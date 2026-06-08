<?php
require_once 'config/database.php';

$db = new Database();
$conn = $db->getConnection();

// Check Pando Holdings data
$stmt = $conn->query("SELECT * FROM project_inventory WHERE vendor LIKE '%Pando%' LIMIT 10");
$results = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo "<pre>";
echo "Pando Holdings Inventory Data:\n";
print_r($results);
echo "</pre>";

// Check invoice totals
$stmt2 = $conn->query("SELECT vendor, invoice_no, SUM(total) as invoice_total, COUNT(*) as item_count FROM project_inventory WHERE vendor LIKE '%Pando%' GROUP BY vendor, invoice_no");
$invoiceTotals = $stmt2->fetchAll(PDO::FETCH_ASSOC);

echo "<pre>";
echo "Invoice Totals for Pando Holdings:\n";
print_r($invoiceTotals);
echo "</pre>";
?>
