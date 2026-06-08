<?php
// Check if required tables exist
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: application/json');

try {
    require 'config/database.php';
    $database = new Database();
    $conn = $database->getConnection();
    
    if ($conn) {
        // Get all tables
        $stmt = $conn->query("SHOW TABLES");
        $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
        
        $required_tables = ['users', 'projects', 'clients', 'leads', 'project_inventory', 'finance_transactions'];
        $missing_tables = [];
        
        foreach ($required_tables as $table) {
            if (!in_array($table, $tables)) {
                $missing_tables[] = $table;
            }
        }
        
        echo json_encode([
            "success" => true,
            "total_tables" => count($tables),
            "tables" => $tables,
            "missing_tables" => $missing_tables,
            "all_required_exist" => empty($missing_tables)
        ]);
    }
} catch (Exception $e) {
    echo json_encode([
        "success" => false,
        "message" => $e->getMessage()
    ]);
}
