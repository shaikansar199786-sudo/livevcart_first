<?php
// api/helpers/SimplePdfBuilder.php
// Pure PHP 4-Page Vector Quotation Builder for Hostinger Shared Hosting (Zero Puppeteer)

class SimplePdfBuilder {

    /**
     * Convert number to words in Indian numbering system (Lakhs & Crores)
     */
    public static function numberToWordsIndian($num) {
        $num = round(floatval($num));
        if ($num <= 0) return 'Zero Rupees Only';
        $ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
        $tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

        $crore = floor($num / 10000000);
        $num -= $crore * 10000000;
        $lakh = floor($num / 100000);
        $num -= $lakh * 100000;
        $thousand = floor($num / 1000);
        $num -= $thousand * 1000;
        $hundred = floor($num / 100);
        $num -= $hundred * 100;

        $res = '';
        if ($crore > 0) $res .= ($crore < 20 ? $ones[$crore] : $tens[floor($crore / 10)] . ' ' . $ones[$crore % 10]) . ' Crore ';
        if ($lakh > 0) $res .= ($lakh < 20 ? $ones[$lakh] : $tens[floor($lakh / 10)] . ' ' . $ones[$lakh % 10]) . ' Lakh ';
        if ($thousand > 0) $res .= ($thousand < 20 ? $ones[$thousand] : $tens[floor($thousand / 10)] . ' ' . $ones[$thousand % 10]) . ' Thousand ';
        if ($hundred > 0) $res .= $ones[$hundred] . ' Hundred ';
        if ($num > 0) {
            if ($res != '') $res .= 'and ';
            $res .= ($num < 20 ? $ones[$num] : $tens[floor($num / 10)] . ($num % 10 ? ' ' . $ones[$num % 10] : ''));
        }
        return trim($res) . ' Rupees Only';
    }

