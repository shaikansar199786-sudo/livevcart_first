<?php
$data = ['lead_id' => 20, 'folder_name' => 'test_folder', 'parent_folder' => ''];
$options = [
    'http' => [
        'header'  => "Content-type: application/json\r\n",
        'method'  => 'POST',
        'content' => json_encode($data)
    ]
];
$context  = stream_context_create($options);
$result = file_get_contents('http://localhost/demoark/api/leads/create-folder', false, $context);
if ($result === FALSE) { /* Handle error */ echo "Failed to fetch"; }
echo $result;
?>
