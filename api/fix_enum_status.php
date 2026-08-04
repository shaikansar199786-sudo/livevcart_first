<?php
require_once __DIR__ . '/config.php';

try {
    $db = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME, DB_USER, DB_PASS);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Change status from ENUM to VARCHAR
    $db->exec("ALTER TABLE leads MODIFY COLUMN status VARCHAR(255) DEFAULT 'enquiry'");
    echo "Successfully updated leads table status to VARCHAR.\n";

} catch (PDOException $e) {
    echo "Database Error: " . $e->getMessage() . "\n";
}
?>
