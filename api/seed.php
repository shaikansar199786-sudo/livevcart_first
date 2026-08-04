<?php
// api/seed.php
require_once 'config/database.php';

try {
    $db = new Database();
    $conn = $db->getConnection();
    $name = "Super Admin";
    $username = "admin";
    $password = password_hash("admin123", PASSWORD_BCRYPT);
    $role = "principal_architect";
    $employee_id = "Livincart001";
    $status = "active";

    $query = "INSERT INTO users (name, username, password, role, employee_id, status) 
              VALUES (:name, :username, :password, :role, :employee_id, :status)
              ON DUPLICATE KEY UPDATE name=VALUES(name)";

    $stmt = $conn->prepare($query);

    $stmt->bindParam(':name', $name);
    $stmt->bindParam(':username', $username);
    $stmt->bindParam(':password', $password);
    $stmt->bindParam(':role', $role);
    $stmt->bindParam(':employee_id', $employee_id);
    $stmt->bindParam(':status', $status);

    if ($stmt->execute()) {
        echo "Seed successful. User Created:<br>";
        echo "Username: admin<br>";
        echo "Password: admin123<br>";
    } else {
        echo "Seed failed.";
    }
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage();
}
?>