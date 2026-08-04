<?php
// api/controllers/ReimbursementController.php

class ReimbursementController
{
    private $conn;

    public function __construct($db)
    {
        $this->conn = $db;
        $this->ensureTable();
    }

    private function ensureTable()
    {
        $sql = "CREATE TABLE IF NOT EXISTS reimbursements (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            employee_name VARCHAR(150) NOT NULL,
            role VARCHAR(50) NOT NULL,
            category VARCHAR(50) NOT NULL,
            reason TEXT NOT NULL,
            amount DECIMAL(10,2) NOT NULL,
            image_path VARCHAR(255) DEFAULT NULL,
            status VARCHAR(20) DEFAULT 'pending',
            admin_note TEXT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_user (user_id),
            INDEX idx_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

        try {
            $this->conn->exec($sql);
        } catch (Exception $e) {
            // table already exists — ignore
        }
    }

    // GET: list reimbursements
    public function getAll($user_id, $user_role)
    {
        try {
            $isAdmin = strtolower($user_role ?? '') === 'admin';
            if ($isAdmin) {
                $sql = "SELECT * FROM reimbursements ORDER BY created_at DESC";
                $stmt = $this->conn->prepare($sql);
                $stmt->execute();
            } else {
                $sql = "SELECT * FROM reimbursements WHERE user_id = :uid ORDER BY created_at DESC";
                $stmt = $this->conn->prepare($sql);
                $stmt->execute([':uid' => $user_id]);
            }
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            return ['success' => true, 'data' => $rows];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // POST: submit new reimbursement
    public function submit($data, $files)
    {
        try {
            $image_path = null;

            // Handle image upload
            if (!empty($files['image']) && $files['image']['error'] === UPLOAD_ERR_OK) {
                $upload_dir = __DIR__ . '/../uploads/reimbursements/';
                if (!is_dir($upload_dir)) {
                    mkdir($upload_dir, 0755, true);
                }
                $ext = pathinfo($files['image']['name'], PATHINFO_EXTENSION);
                $filename = 'reimb_' . time() . '_' . rand(1000, 9999) . '.' . $ext;
                $dest = $upload_dir . $filename;
                if (move_uploaded_file($files['image']['tmp_name'], $dest)) {
                    $image_path = 'uploads/reimbursements/' . $filename;
                }
            }

            $sql = "INSERT INTO reimbursements 
                    (user_id, employee_name, role, category, reason, amount, image_path, status)
                    VALUES (:uid, :name, :role, :cat, :reason, :amount, :img, 'pending')";
            $stmt = $this->conn->prepare($sql);
            $stmt->execute([
                ':uid'    => $data['user_id'],
                ':name'   => $data['employee_name'],
                ':role'   => $data['role'],
                ':cat'    => $data['category'],
                ':reason' => $data['reason'],
                ':amount' => $data['amount'],
                ':img'    => $image_path,
            ]);
            return ['success' => true, 'message' => 'Reimbursement request submitted successfully.'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // POST: admin approve
    public function approve($data)
    {
        try {
            $sql = "UPDATE reimbursements SET status = 'approved', admin_note = :note, updated_at = NOW()
                    WHERE id = :id";
            $stmt = $this->conn->prepare($sql);
            $stmt->execute([
                ':id'   => $data['id'],
                ':note' => $data['admin_note'] ?? null,
            ]);

            // Auto-record to finance_transactions if associated with a project
            try {
                $claimStmt = $this->conn->prepare("SELECT * FROM reimbursements WHERE id = :id");
                $claimStmt->execute([':id' => $data['id']]);
                $claim = $claimStmt->fetch(PDO::FETCH_ASSOC);

                if ($claim) {
                    $projStmt = $this->conn->prepare("SELECT project_id, project_name FROM projects");
                    $projStmt->execute();
                    $projects = $projStmt->fetchAll(PDO::FETCH_ASSOC);

                    $matchedProject = null;
                    foreach ($projects as $p) {
                        if (!empty($p['project_name']) && stripos($claim['reason'], $p['project_name']) !== false) {
                            $matchedProject = $p;
                            break;
                        }
                    }

                    if ($matchedProject) {
                        $finSql = "INSERT INTO finance_transactions 
                                   (project_id, type, amount, payment_mode, category, person_name, description, transaction_date, recorded_by) 
                                   VALUES (:pid, 'debit', :amt, 'Reimbursement', 'Other', :pname, :desc, CURDATE(), :uid)";
                        $finStmt = $this->conn->prepare($finSql);
                        $finStmt->execute([
                            ':pid'   => $matchedProject['project_id'],
                            ':amt'   => $claim['amount'],
                            ':pname' => $claim['employee_name'],
                            ':desc'  => 'Reimbursement (' . $claim['category'] . '): ' . $claim['reason'],
                            ':uid'   => $claim['user_id']
                        ]);
                    } else {
                        // Office General Reimbursement -> goes to Company Expenses & Overheads
                        $finSql = "INSERT INTO finance_transactions 
                                   (project_id, type, amount, payment_mode, category, person_name, description, transaction_date, recorded_by) 
                                   VALUES (NULL, 'debit', :amt, 'Reimbursement', 'Staff Expense', :pname, :desc, CURDATE(), :uid)";
                        $finStmt = $this->conn->prepare($finSql);
                        $finStmt->execute([
                            ':amt'   => $claim['amount'],
                            ':pname' => $claim['employee_name'],
                            ':desc'  => 'Office Reimbursement (' . $claim['category'] . '): ' . $claim['reason'],
                            ':uid'   => $claim['user_id']
                        ]);
                    }
                }
            } catch (Exception $ex) {
                // Ignore if finance_transactions fails
            }

            return ['success' => true, 'message' => 'Reimbursement approved.'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // POST: admin reject
    public function reject($data)
    {
        try {
            $sql = "UPDATE reimbursements SET status = 'rejected', admin_note = :note, updated_at = NOW()
                    WHERE id = :id";
            $stmt = $this->conn->prepare($sql);
            $stmt->execute([
                ':id'   => $data['id'],
                ':note' => $data['admin_note'] ?? null,
            ]);
            return ['success' => true, 'message' => 'Reimbursement rejected.'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
}
