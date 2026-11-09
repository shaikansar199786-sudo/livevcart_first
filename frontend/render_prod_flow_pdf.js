import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

async function renderProdFlowPdf() {
  const artifactDir = 'C:\\Users\\Shaik Ansar\\.gemini\\antigravity-ide\\brain\\e814efe6-6697-4e8f-a7b8-d701e4652717';
  const pdfPath = path.join(artifactDir, 'exported_production_flow_contract.pdf');

  if (!fs.existsSync(pdfPath)) {
    console.error('PDF file does not exist:', pdfPath);
    process.exit(1);
  }

  const pdfBuffer = fs.readFileSync(pdfPath);
  const base64Data = pdfBuffer.toString('base64');

  const browser = await puppeteer.launch({ headless: 'new' });
  const convertPage = await browser.newPage();
  await convertPage.setViewport({ width: 1400, height: 1800 });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js"></script>
    </head>
    <body>
      <script>
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
        
        async function renderAllPages(b64) {
          const binaryString = atob(b64);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          const pdfDoc = await pdfjsLib.getDocument({ data: bytes }).promise;
          const numPages = pdfDoc.numPages;
          const pageDataUrls = [];

          for (let p = 1; p <= numPages; p++) {
            const pageObj = await pdfDoc.getPage(p);
            const viewport = pageObj.getViewport({ scale: 2.5 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            await pageObj.render({ canvasContext: ctx, viewport: viewport }).promise;
            pageDataUrls.push({
              pageNumber: p,
              dataUrl: canvas.toDataURL('image/png')
            });
          }

          return { numPages, pageDataUrls };
        }
      </script>
    </body>
    </html>
  `;

  await convertPage.setContent(html);
  await convertPage.waitForFunction(() => typeof window.pdfjsLib !== 'undefined', { timeout: 15000 }).catch(() => {});

  const renderResult = await convertPage.evaluate(async (b64) => {
    return await window.renderAllPages(b64);
  }, base64Data);

  console.log(`Total Pages rendered from Production Flow PDF: ${renderResult.numPages}`);

  for (const pItem of renderResult.pageDataUrls) {
    const pageNumStr = String(pItem.pageNumber).padStart(2, '0');
    const filename = `prod_flow_page_${pageNumStr}.png`;
    const destPath = path.join(artifactDir, filename);
    const pageBuf = Buffer.from(pItem.dataUrl.split(',')[1], 'base64');
    fs.writeFileSync(destPath, pageBuf);
    console.log(` -> Page ${pItem.pageNumber}: ${filename} (${(pageBuf.length / 1024).toFixed(1)} KB)`);
  }

  await browser.close();
}

renderProdFlowPdf().catch(err => {
  console.error('Error rendering prod flow PDF:', err);
  process.exit(1);
});
