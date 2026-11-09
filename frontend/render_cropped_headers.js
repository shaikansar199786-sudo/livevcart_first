import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

async function cropHeaders() {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 2 });

  // Open generated PDF
  const pdfPath = path.resolve('./generated_contract_test.pdf');
  const pdfUrl = 'file:///' + pdfPath.replace(/\\/g, '/');
  await page.goto(pdfUrl, { waitUntil: 'networkidle0' });

  const artifactDir = 'C:\\Users\\Shaik Ansar\\.gemini\\antigravity-ide\\brain\\e814efe6-6697-4e8f-a7b8-d701e4652717';

  // 1. Works Contract Top Header Crop
  const worksHeaderPath = path.join(artifactDir, 'works_contract_header_photo.png');
  await page.screenshot({
    path: worksHeaderPath,
    clip: { x: 40, y: 30, width: 1120, height: 350 }
  });
  console.log('Saved Works Contract Header Photo to:', worksHeaderPath);

  // 2. Scroll to Handover Agreement section and capture Handover Header Crop
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight - 1400));
  await new Promise(r => setTimeout(r, 800));

  const handoverHeaderPath = path.join(artifactDir, 'handover_agreement_header_photo.png');
  await page.screenshot({
    path: handoverHeaderPath,
    clip: { x: 40, y: 50, width: 1120, height: 400 }
  });
  console.log('Saved Handover Agreement Header Photo to:', handoverHeaderPath);

  await browser.close();
}

cropHeaders().catch(console.error);
