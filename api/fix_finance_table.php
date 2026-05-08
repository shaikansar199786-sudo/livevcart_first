<?php
// api/fix_finance_table.php
require_once 'config/database.php';

try {
    $db = new Database();
    $conn = $db->getConnection();

    echo "Checking finance_transactions table structure...<br>";

    // Add payment_mode if missing
    $conn->exec("ALTER TABLE finance_transactions ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(50) AFTER amount");
    echo "Column 'payment_mode' checked/added.<br>";

    // Add person_name if missing
    $conn->exec("ALTER TABLE finance_transactions ADD COLUMN IF NOT EXISTS person_name VARCHAR(100) AFTER payment_mode");
    echo "Column 'person_name' checked/added.<br>";

    echo "Success: Finance table updated successfully.";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
?>
