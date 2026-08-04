<?php
require_once 'c:\xampp\htdocs\Livincart\api\config\database.php';

try {
    $db = new Database();
    $conn = $db->getConnection();

    // Add used_quantity if missing
    $conn->exec("ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS used_quantity DECIMAL(12, 2) DEFAULT 0 AFTER quantity");

    echo "Table 'quote_items' updated successfully with 'used_quantity' column.\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
