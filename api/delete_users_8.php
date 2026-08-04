<?php
$conn = new mysqli('localhost', 'root', '');
$result = $conn->query("SHOW DATABASES");
$dbs = $result->fetch_all(MYSQLI_ASSOC);
echo json_encode(["databases" => $dbs]);
?>
