<?php
require_once __DIR__ . '/../api/config/database.php';
$conn = getMysqliConnection();
$res = $conn->query("SELECT project_id, project_code, project_name, project_type FROM projects");
while ($row = $res->fetch_assoc()) {
    echo "ID: " . $row['project_id'] . " | Code: " . $row['project_code'] . " | Name: " . $row['project_name'] . " | Type: '" . $row['project_type'] . "'\n";
}
