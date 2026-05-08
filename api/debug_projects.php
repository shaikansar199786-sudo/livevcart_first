<?php
require 'config/database.php';
$db = new Database();
$conn = $db->getConnection();
$stmt = $conn->query("DESCRIBE projects");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
?>
