// seed-to-supabase.ts
// Run this using: `npx tsx scripts/seed-to-supabase.ts`

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function seedImage(filename: string) {
  console.log(`\n--- Seeding ${filename} ---`);
  const imagePath = path.join(__dirname, filename);
  
  if (!fs.existsSync(imagePath)) {
    console.error(`❌ Error: ${filename} does not exist.`);
    return;
  }

  const fileBuffer = fs.readFileSync(imagePath);
  
  // 1. Upload to Supabase
  const uniqueFileName = `${Date.now()}_${filename}`;
  const filePath = `uploads/${uniqueFileName}`;
  
  console.log('⬆️ Uploading to Supabase...');
  const { error: uploadError } = await supabase.storage
    .from('grasp-moments')
    .upload(filePath, fileBuffer, {
      contentType: 'image/jpeg',
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    console.error('❌ Supabase Upload Failed:', uploadError.message);
    return;
  }

  const { data: publicUrlData } = supabase.storage
    .from('grasp-moments')
    .getPublicUrl(filePath);

  const publicUrl = publicUrlData.publicUrl;
  console.log('✅ Uploaded to:', publicUrl);

  // 2. Hit /api/ingest
  console.log('🚀 Stitching into Memory...');
  const blob = new Blob([fileBuffer], { type: 'image/jpeg' });
  const formData = new FormData();
  formData.append('image', blob, filename);
  formData.append('publicUrl', publicUrl);

  const ingestResponse = await fetch('http://localhost:3000/api/ingest', {
    method: 'POST',
    body: formData,
  });

  if (!ingestResponse.ok) {
    console.error('❌ Ingest Failed:', ingestResponse.statusText);
    return;
  }

  const data = await ingestResponse.json();
  console.log(`✅ Success! Supermemory Status: ${data.supermemorySuccess ? 'SUCCESS' : 'FAILED'}`);
  console.log(`Intent Captured: ${data.analysis.subject}`);
}

async function runSeed() {
  await seedImage('eval-job-hunt.jpg');
  await seedImage('eval-thermo.jpg');
  await seedImage('complex-receipt.jpg');
  console.log('\n🎉 All seeding complete!');
}

runSeed();
