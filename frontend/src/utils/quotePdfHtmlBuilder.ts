// src/utils/quotePdfHtmlBuilder.ts
// Official 4-Page Vector HTML Generator for Dompdf and Client-side PDF Generation

import { LOGO_BASE64 } from '../assets/logoBase64';
import { OWNER_SIGNATURE_BASE64 } from '../assets/ownerSignatureBase64';

export function numberToWordsIndian(num: number): string {
    const roundNum = Math.round(Number(num) || 0);
    if (roundNum <= 0) return 'Zero Rupees Only';
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    let n = roundNum;
    const crore = Math.floor(n / 10000000);
    n -= crore * 10000000;
    const lakh = Math.floor(n / 100000);
    n -= lakh * 100000;
    const thousand = Math.floor(n / 1000);
    n -= thousand * 1000;
    const hundred = Math.floor(n / 100);
    n -= hundred * 100;

    let res = '';
    if (crore > 0) res += (crore < 20 ? ones[crore] : tens[Math.floor(crore / 10)] + ' ' + ones[crore % 10]) + ' Crore ';
    if (lakh > 0) res += (lakh < 20 ? ones[lakh] : tens[Math.floor(lakh / 10)] + ' ' + ones[lakh % 10]) + ' Lakh ';
    if (thousand > 0) res += (thousand < 20 ? ones[thousand] : tens[Math.floor(thousand / 10)] + ' ' + ones[thousand % 10]) + ' Thousand ';
    if (hundred > 0) res += ones[hundred] + ' Hundred ';
    if (n > 0) {
        if (res !== '') res += 'and ';
        res += (n < 20 ? ones[n] : tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : ''));
    }
    return (res.trim() + ' Rupees Only');
}

export function computeSqft(widthStr?: any, heightStr?: any, depthStr?: any, mode?: string): number {
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
}

