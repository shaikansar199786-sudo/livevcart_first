<?php
require_once __DIR__ . '/../config/database.php';
$db = new Database();
$conn = $db->getConnection();
$stmt = $conn->query("SELECT q.*, p.client_id, c.name as client_name, c.email as client_email FROM quotes q LEFT JOIN projects p ON q.project_id = p.project_id LEFT JOIN clients c ON p.client_id = c.client_id WHERE q.quote_id = 330");
print_r($stmt->fetch(PDO::FETCH_ASSOC));
