<?php
require 'config/database.php';
$db = new Database();
$conn = $db->getConnection();
try {
    $conn->exec("ALTER TABLE team_targets ADD COLUMN IF NOT EXISTS status ENUM('pending','in_progress','done') DEFAULT 'pending' AFTER task2");
    echo "Column 'status' added or already exists.\n";
    
    // Check structure again
    $stmt = $conn->query("DESCRIBE team_targets");
    print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
?>
