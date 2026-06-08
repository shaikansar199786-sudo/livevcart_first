<?php
// Add subtitle column to quotes table if it doesn't exist
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: application/json');

require 'config/database.php';
$database = new Database();
$conn = $database->getConnection();

try {
    // Check if column exists
    $stmt = $conn->query("SHOW COLUMNS FROM quotes LIKE 'subtitle'");
    $columnExists = $stmt->fetch();
    
    if (!$columnExists) {
        // Add the column
        $conn->query("ALTER TABLE quotes ADD COLUMN subtitle VARCHAR(255) DEFAULT NULL AFTER project_id");
        echo json_encode([
            "success" => true,
            "message" => "subtitle column added successfully"
        ]);
    } else {
        echo json_encode([
            "success" => true,
            "message" => "subtitle column already exists"
        ]);
    }
} catch (Exception $e) {
    echo json_encode([
        "success" => false,
        "message" => "Error: " . $e->getMessage()
    ]);
}
