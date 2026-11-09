import puppeteer from 'puppeteer';
import path from 'path';

async function captureCleanAgreementPhotos() {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  await page.setViewport({ width: 1000, height: 1400, deviceScaleFactor: 2 });
  
  // Set localStorage user session
  await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem("user", JSON.stringify({ user_id: 1, name: "Admin Sukku", username: "shaiksalman9951@gmail.com", role: "admin" }));
  });
  
  await page.goto('http://localhost:5173/agreements', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  
  // Click Create New Agreement
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text && text.includes('Create New Agreement')) {
      await btn.click();
      break;
    }
  }
  await new Promise(r => setTimeout(r, 2000));

  // Ensure Include Handover is checked
  const checkboxes = await page.$$('input[type="checkbox"]');
  for (const cb of checkboxes) {
    const isChecked = await page.evaluate(el => el.checked, cb);
    if (!isChecked) {
      await cb.click();
      await new Promise(r => setTimeout(r, 500));
    }
  }

  // Uncheck "Include Quotation" checkbox if checked, so ONLY Agreement & Handover show
  const labels = await page.$$('label');
  for (const lbl of labels) {
    const txt = await page.evaluate(el => el.textContent, lbl);
    if (txt && txt.includes('Include Quotation')) {
      const cb = await lbl.$('input[type="checkbox"]');
      if (cb) {
        const checked = await page.evaluate(el => el.checked, cb);
        if (checked) await cb.click();
      }
    }
  }
  await new Promise(r => setTimeout(r, 1000));

  const artifactDir = 'C:\\Users\\Shaik Ansar\\.gemini\\antigravity-ide\\brain\\e814efe6-6697-4e8f-a7b8-d701e4652717';

  // 1. Works Contract Photo
  const wrapperElem = await page.$('.agreements-contract-wrapper');
  if (wrapperElem) {
    await wrapperElem.screenshot({ path: path.join(artifactDir, 'works_contract_photo.png') });
    console.log('Saved works_contract_photo.png');
  }

  // 2. Scroll to Handover Agreement & capture Handover Photo
  const handoverElem = await page.evaluateHandle(() => {
    const allH2 = Array.from(document.querySelectorAll('h2'));
    const handoverH2 = allH2.find(h => h.textContent.includes('PROJECT HANDOVER AGREEMENT'));
    return handoverH2 ? handoverH2.closest('.page') || handoverH2.parentElement.parentElement : null;
  });

  if (handoverElem && handoverElem.asElement()) {
    await handoverElem.asElement().screenshot({ path: path.join(artifactDir, 'handover_agreement_photo.png') });
    console.log('Saved handover_agreement_photo.png');
  }

  await browser.close();
  console.log('Clean agreement photos generated successfully!');
}

captureCleanAgreementPhotos().catch(console.error);
