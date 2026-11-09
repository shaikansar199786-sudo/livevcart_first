<?php
require_once __DIR__ . '/../config/database.php';
$db = new Database();
$conn = $db->getConnection();
$stmt = $conn->query("SELECT quote_id, quote_number, ack_token, ack_status FROM quotes WHERE ack_token IS NOT NULL AND ack_token != '' ORDER BY quote_id DESC LIMIT 1");
$row = $stmt->fetch(PDO::FETCH_ASSOC);
echo json_encode($row);
