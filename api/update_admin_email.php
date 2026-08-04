<?php
require_once 'config/database.php';
$db = new Database();
$conn = $db->getConnection();

$stmt = $conn->prepare("UPDATE users SET username = 'admin@gmail.com' WHERE username = 'Admin123'");
if ($stmt->execute()) {
    echo json_encode(["success" => true, "message" => "Admin username updated to admin@gmail.com"]);
} else {
    echo json_encode(["success" => false, "message" => "Failed to update admin username"]);
}
?>
