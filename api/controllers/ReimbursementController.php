<?php
// api/controllers/ReimbursementController.php
require_once __DIR__ . '/../helpers/MailHelper.php';

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
            $this->conn->exec("ALTER TABLE reimbursements ADD COLUMN project_id VARCHAR(100) DEFAULT NULL");
        } catch (Exception $e) {
            // table already exists — ignore error if column already present
        }
    }

    // GET: list reimbursements
    public function getAll($user_id, $user_role, $force_all = false)
    {
        try {
            // If user_role not passed, look up from DB
            if (empty($user_role) && !empty($user_id)) {
                $uStmt = $this->conn->prepare("SELECT role FROM users WHERE user_id = :uid");
                $uStmt->execute([':uid' => $user_id]);
                $user_role = $uStmt->fetchColumn() ?: '';
            }

            $normRole = strtolower(trim($user_role ?? ''));
            $canManage = $force_all || in_array($normRole, ['admin', 'super_admin', 'manager', 'accountant', 'management']);

            if ($canManage) {
                $sql = "SELECT r.*, 
                               COALESCE(p.project_code, r.project_id) as project_code, 
                               p.project_name, 
                               p.project_id as matched_project_id 
                        FROM reimbursements r 
                        LEFT JOIN projects p ON (r.project_id = CAST(p.project_id AS CHAR) OR r.project_id = p.project_code OR r.project_id = CONCAT('PR_', p.project_id)) 
                        ORDER BY r.created_at DESC";
                $stmt = $this->conn->prepare($sql);
                $stmt->execute();
            } else {
                $sql = "SELECT r.*, 
                               COALESCE(p.project_code, r.project_id) as project_code, 
                               p.project_name, 
                               p.project_id as matched_project_id 
                        FROM reimbursements r 
                        LEFT JOIN projects p ON (r.project_id = CAST(p.project_id AS CHAR) OR r.project_id = p.project_code OR r.project_id = CONCAT('PR_', p.project_id)) 
                        WHERE r.user_id = :uid 
                        ORDER BY r.created_at DESC";
                $stmt = $this->conn->prepare($sql);
                $stmt->execute([':uid' => $user_id]);
            }
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            foreach ($rows as &$row) {
                $year = !empty($row['created_at']) ? date('Y', strtotime($row['created_at'])) : date('Y');
                $row['reimbursement_code'] = sprintf('LC-REIM-%s-%04d', $year, (int)$row['id']);
            }
            return ['success' => true, 'data' => $rows];
        } catch (\Throwable $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // POST: submit new reimbursement
    public function submit($data, $files)
    {
        try {
            if (empty(trim($data['reason'] ?? ''))) {
                return ['success' => false, 'message' => 'Reason / Notes is required.'];
            }

            if (empty($files['image']) || $files['image']['error'] !== UPLOAD_ERR_OK) {
                return ['success' => false, 'message' => 'Receipt image is required.'];
            }

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
                    (user_id, project_id, employee_name, role, category, reason, amount, image_path, status)
                    VALUES (:uid, :pid, :name, :role, :cat, :reason, :amount, :img, 'pending')";
            $stmt = $this->conn->prepare($sql);
            $stmt->execute([
                ':uid'    => $data['user_id'],
                ':pid'    => !empty($data['project_id']) ? $data['project_id'] : null,
                ':name'   => $data['employee_name'],
                ':role'   => $data['role'],
                ':cat'    => $data['category'],
                ':reason' => $data['reason'],
                ':amount' => $data['amount'],
                ':img'    => $image_path,
            ]);
            $claimId = $this->conn->lastInsertId();

            // Send Email Notification to Admin with clean HTML format
            $this->sendAdminNotificationMail($claimId, $data, $image_path);

            return ['success' => true, 'message' => 'Reimbursement request submitted successfully.'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // Helper: Send Clean HTML Email Notification to Admin
    private function sendAdminNotificationMail($claimId, $data, $image_path = null)
    {
        try {
            // Fetch project code if project_id provided
            $project_code = 'General / Office';
            if (!empty($data['project_id'])) {
                $pStmt = $this->conn->prepare("SELECT project_code, project_name FROM projects WHERE project_id = :pid OR project_code = :pcode LIMIT 1");
                $pStmt->execute([':pid' => $data['project_id'], ':pcode' => $data['project_id']]);
                $proj = $pStmt->fetch(PDO::FETCH_ASSOC);
                if ($proj) {
                    $project_code = !empty($proj['project_code']) ? $proj['project_code'] : $proj['project_name'];
                } else {
                    $project_code = $data['project_id'];
                }
            }

            $empName = $data['employee_name'] ?? '';
            if (empty($empName) && !empty($data['user_id'])) {
                $uStmt = $this->conn->prepare("SELECT name, username FROM users WHERE user_id = :uid LIMIT 1");
                $uStmt->execute([':uid' => $data['user_id']]);
                $uRow = $uStmt->fetch(PDO::FETCH_ASSOC);
                if ($uRow) {
                    $empName = !empty($uRow['name']) ? $uRow['name'] : $uRow['username'];
                }
            }
            if (empty($empName)) $empName = 'Employee';

            // Send notification via MailHelper using mailer.pdf template format
            MailHelper::sendReimbursementNotification($this->conn, 'submitted', [
                'reimbursement_code' => sprintf('LC-REIM-%s-%04d', date('Y'), (int)$claimId),
                'employee_name'      => $empName,
                'employee_id'        => $data['user_id'] ?? null,
                'amount'             => $data['amount'] ?? 0,
                'category'           => $data['category'] ?? 'Expense Claim',
                'project_id'         => $project_code,
                'date'               => date('d M Y'),
                'description'        => $data['reason'] ?? $data['category'] ?? 'Expense Claim'
            ]);
        } catch (Exception $e) {
            error_log("Reimbursement Mail Notification Error: " . $e->getMessage());
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
                    $projectIdToUse = $claim['project_id'] ?? null;
                    if (!$projectIdToUse) {
                        $projStmt = $this->conn->prepare("SELECT project_id, project_name FROM projects");
                        $projStmt->execute();
                        $projects = $projStmt->fetchAll(PDO::FETCH_ASSOC);

                        foreach ($projects as $p) {
                            if (!empty($p['project_name']) && stripos($claim['reason'], $p['project_name']) !== false) {
                                $projectIdToUse = $p['project_id'];
                                break;
                            }
                        }
                    }

                    $approver = $data['approved_by'] ?? 'Manager/Admin';
                    if ($projectIdToUse) {
                        $finSql = "INSERT INTO finance_transactions 
                                   (project_id, type, amount, payment_mode, category, person_name, description, transaction_date, recorded_by, approval_status, approved_by, approved_at) 
                                   VALUES (:pid, 'debit', :amt, 'Reimbursement', 'Other', :pname, :desc, CURDATE(), :uid, 'approved', :appby, NOW())";
                        $finStmt = $this->conn->prepare($finSql);
                        $finStmt->execute([
                            ':pid'   => $projectIdToUse,
                            ':amt'   => $claim['amount'],
                            ':pname' => $claim['employee_name'],
                            ':desc'  => 'Reimbursement (' . $claim['category'] . '): ' . $claim['reason'],
                            ':uid'   => $claim['user_id'],
                            ':appby' => $approver
                        ]);
                    } else {
                        // Office General Reimbursement -> goes to Company Expenses & Overheads
                        $finSql = "INSERT INTO finance_transactions 
                                   (project_id, type, amount, payment_mode, category, person_name, description, transaction_date, recorded_by, approval_status, approved_by, approved_at) 
                                   VALUES (NULL, 'debit', :amt, 'Reimbursement', 'Staff Expense', :pname, :desc, CURDATE(), :uid, 'approved', :appby, NOW())";
                        $finStmt = $this->conn->prepare($finSql);
                        $finStmt->execute([
                            ':amt'   => $claim['amount'],
                            ':pname' => $claim['employee_name'],
                            ':desc'  => 'Office Reimbursement (' . $claim['category'] . '): ' . $claim['reason'],
                            ':uid'   => $claim['user_id'],
                            ':appby' => $approver
                        ]);
                    }

                    // Send approval email notification
                    MailHelper::sendReimbursementNotification($this->conn, 'approved', [
                        'employee_name' => $claim['employee_name'] ?? 'Employee',
                        'employee_id'   => $claim['user_id'] ?? null,
                        'amount'        => $claim['amount'] ?? 0,
                        'project_id'    => $claim['project_id'] ?? 'General',
                        'date'          => date('d M Y', strtotime($claim['created_at'] ?? 'now')),
                        'description'   => $claim['reason'] ?? ''
                    ]);
                }
            } catch (\Throwable $ex) {
                // Ignore if finance_transactions or mail fails
            }

            return ['success' => true, 'message' => 'Reimbursement approved.'];
        } catch (\Throwable $e) {
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

            try {
                $claimStmt = $this->conn->prepare("SELECT * FROM reimbursements WHERE id = :id");
                $claimStmt->execute([':id' => $data['id']]);
                $claim = $claimStmt->fetch(PDO::FETCH_ASSOC);

                if ($claim) {
                    MailHelper::sendReimbursementNotification($this->conn, 'rejected', [
                        'employee_name' => $claim['employee_name'] ?? 'Employee',
                        'employee_id'   => $claim['user_id'] ?? null,
                        'amount'        => $claim['amount'] ?? 0,
                        'project_id'    => $claim['project_id'] ?? 'General',
                        'date'          => date('d M Y', strtotime($claim['created_at'] ?? 'now')),
                        'description'   => $claim['reason'] ?? '',
                        'reason'        => $data['admin_note'] ?? 'Not specified'
                    ]);
                }
            } catch (\Throwable $ex) {}

            return ['success' => true, 'message' => 'Reimbursement rejected.'];
        } catch (\Throwable $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
}
