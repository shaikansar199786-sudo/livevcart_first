const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    try {
        const pdfPath = '../Interior_Vendor_Service_Agreemt.pdf';
        const pdfBase64 = fs.readFileSync(pdfPath).toString('base64');
        const browser = await puppeteer.launch({ headless: 'new' });
        const page = await browser.newPage();

        await page.setContent(`
            <!DOCTYPE html>
            <html>
            <head>
                <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js"></script>
            </head>
            <body>
                <div id="output"></div>
                <script>
                    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
                    const pdfData = atob("${pdfBase64}");
                    pdfjsLib.getDocument({ data: pdfData }).promise.then(async (pdf) => {
                        let text = '';
                        for (let i = 1; i <= pdf.numPages; i++) {
                            const pageObj = await pdf.getPage(i);
                            const content = await pageObj.getTextContent();
                            text += '\\n--- PAGE ' + i + ' ---\\n';
                            text += content.items.map(item => item.str).join(' ') + '\\n';
                        }
                        document.getElementById('output').innerText = text;
                        const r = document.createElement('div');
                        r.id = 'ready';
                        document.body.appendChild(r);
                    });
                </script>
            </body>
            </html>
        `);

        await page.waitForSelector('#ready', { timeout: 30000 });
        const text = await page.evaluate(() => document.getElementById('output').innerText);
        console.log('--- EXTRACTED PDF TEXT ---');
        console.log(text);
        fs.writeFileSync('extracted_pdf_text.txt', text);
        await browser.close();
    } catch (e) {
        console.error('Error:', e);
    }
})();
