import fs from 'fs';

async function testIntelligenceLogic(text: string, scenarioName: string) {
  console.log(`\\n======================================================`);
  console.log(`🧪 Running Scenario: ${scenarioName}`);
  console.log(`======================================================`);

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error("Please set GROQ_API_KEY in your environment to run this script.");
    return;
  }

  const systemPrompt = `You are a Proactive Intent Rescuer and expert behavioral analysis engine for the Grasp app. 
Analyze this raw OCR text (extracted from an image) and output exactly one JSON object. Do not include conversational text, markdown formatting like \`\`\`json, or any preamble. 

JSON Schema:
{
  "intent": "Short label classifying the action (e.g., study_material, job_application, event_attendance, general_note)",
  "subject": "Primary topic of the image (e.g., Thermodynamics, SWE Intern, Tech Talk)",
  "entities": {
    "deadline": "Extracted date (YYYY-MM-DD) or null if not present",
    "topic": "Specific sub-topic or focus area",
    "urls": ["Array of any extracted URLs or links"]
  },
  "raw_text": "Extract a brief summary or the most important raw text from the image",
  "chain_id": "Generate a unique semantic hash string (e.g., 'thermo_lecture_1') to group this with conceptually related images",
  "priority_weight": 0.85, 
  "logical_transition": "Explanation of how this connects to the subject to help the Semantic Stitcher provide a smooth reading experience"
}

Scoring Rules:
- priority_weight must be a float between 0.0 and 1.0. 
- Higher priority (0.8 - 1.0) for high-decay items like upcoming deadlines, job applications, or time-sensitive events.
- Lower priority (0.1 - 0.5) for general notes or long-term reference material without immediate action needed.`;

  const groqPayload = {
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: `Here is the OCR text extracted from the screenshot:\\n\\n"${text}"`
      }
    ],
    temperature: 0.1,
    max_tokens: 800,
  };

  try {
    const startTime = Date.now();
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(groqPayload),
    });

    const endTime = Date.now();

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ HTTP Error: ${response.status} - ${errorText}`);
      return;
    }

    const data = await response.json();
    let messageContent = data.choices[0]?.message?.content || '';
    messageContent = messageContent.replace(/```json/g, '').replace(/```/g, '').trim();

    const parsedResult = JSON.parse(messageContent);
    
    console.log(`✅ Success! Inference took ${endTime - startTime}ms.`);
    console.log(`Intent Type:        ${parsedResult.intent}`);
    console.log(`Subject:            ${parsedResult.subject}`);
    console.log(`Priority Weight:    ${parsedResult.priority_weight} (0.0 to 1.0)`);
    console.log(`Deadline:           ${parsedResult.entities?.deadline}`);
    console.log(`URLs:               ${parsedResult.entities?.urls?.join(', ')}`);
    console.log(`Chain ID:           ${parsedResult.chain_id}`);
    console.log(`Logical Transition: ${parsedResult.logical_transition}`);
    console.log(`Raw Text Summary:   ${parsedResult.raw_text}`);
  } catch (error) {
    console.error('❌ Fetch failed:', error);
  }
}

async function runTextEvaluations() {
  const jobHuntText = "Frontend Developer Internship at Google. Requirements: React, Next.js, and Tailwind CSS. Apply by May 25, 2026. Send applications via careers.google.com";
  await testIntelligenceLogic(jobHuntText, 'Late-Night Job Hunt');
  
  const thermoText = "Lecture 4: Thermodynamics. The Carnot cycle consists of four reversible processes: 1. Isothermal expansion, 2. Adiabatic expansion, 3. Isothermal compression, 4. Adiabatic compression. Next class: Entropy derivations.";
  await testIntelligenceLogic(thermoText, 'Thermodynamics Continuity');
}

runTextEvaluations();
