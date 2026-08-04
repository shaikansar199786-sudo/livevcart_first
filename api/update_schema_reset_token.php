<?php
require_once 'config/database.php';
$db = new Database();
$conn = $db->getConnection();

try {
    $conn->exec("ALTER TABLE users ADD COLUMN reset_token VARCHAR(255) NULL");
    $conn->exec("ALTER TABLE users ADD COLUMN reset_token_expires_at DATETIME NULL");
    echo json_encode(["success" => true, "message" => "Database schema updated successfully."]);
} catch (Exception $e) {
    // If it fails, it might be because the columns already exist. We can check the error message.
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}
?>
