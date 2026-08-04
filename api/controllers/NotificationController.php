<?php
// api/controllers/NotificationController.php

class NotificationController
{
    private $conn;

    public function __construct($db)
    {
        $this->conn = $db;
    }

    public function getUnread($user_id)
    {
        $query = "SELECT * FROM notifications WHERE user_id = :user_id AND is_read = 0 ORDER BY created_at DESC";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':user_id', $user_id);
        $stmt->execute();
        return ["success" => true, "data" => $stmt->fetchAll(PDO::FETCH_ASSOC)];
    }

    public function markAsRead($notification_id)
    {
        $query = "UPDATE notifications SET is_read = 1 WHERE id = :id";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':id', $notification_id);
        
        if ($stmt->execute()) {
            return ["success" => true, "message" => "Marked as read."];
        }
        return ["success" => false, "message" => "Failed to update notification."];
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
}
?>
