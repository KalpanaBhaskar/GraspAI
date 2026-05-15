import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import sharp from 'sharp';
import crypto from 'crypto';

// ──────────────── Gemini 3.1 Flash Lite ────────────────
// Free tier: 30 req/min, 1500 req/day
// We enforce 5 req/min (12s gap) to stay safely under limits
// ────────────────────────────────────────────────────────
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// In-memory deduplication cache: md5(image) → analysis result
const analysisCache = new Map<string, AnalysisResult>();

// Rate limiter — enforces 12-second gap (5 req/min)
const callTimestamps: number[] = [];
const MAX_CALLS_PER_MIN = 5;
const WINDOW_MS = 60_000;

function checkRateLimit(): { allowed: boolean; waitMs: number } {
  const now = Date.now();
  // Remove timestamps older than 1 minute
  while (callTimestamps.length > 0 && callTimestamps[0] < now - WINDOW_MS) {
    callTimestamps.shift();
  }
  if (callTimestamps.length >= MAX_CALLS_PER_MIN) {
    const waitMs = callTimestamps[0] + WINDOW_MS - now;
    return { allowed: false, waitMs };
  }
  return { allowed: true, waitMs: 0 };
}

export interface AnalysisResult {
  intent: string;
  subject: string;
  entities: {
    deadline: string | null;
    urgency: 'due_soon' | 'none';
    topic: string;
    urls: string[];
    locations: string[];
    key_people: string[];
    key_terms: string[];
  };
  raw_text: string;
  chain_id: string;
  category: 'whats_next' | 'working_on' | 'other';
  priority_weight: number;
  suggested_action: string;
  confidence_score: number;
  detected_language: string;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('image') as File | null;
    const publicUrl = formData.get('publicUrl') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }
    if (!publicUrl) {
      return NextResponse.json({ error: 'Supabase publicUrl not provided' }, { status: 400 });
    }
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is missing. Add it to your .env.local file.' }, { status: 500 });
    }

    // 1. Compress image for efficient token usage
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const compressedBuffer = await sharp(buffer)
      .resize(768, 768, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 65 })
      .toBuffer();

    // 2. Check deduplication cache
    const imageHash = crypto.createHash('md5').update(compressedBuffer).digest('hex');
    if (analysisCache.has(imageHash)) {
      console.log('[Ingest] Cache HIT — skipping Gemini call.');
      const cached = analysisCache.get(imageHash)!;
      const smResult = await pushToSupermemory(cached, publicUrl);
      return NextResponse.json({ success: true, analysis: cached, supermemorySuccess: smResult.success, cached: true });
    }

    // 3. Rate limit check
    const rl = checkRateLimit();
    if (!rl.allowed) {
      const waitSec = Math.ceil(rl.waitMs / 1000);
      console.log(`[Ingest] Rate limit reached. User must wait ${waitSec}s.`);
      return NextResponse.json({
        error: `GraspAI is processing too fast! Free tier allows 5 images per minute. Please wait ${waitSec} seconds and try again.`,
        retryAfterMs: rl.waitMs,
      }, { status: 429 });
    }

    // 4. Build the deep-extraction prompt — ULTRA-STRICT anti-hallucination
    const prompt = `You are GraspAI, an expert image analysis engine. Analyze this image and extract ONLY what is actually visible.

ABSOLUTE RULES — VIOLATION MEANS FAILURE:

1. DEADLINE RULE (MOST IMPORTANT):
   - Set "deadline" to a date string ONLY if you can see an explicit, complete date written on the image (e.g. "May 15, 2026", "15/05/2026", "2026-05-15", "April 30").
   - If the image says vague things like "in 3 days", "next week", "soon", "ASAP" — set "deadline" to null and set "urgency" to "due_soon".
   - If there is NO date and NO urgency language — set "deadline" to null and "urgency" to "none".
   - NEVER compute or calculate a date. NEVER guess. NEVER invent a date that isn't literally printed on the image.
   
   WRONG: Image says "Apply within 3 days" → deadline: "2026-05-18"  ← THIS IS HALLUCINATION
   RIGHT: Image says "Apply within 3 days" → deadline: null, urgency: "due_soon"
   RIGHT: Image says "Deadline: April 30" → deadline: "2026-04-30", urgency: "none"

2. CONTENT RULE: Extract ONLY text and information visible in the image. Never add context from your training data.

3. CHAIN_ID RULE: Use a short consistent slug so the SAME topic always gets the SAME chain_id:
   - Database notes, queries, ER diagrams → "database_notes"
   - Machine learning, neural networks → "ml_architecture"  
   - Internship/job listings → "internship_applications"
   - Thermodynamics, heat engines → "thermodynamics_notes"

4. CATEGORY RULE:
   - "whats_next" → job applications, events, tasks with deadlines or urgency
   - "working_on" → study notes, lecture content, diagrams, code
   - "other" → receipts, bills, contacts, miscellaneous

Return this exact JSON schema:
{
  "intent": "study_material | job_application | event_attendance | general_note | receipt | contact_info | project_diagram",
  "subject": "Primary topic in under 10 words",
  "entities": {
    "deadline": "YYYY-MM-DD or null (ONLY if explicitly written)",
    "urgency": "due_soon | none",
    "topic": "Specific sub-topic",
    "urls": ["any URLs visible"],
    "locations": ["any locations mentioned"],
    "key_people": ["any people/organizations mentioned"],
    "key_terms": ["keyword1", "keyword2", "keyword3"]
  },
  "raw_text": "Accurate transcription of key visible text",
  "chain_id": "semantic_group_slug",
  "category": "whats_next | working_on | other",
  "priority_weight": 0.0 to 1.0,
  "suggested_action": "What the user should do next with this image",
  "confidence_score": 0.0 to 1.0,
  "detected_language": "en"
}`;

    // 5. Call Gemini 3.1 Flash Lite
    console.log('[Ingest] Calling Gemini 3.1 Flash Lite...');
    callTimestamps.push(Date.now());

    const base64Image = compressedBuffer.toString('base64');

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-3.1-flash-lite',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
        maxOutputTokens: 1024,
      }
    });

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Image,
        }
      }
    ]);

    const responseText = result.response.text();
    console.log('[Ingest] Gemini response received.');

    let parsedAnalysis: AnalysisResult;
    try {
      parsedAnalysis = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[Ingest] JSON parse failed. Raw:', responseText);
      return NextResponse.json({ error: 'Invalid JSON from Gemini', rawResponse: responseText }, { status: 500 });
    }

    // 6. Cache the result
    analysisCache.set(imageHash, parsedAnalysis);

    // 7. Push to Supermemory
    const smResult = await pushToSupermemory(parsedAnalysis, publicUrl);

    return NextResponse.json({
      success: true,
      analysis: parsedAnalysis,
      supermemorySuccess: smResult.success,
      supermemoryError: smResult.error,
    });

  } catch (error: any) {
    console.error('[Ingest] Error:', error.message);
    
    // Handle Gemini rate limit errors gracefully
    if (error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED')) {
      return NextResponse.json({
        error: 'Gemini daily limit reached. The free tier allows ~1500 requests/day. Please try again in a few minutes, or wait until the quota resets.',
      }, { status: 429 });
    }

    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

// ──────────────── Supermemory Integration ────────────────
async function pushToSupermemory(analysis: AnalysisResult, publicUrl: string): Promise<{ success: boolean; error: string | null }> {
  try {
    if (!process.env.SUPERMEMORY_TOKEN) {
      throw new Error('SUPERMEMORY_TOKEN is missing.');
    }

    // Build rich semantic content for Supermemory vector indexing
    const keyTerms = analysis.entities?.key_terms?.join(', ') || '';
    const content = [
      `[${analysis.intent}] ${analysis.subject}`,
      `Category: ${analysis.category}`,
      `Topic: ${analysis.entities?.topic || 'General'}`,
      `Key Terms: ${keyTerms}`,
      `Text: ${analysis.raw_text}`,
      `Action: ${analysis.suggested_action}`,
      `Chain: ${analysis.chain_id}`,
      analysis.entities?.deadline ? `Deadline: ${analysis.entities.deadline}` : '',
      analysis.entities?.key_people?.length ? `People: ${analysis.entities.key_people.join(', ')}` : '',
    ].filter(Boolean).join('. ');

    const response = await fetch('https://api.supermemory.ai/v3/documents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPERMEMORY_TOKEN}`,
      },
      body: JSON.stringify({
        content,
        metadata: {
          url: publicUrl,
          subject: analysis.subject,
          deadline: analysis.entities?.deadline || '',
          chain_id: analysis.chain_id,
          intent: analysis.intent,
          category: analysis.category,
          priority_weight: analysis.priority_weight,
          topic: analysis.entities?.topic || '',
          key_terms: keyTerms,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Supermemory ${response.status}: ${errText}`);
    }

    console.log('[Ingest] Supermemory ingestion succeeded.');
    return { success: true, error: null };
  } catch (err: any) {
    console.error('[Ingest] Supermemory Warning:', err.message);
    return { success: false, error: err.message };
  }
}
