<?php

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, x-user-role, x-user-id, Authorization, *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, DELETE");
header("Content-Type: application/json");
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Cache-Control: post-check=0, pre-check=0', false);
header('Pragma: no-cache');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

include('../../config/database.php');
$conn = getMysqliConnection();

$raw_project_id = strval($_GET['project_id'] ?? '');
$type = $_GET['type'] ?? 'designer';

preg_match('/\d+/', $raw_project_id, $matches);
$numeric_id = !empty($matches[0]) ? intval($matches[0]) : 0;
$clean_file_id = preg_replace('/[^a-zA-Z0-9_-]/', '_', $raw_project_id);

if (empty($raw_project_id) && $numeric_id <= 0) {
    echo json_encode([
        "success" => false,
        "error" => "Invalid project_id"
    ]);
    exit;
}

$table = 'project_timeline'; // Default for designer
if ($type === 'pm') {
    $table = 'project_timeline_pm';
    $conn->query("CREATE TABLE IF NOT EXISTS project_timeline_pm LIKE project_timeline");
} else if ($type === 'execution') {
    $table = 'project_timeline_execution';
    $conn->query("CREATE TABLE IF NOT EXISTS project_timeline_execution LIKE project_timeline");
}

$escaped_raw = $conn->real_escape_string($raw_project_id);
$result = $conn->query("
    SELECT * FROM $table 
    WHERE project_id = '$escaped_raw' OR project_id = '$numeric_id'
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
        "id" => $row['external_id'] ? strval($row['external_id']) : strval($row['timeline_id']),
        "category" => $row['task_category'],
        "name" => $row['task_name'],
        "startDate" => $row['start_date'],
        "endDate" => $row['end_date']
    ];
}

// FALLBACK: If DB returned no tasks, try loading from JSON tasks file
if (count($tasks) === 0) {
    $dir = __DIR__ . "/../../uploads/timelines";
    $tasks_file1 = "$dir/" . ($type === 'pm' ? "tasks_pm_{$clean_file_id}.json" : ($type === 'execution' ? "tasks_execution_{$clean_file_id}.json" : "tasks_{$clean_file_id}.json"));
    $tasks_file2 = ($numeric_id > 0) ? "$dir/" . ($type === 'pm' ? "tasks_pm_{$numeric_id}.json" : ($type === 'execution' ? "tasks_execution_{$numeric_id}.json" : "tasks_{$numeric_id}.json")) : null;

    // Legacy fallback for execution type (before file separation)
    $legacyTasks1 = "$dir/tasks_{$clean_file_id}.json";
    $legacyTasks2 = "$dir/tasks_{$numeric_id}.json";

    if (file_exists($tasks_file1)) {
        $tasks = json_decode(file_get_contents($tasks_file1), true) ?: [];
    } else if ($type === 'execution' && file_exists($legacyTasks1)) {
        $tasks = json_decode(file_get_contents($legacyTasks1), true) ?: [];
    } else if ($tasks_file2 && file_exists($tasks_file2)) {
        $tasks = json_decode(file_get_contents($tasks_file2), true) ?: [];
    } else if ($numeric_id > 0 && $type === 'execution' && file_exists($legacyTasks2)) {
        $tasks = json_decode(file_get_contents($legacyTasks2), true) ?: [];
    }
}

// FETCH COMPLETIONS FROM JSON
$completions = [];
$dir = __DIR__ . "/../../uploads/timelines";
$file1 = "$dir/" . ($type === 'pm' ? "completions_pm_{$clean_file_id}.json" : ($type === 'execution' ? "completions_execution_{$clean_file_id}.json" : "completions_{$clean_file_id}.json"));
$file2 = "$dir/" . ($type === 'pm' ? "completions_pm_{$numeric_id}.json" : ($type === 'execution' ? "completions_execution_{$numeric_id}.json" : "completions_{$numeric_id}.json"));

// Legacy fallback for execution type (before file separation)
$legacyFile1 = "$dir/completions_{$clean_file_id}.json";
$legacyFile2 = "$dir/completions_{$numeric_id}.json";

if (file_exists($file1)) {
    $completions = json_decode(file_get_contents($file1), true) ?: [];
} else if ($type === 'execution' && file_exists($legacyFile1)) {
    $completions = json_decode(file_get_contents($legacyFile1), true) ?: [];
} else if ($numeric_id > 0 && file_exists($file2)) {
    $completions = json_decode(file_get_contents($file2), true) ?: [];
} else if ($numeric_id > 0 && $type === 'execution' && file_exists($legacyFile2)) {
    $completions = json_decode(file_get_contents($legacyFile2), true) ?: [];
}

// FETCH CATEGORY ORDER FROM JSON
$categoryOrder    = [];
$customCategories = [];
$catFile1 = "$dir/" . ($type === 'pm' ? "categories_pm_{$clean_file_id}.json" : ($type === 'execution' ? "categories_execution_{$clean_file_id}.json" : "categories_{$clean_file_id}.json"));
$catFile2 = "$dir/" . ($type === 'pm' ? "categories_pm_{$numeric_id}.json" : ($type === 'execution' ? "categories_execution_{$numeric_id}.json" : "categories_{$numeric_id}.json"));

// Legacy fallback for execution type (before file separation)
$legacyCat1 = "$dir/categories_{$clean_file_id}.json";
$legacyCat2 = "$dir/categories_{$numeric_id}.json";

$catFileToRead = null;
if (file_exists($catFile1)) {
    $catFileToRead = $catFile1;
} else if ($type === 'execution' && file_exists($legacyCat1)) {
    $catFileToRead = $legacyCat1;
} else if ($numeric_id > 0 && file_exists($catFile2)) {
    $catFileToRead = $catFile2;
} else if ($numeric_id > 0 && $type === 'execution' && file_exists($legacyCat2)) {
    $catFileToRead = $legacyCat2;
}

if ($catFileToRead) {
    $catData = json_decode(file_get_contents($catFileToRead), true);
    $categoryOrder    = $catData['categoryOrder']    ?? [];
    $customCategories = $catData['customCategories'] ?? [];
}

echo json_encode([
    "success"          => true,
    "tasks"            => $tasks,
    "completions"      => $completions,
    "categoryOrder"    => $categoryOrder,
    "customCategories" => $customCategories,
    "count"            => count($tasks)
]);