    /**
     * Build complete 4-page quotation PDF HTML.
     */
    public static function buildPdfHtml($quoteData) {

        $clientName  = trim($quoteData['client_name'] ?? $quoteData['subtitle'] ?? 'Valued Client');
        if (empty($clientName)) $clientName = 'Valued Client';
        $quoteId     = intval($quoteData['quote_id'] ?? $quoteData['id'] ?? 0);
        $projectId   = $quoteData['project_id'] ?? $quoteData['project_code'] ?? '1';
        $quoteNumber = $quoteData['quote_number'] ?? ('QTN-' . ($projectId ? "PR_$projectId" : $quoteId));
        $versionNum  = intval($quoteData['version'] ?? 1);
        $createdAt   = !empty($quoteData['created_at']) ? date('d M Y', strtotime($quoteData['created_at'])) : date('d M Y');
        
        $extra = [];
        if (!empty($quoteData['extra_data_parsed']) && is_array($quoteData['extra_data_parsed'])) {
            $extra = $quoteData['extra_data_parsed'];
        } elseif (!empty($quoteData['extra_data'])) {
            $extra = is_array($quoteData['extra_data']) ? $quoteData['extra_data'] : (json_decode($quoteData['extra_data'], true) ?: []);
        }

        $rawHidden = $extra['hidden_fields'] ?? $quoteData['hidden_fields'] ?? [];
        if (is_string($rawHidden)) {
            $rawHidden = json_decode($rawHidden, true) ?: [];
        }
        $mergedHidden = is_array($rawHidden) ? $rawHidden : [];
        if (!empty($extra['hidden_fields']) && is_array($extra['hidden_fields'])) {
            $mergedHidden = array_merge($mergedHidden, $extra['hidden_fields']);
        }
        if (!empty($quoteData['hidden_fields']) && is_array($quoteData['hidden_fields'])) {
            $mergedHidden = array_merge($mergedHidden, $quoteData['hidden_fields']);
        }

        $isHidden = function($key) use ($mergedHidden, $extra) {
            $kLower = strtolower($key);
            if (!empty($mergedHidden[$key]) || !empty($mergedHidden[$kLower])) return true;
            if ($key === 'particulars' && (!empty($mergedHidden['particulars']) || !empty($mergedHidden['productDescription']) || !empty($mergedHidden['product_description']))) return true;
            if ($key === 'qty' && (!empty($mergedHidden['qty']) || !empty($mergedHidden['quantity']))) return true;
            if ($key === 'amount' && (!empty($mergedHidden['amount']) || !empty($mergedHidden['item_amount']))) return true;
            if ($key === 'shutterMaterial' && (!empty($mergedHidden['shutter']) || !empty($mergedHidden['shutterMaterial']))) return true;
            if ($key === 'carcassMaterial' && (!empty($mergedHidden['carcass']) || !empty($mergedHidden['carcassMaterial']))) return true;
            if (($key === 'discount' || $key === 'disc') && (!empty($mergedHidden['discount']) || !empty($mergedHidden['disc']))) return true;
            if ($key === 'categoryDiscount' && (!empty($mergedHidden['discount']) || !empty($mergedHidden['categoryDiscount']) || !empty($mergedHidden['category_discount']))) return true;
            if ($key === 'promoCode' && (!empty($mergedHidden['discount']) || !empty($mergedHidden['promoCode']) || !empty($mergedHidden['coupon']) || !empty($mergedHidden['promo_code']))) return true;
            if (($key === 'flatDiscount' || $key === 'generalDiscount') && (!empty($mergedHidden['discount']) || !empty($mergedHidden['flatDiscount']) || !empty($mergedHidden['generalDiscount']) || !empty($mergedHidden['flat_discount']) || !empty($mergedHidden['general_discount']))) return true;
            if ($key === 'additionalCharges' && (!empty($mergedHidden['additionalCharges']) || !empty($mergedHidden['additional_charges']))) return true;
            if ($key === 'gst' && (!empty($mergedHidden['gst']) || !empty($extra['overall_gst_line_hidden']))) return true;
            if ($key === 'roundOff' && (!empty($mergedHidden['roundOff']) || !empty($mergedHidden['round_off']))) return true;
            return false;
        };

        $isFinalVersion = !empty($extra['is_final_version']) || ($quoteData['status'] ?? '') === 'FINAL' || ($quoteData['status'] ?? '') === 'qc_approved';

        // Extract sections & items
        $sections = $quoteData['sections'] ?? [];
        if (empty($sections)) {
            // Attempt DB fetch if sections array not supplied
            try {
                include_once __DIR__ . '/../config/database.php';
                $db = (new Database())->getConnection();
                $targetQid = $quoteId;
                if ($targetQid <= 0 && !empty($quoteNumber)) {
                    $chk = $db->prepare("SELECT quote_id FROM quotes WHERE quote_number = :qnum LIMIT 1");
                    $chk->execute(['qnum' => $quoteNumber]);
                    $targetQid = intval($chk->fetchColumn() ?: 0);
                }
                if ($targetQid > 0) {
                    $sStmt = $db->prepare("SELECT * FROM quote_sections WHERE quote_id = :qid ORDER BY display_order, section_id ASC");
                    $sStmt->execute(['qid' => $targetQid]);
                    $sections = $sStmt->fetchAll(PDO::FETCH_ASSOC);
                    foreach ($sections as &$sec) {
                        $iStmt = $db->prepare("SELECT * FROM quote_items WHERE section_id = :sid ORDER BY display_order, item_id ASC");
                        $iStmt->execute(['sid' => $sec['section_id']]);
                        $sec['items'] = $iStmt->fetchAll(PDO::FETCH_ASSOC);
                    }
                    unset($sec);
                }
            } catch (\Exception $e) {}
        }

        // Calculate Totals & Subtotals matching QuoteTab
        $baseGrossSum = 0;
        $itemDiscSum = 0;
        $secItemAmtSum = 0;
        foreach ($sections as $sec) {
            foreach ($sec['items'] ?? [] as $it) {
                if (($it['brand'] ?? '') === 'HEADER') continue;
                $isLump = ($it['pricing_mode'] ?? '') === 'lumpsum' || (empty($it['width']) && empty($it['height']) && empty($it['sft']));
                $qty = floatval($it['quantity'] ?? 1);
                $rate = floatval($it['rate'] ?? $it['rate_per_sft'] ?? 0);
                $base = ($isLump || $qty == 0) ? $rate : ($qty * $rate);
                $baseGrossSum += $base;
                $discPercent = floatval($it['discount_percent'] ?? 0);
                if ($discPercent > 0 && $base > 0) {
                    $itemDiscSum += ($base * ($discPercent / 100));
                }
                $secItemAmtSum += floatval($it['amount'] ?? $base);
            }
        }

        // If baseGrossSum is available (> 0), use it as gross total before discount, else fall back to sum of amounts or quoteData
        if ($baseGrossSum > 0) {
            $grandTotal = $baseGrossSum;
        } elseif ($secItemAmtSum > 0) {
            $grandTotal = $secItemAmtSum;
        } else {
            $grandTotal = floatval($quoteData['total_amount'] ?? 0);
        }

        // 2. Category-Wise Discounts Breakdown & Total
        $catDiscounts = $extra['category_discounts'] ?? $quoteData['category_discounts'] ?? null;
        $categoryDiscountsList = [];
        $catDiscountAmt = 0;

        if (is_array($catDiscounts) && !empty($catDiscounts)) {
            foreach ($catDiscounts as $cKey => $disc) {
                if (!is_array($disc)) continue;
                $cName = isset($disc['category']) ? trim($disc['category']) : trim(strval($cKey));
                $val = floatval($disc['value'] ?? $disc['amount'] ?? 0);
                $type = $disc['type'] ?? 'percent';
                if ($val <= 0) continue;

                $catTotal = 0;
                $tCat = strtolower($cName);
                foreach ($sections as $sec) {
                    foreach ($sec['items'] ?? [] as $it) {
                        if (($it['brand'] ?? '') === 'HEADER') continue;
                        $iCat = strtolower(trim($it['category'] ?? ''));
                        $sName = strtolower(trim($sec['section_name'] ?? $sec['name'] ?? ''));
                        if (($iCat && (strpos($iCat, $tCat) !== false || strpos($tCat, $iCat) !== false)) ||
                            ($sName && (strpos($sName, $tCat) !== false || strpos($tCat, $sName) !== false))) {
                            $isLump = ($it['pricing_mode'] ?? '') === 'lumpsum' || (empty($it['width']) && empty($it['height']) && empty($it['sft']));
                            $iQty = floatval($it['quantity'] ?? 1);
                            $iRate = floatval($it['rate'] ?? $it['rate_per_sft'] ?? 0);
                            $iBase = ($isLump || $iQty == 0) ? $iRate : ($iQty * $iRate);
                            $catTotal += $iBase > 0 ? $iBase : floatval($it['amount'] ?? 0);
                        }
                    }
                }

                $discAmt = 0;
                if ($type === 'percent') {
                    $discAmt = round($catTotal * ($val / 100));
                } else {
                    $discAmt = round(min($val, $catTotal > 0 ? $catTotal : $val));
                }

                if ($discAmt > 0) {
                    $categoryDiscountsList[] = [
                        'name' => $cName,
                        'value' => $val,
                        'type' => $type,
                        'amount' => $discAmt
                    ];
                    $catDiscountAmt += $discAmt;
                }
            }
        }

        // Fallback: If no explicit category_discounts breakdown matched, but items had discount_percent
        if ($catDiscountAmt == 0 && $itemDiscSum > 0) {
            $catDiscountAmt = round($itemDiscSum);
        }
        // Or if global_discount had percent
        if ($catDiscountAmt == 0 && !empty($extra['global_discount']['value']) && ($extra['global_discount']['type'] ?? '') === 'percent') {
            $catDiscountAmt = round($grandTotal * (floatval($extra['global_discount']['value']) / 100));
        }

        // 3. Flat Amount discount (₹ entered flat amount)
        $flatDiscountAmt = 0;
        $rawFlat = $extra['flat_discount'] ?? $extra['flatDiscount'] ?? $quoteData['flat_discount'] ?? $quoteData['flatDiscount'] ?? $extra['general_discount'] ?? $extra['generalDiscount'] ?? $quoteData['general_discount'] ?? $quoteData['generalDiscount'] ?? null;
        if (is_array($rawFlat)) {
            $flatDiscountAmt = floatval($rawFlat['amount'] ?? $rawFlat['value'] ?? 0);
        } elseif (is_numeric($rawFlat)) {
            $flatDiscountAmt = floatval($rawFlat);
        } elseif (!empty($extra['global_discount']['value']) && ($extra['global_discount']['type'] ?? '') === 'flat') {
            $flatDiscountAmt = floatval($extra['global_discount']['value']);
        }
        $flatDiscountAmt = round($flatDiscountAmt);

        // If itemDiscSum matches flatDiscountAmt and no category_discounts existed, it was auto-distributed; don't double count
        if ($flatDiscountAmt > 0 && $catDiscountAmt == $flatDiscountAmt && empty($categoryDiscountsList)) {
            $catDiscountAmt = 0;
        }

        // 4. Promo coupon discount
        $coupon = $extra['applied_coupon'] ?? $quoteData['applied_coupon'] ?? $extra['appliedCoupon'] ?? $quoteData['appliedCoupon'] ?? $extra['coupon'] ?? $quoteData['coupon'] ?? $extra['promo_code'] ?? $quoteData['promo_code'] ?? null;
        if (is_string($coupon) && strpos($coupon, '{') !== false) {
            $coupon = json_decode($coupon, true);
        }
        $couponDiscountAmt = 0;
        $couponCode = '';
        $couponDesc = '';
        if (!empty($coupon) && is_array($coupon)) {
            $cVal = floatval($coupon['discountValue'] ?? $coupon['discount_value'] ?? $coupon['value'] ?? $coupon['amount'] ?? 0);
            $cType = $coupon['discountType'] ?? $coupon['discount_type'] ?? $coupon['type'] ?? 'percent';
            $couponCode = trim($coupon['code'] ?? $coupon['coupon_code'] ?? 'PROMO');
            if ($cVal > 0) {
                $netAfterDiscounts = max(0, $grandTotal - $catDiscountAmt - $flatDiscountAmt);
                if ($cType === 'percent') {
                    $couponDiscountAmt = round($netAfterDiscounts * ($cVal / 100));
                    $couponDesc = $cVal . '% OFF';
                } else {
                    $couponDiscountAmt = round(min($netAfterDiscounts, $cVal));
                    $couponDesc = 'Rs. ' . number_format($cVal, 2) . ' OFF';
                }
            }
        }

        // Total combined discount across all discount types
        $totalDiscountAmt = $catDiscountAmt + $flatDiscountAmt + $couponDiscountAmt;

        // 5. Additional charges
        $addCharges = $extra['additional_charges'] ?? $extra['additionalCharges'] ?? $quoteData['additional_charges'] ?? $quoteData['additionalCharges'] ?? null;
        if (is_string($addCharges) && strpos($addCharges, '{') !== false) {
            $addCharges = json_decode($addCharges, true);
        }
        $addChargesAmt = 0;
        $hasGstOnCharges = false;
        $chargesGstRate = 18;
        if (is_array($addCharges)) {
            if (is_array($addCharges['amount'] ?? null)) {
                $addChargesAmt = floatval($addCharges['amount']['amount'] ?? $addCharges['amount']['value'] ?? 0);
            } else {
                $addChargesAmt = floatval($addCharges['amount'] ?? $addCharges['value'] ?? 0);
            }
            $hasGstOnCharges = !empty($addCharges['withGst']) || !empty($addCharges['hasGst']) || !empty($addCharges['with_gst']);
            $chargesGstRate = isset($addCharges['gstRate']) ? floatval($addCharges['gstRate']) : (isset($addCharges['gst_rate']) ? floatval($addCharges['gst_rate']) : 18);
        } elseif (is_numeric($addCharges)) {
            $addChargesAmt = floatval($addCharges);
        }

        // Debug logging for PDF build
        @file_put_contents(__DIR__ . '/../debug_email_pdf.log', date('Y-m-d H:i:s') . " | SimplePdfBuilder: flat_discount=" . json_encode($rawFlat) . " (calc: {$flatDiscountAmt}), applied_coupon=" . json_encode($coupon) . " (calc: {$couponDiscountAmt}), additional_charges=" . json_encode($addCharges) . " (calc: {$addChargesAmt})\n", FILE_APPEND);

        // 6. Overall GST (Respecting admin toggle 'overall_gst_line_hidden' and splitwise type)
        $gstSplitType = $extra['gst_split_type'] ?? $quoteData['gst_split_type'] ?? 'intra';
        $overallGstEnabled = ($extra['overall_gst_enabled'] ?? $quoteData['overall_gst_enabled'] ?? true) !== false;
        $overallGstLineHidden = !empty($extra['overall_gst_line_hidden']) || !empty($quoteData['overall_gst_line_hidden']) || $isHidden('gst');
        $gstRate = isset($extra['overall_gst_rate']) ? floatval($extra['overall_gst_rate']) : (isset($quoteData['overall_gst_rate']) ? floatval($quoteData['overall_gst_rate']) : 18);

        $taxableSubtotal = max(0, $grandTotal - $catDiscountAmt - $flatDiscountAmt - $couponDiscountAmt);
        $gstAmount = 0;
        if ($overallGstEnabled && $gstRate > 0) {
            $gstAmount = round($taxableSubtotal * ($gstRate / 100));
        }

        $addChargesGstAmt = 0;
        if ($hasGstOnCharges && $addChargesAmt > 0 && $chargesGstRate > 0) {
            $addChargesGstAmt = round($addChargesAmt * ($chargesGstRate / 100));
        }

        // 7. Net Total & Round off (Includes taxable items, item GST, additional charges, and additional charges GST)
        $unrounded = $taxableSubtotal + $addChargesAmt + $addChargesGstAmt + ($overallGstEnabled ? $gstAmount : 0);
        $roundOffEnabled = ($extra['round_off_enabled'] ?? $quoteData['round_off_enabled'] ?? true) !== false && !$isHidden('roundOff');
        $finalTotal = $roundOffEnabled ? round($unrounded) : round($unrounded, 2);
        $roundOffAdj = $roundOffEnabled ? ($finalTotal - $unrounded) : 0;

        // 8. Terms, Conditions & Material Specifications
        $termsList = $extra['terms_list'] ?? $extra['terms'] ?? $quoteData['terms_list'] ?? $quoteData['terms'] ?? null;
        if (is_string($termsList) && strpos($termsList, '[') !== false) {
            $termsList = json_decode($termsList, true);
        }
        if (empty($termsList) || !is_array($termsList)) {
            $termsList = [
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

        // Base64 Logo & Signature via logoData helper
        require_once __DIR__ . '/logoData.php';
        $logoBase64 = defined('LIVINCART_LOGO_BASE64') ? LIVINCART_LOGO_BASE64 : '';
        if (empty($logoBase64)) {
            $logoPaths = [
                __DIR__ . '/../assets/logo.png',
                __DIR__ . '/../assets/1.png',
                __DIR__ . '/../uploads/logo.png',
                __DIR__ . '/../uploads/1.png',
                __DIR__ . '/../../frontend/src/assets/1.png',
                'C:/xampp/htdocs/livrcart/demoark/frontend/src/assets/1.png'
            ];
            foreach ($logoPaths as $lp) {
                if (file_exists($lp)) {
                    $logoBase64 = 'data:image/png;base64,' . base64_encode(file_get_contents($lp));
                    break;
                }
            }
        }

        $ownerSigBase64 = defined('LIVINCART_SIGNATURE_BASE64') ? LIVINCART_SIGNATURE_BASE64 : '';
        if (empty($ownerSigBase64)) {
            $sigPaths = [
                __DIR__ . '/../assets/LIVE CART SINGTU.png',
                __DIR__ . '/../uploads/LIVE CART SINGTU.png',
                __DIR__ . '/../../frontend/src/assets/LIVE CART SINGTU.png',
                'C:/xampp/htdocs/livrcart/demoark/frontend/src/assets/LIVE CART SINGTU.png'
            ];
            foreach ($sigPaths as $sp) {
                if (file_exists($sp)) {
                    $ownerSigBase64 = 'data:image/png;base64,' . base64_encode(file_get_contents($sp));
                    break;
                }
            }
        }

        // Standard Icons as Base64 SVG
        $icPin = 'data:image/svg+xml;base64,' . base64_encode('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ea580c" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>');
        $icPhone = 'data:image/svg+xml;base64,' . base64_encode('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ea580c" stroke-width="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>');
        $icMail = 'data:image/svg+xml;base64,' . base64_encode('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ea580c" stroke-width="2.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>');
        $icGlobe = 'data:image/svg+xml;base64,' . base64_encode('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ea580c" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.7 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10z"/></svg>');
        $icClip = 'data:image/svg+xml;base64,' . base64_encode('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ea580c" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>');
        $icCal = 'data:image/svg+xml;base64,' . base64_encode('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>');

        $logoHtml = !empty($logoBase64) ? '<img src="' . $logoBase64 . '" style="height: 46px; vertical-align: middle;" />' : '';
        $heroLogoHtml = !empty($logoBase64) ? '<img src="' . $logoBase64 . '" style="height: 80px; margin-bottom: 12px;" />' : '';

        // Generate Modules Summary Rows (Page 3)
        $summaryRowsHtml = '';
        if (!empty($sections)) {
            foreach ($sections as $sIdx => $sec) {
                $secName = htmlspecialchars($sec['section_name'] ?? $sec['name'] ?? ('Module ' . ($sIdx + 1)));
                $secItems = $sec['items'] ?? [];
                $itemCount = 0;
                $secGross = 0;
                $secNet = 0;
                foreach ($secItems as $it) {
                    if (($it['brand'] ?? '') === 'HEADER') continue;
                    $itemCount++;
                    $qty = (isset($it['quantity']) && floatval($it['quantity']) > 0) ? floatval($it['quantity']) : 1.0;
                    $rate = floatval($it['rate'] ?? $it['rate_per_sft'] ?? 0);
                    $base = $qty * $rate;
                    $itAmt = floatval($it['amount'] ?? $base);
                    $secGross += ($base > 0) ? $base : $itAmt;
                    $secNet += $itAmt;
                }
                $displayAmt = $secNet > 0 ? $secNet : $secGross;
                $netHtml = ($secGross > $secNet && abs($secGross - $secNet) > 0.01) ? '<br/><span style="font-size: 7.5pt; color: #64748b; font-weight: 600;">(Gross: Rs. ' . number_format($secGross, 2) . ')</span>' : '';
                $summaryRowsHtml .= '
                <tr style="background-color: ' . ($sIdx % 2 === 1 ? '#fffdfa' : '#ffffff') . '; border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 10px 14px; font-weight: bold; color: #ea580c; text-align: center; width: 45px;">' . ($sIdx + 1) . '</td>
                    <td style="padding: 10px 14px; font-weight: bold; color: #0f172a;">' . $secName . '</td>
                    <td style="padding: 10px 14px; text-align: center; color: #475569; width: 100px;">' . $itemCount . '</td>
                    <td style="padding: 10px 14px; text-align: right; font-weight: bold; color: #ea580c; width: 150px;">Rs. ' . number_format($displayAmt, 2) . $netHtml . '</td>
                </tr>';
            }
        } else {
            $summaryRowsHtml = '
            <tr>
                <td colspan="4" style="padding: 20px; text-align: center; color: #64748b;">Interior Design Proposal Scope - Rs. ' . number_format($grandTotal, 2) . '</td>
            </tr>';
        }

        // Generate Inner Modules Detailed BOQ Tables (Page 4+)
        $innerModulesHtml = '';
        $customHeadings = $extra['custom_headings'] ?? $quoteData['custom_headings'] ?? [];
        if (is_string($customHeadings)) {
            $customHeadings = json_decode($customHeadings, true) ?: [];
        }
        $headerBgColor = $customHeadings['headerBgColor'] ?? ($extra['header_bg_color'] ?? '#f97316');

        if (!empty($sections)) {
            foreach ($sections as $sIdx => $sec) {
                $secName = htmlspecialchars($sec['section_name'] ?? $sec['name'] ?? ('Module ' . ($sIdx + 1)));
                $secItems = $sec['items'] ?? [];
                $secTotal = 0;
                $itemsHtml = '';
                $itemIndex = 1;

                $secId = $sec['section_id'] ?? $sec['id'] ?? '';
                $rawSecHeadings = $sec['custom_headings'] 
                    ?? ($extra['section_headings'][$secId] 
                    ?? ($extra['section_headings'][strval($secId)] 
                    ?? ($extra['section_headings'][$sIdx] 
                    ?? ($extra['section_headings'][strval($sIdx)] 
                    ?? ($extra['section_headings'][$sec['section_name'] ?? ''] 
                    ?? ($extra['section_headings'][$sec['name'] ?? ''] 
                    ?? []))))));
                if (empty($rawSecHeadings) && !empty($quoteData['section_headings'])) {
                    $qSh = is_string($quoteData['section_headings']) ? json_decode($quoteData['section_headings'], true) : $quoteData['section_headings'];
                    if (is_array($qSh)) {
                        $rawSecHeadings = $qSh[$secId] ?? ($qSh[strval($secId)] ?? ($qSh[$sIdx] ?? ($qSh[strval($sIdx)] ?? ($qSh[$sec['section_name'] ?? ''] ?? []))));
                    }
                }
                if (is_string($rawSecHeadings)) {
                    $rawSecHeadings = json_decode($rawSecHeadings, true) ?: [];
                }
                $secHeadings = array_merge($customHeadings, is_array($rawSecHeadings) ? $rawSecHeadings : []);

                $pParticulars = htmlspecialchars($secHeadings['particulars'] ?? $customHeadings['particulars'] ?? 'Product Description');
                $pShutter = !empty($secHeadings['shutterMaterial']) ? preg_replace('/\s*\|\s*/', ' |<br/>', htmlspecialchars($secHeadings['shutterMaterial'])) : (!empty($customHeadings['shutterMaterial']) ? preg_replace('/\s*\|\s*/', ' |<br/>', htmlspecialchars($customHeadings['shutterMaterial'])) : 'Shutter Material |<br/>Finish');
                $pCarcass = !empty($secHeadings['carcassMaterial']) ? preg_replace('/\s*\|\s*/', ' |<br/>', htmlspecialchars($secHeadings['carcassMaterial'])) : (!empty($customHeadings['carcassMaterial']) ? preg_replace('/\s*\|\s*/', ' |<br/>', htmlspecialchars($customHeadings['carcassMaterial'])) : 'Carcass Material |<br/>Color');
                $pDim = !empty($secHeadings['dimensions']) ? preg_replace('/\(W\s*[×x]\s*H\s*[×x]\s*D\)/i', '(W &times;<br/>H &times; D)', htmlspecialchars($secHeadings['dimensions'])) : (!empty($customHeadings['dimensions']) ? preg_replace('/\(W\s*[×x]\s*H\s*[×x]\s*D\)/i', '(W &times;<br/>H &times; D)', htmlspecialchars($customHeadings['dimensions'])) : 'Dimensions (W &times;<br/>H &times; D)');
                $pRate = htmlspecialchars($secHeadings['rate'] ?? $customHeadings['rate'] ?? 'Rate / SFT');
                $pQty = htmlspecialchars($secHeadings['qty'] ?? $customHeadings['qty'] ?? 'QTY');
                $discHeadingVal = $secHeadings['disc'] ?? ($secHeadings['discount'] ?? ($customHeadings['disc'] ?? ($customHeadings['discount'] ?? '')));
                $pDisc = !empty($discHeadingVal) ? str_replace(['%', '<br/><br/>'], ['<br/>%', '<br/>'], htmlspecialchars($discHeadingVal)) : 'Disc<br/>%';
                $gstHeadingVal = $secHeadings['gst'] ?? ($customHeadings['gst'] ?? '');
                $pGst = !empty($gstHeadingVal) ? str_replace(['%', '<br/><br/>'], ['<br/>%', '<br/>'], htmlspecialchars($gstHeadingVal)) : 'GST<br/>%';
                $pAmount = htmlspecialchars($secHeadings['amount'] ?? $customHeadings['amount'] ?? 'Amount');

                foreach ($secItems as $iIdx => $it) {
                    if (($it['brand'] ?? '') === 'HEADER') {
                        $itemIndex = 1;
                        $subTotal = 0;
                        for ($k = $iIdx + 1; $k < count($secItems); $k++) {
                            if (($secItems[$k]['brand'] ?? '') === 'HEADER') break;
                            $subQty = floatval($secItems[$k]['quantity'] ?? 1);
                            $subRate = floatval($secItems[$k]['rate_per_sft'] ?? $secItems[$k]['rate'] ?? 0);
                            $isKSubLump = ($secItems[$k]['pricing_mode'] ?? '') === 'lumpsum' || (empty($secItems[$k]['width']) && empty($secItems[$k]['height']) && empty($secItems[$k]['sft']));
                            $subBase = ($isKSubLump || $subQty == 0) ? $subRate : ($subQty * $subRate);
                            $subTotal += floatval($secItems[$k]['amount'] ?? $subBase);
                        }
                        $colSpanLeft = 1;
                        if (!$isHidden('particulars')) $colSpanLeft++;
                        if (!$isHidden('shutterMaterial')) $colSpanLeft++;
                        if (!$isHidden('carcassMaterial')) $colSpanLeft++;
                        if (!$isHidden('dimensions')) $colSpanLeft++;
                        if (!$isHidden('rate')) $colSpanLeft++;
                        if (!$isHidden('qty')) $colSpanLeft++;
                        if (!$isHidden('discount')) $colSpanLeft++;
                        if (!$isHidden('gst')) $colSpanLeft++;

                        $itemsHtml .= '
                        <tr style="background-color: #fff7ed; border-top: 1.5px solid #fed7aa; border-bottom: 2px solid #ea580c; page-break-inside: avoid; break-inside: avoid;">
                            <td colspan="' . $colSpanLeft . '" style="padding: 8px 12px; font-weight: 900; font-size: 9pt; color: #ea580c; text-transform: uppercase;">
                                ' . htmlspecialchars($it['particulars'] ?? 'Section') . '
                            </td>
                            ' . (!$isHidden('amount') ? '
                            <td style="padding: 8px 12px; text-align: right; font-weight: 900; font-size: 9pt; color: #ea580c;">
                                Rs. ' . number_format($subTotal, 2) . '
                            </td>' : '') . '
                        </tr>';
                        continue;
                    }

                    $pName = htmlspecialchars($it['particulars'] ?? $it['item_name'] ?? 'Custom Modular Work');
                    $category = trim($it['category'] ?? '');
                    $catBadge = !empty($category) ? '<span style="color: #ea580c; font-weight: bold; font-size: 7pt; margin-right: 4px; background-color: #fff7ed; padding: 1px 4px; border-radius: 3px; border: 1px solid #fed7aa;">[' . htmlspecialchars($category) . ']</span> ' : '';
                    $desc = trim($it['hsn_sac'] ?? $it['description'] ?? $it['notes'] ?? $it['specs'] ?? '');
                    $descHtml = !empty($desc) ? '<div style="font-size: 7.5pt; color: #475569; line-height: 1.35; margin-top: 3px; word-wrap: break-word;">' . nl2br(htmlspecialchars($desc)) . '</div>' : '';
                    $imgHtml = !empty($it['image_url']) ? '<img src="' . htmlspecialchars($it['image_url']) . '" style="width: 32px; height: 32px; object-fit: cover; border-radius: 3px; border: 1px solid #e2e8f0; float: left; margin-right: 6px; margin-bottom: 2px;" />' : '';

                    // Shutter Material | Finish
                    $shutter = htmlspecialchars($it['shutter_material'] ?? $it['shutterMaterial'] ?? (!empty($it['brand']) && $it['brand'] !== 'HEADER' ? $it['brand'] : '-'));

                    // Carcass Material | Color
                    $carcassVal = $it['carcass_material'] ?? $it['carcassMaterial'] ?? null;
                    if (empty($carcassVal) && !empty($it['unit'])) {
                        $u = strtoupper(trim($it['unit']));
                        if (!in_array($u, ['SFT', 'RFT', 'NOS', 'SQFT', 'MTR', 'RMT', 'LS', 'SET', 'NO'])) {
                            $carcassVal = $it['unit'];
                        }
                    }
                    $carcass = htmlspecialchars($carcassVal ?: '-');

                    // Dimensions (Width, Height, Depth stacked vertically one after the other)
                    $isLumpsum = ($it['pricing_mode'] ?? '') === 'lumpsum';
                    $lumpsumVal = floatval($it['rate'] ?? $it['amount'] ?? 0);
                    $hasDimensions = (!empty($it['width']) && $it['width'] !== '0') || (!empty($it['height']) && $it['height'] !== '0');
                    $hasOnlySft = !$hasDimensions && !empty($it['sft']) && $it['sft'] !== '0';

                    if ($hasOnlySft) {
                        $dimHtml = '<div style="font-size: 7.5pt; font-weight: 600; color: #111827; word-break: break-all;">' . htmlspecialchars($it['sft']) . ' SFT</div>';
                    } elseif ($hasDimensions) {
                        $w = htmlspecialchars($it['width'] ?? '0');
                        $h = htmlspecialchars($it['height'] ?? '0');
                        $d = htmlspecialchars(!empty($it['depth']) ? $it['depth'] : (!empty($it['sft']) ? $it['sft'] : '0'));
                        $dimHtml = '
                        <div style="line-height: 1.35; font-size: 7.5pt; color: #111827; font-weight: 600; text-align: left; word-break: break-all;">
                            <div>Width: ' . $w . '</div>
                            <div>Height: ' . $h . '</div>
                            <div>Depth: ' . $d . '</div>
                        </div>';
                    } elseif ($isLumpsum) {
                        $dimHtml = '<span style="color: #16a34a; font-weight: bold; font-size: 7.5pt; word-break: break-all;">Lumpsum: Rs. ' . number_format($lumpsumVal, 2) . '</span>';
                    } else {
                        $dimHtml = '-';
                    }

                    // Rate / SFT
                    $rate = floatval($it['rate_per_sft'] ?? $it['rate'] ?? 0);
                    $rateText = $isLumpsum ? '—' : ($rate > 0 ? number_format($rate) : '—');

                    // QTY
                    $qty = floatval($it['quantity'] ?? 1);
                    $qtyFormatted = (fmod($qty, 1.0) == 0.0) ? strval((int)$qty) : strval(round($qty, 2));
                    $qtyText = ($qty > 0) ? $qtyFormatted : ($isLumpsum ? '—' : '1');

                    // Disc %
                    $disc = floatval($it['discount_percent'] ?? 0);
                    $discFormatted = (fmod($disc, 1.0) == 0.0) ? strval((int)$disc) : strval(round($disc, 2));
                    $discText = $discFormatted . '%';

                    // GST %
                    $gst = (isset($it['gst_rate']) && $it['gst_rate'] !== '' && $it['gst_rate'] !== null) ? floatval($it['gst_rate']) : floatval($extra['overall_gst_rate'] ?? 0);
                    $gstFormatted = (fmod($gst, 1.0) == 0.0) ? strval((int)$gst) : strval(round($gst, 2));
                    $gstText = $gstFormatted . '%';

                    // Amount
                    $amt = floatval($it['amount'] ?? ($qty * $rate));
                    $secTotal += $amt;
                    $amtText = number_format($amt);

                    // Log item data
                    error_log("SimplePdfBuilder item BOQ data: " . json_encode([
                        'particulars' => $pName,
                        'desc' => $desc,
                        'shutter' => $shutter,
                        'carcass' => $carcass,
                        'w' => $it['width'] ?? null,
                        'h' => $it['height'] ?? null,
                        'sft' => $it['sft'] ?? null,
                        'rate' => $rate,
                        'qty' => $qty,
                        'disc' => $disc,
                        'gst' => $gst,
                        'amt' => $amt
                    ]));

                    $rowBg = ($itemIndex % 2 === 0) ? '#fffdfa' : '#ffffff';

                    $itemsHtml .= '
                    <tr style="background-color: ' . $rowBg . '; page-break-inside: avoid; break-inside: avoid;">
                        <td style="padding: 9px 4px; text-align: center; vertical-align: middle; width: 3%; font-weight: 800; color: #f97316; font-size: 8.5pt; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; white-space: nowrap;">' . $itemIndex++ . '</td>
                        ' . (!$isHidden('particulars') ? '
                        <td style="padding: 9px 8px; vertical-align: middle; text-align: left; width: 22%; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; word-break: break-word;">
                            ' . $imgHtml . '
                            ' . $catBadge . '
                            <div style="font-weight: 800; color: #0f172a; font-size: 8pt; line-height: 1.25; text-transform: uppercase;">' . $pName . '</div>
                            ' . $descHtml . '
                        </td>' : '') . '
                        ' . (!$isHidden('shutterMaterial') ? '<td style="padding: 9px 8px; vertical-align: middle; text-align: left; font-size: 8pt; color: #475569; font-weight: 500; width: 14%; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; word-break: break-word; line-height: 1.3;">' . $shutter . '</td>' : '') . '
                        ' . (!$isHidden('carcassMaterial') ? '<td style="padding: 9px 8px; vertical-align: middle; text-align: left; font-size: 8pt; color: #475569; font-weight: 500; width: 14%; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; word-break: break-word; line-height: 1.3;">' . $carcass . '</td>' : '') . '
                        ' . (!$isHidden('dimensions') ? '<td style="padding: 8px 6px; vertical-align: middle; text-align: left; width: 13%; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0;">' . $dimHtml . '</td>' : '') . '
                        ' . (!$isHidden('rate') ? '<td style="padding: 9px 6px; vertical-align: middle; text-align: right; font-size: 8pt; color: #334155; font-weight: 600; width: 9%; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; white-space: nowrap;">' . $rateText . '</td>' : '') . '
                        ' . (!$isHidden('qty') ? '<td style="padding: 9px 4px; vertical-align: middle; text-align: center; font-size: 8pt; color: #334155; font-weight: 600; width: 5%; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; white-space: nowrap;">' . $qtyText . '</td>' : '') . '
                        ' . (!$isHidden('discount') ? '<td style="padding: 9px 4px; vertical-align: middle; text-align: center; font-size: 8pt; color: #ea580c; font-weight: 700; width: 5.5%; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; white-space: nowrap;">' . $discText . '</td>' : '') . '
                        ' . (!$isHidden('gst') ? '<td style="padding: 9px 4px; vertical-align: middle; text-align: center; font-size: 8pt; color: #64748b; font-weight: 500; width: 5%; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; white-space: nowrap;">' . $gstText . '</td>' : '') . '
                        ' . (!$isHidden('amount') ? '<td style="padding: 9px 8px; vertical-align: middle; text-align: right; font-weight: 800; font-size: 8.5pt; color: #ea580c; width: 9.5%; border-bottom: 1px solid #e2e8f0; white-space: nowrap;">' . $amtText . '</td>' : '') . '
                    </tr>';
                }

                $colSpanLeft = 1;
                if (!$isHidden('particulars')) $colSpanLeft++;
                if (!$isHidden('shutterMaterial')) $colSpanLeft++;
                if (!$isHidden('carcassMaterial')) $colSpanLeft++;
                if (!$isHidden('dimensions')) $colSpanLeft++;
                if (!$isHidden('rate')) $colSpanLeft++;
                if (!$isHidden('qty')) $colSpanLeft++;
                if (!$isHidden('discount')) $colSpanLeft++;
                if (!$isHidden('gst')) $colSpanLeft++;

                $innerModulesHtml .= '
                <div style="margin-bottom: 24px; page-break-inside: auto; break-inside: auto;">
                    <table style="width: 100%; border-collapse: collapse; background-color: #fff7ed; border: 1.5px solid #fed7aa; border-radius: 8px; margin-bottom: 8px;">
                        <tr>
                            <td style="padding: 9px 14px; font-size: 10.5pt; font-weight: 900; color: #0f172a; text-transform: uppercase;">
                                Module ' . ($sIdx + 1) . ': ' . $secName . '
                            </td>
                            ' . (!$isHidden('amount') ? '
                            <td style="padding: 9px 14px; text-align: right; font-size: 11pt; font-weight: 900; color: #ea580c;">
                                ₹ ' . number_format($secTotal) . '
                            </td>' : '') . '
                        </tr>
                    </table>
                    <table style="width: 100%; border-collapse: collapse; table-layout: fixed; border: 1.5px solid #fed7aa; margin-bottom: 16px; background-color: #ffffff;">
                        <thead>
                            <tr style="background-color: ' . htmlspecialchars($headerBgColor) . '; color: #ffffff;">
                                <th style="padding: 9px 2px; text-align: center; vertical-align: middle; width: 3%; font-size: 8pt; font-weight: 700; color: #ffffff; white-space: nowrap;">#</th>
                                ' . (!$isHidden('particulars') ? '<th style="padding: 9px 8px; text-align: left; vertical-align: middle; width: 22%; font-size: 8pt; font-weight: 700; color: #ffffff; word-break: break-word;">' . $pParticulars . '</th>' : '') . '
                                ' . (!$isHidden('shutterMaterial') ? '<th style="padding: 9px 6px; text-align: left; vertical-align: middle; font-size: 8pt; font-weight: 700; color: #ffffff; width: 14%; word-break: break-word; line-height: 1.25;">' . $pShutter . '</th>' : '') . '
                                ' . (!$isHidden('carcassMaterial') ? '<th style="padding: 9px 6px; text-align: left; vertical-align: middle; font-size: 8pt; font-weight: 700; color: #ffffff; width: 14%; word-break: break-word; line-height: 1.25;">' . $pCarcass . '</th>' : '') . '
                                ' . (!$isHidden('dimensions') ? '<th style="padding: 9px 6px; text-align: center; vertical-align: middle; width: 13%; font-size: 8pt; font-weight: 700; color: #ffffff; line-height: 1.25;">' . $pDim . '</th>' : '') . '
                                ' . (!$isHidden('rate') ? '<th style="padding: 9px 6px; text-align: right; vertical-align: middle; width: 9%; font-size: 8pt; font-weight: 700; color: #ffffff; width: 9%; white-space: nowrap;">' . $pRate . '</th>' : '') . '
                                ' . (!$isHidden('qty') ? '<th style="padding: 9px 4px; text-align: center; vertical-align: middle; width: 5%; font-size: 8pt; font-weight: 700; color: #ffffff; white-space: nowrap;">' . $pQty . '</th>' : '') . '
                                ' . (!$isHidden('discount') ? '<th style="padding: 9px 4px; text-align: center; vertical-align: middle; width: 5.5%; font-size: 8pt; font-weight: 700; color: #ffffff; line-height: 1.25;">' . $pDisc . '</th>' : '') . '
                                ' . (!$isHidden('gst') ? '<th style="padding: 9px 4px; text-align: center; vertical-align: middle; width: 5%; font-size: 8pt; color: #ffffff; line-height: 1.25;">' . $pGst . '</th>' : '') . '
                                ' . (!$isHidden('amount') ? '<th style="padding: 9px 8px; text-align: right; vertical-align: middle; width: 9.5%; font-size: 8pt; font-weight: 700; color: #ffffff; white-space: nowrap;">' . $pAmount . '</th>' : '') . '
                            </tr>
                        </thead>
                        <tbody>
                            ' . $itemsHtml . '
                            <tr style="background-color: #fffdf5; border-top: 1.5px solid #fed7aa; page-break-inside: avoid; break-inside: avoid;">
                                <td colspan="' . $colSpanLeft . '" style="padding: 9px 12px; text-align: right; vertical-align: middle; font-weight: 900; font-size: 8.5pt; color: #0f172a; border-right: 1px solid #fed7aa;">
                                    Module Total (' . $secName . '):
                                </td>
                                ' . (!$isHidden('amount') ? '
                                <td style="padding: 9px 8px; text-align: right; vertical-align: middle; font-weight: 900; font-size: 9.5pt; color: #ea580c; white-space: nowrap;">
                                    ₹ ' . number_format($secTotal) . '
                                </td>' : '') . '
                            </tr>
                        </tbody>
                    </table>
                </div>';
            }
        }

        $financialBreakdownHtml = '';

        $html = '<!DOCTYPE html>
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
        padding: 34px 44px 28px 44px;
        page-break-after: always;
        clear: both;
        box-sizing: border-box;
    }
    .page-wrap-last {
        padding: 34px 44px 28px 44px;
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

<!-- ========================================================== -->
<!-- PAGE 1: EXECUTIVE COVER PAGE                               -->
<!-- ========================================================== -->
<div class="page-wrap">
    <table class="header-border">
        <tr>
            <td style="width: 50%; vertical-align: middle;">
                <table style="width: 100%;">
                    <tr>
                        <td style="width: 55px; vertical-align: middle;">' . $logoHtml . '</td>
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
                    Visakhapatnam, Andhra Pradesh - 530020<br>
                    Phone: +91 7702312351 | Email: contact@livincart.com<br>
                    Website: www.livincart.com
                </div>
            </td>
        </tr>
    </table>

    <div style="height: 170px;">&nbsp;</div>

    <!-- Center Hero Title -->
    <div style="text-align: center; width: 100%;">
        ' . $heroLogoHtml . '
        <div style="font-size: 13.5pt; font-weight: 900; color: #000000; letter-spacing: 0.5px; margin-bottom: 6px;">
            LIVINCART AND SERVICES PRIVATE LIMITED
        </div>
        <div style="width: 160px; height: 0px; border-bottom: 3.5px solid #ea580c; margin: 0 auto 20px auto;"></div>

        <div style="font-size: 23pt; font-weight: 900; color: #000000; letter-spacing: 0.5px;">
            OFFICIAL QUOTATION &amp;
        </div>
        <div style="font-size: 25pt; font-weight: 900; color: #ea580c; letter-spacing: 0.5px; margin-top: 4px;">
            PROJECT ESTIMATE ' . ($isFinalVersion ? '(FINAL VERSION)' : '') . '
        </div>
        <div style="width: 200px; height: 0px; border-bottom: 3.5px solid #ea580c; margin: 16px auto 26px auto;"></div>

        <!-- Quote Details Box -->
        <table style="width: 380px; margin: 0 auto; border: 2px solid #ea580c; border-radius: 16px; background-color: #ffffff;">
            <tr>
                <td style="width: 50%; padding: 12px 18px; text-align: center; border-right: 1.5px solid #fed7aa;">
                    <div style="font-size: 8pt; color: #64748b; font-weight: bold; text-transform: uppercase;">Quote No.</div>
                    <div style="font-size: 11pt; font-weight: 900; color: #000000; margin-top: 2px;">' . htmlspecialchars($quoteNumber) . '</div>
                </td>
                <td style="width: 50%; padding: 12px 18px; text-align: center;">
                    <div style="font-size: 8pt; color: #64748b; font-weight: bold; text-transform: uppercase;">Date</div>
                    <div style="font-size: 11pt; font-weight: 900; color: #000000; margin-top: 2px;">' . $createdAt . '</div>
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

<!-- ========================================================== -->
<!-- PAGE 2: PROJECT INFORMATION & SCOPE DETAILS                 -->
<!-- ========================================================== -->
<div class="page-wrap">
    <table class="header-border">
        <tr>
            <td style="width: 50%; vertical-align: middle;">
                <table style="width: 100%;">
                    <tr>
                        <td style="width: 55px; vertical-align: middle;">' . $logoHtml . '</td>
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
                    Visakhapatnam, Andhra Pradesh - 530020<br>
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
                    <div style="font-size: 13pt; font-weight: 900; color: #ea580c;">' . htmlspecialchars($clientName) . '</div>
                </td>
                <td style="width: 33.3%; border-right: 1.5px dashed #cbd5e1; padding-left: 14px; padding-right: 14px; vertical-align: top;">
                    <div style="font-size: 9pt; color: #64748b; font-weight: bold; margin-bottom: 4px;">Project ID:</div>
                    <div style="font-size: 13pt; font-weight: 900; color: #ea580c;">' . htmlspecialchars($projectId) . '</div>
                </td>
                <td style="width: 33.3%; padding-left: 14px; vertical-align: top;">
                    <div style="font-size: 9pt; color: #64748b; font-weight: bold; margin-bottom: 4px;">Proposal Created on:</div>
                    <div style="font-size: 13pt; font-weight: 900; color: #ea580c;">' . $createdAt . '</div>
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
                    <div style="font-size: 11pt; font-weight: 900; color: #0f172a;">-</div>
                </td>
                <td style="width: 33.3%; border-right: 1.5px dashed #cbd5e1; padding-left: 14px; padding-right: 14px; vertical-align: top;">
                    <div style="font-size: 9pt; color: #64748b; font-weight: bold; margin-bottom: 4px;">Sales Manager Phone:</div>
                    <div style="font-size: 11pt; font-weight: 900; color: #0f172a;">-</div>
                </td>
                <td style="width: 33.3%; padding-left: 14px; vertical-align: top;">
                    <div style="font-size: 9pt; color: #64748b; font-weight: bold; margin-bottom: 4px;">Sales Manager Email:</div>
                    <div style="font-size: 11pt; font-weight: 900; color: #0f172a;">-</div>
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

<!-- ========================================================== -->
<!-- PAGE 3: MODULES SUMMARY & FINANCIAL RECAP                  -->
<!-- ========================================================== -->
<div class="page-wrap">
    <table class="header-border">
        <tr>
            <td style="width: 50%; vertical-align: middle;">
                <table style="width: 100%;">
                    <tr>
                        <td style="width: 55px; vertical-align: middle;">' . $logoHtml . '</td>
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
            Modules Summary - Commercial Estimate - Version ' . $versionNum . '
        </h3>
    </div>

    <!-- DEBUG: flat_discount=' . json_encode($rawFlat) . ', applied_coupon=' . json_encode($coupon) . ', additional_charges=' . json_encode($addCharges) . ' | CALCULATED: flatDiscountAmt=' . $flatDiscountAmt . ', couponDiscountAmt=' . $couponDiscountAmt . ', addChargesAmt=' . $addChargesAmt . ' -->
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
            ' . $summaryRowsHtml . '

            <!-- 1) Gross Total -->
            <tr style="border-top: 2px solid #fed7aa; background-color: #fffaf0;">
                <td colspan="3" style="padding: 10px 14px; font-weight: bold; text-align: right; color: #111827;">Total Modules Gross Amount</td>
                <td style="padding: 10px 14px; text-align: right; font-weight: 900; color: #ea580c; font-size: 10.5pt;">Rs. ' . number_format($grandTotal, 2) . '</td>
            </tr>

            <!-- 2) Total Discount Amount (Replaces category-wise breakdown) -->
            ' . ((!$isHidden('categoryDiscount') || !$isHidden('flatDiscount') || !$isHidden('generalDiscount')) ? (
                $totalDiscountAmt > 0 ? '
                <tr style="border-top: 1px dashed #fed7aa; background-color: #fff7ed;">
                    <td colspan="3" style="padding: 8px 14px; text-align: right; font-weight: bold; color: #c2410c;">Total Discount:</td>
                    <td style="padding: 8px 14px; text-align: right; font-weight: bold; color: #c2410c;">- Rs. ' . number_format($totalDiscountAmt, 2) . '</td>
                </tr>' : '
                <tr style="border-top: 1px dashed #fed7aa; background-color: #fff7ed;">
                    <td colspan="3" style="padding: 8px 14px; text-align: right; font-weight: bold; color: #c2410c;">Total Discount:</td>
                    <td style="padding: 8px 14px; text-align: right; font-weight: bold; color: #94a3b8;">-</td>
                </tr>'
            ) : '') . '

            <!-- 5) Additional Charges -->
            ' . (!$isHidden('additionalCharges') && $addChargesAmt > 0 ? '
            <tr style="border-top: 1px dashed #fed7aa; background-color: #fff7ed;">
                <td colspan="3" style="padding: 8px 14px; text-align: right; font-weight: bold; color: #475569;">Additional Charges:</td>
                <td style="padding: 8px 14px; text-align: right; font-weight: bold; color: #0f172a;">+ Rs. ' . number_format($addChargesAmt, 2) . '</td>
            </tr>' . ($addChargesGstAmt > 0 ? '
            <tr style="background-color: #fff7ed;">
                <td colspan="3" style="padding: 4px 14px 8px; text-align: right; font-weight: bold; color: #ea580c; font-size: 8.5pt;">Additional Charges GST (' . $chargesGstRate . '%):</td>
                <td style="padding: 4px 14px 8px; text-align: right; font-weight: bold; color: #ea580c; font-size: 9.5pt;">+ Rs. ' . number_format($addChargesGstAmt, 2) . '</td>
            </tr>' : '') : '') . '

            <!-- 6) GST (Respecting Hide GST Line toggle & Splitwise type) -->
            ' . ($overallGstEnabled && !$overallGstLineHidden && $gstAmount > 0 ? (
                $gstSplitType === 'intra' ? '
                <tr style="border-top: 1px dashed #fed7aa; background-color: #fff7ed;">
                    <td colspan="3" style="padding: 8px 14px; text-align: right; font-weight: bold; color: #16a34a;">CGST (' . number_format($gstRate / 2, 1) . '%):</td>
                    <td style="padding: 8px 14px; text-align: right; font-weight: bold; color: #16a34a;">+ Rs. ' . number_format(round($gstAmount / 2), 2) . '</td>
                </tr>
                <tr style="border-top: 1px dashed #fed7aa; background-color: #fff7ed;">
                    <td colspan="3" style="padding: 8px 14px; text-align: right; font-weight: bold; color: #16a34a;">SGST (' . number_format($gstRate / 2, 1) . '%):</td>
                    <td style="padding: 8px 14px; text-align: right; font-weight: bold; color: #16a34a;">+ Rs. ' . number_format($gstAmount - round($gstAmount / 2), 2) . '</td>
                </tr>' : '
                <tr style="border-top: 1px dashed #fed7aa; background-color: #fff7ed;">
                    <td colspan="3" style="padding: 8px 14px; text-align: right; font-weight: bold; color: #16a34a;">IGST (' . $gstRate . '%):</td>
                    <td style="padding: 8px 14px; text-align: right; font-weight: bold; color: #16a34a;">+ Rs. ' . number_format($gstAmount, 2) . '</td>
                </tr>'
            ) : '') . '

            <!-- 7) Round Off Adjustment -->
            ' . (($roundOffEnabled || abs($roundOffAdj) > 0.001) && !$isHidden('roundOff') ? '
            <tr style="border-top: 1px dashed #fed7aa; background-color: #fff7ed;">
                <td colspan="3" style="padding: 8px 14px; text-align: right; font-weight: bold; color: #64748b;">Round Off Adjustment:</td>
                <td style="padding: 8px 14px; text-align: right; font-weight: bold; color: ' . ($roundOffAdj >= 0 ? '#16a34a' : '#dc2626') . ';">' . ($roundOffAdj >= 0 ? '+ Rs. ' : '- Rs. ') . number_format(abs($roundOffAdj), 2) . '</td>
            </tr>' : '') . '

            <!-- 8) Final Net Payable Total -->
            <tr style="border-top: 2.5px solid #ea580c; background-color: #fff1f2;">
                <td colspan="3" style="padding: 12px 14px; font-weight: 900; text-align: right; font-size: 11pt; color: #0f172a;">Final Amount (Net Payable Total)</td>
                <td style="padding: 12px 14px; text-align: right; font-weight: 900; color: #16a34a; font-size: 12.5pt;">Rs. ' . number_format($finalTotal, 2) . '</td>
            </tr>
        </tbody>
    </table>

    <!-- Amount in Words -->
    <div style="padding: 14px 18px; background-color: #fffaf0; border-radius: 8px; border: 1px solid #fed7aa;">
        <div style="font-size: 8pt; font-weight: bold; color: #64748b; text-transform: uppercase; margin-bottom: 3px;">Total Amount In Words</div>
        <div style="font-size: 11pt; font-weight: 900; color: #111827;">' . self::numberToWordsIndian($finalTotal) . '</div>
    </div>
