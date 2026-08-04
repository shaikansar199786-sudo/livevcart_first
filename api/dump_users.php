<?php
require_once 'config/database.php';
$db = new Database();
$conn = $db->getConnection();
$stmt = $conn->query('DESCRIBE users');
echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
?>
