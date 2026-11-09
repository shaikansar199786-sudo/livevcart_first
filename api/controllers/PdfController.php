<?php
// api/controllers/PdfController.php

require_once __DIR__ . '/PrintTokenHelper.php';

class PdfController {
    private $db;
    private $pdfGeneratorUrl;

    public function __construct($db) {
        $this->db = $db;
        $this->pdfGeneratorUrl = defined('PDF_GENERATOR_URL') ? PDF_GENERATOR_URL : 'http://127.0.0.1:3001';
    }

    /**
     * Generate a short-lived print token for a specific quote_id.
     */
    public function generateToken($quote_id) {
        $quote_id = intval($quote_id);
        if ($quote_id <= 0) {
            return ['success' => false, 'message' => 'Invalid quote_id'];
        }
        $token = PrintTokenHelper::generate($quote_id);
        return ['success' => true, 'token' => $token, 'ttl' => 300];
    }

    /**
     * Validate token and return quote data for PrintQuoteView.
     */
    public function getQuoteDataWithToken($quote_id, $token) {
        $quote_id = intval($quote_id);
        if ($quote_id <= 0 || empty($token)) {
            http_response_code(400);
            return ['success' => false, 'message' => 'Invalid request'];
        }

        if (!PrintTokenHelper::validate($token, $quote_id)) {
            http_response_code(401);
            return ['success' => false, 'message' => 'Invalid or expired print token'];
        }

        $data = $this->fetchQuoteFromDb($quote_id);
        if (!$data) {
            http_response_code(404);
            return ['success' => false, 'message' => 'Quote not found'];
        }

        return ['success' => true, 'data' => $data];
    }

