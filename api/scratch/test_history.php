<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../controllers/QuoteController.php';

$db = new Database();
$conn = $db->getConnection();
$qc = new QuoteController($conn);

echo "=== HISTORY FOR 90 ===\n";
print_r($qc->getQuoteHistory(90));

echo "\n=== HISTORY FOR lvit-3 ===\n";
print_r($qc->getQuoteHistory('lvit-3'));

echo "\n=== HISTORY FOR lead_90 ===\n";
print_r($qc->getQuoteHistory('lead_90'));
