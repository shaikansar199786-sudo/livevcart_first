<?php
require_once 'api/config/database.php';
$database = new Database();
$db = $database->getConnection();

try {
    $db->exec("DELETE FROM team_workload_items");
    $db->exec("DELETE FROM team_workload_members");
    echo "Database cleaned successfully. Please refresh the page and try again.\n";
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
