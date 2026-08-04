<?php
// api/controllers/AgreementController.php

class AgreementController
{
    private $conn;

    public function __construct($db)
    {
        $this->conn = $db;
        $this->ensureTable();
    }

    private function ensureTable()
    {
        $sql = "CREATE TABLE IF NOT EXISTS agreements (
            id INT AUTO_INCREMENT PRIMARY KEY,
            ref_id VARCHAR(100) NOT NULL,
            project_type VARCHAR(100) DEFAULT 'Interior Design',
            client_name VARCHAR(150) NOT NULL,
            address TEXT NOT NULL,
            contract_value VARCHAR(50) NOT NULL,
            contract_value_words TEXT NOT NULL,
            date DATE NOT NULL,
            place VARCHAR(150) NOT NULL,
            status VARCHAR(30) DEFAULT 'Draft',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_client (client_name),
            INDEX idx_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

        try {
            $this->conn->exec($sql);
            $this->conn->exec("ALTER TABLE agreements ADD COLUMN IF NOT EXISTS project_type VARCHAR(100) DEFAULT 'Interior Design'");
        } catch (Exception $e) {
            // Ignore if table exists
        }
    }

    // List all agreements
    public function getAll()
    {
        try {
            $sql = "SELECT * FROM agreements ORDER BY created_at DESC";
            $stmt = $this->conn->prepare($sql);
            $stmt->execute();
            $data = $stmt->fetchAll(PDO::FETCH_ASSOC);
            return ['success' => true, 'data' => $data];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // Get single agreement
    public function getById($id)
    {
        try {
            $sql = "SELECT * FROM agreements WHERE id = :id";
            $stmt = $this->conn->prepare($sql);
            $stmt->execute([':id' => $id]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($row) {
                return ['success' => true, 'data' => $row];
            }
            return ['success' => false, 'message' => 'Agreement not found'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // Save or update agreement
    public function save($data)
    {
        try {
            $project_type = $data['project_type'] ?? 'Interior Design';
            if (!empty($data['id'])) {
                // Update
                $sql = "UPDATE agreements SET 
                            ref_id = :ref_id, 
                            project_type = :project_type,
                            client_name = :client_name, 
                            address = :address, 
                            contract_value = :contract_value, 
                            contract_value_words = :contract_value_words, 
                            date = :date, 
                            place = :place, 
                            status = :status
                        WHERE id = :id";
                $stmt = $this->conn->prepare($sql);
                $stmt->execute([
                    ':id' => $data['id'],
                    ':ref_id' => $data['ref_id'],
                    ':project_type' => $project_type,
                    ':client_name' => $data['client_name'],
                    ':address' => $data['address'],
                    ':contract_value' => $data['contract_value'],
                    ':contract_value_words' => $data['contract_value_words'],
                    ':date' => $data['date'],
                    ':place' => $data['place'],
                    ':status' => $data['status'] ?? 'Draft'
                ]);
                return ['success' => true, 'message' => 'Agreement updated successfully', 'id' => $data['id']];
            } else {
                // Insert
                $sql = "INSERT INTO agreements 
                            (ref_id, project_type, client_name, address, contract_value, contract_value_words, date, place, status)
                        VALUES 
                            (:ref_id, :project_type, :client_name, :address, :contract_value, :contract_value_words, :date, :place, :status)";
                $stmt = $this->conn->prepare($sql);
                $stmt->execute([
                    ':ref_id' => $data['ref_id'],
                    ':project_type' => $project_type,
                    ':client_name' => $data['client_name'],
                    ':address' => $data['address'],
                    ':contract_value' => $data['contract_value'],
                    ':contract_value_words' => $data['contract_value_words'],
                    ':date' => $data['date'],
                    ':place' => $data['place'],
                    ':status' => $data['status'] ?? 'Draft'
                ]);
                return ['success' => true, 'message' => 'Agreement saved successfully', 'id' => $this->conn->lastInsertId()];
            }
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // Delete agreement
    public function delete($id)
    {
        try {
            $sql = "DELETE FROM agreements WHERE id = :id";
            $stmt = $this->conn->prepare($sql);
            $stmt->execute([':id' => $id]);
            return ['success' => true, 'message' => 'Agreement deleted successfully'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
}
