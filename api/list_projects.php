<?php
require_once 'c:\xampp\htdocs\Livincart\api\config\database.php';
$db = new Database();
$conn = $db->getConnection();
$stmt = $conn->query("SELECT project_id, project_name FROM projects");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
?>
