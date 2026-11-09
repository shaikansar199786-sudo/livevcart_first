<?php
// api/controllers/VendorController.php

class VendorController {
    private $conn;

    public function __construct($db) {
        $this->conn = $db;
        try {
            $this->conn->exec("ALTER TABLE vendors ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'");
        } catch (Exception $e) {}
    }

    public function getAll($category = null) {
        try {
            if (!empty($category)) {
                $category = trim($category);
                $catLower = strtolower($category);

                if (in_array($catLower, ['transport', 'labor', 'miscellaneous'])) {
                    $stmt = $this->conn->prepare("
                        SELECT DISTINCT vendor_name FROM (
                            SELECT vendor_name FROM vendors WHERE LOWER(TRIM(category)) = ? AND vendor_name IS NOT NULL AND TRIM(vendor_name) != ''
                            UNION
                            SELECT person_name as vendor_name FROM finance_transactions WHERE LOWER(TRIM(category)) = ? AND person_name IS NOT NULL AND TRIM(person_name) != ''
                        ) combined_vendors ORDER BY vendor_name ASC
                    ");
                    $stmt->execute([$catLower, $catLower]);
                } else {
                    $stmt = $this->conn->prepare("
                        SELECT DISTINCT vendor_name FROM (
                            SELECT vendor_name FROM vendors WHERE (LOWER(TRIM(category)) = 'vendor quta' OR LOWER(TRIM(category)) = 'vendor' OR category IS NULL OR TRIM(category) = '' OR category = 'General') AND vendor_name IS NOT NULL AND TRIM(vendor_name) != ''
                            UNION
                            SELECT vendor as vendor_name FROM project_inventory WHERE vendor IS NOT NULL AND TRIM(vendor) != ''
                        ) combined_vendors ORDER BY vendor_name ASC
                    ");
                    $stmt->execute();
                }
            } else {
                $stmt = $this->conn->prepare("
                    SELECT DISTINCT vendor_name FROM (
                        SELECT vendor_name FROM vendors WHERE vendor_name IS NOT NULL AND TRIM(vendor_name) != ''
                        UNION
                        SELECT vendor as vendor_name FROM project_inventory WHERE vendor IS NOT NULL AND TRIM(vendor) != ''
                        UNION
                        SELECT person_name as vendor_name FROM finance_transactions WHERE person_name IS NOT NULL AND TRIM(person_name) != ''
                    ) combined_vendors ORDER BY vendor_name ASC
                ");
                $stmt->execute();
            }

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
                        ft.payment_mode as remLivincarts
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
        $vendor = $data['vendor'] ?? $data['vendor_name'] ?? '';
        $user_id = $data['user_id'] ?? 1;
        $category = $data['category'] ?? 'General';
        $contact_person = $data['contact_person'] ?? '';
        $phone = $data['phone'] ?? '';
        $email = $data['email'] ?? '';
        $address = $data['address'] ?? '';
        $gst_number = $data['gst_number'] ?? '';
        $aadhar_number = $data['aadhar_number'] ?? '';
        $aadhar_file = $data['aadhar_file'] ?? '';
        $pan_number = $data['pan_number'] ?? '';
        $pan_file = $data['pan_file'] ?? '';
        
        // Multiple Photos & Documents
        $photos = $data['photos'] ?? $data['documents'] ?? [];
        if (is_string($photos)) {
            $decoded = json_decode($photos, true);
            if (is_array($decoded)) $photos = $decoded;
            else if (!empty($photos)) $photos = [$photos];
            else $photos = [];
        }
        if (!is_array($photos)) $photos = [];
        $singlePhoto = $data['photo'] ?? '';
        if (!empty($singlePhoto) && !in_array($singlePhoto, $photos)) {
            array_unshift($photos, $singlePhoto);
        }
        $primaryPhoto = !empty($photos) ? $photos[0] : $singlePhoto;
        $documentsJson = json_encode($photos);

        // Bank Details
        $bank_name = trim($data['bank_name'] ?? '');
        $account_number = trim($data['account_number'] ?? '');
        $ifsc_code = trim($data['ifsc_code'] ?? '');
        $account_holder = trim($data['account_holder'] ?? '');
        $upi_id = trim($data['upi_id'] ?? '');
        $bank_file = $data['bank_file'] ?? null;
        $bank_details_json = json_encode([
            'bank_name' => $bank_name,
            'account_number' => $account_number,
            'ifsc_code' => $ifsc_code,
            'account_holder' => $account_holder,
            'upi_id' => $upi_id,
            'bank_file' => $bank_file
        ]);

        if ($vendor == '') {
            return ["status" => "error", "message" => "Vendor name required"];
        }

        try {
            // check duplicate
            $check = $this->conn->prepare("SELECT vendor_id FROM vendors WHERE vendor_name = ?");
            $check->execute([$vendor]);
            if ($check->rowCount() > 0) {
                return ["status" => "error", "message" => "Vendor profile with this name already exists"];
            }

            $catLower = strtolower(trim($category));
            $prefix = 'LC-VND-2026';
            $padLen = 4;
            if (strpos($catLower, 'transport') !== false) {
                $prefix = 'LC-TRN-2026';
                $padLen = 3;
            } elseif (strpos($catLower, 'labor') !== false || strpos($catLower, 'labour') !== false) {
                $prefix = 'LC-LAB-2026';
                $padLen = 3;
            } elseif (strpos($catLower, 'misc') !== false) {
                $prefix = 'LC-MISC-2026';
                $padLen = 3;
            }

            $stmtCount = $this->conn->prepare("SELECT COUNT(*) as total FROM vendors WHERE LOWER(TRIM(category)) = ?");
            $stmtCount->execute([$catLower]);
            $totalCat = $stmtCount ? intval($stmtCount->fetch(PDO::FETCH_ASSOC)['total'] ?? 0) : 0;
            $nextNum = $totalCat + 1;

            $code = $prefix . "-" . str_pad($nextNum, $padLen, '0', STR_PAD_LEFT);
            $sql = "INSERT INTO vendors (
                        vendor_name, vendor_code, status, category, contact_person, phone, email, address, 
                        gst_number, aadhar_number, aadhar_file, pan_number, pan_file, photo, documents, 
                        bank_name, account_number, ifsc_code, account_holder, upi_id, bank_file, bank_details, created_by
                    ) VALUES (?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
            
            $stmt = $this->conn->prepare($sql);
            if ($stmt->execute([
                $vendor, $code, $category, $contact_person, $phone, $email, $address, 
                $gst_number, $aadhar_number, $aadhar_file, $pan_number, $pan_file, $primaryPhoto, $documentsJson,
                $bank_name, $account_number, $ifsc_code, $account_holder, $upi_id, $bank_file, $bank_details_json, $user_id
            ])) {
                return ["status" => "success", "message" => "Vendor profile created successfully"];
            } else {
                return ["status" => "error", "message" => "Insert failed"];
            }
        } catch (PDOException $e) {
            return ["status" => "error", "message" => "Database Error: " . $e->getMessage()];
        }
    }

    public function getGlobalData() {
        try {
            $response = [
                'vendor_quta' => [],
                'transport' => [],
                'labor' => [],
                'miscellaneous' => [],
                'balance_sheet' => []
            ];

            // 1. Vendor Quta (from project_inventory - grouped by vendor + invoice)
            $stmt1 = $this->conn->query("SELECT pi.*, COALESCE(p.project_name, 'General Site') as site, p.project_type, p.client_id FROM project_inventory pi LEFT JOIN projects p ON pi.project_id = p.project_id ORDER BY pi.invoice_date DESC");
            $inventory = $stmt1->fetchAll(PDO::FETCH_ASSOC);
            
            // First, calculate invoice totals per vendor + invoice_no + project_id
            $invoiceTotals = [];
            foreach ($inventory as $row) {
                $v = $row['vendor'] ? trim($row['vendor']) : 'Unknown Vendor';
                $invoiceNo = $row['invoice_no'] ? trim($row['invoice_no']) : 'No Invoice';
                $projectId = $row['project_id'] ? $row['project_id'] : '0';
                $key = $v . '|' . $invoiceNo . '|' . $projectId;
                
                if (!isset($invoiceTotals[$key])) {
                    $invoiceTotals[$key] = [
                        'vendor' => $v,
                        'invoice_no' => $invoiceNo,
                        'project_id' => $projectId,
                        'invoice_total' => 0,
                        'total_paid' => 0
                    ];
                }
                $invoiceTotals[$key]['invoice_total'] += floatval($row['total']);
                $invoiceTotals[$key]['total_paid'] += floatval($row['paid'] ?? 0);
            }
            
            // Now group by vendor and add invoice total to each item
            $groupedInventory = [];
            foreach ($inventory as $row) {
                $v = $row['vendor'] ? trim($row['vendor']) : 'Unknown Vendor';
                $invoiceNo = $row['invoice_no'] ? trim($row['invoice_no']) : 'No Invoice';
                $projectId = $row['project_id'] ? $row['project_id'] : '0';
                $key = $v . '|' . $invoiceNo . '|' . $projectId;
                
                // Add invoice_total to each row
                $row['invoice_total'] = $invoiceTotals[$key]['invoice_total'];
                
                if (!isset($groupedInventory[$v])) {
                    $groupedInventory[$v] = ['vendor_name' => $v, 'items' => [], 'total_amount' => 0];
                }
                $groupedInventory[$v]['items'][] = $row;
                $groupedInventory[$v]['total_amount'] += floatval($row['total']);
            }

            // 2. Finance categories
            $stmt2 = $this->conn->query("SELECT ft.*, COALESCE(p.project_name, 'General Site') as site, p.project_type, p.client_id FROM finance_transactions ft LEFT JOIN projects p ON ft.project_id = p.project_id WHERE ft.category IN ('Transport', 'Labor', 'Miscellaneous')");
            $transactions = $stmt2->fetchAll(PDO::FETCH_ASSOC);
            
            $groupedTransport = [];
            $groupedLabor = [];
            $groupedMisc = [];

            foreach ($transactions as $t) {
                $name = $t['person_name'] ? trim($t['person_name']) : 'Unknown';
                $cat = strtolower(trim($t['category']));
                
                if ($cat == 'transport') {
                    if (!isset($groupedTransport[$name])) $groupedTransport[$name] = ['person_name' => $name, 'transactions' => [], 'total_payment' => 0];
                    $groupedTransport[$name]['transactions'][] = $t;
                    $groupedTransport[$name]['total_payment'] += floatval($t['amount'] ?? 0);
                } elseif ($cat == 'labor') {
                    if (!isset($groupedLabor[$name])) $groupedLabor[$name] = ['person_name' => $name, 'transactions' => [], 'total_payment' => 0];
                    $groupedLabor[$name]['transactions'][] = $t;
                    $groupedLabor[$name]['total_payment'] += floatval($t['amount'] ?? 0);
                } elseif ($cat == 'miscellaneous') {
                    if (!isset($groupedMisc[$name])) $groupedMisc[$name] = ['person_name' => $name, 'transactions' => [], 'total_payment' => 0];
                    $groupedMisc[$name]['transactions'][] = $t;
                    $groupedMisc[$name]['total_payment'] += floatval($t['amount'] ?? 0);
                }
            }

            // 3. Include registered vendors from vendors table into respective categories
            $registeredVendors = $this->conn->query("SELECT * FROM vendors ORDER BY vendor_name ASC")->fetchAll(PDO::FETCH_ASSOC);
            $vendorMap = [];
            foreach ($registeredVendors as $vRow) {
                $vendorMap[trim($vRow['vendor_name'])] = $vRow;
            }

            // Attach vendor details if matching
            foreach ($groupedInventory as $vName => &$vGroup) {
                if (isset($vendorMap[$vName])) $vGroup['details'] = $vendorMap[$vName];
            }
            unset($vGroup);

            foreach ($groupedTransport as $vName => &$vGroup) {
                if (isset($vendorMap[$vName])) $vGroup['details'] = $vendorMap[$vName];
            }
            unset($vGroup);

            foreach ($groupedLabor as $vName => &$vGroup) {
                if (isset($vendorMap[$vName])) $vGroup['details'] = $vendorMap[$vName];
            }
            unset($vGroup);

            foreach ($groupedMisc as $vName => &$vGroup) {
                if (isset($vendorMap[$vName])) $vGroup['details'] = $vendorMap[$vName];
            }
            unset($vGroup);

            // Add empty vendor profiles to their appropriate tab based on category
            foreach ($registeredVendors as $vRow) {
                $rvClean = trim($vRow['vendor_name']);
                if (empty($rvClean)) continue;

                $catLower = strtolower(trim($vRow['category'] ?? ''));
                if ($catLower === 'transport') {
                    if (!isset($groupedTransport[$rvClean])) {
                        $groupedTransport[$rvClean] = ['person_name' => $rvClean, 'details' => $vRow, 'transactions' => [], 'total_payment' => 0];
                    }
                } elseif ($catLower === 'labor') {
                    if (!isset($groupedLabor[$rvClean])) {
                        $groupedLabor[$rvClean] = ['person_name' => $rvClean, 'details' => $vRow, 'transactions' => [], 'total_payment' => 0];
                    }
                } elseif ($catLower === 'miscellaneous') {
                    if (!isset($groupedMisc[$rvClean])) {
                        $groupedMisc[$rvClean] = ['person_name' => $rvClean, 'details' => $vRow, 'transactions' => [], 'total_payment' => 0];
                    }
                } else {
                    if (!isset($groupedInventory[$rvClean])) {
                        $groupedInventory[$rvClean] = ['vendor_name' => $rvClean, 'details' => $vRow, 'items' => [], 'total_amount' => 0];
                    }
                }
            }

            // Also compile complete vendor list for Vendor Data tab
            $allVendorProfiles = $registeredVendors;
            $knownVendors = [];
            foreach ($registeredVendors as $rv) {
                $knownVendors[strtolower(trim($rv['vendor_name']))] = true;
            }

            foreach ($groupedInventory as $vName => $vData) {
                $cleanName = trim($vName);
                if (!empty($cleanName) && !isset($knownVendors[strtolower($cleanName)])) {
                    $allVendorProfiles[] = [
                        'vendor_id' => null,
                        'vendor_name' => $cleanName,
                        'vendor_code' => '',
                        'category' => 'Material Vendor',
                        'contact_person' => '',
                        'phone' => '',
                        'email' => '',
                        'address' => '',
                        'gst_number' => '',
                        'aadhar_number' => '',
                        'aadhar_file' => null,
                        'pan_number' => '',
                        'pan_file' => null,
                        'photo' => null,
                        'documents' => null,
                        'bank_name' => '',
                        'account_number' => '',
                        'ifsc_code' => '',
                        'account_holder' => '',
                        'upi_id' => '',
                        'bank_file' => null,
                        'status' => 'active'
                    ];
                    $knownVendors[strtolower($cleanName)] = true;
                }
            }

            foreach ($groupedTransport as $vName => $vData) {
                $cleanName = trim($vName);
                if (!empty($cleanName) && !isset($knownVendors[strtolower($cleanName)])) {
                    $allVendorProfiles[] = [
                        'vendor_id' => null,
                        'vendor_name' => $cleanName,
                        'vendor_code' => '',
                        'category' => 'Transport',
                        'contact_person' => '',
                        'phone' => '',
                        'email' => '',
                        'address' => '',
                        'gst_number' => '',
                        'aadhar_number' => '',
                        'aadhar_file' => null,
                        'pan_number' => '',
                        'pan_file' => null,
                        'photo' => null,
                        'status' => 'active'
                    ];
                    $knownVendors[strtolower($cleanName)] = true;
                }
            }

            foreach ($groupedLabor as $vName => $vData) {
                $cleanName = trim($vName);
                if (!empty($cleanName) && !isset($knownVendors[strtolower($cleanName)])) {
                    $allVendorProfiles[] = [
                        'vendor_id' => null,
                        'vendor_name' => $cleanName,
                        'vendor_code' => '',
                        'category' => 'Labour',
                        'contact_person' => '',
                        'phone' => '',
                        'email' => '',
                        'address' => '',
                        'gst_number' => '',
                        'aadhar_number' => '',
                        'aadhar_file' => null,
                        'pan_number' => '',
                        'pan_file' => null,
                        'photo' => null,
                        'status' => 'active'
                    ];
                    $knownVendors[strtolower($cleanName)] = true;
                }
            }

            foreach ($groupedMisc as $vName => $vData) {
                $cleanName = trim($vName);
                if (!empty($cleanName) && !isset($knownVendors[strtolower($cleanName)])) {
                    $allVendorProfiles[] = [
                        'vendor_id' => null,
                        'vendor_name' => $cleanName,
                        'vendor_code' => '',
                        'category' => 'Miscellaneous',
                        'contact_person' => '',
                        'phone' => '',
                        'email' => '',
                        'address' => '',
                        'gst_number' => '',
                        'aadhar_number' => '',
                        'aadhar_file' => null,
                        'pan_number' => '',
                        'pan_file' => null,
                        'photo' => null,
                        'status' => 'active'
                    ];
                    $knownVendors[strtolower($cleanName)] = true;
                }
            }

            $response['vendor_quta'] = array_values($groupedInventory);
            $response['transport'] = array_values($groupedTransport);
            $response['labor'] = array_values($groupedLabor);
            $response['miscellaneous'] = array_values($groupedMisc);
            $response['registered_vendors'] = $allVendorProfiles;
            
            return ["success" => true, "data" => $response];
        } catch (PDOException $e) {
            return ["success" => false, "message" => "Database Error: " . $e->getMessage()];
        }
    }

    public function updatePayment($data) {
        try {
            $id = $data['id'] ?? null;
            $payment_date = $data['payment_date'] ?? null;
            $payment_amount = $data['payment_amount'] ?? null;
            $payment_mode = $data['payment_mode'] ?? null;
            $remLivincart = $data['remLivincart'] ?? null;

            if (!$id) {
                return ["success" => false, "message" => "ID is required"];
            }

            // Add remLivincart column if it doesn't exist
            try {
                $this->conn->exec("ALTER TABLE project_inventory ADD COLUMN remLivincart TEXT DEFAULT NULL AFTER payment_date");
            } catch (PDOException $e) {
                // Column already exists, ignore error
            }

            // If updating payment_amount, fetch total to update unpaid and payment_status
            if ($payment_amount !== null) {
                $stmt = $this->conn->prepare("SELECT total FROM project_inventory WHERE id = :id");
                $stmt->execute([':id' => $id]);
                $item = $stmt->fetch(PDO::FETCH_ASSOC);
                
                if ($item) {
                    $total = floatval($item['total']);
                    $paid = floatval($payment_amount);
                    $unpaid = max(0.0, $total - $paid);
                    $status = ($paid >= $total) ? 'Paid' : 'Unpaid';
                }
            }

            // Build update query dynamically based on provided fields
            $updateFields = [];
            $params = [':id' => $id];

            if ($payment_date !== null) {
                $updateFields[] = "payment_date = :payment_date";
                $params[':payment_date'] = $payment_date;
            }
            if ($payment_amount !== null) {
                $updateFields[] = "paid = :payment_amount";
                $params[':payment_amount'] = $payment_amount;
                
                if (isset($unpaid) && isset($status)) {
                    $updateFields[] = "unpaid = :unpaid";
                    $params[':unpaid'] = $unpaid;
                    $updateFields[] = "payment_status = :status";
                    $params[':status'] = $status;
                }
            }
            if ($payment_mode !== null) {
                $updateFields[] = "payment_mode = :payment_mode";
                $params[':payment_mode'] = $payment_mode;
            }
            if ($remLivincart !== null) {
                $updateFields[] = "remLivincart = :remLivincart";
                $params[':remLivincart'] = $remLivincart;
            }

            if (!empty($updateFields)) {
                $query = "UPDATE project_inventory SET " . implode(", ", $updateFields) . " WHERE id = :id";
                $stmt = $this->conn->prepare($query);
                if ($stmt->execute($params)) {
                    return ["success" => true, "message" => "Payment details updated successfully"];
                }
            }
            
            return ["success" => false, "message" => "No changes made"];
        } catch (PDOException $e) {
            return ["success" => false, "message" => "Database error: " . $e->getMessage()];
        }
    }

    public function processPaymentApproval($data) {
        $action = $data['action'] ?? null; // requested, approved, rejected
        $category = $data['category'] ?? 'Material / Vendor';
        $amount = $data['amount'] ?? 0;
        $vendorName = $data['vendor_name'] ?? 'Vendor';
        $description = $data['description'] ?? 'Payment Request';
        $dueDate = $data['due_date'] ?? date('d M Y');
        $reason = $data['reason'] ?? '';

        if (!in_array($action, ['requested', 'approved', 'rejected'])) {
            return ["success" => false, "message" => "Invalid action"];
        }

        try {
            require_once __DIR__ . '/../helpers/MailHelper.php';
            $mailData = [
                'category' => $category,
                'amount' => $amount,
                'vendor_name' => $vendorName,
                'description' => $description,
                'due_date' => $dueDate,
                'reason' => $reason
            ];
            
            $mailSent = MailHelper::sendPaymentApprovalNotification($this->conn, $action, $mailData);
            
            return ["success" => true, "message" => "Payment approval action processed.", "mail_sent" => $mailSent];
        } catch (Exception $e) {
            return ["success" => false, "message" => "Error processing payment approval: " . $e->getMessage()];
        }
    }

    public function deleteInventoryItem($data) {
        try {
            $id = $data['id'] ?? null;

            if (!$id) {
                return ["success" => false, "message" => "ID is required"];
            }

            $stmt = $this->conn->prepare("DELETE FROM project_inventory WHERE id = :id");
            $stmt->execute([':id' => $id]);

            return ["success" => true, "message" => "Item deleted successfully"];
        } catch (PDOException $e) {
            return ["success" => false, "message" => "Database Error: " . $e->getMessage()];
        }
    }

    public function updateProfile($data) {
        $vendor_id = $data['vendor_id'] ?? null;
        $vendor_name = $data['vendor_name'] ?? $data['vendor'] ?? null;
        $category = $data['category'] ?? null;
        $contact_person = $data['contact_person'] ?? '';
        $phone = $data['phone'] ?? '';
        $email = $data['email'] ?? '';
        $address = $data['address'] ?? '';
        $gst_number = $data['gst_number'] ?? '';
        $aadhar_number = $data['aadhar_number'] ?? '';
        $aadhar_file = $data['aadhar_file'] ?? null;
        $pan_number = $data['pan_number'] ?? '';
        $pan_file = $data['pan_file'] ?? null;
        $photo = $data['photo'] ?? null;

        // Multiple Photos & Documents
        $photos = $data['photos'] ?? $data['documents'] ?? null;
        $documentsJson = null;
        if ($photos !== null) {
            if (is_string($photos)) {
                $decoded = json_decode($photos, true);
                if (is_array($decoded)) {
                    $documentsJson = $photos;
                    if ($photo === null && count($decoded) > 0) {
                        $photo = $decoded[0];
                    }
                } else if (!empty($photos)) {
                    $documentsJson = json_encode([$photos]);
                    if ($photo === null) $photo = $photos;
                } else {
                    $documentsJson = json_encode([]);
                }
            } else if (is_array($photos)) {
                $documentsJson = json_encode($photos);
                if ($photo === null && count($photos) > 0) {
                    $photo = $photos[0];
                }
            }
        }

        // Bank Details
        $bank_name = isset($data['bank_name']) ? trim($data['bank_name']) : null;
        $account_number = isset($data['account_number']) ? trim($data['account_number']) : null;
        $ifsc_code = isset($data['ifsc_code']) ? trim($data['ifsc_code']) : null;
        $account_holder = isset($data['account_holder']) ? trim($data['account_holder']) : null;
        $upi_id = isset($data['upi_id']) ? trim($data['upi_id']) : null;
        $bank_file = $data['bank_file'] ?? null;

        if (!$vendor_id && !$vendor_name) {
            return ["status" => "error", "message" => "Vendor ID or name required"];
        }

        try {
            if ($vendor_id) {
                $stmt = $this->conn->prepare("SELECT * FROM vendors WHERE vendor_id = ?");
                $stmt->execute([$vendor_id]);
            } else {
                $stmt = $this->conn->prepare("SELECT * FROM vendors WHERE vendor_name = ?");
                $stmt->execute([$vendor_name]);
            }
            $existing = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$existing) {
                return $this->create($data);
            }

            $vId = $existing['vendor_id'];
            $oldVendorName = $existing['vendor_name'];
            $newVendorName = !empty($vendor_name) ? $vendor_name : $oldVendorName;

            $updateFields = [
                "vendor_name = ?",
                "contact_person = ?",
                "phone = ?",
                "email = ?",
                "address = ?",
                "gst_number = ?",
                "aadhar_number = ?",
                "pan_number = ?"
            ];
            $params = [
                $newVendorName,
                $contact_person,
                $phone,
                $email,
                $address,
                $gst_number,
                $aadhar_number,
                $pan_number
            ];

            if ($category !== null) {
                $updateFields[] = "category = ?";
                $params[] = $category;
            }

            if (isset($data['status']) && !empty($data['status'])) {
                $updateFields[] = "status = ?";
                $params[] = $data['status'];
            }

            if ($aadhar_file !== null) {
                $updateFields[] = "aadhar_file = ?";
                $params[] = $aadhar_file;
            }
            if ($pan_file !== null) {
                $updateFields[] = "pan_file = ?";
                $params[] = $pan_file;
            }
            if ($photo !== null) {
                $updateFields[] = "photo = ?";
                $params[] = $photo;
            }
            if ($documentsJson !== null) {
                $updateFields[] = "documents = ?";
                $params[] = $documentsJson;
            }

            if ($bank_name !== null) {
                $updateFields[] = "bank_name = ?";
                $params[] = $bank_name;
            }
            if ($account_number !== null) {
                $updateFields[] = "account_number = ?";
                $params[] = $account_number;
            }
            if ($ifsc_code !== null) {
                $updateFields[] = "ifsc_code = ?";
                $params[] = $ifsc_code;
            }
            if ($account_holder !== null) {
                $updateFields[] = "account_holder = ?";
                $params[] = $account_holder;
            }
            if ($upi_id !== null) {
                $updateFields[] = "upi_id = ?";
                $params[] = $upi_id;
            }
            if ($bank_file !== null) {
                $updateFields[] = "bank_file = ?";
                $params[] = $bank_file;
            }

            // Also keep bank_details json synchronized
            $mergedBankDetails = [
                'bank_name' => $bank_name !== null ? $bank_name : ($existing['bank_name'] ?? ''),
                'account_number' => $account_number !== null ? $account_number : ($existing['account_number'] ?? ''),
                'ifsc_code' => $ifsc_code !== null ? $ifsc_code : ($existing['ifsc_code'] ?? ''),
                'account_holder' => $account_holder !== null ? $account_holder : ($existing['account_holder'] ?? ''),
                'upi_id' => $upi_id !== null ? $upi_id : ($existing['upi_id'] ?? ''),
                'bank_file' => $bank_file !== null ? $bank_file : ($existing['bank_file'] ?? null)
            ];
            $updateFields[] = "bank_details = ?";
            $params[] = json_encode($mergedBankDetails);

            $params[] = $vId;

            $sql = "UPDATE vendors SET " . implode(", ", $updateFields) . " WHERE vendor_id = ?";
            $uStmt = $this->conn->prepare($sql);
            $uStmt->execute($params);

            if ($newVendorName !== $oldVendorName) {
                $invStmt = $this->conn->prepare("UPDATE project_inventory SET vendor = ? WHERE vendor = ?");
                $invStmt->execute([$newVendorName, $oldVendorName]);
            }

            return ["status" => "success", "message" => "Vendor profile updated successfully"];
        } catch (PDOException $e) {
            return ["status" => "error", "message" => "Database error: " . $e->getMessage()];
        }
    }

    public function toggleStatus($data) {
        $vendor_id = $data['vendor_id'] ?? $data['id'] ?? null;
        $vendor_name = $data['vendor_name'] ?? null;
        $status = $data['status'] ?? null;

        if (!$vendor_id && !$vendor_name) {
            return ["status" => "error", "message" => "Vendor ID or Name required"];
        }

        try {
            if ($vendor_id) {
                if ($status) {
                    $stmt = $this->conn->prepare("UPDATE vendors SET status = ? WHERE vendor_id = ?");
                    $stmt->execute([$status, $vendor_id]);
                } else {
                    $stmt = $this->conn->prepare("UPDATE vendors SET status = CASE WHEN status = 'inactive' THEN 'active' ELSE 'inactive' END WHERE vendor_id = ?");
                    $stmt->execute([$vendor_id]);
                }
            } else if ($vendor_name) {
                if ($status) {
                    $stmt = $this->conn->prepare("UPDATE vendors SET status = ? WHERE vendor_name = ?");
                    $stmt->execute([$status, $vendor_name]);
                } else {
                    $stmt = $this->conn->prepare("UPDATE vendors SET status = CASE WHEN status = 'inactive' THEN 'active' ELSE 'inactive' END WHERE vendor_name = ?");
                    $stmt->execute([$vendor_name]);
                }
            }

            return ["status" => "success", "message" => "Vendor status updated successfully"];
        } catch (PDOException $e) {
            return ["status" => "error", "message" => "Database error: " . $e->getMessage()];
        }
    }

    public function deleteVendor($data) {
        $vendor_id = is_array($data) ? ($data['vendor_id'] ?? $data['id'] ?? null) : $data;
        $vendor_name = is_array($data) ? ($data['vendor_name'] ?? null) : null;

        if (!$vendor_id && !$vendor_name) {
            return ["status" => "error", "message" => "Vendor ID or Name required for deletion"];
        }

        try {
            if ($vendor_id) {
                $stmt = $this->conn->prepare("DELETE FROM vendors WHERE vendor_id = ?");
                $stmt->execute([$vendor_id]);
            } else if ($vendor_name) {
                $stmt = $this->conn->prepare("DELETE FROM vendors WHERE vendor_name = ?");
                $stmt->execute([$vendor_name]);
            }

            return ["status" => "success", "message" => "Vendor profile deleted successfully"];
        } catch (PDOException $e) {
            return ["status" => "error", "message" => "Database error: " . $e->getMessage()];
        }
    }
}

