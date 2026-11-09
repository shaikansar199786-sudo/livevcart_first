<?php
// api/controllers/FinanceController.php
require_once __DIR__ . '/../helpers/MailHelper.php';

class FinanceController
{
    private $conn;

    public function __construct($db)
    {
        $this->conn = $db;
        $this->ensureSchema();
        $this->purgeExpiredDeletedTransactions();
    }

    private function ensureSchema()
    {
        try {
            $checkDel = $this->conn->query("SHOW COLUMNS FROM finance_transactions LIKE 'is_deleted'");
            if (!$checkDel || $checkDel->rowCount() === 0) {
                $this->conn->exec("ALTER TABLE finance_transactions ADD COLUMN is_deleted TINYINT(1) DEFAULT 0");
                $this->conn->exec("ALTER TABLE finance_transactions ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL");
                $this->conn->exec("ALTER TABLE finance_transactions ADD COLUMN deleted_by VARCHAR(100) NULL DEFAULT NULL");
                $this->conn->exec("ALTER TABLE finance_transactions ADD INDEX idx_finance_deleted (is_deleted, deleted_at)");
            }
        } catch (Exception $e) {
            // Ignore if already added or permission issue
        }

        try {
            $checkApproval = $this->conn->query("SHOW COLUMNS FROM finance_transactions LIKE 'approval_status'");
            if (!$checkApproval || $checkApproval->rowCount() === 0) {
                $this->conn->exec("ALTER TABLE finance_transactions ADD COLUMN approval_status VARCHAR(20) DEFAULT 'approved'");
                $this->conn->exec("ALTER TABLE finance_transactions ADD COLUMN approved_by VARCHAR(100) NULL");
                $this->conn->exec("ALTER TABLE finance_transactions ADD COLUMN approved_at DATETIME NULL");
            }
        } catch (Exception $e) {}

        try {
            $checkStatus = $this->conn->query("SHOW COLUMNS FROM finance_transactions LIKE 'payment_status'");
            if (!$checkStatus || $checkStatus->rowCount() === 0) {
                $this->conn->exec("ALTER TABLE finance_transactions ADD COLUMN payment_status VARCHAR(20) DEFAULT 'paid'");
            }
        } catch (Exception $e) {}

        try {
            $checkRemarks = $this->conn->query("SHOW COLUMNS FROM finance_transactions LIKE 'remarks'");
            if (!$checkRemarks || $checkRemarks->rowCount() === 0) {
                $this->conn->exec("ALTER TABLE finance_transactions ADD COLUMN remarks TEXT NULL");
            }
        } catch (Exception $e) {}

        try {
            $checkImg = $this->conn->query("SHOW COLUMNS FROM finance_transactions LIKE 'receipt_image'");
            if (!$checkImg || $checkImg->rowCount() === 0) {
                $this->conn->exec("ALTER TABLE finance_transactions ADD COLUMN receipt_image LONGTEXT NULL");
            }
        } catch (Exception $e) {}
    }

