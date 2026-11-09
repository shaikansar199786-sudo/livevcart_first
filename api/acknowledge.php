<?php
/**
 * Public Acknowledgement Handler (Quotes & Agreements)
 * Public endpoint — no auth required.
 *
 * For Quotations:
 * Client clicks "Accept Quotation" -> /api/acknowledge.php?token=TOKEN&action=accept
 * Client clicks "Reject Quotation" -> /api/acknowledge.php?token=TOKEN&action=reject
 * After accepting:
 *  - Buttons disappear in-place and show:
 *    "Quotation Accepted Successfully"
 *    "Thank you! You have accepted the quotation proposal. Your project has been officially confirmed and our Admin, Design, and Sales teams have been notified!"
 *  - Converts lead to project automatically.
 *  - Notifies Admin, Designer, Sales teams, and Client via email.
 */

// Suppress PHP warnings/notices from HTTP output to ensure clean JSON responses
@ini_set('display_errors', '0');
@ini_set('display_startup_errors', '0');
@ini_set('log_errors', '1');
error_reporting(E_ALL & ~E_DEPRECATED & ~E_STRICT);

require_once __DIR__ . '/config/database.php';

// ── GOOGLE AMP FOR EMAIL CORS HEADERS ──
$allowedOrigins = [
    'https://mail.google.com',
    'https://amp.gmail.dev',
    'https://playground.amp.dev',
    'http://localhost',
    'http://127.0.0.1'
];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$matchedOrigin = 'https://mail.google.com';
if (in_array($origin, $allowedOrigins, true) || preg_match('/^https:\/\/([a-zA-Z0-9-]+\.)?googleusercontent\.com$/', $origin)) {
    $matchedOrigin = $origin;
} elseif (!empty($origin)) {
    $matchedOrigin = $origin;
}

header('Access-Control-Allow-Origin: ' . $matchedOrigin);
header('Access-Control-Allow-Credentials: true');
header('AMP-Email-Allow-Sender: updates@livincart.com');

$sourceOrigin = !empty($_GET['__amp_source_origin']) ? $_GET['__amp_source_origin'] : 'updates@livincart.com';
header('AMP-Access-Control-Allow-Source-Origin: ' . $sourceOrigin);
header('Access-Control-Expose-Headers: AMP-Access-Control-Allow-Source-Origin');

$reqMethod = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($reqMethod === 'OPTIONS') {
    header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, AMP-Access-Control-Allow-Source-Origin, AMP-Email-Allow-Sender');
    http_response_code(200);
    exit;
}

$token  = isset($_POST['token']) ? trim($_POST['token']) : (isset($_GET['token']) ? trim($_GET['token']) : '');
$action = isset($_POST['action']) ? strtolower(trim($_POST['action'])) : (isset($_GET['action']) ? strtolower(trim($_GET['action'])) : '');
if (empty($action) && isset($_POST['action_btn'])) {
    $action = strtolower(trim($_POST['action_btn']));
}

// Strict whitelist for action: only 'accept' or 'reject' are permitted
if (!in_array($action, ['accept', 'reject'], true)) {
    $action = '';
}

