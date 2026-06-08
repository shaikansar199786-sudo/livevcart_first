<?php
require_once 'api/config/database.php';
$database = new Database();
$db = $database->getConnection();

echo "--- MEMBERS ---\n";
$stmt = $db->query("SELECT * FROM team_workload_members");
$members = $stmt->fetchAll(PDO::FETCH_ASSOC);
print_r($members);

echo "\n--- ITEMS ---\n";
$stmt = $db->query("SELECT * FROM team_workload_items");
$items = $stmt->fetchAll(PDO::FETCH_ASSOC);
print_r($items);

echo "\n--- CONFIG ---\n";
$stmt = $db->query("SELECT * FROM team_workload_config");
$config = $stmt->fetchAll(PDO::FETCH_ASSOC);
print_r($config);
