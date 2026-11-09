<?php
require_once __DIR__ . '/../config/database.php';
$db = new Database();
$conn = $db->getConnection();

echo "=== LEADS MATCHING lvit-3 ===\n";
$stmt = $conn->query("SELECT lead_id, manual_client_id, client_name, contact_number, status, project_scope FROM leads WHERE manual_client_id LIKE '%lvit%' OR lead_id = 3");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));

echo "\n=== QUOTES RECENT 10 ===\n";
$qstmt = $conn->query("SELECT quote_id, project_id, quote_number, version, subtitle, total_amount, created_at, extra_data FROM quotes ORDER BY quote_id DESC LIMIT 10");
$quotes = $qstmt->fetchAll(PDO::FETCH_ASSOC);
foreach ($quotes as &$q) {
    if (strlen($q['extra_data'] ?? '') > 50) {
        $q['extra_data'] = substr($q['extra_data'], 0, 50) . '...';
    }
}
print_r($quotes);

echo "\n=== LEAD FILES ===\n";
$fstmt = $conn->query("SELECT * FROM lead_files ORDER BY id DESC LIMIT 10");
if ($fstmt) {
    print_r($fstmt->fetchAll(PDO::FETCH_ASSOC));
}
