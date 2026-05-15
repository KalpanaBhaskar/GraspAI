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

    // 1. Retrieve context from Supermemory
    console.log('[Chat] Searching Supermemory for:', message);
    const smResponse = await fetch('https://api.supermemory.ai/v3/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPERMEMORY_TOKEN}`,
      },
      body: JSON.stringify({ q: message, limit: 5 }),
    });

    if (!smResponse.ok) {
      const errText = await smResponse.text();
      console.error('Supermemory Search Failed:', smResponse.status, errText);
      throw new Error('Failed to retrieve memory context');
    }

    const smData = await smResponse.json();
    const results = smData.results || [];
    console.log('[Chat] Found', results.length, 'relevant memories.');

    // Extract unique image URLs to return to the frontend
    const relevantImages: string[] = [];
    const seenUrls = new Set<string>();
    for (const r of results) {
      const url = r.metadata?.url;
      if (url && !seenUrls.has(url)) {
        seenUrls.add(url);
        relevantImages.push(url);
      }
    }

    // Compile context for Gemini
    const contextText = results
      .map((r: any) => {
        const chunks = r.chunks?.map((c: any) => c.content).join(' ') || '';
        return `Document: "${r.title}"\nContent: ${chunks}\nImage URL: ${r.metadata?.url || 'N/A'}`;
      })
      .join('\n\n---\n\n');

    // 2. Generate Answer using Gemini
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });
    
    const prompt = `You are GraspAI, a helpful, crisp, and direct memory assistant. 
The user asked: "${message}"

Here is the retrieved context from their personal memory graph:
${contextText || '(No relevant memories found)'}

Instructions:
- Answer the user's question clearly and concisely based ONLY on the provided context.
- If the answer is not in the context, politely state that you cannot find it in their uploaded memories.
- Do NOT hallucinate or make up information.
- Keep your answer short and actionable.
- If you reference specific documents, mention their titles.`;

    console.log('[Chat] Calling Gemini for answer generation...');
    const result = await model.generateContent(prompt);
    const answer = result.response.text();

    return NextResponse.json({
      answer,
      images: relevantImages,
    });
  } catch (error: any) {
    console.error('Chat API Error:', error.message);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
