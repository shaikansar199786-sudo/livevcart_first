<?php
require_once 'config/database.php';
$db = new Database();
$conn = $db->getConnection();

$stmt = $conn->prepare("SELECT user_id FROM users WHERE username IN ('@Jayanthi', '@think@gmail.com', '@d1@gmail.com') OR name IN ('ganga', 'Think', 'd1')");
$stmt->execute();
$users = $stmt->fetchAll(PDO::FETCH_COLUMN);

if (empty($users)) {
    echo json_encode(["deleted" => 0, "message" => "No users found"]);
    exit;
}

$placeholders = implode(',', array_fill(0, count($users), '?'));

try {
    $conn->exec("SET FOREIGN_KEY_CHECKS=0");
    
    // Also delete from project_assignments just to be slightly cleaner
    $stmt1 = $conn->prepare("DELETE FROM project_assignments WHERE user_id IN ($placeholders)");
    $stmt1->execute($users);
    
    $stmt2 = $conn->prepare("DELETE FROM users WHERE user_id IN ($placeholders)");
    $stmt2->execute($users);
    
    $conn->exec("SET FOREIGN_KEY_CHECKS=1");
    
    echo json_encode(["deleted" => $stmt2->rowCount(), "user_ids" => $users]);
} catch (Exception $e) {
    $conn->exec("SET FOREIGN_KEY_CHECKS=1");
    echo json_encode(["error" => $e->getMessage()]);
}
?>
