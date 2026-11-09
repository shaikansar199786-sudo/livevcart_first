<?php
class PDFCommentController {
    private $conn;

    public function __construct($conn) {
        $this->conn = $conn;
        $this->ensureTable();
    }

    private function ensureTable() {
        try {
            $sql1 = "CREATE TABLE IF NOT EXISTS pdf_comments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                file_id INT NOT NULL,
                page_number INT NOT NULL,
                comment_text TEXT NOT NULL,
                selected_text VARCHAR(255) DEFAULT NULL,
                status ENUM('open', 'resolved') DEFAULT 'open',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_file (file_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
            $this->conn->exec($sql1);

            // Add selected_text column if it doesn't exist
            try {
                $this->conn->exec("ALTER TABLE pdf_comments ADD COLUMN selected_text VARCHAR(255) DEFAULT NULL");
            } catch (Exception $e) {
                // Column might already exist
            }

            // Add position_data column if it doesn't exist
            try {
                $this->conn->exec("ALTER TABLE pdf_comments ADD COLUMN position_data LONGTEXT DEFAULT NULL");
            } catch (Exception $e) {
                // Column might already exist
            }

            $sql2 = "CREATE TABLE IF NOT EXISTS pdf_comment_history (
                id INT AUTO_INCREMENT PRIMARY KEY,
                comment_id INT NOT NULL,
                action ENUM('opened', 'resolved', 'reopened') NOT NULL,
                user_name VARCHAR(150) NOT NULL,
                user_role VARCHAR(100) NOT NULL,
                notes TEXT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_comment (comment_id),
                FOREIGN KEY (comment_id) REFERENCES pdf_comments(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
            $this->conn->exec($sql2);
        } catch (Exception $e) {
            // Table already exists or creation failed
        }
    }

    public function getComments($file_id) {
        try {
            $stmt = $this->conn->prepare("SELECT * FROM pdf_comments WHERE file_id = :file_id ORDER BY page_number ASC, id DESC");
            $stmt->execute(['file_id' => $file_id]);
            $comments = $stmt->fetchAll(PDO::FETCH_ASSOC);

            foreach ($comments as &$c) {
                $h_stmt = $this->conn->prepare("SELECT * FROM pdf_comment_history WHERE comment_id = :comment_id ORDER BY created_at ASC");
                $h_stmt->execute(['comment_id' => $c['id']]);
                $c['history'] = $h_stmt->fetchAll(PDO::FETCH_ASSOC);
                if (!empty($c['position_data'])) {
                    $decoded = json_decode($c['position_data'], true);
                    $c['position_data'] = $decoded !== null ? $decoded : $c['position_data'];
                }
            }

            return ["success" => true, "data" => $comments];
        } catch (Exception $e) {
            return ["success" => false, "message" => $e->getMessage()];
        }
    }

    public function addComment($data) {
        try {
            $file_id = intval($data['file_id']);
            $page_number = intval($data['page_number'] ?? 1);
            $comment_text = trim($data['comment_text'] ?? '');
            $selected_text = isset($data['selected_text']) ? trim($data['selected_text']) : null;
            $position_data = isset($data['position_data']) ? $data['position_data'] : null;
            if (is_array($position_data)) {
                $position_data = json_encode($position_data);
            }
            $user_name = trim($data['user_name'] ?? 'User');
            $user_role = trim($data['user_role'] ?? 'staff');

            if (empty($comment_text)) {
                return ["success" => false, "message" => "Comment text is required."];
            }

            if ($selected_text === '') {
                $selected_text = null;
            }

            $this->conn->beginTransaction();

            $stmt = $this->conn->prepare("INSERT INTO pdf_comments (file_id, page_number, comment_text, selected_text, position_data, status) VALUES (:file_id, :page_number, :comment_text, :selected_text, :position_data, 'open')");
            $stmt->execute([
                'file_id' => $file_id,
                'page_number' => $page_number,
                'comment_text' => $comment_text,
                'selected_text' => $selected_text,
                'position_data' => $position_data
            ]);
            $comment_id = $this->conn->lastInsertId();

            $h_stmt = $this->conn->prepare("INSERT INTO pdf_comment_history (comment_id, action, user_name, user_role, notes) VALUES (:comment_id, 'opened', :user_name, :user_role, :notes)");
            $h_stmt->execute([
                'comment_id' => $comment_id,
                'user_name' => $user_name,
                'user_role' => $user_role,
                'notes' => $comment_text
            ]);

            $this->conn->commit();
            return ["success" => true, "message" => "Comment added successfully.", "comment_id" => $comment_id];
        } catch (Exception $e) {
            if ($this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            return ["success" => false, "message" => $e->getMessage()];
        }
    }

    public function resolveComment($data) {
        try {
            $comment_id = intval($data['comment_id']);
            $user_name = trim($data['user_name'] ?? 'User');
            $user_role = trim($data['user_role'] ?? 'staff');

            $this->conn->beginTransaction();

            $stmt = $this->conn->prepare("UPDATE pdf_comments SET status = 'resolved' WHERE id = :comment_id");
            $stmt->execute(['comment_id' => $comment_id]);

            $h_stmt = $this->conn->prepare("INSERT INTO pdf_comment_history (comment_id, action, user_name, user_role, notes) VALUES (:comment_id, 'resolved', :user_name, :user_role, 'Resolved comment.')");
            $h_stmt->execute([
                'comment_id' => $comment_id,
                'user_name' => $user_name,
                'user_role' => $user_role
            ]);

            $this->conn->commit();
            return ["success" => true, "message" => "Comment resolved successfully."];
        } catch (Exception $e) {
            if ($this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            return ["success" => false, "message" => $e->getMessage()];
        }
    }

    public function reopenComment($data) {
        try {
            $comment_id = intval($data['comment_id']);
            $user_name = trim($data['user_name'] ?? 'User');
            $user_role = trim($data['user_role'] ?? 'staff');

            $this->conn->beginTransaction();

            $stmt = $this->conn->prepare("UPDATE pdf_comments SET status = 'open' WHERE id = :comment_id");
            $stmt->execute(['comment_id' => $comment_id]);

            $h_stmt = $this->conn->prepare("INSERT INTO pdf_comment_history (comment_id, action, user_name, user_role, notes) VALUES (:comment_id, 'reopened', :user_name, :user_role, 'Reopened comment.')");
            $h_stmt->execute([
                'comment_id' => $comment_id,
                'user_name' => $user_name,
                'user_role' => $user_role
            ]);

            $this->conn->commit();
            return ["success" => true, "message" => "Comment reopened successfully."];
        } catch (Exception $e) {
            if ($this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            return ["success" => false, "message" => $e->getMessage()];
        }
    }
}
?>
