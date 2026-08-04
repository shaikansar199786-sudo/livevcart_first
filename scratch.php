<?php
require 'api/config/database.php';
$db = new Database();
$conn = $db->getConnection();
$stmt = $conn->query('SHOW CREATE TABLE projects');
print_r($stmt->fetch(PDO::FETCH_ASSOC));
