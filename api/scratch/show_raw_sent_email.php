<?php
require_once __DIR__ . '/../libs/AmpPHPMailer.php';
require_once __DIR__ . '/../helpers/AmpQuoteEmailBuilder.php';

$mail = new AmpPHPMailer();
$mail->isSMTP();
$mail->setFrom('updates@livincart.com', 'LivinCart Quotations');
$mail->addAddress('client@example.com', 'Shaik Salman');
$mail->Subject = 'Quotation Acknowledgement Request — QTN-lvit-2 | LivinCart';
$mail->isHTML(true);

$quoteData = [
    'quote_id' => 320,
    'quote_number' => 'QTN-lvit-2',
    'client_name' => 'Shaik Salman',
    'total_amount' => 8750.00
];
$token = '5c0bbdaec931690867be12fbcc108dc3df5273e830d07bcb465ad4462b2fd9e6';
$endpoint = 'https://livincart.com/api/acknowledge.php';
$acceptUrl = $endpoint . '?token=' . $token . '&action=accept';
$rejectUrl = $endpoint . '?token=' . $token . '&action=reject';

$mail->AltBody = "Dear Shaik Salman,\nPlease review and respond to your LivinCart quotation proposal (QTN-lvit-2):\nAccept: {$acceptUrl}\nReject: {$rejectUrl}";
$mail->AmpBody = AmpQuoteEmailBuilder::buildAmpEmail($quoteData, $token, $endpoint);
$mail->Body    = "<!DOCTYPE html><html><body><h2>Quotation Proposal QTN-lvit-2</h2><p><a href=\"{$acceptUrl}\">ACCEPT</a> | <a href=\"{$rejectUrl}\">REJECT</a></p></body></html>";

// Add sample PDF attachment
$mail->addStringAttachment("%PDF-1.4 sample pdf binary data", "Quotation_QTN-lvit-2.pdf", "base64", "application/pdf");

$mail->preSend();

$rawHeaders = $mail->createHeader();
$rawBody = $mail->createBody();

echo "==================== FULL RAW SENT EMAIL HEADERS ====================\n";
echo trim($rawHeaders) . "\n\n";

echo "==================== RAW EMAIL MIME STRUCTURE SAMPLES ====================\n";
// Print boundary headers and first few lines of each MIME part
$lines = explode("\n", $rawBody);
$isPrinting = false;
$printedLines = 0;
foreach ($lines as $line) {
    if (strpos($line, '--b') === 0 || strpos($line, 'Content-Type:') === 0 || strpos($line, 'Content-Transfer-Encoding:') === 0 || strpos($line, 'Content-Disposition:') === 0) {
        echo $line . "\n";
    }
}

echo "\n==================== EXACT POSITION CHECKS ====================\n";
$posPlain = strpos($rawBody, 'Content-Type: text/plain');
$posAmp   = strpos($rawBody, 'Content-Type: text/x-amp-html');
$posHtml  = strpos($rawBody, 'Content-Type: text/html');
$posPdf   = strpos($rawBody, 'Content-Type: application/pdf');

echo "Position text/plain:       {$posPlain}\n";
echo "Position text/x-amp-html:  {$posAmp}\n";
echo "Position text/html:        {$posHtml}\n";
echo "Position application/pdf:  {$posPdf}\n";

$isStrictOrder = ($posPlain < $posAmp) && ($posAmp < $posHtml) && ($posHtml < $posPdf);
echo "\nMIME Order Strict Compliance: " . ($isStrictOrder ? "PASS (text/plain < text/x-amp-html < text/html < application/pdf)" : "FAIL") . "\n";

$fromCheck = (strpos($rawHeaders, 'From: LivinCart Quotations <updates@livincart.com>') !== false || strpos($rawHeaders, 'From: updates@livincart.com') !== false);
echo "From Header Check (updates@livincart.com): " . ($fromCheck ? "PASS" : "FAIL") . "\n";
