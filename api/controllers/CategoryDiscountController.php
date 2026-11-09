<?php
// api/controllers/CategoryDiscountController.php

class CategoryDiscountController {
    private $db;

    public function __construct($db) {
        $this->db = $db;
        $this->initTables();
    }

    private function initTables() {
        if (!$this->db) return;
        try {
            $this->db->exec("CREATE TABLE IF NOT EXISTS system_settings (
                setting_key VARCHAR(100) PRIMARY KEY,
                setting_value TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            // Seed default category_max_discount if not present
            try {
                $stmt = $this->db->prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'category_max_discount'");
                $stmt->execute();
                if (!$stmt->fetch()) {
                    $ins = $this->db->prepare("INSERT INTO system_settings (setting_key, setting_value) VALUES ('category_max_discount', '10')");
                    $ins->execute();
                }
            } catch (Throwable $se1) {}

            // Seed default category_max_discounts_map if not present
            try {
                $stmtMap = $this->db->prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'category_max_discounts_map'");
                $stmtMap->execute();
                if (!$stmtMap->fetch()) {
                    $defaultMap = [
                        'Wood work' => 10,
                        'Accessories' => 15,
                        'False Ceiling' => 10,
                        'Painting' => 12,
                        'HDS' => 10,
                        'Lights' => 15,
                        'Furniture' => 10,
                        'Furnishing' => 10,
                        'Custom Carpentry' => 10,
                        'Decor' => 15,
                        'Civilwork' => 5,
                        'Services' => 5,
                        'Miscellaneous' => 10,
                        'Appliances' => 5
                    ];
                    $insMap = $this->db->prepare("INSERT INTO system_settings (setting_key, setting_value) VALUES ('category_max_discounts_map', :map)");
                    $insMap->execute(['map' => json_encode($defaultMap)]);
                }
            } catch (Throwable $se2) {}

            $this->db->exec("CREATE TABLE IF NOT EXISTS category_discount_requests (
                id INT AUTO_INCREMENT PRIMARY KEY,
                quote_id VARCHAR(100) NULL,
                project_id VARCHAR(100) NULL,
                project_name VARCHAR(255) NULL,
                client_name VARCHAR(255) NULL,
                requested_by_id VARCHAR(100) NULL,
                requested_by_name VARCHAR(255) NULL,
                category_discounts LONGTEXT NOT NULL,
                exceeding_details LONGTEXT NULL,
                total_subtotal DECIMAL(15,2) DEFAULT 0,
                total_discount_amount DECIMAL(15,2) DEFAULT 0,
                notes TEXT NULL,
                status VARCHAR(50) DEFAULT 'pending',
                reviewed_by_id VARCHAR(100) NULL,
                reviewed_by_name VARCHAR(255) NULL,
                reviewed_at DATETIME NULL,
                rejection_reason TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            // Ensure columns exist on older tables
            try { $this->db->exec("ALTER TABLE category_discount_requests ADD COLUMN IF NOT EXISTS rejection_reason TEXT NULL"); } catch (Throwable $e) {}
            try { $this->db->exec("ALTER TABLE category_discount_requests ADD COLUMN IF NOT EXISTS reviewed_by_id VARCHAR(100) NULL"); } catch (Throwable $e) {}
            try { $this->db->exec("ALTER TABLE category_discount_requests ADD COLUMN IF NOT EXISTS reviewed_by_name VARCHAR(255) NULL"); } catch (Throwable $e) {}
            try { $this->db->exec("ALTER TABLE category_discount_requests ADD COLUMN IF NOT EXISTS reviewed_at DATETIME NULL"); } catch (Throwable $e) {}
        } catch (Throwable $e) {
            error_log("CategoryDiscountController table init error: " . $e->getMessage());
        }
    }

    public function getMaxDiscount() {
        $defaultMap = [
            'Wood work' => 10,
            'Accessories' => 15,
            'False Ceiling' => 10,
            'Painting' => 12,
            'HDS' => 10,
            'Lights' => 15,
            'Furniture' => 10,
            'Furnishing' => 10,
            'Custom Carpentry' => 10,
            'Decor' => 15,
            'Civilwork' => 5,
            'Services' => 5,
            'Miscellaneous' => 10,
            'Appliances' => 5
        ];

        try {
            if (!$this->db) {
                return [
                    "success" => true,
                    "max_discount" => 10.0,
                    "category_max_discounts" => $defaultMap
                ];
            }

            $stmt = $this->db->prepare("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('category_max_discount', 'category_max_discounts_map')");
            $stmt->execute();
            $rows = $stmt->fetchAll(PDO::FETCH_KEY_PAIR) ?: [];
            $val = isset($rows['category_max_discount']) ? floatval($rows['category_max_discount']) : 10.0;
            $catMap = [];
            if (!empty($rows['category_max_discounts_map'])) {
                $decoded = json_decode($rows['category_max_discounts_map'], true);
                if (is_array($decoded)) {
                    $catMap = $decoded;
                }
            }
            if (empty($catMap)) {
                $catMap = $defaultMap;
            }
            return [
                "success" => true,
                "max_discount" => $val,
                "category_max_discounts" => $catMap
            ];
        } catch (Throwable $e) {
            return [
                "success" => true,
                "max_discount" => 10.0,
                "category_max_discounts" => $defaultMap
            ];
        }
    }

    public function updateMaxDiscount($data) {
        try {
            $val = isset($data['max_discount']) ? floatval($data['max_discount']) : 10.0;
            if ($val < 0 || $val > 100) {
                $val = 10.0;
            }

            $stmt = $this->db->prepare("INSERT INTO system_settings (setting_key, setting_value) 
                VALUES ('category_max_discount', :val1) 
                ON DUPLICATE KEY UPDATE setting_value = :val2");
            $stmt->execute([
                'val1' => strval($val),
                'val2' => strval($val)
            ]);

            $catMap = $data['category_max_discounts'] ?? $data['categories'] ?? null;
            $cleanedMap = [];
            if ($catMap !== null && is_array($catMap)) {
                foreach ($catMap as $cat => $limit) {
                    $cName = trim(strval($cat));
                    $lVal = floatval($limit);
                    if ($cName !== '' && $lVal >= 0 && $lVal <= 100) {
                        $cleanedMap[$cName] = $lVal;
                    }
                }
                $jsonMap = json_encode($cleanedMap);
                $stmtMap = $this->db->prepare("INSERT INTO system_settings (setting_key, setting_value) 
                    VALUES ('category_max_discounts_map', :val1) 
                    ON DUPLICATE KEY UPDATE setting_value = :val2");
                $stmtMap->execute([
                    'val1' => $jsonMap,
                    'val2' => $jsonMap
                ]);
            }

            return [
                "success" => true,
                "message" => "Category max discount limits updated successfully",
                "max_discount" => $val,
                "category_max_discounts" => $cleanedMap
            ];
        } catch (Exception $e) {
            return ["success" => false, "message" => $e->getMessage()];
        }
    }

    public function submitRequest($data) {
        try {
            $quoteId = trim($data['quote_id'] ?? '');
            $projectId = trim($data['project_id'] ?? '');
            $projectName = trim($data['project_name'] ?? '');
            $clientName = trim($data['client_name'] ?? '');
            $reqById = trim($data['requested_by_id'] ?? $data['user_id'] ?? '');
            $reqByName = trim($data['requested_by_name'] ?? $data['user_name'] ?? 'Employee');
            $notes = trim($data['notes'] ?? '');
            $totalSubtotal = floatval($data['total_subtotal'] ?? 0);
            $totalDiscountAmt = floatval($data['total_discount_amount'] ?? 0);

            $rawCatDisc = $data['category_discounts'] ?? [];
            $catDiscountsJson = is_string($rawCatDisc) ? $rawCatDisc : json_encode($rawCatDisc);

            $rawExceeding = $data['exceeding_details'] ?? [];
            $exceedingJson = is_string($rawExceeding) ? $rawExceeding : json_encode($rawExceeding);

            if (empty($projectId) && empty($quoteId)) {
                return ["success" => false, "message" => "Project ID or Quote ID is required to submit a discount approval request."];
            }

            // Check if there is an existing pending request for this quote or project
            $existingId = null;
            if (!empty($quoteId)) {
                $check = $this->db->prepare("SELECT id FROM category_discount_requests WHERE quote_id = :qid AND status = 'pending' ORDER BY id DESC LIMIT 1");
                $check->execute(['qid' => $quoteId]);
                $existing = $check->fetch(PDO::FETCH_ASSOC);
                if ($existing) $existingId = $existing['id'];
            }
            if (!$existingId && !empty($projectId)) {
                $check = $this->db->prepare("SELECT id FROM category_discount_requests WHERE project_id = :pid AND status = 'pending' ORDER BY id DESC LIMIT 1");
                $check->execute(['pid' => $projectId]);
                $existing = $check->fetch(PDO::FETCH_ASSOC);
                if ($existing) $existingId = $existing['id'];
            }

            if ($existingId) {
                // Update existing pending request
                $upd = $this->db->prepare("UPDATE category_discount_requests SET 
                    project_name = :pname,
                    client_name = :cname,
                    requested_by_id = :req_id,
                    requested_by_name = :req_name,
                    category_discounts = :cats,
                    exceeding_details = :exceed,
                    total_subtotal = :subtot,
                    total_discount_amount = :discamt,
                    notes = :notes,
                    status = 'pending',
                    updated_at = NOW()
                    WHERE id = :id");
                $upd->execute([
                    'pname' => $projectName,
                    'cname' => $clientName,
                    'req_id' => $reqById,
                    'req_name' => $reqByName,
                    'cats' => $catDiscountsJson,
                    'exceed' => $exceedingJson,
                    'subtot' => $totalSubtotal,
                    'discamt' => $totalDiscountAmt,
                    'notes' => $notes,
                    'id' => $existingId
                ]);

                return [
                    "success" => true,
                    "request_id" => $existingId,
                    "message" => "Discount approval request updated successfully and sent to Admin Dashboard!"
                ];
            }

            // Insert new request
            $stmt = $this->db->prepare("INSERT INTO category_discount_requests 
                (quote_id, project_id, project_name, client_name, requested_by_id, requested_by_name, category_discounts, exceeding_details, total_subtotal, total_discount_amount, notes, status)
                VALUES (:qid, :pid, :pname, :cname, :req_id, :req_name, :cats, :exceed, :subtot, :discamt, :notes, 'pending')");
            $stmt->execute([
                'qid' => $quoteId,
                'pid' => $projectId,
                'pname' => $projectName,
                'cname' => $clientName,
                'req_id' => $reqById,
                'req_name' => $reqByName,
                'cats' => $catDiscountsJson,
                'exceed' => $exceedingJson,
                'subtot' => $totalSubtotal,
                'discamt' => $totalDiscountAmt,
                'notes' => $notes
            ]);

            $newId = $this->db->lastInsertId();

            return [
                "success" => true,
                "request_id" => $newId,
                "message" => "Category discount approval request submitted to Admin Dashboard successfully!"
            ];
        } catch (Exception $e) {
            return ["success" => false, "message" => $e->getMessage()];
        }
    }

    public function getRequests($params = []) {
        try {
            $status = $params['status'] ?? null;
            $quoteId = $params['quote_id'] ?? null;
            $projectId = $params['project_id'] ?? null;

            $sql = "SELECT * FROM category_discount_requests WHERE 1=1";
            $binds = [];

            if (!empty($status) && $status !== 'all') {
                $sql .= " AND status = :status";
                $binds['status'] = $status;
            }
            if (!empty($quoteId)) {
                $sql .= " AND quote_id = :quote_id";
                $binds['quote_id'] = $quoteId;
            }
            if (!empty($projectId)) {
                $sql .= " AND project_id = :project_id";
                $binds['project_id'] = $projectId;
            }

            $sql .= " ORDER BY (status = 'pending') DESC, id DESC";

            $stmt = $this->db->prepare($sql);
            $stmt->execute($binds);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Parse JSON fields
            foreach ($rows as &$r) {
                if (!empty($r['category_discounts'])) {
                    $decoded = json_decode($r['category_discounts'], true);
                    $r['category_discounts_parsed'] = $decoded ?: [];
                } else {
                    $r['category_discounts_parsed'] = [];
                }
                if (!empty($r['exceeding_details'])) {
                    $decoded = json_decode($r['exceeding_details'], true);
                    $r['exceeding_details_parsed'] = $decoded ?: [];
                } else {
                    $r['exceeding_details_parsed'] = [];
                }
            }

            return ["success" => true, "data" => $rows];
        } catch (Exception $e) {
            return ["success" => false, "message" => $e->getMessage(), "data" => []];
        }
    }

    public function reviewRequest($data) {
        try {
            $requestId = intval($data['request_id'] ?? $data['id'] ?? 0);
            $action = strtolower(trim($data['action'] ?? '')); // 'approved' or 'rejected'
            if ($action === 'reject') $action = 'rejected';
            if ($action === 'approve') $action = 'approved';

            $reviewedByName = trim($data['reviewed_by_name'] ?? $data['reviewed_by'] ?? 'Admin');
            $reviewedById = trim($data['reviewed_by_id'] ?? '');
            $rejectionReason = trim($data['rejection_reason'] ?? $data['reason'] ?? 'Discount request rejected');

            // Fallback: look up pending request by quote_id or project_id if request_id not provided
            if ($requestId <= 0 && (!empty($data['quote_id']) || !empty($data['project_id']))) {
                $qid = trim($data['quote_id'] ?? '');
                $pid = trim($data['project_id'] ?? '');
                if ($qid) {
                    $fStmt = $this->db->prepare("SELECT id FROM category_discount_requests WHERE quote_id = :qid AND status = 'pending' ORDER BY id DESC LIMIT 1");
                    $fStmt->execute(['qid' => $qid]);
                    $fRow = $fStmt->fetch(PDO::FETCH_ASSOC);
                    if ($fRow) $requestId = intval($fRow['id']);
                }
                if ($requestId <= 0 && $pid) {
                    $fStmt = $this->db->prepare("SELECT id FROM category_discount_requests WHERE project_id = :pid AND status = 'pending' ORDER BY id DESC LIMIT 1");
                    $fStmt->execute(['pid' => $pid]);
                    $fRow = $fStmt->fetch(PDO::FETCH_ASSOC);
                    if ($fRow) $requestId = intval($fRow['id']);
                }
            }

            if ($requestId <= 0) {
                return ["success" => false, "message" => "Valid request_id is required."];
            }
            if ($action !== 'approved' && $action !== 'rejected') {
                return ["success" => false, "message" => "Action must be either 'approved' or 'rejected'."];
            }

            // Fetch request
            $stmt = $this->db->prepare("SELECT * FROM category_discount_requests WHERE id = :id");
            $stmt->execute(['id' => $requestId]);
            $req = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$req) {
                return ["success" => false, "message" => "Discount approval request not found."];
            }

            // Update request record
            $upd = $this->db->prepare("UPDATE category_discount_requests SET 
                status = :st,
                reviewed_by_id = :rev_id,
                reviewed_by_name = :rev_name,
                reviewed_at = NOW(),
                rejection_reason = :reason,
                updated_at = NOW()
                WHERE id = :id");
            $upd->execute([
                'st' => $action,
                'rev_id' => $reviewedById,
                'rev_name' => $reviewedByName,
                'reason' => $action === 'rejected' ? $rejectionReason : null,
                'id' => $requestId
            ]);

            // Sync approval or rejection into quote's extra_data in quotes table if quote exists
            if (!empty($req['quote_id']) || !empty($req['project_id'])) {
                if ($action === 'approved') {
                    $this->syncApprovedDiscountsToQuote($req, $reviewedByName);
                } else if ($action === 'rejected') {
                    $this->syncRejectedDiscountsToQuote($req, $reviewedByName, $rejectionReason);
                }
            }

            $actionText = $action === 'approved' ? 'approved' : 'rejected';
            return [
                "success" => true,
                "message" => "Category discount approval request #{$requestId} has been {$actionText} successfully!"
            ];
        } catch (Exception $e) {
            return ["success" => false, "message" => $e->getMessage()];
        }
    }

    private function syncRejectedDiscountsToQuote($request, $adminName, $rejectionReason) {
        try {
            $quoteId = $request['quote_id'] ?? null;
            $projectId = $request['project_id'] ?? null;
            $catDiscounts = json_decode($request['category_discounts'] ?? '{}', true);

            if (empty($catDiscounts) || !is_array($catDiscounts)) return;

            $quoteRow = null;
            if ($quoteId) {
                $qStmt = $this->db->prepare("SELECT id, extra_data FROM quotes WHERE id = :qid LIMIT 1");
                $qStmt->execute(['qid' => $quoteId]);
                $quoteRow = $qStmt->fetch(PDO::FETCH_ASSOC);
            }
            if (!$quoteRow && $projectId) {
                $qStmt = $this->db->prepare("SELECT id, extra_data FROM quotes WHERE project_id = :pid ORDER BY id DESC LIMIT 1");
                $qStmt->execute(['pid' => $projectId]);
                $quoteRow = $qStmt->fetch(PDO::FETCH_ASSOC);
            }

            if ($quoteRow) {
                $extraData = !empty($quoteRow['extra_data']) ? json_decode($quoteRow['extra_data'], true) : [];
                if (!is_array($extraData)) $extraData = [];

                $existingCatDiscounts = $extraData['category_discounts'] ?? [];
                if (!is_array($existingCatDiscounts)) $existingCatDiscounts = [];

                $stamp = date('h:i A, d/m/Y');
                foreach ($catDiscounts as $catName => $discInfo) {
                    $normVal = is_array($discInfo) ? ($discInfo['value'] ?? 0) : floatval($discInfo);
                    $discType = is_array($discInfo) ? ($discInfo['type'] ?? 'percent') : 'percent';
                    $existingCatDiscounts[$catName] = [
                        'type' => $discType,
                        'value' => $normVal,
                        'adminApproved' => false,
                        'rejected' => true,
                        'rejectedBy' => $adminName,
                        'rejectedAt' => $stamp,
                        'rejectionReason' => $rejectionReason,
                        'approvedValue' => 0
                    ];
                }

                $extraData['category_discounts'] = $existingCatDiscounts;
                $upd = $this->db->prepare("UPDATE quotes SET extra_data = :extra WHERE id = :qid");
                $upd->execute([
                    'extra' => json_encode($extraData),
                    'qid' => $quoteRow['id']
                ]);
            }
        } catch (Exception $e) {
            error_log("Failed to sync rejected discounts to quote: " . $e->getMessage());
        }
    }

    private function syncApprovedDiscountsToQuote($request, $adminName) {
        try {
            $quoteId = $request['quote_id'] ?? null;
            $projectId = $request['project_id'] ?? null;
            $catDiscounts = json_decode($request['category_discounts'] ?? '{}', true);

            if (empty($catDiscounts) || !is_array($catDiscounts)) return;

            // Find matching quote in quotes table
            $quoteRow = null;
            if ($quoteId) {
                $qStmt = $this->db->prepare("SELECT id, extra_data FROM quotes WHERE id = :qid LIMIT 1");
                $qStmt->execute(['qid' => $quoteId]);
                $quoteRow = $qStmt->fetch(PDO::FETCH_ASSOC);
            }
            if (!$quoteRow && $projectId) {
                $qStmt = $this->db->prepare("SELECT id, extra_data FROM quotes WHERE project_id = :pid ORDER BY id DESC LIMIT 1");
                $qStmt->execute(['pid' => $projectId]);
                $quoteRow = $qStmt->fetch(PDO::FETCH_ASSOC);
            }

            if ($quoteRow) {
                $extraData = !empty($quoteRow['extra_data']) ? json_decode($quoteRow['extra_data'], true) : [];
                if (!is_array($extraData)) $extraData = [];

                $existingCatDiscounts = $extraData['category_discounts'] ?? [];
                if (!is_array($existingCatDiscounts)) $existingCatDiscounts = [];

                $stamp = date('h:i A, d/m/Y');
                foreach ($catDiscounts as $catName => $discInfo) {
                    $normVal = is_array($discInfo) ? ($discInfo['value'] ?? 0) : floatval($discInfo);
                    $discType = is_array($discInfo) ? ($discInfo['type'] ?? 'percent') : 'percent';
                    $existingCatDiscounts[$catName] = [
                        'type' => $discType,
                        'value' => $normVal,
                        'adminApproved' => true,
                        'approvedBy' => $adminName,
                        'approvedAt' => $stamp,
                        'approvedValue' => $normVal
                    ];
                }

                $extraData['category_discounts'] = $existingCatDiscounts;
                $upd = $this->db->prepare("UPDATE quotes SET extra_data = :extra WHERE id = :qid");
                $upd->execute([
                    'extra' => json_encode($extraData),
                    'qid' => $quoteRow['id']
                ]);
            }
        } catch (Exception $e) {
            error_log("Failed to sync approved discounts to quote: " . $e->getMessage());
        }
    }
}
