import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

async function runExportAndRender() {
  console.log('1. Launching Puppeteer browser for PDF Export...');
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  await page.setViewport({ width: 1280, height: 1000 });

  // 1. Authenticate
  console.log('2. Authenticating user session...');
  try {
    await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded' });
  } catch (e) {
    console.log('Retrying navigation to login page...');
    await new Promise(r => setTimeout(r, 1000));
    await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded' });
  }
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

  // 2. Navigate to Agreements
  console.log('3. Navigating to Agreements dashboard...');
  await page.goto('http://localhost:5173/agreements', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  // 3. Click Create New Agreement
  console.log('4. Opening Create New Agreement workspace...');
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text && text.includes('Create New Agreement')) {
      await btn.click();
      break;
    }
  }
  await new Promise(r => setTimeout(r, 2000));

  // 4. Ensure Handover & Contract checkboxes are active
  console.log('5. Ensuring Contract section checkboxes are active...');
  const checkboxes = await page.$$('input[type="checkbox"]');
  for (const cb of checkboxes) {
    const isChecked = await page.evaluate(el => el.checked, cb);
    if (!isChecked) {
      await cb.click();
      await new Promise(r => setTimeout(r, 500));
    }
  }
  await new Promise(r => setTimeout(r, 2000));
  const hasWrapper = await page.evaluate(() => {
    return {
      hasWrapper: !!document.querySelector('.agreements-contract-wrapper'),
      hasPrintPreview: !!document.querySelector('.agreements-print-preview'),
      bodySnippet: document.body.innerText.substring(0, 200)
    };
  });
  console.log('DOM Check:', hasWrapper);

  // Inject html2pdf script bundle into page if not on window
  console.log('6. Ensuring html2pdf library bundle is loaded...');
  await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js' });

  // 5. Trigger the production PDF export function directly on the element
  console.log('7. Triggering production PDF export (html2pdf production pipeline)...');
  const pdfBase64Data = await page.evaluate(async () => {
    let liveElem = document.querySelector('.agreements-contract-wrapper');
    if (!liveElem) liveElem = document.querySelector('.agreements-print-preview');
    if (!liveElem) throw new Error('Contract wrapper element not found');

    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }

    const pElem = liveElem.querySelector('p');
    const allP = Array.from(liveElem.querySelectorAll('p'));
    const headingElem = allP.find(p => p.textContent.includes('Terms and Conditions') || p.textContent.includes('Para 1'));

    const pStyle = pElem ? window.getComputedStyle(pElem) : null;
    const hStyle = headingElem ? window.getComputedStyle(headingElem) : null;

    console.log("=== LIVE COMPUTED BODY PARAGRAPH STYLES ===");
    console.log({
      text: pElem ? pElem.textContent.substring(0, 40) : '',
      fontFamily: pStyle ? pStyle.fontFamily : '',
      fontWeight: pStyle ? pStyle.fontWeight : '',
      fontSize: pStyle ? pStyle.fontSize : '',
      letterSpacing: pStyle ? pStyle.letterSpacing : '',
      lineHeight: pStyle ? pStyle.lineHeight : '',
      marginTop: pStyle ? pStyle.marginTop : '',
      marginBottom: pStyle ? pStyle.marginBottom : ''
    });

    console.log("=== LIVE COMPUTED HEADING STYLES ===");
    console.log({
      text: headingElem ? headingElem.textContent.substring(0, 40) : '',
      fontFamily: hStyle ? hStyle.fontFamily : '',
      fontWeight: hStyle ? hStyle.fontWeight : '',
      fontSize: hStyle ? hStyle.fontSize : '',
      letterSpacing: hStyle ? hStyle.letterSpacing : '',
      lineHeight: hStyle ? hStyle.lineHeight : '',
      marginTop: hStyle ? hStyle.marginTop : '',
      marginBottom: hStyle ? hStyle.marginBottom : '',
      textDecoration: hStyle ? hStyle.textDecoration : ''
    });

    const opt = {
      margin: [8, 10, 8, 10],
      filename: 'Livincart_Works_Contract_Test.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false, scrollX: 0, scrollY: 0, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'] }
    };

    const html2pdfLib = window['html2pdf'];
    if (!html2pdfLib) throw new Error('html2pdf library could not be initialized');

    const pdfDataUri = await html2pdfLib().set(opt).from(liveElem).outputPdf('datauristring');
    return pdfDataUri;
  });

  console.log('8. Production PDF file generated successfully! Base64 size:', pdfBase64Data.length);

  // Save the raw exported PDF file to disk
  const pdfBuffer = Buffer.from(pdfBase64Data.split(',')[1], 'base64');
  const exportedPdfPath = path.resolve('./exported_production_contract.pdf');
  fs.writeFileSync(exportedPdfPath, pdfBuffer);
  console.log('Saved exported PDF file to:', exportedPdfPath);

  await browser.close();

  // 6. Convert exported PDF pages directly to PNG & Zoomed Paragraph PNG
  console.log('9. Converting PDF pages to high-res PNG & zoomed paragraph...');
  const renderBrowser = await puppeteer.launch({ headless: 'new' });
  const renderPage = await renderBrowser.newPage();
  await renderPage.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded' });
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
    const totalPages = pdfDoc.numPages;

    // Render Page 1 at 3.0 scale for ultra high resolution detail
    const page1Obj = await pdfDoc.getPage(1);
    const viewport = page1Obj.getViewport({ scale: 3.0 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page1Obj.render({ canvasContext: ctx, viewport: viewport }).promise;

    const fullP1Data = canvas.toDataURL('image/png');

    // Create a cropped canvas zoomed in on Para 1 & Terms & Conditions paragraph text
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

    return {
      fullP1Data,
      zoomP1Data,
      totalPages
    };
  }, pdfBase64);

  console.log(`10. Extracted Page 1 and Zoomed Paragraph PNGs.`);

  const p1Buffer = Buffer.from(pagePngResults.fullP1Data.split(',')[1], 'base64');
  const zoomBuffer = Buffer.from(pagePngResults.zoomP1Data.split(',')[1], 'base64');

  const artifactDir = 'C:\\Users\\Shaik Ansar\\.gemini\\antigravity-ide\\brain\\e814efe6-6697-4e8f-a7b8-d701e4652717';
  const page1Dest = path.join(artifactDir, 'works_contract_page1.png');
  const zoomDest = path.join(artifactDir, 'works_contract_page1_zoomed.png');

  fs.writeFileSync(page1Dest, p1Buffer);
  fs.writeFileSync(zoomDest, zoomBuffer);
  console.log('11. Saved PNG files to artifacts directory:');
  console.log(' -> Page 1 Full:', page1Dest);
  console.log(' -> Page 1 Zoomed Paragraph:', zoomDest);

  await renderBrowser.close();
  console.log('ALL DONE SUCCESSFUL!');
}

runExportAndRender().catch(err => {
  console.error('ERROR during PDF export & render:', err);
  process.exit(1);
});
