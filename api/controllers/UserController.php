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

    /**
     * Purges accounts that have been soft-deleted for more than 30 days.
     * User requirement: "after 30 day permant delted account"
     */
    private function purgeExpiredDeletedUsers()
    {
        try {
            $query = "DELETE FROM " . $this->table_name . " 
                      WHERE status = 'deleted' 
                      AND deleted_at IS NOT NULL 
                      AND deleted_at < DATE_SUB(NOW(), INTERVAL 30 DAY)";
            $this->conn->exec($query);
        } catch (Exception $e) {
            // Ignore purge error silently to avoid blocking user flow
        }
    }

    public function create($data)
    {
        try {
            $query = "INSERT INTO " . $this->table_name . " 
                    (name, username, password, plain_password, role, department, phone, employee_id, status) 
                    VALUES (:name, :username, :password, :plain_password, :role, :department, :phone, :employee_id, :status)";

            $stmt = $this->conn->prepare($query);

            $raw_password = (string)($data['password'] ?? '');
            $hashed_password = password_hash($raw_password, PASSWORD_BCRYPT);
            $name = trim($data['name'] ?? '');
            $username = trim($data['username'] ?? '');
            $role = $data['role'] ?? 'project_head';
            $department = !empty($data['department']) ? trim($data['department']) : null;
            $phone = !empty($data['phone']) ? trim($data['phone']) : null;
            $employee_id = !empty($data['employee_id']) ? trim($data['employee_id']) : null;
            $status = $data['status'] ?? 'active';

            $stmt->bindParam(':name', $name);
            $stmt->bindParam(':username', $username);
            $stmt->bindParam(':password', $hashed_password);
            $stmt->bindParam(':plain_password', $raw_password);
            $stmt->bindParam(':role', $role);
            $stmt->bindParam(':department', $department);
            $stmt->bindParam(':phone', $phone);
            $stmt->bindParam(':employee_id', $employee_id);
            $stmt->bindParam(':status', $status);

            if ($stmt->execute()) {
                return ["success" => true, "message" => "User created successfully."];
            }

            return ["success" => false, "message" => "Unable to create user."];
        } catch (PDOException $e) {
            if ($e->getCode() == 23000 || strpos($e->getMessage(), '1062') !== false) {
                if (strpos($e->getMessage(), 'username') !== false) {
                    return ["success" => false, "message" => "Username/Email already exists."];
                }
                if (strpos($e->getMessage(), 'employee_id') !== false) {
                    return ["success" => false, "message" => "Employee ID already exists."];
                }
                return ["success" => false, "message" => "User record already exists."];
            }
            return ["success" => false, "message" => "Database error: " . $e->getMessage()];
        }
    }

    public function getAll()
    {
        try {
            // First run auto-purge for any account deleted > 30 days ago
            $this->purgeExpiredDeletedUsers();

            $query = "SELECT user_id, name, username, role, department, phone, employee_id, status, deleted_at, 
                             plain_password, created_at,
                             GREATEST(0, 30 - DATEDIFF(NOW(), deleted_at)) as days_remaining
                      FROM " . $this->table_name . " 
                      ORDER BY user_id DESC";
            $stmt = $this->conn->prepare($query);
            $stmt->execute();
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            return [];
        }
    }

    public function update($data)
    {
        try {
            $query = "UPDATE " . $this->table_name . " 
                    SET name = :name, username = :username, role = :role, department = :department, 
                        phone = :phone, employee_id = :employee_id, status = :status";
            
            $hasPassword = isset($data['password']) && strlen(trim((string)$data['password'])) > 0;
            if ($hasPassword) {
                $query .= ", password = :password, plain_password = :plain_password";
            }
            
            $query .= " WHERE user_id = :user_id";

            $stmt = $this->conn->prepare($query);

            $name = trim($data['name'] ?? '');
            $username = trim($data['username'] ?? '');
            $role = $data['role'] ?? 'project_head';
            $department = !empty($data['department']) ? trim($data['department']) : null;
            $phone = !empty($data['phone']) ? trim($data['phone']) : null;
            $employee_id = !empty($data['employee_id']) ? trim($data['employee_id']) : null;
            $status = $data['status'] ?? 'active';
            $user_id = $data['user_id'] ?? null;

            $stmt->bindParam(':name', $name);
            $stmt->bindParam(':username', $username);
            $stmt->bindParam(':role', $role);
            $stmt->bindParam(':department', $department);
            $stmt->bindParam(':phone', $phone);
            $stmt->bindParam(':employee_id', $employee_id);
            $stmt->bindParam(':status', $status);
            $stmt->bindParam(':user_id', $user_id);

            if ($hasPassword) {
                $raw_password = (string)$data['password'];
                $hashed_password = password_hash($raw_password, PASSWORD_BCRYPT);
                $stmt->bindParam(':password', $hashed_password);
                $stmt->bindParam(':plain_password', $raw_password);
            }

            if ($stmt->execute()) {
                return ["success" => true, "message" => "User updated successfully."];
            }

            return ["success" => false, "message" => "Unable to update user."];
        } catch (PDOException $e) {
            if ($e->getCode() == 23000 || strpos($e->getMessage(), '1062') !== false) {
                if (strpos($e->getMessage(), 'username') !== false) {
                    return ["success" => false, "message" => "Username/Email already exists."];
                }
                if (strpos($e->getMessage(), 'employee_id') !== false) {
                    return ["success" => false, "message" => "Employee ID already exists."];
                }
                return ["success" => false, "message" => "Duplicate record found."];
            }
            return ["success" => false, "message" => "Database error: " . $e->getMessage()];
        }
    }

    /**
     * Soft delete with 30-day recovery window.
     */
    public function softDelete($user_id)
    {
        try {
            $query = "UPDATE " . $this->table_name . " 
                      SET status = 'deleted', deleted_at = NOW() 
                      WHERE user_id = :user_id";
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':user_id', $user_id);

            if ($stmt->execute()) {
                return [
                    "success" => true, 
                    "message" => "Employee account moved to Trash. You have 30 days to recover this account before permanent removal."
                ];
            }
            return ["success" => false, "message" => "Unable to delete user."];
        } catch (PDOException $e) {
            return ["success" => false, "message" => "Database error: " . $e->getMessage()];
        }
    }

    /**
     * Restore employee account within 30-day recovery window.
     */
    public function restore($user_id)
    {
        try {
            $query = "UPDATE " . $this->table_name . " 
                      SET status = 'active', deleted_at = NULL 
                      WHERE user_id = :user_id";
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':user_id', $user_id);

            if ($stmt->execute()) {
                return [
                    "success" => true, 
                    "message" => "Employee account restored successfully! Login access and dashboard permissions are active again."
                ];
            }
            return ["success" => false, "message" => "Unable to restore user."];
        } catch (PDOException $e) {
            return ["success" => false, "message" => "Database error: " . $e->getMessage()];
        }
    }

    /**
     * Update active / inactive status.
     */
    public function updateStatus($user_id, $status)
    {
        try {
            $allowed = ['active', 'inactive'];
            if (!in_array($status, $allowed)) {
                return ["success" => false, "message" => "Invalid status value."];
            }

            $query = "UPDATE " . $this->table_name . " 
                      SET status = :status, deleted_at = NULL 
                      WHERE user_id = :user_id";
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':status', $status);
            $stmt->bindParam(':user_id', $user_id);

            if ($stmt->execute()) {
                return ["success" => true, "message" => "Employee status updated to " . ucfirst($status) . "."];
            }
            return ["success" => false, "message" => "Unable to update status."];
        } catch (PDOException $e) {
            return ["success" => false, "message" => "Database error: " . $e->getMessage()];
        }
    }

    /**
     * Permanent delete (force delete immediately).
     */
    public function hardDelete($user_id)
    {
        try {
            $query = "DELETE FROM " . $this->table_name . " WHERE user_id = :user_id";
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':user_id', $user_id);

            if ($stmt->execute()) {
                return ["success" => true, "message" => "Employee account permanently deleted."];
            }
            return ["success" => false, "message" => "Unable to permanently delete user."];
        } catch (PDOException $e) {
            return ["success" => false, "message" => "Database error: " . $e->getMessage()];
        }
    }
}
?>