<?php
require_once 'config/database.php';
$db = new Database();
$conn = $db->getConnection();

if (isset($_GET['delete'])) {
    $stmt = $conn->prepare("DELETE FROM users WHERE email IN ('Jayanthi', 'think@gmail.com', 'd1@gmail.com') OR name IN ('ganga', 'Think', 'd1')");
    $stmt->execute();
    echo json_encode(["deleted" => $stmt->rowCount()]);
} else {
    $stmt = $conn->query("SELECT * FROM users");
    $users = $stmt->fetchAll();
    echo json_encode(["users" => $users]);
}
?>
