<?php

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

include('../../config/database.php');
$conn = getMysqliConnection();

$project_id = intval($_GET['project_id'] ?? 0);

if ($project_id <= 0) {
    echo json_encode([
        "success" => false,
        "error" => "Invalid project_id"
    ]);
    exit;
}

$result = $conn->query("
    SELECT * FROM project_timeline 
    WHERE project_id = $project_id
    ORDER BY timeline_id ASC
");

if (!$result) {
    echo json_encode([
        "success" => false,
        "error" => $conn->error
    ]);
    exit;
}

$tasks = [];

while ($row = $result->fetch_assoc()) {
    $tasks[] = [
        "id" => $row['external_id'] ? intval($row['external_id']) : intval($row['timeline_id']),
        "category" => $row['task_category'],
        "name" => $row['task_name'],
        "startDate" => $row['start_date'],
        "endDate" => $row['end_date']
    ];
}

// FETCH COMPLETIONS FROM JSON
$completions = [];
$file = __DIR__ . "/../../uploads/timelines/completions_$project_id.json";
if (file_exists($file)) {
    $completions = json_decode(file_get_contents($file), true);
}

echo json_encode([
    "success" => true,
    "tasks" => $tasks,
    "completions" => $completions,
    "count" => count($tasks)
]);