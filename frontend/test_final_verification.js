import puppeteer from 'puppeteer';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

async function runFinalVerification() {
  console.log('--- 1. Testing Dompdf Backend Path ---');
  try {
    const phpRes = execSync('php ../api/scratch_dompdf_debug.php').toString();
    console.log(phpRes);
  } catch (err) {
    console.error('PHP execution error:', err.message);
  }

  console.log('--- 2. Testing Frontend / Live React Component Path via Puppeteer ---');
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  await page.setViewport({ width: 1280, height: 1200 });
  
  // Set localStorage user session
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

  // Get final computed width of .agreements-contract-wrapper & header text bounding boxes
  const metrics = await page.evaluate(() => {
    const wrapper = document.querySelector('.agreements-contract-wrapper');
    const pHeader = wrapper ? wrapper.querySelector('p') : null;
    const h2Header = wrapper ? wrapper.querySelector('h2') : null;
    const pageElem = wrapper ? wrapper.querySelector('.page') : null;

    const wBox = wrapper ? wrapper.getBoundingClientRect() : null;
    const pBox = pHeader ? pHeader.getBoundingClientRect() : null;
    const pageBox = pageElem ? pageElem.getBoundingClientRect() : null;

    return {
      wrapperWidth: wBox ? wBox.width : 0,
      wrapperLeft: wBox ? wBox.left : 0,
      wrapperRight: wBox ? wBox.right : 0,
      pageWidth: pageBox ? pageBox.width : 0,
      headerTextRight: pBox ? pBox.right : 0,
      headerTextContent: pHeader ? pHeader.textContent : '',
      headerTextWidth: pBox ? pBox.width : 0,
      headerRightPadding: pHeader && pHeader.parentElement ? window.getComputedStyle(pHeader.parentElement).paddingRight : ''
    };
  });
  console.log('METRICS:', JSON.stringify(metrics, null, 2));

  // Screenshot frontend live contract component
  await page.screenshot({ path: './final_frontend_contract_render.png', fullPage: true });

  // Generate PDF from element
  const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' } });
  fs.writeFileSync('./final_frontend_contract.pdf', pdfBuffer);

  // Now render both PDFs (Frontend & Dompdf) to high-res PNG for visual inspection
  const pdfPage1 = await browser.newPage();
  await pdfPage1.setViewport({ width: 1200, height: 1600 });
  
  const frontendPdfUrl = 'file:///' + path.resolve('./final_frontend_contract.pdf').replace(/\\/g, '/');
  await pdfPage1.goto(frontendPdfUrl, { waitUntil: 'networkidle0' });
  await pdfPage1.screenshot({ path: './final_frontend_pdf_screenshot.png', fullPage: true });

  const dompdfPdfUrl = 'file:///' + path.resolve('../api/dompdf_debug_output.pdf').replace(/\\/g, '/');
  await pdfPage1.goto(dompdfPdfUrl, { waitUntil: 'networkidle0' });
  await pdfPage1.screenshot({ path: './final_backend_dompdf_screenshot.png', fullPage: true });

  await browser.close();
  console.log('Final verification complete!');
}

runFinalVerification().catch(console.error);
