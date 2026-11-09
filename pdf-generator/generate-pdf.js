// pdf-generator/generate-pdf.js
// Puppeteer PDF generation service — port 3001
// Renders the React /print-quote/:quoteId page (isPrintingVersion layout) and exports to PDF.
// Saves debug-quote.pdf locally each time for inspection before email wiring.

const puppeteer = require('puppeteer');
const express = require('express');
const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

const app = express();
const PORT = 3001;

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// ---------------------------------------------------------------------------
// POST /generate-pdf
// Body: { quoteId, projectId, token, apiBaseUrl }
// ---------------------------------------------------------------------------
app.post('/generate-pdf', async (req, res) => {
    const { quoteId, projectId, token, apiBaseUrl } = req.body;

    if (!quoteId || !token) {
        return res.status(400).json({ success: false, error: 'quoteId and token are required' });
    }

    const frontendBase = process.env.FRONTEND_BASE || 'http://localhost:5173';
    const printUrl = `${frontendBase}/print-quote/${quoteId}?token=${encodeURIComponent(token)}&api=${encodeURIComponent(apiBaseUrl || 'http://localhost/livrcart/demoark/api')}`;

    console.log(`[PDF] Generating for quote ${quoteId} — navigating to: ${printUrl}`);

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-web-security',
                '--allow-running-insecure-content'
            ]
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 2 });

        // Emulate print media type so all @media print rules & page break CSS apply cleanly
        await page.emulateMediaType('print');

        await page.goto(printUrl, {
            waitUntil: 'networkidle2',
            timeout: 45000
        });

        await page.evaluate(() =>
            document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()
        );

        try {
            await page.waitForSelector('#print-ready', { timeout: 15000 });
            console.log('[PDF] #print-ready found — rendering complete');
        } catch (e) {
            console.warn('[PDF] #print-ready not found within 15s — proceeding anyway');
        }

        await new Promise(r => setTimeout(r, 500));

        let htmlSnapshot = '';
        try {
            htmlSnapshot = await page.content();
        } catch (_) { }

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
            preferCSSPageSize: true
        });

        await browser.close();
        browser = null;

        const debugPath = path.join(__dirname, 'debug-quote.pdf');
        fs.writeFileSync(debugPath, pdfBuffer);
        console.log(`[PDF] Debug Quote PDF saved: ${debugPath} (${pdfBuffer.length} bytes)`);

        const pdfBase64 = `data:application/pdf;base64,${pdfBuffer.toString('base64')}`;

        res.json({
            success: true,
            pdf: pdfBase64,
            pdf_base64: pdfBase64,
            html_snapshot: htmlSnapshot,
            debug_path: debugPath,
            size_bytes: pdfBuffer.length
        });

    } catch (error) {
        console.error('[PDF] Quote generation error:', error.message);
        if (browser) {
            try { await browser.close(); } catch (_) { }
        }
        res.status(500).json({
            success: false,
            error: 'Failed to generate Quote PDF',
            message: error.message
        });
    }
});

// ---------------------------------------------------------------------------
// POST /generate-agreement-pdf
// Body: { agreementId, token, apiBaseUrl }
// ---------------------------------------------------------------------------
app.post('/generate-agreement-pdf', async (req, res) => {
    const { agreementId, token, apiBaseUrl } = req.body;

    if (!agreementId || !token) {
        return res.status(400).json({ success: false, error: 'agreementId and token are required' });
    }

    const frontendBase = process.env.FRONTEND_BASE || 'http://localhost:5173';
    const printUrl = `${frontendBase}/print-agreement/${agreementId}?token=${encodeURIComponent(token)}&api=${encodeURIComponent(apiBaseUrl || 'http://localhost/livrcart/demoark/api')}`;

    console.log(`[PDF] Generating for agreement ${agreementId} — navigating to: ${printUrl}`);

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-web-security',
                '--allow-running-insecure-content'
            ]
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });

        await page.goto(printUrl, {
            waitUntil: 'networkidle2',
            timeout: 45000
        });

        await page.evaluate(() =>
            document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()
        );

        try {
            await page.waitForSelector('#print-ready', { timeout: 30000 });
            console.log('[PDF] Agreement #print-ready found — rendering complete');
        } catch (e) {
            console.warn('[PDF] Agreement #print-ready not found within 30s — proceeding anyway');
        }

        await new Promise(r => setTimeout(r, 800));

        let htmlSnapshot = '';
        try {
            htmlSnapshot = await page.content();
        } catch (_) { }

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
            preferCSSPageSize: true
        });

        await browser.close();
        browser = null;

        const debugPath = path.join(__dirname, 'debug-agreement.pdf');
        fs.writeFileSync(debugPath, pdfBuffer);
        console.log(`[PDF] Debug Agreement PDF saved: ${debugPath} (${pdfBuffer.length} bytes)`);

        const pdfBase64 = `data:application/pdf;base64,${pdfBuffer.toString('base64')}`;

        res.json({
            success: true,
            pdf: pdfBase64,
            html_snapshot: htmlSnapshot,
            debug_path: debugPath,
            size_bytes: pdfBuffer.length
        });

    } catch (error) {
        console.error('[PDF] Agreement generation error:', error.message);
        if (browser) {
            try { await browser.close(); } catch (_) { }
        }
        res.status(500).json({
            success: false,
            error: 'Failed to generate Agreement PDF',
            message: error.message
        });
    }
});

