<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/AmpQuoteEmailBuilder.php';

$db = new Database();
$conn = $db->getConnection();
$stmt = $conn->query("SELECT * FROM quotes WHERE quote_id = 331");
$q = $stmt->fetch(PDO::FETCH_ASSOC);

$ampHtml = AmpQuoteEmailBuilder::buildAmpEmail(
    $q,
    $q['ack_token'],
    'https://livincart.com/api/acknowledge.php'
);

file_put_contents(__DIR__ . '/quote_331_amp.html', $ampHtml);
echo "Generated quote_331_amp.html. Length: " . strlen($ampHtml) . " bytes\n";