</div>

<!-- ========================================================== -->
<!-- PAGE 4+: INNER MODULES & DETAILED BOQ BREAKDOWN            -->
<!-- ========================================================== -->
<div class="' . (!$isHidden('terms') && !empty($termsList) ? 'page-wrap' : 'page-wrap-last') . '">
    <table class="header-border">
        <tr>
            <td style="width: 50%; vertical-align: middle;">
                <table style="width: 100%;">
                    <tr>
                        <td style="width: 55px; vertical-align: middle;">' . $logoHtml . '</td>
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
    ' . $innerModulesHtml . '

    <!-- Page 4 BOQ Signatures -->
    <table style="margin-top: 32px; padding-top: 14px; border-top: 1px solid #cbd5e1; page-break-inside: avoid;">
        <tr>
            <td style="width: 50%; vertical-align: top;">
                <div style="font-size: 9pt; font-weight: bold; color: #0c1527;">Client Signature</div>
                <div style="height: 35px;">&nbsp;</div>
                <div style="font-size: 8.5pt; color: #64748b;">' . htmlspecialchars($clientName) . '</div>
            </td>
            <td style="width: 50%; text-align: right; vertical-align: top;">
                <div style="font-size: 9pt; font-weight: bold; color: #0c1527;">Authorized Signatory</div>
                <div style="margin: 3px 0; height: 38px; text-align: right;">
                    ' . ($ownerSigBase64 ? '<img src="' . $ownerSigBase64 . '" style="height: 36px; object-fit: contain; display: inline-block;" />' : '&nbsp;') . '
                </div>
                <div style="font-size: 8.5pt; color: #64748b;">Livincart Architects &amp; Interiors</div>
            </td>
        </tr>
    </table>