// ---------------------------------------------------------------------------
// POST /generate-mom-pdf
// Body: { projectId, token, apiBaseUrl }
// ---------------------------------------------------------------------------
app.post('/generate-mom-pdf', async (req, res) => {
    const { projectId, token, apiBaseUrl, type, source, filter } = req.body;

    if (!projectId || !token) {
        return res.status(400).json({ success: false, error: 'projectId and token are required' });
    }

    const filterType = type || source || filter || '';
    const frontendBase = process.env.FRONTEND_BASE || 'http://localhost:5173';
    let printUrl = `${frontendBase}/print-mom/${projectId}?token=${encodeURIComponent(token)}&api=${encodeURIComponent(apiBaseUrl || 'http://localhost/livrcart/demoark/api')}`;
    if (filterType) {
        printUrl += `&type=${encodeURIComponent(filterType)}`;
    }

    console.log(`[PDF] Generating MOM for project ${projectId} — navigating to: ${printUrl}`);

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-web-security',
                '--allow-running-insecure-content'
            ]
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });

        await page.goto(printUrl, {
            waitUntil: 'networkidle2',
            timeout: 45000
        });

        await page.evaluate(() =>
            document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()
        );

        try {
            await page.waitForSelector('#print-ready', { timeout: 30000 });
            console.log('[PDF] MOM #print-ready found — rendering complete');
        } catch (e) {
            console.warn('[PDF] MOM #print-ready not found within 30s — proceeding anyway');
        }

        await new Promise(r => setTimeout(r, 800));

        let htmlSnapshot = '';
        try {
            htmlSnapshot = await page.content();
        } catch (_) { }

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
            preferCSSPageSize: true
        });

        if (!pdfBuffer || pdfBuffer.length < 5000) {
            console.error(`[PDF] MOM generation produced an empty/invalid PDF (${pdfBuffer ? pdfBuffer.length : 0} bytes)`);
            return res.status(500).json({
                success: false,
                error: 'Generated PDF was empty or blank',
                size_bytes: pdfBuffer ? pdfBuffer.length : 0
            });
        }

        const debugPath = path.join(__dirname, 'debug-mom.pdf');
        fs.writeFileSync(debugPath, pdfBuffer);
        console.log(`[PDF] Debug MOM PDF saved: ${debugPath} (${pdfBuffer.length} bytes)`);

        const pdfBase64 = `data:application/pdf;base64,${pdfBuffer.toString('base64')}`;

        res.json({
            success: true,
            pdf: pdfBase64,
            html_snapshot: htmlSnapshot,
            debug_path: debugPath,
            size_bytes: pdfBuffer.length
        });

    } catch (error) {
        console.error('[PDF] MOM generation error:', error.message);
        if (browser) {
            try { await browser.close(); } catch (_) { }
        }
        res.status(500).json({
            success: false,
            error: 'Failed to generate MOM PDF',
            message: error.message
        });
    }
});