$isAmpRequest = !empty($_GET['__amp_source_origin']) || !empty($_SERVER['HTTP_AMP_SAME_ORIGIN']);
$isAjax = $isAmpRequest || isset($_GET['ajax']) || isset($_POST['ajax']) || 
          (!empty($_SERVER['HTTP_X_REQUESTED_WITH']) && strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest') ||
          (isset($_SERVER['HTTP_ACCEPT']) && strpos($_SERVER['HTTP_ACCEPT'], 'application/json') !== false && empty($_GET['download_pdf']));

// Sanitize token — hex characters only
$token = preg_replace('/[^a-f0-9]/', '', $token);

$itemType       = '';           // 'quote' | 'agreement'
$status         = 'invalid';   // invalid | pending_quote | success | rejected | already | already_accepted | already_rejected
$heading        = '';
$message        = '';
$clientName     = '';
$clientEmail    = '';
$refId          = '';
$totalAmount    = '';
$quoteDate      = '';
$acknowledgedAt = '';
$leadConverted  = false;
$sectionsList   = [];
$triedOppositeAction = '';

if (strlen($token) === 64) {
    try {
        $db   = new Database();
        $conn = $db->getConnection();

        $ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        $ip = substr(trim(explode(',', $ip)[0]), 0, 45);

        // ─────────────────────────────────────────────────────────────
        // 1. Check if token belongs to QUOTES
        // ─────────────────────────────────────────────────────────────
        $stmtQ = $conn->prepare(
            "SELECT q.quote_id, q.quote_number, q.project_id, q.subtitle, q.total_amount, 
                    q.status, q.acknowledged_at, q.ack_status, q.extra_data, q.lead_id, 
                    q.created_at, q.pdf_snapshot
             FROM quotes q
             WHERE q.ack_token = :token
             LIMIT 1"
        );
        $stmtQ->execute([':token' => $token]);
        $quoteRow = $stmtQ->fetch(PDO::FETCH_ASSOC);

        if ($quoteRow) {
            $itemType    = 'quote';
            $quoteId     = intval($quoteRow['quote_id']);
            $refId       = $quoteRow['quote_number'] ?: ('QT-' . $quoteId);
            $totalAmount = '₹' . number_format(floatval($quoteRow['total_amount'] ?? 0), 2);
            $quoteDate   = !empty($quoteRow['created_at']) ? date('d M Y', strtotime($quoteRow['created_at'])) : date('d M Y');
            $rawPid      = (string)($quoteRow['project_id'] ?? '');

            // PDF Download support (lazy loaded only when download is explicitly requested)
            if (isset($_GET['download_pdf'])) {
                $pdfData = '';
                if (!empty($quoteRow['pdf_snapshot']) && strlen($quoteRow['pdf_snapshot']) > 1000) {
                    $pdfData = $quoteRow['pdf_snapshot'];
                } else {
                    try {
                        require_once __DIR__ . '/helpers/SimplePdfBuilder.php';
                        $pdfData = \SimplePdfBuilder::generateQuotePdfBinary($quoteRow);
                    } catch (Exception $ePdf) {}
                }
                if (!empty($pdfData)) {
                    $cleanRef = preg_replace('/[^a-zA-Z0-9_-]/', '', $refId);
                    header('Content-Type: application/pdf');
                    header('Content-Disposition: inline; filename="Quotation_' . $cleanRef . '.pdf"');
                    header('Content-Length: ' . strlen($pdfData));
                    echo $pdfData;
                    exit;
                }
            }

            // Fetch quote sections for room scope summary
            try {
                $secStmt = $conn->prepare("SELECT section_id, section_name FROM quote_sections WHERE quote_id = :qid ORDER BY display_order ASC");
                $secStmt->execute([':qid' => $quoteId]);
                $sectionsList = $secStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
            } catch (Exception $secEx) {}

            // Resolve client name & email
            // 1. Try from leads
            $leadData = null;
            $leadInfo = null;
            $chkLead = $conn->prepare("SELECT lead_id, client_name, email, contact_number, is_converted, d1_assigned_to, assigned_to, created_by FROM leads WHERE lead_id = :lid OR manual_client_id = :mcid LIMIT 1");
            $chkLead->execute([':lid' => $rawPid, ':mcid' => $rawPid]);
            $leadInfo = $chkLead->fetch(PDO::FETCH_ASSOC);
            if ($leadInfo && !empty($leadInfo['client_name'])) {
                $clientName = $leadInfo['client_name'];
                $clientEmail = $leadInfo['email'] ?? '';
            }

            // 2. Try from clients via projects
            if (empty($clientName) && !empty($rawPid)) {
                $chkProj = $conn->prepare("SELECT c.name as client_name, c.email as client_email FROM projects p JOIN clients c ON p.client_id = c.client_id WHERE p.project_id = :pid LIMIT 1");
                $chkProj->execute([':pid' => $rawPid]);
                $projInfo = $chkProj->fetch(PDO::FETCH_ASSOC);
                if ($projInfo && !empty($projInfo['client_name'])) {
                    $clientName = $projInfo['client_name'];
                    $clientEmail = $projInfo['client_email'] ?? $clientEmail;
                }
            }

            if (empty($clientName)) {
                $clientName = $quoteRow['subtitle'] ?: 'Valued Client';
            }

            $prevAccepted = (!empty($quoteRow['ack_status']) && $quoteRow['ack_status'] === 'accepted') || in_array(strtolower($quoteRow['status'] ?? ''), ['approved', 'accepted', 'order_converted', 'won']);
            $prevRejected = (!empty($quoteRow['ack_status']) && $quoteRow['ack_status'] === 'rejected' && !empty($quoteRow['acknowledged_at']));

            if ($prevAccepted) {
                // Single-use token enforcement: already accepted
                $acknowledgedAt = !empty($quoteRow['acknowledged_at']) ? date('d M Y, h:i A', strtotime($quoteRow['acknowledged_at'])) : date('d M Y, h:i A');
                $status   = 'already_accepted';
                if ($action === 'reject') {
                    $triedOppositeAction = 'reject';
                    $heading  = 'Initial Quotation Already Accepted (Rejection Not Permitted)';
                    $message  = 'You have already accepted this initial quotation on ' . $acknowledgedAt . '. Rejection is not permitted. Next step: Stage 1 Token Advance payment.';
                } else {
                    $heading  = 'Initial Quotation Accepted Successfully';
                    $message  = 'Thank you! You have accepted the initial quotation proposal. Your acceptance has been registered with our team. To officially confirm your order and begin project onboarding, please proceed with the Stage 1: Token Advance payment.';
                }
            } elseif ($prevRejected) {
                // Single-use token enforcement: already rejected
                $acknowledgedAt = !empty($quoteRow['acknowledged_at']) ? date('d M Y, h:i A', strtotime($quoteRow['acknowledged_at'])) : date('d M Y, h:i A');
                $status   = 'already_rejected';
                if ($action === 'accept') {
                    $triedOppositeAction = 'accept';
                    $heading  = 'Quotation Already Declined (Acceptance Not Permitted)';
                    $message  = 'You have already declined this quotation on ' . $acknowledgedAt . '. This quotation proposal is permanently closed and cannot be accepted.';
                } else {
                    $heading  = 'Quotation Declined';
                    $message  = 'Your response has been recorded. We appreciate your consideration and hope to assist you in the future.';
                }
            } elseif ($action === 'accept') {
                $quoteAmt = floatval($quoteRow['total_amount'] ?? 0);

                // 1. Update quote status, mark as accepted and lock as INITIAL QUOTATION
                $upd = $conn->prepare(
                    "UPDATE quotes 
                     SET acknowledged_at = NOW(), 
                         acknowledged_ip = :ip, 
                         ack_status      = 'accepted', 
                         status          = 'approved', 
                         is_initial      = 1 
                     WHERE quote_id = :id
                       AND ack_token = :token
                       AND (ack_status IS NULL OR ack_status = '' OR ack_status = 'pending')"
                );
                $upd->execute([':ip' => $ip, ':id' => $quoteId, ':token' => $token]);
                $rowsAffected = $upd->rowCount();

                if ($rowsAffected === 0) {
                    $chkFinal = $conn->prepare("SELECT ack_status, acknowledged_at FROM quotes WHERE quote_id = :id");
                    $chkFinal->execute([':id' => $quoteId]);
                    $fRow = $chkFinal->fetch(PDO::FETCH_ASSOC);
                    if ($fRow && $fRow['ack_status'] === 'accepted') {
                        $acknowledgedAt = !empty($fRow['acknowledged_at']) ? date('d M Y, h:i A', strtotime($fRow['acknowledged_at'])) : date('d M Y, h:i A');
                        $status   = 'already_accepted';
                        $heading  = 'Initial Quotation Accepted Successfully';
                        $message  = 'Thank you! You have accepted the initial quotation proposal. Your acceptance has been registered with our team. To officially confirm your order and begin project onboarding, please proceed with the Stage 1: Token Advance payment.';
                    } elseif ($fRow && $fRow['ack_status'] === 'rejected') {
                        $acknowledgedAt = !empty($fRow['acknowledged_at']) ? date('d M Y, h:i A', strtotime($fRow['acknowledged_at'])) : date('d M Y, h:i A');
                        $status   = 'already_rejected';
                        $triedOppositeAction = 'accept';
                        $heading  = 'Quotation Already Declined (Acceptance Not Permitted)';
                        $message  = 'You have already declined this quotation on ' . $acknowledgedAt . '. This quotation proposal is permanently closed and cannot be accepted.';
                    }
                } else {
                    $acknowledgedAt = date('d M Y, h:i A');
                }

                // 2. Clear is_initial from other quotes for this project/lead
                try {
                    $conn->prepare("UPDATE quotes SET is_initial = 0 WHERE quote_id != :qid AND ((project_id = :pid AND project_id > 0) OR (lead_id = :lid AND lead_id > 0))")
                         ->execute([':qid' => $quoteId, ':pid' => $rawPid, ':lid' => $quoteRow['lead_id'] ?? 0]);
                } catch (Exception $e) {}

                // 3. Mark extra_data with is_initial_quote = true
                try {
                    $exData = !empty($quoteRow['extra_data']) ? json_decode($quoteRow['extra_data'], true) : [];
                    if (!is_array($exData)) $exData = [];
                    $exData['is_initial_quote'] = true;
                    $conn->prepare("UPDATE quotes SET extra_data = :ex WHERE quote_id = :qid")->execute([':ex' => json_encode($exData), ':qid' => $quoteId]);
                } catch (Exception $e) {}

                // ── CONVERT LEAD TO PROJECT & LOCK INITIAL BUDGET ──
                $leadIdToConvert = null;
                if (!empty($quoteRow['lead_id'])) {
                    $leadIdToConvert = intval($quoteRow['lead_id']);
                }
                if (!$leadIdToConvert && !empty($leadInfo['lead_id'])) {
                    $leadIdToConvert = intval($leadInfo['lead_id']);
                }
                if (!$leadIdToConvert && !empty($quoteRow['extra_data'])) {
                    $ex = json_decode($quoteRow['extra_data'], true);
                    if (!empty($ex['lead_id'])) {
                        $leadIdToConvert = intval($ex['lead_id']);
                    }
                }
                if (!$leadIdToConvert && !empty($rawPid) && is_numeric($rawPid)) {
                    $leadIdToConvert = intval($rawPid);
                }
                if (!$leadIdToConvert && !empty($clientName)) {
                    $chkLeadByName = $conn->prepare("SELECT lead_id FROM leads WHERE client_name = :cname AND (is_converted = 0 OR is_converted IS NULL) ORDER BY lead_id DESC LIMIT 1");
                    $chkLeadByName->execute([':cname' => $clientName]);
                    $leadIdToConvert = intval($chkLeadByName->fetchColumn() ?: 0);
                }

                // 4. Lock initial quote amount and budget on Lead & link quote to lead
                if ($leadIdToConvert > 0) {
                    try {
                        $conn->prepare("UPDATE quotes SET lead_id = :lid WHERE quote_id = :qid AND (lead_id IS NULL OR lead_id = 0)")
                             ->execute([':lid' => $leadIdToConvert, ':qid' => $quoteId]);
                    } catch (Exception $e) {}
                    try {
                        $conn->prepare("UPDATE leads SET initial_quote_amount = :amt, total_budget = :amt, estimated_budget = :amt WHERE lead_id = :lid")
                             ->execute([':amt' => $quoteAmt, ':lid' => $leadIdToConvert]);
                    } catch (Exception $e) {}
                }

                // 5. Lock initial quote amount and budget on Project if already exists
                if (!empty($rawPid)) {
                    try {
                        $conn->prepare("UPDATE projects SET initial_quote_amount = :amt, total_budget = CASE WHEN COALESCE(is_final_quote_approved, 0) = 0 THEN :amt ELSE total_budget END WHERE project_id = :pid OR project_code = :pcode")
                             ->execute([':amt' => $quoteAmt, ':pid' => $rawPid, ':pcode' => $rawPid]);
                    } catch (Exception $e) {}
                }

                if ($leadIdToConvert > 0) {
                    try {
                        $lStmt = $conn->prepare("SELECT * FROM leads WHERE lead_id = :lid LIMIT 1");
                        $lStmt->execute([':lid' => $leadIdToConvert]);
                        $leadData = $lStmt->fetch(PDO::FETCH_ASSOC);

                        // Client accepted initial quotation: lock initial budget and update lead status to proposal_accepted
                        // Note: d1_status is preserved so consultation meeting status is only completed when manually marked by designer or sales team
                        $conn->prepare("UPDATE leads SET initial_quote_amount = :amt, total_budget = :amt, estimated_budget = :amt, status = 'proposal_accepted' WHERE lead_id = :lid")
                             ->execute([':amt' => $quoteAmt, ':lid' => $leadIdToConvert]);

                        // Strict Workflow Rule: If Stage 1 payment was already completed, automatically convert lead to project
                        $leadAdv = floatval($leadData['advance_paid'] ?? 0);
                        $leadBudget = floatval($quoteAmt);
                        $isStage1AlreadyPaid = $leadBudget > 0 
                            ? ($leadAdv >= ($leadBudget * 0.10 - 1) || ($leadAdv / $leadBudget) * 100 >= 9.9) 
                            : ($leadAdv > 0);

                        if ($isStage1AlreadyPaid && empty($leadData['is_converted'])) {
                            require_once __DIR__ . '/controllers/LeadController.php';
                            $leadCtrl = new LeadController($conn, 1, 'admin');
                            $leadCtrl->convertToProject($leadIdToConvert, [
                                'advance_paid' => $leadAdv,
                                'total_budget' => $leadBudget,
                                'initial_quote_amount' => $leadBudget,
                                'created_by' => 1
                            ]);
                        }
                    } catch (Exception $convEx) {
                        error_log("Quote accept lead update error: " . $convEx->getMessage());
                    }
                }

                $status   = 'success';
                $heading  = 'Initial Quotation Accepted Successfully';
                $message  = 'Thank you! You have accepted the initial quotation proposal. Your acceptance has been registered with our team. To officially confirm your order and begin project onboarding, please proceed with the Stage 1: Token Advance payment.';

                // Dispatch asynchronous email notifications in a detached background process
                // This returns IMMEDIATELY to mobile/browser in <50ms without waiting for SMTP or network latency!
                $origSubject = null;
                $origMessageId = null;
                if (!empty($quoteRow['extra_data'])) {
                    $exMeta = json_decode($quoteRow['extra_data'], true);
                    if (is_array($exMeta)) {
                        $origSubject   = $exMeta['last_email_subject'] ?? null;
                        $origMessageId = $exMeta['last_email_message_id'] ?? null;
                    }
                }

                $dName = 'Designer';
                $dEmail = null;
                $sName = 'Sales Team';
                $sEmail = null;
                if (!empty($leadData)) {
                    if (!empty($leadData['d1_assigned_to'])) {
                        $dId = explode(',', $leadData['d1_assigned_to'])[0];
                        $uStmt = $conn->prepare("SELECT name, username FROM users WHERE user_id = :uid LIMIT 1");
                        $uStmt->execute([':uid' => $dId]);
                        $uRow = $uStmt->fetch(PDO::FETCH_ASSOC);
                        if ($uRow) {
                            $dName = $uRow['name'] ?: $dName;
                            $dEmail = filter_var($uRow['username'], FILTER_VALIDATE_EMAIL) ? $uRow['username'] : null;
                        }
                    }
                    $sId = !empty($leadData['assigned_to']) ? $leadData['assigned_to'] : (!empty($leadData['created_by']) ? $leadData['created_by'] : null);
                    if ($sId) {
                        $uStmt = $conn->prepare("SELECT name, username FROM users WHERE user_id = :uid LIMIT 1");
                        $uStmt->execute([':uid' => $sId]);
                        $uRow = $uStmt->fetch(PDO::FETCH_ASSOC);
                        if ($uRow) {
                            $sName = $uRow['name'] ?: $sName;
                            $sEmail = filter_var($uRow['username'], FILTER_VALIDATE_EMAIL) ? $uRow['username'] : null;
                        }
                    }
                }

                $jobPayload = [
                    'quote_id'        => $quoteId,
                    'project_id'      => !empty($quoteRow['project_id']) ? $quoteRow['project_id'] : ($leadIdToConvert ?: ('PRJ-' . $quoteId)),
                    'lead_id'         => $leadIdToConvert,
                    'client_name'     => $clientName,
                    'client_email'    => $clientEmail,
                    'ref_id'          => $refId,
                    'quote_amt'       => $quoteAmt,
                    'designer_name'   => $dName,
                    'designer_email'  => $dEmail,
                    'sales_name'      => $sName,
                    'sales_email'     => $sEmail,
                    'orig_subject'    => $origSubject,
                    'orig_message_id' => $origMessageId
                ];

                $tempDir = __DIR__ . '/scratch';
                if (!is_dir($tempDir)) {
                    @mkdir($tempDir, 0777, true);
                }
                $jobFile = $tempDir . '/job_' . uniqid('ack_', true) . '.json';
                file_put_contents($jobFile, json_encode($jobPayload));

                $phpBin = PHP_BINARY;
                if (empty($phpBin) || !is_file($phpBin)) {
                    $phpBin = 'php';
                }
                $workerScript = __DIR__ . '/helpers/async_email_worker.php';
                if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
                    $cmd = 'start /B "" ' . escapeshellarg($phpBin) . ' ' . escapeshellarg($workerScript) . ' ' . escapeshellarg($jobFile) . ' > NUL 2>&1';
                    pclose(popen($cmd, 'r'));
                } else {
                    $cmd = escapeshellarg($phpBin) . ' ' . escapeshellarg($workerScript) . ' ' . escapeshellarg($jobFile) . ' > /dev/null 2>&1 &';
                    exec($cmd);
                }


            } elseif ($action === 'reject') {
                // Update quote status to order_lost
                $upd = $conn->prepare(
                    "UPDATE quotes 
                     SET acknowledged_at = NOW(), 
                         acknowledged_ip = :ip, 
                         ack_status      = 'rejected', 
                         status          = 'order_lost' 
                     WHERE quote_id = :id
                       AND ack_token = :token
                       AND (ack_status IS NULL OR ack_status = '' OR ack_status = 'pending')"
                );
                $upd->execute([':ip' => $ip, ':id' => $quoteId, ':token' => $token]);
                $rowsAffected = $upd->rowCount();

                if ($rowsAffected === 0) {
                    $chkFinal = $conn->prepare("SELECT ack_status, acknowledged_at FROM quotes WHERE quote_id = :id");
                    $chkFinal->execute([':id' => $quoteId]);
                    $fRow = $chkFinal->fetch(PDO::FETCH_ASSOC);
                    if ($fRow && $fRow['ack_status'] === 'accepted') {
                        $acknowledgedAt = !empty($fRow['acknowledged_at']) ? date('d M Y, h:i A', strtotime($fRow['acknowledged_at'])) : date('d M Y, h:i A');
                        $status   = 'already_accepted';
                        $triedOppositeAction = 'reject';
                        $heading  = 'Quotation Already Accepted (Rejection Not Permitted)';
                        $message  = 'You have already accepted this quotation on ' . $acknowledgedAt . '. Your project has been officially confirmed and locked. Rejection is not permitted.';
                    } else {
                        $acknowledgedAt = !empty($fRow['acknowledged_at']) ? date('d M Y, h:i A', strtotime($fRow['acknowledged_at'])) : date('d M Y, h:i A');
                        $status   = 'already_rejected';
                        $heading  = 'Quotation Declined';
                        $message  = 'Your response has been recorded. We appreciate your consideration and hope to assist you in the future.';
                    }
                } else {
                    $acknowledgedAt = date('d M Y, h:i A');
                    $status         = 'rejected';
                    $heading        = 'Quotation Declined';
                    $message        = 'Your response has been recorded. We appreciate your consideration and hope to assist you in the future.';
                }

            } else {
                // Not yet responded and no action -> show details with interactive Accept/Reject buttons
                $status  = 'pending_quote';
                $heading = 'Quotation Acceptance & Confirmation';
                $message = 'Please review the quotation proposal details below and confirm whether you would like to Accept or Reject this proposal:';
            }

        } else {
            // ─────────────────────────────────────────────────────────────
            // 2. Check if token belongs to AGREEMENTS
            // ─────────────────────────────────────────────────────────────
            $stmtA = $conn->prepare(
                "SELECT id, ref_id, project_id, client_name, status, acknowledged_at
                 FROM agreements
                 WHERE ack_token = :token
                 LIMIT 1"
            );
            $stmtA->execute([':token' => $token]);
            $agRow = $stmtA->fetch(PDO::FETCH_ASSOC);

            if ($agRow) {
                $itemType   = 'agreement';
                $clientName = $agRow['client_name'];
                $refId      = $agRow['ref_id'];

                if (!empty($agRow['acknowledged_at'])) {
                    $status         = 'already';
                    $acknowledgedAt = date('d M Y, h:i A', strtotime($agRow['acknowledged_at']));
                    $heading        = 'Already Acknowledged';
                    $message        = 'You have already acknowledged receipt of this agreement.';
                } else {
                    $upd = $conn->prepare(
                        "UPDATE agreements
                         SET acknowledged_at  = NOW(),
                             acknowledged_ip  = :ip,
                             status           = 'Acknowledged'
                         WHERE ack_token = :token"
                    );
                    $upd->execute([':ip' => $ip, ':token' => $token]);

                    // Sync works contract completion to projects table
                    $pId = !empty($agRow['project_id']) ? intval($agRow['project_id']) : 0;
                    if ($pId > 0) {
                        try {
                            $conn->prepare("UPDATE projects SET works_contract_done = 1, works_contract_signed = 1, agreement_status = 'acknowledged' WHERE project_id = :pid OR id = :pid")->execute([':pid' => $pId]);
                        } catch (Exception $pe) {}
                    } else if (!empty($refId)) {
                        try {
                            $conn->prepare("UPDATE projects SET works_contract_done = 1, works_contract_signed = 1, agreement_status = 'acknowledged' WHERE project_code = :ref OR project_id = :ref")->execute([':ref' => $refId]);
                        } catch (Exception $pe) {}
                    }

                    $acknowledgedAt = date('d M Y, h:i A');
                    $status         = 'success';
                    $heading        = 'Agreement Acknowledged Successfully';
                    $message        = 'Thank you! Your acknowledgement has been recorded successfully.';
                }
            } else {
                $status  = 'invalid';
                $heading = 'Invalid Link';
                $message = 'This acknowledgement link is invalid or has expired.';
            }
        }
    } catch (Exception $e) {
        $status  = 'invalid';
        $heading = 'System Error';
        $message = 'A server error occurred. Please try again or contact support.';
    }
} else {
    $status  = 'invalid';
    $heading = 'Invalid Link';
    $message = 'This acknowledgement link is invalid or malformed.';
}