export function buildOfficial4PageHtml(quoteData: any, hiddenFields: any = {}): string {
    const clientName = quoteData?.client_name || quoteData?.subtitle || 'Valued Client';
    const quoteNumber = quoteData?.quote_number || `DRAFT-${quoteData?.quote_id || quoteData?.id || '101'}`;
    const projectId = quoteData?.project_id || quoteData?.project_code || '1';
    const versionNum = quoteData?.version || 0;
    const isFinalVersion = quoteData?.status === 'FINAL' || quoteData?.status === 'qc_approved' || Boolean(quoteData?.is_final_version);
    const createdAt = quoteData?.created_at
        ? new Date(quoteData.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const clientSignature = quoteData?.client_signature || quoteData?.clientSignature || '';

    let extra: any = {};
    if (quoteData?.extra_data_parsed && typeof quoteData.extra_data_parsed === 'object') {
        extra = quoteData.extra_data_parsed;
    } else if (quoteData?.extra_data) {
        try {
            extra = typeof quoteData.extra_data === 'string' ? JSON.parse(quoteData.extra_data) : quoteData.extra_data;
        } catch (e) {
            extra = {};
        }
    }

    const mergedHidden: Record<string, boolean> = {
        ...hiddenFields,
        ...(extra.hidden_fields || {}),
        ...(quoteData?.hidden_fields || {})
    };

    const isHidden = (key: string): boolean => {
        return Boolean(
            mergedHidden[key] ||
            mergedHidden[key.toLowerCase()] ||
            (key === 'particulars' && (mergedHidden.particulars || mergedHidden['productDescription'] || mergedHidden['product_description'])) ||
            (key === 'qty' && (mergedHidden.qty || mergedHidden['quantity'])) ||
            ((key === 'discount' || key === 'disc') && (mergedHidden.discount || mergedHidden.disc)) ||
            (key === 'amount' && (mergedHidden.amount || mergedHidden['item_amount'])) ||
            (key === 'shutterMaterial' && (mergedHidden.shutter || mergedHidden['shutterMaterial'])) ||
            (key === 'carcassMaterial' && (mergedHidden.carcass || mergedHidden['carcassMaterial'])) ||
            (key === 'categoryDiscount' && (mergedHidden.categoryDiscount || mergedHidden['category_discount'])) ||
            (key === 'promoCode' && (mergedHidden.promoCode || mergedHidden.coupon || mergedHidden['promo_code'])) ||
            ((key === 'flatDiscount' || key === 'generalDiscount') && (mergedHidden.flatDiscount || mergedHidden.generalDiscount || mergedHidden['flat_discount'] || mergedHidden['general_discount'])) ||
            (key === 'additionalCharges' && (mergedHidden.additionalCharges || mergedHidden['additional_charges'])) ||
            (key === 'gst' && (mergedHidden.gst || extra.overall_gst_line_hidden)) ||
            (key === 'roundOff' && (mergedHidden.roundOff || mergedHidden['round_off']))
        );
    };

    // Extract Sections
    let sections: any[] = [];
    if (Array.isArray(quoteData?.sections) && quoteData.sections.length > 0) {
        sections = quoteData.sections;
    }

    // Calculations matching QuoteTab
    let baseGrossSum = 0;
    let itemDiscSum = 0;
    let secItemAmtSum = 0;

    sections.forEach((sec: any) => {
        (sec.items || []).forEach((it: any) => {
            if (it.brand === 'HEADER') return;
            const qty = parseFloat(it.quantity) || 1;
            const rate = parseFloat(it.rate || it.rate_per_sft) || 0;
            const base = qty * rate;
            baseGrossSum += base;
            const discPercent = parseFloat(it.discount_percent) || 0;
            if (discPercent > 0 && base > 0) {
                itemDiscSum += base * (discPercent / 100);
            }
            secItemAmtSum += parseFloat(it.amount || base);
        });
    });

    let grandTotal = 0;
    if (baseGrossSum > 0) {
        grandTotal = baseGrossSum;
    } else if (secItemAmtSum > 0) {
        grandTotal = secItemAmtSum;
    } else {
        grandTotal = parseFloat(quoteData?.total_amount || 0);
    }

    // 2. Category-Wise Discounts Breakdown & Total
    const catDiscounts = extra.category_discounts || quoteData?.category_discounts;
    const categoryDiscountsList: Array<{ name: string; value: number; type: string; amount: number }> = [];
    let catDiscountAmt = 0;

    if (catDiscounts && typeof catDiscounts === 'object') {
        Object.entries(catDiscounts).forEach(([cKey, disc]: [string, any]) => {
            if (!disc) return;
            const cName = disc.category ? String(disc.category).trim() : cKey.trim();
            const val = parseFloat(disc.value || disc.amount || 0);
            const type = disc.type || 'percent';
            if (val <= 0) return;

            let catTotal = 0;
            const tCat = cName.toLowerCase();
            sections.forEach((sec: any) => {
                (sec.items || []).forEach((it: any) => {
                    if (it.brand === 'HEADER') return;
                    const iCat = (it.category || '').toLowerCase().trim();
                    const sName = (sec.section_name || sec.name || '').toLowerCase().trim();
                    if ((iCat && (iCat.includes(tCat) || tCat.includes(iCat))) || (sName && (sName.includes(tCat) || tCat.includes(sName)))) {
                        const iQty = parseFloat(it.quantity) || 1;
                        const iRate = parseFloat(it.rate || it.rate_per_sft) || 0;
                        catTotal += (iQty * iRate) > 0 ? (iQty * iRate) : parseFloat(it.amount || 0);
                    }
                });
            });

            let discAmt = 0;
            if (type === 'percent') {
                discAmt = Math.round(catTotal * (val / 100) * 100) / 100;
            } else {
                discAmt = Math.round(Math.min(val, catTotal > 0 ? catTotal : val) * 100) / 100;
            }

            if (discAmt > 0) {
                categoryDiscountsList.push({
                    name: cName,
                    value: val,
                    type,
                    amount: discAmt
                });
                catDiscountAmt += discAmt;
            }
        });
    }

    // Fallback: If no explicit category_discounts breakdown matched, but items had discount_percent
    if (catDiscountAmt === 0 && itemDiscSum > 0) {
        catDiscountAmt = Math.round(itemDiscSum * 100) / 100;
    }
    // Or if global_discount had percent
    const globalDisc = extra.global_discount || quoteData?.global_discount;
    if (catDiscountAmt === 0 && globalDisc?.value && globalDisc.type === 'percent') {
        catDiscountAmt = Math.round(grandTotal * (parseFloat(globalDisc.value) / 100));
    }

    // 3. Flat Amount discount (₹ entered flat amount)
    const generalDisc = extra.general_discount || quoteData?.general_discount;
    // 3. Flat Amount discount (₹ entered flat amount)
    let flatDiscountAmt = 0;
    const rawFlat = extra.flat_discount ?? extra.flatDiscount ?? quoteData?.flat_discount ?? quoteData?.flatDiscount ?? extra.general_discount ?? extra.generalDiscount ?? quoteData?.general_discount ?? quoteData?.generalDiscount ?? null;
    if (rawFlat && typeof rawFlat === 'object') {
        flatDiscountAmt = parseFloat(rawFlat.amount ?? rawFlat.value ?? 0) || 0;
    } else if (rawFlat !== null && !isNaN(parseFloat(rawFlat))) {
        flatDiscountAmt = parseFloat(rawFlat) || 0;
    } else if (globalDisc?.value && globalDisc.type === 'flat') {
        flatDiscountAmt = parseFloat(globalDisc.value) || 0;
    }
    flatDiscountAmt = Math.round(flatDiscountAmt);

    // If itemDiscSum matches flatDiscountAmt and no category_discounts existed, it was auto-distributed; don't double count
    if (flatDiscountAmt > 0 && catDiscountAmt === flatDiscountAmt && categoryDiscountsList.length === 0) {
        catDiscountAmt = 0;
    }

    // 4. Promo coupon discount
    let coupon = extra.applied_coupon || quoteData?.applied_coupon || extra.appliedCoupon || quoteData?.appliedCoupon || extra.coupon || quoteData?.coupon || extra.promo_code || quoteData?.promo_code;
    if (typeof coupon === 'string' && coupon.startsWith('{')) {
        try { coupon = JSON.parse(coupon); } catch (e) {}
    }
    let couponDiscountAmt = 0;
    let couponCode = '';
    let couponDesc = '';
    if (coupon && typeof coupon === 'object') {
        const cVal = parseFloat(coupon.discountValue || coupon.discount_value || coupon.value || coupon.amount || 0);
        const cType = coupon.discountType || coupon.discount_type || coupon.type || 'percent';
        couponCode = (coupon.code || coupon.coupon_code || 'PROMO').trim();
        if (cVal > 0) {
            const netAfterDiscounts = Math.max(0, grandTotal - catDiscountAmt - flatDiscountAmt);
            if (cType === 'percent') {
                couponDiscountAmt = Math.round(netAfterDiscounts * (cVal / 100));
                couponDesc = `${cVal}% OFF`;
            } else {
                couponDiscountAmt = Math.min(netAfterDiscounts, Math.round(cVal));
                couponDesc = `Rs. ${cVal.toLocaleString('en-IN')} OFF`;
            }
        }
    }

    // 5. Additional Charges
    let addCharges = extra.additional_charges || extra.additionalCharges || quoteData?.additional_charges || quoteData?.additionalCharges;
    if (typeof addCharges === 'string' && addCharges.startsWith('{')) {
        try { addCharges = JSON.parse(addCharges); } catch (e) {}
    }
    let addChargesAmt = 0;
    let hasGstOnCharges = false;
    let chargesGstRate = 18;
    if (addCharges && typeof addCharges === 'object') {
        if (typeof addCharges.amount === 'object') {
            addChargesAmt = parseFloat(addCharges.amount?.amount || addCharges.amount?.value || 0) || 0;
        } else {
            addChargesAmt = parseFloat(addCharges.amount ?? addCharges.value ?? 0) || 0;
        }
        hasGstOnCharges = Boolean(addCharges.withGst || addCharges.hasGst || addCharges.with_gst);
        chargesGstRate = addCharges.gstRate !== undefined ? parseFloat(addCharges.gstRate) : (addCharges.gst_rate !== undefined ? parseFloat(addCharges.gst_rate) : 18);
    } else if (addCharges !== null && !isNaN(parseFloat(addCharges))) {
        addChargesAmt = parseFloat(addCharges) || 0;
    }

    // 6. Overall GST (Respecting admin toggle 'overall_gst_line_hidden')
    const overallGstEnabled = (extra.overall_gst_enabled ?? quoteData?.overall_gst_enabled ?? true) !== false;
    const overallGstLineHidden = Boolean(extra.overall_gst_line_hidden || quoteData?.overall_gst_line_hidden || isHidden('gst'));
    const gstRate = parseFloat(extra.overall_gst_rate ?? quoteData?.overall_gst_rate ?? 18);

    const taxableSubtotal = Math.max(0, grandTotal - catDiscountAmt - flatDiscountAmt - couponDiscountAmt);
    let gstAmount = 0;
    if (overallGstEnabled && gstRate > 0) {
        gstAmount = Math.round(taxableSubtotal * (gstRate / 100));
        if (hasGstOnCharges && addChargesAmt > 0) {
            gstAmount += Math.round(addChargesAmt * (chargesGstRate / 100));
        }
    }

    // 7. Net Total & Round off
    const unrounded = taxableSubtotal + addChargesAmt + (overallGstEnabled ? gstAmount : 0);
    const roundOffEnabled = (extra.round_off_enabled ?? quoteData?.round_off_enabled ?? true) !== false && !isHidden('roundOff');
    const finalTotal = roundOffEnabled ? Math.round(unrounded) : Math.round(unrounded * 100) / 100;
    const roundOffAdj = roundOffEnabled ? (finalTotal - unrounded) : 0;

    // 8. Terms, Conditions & Material Specifications
    let termsList: string[] = extra.terms_list || extra.terms || quoteData?.terms_list || quoteData?.terms || [];
    if (typeof termsList === 'string' && (termsList as string).startsWith('[')) {
        try { termsList = JSON.parse(termsList); } catch (e) {}
    }
    if (!Array.isArray(termsList) || termsList.length === 0) {
        termsList = [
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
        ];
    }

    // Render Page 3 Summary Rows
    let summaryRowsHtml = '';
    let grandTotalSft = 0;
    if (sections.length > 0) {
        sections.forEach((sec: any, sIdx: number) => {
            const secName = sec.section_name || sec.name || `Module ${sIdx + 1}`;
            let itemCount = 0;
            let secGross = 0;
            let secNet = 0;
            let secSft = 0;
            (sec.items || []).forEach((it: any) => {
                if (it.brand === 'HEADER') return;
                itemCount++;
                const itQty = (it.quantity === undefined || it.quantity === null || parseFloat(it.quantity) <= 0) ? 1 : parseFloat(it.quantity);
                const itRate = parseFloat(it.rate || it.rate_per_sft) || 0;
                const itBase = itQty * itRate;
                const itAmt = parseFloat(it.amount !== undefined && it.amount !== null ? it.amount : itBase);
                secGross += (itBase > 0 ? itBase : itAmt);
                secNet += itAmt;
                const sft = computeSqft(it.width, it.height, it.depth || it.sft, it.pricing_mode);
                secSft += (sft * itQty);
            });
            const displayAmt = secNet > 0 ? secNet : secGross;
            grandTotalSft += secSft;
            summaryRowsHtml += `
                <tr style="background-color: ${sIdx % 2 === 1 ? '#fffdfa' : '#ffffff'}; border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 10px 14px; font-weight: bold; color: #ea580c; text-align: center; width: 45px;">${sIdx + 1}</td>
                    <td style="padding: 10px 14px; font-weight: bold; color: #0f172a;">${secName}</td>
                    <td style="padding: 10px 14px; text-align: center; color: #475569; width: 100px;">
                        <div>${itemCount}</div>
                        ${secSft > 0 ? `<div style="color: #ea580c; font-size: 7.5pt; font-weight: 700; word-break: break-all;">${Number(secSft.toFixed(2))} SFT</div>` : ''}
                    </td>
                    <td style="padding: 10px 14px; text-align: right; font-weight: bold; color: #ea580c; width: 150px;">
                        <div>Rs. ${displayAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        ${secGross > secNet && Math.abs(secGross - secNet) > 0.01 ? `<div style="font-size: 7pt; color: #64748b; font-weight: bold;">(Gross: Rs. ${secGross.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</div>` : ''}
                    </td>
                </tr>
            `;
        });
    } else {
        summaryRowsHtml = `
            <tr>
                <td colspan="4" style="padding: 20px; text-align: center; color: #64748b;">Interior Design Proposal Scope — Rs. ${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
        `;
    }

    // Render Page 4+ Detailed BOQ Tables with full columns matching screen
    let innerModulesHtml = '';
    const customHeadings: Record<string, string> = {
        ...(quoteData?.custom_headings || {}),
        ...(extra.custom_headings || {})
    };
    const headerBgColor = extra.custom_headings?.headerBgColor || quoteData?.custom_headings?.headerBgColor || extra.header_bg_color || '#f97316';

    if (sections.length > 0) {
        sections.forEach((sec: any, sIdx: number) => {
            const secName = sec.section_name || sec.name || `Module ${sIdx + 1}`;
            let secTotal = 0;
            let itemsHtml = '';
            let itemIndex = 1;
            const items = sec.items || [];

            const secId = sec.section_id || sec.id;
            let secCustomHeadings: Record<string, string> = {};
            if (sec.custom_headings) {
                if (typeof sec.custom_headings === 'object') {
                    secCustomHeadings = sec.custom_headings;
                } else if (typeof sec.custom_headings === 'string') {
                    try { secCustomHeadings = JSON.parse(sec.custom_headings); } catch (e) {}
                }
            }
            const secHeadings: Record<string, string> = {
                ...customHeadings,
                ...secCustomHeadings,
                ...((secId && extra.section_headings?.[secId]) ? extra.section_headings[secId] : {}),
                ...((secId && extra.section_headings?.[String(secId)]) ? extra.section_headings[String(secId)] : {}),
                ...((extra.section_headings?.[sIdx]) ? extra.section_headings[sIdx] : {}),
                ...((extra.section_headings?.[String(sIdx)]) ? extra.section_headings[String(sIdx)] : {}),
                ...((secName && extra.section_headings?.[secName]) ? extra.section_headings[secName] : {}),
                ...((secId && quoteData?.section_headings?.[secId]) ? quoteData.section_headings[secId] : {}),
                ...((secId && quoteData?.section_headings?.[String(secId)]) ? quoteData.section_headings[String(secId)] : {}),
                ...((quoteData?.section_headings?.[sIdx]) ? quoteData.section_headings[sIdx] : {}),
                ...((quoteData?.section_headings?.[String(sIdx)]) ? quoteData.section_headings[String(sIdx)] : {}),
                ...((secName && quoteData?.section_headings?.[secName]) ? quoteData.section_headings[secName] : {})
            };

            const particularsHeading = secHeadings.particulars || 'Product Description';
            const shutterHeading = secHeadings.shutterMaterial ? secHeadings.shutterMaterial.replace(/\s*\|\s*/g, ' |<br/>') : 'Shutter Material |<br/>Finish';
            const carcassHeading = secHeadings.carcassMaterial ? secHeadings.carcassMaterial.replace(/\s*\|\s*/g, ' |<br/>') : 'Carcass Material |<br/>Color';
            const dimensionsHeading = secHeadings.dimensions ? secHeadings.dimensions.replace(/\(W\s*[×x]\s*H\s*[×x]\s*D\)/i, '(W &times;<br/>H &times; D)') : 'Dimensions (W &times;<br/>H &times; D)';
            const rateHeading = secHeadings.rate || 'Rate / SFT';
            const qtyHeading = secHeadings.qty || 'QTY';
            const discHeading = (secHeadings.disc || secHeadings.discount) ? (secHeadings.disc || secHeadings.discount).replace('%', '<br/>%').replace('<br/><br/>', '<br/>') : 'Disc<br/>%';
            const gstHeading = secHeadings.gst ? secHeadings.gst.replace('%', '<br/>%').replace('<br/><br/>', '<br/>') : 'GST<br/>%';
            const amountHeading = secHeadings.amount || 'Amount';

            items.forEach((it: any, iIdx: number) => {
                if (it.brand === 'HEADER') {
                    itemIndex = 1;
                    let subTotal = 0;
                    for (let k = iIdx + 1; k < items.length; k++) {
                        if (items[k].brand === 'HEADER') break;
                        const subQty = parseFloat(items[k].quantity) || 1;
                        const subRate = parseFloat(items[k].rate_per_sft || items[k].rate) || 0;
                        subTotal += (parseFloat(items[k].amount) || (subQty * subRate));
                    }
                    let colSpanLeft = 1;
                    if (!isHidden('particulars')) colSpanLeft++;
                    if (!isHidden('shutterMaterial')) colSpanLeft++;
                    if (!isHidden('carcassMaterial')) colSpanLeft++;
                    if (!isHidden('dimensions')) colSpanLeft++;
                    if (!isHidden('rate')) colSpanLeft++;
                    if (!isHidden('qty')) colSpanLeft++;
                    if (!isHidden('discount')) colSpanLeft++;
                    if (!isHidden('gst')) colSpanLeft++;

                    itemsHtml += `
                        <tr style="background-color: #fff7ed; border-top: 1.5px solid #fed7aa; border-bottom: 2px solid #ea580c; page-break-inside: avoid; break-inside: avoid;">
                            <td colspan="${colSpanLeft}" style="padding: 8px 12px; font-weight: 900; font-size: 9pt; color: #ea580c; text-transform: uppercase;">
                                ${it.particulars || 'Section'}
                            </td>
                            ${!isHidden('amount') ? `
                            <td style="padding: 8px 12px; text-align: right; font-weight: 900; font-size: 9pt; color: #ea580c;">
                                Rs. ${subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>` : ''}
                        </tr>
                    `;
                    return;
                }

                const pName = it.particulars || it.item_name || 'Custom Modular Work';
                const catBadge = it.category ? `<div style="color: #ea580c; font-weight: 800; font-size: 7.5pt; margin-bottom: 2px;">[${it.category}]</div>` : '';
                const desc = it.hsn_sac || it.description || it.notes || it.specs || '';
                const descHtml = desc ? `<div style="font-size: 7.5pt; color: #64748b; font-weight: 500; margin-top: 2px; word-break: break-word;">${String(desc).replace(/\n/g, '<br/>')}</div>` : '';
                const imgHtml = it.image_url ? `<img src="${it.image_url}" style="width: 32px; height: 32px; object-fit: cover; border-radius: 3px; border: 1px solid #e2e8f0; float: left; margin-right: 6px; margin-bottom: 2px;" />` : '';

                // Shutter Material | Finish from shutter_material or brand
                const shutter = it.shutter_material || it.shutterMaterial || (it.brand && it.brand !== 'HEADER' ? it.brand : '—');

                // Carcass Material | Color from carcass_material or unit
                const uUnit = String(it.unit || '').toUpperCase().trim();
                const carcass = it.carcass_material || it.carcassMaterial || (!['SFT', 'RFT', 'NOS', 'SQFT', 'MTR', 'RMT', 'LS', 'SET', 'NO'].includes(uUnit) ? it.unit : '') || '—';

                // Dimensions (Width, Height, Depth stacked vertically one after the other)
                const isLumpsum = it.pricing_mode === 'lumpsum';
                const lumpsumVal = parseFloat(it.rate || it.amount || 0);
                const hasDimensions = Boolean((it.width && String(it.width).trim() !== '' && String(it.width).trim() !== '0') || (it.height && String(it.height).trim() !== '' && String(it.height).trim() !== '0'));
                const hasOnlySft = !hasDimensions && Boolean(it.sft && String(it.sft).trim() !== '' && String(it.sft).trim() !== '0');
                let dimHtml = '';
                if (hasOnlySft) {
                    dimHtml = `<div style="font-size: 7.5pt; font-weight: 600; color: #334155; word-break: break-all;">${it.sft} SFT</div>`;
                } else if (hasDimensions) {
                    const w = it.width ?? 0;
                    const h = it.height ?? 0;
                    const d = it.depth ?? it.sft ?? 0;
                    dimHtml = `
                        <div style="line-height: 1.35; font-size: 7.5pt; color: #334155; font-weight: 600; text-align: left; word-break: break-all;">
                            <div>Width: ${w}</div>
                            <div>Height: ${h}</div>
                            <div>Depth: ${d}</div>
                        </div>
                    `;
                } else if (isLumpsum) {
                    dimHtml = `<span style="color: #16a34a; font-weight: bold; font-size: 7.5pt; word-break: break-all;">Lumpsum: ₹ ${lumpsumVal.toLocaleString('en-IN')}</span>`;
                } else {
                    dimHtml = '—';
                }

                // Rate / SFT
                const rateVal = parseFloat(it.rate_per_sft || it.rate || 0);
                const rateText = isLumpsum ? '—' : (rateVal > 0 ? rateVal.toLocaleString('en-IN') : '—');

                // Helper to format numeric values cleanly: whole number without decimals, or decimal with up to 2 decimal places if fractional
                const formatDynamicNumber = (num: number): string => {
                    return (Math.round(num * 100) / 100).toString();
                };

                // QTY
                const rawQty = parseFloat(it.quantity);
                const qtyVal = isNaN(rawQty) ? 1 : rawQty;
                const qtyText = (qtyVal > 0) ? formatDynamicNumber(qtyVal) : (isLumpsum ? '—' : '1');

                // Disc %
                const discVal = parseFloat(it.discount_percent || 0);
                const discText = discVal > 0 ? `${formatDynamicNumber(discVal)}%` : '0%';

                // GST %
                const gstVal = (it.gst_rate !== undefined && it.gst_rate !== null && it.gst_rate !== '') ? parseFloat(it.gst_rate) : (parseFloat(extra?.overall_gst_rate) || 0);
                const gstText = `${formatDynamicNumber(gstVal)}%`;

                // Amount
                const amt = parseFloat(it.amount) || (qtyVal * rateVal);
                secTotal += amt;
                const amtText = amt.toLocaleString('en-IN');

                const rowBg = itemIndex % 2 === 0 ? '#fffdfa' : '#ffffff';

                itemsHtml += `
                    <tr style="background-color: ${rowBg}; page-break-inside: avoid; break-inside: avoid;">
                        <td style="padding: 9px 4px; text-align: center; vertical-align: middle; width: 3%; font-weight: 800; color: #f97316; font-size: 8.5pt; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; white-space: nowrap;">${itemIndex++}</td>
                        ${!isHidden('particulars') ? `
                        <td style="padding: 9px 8px; vertical-align: middle; text-align: left; width: 22%; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; word-break: break-word;">
                            ${imgHtml}
                            ${catBadge}
                            <div style="font-weight: 800; color: #0f172a; font-size: 8pt; line-height: 1.25; text-transform: uppercase;">${pName}</div>
                            ${descHtml}
                        </td>` : ''}
                        ${!isHidden('shutterMaterial') ? `<td style="padding: 9px 8px; vertical-align: middle; text-align: left; font-size: 8pt; color: #475569; font-weight: 500; width: 14%; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; word-break: break-word; line-height: 1.3;">${shutter}</td>` : ''}
                        ${!isHidden('carcassMaterial') ? `<td style="padding: 9px 8px; vertical-align: middle; text-align: left; font-size: 8pt; color: #475569; font-weight: 500; width: 14%; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; word-break: break-word; line-height: 1.3;">${carcass}</td>` : ''}
                        ${!isHidden('dimensions') ? `<td style="padding: 8px 6px; vertical-align: middle; text-align: left; width: 13%; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0;">${dimHtml}</td>` : ''}
                        ${!isHidden('rate') ? `<td style="padding: 9px 6px; vertical-align: middle; text-align: right; font-size: 8pt; color: #334155; font-weight: 600; width: 9%; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; white-space: nowrap;">${rateText}</td>` : ''}
                        ${!isHidden('qty') ? `<td style="padding: 9px 4px; vertical-align: middle; text-align: center; font-size: 8pt; color: #334155; font-weight: 600; width: 5%; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; white-space: nowrap;">${qtyText}</td>` : ''}
                        ${!isHidden('discount') ? `<td style="padding: 9px 4px; vertical-align: middle; text-align: center; font-size: 8pt; color: #ea580c; font-weight: 700; width: 5.5%; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; white-space: nowrap;">${discText}</td>` : ''}
                        ${!isHidden('gst') ? `<td style="padding: 9px 4px; vertical-align: middle; text-align: center; font-size: 8pt; color: #64748b; font-weight: 500; width: 5%; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; white-space: nowrap;">${gstText}</td>` : ''}
                        ${!isHidden('amount') ? `<td style="padding: 9px 8px; vertical-align: middle; text-align: right; font-weight: 800; font-size: 8.5pt; color: #ea580c; width: 9.5%; border-bottom: 1px solid #e2e8f0; white-space: nowrap;">${amtText}</td>` : ''}
                    </tr>
                `;
            });

            let colSpanLeft = 1;
            if (!isHidden('particulars')) colSpanLeft++;
            if (!isHidden('shutterMaterial')) colSpanLeft++;
            if (!isHidden('carcassMaterial')) colSpanLeft++;
            if (!isHidden('dimensions')) colSpanLeft++;
            if (!isHidden('rate')) colSpanLeft++;
            if (!isHidden('qty')) colSpanLeft++;
            if (!isHidden('discount')) colSpanLeft++;
            if (!isHidden('gst')) colSpanLeft++;

            innerModulesHtml += `
                <div style="margin-bottom: 24px; page-break-inside: auto; break-inside: auto;">
                    <table style="width: 100%; border-collapse: collapse; background-color: #fff7ed; border: 1.5px solid #fed7aa; border-radius: 8px; margin-bottom: 8px;">
                        <tr>
                            <td style="padding: 9px 14px; font-size: 10.5pt; font-weight: 900; color: #0f172a; text-transform: uppercase;">
                                Module ${sIdx + 1}: ${secName}
                            </td>
                            ${!isHidden('amount') ? `
                            <td style="padding: 9px 14px; text-align: right; font-size: 11pt; font-weight: 900; color: #ea580c;">
                                ₹ ${secTotal.toLocaleString('en-IN')}
                            </td>` : ''}
                        </tr>
                    </table>
                    <table style="width: 100%; border-collapse: collapse; table-layout: fixed; border: 1.5px solid #fed7aa; margin-bottom: 16px; background-color: #ffffff;">
                        <thead>
                            <tr style="background-color: ${headerBgColor}; color: #ffffff;">
                                <th style="padding: 9px 2px; text-align: center; vertical-align: middle; width: 3%; font-size: 8pt; font-weight: 700; color: #ffffff; white-space: nowrap;">#</th>
                                ${!isHidden('particulars') ? `<th style="padding: 9px 8px; text-align: left; vertical-align: middle; width: 22%; font-size: 8pt; font-weight: 700; color: #ffffff; word-break: break-word;">${particularsHeading}</th>` : ''}
                                ${!isHidden('shutterMaterial') ? `<th style="padding: 9px 6px; text-align: left; vertical-align: middle; font-size: 8pt; font-weight: 700; color: #ffffff; width: 14%; word-break: break-word; line-height: 1.25;">${shutterHeading}</th>` : ''}
                                ${!isHidden('carcassMaterial') ? `<th style="padding: 9px 6px; text-align: left; vertical-align: middle; font-size: 8pt; font-weight: 700; color: #ffffff; width: 14%; word-break: break-word; line-height: 1.25;">${carcassHeading}</th>` : ''}
                                ${!isHidden('dimensions') ? `<th style="padding: 9px 6px; text-align: center; vertical-align: middle; font-size: 8pt; font-weight: 700; color: #ffffff; width: 13%; line-height: 1.25;">${dimensionsHeading}</th>` : ''}
                                ${!isHidden('rate') ? `<th style="padding: 9px 6px; text-align: right; vertical-align: middle; font-size: 8pt; font-weight: 700; color: #ffffff; width: 9%; white-space: nowrap;">${rateHeading}</th>` : ''}
                                ${!isHidden('qty') ? `<th style="padding: 9px 4px; text-align: center; vertical-align: middle; width: 5%; font-size: 8pt; font-weight: 700; color: #ffffff; white-space: nowrap;">${qtyHeading}</th>` : ''}
                                ${!isHidden('discount') ? `<th style="padding: 9px 4px; text-align: center; vertical-align: middle; width: 5.5%; font-size: 8pt; font-weight: 700; color: #ffffff; line-height: 1.25;">${discHeading}</th>` : ''}
                                ${!isHidden('gst') ? `<th style="padding: 9px 4px; text-align: center; vertical-align: middle; width: 5%; font-size: 8pt; font-weight: 700; color: #ffffff; line-height: 1.25;">${gstHeading}</th>` : ''}
                                ${!isHidden('amount') ? `<th style="padding: 9px 8px; text-align: right; vertical-align: middle; width: 9.5%; font-size: 8pt; font-weight: 700; color: #ffffff; white-space: nowrap;">${amountHeading}</th>` : ''}
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsHtml}
                            <tr style="background-color: #fffdf5; border-top: 1.5px solid #fed7aa; page-break-inside: avoid; break-inside: avoid;">
                                <td colspan="${colSpanLeft}" style="padding: 9px 12px; text-align: right; vertical-align: middle; font-weight: 900; font-size: 8.5pt; color: #0f172a; border-right: 1px solid #fed7aa;">
                                    Module Total (${secName}):
                                </td>
                                ${!isHidden('amount') ? `
                                <td style="padding: 9px 8px; text-align: right; vertical-align: middle; font-weight: 900; font-size: 9.5pt; color: #ea580c; white-space: nowrap;">
                                    ₹ ${secTotal.toLocaleString('en-IN')}
                                </td>` : ''}
                            </tr>
                        </tbody>
                    </table>
                </div>
            `;
        });
    }

    const financialBreakdownHtml = '';

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
    @page { margin: 0px; size: A4 portrait; }
    * { box-sizing: border-box; }
    body {
        font-family: "DejaVu Sans", Arial, sans-serif;
        font-size: 9pt;
        color: #0f172a;
        background-color: #ffffff;
        margin: 0;
        padding: 0;
    }
    .page-wrap {
        padding: 30px 12px 24px 12px;
        page-break-after: always;
        clear: both;
        box-sizing: border-box;
    }
    .page-wrap-last {
        padding: 30px 12px 24px 12px;
        clear: both;
        box-sizing: border-box;
    }
    table { width: 100%; border-collapse: collapse; }
    .header-border {
        border-bottom: 2.5px solid #ea580c;
        padding-bottom: 12px;
        margin-bottom: 22px;
    }
    .brand-name {
        font-size: 14pt;
        font-weight: 900;
        color: #000000;
        line-height: 1.15;
    }
    .brand-sub {
        font-size: 7.5pt;
        color: #64748b;
        font-weight: 600;
    }
    .company-title {
        font-size: 9pt;
        font-weight: 900;
        color: #000000;
        text-align: right;
    }
    .company-contact {
        font-size: 7.5pt;
        color: #475569;
        text-align: right;
        line-height: 1.4;
    }
</style>
</head>
<body>

<!-- PAGE 1: EXECUTIVE COVER PAGE -->
<div class="page-wrap">
    <table class="header-border">
        <tr>
            <td style="width: 50%; vertical-align: middle;">
                <table style="width: 100%;">
                    <tr>
                        <td style="width: 55px; vertical-align: middle;"><img src="${LOGO_BASE64}" style="height: 46px; vertical-align: middle;" /></td>
                        <td style="vertical-align: middle; padding-left: 8px;">
                            <div class="brand-name">Livincart Private Limited</div>
                            <div class="brand-sub">Official Quotation & Estimation Workspace</div>
                        </td>
                    </tr>
                </table>
            </td>
            <td style="width: 50%; vertical-align: middle; text-align: right;">
                <div class="company-title">LIVINCART AND SERVICES PRIVATE LIMITED</div>
                <div class="company-contact">
                    GST : 37AAGCL5523Q1ZX<br>
                    Visakhapatnam, Andhra Pradesh – 530020<br>
                    Phone: +91 7702312351 | Email: contact@livincart.com<br>
                    Website: www.livincart.com
                </div>
            </td>
        </tr>
    </table>

    <div style="height: 170px;">&nbsp;</div>

    <!-- Center Hero Title -->
    <div style="text-align: center; width: 100%;">
        <img src="${LOGO_BASE64}" style="height: 80px; margin-bottom: 12px;" />
        <div style="font-size: 13.5pt; font-weight: 900; color: #000000; letter-spacing: 0.5px; margin-bottom: 6px;">
            LIVINCART AND SERVICES PRIVATE LIMITED
        </div>
        <div style="width: 160px; height: 0px; border-bottom: 3.5px solid #ea580c; margin: 0 auto 20px auto;"></div>

        <div style="font-size: 23pt; font-weight: 900; color: #000000; letter-spacing: 0.5px;">
            OFFICIAL QUOTATION &amp;
        </div>
        <div style="font-size: 25pt; font-weight: 900; color: #ea580c; letter-spacing: 0.5px; margin-top: 4px;">
            PROJECT ESTIMATE ${isFinalVersion ? '(FINAL VERSION)' : ''}
        </div>
        <div style="width: 200px; height: 0px; border-bottom: 3.5px solid #ea580c; margin: 16px auto 26px auto;"></div>

        <!-- Quote Details Box -->
        <table style="width: 380px; margin: 0 auto; border: 2px solid #ea580c; border-radius: 16px; background-color: #ffffff;">
            <tr>
                <td style="width: 50%; padding: 12px 18px; text-align: center; border-right: 1.5px solid #fed7aa;">
                    <div style="font-size: 8pt; color: #64748b; font-weight: bold; text-transform: uppercase;">Quote No.</div>
                    <div style="font-size: 11pt; font-weight: 900; color: #000000; margin-top: 2px;">${quoteNumber}</div>
                </td>
                <td style="width: 50%; padding: 12px 18px; text-align: center;">
                    <div style="font-size: 8pt; color: #64748b; font-weight: bold; text-transform: uppercase;">Date</div>
                    <div style="font-size: 11pt; font-weight: 900; color: #000000; margin-top: 2px;">${createdAt}</div>
                </td>
            </tr>
        </table>
    </div>

    <div style="height: 180px;">&nbsp;</div>

    <!-- Bottom Contact Strips -->
    <div style="border: 2px solid #ea580c; border-radius: 14px; overflow: hidden; background-color: #ffffff;">
        <table style="background-color: #ea580c; color: #ffffff;">
            <tr>
                <td style="width: 38%; padding: 9px 12px; text-align: center; font-size: 8.5pt; font-weight: bold; color: #ffffff; border-right: 1.5px solid #ffffff;">
                    Visakhapatnam, Andhra Pradesh 530020
                </td>
                <td style="width: 26%; padding: 9px 12px; text-align: center; font-size: 8.5pt; font-weight: bold; color: #ffffff; border-right: 1.5px solid #ffffff;">
                    +91 7702312351
                </td>
                <td style="width: 36%; padding: 9px 12px; text-align: center; font-size: 8.5pt; font-weight: bold; color: #ffffff;">
                    contact@livincart.com
                </td>
            </tr>
        </table>
        <table style="background-color: #fff7ed; border-top: 1.5px solid #fed7aa;">
            <tr>
                <td style="width: 50%; padding: 9px 12px; text-align: center; font-size: 9pt; font-weight: 900; color: #0f172a; border-right: 1.5px solid #fed7aa;">
                    www.livincart.com
                </td>
                <td style="width: 50%; padding: 9px 12px; text-align: center; font-size: 9pt; font-weight: 900; color: #0f172a;">
                    Livincart Team
                </td>
            </tr>
        </table>
    </div>
</div>

<!-- PAGE 2: PROJECT INFORMATION & SCOPE DETAILS -->
<div class="page-wrap">
    <table class="header-border">
        <tr>
            <td style="width: 50%; vertical-align: middle;">
                <table style="width: 100%;">
                    <tr>
                        <td style="width: 55px; vertical-align: middle;"><img src="${LOGO_BASE64}" style="height: 46px; vertical-align: middle;" /></td>
                        <td style="vertical-align: middle; padding-left: 8px;">
                            <div class="brand-name">Livincart Private Limited</div>
                            <div class="brand-sub">Official Quotation & Estimation Workspace</div>
                        </td>
                    </tr>
                </table>
            </td>
            <td style="width: 50%; vertical-align: middle; text-align: right;">
                <div class="company-title">LIVINCART AND SERVICES PRIVATE LIMITED</div>
                <div class="company-contact">
                    GST : 37AAGCL5523Q1ZX<br>
                    Visakhapatnam, Andhra Pradesh – 530020<br>
                    Phone: +91 7702312351 | Email: contact@livincart.com
                </div>
            </td>
        </tr>
    </table>

    <div style="margin-bottom: 24px;">
        <h2 style="margin: 0; font-size: 19pt; font-weight: 900; color: #0f172a;">PROJECT INFORMATION</h2>
        <div style="width: 75px; height: 4px; background-color: #ea580c; margin-top: 6px;"></div>
    </div>

    <!-- Dotted Grid Box -->
    <div style="border: 2px solid #cbd5e1; border-radius: 14px; padding: 24px; background-color: #ffffff; margin-bottom: 26px;">
        <table style="border-bottom: 1.5px dashed #cbd5e1; padding-bottom: 20px; margin-bottom: 20px;">
            <tr>
                <td style="width: 33.3%; border-right: 1.5px dashed #cbd5e1; padding-right: 14px; vertical-align: top;">
                    <div style="font-size: 9pt; color: #64748b; font-weight: bold; margin-bottom: 4px;">Proposal Created for:</div>
                    <div style="font-size: 13pt; font-weight: 900; color: #ea580c;">${clientName}</div>
                </td>
                <td style="width: 33.3%; border-right: 1.5px dashed #cbd5e1; padding-left: 14px; padding-right: 14px; vertical-align: top;">
                    <div style="font-size: 9pt; color: #64748b; font-weight: bold; margin-bottom: 4px;">Project ID:</div>
                    <div style="font-size: 13pt; font-weight: 900; color: #ea580c;">${projectId}</div>
                </td>
                <td style="width: 33.3%; padding-left: 14px; vertical-align: top;">
                    <div style="font-size: 9pt; color: #64748b; font-weight: bold; margin-bottom: 4px;">Proposal Created on:</div>
                    <div style="font-size: 13pt; font-weight: 900; color: #ea580c;">${createdAt}</div>
                </td>
            </tr>
        </table>

        <div style="border-bottom: 1.5px dashed #cbd5e1; padding-bottom: 18px; margin-bottom: 18px;">
            <div style="font-size: 9pt; color: #64748b; font-weight: bold; margin-bottom: 4px;">Scope of Work:</div>
            <div style="font-size: 12.5pt; font-weight: 900; color: #ea580c;">Complete Interior Design &amp; Custom Modular Execution</div>
        </div>

        <table style="border-bottom: 1.5px dashed #cbd5e1; padding-bottom: 20px; margin-bottom: 20px;">
            <tr>
                <td style="width: 33.3%; border-right: 1.5px dashed #cbd5e1; padding-right: 14px; vertical-align: top;">
                    <div style="font-size: 9pt; color: #64748b; font-weight: bold; margin-bottom: 4px;">Production &amp; Installation:</div>
                    <div style="font-size: 12pt; font-weight: 900; color: #0f172a;">75 Business Days</div>
                </td>
                <td style="width: 33.3%; border-right: 1.5px dashed #cbd5e1; padding-left: 14px; padding-right: 14px; vertical-align: top;">
                    <div style="font-size: 9pt; color: #64748b; font-weight: bold; margin-bottom: 4px;">Project Category:</div>
                    <div style="font-size: 12pt; font-weight: 900; color: #0f172a;">Interior &amp; Furniture Projects</div>
                </td>
                <td style="width: 33.3%; padding-left: 14px; vertical-align: top;">
                    <div style="font-size: 9pt; color: #64748b; font-weight: bold; margin-bottom: 4px;">Designer Name:</div>
                    <div style="font-size: 12pt; font-weight: 900; color: #0f172a;">Livincart Team</div>
                </td>
            </tr>
        </table>

        <table>
            <tr>
                <td style="width: 33.3%; border-right: 1.5px dashed #cbd5e1; padding-right: 14px; vertical-align: top;">
                    <div style="font-size: 9pt; color: #64748b; font-weight: bold; margin-bottom: 4px;">Sales Manager Name:</div>
                    <div style="font-size: 11pt; font-weight: 900; color: #0f172a;">${(!extra.sales_manager_name || String(extra.sales_manager_name).toLowerCase().includes('admin')) ? ((quoteData as any)?.sales_manager_name && !String((quoteData as any).sales_manager_name).toLowerCase().includes('admin') ? (quoteData as any).sales_manager_name : 'Thanmai') : extra.sales_manager_name}</div>
                </td>
                <td style="width: 33.3%; border-right: 1.5px dashed #cbd5e1; padding-left: 14px; padding-right: 14px; vertical-align: top;">
                    <div style="font-size: 9pt; color: #64748b; font-weight: bold; margin-bottom: 4px;">Sales Manager Phone:</div>
                    <div style="font-size: 11pt; font-weight: 900; color: #0f172a;">${(!extra.sales_manager_phone || extra.sales_manager_phone === '9182263332') ? ((quoteData as any)?.sales_manager_phone && (quoteData as any).sales_manager_phone !== '9182263332' ? (quoteData as any).sales_manager_phone : '7702312351') : extra.sales_manager_phone}</div>
                </td>
                <td style="width: 33.3%; padding-left: 14px; vertical-align: top;">
                    <div style="font-size: 9pt; color: #64748b; font-weight: bold; margin-bottom: 4px;">Sales Manager Email:</div>
                    <div style="font-size: 11pt; font-weight: 900; color: #0f172a;">${extra.sales_manager_email || (quoteData as any)?.sales_manager_email || 'sukendra.ch@livincart.com'}</div>
                </td>
            </tr>
        </table>
    </div>

    <!-- Highlighted Note Box -->
    <table style="background-color: #fff7ed; border-radius: 12px; border: 1.5px solid #fed7aa; padding: 14px 18px;">
        <tr>
            <td style="width: 32px; vertical-align: middle;">
                <div style="width: 26px; height: 26px; line-height: 26px; border-radius: 50%; background-color: #ea580c; color: #ffffff; text-align: center; font-weight: 900; font-size: 12pt;">i</div>
            </td>
            <td style="padding-left: 12px; vertical-align: middle; font-size: 9.5pt; color: #7c2d12; font-weight: 600; line-height: 1.45;">
                <strong style="color: #ea580c;">NOTE:</strong>
                The timeline may change based on Location, Finishes, Project Value, and Civil Scope of work.
            </td>
        </tr>
    </table>
</div>

<!-- PAGE 3: MODULES SUMMARY & FINANCIAL RECAP -->
<div class="page-wrap">
    <table class="header-border">
        <tr>
            <td style="width: 50%; vertical-align: middle;">
                <table style="width: 100%;">
                    <tr>
                        <td style="width: 55px; vertical-align: middle;"><img src="${LOGO_BASE64}" style="height: 46px; vertical-align: middle;" /></td>
                        <td style="vertical-align: middle; padding-left: 8px;">
                            <div class="brand-name">Livincart Private Limited</div>
                            <div class="brand-sub">Official Quotation & Estimation Workspace</div>
                        </td>
                    </tr>
                </table>
            </td>
            <td style="width: 50%; vertical-align: middle; text-align: right;">
                <div class="company-title">LIVINCART AND SERVICES PRIVATE LIMITED</div>
                <div class="company-contact">
                    GST : 37AAGCL5523Q1ZX | Phone: +91 7702312351
                </div>
            </td>
        </tr>
    </table>

    <div style="margin-bottom: 18px;">
        <h3 style="font-size: 13pt; font-weight: 900; color: #0f172a; margin: 0; text-transform: uppercase;">
            Modules Summary — Commercial Estimate — Version ${versionNum}
        </h3>
    </div>

    <!-- DEBUG: flat_discount=${JSON.stringify(rawFlat)}, applied_coupon=${JSON.stringify(coupon)}, additional_charges=${JSON.stringify(addCharges)} | CALCULATED: flatDiscountAmt=${flatDiscountAmt}, couponDiscountAmt=${couponDiscountAmt}, addChargesAmt=${addChargesAmt} -->
    <!-- Summary Table -->
    <table style="border: 1px solid #cbd5e1; margin-bottom: 22px;">
        <thead>
            <tr style="background-color: #ea580c; color: #ffffff;">
                <th style="padding: 10px 14px; text-align: center; font-weight: bold; color: #ffffff; width: 45px;">#</th>
                <th style="padding: 10px 14px; text-align: left; font-weight: bold; color: #ffffff;">Module Name</th>
                <th style="padding: 10px 14px; text-align: center; font-weight: bold; color: #ffffff; width: 100px;">Total Items</th>
                <th style="padding: 10px 14px; text-align: right; font-weight: bold; color: #ffffff; width: 150px;">Amount (Rs.)</th>
            </tr>
        </thead>
        <tbody>
            ${summaryRowsHtml}

            <!-- 1) Gross Total -->
            <tr style="border-top: 2px solid #fed7aa; background-color: #fffaf0;">
                <td colspan="3" style="padding: 10px 14px; font-weight: bold; text-align: right; color: #111827;">
                    <div>Total Modules Gross Amount</div>
                    ${grandTotalSft > 0 ? `<div style="font-size: 8pt; color: #ea580c; font-weight: 800; word-break: break-all;">Total SFT: ${grandTotalSft} SFT</div>` : ''}
                </td>
                <td style="padding: 10px 14px; text-align: right; font-weight: 900; color: #ea580c; font-size: 10.5pt;">Rs. ${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>

            <!-- 2) Category-Wise Discounts -->
            ${!isHidden('categoryDiscount') ? (
                catDiscountAmt > 0 ? (
                    categoryDiscountsList.length > 1 ? categoryDiscountsList.map(cd => `
                    <tr style="border-top: 1px dashed #fed7aa; background-color: #fff7ed;">
                        <td colspan="3" style="padding: 8px 14px; text-align: right; font-weight: bold; color: #c2410c;">Category Discount (${cd.name}${cd.type === 'percent' ? ` - ${cd.value}%` : ''}):</td>
                        <td style="padding: 8px 14px; text-align: right; font-weight: bold; color: #c2410c;">- Rs. ${cd.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>`).join('') + `
                    <tr style="border-top: 1px dashed #fed7aa; background-color: #fff7ed;">
                        <td colspan="3" style="padding: 8px 14px; text-align: right; font-weight: bold; color: #c2410c;">Total Category-Wise Discount:</td>
                        <td style="padding: 8px 14px; text-align: right; font-weight: bold; color: #c2410c;">- Rs. ${catDiscountAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>` : (
                    categoryDiscountsList.length === 1 ? `
                    <tr style="border-top: 1px dashed #fed7aa; background-color: #fff7ed;">
                        <td colspan="3" style="padding: 8px 14px; text-align: right; font-weight: bold; color: #c2410c;">Category-Wise Discount (${categoryDiscountsList[0].name}${categoryDiscountsList[0].type === 'percent' ? ` - ${categoryDiscountsList[0].value}%` : ''}):</td>
                        <td style="padding: 8px 14px; text-align: right; font-weight: bold; color: #c2410c;">- Rs. ${catDiscountAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>` : `
                    <tr style="border-top: 1px dashed #fed7aa; background-color: #fff7ed;">
                        <td colspan="3" style="padding: 8px 14px; text-align: right; font-weight: bold; color: #c2410c;">Total Category-Wise Discount:</td>
                        <td style="padding: 8px 14px; text-align: right; font-weight: bold; color: #c2410c;">- Rs. ${catDiscountAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>`
                )) : `
                <tr style="border-top: 1px dashed #fed7aa; background-color: #fff7ed;">
                    <td colspan="3" style="padding: 8px 14px; text-align: right; font-weight: bold; color: #c2410c;">Category-Wise Discounts:</td>
                    <td style="padding: 8px 14px; text-align: right; font-weight: bold; color: #94a3b8;">—</td>
                </tr>`
            ) : ''}

            <!-- 3) Flat Amount Discount -->
            ${!isHidden('flatDiscount') && !isHidden('generalDiscount') ? `
            <tr style="border-top: 1px dashed #fed7aa; background-color: #fff7ed;">
                <td colspan="3" style="padding: 8px 14px; text-align: right; font-weight: bold; color: #c2410c;">Flat Amount Discount:</td>
                <td style="padding: 8px 14px; text-align: right; font-weight: bold; color: ${flatDiscountAmt > 0 ? '#c2410c' : '#94a3b8'};">${flatDiscountAmt > 0 ? `- Rs. ${flatDiscountAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}</td>
            </tr>` : ''}

            <!-- 4) Promo Coupon Discount -->
            ${!isHidden('promoCode') ? `
            <tr style="border-top: 1px dashed #fed7aa; background-color: #fff7ed;">
                <td colspan="3" style="padding: 8px 14px; text-align: right; font-weight: bold; color: #ea580c;">${couponDiscountAmt > 0 ? `Promo Code Applied (${couponCode}${couponDesc ? ` - ${couponDesc}` : ''}):` : 'Promo / Coupon Code Applied:'}</td>
                <td style="padding: 8px 14px; text-align: right; font-weight: bold; color: ${couponDiscountAmt > 0 ? '#ea580c' : '#94a3b8'};">${couponDiscountAmt > 0 ? `- Rs. ${couponDiscountAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}</td>
            </tr>` : ''}

            <!-- 5) Additional Charges -->
            ${!isHidden('additionalCharges') ? `
            <tr style="border-top: 1px dashed #fed7aa; background-color: #fff7ed;">
                <td colspan="3" style="padding: 8px 14px; text-align: right; font-weight: bold; color: #475569;">Additional Charges:</td>
                <td style="padding: 8px 14px; text-align: right; font-weight: bold; color: ${addChargesAmt > 0 ? '#0f172a' : '#94a3b8'};">${addChargesAmt > 0 ? `+ Rs. ${addChargesAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}</td>
            </tr>` : ''}

            <!-- 6) GST (Respecting Hide GST Line toggle) -->
            ${overallGstEnabled && !overallGstLineHidden && gstAmount > 0 ? `
            <tr style="border-top: 1px dashed #fed7aa; background-color: #fff7ed;">
                <td colspan="3" style="padding: 8px 14px; text-align: right; font-weight: bold; color: #16a34a;">Overall GST (${gstRate}%):</td>
                <td style="padding: 8px 14px; text-align: right; font-weight: bold; color: #16a34a;">+ Rs. ${gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>` : ''}

            <!-- 7) Round Off Adjustment -->
            ${(roundOffEnabled || Math.abs(roundOffAdj) > 0.001) && !isHidden('roundOff') ? `
            <tr style="border-top: 1px dashed #fed7aa; background-color: #fff7ed;">
                <td colspan="3" style="padding: 8px 14px; text-align: right; font-weight: bold; color: #64748b;">Round Off Adjustment:</td>
                <td style="padding: 8px 14px; text-align: right; font-weight: bold; color: ${roundOffAdj >= 0 ? '#16a34a' : '#dc2626'};">${roundOffAdj >= 0 ? '+ Rs. ' : '- Rs. '}${Math.abs(roundOffAdj).toFixed(2)}</td>
            </tr>` : ''}

            <!-- 8) Final Net Payable Total -->
            <tr style="border-top: 2.5px solid #ea580c; background-color: #fff1f2;">
                <td colspan="3" style="padding: 12px 14px; font-weight: 900; text-align: right; font-size: 11pt; color: #0f172a;">Final Amount (Net Payable Total)</td>
                <td style="padding: 12px 14px; text-align: right; font-weight: 900; color: #16a34a; font-size: 12.5pt;">Rs. ${finalTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
        </tbody>
    </table>

    <!-- Amount in Words -->
    <div style="padding: 14px 18px; background-color: #fffaf0; border-radius: 8px; border: 1px solid #fed7aa;">
        <div style="font-size: 8pt; font-weight: bold; color: #64748b; text-transform: uppercase; margin-bottom: 3px;">Total Amount In Words</div>
        <div style="font-size: 11pt; font-weight: 900; color: #111827;">${numberToWordsIndian(finalTotal)}</div>
    </div>
</div>

<!-- PAGE 4+: INNER MODULES & DETAILED BOQ BREAKDOWN -->
<div class="${!isHidden('terms') && termsList.length > 0 ? 'page-wrap' : 'page-wrap-last'}">
    <table class="header-border">
        <tr>
            <td style="width: 50%; vertical-align: middle;">
                <table style="width: 100%;">
                    <tr>
                        <td style="width: 55px; vertical-align: middle;"><img src="${LOGO_BASE64}" style="height: 46px; vertical-align: middle;" /></td>
                        <td style="vertical-align: middle; padding-left: 8px;">
                            <div class="brand-name">Livincart Private Limited</div>
                            <div class="brand-sub">Official Quotation & Estimation Workspace</div>
                        </td>
                    </tr>
                </table>
            </td>
            <td style="width: 50%; vertical-align: middle; text-align: right;">
                <div class="company-title">LIVINCART AND SERVICES PRIVATE LIMITED</div>
                <div class="company-contact">
                    Detailed Itemized BOQ & Specifications
                </div>
            </td>
        </tr>
    </table>

    <!-- Detailed Modules Tables -->
    ${innerModulesHtml}

    <!-- Page 4 BOQ Signatures -->
    <table style="margin-top: 32px; padding-top: 14px; border-top: 1px solid #cbd5e1; page-break-inside: avoid;">
        <tr>
            <td style="width: 50%; vertical-align: top;">
                <div style="font-size: 9pt; font-weight: bold; color: #0c1527;">Client Signature</div>
                <div style="margin: 3px 0; height: 38px;">
                    ${clientSignature ? `<img src="${clientSignature}" alt="Client Signature" style="height: 36px; max-width: 140px; object-fit: contain; display: inline-block;" />` : `&nbsp;`}
                </div>
                <div style="font-size: 8.5pt; color: #64748b;">${clientName}</div>
            </td>
            <td style="width: 50%; text-align: right; vertical-align: top;">
                <div style="font-size: 9pt; font-weight: bold; color: #0c1527;">Authorized Signatory</div>
                <div style="margin: 3px 0; height: 38px; text-align: right;">
                    <img src="${OWNER_SIGNATURE_BASE64}" alt="Livincart Owner Signature" style="height: 36px; object-fit: contain; display: inline-block;" />
                </div>
                <div style="font-size: 8.5pt; color: #64748b;">Livincart Architects &amp; Interiors</div>
            </td>
        </tr>
    </table>
</div>

<!-- ══════════════════════════════════════════════════════════ -->
<!-- PAGE 5: DEDICATED TERMS, CONDITIONS & MATERIAL SPECS        -->
<!-- ══════════════════════════════════════════════════════════ -->
${!isHidden('terms') && termsList.length > 0 ? `
<div class="page-wrap-last">
    <table class="header-border">
        <tr>
            <td style="width: 50%; vertical-align: middle;">
                <table style="width: 100%;">
                    <tr>
                        <td style="width: 55px; vertical-align: middle;"><img src="${LOGO_BASE64}" style="height: 46px; vertical-align: middle;" /></td>
                        <td style="vertical-align: middle; padding-left: 8px;">
                            <div class="brand-name">Livincart Private Limited</div>
                            <div class="brand-sub">Official Quotation &amp; Estimation Workspace</div>
                        </td>
                    </tr>
                </table>
            </td>
            <td style="width: 50%; vertical-align: middle; text-align: right;">
                <div class="company-title">LIVINCART AND SERVICES PRIVATE LIMITED</div>
                <div class="company-contact">
                    GST : 37AAGCL5523Q1ZX | Phone: +91 7702312351
                </div>
            </td>
        </tr>
    </table>

    <div style="margin-bottom: 16px;">
        <h3 style="font-size: 13pt; font-weight: 900; color: #0f172a; margin: 0; text-transform: uppercase;">
            TERMS, CONDITIONS &amp; MATERIAL SPECIFICATIONS
        </h3>
        <div style="width: 80px; height: 3.5px; background-color: #ea580c; margin-top: 5px;"></div>
    </div>

    <div style="padding: 18px 20px; background-color: #fffdfa; border: 1.5px solid #fed7aa; border-radius: 12px; margin-bottom: 22px;">
        <div style="font-size: 8pt; color: #334155; line-height: 1.45;">
            ${termsList.map((termText, tIdx) => {
                termText = (termText || '').trim();
                if (!termText) return '';
                const isSubMilestone = (tIdx >= 4 && tIdx <= 7);
                const isSectionHeader = (tIdx === 3);
                const subBullets = ['a.', 'b.', 'c.', 'd.'];
                const bulletLabel = isSubMilestone ? (subBullets[tIdx - 4] || '•') : (tIdx < 4 ? `${tIdx + 1}.` : `${tIdx - 3}.`);
                const paddingLeft = isSubMilestone ? '18px' : '0px';
                const isBold = isSectionHeader || /^Material/i.test(termText) || /^Finishes/i.test(termText) || /^Accessories/i.test(termText) || /^Warranty/i.test(termText) || /^Note/i.test(termText) || /^Payment Milestones/i.test(termText);
                const color = isSectionHeader ? '#ea580c' : '#334155';
                const weight = isBold ? 'bold' : 'normal';

                return `<table style="width: 100%; border-collapse: collapse; margin-bottom: 4px; padding-left: ${paddingLeft}; page-break-inside: avoid;">
                    <tr>
                        <td style="width: ${isSubMilestone ? '36px' : '22px'}; text-align: right; padding-right: 6px; vertical-align: top; font-weight: bold; color: #ea580c; font-size: 8pt;">${bulletLabel}</td>
                        <td style="vertical-align: top; font-size: 8pt; color: ${color}; font-weight: ${weight}; line-height: 1.45;">${termText}</td>
                    </tr>
                </table>`;
            }).join('')}
        </div>
    </div>

    <!-- Account Details & Signatures -->
    <table style="width: 100%; border-top: 1.5px dashed #cbd5e1; padding-top: 16px; margin-top: 16px; page-break-inside: avoid;">
        <tr>
            <td style="vertical-align: top; width: ${clientSignature ? '40%' : '60%'};">
                <div style="font-size: 9pt; font-weight: 900; color: #0f172a;">
                    Account Name: <span style="color: #ea580c;">Livincart and services private limited</span>
                </div>
                <div style="font-size: 7.5pt; color: #64748b; margin-top: 4px;">
                    Note: Terms &amp; conditions are part of the official quotation agreement.
                </div>
            </td>
            ${clientSignature ? `
            <td style="vertical-align: top; text-align: center; width: 30%;">
                <div style="font-size: 8.5pt; color: #64748b; font-weight: 600;">Client Signature</div>
                <div style="margin: 3px 0; height: 40px; text-align: center;">
                    <img src="${clientSignature}" alt="Client Signature" style="height: 38px; max-width: 140px; object-fit: contain; display: inline-block;" />
                </div>
                <div style="font-size: 8.5pt; font-weight: 700; color: #0f172a;">${clientName}</div>
            </td>` : ''}
            <td style="vertical-align: top; text-align: right; width: ${clientSignature ? '30%' : '40%'};">
                <div style="font-size: 8.5pt; color: #64748b; font-weight: 600;">Authorized Signature</div>
                <div style="margin: 3px 0; height: 40px; text-align: right;">
                    <img src="${OWNER_SIGNATURE_BASE64}" alt="Livincart Owner Signature" style="height: 38px; object-fit: contain; display: inline-block;" />
                </div>
                <div style="font-size: 9.5pt; font-weight: 900; color: #0f172a;">Livincart &amp; Services Pvt Ltd</div>
            </td>
        </tr>
    </table>
</div>` : ''}

</body>
</html>`;
}
