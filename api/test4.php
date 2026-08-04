<?php
$data = ['lead_id' => 20, 'status' => 'in_meeting'];
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
