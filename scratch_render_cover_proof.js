const path = require('path');
const puppeteer = require(path.join(__dirname, 'pdf-generator/node_modules/puppeteer'));
const fs = require('fs');

(async () => {
    const artifactDir = 'C:\\Users\\Shaik Ansar\\.gemini\\antigravity-ide\\brain\\e814efe6-6697-4e8f-a7b8-d701e4652717';
    const pdfPath = 'c:\\xampp\\htdocs\\livrcart\\demoark\\final_merged_package_proof.pdf';

    if (!fs.existsSync(pdfPath)) {
        console.error('PDF file does not exist:', pdfPath);
        return;
    }

    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfBase64 = pdfBuffer.toString('base64');

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 1600 });

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js"></script>
            <style>
                body { margin: 0; padding: 0; background: #fff; }
                canvas { display: block; margin: 0 auto; }
            </style>
        </head>
        <body>
            <div id="canvas-container"></div>
            <script>
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
                window.renderPdfPage = async function(base64Data, pageNum) {
                    const container = document.getElementById('canvas-container');
                    container.innerHTML = '';
                    const raw = atob(base64Data);
                    const uint8Array = new Uint8Array(raw.length);
                    for (let i = 0; i < raw.length; i++) {
                        uint8Array[i] = raw.charCodeAt(i);
                    }
                    const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
                    const pdf = await loadingTask.promise;
                    const page = await pdf.getPage(pageNum);
                    const viewport = page.getViewport({ scale: 1.5 });
                    const canvas = document.createElement('canvas');
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;
                    container.appendChild(canvas);
                    const context = canvas.getContext('2d');
                    await page.render({ canvasContext: context, viewport: viewport }).promise;
                    return pdf.numPages;
                };
            </script>
        </body>
        </html>
    `;

    await page.setContent(htmlContent);
    await page.waitForFunction('typeof window.renderPdfPage === "function"');

    const totalPages = await page.evaluate((b) => window.renderPdfPage(b, 1), pdfBase64);
    console.log(`Total PDF Pages: ${totalPages}`);

    for (let p = 1; p <= Math.min(2, totalPages); p++) {
        await page.evaluate((b, pageNum) => window.renderPdfPage(b, pageNum), pdfBase64, p);
        await new Promise(r => setTimeout(r, 1500));
        const imgPath = path.join(artifactDir, `cover_proof_page_${p}.png`);
        await page.screenshot({ path: imgPath, type: 'png' });
        console.log(`Saved screenshot: ${imgPath}`);
    }

    await browser.close();
})();
