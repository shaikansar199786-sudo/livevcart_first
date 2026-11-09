import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

async function exportFullPackage() {
  console.log('1. Launching Puppeteer browser for Clean Standalone Print View Export...');
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  await page.setViewport({ width: 1280, height: 1400 });

  const clientName = "K Ranjit Kumar";
  const contractValue = "9,70,097";
  const contractWords = "Nine Lakhs Seventy Thousand Ninety-Seven Rupees Only";
  const address = "10-79/7/2, GF-104, AMMUS GREEN VALLEY, SAGAR NAGAR, ENDADA, Visakhapatnam – 530045";
  const refId = "PR_2026_009/01";

  const targetUrl = `http://localhost:5173/print-agreement/1?cn=${encodeURIComponent(clientName)}&cv=${encodeURIComponent(contractValue)}&cvw=${encodeURIComponent(contractWords)}&addr=${encodeURIComponent(address)}&ref=${encodeURIComponent(refId)}&type=Interior%20Design&includeHandover=true&includeContract=true`;

  console.log(`2. Navigating directly to unauthenticated print route:\n ${targetUrl}`);
  await page.goto(targetUrl, { waitUntil: 'networkidle2' });
  
  await page.waitForSelector('#print-ready', { timeout: 10000 }).catch(() => console.log('Print ready selector wait timed out, continuing...'));
  await new Promise(r => setTimeout(r, 2000));

  const pageDebug = await page.evaluate(() => {
    return {
      url: window.location.href,
      h1Text: Array.from(document.querySelectorAll('h1, h2, h3, p')).slice(0, 10).map(h => h.textContent.trim()),
      hasPrintReady: !!document.getElementById('print-ready'),
      bodyLength: document.body.innerHTML.length
    };
  });
  console.log('Page Debug Info:', JSON.stringify(pageDebug, null, 2));

  // 3. Purge oklab/oklch stylesheets
  console.log('3. Purging oklab/oklch stylesheets from DOM...');
  await page.evaluate(() => {
    document.querySelectorAll('style').forEach(s => {
      if (s.textContent && (s.textContent.includes('oklab') || s.textContent.includes('oklch'))) {
        s.textContent = s.textContent
          .replace(/oklab\([^)]+\)/gi, '#000000')
          .replace(/oklch\([^)]+\)/gi, '#000000');
      }
    });

    if (typeof window.html2pdf === 'undefined') {
      return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
        script.onload = resolve;
        document.head.appendChild(script);
      });
    }
  });

  // 4. Export PDF
  console.log('4. Exporting PDF from live DOM element...');
  const pdfDataUri = await page.evaluate(async () => {
    const elem = document.querySelector('.agreements-contract-wrapper') || document.body;

    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
    await new Promise(r => setTimeout(r, 500));

    const opt = {
      margin: [20, 25, 20, 25],
      filename: 'full_3_document_package.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        scrollX: 0,
        scrollY: 0,
        backgroundColor: '#ffffff'
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'] }
    };

    return await window.html2pdf().set(opt).from(elem).outputPdf('datauristring');
  });

  const base64Data = pdfDataUri.split(',')[1];
  const pdfBuffer = Buffer.from(base64Data, 'base64');

  const artifactDir = 'C:\\Users\\Shaik Ansar\\.gemini\\antigravity-ide\\brain\\e814efe6-6697-4e8f-a7b8-d701e4652717';
  const pdfPath = path.join(artifactDir, 'exported_full_3_document_package.pdf');
  fs.writeFileSync(pdfPath, pdfBuffer);

  // 5. Render PDF pages to PNG
  console.log('5. Converting PDF pages to PNG screenshots...');
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

  const renderResult = await convertPage.evaluate(async (b64) => {
    return await window.renderAllPages(b64);
  }, base64Data);

  console.log(`Total Pages rendered from PDF: ${renderResult.numPages}`);

  for (const pItem of renderResult.pageDataUrls) {
    const pageNumStr = String(pItem.pageNumber).padStart(2, '0');
    const filename = `clean_package_page_${pageNumStr}.png`;
    const destPath = path.join(artifactDir, filename);
    const pageBuf = Buffer.from(pItem.dataUrl.split(',')[1], 'base64');
    fs.writeFileSync(destPath, pageBuf);
    console.log(` -> Page ${pItem.pageNumber}: ${filename} (${(pageBuf.length / 1024).toFixed(1)} KB)`);
  }

  await browser.close();
}

exportFullPackage().catch(err => {
  console.error('Fatal Error in exportFullPackage:', err);
  process.exit(1);
});
