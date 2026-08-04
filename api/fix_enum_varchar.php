<?php
require_once 'config/database.php';

try {
    $db = new Database();
    $conn = $db->getConnection();
    
    $conn->exec("ALTER TABLE leads MODIFY COLUMN project_type VARCHAR(255) DEFAULT NULL");
    $conn->exec("ALTER TABLE leads MODIFY COLUMN lead_source VARCHAR(255) DEFAULT NULL");
    $conn->exec("ALTER TABLE projects MODIFY COLUMN project_type VARCHAR(255) DEFAULT NULL");
    $conn->exec("ALTER TABLE clients MODIFY COLUMN lead_source VARCHAR(255) DEFAULT NULL");
    
    echo "Columns converted to VARCHAR.";

} catch(Exception $e) {
    echo "Error: " . $e->getMessage();
}
?>
