<?php
// api/controllers/CivilEstimateController.php

class CivilEstimateController
{
    private $conn;

    public function __construct($db)
    {
        $this->conn = $db;
        $this->ensureTable();
    }

    private function ensureTable()
    {
        $sql = "CREATE TABLE IF NOT EXISTS civil_estimates (
            id INT AUTO_INCREMENT PRIMARY KEY,
            estimate_data LONGTEXT NOT NULL,
            header_data LONGTEXT DEFAULT NULL,
            grand_total DECIMAL(15,2) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )";
        $this->conn->exec($sql);

        // Add header_data column if upgrading an existing table
        try {
            $this->conn->exec("ALTER TABLE civil_estimates ADD COLUMN header_data LONGTEXT DEFAULT NULL");
        } catch (Exception $e) {}
    }

    public function save($data)
    {
        try {
            $estimate_json = json_encode($data['sections'] ?? []);
            $header_json   = json_encode($data['header'] ?? null);
            $grand_total   = $data['grand_total'] ?? 0;

            // Upsert: keep only one record
            $check = $this->conn->query("SELECT id FROM civil_estimates LIMIT 1");
            $row   = $check->fetch(PDO::FETCH_ASSOC);

            if ($row) {
                $stmt = $this->conn->prepare(
                    "UPDATE civil_estimates SET estimate_data=:ed, header_data=:hd, grand_total=:gt WHERE id=:id"
                );
                $stmt->execute([
                    'ed' => $estimate_json,
                    'hd' => $header_json,
                    'gt' => $grand_total,
                    'id' => $row['id']
                ]);
            } else {
                $stmt = $this->conn->prepare(
                    "INSERT INTO civil_estimates (estimate_data, header_data, grand_total) VALUES (:ed, :hd, :gt)"
                );
                $stmt->execute([
                    'ed' => $estimate_json,
                    'hd' => $header_json,
                    'gt' => $grand_total
                ]);
            }

            return ["success" => true, "message" => "Estimate saved successfully"];
        } catch (Exception $e) {
            return ["success" => false, "message" => $e->getMessage()];
        }
    }

    public function load()
    {
        try {
            $stmt = $this->conn->query("SELECT * FROM civil_estimates LIMIT 1");
            $row  = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($row) {
                $row['sections'] = json_decode($row['estimate_data'], true);
                $row['header']   = !empty($row['header_data']) ? json_decode($row['header_data'], true) : null;
                return ["success" => true, "data" => $row];
            }
            return ["success" => true, "data" => null];
        } catch (Exception $e) {
            return ["success" => false, "message" => $e->getMessage()];
        }
    }
}
?>
