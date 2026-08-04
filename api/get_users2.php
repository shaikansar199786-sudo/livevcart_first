<?php
require_once 'config/database.php';
$db = new Database();
$conn = $db->getConnection();
$stmt = $conn->prepare("SHOW COLUMNS FROM users");
$stmt->execute();
$columns = $stmt->fetchAll(PDO::FETCH_ASSOC);

$stmt2 = $conn->prepare("SELECT * FROM users");
$stmt2->execute();
$users = $stmt2->fetchAll(PDO::FETCH_ASSOC);

echo json_encode(['columns' => $columns, 'users' => $users]);
?>
