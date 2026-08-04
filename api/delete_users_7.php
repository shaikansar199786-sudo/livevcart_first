<?php
$conn = new mysqli('localhost', 'root', '', 'ark_pm_system');

if ($conn->connect_error) {
    echo json_encode(["error" => "No ark_pm_system database"]);
    exit;
}

$result = $conn->query("SELECT user_id, name, username, employee_id FROM users");
$users = $result->fetch_all(MYSQLI_ASSOC);
echo json_encode(["users_in_ark_pm_system" => $users]);
?>