// If AJAX or AMP request, return JSON response
if ($isAjax) {
    if (ob_get_length()) {
        ob_clean();
    }
    header('Content-Type: application/json; charset=UTF-8');
    $isAcc = in_array($status, ['success', 'already_accepted', 'already'], true);
    $isRej = in_array($status, ['rejected', 'already_rejected'], true);
    echo json_encode([
        'success'             => $isAcc || $isRej,
        'status'              => $status,
        'accepted'            => $isAcc,
        'rejected'            => $isRej,
        'triedOppositeAction' => $triedOppositeAction,
        'refId'               => $refId,
        'totalAmount'         => $totalAmount,
        'clientName'          => $clientName,
        'heading'             => $heading,
        'message'             => $message,
        'acknowledgedAt'      => $acknowledgedAt ?: date('d M Y, h:i A'),
        'leadConverted'       => $leadConverted
    ]);
    if (function_exists('fastcgi_finish_request')) {
        fastcgi_finish_request();
    }
    exit;
}

$isAccepted = in_array($status, ['success', 'already_accepted']);
$isRejected = in_array($status, ['rejected', 'already_rejected']);
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><?= htmlspecialchars($heading ?: 'Quotation Confirmation') ?> — LivinCart</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: #f1f5f9;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
      color: #0f172a;
    }
    .wrapper {
      max-width: 620px;
      width: 100%;
      background: #ffffff;
      border-radius: 20px;
      box-shadow: 0 12px 40px rgba(15, 23, 42, 0.08);
      border: 1.5px solid #e2e8f0;
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      padding: 24px 28px;
      display: flex;
      align-items: center;
      gap: 16px;
      border-bottom: 3px solid #fca412;
    }
    .logo-badge {
      width: 48px;
      height: 48px;
      background: #fca412;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.4rem;
      font-weight: 900;
      color: #0f172a;
      flex-shrink: 0;
      box-shadow: 0 4px 12px rgba(252, 164, 18, 0.35);
    }
    .header-text h1 {
      font-size: 1.25rem;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: -0.2px;
      line-height: 1.2;
    }
    .header-text h1 span { color: #fca412; }
    .header-text p {
      font-size: 0.80rem;
      color: #94a3b8;
      font-weight: 500;
      margin-top: 3px;
    }
    .content {
      padding: 32px 28px;
    }

    /* Proposal Summary Card */
    .proposal-card {
      background: #fffbf5;
      border: 1.5px solid #fed7aa;
      border-radius: 14px;
      padding: 20px 22px;
      margin-bottom: 26px;
    }
    .proposal-card-title {
      font-size: 0.76rem;
      font-weight: 800;
      color: #c2410c;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .proposal-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px dashed #fed7aa;
      font-size: 0.90rem;
    }
    .proposal-row:last-child {
      border-bottom: none;
      padding-top: 10px;
    }
    .proposal-label {
      color: #64748b;
      font-weight: 600;
    }
    .proposal-value {
      color: #0f172a;
      font-weight: 800;
      text-align: right;
    }
    .proposal-total {
      font-size: 1.20rem;
      font-weight: 900;
      color: #16a34a;
    }

    .room-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 12px;
      padding-top: 10px;
      border-top: 1px solid #fed7aa;
    }
    .room-tag {
      background: #ffffff;
      border: 1px solid #fbd38d;
      color: #7c2d12;
      font-size: 0.72rem;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 12px;
    }

    /* Action Container */
    .action-container {
      background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
      border: 1.5px solid #cbd5e1;
      border-radius: 16px;
      padding: 26px 22px;
      margin-bottom: 24px;
      text-align: center;
      box-shadow: 0 4px 18px rgba(15, 23, 42, 0.04);
      transition: all 0.3s ease;
    }
    .action-tag {
      display: inline-block;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 20px;
      padding: 4px 14px;
      font-size: 0.74rem;
      font-weight: 800;
      color: #475569;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin-bottom: 10px;
    }
    .action-title {
      font-size: 1.15rem;
      font-weight: 900;
      color: #0f172a;
      margin-bottom: 6px;
    }
    .action-subtitle {
      font-size: 0.88rem;
      color: #475569;
      margin: 0 auto 20px auto;
      max-width: 480px;
      line-height: 1.55;
    }
    .btn-group {
      display: flex;
      gap: 14px;
      justify-content: center;
      margin: 0 auto;
      max-width: 480px;
    }
    .btn-accept {
      flex: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      background-color: #16a34a;
      background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
      color: #ffffff;
      font-size: 0.92rem;
      font-weight: 800;
      padding: 13px 24px;
      border-radius: 10px;
      text-decoration: none;
      box-shadow: 0 6px 18px rgba(22, 163, 74, 0.35);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border: 1px solid #14532d;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .btn-accept:hover {
      background: #15803d;
      transform: translateY(-1px);
    }
    .btn-reject {
      flex: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      background-color: #ffffff;
      color: #dc2626;
      font-size: 0.92rem;
      font-weight: 800;
      padding: 12px 24px;
      border-radius: 10px;
      text-decoration: none;
      box-shadow: 0 2px 8px rgba(220, 38, 38, 0.12);
      border: 2px solid #ef4444;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .btn-reject:hover {
      background: #fef2f2;
      border-color: #dc2626;
      transform: translateY(-1px);
    }

    /* Result State Card (Appears in-place, buttons disappear) */
    .result-box {
      border-radius: 14px;
      padding: 24px 20px;
      text-align: center;
      animation: fadeIn 0.4s ease forwards;
    }
    .result-accepted {
      background: #f0fdf4;
      border: 1.5px solid #86efac;
    }
    .result-rejected {
      background: #fef2f2;
      border: 1.5px solid #fca5a5;
    }
    .result-invalid {
      background: #fff1f2;
      border: 1.5px solid #fecdd3;
    }
    .result-icon {
      font-size: 2.4rem;
      line-height: 1;
      margin-bottom: 12px;
    }
    .result-heading {
      font-size: 1.25rem;
      font-weight: 900;
      margin-bottom: 8px;
    }
    .result-accepted .result-heading { color: #16a34a; }
    .result-rejected .result-heading { color: #dc2626; }
    .result-invalid .result-heading { color: #e11d48; }

    .result-message {
      font-size: 0.92rem;
      color: #334155;
      line-height: 1.6;
      max-width: 500px;
      margin: 0 auto;
    }
    .result-meta {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      align-items: center;
      gap: 12px;
      margin-top: 16px;
      padding-top: 14px;
      border-top: 1px solid rgba(0,0,0,0.06);
      font-size: 0.80rem;
      color: #64748b;
      font-weight: 600;
    }
    .badge-success {
      background: #16a34a;
      color: #ffffff;
      padding: 3px 10px;
      border-radius: 12px;
      font-weight: 800;
      font-size: 0.74rem;
      display: inline-block;
    }
    .badge-declined {
      background: #dc2626;
      color: #ffffff;
      padding: 3px 10px;
      border-radius: 12px;
      font-weight: 800;
      font-size: 0.74rem;
      display: inline-block;
    }

    .pdf-download-bar {
      margin-top: 20px;
      display: flex;
      justify-content: center;
    }
    .btn-pdf {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #ffffff;
      border: 1.5px solid #cbd5e1;
      color: #0f172a;
      font-size: 0.84rem;
      font-weight: 700;
      padding: 8px 18px;
      border-radius: 8px;
      text-decoration: none;
      transition: all 0.15s ease;
    }
    .btn-pdf:hover {
      background: #f8fafc;
      border-color: #94a3b8;
    }

    .footer {
      background: #f8fafc;
      padding: 16px 28px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 0.78rem;
      color: #94a3b8;
      line-height: 1.5;
    }
    .footer a {
      color: #fca412;
      text-decoration: none;
      font-weight: 600;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .btn-spinner {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255,255,255,0.3);
      border-radius: 50%;
      border-top-color: #ffffff;
      animation: spin 0.8s linear infinite;
      vertical-align: middle;
      margin-right: 8px;
    }

    .btn-spinner-dark {
      border: 2px solid rgba(220,38,38,0.2);
      border-top-color: #dc2626;
    }

    @media (max-width: 600px) {
      body {
        padding: 8px 4px;
      }
      .wrapper {
        margin: 0 auto;
        border-radius: 12px;
      }
      .header {
        padding: 16px 14px;
      }
      .content {
        padding: 18px 14px;
      }
      .btn-group {
        flex-direction: column;
        gap: 12px;
      }
      .btn-accept, .btn-reject {
        width: 100%;
        min-height: 48px;
        padding: 14px;
      }
    }
  </style>
</head>
<body>

<div class="wrapper">
  <!-- Brand Header -->
  <div class="header">
    <div class="logo-badge">L</div>
    <div class="header-text">
      <h1>LivinCart <span>Interiors</span></h1>
      <p>Official Quotation Proposal &bull; Digital Acknowledgement</p>
    </div>
  </div>

  <div class="content">
    <?php if ($itemType === 'quote'): ?>
      <!-- Quotation Proposal Details (The client sees their exact quotation proposal context) -->
      <div class="proposal-card">
        <div class="proposal-card-title">
          <span>Quotation Overview</span>
          <span><?= htmlspecialchars($quoteDate) ?></span>
        </div>
        <div class="proposal-row">
          <span class="proposal-label">Client Name:</span>
          <span class="proposal-value"><?= htmlspecialchars($clientName) ?></span>
        </div>
        <div class="proposal-row">
          <span class="proposal-label">Quotation Reference:</span>
          <span class="proposal-value"><?= htmlspecialchars($refId) ?></span>
        </div>
        <div class="proposal-row">
          <span class="proposal-label">Total Estimated Value:</span>
          <span class="proposal-value proposal-total"><?= htmlspecialchars($totalAmount) ?></span>
        </div>

        <?php if (!empty($sectionsList)): ?>
          <div class="room-tags">
            <?php foreach ($sectionsList as $sec): ?>
              <span class="room-tag"><?= htmlspecialchars($sec['section_name'] ?: 'Scope Item') ?></span>
            <?php endforeach; ?>
          </div>
        <?php endif; ?>
      </div>

      <!-- In-Place Action & Decision Section -->
      <?php
        $isAccepted = in_array($status, ['success', 'already_accepted'], true);
        $isRejected = in_array($status, ['rejected', 'already_rejected'], true);
      ?>
      <div class="action-container" id="decisionContainer">
        <?php if ($status === 'pending_quote'): ?>
          <!-- Interactive Decision Form: Supports both Native Form POST and AJAX -->
          <form method="POST" action="?token=<?= htmlspecialchars($token) ?>" id="decisionForm" onsubmit="return false;">
            <input type="hidden" name="token" value="<?= htmlspecialchars($token) ?>">
            <input type="hidden" name="quote_id" value="<?= htmlspecialchars($quoteId) ?>">
            <input type="hidden" name="action" id="decisionAction" value="">
            <div class="action-tag">Official Client Decision</div>
            <div class="action-title">Review &amp; Authorize Quotation</div>
            <p class="action-subtitle">
              Please review the quotation proposal and submit your official response:
            </p>
            <div class="btn-group" id="btnGroupBlock">
              <button type="button" class="btn-accept" id="btnAccept" onclick="submitDecision('accept')">
                &#10003;&nbsp; ACCEPT QUOTATION
              </button>
              <button type="button" class="btn-reject" id="btnReject" onclick="submitDecision('reject')">
                &#10005;&nbsp; REJECT QUOTATION
              </button>
            </div>
            <div id="decisionErrorMsg" style="display: none; color: #b91c1c; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px 14px; font-size: 0.84rem; font-weight: 700; margin-top: 14px; text-align: center;"></div>
            <div style="font-size: 0.76rem; color: #64748b; margin-top: 16px; line-height: 1.4;">
              🔒 Secure digital decision &bull; Once accepted, your project is officially booked and design onboarding commences automatically.
            </div>
          </form>
        <?php elseif ($isAccepted): ?>
          <!-- ACCEPTED: Only Accepted button is shown, Reject button has completely disappeared -->
          <?php if ($triedOppositeAction === 'reject'): ?>
            <div style="background: #fef2f2; border: 1.5px solid #f87171; border-radius: 12px; padding: 14px 18px; margin: 0 auto 20px auto; max-width: 520px; color: #991b1b; text-align: left; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.1);">
                <div style="font-weight: 800; font-size: 0.95rem; margin-bottom: 6px; display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 1.2rem;">⚠️</span>
                    <span>Rejection Not Allowed — Already Accepted</span>
                </div>
                <div style="font-size: 0.86rem; line-height: 1.5; color: #7f1d1d;">
                    You have already accepted this quotation on <strong><?= htmlspecialchars($acknowledgedAt ?: 'earlier') ?></strong>. Your project has been officially confirmed and locked. There is no chance or option to reject after acceptance.
                </div>
            </div>
          <?php endif; ?>
          <div style="margin-bottom: 20px;">
            <div class="btn-group" style="max-width: 320px; margin: 0 auto 16px auto;">
              <button type="button" class="btn-accept" style="cursor: default; background: #16a34a; box-shadow: 0 4px 14px rgba(22, 163, 74, 0.4); padding: 14px 28px; font-size: 1rem; width: 100%; border: none;">
                &#10003;&nbsp; ACCEPTED
              </button>
            </div>
          </div>
          <div class="result-box result-accepted">
            <div style="background: #ffffff; border: 1.5px solid #86efac; border-radius: 12px; padding: 10px 16px; margin: 0 auto 16px auto; max-width: 460px;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                        <td style="text-align: left; vertical-align: middle; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13.5px; font-weight: 800; color: #16a34a;">
                            &#10004;&nbsp; Initial Quotation Accepted &#10003;
                        </td>
                        <td style="text-align: right; vertical-align: middle;">
                            <span style="background: #16a34a; color: #ffffff; padding: 4px 10px; border-radius: 8px; font-size: 11px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">
                                ACCEPTED
                            </span>
                        </td>
                    </tr>
                </table>
            </div>
            <h2 class="result-heading" style="color: #14532d; font-size: 1.25rem; font-weight: 900; margin-bottom: 6px;"><?= htmlspecialchars($heading ?: 'Initial Quotation Proposal Accepted') ?></h2>
            <p class="result-message" style="color: #166534; font-size: 0.92rem; margin: 0 auto 14px auto;">
              <?= htmlspecialchars($message ?: 'Thank you! You have accepted the initial quotation proposal. To officially confirm your order and begin project onboarding, please complete the Stage 1: Token Advance payment with our design & sales team.') ?>
            </p>
            <div style="font-size: 0.82rem; color: #15803d; font-weight: 700; margin-bottom: 16px;">
              🔒 Locked as Initial Quotation &bull; Awaiting Stage 1 Token Advance Payment
            </div>
            <div class="result-meta">
              <span>📅 Accepted on: <?= htmlspecialchars($acknowledgedAt ?: date('d M Y, h:i A')) ?></span>
              <span class="badge-success">Initial Quote Accepted ✓</span>
            </div>
          </div>
        <?php elseif ($isRejected): ?>
          <!-- REJECTED: Only Rejected button is shown, Accept button has completely disappeared -->
          <?php if ($triedOppositeAction === 'accept'): ?>
            <div style="background: #fef2f2; border: 1.5px solid #f87171; border-radius: 12px; padding: 14px 18px; margin: 0 auto 20px auto; max-width: 520px; color: #991b1b; text-align: left; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.1);">
                <div style="font-weight: 800; font-size: 0.95rem; margin-bottom: 6px; display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 1.2rem;">⚠️</span>
                    <span>Acceptance Not Allowed — Already Declined</span>
                </div>
                <div style="font-size: 0.86rem; line-height: 1.5; color: #7f1d1d;">
                    You have already declined this quotation on <strong><?= htmlspecialchars($acknowledgedAt ?: 'earlier') ?></strong>. This quotation proposal is permanently closed and cannot be accepted.
                </div>
            </div>
          <?php endif; ?>
          <div style="margin-bottom: 20px;">
            <div class="btn-group" style="max-width: 320px; margin: 0 auto 16px auto;">
              <button type="button" class="btn-reject" style="cursor: default; background: #dc2626; color: #ffffff; border: none; box-shadow: 0 4px 14px rgba(220, 38, 38, 0.3); padding: 14px 28px; font-size: 1rem; width: 100%;">
                &#10005;&nbsp; REJECTED
              </button>
            </div>
          </div>
          <div class="result-box result-rejected">
            <div class="result-icon">❌</div>
            <h2 class="result-heading"><?= htmlspecialchars($heading ?: 'Quotation Declined') ?></h2>
            <p class="result-message">
              <?= htmlspecialchars($message ?: 'Your response has been recorded. We appreciate your consideration and hope to assist you in the future.') ?>
            </p>
            <div class="result-meta">
              <span>📅 Response recorded on: <?= htmlspecialchars($acknowledgedAt ?: date('d M Y, h:i A')) ?></span>
              <span class="badge-declined">Proposal Declined</span>
            </div>
          </div>
        <?php endif; ?>
      </div>

      <!-- Direct PDF View/Download Button -->
      <div class="pdf-download-bar">
        <a href="?token=<?= htmlspecialchars($token) ?>&download_pdf=1" target="_blank" class="btn-pdf">
          📄 View / Download Quotation PDF
        </a>
      </div>

    <?php else: ?>
      <!-- Agreement or Invalid link fallback -->
      <div class="result-box <?= $status === 'success' ? 'result-accepted' : 'result-invalid' ?>">
        <div class="result-icon"><?= $status === 'success' ? '✅' : '❌' ?></div>
        <h2 class="result-heading"><?= htmlspecialchars($heading) ?></h2>
        <p class="result-message"><?= htmlspecialchars($message) ?></p>
        <?php if ($acknowledgedAt): ?>
          <div class="result-meta">
            <span>📅 Timestamp: <?= htmlspecialchars($acknowledgedAt) ?></span>
          </div>
        <?php endif; ?>
      </div>
    <?php endif; ?>
  </div>

  <div class="footer">
    &copy; <?= date('Y') ?> LivinCart Private Limited &bull; Luxury Interiors &amp; Modulars<br>
    Support: <a href="mailto:updates@livincart.com">updates@livincart.com</a> &bull; <a href="https://livincart.com" target="_blank">livincart.com</a>
  </div>
</div>

<script>
// Flag to prevent duplicate/concurrent submissions
var isSubmittingDecision = false;

function escapeHtml(str) {
  if (!str) return '';
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderAcceptedState(data) {
  var container = document.getElementById('decisionContainer');
  if (!container) return;
  var ackTime = (data && data.acknowledgedAt) ? data.acknowledgedAt : 'Today';
  var heading = (data && data.heading) ? data.heading : 'Quotation Proposal Officially Confirmed';
  var msg = (data && data.message) ? data.message : 'Thank you! You have accepted the quotation proposal. Your project has been officially confirmed and our Admin, Design, and Sales teams have been notified!';

  var oppositeWarningHtml = '';
  if (data && data.triedOppositeAction === 'reject') {
    oppositeWarningHtml = `
      <div style="background: #fef2f2; border: 1.5px solid #f87171; border-radius: 12px; padding: 14px 18px; margin: 0 auto 20px auto; max-width: 520px; color: #991b1b; text-align: left; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.1);">
          <div style="font-weight: 800; font-size: 0.95rem; margin-bottom: 6px; display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 1.2rem;">⚠️</span>
              <span>Rejection Not Allowed — Already Accepted</span>
          </div>
          <div style="font-size: 0.86rem; line-height: 1.5; color: #7f1d1d;">
              You have already accepted this quotation on <strong>` + escapeHtml(ackTime) + `</strong>. Your project has been officially confirmed and locked. There is no chance or option to reject after acceptance.
          </div>
      </div>
    `;
  }

  container.innerHTML = oppositeWarningHtml + `
    <div style="margin-bottom: 20px;">
      <div class="btn-group" style="max-width: 320px; margin: 0 auto 16px auto;">
        <button type="button" class="btn-accept" style="cursor: default; background: #16a34a; box-shadow: 0 4px 14px rgba(22, 163, 74, 0.4); padding: 14px 28px; font-size: 1rem; width: 100%; border: none;">
          &#10003;&nbsp; ACCEPTED
        </button>
      </div>
    </div>
    <div class="result-box result-accepted" style="animation: fadeIn 0.4s ease-out;">
      <div style="background: #ffffff; border: 1.5px solid #86efac; border-radius: 12px; padding: 10px 16px; margin: 0 auto 16px auto; max-width: 460px;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                  <td style="text-align: left; vertical-align: middle; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13.5px; font-weight: 800; color: #16a34a;">
                      &#10004;&nbsp; Initial Quotation Accepted &#10003;
                  </td>
                  <td style="text-align: right; vertical-align: middle;">
                      <span style="background: #16a34a; color: #ffffff; padding: 4px 10px; border-radius: 8px; font-size: 11px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">
                          ACCEPTED
                      </span>
                  </td>
              </tr>
          </table>
      </div>
      <h2 class="result-heading" style="color: #14532d; font-size: 1.25rem; font-weight: 900; margin-bottom: 6px;">` + escapeHtml(heading) + `</h2>
      <p class="result-message" style="color: #166534; font-size: 0.92rem; margin: 0 auto 14px auto;">
        ` + escapeHtml(msg) + `
      </p>
      <div style="font-size: 0.82rem; color: #15803d; font-weight: 700; margin-bottom: 16px;">
        🔒 Locked as Initial Quotation &bull; Awaiting Stage 1 Token Advance Payment
      </div>
      <div class="result-meta">
        <span>📅 Accepted on: ` + escapeHtml(ackTime) + `</span>
        <span class="badge-success">Initial Quote Accepted ✓</span>
      </div>
    </div>
  `;
}

function renderRejectedState(data) {
  var container = document.getElementById('decisionContainer');
  if (!container) return;
  var ackTime = (data && data.acknowledgedAt) ? data.acknowledgedAt : 'Today';
  var heading = (data && data.heading) ? data.heading : 'Quotation Declined';
  var msg = (data && data.message) ? data.message : 'Your response has been recorded. We appreciate your consideration and hope to assist you in the future.';

  var oppositeWarningHtml = '';
  if (data && data.triedOppositeAction === 'accept') {
    oppositeWarningHtml = `
      <div style="background: #fef2f2; border: 1.5px solid #f87171; border-radius: 12px; padding: 14px 18px; margin: 0 auto 20px auto; max-width: 520px; color: #991b1b; text-align: left; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.1);">
          <div style="font-weight: 800; font-size: 0.95rem; margin-bottom: 6px; display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 1.2rem;">⚠️</span>
              <span>Acceptance Not Allowed — Already Declined</span>
          </div>
          <div style="font-size: 0.86rem; line-height: 1.5; color: #7f1d1d;">
              You have already declined this quotation on <strong>` + escapeHtml(ackTime) + `</strong>. This quotation proposal is permanently closed and cannot be accepted.
          </div>
      </div>
    `;
  }

  container.innerHTML = oppositeWarningHtml + `
    <div style="margin-bottom: 20px;">
      <div class="btn-group" style="max-width: 320px; margin: 0 auto 16px auto;">
        <button type="button" class="btn-reject" style="cursor: default; background: #dc2626; color: #ffffff; border: none; box-shadow: 0 4px 14px rgba(220, 38, 38, 0.3); padding: 14px 28px; font-size: 1rem; width: 100%;">
          &#10005;&nbsp; REJECTED
        </button>
      </div>
    </div>
    <div class="result-box result-rejected" style="animation: fadeIn 0.4s ease-out;">
      <div class="result-icon">❌</div>
      <h2 class="result-heading">` + escapeHtml(heading) + `</h2>
      <p class="result-message">
        ` + escapeHtml(msg) + `
      </p>
      <div class="result-meta">
        <span>📅 Response recorded on: ` + escapeHtml(ackTime) + `</span>
        <span class="badge-declined">Proposal Declined</span>
      </div>
    </div>
  `;
}

// In-place decision submission:
// 1. Shows processing state and disables both buttons (preventing double clicks).
// 2. Transmits AJAX request via POST.
// 3. Updates UI ONLY after server confirmation is received.
// 4. On error, displays helpful error and keeps buttons available for valid retry.
function submitDecision(action) {
  if (isSubmittingDecision) return;

  var container = document.getElementById('decisionContainer');
  var btnAccept = document.getElementById('btnAccept');
  var btnReject = document.getElementById('btnReject');
  var errorMsg  = document.getElementById('decisionErrorMsg');

  if (errorMsg) {
    errorMsg.style.display = 'none';
    errorMsg.textContent = '';
  }

  var origAcceptText = btnAccept ? btnAccept.innerHTML : '';
  var origRejectText = btnReject ? btnReject.innerHTML : '';

  isSubmittingDecision = true;
  if (btnAccept) btnAccept.disabled = true;
  if (btnReject) btnReject.disabled = true;

  if (action === 'accept' && btnAccept) {
    btnAccept.innerHTML = '<span class="btn-spinner"></span> Processing Acceptance...';
  } else if (action === 'reject' && btnReject) {
    btnReject.innerHTML = '<span class="btn-spinner btn-spinner-dark"></span> Processing Rejection...';
  }

  var token = <?= json_encode($token) ?>;
  var targetUrl = window.location.pathname + '?token=' + encodeURIComponent(token) + '&ajax=1';

  var formData = new FormData();
  formData.append('token', token);
  formData.append('action', action);
  formData.append('ajax', '1');

  function showError(msg) {
    if (errorMsg) {
      errorMsg.textContent = msg;
      errorMsg.style.display = 'block';
    } else {
      alert(msg);
    }
  }

  function restoreButtons() {
    isSubmittingDecision = false;
    if (btnAccept) {
      btnAccept.disabled = false;
      btnAccept.innerHTML = origAcceptText || '&#10003;&nbsp; ACCEPT QUOTATION';
    }
    if (btnReject) {
      btnReject.disabled = false;
      btnReject.innerHTML = origRejectText || '&#10005;&nbsp; REJECT QUOTATION';
    }
  }

  fetch(targetUrl, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    },
    body: formData
  })
  .then(function(res) {
    if (!res.ok) {
      throw new Error('Server returned HTTP ' + res.status);
    }
    return res.json();
  })
  .then(function(data) {
    isSubmittingDecision = false;
    if (!data || !data.success) {
      var msg = (data && data.message) ? data.message : 'Unable to record your response. Please try again.';
      showError(msg);
      restoreButtons();
      return;
    }

    if (data.accepted || data.status === 'success' || data.status === 'already_accepted') {
      renderAcceptedState(data);
    } else if (data.rejected || data.status === 'rejected' || data.status === 'already_rejected') {
      renderRejectedState(data);
    } else {
      showError(data.message || 'Unknown response. Please refresh the page.');
      restoreButtons();
    }
  })
  .catch(function(err) {
    showError('A network or server error occurred (' + (err.message || 'Request failed') + '). Please try again.');
    restoreButtons();
  });
}

// Ensure event listeners are attached to buttons
document.addEventListener('DOMContentLoaded', function() {
  var bAcc = document.getElementById('btnAccept');
  var bRej = document.getElementById('btnReject');
  if (bAcc) {
    bAcc.addEventListener('click', function(e) {
      e.preventDefault();
      submitDecision('accept');
    });
  }
  if (bRej) {
    bRej.addEventListener('click', function(e) {
      e.preventDefault();
      submitDecision('reject');
    });
  }
});
</script>

</body>
</html>
<?php
if (function_exists('fastcgi_finish_request')) {
    fastcgi_finish_request();
}
?>
