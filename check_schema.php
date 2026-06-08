<?php
require 'api/config/database.php';
$db = new Database();
$conn = $db->getConnection();
$stmt = $conn->query('SELECT DISTINCT role FROM users');
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
?>
