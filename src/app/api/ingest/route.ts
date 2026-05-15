import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import Together from 'together-ai';
import crypto from 'crypto';

// Initialize the Together AI SDK
const together = new Together({ apiKey: process.env.TOGETHER_API_KEY || '' });

// In-memory deduplication cache: hash → analysis result
const analysisCache = new Map<string, AnalyzeIntentResponse>();

// Rate limiter
let lastApiCall = 0;
const MIN_GAP_MS = 2000;

export interface AnalyzeIntentResponse {
  intent: string;
  subject: string;
  entities: {
    deadline: string | null;
    topic: string;
    urls: string[];
    locations: string[];
    key_people: string[];
  };
  raw_text: string;
  chain_id: string;
  priority_weight: number;
  logical_transition: string;
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

    if (!process.env.TOGETHER_API_KEY) {
      console.error('TOGETHER_API_KEY is missing in environment variables.');
      return NextResponse.json({ error: 'Server configuration error: TOGETHER_API_KEY missing. Please add it to your .env.local file.' }, { status: 500 });
    }

    // 1. Convert File to ArrayBuffer and compress AGGRESSIVELY to minimize token usage
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const compressedBuffer = await sharp(buffer)
      .resize(768, 768, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 60 })
      .toBuffer();

    const base64Image = compressedBuffer.toString('base64');
    const dataUrl = `data:image/jpeg;base64,${base64Image}`;

    // 2. Check deduplication cache using content hash
    const imageHash = crypto.createHash('md5').update(compressedBuffer).digest('hex');
    if (analysisCache.has(imageHash)) {
      console.log('[Ingest] Cache HIT — skipping Together AI call entirely.');
      const cachedAnalysis = analysisCache.get(imageHash)!;
      await pushToSupermemory(cachedAnalysis, publicUrl);
      
      return NextResponse.json({ 
        success: true, 
        analysis: cachedAnalysis,
        supermemorySuccess: true,
        cached: true
      }, { status: 200 });
    }

    // 3. Enforce rate limiter
    const now = Date.now();
    const elapsed = now - lastApiCall;
    if (elapsed < MIN_GAP_MS) {
      const waitMs = MIN_GAP_MS - elapsed;
      console.log(`[Ingest] Rate limiter: waiting ${waitMs}ms before calling Together AI...`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }

    // 4. Prepare prompt with strict JSON requirements
    const systemPrompt = `You are an expert AI extraction engine. Your task is to deeply analyze the provided image and extract intent and context in strict JSON format. Do NOT miss critical details. Do NOT hallucinate or add non-existent points.
For "deadline": ONLY extract if explicitly visible, as YYYY-MM-DD. Otherwise null.
For "chain_id": use a consistent, logical slug so related images cluster together (e.g. all database notes use "database_notes", all ML diagrams use "ml_architecture").
Respond ONLY with a valid JSON object matching this exact schema:
{
  "intent": "study_material | job_application | event_attendance | general_note | receipt | contact_info",
  "subject": "Primary topic (under 10 words)",
  "entities": {
    "deadline": "YYYY-MM-DD or null",
    "topic": "Specific sub-topic",
    "urls": ["url1"],
    "locations": ["loc1"],
    "key_people": ["person1"]
  },
  "raw_text": "Brief accurate OCR summary",
  "chain_id": "logical_group_slug",
  "priority_weight": 0.0 to 1.0,
  "logical_transition": "How this connects to related content",
  "suggested_action": "Proactive next step for user",
  "confidence_score": 0.0 to 1.0,
  "detected_language": "Two-letter code"
}`;

    // 5. Execute Together AI call
    console.log('[Ingest] Calling Together AI (Llama 3.2 Vision)...');
    lastApiCall = Date.now();
    let parsedAnalysis: AnalyzeIntentResponse | null = null;
    
    try {
      const response = await together.chat.completions.create({
        model: "meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: systemPrompt },
              { type: "image_url", image_url: { url: dataUrl } }
            ]
          }
        ],
        max_tokens: 1024,
        temperature: 0.1,
        top_p: 0.9,
      });

      let responseText = response.choices[0]?.message?.content || "";
      console.log('[Ingest] Together AI response received.');
      
      // Clean up markdown formatting if the model wrapped it in ```json ... ```
      responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

      try {
        parsedAnalysis = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse JSON from Together AI:', responseText);
        return NextResponse.json({ error: 'Invalid JSON returned from model', rawResponse: responseText }, { status: 500 });
      }
    } catch (apiError: any) {
      console.error('[Ingest] Together AI Error:', apiError.message);
      
      if (apiError.message?.includes('402') || apiError.message?.includes('credit_limit')) {
         return NextResponse.json({ 
           error: `Together AI API Error: 402 Credit limit exceeded. You must add a payment method at api.together.ai/settings/billing to unlock your free credits.` 
         }, { status: 402 });
      }
      return NextResponse.json({ error: `Together AI API Error: ${apiError.message}` }, { status: 500 });
    }

    if (!parsedAnalysis) {
      return NextResponse.json({ error: 'Failed to get analysis from model.' }, { status: 500 });
    }

    // 6. Cache the result
    analysisCache.set(imageHash, parsedAnalysis);

    // 7. Push to Supermemory
    const smResult = await pushToSupermemory(parsedAnalysis, publicUrl);

    return NextResponse.json({ 
      success: true, 
      analysis: parsedAnalysis,
      supermemorySuccess: smResult.success,
      supermemoryError: smResult.error
    }, { status: 200 });
    
  } catch (error: any) {
    console.error('API Route Error:', error.message);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// Helper: push analysis to Supermemory knowledge graph
async function pushToSupermemory(analysis: AnalyzeIntentResponse, publicUrl: string): Promise<{ success: boolean; error: string | null }> {
  try {
    if (!process.env.SUPERMEMORY_TOKEN) {
      throw new Error("SUPERMEMORY_TOKEN is missing.");
    }

    const response = await fetch("https://api.supermemory.ai/v3/documents", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        "Authorization": `Bearer ${process.env.SUPERMEMORY_TOKEN}` 
      },
      body: JSON.stringify({
        content: `[${analysis.intent}] ${analysis.subject}: ${analysis.raw_text}. Action: ${analysis.suggested_action}. Chain: ${analysis.chain_id}`,
        metadata: {
          url: publicUrl,
          subject: analysis.subject,
          deadline: analysis.entities.deadline || '',
          chain_id: analysis.chain_id,
          intent: analysis.intent,
          priority_weight: analysis.priority_weight,
          topic: analysis.entities.topic
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Supermemory ${response.status}: ${errText}`);
    }

    console.log('[Ingest] Supermemory ingestion succeeded.');
    return { success: true, error: null };
  } catch (err: any) {
    console.error("Supermemory Warning:", err.message);
    return { success: false, error: err.message };
  }
}
