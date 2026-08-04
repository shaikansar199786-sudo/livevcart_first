<?php
require_once 'config/database.php';
$db = new Database();
$conn = $db->getConnection();

$hash = password_hash('123456', PASSWORD_BCRYPT);
$stmt = $conn->prepare("UPDATE users SET password = :hash");
if ($stmt->execute([':hash' => $hash])) {
    echo "All passwords reset to '123456'.";
} else {
    echo "Failed to reset passwords.";
}
?>
