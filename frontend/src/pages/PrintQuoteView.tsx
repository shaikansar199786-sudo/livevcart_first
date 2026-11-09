// src/pages/PrintQuoteView.tsx - Updated layout & inline SVGs
// Unauthenticated route rendered by Puppeteer to produce the quote PDF.
// Validates a short-lived HMAC token, fetches quote data from the API,
// and renders the exact same isPrintingVersion layout used by Print Quote.
// Emits a #print-ready sentinel element when rendering is complete.

import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import liveLogo from '../assets/1.png';
import liveCartSignature from '../assets/LIVE CART SINGTU.png';

// ─── Interfaces (mirrored from QuoteTab) ────────────────────────────────────
interface QuoteItem {
    item_id: string | number;
    particulars: string;
    brand: string;
    unit: string;
    quantity: number;
    rate: number;
    amount: number;
    category?: string;
    width?: string;
    height?: string;
    sft?: string;
    hsn_sac?: string;
    image_url?: string;
}

interface QuoteSection {
    section_id: string | number;
    section_name: string;
    name?: string;
    items: QuoteItem[];
}

interface QuoteData {
    quote_id: number;
    project_id: number;
    quote_number: string;
    version: number;
    total_amount: number;
    created_at: string;
    subtitle?: string;
    project_name?: string;
    client_name?: string;
    discount_percent?: number;
    coupon_code?: string;
    coupon_discount_type?: string;
    coupon_discount_value?: number;
    category_discounts?: any;
    sections: QuoteSection[];
}

// ─── Number to words ─────────────────────────────────────────────────────────
const numberToWords = (num: number): string => {
    if (num === 0) return 'Zero';
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const convert = (n: number): string => {
        if (n < 20) return ones[n];
        if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
        return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + convert(n % 100) : '');
    };
    const rounded = Math.round(num);
    const crores = Math.floor(rounded / 10000000);
    const lakhs = Math.floor((rounded % 10000000) / 100000);
    const thousands = Math.floor((rounded % 100000) / 1000);
    const remainder = rounded % 1000;
    let result = '';
    if (crores) result += convert(crores) + ' Crore ';
    if (lakhs) result += convert(lakhs) + ' Lakh ';
    if (thousands) result += convert(thousands) + ' Thousand ';
    if (remainder) result += convert(remainder);
    return result.trim() + ' Rupees Only';
};

const computeSqft = (widthStr?: any, heightStr?: any, depthStr?: any, mode?: string) => {
    const w = parseFloat(widthStr || '0') || 0;
    const h = parseFloat(heightStr || '0') || 0;
    const d = parseFloat(depthStr || '0') || 0;
    if (w > 0 && h > 0) {
        let res = 0;
        if (d > 0) {
            res = (w * h * d) / 27000000;
        } else {
            res = (w * h) / 90000;
        }
        return Math.round(res * 100) / 100;
    }
    return 0;
};

// ─── Page header (same as QuoteTab's print layout) ───────────────────────────
const PageHeader: React.FC<{ version: number }> = ({ version }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '2px solid #0f172a', paddingBottom: '12px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img src={liveLogo} alt="Logo" style={{ height: '44px', objectFit: 'contain' }} />
            <div>
                <h1 style={{ margin: 0, fontSize: '14pt', fontWeight: 800, color: '#0f172a' }}>Livincart Private Limited</h1>
                <p style={{ margin: 0, fontSize: '8pt', color: '#64748b', fontWeight: 600 }}>Official Quotation &amp; Estimation Workspace</p>
            </div>
        </div>
        <div style={{ textAlign: 'right' }}>
            <h2 style={{ margin: '0 0 2px 0', fontSize: '9pt', fontWeight: 800, color: '#0f172a' }}>COMPANY : LIVINCART AND SERVICES PRIVATE LIMITED</h2>
            <p style={{ margin: 0, fontSize: '9pt', fontWeight: 800, color: '#10b981' }}>GST : 37AAGCL5523Q1ZX</p>
        </div>
    </div>
);

import { API_BASE_URL } from '../config';

