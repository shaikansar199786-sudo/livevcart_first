<?php
$options = [
    'http' => [
        'method'  => 'DELETE'
    ]
];
$context  = stream_context_create($options);
$result = file_get_contents('http://localhost/demoark/api/leads/files?lead_id=20&filename=test_folder&folder=', false, $context);
if ($result === FALSE) { echo "Failed to fetch"; }
echo $result;
?>
