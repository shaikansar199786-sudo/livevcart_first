<?php
$_SERVER["REQUEST_METHOD"] = "POST";
$json = json_encode([
    "project_id" => "68",
    "type" => "designer",
    "tasks" => json_decode(file_get_contents("api/uploads/timelines/tasks_68.json"), true),
    "completions" => json_decode(file_get_contents("api/uploads/timelines/completions_68.json"), true),
    "created_by" => 1
]);
$_POST = [];
// Mock php://input by redefining it or just replacing the fetch in save-state.php
// Actually save-state.php reads php://input so we cannot easily mock it without rewriting it for the test.
?>