export const QuotePdfDocument: React.FC<{ quoteId?: string | number; projectId?: string | number; activePage?: number; token?: string; apiBase?: string; onPageCount?: (count: number) => void }> = ({
    quoteId,
    projectId,
    activePage,
    token = '',
    apiBase = API_BASE_URL,
    onPageCount
}) => {
    const [quote, setQuote] = useState<QuoteData | null>(null);
    const [error, setError] = useState<string>('');
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const origBodyBg = document.body.style.backgroundColor;
        const origDocBg = document.documentElement.style.backgroundColor;
        document.body.style.backgroundColor = '#ffffff';
        document.body.style.background = '#ffffff';
        document.documentElement.style.backgroundColor = '#ffffff';
        document.documentElement.style.background = '#ffffff';

        return () => {
            document.body.style.backgroundColor = origBodyBg;
            document.body.style.background = origBodyBg;
            document.documentElement.style.backgroundColor = origDocBg;
            document.documentElement.style.background = origDocBg;
        };
    }, []);

    useEffect(() => {
        const load = async () => {
            try {
                if (token && quoteId) {
                    const res = await axios.post(`${apiBase}/pdf/validate-token`, {
                        quote_id: parseInt(String(quoteId), 10),
                        token
                    });
                    if (res.data?.success && res.data?.data) {
                        setQuote(res.data.data);
                        return;
                    }
                }

                // 1. Try loading by specific quoteId if provided
                if (quoteId && intval(String(quoteId)) > 0) {
                    const res = await axios.get(`${apiBase}/quotes/${quoteId}`);
                    if (res.data?.success && res.data?.data) {
                        setQuote(res.data.data);
                        return;
                    } else if (res.data && res.data.sections) {
                        setQuote(res.data);
                        return;
                    }
                }

                // 2. Fallback: try loading latest quote by projectId or quoteId
                const pid = projectId || quoteId;
                if (pid) {
                    const resLatest = await axios.get(`${apiBase}/quotes/latest?project_id=${pid}&is_used=false`);
                    if (resLatest.data?.success && resLatest.data?.data) {
                        setQuote(resLatest.data.data);
                        return;
                    }
                }

                setError('Quotation data not found. Please save a quote version first.');
            } catch (err: any) {
                setError(err.response?.data?.message || 'Failed to load quotation details');
            }
        };

        const intval = (v: string) => parseInt(v, 10) || 0;

        load();
    }, [quoteId, projectId, token, apiBase]);

    // Signal Puppeteer that rendering is complete
    useEffect(() => {
        if (quote) {
            const t = setTimeout(() => setReady(true), 300);
            return () => clearTimeout(t);
        }
    }, [quote]);

    // Smooth scroll into view when activePage prop changes (Unconditional hook call)
    useEffect(() => {
        if (activePage && activePage > 0) {
            const timer = setTimeout(() => {
                const pageEl = document.getElementById(`pdf-page-${activePage}`) || document.getElementById(`quote-page-${activePage}`);
                if (pageEl) {
                    pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [activePage]);

    // Calculate and report total page count unconditionally to parent (Rules of Hooks)
    useEffect(() => {
        if (quote && onPageCount) {
            const extraData = (quote as any).extra_data_parsed || 
                (typeof (quote as any).extra_data === 'string' ? (JSON.parse((quote as any).extra_data || '{}') || {}) : ((quote as any).extra_data || {}));
            const hFields = extraData.hidden_fields || (quote as any).hidden_fields || {};
            const hasTerms = !hFields.termsAndConditions;
            const totalCount = hasTerms ? 5 : 4;
            onPageCount(totalCount);
        }
    }, [quote, onPageCount]);

    // ── Error state ────────────────────────────────────────────────────────
    if (error) {
        return (
            <div style={{ padding: '40px', fontFamily: 'Inter, sans-serif', color: '#ef4444' }}>
                <h2>PDF Generation Error</h2>
                <p>{error}</p>
            </div>
        );
    }

    // ── Loading state ──────────────────────────────────────────────────────
    if (!quote) {
        return (
            <div style={{ padding: '40px', fontFamily: 'Inter, sans-serif', color: '#64748b' }}>
                <p>Loading quote data...</p>
            </div>
        );
    }

    // ── Computed values ────────────────────────────────────────────────────
    const extra = (quote as any).extra_data_parsed || (typeof (quote as any).extra_data === 'string' ? (JSON.parse((quote as any).extra_data || '{}') || {}) : ((quote as any).extra_data || {}));
    const hiddenFields = extra.hidden_fields || (quote as any).hidden_fields || {};
    const customHeadings = extra.custom_headings || (quote as any).custom_headings || {};
    const headerBgColor = extra.custom_headings?.headerBgColor || (quote as any).custom_headings?.headerBgColor || 'rgb(254, 143, 62)';
    const isFinalVersion = !!(extra.is_final_version || (quote as any).is_final_version || (quote as any).status === 'qc_approved');
    const overallGstHidden = !!extra.overall_gst_line_hidden || !!hiddenFields.gst;

    console.log('[PrintQuoteView] Loaded extra:', extra, 'hiddenFields:', hiddenFields);

    const isHidden = (key: string): boolean => {
        return Boolean(
            hiddenFields[key] ||
            hiddenFields[key.toLowerCase()] ||
            (key === 'particulars' && (hiddenFields.particulars || hiddenFields.productDescription || (hiddenFields as any)['product_description'])) ||
            (key === 'qty' && (hiddenFields.qty || hiddenFields.quantity)) ||
            ((key === 'discount' || key === 'disc') && (hiddenFields.discount || hiddenFields.disc)) ||
            (key === 'amount' && (hiddenFields.amount || (hiddenFields as any)['item_amount'])) ||
            (key === 'shutterMaterial' && (hiddenFields.shutter || hiddenFields.shutterMaterial)) ||
            (key === 'carcassMaterial' && (hiddenFields.carcass || hiddenFields.carcassMaterial)) ||
            (key === 'categoryDiscount' && (hiddenFields.categoryDiscount || hiddenFields.category_discount)) ||
            (key === 'promoCode' && (hiddenFields.promoCode || hiddenFields.coupon || hiddenFields.promo_code)) ||
            ((key === 'generalDiscount' || key === 'flatDiscount') && (hiddenFields.generalDiscount || hiddenFields.flatDiscount || (hiddenFields as any)['general_discount'] || (hiddenFields as any)['flat_discount'])) ||
            (key === 'additionalCharges' && (hiddenFields.additionalCharges || hiddenFields.additional_charges)) ||
            (key === 'gst' && (hiddenFields.gst || overallGstHidden || extra.overall_gst_line_hidden)) ||
            (key === 'roundOff' && (hiddenFields.roundOff || hiddenFields.round_off))
        );
    };

    const moduleTotalColSpan = 1 + // '#' column
        (!isHidden('particulars') ? 1 : 0) +
        (!isHidden('shutterMaterial') ? 1 : 0) +
        (!isHidden('carcassMaterial') ? 1 : 0) +
        (!isHidden('dimensions') ? 1 : 0) +
        (!isHidden('rate') ? 1 : 0) +
        (!isHidden('qty') ? 1 : 0) +
        (!isHidden('discount') ? 1 : 0) +
        (!isHidden('gst') ? 1 : 0);

    const allColsCount = moduleTotalColSpan + (!isHidden('amount') ? 1 : 0);

    const sections = quote.sections || [];
    let baseGrossSum = 0;
    sections.forEach(sec => {
        (sec.items || []).forEach(it => {
            if (it.brand === 'HEADER') return;
            const qty = parseFloat(String(it.quantity)) || 0;
            const rate = parseFloat(String(it.rate)) || 0;
            baseGrossSum += (qty * rate);
        });
    });
    const grandTotal = baseGrossSum > 0 ? baseGrossSum : sections.reduce((acc, sec) =>
        acc + (sec.items || []).reduce((a, it) => a + (parseFloat(String(it.amount)) || 0), 0), 0
    );

    // Category discount calculation
    let categoryDiscountAmt = 0;
    if (quote.category_discounts && typeof quote.category_discounts === 'object') {
        Object.keys(quote.category_discounts).forEach(cat => {
            const disc = quote.category_discounts[cat];
            if (!disc || !disc.value) return;

            let catTotal = 0;
            const targetCat = cat.trim().toLowerCase();
            sections.forEach(sec => {
                sec.items.forEach(item => {
                    if (item.brand === 'HEADER') return;
                    const itemCat = (item.category || '').trim().toLowerCase();
                    const secName = (sec.section_name || sec.name || '').trim().toLowerCase();
                    const itemParticulars = (item.particulars || '').trim().toLowerCase();

                    const isDirectMatch = (itemCat && (itemCat === targetCat || itemCat.includes(targetCat) || targetCat.includes(itemCat))) ||
                        (secName && (secName === targetCat || secName.includes(targetCat) || targetCat.includes(secName))) ||
                        (itemParticulars && (itemParticulars.includes(targetCat) || targetCat.includes(itemParticulars)));

                    const isFallbackWoodWork = !itemCat && targetCat.includes('wood') && !secName.includes('accessories') && !secName.includes('ceiling') && !secName.includes('painting') && !secName.includes('lights') && !secName.includes('furniture') && !secName.includes('civil');

                    if (isDirectMatch || isFallbackWoodWork) {
                        catTotal += (parseFloat(String(item.amount)) || 0);
                    }
                });
            });

            if (disc.type === 'percent') {
                categoryDiscountAmt += catTotal * (disc.value / 100);
            } else {
                categoryDiscountAmt += Math.min(disc.value, catTotal);
            }
        });
    }
    categoryDiscountAmt = Math.round(categoryDiscountAmt);

    // Flat Amount discount
    const generalDisc = extra.general_discount || (quote as any).general_discount;
    const globalDisc = extra.global_discount || (quote as any).global_discount;
    let flatDiscountAmt = 0;
    if (generalDisc?.amount && (generalDisc.type === 'flat' || !generalDisc.type)) {
        flatDiscountAmt = parseFloat(generalDisc.amount) || 0;
    } else if (generalDisc?.value && (generalDisc.type === 'flat' || !generalDisc.type)) {
        flatDiscountAmt = parseFloat(generalDisc.value) || 0;
    } else if (globalDisc?.value && globalDisc.type === 'flat') {
        flatDiscountAmt = parseFloat(globalDisc.value) || 0;
    } else if (extra.flat_discount) {
        flatDiscountAmt = parseFloat(extra.flat_discount) || 0;
    }
    flatDiscountAmt = Math.round(flatDiscountAmt);

    // Coupon discount calculation
    const appliedCoupon = extra.applied_coupon || (quote.coupon_code ? {
        code: quote.coupon_code,
        discountType: quote.coupon_discount_type || 'percent',
        discountValue: quote.coupon_discount_value || 0
    } : null);

    let couponDiscountAmt = 0;
    if (appliedCoupon && appliedCoupon.discountValue) {
        const grossAfterCat = Math.max(0, grandTotal - categoryDiscountAmt - flatDiscountAmt);
        if (appliedCoupon.discountType === 'percent') {
            couponDiscountAmt = Math.round(grossAfterCat * (appliedCoupon.discountValue / 100));
        } else {
            couponDiscountAmt = Math.min(grossAfterCat, appliedCoupon.discountValue);
        }
    }

    // Additional charges
    const rawCharges = extra.additional_charges || (quote as any).additional_charges;
    let addChargesAmt = 0;
    let addChargesHasGst = false;
    let addChargesGstRate = 0;
    if (rawCharges) {
        if (typeof rawCharges === 'number') {
            addChargesAmt = rawCharges;
        } else if (typeof rawCharges === 'object') {
            if (typeof rawCharges.amount === 'object' && rawCharges.amount !== null) {
                addChargesAmt = parseFloat(rawCharges.amount.amount || rawCharges.amount.value) || 0;
            } else {
                addChargesAmt = parseFloat(rawCharges.amount || rawCharges.value) || 0;
            }
            addChargesHasGst = !!(rawCharges.withGst || rawCharges.with_gst || rawCharges.hasGst);
            addChargesGstRate = parseFloat(rawCharges.gstRate ?? rawCharges.gst_rate) || 0;
        }
    }
    const addChargesGstAmt = (addChargesHasGst && addChargesAmt > 0 && addChargesGstRate > 0)
        ? Math.round(addChargesAmt * (addChargesGstRate / 100))
        : 0;

    // Taxable Subtotal
    const taxableSubtotal = Math.max(0, grandTotal - categoryDiscountAmt - flatDiscountAmt - couponDiscountAmt);

    // Overall GST calculation: GST is applied to items only, and only rendered if !overallGstHidden
    const overallGstEnabled = extra.overall_gst_enabled !== false;
    const rawGstRate = extra.overall_gst_rate !== undefined ? extra.overall_gst_rate : (quote as any).overall_gst_rate;
    const overallGstRate = rawGstRate !== undefined && rawGstRate !== null && !isNaN(parseFloat(rawGstRate)) ? parseFloat(rawGstRate) : 18;

    // Check individual item GST rates across sections
    let itemsGstSum = 0;
    const uniqueItemGstRates = new Set<number>();
    sections.forEach((sec: any) => {
        (sec.items || []).forEach((it: any) => {
            if (it.brand === 'HEADER') return;
            const effQty = (it.quantity === undefined || it.quantity === null || parseFloat(it.quantity as any) <= 0) ? 1 : parseFloat(it.quantity as any);
            const rate = Math.max(0, parseFloat(it.rate as any) || 0);
            const baseAmt = effQty * rate;
            const disc = Math.min(100, Math.max(0, it.discount_percent || 0));
            const amtAfterDisc = Math.max(0, baseAmt - (baseAmt * (disc / 100)));
            const itemGst = (it.gst_rate !== undefined && it.gst_rate !== null && String(it.gst_rate).trim() !== '')
                ? Math.min(100, Math.max(0, parseFloat(it.gst_rate as any) || 0))
                : overallGstRate;
            uniqueItemGstRates.add(itemGst);
            itemsGstSum += amtAfterDisc * (itemGst / 100);
        });
    });

    const isMixedGst = uniqueItemGstRates.size > 1;
    let gstAmount = 0;
    if (overallGstEnabled) {
        if (isMixedGst) {
            const grossAfterCat = Math.max(0, grandTotal - categoryDiscountAmt);
            const otherDiscounts = flatDiscountAmt + couponDiscountAmt;
            let totalGst = itemsGstSum;
            if (otherDiscounts > 0 && grossAfterCat > 0) {
                const discountRatio = Math.max(0, 1 - (otherDiscounts / grossAfterCat));
                totalGst = itemsGstSum * discountRatio;
            }
            gstAmount = Math.round(totalGst);
        } else {
            const effectiveRate = uniqueItemGstRates.size === 1 ? Array.from(uniqueItemGstRates)[0] : overallGstRate;
            gstAmount = Math.round(taxableSubtotal * (effectiveRate / 100));
        }
    }
    const effectivePrintGstRate = taxableSubtotal > 0 ? (gstAmount / taxableSubtotal) * 100 : overallGstRate;

    // Unrounded Net Total (Includes taxable items, item GST, additional charges, and additional charges GST)
    const unroundedNetTotal = taxableSubtotal + addChargesAmt + addChargesGstAmt + gstAmount;

    // Round Off calculation
    const roundOffEnabled = extra.round_off_enabled !== false && !hiddenFields.roundOff;
    const roundOffAdjustment = roundOffEnabled ? (Math.round(unroundedNetTotal) - unroundedNetTotal) : 0;
    const finalTotal = roundOffEnabled ? Math.round(unroundedNetTotal) : Math.round(unroundedNetTotal * 100) / 100;

    const versionNum = quote.version || 1;
    const clientName = quote.client_name || extra.client_name || quote.subtitle || 'Valued Client';
    const formattedProjId = quote.project_id ? `DC-${quote.project_id}` : 'DC-1';
    const savedDate = new Date(quote.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

    // Page filtering helper - Always render all pages for continuous scrolling & smooth page navigation
    const showPage = (_pNum: number) => true;

    // ──────────────────────────────────────────────────────────────────────────
    // RENDER — 100% Present UI Design matching QuoteTab.tsx
    // ──────────────────────────────────────────────────────────────────────────
    return (
        <div style={{ backgroundColor: '#ffffff', minHeight: '100vh', width: '100%', margin: 0, padding: 0 }}>
            {ready && <div id="print-ready" style={{ display: 'none' }} />}
            <style>{`
                @media screen {
                    html, body, #root {
                        background-color: #334155 !important;
                        background: #334155 !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    .pdf-a4-screen-page {
                        width: 210mm;
                        max-width: 96%;
                        margin: 24px auto !important;
                        background-color: #ffffff !important;
                        border-radius: 6px;
                        box-shadow: 0 16px 45px rgba(0, 0, 0, 0.4) !important;
                        padding: 20px 24px !important;
                        box-sizing: border-box !important;
                    }
                }
                @media print {
                    html, body, #root {
                        background-color: #ffffff !important;
                        background: #ffffff !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    .pdf-a4-screen-page {
                        width: 100% !important;
                        max-width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        box-shadow: none !important;
                    }
                }
            `}</style>

            {/* PAGE 1: COVER PAGE */}
            {showPage(1) && (
                <div id="pdf-page-1" className="pdf-a4-screen-page page-break-cover" style={{ minHeight: '270mm', backgroundColor: '#ffffff', position: 'relative', boxSizing: 'border-box', pageBreakAfter: 'always', breakAfter: 'page' }}>
                    <table style={{ width: '100%', height: '100%', minHeight: '250mm', borderCollapse: 'collapse' }}>
                        <tbody>
                            {/* Row 1: Top Header */}
                            <tr>
                                <td style={{ verticalAlign: 'top', border: 'none', padding: 0 }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', borderBottom: '2.5px solid #ea580c', paddingBottom: '12px' }}>
                                        <tbody>
                                            <tr>
                                                <td style={{ width: '50%', verticalAlign: 'middle', border: 'none', padding: 0 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <img src={liveLogo} alt="Logo" style={{ height: '48px', objectFit: 'contain' }} />
                                                        <div>
                                                            <div style={{ fontSize: '13pt', fontWeight: 900, color: '#000000', lineHeight: 1.15, whiteSpace: 'nowrap' }}>Livincart Private Limited</div>
                                                            <div style={{ fontSize: '7.5pt', color: '#64748b', fontWeight: 500, whiteSpace: 'nowrap' }}>Official Quotation &amp; Estimation Workspace</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td style={{ width: '50%', verticalAlign: 'middle', textAlign: 'right', border: 'none', padding: 0 }}>
                                                    <div style={{ fontSize: '10pt', fontWeight: 900, color: '#000000', marginBottom: '4px' }}>LIVINCART AND SERVICES PRIVATE LIMITED</div>
                                                    <div style={{ fontSize: '7.5pt', color: '#475569', fontWeight: 600, lineHeight: 1.35, whiteSpace: 'nowrap' }}>
                                                        <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNlYTU4MGMiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMjEgMTBjMCA3LTkgMTMtOSAxM3MtOS02LTktMTNhOSA5IDAgMSAxIDE4IDB6Ii8+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMCIgcj0iMyIvPjwvc3ZnPg==" alt="" style={{ width: '10px', height: '10px', verticalAlign: '-1px', marginRight: '4px', display: 'inline-block' }} />
                                                        Visakhapatnam, Andhra Pradesh – 530020
                                                    </div>
                                                    <div style={{ fontSize: '7.5pt', color: '#475569', fontWeight: 600, lineHeight: 1.35, whiteSpace: 'nowrap' }}>
                                                        <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNlYTU4MGMiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMjIgMTYuOTJ2M2EyIDIgMCAwIDEtMi4xOCAyIDE5Ljc5IDE5Ljc5IDAgMCAxLTguNjMtMy4wNyAxOS41IDE5LjUgMCAwIDEtNi02IDE5Ljc5IDE5Ljc5IDAgMCAxLTMuMDctOC42N0EyIDIgMCAwIDEgNC4xMSAyMmgzYTIgMiAwIDAgMSAyIDEuNzIgMTIuODQgMTIuODQgMCAwIDAgLjcgMi44MSAyIDIgMCAwIDEtLjQ1IDIuMTFMOC4wOSA5LjkxYTE2IDE2IDAgMCAwIDYgNmwxLjI3LTEuMjdhMiAyIDAgMCAxIDIuMTEtLjQ1IDEyLjg0IDEyLjg0IDAgMCAwIDIuODEuN0EyIDIgMCAwIDEgMjIgMTYuOTJ6Ii8+PC9zdmc+" alt="" style={{ width: '10px', height: '10px', verticalAlign: '-1px', marginRight: '4px', display: 'inline-block' }} />
                                                        +91 7702312351
                                                    </div>
                                                    <div style={{ fontSize: '7.5pt', color: '#475569', fontWeight: 600, lineHeight: 1.35, whiteSpace: 'nowrap' }}>
                                                        <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNlYTU4MGMiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cG9seWxpbmUgcG9pbnRzPSIyMiw2IDEyLDEzIDIsNiIvPjwvc3ZnPg==" alt="" style={{ width: '10px', height: '10px', verticalAlign: '-1px', marginRight: '4px', display: 'inline-block' }} />
                                                        contact@livincart.com &nbsp;&nbsp;
                                                        <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMwMjg4YzciIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMCIvPjxsaW5lIHgxPSIyIiB5MT0iMTIiIHgyPSIyMiIgeTI9IjEyIi8+PHBhdGggZD0iTTEyIDJhMTUuMyAxNS43IDAgMCAxIDQgMTAgMTUuMyAxNS43IDAgMCAxLTQgMTAgMTUuMyAxNS43IDAgMCAxLTQtMTAgMTUuMyAxNS43IDAgMCAxIDQtMTB6Ii8+PC9zdmc+" alt="" style={{ width: '10px', height: '10px', verticalAlign: '-1px', marginRight: '4px', display: 'inline-block' }} />
                                                        www.livincart.com
                                                    </div>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </td>
                            </tr>

                            {/* Row 2: Top Spacer (220px) */}
                            <tr style={{ height: '220px' }}>
                                <td style={{ height: '220px', border: 'none', padding: 0 }}>&nbsp;</td>
                            </tr>

                            {/* Row 3: Center Hero Content */}
                            <tr>
                                <td style={{ verticalAlign: 'middle', border: 'none', padding: 0, textAlign: 'center' }}>
                                    <center>
                                        <table align="center" style={{ width: '100%', borderCollapse: 'collapse', margin: '0 auto', marginLeft: 'auto', marginRight: 'auto' }}>
                                            <tbody>
                                                <tr>
                                                    <td align="center" style={{ textAlign: 'center', verticalAlign: 'middle', border: 'none', width: '100%' }}>
                                                        <div style={{ textAlign: 'center', width: '100%', margin: '0 auto' }}>
                                                            <img src={liveLogo} alt="Logo Center" style={{ height: '80px', objectFit: 'contain', marginBottom: '14px', display: 'inline-block', margin: '0 auto' }} />
                                                        </div>
                                                        <div style={{ fontSize: '13.5pt', fontWeight: 900, color: '#000000', marginBottom: '8px', letterSpacing: '0.5px', textAlign: 'center', width: '100%' }}>LIVINCART AND SERVICES PRIVATE LIMITED</div>
                                                        <div style={{ width: '160px', height: '0px', borderBottom: '3.5px solid #ea580c', margin: '8px auto 22px', marginLeft: 'auto', marginRight: 'auto' }} />

                                                        <h1 style={{ margin: 0, fontSize: '24pt', fontWeight: 900, color: '#000000', letterSpacing: '0.5px', textAlign: 'center', width: '100%' }}>OFFICIAL QUOTATION &amp;</h1>
                                                        <h1 style={{ margin: '6px 0 0 0', fontSize: '26pt', fontWeight: 900, color: '#ea580c', letterSpacing: '0.5px', textAlign: 'center', width: '100%' }}>
                                                            PROJECT ESTIMATE {isFinalVersion ? '(FINAL VERSION)' : ''}
                                                        </h1>
                                                        <div style={{ width: '200px', height: '0px', borderBottom: '3.5px solid #ea580c', margin: '12px auto 26px', marginLeft: 'auto', marginRight: 'auto' }} />

                                                        {/* Quote Details Box */}
                                                        <table className="quote-header-details-table" align="center" style={{ margin: '0 auto', marginLeft: 'auto', marginRight: 'auto', border: '2px solid #ea580c', borderRadius: '20px', borderCollapse: 'separate', backgroundColor: '#ffffff' }}>
                                                            <tbody>
                                                                <tr>
                                                                    <td align="center" style={{ width: '50%', border: 'none', padding: '12px 24px', verticalAlign: 'middle', textAlign: 'center' }}>
                                                                        <table align="center" style={{ margin: '0 auto', borderCollapse: 'collapse' }}>
                                                                            <tbody>
                                                                                <tr>
                                                                                    <td style={{ verticalAlign: 'middle', border: 'none', paddingRight: '8px' }}>
                                                                                        <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNlYTU4MGMiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTYgNGgyYTIgMiAwIDAgMSAyIDJ2MTRhMiAyIDAgMCAxLTIgMkg2YTIgMiAwIDAgMS0yLTJWNmEyIDIgMCAwIDEgMi0yaDIiLz48cmVjdCB4PSI4IiB5PSIyIiB3aWR0aD0iOCIgaGVpZ2h0PSI0IiByeD0iMSIgcnk9IjEiLz48L3N2Zz4=" alt="" style={{ height: '20px', verticalAlign: 'middle' }} />
                                                                                    </td>
                                                                                    <td style={{ verticalAlign: 'middle', border: 'none', textAlign: 'center' }}>
                                                                                        <div style={{ fontSize: '8.5pt', color: '#64748b', fontWeight: 600, textAlign: 'center' }}>Quote No.</div>
                                                                                        <div style={{ fontSize: '11pt', fontWeight: 900, color: '#000000', whiteSpace: 'nowrap', textAlign: 'center' }}>
                                                                                            {(() => {
                                                                                                const val = String(formattedProjId || '101').trim();
                                                                                                const cleanVal = val.startsWith('QTN-') ? val : `QTN-${val}`;
                                                                                                return `${cleanVal}-v${versionNum}`;
                                                                                            })()}
                                                                                        </div>
                                                                                    </td>
                                                                                </tr>
                                                                            </tbody>
                                                                        </table>
                                                                    </td>
                                                                    <td align="center" style={{ width: '50%', border: 'none', borderLeft: '1.5px solid #fed7aa', padding: '12px 24px', verticalAlign: 'middle', textAlign: 'center' }}>
                                                                        <table align="center" style={{ margin: '0 auto', borderCollapse: 'collapse' }}>
                                                                            <tbody>
                                                                                <tr>
                                                                                    <td style={{ verticalAlign: 'middle', border: 'none', paddingRight: '8px' }}>
                                                                                        <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMzYjgyZjYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB4PSIzIiB5PSI0IiB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHJ4PSIyIiByeT0iMiIvPjxsaW5lIHgxPSIxNiIgeTE9IjIiIHgyPSIxNiIgeTI9IjYiLz48bGluZSB4MT0iOCIgeTE9IjIiIHgyPSI4IiB5Mj0iNiIvPjxsaW5lIHgxPSIzIiB5MT0iMTAiIHgyPSIyMSIgeTI9IjEwIi8+PC9zdmc+" alt="" style={{ height: '20px', verticalAlign: 'middle' }} />
                                                                                    </td>
                                                                                    <td style={{ verticalAlign: 'middle', border: 'none', textAlign: 'center' }}>
                                                                                        <div style={{ fontSize: '8.5pt', color: '#64748b', fontWeight: 600, textAlign: 'center' }}>Date</div>
                                                                                        <div style={{ fontSize: '11pt', fontWeight: 900, color: '#000000', whiteSpace: 'nowrap', textAlign: 'center' }}>{savedDate}</div>
                                                                                    </td>
                                                                                </tr>
                                                                            </tbody>
                                                                        </table>
                                                                    </td>
                                                                </tr>
                                                            </tbody>
                                                        </table>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </center>
                                </td>
                            </tr>

                            {/* Row 2: Spacer to lock footer at bottom edge of Page 1 */}
                            <tr style={{ height: '440px' }}>
                                <td style={{ height: '440px', border: 'none', padding: 0 }}>&nbsp;</td>
                            </tr>

                            {/* Row 3: Bottom Contact Card */}
                            <tr>
                                <td style={{ verticalAlign: 'bottom', border: 'none', padding: 0 }}>
                                    <div style={{ border: '2px solid #ea580c', borderRadius: '18px', backgroundColor: '#ffffff', overflow: 'hidden' }}>
                                        <table className="cover-card-orange-strip" style={{ width: '100%', backgroundColor: '#ea580c', background: '#ea580c', borderCollapse: 'collapse' }}>
                                            <tbody>
                                                <tr>
                                                    <td style={{ width: '38%', border: 'none', padding: '10px 14px', color: '#ffffff', fontSize: '8.5pt', fontWeight: 800, verticalAlign: 'middle', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                                        <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNCIgaGVpZ2h0PSIxNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSIjZmZmZmZmIj48cGF0aCBkPSJNMTIgMkM4LjEzIDIgNSA1LjEzIDUgOWMwIDUuMjUgNyAxMyA3IDEzczctNy43NSA3LTEzYzAtMy44Ny0zLjEzLTctNy03em0wIDkuNWMtMS4zOCAwLTIuNS0xLjEyLTIuNS0yLjVzMS4xMi0yLjUgMi41LTIuNSAyLjUgMS4xMiAyLjUgMi41LTEuMTIgMi41LTIuNSAyLjV6Ii8+PC9zdmc+" alt="" style={{ width: '12px', height: '12px', verticalAlign: '-1px', marginRight: '5px', display: 'inline-block' }} />
                                                        Visakhapatnam, Andhra Pradesh 530020
                                                    </td>
                                                    <td style={{ width: '26%', border: 'none', borderLeft: '1.5px solid #ffffff', padding: '10px 14px', color: '#ffffff', fontSize: '8.5pt', fontWeight: 800, verticalAlign: 'middle', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                                        <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNCIgaGVpZ2h0PSIxNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSIjZmZmZmZmIj48cGF0aCBkPSJNNi42MiAxMC43OWMxLjQ4IDIuODMgMy43NiA1LjE4IDYuNTkgNi41OWwyLjItMi4yYy4yNy0uMjcuNjctLjM2IDEuMDItLjI0IDEuMTIuMzcgMi4zMy41NyAzLjU3LjU3LjU1IDAgMSAuNDUgMSAxVjIwYzAgLjU1LS40NSAxLTEgMS05LjM5IDAtMTctNy42MS0xNy0xNyAwLS41NS40NS0xIDEtMWgzLjVjLjU1IDAgMSAuNDUgMSAxIDAgMS4yNS4yIDIuNDUuNTcgMy41Ny4xMS4zNS4wMy43NC0uMjUgMS4wMmwtMi4yIDIuMnoiLz48L3N2Zz4=" alt="" style={{ width: '12px', height: '12px', verticalAlign: '-1px', marginRight: '5px', display: 'inline-block' }} />
                                                        +91 7702312351
                                                    </td>
                                                    <td style={{ width: '36%', border: 'none', borderLeft: '1.5px solid #ffffff', padding: '10px 14px', color: '#ffffff', fontSize: '8.5pt', fontWeight: 800, verticalAlign: 'middle', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                                        <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNCIgaGVpZ2h0PSIxNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSIjZmZmZmZmIj48cGF0aCBkPSJNMjAgNEg0Yy0xLjEgMC0xLjk5LjktMS45OSAyTDIgMThjMCAxLjEuOSAyIDIgMmgxNmMxLjEgMCAyLS45IDItNlY2YzAtMS4xLS45LTItMi0yek00IDhsOCA1IDgtNVY2bC04IDUtOC01djJ6Ii8+PC9zdmc+" alt="" style={{ width: '12px', height: '12px', verticalAlign: '-1px', marginRight: '5px', display: 'inline-block' }} />
                                                        contact@livincart.com
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>

                                        <table className="cover-card-light-strip" style={{ width: '100%', backgroundColor: '#fff7ed', background: '#fff7ed', borderTop: '1.5px solid #fed7aa', borderCollapse: 'collapse' }}>
                                            <tbody>
                                                <tr>
                                                    <td style={{ width: '50%', border: 'none', padding: '10px 14px', color: '#0f172a', fontSize: '9pt', fontWeight: 900, verticalAlign: 'middle', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                                        <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNCIgaGVpZ2h0PSIxNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSIjZWE1ODBjIj48cGF0aCBkPSJNMTIgMkM2LjQ4IDIgMiA2LjQ4IDIgMTJzNC40OCAxMCAxMCAxMCAxMC04LjQ4IDEwLTEwUzE3LjUyIDIgMTIgMnptLTEgMTcuOTNjLTMuOTUtLjQ5LTctMy44NS03LTctMyAwLS42Mi4wOC0xLjIxLjIxLTEuOTlMOSAxNXZjMCAxLjEuOSAyIDIgMnYxLjkzejptNi45LTIuNThjLS4yNi0uODEtMS0xLjM5LTEuOS0xLjM5aC0xdi0zYzAtLjU1LS40NS0xLTEtMUg8di0yaDJjNC41NSAwIDEtLjQ1IDEtMVY3aDJjMS4xIDAgMi0uOSAyLTJ2LS40MWMyLjkzIDEuMTkgNSA0LjA2IDUgNy40MSAwIDIuMDgtLjggMy45Ny0yLjEgNS4zOXoiLz48L3N2Zz4=" alt="" style={{ width: '12px', height: '12px', verticalAlign: '-1px', marginRight: '6px', display: 'inline-block' }} />
                                                        www.livincart.com
                                                    </td>
                                                    <td style={{ width: '50%', border: 'none', borderLeft: '1.5px solid #fed7aa', padding: '10px 14px', color: '#0f172a', fontSize: '9pt', fontWeight: 900, verticalAlign: 'middle', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                                        <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNCIgaGVpZ2h0PSIxNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSIjZWE1ODBjIj48cGF0aCBkPSJNMTIgMTJjMi4yMSAwIDQtMS43OSA0LTRzLTEuNzktNC00LTQtNCAxLjc5LTQgNCAxLjc5IDQgNCA0em0wIDJjLTIuNjcgMC04IDEuMzQtOCA0djJoMTZ2LTJjMC0yLjY2LTUuMzMtNC04LTR6Ii8+PC9zdmc+" alt="" style={{ width: '12px', height: '12px', verticalAlign: '-1px', marginRight: '6px', display: 'inline-block' }} />
                                                        Livincart Team
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── PAGE 2: PROJECT INFORMATION & SCOPE DETAILS (PRESENT UI DESIGN) ── */}
            {showPage(2) && (
                <div id="pdf-page-2" className="page-break-project-info" style={{ minHeight: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', backgroundColor: '#ffffff', padding: '16px 24px 20px 24px', position: 'relative', boxSizing: 'border-box', pageBreakAfter: 'always', breakAfter: 'page', marginBottom: '0' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
                        <div>
                            {/* Header */}
                            <table style={{ width: '100%', borderCollapse: 'collapse', borderBottom: '2.5px solid #ea580c', paddingBottom: '14px', marginBottom: '28px' }}>
                                <tbody>
                                    <tr>
                                        <td style={{ width: '50%', verticalAlign: 'top', border: 'none', padding: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                                <img src={liveLogo} alt="Logo" style={{ height: '50px', objectFit: 'contain' }} />
                                                <div>
                                                    <div style={{ fontSize: '15pt', fontWeight: 900, color: '#000000', marginBottom: '2px' }}>Livincart Private Limited</div>
                                                    <div style={{ fontSize: '8pt', color: '#64748b', fontWeight: 500 }}>Official Quotation &amp; Estimation Workspace</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ width: '50%', verticalAlign: 'top', textAlign: 'right', border: 'none', padding: 0 }}>
                                            <div style={{ fontSize: '9.5pt', fontWeight: 900, color: '#000000', marginBottom: '4px' }}>LIVINCART AND SERVICES PRIVATE LIMITED</div>
                                            <div style={{ fontSize: '7.5pt', color: '#475569', fontWeight: 600, marginTop: '4px', display: 'block' }}>
                                                Visakhapatnam, Andhra Pradesh - 530020
                                            </div>
                                            <div style={{ fontSize: '7.5pt', color: '#475569', fontWeight: 600, marginTop: '3px', display: 'block' }}>
                                                Phone: +91 7702312351
                                            </div>
                                            <div style={{ fontSize: '7.5pt', color: '#475569', fontWeight: 600, marginTop: '3px', display: 'block' }}>
                                                contact@livincart.com &nbsp;&nbsp;|&nbsp;&nbsp; www.livincart.com
                                            </div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>

                            {/* Title */}
                            <div style={{ marginBottom: '28px' }}>
                                <h2 style={{ margin: 0, fontSize: '20pt', fontWeight: 900, color: '#0f172a' }}>PROJECT INFORMATION</h2>
                                <div style={{ width: '80px', height: '4px', backgroundColor: '#ea580c', marginTop: '8px' }} />
                            </div>

                            {/* Spacious Dotted Grid */}
                            <div style={{ border: '2px solid #cbd5e1', borderRadius: '18px', padding: '32px', backgroundColor: '#ffffff', marginBottom: '32px', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', borderBottom: '2px dashed #cbd5e1', paddingBottom: '28px', marginBottom: '28px' }}>
                                    <tbody>
                                        <tr>
                                            <td style={{ width: '33.33%', border: 'none', borderRight: '2px dashed #cbd5e1', paddingRight: '16px', verticalAlign: 'top' }}>
                                                <div style={{ fontSize: '9.5pt', color: '#64748b', fontWeight: 700, marginBottom: '8px' }}>Proposal Created for:</div>
                                                <div style={{ fontSize: '14pt', fontWeight: 900, color: '#ea580c' }}>{clientName}</div>
                                            </td>
                                            <td style={{ width: '33.33%', border: 'none', borderRight: '2px dashed #cbd5e1', paddingLeft: '16px', paddingRight: '16px', verticalAlign: 'top' }}>
                                                <div style={{ fontSize: '9.5pt', color: '#64748b', fontWeight: 700, marginBottom: '8px' }}>Project ID:</div>
                                                <div style={{ fontSize: '14pt', fontWeight: 900, color: '#ea580c' }}>{formattedProjId}</div>
                                            </td>
                                            <td style={{ width: '33.33%', border: 'none', paddingLeft: '16px', verticalAlign: 'top' }}>
                                                <div style={{ fontSize: '9.5pt', color: '#64748b', fontWeight: 700, marginBottom: '8px' }}>Proposal Created on:</div>
                                                <div style={{ fontSize: '14pt', fontWeight: 900, color: '#ea580c' }}>{savedDate}</div>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>

                                {!hiddenFields.scope && (
                                    <div style={{ padding: '0 0 28px 0', borderBottom: '2px dashed #cbd5e1', marginBottom: '28px' }}>
                                        <div style={{ fontSize: '9.5pt', color: '#64748b', fontWeight: 700, marginBottom: '8px' }}>Scope of Work:</div>
                                        <div style={{ fontSize: '14pt', fontWeight: 900, color: '#ea580c', lineHeight: 1.45 }}>Complete Interior Design &amp; Custom Modular Execution</div>
                                    </div>
                                )}

                                <table style={{ width: '100%', borderCollapse: 'collapse', borderBottom: '2px dashed #cbd5e1', paddingBottom: '28px', marginBottom: '28px' }}>
                                    <tbody>
                                        <tr>
                                            <td style={{ width: '33.33%', border: 'none', borderRight: '2px dashed #cbd5e1', paddingRight: '16px', verticalAlign: 'top' }}>
                                                <div style={{ fontSize: '9.5pt', color: '#64748b', fontWeight: 700, marginBottom: '8px' }}>Time for Production &amp; Installation:</div>
                                                <div style={{ fontSize: '13pt', fontWeight: 900, color: '#0f172a' }}>75 Business Days</div>
                                            </td>
                                            <td style={{ width: '33.33%', border: 'none', borderRight: '2px dashed #cbd5e1', paddingLeft: '16px', paddingRight: '16px', verticalAlign: 'top' }}>
                                                <div style={{ fontSize: '9.5pt', color: '#64748b', fontWeight: 700, marginBottom: '8px' }}>Project Category:</div>
                                                <div style={{ fontSize: '13pt', fontWeight: 900, color: '#0f172a' }}>Interior &amp; Furniture Projects</div>
                                            </td>
                                            <td style={{ width: '33.33%', border: 'none', paddingLeft: '16px', verticalAlign: 'top' }}>
                                                <div style={{ fontSize: '9.5pt', color: '#64748b', fontWeight: 700, marginBottom: '8px' }}>Designer Name:</div>
                                                <div style={{ fontSize: '13pt', fontWeight: 900, color: '#0f172a' }}>Livincart Team</div>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>

                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <tbody>
                                        <tr>
                                            <td style={{ width: '33.33%', border: 'none', borderRight: '2px dashed #cbd5e1', paddingRight: '16px', verticalAlign: 'top' }}>
                                                <div style={{ fontSize: '9.5pt', color: '#64748b', fontWeight: 700, marginBottom: '8px' }}>Sales Manager Name:</div>
                                                <div style={{ fontSize: '13pt', fontWeight: 900, color: '#0f172a' }}>{(!extra.sales_manager_name || extra.sales_manager_name.toLowerCase().includes('admin')) ? ((quote as any)?.sales_manager_name && !(quote as any).sales_manager_name.toLowerCase().includes('admin') ? (quote as any).sales_manager_name : 'Thanmai') : extra.sales_manager_name}</div>
                                            </td>
                                            <td style={{ width: '33.33%', border: 'none', borderRight: '2px dashed #cbd5e1', paddingLeft: '16px', paddingRight: '16px', verticalAlign: 'top' }}>
                                                <div style={{ fontSize: '9.5pt', color: '#64748b', fontWeight: 700, marginBottom: '8px' }}>Sales Manager Phone:</div>
                                                <div style={{ fontSize: '13pt', fontWeight: 900, color: '#0f172a' }}>{(!extra.sales_manager_phone || extra.sales_manager_phone === '9182263332') ? ((quote as any)?.sales_manager_phone && (quote as any).sales_manager_phone !== '9182263332' ? (quote as any).sales_manager_phone : '7702312351') : extra.sales_manager_phone}</div>
                                            </td>
                                            <td style={{ width: '33.33%', border: 'none', paddingLeft: '16px', verticalAlign: 'top' }}>
                                                <div style={{ fontSize: '9.5pt', color: '#64748b', fontWeight: 700, marginBottom: '8px' }}>Sales Manager Email:</div>
                                                <div style={{ fontSize: '13pt', fontWeight: 900, color: '#0f172a' }}>{extra.sales_manager_email || (quote as any)?.sales_manager_email || 'sukendra.ch@livincart.com'}</div>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Orange Note Box */}
                        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff7ed', borderRadius: '14px', border: '2px solid #fed7aa', marginTop: 'auto' }}>
                            <tbody>
                                <tr>
                                    <td style={{ width: '44px', minWidth: '44px', maxWidth: '44px', padding: '16px 12px 16px 20px', verticalAlign: 'middle', border: 'none' }}>
                                        <div style={{ width: '32px', height: '32px', minWidth: '32px', maxWidth: '32px', lineHeight: '32px', borderRadius: '50%', backgroundColor: '#ea580c', color: '#ffffff', textAlign: 'center', fontWeight: 900, fontSize: '14pt', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>i</div>
                                    </td>
                                    <td style={{ padding: '16px 20px 16px 0', verticalAlign: 'middle', border: 'none', fontSize: '10.5pt', color: '#7c2d12', fontWeight: 600, lineHeight: 1.45 }}>
                                        <strong style={{ color: '#ea580c', marginRight: '8px' }}>NOTE:</strong>
                                        The timeline may change based on Location, Finishes, Project Value, and Civil Scope of work.
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── PAGE 3: MODULES SUMMARY ── */}
            {showPage(3) && (
                <div id="pdf-page-3" className="page-break-modules-summary" style={{ minHeight: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '16px 24px 20px 24px', backgroundColor: '#ffffff', position: 'relative', boxSizing: 'border-box', pageBreakAfter: 'always', breakAfter: 'page', marginBottom: '0' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
                        <div>
                            <PageHeader version={versionNum} />
                            <h3 style={{ fontSize: '12pt', fontWeight: 800, color: '#0f172a', marginBottom: '16px', textTransform: 'uppercase' }}>
                                Modules Summary — Commercial Estimate — Version {versionNum}
                            </h3>
                            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px', fontSize: '9.5pt' }}>
                                <thead>
                                    <tr style={{ backgroundColor: headerBgColor, color: '#ffffff' }}>
                                        <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#ffffff' }}>#</th>
                                        <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#ffffff' }}>Module Name</th>
                                        <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#ffffff' }}>Total Items</th>
                                        <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#ffffff' }}>Amount (₹)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sections.map((sec, si) => {
                                        const secGross = sec.items.reduce((a, it) => {
                                            if (it.brand === 'HEADER') return a;
                                            const isLump = (it as any).pricing_mode === 'lumpsum' || (!it.width && !it.height && !it.sft);
                                            const qty = parseFloat(String(it.quantity)) || 0;
                                            const rate = parseFloat(String(it.rate)) || 0;
                                            const base = (isLump || qty === 0) ? rate : (qty * rate);
                                            return a + base;
                                        }, 0);
                                        const secTotal = sec.items.reduce((a, it) => a + (parseFloat(String(it.amount)) || 0), 0);
                                        const displayAmt = secGross > 0 ? secGross : secTotal;
                                        const itemCount = sec.items.filter(it => it.brand !== 'HEADER').length;
                                        const secSft = sec.items.reduce((sum, it) => {
                                            if (it.brand === 'HEADER') return sum;
                                            const sft = computeSqft(it.width, it.height, it.sft, (it as any).pricing_mode);
                                            return sum + (sft * (it.quantity || 1));
                                        }, 0);
                                        return (
                                            <tr key={sec.section_id} style={{ borderBottom: '1px solid #f3f4f6', backgroundColor: si % 2 === 1 ? '#fffdf9' : '#ffffff' }}>
                                                <td style={{ padding: '10px 14px', fontWeight: 700, color: '#f97316' }}>{si + 1}</td>
                                                <td style={{ padding: '10px 14px', fontWeight: 800, color: '#111827' }}>{sec.section_name}</td>
                                                <td style={{ padding: '10px 14px', textAlign: 'center', color: '#374151', fontWeight: 600 }}>
                                                    <div>{itemCount}</div>
                                                    {secSft > 0 && (
                                                        <div style={{ color: '#ea580c', fontSize: '7.5pt', fontWeight: 700, wordBreak: 'break-all' }} title={`Exact Module SFT: ${Number(secSft.toFixed(2))}`}>
                                                            {Number(secSft.toFixed(2))} SFT
                                                        </div>
                                                    )}
                                                </td>
                                                <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#ea580c' }}>
                                                    <div>₹ {displayAmt.toLocaleString('en-IN')}</div>
                                                    {secGross > 0 && secGross !== secTotal && (
                                                        <div style={{ fontSize: '7.5pt', color: '#64748b', fontWeight: 700, marginTop: '2px' }}>
                                                            (Net: ₹ {secTotal.toLocaleString('en-IN')})
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {/* 1) Total Modules Gross Amount */}
                                    <tr style={{ borderTop: '2px solid #fed7aa', backgroundColor: '#fffaf0' }}>
                                        <td colSpan={3} style={{ padding: '10px 14px', fontWeight: 800, textAlign: 'right', fontSize: '9.5pt', color: '#111827' }}>
                                            <div>Total Modules Gross Amount</div>
                                            {(() => {
                                                const grandTotalSft = sections.reduce((secSum, sec) => {
                                                    return secSum + sec.items.reduce((itemSum, it) => {
                                                        if (it.brand === 'HEADER') return itemSum;
                                                        const sft = computeSqft(it.width, it.height, it.sft, (it as any).pricing_mode);
                                                        return itemSum + (sft * (it.quantity || 1));
                                                    }, 0);
                                                }, 0);
                                                return grandTotalSft > 0 ? (
                                                    <div style={{ fontSize: '8pt', color: '#ea580c', fontWeight: 800, wordBreak: 'break-all' }} title={`Exact Total SFT: ${grandTotalSft}`}>
                                                        Total SFT: {grandTotalSft} SFT
                                                    </div>
                                                ) : null;
                                            })()}
                                        </td>
                                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#ea580c', fontSize: '11pt' }}>₹ {grandTotal.toLocaleString('en-IN')}</td>
                                    </tr>

                                    {/* 2) Category-Wise Discount */}
                                    {categoryDiscountAmt > 0 && !isHidden('categoryDiscount') && (
                                        <tr style={{ borderTop: '1px dashed #fed7aa', backgroundColor: '#fff7ed' }}>
                                            <td colSpan={3} style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 700, fontSize: '9pt', color: '#c2410c' }}>
                                                Total Category-Wise Discount:
                                            </td>
                                            <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 800, color: '#c2410c', fontSize: '10pt' }}>
                                                - ₹ {Math.round(categoryDiscountAmt).toLocaleString('en-IN')}
                                            </td>
                                        </tr>
                                    )}

                                    {/* 3) Flat Amount Discount */}
                                    {flatDiscountAmt > 0 && !isHidden('flatDiscount') && !isHidden('generalDiscount') && (
                                        <tr style={{ borderTop: '1px dashed #fed7aa', backgroundColor: '#fff7ed' }}>
                                            <td colSpan={3} style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 700, fontSize: '9pt', color: '#c2410c' }}>
                                                Flat Amount Discount:
                                            </td>
                                            <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 800, color: '#c2410c', fontSize: '10pt' }}>
                                                - ₹ {flatDiscountAmt.toLocaleString('en-IN')}
                                            </td>
                                        </tr>
                                    )}

                                    {/* 4) Promo / Coupon Code Discount */}
                                    {appliedCoupon && couponDiscountAmt > 0 && !isHidden('promoCode') && (
                                        <tr style={{ borderTop: '1px dashed #fed7aa', backgroundColor: '#fff7ed' }}>
                                            <td colSpan={3} style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 700, fontSize: '9pt', color: '#ea580c' }}>
                                                Promo Code: <strong>{appliedCoupon.code}</strong> ({appliedCoupon.discountType === 'percent' ? `${appliedCoupon.discountValue}% OFF` : `₹${appliedCoupon.discountValue?.toLocaleString('en-IN')} OFF`})
                                            </td>
                                            <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 800, color: '#ea580c', fontSize: '10pt' }}>
                                                - ₹ {Math.round(couponDiscountAmt).toLocaleString('en-IN')}
                                            </td>
                                        </tr>
                                    )}

                                    {/* 5) Additional Charges */}
                                    {addChargesAmt > 0 && !isHidden('additionalCharges') && (
                                        <>
                                            <tr style={{ borderTop: '1px dashed #fed7aa', backgroundColor: '#fff7ed' }}>
                                                <td colSpan={3} style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 700, fontSize: '9pt', color: '#475569' }}>
                                                    Additional Charges:
                                                </td>
                                                <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 800, color: '#0f172a', fontSize: '10pt' }}>
                                                    + ₹ {addChargesAmt.toLocaleString('en-IN')}
                                                </td>
                                            </tr>
                                            {addChargesGstAmt > 0 && (
                                                <tr style={{ backgroundColor: '#fff7ed' }}>
                                                    <td colSpan={3} style={{ padding: '4px 14px 8px', textAlign: 'right', fontWeight: 700, fontSize: '8.5pt', color: '#ea580c' }}>
                                                        Additional Charges GST ({addChargesGstRate}%):
                                                    </td>
                                                    <td style={{ padding: '4px 14px 8px', textAlign: 'right', fontWeight: 800, color: '#ea580c', fontSize: '9.5pt' }}>
                                                        + ₹ {addChargesGstAmt.toLocaleString('en-IN')}
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    )}

                                    {/* 6) Overall GST (Respecting Hide GST Line toggle) */}
                                    {overallGstEnabled && !overallGstHidden && gstAmount > 0 && (
                                        <tr style={{ borderTop: '1px dashed #fed7aa', backgroundColor: '#fff7ed' }}>
                                            <td colSpan={3} style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 700, fontSize: '9pt', color: '#16a34a' }}>
                                                Overall GST ({(isMixedGst ? effectivePrintGstRate : overallGstRate).toFixed(1)}%):
                                            </td>
                                            <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 800, color: '#16a34a', fontSize: '10pt' }}>
                                                + ₹ {gstAmount.toLocaleString('en-IN')}
                                            </td>
                                        </tr>
                                    )}

                                    {/* 7) Round Off Adjustment */}
                                    {(roundOffEnabled || Math.abs(roundOffAdjustment) > 0.001) && !isHidden('roundOff') && (
                                        <tr style={{ borderTop: '1px dashed #fed7aa', backgroundColor: '#fff7ed' }}>
                                            <td colSpan={3} style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 700, fontSize: '9pt', color: '#64748b' }}>
                                                Round Off Adjustment:
                                            </td>
                                            <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 800, color: roundOffAdjustment >= 0 ? '#16a34a' : '#dc2626', fontSize: '10pt' }}>
                                                {roundOffAdjustment >= 0 ? `+ ₹${roundOffAdjustment.toFixed(2)}` : `- ₹${Math.abs(roundOffAdjustment).toFixed(2)}`}
                                            </td>
                                        </tr>
                                    )}

                                    {/* 7) Final Amount (Net Payable Total) */}
                                    <tr style={{ borderTop: '2.5px solid #ea580c', backgroundColor: '#fff1f2' }}>
                                        <td colSpan={3} style={{ padding: '12px 14px', fontWeight: 900, textAlign: 'right', fontSize: '10.5pt', color: '#0f172a' }}>Final Amount (Net Payable Total)</td>
                                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 900, color: '#16a34a', fontSize: '12pt' }}>₹ {finalTotal.toLocaleString('en-IN')}</td>
                                    </tr>
                                </tbody>
                            </table>
                            <div style={{ padding: '14px 18px', backgroundColor: '#fffaf0', borderRadius: '8px', border: '1px solid #fed7aa', marginBottom: '24px' }}>
                                <span style={{ fontSize: '8.5pt', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Total Amount In Words</span>
                                <span style={{ fontSize: '10.5pt', fontWeight: 800, color: '#111827' }}>{numberToWords(finalTotal)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── PAGE 4+: DETAILED BOQ TABLES ── */}
            {showPage(4) && (
                <div id="pdf-page-4" className="page-break-detail-tables" style={{ position: 'relative', pageBreakBefore: 'always', breakBefore: 'page', marginBottom: '0' }}>
                    {sections.map((sec, si) => {
                        const secTotal = sec.items.reduce((a, it) => a + (parseFloat(String(it.amount)) || 0), 0);
                        const secHeadings = (sec as any).custom_headings 
                            || extra.section_headings?.[sec.section_id] 
                            || extra.section_headings?.[String(sec.section_id)] 
                            || extra.section_headings?.[si] 
                            || extra.section_headings?.[String(si)] 
                            || extra.section_headings?.[sec.section_name]
                            || customHeadings || {};
                        let itemCounter = 0;
                        return (
                            <div key={sec.section_id} className={`page-break-section ${si === 0 ? 'page-break-first-module' : ''}`} style={{ minHeight: 'auto', padding: '8px 24px 20px 24px', backgroundColor: '#ffffff', position: 'relative', boxSizing: 'border-box', pageBreakInside: 'auto', breakInside: 'auto', pageBreakAfter: 'auto', breakAfter: 'auto', marginBottom: '0' }}>
                                {/* Section Title */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    backgroundColor: '#fff7ed',
                                    border: '1.5px solid #fed7aa',
                                    borderRadius: '10px',
                                    padding: '10px 16px',
                                    marginBottom: '12px',
                                    pageBreakAfter: 'avoid',
                                    breakAfter: 'avoid',
                                    pageBreakInside: 'avoid',
                                    breakInside: 'avoid'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{
                                            width: '28px',
                                            height: '28px',
                                            minWidth: '28px',
                                            borderRadius: '50%',
                                            backgroundColor: '#ea580c',
                                            color: '#ffffff',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontWeight: 900,
                                            fontSize: '10pt',
                                            boxShadow: '0 2px 4px rgba(234, 88, 12, 0.25)'
                                        }}>
                                            {si + 1}
                                        </div>
                                        <div style={{ fontSize: '11pt', fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                                            Module {si + 1}: {sec.section_name}
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '12pt', fontWeight: 900, color: '#ea580c' }}>
                                        ₹ {secTotal.toLocaleString('en-IN')}
                                    </div>
                                </div>

                                <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: 0, fontSize: '0.85rem', border: '1.5px solid #fed7aa', pageBreakInside: 'auto', breakInside: 'auto' }}>
                                    <thead style={{ display: 'table-header-group', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                                        <tr style={{ backgroundColor: headerBgColor, color: '#ffffff', pageBreakInside: 'avoid', breakInside: 'avoid', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                            <th style={{ padding: '8px 2px', textAlign: 'center', width: '3.5%', fontWeight: 700, fontSize: '0.78rem', color: '#ffffff', border: 'none', backgroundColor: headerBgColor, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact', whiteSpace: 'nowrap', wordBreak: 'normal' }}>#</th>
                                            {!isHidden('particulars') && (
                                                <th style={{ padding: '8px 8px', textAlign: 'left', width: '22%', fontWeight: 700, fontSize: '0.82rem', color: '#ffffff', border: 'none', backgroundColor: headerBgColor, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                                    {secHeadings.particulars || customHeadings.particulars || 'Product Description'}
                                                </th>
                                            )}
                                            {!isHidden('shutterMaterial') && (
                                                <th style={{ padding: '8px 8px', textAlign: 'left', width: '15%', fontWeight: 700, fontSize: '0.82rem', color: '#ffffff', border: 'none', backgroundColor: headerBgColor, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                                    {secHeadings.shutterMaterial || customHeadings.shutterMaterial || 'Shutter Material | Finish'}
                                                </th>
                                            )}
                                            {!isHidden('carcassMaterial') && (
                                                <th style={{ padding: '8px 8px', textAlign: 'left', width: '15%', fontWeight: 700, fontSize: '0.82rem', color: '#ffffff', border: 'none', backgroundColor: headerBgColor, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                                    {secHeadings.carcassMaterial || customHeadings.carcassMaterial || 'Carcass Material | Color'}
                                                </th>
                                            )}
                                            {!isHidden('dimensions') && (
                                                <th style={{ padding: '8px 4px', textAlign: 'center', width: '13%', fontWeight: 700, fontSize: '0.75rem', color: '#ffffff', border: 'none', backgroundColor: headerBgColor, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                                    {secHeadings.dimensions || customHeadings.dimensions || 'Dimensions (W × H × D) (mm)'}
                                                </th>
                                            )}
                                            {!isHidden('rate') && (
                                                <th style={{ padding: '8px 4px', textAlign: 'right', width: '9%', fontWeight: 700, fontSize: '0.75rem', color: '#ffffff', border: 'none', backgroundColor: headerBgColor, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact', whiteSpace: 'nowrap', wordBreak: 'normal' }}>
                                                    {secHeadings.rate || customHeadings.rate || 'Rate / SFT'}
                                                </th>
                                            )}
                                            {!isHidden('qty') && (
                                                <th style={{ padding: '8px 4px', textAlign: 'center', width: '6.5%', fontWeight: 700, fontSize: '0.80rem', color: '#ffffff', border: 'none', backgroundColor: headerBgColor, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact', whiteSpace: 'nowrap', wordBreak: 'normal' }}>
                                                    {secHeadings.qty || customHeadings.qty || 'QTY'}
                                                </th>
                                            )}
                                            {!isHidden('discount') && (
                                                <th style={{ padding: '8px 4px', textAlign: 'center', width: '7.5%', fontWeight: 700, fontSize: '0.80rem', color: '#ffffff', border: 'none', backgroundColor: headerBgColor, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact', whiteSpace: 'nowrap', wordBreak: 'normal' }}>
                                                    {secHeadings.disc || secHeadings.discount || customHeadings.disc || customHeadings.discount || 'Disc %'}
                                                </th>
                                            )}
                                            {!isHidden('gst') && (
                                                <th style={{ padding: '8px 4px', textAlign: 'center', width: '6.5%', fontWeight: 700, fontSize: '0.80rem', color: '#ffffff', border: 'none', backgroundColor: headerBgColor, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact', whiteSpace: 'nowrap', wordBreak: 'normal' }}>
                                                    {secHeadings.gst || customHeadings.gst || 'GST %'}
                                                </th>
                                            )}
                                            {!isHidden('amount') && (
                                                <th style={{ padding: '8px 8px', textAlign: 'right', width: '12%', fontWeight: 700, fontSize: '0.82rem', color: '#ffffff', border: 'none', backgroundColor: headerBgColor, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact', whiteSpace: 'nowrap', wordBreak: 'normal' }}>
                                                    {secHeadings.amount || customHeadings.amount || 'Amount'}
                                                </th>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(() => {
                                            itemCounter = 0;
                                            const totalCols = allColsCount;
                                            return sec.items.map((item, iIdx) => {
                                                if (item.brand === 'HEADER') {
                                                    itemCounter = 0;
                                                    let subTotal = 0;
                                                    for (let k = iIdx + 1; k < sec.items.length; k++) {
                                                        if (sec.items[k].brand === 'HEADER') break;
                                                        subTotal += (parseFloat(String(sec.items[k].amount)) || 0);
                                                    }
                                                    return (
                                                        <tr key={item.item_id || iIdx} style={{ pageBreakInside: 'avoid', breakInside: 'avoid', pageBreakAfter: 'avoid', breakAfter: 'avoid', backgroundColor: '#fff7ed', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                                            <td colSpan={!isHidden('amount') ? Math.max(1, totalCols - 1) : totalCols} style={{ padding: '8px 12px', backgroundColor: '#fff7ed', borderTop: '1.5px solid #fed7aa', borderBottom: '2px solid #ea580c', fontWeight: 900, color: '#ea580c', fontSize: '9pt', textTransform: 'uppercase', letterSpacing: '0.5px', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                                                {item.particulars}
                                                            </td>
                                                            {!isHidden('amount') && (
                                                                <td style={{ padding: '8px 12px', backgroundColor: '#fff7ed', borderTop: '1.5px solid #fed7aa', borderBottom: '2px solid #ea580c', fontWeight: 900, color: '#ea580c', fontSize: '9pt', textAlign: 'right', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact', whiteSpace: 'nowrap' }}>
                                                                    ₹ {subTotal.toLocaleString('en-IN')}
                                                                </td>
                                                            )}
                                                        </tr>
                                                    );
                                                }
                                                itemCounter++;
                                                const isEven = itemCounter % 2 === 0;
                                                const hasDimensions = Boolean((item.width && String(item.width).trim() !== '' && String(item.width).trim() !== '0') || (item.height && String(item.height).trim() !== '' && String(item.height).trim() !== '0'));
                                                const isLumpsumItem = (item as any).pricing_mode === 'lumpsum' || !hasDimensions;
                                                const lumpsumVal = parseFloat(String(item.rate)) || parseFloat(String(item.amount)) || 0;
                                                const shutter = (item as any).shutter_material || (item as any).shutterMaterial || (item.brand && item.brand !== 'HEADER' ? item.brand : '—');
                                                const carcass = (item as any).carcass_material || (item as any).carcassMaterial || (item.unit && !['SFT', 'RFT', 'NOS', 'SQFT', 'MTR', 'RMT'].includes(String(item.unit).toUpperCase().trim()) ? item.unit : '—');
                                                return (
                                                    <tr key={item.item_id} style={{ backgroundColor: isEven ? '#fffdf9' : '#ffffff', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                                                        <td style={{ padding: '8px 2px', textAlign: 'center', fontWeight: 700, color: '#f97316', fontSize: '8pt', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap', pageBreakInside: 'avoid', breakInside: 'avoid' }}>{itemCounter}</td>
                                                        {!isHidden('particulars') && (
                                                            <td style={{ padding: '8px 8px', textAlign: 'left', fontWeight: 700, color: '#0f172a', fontSize: '8.5pt', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', wordBreak: 'break-word', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                                                                {(item as any).category && <div style={{ color: '#ea580c', fontWeight: 800, fontSize: '7.5pt', marginBottom: '2px' }}>[{(item as any).category}]</div>}
                                                                {item.particulars}
                                                                {item.hsn_sac && <div style={{ fontSize: '7.5pt', color: '#64748b', fontWeight: 500, marginTop: '2px' }}>{item.hsn_sac}</div>}
                                                            </td>
                                                        )}
                                                        {!isHidden('shutterMaterial') && (
                                                            <td style={{ padding: '8px 8px', textAlign: 'left', color: '#475569', fontSize: '8pt', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', wordBreak: 'break-word', pageBreakInside: 'avoid', breakInside: 'avoid' }}>{shutter}</td>
                                                        )}
                                                        {!isHidden('carcassMaterial') && (
                                                            <td style={{ padding: '8px 8px', textAlign: 'left', color: '#475569', fontSize: '8pt', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', wordBreak: 'break-word', pageBreakInside: 'avoid', breakInside: 'avoid' }}>{carcass}</td>
                                                        )}
                                                        {!isHidden('dimensions') && (
                                                            <td style={{ padding: '6px 6px', textAlign: 'left', color: '#334155', fontSize: '7.5pt', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                                                                {isLumpsumItem ? (
                                                                    <span style={{ color: '#16a34a', fontWeight: 800 }}>Lumpsum: ₹{lumpsumVal.toLocaleString('en-IN')}</span>
                                                                ) : (
                                                                    <div style={{ lineHeight: 1.3, fontWeight: 600 }}>
                                                                        <div>Width: {item.width || 0}</div>
                                                                        <div>Height: {item.height || 0}</div>
                                                                        <div>Depth: {item.sft || 0}</div>
                                                                        {(() => {
                                                                            const sqftVal = computeSqft(item.width, item.height, item.sft, (item as any).pricing_mode);
                                                                            return sqftVal > 0 ? (
                                                                                <div style={{ color: '#ea580c', fontWeight: 700, fontSize: '7.2pt', marginTop: '2px', wordBreak: 'break-all' }} title={`Exact SFT: ${Number(sqftVal.toFixed(2))}`}>
                                                                                    {Number(sqftVal.toFixed(2))} SFT
                                                                                </div>
                                                                            ) : null;
                                                                        })()}
                                                                    </div>
                                                                )}
                                                            </td>
                                                        )}
                                                        {!isHidden('rate') && (
                                                            <td style={{ padding: '8px 6px', textAlign: 'right', color: '#334155', fontSize: '8pt', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap', pageBreakInside: 'avoid', breakInside: 'avoid' }}>{isLumpsumItem ? '—' : (parseFloat(String(item.rate)) || 0).toLocaleString('en-IN')}</td>
                                                        )}
                                                        {!isHidden('qty') && (
                                                            <td style={{ padding: '8px 4px', textAlign: 'center', color: '#334155', fontSize: '8.5pt', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap', pageBreakInside: 'avoid', breakInside: 'avoid' }}>{isLumpsumItem ? ((item.quantity && Number(item.quantity) > 0) ? item.quantity : '—') : (item.quantity || 1)}</td>
                                                        )}
                                                        {!isHidden('discount') && (
                                                            <td style={{ padding: '8px 4px', textAlign: 'center', color: '#ea580c', fontSize: '8pt', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap', pageBreakInside: 'avoid', breakInside: 'avoid' }}>{(item as any).discount_percent ? (item as any).discount_percent + '%' : '0%'}</td>
                                                        )}
                                                        {!isHidden('gst') && (
                                                            <td style={{ padding: '8px 4px', textAlign: 'center', color: '#64748b', fontSize: '8pt', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap', pageBreakInside: 'avoid', breakInside: 'avoid' }}>{((item as any).gst_rate !== undefined && (item as any).gst_rate !== null && String((item as any).gst_rate).trim() !== '') ? (item as any).gst_rate + '%' : overallGstRate + '%'}</td>
                                                        )}
                                                        {!isHidden('amount') && (
                                                            <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 800, color: '#ea580c', fontSize: '8.5pt', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap', pageBreakInside: 'avoid', breakInside: 'avoid' }}>{(parseFloat(String(item.amount)) || 0).toLocaleString('en-IN')}</td>
                                                        )}
                                                    </tr>
                                                );
                                            });
                                        })()}
                                        <tr style={{ backgroundColor: '#fffaf0', fontWeight: 800, borderTop: '1.5px solid #fed7aa', pageBreakBefore: 'avoid', breakBefore: 'avoid', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                                            <td colSpan={!isHidden('amount') ? moduleTotalColSpan : allColsCount} style={{ padding: '10px 10px', textAlign: 'right', fontSize: '9pt', color: '#111827', borderRight: !isHidden('amount') ? '1px solid #fed7aa' : 'none' }}>Module Total ({sec.section_name}):</td>
                                            {!isHidden('amount') && (
                                                <td style={{ padding: '10px 10px', textAlign: 'right', fontSize: '9.5pt', color: '#ea580c', fontWeight: 900, whiteSpace: 'nowrap' }}>
                                                    ₹ {secTotal.toLocaleString('en-IN')}
                                                </td>
                                            )}
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── PAGE 5: TERMS & CONDITIONS & MATERIAL SPECIFICATIONS ── */}
            {showPage(5) && !hiddenFields.termsAndConditions && (
                <div id="pdf-page-5" className="page-break-terms-conditions" style={{ minHeight: 'auto', padding: '16px 24px 20px 24px', backgroundColor: '#ffffff', position: 'relative', boxSizing: 'border-box', pageBreakBefore: 'always', breakBefore: 'page' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', justifyContent: 'space-between' }}>
                        <div>
                            {/* Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2.5px solid #ea580c', paddingBottom: '14px', marginBottom: '24px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                    <img src={liveLogo} alt="Logo" style={{ height: '50px', objectFit: 'contain' }} />
                                    <div>
                                        <div style={{ fontSize: '15pt', fontWeight: 900, color: '#000000', marginBottom: '2px' }}>Livincart Private Limited</div>
                                        <div style={{ fontSize: '8pt', color: '#64748b', fontWeight: 500 }}>Official Quotation &amp; Estimation Workspace</div>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '9.5pt', fontWeight: 900, color: '#000000', marginBottom: '4px' }}>LIVINCART AND SERVICES PRIVATE LIMITED</div>
                                    <div style={{ fontSize: '7.5pt', color: '#475569', fontWeight: 600, marginTop: '4px' }}>
                                        <span style={{ marginRight: '10px' }}>Visakhapatnam, Andhra Pradesh - 530020</span>
                                        <span>Phone: +91 7702312351</span>
                                    </div>
                                    <div style={{ fontSize: '7.5pt', color: '#475569', fontWeight: 600, marginTop: '2px' }}>
                                        <span style={{ marginRight: '10px' }}>contact@livincart.com</span>
                                        <span>www.livincart.com</span>
                                    </div>
                                </div>
                            </div>

                            {/* Title */}
                            <div style={{ marginBottom: '20px' }}>
                                <h2 style={{ margin: 0, fontSize: '18pt', fontWeight: 900, color: '#0f172a' }}>TERMS, CONDITIONS &amp; MATERIAL SPECIFICATIONS</h2>
                                <div style={{ width: '80px', height: '4px', backgroundColor: '#ea580c', marginTop: '6px' }} />
                            </div>

                            {/* Terms List Box */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                                {(() => {
                                    let numCounter = 0;
                                    return [
                                        "Material Specifications - Plywood, HDHMR as per client choice",
                                        "Finishes Specifications - Hi Gloss Finish, Matt, Suede, Wooden finishes as per client choice",
                                        "Accessories - Ebco, Hettich, or equivalent based upon availability.",
                                        "Payment Milestones:",
                                        "Initial Agreement Payment = 10% of total Quote (Non-Refundable - 3D provided)",
                                        "2nd Payment = 50% of total Quote (After designs finalisation)",
                                        "3rd Payment = 35% of total Quote (After 60% of work completion)",
                                        "Final Payment = 5% of total Quote (After 100% work completion)",
                                        "Timelines - Once all the designs finalisation 45-60 days for handover.",
                                        "Note - If any Addons in scope of work this quote may be Increased during installation phase.",
                                        "Warranty and Responsibility - Vendor shall provide One Year workmanship Warranty covering installation quality and fittings, Accessories.",
                                        "Kitchen sink, A/C, chimney, set top box and other accessories are not under our scope, If required any as per client selection will be charged separately",
                                        "Extra lights and electrical wiring charges are separately charged as per site conditions and client requirement",
                                        "If any excess drawers will be required other than standards, extra cost based on client requirement",
                                        "Water & power should be supplied by client free of cost",
                                        "After execution of the work as per drawing if any modifications cost will be extra as on actuals",
                                        "There is no extra hidden charges in the quotation.",
                                        "The company cannot be held responsible for additional requirement other than specified in the contract",
                                        "Customer should give access to the property till the completion of the work so that workers work night shift if needed",
                                        "The above quotation is prepared completely based on the requirements of client with the proper measurements"
                                    ].map((term, idx) => {
                                        const isSubMilestone = idx >= 4 && idx <= 7;
                                        const isSectionHeader = idx === 3;
                                        if (!isSubMilestone) {
                                            numCounter++;
                                        }
                                        const subBulletLabels = ['a.', 'b.', 'c.', 'd.'];
                                        const bulletLabel = isSubMilestone
                                            ? (subBulletLabels[idx - 4] || '•')
                                            : `${numCounter}.`;

                                        return (
                                            <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', fontSize: '9.2pt', color: '#1e293b', lineHeight: 1.5, paddingLeft: isSubMilestone ? '16px' : '0' }}>
                                                <span style={{ fontWeight: 900, color: '#ea580c', marginRight: '6px', flexShrink: 0 }}>{bulletLabel}</span>
                                                <span style={{ flex: 1, fontWeight: isSectionHeader || term.startsWith('Material') || term.startsWith('Finishes') || term.startsWith('Warranty') || term.startsWith('Note') ? 900 : 500, color: isSectionHeader ? '#ea580c' : '#334155' }}>
                                                    {term}
                                                </span>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        </div>

                        {/* Footer Account Details & Signatures */}
                        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '2px dashed #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontSize: '9.5pt', fontWeight: 900, color: '#0f172a' }}>
                                    Account Name: <span style={{ color: '#ea580c' }}>Livincart and services private limited</span>
                                </div>
                                <div style={{ fontSize: '8pt', color: '#64748b', marginTop: '4px' }}>
                                    Note: Terms &amp; conditions are part of the official quotation agreement.
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '8.5pt', color: '#64748b', fontWeight: 600 }}>Authorized Signature</div>
                                <div style={{ margin: '6px 0', height: '42px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                                    <img src={liveCartSignature} alt="Signature" style={{ height: '42px', objectFit: 'contain' }} />
                                </div>
                                <div style={{ fontSize: '10pt', fontWeight: 900, color: '#0f172a' }}>Livincart &amp; Services Pvt Ltd</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── PRINT-READY SENTINEL - Puppeteer waits for this ── */}
            {ready && (
                <div
                    id="print-ready"
                    style={{ position: 'fixed', bottom: 0, right: 0, width: '1px', height: '1px', opacity: 0, pointerEvents: 'none' }}
                    aria-hidden="true"
                />
            )}
        </div>
    );
};

export const PrintQuoteView: React.FC = () => {
    const { quoteId } = useParams<{ quoteId: string }>();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token') || '';
    const apiBase = searchParams.get('api') || API_BASE_URL;

    useEffect(() => {
        const origBodyBg = document.body.style.backgroundColor;
        const origDocBg = document.documentElement.style.backgroundColor;
        document.body.style.backgroundColor = '#ffffff';
        document.body.style.background = '#ffffff';
        document.documentElement.style.backgroundColor = '#ffffff';
        document.documentElement.style.background = '#ffffff';

        return () => {
            document.body.style.backgroundColor = origBodyBg;
            document.body.style.background = origBodyBg;
            document.documentElement.style.backgroundColor = origDocBg;
            document.documentElement.style.background = origDocBg;
        };
    }, []);

    if (!quoteId) return <div style={{ padding: '40px', color: '#ef4444' }}>Missing quoteId</div>;

    return (
        <div style={{ backgroundColor: '#334155', minHeight: '100vh', width: '100%', margin: 0, padding: '0 0 40px 0' }}>
            <style>{`
                @media screen {
                    html, body, #root {
                        background-color: #334155 !important;
                        background: #334155 !important;
                    }
                }
                @media print {
                    html, body, #root {
                        background-color: #ffffff !important;
                        background: #ffffff !important;
                    }
                }
            `}</style>
            <div className="no-print" style={{
                position: 'sticky',
                top: 0,
                zIndex: 99999,
                backgroundColor: '#0f172a',
                color: '#ffffff',
                padding: '12px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 4px 14px rgba(0,0,0,0.3)'
            }}>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#fca412', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>📄 A4 PDF Document Viewer</span>
                    <span style={{ color: '#94a3b8', fontWeight: 600, fontSize: '0.86rem' }}>• Quote #{quoteId}</span>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                        onClick={() => window.print()}
                        style={{
                            padding: '8px 20px',
                            backgroundColor: '#ea580c',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '6px',
                            fontWeight: 800,
                            fontSize: '0.88rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            boxShadow: '0 2px 6px rgba(234, 88, 12, 0.4)'
                        }}
                    >
                         Print / Save PDF
                    </button>
                    <button
                        onClick={() => window.close()}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: 'transparent',
                            color: '#cbd5e1',
                            border: '1px solid #475569',
                            borderRadius: '6px',
                            fontWeight: 700,
                            fontSize: '0.84rem',
                            cursor: 'pointer'
                        }}
                    >
                        Close Preview
                    </button>
                </div>
            </div>
            <div className="pdf-a4-screen-page">
                <QuotePdfDocument quoteId={quoteId} token={token} apiBase={apiBase} />
            </div>
        </div>
    );
};

export default PrintQuoteView;
