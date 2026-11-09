<?php
// api/helpers/async_email_worker.php
// Standalone asynchronous background worker to send quote notifications without blocking client HTTP response

if (php_sapi_name() !== 'cli' && empty($_SERVER['HTTP_X_INTERNAL_WORKER'])) {
    http_response_code(403);
    exit('Direct access not permitted');
}

// Ignore user abort and set no time limit
ignore_user_abort(true);
set_time_limit(120);

$jobFile = $argv[1] ?? '';
if (empty($jobFile) || !file_exists($jobFile)) {
    exit(0);
}

$rawJson = @file_get_contents($jobFile);
@unlink($jobFile);

if (empty($rawJson)) {
    exit(0);
}

$data = json_decode($rawJson, true);
if (!is_array($data)) {
    exit(0);
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/MailHelper.php';

try {
    $db = new Database();
    $conn = $db->getConnection();
} catch (Exception $dbEx) {
    error_log("async_email_worker DB connection error: " . $dbEx->getMessage());
    exit(1);
}

$quoteId         = intval($data['quote_id'] ?? 0);
$leadIdToConvert = intval($data['lead_id'] ?? 0);
$clientName      = $data['client_name'] ?? 'Valued Client';
$clientEmail     = $data['client_email'] ?? '';
$refId           = $data['ref_id'] ?? ('QT-' . $quoteId);
$quoteAmt        = floatval($data['quote_amt'] ?? 0);
$dName           = $data['designer_name'] ?? 'Designer';
$dEmail          = $data['designer_email'] ?? null;
$sName           = $data['sales_name'] ?? 'Sales Team';
$sEmail          = $data['sales_email'] ?? null;
$origSubject     = $data['orig_subject'] ?? null;
$origMessageId   = $data['orig_message_id'] ?? null;

// 1. Send Initial Quote Accepted Notification to Admin, Project Manager, Designer, and Sales
try {
    MailHelper::sendInitialQuoteAcceptedNotification($conn, [
        'quote_id'         => $quoteId,
        'ref_id'           => $refId,
        'client_name'      => $clientName,
        'client_email'     => filter_var($clientEmail, FILTER_VALIDATE_EMAIL) ? $clientEmail : null,
        'designer_name'    => $dName,
        'designer_email'   => $dEmail,
        'sales_name'       => $sName,
        'sales_email'      => $sEmail,
        'quote_amt'        => $quoteAmt,
        'total_budget'     => $quoteAmt,
        'lead_id'          => $leadIdToConvert
    ]);
} catch (Exception $noticeEx) {
    error_log("async_email_worker initial quote notice error: " . $noticeEx->getMessage());
}

// 2. Send Initial Quote Acceptance Confirmation to Client in the same email conversation thread
if (!empty($clientEmail) && filter_var($clientEmail, FILTER_VALIDATE_EMAIL)) {
    try {
        if (!empty($origSubject)) {
            $cleanSubj = trim(preg_replace('/^(re:\s*)+/i', '', $origSubject));
            $subjClientQuote = 'Re: ' . $cleanSubj;
        } else {
            $subjClientQuote = 'Re: Initial Quotation Proposal Accepted #' . $refId . ' for ' . $clientName . ' - Livincart Interiors';
        }

        $formattedAmount = '₹' . number_format($quoteAmt, 2);

        $bodyClientQuote = '
        <p style="font-size: 1.02rem; font-weight: 700; color: #0f172a; margin: 0 0 12px 0;">Dear ' . htmlspecialchars($clientName) . ',</p>
        <p style="font-size: 0.95rem; color: #334155; line-height: 1.6; margin: 0 0 20px 0;">
            Thank you for reviewing and accepting your initial quotation proposal. Your proposal acceptance has been officially recorded in our system.
        </p>
        <div style="background: linear-gradient(180deg, #f0fdf4 0%, #dcfce7 100%); border: 2px solid #16a34a; border-radius: 14px; padding: 24px 20px; margin: 20px 0; text-align: center; box-shadow: 0 4px 16px rgba(22, 163, 74, 0.12);">
            <div style="margin-bottom: 16px;">
                <div style="display: inline-block; background: #16a34a; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; font-weight: 800; padding: 13px 36px; border-radius: 10px; box-shadow: 0 4px 14px rgba(220, 38, 38, 0); text-transform: uppercase; letter-spacing: 0.5px;">
                    &#10003;&nbsp; INITIAL QUOTE ACCEPTED
                </div>
            </div>
            <div style="background: #ffffff; border: 1.5px solid #86efac; border-radius: 12px; padding: 10px 16px; margin: 0 auto 16px auto; max-width: 460px;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                        <td style="text-align: left; vertical-align: middle; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif; font-size: 13.5px; font-weight: 800; color: #16a34a;">
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
            <div style="font-size: 1.22rem; font-weight: 900; color: #14532d; margin-bottom: 6px;">
                Initial Quotation Proposal Accepted
            </div>
            <p style="font-size: 0.92rem; color: #166534; margin: 0 auto 16px auto; max-width: 480px; line-height: 1.55;">
                Thank you! You have accepted the initial quotation proposal. Your acceptance has been registered with our Admin, Design, and Sales teams.
            </p>
            <div style="font-size: 0.82rem; color: #15803d; font-weight: 700; margin-bottom: 14px;">
                🔒 Locked as Initial Quotation &bull; Awaiting Stage 1 Token Advance Payment
            </div>
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto; background: #ffffff; border-radius: 10px; padding: 12px 20px; border: 1px solid #bbf7d0;">
                <tr>
                    <td style="font-size: 0.85rem; color: #166534; font-weight: 700;">Accepted Amount:</td>
                    <td style="font-size: 1.15rem; color: #16a34a; font-weight: 900; padding-left: 14px;">' . $formattedAmount . '</td>
                </tr>
                <tr>
                    <td style="font-size: 0.85rem; color: #166534; font-weight: 700; padding-top: 6px;">Status:</td>
                    <td style="font-size: 0.9rem; color: #15803d; font-weight: 800; padding-left: 14px; padding-top: 6px;">Initial Quote Accepted (Stage 1 Payment Pending)</td>
                </tr>
            </table>
        </div>
        <p style="font-size: 0.92rem; color: #334155; line-height: 1.6; margin: 20px 0 0 0;">
            <b>What happens next to confirm your order?</b><br>
            &bull; To officially confirm your order and begin project design onboarding, please complete the <b>Stage 1: Token Advance Payment</b> with our sales team.<br>
            &bull; Once 100% of your Stage 1 Token Advance is verified, your project will be officially confirmed/booked, and site kick-off will begin.<br><br>
            A copy of your confirmed initial quotation document is attached to this email for your records.
        </p>';

        // Resolve PDF binary for attachment
        $pdfData = '';
        if ($quoteId > 0) {
            $qStmt = $conn->prepare("SELECT quote_id, quote_number, project_id, subtitle, total_amount, pdf_snapshot, extra_data FROM quotes WHERE quote_id = :qid LIMIT 1");
            $qStmt->execute([':qid' => $quoteId]);
            $qRow = $qStmt->fetch(PDO::FETCH_ASSOC);
            if ($qRow) {
                if (!empty($qRow['pdf_snapshot']) && strlen($qRow['pdf_snapshot']) > 1000) {
                    $pdfData = $qRow['pdf_snapshot'];
                } else {
                    try {
                        require_once __DIR__ . '/SimplePdfBuilder.php';
                        $pdfData = \SimplePdfBuilder::generateQuotePdfBinary($qRow);
                    } catch (Exception $ePdf) {}
                }
            }
        }

        $quoteAtt = [];
        if (!empty($pdfData)) {
            $quoteAtt[] = [
                'binary' => $pdfData,
                'name'   => 'Quotation_' . preg_replace('/[^a-zA-Z0-9_-]/', '', $refId) . '.pdf',
                'mime'   => 'application/pdf'
            ];
        }

        $customHeaders = [];
        if (!empty($origMessageId)) {
            $customHeaders['In-Reply-To'] = $origMessageId;
            $customHeaders['References'] = $origMessageId;
        }

        MailHelper::sendMail(
            $clientEmail,
            $subjClientQuote,
            $bodyClientQuote,
            $quoteAtt,
            $customHeaders
        );
    } catch (Exception $mailEx) {
        error_log("async_email_worker client confirmation error: " . $mailEx->getMessage());
    }
}
