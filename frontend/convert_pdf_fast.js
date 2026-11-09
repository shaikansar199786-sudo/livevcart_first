import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

async function convertPdfToPng() {
  const pdfPath = path.resolve('./exported_production_contract.pdf');
  if (!fs.existsSync(pdfPath)) {
    throw new Error('exported_production_contract.pdf does not exist!');
  }
  const pdfBuffer = fs.readFileSync(pdfPath);
  const pdfBase64 = pdfBuffer.toString('base64');

  console.log('1. Launching Puppeteer...');
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded' });
  await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js' });

  const scanResults = await page.evaluate(async (base64Data) => {
    const pdfjs = window['pdfjsLib'];
    pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    const binaryString = atob(base64Data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const pdfDoc = await pdfjs.getDocument({ data: bytes }).promise;
    const totalPages = pdfDoc.numPages;

    async function renderPage(pageNum) {
      const pageObj = await pdfDoc.getPage(pageNum);
      const viewport = pageObj.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');

      await pageObj.render({ canvasContext: ctx, viewport: viewport }).promise;
      return canvas.toDataURL('image/png');
    }

    const p13Png = await renderPage(13);
    const p14Png = await renderPage(14);

    return {
      p13Png,
      p14Png,
      totalPages
    };
  }, pdfBase64);

  const p13Buffer = Buffer.from(scanResults.p13Png.split(',')[1], 'base64');
  const p14Buffer = Buffer.from(scanResults.p14Png.split(',')[1], 'base64');

  const artifactDir = 'C:\\Users\\Shaik Ansar\\.gemini\\antigravity-ide\\brain\\e814efe6-6697-4e8f-a7b8-d701e4652717';
  fs.writeFileSync(path.join(artifactDir, 'page13.png'), p13Buffer);
  fs.writeFileSync(path.join(artifactDir, 'page14.png'), p14Buffer);

  console.log('Saved Page 13 & 14 images!');

  await browser.close();
}

convertPdfToPng().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
