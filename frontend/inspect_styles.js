import puppeteer from 'puppeteer';

async function inspectComputedStyles() {
  console.log('1. Launching Puppeteer browser for PDF Export...');
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1000 });

  // 1. Authenticate
  await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded' });
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
  await page.goto('http://localhost:5173/agreements', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  // 3. Click Create New Agreement
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text && text.includes('Create New Agreement')) {
      await btn.click();
      break;
    }
  }
  await new Promise(r => setTimeout(r, 2000));

  // 4. Ensure Handover section checkbox is active
  const checkboxes = await page.$$('input[type="checkbox"]');
  for (const cb of checkboxes) {
    const isChecked = await page.evaluate(el => el.checked, cb);
    if (!isChecked) {
      await cb.click();
      await new Promise(r => setTimeout(r, 500));
    }
  }
  await new Promise(r => setTimeout(r, 1000));

  const stylesResult = await page.evaluate(() => {
    const liveElem = document.querySelector('.agreements-contract-wrapper');
    if (!liveElem) return { error: 'Contract wrapper element not found' };

    const bodyParagraph = liveElem.querySelector('p');
    
    // Find heading element like Para 1 or Terms and Conditions
    const allP = Array.from(liveElem.querySelectorAll('p'));
    const headingParagraph = allP.find(p => p.textContent.includes('Terms and Conditions') || p.textContent.includes('Para 1'));

    const getElementDetails = (el) => {
      if (!el) return null;
      const cs = window.getComputedStyle(el);
      return {
        textContent: el.textContent.trim().substring(0, 60),
        tagName: el.tagName,
        fontFamily: cs.fontFamily,
        fontWeight: cs.fontWeight,
        fontSize: cs.fontSize,
        letterSpacing: cs.letterSpacing,
        lineHeight: cs.lineHeight,
        marginTop: cs.marginTop,
        marginBottom: cs.marginBottom,
        paddingTop: cs.paddingTop,
        paddingBottom: cs.paddingBottom,
        textDecoration: cs.textDecoration,
        textDecorationLine: cs.textDecorationLine
      };
    };

    return {
      wrapperFontFamily: window.getComputedStyle(liveElem).fontFamily,
      bodyParagraph: getElementDetails(bodyParagraph),
      headingElement: getElementDetails(headingParagraph)
    };
  });

  console.log('--- ACTUAL COMPUTED DOM STYLES ---');
  console.log(JSON.stringify(stylesResult, null, 2));

  await browser.close();
}

inspectComputedStyles().catch(console.error);
