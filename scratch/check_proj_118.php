<?php
require_once __DIR__ . '/../api/config/database.php';
$db = (new Database())->getConnection();
$stmt = $db->prepare('SELECT project_id, project_name, status, qc_status, is_final_quote_approved, qc_approved, project_stage, stage2_paid, stage3_paid, total_budget FROM projects WHERE project_id = 118');
$stmt->execute();
print_r($stmt->fetch(PDO::FETCH_ASSOC));

