<?php
require_once __DIR__ . '/../config/database.php';
$db = new Database();
$conn = $db->getConnection();
$stmt = $conn->query("SELECT quote_id, quote_number, ack_token FROM quotes WHERE quote_id = 330");
$q = $stmt->fetch(PDO::FETCH_ASSOC);

$_GET['token'] = $q['ack_token'];
unset($_GET['action']); // Access without action to see what state is rendered
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
$_SERVER['HTTP_HOST'] = 'localhost';

ob_start();
require __DIR__ . '/../acknowledge.php';
$html = ob_get_clean();

// Check if decisionContainer contains buttons or confirmed card
preg_match('/<div class="action-container" id="decisionContainer">(.*?)<\/div>/s', $html, $m);
$decisionHtml = $m[1] ?? '';
echo "Decision Container Content:\n" . trim($decisionHtml) . "\n";
