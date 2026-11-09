<?php
require_once __DIR__ . '/../config/database.php';
$db = new Database();
$conn = $db->getConnection();

echo "=== QUOTES FOR 90 OR lvit-3 ===\n";
$stmt = $conn->query("SELECT quote_id, project_id, quote_number, version, subtitle, total_amount, created_at, updated_at FROM quotes WHERE project_id = 90 OR project_id = '90' OR project_id = 'lvit-3' OR quote_number LIKE '%lvit-3%'");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));

echo "\n=== QUOTES WITH lvit IN GENERAL ===\n";
$stmt2 = $conn->query("SELECT quote_id, project_id, quote_number, version, subtitle, total_amount, created_at, updated_at FROM quotes WHERE quote_number LIKE '%lvit%' OR project_id LIKE '%lvit%'");
print_r($stmt2->fetchAll(PDO::FETCH_ASSOC));
