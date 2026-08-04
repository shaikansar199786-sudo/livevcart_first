<?php
$data = [
    'project_id' => 64,
    'type' => 'designer',
    'tasks' => [[
        'id' => 1785733293516,
        'name' => 'Test',
        'category' => 'Test',
        'startDate' => '2026-08-01',
        'endDate' => '2026-08-05'
    ]],
    'completions' => [
        '1785733293516' => [
            '2026-08-01' => 'ongoing'
        ]
    ]
];
$opts = [
    'http' => [
        'method' => 'POST',
        'header' => 'Content-Type: application/json',
        'content' => json_encode($data)
    ]
];
$context = stream_context_create($opts);
echo file_get_contents('http://localhost/livrcart/demoark/api/controllers/timeline/save-state.php', false, $context);
