<?php
require_once __DIR__ . '/../config/database.php';
$db = new Database();
$conn = $db->getConnection();

echo "=== ALL QUOTES WITH lvit OR 90 OR test_3 ===\n";
$stmt = $conn->query("SELECT quote_id, project_id, quote_number, version, subtitle, total_amount, created_at, updated_at FROM quotes WHERE quote_number LIKE '%lvit%' OR project_id = 90 OR project_id = 'lvit-3' OR subtitle LIKE '%test_3%' OR subtitle LIKE '%lvit%'");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));

echo "\n=== ALL PROJECTS WITH lvit OR 90 OR test_3 ===\n";
$pstmt = $conn->query("SELECT * FROM projects WHERE project_id = 90 OR project_code LIKE '%lvit%' OR project_name LIKE '%test_3%'");
print_r($pstmt->fetchAll(PDO::FETCH_ASSOC));

echo "\n=== ALL LEADS ===\n";
$lstmt = $conn->query("SELECT lead_id, manual_client_id, client_name FROM leads WHERE lead_id IN (88, 89, 90, 91, 92, 93, 94)");
print_r($lstmt->fetchAll(PDO::FETCH_ASSOC));
