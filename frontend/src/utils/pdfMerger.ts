// src/utils/pdfMerger.ts
// Client-side multi-PDF merger using pdf-lib.
// Combines multiple PDF Base64 strings into a single multi-page PDF document.

import { PDFDocument } from 'pdf-lib';

export const mergePdfBase64Array = async (pdfBase64List: string[]): Promise<string> => {
    if (!pdfBase64List || pdfBase64List.length === 0) {
        throw new Error('[PDF Merger] Empty PDF array provided for merge');
    }

    const validPdfs = pdfBase64List.filter(p => p && typeof p === 'string' && p.trim().length > 0);
    if (validPdfs.length === 0) {
        throw new Error('[PDF Merger] All provided PDF strings were empty or invalid');
    }

    console.log(`[PDF Merger] Starting validation and merge for ${validPdfs.length} source PDF(s)...`);

    try {
        const mergedPdf = await PDFDocument.create();

        for (let idx = 0; idx < validPdfs.length; idx++) {
            const pdfDataUri = validPdfs[idx];
            const base64Str = pdfDataUri.includes(',') ? pdfDataUri.split(',')[1] : pdfDataUri;

            if (!base64Str || base64Str.trim().length < 100) {
                console.error(`❌ [PDF Merger] Source PDF #${idx + 1} base64 payload is missing or too small (${base64Str?.length || 0} chars)`);
                throw new Error(`Source PDF #${idx + 1} payload is empty or invalid`);
            }

            let binaryStr: string;
            try {
                binaryStr = atob(base64Str.trim());
            } catch (b64Err) {
                console.error(`❌ [PDF Merger] Base64 decode failed for PDF #${idx + 1}:`, b64Err);
                throw new Error(`Failed to decode base64 for Source PDF #${idx + 1}`);
            }

            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
                bytes[i] = binaryStr.charCodeAt(i);
            }

            if (bytes.length < 500) {
                console.error(`❌ [PDF Merger] Source PDF #${idx + 1} byte size is too small (${bytes.length} bytes). Likely blank or corrupted.`);
                throw new Error(`Source PDF #${idx + 1} is empty or corrupted (${bytes.length} bytes)`);
            }

            const pdfDoc = await PDFDocument.load(bytes);
            const pageCount = pdfDoc.getPageCount();

            console.log(`📄 [PDF Merger] Source PDF #${idx + 1}: ${pageCount} page(s), ${bytes.length} bytes`);

            if (pageCount === 0) {
                console.error(`❌ [PDF Merger] Source PDF #${idx + 1} has 0 pages!`);
                throw new Error(`Source PDF #${idx + 1} contains 0 pages`);
            }

            const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
            copiedPages.forEach((page) => mergedPdf.addPage(page));
        }

        const totalPages = mergedPdf.getPageCount();
        if (totalPages === 0) {
            throw new Error('[PDF Merger] Merged result document has 0 pages');
        }

        console.log(`✅ Multi-PDF merge successful: ${totalPages} pages total`);
        const mergedBase64 = await mergedPdf.saveAsBase64({ dataUri: true });
        return mergedBase64;
    } catch (err: any) {
        console.error('❌ [PDF Merger] Client-side multi-PDF merge failed:', err);
        throw err;
    }
};
