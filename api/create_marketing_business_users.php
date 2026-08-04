<?php
require_once 'config/database.php';

try {
    $db = new Database();
    $conn = $db->getConnection();
    
    // Hash password
    $password = password_hash('password123', PASSWORD_DEFAULT);
    
    // Create Business Associate
    $stmt2 = $conn->prepare("INSERT INTO users (name, username, phone, role, password, status) 
                            VALUES ('Test Business Associate', 'business@test.com', '8765432109', 'business_associate', :password, 'active')
                            ON DUPLICATE KEY UPDATE name=VALUES(name)");
    $stmt2->bindParam(':password', $password);
    $stmt2->execute();
    
    echo json_encode([
        "success" => true,
        "message" => "Business Associate test user created successfully.",
        "users" => [
            ["username" => "business@test.com", "password" => "password123", "role" => "business_associate"]
        ]
    ]);
} catch (Exception $e) {
    echo json_encode([
        "success" => false,
        "message" => "Failed to seed users: " . $e->getMessage()
    ]);
}
?>
