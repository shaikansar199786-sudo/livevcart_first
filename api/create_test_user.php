<?php
require_once 'config/database.php';
$db = new Database();
$conn = $db->getConnection();

$password = password_hash('password123', PASSWORD_DEFAULT);

$query = "INSERT INTO users (name, username, phone, role, password, status) 
          VALUES ('Test Sales', 'sales@test.com', '1234567890', 'sales', :password, 'active')";
$stmt = $conn->prepare($query);
$stmt->bindParam(':password', $password);

if($stmt->execute()) {
    echo "Created Sales user successfully.";
} else {
    echo "Error creating user.";
}
?>
