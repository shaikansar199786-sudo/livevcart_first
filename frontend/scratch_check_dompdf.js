import puppeteer from 'puppeteer';
import path from 'path';

async function checkDompdfRender() {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  await page.setViewport({ width: 1200, height: 1600 });
  const pdfUrl = 'file:///' + path.resolve('../api/dompdf_debug_output.pdf').replace(/\\/g, '/');
  await page.goto(pdfUrl, { waitUntil: 'networkidle0' });
  
  await page.screenshot({ path: './dompdf_marker_check.png', fullPage: true });
  await browser.close();
  console.log('Dompdf check screenshot saved to dompdf_marker_check.png');
}

checkDompdfRender().catch(console.error);
