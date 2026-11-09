const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

(async () => {
    const pdfPath = path.join(__dirname, 'test_quote_controller_out.pdf');
    const pdfData = fs.readFileSync(pdfPath);
    const pdfBase64 = pdfData.toString('base64');

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 1600 });

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
    </head>
    <body style="margin:0; background: #e2e8f0;">
      <div id="container"></div>
      <script>
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        const pdfData = atob("${pdfBase64}");
        
        pdfjsLib.getDocument({data: pdfData}).promise.then(async (pdf) => {
          window.numPages = pdf.numPages;
          console.log('Total pages:', pdf.numPages);
          
          for (let i = 1; i <= pdf.numPages; i++) {
            const pageObj = await pdf.getPage(i);
            const viewport = pageObj.getViewport({ scale: 2.0 });
            
            const canvas = document.createElement('canvas');
            canvas.id = 'page-' + i;
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            canvas.style.margin = '20px auto';
            canvas.style.display = 'block';
            canvas.style.boxShadow = '0 10px 25px rgba(0,0,0,0.3)';
            document.getElementById('container').appendChild(canvas);
            
            const renderContext = {
              canvasContext: canvas.getContext('2d'),
              viewport: viewport
            };
            await pageObj.render(renderContext).promise;
          }
          window.pdfRendered = true;
        });
      </script>
    </body>
    </html>
    `;

    await page.setContent(htmlContent);
    await page.waitForFunction('window.pdfRendered === true', { timeout: 30000 });

    const numPages = await page.evaluate(() => window.numPages);
    console.log(`Rendered PDF with ${numPages} pages.`);

    for (let i = 1; i <= numPages; i++) {
        const canvasEl = await page.$(`#page-${i}`);
        const artifactPath = path.join(`C:\\Users\\Shaik Ansar\\.gemini\\antigravity-ide\\brain\\e814efe6-6697-4e8f-a7b8-d701e4652717`, `prod_cover_proof_page_${i}.png`);
        await canvasEl.screenshot({ path: artifactPath });
        console.log(`Saved screenshot page ${i}: ${artifactPath}`);
    }

    await browser.close();
})();
