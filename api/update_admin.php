<?php
require_once 'config/database.php';
$db = new Database();
$conn = $db->getConnection();

$stmt = $conn->prepare("UPDATE users SET employee_id = 'LVN001' WHERE username = 'Admin123'");
$stmt->execute();
echo json_encode(["updated" => $stmt->rowCount()]);
?>
