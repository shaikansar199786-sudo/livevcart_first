<?php
require_once __DIR__ . '/../api/config/database.php';
$conn = getMysqliConnection();
$project_id = 63;

echo "--- TASKS IN DATABASE FOR PROJECT $project_id ---\n";
$res = $conn->query("SELECT * FROM project_timeline WHERE project_id = $project_id");
while ($row = $res->fetch_assoc()) {
    print_r($row);
}

echo "--- COMPLETIONS JSON FILE FOR PROJECT $project_id ---\n";
$file = __DIR__ . "/../api/uploads/timelines/completions_$project_id.json";
if (file_exists($file)) {
    echo file_get_contents($file) . "\n";
} else {
    echo "No completions file found at $file\n";
}
