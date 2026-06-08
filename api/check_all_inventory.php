<?php
require_once 'config/database.php';

$db = new Database();
$conn = $db->getConnection();

// Check all inventory data
$stmt = $conn->query("SELECT vendor, invoice_no, item_name, total, paid FROM project_inventory LIMIT 20");
$results = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo "<pre>";
echo "Sample Inventory Data:\n";
print_r($results);
echo "</pre>";

// Check invoice totals grouped by vendor and invoice
$stmt2 = $conn->query("SELECT vendor, invoice_no, SUM(total) as invoice_total, SUM(paid) as total_paid, COUNT(*) as item_count FROM project_inventory GROUP BY vendor, invoice_no ORDER BY invoice_total DESC LIMIT 10");
$invoiceTotals = $stmt2->fetchAll(PDO::FETCH_ASSOC);

echo "<pre>";
echo "Invoice Totals (grouped by vendor + invoice):\n";
print_r($invoiceTotals);
echo "</pre>";
?>
