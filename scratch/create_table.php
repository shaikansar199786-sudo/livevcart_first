<?php
require_once 'api/config/database.php';
$database = new Database();
$db = $database->getConnection();

try {
    $db->exec("CREATE TABLE IF NOT EXISTS team_workload_config (
        category VARCHAR(20) PRIMARY KEY,
        row_count INT DEFAULT 8
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    
    $db->exec("INSERT IGNORE INTO team_workload_config (category, row_count) VALUES ('RED', 3), ('YELLOW', 3), ('GREEN', 3)");
    
    echo "Table created and initialized successfully.\n";
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
