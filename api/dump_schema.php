<?php
require_once 'config/database.php';
$db = new Database();
$conn = $db->getConnection();
$stmt = $conn->query('DESCRIBE leads');
$leads = $stmt->fetchAll(PDO::FETCH_ASSOC);
$stmt2 = $conn->query('DESCRIBE projects');
$projects = $stmt2->fetchAll(PDO::FETCH_ASSOC);
echo json_encode(["leads" => $leads, "projects" => $projects]);
?>
