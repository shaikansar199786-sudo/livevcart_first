<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, x-user-role, x-user-id, Authorization, *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

include('../../config/database.php');
$conn = getMysqliConnection();

$dir = __DIR__ . '/../../uploads/timelines';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $pendingList = [];

    // 1. Scan uploads/timelines/ JSON files for pending_approval statuses
    if (is_dir($dir)) {
        $files = scandir($dir);
        foreach ($files as $file) {
            if (strpos($file, 'completions_') === 0 && strpos($file, '.json') !== false) {
                $isPm = strpos($file, 'completions_pm_') === 0;
                $pId = str_replace(['completions_pm_', 'completions_', '.json'], '', $file);
                
                $content = @file_get_contents($dir . '/' . $file);
                $completions = json_decode($content, true);

                if (is_array($completions)) {
                    // Fetch project name
                    $pName = "Project #$pId";
                    $pRes = $conn->query("SELECT project_name FROM projects WHERE project_id = " . intval($pId));
                    if ($pRes && $pRow = $pRes->fetch_assoc()) {
                        $pName = $pRow['project_name'];
                    }

                    // Fetch timeline task names from database table
                    $table = $isPm ? 'project_timeline_pm' : 'project_timeline';
                    $taskMap = [];
                    $tRes = $conn->query("SELECT external_id, task_name, task_category FROM $table WHERE project_id = " . intval($pId));
                    if ($tRes) {
                        while ($tRow = $tRes->fetch_assoc()) {
                            $taskMap[strval($tRow['external_id'])] = $tRow['task_name'];
                        }
                    }

                    foreach ($completions as $taskId => $dateMap) {
                        if (is_array($dateMap)) {
                            foreach ($dateMap as $dateStr => $status) {
                                if ($status === 'pending_approval') {
                                    $tName = $taskMap[strval($taskId)] ?? "Task #$taskId";
                                    $pendingList[] = [
                                        'id' => "file_{$pId}_{$taskId}_{$dateStr}",
                                        'source' => 'file',
                                        'project_id' => intval($pId),
                                        'project_name' => $pName,
                                        'task_id' => $taskId,
                                        'task_name' => $tName,
                                        'date' => $dateStr,
                                        'type' => $isPm ? 'pm' : 'designer',
                                        'status' => 'pending_approval'
                                    ];
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // 2. Scan project_trackers table for pending_approval stage statuses
    $trackerRes = $conn->query("SELECT * FROM project_trackers");
    if ($trackerRes) {
        while ($tRow = $trackerRes->fetch_assoc()) {
            $colData = json_decode($tRow['column_data'] ?? '{}', true);
            if (is_array($colData)) {
                foreach ($colData as $colName => $status) {
                    if ($status === 'pending_approval') {
                        $pendingList[] = [
                            'id' => "tracker_{$tRow['id']}_{$colName}",
                            'source' => 'tracker',
                            'tracker_id' => intval($tRow['id']),
                            'project_id' => $tRow['project_id'],
                            'project_name' => $tRow['project_name'] ?: 'Project Tracker',
                            'task_name' => $colName,
                            'category' => $tRow['category'],
                            'status' => 'pending_approval'
                        ];
                    }
                }
            }
        }
    }

    echo json_encode([
        "success" => true,
        "data" => $pendingList
    ]);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $raw = file_get_contents("php://input");
    $data = json_decode($raw, true);

    if (!$data) {
        echo json_encode(["success" => false, "message" => "Invalid JSON payload"]);
        exit();
    }

    $source = $data['source'] ?? '';
    
    if ($source === 'file') {
        $pId = intval($data['project_id'] ?? 0);
        $taskId = $data['task_id'] ?? '';
        $dateStr = $data['date'] ?? '';
        $type = $data['type'] ?? 'designer';

        $file = $type === 'pm' ? "completions_pm_$pId.json" : "completions_$pId.json";
        $filePath = $dir . '/' . $file;

        if (file_exists($filePath)) {
            $content = file_get_contents($filePath);
            $completions = json_decode($content, true) ?: [];

            if (isset($completions[$taskId][$dateStr])) {
                $completions[$taskId][$dateStr] = 'done'; // Changed to GREEN / COMPLETED
                file_put_contents($filePath, json_encode($completions));
            }
        }

        echo json_encode(["success" => true, "message" => "Task approved and status changed to GREEN (Completed)"]);
        exit();
    }

    if ($source === 'tracker') {
        $trackerId = intval($data['tracker_id'] ?? 0);
        $colName = $data['task_name'] ?? '';

        if ($trackerId > 0 && !empty($colName)) {
            $res = $conn->query("SELECT column_data FROM project_trackers WHERE id = $trackerId");
            if ($res && $row = $res->fetch_assoc()) {
                $colData = json_decode($row['column_data'] ?? '{}', true) ?: [];
                $colData[$colName] = 'done'; // Changed to GREEN / COMPLETED
                $jsonStr = $conn->real_escape_string(json_encode($colData));
                $conn->query("UPDATE project_trackers SET column_data = '$jsonStr' WHERE id = $trackerId");
            }
        }

        echo json_encode(["success" => true, "message" => "Stage tracker approved and status changed to GREEN (Completed)"]);
        exit();
    }

    echo json_encode(["success" => false, "message" => "Unknown source type"]);
    exit();
}
