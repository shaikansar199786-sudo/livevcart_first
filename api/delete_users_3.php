<?php
require_once 'config/database.php';
$db = new Database();
$conn = $db->getConnection();

$stmt = $conn->query("DESCRIBE users");
$columns = $stmt->fetchAll();
echo json_encode(["columns" => $columns]);
?>