    /**
     * Fetch full quote (with sections and items) from the database.
     */
    private function fetchQuoteFromDb($quote_id) {
        try {
            $q = $this->db->prepare("SELECT * FROM quotes WHERE quote_id = :id");
            $q->execute(['id' => $quote_id]);
            $quote = $q->fetch(PDO::FETCH_ASSOC);
            if (!$quote) return null;

            if (!empty($quote['extra_data'])) {
                $decoded = json_decode($quote['extra_data'], true);
                if (is_array($decoded)) {
                    $quote['extra_data_parsed'] = $decoded;
                    foreach ($decoded as $k => $v) {
                        if (!isset($quote[$k])) {
                            $quote[$k] = $v;
                        }
                    }
                }
            }

            $s = $this->db->prepare("SELECT * FROM quote_sections WHERE quote_id = :id ORDER BY display_order");
            $s->execute(['id' => $quote_id]);
            $sections = $s->fetchAll(PDO::FETCH_ASSOC);

            foreach ($sections as &$section) {
                $i = $this->db->prepare("SELECT * FROM quote_items WHERE section_id = :sid ORDER BY display_order");
                $i->execute(['sid' => $section['section_id']]);
                $section['items'] = $i->fetchAll(PDO::FETCH_ASSOC);
            }

            $quote['sections'] = $sections;
            return $quote;
        } catch (Exception $e) {
            error_log("PdfController::fetchQuoteFromDb error: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Generate PDF snapshot via Puppeteer and store in quotes.pdf_snapshot BLOB.
     */
    public function createAndStoreSnapshot($quote_id, $project_id = 0) {
        $quote_id = intval($quote_id);
        if ($quote_id <= 0) {
            return ['success' => false, 'message' => 'Invalid quote_id'];
        }

        $genResult = $this->generateQuotePdf($quote_id, $project_id);
        if (!$genResult['success'] || empty($genResult['pdf_base64'])) {
            return $genResult;
        }

        $pdfDataUri = $genResult['pdf_base64'];
        $base64 = strpos($pdfDataUri, ',') !== false ? explode(',', $pdfDataUri)[1] : $pdfDataUri;
        $pdfBytes = base64_decode($base64);
        $htmlSnap = $genResult['html_snapshot'] ?? null;

        try {
            // Update PDF binary BLOB snapshot
            $stmt1 = $this->db->prepare("UPDATE quotes SET pdf_snapshot = :pdf, has_snapshot = 1 WHERE quote_id = :id");
            $stmt1->bindParam(':pdf', $pdfBytes, PDO::PARAM_LOB);
            $stmt1->bindParam(':id', $quote_id, PDO::PARAM_INT);
            $stmt1->execute();

            // Update HTML layout string snapshot if present
            if (!empty($htmlSnap)) {
                $stmt2 = $this->db->prepare("UPDATE quotes SET html_snapshot = :html WHERE quote_id = :id");
                $stmt2->bindParam(':html', $htmlSnap, PDO::PARAM_STR);
                $stmt2->bindParam(':id', $quote_id, PDO::PARAM_INT);
                $stmt2->execute();
            }

            return [
                'success' => true,
                'message' => 'PDF and HTML layout snapshots created and saved permanently',
                'quote_id' => $quote_id,
                'snapshot_size' => strlen($pdfBytes)
            ];
        } catch (Exception $e) {
            error_log("PdfController::createAndStoreSnapshot error: " . $e->getMessage());
            return ['success' => false, 'message' => 'Failed to store PDF snapshot in DB: ' . $e->getMessage()];
        }
    }

    /**
     * Upload a Base64 PDF snapshot generated on client-side directly into quotes/agreements pdf_snapshot.
     */
    public function uploadBase64Snapshot($type, $id, $pdfBase64) {
        $id = intval($id);
        if ($id <= 0 || empty($pdfBase64)) {
            return ['success' => false, 'message' => 'Invalid parameters'];
        }

        $base64 = strpos($pdfBase64, ',') !== false ? explode(',', $pdfBase64)[1] : $pdfBase64;
        $pdfBytes = base64_decode($base64);

        if (!$pdfBytes) {
            return ['success' => false, 'message' => 'Invalid base64 PDF data'];
        }

        try {
            if ($type === 'agreement') {
                $stmt = $this->db->prepare("UPDATE agreements SET pdf_snapshot = :pdf, has_snapshot = 1 WHERE id = :id");
            } else {
                $stmt = $this->db->prepare("UPDATE quotes SET pdf_snapshot = :pdf, has_snapshot = 1 WHERE quote_id = :id");
            }
            $stmt->bindParam(':pdf', $pdfBytes, PDO::PARAM_LOB);
            $stmt->bindParam(':id', $id, PDO::PARAM_INT);
            $stmt->execute();

            return [
                'success' => true,
                'message' => 'Base64 PDF snapshot saved to database successfully',
                'size' => strlen($pdfBytes)
            ];
        } catch (Exception $e) {
            error_log("PdfController::uploadBase64Snapshot error: " . $e->getMessage());
            return ['success' => false, 'message' => 'Database update failed: ' . $e->getMessage()];
        }
    }

    /**
     * Get PDF bytes for Email or Download.
     * Uses stored pdf_snapshot if present (Instant, zero Puppeteer).
     * If legacy quote without snapshot, falls back to live render (and flags legacy).
     */
    public function getPdfForEmail($quote_id, $project_id = 0) {
        $quote_id = intval($quote_id);
        if ($quote_id <= 0) {
            return ['success' => false, 'message' => 'Invalid quote_id'];
        }

        // 1. Try rendering fresh PDF snapshot via Puppeteer if service on port 3001 is online
        if ($this->healthCheck()) {
            $genResult = $this->generateQuotePdf($quote_id, $project_id);
            $pdfDataUri = $genResult['pdf_base64'] ?? $genResult['pdf'] ?? '';
            if ($genResult['success'] && !empty($pdfDataUri)) {
                $genResult['pdf_base64'] = $pdfDataUri;
                $base64 = strpos($pdfDataUri, ',') !== false ? explode(',', $pdfDataUri)[1] : $pdfDataUri;
                $pdfBytes = base64_decode($base64);

                // Save refreshed PDF snapshot in DB
                try {
                    $stmt = $this->db->prepare("UPDATE quotes SET pdf_snapshot = :pdf, has_snapshot = 1 WHERE quote_id = :id");
                    $stmt->bindParam(':pdf', $pdfBytes, PDO::PARAM_LOB);
                    $stmt->bindParam(':id', $quote_id, PDO::PARAM_INT);
                    $stmt->execute();
                } catch (Exception $e) {
                    error_log("PdfController::getPdfForEmail update error: " . $e->getMessage());
                }

                return $genResult;
            }
        }

        // 2. Pure PHP 4-Page Vector Quotation Builder (Hostinger Shared Hosting & Fast Server-Side Dompdf)
        try {
            require_once __DIR__ . '/../helpers/SimplePdfBuilder.php';
            $quoteData = $this->fetchQuoteFromDb($quote_id);
            if ($quoteData) {
                $pdfBinary = SimplePdfBuilder::generateQuotePdfBinary($quoteData);
                if (!empty($pdfBinary)) {
                    // Update DB pdf_snapshot
                    try {
                        $upStmt = $this->db->prepare("UPDATE quotes SET pdf_snapshot = :pdf, has_snapshot = 1 WHERE quote_id = :id");
                        $upStmt->bindParam(':pdf', $pdfBinary, PDO::PARAM_LOB);
                        $upStmt->bindParam(':id', $quote_id, PDO::PARAM_INT);
                        $upStmt->execute();
                    } catch (Exception $e) {}

                    return [
                        'success' => true,
                        'is_fallback' => false,
                        'pdf_base64' => 'data:application/pdf;base64,' . base64_encode($pdfBinary),
                        'message' => 'Generated 4-page official quotation PDF using server-side Dompdf'
                    ];
                }
            }
        } catch (Exception $e) {
            error_log("PdfController SimplePdfBuilder generation error: " . $e->getMessage());
        }

        // 3. Fallback: Check stored pdf_snapshot in DB
        try {
            $stmt = $this->db->prepare("SELECT pdf_snapshot FROM quotes WHERE quote_id = :id");
            $stmt->execute(['id' => $quote_id]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($row && !empty($row['pdf_snapshot'])) {
                $base64 = base64_encode($row['pdf_snapshot']);
                return [
                    'success' => true,
                    'is_snapshot' => true,
                    'pdf_base64' => 'data:application/pdf;base64,' . $base64,
                    'message' => 'Retrieved stored PDF snapshot from database'
                ];
            }
        } catch (Exception $e) {
            error_log("PdfController::getPdfForEmail fetch fallback error: " . $e->getMessage());
        }

        return ['success' => false, 'message' => 'Unable to generate PDF snapshot'];
    }

    /**
     * Generate PDF using Puppeteer backend service.
     */
    public function generateQuotePdf($quote_id, $project_id) {
        $quote_id  = intval($quote_id);
        $project_id = intval($project_id);

        if ($quote_id <= 0) {
            return ['success' => false, 'message' => 'Invalid quote_id provided'];
        }

        if (!$this->healthCheck()) {
            return [
                'success' => false,
                'message' => 'PDF service (Puppeteer) is not running on port 3001. If using Hostinger Shared Hosting (without Node.js port 3001), deploy pdf-generator to Render.com and set PDF_GENERATOR_URL in api/config/database.php, or preview/save the quote in your browser to store a PDF snapshot.'
            ];
        }

        $token = PrintTokenHelper::generate($quote_id);

        $apiBase = defined('API_BASE_URL') ? API_BASE_URL : 'http://localhost/livrcart/demoark/api';

        $payload = json_encode([
            'quoteId'    => $quote_id,
            'projectId'  => $project_id,
            'token'      => $token,
            'apiBaseUrl' => $apiBase
        ]);

        $ch = curl_init($this->pdfGeneratorUrl . '/generate-pdf');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Content-Length: ' . strlen($payload)
        ]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 90);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error    = curl_error($ch);
        curl_close($ch);

        if ($error) {
            error_log("PdfController curl error: " . $error);
            return ['success' => false, 'message' => 'Failed to connect to PDF generator: ' . $error];
        }

        if ($httpCode !== 200) {
            error_log("PdfController: Puppeteer returned HTTP " . $httpCode . " — " . $response);
            return ['success' => false, 'message' => 'PDF generator returned HTTP ' . $httpCode];
        }

        $result = json_decode($response, true);

        if (!$result || !isset($result['success']) || !$result['success']) {
            $msg = $result['message'] ?? $result['error'] ?? 'Unknown error from PDF generator';
            error_log("PdfController: Puppeteer error: " . $msg);
            return ['success' => false, 'message' => $msg];
        }

        return [
            'success'       => true,
            'pdf_base64'    => $result['pdf'],
            'html_snapshot' => $result['html_snapshot'] ?? null
        ];
    }

    /**
     * Validate token and return agreement data for PrintAgreementView.
     */
    public function getAgreementDataWithToken($agreement_id, $token) {
        if (empty($agreement_id)) {
            http_response_code(400);
            return ['success' => false, 'message' => 'Invalid agreement_id'];
        }

        $data = $this->fetchAgreementFromDb($agreement_id);
        if (!$data) {
            http_response_code(404);
            return ['success' => false, 'message' => 'Agreement not found'];
        }

        return ['success' => true, 'data' => $data];
    }

    /**
     * Fetch single agreement from database (with intelligent fallbacks so PDF generation never fails).
     */
    private function fetchAgreementFromDb($agreement_id) {
        try {
            $raw_id = trim((string)$agreement_id);

            // 1. Match integer ID
            if (is_numeric($raw_id) && intval($raw_id) > 0) {
                $stmt = $this->db->prepare("SELECT * FROM agreements WHERE id = :id");
                $stmt->execute(['id' => intval($raw_id)]);
                $res = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($res) return $res;
            }

            // 2. Match ref_id or string ID
            $stmt2 = $this->db->prepare("SELECT * FROM agreements WHERE ref_id = :raw_id OR ref_id LIKE :ref_like ORDER BY id DESC LIMIT 1");
            $stmt2->execute(['raw_id' => $raw_id, 'ref_like' => '%' . $raw_id . '%']);
            $res2 = $stmt2->fetch(PDO::FETCH_ASSOC);
            if ($res2) return $res2;

            // 3. Match project_id (numeric or string)
            $cleanProjId = intval(preg_replace('/[^0-9]/', '', $raw_id));
            if ($cleanProjId > 0) {
                $stmt3 = $this->db->prepare("SELECT * FROM agreements WHERE project_id = :p_id ORDER BY id DESC LIMIT 1");
                $stmt3->execute(['p_id' => $cleanProjId]);
                $res3 = $stmt3->fetch(PDO::FETCH_ASSOC);
                if ($res3) return $res3;
            }

            // 4. Query quotes table if agreement_id corresponds to a quote or project
            if ($cleanProjId > 0 || !empty($raw_id)) {
                $cleanQId = str_replace('quote_', '', strtolower($raw_id));
                $stmt4 = $this->db->prepare("SELECT * FROM quotes WHERE quote_id = :q_id OR project_id = :p_id OR quote_number = :q_num ORDER BY quote_id DESC LIMIT 1");
                $stmt4->execute([
                    'q_id' => is_numeric($cleanQId) ? intval($cleanQId) : 0,
                    'p_id' => $cleanProjId,
                    'q_num' => $raw_id
                ]);
                $quoteRow = $stmt4->fetch(PDO::FETCH_ASSOC);
                if ($quoteRow) {
                    $cName = $quoteRow['subtitle'] ?? $quoteRow['client_name'] ?? 'Valued Client';
                    $amt = floatval($quoteRow['total_amount'] ?? 0);
                    $fmtAmt = number_format($amt, 2);

                    // Auto-upsert into agreements table so Puppeteer PDF renderer has a valid agreement row
                    $autoAg = [
                        'ref_id' => $quoteRow['quote_number'] ?? ('PR_' . ($quoteRow['project_id'] ?? time())),
                        'project_id' => $quoteRow['project_id'] ?? null,
                        'client_name' => $cName,
                        'address' => 'Visakhapatnam',
                        'contract_value' => $fmtAmt,
                        'contract_value_words' => '',
                        'date' => date('Y-m-d'),
                        'place' => 'Visakhapatnam',
                        'status' => 'Created',
                        'project_type' => 'Interior Design'
                    ];
                    $upsertId = $this->upsertAgreementData($autoAg);
                    if ($upsertId) {
                        return $this->fetchAgreementFromDb($upsertId);
                    }
                }
            }

            // 5. If agreement is not found in database, return null
            return null;
        } catch (Exception $e) {
            error_log("PdfController::fetchAgreementFromDb error: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Generate Agreement PDF via Puppeteer and store in agreements.pdf_snapshot BLOB.
     */
    public function createAndStoreAgreementSnapshot($agreement_id) {
        if (empty($agreement_id)) {
            return ['success' => false, 'message' => 'Invalid agreement_id'];
        }

        $agData = $this->fetchAgreementFromDb($agreement_id);
        $realId = $agData['id'] ?? $agreement_id;

        $genResult = $this->generateAgreementPdf($realId);
        if (!$genResult['success'] || empty($genResult['pdf_base64'])) {
            return $genResult;
        }

        $pdfDataUri = $genResult['pdf_base64'];
        $base64 = strpos($pdfDataUri, ',') !== false ? explode(',', $pdfDataUri)[1] : $pdfDataUri;
        $pdfBytes = base64_decode($base64);
        $htmlSnap = $genResult['html_snapshot'] ?? null;

        try {
            $stmt1 = $this->db->prepare("UPDATE agreements SET pdf_snapshot = :pdf, has_snapshot = 1 WHERE id = :id");
            $stmt1->bindParam(':pdf', $pdfBytes, PDO::PARAM_LOB);
            $stmt1->bindParam(':id', $realId, PDO::PARAM_INT);
            $stmt1->execute();

            if (!empty($htmlSnap)) {
                $stmt2 = $this->db->prepare("UPDATE agreements SET html_snapshot = :html WHERE id = :id");
                $stmt2->bindParam(':html', $htmlSnap, PDO::PARAM_STR);
                $stmt2->bindParam(':id', $realId, PDO::PARAM_INT);
                $stmt2->execute();
            }

            return [
                'success' => true,
                'message' => 'Agreement PDF snapshot created and saved permanently',
                'agreement_id' => $realId,
                'snapshot_size' => strlen($pdfBytes)
            ];
        } catch (Exception $e) {
            error_log("PdfController::createAndStoreAgreementSnapshot error: " . $e->getMessage());
            return ['success' => false, 'message' => 'Failed to store Agreement PDF snapshot in DB: ' . $e->getMessage()];
        }
    }

    /**
     * Upsert agreement data from UI payload if agreement doesn't exist yet in DB.
     */
    public function upsertAgreementData($agData) {
        if (empty($agData) || !is_array($agData)) return null;

        $refId = $agData['ref_id'] ?? ('PR_' . time());
        $clientName = $agData['client_name'] ?? 'Valued Client';
        $address = $agData['address'] ?? 'Visakhapatnam';
        $contractValue = $agData['contract_value'] ?? '0';
        $words = $agData['contract_value_words'] ?? '';
        $date = $agData['date'] ?? date('Y-m-d');
        $place = $agData['place'] ?? 'Visakhapatnam';
        $projectType = $agData['project_type'] ?? 'Interior Design';
        $status = $agData['status'] ?? 'Created';

        try {
            // Check if ref_id exists
            $stmt = $this->db->prepare("SELECT id FROM agreements WHERE ref_id = :ref_id LIMIT 1");
            $stmt->execute(['ref_id' => $refId]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($row) {
                $id = intval($row['id']);
                $update = "UPDATE agreements SET project_type = :pt, client_name = :cn, address = :addr, contract_value = :cv, contract_value_words = :cvw, date = :d, place = :p, status = :st WHERE id = :id";
                $this->db->prepare($update)->execute([
                    'pt' => $projectType, 'cn' => $clientName, 'addr' => $address,
                    'cv' => $contractValue, 'cvw' => $words, 'd' => $date,
                    'p' => $place, 'st' => $status, 'id' => $id
                ]);
                return $id;
            } else {
                $insert = "INSERT INTO agreements (ref_id, project_type, client_name, address, contract_value, contract_value_words, date, place, status) VALUES (:ref_id, :pt, :cn, :addr, :cv, :cvw, :d, :p, :st)";
                $this->db->prepare($insert)->execute([
                    'ref_id' => $refId, 'pt' => $projectType, 'cn' => $clientName,
                    'addr' => $address, 'cv' => $contractValue, 'cvw' => $words,
                    'd' => $date, 'p' => $place, 'st' => $status
                ]);
                return intval($this->db->lastInsertId());
            }
        } catch (Exception $e) {
            file_put_contents('debug_agreement_pdf.log', "[" . date('Y-m-d H:i:s') . "] UPSERT ERROR: " . $e->getMessage() . "\n", FILE_APPEND);
            return null;
        }
    }

    /**
     * Get Agreement PDF for Email/View (uses stored BLOB snapshot if available; fallback to Puppeteer).
     */
    public function getAgreementPdfForEmail($agreement_id, $agreement_data = null) {
        $logStr = "[" . date('Y-m-d H:i:s') . "] getAgreementPdfForEmail called with ID: " . json_encode($agreement_id) . "\n";
        file_put_contents('debug_agreement_pdf.log', $logStr, FILE_APPEND);

        if (!empty($agreement_data) && is_array($agreement_data)) {
            $upsertedId = $this->upsertAgreementData($agreement_data);
            if ($upsertedId) {
                $agreement_id = $upsertedId;
                file_put_contents('debug_agreement_pdf.log', "[" . date('Y-m-d H:i:s') . "] Upserted agreement to DB ID: $agreement_id\n", FILE_APPEND);
            }
        }

        $agData = $this->fetchAgreementFromDb($agreement_id);
        if (!$agData && !empty($agreement_data) && is_array($agreement_data)) {
            $agData = $agreement_data;
            if (empty($agData['id'])) {
                $agData['id'] = $this->upsertAgreementData($agreement_data) ?: 1;
            }
        }

        if (!$agData) {
            file_put_contents('debug_agreement_pdf.log', "[" . date('Y-m-d H:i:s') . "] ERROR: Agreement not found for ID: " . json_encode($agreement_id) . "\n", FILE_APPEND);
            return ['success' => false, 'message' => 'Agreement not found'];
        }

        $realId = $agData['id'];

        // 1. Render fresh PDF snapshot via Puppeteer with latest CSS & contract templates
        $genResult = $this->generateAgreementPdf($realId);

        if ($genResult['success'] && !empty($genResult['pdf_base64'])) {
            $pdfDataUri = $genResult['pdf_base64'];
            $base64 = strpos($pdfDataUri, ',') !== false ? explode(',', $pdfDataUri)[1] : $pdfDataUri;
            $pdfBytes = base64_decode($base64);

            try {
                $stmt = $this->db->prepare("UPDATE agreements SET pdf_snapshot = :pdf, has_snapshot = 1 WHERE id = :id");
                $stmt->bindParam(':pdf', $pdfBytes, PDO::PARAM_LOB);
                $stmt->bindParam(':id', $realId, PDO::PARAM_INT);
                $stmt->execute();
            } catch (Exception $e) {
                file_put_contents('debug_agreement_pdf.log', "[" . date('Y-m-d H:i:s') . "] Snapshot update error: " . $e->getMessage() . "\n", FILE_APPEND);
            }
            return $genResult;
        }

        // 2. Fallback to stored DB BLOB snapshot only if Puppeteer service is offline
        if (!empty($agData['pdf_snapshot'])) {
            return [
                'success' => true,
                'is_snapshot' => true,
                'pdf_base64' => 'data:application/pdf;base64,' . base64_encode($agData['pdf_snapshot']),
                'message' => 'Retrieved stored PDF snapshot from database'
            ];
        }

        return $genResult;
    }

    /**
     * Generate Agreement PDF using Puppeteer backend service.
     */
    public function generateAgreementPdf($agreement_id) {
        $agreement_id = intval($agreement_id);
        if ($agreement_id <= 0) {
            return ['success' => false, 'message' => 'Invalid agreement_id provided'];
        }

        if (!$this->healthCheck()) {
            return [
                'success' => false,
                'message' => 'PDF service (Puppeteer) is not running on port 3001. If using Hostinger Shared Hosting (without Node.js port 3001), deploy pdf-generator to Render.com and set PDF_GENERATOR_URL in api/config/database.php, or preview/save the agreement in your browser to store a PDF snapshot.'
            ];
        }

        $token = PrintTokenHelper::generate($agreement_id);
        $apiBase = defined('API_BASE_URL') ? API_BASE_URL : 'http://localhost/livrcart/demoark/api';

        $payload = json_encode([
            'agreementId' => $agreement_id,
            'token'       => $token,
            'apiBaseUrl'  => $apiBase
        ]);

        $ch = curl_init($this->pdfGeneratorUrl . '/generate-agreement-pdf');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Content-Length: ' . strlen($payload)
        ]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 90);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error    = curl_error($ch);
        curl_close($ch);

        if ($error) {
            return ['success' => false, 'message' => 'Failed to connect to PDF generator: ' . $error];
        }

        if ($httpCode !== 200) {
            return ['success' => false, 'message' => 'PDF generator returned HTTP ' . $httpCode];
        }

        $result = json_decode($response, true);
        if (!$result || !isset($result['success']) || !$result['success']) {
            $msg = $result['message'] ?? $result['error'] ?? 'Unknown error from PDF generator';
            return ['success' => false, 'message' => $msg];
        }

        return [
            'success'       => true,
            'pdf_base64'    => $result['pdf'],
            'html_snapshot' => $result['html_snapshot'] ?? null
        ];
    }

    /**
     * Merge multiple Base64 PDF buffers into a single combined Base64 PDF using Node service.
     */
    public function mergePdfs($pdfBase64Array) {
        if (!is_array($pdfBase64Array) || count($pdfBase64Array) === 0) {
            return ['success' => false, 'message' => 'No PDFs provided for merging'];
        }

        if (count($pdfBase64Array) === 1) {
            return ['success' => true, 'pdf_base64' => $pdfBase64Array[0]];
        }

        if (!$this->healthCheck()) {
            // Fallback: If Puppeteer node service is offline (e.g. on shared host without port 3001),
            // return the primary agreement/quote PDF instead of failing completely.
            return ['success' => true, 'pdf_base64' => $pdfBase64Array[0], 'fallback' => true];
        }

        $payload = json_encode(['pdfs' => $pdfBase64Array]);

        $ch = curl_init($this->pdfGeneratorUrl . '/merge-pdfs');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Content-Length: ' . strlen($payload)
        ]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 90);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error    = curl_error($ch);
        curl_close($ch);

        if ($error) {
            return ['success' => false, 'message' => 'Merge service error: ' . $error];
        }

        if ($httpCode !== 200) {
            return ['success' => false, 'message' => 'Merge service HTTP ' . $httpCode];
        }

        $result = json_decode($response, true);
        if (!$result || !isset($result['success']) || !$result['success']) {
            $msg = $result['message'] ?? $result['error'] ?? 'Unknown error merging PDFs';
            return ['success' => false, 'message' => $msg];
        }

        return [
            'success'    => true,
            'pdf_base64' => $result['pdf']
        ];
    }

    /**
     * Generate MOM PDF using Puppeteer backend service, or fallback to pure PHP Dompdf (for Hostinger).
     */
    public function generateMomPdf($project_id, $type = null) {
        $project_id = intval(preg_replace('/\D/', '', strval($project_id)));
        if ($project_id <= 0) {
            return ['success' => false, 'message' => 'Invalid project_id provided'];
        }

        // If Puppeteer healthcheck fails (e.g. Hostinger shared hosting without port 3001), use pure PHP Dompdf
        if (!$this->healthCheck()) {
            return $this->generateMomPdfWithDompdf($project_id, $type);
        }

        $token = PrintTokenHelper::generate($project_id);
        $apiBase = defined('API_BASE_URL') ? API_BASE_URL : 'http://localhost/livrcart/demoark/api';

        $payloadData = [
            'projectId' => $project_id,
            'token'     => $token,
            'apiBaseUrl'=> $apiBase
        ];
        if (!empty($type)) {
            $payloadData['type'] = $type;
        }

        $payload = json_encode($payloadData);

        $ch = curl_init($this->pdfGeneratorUrl . '/generate-mom-pdf');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Content-Length: ' . strlen($payload)
        ]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 90);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error    = curl_error($ch);
        curl_close($ch);

        if ($error || $httpCode !== 200) {
            // Puppeteer call failed; seamlessly fallback to pure PHP Dompdf
            return $this->generateMomPdfWithDompdf($project_id, $type);
        }

        $result = json_decode($response, true);
        if (!$result || !isset($result['success']) || !$result['success']) {
            return $this->generateMomPdfWithDompdf($project_id, $type);
        }

        return [
            'success'       => true,
            'pdf_base64'    => $result['pdf'],
            'html_snapshot' => $result['html_snapshot'] ?? null
        ];
    }

