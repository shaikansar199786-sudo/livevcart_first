<?php
// api/controllers/ContractLabourController.php

class ContractLabourController {
    private $conn;

    public function __construct($db) {
        $this->conn = $db;
    }

    public function getProjectContracts($projectId) {
        if (empty($projectId)) {
            return ["success" => false, "message" => "Project ID is required"];
        }

        try {
            // Fetch contracts for this project
            $stmt = $this->conn->prepare("
                SELECT * FROM project_contract_labour 
                WHERE project_id = ? 
                ORDER BY created_at DESC
            ");
            $stmt->execute([$projectId]);
            $contracts = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Fetch all payments for this project
            $stmtPay = $this->conn->prepare("
                SELECT * FROM project_contract_payments 
                WHERE project_id = ? 
                ORDER BY payment_date ASC, id ASC
            ");
            $stmtPay->execute([$projectId]);
            $allPayments = $stmtPay->fetchAll(PDO::FETCH_ASSOC);

            // Group payments by contract_id
            $paymentsByContract = [];
            foreach ($allPayments as $p) {
                $cId = $p['contract_id'];
                if (!isset($paymentsByContract[$cId])) {
                    $paymentsByContract[$cId] = [];
                }
                $paymentsByContract[$cId][] = $p;
            }

            // Attach payments & calculate totals
            $totalContractAmount = 0;
            $totalPaid = 0;
            $countsByType = ['Labour' => 0, 'Contractor' => 0, 'Vendor' => 0];

            foreach ($contracts as &$c) {
                $cId = $c['id'];
                $c['contract_amount'] = floatval($c['contract_amount'] ?? 0);
                $c['payments'] = $paymentsByContract[$cId] ?? [];
                
                $cPaid = 0;
                foreach ($c['payments'] as $p) {
                    if (strtolower($p['status'] ?? 'paid') === 'paid') {
                        $cPaid += floatval($p['amount'] ?? 0);
                    }
                }
                
                $c['total_paid'] = $cPaid;
                $c['balance_due'] = max(0, $c['contract_amount'] - $cPaid);
                $c['is_fully_paid'] = $cPaid >= $c['contract_amount'] && $c['contract_amount'] > 0;

                $totalContractAmount += $c['contract_amount'];
                $totalPaid += $cPaid;

                $type = $c['party_type'] ?? 'Labour';
                if (!isset($countsByType[$type])) {
                    $countsByType[$type] = 0;
                }
                $countsByType[$type]++;
            }
            unset($c);

            return [
                "success" => true,
                "data" => [
                    "contracts" => $contracts,
                    "summary" => [
                        "total_assigned" => count($contracts),
                        "total_contract_amount" => $totalContractAmount,
                        "total_paid" => $totalPaid,
                        "total_balance_due" => max(0, $totalContractAmount - $totalPaid),
                        "counts_by_type" => $countsByType
                    ]
                ]
            ];
        } catch (PDOException $e) {
            return ["success" => false, "message" => "Database Error: " . $e->getMessage()];
        }
    }

    public function createContract($data) {
        $projectId = $data['project_id'] ?? null;
        $partyName = trim($data['party_name'] ?? '');
        $partyType = $data['party_type'] ?? 'Labour';
        $workTrade = trim($data['work_trade'] ?? '');
        $phone = trim($data['phone'] ?? '');
        $contractAmount = floatval($data['contract_amount'] ?? 0);
        $status = $data['status'] ?? 'In Progress';
        $notes = trim($data['notes'] ?? '');
        $createdBy = $data['created_by'] ?? null;

        if (empty($projectId) || empty($partyName)) {
            return ["success" => false, "message" => "Project ID and Party Name are required"];
        }

        try {
            $stmt = $this->conn->prepare("
                INSERT INTO project_contract_labour 
                (project_id, party_name, party_type, work_trade, phone, contract_amount, status, notes, created_by) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $projectId, $partyName, $partyType, $workTrade, $phone, $contractAmount, $status, $notes, $createdBy
            ]);
            $contractId = $this->conn->lastInsertId();

            // If an initial advance was recorded simultaneously
            $initialAdvance = floatval($data['initial_advance'] ?? 0);
            if ($initialAdvance > 0) {
                $advDate = !empty($data['advance_date']) ? $data['advance_date'] : date('Y-m-d');
                $advMode = !empty($data['advance_mode']) ? $data['advance_mode'] : 'Cash';
                $advProof = $data['advance_proof'] ?? null;
                $advNotes = $data['advance_notes'] ?? 'Initial Advance Payment';

                $stmtAdv = $this->conn->prepare("
                    INSERT INTO project_contract_payments 
                    (contract_id, project_id, payment_stage, amount, payment_date, payment_mode, status, receipt_proof, notes, recorded_by) 
                    VALUES (?, ?, 'Advance', ?, ?, ?, 'Paid', ?, ?, ?)
                ");
                $stmtAdv->execute([
                    $contractId, $projectId, $initialAdvance, $advDate, $advMode, $advProof, $advNotes, $createdBy
                ]);
            }

            return [
                "success" => true,
                "message" => "Contract created successfully",
                "contract_id" => $contractId
            ];
        } catch (PDOException $e) {
            return ["success" => false, "message" => "Database Error: " . $e->getMessage()];
        }
    }

    public function updateContract($data) {
        $id = $data['id'] ?? null;
        if (empty($id)) {
            return ["success" => false, "message" => "Contract ID is required"];
        }

        try {
            $partyName = trim($data['party_name'] ?? '');
            $partyType = $data['party_type'] ?? 'Labour';
            $workTrade = trim($data['work_trade'] ?? '');
            $phone = trim($data['phone'] ?? '');
            $contractAmount = floatval($data['contract_amount'] ?? 0);
            $status = $data['status'] ?? 'In Progress';
            $notes = trim($data['notes'] ?? '');

            $stmt = $this->conn->prepare("
                UPDATE project_contract_labour 
                SET party_name = ?, party_type = ?, work_trade = ?, phone = ?, contract_amount = ?, status = ?, notes = ? 
                WHERE id = ?
            ");
            $stmt->execute([
                $partyName, $partyType, $workTrade, $phone, $contractAmount, $status, $notes, $id
            ]);

            return ["success" => true, "message" => "Contract updated successfully"];
        } catch (PDOException $e) {
            return ["success" => false, "message" => "Database Error: " . $e->getMessage()];
        }
    }

    public function deleteContract($id) {
        if (empty($id)) {
            return ["success" => false, "message" => "Contract ID is required"];
        }

        try {
            // Delete payments
            $stmtPay = $this->conn->prepare("DELETE FROM project_contract_payments WHERE contract_id = ?");
            $stmtPay->execute([$id]);

            // Delete contract
            $stmt = $this->conn->prepare("DELETE FROM project_contract_labour WHERE id = ?");
            $stmt->execute([$id]);

            return ["success" => true, "message" => "Contract and payments deleted successfully"];
        } catch (PDOException $e) {
            return ["success" => false, "message" => "Database Error: " . $e->getMessage()];
        }
    }

    public function addPayment($data) {
        $contractId = $data['contract_id'] ?? null;
        $projectId = $data['project_id'] ?? null;
        $paymentStage = trim($data['payment_stage'] ?? 'Installment');
        $amount = floatval($data['amount'] ?? 0);
        $paymentDate = !empty($data['payment_date']) ? $data['payment_date'] : date('Y-m-d');
        $paymentMode = $data['payment_mode'] ?? 'Cash';
        $status = $data['status'] ?? 'Paid';
        $receiptProof = $data['receipt_proof'] ?? null;
        $notes = trim($data['notes'] ?? '');
        $recordedBy = $data['recorded_by'] ?? null;

        if (empty($contractId) || empty($projectId) || $amount <= 0) {
            return ["success" => false, "message" => "Contract ID, Project ID, and a valid Amount are required"];
        }

        try {
            $stmt = $this->conn->prepare("
                INSERT INTO project_contract_payments 
                (contract_id, project_id, payment_stage, amount, payment_date, payment_mode, status, receipt_proof, notes, recorded_by) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $contractId, $projectId, $paymentStage, $amount, $paymentDate, $paymentMode, $status, $receiptProof, $notes, $recordedBy
            ]);

            return ["success" => true, "message" => "Payment installment recorded successfully"];
        } catch (PDOException $e) {
            return ["success" => false, "message" => "Database Error: " . $e->getMessage()];
        }
    }

    public function updatePayment($data) {
        $id = $data['id'] ?? null;
        if (empty($id)) {
            return ["success" => false, "message" => "Payment ID is required"];
        }

        try {
            $paymentStage = trim($data['payment_stage'] ?? 'Installment');
            $amount = floatval($data['amount'] ?? 0);
            $paymentDate = !empty($data['payment_date']) ? $data['payment_date'] : date('Y-m-d');
            $paymentMode = $data['payment_mode'] ?? 'Cash';
            $status = $data['status'] ?? 'Paid';
            $receiptProof = $data['receipt_proof'] ?? null;
            $notes = trim($data['notes'] ?? '');

            $fields = [
                "payment_stage = ?",
                "amount = ?",
                "payment_date = ?",
                "payment_mode = ?",
                "status = ?",
                "notes = ?"
            ];
            $params = [$paymentStage, $amount, $paymentDate, $paymentMode, $status, $notes];

            if ($receiptProof !== null) {
                $fields[] = "receipt_proof = ?";
                $params[] = $receiptProof;
            }

            $params[] = $id;

            $stmt = $this->conn->prepare("
                UPDATE project_contract_payments 
                SET " . implode(", ", $fields) . " 
                WHERE id = ?
            ");
            $stmt->execute($params);

            return ["success" => true, "message" => "Payment updated successfully"];
        } catch (PDOException $e) {
            return ["success" => false, "message" => "Database Error: " . $e->getMessage()];
        }
    }

    public function deletePayment($id) {
        if (empty($id)) {
            return ["success" => false, "message" => "Payment ID is required"];
        }

        try {
            $stmt = $this->conn->prepare("DELETE FROM project_contract_payments WHERE id = ?");
            $stmt->execute([$id]);

            return ["success" => true, "message" => "Payment deleted successfully"];
        } catch (PDOException $e) {
            return ["success" => false, "message" => "Database Error: " . $e->getMessage()];
        }
    }
}
