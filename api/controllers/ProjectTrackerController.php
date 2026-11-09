<?php
class ProjectTrackerController {
    private $conn;

    public function __construct($conn) {
        $this->conn = $conn;
        $this->ensureTable();
    }

    private function ensureTable() {
        $sql = "CREATE TABLE IF NOT EXISTS project_trackers (
            id INT AUTO_INCREMENT PRIMARY KEY,
            category ENUM('architectural', 'interior', 'site') NOT NULL,
            project_id VARCHAR(100) DEFAULT NULL,
            project_name VARCHAR(255) NOT NULL,
            staff_name VARCHAR(150) NOT NULL,
            column_data JSON NOT NULL,
            sort_order INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_category (category)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
        $this->conn->exec($sql);
        try {
            $this->conn->exec("ALTER TABLE project_trackers MODIFY COLUMN category VARCHAR(50) NOT NULL");
        } catch (Exception $e) {
        }
    }

    public function getByCategory($category) {
        $stmt = $this->conn->prepare("SELECT * FROM project_trackers WHERE category = :category ORDER BY sort_order ASC, id ASC");
        $stmt->execute([':category' => $category]);
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Decode JSON for each row
        foreach ($results as &$row) {
            $row['column_data'] = json_decode($row['column_data'], true);
        }
        return $results;
    }

    public function getByProjectId($projectId) {
        $stmt = $this->conn->prepare("SELECT * FROM project_trackers WHERE project_id = :pid OR project_id LIKE :pid_like ORDER BY id DESC");
        $stmt->execute([':pid' => $projectId, ':pid_like' => "%{$projectId}%"]);
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($results as &$row) {
            $row['column_data'] = json_decode($row['column_data'], true);
        }
        return $results;
    }

    public function save($category, $rows) {
        try {
            $this->conn->beginTransaction();
            // Delete all existing rows for this category
            $stmt = $this->conn->prepare("DELETE FROM project_trackers WHERE category = :category");
            $stmt->execute([':category' => $category]);

            // Re-insert all rows
            if (!empty($rows)) {
                $stmt = $this->conn->prepare(
                    "INSERT INTO project_trackers (category, project_id, project_name, staff_name, column_data, sort_order)
                     VALUES (:category, :project_id, :project_name, :staff_name, :column_data, :sort_order)"
                );
                foreach ($rows as $idx => $row) {
                    $stmt->execute([
                        ':category'     => $category,
                        ':project_id'   => $row['project_id'] ?? null,
                        ':project_name' => $row['project_name'] ?? '',
                        ':staff_name'   => $row['staff_name'] ?? '',
                        ':column_data'  => json_encode($row['column_data'] ?? []),
                        ':sort_order'   => $idx,
                    ]);

                    // Sync latest active stage to projects table if project_id is present
                    if (!empty($row['project_id']) && !empty($row['column_data'])) {
                        $colData = $row['column_data'];
                        $latestStage = null;
                        foreach ($colData as $stageName => $stVal) {
                            if (in_array($stVal, ['ongoing', 'in_progress', 'pending_approval', 'done', 'completed'])) {
                                $latestStage = $stageName;
                            }
                        }
                        if ($latestStage) {
                            $updateStmt = $this->conn->prepare("UPDATE projects SET project_stage = :stage WHERE project_id = :pid OR id = :pid");
                            $updateStmt->execute([':stage' => $latestStage, ':pid' => $row['project_id']]);
                        }
                    }
                }
            }

            $this->conn->commit();
            return ['success' => true, 'message' => 'Tracker saved successfully'];
        } catch (Exception $e) {
            $this->conn->rollBack();
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
}
