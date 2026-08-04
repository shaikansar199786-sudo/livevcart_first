<?php
require_once 'c:\xampp\htdocs\Livincart\api\config\database.php';
$db = new Database();
$conn = $db->getConnection();
$stmt = $conn->query("DESCRIBE quotes");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
?>
