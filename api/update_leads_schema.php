<?php
require_once 'config/database.php';

try {
    $db = new Database();
    $conn = $db->getConnection();
    
    // Add columns if they don't exist
    $sql1 = "ALTER TABLE leads ADD COLUMN manual_client_id VARCHAR(100) DEFAULT NULL AFTER lead_id";
    $sql2 = "ALTER TABLE leads ADD COLUMN project_scope VARCHAR(255) DEFAULT NULL AFTER project_type";
    
    try {
        $conn->exec($sql1);
        echo "Added manual_client_id. \n";
    } catch(PDOException $e) {
        echo "manual_client_id may already exist or error: " . $e->getMessage() . "\n";
    }
    
    try {
        $conn->exec($sql2);
        echo "Added project_scope. \n";
    } catch(PDOException $e) {
        echo "project_scope may already exist or error: " . $e->getMessage() . "\n";
    }

    echo "Schema update completed.";

} catch(Exception $e) {
    echo "Error: " . $e->getMessage();
}
?>
