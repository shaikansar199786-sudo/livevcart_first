<?php
require_once 'config/database.php';
$db = new Database();
$conn = $db->getConnection();

$stmt = $conn->query("SELECT * FROM users");
$users = $stmt->fetchAll();
echo json_encode(["users" => $users]);
?>
