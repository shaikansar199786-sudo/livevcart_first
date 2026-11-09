<?php
// Script to add incentive column to finance_transactions table
require_once 'api/config/database.php';

try {
    $conn = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME, DB_USER, DB_PASS);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    echo "Connecting to database: " . DB_NAME . "<br>";
    
    // Check if column already exists
    $check = $conn->query("SHOW COLUMNS FROM finance_transactions LIKE 'incentive'");
    if ($check->rowCount() > 0) {
        echo "Column 'incentive' already exists in finance_transactions table.<br>";
    } else {
        // Add the column
        $sql = "ALTER TABLE finance_transactions ADD COLUMN incentive DECIMAL(15, 2) DEFAULT NULL AFTER recorded_by";
        $conn->exec($sql);
        echo "SUCCESS: Column 'incentive' added to finance_transactions table.<br>";
    }
    
    // Verify the column was added
    $verify = $conn->query("SHOW COLUMNS FROM finance_transactions LIKE 'incentive'");
    if ($verify->rowCount() > 0) {
        echo "VERIFIED: Column 'incentive' exists in the table.<br>";
    }
    
} catch(PDOException $e) {
    echo "ERROR: " . $e->getMessage() . "<br>";
}
?>
