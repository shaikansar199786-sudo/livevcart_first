<?php
// api/controllers/VendorQuotaController.php

class VendorQuotaController {
    private $db;
    private $conn;

    public function __construct() {
        $this->db = new Database();
        $this->conn = $this->db->getConnection();
    }

    public function getVendorQuotas() {
        try {
            $this->ensureTablesExist();

            // Ensure main_vendors table exists
            try {
                $this->conn->exec("CREATE TABLE IF NOT EXISTS main_vendors (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    vendor_name VARCHAR(255) NOT NULL,
                    category VARCHAR(100) DEFAULT 'Main Vendor',
                    contact_person VARCHAR(255) DEFAULT NULL,
                    phone VARCHAR(100) DEFAULT NULL,
                    email VARCHAR(255) DEFAULT NULL,
                    address TEXT DEFAULT NULL,
                    gst_number VARCHAR(100) DEFAULT NULL,
                    pan_number VARCHAR(100) DEFAULT NULL,
                    pan_file LONGTEXT DEFAULT NULL,
                    aadhar_number VARCHAR(100) DEFAULT NULL,
                    aadhar_file LONGTEXT DEFAULT NULL,
                    photo LONGTEXT DEFAULT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
            } catch (Exception $e) {}

            // Pull registered vendors strictly from main_vendors table
            $regStmt = $this->conn->query("SELECT DISTINCT vendor_name, phone, email, address, category as vendor_type, created_at, photo, gst_number, pan_number, aadhar_number FROM main_vendors WHERE vendor_name IS NOT NULL AND TRIM(vendor_name) != '' ORDER BY vendor_name ASC");
            $registeredVendors = $regStmt->fetchAll(PDO::FETCH_ASSOC);

            $invStmt = $this->conn->query("SELECT DISTINCT vendor as vendor_name FROM project_inventory WHERE vendor IS NOT NULL AND TRIM(vendor) != ''");
            $invVendors = $invStmt->fetchAll(PDO::FETCH_ASSOC);

            $finStmt = $this->conn->query("SELECT DISTINCT person_name as vendor_name FROM finance_transactions WHERE person_name IS NOT NULL AND TRIM(person_name) != ''");
            $finVendors = $finStmt->fetchAll(PDO::FETCH_ASSOC);

            $vqVendorsStmt = $this->conn->query("SELECT DISTINCT vendor_name FROM vendor_quotations WHERE vendor_name IS NOT NULL AND TRIM(vendor_name) != ''");
            $vqVendors = $vqVendorsStmt->fetchAll(PDO::FETCH_ASSOC);

            // Fetch all projects for dropdown list
            $allProjectsStmt = $this->conn->query("SELECT project_id, project_name, client_id, project_type FROM projects ORDER BY project_name ASC");
            $allProjectsList = $allProjectsStmt->fetchAll(PDO::FETCH_ASSOC);

            // Fetch vendor-project links from created vendor_quotations
            $vqProjectsStmt = $this->conn->query("
                SELECT vq.vendor_name as vendor, vq.project_id, COALESCE(p.project_name, CONCAT('Project ', vq.project_id)) as project_name, p.client_id, p.project_type, COUNT(vq.id) as item_count, SUM(vq.total_amount) as total_amount
                FROM vendor_quotations vq
                LEFT JOIN projects p ON vq.project_id = p.project_id
                WHERE vq.vendor_name IS NOT NULL AND TRIM(vq.vendor_name) != ''
                GROUP BY vq.vendor_name, vq.project_id
            ");
            $vqProjects = $vqProjectsStmt->fetchAll(PDO::FETCH_ASSOC);

            // Fetch vendor-project links from inventory
            $invProjectsStmt = $this->conn->query("
                SELECT pi.vendor, pi.project_id, COALESCE(p.project_name, CONCAT('Project ', pi.project_id)) as project_name, p.client_id, p.project_type, COUNT(pi.id) as item_count, SUM(pi.total) as total_amount
                FROM project_inventory pi
                LEFT JOIN projects p ON pi.project_id = p.project_id
                WHERE pi.vendor IS NOT NULL AND TRIM(pi.vendor) != ''
                GROUP BY pi.vendor, pi.project_id
            ");
            $invProjects = $invProjectsStmt->fetchAll(PDO::FETCH_ASSOC);

            // Fetch vendor-project links from finance
            $finProjectsStmt = $this->conn->query("
                SELECT ft.person_name as vendor, ft.project_id, COALESCE(p.project_name, CONCAT('Project ', ft.project_id)) as project_name, p.client_id, p.project_type, COUNT(ft.transaction_id) as item_count, SUM(ft.amount) as total_amount
                FROM finance_transactions ft
                LEFT JOIN projects p ON ft.project_id = p.project_id
                WHERE ft.person_name IS NOT NULL AND TRIM(ft.person_name) != ''
                GROUP BY ft.person_name, ft.project_id
            ");
            $finProjects = $finProjectsStmt->fetchAll(PDO::FETCH_ASSOC);

            $vendorMap = [];

            // Helper to clean vendor categories
            $formatVendorCategory = function($cat, $default = 'Material Vendor') {
                if (empty($cat)) return $default;
                $trimmed = trim($cat);
                if (strcasecmp($trimmed, 'Vendor Quta') === 0 || strcasecmp($trimmed, 'General') === 0) {
                    return 'Material Vendor';
                }
                if (strcasecmp($trimmed, 'Service Vendor') === 0) {
                    return 'Labor / Service Vendor';
                }
                return $trimmed;
            };

            // 1. Add registered vendors
            foreach ($registeredVendors as $rv) {
                $name = trim($rv['vendor_name']);
                if (empty($name)) continue;
                $vendorMap[$name] = [
                    'vendor_name' => $name,
                    'phone' => $rv['phone'] ?? '',
                    'email' => $rv['email'] ?? '',
                    'address' => $rv['address'] ?? '',
                    'vendor_type' => $formatVendorCategory($rv['vendor_type'] ?? '', 'Material Vendor'),
                    'created_at' => $rv['created_at'] ?? null,
                    'projects' => []
                ];
            }

            // 2. Add inventory vendors
            foreach ($invVendors as $iv) {
                $name = trim($iv['vendor_name']);
                if (empty($name)) continue;
                if (!isset($vendorMap[$name])) {
                    $vendorMap[$name] = [
                        'vendor_name' => $name,
                        'phone' => '', 'email' => '', 'address' => '', 'vendor_type' => 'Material Vendor',
                        'created_at' => null,
                        'projects' => []
                    ];
                }
            }

            // 3. Add finance vendors
            foreach ($finVendors as $fv) {
                $name = trim($fv['vendor_name']);
                if (empty($name)) continue;
                if (!isset($vendorMap[$name])) {
                    $vendorMap[$name] = [
                        'vendor_name' => $name,
                        'phone' => '', 'email' => '', 'address' => '', 'vendor_type' => 'Labor / Service Vendor',
                        'created_at' => null,
                        'projects' => []
                    ];
                }
            }

            // 4. Add quota vendors
            foreach ($vqVendors as $vqv) {
                $name = trim($vqv['vendor_name']);
                if (empty($name)) continue;
                if (!isset($vendorMap[$name])) {
                    $vendorMap[$name] = [
                        'vendor_name' => $name,
                        'phone' => '', 'email' => '', 'address' => '', 'vendor_type' => 'Material Vendor',
                        'created_at' => null,
                        'projects' => []
                    ];
                }
            }

            // Map vendor_quotations project links FIRST (so created quotas appear at top)
            foreach ($vqProjects as $vqp) {
                $name = trim($vqp['vendor']);
                if (isset($vendorMap[$name])) {
                    $vendorMap[$name]['projects'][] = [
                        'project_id' => $vqp['project_id'],
                        'project_name' => $vqp['project_name'],
                        'client_id' => $vqp['client_id'] ?? $vqp['project_id'],
                        'project_type' => $vqp['project_type'] ?? 'Interior Project',
                        'item_count' => intval($vqp['item_count']),
                        'total_amount' => floatval($vqp['total_amount']),
                        'is_created_quota' => true
                    ];
                }
            }

            // Map project inventory links
            foreach ($invProjects as $ip) {
                $name = trim($ip['vendor']);
                if (isset($vendorMap[$name])) {
                    $exists = false;
                    foreach ($vendorMap[$name]['projects'] as &$pr) {
                        if (strval($pr['project_id']) === strval($ip['project_id'])) {
                            $pr['total_amount'] += floatval($ip['total_amount']);
                            $pr['item_count'] += intval($ip['item_count']);
                            $exists = true;
                            break;
                        }
                    }
                    if (!$exists) {
                        $vendorMap[$name]['projects'][] = [
                            'project_id' => $ip['project_id'],
                            'project_name' => $ip['project_name'],
                            'client_id' => $ip['client_id'] ?? $ip['project_id'],
                            'project_type' => $ip['project_type'] ?? 'Interior Project',
                            'item_count' => intval($ip['item_count']),
                            'total_amount' => floatval($ip['total_amount'])
                        ];
                    }
                }
            }

            // Map finance project links
            foreach ($finProjects as $fp) {
                $name = trim($fp['vendor']);
                if (isset($vendorMap[$name])) {
                    $exists = false;
                    foreach ($vendorMap[$name]['projects'] as &$pr) {
                        if (strval($pr['project_id']) === strval($fp['project_id'])) {
                            $pr['total_amount'] += floatval($fp['total_amount']);
                            $pr['item_count'] += intval($fp['item_count']);
                            $exists = true;
                            break;
                        }
                    }
                    if (!$exists) {
                        $vendorMap[$name]['projects'][] = [
                            'project_id' => $fp['project_id'],
                            'project_name' => $fp['project_name'],
                            'client_id' => $fp['client_id'] ?? $fp['project_id'],
                            'project_type' => $fp['project_type'] ?? 'Interior Project',
                            'item_count' => intval($fp['item_count']),
                            'total_amount' => floatval($fp['total_amount'])
                        ];
                    }
                }
            }

            // Fallback: If a vendor has no linked/assigned projects yet, show available projects list
            foreach ($vendorMap as &$v) {
                if (empty($v['projects'])) {
                    $v['projects'] = array_map(function($p) {
                        return [
                            'project_id' => $p['project_id'],
                            'project_name' => $p['project_name'],
                            'client_id' => $p['client_id'] ?? $p['project_id'],
                            'project_type' => $p['project_type'] ?? 'Interior Project',
                            'item_count' => 0,
                            'total_amount' => 0.00
                        ];
                    }, $allProjectsList);
                }
            }

            echo json_encode([
                'success' => true,
                'vendors' => array_values($vendorMap)
            ]);

        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
    }

    public function getProjectVendorItems() {
        $vendor = $_GET['vendor'] ?? '';
        $projectId = $_GET['project_id'] ?? '';

        if (empty($projectId)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'project_id is required']);
            return;
        }

        try {
            $this->ensureTablesExist();

            // Fetch saved quotation from vendor_quotations table
            $savedQuote = null;
            if (!empty($vendor)) {
                $vqStmt = $this->conn->prepare("
                    SELECT vq.*, p.project_name, p.client_id, p.project_type
                    FROM vendor_quotations vq
                    LEFT JOIN projects p ON vq.project_id = p.project_id
                    WHERE vq.vendor_name = :vendor AND vq.project_id = :project_id
                    ORDER BY vq.id DESC
                    LIMIT 1
                ");
                $vqStmt->execute([':vendor' => $vendor, ':project_id' => $projectId]);
                $savedQuoteRaw = $vqStmt->fetch(PDO::FETCH_ASSOC);

                if ($savedQuoteRaw) {
                    $itemsData = json_decode($savedQuoteRaw['items_data'] ?? '[]', true);
                    $savedQuote = [
                        'id' => $savedQuoteRaw['id'],
                        'project_id' => $savedQuoteRaw['project_id'],
                        'project_name' => $savedQuoteRaw['project_name'],
                        'vendor_name' => $savedQuoteRaw['vendor_name'],
                        'total_amount' => floatval($savedQuoteRaw['total_amount']),
                        'items_data' => $itemsData,
                        'modules_data' => $savedQuoteRaw['modules_data'] ?? null,
                        'version' => $savedQuoteRaw['version'] ?? 'V1.0',
                        'approval_status' => $savedQuoteRaw['approval_status'] ?? 'Pending Approval',
                        'is_locked' => $savedQuoteRaw['is_locked'] ?? 0,
                        'column_visibility' => $savedQuoteRaw['column_visibility'] ?? null,
                        'created_at' => $savedQuoteRaw['created_at']
                    ];
                }
            }

            // Get inventory items
            $invItems = [];
            if (!empty($vendor)) {
                $stmt1 = $this->conn->prepare("
                    SELECT pi.*, p.project_name, p.client_id, p.project_type
                    FROM project_inventory pi
                    JOIN projects p ON pi.project_id = p.project_id
                    WHERE pi.vendor = :vendor AND pi.project_id = :project_id
                ");
                $stmt1->execute([':vendor' => $vendor, ':project_id' => $projectId]);
                $invItems = $stmt1->fetchAll(PDO::FETCH_ASSOC);
            }

            // Get finance transactions
            $finItems = [];
            if (!empty($vendor)) {
                $stmt2 = $this->conn->prepare("
                    SELECT ft.*, p.project_name, p.client_id, p.project_type
                    FROM finance_transactions ft
                    JOIN projects p ON ft.project_id = p.project_id
                    WHERE ft.person_name = :vendor AND ft.project_id = :project_id
                ");
                $stmt2->execute([':vendor' => $vendor, ':project_id' => $projectId]);
                $finItems = $stmt2->fetchAll(PDO::FETCH_ASSOC);
            }

            // Get Client Quotation (quotes table) items for this project_id
            $clientQuote = null;
            try {
                $cqStmt = $this->conn->prepare("
                    SELECT q.*, p.project_name, p.client_id, p.project_type
                    FROM quotes q
                    LEFT JOIN projects p ON q.project_id = p.project_id
                    WHERE q.project_id = :project_id OR q.quote_id = :project_id
                    ORDER BY q.created_at DESC
                    LIMIT 1
                ");
                $cqStmt->execute([':project_id' => $projectId]);
                $cqRaw = $cqStmt->fetch(PDO::FETCH_ASSOC);

                if ($cqRaw) {
                    $itemsParsed = [];
                    $sectionsParsed = [];
                    if (!empty($cqRaw['extra_data'])) {
                        $exData = json_decode($cqRaw['extra_data'], true);
                        if (isset($exData['sections']) && is_array($exData['sections'])) {
                            $sectionsParsed = $exData['sections'];
                            foreach ($sectionsParsed as $sec) {
                                if (isset($sec['items']) && is_array($sec['items'])) {
                                    foreach ($sec['items'] as $it) {
                                        $itemsParsed[] = array_merge($it, ['category' => $sec['name'] ?? $sec['title'] ?? 'General']);
                                    }
                                }
                            }
                        } else if (isset($exData['items']) && is_array($exData['items'])) {
                            $itemsParsed = $exData['items'];
                        }
                    }

                    // Fallback to quote_sections & quote_items if extra_data is empty
                    if (empty($itemsParsed) && !empty($cqRaw['quote_id'])) {
                        $qiStmt = $this->conn->prepare("
                            SELECT qi.*, qs.section_name as category
                            FROM quote_items qi
                            JOIN quote_sections qs ON qi.section_id = qs.section_id
                            WHERE qs.quote_id = :qid
                            ORDER BY qi.display_order ASC
                        ");
                        $qiStmt->execute([':qid' => $cqRaw['quote_id']]);
                        $itemsParsed = $qiStmt->fetchAll(PDO::FETCH_ASSOC);
                    }

                    $clientQuote = [
                        'quote_id' => $cqRaw['quote_id'] ?? $cqRaw['id'] ?? null,
                        'project_id' => $cqRaw['project_id'],
                        'project_name' => $cqRaw['project_name'] ?? '',
                        'quote_number' => $cqRaw['quote_number'] ?? '',
                        'total_amount' => floatval($cqRaw['total_amount'] ?? 0),
                        'items' => $itemsParsed,
                        'sections' => $sectionsParsed
                    ];
                }
            } catch (Exception $e) {}

            // Fallback: If no vendor-specific inventory items found, fetch project inventory items for this project
            if (empty($invItems) && empty($finItems) && empty($savedQuote)) {
                $fallbackStmt = $this->conn->prepare("
                    SELECT pi.*, p.project_name, p.client_id, p.project_type
                    FROM project_inventory pi
                    JOIN projects p ON pi.project_id = p.project_id
                    WHERE pi.project_id = :project_id
                    LIMIT 20
                ");
                $fallbackStmt->execute([':project_id' => $projectId]);
                $invItems = $fallbackStmt->fetchAll(PDO::FETCH_ASSOC);
            }

            echo json_encode([
                'success' => true,
                'inventory_items' => $invItems,
                'finance_items' => $finItems,
                'saved_quotation' => $savedQuote,
                'client_quote' => $clientQuote
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
    }

    public function saveVendorQuota() {
        $data = json_decode(file_get_contents("php://input"), true);
        if (!$data) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Invalid JSON payload']);
            return;
        }

        $quotasToSave = isset($data['quotas']) && is_array($data['quotas']) ? $data['quotas'] : (isset($data['vendor_name']) ? [$data] : []);

        if (empty($quotasToSave)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Missing vendor_name or project_id']);
            return;
        }

        try {
            $this->ensureTablesExist();

            $this->conn->beginTransaction();

            foreach ($quotasToSave as $qData) {
                if (empty($qData['vendor_name']) || empty($qData['project_id'])) {
                    throw new Exception("Vendor quota item missing vendor_name or project_id");
                }

                $version = $qData['version'] ?? 'V1.0';
                $approval_status = $qData['approval_status'] ?? 'Pending Approval';
                $is_locked = !empty($qData['is_locked']) ? 1 : 0;
                $col_vis = isset($qData['column_visibility']) ? json_encode($qData['column_visibility']) : null;
                $modules_data = isset($qData['modules_data']) ? json_encode($qData['modules_data']) : null;
                $items_data = json_encode($qData['items_data'] ?? []);
                $total_amount = floatval($qData['total_amount'] ?? 0);
                $notes = $qData['notes'] ?? '';

                // Check if existing record exists for vendor & project
                $checkStmt = $this->conn->prepare("SELECT id FROM vendor_quotations WHERE vendor_name = :v AND project_id = :p LIMIT 1");
                $checkStmt->execute([':v' => $qData['vendor_name'], ':p' => $qData['project_id']]);
                $existing = $checkStmt->fetch(PDO::FETCH_ASSOC);

                if ($existing) {
                    $upStmt = $this->conn->prepare("
                        UPDATE vendor_quotations SET
                            total_amount = :total_amount,
                            items_data = :items_data,
                            modules_data = :modules_data,
                            notes = :notes,
                            version = :version,
                            approval_status = :approval_status,
                            is_locked = :is_locked,
                            column_visibility = :column_visibility
                        WHERE id = :id
                    ");
                    $upStmt->execute([
                        ':total_amount' => $total_amount,
                        ':items_data' => $items_data,
                        ':modules_data' => $modules_data,
                        ':notes' => $notes,
                        ':version' => $version,
                        ':approval_status' => $approval_status,
                        ':is_locked' => $is_locked,
                        ':column_visibility' => $col_vis,
                        ':id' => $existing['id']
                    ]);
                    $savedIds[] = $existing['id'];
                } else {
                    $inStmt = $this->conn->prepare("
                        INSERT INTO vendor_quotations 
                        (project_id, vendor_name, total_amount, items_data, modules_data, notes, version, approval_status, is_locked, column_visibility, created_at)
                        VALUES 
                        (:project_id, :vendor_name, :total_amount, :items_data, :modules_data, :notes, :version, :approval_status, :is_locked, :column_visibility, NOW())
                    ");
                    $inStmt->execute([
                        ':project_id' => $qData['project_id'],
                        ':vendor_name' => $qData['vendor_name'],
                        ':total_amount' => $total_amount,
                        ':items_data' => $items_data,
                        ':modules_data' => $modules_data,
                        ':notes' => $notes,
                        ':version' => $version,
                        ':approval_status' => $approval_status,
                        ':is_locked' => $is_locked,
                        ':column_visibility' => $col_vis
                    ]);
                    $savedIds[] = $this->conn->lastInsertId();
                }
            }

            $this->conn->commit();
            echo json_encode(['success' => true, 'ids' => $savedIds, 'count' => count($savedIds)]);
        } catch (Exception $e) {
            if ($this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
    }

    public function sendApprovalNotification() {
        $data = json_decode(file_get_contents("php://input"), true);
        $vendor = $data['vendor_name'] ?? '';
        $projectId = $data['project_id'] ?? '';
        $status = $data['approval_status'] ?? 'Approved';

        $userRole = $_SERVER['HTTP_X_USER_ROLE'] ?? ($data['user_role'] ?? '');
        $userRoleLower = strtolower(trim($userRole));
        $isAdmin = in_array($userRoleLower, ['admin', 'administrator', 'superadmin', 'management', 'owner']) || strpos($userRoleLower, 'admin') !== false;

        if (empty($vendor) || empty($projectId)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Missing vendor_name or project_id']);
            return;
        }

        // STRICT ACCESS CONTROL: Only Admin can approve
        if ($status === 'Approved' && !empty($userRole) && !$isAdmin) {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Access Denied: Only Admin can approve vendor quotations.']);
            return;
        }

        try {
            $this->ensureTablesExist();

            // Update status and lock quota in vendor_quotations
            $isLocked = ($status === 'Approved') ? 1 : 0;
            $stmt = $this->conn->prepare("UPDATE vendor_quotations SET approval_status = :st, is_locked = :lk WHERE vendor_name = :v AND project_id = :p");
            $stmt->execute([':st' => $status, ':lk' => $isLocked, ':v' => $vendor, ':p' => $projectId]);

            // Also synchronize main_vendors status
            try {
                $mvStmt = $this->conn->prepare("UPDATE main_vendors SET status = :st WHERE vendor_name = :v");
                $mvStmt->execute([
                    ':st' => ($status === 'Approved' ? 'APPROVED' : ($status === 'Pending Approval' ? 'PENDING' : $status)),
                    ':v' => $vendor
                ]);
            } catch (Exception $e) {}

            $respMessage = "Vendor Quota updated to '{$status}'.";

            // Create notification entries in the system notifications table
            try {
                $this->conn->exec("CREATE TABLE IF NOT EXISTS notifications (
                    id INT(11) AUTO_INCREMENT PRIMARY KEY,
                    user_id INT(11) NOT NULL,
                    title VARCHAR(255) NOT NULL,
                    message TEXT NOT NULL,
                    type VARCHAR(50) DEFAULT 'info',
                    is_read INT(1) DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

                if ($status === 'Approved') {
                    // Approved strictly by Admin: notify operational staff (Project Manager, Site Manager)
                    $uStmt = $this->conn->prepare("SELECT user_id FROM users WHERE LOWER(role) IN ('project_head', 'project_manager', 'manager', 'site_engineer', 'site_inspection', 'site_inspector')");
                    $uStmt->execute();
                    $targetUsers = $uStmt->fetchAll(PDO::FETCH_ASSOC);

                    $title = "Vendor Quota Approved by Admin";
                    $msg = "Official Work Order Quota for Vendor '{$vendor}' on Project Site '{$projectId}' has been APPROVED by Admin and locked for execution.";
                    $nStmt = $this->conn->prepare("INSERT INTO notifications (user_id, title, message, type, is_read, created_at) VALUES (:uid, :title, :msg, 'vendor_quota_approved', 0, NOW())");
                    foreach ($targetUsers as $tUser) {
                        $nStmt->execute([':uid' => $tUser['user_id'], ':title' => $title, ':msg' => $msg]);
                    }
                    $respMessage = "Vendor Quota approved by Admin! Quotation is locked for execution.";
                } else {
                    // Submitted for Admin review: find all Admins and insert into notifications
                    $adminStmt = $this->conn->prepare("SELECT user_id FROM users WHERE LOWER(role) IN ('admin', 'administrator', 'superadmin', 'management', 'owner')");
                    $adminStmt->execute();
                    $admins = $adminStmt->fetchAll(PDO::FETCH_ASSOC);

                    $title = "Vendor Quota Submitted for Approval";
                    $msg = "A Vendor Quota for '{$vendor}' on Project Site '{$projectId}' has been submitted for Admin approval.";
                    $nStmt = $this->conn->prepare("INSERT INTO notifications (user_id, title, message, type, is_read, created_at) VALUES (:uid, :title, :msg, 'vendor_quota_approval', 0, NOW())");
                    foreach ($admins as $admin) {
                        $nStmt->execute([':uid' => $admin['user_id'], ':title' => $title, ':msg' => $msg]);
                    }
                    $respMessage = "Vendor Quota submitted for Admin approval. Notification sent to Admin!";
                }
            } catch (Exception $e) {}

            echo json_encode([
                'success' => true,
                'status' => $status,
                'is_locked' => $isLocked,
                'message' => $respMessage
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
    }

    public function getPendingApprovals() {
        try {
            $this->ensureTablesExist();
            $stmt = $this->conn->query("
                SELECT vq.id, vq.project_id, vq.vendor_name, vq.total_amount, vq.version, vq.approval_status, vq.is_locked, vq.created_at,
                       COALESCE(p.project_name, c.projectname, CONCAT('Project ', vq.project_id)) as project_name,
                       c.name as client_name,
                       mv.phone, mv.contact_person
                FROM vendor_quotations vq
                LEFT JOIN projects p ON vq.project_id = p.project_id
                LEFT JOIN clients c ON p.client_id = c.client_id
                LEFT JOIN main_vendors mv ON vq.vendor_name = mv.vendor_name
                WHERE vq.approval_status = 'Pending Approval'
                GROUP BY vq.id
                ORDER BY vq.id DESC
            ");
            $data = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(['success' => true, 'data' => $data]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
    }

    public function getAgreementPdf() {
        $pdfPath = __DIR__ . '/../../Interior_Vendor_Service_Agreemt.pdf';
        if (!file_exists($pdfPath)) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Agreement PDF not found']);
            return;
        }

        $base64 = base64_encode(file_get_contents($pdfPath));
        echo json_encode([
            'success' => true,
            'filename' => 'Interior_Vendor_Service_Agreemt.pdf',
            'pdf_base64' => $base64
        ]);
    }

    public function generatePdf() {
        $vendor = $_GET['vendor'] ?? ($_POST['vendor'] ?? '');
        $projectId = $_GET['project_id'] ?? ($_POST['project_id'] ?? '');

        if (empty($vendor) || empty($projectId)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'vendor and project_id are required']);
            return;
        }

        $pdfGenBase = defined('PDF_GENERATOR_URL') ? PDF_GENERATOR_URL : 'http://127.0.0.1:3001';
        $apiBase = defined('API_BASE_URL') ? API_BASE_URL : 'http://localhost/livrcart/demoark/api';

        $pdfGeneratorUrl = $pdfGenBase . '/generate-vendor-quota-pdf';

        $payload = json_encode([
            'vendor'     => $vendor,
            'projectId'  => $projectId,
            'apiBaseUrl' => $apiBase
        ]);

        $ch = curl_init($pdfGeneratorUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Content-Length: ' . strlen($payload)
        ]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 90);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error    = curl_error($ch);
        curl_close($ch);

        if ($error) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'PDF generator service error: ' . $error]);
            return;
        }

        if ($httpCode !== 200) {
            http_response_code($httpCode);
            echo json_encode(['success' => false, 'error' => 'PDF generator service HTTP ' . $httpCode]);
            return;
        }

        echo $response;
    }

    private function ensureTablesExist() {
        $sql = "
            CREATE TABLE IF NOT EXISTS vendor_quotations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                project_id VARCHAR(100) NOT NULL,
                vendor_name VARCHAR(255) NOT NULL,
                total_amount DECIMAL(12,2) DEFAULT 0.00,
                items_data JSON NULL,
                modules_data LONGTEXT NULL,
                notes TEXT NULL,
                version VARCHAR(50) DEFAULT 'V1.0',
                approval_status VARCHAR(100) DEFAULT 'Pending Approval',
                is_locked TINYINT(1) DEFAULT 0,
                column_visibility LONGTEXT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ";
        $this->conn->exec($sql);

        try {
            $this->conn->exec("ALTER TABLE vendor_quotations ADD COLUMN version VARCHAR(50) DEFAULT 'V1.0'");
        } catch (Exception $e) {}
        try {
            $this->conn->exec("ALTER TABLE vendor_quotations ADD COLUMN approval_status VARCHAR(100) DEFAULT 'Pending Approval'");
        } catch (Exception $e) {}
        try {
            $this->conn->exec("ALTER TABLE vendor_quotations ADD COLUMN is_locked TINYINT(1) DEFAULT 0");
        } catch (Exception $e) {}
        try {
            $this->conn->exec("ALTER TABLE vendor_quotations ADD COLUMN column_visibility LONGTEXT NULL");
        } catch (Exception $e) {}
        try {
            $this->conn->exec("ALTER TABLE vendor_quotations ADD COLUMN modules_data LONGTEXT NULL");
        } catch (Exception $e) {}
    }
}
