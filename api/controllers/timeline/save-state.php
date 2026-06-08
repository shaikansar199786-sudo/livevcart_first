<?php

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

include('../../config/database.php');
$conn = getMysqliConnection();

/* READ INPUT */
$raw = file_get_contents("php://input");
$data = json_decode($raw, true);

if (!$data) {
    echo json_encode([
        "success" => false,
        "error" => "Invalid JSON",
        "raw" => $raw
    ]);
    exit;
}

$project_id = intval($data['project_id'] ?? 0);
$tasks = $data['tasks'] ?? [];
$completions = $data['completions'] ?? [];
$created_by = intval($data['created_by'] ?? 1);

if ($project_id <= 0) {
    echo json_encode([
        "success" => false,
        "error" => "Invalid project_id"
    ]);
    exit;
}

// SAVE COMPLETIONS TO JSON FILE (for persistence)
$dir = __DIR__ . '/../../uploads/timelines';
if (!is_dir($dir)) {
    mkdir($dir, 0777, true);
}
file_put_contents($dir . "/completions_$project_id.json", json_encode($completions));

/* TRANSACTION START */
$conn->begin_transaction();

try {

    // Delete old
    $delete = $conn->query("DELETE FROM project_timeline WHERE project_id = $project_id");

    if (!$delete) {
        throw new Exception("Delete failed: " . $conn->error);
    }

    // Insert new
    foreach ($tasks as $task) {

        $task_name = $conn->real_escape_string($task['name']);
        $category = $conn->real_escape_string($task['category']);
        $start = $task['startDate'];
        $end = $task['endDate'];
        $external_id = $task['id']; // This is Date.now() from frontend

        $duration = (strtotime($end) - strtotime($start)) / 86400;

        $sql = "INSERT INTO project_timeline 
        (project_id, external_id, task_name, task_category, start_date, end_date, duration_days, created_by)
        VALUES 
        ($project_id, $external_id, '$task_name', '$category', '$start', '$end', '$duration', '$created_by')";

        if (!$conn->query($sql)) {
            throw new Exception("Insert failed: " . $conn->error);
        }
    }

    $conn->commit();

    echo json_encode([
        "success" => true,
        "saved_count" => count($tasks),
        "completions_saved" => true
    ]);

} catch (Exception $e) {

    $conn->rollback();

    echo json_encode([
        "success" => false,
        "error" => $e->getMessage()
    ]);
}