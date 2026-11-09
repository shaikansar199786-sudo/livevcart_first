<?php
try {
    $db = new PDO("mysql:host=127.0.0.1;dbname=updted_liveicart;charset=utf8", "root", "");
    $stmt = $db->query("SELECT project_id, project_name, status, qc_status, is_final_quote_approved, qc_approved, project_stage, stage2_paid, stage3_paid, total_budget FROM projects WHERE project_id = 118");
    print_r($stmt->fetch(PDO::FETCH_ASSOC));
} catch (Exception $e) {
    echo $e->getMessage();
}

