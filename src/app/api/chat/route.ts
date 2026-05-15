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
      body: JSON.stringify({ q: message, limit: 15 }),
    });

    let results: any[] = [];
    if (smResponse.ok) {
      const smData = await smResponse.json();
      results = smData.results || [];
      console.log('[Chat] Found', results.length, 'raw Supermemory results.');
    } else {
      console.warn('[Chat] Supermemory search failed:', smResponse.status);
    }

    // 2. Build context for Gemini — let the LLM decide which results are truly relevant
    const contextDocs = results.map((r: any, idx: number) => {
      const chunks = r.chunks?.map((c: any) => c.content).join(' ') || r.content || '';
      return {
        index: idx,
        subject: r.metadata?.subject || r.title || 'Untitled',
        chainId: r.metadata?.chain_id || 'uncategorized',
        content: chunks,
        url: r.metadata?.url || null,
        deadline: r.metadata?.deadline || null,
        intent: r.metadata?.intent || 'general_note',
        topic: r.metadata?.topic || '',
      };
    });

    const contextText = contextDocs
      .map(d => `[${d.index}] Subject: "${d.subject}" | Chain: ${d.chainId} | Topic: ${d.topic} | Content: ${d.content} | Deadline: ${d.deadline || 'None'}`)
      .join('\n\n');

    // 3. Ask Gemini to answer AND select only the relevant document indices
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-3.1-flash-lite',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.15,
        maxOutputTokens: 1024,
      }
    });

    const prompt = `You are GraspAI, a precise memory assistant. The user has uploaded images that were analyzed and stored.

User's question: "${message}"

Here are ALL retrieved documents (some may be IRRELEVANT):
${contextText || '(No documents found)'}

YOUR TASK:
1. Read the user's question carefully.
2. From the documents above, select ONLY the ones that ACTUALLY answer the user's question. Be strict — if a document is about a different topic, EXCLUDE it.
3. Write a clear, concise answer based ONLY on the relevant documents.
4. List the indices of the relevant documents.

CRITICAL RULES:
- If the user asks about "DBMS" or "database", ONLY include documents about databases. Do NOT include machine learning, thermodynamics, or other topics.
- NEVER hallucinate. Only reference information from the documents.
- If no documents are relevant, say so honestly.

Return this JSON:
{
  "answer": "Your clear, concise answer text",
  "relevant_indices": [0, 2, 5],
  "cluster_title": "A short title for the collection of relevant images (e.g. 'Database Notes', 'Internship Applications')"
}`;

    console.log('[Chat] Calling Gemini for filtered answer...');
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    let geminiResponse: { answer: string; relevant_indices: number[]; cluster_title: string };
    try {
      geminiResponse = JSON.parse(responseText);
    } catch {
      // Fallback if JSON parsing fails
      geminiResponse = {
        answer: responseText,
        relevant_indices: contextDocs.map(d => d.index),
        cluster_title: 'Search Results'
      };
    }

    // 4. Filter to ONLY the relevant documents
    const relevantDocs = geminiResponse.relevant_indices
      .filter(i => i >= 0 && i < contextDocs.length)
      .map(i => contextDocs[i])
      .filter(d => d.url); // only docs with actual images

    // 5. Build ONE unified cluster from all relevant images
    const relevantImages = relevantDocs.map(d => d.url!);
    const uniqueImages = [...new Set(relevantImages)];

    const clusters = uniqueImages.length > 0 ? [{
      chainId: `chat_cluster_${Date.now()}`,
      title: geminiResponse.cluster_title || 'Search Results',
      images: uniqueImages,
      deadline: relevantDocs.find(d => d.deadline)?.deadline || null,
      intent: relevantDocs[0]?.intent || 'general_note',
      imageCount: uniqueImages.length,
    }] : [];

    return NextResponse.json({
      answer: geminiResponse.answer,
      images: uniqueImages,
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
