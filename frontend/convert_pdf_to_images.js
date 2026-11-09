import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

async function convertPdfToPngs() {
  const pdfPath = path.resolve('./exported_full_3_document_package.pdf');
  if (!fs.existsSync(pdfPath)) {
    throw new Error('exported_full_3_document_package.pdf not found!');
  }

  const pdfBuffer = fs.readFileSync(pdfPath);
  const base64Data = pdfBuffer.toString('base64');
  console.log(`Loaded PDF file: ${pdfPath} (${(pdfBuffer.length / 1024).toFixed(1)} KB)`);

  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1800 });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js"></script>
    </head>
    <body>
      <script>
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
        let pdfDoc = null;

        async function initPdf(b64) {
          const binaryString = atob(b64);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          pdfDoc = await pdfjsLib.getDocument({ data: bytes }).promise;
          return pdfDoc.numPages;
        }

        async function renderSinglePage(pageNum) {
          const pageObj = await pdfDoc.getPage(pageNum);
          const viewport = pageObj.getViewport({ scale: 2.2 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          await pageObj.render({ canvasContext: ctx, viewport: viewport }).promise;
          return canvas.toDataURL('image/png');
        }
      </script>
    </body>
    </html>
  `;

  await page.setContent(html);

  console.log('Initializing PDF.js doc...');
  const numPages = await page.evaluate(async (b64) => {
    return await window.initPdf(b64);
  }, base64Data);

  console.log(`Total Pages in PDF: ${numPages}`);

  const artifactDir = 'C:\\Users\\Shaik Ansar\\.gemini\\antigravity-ide\\brain\\e814efe6-6697-4e8f-a7b8-d701e4652717';
  const pageSummary = [];

  for (let p = 1; p <= numPages; p++) {
    console.log(`Rendering page ${p} of ${numPages}...`);
    const dataUrl = await page.evaluate(async (pageNum) => {
      return await window.renderSinglePage(pageNum);
    }, p);

    const pageNumStr = String(p).padStart(2, '0');
    const filename = `exported_package_page_${pageNumStr}.png`;
    const destPath = path.join(artifactDir, filename);
    const pageBuf = Buffer.from(dataUrl.split(',')[1], 'base64');
    fs.writeFileSync(destPath, pageBuf);

    pageSummary.push({
      pageNumber: p,
      filename,
      filepath: destPath,
      sizeKb: (pageBuf.length / 1024).toFixed(1)
    });
    console.log(` -> Saved Page ${p}: ${filename} (${(pageBuf.length / 1024).toFixed(1)} KB)`);
  }

  await browser.close();

  console.log('\nCONVERSION COMPLETED SUCCESSFULLY!');
  console.log(JSON.stringify(pageSummary, null, 2));
}

convertPdfToPngs().catch(err => {
  console.error('Fatal Error in convertPdfToPngs:', err);
  process.exit(1);
});