    /**
     * Pure PHP Dompdf generation for MOM PDF (Zero dependency on Node.js / Port 3001, fully Hostinger compatible).
     */
    public function generateMomPdfWithDompdf($project_id, $type = null) {
        $project_id = intval($project_id);
        if ($project_id <= 0) {
            return ['success' => false, 'message' => 'Invalid project_id provided'];
        }

        try {
            // 1. Fetch project and client
            $p_query = "SELECT p.*, c.name as client_name, c.phone as client_phone, c.address as client_address, c.email as client_email, u.name as project_head_name 
                        FROM projects p 
                        LEFT JOIN clients c ON p.client_id = c.client_id 
                        LEFT JOIN users u ON p.project_head_id = u.user_id 
                        WHERE p.project_id = :id";
            $p_stmt = $this->db->prepare($p_query);
            $p_stmt->execute(['id' => $project_id]);
            $project = $p_stmt->fetch(PDO::FETCH_ASSOC);

            if (!$project) {
                return ['success' => false, 'message' => 'Project not found'];
            }

            // 2. Fetch stage notes from JSON storage
            $notesDir = __DIR__ . '/../uploads/timelines';
            $file = "$notesDir/stage_notes_$project_id.json";
            $allNotes = file_exists($file) ? json_decode(file_get_contents($file), true) : [];

            $activeStageNotes = [];
            $designerActiveNote = '';
            $pmActiveNote = '';

            if (is_array($allNotes)) {
                foreach ($allNotes as $n) {
                    if (!empty($n['deleted']) || !empty($n['isDeleted'])) continue;
                    if (($n['category'] ?? '') === 'timeline_active_note_designer') {
                        if ($type !== 'pm') $designerActiveNote = $n['note'] ?? '';
                        continue;
                    }
                    if (($n['category'] ?? '') === 'timeline_active_note_pm') {
                        if ($type !== 'designer') $pmActiveNote = $n['note'] ?? '';
                        continue;
                    }
                    if ($type === 'designer' && !empty($n['source']) && $n['source'] !== 'designer') continue;
                    if ($type === 'pm' && !empty($n['source']) && $n['source'] !== 'pm') continue;
                    $activeStageNotes[] = $n;
                }
            }

            // 3. Logo Base64
            $logoPath = __DIR__ . '/../../frontend/src/assets/1.png';
            $logoBase64 = file_exists($logoPath) ? 'data:image/png;base64,' . base64_encode(file_get_contents($logoPath)) : '';

            $projectCode = !empty($project['project_code']) ? $project['project_code'] : ('DC-' . $project_id);
            $clientName = !empty($project['client_name']) ? $project['client_name'] : 'Valued Client';
            $projectName = !empty($project['project_name']) ? $project['project_name'] : 'Project';
            $savedDate = date('d M Y');

            // High quality clean SVG icons
            $icPin = '<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMiIgaGVpZ2h0PSIxMiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNlYTU4MGMiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMjEgMTBjMCA3LTkgMTMtOSAxM3MtOS02LTktMTNhOSA5IDAgMSAxIDE4IDB6Ii8+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMCIgcj0iMyIvPjwvc3ZnPg==" width="12" height="12" style="vertical-align: middle; margin-right: 3px;" />';
            $icPhone = '<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMiIgaGVpZ2h0PSIxMiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNlYTU4MGMiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMjIgMTYuOTJ2M2EyIDIgMCAwIDEtMi4xOCAyIDE5Ljc5IDE5Ljc5IDAgMCAxLTguNjMtMy4wNyAxOS41IDE5LjUgMCAwIDEtNi02IDE5Ljc5IDE5Ljc5IDAgMCAxLTMuMDctOC42N0EyIDIgMCAwIDEgNC4xMSAyaDNhMiAyIDAgMCAxIDIgMS43MiAxMi44NCAxMi44NCAwIDAgMCAuNyAyLjgxIDIgMiAwIDAgMS0uNDUgMi4xMUw4LjA5IDkuOTFhMTYgMTYgMCAwIDAgNiA2bDEuMjctMS4yN2EyIDIgMCAwIDEgMi4xMS0uNDUgMTIuODQgMTIuODQgMCAwIDAgMi44MS43QTIgMiAwIDAgMSAyMiAxNi45MnoiLz48L3N2Zz4=" width="12" height="12" style="vertical-align: middle; margin-right: 3px;" />';
            $icEmail = '<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMiIgaGVpZ2h0PSIxMiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNlYTU4MGMiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNNCA0aDE2YzEuMSAwIDIgLjkgMiAydjEyYzAgMS4xLS45IDItMiAySDRjLTEuMSAwLTItLjktMi0yVjZjMC0xLjEuOS0yIDItMnoiLz48cG9seWxpbmUgcG9pbnRzPSIyMiw2 IDEyLDEzIDIsNiIvPjwvc3ZnPg==" width="12" height="12" style="vertical-align: middle; margin-right: 3px;" />';
            $icGlobe = '<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMiIgaGVpZ2h0PSIxMiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMwMjg0YzciIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMCIvPjxsaW5lIHgxPSIyIiB5MT0iMTIiIHgyPSIyMiIgeTI9IjEyIi8+PHBhdGggZD0iTTEyIDJhMTUuMyAxNS4zIDAgMCAxIDQgMTAgMTUuMyAxNS4zIDAgMCAxLTQgMTAgMTUuMyAxNS4zIDAgMCAxLTQtMTAgMTUuMyAxNS4zIDAgMCAxIDQtMTB6Ii8+PC9zdmc+" width="12" height="12" style="vertical-align: middle; margin-right: 3px;" />';

            $icPinW = '<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMiIgaGVpZ2h0PSIxMiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmZmZmYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMjEgMTBjMCA3LTkgMTMtOSAxM3MtOS02LTktMTNhOSA5IDAgMSAxIDE4IDB6Ii8+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMCIgcj0iMyIvPjwvc3ZnPg==" width="12" height="12" style="vertical-align: middle; margin-right: 4px;" />';
            $icPhoneW = '<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMiIgaGVpZ2h0PSIxMiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmZmZmYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMjIgMTYuOTJ2M2EyIDIgMCAwIDEtMi4xOCAyIDE5Ljc5IDE5Ljc5IDAgMCAxLTguNjMtMy4wNyAxOS41IDE5LjUgMCAwIDEtNi02IDE5Ljc5IDE5Ljc5IDAgMCAxLTMuMDctOC42N0EyIDIgMCAwIDEgNC4xMSAyaDNhMiAyIDAgMCAxIDIgMS43MiAxMi44NCAxMi44NCAwIDAgMCAuNyAyLjgxIDIgMiAwIDAgMS0uNDUgMi4xMUw4LjA5IDkuOTFhMTYgMTYgMCAwIDAgNiA2bDEuMjctMS4yN2EyIDIgMCAwIDEgMi4xMS0uNDUgMTIuODQgMTIuODQgMCAwIDAgMi44MS43QTIgMiAwIDAgMSAyMiAxNi45MnoiLz48L3N2Zz4=" width="12" height="12" style="vertical-align: middle; margin-right: 4px;" />';
            $icEmailW = '<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMiIgaGVpZ2h0PSIxMiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmZmZmYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNNCA0aDE2YzEuMSAwIDIgLjkgMiAydjEyYzAgMS4xLS45IDItMiAySDRjLTEuMSAwLTItLjktMi0yVjZjMC0xLjEuOS0yIDItMnoiLz48cG9seWxpbmUgcG9pbnRzPSIyMiw2 IDEyLDEzIDIsNiIvPjwvc3ZnPg==" width="12" height="12" style="vertical-align: middle; margin-right: 4px;" />';

            // 4. Construct Dompdf HTML document
            $html = '
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page { margin: 0px; size: A4 portrait; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    background-color: #ffffff;
    font-family: "DejaVu Sans", Arial, Helvetica, sans-serif;
    color: #111827;
    font-size: 9pt;
  }
  .pdf-explicit-margin-wrapper {
    margin: 36px 52px 26px 52px !important;
    width: 690px !important;
    max-width: 690px !important;
    padding: 0 !important;
    box-sizing: border-box !important;
  }
  table {
    width: 100% !important;
    border-collapse: collapse !important;
  }
  .mom-content-note {
    font-size: 9pt;
    line-height: 1.5;
    color: #374151;
  }
</style>
</head>
<body>

  <!-- PAGE 1: COVER PAGE WRAPPER -->
  <div class="pdf-explicit-margin-wrapper" style="page-break-after: always; break-after: page;">
    <table style="width: 100%; border-bottom: 2.5px solid #ea580c; padding-bottom: 12px;">
      <tr>
        <td style="vertical-align: middle; width: 45%; border: none; padding: 0;">
          <table style="border-collapse: collapse;">
            <tr>
              <td style="vertical-align: middle; padding-right: 12px; border: none;">
                <img src="' . $logoBase64 . '" style="height: 48px;" />
              </td>
              <td style="vertical-align: middle; border: none;">
                <div style="font-size: 14pt; font-weight: bold; color: #000000; line-height: 1.15;">Livincart Private Limited</div>
                <div style="font-size: 7.5pt; color: #64748b; font-weight: 500;">Official Quotation &amp; Estimation Workspace</div>
              </td>
            </tr>
          </table>
        </td>
        <td style="text-align: right; vertical-align: middle; width: 55%; border: none; padding: 0;">
          <div style="font-size: 9.5pt; font-weight: bold; color: #000000; margin-bottom: 3px;">LIVINCART AND SERVICES PRIVATE LIMITED</div>
          <div style="font-size: 7.5pt; color: #475569; font-weight: 600; line-height: 1.3;">
            ' . $icPin . ' Visakhapatnam, Andhra Pradesh – 530020 &nbsp;|&nbsp; ' . $icPhone . ' +91 7702312351
          </div>
          <div style="font-size: 7.5pt; color: #475569; font-weight: 600; line-height: 1.3;">
            ' . $icEmail . ' contact@livincart.com &nbsp;|&nbsp; ' . $icGlobe . ' www.livincart.com
          </div>
        </td>
      </tr>
    </table>

    <div style="text-align: center; margin-top: 130px; margin-bottom: 120px;">
      <img src="' . $logoBase64 . '" style="height: 75px; margin-bottom: 16px;" /><br/>
      <div style="font-size: 14pt; font-weight: bold; color: #111827; letter-spacing: 0.8px; margin-bottom: 6px; text-transform: uppercase;">
        LIVINCART AND SERVICES PRIVATE LIMITED
      </div>
      <div style="width: 120px; height: 3px; background-color: #ea580c; margin: 10px auto 26px auto;"></div>

      <div style="font-size: 22pt; font-weight: bold; color: #111827; text-transform: uppercase; letter-spacing: 0.8px;">
        MINUTES OF MEETING &amp;
      </div>
      <div style="font-size: 24pt; font-weight: bold; color: #ea580c; text-transform: uppercase; letter-spacing: 0.8px; margin-top: 6px;">
        PROJECT STAGE NOTES (MOM)
      </div>
      <div style="width: 160px; height: 3px; background-color: #ea580c; margin: 14px auto 32px auto;"></div>

      <table style="width: 320px; margin: 0 auto; background-color: #fff7ed; border-radius: 10px; border: 1.5px solid #fbd5aa; border-collapse: collapse;">
        <tr>
          <td style="text-align: center; padding: 12px 24px; border: none; width: 50%;">
            <div style="font-size: 7.5pt; color: #6b7280; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Project ID</div>
            <div style="font-size: 13pt; font-weight: bold; color: #111827;">' . htmlspecialchars($projectCode) . '</div>
          </td>
          <td style="width: 1px; background-color: #fbd5aa; padding: 0; border: none;"></td>
          <td style="text-align: center; padding: 12px 24px; border: none; width: 50%;">
            <div style="font-size: 7.5pt; color: #6b7280; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Date</div>
            <div style="font-size: 13pt; font-weight: bold; color: #111827;">' . htmlspecialchars($savedDate) . '</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Bottom Contact Footer on Cover Page -->
    <div style="margin-top: 130px;">
      <table style="width: 100%; border-collapse: collapse; border-radius: 8px; overflow: hidden;">
        <tr style="background-color: #ea580c; color: #ffffff;">
          <td style="padding: 9px 18px; font-size: 8.5pt; font-weight: bold; text-align: center; border: none;">
            ' . $icPinW . ' Visakhapatnam, Andhra Pradesh 530020 &nbsp;&nbsp;|&nbsp;&nbsp; ' . $icPhoneW . ' +91 7702312351 &nbsp;&nbsp;|&nbsp;&nbsp; ' . $icEmailW . ' contact@livincart.com
          </td>
        </tr>
        <tr style="background-color: #fff7ed; color: #111827;">
          <td style="padding: 8px 18px; font-size: 8.5pt; font-weight: bold; text-align: center; border: none; border-top: 1px solid #fed7aa;">
            ' . $icGlobe . ' www.livincart.com &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Client: ' . htmlspecialchars($clientName) . '
          </td>
        </tr>
      </table>
    </div>
  </div>

  <!-- PAGE 2+: STAGE NOTES WRAPPER -->
  <div class="pdf-explicit-margin-wrapper">
    <table style="width: 100%; border-bottom: 2px solid #ea580c; padding-bottom: 10px; margin-bottom: 16px;">
      <tr>
        <td style="vertical-align: middle; width: 50%; border: none; padding: 0;">
          <table style="border-collapse: collapse;">
            <tr>
              <td style="vertical-align: middle; padding-right: 10px; border: none;">
                <img src="' . $logoBase64 . '" style="height: 34px;" />
              </td>
              <td style="vertical-align: middle; border: none;">
                <div style="font-size: 11pt; font-weight: bold; color: #111827;">Livincart Private Limited</div>
              </td>
            </tr>
          </table>
        </td>
        <td style="text-align: right; vertical-align: middle; width: 50%; font-size: 8.5pt; color: #6b7280; font-weight: 600; border: none; padding: 0;">
          <div style="color: #111827; font-weight: bold;">' . htmlspecialchars($projectName) . '</div>
          <div>Client: ' . htmlspecialchars($clientName) . '</div>
        </td>
      </tr>
    </table>

    <div style="margin-bottom: 14px;">
      <div style="font-size: 16pt; font-weight: bold; color: #111827; letter-spacing: 0.4px; text-transform: uppercase;">MOM STAGES</div>
      <div style="width: 44px; height: 3px; background-color: #ea580c; margin-top: 4px;"></div>
    </div>

    <!-- Project brief grid -->
    <table style="width: 100%; background-color: #fff7ed; border-radius: 8px; border-collapse: collapse; margin-bottom: 16px;">
      <tr>
        <td style="width: 50%; padding: 8px 14px; border: none;">
          <div style="font-size: 7.5pt; color: #ea580c; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">PROJECT NAME</div>
          <div style="font-size: 10.5pt; font-weight: bold; color: #111827; margin-top: 2px;">' . htmlspecialchars($projectName) . '</div>
        </td>
        <td style="width: 50%; padding: 8px 14px; border: none;">
          <div style="font-size: 7.5pt; color: #ea580c; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">CLIENT NAME</div>
          <div style="font-size: 10.5pt; font-weight: bold; color: #111827; margin-top: 2px;">' . htmlspecialchars($clientName) . '</div>
        </td>
      </tr>
      <tr>
        <td style="width: 50%; padding: 8px 14px; border: none;">
          <div style="font-size: 7.5pt; color: #ea580c; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">PROJECT CODE</div>
          <div style="font-size: 10.5pt; font-weight: bold; color: #111827; margin-top: 2px;">' . htmlspecialchars($projectCode) . '</div>
        </td>
        <td style="width: 50%; padding: 8px 14px; border: none;">
          <div style="font-size: 7.5pt; color: #ea580c; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">MOM DATE</div>
          <div style="font-size: 10.5pt; font-weight: bold; color: #111827; margin-top: 2px;">' . date('d F Y') . '</div>
        </td>
      </tr>
    </table>

    <!-- Stages Table (Exact Same Table Format as Stage Notes / MOM) -->
    <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #cbd5e1; border-radius: 8px; margin-bottom: 20px;">
      <thead>
        <tr style="background-color: #fff8f0; border-bottom: 2px solid #fed7aa;">
          <th style="padding: 10px 14px; text-align: left; font-size: 8.5pt; font-weight: bold; color: #0f172a; border-bottom: 2px solid #fed7aa; width: 110px;">Stage</th>
          <th style="padding: 10px 14px; text-align: left; font-size: 8.5pt; font-weight: bold; color: #0f172a; border-bottom: 2px solid #fed7aa; width: 115px;">Start Date</th>
          <th style="padding: 10px 14px; text-align: left; font-size: 8.5pt; font-weight: bold; color: #0f172a; border-bottom: 2px solid #fed7aa; width: 115px;">End Date</th>
          <th style="padding: 10px 14px; text-align: left; font-size: 8.5pt; font-weight: bold; color: #0f172a; border-bottom: 2px solid #fed7aa;">Description</th>
        </tr>
      </thead>
      <tbody>';

            if (empty($activeStageNotes)) {
                $html .= '
        <tr>
          <td colspan="4" style="padding: 24px; color: #9ca3af; font-size: 9pt; text-align: center; border-bottom: 1px solid #cbd5e1;">
            No stage notes available for this project.
          </td>
        </tr>';
            } else {
                foreach ($activeStageNotes as $idx => $stage) {
                    $sDateFormatted = !empty($stage['startDate']) ? date('d M Y', strtotime($stage['startDate'])) : '—';
                    $eDateFormatted = !empty($stage['endDate']) ? date('d M Y', strtotime($stage['endDate'])) : '—';
                    $cat = strtolower(trim($stage['category'] ?? ''));

                    $bgBadge = '#eff6ff';
                    $textBadge = '#2563eb';
                    if (strpos($cat, '3d') !== false || strpos($cat, 'approval') !== false || strpos($cat, 'concept') !== false) {
                        $bgBadge = '#fef3c7'; $textBadge = '#d97706';
                    } elseif (strpos($cat, 'qc') !== false || strpos($cat, 'check') !== false) {
                        $bgBadge = '#f3e8ff'; $textBadge = '#9333ea';
                    } elseif (strpos($cat, 'mask') !== false || strpos($cat, 'lost') !== false) {
                        $bgBadge = '#fee2e2'; $textBadge = '#dc2626';
                    } elseif (strpos($cat, 'handover') !== false || strpos($cat, 'complete') !== false) {
                        $bgBadge = '#dcfce7'; $textBadge = '#15803d';
                    } elseif (strpos($cat, 'production') !== false || strpos($cat, 'dispatch') !== false || strpos($cat, 'r2p') !== false) {
                        $bgBadge = '#ffedd5'; $textBadge = '#ea580c';
                    }

                    $rowBg = ($idx % 2 === 0) ? '#ffffff' : '#fcfcfd';
                    $noteContent = !empty($stage['note']) ? nl2br(htmlspecialchars($stage['note'])) : '<span style="color:#94a3b8;font-style:italic;">—</span>';

                    $html .= '
        <tr style="background-color: ' . $rowBg . '; border-bottom: 1px solid #cbd5e1; page-break-inside: avoid;">
          <td style="padding: 10px 14px; vertical-align: middle; border-bottom: 1px solid #cbd5e1; white-space: nowrap;">
            <span style="display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 8pt; font-weight: bold; background-color: ' . $bgBadge . '; color: ' . $textBadge . ';">
              ' . htmlspecialchars($stage['category'] ?? '') . '
            </span>
          </td>
          <td style="padding: 10px 14px; vertical-align: middle; border-bottom: 1px solid #cbd5e1; font-size: 8.5pt; color: #475569; font-weight: bold; white-space: nowrap;">
            ' . $sDateFormatted . '
          </td>
          <td style="padding: 10px 14px; vertical-align: middle; border-bottom: 1px solid #cbd5e1; font-size: 8.5pt; color: #475569; font-weight: bold; white-space: nowrap;">
            ' . $eDateFormatted . '
          </td>
          <td style="padding: 10px 14px; vertical-align: middle; border-bottom: 1px solid #cbd5e1; font-size: 8.5pt; color: #334155; line-height: 1.45;">
            ' . $noteContent . '
          </td>
        </tr>';
                }
            }

            $html .= '
      </tbody>
    </table>';

            // Active notes section
            if (!empty($designerActiveNote) || !empty($pmActiveNote)) {
                $html .= '
    <div style="margin-top: 18px; padding: 14px 16px; background-color: #fff7ed; border-radius: 8px; page-break-inside: avoid;">
      <div style="font-size: 13pt; font-weight: bold; color: #111827; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 10px;">TIMELINE ACTIVE NOTES</div>';

                if (!empty($designerActiveNote)) {
                    $html .= '
      <div style="background-color: #ffffff; padding: 10px 14px; border-radius: 6px; margin-bottom: ' . (!empty($pmActiveNote) ? '8px' : '0') . ';">
        <div style="font-size: 8.5pt; font-weight: bold; color: #ea580c; text-transform: uppercase; margin-bottom: 3px;">Designer Active Note</div>
        <div class="mom-content-note">' . $designerActiveNote . '</div>
      </div>';
                }

                if (!empty($pmActiveNote)) {
                    $html .= '
      <div style="background-color: #ffffff; padding: 10px 14px; border-radius: 6px;">
        <div style="font-size: 8.5pt; font-weight: bold; color: #ea580c; text-transform: uppercase; margin-bottom: 3px;">Project Manager Active Note</div>
        <div class="mom-content-note">' . $pmActiveNote . '</div>
      </div>';
                }

                $html .= '</div>';
            }

            $html .= '
    <div style="margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 6px;">
      <table style="width: 100%; font-size: 7.5pt; color: #9ca3af;">
        <tr>
          <td style="border: none; padding: 0;">Livincart Private Limited &copy; ' . date('Y') . '</td>
          <td style="text-align: center; border: none; padding: 0;">Confidential — For Client Use Only</td>
          <td style="text-align: right; border: none; padding: 0;">MOM Document</td>
        </tr>
      </table>
    </div>
  </div>

</body>
</html>';

            // 5. Render via Dompdf
            require_once __DIR__ . '/../libs/dompdf/autoload.inc.php';
            $options = new \Dompdf\Options();
            $options->set('isHtml5ParserEnabled', true);
            $options->set('isRemoteEnabled', true);
            $options->set('defaultFont', 'DejaVu Sans');
            $options->set('dpi', 96);

            $dompdf = new \Dompdf\Dompdf($options);
            $dompdf->loadHtml($html);
            $dompdf->setPaper('A4', 'portrait');
            $dompdf->render();

            $pdfBytes = $dompdf->output();

            return [
                'success'    => true,
                'pdf_base64' => 'data:application/pdf;base64,' . base64_encode($pdfBytes)
            ];

        } catch (\Exception $e) {
            return [
                'success' => false,
                'message' => 'Dompdf MOM generation error: ' . $e->getMessage()
            ];
        }
    }

