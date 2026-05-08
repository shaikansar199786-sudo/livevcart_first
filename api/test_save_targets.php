<?php
require 'config/database.php';
require 'controllers/TeamTargetController.php';

$db = new Database();
$conn = $db->getConnection();
$targetCtrl = new TeamTargetController($conn);

$month = "2026-05";
$rows = [
    [
        'project_id' => '1',
        'project_name' => 'Test Project',
        'team_member' => 'Ankita',
        'task1' => '3D',
        'task2' => 'Detailed Drawings',
        'status' => 'done'
    ]
];

$result = $targetCtrl->save($month, $rows);
echo json_encode($result);
?>
