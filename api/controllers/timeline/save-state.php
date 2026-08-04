<?php

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, x-user-role, x-user-id, Authorization, *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS, PUT, DELETE");
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

$raw_project_id = strval($data['project_id'] ?? '');
$type = $data['type'] ?? 'designer';
$tasks = $data['tasks'] ?? [];
$completions = $data['completions'] ?? [];
$created_by = intval($data['created_by'] ?? 1);

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

// SAVE COMPLETIONS + TASKS TO JSON FILE (for persistence & fallback)
$dir = __DIR__ . '/../../uploads/timelines';
if (!is_dir($dir)) {
    mkdir($dir, 0777, true);
}
$completions_file1 = $type === 'pm' ? "completions_pm_{$clean_file_id}.json" : ($type === 'execution' ? "completions_execution_{$clean_file_id}.json" : "completions_{$clean_file_id}.json");
file_put_contents($dir . "/$completions_file1", json_encode($completions));
// Save tasks to JSON as fallback (in case DB tasks get wiped)
$tasks_file1 = $type === 'pm' ? "tasks_pm_{$clean_file_id}.json" : ($type === 'execution' ? "tasks_execution_{$clean_file_id}.json" : "tasks_{$clean_file_id}.json");
file_put_contents($dir . "/$tasks_file1", json_encode($tasks));
if ($numeric_id > 0) {
    $completions_file2 = $type === 'pm' ? "completions_pm_{$numeric_id}.json" : ($type === 'execution' ? "completions_execution_{$numeric_id}.json" : "completions_{$numeric_id}.json");
    file_put_contents($dir . "/$completions_file2", json_encode($completions));
    $tasks_file2 = $type === 'pm' ? "tasks_pm_{$numeric_id}.json" : ($type === 'execution' ? "tasks_execution_{$numeric_id}.json" : "tasks_{$numeric_id}.json");
    file_put_contents($dir . "/$tasks_file2", json_encode($tasks));
}

// SAVE categoryOrder and customCategories
$categoryOrder    = $data['categoryOrder']    ?? [];
$customCategories = $data['customCategories'] ?? [];
$catPayload = json_encode([
    'categoryOrder'    => $categoryOrder,
    'customCategories' => $customCategories
]);
$categories_file1 = $type === 'pm' ? "categories_pm_{$clean_file_id}.json" : ($type === 'execution' ? "categories_execution_{$clean_file_id}.json" : "categories_{$clean_file_id}.json");
file_put_contents($dir . "/$categories_file1", $catPayload);
if ($numeric_id > 0) {
    $categories_file2 = $type === 'pm' ? "categories_pm_{$numeric_id}.json" : ($type === 'execution' ? "categories_execution_{$numeric_id}.json" : "categories_{$numeric_id}.json");
    file_put_contents($dir . "/$categories_file2", $catPayload);
}

// Auto-notify admins if any task is set to pending_approval
$has_pending_approval = false;
if (is_array($completions)) {
    foreach ($completions as $taskId => $dateMap) {
        if (is_array($dateMap)) {
            foreach ($dateMap as $date => $st) {
                if ($st === 'pending_approval') {
                    $has_pending_approval = true;
                    break 2;
                }
            }
        }
    }
}

if ($has_pending_approval && ($numeric_id > 0 || !empty($raw_project_id))) {
    $escaped_check_id = $conn->real_escape_string($raw_project_id);
    $p_res = $conn->query("SELECT project_name FROM projects WHERE project_id = '$escaped_check_id' OR project_id = '$numeric_id'");
    $p_name = ($p_res && $p_row = $p_res->fetch_assoc()) ? $p_row['project_name'] : "Project #$raw_project_id";
    
    $admins = $conn->query("SELECT user_id FROM users WHERE LOWER(role) IN ('admin', 'project_head', 'project_manager', 'manager')");
    if ($admins) {
        while ($admin = $admins->fetch_assoc()) {
            $u_id = intval($admin['user_id']);
            $title = $conn->real_escape_string("Designer Timeline Task Approval Request");
            $msg = $conn->real_escape_string("A timeline task in project '$p_name' is waiting for your approval.");
            
            $chk = $conn->query("SELECT notification_id FROM notifications WHERE user_id = $u_id AND is_read = 0 AND message LIKE '%$p_name%'");
            if ($chk && $chk->num_rows == 0) {
                $conn->query("INSERT INTO notifications (user_id, title, message, type, is_read, created_at) VALUES ($u_id, '$title', '$msg', 'timeline_approval', 0, NOW())");
            }
        }
    }
}

$escaped_raw = $conn->real_escape_string($raw_project_id);

/* TRANSACTION START */
$conn->begin_transaction();

try {

    // Delete old matching raw string or numeric id
    $delete = $conn->query("DELETE FROM $table WHERE project_id = '$escaped_raw' OR project_id = '$numeric_id'");

    if (!$delete) {
        throw new Exception("Delete failed: " . $conn->error);
    }

    // Insert new
    foreach ($tasks as $task) {

        $task_name = $conn->real_escape_string($task['name']);
        $category = $conn->real_escape_string($task['category']);
        $start = $task['startDate'];
        $end = $task['endDate'];
        $external_id = $task['id'];

        $duration = (strtotime($end) - strtotime($start)) / 86400;
        $db_proj_id = ($numeric_id > 0) ? $numeric_id : "'$escaped_raw'";

        $sql = "INSERT INTO $table 
        (project_id, external_id, task_name, task_category, start_date, end_date, duration_days, created_by)
        VALUES 
        ($db_proj_id, $external_id, '$task_name', '$category', '$start', '$end', '$duration', '$created_by')";

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