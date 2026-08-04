<?php
$data = [
    'lead_id' => 20, 
    'status' => 'won',
    'data' => [
        'project_name' => 'Test Project',
        'project_head_id' => 1,
        'site_engineer_id' => 1,
        'total_budget' => 500000,
        'start_date' => '2026-07-22',
        'expected_end_date' => '2026-11-22'
    ]
];
$options = [
    'http' => [
        'header'  => "Content-type: application/json\r\n",
        'method'  => 'POST',
        'content' => json_encode($data)
    ]
];
$context  = stream_context_create($options);
$result = file_get_contents('http://localhost/demoark/api/leads/update-status', false, $context);
if ($result === FALSE) { echo "Failed to fetch"; }
echo $result;
?>