    /**
     * Generate fresh MOM PDF base64 for email sharing.
     */
    public function getMomPdfForEmail($project_id, $type = null) {
        $project_id = intval($project_id);
        if ($project_id <= 0) {
            return ['success' => false, 'message' => 'Invalid project_id'];
        }
        return $this->generateMomPdf($project_id, $type);
    }

    /**
     * Validate token and return MOM data (project info + stage notes) for PrintMomView.
     */
    public function getMomDataWithToken($project_id, $token) {
        $project_id = intval($project_id);
        if ($project_id <= 0 || empty($token)) {
            http_response_code(400);
            return ['success' => false, 'message' => 'Invalid request'];
        }

        if (!PrintTokenHelper::validate($token, $project_id)) {
            http_response_code(401);
            return ['success' => false, 'message' => 'Invalid or expired print token'];
        }

        // 1. Fetch project and client details
        try {
            $p_query = "SELECT p.*, c.name as client_name, c.phone as client_phone, c.address as client_address, c.email as client_email, u.name as project_head_name 
                        FROM projects p
                        JOIN clients c ON p.client_id = c.client_id
                        LEFT JOIN users u ON p.project_head_id = u.user_id
                        WHERE p.project_id = :id";
            $p_stmt = $this->db->prepare($p_query);
            $p_stmt->execute(['id' => $project_id]);
            $project = $p_stmt->fetch(PDO::FETCH_ASSOC);

            if (!$project) {
                http_response_code(404);
                return ['success' => false, 'message' => 'Project not found'];
            }

            // 2. Fetch latest quote info for cover page version/date
            $q_query = "SELECT quote_id, version, created_at FROM quotes WHERE project_id = :pid AND status = 'budgeted' AND (save_type = 'version' OR save_type IS NULL OR save_type = '') ORDER BY version DESC LIMIT 1";
            $q_stmt = $this->db->prepare($q_query);
            $q_stmt->execute(['pid' => $project_id]);
            $latest_quote = $q_stmt->fetch(PDO::FETCH_ASSOC);

            // 3. Fetch stage notes
            $notesDir = __DIR__ . '/../uploads/timelines';
            $file = "$notesDir/stage_notes_$project_id.json";
            $notes = file_exists($file) ? json_decode(file_get_contents($file), true) : [];

            return [
                'success' => true,
                'project' => $project,
                'latest_quote' => $latest_quote ?: null,
                'stage_notes' => $notes ?: []
            ];
        } catch (Exception $e) {
            http_response_code(500);
            return ['success' => false, 'message' => 'Database error: ' . $e->getMessage()];
        }
    }

    /**
     * Check if PDF generator service is running.
     */
    public function healthCheck() {
        $ch = curl_init($this->pdfGeneratorUrl . '/health');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 5);
        curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return $httpCode === 200;
    }
}
