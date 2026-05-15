// test-ingest.ts
// Run this using: `npx tsx scripts/test-ingest.ts`

import fs from 'fs';
import path from 'path';

async function testIngestPipeline() {
  const LOCAL_API_URL = 'http://localhost:3000/api/ingest';
  const MOCK_PUBLIC_URL = 'https://gfasqzpxsxxvzhrgtjtq.supabase.co/storage/v1/object/public/grasp-moments/uploads/test-image-123.jpg';
  
  const imagePath = path.join(__dirname, 'complex-receipt.jpg');
  
  if (!fs.existsSync(imagePath)) {
    console.error(`❌ Error: Please ensure 'complex-receipt.jpg' exists.`);
    return;
  }

  console.log('🖼️ Reading and compressing image file...');
  const fileBuffer = fs.readFileSync(imagePath);
  const blob = new Blob([fileBuffer], { type: 'image/jpeg' });
  
  const formData = new FormData();
  formData.append('image', blob, 'complex-receipt.jpg');
  formData.append('publicUrl', MOCK_PUBLIC_URL);

  console.log('🚀 Sending request to local API Route (/api/ingest)...');
  try {
    const startTime = Date.now();
    const response = await fetch(LOCAL_API_URL, {
      method: 'POST',
      body: formData,
    });

    const endTime = Date.now();

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ HTTP Error: ${response.status} - ${errorText}`);
      return;
    }

    const data = await response.json();
    console.log(`\\n✅ Success! Pipeline execution took ${endTime - startTime}ms.`);
    console.log('Supermemory Integration Status:', data.supermemorySuccess ? '✅ SUCCESS' : `❌ FAILED (${data.supermemoryError})`);
    
    console.log('\\n🧠 Extracted Semantic Intent & Supermemory Logic:');
    console.log('================================================');
    console.log(`Intent Type:        ${data.analysis.intent}`);
    console.log(`Subject:            ${data.analysis.subject}`);
    console.log(`Priority Weight:    ${data.analysis.priority_weight} (0.0 to 1.0)`);
    console.log(`Suggested Action:   ${data.analysis.suggested_action}`);
    console.log(`Chain ID:           ${data.analysis.chain_id}`);
    
    console.log('\\n📌 Entities:');
    console.log(` - Deadline:    ${data.analysis.entities?.deadline || 'None'}`);
    console.log(` - Topic:       ${data.analysis.entities?.topic || 'None'}`);
    console.log(` - URLs:        ${data.analysis.entities?.urls?.join(', ') || 'None'}`);
    console.log(` - Locations:   ${data.analysis.entities?.locations?.join(', ') || 'None'}`);
    console.log(` - Key People:  ${data.analysis.entities?.key_people?.join(', ') || 'None'}`);
    console.log('================================================');

  } catch (error) {
    console.error('❌ Fetch failed:', error);
  }
}

testIngestPipeline();
