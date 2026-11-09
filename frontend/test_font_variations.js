import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

async function testVariations() {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1000 });

  const testHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { background: #fff; font-size: 14px; margin: 20px; }
        .box { margin-bottom: 20px; padding: 10px; border: 1px solid #ccc; }
        .f1 { font-family: "Calibri", "Segoe UI", Arial, sans-serif; }
        .f2 { font-family: "Segoe UI", Arial, sans-serif; }
        .f3 { font-family: Arial, Helvetica, sans-serif; }
        .ls-normal { letter-spacing: normal; }
        .ls-03 { letter-spacing: 0.3px; }
        .ls-05 { letter-spacing: 0.5px; }
        .ls-08 { letter-spacing: 0.8px; }
      </style>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
    </head>
    <body>
      <div id="render-target" style="width: 700px; padding: 20px; background: #fff;">
        <div class="box f1 ls-normal">
          <strong>1. Calibri (letter-spacing: normal):</strong><br>
          This agreement is made on Sep 5, 2026 between Mr. and Livincart Company for the Interior Design work of the Residential home. The total contract value is ₹1,18,000 (One Lakh Eighteen Thousand Rupees Only).
        </div>
        <div class="box f1 ls-03">
          <strong>2. Calibri (letter-spacing: 0.3px):</strong><br>
          This agreement is made on Sep 5, 2026 between Mr. and Livincart Company for the Interior Design work of the Residential home. The total contract value is ₹1,18,000 (One Lakh Eighteen Thousand Rupees Only).
        </div>
        <div class="box f1 ls-05">
          <strong>3. Calibri (letter-spacing: 0.5px):</strong><br>
          This agreement is made on Sep 5, 2026 between Mr. and Livincart Company for the Interior Design work of the Residential home. The total contract value is ₹1,18,000 (One Lakh Eighteen Thousand Rupees Only).
        </div>
        <div class="box f2 ls-normal">
          <strong>4. Segoe UI (letter-spacing: normal):</strong><br>
          This agreement is made on Sep 5, 2026 between Mr. and Livincart Company for the Interior Design work of the Residential home. The total contract value is ₹1,18,000 (One Lakh Eighteen Thousand Rupees Only).
        </div>
        <div class="box f2 ls-03">
          <strong>5. Segoe UI (letter-spacing: 0.3px):</strong><br>
          This agreement is made on Sep 5, 2026 between Mr. and Livincart Company for the Interior Design work of the Residential home. The total contract value is ₹1,18,000 (One Lakh Eighteen Thousand Rupees Only).
        </div>
        <div class="box f3 ls-normal">
          <strong>6. Arial (letter-spacing: normal):</strong><br>
          This agreement is made on Sep 5, 2026 between Mr. and Livincart Company for the Interior Design work of the Residential home. The total contract value is ₹1,18,000 (One Lakh Eighteen Thousand Rupees Only).
        </div>
        <div class="box f3 ls-03">
          <strong>7. Arial (letter-spacing: 0.3px):</strong><br>
          This agreement is made on Sep 5, 2026 between Mr. and Livincart Company for the Interior Design work of the Residential home. The total contract value is ₹1,18,000 (One Lakh Eighteen Thousand Rupees Only).
        </div>
      </div>
    </body>
    </html>
  `;

  await page.setContent(testHtml);

  const pdfDataUri = await page.evaluate(async () => {
    const target = document.getElementById('render-target');
    const opt = {
      margin: [5, 5, 5, 5],
      filename: 'test_variations.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    return await window.html2pdf().set(opt).from(target).outputPdf('datauristring');
  });

  const pdfBuffer = Buffer.from(pdfDataUri.split(',')[1], 'base64');
  
  // Render to image
  const renderBrowser = await puppeteer.launch({ headless: 'new' });
  const renderPage = await renderBrowser.newPage();
  await renderPage.goto('about:blank');
  await renderPage.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js' });

  const pdfBase64 = pdfBuffer.toString('base64');
  const pngData = await renderPage.evaluate(async (base64Data) => {
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
    const viewport = page1Obj.getViewport({ scale: 2.5 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page1Obj.render({ canvasContext: ctx, viewport: viewport }).promise;

    return canvas.toDataURL('image/png');
  }, pdfBase64);

  const pngBuffer = Buffer.from(pngData.split(',')[1], 'base64');
  const artifactDir = 'C:\\Users\\Shaik Ansar\\.gemini\\antigravity-ide\\brain\\e814efe6-6697-4e8f-a7b8-d701e4652717';
  fs.writeFileSync(path.join(artifactDir, 'font_variations_test.png'), pngBuffer);

  await browser.close();
  await renderBrowser.close();
  console.log('Variations test done!');
}

testVariations().catch(console.error);
