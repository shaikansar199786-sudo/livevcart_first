const puppeteer = require('puppeteer');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

(async () => {
    try {
        const token = execSync('php scratch/get_token.php').toString().trim();
        console.log("Generated token:", token);

        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setViewport({ width: 800, height: 1130, deviceScaleFactor: 2 });

        page.on('console', msg => console.log('PAGE LOG:', msg.text()));

        const printUrl = `http://localhost:5173/print-quote/97?token=${encodeURIComponent(token)}&api=${encodeURIComponent('http://localhost/livrcart/demoark/api')}`;
        console.log("Navigating to:", printUrl);

        await page.goto(printUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(r => setTimeout(r, 2000));

        const artifactDir = 'C:\\Users\\Shaik Ansar\\.gemini\\antigravity-ide\\brain\\64599ec1-4299-4a5a-a299-ea0b90565281';

        // 1. Cover Page
        const coverEl = await page.$('.page-break-cover');
        if (coverEl) {
            await coverEl.screenshot({ path: path.join(artifactDir, 'cover_page.png') });
            console.log("Saved cover_page.png to artifact directory!");
        }

        // 2. Project Info Page
        const infoEl = await page.$('.page-break-project-info');
        if (infoEl) {
            await infoEl.screenshot({ path: path.join(artifactDir, 'project_info_page.png') });
            console.log("Saved project_info_page.png to artifact directory!");
        }

        // 3. Module Transition Page
        const modEl = await page.$('.module-pages-wrapper');
        if (modEl) {
            await modEl.screenshot({ path: path.join(artifactDir, 'module_transition.png') });
            console.log("Saved module_transition.png to artifact directory!");
        }

        await browser.close();
    } catch (e) {
        console.error("Error capturing:", e.message);
    }
})();
