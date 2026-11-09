<?php
require_once 'config/database.php';
$db = new Database();
$conn = $db->getConnection();
try {
    $conn->exec("ALTER TABLE project_assignments MODIFY COLUMN role VARCHAR(100) NOT NULL");
    echo "SUCCESS: project_assignments role modified to VARCHAR(100)\n";
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