// ---------------------------------------------------------------------------
// POST /generate-vendor-quota-pdf
// Body: { vendor, projectId, token, apiBaseUrl }
// ---------------------------------------------------------------------------
app.post('/generate-vendor-quota-pdf', async (req, res) => {
    const { vendor, projectId, token, apiBaseUrl } = req.body;

    const vName = vendor || 'Vendor';
    const pId = projectId || '1';

    const frontendBase = 'http://localhost:5173';
    const printUrl = `${frontendBase}/print-vendor-quota?vendor=${encodeURIComponent(vName)}&project_id=${encodeURIComponent(pId)}&api=${encodeURIComponent(apiBaseUrl || 'http://localhost/livrcart/demoark/api')}`;

    console.log(`[PDF] Generating Vendor Quota for vendor "${vName}" project ${pId} — navigating to: ${printUrl}`);

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-web-security',
                '--allow-running-insecure-content'
            ]
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });

        await page.goto(printUrl, {
            waitUntil: 'networkidle2',
            timeout: 45000
        });

        await page.evaluate(() =>
            document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()
        );

        try {
            await page.waitForSelector('#print-ready', { timeout: 30000 });
            console.log('[PDF] Vendor Quota #print-ready found — rendering complete');
        } catch (e) {
            console.warn('[PDF] Vendor Quota #print-ready not found within 30s — proceeding anyway');
        }

        await new Promise(r => setTimeout(r, 600));

        let htmlSnapshot = '';
        try {
            htmlSnapshot = await page.content();
        } catch (_) { }

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
            preferCSSPageSize: true
        });

        await browser.close();
        browser = null;

        const debugPath = path.join(__dirname, 'debug-vendor-quota.pdf');
        fs.writeFileSync(debugPath, pdfBuffer);
        console.log(`[PDF] Debug Vendor Quota PDF saved: ${debugPath} (${pdfBuffer.length} bytes)`);

        const pdfBase64 = `data:application/pdf;base64,${pdfBuffer.toString('base64')}`;

        res.json({
            success: true,
            pdf: pdfBase64,
            html_snapshot: htmlSnapshot,
            debug_path: debugPath,
            size_bytes: pdfBuffer.length
        });

    } catch (error) {
        console.error('[PDF] Vendor Quota generation error:', error.message);
        if (browser) {
            try { await browser.close(); } catch (_) { }
        }
        res.status(500).json({
            success: false,
            error: 'Failed to generate Vendor Quota PDF',
            message: error.message
        });
    }
});

// ---------------------------------------------------------------------------
// POST /merge-pdfs
// Body: { pdfs: [base64_1, base64_2, ...] }
// ---------------------------------------------------------------------------
app.post('/merge-pdfs', async (req, res) => {
    const { pdfs } = req.body;

    if (!Array.isArray(pdfs) || pdfs.length === 0) {
        return res.status(400).json({ success: false, error: 'pdfs array is required' });
    }

    try {
        console.log(`[PDF-MERGE] Merging ${pdfs.length} PDF documents...`);
        const mergedPdf = await PDFDocument.create();

        for (let i = 0; i < pdfs.length; i++) {
            let base64Str = pdfs[i];
            if (base64Str.includes(',')) {
                base64Str = base64Str.split(',')[1];
            }
            const pdfBytes = Buffer.from(base64Str, 'base64');
            const srcDoc = await PDFDocument.load(pdfBytes);
            const copiedPages = await mergedPdf.copyPages(srcDoc, srcDoc.getPageIndices());
            copiedPages.forEach(page => mergedPdf.addPage(page));
        }

        const mergedPdfBytes = await mergedPdf.save();
        const mergedBuffer = Buffer.from(mergedPdfBytes);

        // Save debug merged PDF locally for inspection
        const debugMergedPath = path.join(__dirname, 'debug-merged.pdf');
        fs.writeFileSync(debugMergedPath, mergedBuffer);
        console.log(`[PDF-MERGE] Debug Merged PDF saved: ${debugMergedPath} (${mergedBuffer.length} bytes, total pages: ${mergedPdf.getPageCount()})`);

        const pdfBase64 = `data:application/pdf;base64,${mergedBuffer.toString('base64')}`;

        res.json({
            success: true,
            pdf: pdfBase64,
            debug_path: debugMergedPath,
            page_count: mergedPdf.getPageCount(),
            size_bytes: mergedBuffer.length
        });
    } catch (error) {
        console.error('[PDF-MERGE] Error merging PDFs:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to merge PDFs',
            message: error.message
        });
    }
});

// ---------------------------------------------------------------------------
// GET /health
// ---------------------------------------------------------------------------
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', message: 'PDF generator service is running on port ' + PORT });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
    console.log(`[PDF] Puppeteer & PDF-Merge service running on http://localhost:${PORT}`);
});