    /**
     * Purges entries that have been soft-deleted for more than 30 days.
     * User requirement: "remain recoverable for 30 days. After 30 days, they can be permanently deleted."
     */
    public function purgeExpiredDeletedTransactions()
    {
        try {
            $this->conn->exec("DELETE FROM finance_transactions 
                              WHERE is_deleted = 1 
                              AND deleted_at IS NOT NULL 
                              AND deleted_at < DATE_SUB(NOW(), INTERVAL 30 DAY)");
        } catch (Exception $e) {
            // Silent catch to prevent blocking
        }
    }

    public function recordTransaction($data)
    {
        $raw_project_id = !empty($data['project_id']) ? $data['project_id'] : null;
        $project_id = $raw_project_id;
        $client_code_label = '';

        // Resolve canonical project_id / lead_id and client code
        if ($raw_project_id) {
            try {
                // 1. Try direct match on projects table by project_id or project_code
                $pStmt = $this->conn->prepare("SELECT project_id, project_code FROM projects WHERE project_id = :p1 OR project_code = :p2 LIMIT 1");
                $pStmt->execute([':p1' => $raw_project_id, ':p2' => $raw_project_id]);
                $pRow = $pStmt->fetch(PDO::FETCH_ASSOC);

                if ($pRow) {
                    $project_id = $pRow['project_id'];
                    $client_code_label = $pRow['project_code'] ?? '';
                } else {
                    // 2. Try match on leads table by lead_id or manual_client_id
                    $lStmt = $this->conn->prepare("SELECT lead_id, manual_client_id FROM leads WHERE lead_id = :l1 OR manual_client_id = :l2 LIMIT 1");
                    $lStmt->execute([':l1' => $raw_project_id, ':l2' => $raw_project_id]);
                    $lRow = $lStmt->fetch(PDO::FETCH_ASSOC);
                    if ($lRow) {
                        $client_code_label = $lRow['manual_client_id'] ?? '';
                        $leadId = $lRow['lead_id'];
                        // Try to get converted project_id for this lead
                        $pConv = $this->conn->prepare("SELECT p.project_id FROM projects p JOIN clients c ON p.client_id = c.client_id WHERE c.converted_from_lead_id = :lid LIMIT 1");
                        $pConv->execute([':lid' => $leadId]);
                        $pConvRow = $pConv->fetch(PDO::FETCH_ASSOC);
                        $project_id = $pConvRow['project_id'] ?? $leadId;
                    }
                }
            } catch (Exception $e) {
                error_log("recordTransaction project_id resolution error: " . $e->getMessage());
            }
        }

        // Check if incentive column exists, if not add it
        $checkColumn = $this->conn->query("SHOW COLUMNS FROM finance_transactions LIKE 'incentive'");
        $hasIncentiveColumn = $checkColumn && $checkColumn->rowCount() > 0;

        if (!$hasIncentiveColumn) {
            try {
                $this->conn->exec("ALTER TABLE finance_transactions ADD COLUMN incentive DECIMAL(12,2) NULL DEFAULT 0");
                $hasIncentiveColumn = true;
            } catch (Exception $e) {}
        }

        // Check if receipt_image column exists, if not add it
        $checkImg = $this->conn->query("SHOW COLUMNS FROM finance_transactions LIKE 'receipt_image'");
        $hasImgColumn = $checkImg && $checkImg->rowCount() > 0;
        if (!$hasImgColumn) {
            try {
                $this->conn->exec("ALTER TABLE finance_transactions ADD COLUMN receipt_image LONGTEXT NULL");
                $hasImgColumn = true;
            } catch (Exception $e) {}
        }

        // Check if payment_status column exists, if not add it
        $checkStatus = $this->conn->query("SHOW COLUMNS FROM finance_transactions LIKE 'payment_status'");
        $hasStatusColumn = $checkStatus && $checkStatus->rowCount() > 0;
        if (!$hasStatusColumn) {
            try {
                $this->conn->exec("ALTER TABLE finance_transactions ADD COLUMN payment_status VARCHAR(20) DEFAULT 'paid'");
                $hasStatusColumn = true;
            } catch (Exception $e) {}
        }

        // Check if remarks column exists, if not add it
        $checkRemarks = $this->conn->query("SHOW COLUMNS FROM finance_transactions LIKE 'remarks'");
        $hasRemarksColumn = $checkRemarks && $checkRemarks->rowCount() > 0;
        if (!$hasRemarksColumn) {
            try {
                $this->conn->exec("ALTER TABLE finance_transactions ADD COLUMN remarks TEXT NULL");
                $hasRemarksColumn = true;
            } catch (Exception $e) {}
        }

        // Check if approval_status column exists, if not add it
        $checkApproval = $this->conn->query("SHOW COLUMNS FROM finance_transactions LIKE 'approval_status'");
        $hasApprovalColumn = $checkApproval && $checkApproval->rowCount() > 0;
        if (!$hasApprovalColumn) {
            try {
                $this->conn->exec("ALTER TABLE finance_transactions ADD COLUMN approval_status VARCHAR(20) DEFAULT 'approved'");
                $this->conn->exec("ALTER TABLE finance_transactions ADD COLUMN approved_by VARCHAR(100) NULL");
                $this->conn->exec("ALTER TABLE finance_transactions ADD COLUMN approved_at DATETIME NULL");
                $hasApprovalColumn = true;
            } catch (Exception $e) {}
        }

        $fields = ['project_id', 'type', 'amount', 'payment_mode', 'category', 'person_name', 'description', 'transaction_date', 'recorded_by'];
        $placeholders = [':project_id', ':type', ':amount', ':payment_mode', ':category', ':person_name', ':description', ':date', ':recorded_by'];

        if ($hasIncentiveColumn) {
            $fields[] = 'incentive';
            $placeholders[] = ':incentive';
        }
        if ($hasImgColumn) {
            $fields[] = 'receipt_image';
            $placeholders[] = ':receipt_image';
        }
        if ($hasStatusColumn) {
            $fields[] = 'payment_status';
            $placeholders[] = ':payment_status';
        }
        if ($hasRemarksColumn) {
            $fields[] = 'remarks';
            $placeholders[] = ':remarks';
        }
        if ($hasApprovalColumn) {
            $fields[] = 'approval_status';
            $placeholders[] = ':approval_status';
            $fields[] = 'approved_by';
            $placeholders[] = ':approved_by';
            $fields[] = 'approved_at';
            $placeholders[] = ':approved_at';
        }

        $query = "INSERT INTO finance_transactions (" . implode(', ', $fields) . ") VALUES (" . implode(', ', $placeholders) . ")";
        $stmt = $this->conn->prepare($query);

        $stmt->bindParam(':project_id', $project_id);
        $stmt->bindParam(':type', $data['type']);
        $stmt->bindParam(':amount', $data['amount']);
        
        $payment_mode = $data['payment_mode'] ?? null;
        $stmt->bindParam(':payment_mode', $payment_mode);
        
        $category = $data['category'] ?? 'Other';
        $stmt->bindParam(':category', $category);
        
        $person_name = $data['person_name'] ?? null;
        $stmt->bindParam(':person_name', $person_name);
        
        $description = $data['description'] ?? '';
        if ($client_code_label && strpos($description, $client_code_label) === false) {
            $description .= " (Client ID: " . $client_code_label . ")";
        }
        if ($raw_project_id && strpos($description, (string)$raw_project_id) === false) {
            $description .= " [Project: " . $raw_project_id . "]";
        }
        $stmt->bindParam(':description', $description);
        
        $date = $data['date'] ?? date('Y-m-d');
        $stmt->bindParam(':date', $date);
        
        $recorded_by = $data['recorded_by'] ?? 1;
        $stmt->bindParam(':recorded_by', $recorded_by);
        
        if ($hasIncentiveColumn) {
            $incentive = $data['incentive'] ?? null;
            $stmt->bindParam(':incentive', $incentive);
        }
        if ($hasImgColumn) {
            $receipt_image = $data['receipt_image'] ?? $data['image'] ?? null;
            $stmt->bindParam(':receipt_image', $receipt_image);
        }
        if ($hasStatusColumn) {
            $payment_status = $data['payment_status'] ?? 'paid';
            $stmt->bindParam(':payment_status', $payment_status);
        }
        if ($hasRemarksColumn) {
            $remarks = $data['remarks'] ?? null;
            $stmt->bindParam(':remarks', $remarks);
        }
        if ($hasApprovalColumn) {
            $defaultStatus = (($data['type'] ?? '') === 'debit') ? 'pending' : 'approved';
            $approval_status = $data['approval_status'] ?? $defaultStatus;
            $stmt->bindParam(':approval_status', $approval_status);
            $approved_by = $data['approved_by'] ?? ($approval_status === 'approved' ? ($data['recorded_by'] ?? 'Admin') : null);
            $stmt->bindParam(':approved_by', $approved_by);
            $approved_at = $data['approved_at'] ?? ($approval_status === 'approved' ? date('Y-m-d H:i:s') : null);
            $stmt->bindParam(':approved_at', $approved_at);
        }

        try {
            if ($stmt->execute()) {
                $amt = floatval($data['amount'] ?? 0);

                if (($data['type'] ?? '') === 'credit' && !empty($project_id)) {
                    try {
                        try { $this->conn->exec("ALTER TABLE leads ADD COLUMN IF NOT EXISTS advance_received DECIMAL(15,2) DEFAULT 0.00"); } catch (Exception $e) {}
                        try { $this->conn->exec("ALTER TABLE leads ADD COLUMN IF NOT EXISTS is_20_percent_paid TINYINT(1) DEFAULT 0"); } catch (Exception $e) {}
                        try { $this->conn->exec("ALTER TABLE leads ADD COLUMN IF NOT EXISTS stage2_paid TINYINT(1) DEFAULT 0"); } catch (Exception $e) {}
                        try { $this->conn->exec("ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_20_percent_paid TINYINT(1) DEFAULT 0"); } catch (Exception $e) {}
                        try { $this->conn->exec("ALTER TABLE projects ADD COLUMN IF NOT EXISTS stage2_paid TINYINT(1) DEFAULT 0"); } catch (Exception $e) {}
                        try { $this->conn->exec("ALTER TABLE projects ADD COLUMN IF NOT EXISTS stage3_paid TINYINT(1) DEFAULT 0"); } catch (Exception $e) {}

                        $isStage2 = stripos($category, 'stage 2') !== false || stripos($description, 'stage 2') !== false || stripos($description, '20%') !== false;
                        $isStage3 = stripos($category, 'stage 3') !== false || stripos($description, 'stage 3') !== false || stripos($description, '40%') !== false;

                        // Update projects table
                        $this->conn->prepare("UPDATE projects SET advance_received = advance_received + :amt" . ($isStage2 ? ", stage2_paid = 1, is_20_percent_paid = 1, payment_status = '20% Paid'" : ($isStage3 ? ", stage3_paid = 1, payment_status = '60% Paid'" : "")) . " WHERE project_id = :pid OR project_code = :rawid OR manual_client_id = :rawid OR lead_id = :pid")->execute(['amt' => $amt, 'pid' => intval($project_id), 'rawid' => (string)$raw_project_id]);
                        
                        // Update leads table safely
                        $this->conn->prepare("UPDATE leads SET advance_paid = advance_paid + :amt, advance_received = advance_received + :amt" . ($isStage2 ? ", stage2_paid = 1, is_20_percent_paid = 1, payment_status = '20% Paid'" : ($isStage3 ? ", payment_status = '60% Paid'" : "")) . " WHERE lead_id = :lid OR manual_client_id = :rawid")->execute(['amt' => $amt, 'lid' => intval($project_id), 'rawid' => (string)$raw_project_id]);

                        // Check if cumulative total paid >= 19.5% of budget or explicit Stage 2
                        $lRowStmt = $this->conn->prepare("SELECT total_budget, estimated_budget, initial_quote_amount, advance_paid FROM leads WHERE lead_id = :lid OR manual_client_id = :rawid LIMIT 1");
                        $lRowStmt->execute(['lid' => intval($project_id), 'rawid' => (string)$raw_project_id]);
                        $lRow = $lRowStmt->fetch(PDO::FETCH_ASSOC);

                        // Check cumulative credit transactions
                        $finStmt = $this->conn->prepare("
                            SELECT COALESCE(SUM(amount), 0) as total_tx
                            FROM finance_transactions 
                            WHERE type = 'credit' 
                              AND (project_id = :pid OR project_id = :rawid OR description LIKE :rawmatch)
                        ");
                        $rawMatch = "%" . $raw_project_id . "%";
                        $finStmt->execute(['pid' => (string)$project_id, 'rawid' => (string)$raw_project_id, 'rawmatch' => $rawMatch]);
                        $cumTx = floatval($finStmt->fetchColumn() ?: 0);

                        if ($lRow) {
                            $budget = floatval($lRow['initial_quote_amount'] ?? $lRow['total_budget'] ?? $lRow['estimated_budget'] ?? 0);
                            $advPaid = floatval($lRow['advance_paid'] ?? 0);
                            $effectiveTotal = max($advPaid, $cumTx);
                            if ($isStage2 || ($budget > 0 && ($effectiveTotal / $budget) * 100 >= 19.5) || $effectiveTotal >= 20000) {
                                $this->conn->prepare("UPDATE leads SET is_20_percent_paid = 1, stage2_paid = 1, payment_status = '20% Paid', advance_paid = :eff WHERE lead_id = :lid OR manual_client_id = :rawid")->execute(['eff' => $effectiveTotal, 'lid' => intval($project_id), 'rawid' => (string)$raw_project_id]);
                                $this->conn->prepare("UPDATE projects SET is_20_percent_paid = 1, stage2_paid = 1, payment_status = '20% Paid', advance_received = :eff WHERE project_id = :pid OR project_code = :rawid OR manual_client_id = :rawid OR lead_id = :pid")->execute(['eff' => $effectiveTotal, 'pid' => intval($project_id), 'rawid' => (string)$raw_project_id]);
                            }

                            // Strict Workflow Rule: Auto-convert lead to active project ONLY after quote accepted AND Stage 1 paid!
                            $targetStage1 = $budget > 0 ? ($budget * 0.10) : 0;
                            $isStage1Satisfied = $targetStage1 > 0 
                                ? ($effectiveTotal >= ($targetStage1 - 1) || (($effectiveTotal / $budget) * 100) >= 9.9) 
                                : ($effectiveTotal > 0);

                            $lStat = strtolower($lRow['status'] ?? '');
                            $isQuoteAccepted = in_array($lStat, ['proposal_accepted', 'accepted', 'approved', 'won', 'converted']);
                            if (!$isQuoteAccepted) {
                                try {
                                    $chkQStmt = $this->conn->prepare("SELECT quote_id FROM quotes WHERE (lead_id = :lid OR project_id = :lid OR project_id = :rawid) AND (ack_status = 'accepted' OR LOWER(status) IN ('approved', 'accepted', 'order_converted')) LIMIT 1");
                                    $chkQStmt->execute(['lid' => (string)($lRow['lead_id'] ?? $project_id), 'rawid' => (string)$raw_project_id]);
                                    if ($chkQStmt->fetch()) {
                                        $isQuoteAccepted = true;
                                    }
                                } catch (Exception $eQ) {}
                            }

                            if ($isStage1Satisfied && $isQuoteAccepted && empty($lRow['is_converted'])) {
                                require_once __DIR__ . '/LeadController.php';
                                $leadCtrl = new LeadController($this->conn, $this->current_user_id, $this->current_user_role);
                                $leadCtrl->convertToProject(intval($lRow['lead_id'] ?? $project_id), [
                                    'advance_paid' => $effectiveTotal,
                                    'total_budget' => $budget,
                                    'initial_quote_amount' => $budget,
                                    'created_by' => $data['recorded_by'] ?? ($this->current_user_id ?: 1)
                                ]);
                            }
                        }
                    } catch (Exception $e) {
                        error_log("Finance credit lead update error: " . $e->getMessage());
                    }
                }

                // Also sync with monthly_income table for general finance tracking
                try {
                    $monthYear = date('Y-m', strtotime($date));
                    $mStmt = $this->conn->prepare("INSERT INTO monthly_income (month_year, category, description, amount, transaction_date) VALUES (:my, :cat, :desc, :amt, :tdate)");
                    $mStmt->execute([
                        'my' => $monthYear,
                        'cat' => $category,
                        'desc' => $description,
                        'amt' => $amt,
                        'tdate' => $date
                    ]);
                } catch (Exception $e) {}

                return ["success" => true, "message" => "Transaction recorded successfully."];
            }
        } catch (PDOException $e) {
            return ["success" => false, "message" => "Database error: " . $e->getMessage()];
        }
        
        return ["success" => false, "message" => "Failed to record transaction."];
    }

    public function getProjectSummary($project_id)
    {
        $query = "SELECT 
                    SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END) as total_received,
                    SUM(CASE WHEN type = 'debit' AND COALESCE(approval_status, 'approved') = 'approved' THEN amount ELSE 0 END) as total_spent
                  FROM finance_transactions
                  WHERE project_id = :p_id AND COALESCE(is_deleted, 0) = 0";

        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':p_id', $project_id);
        $stmt->execute();
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public function getAllTransactions($project_id = null, $include_deleted = false)
    {
        $resolved_pid = $project_id;
        $pcode = '';
        $mcid = '';

        if (!empty($project_id)) {
            try {
                $pStmt = $this->conn->prepare("SELECT p.project_id, p.project_code, c.converted_from_lead_id FROM projects p LEFT JOIN clients c ON p.client_id = c.client_id WHERE p.project_id = :p1 OR p.project_code = :p2 LIMIT 1");
                $pStmt->execute([':p1' => $project_id, ':p2' => $project_id]);
                $pRow = $pStmt->fetch(PDO::FETCH_ASSOC);
                if ($pRow) {
                    $resolved_pid = $pRow['project_id'];
                    $pcode = $pRow['project_code'] ?? '';
                    if (!empty($pRow['converted_from_lead_id'])) {
                        $lead_id = $pRow['converted_from_lead_id'];
                        $lRow = $this->conn->query("SELECT manual_client_id FROM leads WHERE lead_id = '{$pRow['converted_from_lead_id']}'")->fetch(PDO::FETCH_ASSOC);
                        $mcid = $lRow['manual_client_id'] ?? '';
                    }
                } else {
                    $lStmt = $this->conn->prepare("SELECT lead_id, manual_client_id FROM leads WHERE lead_id = :l1 OR manual_client_id = :l2 LIMIT 1");
                    $lStmt->execute([':l1' => $project_id, ':l2' => $project_id]);
                    $lRow = $lStmt->fetch(PDO::FETCH_ASSOC);
                    if ($lRow) {
                        $mcid = $lRow['manual_client_id'] ?? '';
                        $leadId = $lRow['lead_id'];
                        $lead_id = $leadId;
                        $pConv = $this->conn->prepare("SELECT p.project_id, p.project_code FROM projects p JOIN clients c ON p.client_id = c.client_id WHERE c.converted_from_lead_id = :lid LIMIT 1");
                        $pConv->execute([':lid' => $leadId]);
                        $pConvRow = $pConv->fetch(PDO::FETCH_ASSOC);
                        if ($pConvRow) {
                            $resolved_pid = $pConvRow['project_id'];
                            $pcode = $pConvRow['project_code'] ?? '';
                        } else {
                            $resolved_pid = $leadId;
                        }
                    }
                }
            } catch (Exception $e) {}
        }

        $query = "SELECT ft.*, 
                    COALESCE(p1.project_name, p2.project_name) as project_name,
                    COALESCE(p1.project_code, p2.project_code) as project_code,
                    COALESCE(p1.client_id, p2.client_id) as client_id,
                    COALESCE(p1.project_type, p2.project_type) as project_type,
                    COALESCE(ft.is_deleted, 0) as is_deleted,
                    ft.deleted_at,
                    ft.deleted_by,
                    DATEDIFF(NOW(), ft.deleted_at) as days_since_delete,
                    GREATEST(0, 30 - COALESCE(DATEDIFF(NOW(), ft.deleted_at), 0)) as recovery_days_remaining
                  FROM finance_transactions ft
                  LEFT JOIN projects p1 ON p1.project_id = ft.project_id
                  LEFT JOIN projects p2 ON p2.project_code = ft.project_id AND p1.project_id IS NULL";

        $whereConditions = [];
        $params = [];

        if (!$include_deleted) {
            $whereConditions[] = "COALESCE(ft.is_deleted, 0) = 0";
        }

        if (!empty($project_id)) {
            $pConditions = ["ft.project_id = :r_pid"];
            $params[':r_pid'] = $resolved_pid;
            if ($project_id !== $resolved_pid) {
                $pConditions[] = "ft.project_id = :raw_pid";
                $params[':raw_pid'] = $project_id;
            }
            if (!empty($lead_id)) {
                $pConditions[] = "ft.project_id = :lead_id";
                $params[':lead_id'] = $lead_id;
            }
            if ($pcode) {
                $pConditions[] = "ft.project_id = :pcode OR ft.description LIKE :pcode_match";
                $params[':pcode'] = $pcode;
                $params[':pcode_match'] = "%" . $pcode . "%";
            }
            if ($mcid) {
                $pConditions[] = "ft.project_id = :mcid OR ft.description LIKE :mcid_match";
                $params[':mcid'] = $mcid;
                $params[':mcid_match'] = "%" . $mcid . "%";
            }
            $whereConditions[] = "(" . implode(' OR ', $pConditions) . ")";
        }

        if (!empty($whereConditions)) {
            $query .= " WHERE " . implode(' AND ', $whereConditions);
        }

        $query .= " GROUP BY ft.transaction_id ORDER BY ft.transaction_date DESC, ft.transaction_id DESC";

        $stmt = $this->conn->prepare($query);
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function updateTransaction($id, $data)
    {
        // Build dynamic SET clause based on provided fields
        $setParts = [];
        $params = [];
        
        if (array_key_exists('project_id', $data)) {
            $setParts[] = "project_id = :project_id";
            $params[':project_id'] = empty($data['project_id']) ? null : $data['project_id'];
        }
        if (isset($data['type'])) {
            $setParts[] = "type = :type";
            $params[':type'] = $data['type'];
        }
        if (isset($data['amount'])) {
            $setParts[] = "amount = :amount";
            $params[':amount'] = $data['amount'];
        }
        if (isset($data['payment_mode'])) {
            $setParts[] = "payment_mode = :payment_mode";
            $params[':payment_mode'] = $data['payment_mode'];
        }
        if (isset($data['person_name'])) {
            $setParts[] = "person_name = :person_name";
            $params[':person_name'] = $data['person_name'];
        }
        if (isset($data['incentive'])) {
            $setParts[] = "incentive = :incentive";
            $params[':incentive'] = $data['incentive'];
        }
        if (isset($data['description'])) {
            $setParts[] = "description = :description";
            $params[':description'] = $data['description'];
        }
        if (isset($data['date']) || isset($data['transaction_date'])) {
            $setParts[] = "transaction_date = :date";
            $params[':date'] = $data['date'] ?? $data['transaction_date'] ?? date('Y-m-d');
        }
        if (isset($data['category'])) {
            $setParts[] = "category = :category";
            $params[':category'] = $data['category'];
        }
        if (isset($data['receipt_image']) || isset($data['image'])) {
            $setParts[] = "receipt_image = :receipt_image";
            $params[':receipt_image'] = $data['receipt_image'] ?? $data['image'];
        }
        if (isset($data['payment_status'])) {
            $setParts[] = "payment_status = :payment_status";
            $params[':payment_status'] = $data['payment_status'];
        }
        if (isset($data['remarks'])) {
            $setParts[] = "remarks = :remarks";
            $params[':remarks'] = $data['remarks'];
        }
        if (isset($data['approval_status'])) {
            $setParts[] = "approval_status = :approval_status";
            $params[':approval_status'] = $data['approval_status'];
        }
        if (isset($data['approved_by'])) {
            $setParts[] = "approved_by = :approved_by";
            $params[':approved_by'] = $data['approved_by'];
        }
        if (isset($data['approved_at'])) {
            $setParts[] = "approved_at = :approved_at";
            $params[':approved_at'] = $data['approved_at'];
        }
        
        if (empty($setParts)) {
            return ["success" => false, "message" => "No fields to update"];
        }
        
        $query = "UPDATE finance_transactions SET " . implode(', ', $setParts) . " WHERE transaction_id = :id";
        $params[':id'] = $id;

        $stmt = $this->conn->prepare($query);

        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }

        try {
            if ($stmt->execute()) {
                return ["success" => true, "message" => "Transaction updated."];
            }
        } catch (PDOException $e) {
            return ["success" => false, "message" => "Database error: " . $e->getMessage()];
        }
        
        return ["success" => false, "message" => "Failed to update transaction."];
    }

    public function approveExpense($id, $approved_by = null)
    {
        try {
            $this->conn->exec("ALTER TABLE finance_transactions ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'approved'");
            $this->conn->exec("ALTER TABLE finance_transactions ADD COLUMN IF NOT EXISTS approved_by VARCHAR(100) NULL");
            $this->conn->exec("ALTER TABLE finance_transactions ADD COLUMN IF NOT EXISTS approved_at DATETIME NULL");
        } catch (Exception $e) {}

        $stmt = $this->conn->prepare("UPDATE finance_transactions SET approval_status = 'approved', approved_by = :uid, approved_at = NOW() WHERE transaction_id = :id");
        if ($stmt->execute([':uid' => $approved_by, ':id' => $id])) {
            return ["success" => true, "message" => "Expense approved and reflected in balance sheet."];
        }
        return ["success" => false, "message" => "Failed to approve expense."];
    }

    public function rejectExpense($id, $approved_by = null)
    {
        try {
            $this->conn->exec("ALTER TABLE finance_transactions ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'approved'");
            $this->conn->exec("ALTER TABLE finance_transactions ADD COLUMN IF NOT EXISTS approved_by VARCHAR(100) NULL");
            $this->conn->exec("ALTER TABLE finance_transactions ADD COLUMN IF NOT EXISTS approved_at DATETIME NULL");
        } catch (Exception $e) {}

        $stmt = $this->conn->prepare("UPDATE finance_transactions SET approval_status = 'rejected', approved_by = :uid, approved_at = NOW() WHERE transaction_id = :id");
        if ($stmt->execute([':uid' => $approved_by, ':id' => $id])) {
            return ["success" => true, "message" => "Expense rejected."];
        }
        return ["success" => false, "message" => "Failed to reject expense."];
    }

    /**
     * Soft-deletes a transaction with 30-day recovery window.
     * User requirement: "If I delete any entries from Company Expenses, Site Expenses, or Payments Received, 
     * they should appear in the Deleted Entries section and remain recoverable for 30 days."
     */
    public function deleteTransaction($id, $deleted_by = null)
    {
        $this->ensureSchema();
        $query = "UPDATE finance_transactions 
                  SET is_deleted = 1, deleted_at = NOW(), deleted_by = :uid 
                  WHERE transaction_id = :id";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':id', $id);
        $stmt->bindParam(':uid', $deleted_by);

        try {
            if ($stmt->execute()) {
                return [
                    "success" => true, 
                    "message" => "Transaction moved to Deleted Entries. It can be recovered within 30 days."
                ];
            }
        } catch (PDOException $e) {
            return ["success" => false, "message" => "Database error: " . $e->getMessage()];
        }
        
        return ["success" => false, "message" => "Failed to delete transaction."];
    }

    /**
     * Restores a soft-deleted transaction.
     */
    public function restoreTransaction($id)
    {
        $this->ensureSchema();
        $query = "UPDATE finance_transactions 
                  SET is_deleted = 0, deleted_at = NULL, deleted_by = NULL 
                  WHERE transaction_id = :id";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':id', $id);

        try {
            if ($stmt->execute()) {
                return ["success" => true, "message" => "Transaction restored successfully."];
            }
        } catch (PDOException $e) {
            return ["success" => false, "message" => "Database error: " . $e->getMessage()];
        }

        return ["success" => false, "message" => "Failed to restore transaction."];
    }

    /**
     * Permanently purges a transaction from the database.
     */
    public function permanentDeleteTransaction($id)
    {
        $query = "DELETE FROM finance_transactions WHERE transaction_id = :id";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':id', $id);

        try {
            if ($stmt->execute()) {
                return ["success" => true, "message" => "Transaction permanently purged from database."];
            }
        } catch (PDOException $e) {
            return ["success" => false, "message" => "Database error: " . $e->getMessage()];
        }

        return ["success" => false, "message" => "Failed to permanently delete transaction."];
    }
}
?>