<?php
require_once __DIR__ . '/../config/database.php';
$db = new Database();
$conn = $db->getConnection();
$stmt = $conn->query("SHOW COLUMNS FROM quotes LIKE '%email%'");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
