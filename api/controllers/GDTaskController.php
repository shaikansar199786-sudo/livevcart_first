<?php
// api/controllers/GDTaskController.php

class GDTaskController
{
    private $conn;

    public function __construct($db)
    {
        $this->conn = $db;
        $this->ensureTable();
    }

    private function ensureTable()
    {
        $sql = "CREATE TABLE IF NOT EXISTS gd_tasks (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            gd_name VARCHAR(150) NOT NULL,
            task_title VARCHAR(255) NOT NULL,
            description TEXT DEFAULT NULL,
            target_type ENUM('daily', 'weekly', 'monthly') DEFAULT 'daily',
            target_date DATE DEFAULT NULL,
            status ENUM('pending_admin_review', 'accepted', 'rejected', 'ongoing', 'pending_completion_approval', 'completed', 'incomplete') DEFAULT 'pending_admin_review',
            rejection_reason TEXT DEFAULT NULL,
            admin_notes TEXT DEFAULT NULL,
            attachment_url TEXT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_user (user_id),
            INDEX idx_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

        try {
            $this->conn->exec($sql);
        } catch (Exception $e) {
            // ignore if already exists
        }
    }

    public function getTasks($user_id = null, $user_role = null, $filter_gd_id = null)
    {
        try {
            $sql = "SELECT t.*, u.name as employee_name, u.username as employee_email 
                    FROM gd_tasks t 
                    LEFT JOIN users u ON t.user_id = u.user_id WHERE 1=1";
            $params = [];

            if ($filter_gd_id) {
                $sql .= " AND t.user_id = :filter_gd_id";
                $params['filter_gd_id'] = $filter_gd_id;
            } elseif (in_array(strtolower($user_role ?? ''), ['graphic_designer', 'gd']) || strpos(strtolower($user_role ?? ''), 'graphic') !== false) {
                $sql .= " AND t.user_id = :user_id";
                $params['user_id'] = $user_id;
            }

            $sql .= " ORDER BY t.created_at DESC";
            $stmt = $this->conn->prepare($sql);
            $stmt->execute($params);
            $tasks = $stmt->fetchAll(PDO::FETCH_ASSOC);

            return ["success" => true, "data" => $tasks];
        } catch (Exception $e) {
            return ["success" => false, "message" => $e->getMessage()];
        }
    }

    public function submitTarget($data)
    {
        try {
            $sql = "INSERT INTO gd_tasks (user_id, gd_name, task_title, description, target_type, target_date, attachment_url, status) 
                    VALUES (:user_id, :gd_name, :task_title, :description, :target_type, :target_date, :attachment_url, 'pending_admin_review')";
            $stmt = $this->conn->prepare($sql);
            $stmt->execute([
                'user_id' => $data['user_id'],
                'gd_name' => $data['gd_name'] ?? 'Graphic Designer',
                'task_title' => $data['task_title'],
                'description' => $data['description'] ?? '',
                'target_type' => $data['target_type'] ?? 'daily',
                'target_date' => $data['target_date'] ?? date('Y-m-d'),
                'attachment_url' => $data['attachment_url'] ?? ''
            ]);

            $task_id = $this->conn->lastInsertId();

            // Create notification for Admin
            $n_sql = "INSERT INTO notifications (user_id, title, message, type) 
                      SELECT user_id, 'New GD Target Submission', :msg, 'gd_target' 
                      FROM users WHERE role = 'admin' LIMIT 1";
            $n_stmt = $this->conn->prepare($n_sql);
            $n_stmt->execute(['msg' => ($data['gd_name'] ?? 'A Graphic Designer') . " submitted a new target: " . $data['task_title']]);

            return ["success" => true, "message" => "Target work submitted to Admin for review!", "task_id" => $task_id];
        } catch (Exception $e) {
            return ["success" => false, "message" => $e->getMessage()];
        }
    }

    public function reviewSubmission($data)
    {
        try {
            $id = $data['id'];
            $action = $data['action']; // 'accept' or 'reject'
            $notes = $data['notes'] ?? '';

            if ($action === 'accept') {
                $status = 'accepted';
                $rejection_reason = null;
            } else {
                $status = 'rejected';
                $rejection_reason = $notes;
            }

            $sql = "UPDATE gd_tasks SET status = :status, rejection_reason = :rejection_reason, admin_notes = :notes WHERE id = :id";
            $stmt = $this->conn->prepare($sql);
            $stmt->execute([
                'status' => $status,
                'rejection_reason' => $rejection_reason,
                'notes' => $notes,
                'id' => $id
            ]);

            // Notify the GD employee
            $get_task = $this->conn->prepare("SELECT user_id, task_title FROM gd_tasks WHERE id = :id");
            $get_task->execute(['id' => $id]);
            $task_row = $get_task->fetch(PDO::FETCH_ASSOC);

            if ($task_row) {
                $msg = $action === 'accept' 
                    ? "Your submission '{$task_row['task_title']}' was ACCEPTED by Admin and added to your active Tasks!" 
                    : "Your submission '{$task_row['task_title']}' was REJECTED by Admin. Notes: " . ($notes ?: 'Please revise and resubmit.');
                
                $n_sql = "INSERT INTO notifications (user_id, title, message, type) VALUES (:u_id, 'GD Work Review Update', :msg, 'gd_review')";
                $n_stmt = $this->conn->prepare($n_sql);
                $n_stmt->execute(['u_id' => $task_row['user_id'], 'msg' => $msg]);
            }

            return ["success" => true, "message" => "Submission review updated successfully."];
        } catch (Exception $e) {
            return ["success" => false, "message" => $e->getMessage()];
        }
    }

