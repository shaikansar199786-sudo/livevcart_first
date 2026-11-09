<?php
require_once __DIR__ . '/../config/database.php';
$db = new Database();
$conn = $db->getConnection();
$stmt = $conn->query("SELECT quote_id, quote_number, subtitle, status, ack_status, is_initial, ack_token, ack_email_sent_at, acknowledged_at, extra_data FROM quotes ORDER BY quote_id DESC LIMIT 5");
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
foreach ($rows as $r) {
    echo "ID: {$r['quote_id']} | Number: {$r['quote_number']} | Status: {$r['status']} | AckStatus: {$r['ack_status']} | Initial: {$r['is_initial']} | Token: {$r['ack_token']}\n";
    echo "SentAt: {$r['ack_email_sent_at']} | AckAt: {$r['acknowledged_at']}\n";
    echo "Extra: " . substr($r['extra_data'] ?? '', 0, 300) . "\n\n";
}
