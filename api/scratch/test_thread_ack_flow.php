<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../controllers/QuoteController.php';

$db = new Database();
$conn = $db->getConnection();

echo "=== STEP 1: Verify recent quote 330 data ===\n";
$stmt = $conn->query("SELECT quote_id, quote_number, ack_token, extra_data FROM quotes WHERE quote_id = 330");
$q = $stmt->fetch(PDO::FETCH_ASSOC);
echo "Quote 330 Token: " . ($q['ack_token'] ?? 'NONE') . "\n";

// Set last_email_message_id and last_email_subject on quote 330 if not present
$ex = json_decode($q['extra_data'] ?? '{}', true) ?: [];
if (empty($ex['last_email_message_id'])) {
    $ex['last_email_message_id'] = '<test-proposal-msg-id-330@livincart.com>';
    $ex['last_email_subject'] = 'Official Quotation #Livincart-QT-B-1791289158-v2 for test_7 - Livincart Interiors';
    $conn->prepare("UPDATE quotes SET extra_data = :ex WHERE quote_id = 330")->execute([':ex' => json_encode($ex)]);
    echo "Updated quote 330 extra_data with sample message_id and subject for testing.\n";
}

echo "\n=== STEP 2: Test acknowledge.php for Quote 330 with action=accept ===\n";
// Simulate request to acknowledge.php
$_GET['token'] = $q['ack_token'];
$_GET['action'] = 'accept';
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
$_SERVER['HTTP_HOST'] = 'localhost';

ob_start();
require __DIR__ . '/../acknowledge.php';
$htmlOutput = ob_get_clean();

echo "Acknowledge HTML rendered (" . strlen($htmlOutput) . " bytes).\n";
$hasConfirmedBadge = strpos($htmlOutput, 'Quotation Accepted Successfully') !== false;
$hasReturnToEmail = strpos($htmlOutput, 'Return to Email Thread') !== false;
$hasIntentLink = strpos($htmlOutput, 'intent://mail') !== false;
$hasNoAcceptBtn = strpos($htmlOutput, 'btn-accept') === false;

echo "Has Confirmed Badge: " . ($hasConfirmedBadge ? 'YES' : 'NO') . "\n";
echo "Has Return To Email Thread: " . ($hasReturnToEmail ? 'YES' : 'NO') . "\n";
echo "Has Intent Link: " . ($hasIntentLink ? 'YES' : 'NO') . "\n";
echo "Buttons Gone: " . ($hasNoAcceptBtn ? 'YES' : 'NO') . "\n";

echo "\n=== STEP 3: Verify Quote 330 Status in DB ===\n";
$stmt2 = $conn->query("SELECT quote_id, status, ack_status, is_initial, acknowledged_at FROM quotes WHERE quote_id = 330");
$updatedQ = $stmt2->fetch(PDO::FETCH_ASSOC);
print_r($updatedQ);
