<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../controllers/QuoteController.php';

$db = new Database();
$conn = $db->getConnection();
$qc = new QuoteController($conn, 1, 'admin');

// Pick a test quote or quote 319
$stmt = $conn->query("SELECT quote_id, quote_number, total_amount FROM quotes WHERE quote_id = 319");
$q = $stmt->fetch(PDO::FETCH_ASSOC);

echo "Quote 319:\n";
print_r($q);

// Reset quote 319 ack status to test clean flow
$conn->query("UPDATE quotes SET ack_status = NULL, acknowledged_at = NULL, is_initial = 0 WHERE quote_id = 319");

echo "Testing sendAckEmail...\n";
$sendRes = $qc->sendAckEmail([
    'quote_id' => 319,
    'quote_number' => $q['quote_number'],
    'client_email' => 'updates@livincart.com', // safe test email
    'client_name' => 'Test Client'
]);
echo "sendAckEmail result: " . json_encode($sendRes) . "\n";

// Check extra_data
$stmt2 = $conn->query("SELECT extra_data FROM quotes WHERE quote_id = 319");
$ex = json_decode($stmt2->fetchColumn() ?: '{}', true);
echo "Recorded extra_data:\n";
echo "Message ID: " . ($ex['last_email_message_id'] ?? 'NONE') . "\n";
echo "Subject: " . ($ex['last_email_subject'] ?? 'NONE') . "\n";
