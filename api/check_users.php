<?php
require_once 'config/database.php';
$db = new Database();
$conn = $db->getConnection();
$stmt = $conn->query("SELECT user_id, name, username, role, status FROM users");
$users = $stmt->fetchAll(PDO::FETCH_ASSOC);
echo json_encode(["total_users" => count($users), "users" => $users]);
?>
