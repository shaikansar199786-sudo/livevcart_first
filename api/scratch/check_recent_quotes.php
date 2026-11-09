<?php
require_once __DIR__ . '/../config/database.php';
$db = new Database();
$conn = $db->getConnection();
$stmt = $conn->query("SELECT quote_id, quote_number, ack_token, ack_status, status, ack_email_sent_at FROM quotes ORDER BY quote_id DESC LIMIT 10");
echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_PRETTY_PRINT);