    public function updateStatus($data)
    {
        try {
            $id = $data['id'];
            $status = $data['status']; // 'ongoing', 'pending_completion_approval'
            $attachment_url = $data['attachment_url'] ?? null;

            if ($attachment_url) {
                $sql = "UPDATE gd_tasks SET status = :status, attachment_url = :attachment_url WHERE id = :id";
                $stmt = $this->conn->prepare($sql);
                $stmt->execute(['status' => $status, 'attachment_url' => $attachment_url, 'id' => $id]);
            } else {
                $sql = "UPDATE gd_tasks SET status = :status WHERE id = :id";
                $stmt = $this->conn->prepare($sql);
                $stmt->execute(['status' => $status, 'id' => $id]);
            }

            if ($status === 'pending_completion_approval') {
                $get_task = $this->conn->prepare("SELECT gd_name, task_title FROM gd_tasks WHERE id = :id");
                $get_task->execute(['id' => $id]);
                $task_row = $get_task->fetch(PDO::FETCH_ASSOC);

                if ($task_row) {
                    $n_sql = "INSERT INTO notifications (user_id, title, message, type) 
                              SELECT user_id, 'GD Task Completion Approval Request', :msg, 'gd_completion' 
                              FROM users WHERE role = 'admin' LIMIT 1";
                    $n_stmt = $this->conn->prepare($n_sql);
                    $n_stmt->execute(['msg' => "{$task_row['gd_name']} marked '{$task_row['task_title']}' as completed. Approval required."]);
                }
            }

            return ["success" => true, "message" => "Task status updated."];
        } catch (Exception $e) {
            return ["success" => false, "message" => $e->getMessage()];
        }
    }

    public function reviewCompletion($data)
    {
        try {
            $id = $data['id'];
            $action = $data['action']; // 'approve' or 'reject'
            $notes = $data['notes'] ?? '';

            $status = $action === 'approve' ? 'completed' : 'incomplete';

            $sql = "UPDATE gd_tasks SET status = :status, admin_notes = :notes WHERE id = :id";
            $stmt = $this->conn->prepare($sql);
            $stmt->execute(['status' => $status, 'notes' => $notes, 'id' => $id]);

            $get_task = $this->conn->prepare("SELECT user_id, task_title FROM gd_tasks WHERE id = :id");
            $get_task->execute(['id' => $id]);
            $task_row = $get_task->fetch(PDO::FETCH_ASSOC);

            if ($task_row) {
                $msg = $action === 'approve' 
                    ? "Great job! Admin APPROVED completion of task '{$task_row['task_title']}'." 
                    : "Admin marked task '{$task_row['task_title']}' as INCOMPLETE. Notes: " . ($notes ?: 'Please make necessary changes.');

                $n_sql = "INSERT INTO notifications (user_id, title, message, type) VALUES (:u_id, 'Task Completion Review', :msg, 'gd_completion_review')";
                $n_stmt = $this->conn->prepare($n_sql);
                $n_stmt->execute(['u_id' => $task_row['user_id'], 'msg' => $msg]);
            }

            return ["success" => true, "message" => "Completion review updated."];
        } catch (Exception $e) {
            return ["success" => false, "message" => $e->getMessage()];
        }
    }

    public function assignDirectTask($data)
    {
        try {
            $sql = "INSERT INTO gd_tasks (user_id, gd_name, task_title, description, target_type, target_date, status, admin_notes) 
                    VALUES (:user_id, :gd_name, :task_title, :description, :target_type, :target_date, 'accepted', :admin_notes)";
            $stmt = $this->conn->prepare($sql);
            $stmt->execute([
                'user_id' => $data['user_id'],
                'gd_name' => $data['gd_name'] ?? 'Graphic Designer',
                'task_title' => $data['task_title'],
                'description' => $data['description'] ?? '',
                'target_type' => $data['target_type'] ?? 'daily',
                'target_date' => $data['target_date'] ?? date('Y-m-d'),
                'admin_notes' => $data['admin_notes'] ?? 'Assigned by Admin'
            ]);

            $task_id = $this->conn->lastInsertId();

            $n_sql = "INSERT INTO notifications (user_id, title, message, type) VALUES (:u_id, 'New Task Assigned by Admin', :msg, 'gd_new_task')";
            $n_stmt = $this->conn->prepare($n_sql);
            $n_stmt->execute(['u_id' => $data['user_id'], 'msg' => "Admin assigned you a new task: " . $data['task_title']]);

            return ["success" => true, "message" => "Task assigned directly to Graphic Designer!", "task_id" => $task_id];
        } catch (Exception $e) {
            return ["success" => false, "message" => $e->getMessage()];
        }
    }
}
