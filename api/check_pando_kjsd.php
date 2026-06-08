<?php
require 'config/database.php';
$database = new Database();
$conn = $database->getConnection();

// Check kjsd vendor data for Pando Holdings project only
$stmt = $conn->query("SELECT pi.*, p.project_name FROM project_inventory pi JOIN projects p ON pi.project_id = p.project_id WHERE pi.vendor LIKE '%kjsd%' AND p.project_name LIKE '%Pando%'");
$results = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo "=== KJSD Vendor Data for Pando Holdings ===\n";
echo json_encode($results, JSON_PRETTY_PRINT);

// Calculate what the invoice total should be
$total = 0;
foreach ($results as $row) {
    $total += floatval($row['total']);
}
echo "\n\n=== Calculated Total from 'total' field for Pando Holdings ===\n";
echo "Total: ₹" . number_format($total, 2);

// Check invoice numbers
echo "\n\n=== Invoice Numbers for Pando Holdings ===\n";
foreach ($results as $row) {
    echo "Invoice No: " . ($row['invoice_no'] ?? 'NULL') . " - Total: " . $row['total'] . " - Item: " . $row['item_name'] . "\n";
}
