<?php
require_once 'config/database.php';

try {
    $db = new Database();
    $conn = $db->getConnection();
    
    $sql = "ALTER TABLE leads ADD COLUMN client_address TEXT DEFAULT NULL AFTER location";
    
    try {
        $conn->exec($sql);
        echo "Added client_address. \n";
    } catch(PDOException $e) {
        echo "client_address may already exist or error: " . $e->getMessage() . "\n";
    }

    echo "Schema update completed.";

} catch(Exception $e) {
    echo "Error: " . $e->getMessage();
}
?>
