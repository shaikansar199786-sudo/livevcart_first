<?php
// api/controllers/NotificationController.php

class NotificationController
{
    private $conn;

    public function __construct($db)
    {
        $this->conn = $db;
        $this->ensureNotificationsSchema();
    }

    public function ensureNotificationsSchema()
    {
        try {
            if (!$this->conn) return;
            $this->conn->exec("CREATE TABLE IF NOT EXISTS notifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                title VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                type VARCHAR(50) DEFAULT 'info',
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_user_id (user_id),
                INDEX idx_is_read (is_read)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        } catch (Throwable $e) {}
    }

    public function getUnread($user_id)
    {
        try {
            $this->ensureNotificationsSchema();
            $query = "SELECT * FROM notifications WHERE user_id = :user_id AND is_read = 0 ORDER BY created_at DESC";
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':user_id', $user_id);
            $stmt->execute();
            return ["success" => true, "data" => $stmt->fetchAll(PDO::FETCH_ASSOC) ?: []];
        } catch (Throwable $e) {
            return ["success" => true, "data" => []];
        }
    }

    public function markAsRead($notification_id)
    {
        try {
            $query = "UPDATE notifications SET is_read = 1 WHERE id = :id";
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':id', $notification_id);
            
            if ($stmt->execute()) {
                return ["success" => true, "message" => "Marked as read."];
            }
            return ["success" => false, "message" => "Failed to update notification."];
        } catch (Throwable $e) {
            return ["success" => false, "message" => $e->getMessage()];
        }
    }

    public function notifyAdmins($title, $message)
    {
        try {
            // Find all admin and project manager users
            $u_query = "SELECT user_id FROM users WHERE LOWER(role) IN ('admin', 'project_head', 'project_manager', 'manager')";
            $u_stmt = $this->conn->prepare($u_query);
            $u_stmt->execute();
            $admins = $u_stmt->fetchAll(PDO::FETCH_ASSOC);

            if (empty($admins)) {
                return ["success" => true, "message" => "No admins found to notify."];
            }

            $n_query = "INSERT INTO notifications (user_id, title, message, is_read, created_at) VALUES (:user_id, :title, :message, 0, NOW())";
            $n_stmt = $this->conn->prepare($n_query);

            foreach ($admins as $admin) {
                $n_stmt->execute([
                    ':user_id' => $admin['user_id'],
                    ':title' => $title,
                    ':message' => $message
                ]);
            }

            return ["success" => true, "message" => "Admins notified successfully."];
        } catch (Exception $e) {
            return ["success" => false, "message" => $e->getMessage()];
        }
    }

    private function ensureSupportQueriesSchema()
    {
        try {
            $sql = "CREATE TABLE IF NOT EXISTS support_queries (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NULL,
                user_name VARCHAR(255) NULL,
                user_role VARCHAR(100) NULL,
                query_type VARCHAR(100) DEFAULT 'query',
                subject VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                status VARCHAR(50) DEFAULT 'pending',
                admin_reply TEXT NULL,
                admin_id INT NULL,
                admin_name VARCHAR(255) NULL,
                replied_at DATETIME NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_user_id (user_id),
                INDEX idx_status (status)
            )";
            $this->conn->exec($sql);

            // Safely check and add any missing columns in existing tables
            $cols = $this->conn->query("SHOW COLUMNS FROM support_queries")->fetchAll(PDO::FETCH_COLUMN);
            if (!in_array('admin_reply', $cols)) {
                $this->conn->exec("ALTER TABLE support_queries ADD COLUMN admin_reply TEXT NULL");
            }
            if (!in_array('admin_id', $cols)) {
                $this->conn->exec("ALTER TABLE support_queries ADD COLUMN admin_id INT NULL");
            }
            if (!in_array('admin_name', $cols)) {
                $this->conn->exec("ALTER TABLE support_queries ADD COLUMN admin_name VARCHAR(255) NULL");
            }
            if (!in_array('replied_at', $cols)) {
                $this->conn->exec("ALTER TABLE support_queries ADD COLUMN replied_at DATETIME NULL");
            }
            if (!in_array('status', $cols)) {
                $this->conn->exec("ALTER TABLE support_queries ADD COLUMN status VARCHAR(50) DEFAULT 'pending'");
            }
        } catch (Exception $e) {
            error_log("ensureSupportQueriesSchema error: " . $e->getMessage());
        }
    }

    public function submitHelpQuery($data)
    {
        try {
            $this->ensureSupportQueriesSchema();

            $userId = !empty($data['user_id']) ? intval($data['user_id']) : null;
            $userName = trim($data['user_name'] ?? 'Team Member');
            $userRole = trim($data['user_role'] ?? 'Staff');
            $queryType = strtolower(trim($data['query_type'] ?? 'query')); // 'query', 'feedback', 'issue', 'urgent', 'other'
            $subject = trim($data['subject'] ?? 'Help & Feedback Query');
            $message = trim($data['message'] ?? '');

            if (empty($message)) {
                return ["success" => false, "message" => "Please enter your message or feedback."];
            }

            try {
                $sq_stmt = $this->conn->prepare("INSERT INTO support_queries (user_id, user_name, user_role, query_type, subject, message, status) VALUES (:user_id, :user_name, :user_role, :query_type, :subject, :message, 'pending')");
                $sq_stmt->execute([
                    ':user_id' => $userId,
                    ':user_name' => $userName,
                    ':user_role' => $userRole,
                    ':query_type' => $queryType,
                    ':subject' => $subject,
                    ':message' => $message
                ]);
            } catch (Exception $e) {
                error_log("Error saving to support_queries: " . $e->getMessage());
            }

            // STRICT: Trigger to ADMIN ONLY (exclude project managers, designers, etc.)
            $u_query = "SELECT user_id, name, role FROM users WHERE LOWER(role) IN ('admin', 'super_admin', 'administrator', 'superadmin') OR LOWER(role) LIKE '%admin%'";
            $u_stmt = $this->conn->prepare($u_query);
            $u_stmt->execute();
            $admins = $u_stmt->fetchAll(PDO::FETCH_ASSOC);

            if (empty($admins)) {
                // Fallback: If no users have explicit 'admin' role name, find top root user
                $f_query = "SELECT user_id, name, role FROM users ORDER BY user_id ASC LIMIT 1";
                $f_stmt = $this->conn->prepare($f_query);
                $f_stmt->execute();
                $admins = $f_stmt->fetchAll(PDO::FETCH_ASSOC);
            }

            // Ensure notifications table exists
            try {
                $this->conn->exec("CREATE TABLE IF NOT EXISTS notifications (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    title VARCHAR(255) NOT NULL,
                    message TEXT NOT NULL,
                    type VARCHAR(50) DEFAULT 'info',
                    is_read BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_user_id (user_id),
                    INDEX idx_is_read (is_read)
                )");
            } catch (Exception $ne) {}

            $typeLabel = ucfirst($queryType);
            if ($queryType === 'query') $typeLabel = 'Help Query';
            elseif ($queryType === 'feedback') $typeLabel = 'User Feedback';
            elseif ($queryType === 'issue') $typeLabel = 'Technical Issue';
            elseif ($queryType === 'urgent') $typeLabel = 'Urgent Help';
            elseif ($queryType === 'other') $typeLabel = 'Other / General Query';

            $notifTitle = "💬 [{$typeLabel}] from {$userName} ({$userRole})";
            $notifMessage = "Subject: {$subject}\n\n{$message}\n\n👤 Submitted by: {$userName} ({$userRole})";

            $n_query = "INSERT INTO notifications (user_id, title, message, type, is_read, created_at) VALUES (:user_id, :title, :message, 'support_query', 0, NOW())";
            $n_stmt = $this->conn->prepare($n_query);

            foreach ($admins as $admin) {
                $n_stmt->execute([
                    ':user_id' => $admin['user_id'],
                    ':title' => $notifTitle,
                    ':message' => $notifMessage
                ]);
            }

            return [
                "success" => true,
                "message" => "Your query/feedback has been sent to Admin successfully! The Admin team has been notified."
            ];
        } catch (Exception $e) {
            return ["success" => false, "message" => "Failed to submit query: " . $e->getMessage()];
        }
    }

    public function replySupportQuery($data)
    {
        try {
            $this->ensureSupportQueriesSchema();

            $queryId = intval($data['query_id'] ?? $data['id'] ?? 0);
            $adminReply = trim($data['admin_reply'] ?? $data['reply'] ?? $data['message'] ?? '');
            $adminId = !empty($data['admin_id']) ? intval($data['admin_id']) : null;
            $adminName = trim($data['admin_name'] ?? 'Admin Team');

            if ($queryId <= 0) {
                return ["success" => false, "message" => "Invalid query ID."];
            }
            if (empty($adminReply)) {
                return ["success" => false, "message" => "Please enter your reply message."];
            }

            // Update support query with reply
            $stmt = $this->conn->prepare("UPDATE support_queries SET admin_reply = :reply, admin_id = :aid, admin_name = :aname, replied_at = NOW(), status = 'answered' WHERE id = :id");
            $stmt->execute([
                ':reply' => $adminReply,
                ':aid' => $adminId,
                ':aname' => $adminName,
                ':id' => $queryId
            ]);

            // Fetch query to notify employee
            $qStmt = $this->conn->prepare("SELECT user_id, user_name, subject, query_type FROM support_queries WHERE id = :id LIMIT 1");
            $qStmt->execute([':id' => $queryId]);
            $queryRow = $qStmt->fetch(PDO::FETCH_ASSOC);

            if ($queryRow && !empty($queryRow['user_id'])) {
                $empId = intval($queryRow['user_id']);
                $sub = $queryRow['subject'] ?? 'Help Query';

                try {
                    $this->conn->exec("CREATE TABLE IF NOT EXISTS notifications (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        user_id INT NOT NULL,
                        title VARCHAR(255) NOT NULL,
                        message TEXT NOT NULL,
                        type VARCHAR(50) DEFAULT 'info',
                        is_read BOOLEAN DEFAULT FALSE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        INDEX idx_user_id (user_id),
                        INDEX idx_is_read (is_read)
                    )");
                } catch (Exception $ne) {}

                $notifTitle = "👑 Admin Replied to: {$sub}";
                $notifMsg = "Admin {$adminName} replied to your query:\n\n\"{$adminReply}\"\n\nClick to view query history & chat.";

                $nStmt = $this->conn->prepare("INSERT INTO notifications (user_id, title, message, type, is_read, created_at) VALUES (:uid, :title, :msg, 'support_reply', 0, NOW())");
                $nStmt->execute([
                    ':uid' => $empId,
                    ':title' => $notifTitle,
                    ':msg' => $notifMsg
                ]);
            }

            return [
                "success" => true,
                "message" => "Reply sent to employee successfully! The employee has been notified in their dashboard.",
                "data" => [
                    "id" => $queryId,
                    "admin_reply" => $adminReply,
                    "admin_name" => $adminName,
                    "replied_at" => date('Y-m-d H:i:s'),
                    "status" => 'answered'
                ]
            ];
        } catch (Exception $e) {
            return ["success" => false, "message" => "Failed to send reply: " . $e->getMessage()];
        }
    }

    public function getSupportQueries($userId = null, $role = null)
    {
        try {
            $this->ensureSupportQueriesSchema();

            $isAdmin = false;
            if (!empty($role)) {
                $lr = strtolower($role);
                if (strpos($lr, 'admin') !== false) {
                    $isAdmin = true;
                }
            }

            if (!empty($userId) && !$isAdmin) {
                $stmt = $this->conn->prepare("SELECT * FROM support_queries WHERE user_id = :uid ORDER BY created_at DESC LIMIT 100");
                $stmt->execute([':uid' => intval($userId)]);
            } else {
                $stmt = $this->conn->query("SELECT * FROM support_queries ORDER BY created_at DESC LIMIT 200");
            }

            return ["success" => true, "data" => $stmt->fetchAll(PDO::FETCH_ASSOC)];
        } catch (Exception $e) {
            return ["success" => false, "message" => $e->getMessage(), "data" => []];
        }
    }
}
?>
