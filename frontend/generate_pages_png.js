import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

async function generateImages() {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  await page.setViewport({ width: 1280, height: 1200 });
  
  // Authenticate
  await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    const dummyUser = {
      user_id: 1,
      name: "Admin Sukku",
      username: "shaiksalman9951@gmail.com",
      role: "admin",
      phone: "9182263332"
    };
    localStorage.setItem("user", JSON.stringify(dummyUser));
  });
  
  await page.goto('http://localhost:5173/agreements', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  
  // Click Create New Agreement
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text && text.includes('Create New Agreement')) {
      await btn.click();
      break;
    }
  }
  await new Promise(r => setTimeout(r, 2000));

  // Check the Handover checkbox to ensure Handover Agreement page is included
  const checkboxes = await page.$$('input[type="checkbox"]');
  for (const cb of checkboxes) {
    const isChecked = await page.evaluate(el => el.checked, cb);
    if (!isChecked) {
      await cb.click();
      await new Promise(r => setTimeout(r, 500));
    }
  }

  // Generate PDF from live contract wrapper element
  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '4mm', right: '4mm', bottom: '4mm', left: '4mm' }
  });
  
  const pdfPath = path.resolve('./generated_contract_test.pdf');
  fs.writeFileSync(pdfPath, pdfBuffer);
  console.log('PDF saved to:', pdfPath);

  // Load PDF in browser to render Page 1 and Last Page as images
  const pdfPage = await browser.newPage();
  await pdfPage.setViewport({ width: 1200, height: 1600 });
  const pdfUrl = 'file:///' + pdfPath.replace(/\\/g, '/');
  await pdfPage.goto(pdfUrl, { waitUntil: 'networkidle0' });

  // Screenshot Page 1 (Works Contract)
  const page1PngPath = path.resolve('./artifacts_page1_works_contract.png');
  await pdfPage.screenshot({
    path: page1PngPath,
    clip: { x: 0, y: 0, width: 1200, height: 1600 }
  });
  console.log('Page 1 screenshot saved to:', page1PngPath);

  // Scroll to bottom for Last Page (Handover Agreement)
  await pdfPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await new Promise(r => setTimeout(r, 1000));
  
  const lastPagePngPath = path.resolve('./artifacts_lastpage_handover.png');
  await pdfPage.screenshot({
    path: lastPagePngPath,
    fullPage: false
  });
  console.log('Last Page screenshot saved to:', lastPagePngPath);

  // Copy images to artifacts directory so they can be rendered in response
  const artifactDir = 'C:\\Users\\Shaik Ansar\\.gemini\\antigravity-ide\\brain\\e814efe6-6697-4e8f-a7b8-d701e4652717';
  fs.copyFileSync(page1PngPath, path.join(artifactDir, 'works_contract_page1.png'));
  fs.copyFileSync(lastPagePngPath, path.join(artifactDir, 'handover_agreement_lastpage.png'));
  console.log('Artifact images copied successfully!');

  await browser.close();
}

generateImages().catch(console.error);
