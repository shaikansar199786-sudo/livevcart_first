<?php
// api/controllers/UserController.php

class UserController
{
    private $conn;
    private $table_name = "users";

    public function __construct($db)
    {
        $this->conn = $db;
    }

    public function create($data)
    {
        $query = "INSERT INTO " . $this->table_name . " 
                (name, username, password, role, phone, employee_id, status) 
                VALUES (:name, :username, :password, :role, :phone, :employee_id, :status)";

        $stmt = $this->conn->prepare($query);

        $hashed_password = password_hash($data['password'], PASSWORD_BCRYPT);

        $stmt->bindParam(':name', $data['name']);
        $stmt->bindParam(':username', $data['username']);
        $stmt->bindParam(':password', $hashed_password);
        $stmt->bindParam(':role', $data['role']);
        $stmt->bindParam(':phone', $data['phone']);
        $stmt->bindParam(':employee_id', $data['employee_id']);
        $stmt->bindParam(':status', $data['status']);

        if ($stmt->execute()) {
            return ["success" => true, "message" => "User created successfully."];
        }

        return ["success" => false, "message" => "Unable to create user."];
    }

    public function getAll()
    {
        $query = "SELECT user_id, name, username, role, phone, employee_id, status, created_at FROM " . $this->table_name;
        $stmt = $this->conn->prepare($query);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function update($data)
    {
        $query = "UPDATE " . $this->table_name . " 
                SET name = :name, username = :username, role = :role, 
                    phone = :phone, employee_id = :employee_id, status = :status";
        
        if (!empty($data['password'])) {
            $query .= ", password = :password";
        }
        
        $query .= " WHERE user_id = :user_id";

        $stmt = $this->conn->prepare($query);

        $stmt->bindParam(':name', $data['name']);
        $stmt->bindParam(':username', $data['username']);
        $stmt->bindParam(':role', $data['role']);
        $stmt->bindParam(':phone', $data['phone']);
        $stmt->bindParam(':employee_id', $data['employee_id']);
        $stmt->bindParam(':status', $data['status']);
        $stmt->bindParam(':user_id', $data['user_id']);

        if (!empty($data['password'])) {
            $hashed_password = password_hash($data['password'], PASSWORD_BCRYPT);
            $stmt->bindParam(':password', $hashed_password);
        }

        if ($stmt->execute()) {
            return ["success" => true, "message" => "User updated successfully."];
        }

        return ["success" => false, "message" => "Unable to update user."];
    }

    public function hardDelete($user_id)
    {
        $query = "DELETE FROM " . $this->table_name . " WHERE user_id = :user_id";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':user_id', $user_id);

        if ($stmt->execute()) {
            return ["success" => true, "message" => "User deleted permanently."];
        }
        return ["success" => false, "message" => "Unable to delete user."];
    }
}
?>