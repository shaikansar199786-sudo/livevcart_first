<?php
require_once 'c:\xampp\htdocs\Livincart\api\config\database.php';

try {
    $db = new Database();
    $conn = $db->getConnection();

    // Update status ENUM to include budgeted and used
    $conn->exec("ALTER TABLE quotes MODIFY COLUMN status ENUM('draft', 'sent', 'approved', 'rejected', 'budgeted', 'used') DEFAULT 'budgeted'");

    // Also fix any existing empty statuses to 'budgeted' for Project ID 9 (or all if appropriate)
    $conn->exec("UPDATE quotes SET status = 'budgeted' WHERE status = '' OR status IS NULL");

    echo "Database ENUM values updated and existing records fixed.\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
