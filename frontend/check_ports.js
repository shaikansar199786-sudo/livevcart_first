import puppeteer from 'puppeteer';

async function checkPorts() {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  for (const port of [5173, 5174, 5175, 3000]) {
    try {
      await page.goto(`http://localhost:${port}`, { waitUntil: 'domcontentloaded', timeout: 3000 });
      const title = await page.title();
      console.log(`Port ${port} Title:`, title);
    } catch (e) {
      console.log(`Port ${port}: not responding`);
    }
  }
  await browser.close();
}

checkPorts().catch(console.error);
