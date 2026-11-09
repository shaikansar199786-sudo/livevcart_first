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
    $approvedList = [];
    $rejectedList = [];

    // 1. Scan uploads/timelines/ JSON files for pending, approved, and rejected statuses
    if (is_dir($dir)) {
        $files = scandir($dir);
        foreach ($files as $file) {
            if (strpos($file, 'completions_') === 0 && strpos($file, '.json') !== false) {
                $isPm = strpos($file, 'completions_pm_') === 0;
                $isExec = strpos($file, 'completions_execution_') === 0;
                $timelineType = $isPm ? 'pm' : ($isExec ? 'execution' : 'designer');
                $pId = str_replace(['completions_pm_', 'completions_execution_', 'completions_', '.json'], '', $file);
                
                $content = @file_get_contents($dir . '/' . $file);
                $completions = json_decode($content, true);

                if (is_array($completions)) {
                    // Fetch project name & details safely
                    $pName = "Project #$pId";
                    $clientName = "";
                    $projectType = "";
                    $pRes = $conn->query("
                        SELECT p.project_name, p.project_type, c.name AS client_name 
                        FROM projects p 
                        LEFT JOIN clients c ON p.client_id = c.client_id 
                        WHERE p.project_id = " . intval($pId)
                    );
                    if ($pRes && $pRow = $pRes->fetch_assoc()) {
                        $pName = $pRow['project_name'];
                        $clientName = $pRow['client_name'] ?? '';
                        $projectType = $pRow['project_type'] ?? '';
                    } else {
                        // Project does not exist in database (was deleted). Skip orphaned completion file.
                        continue;
                    }

                    // Fetch timeline task names from tasks_$pId.json first if available
                    $taskMap = [];
                    $tasksJsonFile = $isPm ? "$dir/tasks_pm_$pId.json" : ($isExec ? "$dir/tasks_execution_$pId.json" : "$dir/tasks_$pId.json");
                    if (file_exists($tasksJsonFile)) {
                        $tArr = json_decode(@file_get_contents($tasksJsonFile), true) ?: [];
                        if (is_array($tArr)) {
                            foreach ($tArr as $tItem) {
                                if (isset($tItem['id']) && isset($tItem['name'])) {
                                    $taskMap[strval($tItem['id'])] = $tItem['name'];
                                }
                            }
                        }
                    }

                    // Also fetch timeline task names from database table as fallback
                    $table = $isPm ? 'project_timeline_pm' : 'project_timeline';
                    $tRes = $conn->query("SELECT external_id, task_name, task_category FROM $table WHERE project_id = " . intval($pId));
                    if ($tRes) {
                        while ($tRow = $tRes->fetch_assoc()) {
                            if (!empty($tRow['task_name'])) {
                                $taskMap[strval($tRow['external_id'])] = $tRow['task_name'];
                            }
                        }
                    }

                    foreach ($completions as $taskId => $dateMap) {
                        if (is_array($dateMap)) {
                            $pendingDates = [];
                            $approvedDates = [];
                            $rejectedDates = [];
                            foreach ($dateMap as $dateStr => $status) {
                                if ($status === 'pending_approval') {
                                    $pendingDates[] = $dateStr;
                                } elseif ($status === 'done' || $status === 'completed') {
                                    $approvedDates[] = $dateStr;
                                } elseif ($status === 'rejected') {
                                    $rejectedDates[] = $dateStr;
                                }
                            }
                            $tName = $taskMap[strval($taskId)] ?? "Task #$taskId";

                            if (!empty($pendingDates)) {
                                $displayDate = count($pendingDates) === 1 ? $pendingDates[0] : (min($pendingDates) . " to " . max($pendingDates));
                                $pendingList[] = [
                                    'id' => "file_{$pId}_{$taskId}",
                                    'source' => 'file',
                                    'project_id' => intval($pId),
                                    'project_name' => $pName,
                                    'client_name' => $clientName,
                                    'project_type' => $projectType,
                                    'task_id' => $taskId,
                                    'task_name' => $tName,
                                    'date' => $displayDate,
                                    'type' => $timelineType,
                                    'status' => 'pending_approval'
                                ];
                            }
                            if (!empty($approvedDates)) {
                                $displayDate = count($approvedDates) === 1 ? $approvedDates[0] : (min($approvedDates) . " to " . max($approvedDates));
                                $approvedList[] = [
                                    'id' => "file_{$pId}_{$taskId}_appr",
                                    'source' => 'file',
                                    'project_id' => intval($pId),
                                    'project_name' => $pName,
                                    'client_name' => $clientName,
                                    'project_type' => $projectType,
                                    'task_id' => $taskId,
                                    'task_name' => $tName,
                                    'date' => $displayDate,
                                    'type' => $timelineType,
                                    'status' => 'done'
                                ];
                            }
                            if (!empty($rejectedDates)) {
                                $displayDate = count($rejectedDates) === 1 ? $rejectedDates[0] : (min($rejectedDates) . " to " . max($rejectedDates));
                                $rejectedList[] = [
                                    'id' => "file_{$pId}_{$taskId}_rej",
                                    'source' => 'file',
                                    'project_id' => intval($pId),
                                    'project_name' => $pName,
                                    'client_name' => $clientName,
                                    'project_type' => $projectType,
                                    'task_id' => $taskId,
                                    'task_name' => $tName,
                                    'date' => $displayDate,
                                    'type' => $timelineType,
                                    'status' => 'rejected'
                                ];
                            }
                        }
                    }
                }
            }
        }
    }

    // 2. Scan project_trackers table for pending, approved, and rejected stage statuses
    $trackerRes = $conn->query("SELECT pt.* FROM project_trackers pt INNER JOIN projects p ON pt.project_id = p.project_id");
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
                    } elseif ($status === 'done' || $status === 'completed') {
                        $approvedList[] = [
                            'id' => "tracker_{$tRow['id']}_{$colName}_appr",
                            'source' => 'tracker',
                            'tracker_id' => intval($tRow['id']),
                            'project_id' => $tRow['project_id'],
                            'project_name' => $tRow['project_name'] ?: 'Project Tracker',
                            'task_name' => $colName,
                            'category' => $tRow['category'],
                            'status' => 'done'
                        ];
                    } elseif ($status === 'rejected') {
                        $rejectedList[] = [
                            'id' => "tracker_{$tRow['id']}_{$colName}_rej",
                            'source' => 'tracker',
                            'tracker_id' => intval($tRow['id']),
                            'project_id' => $tRow['project_id'],
                            'project_name' => $tRow['project_name'] ?: 'Project Tracker',
                            'task_name' => $colName,
                            'category' => $tRow['category'],
                            'status' => 'rejected'
                        ];
                    }
                }
            }
        }
    }

    echo json_encode([
        "success" => true,
        "counts" => [
            "pending" => count($pendingList),
            "approved" => count($approvedList),
            "rejected" => count($rejectedList)
        ],
        "data" => $pendingList,
        "approved_tasks" => $approvedList,
        "rejected_tasks" => $rejectedList
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
    $action = strtolower($data['action'] ?? 'approve');
    $rejectionReason = trim($data['reason'] ?? '');
    
    // Status to apply: 'done' for approved, 'rejected' for rejected (requires rework)
    $targetStatus = ($action === 'reject') ? 'rejected' : 'done';
    
    if ($source === 'file') {
        $pId = intval($data['project_id'] ?? 0);
        $taskId = $data['task_id'] ?? '';
        $type = $data['type'] ?? 'designer';

        $file = $type === 'pm' ? "completions_pm_$pId.json" : ($type === 'execution' ? "completions_execution_$pId.json" : "completions_$pId.json");
        $filePath = $dir . '/' . $file;

        if (file_exists($filePath)) {
            $content = file_get_contents($filePath);
            $completions = json_decode($content, true) ?: [];

            if (isset($completions[$taskId])) {
                if (is_array($completions[$taskId])) {
                    foreach ($completions[$taskId] as $d => $st) {
                        $completions[$taskId][$d] = $targetStatus;
                    }
                } else {
                    $completions[$taskId] = $targetStatus;
                }
                file_put_contents($filePath, json_encode($completions));
            }
        }

        if ($action === 'reject') {
            echo json_encode(["success" => true, "message" => "Task rejected and marked as Rejected (Rework required)"]);
        } else {
            echo json_encode(["success" => true, "message" => "Task approved and marked as Completed (Green)"]);
        }
        exit();
    }

    if ($source === 'tracker') {
        $trackerId = intval($data['tracker_id'] ?? 0);
        $colName = $data['task_name'] ?? '';

        if ($trackerId > 0 && !empty($colName)) {
            $res = $conn->query("SELECT column_data FROM project_trackers WHERE id = $trackerId");
            if ($res && $row = $res->fetch_assoc()) {
                $colData = json_decode($row['column_data'] ?? '{}', true) ?: [];
                $colData[$colName] = $targetStatus;
                $jsonStr = $conn->real_escape_string(json_encode($colData));
                $conn->query("UPDATE project_trackers SET column_data = '$jsonStr' WHERE id = $trackerId");
            }
        }

        if ($action === 'reject') {
            echo json_encode(["success" => true, "message" => "Stage tracker rejected and marked as Rejected (Rework required)"]);
        } else {
            echo json_encode(["success" => true, "message" => "Stage tracker approved and status changed to GREEN (Completed)"]);
        }
        exit();
    }

    echo json_encode(["success" => false, "message" => "Unknown source type"]);
    exit();
}
