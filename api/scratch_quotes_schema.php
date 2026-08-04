<?php
require 'config/database.php';
$db = new Database();
$conn = $db->getConnection();
$stmt = $conn->query("DESCRIBE quotes");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
$stmt = $conn->query("DESCRIBE quote_sections");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
$stmt = $conn->query("DESCRIBE quote_items");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
