<?php
require 'config/database.php';
$database = new Database();
$conn = $database->getConnection();

// Check kjsd vendor data specifically
$stmt = $conn->query("SELECT * FROM project_inventory WHERE vendor LIKE '%kjsd%' OR vendor LIKE '%KJSD%'");
$results = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo "=== KJSD Vendor Data ===\n";
echo json_encode($results, JSON_PRETTY_PRINT);

// Calculate what the invoice total should be
$total = 0;
foreach ($results as $row) {
    $total += floatval($row['total']);
}
echo "\n\n=== Calculated Total from 'total' field ===\n";
echo "Total: ₹" . number_format($total, 2);

// Check if there's an invoice_no field
echo "\n\n=== Invoice Numbers ===\n";
foreach ($results as $row) {
    echo "Invoice No: " . ($row['invoice_no'] ?? 'NULL') . " - Total: " . $row['total'] . "\n";
}
