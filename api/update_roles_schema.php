<?php
require_once 'config/database.php';

try {
    $db = new Database();
    $conn = $db->getConnection();
    
    // First, update any existing 'principal_architect' users to 'admin'
    $conn->exec("UPDATE users SET role = 'admin' WHERE role = 'principal_architect'");

    // Update 'site_inspection' users to 'site_inspector'
    $conn->exec("UPDATE users SET role = 'site_inspector' WHERE role = 'site_inspection'");

    // Alter column to VARCHAR(100) so any current and future roles are supported flexibly
    $sql = "ALTER TABLE users MODIFY COLUMN role VARCHAR(100) NOT NULL DEFAULT 'manager'";
    
    $conn->exec($sql);
    echo "Database schema updated successfully for new roles.";

} catch(Exception $e) {
    echo "Error: " . $e->getMessage();
}
?>
