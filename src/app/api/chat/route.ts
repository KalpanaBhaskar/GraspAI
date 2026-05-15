import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }
    if (!process.env.SUPERMEMORY_TOKEN) {
      return NextResponse.json({ error: 'SUPERMEMORY_TOKEN is missing' }, { status: 500 });
    }
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is missing' }, { status: 500 });
    }

    // 1. Search Supermemory for relevant context
    console.log('[Chat] Searching Supermemory for:', message);
    const smResponse = await fetch('https://api.supermemory.ai/v3/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPERMEMORY_TOKEN}`,
      },
      body: JSON.stringify({ q: message, limit: 10 }),
    });

    let results: any[] = [];
    if (smResponse.ok) {
      const smData = await smResponse.json();
      results = smData.results || [];
      console.log('[Chat] Found', results.length, 'relevant memories.');
    } else {
      console.warn('[Chat] Supermemory search failed:', smResponse.status);
    }

    // 2. Extract unique image URLs and cluster metadata
    const relevantImages: string[] = [];
    const clusterMap: Record<string, { title: string; images: string[]; deadline: string | null; intent: string }> = {};
    const seenUrls = new Set<string>();

    for (const r of results) {
      const url = r.metadata?.url;
      const chainId = r.metadata?.chain_id || 'uncategorized';
      const subject = r.metadata?.subject || r.title || 'Untitled';
      const deadline = r.metadata?.deadline || null;
      const intent = r.metadata?.intent || 'general_note';

      if (url && !seenUrls.has(url)) {
        seenUrls.add(url);
        relevantImages.push(url);

        if (!clusterMap[chainId]) {
          clusterMap[chainId] = { title: subject, images: [], deadline, intent };
        }
        clusterMap[chainId].images.push(url);
      }
    }

    // Convert cluster map to array
    const clusters = Object.entries(clusterMap).map(([chainId, data]) => ({
      chainId,
      title: data.title,
      images: data.images,
      deadline: data.deadline,
      intent: data.intent,
      imageCount: data.images.length,
    }));

    // 3. Compile context for Gemini
    const contextText = results
      .map((r: any) => {
        const chunks = r.chunks?.map((c: any) => c.content).join(' ') || r.content || '';
        return `Document: "${r.metadata?.subject || r.title || 'Untitled'}"\nChain: ${r.metadata?.chain_id || 'N/A'}\nContent: ${chunks}\nImage: ${r.metadata?.url || 'N/A'}\nDeadline: ${r.metadata?.deadline || 'None'}`;
      })
      .join('\n\n---\n\n');

    // 4. Generate answer with Gemini
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-3.1-flash-lite',
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1024,
      }
    });

    const prompt = `You are GraspAI, a helpful and precise memory assistant. The user's uploaded images have been analyzed and stored as knowledge. 

User's question: "${message}"

Retrieved context from their memory graph:
${contextText || '(No relevant memories found)'}

CRITICAL RULES:
- Answer ONLY based on the retrieved context above. NEVER hallucinate or assume facts.
- If you find matching documents, summarize them clearly and mention which images are relevant.
- If the user asks for a list or sequence, format it as a clean numbered list or table.
- If the user asks about deadlines, only mention deadlines that are explicitly in the context.
- If no relevant memories are found, say: "I couldn't find anything matching that in your uploaded memories. Try uploading more images related to this topic."
- Be concise, direct, and helpful.
- When referencing images, mention their subject/title so the user knows which card to look at.`;

    console.log('[Chat] Calling Gemini for answer...');
    const result = await model.generateContent(prompt);
    const answer = result.response.text();

    return NextResponse.json({
      answer,
      images: relevantImages,
      clusters,
    });
  } catch (error: any) {
    console.error('[Chat] Error:', error.message);
    
    if (error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED')) {
      return NextResponse.json({
        answer: 'I need a moment — the AI is processing too many requests. Please wait 15 seconds and try again.',
        images: [],
        clusters: [],
      });
    }

    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
