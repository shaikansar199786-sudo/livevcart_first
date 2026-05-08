<?php
class TeamTargetController {
    private $conn;

    public function __construct($conn) {
        $this->conn = $conn;
        $this->ensureTable();
    }

    private function ensureTable() {
        $sql = "CREATE TABLE IF NOT EXISTS team_targets (
            id INT AUTO_INCREMENT PRIMARY KEY,
            month VARCHAR(7) NOT NULL COMMENT 'Format: YYYY-MM',
            project_id VARCHAR(100) DEFAULT NULL,
            project_name VARCHAR(255) NOT NULL,
            team_member VARCHAR(150) NOT NULL,
            task1 VARCHAR(500) DEFAULT '',
            task2 VARCHAR(500) DEFAULT '',
            status ENUM('pending','in_progress','done') DEFAULT 'pending',
            sort_order INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_month (month)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
        $this->conn->exec($sql);
    }

    public function getByMonth($month) {
        $stmt = $this->conn->prepare("SELECT * FROM team_targets WHERE month = :month ORDER BY sort_order ASC, id ASC");
        $stmt->execute([':month' => $month]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function save($month, $rows) {
        try {
            $this->conn->beginTransaction();
            // Delete all existing rows for this month
            $stmt = $this->conn->prepare("DELETE FROM team_targets WHERE month = :month");
            $stmt->execute([':month' => $month]);

            // Re-insert all rows
            if (!empty($rows)) {
                $stmt = $this->conn->prepare(
                    "INSERT INTO team_targets (month, project_id, project_name, team_member, task1, task2, status, sort_order)
                     VALUES (:month, :project_id, :project_name, :team_member, :task1, :task2, :status, :sort_order)"
                );
                foreach ($rows as $idx => $row) {
                    $stmt->execute([
                        ':month'        => $month,
                        ':project_id'   => $row['project_id'] ?? null,
                        ':project_name' => $row['project_name'] ?? '',
                        ':team_member'  => $row['team_member'] ?? '',
                        ':task1'        => $row['task1'] ?? '',
                        ':task2'        => $row['task2'] ?? '',
                        ':status'       => $row['status'] ?? 'pending',
                        ':sort_order'   => $idx,
                    ]);
                }
            }

            $this->conn->commit();
            return ['success' => true, 'message' => 'Targets saved successfully'];
        } catch (Exception $e) {
            $this->conn->rollBack();
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function getMonths() {
        $stmt = $this->conn->query("SELECT DISTINCT month FROM team_targets ORDER BY month DESC LIMIT 24");
        return $stmt->fetchAll(PDO::FETCH_COLUMN);
    }
}
