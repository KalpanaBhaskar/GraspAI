import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

async function createTextImage(text: string, filename: string) {
  const width = 800;
  const height = 400;
  
  // Wrap text simply by inserting newlines (very basic wrapping for SVG)
  const words = text.split(' ');
  let line = '';
  let y = 50;
  const lines = [];
  for (const word of words) {
    if ((line + word).length > 50) {
      lines.push(`<text x="50" y="${y}" font-family="Arial" font-size="24" fill="black">${line}</text>`);
      line = word + ' ';
      y += 35;
    } else {
      line += word + ' ';
    }
  }
  lines.push(`<text x="50" y="${y}" font-family="Arial" font-size="24" fill="black">${line}</text>`);

  const svgImage = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="white"/>
      ${lines.join('\\n')}
    </svg>
  `;
  
  const outputPath = path.join(__dirname, filename);
  await sharp(Buffer.from(svgImage))
    .jpeg()
    .toFile(outputPath);
    
  return outputPath;
}

async function testApi(imagePath: string, scenarioName: string) {
  console.log(`\\n======================================================`);
  console.log(`🧪 Running Scenario: ${scenarioName}`);
  console.log(`======================================================`);
  
  const LOCAL_API_URL = 'http://localhost:3000/api/analyze-intent';
  const fileBuffer = fs.readFileSync(imagePath);
  const blob = new Blob([fileBuffer], { type: 'image/jpeg' });
  
  const formData = new FormData();
  formData.append('image', blob, path.basename(imagePath));

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
    console.log(`✅ Success! Inference took ${endTime - startTime}ms.`);
    console.log(`Intent Type:        ${data.intent}`);
    console.log(`Subject:            ${data.subject}`);
    console.log(`Priority Weight:    ${data.priority_weight} (0.0 to 1.0)`);
    console.log(`Deadline:           ${data.entities?.deadline}`);
    console.log(`URLs:               ${data.entities?.urls?.join(', ')}`);
    console.log(`Chain ID:           ${data.chain_id}`);
    console.log(`Logical Transition: ${data.logical_transition}`);
    console.log(`Raw Text Summary:   ${data.raw_text}`);
  } catch (error) {
    console.error('❌ Fetch failed:', error);
  }
}

async function runEvaluations() {
  // Scenario 1: Late-Night Job Hunt
  console.log('Generating images for evaluation...');
  const jobHuntText = "Frontend Developer Internship at Google. Requirements: React, Next.js, and Tailwind CSS. Apply by May 25, 2026. Send applications via careers.google.com";
  const jobHuntPath = await createTextImage(jobHuntText, 'eval-job-hunt.jpg');
  
  // Scenario 2: Thermodynamics Continuity
  const thermoText = "Lecture 4: Thermodynamics. The Carnot cycle consists of four reversible processes: 1. Isothermal expansion, 2. Adiabatic expansion, 3. Isothermal compression, 4. Adiabatic compression. Next class: Entropy derivations.";
  const thermoPath = await createTextImage(thermoText, 'eval-thermo.jpg');
  
  // Run Tests
  await testApi(jobHuntPath, 'Late-Night Job Hunt');
  await testApi(thermoPath, 'Thermodynamics Continuity');
}

runEvaluations();
