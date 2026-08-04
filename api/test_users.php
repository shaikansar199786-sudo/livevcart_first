<?php
require_once 'config/database.php';
$db = new Database();
$conn = $db->getConnection();
$stmt = $conn->query("SELECT user_id, username, password, role FROM users");
$users = $stmt->fetchAll(PDO::FETCH_ASSOC);
echo json_encode($users);
?>
