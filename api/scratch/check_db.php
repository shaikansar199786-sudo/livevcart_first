<?php
require_once __DIR__ . '/../config/database.php';
$db = new Database();
$conn = $db->getConnection();
$stmt = $conn->query("SELECT quote_id, quote_number, status, ack_status, ack_token, is_initial, updated_at, extra_data FROM quotes WHERE lead_id = 115 OR project_id = 115");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
$lead = $conn->query("SELECT * FROM leads WHERE id = 115 OR lead_id = 115");
print_r($lead ? $lead->fetchAll(PDO::FETCH_ASSOC) : 'No lead found');
