<?php
// Simple database connection test
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: application/json');

try {
    require 'config/database.php';
    $database = new Database();
    $conn = $database->getConnection();
    
    if ($conn) {
        echo json_encode([
            "success" => true,
            "message" => "Database connection successful",
            "database_info" => [
                "host" => DB_HOST,
                "database" => DB_NAME,
                "user" => DB_USER,
                "production" => IS_PRODUCTION ? "true" : "false"
            ]
        ]);
        
        // Test a simple query
        $stmt = $conn->query("SELECT COUNT(*) as count FROM users");
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        echo json_encode([
            "users_count" => $result['count']
        ]);
    }
} catch (Exception $e) {
    echo json_encode([
        "success" => false,
        "message" => $e->getMessage(),
        "database_info" => [
            "host" => DB_HOST,
            "database" => DB_NAME,
            "user" => DB_USER,
            "production" => defined('IS_PRODUCTION') ? (IS_PRODUCTION ? "true" : "false") : "not defined"
        ]
    ]);
}