</div>

<!-- ========================================================== -->
<!-- PAGE 5: DEDICATED TERMS, CONDITIONS & MATERIAL SPECS        -->
<!-- ========================================================== -->
' . (!$isHidden('terms') && !empty($termsList) ? '
<div class="page-wrap-last">
    <table class="header-border">
        <tr>
            <td style="width: 50%; vertical-align: middle;">
                <table style="width: 100%;">
                    <tr>
                        <td style="width: 55px; vertical-align: middle;">' . $logoHtml . '</td>
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
            ' . implode('', array_map(function($tIdx, $termText) {
                $termText = trim($termText);
                if (empty($termText)) return '';
                $isSubMilestone = ($tIdx >= 4 && $tIdx <= 7);
                $isSectionHeader = ($tIdx === 3);
                $subBullets = ['a.', 'b.', 'c.', 'd.'];
                $bulletLabel = $isSubMilestone ? ($subBullets[$tIdx - 4] ?? '-') : ($tIdx < 4 ? ($tIdx + 1) . '.' : ($tIdx - 3) . '.');
                $paddingLeft = $isSubMilestone ? '18px' : '0px';
                $isBold = $isSectionHeader || stripos($termText, 'Material') === 0 || stripos($termText, 'Finishes') === 0 || stripos($termText, 'Accessories') === 0 || stripos($termText, 'Warranty') === 0 || stripos($termText, 'Note') === 0 || stripos($termText, 'Payment Milestones') === 0;
                $color = $isSectionHeader ? '#ea580c' : '#334155';
                $weight = $isBold ? 'bold' : 'normal';
                
                return '<table style="width: 100%; border-collapse: collapse; margin-bottom: 4px; padding-left: ' . $paddingLeft . '; page-break-inside: avoid;">
                    <tr>
                        <td style="width: ' . ($isSubMilestone ? '36px' : '22px') . '; text-align: right; padding-right: 6px; vertical-align: top; font-weight: bold; color: #ea580c; font-size: 8pt;">' . htmlspecialchars($bulletLabel) . '</td>
                        <td style="vertical-align: top; font-size: 8pt; color: ' . $color . '; font-weight: ' . $weight . '; line-height: 1.45;">' . htmlspecialchars($termText) . '</td>
                    </tr>
                </table>';
            }, array_keys($termsList), $termsList)) . '
        </div>
    </div>

    <!-- Account Details & Signatures -->
    <table style="width: 100%; border-top: 1.5px dashed #cbd5e1; padding-top: 16px; margin-top: 16px; page-break-inside: avoid;">
        <tr>
            <td style="vertical-align: top; width: 60%;">
                <div style="font-size: 9pt; font-weight: 900; color: #0f172a;">
                    Account Name: <span style="color: #ea580c;">Livincart and services private limited</span>
                </div>
                <div style="font-size: 7.5pt; color: #64748b; margin-top: 4px;">
                    Note: Terms &amp; conditions are part of the official quotation agreement.
                </div>
            </td>
            <td style="vertical-align: top; text-align: right; width: 40%;">
                <div style="font-size: 8.5pt; color: #64748b; font-weight: 600;">Authorized Signature</div>
                <div style="margin: 3px 0; height: 40px; text-align: right;">
                    ' . ($ownerSigBase64 ? '<img src="' . $ownerSigBase64 . '" style="height: 38px; object-fit: contain; display: inline-block;" />' : '&nbsp;') . '
                </div>
                <div style="font-size: 9.5pt; font-weight: 900; color: #0f172a;">Livincart &amp; Services Pvt Ltd</div>
            </td>
        </tr>
    </table>
</div>' : '') . '

</body>
</html>';

        return $html;
    }

    /**
     * Generate complete 4-page quotation PDF binary using Dompdf.
     */
    public static function generateQuotePdfBinary($quoteData) {
        require_once __DIR__ . '/../libs/dompdf/autoload.inc.php';
        $html = self::buildPdfHtml($quoteData);

        $options = new \Dompdf\Options();
        $options->set('isHtml5ParserEnabled', true);
        $options->set('isRemoteEnabled', true);
        $options->set('defaultFont', 'DejaVu Sans');
        $options->set('dpi', 96);

        $dompdf = new \Dompdf\Dompdf($options);
        $dompdf->loadHtml($html);
        $dompdf->setPaper('A4', 'portrait');
        $dompdf->render();

        return $dompdf->output();
    }
}
