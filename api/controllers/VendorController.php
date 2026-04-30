<?php
// api/controllers/VendorController.php

class VendorController {
    private $conn;

    public function __construct($db) {
        $this->conn = $db;
    }

    public function getAll() {
        try {
            $stmt = $this->conn->prepare("SELECT vendor_name FROM vendors");
            $stmt->execute();
            $vendors = $stmt->fetchAll(PDO::FETCH_COLUMN);
            return ["status" => "success", "data" => $vendors];
        } catch (PDOException $e) {
            return ["status" => "error", "message" => $e->getMessage()];
        }
    }

    public function getLaborVendors() {
        try {
            $query = "SELECT 
                        ft.person_name, 
                        p.project_name as site,
                        ft.transaction_date as payment_date,
                        ft.amount as payment_amount,
                        ft.payment_mode as remarks
                      FROM finance_transactions ft
                      JOIN projects p ON ft.project_id = p.project_id
                      WHERE ft.category = 'Labor' AND ft.person_name IS NOT NULL AND ft.person_name != ''
                      ORDER BY ft.person_name ASC, ft.transaction_date ASC";
            $stmt = $this->conn->prepare($query);
            $stmt->execute();
            $transactions = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $grouped = [];
            foreach ($transactions as $t) {
                $name = $t['person_name'];
                if (!isset($grouped[$name])) {
                    $grouped[$name] = [
                        'person_name' => $name,
                        'transactions' => [],
                        'total_payment' => 0
                    ];
                }
                $grouped[$name]['transactions'][] = $t;
                $grouped[$name]['total_payment'] += $t['payment_amount'];
            }

            return ["success" => true, "data" => array_values($grouped)];
        } catch (PDOException $e) {
            return ["success" => false, "message" => "Database Error: " . $e->getMessage()];
        }
    }

    public function create($data) {
        $vendor = $data['vendor'] ?? '';
        $user_id = $data['user_id'] ?? 1;

        if ($vendor == '') {
            return ["status" => "error", "message" => "Vendor name required"];
        }

        try {
            // check duplicate
            $check = $this->conn->prepare("SELECT vendor_id FROM vendors WHERE vendor_name = ?");
            $check->execute([$vendor]);
            if ($check->rowCount() > 0) {
                return ["status" => "success", "message" => "Already exists"];
            }

            $code = "VND-" . strtoupper(substr($vendor, 0, 3)) . "-" . rand(100, 999);
            $sql = "INSERT INTO vendors (vendor_name, vendor_code, status, category, contact_person, phone, email, address, gst_number, created_by) 
                    VALUES (?, ?, 'active', 'General', '', '', '', '', '', ?)";
            
            $stmt = $this->conn->prepare($sql);
            if ($stmt->execute([$vendor, $code, $user_id])) {
                return ["status" => "success", "message" => "Vendor added"];
            } else {
                return ["status" => "error", "message" => "Insert failed"];
            }
        } catch (PDOException $e) {
            return ["status" => "error", "message" => "Database Error: " . $e->getMessage()];
        }
    }
}

