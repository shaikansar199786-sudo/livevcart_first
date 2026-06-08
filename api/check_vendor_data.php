<?php
require 'config/database.php';
$database = new Database();
$conn = $database->getConnection();

// Check kjsd vendor data
$stmt = $conn->query("SELECT * FROM project_inventory WHERE vendor LIKE '%kjsd%' OR vendor LIKE '%KJSD%'");
$results = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo "=== KJSD Vendor Data ===\n";
echo json_encode($results, JSON_PRETTY_PRINT);

// Check Pando Holdings project
$stmt2 = $conn->query("SELECT p.project_name, pi.* FROM project_inventory pi JOIN projects p ON pi.project_id = p.project_id WHERE p.project_name LIKE '%Pando%' ORDER BY pi.invoice_date DESC");
$pandoResults = $stmt2->fetchAll(PDO::FETCH_ASSOC);

echo "\n\n=== Pando Holdings Project Inventory ===\n";
echo json_encode($pandoResults, JSON_PRETTY_PRINT);
