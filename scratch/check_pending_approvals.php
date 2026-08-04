<?php
include(__DIR__ . '/../api/config/database.php');
$conn = getMysqliConnection();

$dir = __DIR__ . '/../api/uploads/timelines';

echo "=== SCANNING UPLOADS/TIMELINES ===\n";
if (is_dir($dir)) {
    $files = scandir($dir);
    foreach ($files as $file) {
        if (strpos($file, 'completions_') === 0 && strpos($file, '.json') !== false) {
            echo "File: $file\n";
            $content = file_get_contents($dir . '/' . $file);
            echo $content . "\n";
        }
    }
} else {
    echo "Directory $dir does not exist!\n";
}

echo "\n=== SCANNING PROJECT_TRACKERS ===\n";
$res = $conn->query("SELECT * FROM project_trackers");
if ($res) {
    while ($row = $res->fetch_assoc()) {
        echo "ID: {$row['id']} | Category: {$row['category']} | Project: {$row['project_name']} | Data: {$row['column_data']}\n";
    }
}
