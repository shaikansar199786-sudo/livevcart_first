<?php
// Add transaction_date column to monthly_income table if it doesn't exist
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: application/json');

require 'config/database.php';
$database = new Database();
$conn = $database->getConnection();

try {
    // Check if column exists
    $stmt = $conn->query("SHOW COLUMNS FROM monthly_income LIKE 'transaction_date'");
    $columnExists = $stmt->fetch();
    
    if (!$columnExists) {
        // Add the column
        $conn->query("ALTER TABLE monthly_income ADD COLUMN transaction_date DATE DEFAULT NULL AFTER amount");
        echo json_encode([
            "success" => true,
            "message" => "transaction_date column added successfully"
        ]);
    } else {
        echo json_encode([
            "success" => true,
            "message" => "transaction_date column already exists"
        ]);
    }
} catch (Exception $e) {
    echo json_encode([
        "success" => false,
        "message" => "Error: " . $e->getMessage()
    ]);
}
