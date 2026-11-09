import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

async function testFontFix() {
  console.log('Testing font fix combinations for html2pdf rendering...');
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1000 });

  await page.goto('http://localhost:5173/agreements', { waitUntil: 'domcontentloaded' });
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

  await page.goto('http://localhost:5173/agreements', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 3000));

  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text && text.includes('Create New Agreement')) {
      await btn.click();
      break;
    }
  }
  await new Promise(r => setTimeout(r, 2000));

  await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js' });

  // Execute PDF generation test
  const pdfBase64Data = await page.evaluate(async () => {
    const liveElem = document.querySelector('.agreements-contract-wrapper');
    if (!liveElem) throw new Error('Contract wrapper element not found');

    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }

    const opt = {
      margin: [8, 10, 8, 10],
      filename: 'Livincart_Works_Contract_Test.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2, 
        useCORS: true, 
        logging: false, 
        scrollX: 0, 
        scrollY: 0, 
        backgroundColor: '#ffffff',
        letterRendering: false
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'] }
    };

    const html2pdfLib = window['html2pdf'];
    const pdfDataUri = await html2pdfLib().set(opt).from(liveElem).outputPdf('datauristring');
    return pdfDataUri;
  });

  const pdfBuffer = Buffer.from(pdfBase64Data.split(',')[1], 'base64');
  const exportedPdfPath = path.resolve('./exported_production_contract.pdf');
  fs.writeFileSync(exportedPdfPath, pdfBuffer);

  await browser.close();

  // Render to PNG using PDF.js
  const renderBrowser = await puppeteer.launch({ headless: 'new' });
  const renderPage = await renderBrowser.newPage();
  await renderPage.goto('http://localhost:5173/agreements', { waitUntil: 'domcontentloaded' });
  await renderPage.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js' });

  const pdfBase64 = pdfBuffer.toString('base64');
  const pagePngResults = await renderPage.evaluate(async (base64Data) => {
    const pdfjs = window['pdfjsLib'];
    pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    const binaryString = atob(base64Data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const pdfDoc = await pdfjs.getDocument({ data: bytes }).promise;
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
  }, pdfBase64);

  const p1Buffer = Buffer.from(pagePngResults.fullP1Data.split(',')[1], 'base64');
  const zoomBuffer = Buffer.from(pagePngResults.zoomP1Data.split(',')[1], 'base64');

  const artifactDir = 'C:\\Users\\Shaik Ansar\\.gemini\\antigravity-ide\\brain\\e814efe6-6697-4e8f-a7b8-d701e4652717';
  fs.writeFileSync(path.join(artifactDir, 'works_contract_page1.png'), p1Buffer);
  fs.writeFileSync(path.join(artifactDir, 'works_contract_page1_zoomed.png'), zoomBuffer);

  await renderBrowser.close();
  console.log('SUCCESSFULLY_RENDERED_IMAGES');
}

testFontFix().catch(console.error);
