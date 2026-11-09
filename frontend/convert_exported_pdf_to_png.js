import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

async function convertPdfToImages() {
  const pdfPath = path.resolve('./exported_production_contract.pdf');
  if (!fs.existsSync(pdfPath)) {
    throw new Error('exported_production_contract.pdf does not exist!');
  }

  const pdfBuffer = fs.readFileSync(pdfPath);
  const pdfBase64 = pdfBuffer.toString('base64');

  console.log('Rendering exported PDF pages to PNG using PDF.js...');
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 1600 });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js"></script>
    </head>
    <body>
      <div id="status"></div>
      <script>
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
        
        async function runRender(b64) {
          const binaryString = atob(b64);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          const pdfDoc = await pdfjsLib.getDocument({ data: bytes }).promise;
          const page1Obj = await pdfDoc.getPage(1);
          const viewport = page1Obj.getViewport({ scale: 3.0 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          await page1Obj.render({ canvasContext: ctx, viewport: viewport }).promise;

          const fullP1Data = canvas.toDataURL('image/png');

          const zoomCanvas = document.createElement('canvas');
          const cropX = Math.round(viewport.width * 0.08);
          const cropY = Math.round(viewport.height * 0.14);
          const cropWidth = Math.round(viewport.width * 0.84);
          const cropHeight = Math.round(viewport.height * 0.28);

          zoomCanvas.width = cropWidth;
          zoomCanvas.height = cropHeight;
          const zoomCtx = zoomCanvas.getContext('2d');
          zoomCtx.drawImage(canvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

          const zoomP1Data = zoomCanvas.toDataURL('image/png');

          return { fullP1Data, zoomP1Data };
        }
      </script>
    </body>
    </html>
  `;

  await page.setContent(html);

  const pagePngResults = await page.evaluate(async (b64) => {
    return await window.runRender(b64);
  }, pdfBase64);

  const p1Buffer = Buffer.from(pagePngResults.fullP1Data.split(',')[1], 'base64');
  const zoomBuffer = Buffer.from(pagePngResults.zoomP1Data.split(',')[1], 'base64');

  const artifactDir = 'C:\\Users\\Shaik Ansar\\.gemini\\antigravity-ide\\brain\\e814efe6-6697-4e8f-a7b8-d701e4652717';
  const page1Dest = path.join(artifactDir, 'works_contract_page1.png');
  const zoomDest = path.join(artifactDir, 'works_contract_page1_zoomed.png');

  fs.writeFileSync(page1Dest, p1Buffer);
  fs.writeFileSync(zoomDest, zoomBuffer);

  console.log('Saved PNG files to artifacts:');
  console.log(' -> Page 1 Full:', page1Dest);
  console.log(' -> Page 1 Zoomed:', zoomDest);

  await browser.close();
}

convertPdfToImages().catch(console.error);
