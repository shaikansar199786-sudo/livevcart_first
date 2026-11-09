<?php
require_once __DIR__ . '/../config/database.php';

$db = new Database();
$conn = $db->getConnection();
$stmt = $conn->query("SELECT quote_id, quote_number, ack_token FROM quotes WHERE quote_id = 319");
$q = $stmt->fetch(PDO::FETCH_ASSOC);

echo "Simulating Accept for quote 319...\n";
$_GET['token'] = $q['ack_token'];
$_GET['action'] = 'accept';
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
$_SERVER['HTTP_HOST'] = 'localhost';

ob_start();
require __DIR__ . '/../acknowledge.php';
$html = ob_get_clean();

echo "Acknowledged quote 319 successfully!\n";
$stmt2 = $conn->query("SELECT quote_id, status, ack_status, is_initial FROM quotes WHERE quote_id = 319");
print_r($stmt2->fetch(PDO::FETCH_ASSOC));
