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
            task1_status ENUM('pending','in_progress','done') DEFAULT 'pending',
            task2_status ENUM('pending','in_progress','done') DEFAULT 'pending',
            tasks_json TEXT DEFAULT NULL,
            remarks VARCHAR(1000) DEFAULT '',
            deadline VARCHAR(50) DEFAULT '',
            sort_order INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_month (month)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
        $this->conn->exec($sql);

        // Add new columns if they don't exist (for existing tables)
        try {
            $this->conn->exec("ALTER TABLE team_targets ADD COLUMN task1_status ENUM('pending','in_progress','done') DEFAULT 'pending' AFTER task2");
        } catch (Exception $e) {
        } catch (Exception $e) {}
        try {
            $this->conn->exec("ALTER TABLE team_targets ADD COLUMN task2_status ENUM('pending','in_progress','done') DEFAULT 'pending' AFTER task1_status");
        } catch (Exception $e) {}
        try {
            $this->conn->exec("ALTER TABLE team_targets ADD COLUMN tasks_json TEXT DEFAULT NULL AFTER task2_status");
        } catch (Exception $e) {}
        try {
            $this->conn->exec("ALTER TABLE team_targets ADD COLUMN remarks VARCHAR(1000) DEFAULT '' AFTER tasks_json");
        } catch (Exception $e) {}
        try {
            $this->conn->exec("ALTER TABLE team_targets ADD COLUMN deadline VARCHAR(50) DEFAULT '' AFTER remarks");
        } catch (Exception $e) {}
    }

    public function getByMonth($month) {
        $stmt = $this->conn->prepare("SELECT * FROM team_targets WHERE month = :month ORDER BY sort_order ASC, id ASC");
        $stmt->execute([':month' => $month]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as &$row) {
            if (!empty($row['tasks_json'])) {
                $row['dynamic_tasks'] = json_decode($row['tasks_json'], true);
            } else {
                $row['dynamic_tasks'] = [];
            }
        }
        return $rows;
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
                    "INSERT INTO team_targets (month, project_id, project_name, team_member, task1, task2, task1_status, task2_status, tasks_json, remarks, deadline, sort_order)
                     VALUES (:month, :project_id, :project_name, :team_member, :task1, :task2, :task1_status, :task2_status, :tasks_json, :remarks, :deadline, :sort_order)"
                );
                foreach ($rows as $idx => $row) {
                    $stmt->execute([
                        ':month'        => $month,
                        ':project_id'   => $row['project_id'] ?? null,
                        ':project_name' => $row['project_name'] ?? '',
                        ':team_member'  => $row['team_member'] ?? '',
                        ':task1'        => $row['task1'] ?? '',
                        ':task2'        => $row['task2'] ?? '',
                        ':task1_status' => $row['task1_status'] ?? 'pending',
                        ':task2_status' => $row['task2_status'] ?? 'pending',
                        ':tasks_json'   => isset($row['dynamic_tasks']) ? json_encode($row['dynamic_tasks']) : null,
                        ':remarks'      => $row['remarks'] ?? '',
                        ':deadline'     => $row['deadline'] ?? '',
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
