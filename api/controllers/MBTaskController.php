<?php
// api/controllers/MBTaskController.php

class MBTaskController
{
    private $conn;

    public function __construct($db)
    {
        $this->conn = $db;
        $this->ensureTable();
    }

    private function ensureTable()
    {
        $sql = "CREATE TABLE IF NOT EXISTS mb_tasks (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            employee_name VARCHAR(150) NOT NULL,
            role VARCHAR(100) NOT NULL,
            task_title VARCHAR(255) NOT NULL,
            description TEXT DEFAULT NULL,
            duration_days INT DEFAULT 1,
            start_date DATE DEFAULT NULL,
            end_date DATE DEFAULT NULL,
            status ENUM('pending_admin_review', 'accepted', 'rejected', 'ongoing', 'pending_completion_review', 'completed', 'cancelled') DEFAULT 'pending_admin_review',
            rejection_reason TEXT DEFAULT NULL,
            admin_notes TEXT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_user (user_id),
            INDEX idx_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

        $subSql = "CREATE TABLE IF NOT EXISTS mb_sub_tasks (
            id INT AUTO_INCREMENT PRIMARY KEY,
            task_id INT NOT NULL,
            title VARCHAR(255) NOT NULL,
            status ENUM('pending', 'completed') DEFAULT 'pending',
            start_date DATE DEFAULT NULL,
            duration_days INT DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (task_id) REFERENCES mb_tasks(id) ON DELETE CASCADE,
            INDEX idx_task (task_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

        try {
            $this->conn->exec($sql);
            $this->conn->exec($subSql);
            // Run ALTER columns safely if they do not exist
            try {
                $this->conn->exec("ALTER TABLE mb_tasks MODIFY COLUMN status ENUM('pending_admin_review', 'accepted', 'rejected', 'ongoing', 'pending_completion_review', 'completed', 'cancelled') DEFAULT 'pending_admin_review'");
            } catch (Exception $e) {}
            try {
                $this->conn->exec("ALTER TABLE mb_sub_tasks ADD COLUMN start_date DATE DEFAULT NULL AFTER status");
            } catch (Exception $e) {}
            try {
                $this->conn->exec("ALTER TABLE mb_sub_tasks ADD COLUMN duration_days INT DEFAULT 1 AFTER start_date");
            } catch (Exception $e) {}
            try {
                $this->conn->exec("ALTER TABLE mb_tasks ADD COLUMN project_type VARCHAR(50) DEFAULT 'interior'");
            } catch (Exception $e) {}
            try {
                $this->conn->exec("ALTER TABLE mb_tasks ADD COLUMN project_name VARCHAR(255) DEFAULT NULL");
            } catch (Exception $e) {}
            try {
                $this->conn->exec("ALTER TABLE mb_tasks ADD COLUMN start_time VARCHAR(20) DEFAULT '09:00'");
            } catch (Exception $e) {}
            try {
                $this->conn->exec("ALTER TABLE mb_tasks ADD COLUMN end_time VARCHAR(20) DEFAULT '18:00'");
            } catch (Exception $e) {}
        } catch (Exception $e) {
            // Table already exists or creation failed
        }
    }

    public function getTasks($user_id = null, $user_role = null, $filter_user_id = null, $status_filter = null)
    {
        try {
            $sql = "SELECT t.*, u.name as employee_fullname, u.username as employee_email 
                    FROM mb_tasks t 
                    LEFT JOIN users u ON t.user_id = u.user_id WHERE 1=1";
            $params = [];

            $user_role_lower = strtolower($user_role ?? '');
            
            // Check if user is a Business Associate
            if ($user_role_lower === 'business_associate') {
                $sql .= " AND t.user_id = :user_id";
                $params['user_id'] = $user_id;
            } else if ($filter_user_id) {
                // Admins/Managers filtering by specific employee
                $sql .= " AND t.user_id = :filter_user_id";
                $params['filter_user_id'] = $filter_user_id;
            }

            if ($status_filter) {
                $sql .= " AND t.status = :status_filter";
                $params['status_filter'] = $status_filter;
            }

            $sql .= " ORDER BY t.created_at DESC";
            $stmt = $this->conn->prepare($sql);
            $stmt->execute($params);
            $tasks = $stmt->fetchAll(PDO::FETCH_ASSOC);

            if (!empty($tasks)) {
                $taskIds = array_column($tasks, 'id');
                $placeholders = implode(',', array_fill(0, count($taskIds), '?'));
                $subStmt = $this->conn->prepare("SELECT * FROM mb_sub_tasks WHERE task_id IN ($placeholders) ORDER BY id ASC");
                $subStmt->execute($taskIds);
                $subTasks = $subStmt->fetchAll(PDO::FETCH_ASSOC);

                $subTasksMap = [];
                foreach ($subTasks as $st) {
                    $subTasksMap[$st['task_id']][] = $st;
                }

                foreach ($tasks as &$t) {
                    $t['sub_tasks'] = $subTasksMap[$t['id']] ?? [];
                }
            }

            return ["success" => true, "data" => $tasks];
        } catch (Exception $e) {
            return ["success" => false, "message" => $e->getMessage()];
        }
    }

    public function submitTask($data)
    {
        try {
            $start_date = $data['start_date'] ?? date('Y-m-d');
            $end_date = !empty($data['end_date']) ? $data['end_date'] : date('Y-m-d', strtotime($start_date . " + " . (intval($data['duration_days'] ?? 1) - 1) . " days"));
            $diffSecs = strtotime($end_date) - strtotime($start_date);
            $duration_days = max(1, round($diffSecs / 86400) + 1);

            $sql = "INSERT INTO mb_tasks (user_id, employee_name, role, task_title, description, duration_days, start_date, end_date, start_time, end_time, project_type, project_name, status) 
                    VALUES (:user_id, :employee_name, :role, :task_title, :description, :duration_days, :start_date, :end_date, :start_time, :end_time, :project_type, :project_name, 'pending_admin_review')";
            
            $stmt = $this->conn->prepare($sql);
            $stmt->execute([
                'user_id' => $data['user_id'],
                'employee_name' => $data['employee_name'] ?? 'Marketing/Business User',
                'role' => $data['role'] ?? 'business_associate',
                'task_title' => $data['task_title'],
                'description' => $data['description'] ?? '',
                'duration_days' => $duration_days,
                'start_date' => $start_date,
                'end_date' => $end_date,
                'start_time' => $data['start_time'] ?? '09:00',
                'end_time' => $data['end_time'] ?? '18:00',
                'project_type' => $data['project_type'] ?? 'interior',
                'project_name' => $data['project_name'] ?? ''
            ]);

            $task_id = $this->conn->lastInsertId();

            // Insert sub-tasks if provided (expects list of objects with title, start_date, duration_days)
            if (isset($data['sub_tasks']) && is_array($data['sub_tasks'])) {
                $sub_sql = "INSERT INTO mb_sub_tasks (task_id, title, status, start_date, duration_days) 
                            VALUES (:task_id, :title, 'pending', :start_date, :duration_days)";
                $sub_stmt = $this->conn->prepare($sub_sql);
                foreach ($data['sub_tasks'] as $sub) {
                    // Check if $sub is an array or object, or plain string for backward compatibility
                    if (is_array($sub)) {
                        $sub_title = $sub['title'] ?? '';
                        $sub_start = $sub['start_date'] ?? null;
                        $sub_dur = intval($sub['duration_days'] ?? 1);
                    } else {
                        $sub_title = strval($sub);
                        $sub_start = null;
                        $sub_dur = 1;
                    }

                    if (trim($sub_title) !== '') {
                        $sub_stmt->execute([
                            'task_id' => $task_id,
                            'title' => trim($sub_title),
                            'start_date' => $sub_start ? $sub_start : null,
                            'duration_days' => $sub_dur
                        ]);
                    }
                }
            }

            // Create notification for Admin
            $n_sql = "INSERT INTO notifications (user_id, title, message, type) 
                      SELECT user_id, 'New Marketing/Business Task Submission', :msg, 'mb_task' 
                      FROM users WHERE role = 'admin'";
            $n_stmt = $this->conn->prepare($n_sql);
            $n_stmt->execute([
                'msg' => ($data['employee_name'] ?? 'An employee') . " submitted a new task request: " . $data['task_title']
            ]);

            return ["success" => true, "message" => "Task submitted to Admin for approval!", "task_id" => $task_id];
        } catch (Exception $e) {
            return ["success" => false, "message" => $e->getMessage()];
        }
    }

    public function reviewTask($data)
    {
        try {
            $id = $data['id'];
            $action = $data['action']; // 'accept', 'reject', 'approve_completion', 'reject_completion'
            $notes = $data['notes'] ?? '';

            // Fetch current status to know what we are reviewing
            $get_task = $this->conn->prepare("SELECT user_id, task_title, status FROM mb_tasks WHERE id = :id");
            $get_task->execute(['id' => $id]);
            $task_row = $get_task->fetch(PDO::FETCH_ASSOC);

            if (!$task_row) {
                return ["success" => false, "message" => "Task not found."];
            }

            if ($action === 'accept') {
                $status = 'accepted';
                $rejection_reason = null;
                $admin_notes = $notes;
            } elseif ($action === 'reject') {
                $status = 'rejected';
                $rejection_reason = $notes;
                $admin_notes = null;
            } elseif ($action === 'cancel') {
                $status = 'cancelled';
                $rejection_reason = $notes ?: 'Cancelled by Admin';
                $admin_notes = $notes ?: 'Cancelled by Admin';
            } elseif ($action === 'approve_completion') {
                $status = 'completed';
                $rejection_reason = null;
                $admin_notes = $notes ?: 'Approved completion.';
            } elseif ($action === 'reject_completion') {
                $status = 'ongoing';
                $rejection_reason = $notes; // Store completion rejection notes here
                $admin_notes = null;
            } else {
                return ["success" => false, "message" => "Invalid review action."];
            }

            $sql = "UPDATE mb_tasks SET status = :status, rejection_reason = :rejection_reason, admin_notes = :admin_notes WHERE id = :id";
            $stmt = $this->conn->prepare($sql);
            $stmt->execute([
                'status' => $status,
                'rejection_reason' => $rejection_reason,
                'admin_notes' => $admin_notes,
                'id' => $id
            ]);

            // Notify the employee
            $msg = '';
            if ($action === 'accept') {
                $msg = "Your task request '{$task_row['task_title']}' was ACCEPTED by Admin! You can now start the task.";
            } elseif ($action === 'reject') {
                $msg = "Your task request '{$task_row['task_title']}' was REJECTED by Admin. Reason: " . ($notes ?: 'Please revise and resubmit.');
            } elseif ($action === 'cancel') {
                $msg = "Your task '{$task_row['task_title']}' has been CANCELLED by Admin. Reason: " . ($notes ?: 'No reason specified.');
            } elseif ($action === 'approve_completion') {
                $msg = "Your task completion for '{$task_row['task_title']}' was APPROVED by Admin!";
            } elseif ($action === 'reject_completion') {
                $msg = "Your task completion for '{$task_row['task_title']}' was REJECTED by Admin. Reason: " . ($notes ?: 'Please complete remaining items.');
            }

            if ($msg) {
                $n_sql = "INSERT INTO notifications (user_id, title, message, type) VALUES (:u_id, 'Task Approval Update', :msg, 'mb_review')";
                $n_stmt = $this->conn->prepare($n_sql);
                $n_stmt->execute(['u_id' => $task_row['user_id'], 'msg' => $msg]);
            }

            return ["success" => true, "message" => "Task review updated successfully."];
        } catch (Exception $e) {
            return ["success" => false, "message" => $e->getMessage()];
        }
    }

    public function updateStatus($data)
    {
        try {
            $id = $data['id'];
            $status = $data['status']; // 'ongoing', 'pending_completion_review'

            // Fetch current status
            $check = $this->conn->prepare("SELECT status FROM mb_tasks WHERE id = :id");
            $check->execute(['id' => $id]);
            $curr = $check->fetch(PDO::FETCH_ASSOC);

            if (!$curr) {
                return ["success" => false, "message" => "Task not found."];
            }

            if ($status === 'ongoing' && $curr['status'] !== 'accepted') {
                return ["success" => false, "message" => "Only accepted tasks can be started."];
            }

            if ($status === 'pending_completion_review' && $curr['status'] !== 'ongoing') {
                return ["success" => false, "message" => "Only ongoing tasks can be submitted for completion review."];
            }

            if ($status === 'cancelled') {
                if ($curr['status'] === 'completed') {
                    return ["success" => false, "message" => "Completed tasks cannot be cancelled."];
                }
            }

            // Note: direct status update to 'completed' is blocked on this endpoint to force admin review
            if ($status === 'completed') {
                return ["success" => false, "message" => "Completion requires Admin approval."];
            }

            $notes = $data['notes'] ?? ($data['reason'] ?? 'Cancelled');
            if ($status === 'cancelled') {
                $sql = "UPDATE mb_tasks SET status = :status, rejection_reason = :notes WHERE id = :id";
                $stmt = $this->conn->prepare($sql);
                $stmt->execute(['status' => $status, 'notes' => $notes, 'id' => $id]);
            } else {
                $sql = "UPDATE mb_tasks SET status = :status WHERE id = :id";
                $stmt = $this->conn->prepare($sql);
                $stmt->execute(['status' => $status, 'id' => $id]);
            }

            if ($status === 'pending_completion_review') {
                $get_task = $this->conn->prepare("SELECT employee_name, task_title FROM mb_tasks WHERE id = :id");
                $get_task->execute(['id' => $id]);
                $task_row = $get_task->fetch(PDO::FETCH_ASSOC);

                if ($task_row) {
                    $n_sql = "INSERT INTO notifications (user_id, title, message, type) 
                              SELECT user_id, 'Marketing/Business Task Completion Request', :msg, 'mb_completion_request' 
                              FROM users WHERE role = 'admin'";
                    $n_stmt = $this->conn->prepare($n_sql);
                    $n_stmt->execute(['msg' => "{$task_row['employee_name']} submitted task '{$task_row['task_title']}' for completion approval."]);
                }
            }

            return ["success" => true, "message" => "Task status updated to {$status}."];
        } catch (Exception $e) {
            return ["success" => false, "message" => $e->getMessage()];
        }
    }

    public function assignDirectTask($data)
    {
        try {
            $start_date = $data['start_date'] ?? date('Y-m-d');
            $end_date = !empty($data['end_date']) ? $data['end_date'] : date('Y-m-d', strtotime($start_date . " + " . (intval($data['duration_days'] ?? 1) - 1) . " days"));
            $diffSecs = strtotime($end_date) - strtotime($start_date);
            $duration_days = max(1, round($diffSecs / 86400) + 1);

            $sql = "INSERT INTO mb_tasks (user_id, employee_name, role, task_title, description, duration_days, start_date, end_date, start_time, end_time, project_type, project_name, status, admin_notes) 
                    VALUES (:user_id, :employee_name, :role, :task_title, :description, :duration_days, :start_date, :end_date, :start_time, :end_time, :project_type, :project_name, 'accepted', :admin_notes)";
            $stmt = $this->conn->prepare($sql);
            $stmt->execute([
                'user_id' => $data['user_id'],
                'employee_name' => $data['employee_name'] ?? 'Marketing/Business User',
                'role' => $data['role'] ?? 'business_associate',
                'task_title' => $data['task_title'],
                'description' => $data['description'] ?? '',
                'duration_days' => $duration_days,
                'start_date' => $start_date,
                'end_date' => $end_date,
                'start_time' => $data['start_time'] ?? '09:00',
                'end_time' => $data['end_time'] ?? '18:00',
                'project_type' => $data['project_type'] ?? 'interior',
                'project_name' => $data['project_name'] ?? '',
                'admin_notes' => $data['admin_notes'] ?? 'Assigned directly by Admin'
            ]);

            $task_id = $this->conn->lastInsertId();

            $n_sql = "INSERT INTO notifications (user_id, title, message, type) VALUES (:u_id, 'New Task Assigned by Admin', :msg, 'mb_new_task')";
            $n_stmt = $this->conn->prepare($n_sql);
            $n_stmt->execute([
                'u_id' => $data['user_id'], 
                'msg' => "Admin assigned you a new task: " . $data['task_title']
            ]);

            return ["success" => true, "message" => "Task assigned directly!", "task_id" => $task_id];
        } catch (Exception $e) {
            return ["success" => false, "message" => $e->getMessage()];
        }
    }

    public function getStatsSummary($user_id = null, $user_role = null)
    {
        try {
            $user_role_lower = strtolower($user_role ?? '');
            
            // Base SQL queries for stats
            $where = " WHERE 1=1";
            $params = [];

            if ($user_role_lower === 'business_associate') {
                $where .= " AND user_id = :user_id";
                $params['user_id'] = $user_id;
            }

            // Total remaining/pending
            $stmt_pending = $this->conn->prepare("SELECT COUNT(*) as count FROM mb_tasks {$where} AND status = 'pending_admin_review'");
            $stmt_pending->execute($params);
            $pending = $stmt_pending->fetch(PDO::FETCH_ASSOC)['count'];

            // Total accepted (including ongoing)
            $stmt_accepted = $this->conn->prepare("SELECT COUNT(*) as count FROM mb_tasks {$where} AND status IN ('accepted', 'ongoing')");
            $stmt_accepted->execute($params);
            $accepted = $stmt_accepted->fetch(PDO::FETCH_ASSOC)['count'];

            // Total rejected
            $stmt_rejected = $this->conn->prepare("SELECT COUNT(*) as count FROM mb_tasks {$where} AND status = 'rejected'");
            $stmt_rejected->execute($params);
            $rejected = $stmt_rejected->fetch(PDO::FETCH_ASSOC)['count'];

            // Total completed
            $stmt_completed = $this->conn->prepare("SELECT COUNT(*) as count FROM mb_tasks {$where} AND status = 'completed'");
            $stmt_completed->execute($params);
            $completed = $stmt_completed->fetch(PDO::FETCH_ASSOC)['count'];

            // Total cancelled
            $stmt_cancelled = $this->conn->prepare("SELECT COUNT(*) as count FROM mb_tasks {$where} AND status = 'cancelled'");
            $stmt_cancelled->execute($params);
            $cancelled = $stmt_cancelled->fetch(PDO::FETCH_ASSOC)['count'];

            // Total delayed/deadline tasks (status in accepted, ongoing AND end_date < current_date)
            $stmt_delayed = $this->conn->prepare("SELECT COUNT(*) as count FROM mb_tasks {$where} AND status IN ('accepted', 'ongoing') AND end_date < CURDATE()");
            $stmt_delayed->execute($params);
            $delayed = $stmt_delayed->fetch(PDO::FETCH_ASSOC)['count'];

            return [
                "success" => true,
                "data" => [
                    "pending" => intval($pending),
                    "accepted" => intval($accepted),
                    "rejected" => intval($rejected),
                    "completed" => intval($completed),
                    "delayed" => intval($delayed),
                    "cancelled" => intval($cancelled)
                ]
            ];
        } catch (Exception $e) {
            return ["success" => false, "message" => $e->getMessage()];
        }
    }

    public function toggleSubTask($data)
    {
        try {
            $id = $data['subtask_id'];
            $status = $data['status']; // 'pending' or 'completed'

            $sql = "UPDATE mb_sub_tasks SET status = :status WHERE id = :id";
            $stmt = $this->conn->prepare($sql);
            $stmt->execute(['status' => $status, 'id' => $id]);

            return ["success" => true, "message" => "Sub-task status updated."];
        } catch (Exception $e) {
            return ["success" => false, "message" => $e->getMessage()];
        }
    }
}
?>
