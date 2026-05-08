<?php
require 'config/database.php';
$db = new Database();
$conn = $db->getConnection();
try {
    $conn->exec("ALTER TABLE projects MODIFY COLUMN status ENUM('Pending', 'Completed', 'On Going', 'Cancelled') DEFAULT 'Pending'");
    echo "Projects table updated successfully.\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
?>
