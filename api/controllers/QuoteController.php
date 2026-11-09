<?php
// api/controllers/QuoteController.php
require_once __DIR__ . '/../helpers/MailHelper.php';

class QuoteController
{
    private $conn;

    public function __construct($db)
    {
        $this->conn = $db;
        $this->ensureAutoIncrementSchema();
        $this->ensureExtraDataColumn();
        $this->ensureStatusColumnVarchar();
        $this->ensureAckColumns();
        $this->ensureSoftDeleteColumns();
    }

    private function ensureAutoIncrementSchema()
    {
        try {
            // 1. quotes table
            $col = $this->conn->query("SHOW COLUMNS FROM quotes LIKE 'quote_id'")->fetch(\PDO::FETCH_ASSOC);
            if ($col && strpos(strtolower($col['Extra'] ?? ''), 'auto_increment') === false) {
                $maxId = intval($this->conn->query("SELECT COALESCE(MAX(quote_id), 0) FROM quotes WHERE quote_id > 0")->fetchColumn() ?: 0);
                $zeroQuotes = $this->conn->query("SELECT quote_number FROM quotes WHERE quote_id = 0")->fetchAll(\PDO::FETCH_ASSOC);
                foreach ($zeroQuotes as $zq) {
                    $maxId++;
                    $this->conn->prepare("UPDATE quotes SET quote_id = :nid WHERE quote_number = :qn AND quote_id = 0 LIMIT 1")->execute(['nid' => $maxId, 'qn' => $zq['quote_number']]);
                    $this->conn->prepare("UPDATE quote_sections SET quote_id = :nid WHERE quote_id = 0")->execute(['nid' => $maxId]);
                }
                try { $this->conn->exec("ALTER TABLE quotes ADD PRIMARY KEY (quote_id)"); } catch (\Exception $e) {}
                try { $this->conn->exec("ALTER TABLE quotes MODIFY COLUMN quote_id INT(11) NOT NULL AUTO_INCREMENT"); } catch (\Exception $e) {}
            }

            // 2. quote_sections table
            $sCol = $this->conn->query("SHOW COLUMNS FROM quote_sections LIKE 'section_id'")->fetch(\PDO::FETCH_ASSOC);
            if ($sCol && strpos(strtolower($sCol['Extra'] ?? ''), 'auto_increment') === false) {
                $zeroSecs = $this->conn->query("SELECT section_name, quote_id FROM quote_sections WHERE section_id = 0")->fetchAll(\PDO::FETCH_ASSOC);
                $maxSecId = intval($this->conn->query("SELECT COALESCE(MAX(section_id), 0) FROM quote_sections WHERE section_id > 0")->fetchColumn() ?: 0);
                foreach ($zeroSecs as $zs) {
                    $maxSecId++;
                    $this->conn->prepare("UPDATE quote_sections SET section_id = :nid WHERE section_id = 0 AND quote_id = :qid AND section_name = :sname LIMIT 1")
                         ->execute(['nid' => $maxSecId, 'qid' => $zs['quote_id'], 'sname' => $zs['section_name']]);
                    // Also update any matching items with section_id = 0
                    try {
                        $this->conn->prepare("UPDATE quote_items SET section_id = :nid WHERE section_id = 0")
                             ->execute(['nid' => $maxSecId]);
                    } catch (\Exception $ie) {}
                }
                try { $this->conn->exec("ALTER TABLE quote_sections ADD PRIMARY KEY (section_id)"); } catch (\Exception $e) {}
                try { $this->conn->exec("ALTER TABLE quote_sections MODIFY COLUMN section_id INT(11) NOT NULL AUTO_INCREMENT"); } catch (\Exception $e) {}
            }

            // 3. quote_items table
            $iCol = $this->conn->query("SHOW COLUMNS FROM quote_items LIKE 'item_id'")->fetch(\PDO::FETCH_ASSOC);
            if ($iCol && strpos(strtolower($iCol['Extra'] ?? ''), 'auto_increment') === false) {
                $zeroItems = $this->conn->query("SELECT particulars, section_id, display_order FROM quote_items WHERE item_id = 0")->fetchAll(\PDO::FETCH_ASSOC);
                $maxItemId = intval($this->conn->query("SELECT COALESCE(MAX(item_id), 0) FROM quote_items WHERE item_id > 0")->fetchColumn() ?: 0);
                foreach ($zeroItems as $zi) {
                    $maxItemId++;
                    $this->conn->prepare("UPDATE quote_items SET item_id = :nid WHERE item_id = 0 AND section_id = :sid AND display_order = :ord LIMIT 1")
                         ->execute(['nid' => $maxItemId, 'sid' => $zi['section_id'], 'ord' => $zi['display_order']]);
                }
                try { $this->conn->exec("ALTER TABLE quote_items ADD PRIMARY KEY (item_id)"); } catch (\Exception $e) {}
                try { $this->conn->exec("ALTER TABLE quote_items MODIFY COLUMN item_id INT(11) NOT NULL AUTO_INCREMENT"); } catch (\Exception $e) {}
            }
        } catch (\Exception $e) {
            error_log("ensureAutoIncrementSchema error: " . $e->getMessage());
        }
    }

    private function ensureAckColumns()
    {
        try {
            $this->conn->exec("ALTER TABLE quotes ADD COLUMN IF NOT EXISTS ack_token VARCHAR(100) NULL DEFAULT NULL");
            $this->conn->exec("ALTER TABLE quotes ADD COLUMN IF NOT EXISTS acknowledged_at DATETIME NULL DEFAULT NULL");
            $this->conn->exec("ALTER TABLE quotes ADD COLUMN IF NOT EXISTS acknowledged_ip VARCHAR(50) NULL DEFAULT NULL");
            $this->conn->exec("ALTER TABLE quotes ADD COLUMN IF NOT EXISTS ack_email_sent_at DATETIME NULL DEFAULT NULL");
            $this->conn->exec("ALTER TABLE quotes ADD COLUMN IF NOT EXISTS ack_status VARCHAR(50) NULL DEFAULT NULL");
            $this->conn->exec("ALTER TABLE quotes ADD COLUMN IF NOT EXISTS lead_id INT(11) NULL DEFAULT NULL");
            $this->conn->exec("ALTER TABLE quotes ADD COLUMN IF NOT EXISTS updated_by INT(11) NULL DEFAULT NULL");
            try {
                $this->conn->exec("ALTER TABLE quotes ADD UNIQUE INDEX idx_quote_ack_token (ack_token)");
            } catch (Exception $e2) {}
        } catch (Exception $e) {}
    }

    private function ensureSoftDeleteColumns()
    {
        try {
            $c1 = $this->conn->query("SHOW COLUMNS FROM quotes LIKE 'is_deleted'");
            if ($c1 && $c1->rowCount() === 0) {
                $this->conn->exec("ALTER TABLE quotes ADD COLUMN is_deleted TINYINT(1) NOT NULL DEFAULT 0");
            }
            $c2 = $this->conn->query("SHOW COLUMNS FROM quotes LIKE 'deleted_at'");
            if ($c2 && $c2->rowCount() === 0) {
                $this->conn->exec("ALTER TABLE quotes ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL");
            }
            $c3 = $this->conn->query("SHOW COLUMNS FROM quotes LIKE 'deleted_by'");
            if ($c3 && $c3->rowCount() === 0) {
                $this->conn->exec("ALTER TABLE quotes ADD COLUMN deleted_by INT(11) NULL DEFAULT NULL");
            }
            try {
                $this->conn->exec("ALTER TABLE quotes ADD INDEX idx_quote_deleted (is_deleted, deleted_at)");
            } catch (Exception $e3) {}
        } catch (Exception $e) {
            error_log("ensureSoftDeleteColumns error: " . $e->getMessage());
        }
    }

    private function ensureExtraDataColumn()
    {
        try {
            $check = $this->conn->query("SHOW COLUMNS FROM quotes LIKE 'extra_data'");
            if ($check && $check->rowCount() === 0) {
                $this->conn->exec("ALTER TABLE quotes ADD COLUMN extra_data LONGTEXT NULL");
            }
        } catch (Exception $e) {}
    }

    private function ensureStatusColumnVarchar()
    {
        try {
            $this->conn->exec("ALTER TABLE quotes MODIFY COLUMN status VARCHAR(100) DEFAULT 'booked'");
        } catch (Exception $e) {}
    }

    public function createQuote($data)
    {
        $eff_uid = $data['created_by'] ?? ($data['user_id'] ?? null);
        $eff_role = $data['role'] ?? ($data['user_role'] ?? null);
        $raw_p_id = $data['project_id'] ?? 0;

        if (!$this->canDesignerModifyProject($raw_p_id, $eff_uid, $eff_role, $data)) {
            return [
                "success" => false,
                "message" => "Access Denied: You are not assigned to this project by the sales team. Only the assigned designer can create quotations for this project."
            ];
        }

        try {
            $this->conn->beginTransaction();

            try {
                $this->conn->exec("ALTER TABLE quote_items MODIFY COLUMN unit LONGTEXT DEFAULT NULL");
                $this->conn->exec("ALTER TABLE quote_items MODIFY COLUMN particulars LONGTEXT DEFAULT NULL");
            } catch (Exception $e) {}

            // 1. Create Quote Entry
            $quote_number = 'Livincart-QT-' . time();
            $query = "INSERT INTO quotes (project_id, quote_number, total_amount, created_by, status) 
                      VALUES (:p_id, :q_num, :total, :u_id, 'draft')";
            $stmt = $this->conn->prepare($query);
            $stmt->execute([
                'p_id' => $data['project_id'],
                'q_num' => $quote_number,
                'total' => $data['total_amount'] ?? 0,
                'u_id' => $data['created_by'] ?? 1
            ]);
            $quote_id = $this->conn->lastInsertId();

            // 2. Insert Sections and Items
            if (isset($data['sections']) && is_array($data['sections'])) {
                foreach ($data['sections'] as $s_idx => $section) {
                    $s_query = "INSERT INTO quote_sections (quote_id, section_name, display_order) 
                                VALUES (:q_id, :name, :order)";
                    $s_stmt = $this->conn->prepare($s_query);
                    $s_stmt->execute([
                        'q_id' => $quote_id,
                        'name' => $section['name'] ?? $section['section_name'] ?? 'Section',
                        'order' => $s_idx
                    ]);
                    $section_id = $this->conn->lastInsertId();

                    if (isset($section['items']) && is_array($section['items'])) {
                        foreach ($section['items'] as $i_idx => $item) {
                            $i_query = "INSERT INTO quote_items 
                                        (section_id, particulars, brand, unit, quantity, image_url, rate, amount, display_order) 
                                        VALUES (:s_id, :part, :brand, :unit, :qty, :img, :rate, :amt, :order)";
                            $i_stmt = $this->conn->prepare($i_query);
                            $i_stmt->execute([
                                's_id' => $section_id,
                                'part' => $item['particulars'],
                                'brand' => $item['brand'] ?? '',
                                'unit' => $item['unit'] ?? '',
                                'qty' => $item['quantity'] ?? 0,
                                'img' => $item['image_url'] ?? '',
                                'rate' => $item['rate'] ?? 0,
                                'amt' => ($item['quantity'] ?? 0) * ($item['rate'] ?? 0),
                                'order' => $i_idx
                            ]);
                        }
                    }
                }
            }

            if ($this->conn->inTransaction()) {
                $this->conn->commit();
            }
            return ["success" => true, "message" => "Quote created successfully", "quote_id" => $quote_id];
        } catch (Exception $e) {
            if ($this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            return ["success" => false, "message" => "Error creating quote: " . $e->getMessage()];
        }
    }

    public function resolveIdentifiers($id)
    {
        $clean = trim((string)$id);
        if (empty($clean)) return [];
        $ids = [$clean];

        $cleanNoPrefix = preg_replace('/^(lead_|lead-|PR-|PR_|p-|l-|q-|ql-)/i', '', $clean);
        if (!empty($cleanNoPrefix) && $cleanNoPrefix !== $clean) {
            $ids[] = $cleanNoPrefix;
        }

        $numeric = is_numeric($cleanNoPrefix) ? $cleanNoPrefix : (is_numeric($clean) ? $clean : null);
        if ($numeric !== null) {
            $ids[] = (string)$numeric;
            $ids[] = 'PR-' . $numeric;
            $ids[] = 'PR_' . $numeric;
            $ids[] = 'lead_' . $numeric;
            $ids[] = 'lead-' . $numeric;
        }

        try {
            // Check projects by exact code or ID
            $pQuery = "SELECT project_id, project_code FROM projects WHERE project_id = :id OR project_code = :id";
            $pParams = ['id' => $clean];
            if ($numeric !== null) {
                $pQuery .= " OR project_id = :num OR project_code = :numcode";
                $pParams['num'] = $numeric;
                $pParams['numcode'] = 'PR-' . $numeric;
            }
            $pStmt = $this->conn->prepare($pQuery);
            $pStmt->execute($pParams);
            $projects = $pStmt->fetchAll(PDO::FETCH_ASSOC);
            foreach ($projects as $p) {
                if (!empty($p['project_id'])) $ids[] = (string)$p['project_id'];
                if (!empty($p['project_code'])) $ids[] = (string)$p['project_code'];
                $lStmt = $this->conn->prepare("SELECT lead_id, manual_client_id FROM leads WHERE manual_client_id = :code OR lead_id = :code OR manual_client_id = :pid OR lead_id = :pid");
                $lStmt->execute(['code' => $p['project_code'], 'pid' => $p['project_id']]);
                $leads = $lStmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($leads as $l) {
                    if (!empty($l['lead_id'])) $ids[] = (string)$l['lead_id'];
                    if (!empty($l['manual_client_id'])) $ids[] = (string)$l['manual_client_id'];
                }
            }
        } catch (Exception $e) {}

        try {
            // Check leads by exact code or ID
            $lQuery2 = "SELECT lead_id, manual_client_id FROM leads WHERE lead_id = :id OR manual_client_id = :id";
            $lParams2 = ['id' => $clean];
            if ($numeric !== null) {
                $lQuery2 .= " OR lead_id = :num";
                $lParams2['num'] = $numeric;
            }
            $lStmt2 = $this->conn->prepare($lQuery2);
            $lStmt2->execute($lParams2);
            $leads2 = $lStmt2->fetchAll(PDO::FETCH_ASSOC);
            foreach ($leads2 as $l2) {
                if (!empty($l2['lead_id'])) $ids[] = (string)$l2['lead_id'];
                if (!empty($l2['manual_client_id'])) $ids[] = (string)$l2['manual_client_id'];
                $pStmt2 = $this->conn->prepare("SELECT project_id, project_code FROM projects WHERE project_code = :code OR project_id = :code OR project_id = :lid");
                $pStmt2->execute(['code' => $l2['manual_client_id'] ?: $l2['lead_id'], 'lid' => $l2['lead_id']]);
                $projects2 = $pStmt2->fetchAll(PDO::FETCH_ASSOC);
                foreach ($projects2 as $p2) {
                    if (!empty($p2['project_id'])) $ids[] = (string)$p2['project_id'];
                    if (!empty($p2['project_code'])) $ids[] = (string)$p2['project_code'];
                }
            }
        } catch (Exception $e) {}

        return array_values(array_unique(array_filter($ids)));
    }

    public function getQuotesByProject($project_id, $user_id = null, $role = null)
    {
        $designerContext = !empty($user_id) ? $this->resolveDesignerAssignments($user_id, $role) : null;
        if ($designerContext !== null) {
            $checkPid = strtolower(trim(strval($project_id)));
            $cleanNum = preg_replace('/\D/', '', $checkPid);
            $hasAccess = isset($designerContext['project_ids'][$checkPid]) ||
                         isset($designerContext['lead_ids'][$checkPid]) ||
                         isset($designerContext['codes'][$checkPid]) ||
                         ($cleanNum !== '' && (isset($designerContext['project_ids'][$cleanNum]) || isset($designerContext['lead_ids'][$cleanNum])));
            if (!$hasAccess) {
                return [];
            }
        }

        $allIds = $this->resolveIdentifiers($project_id);
        if (empty($allIds)) {
            $allIds = [(string)$project_id];
        }

        $placeholders = implode(',', array_fill(0, count($allIds), '?'));
        $query = "SELECT * FROM quotes WHERE project_id IN ($placeholders) ORDER BY version DESC, created_at DESC";
        $stmt = $this->conn->prepare($query);
        $stmt->execute($allIds);
        $quotes = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($quotes as &$q) {
            $isDraftOrDup = (($q['save_type'] ?? '') === 'draft' || ($q['status'] ?? '') === 'draft');
            if (!empty($q['extra_data'])) {
                $decoded = json_decode($q['extra_data'], true);
                if (is_array($decoded)) {
                    $q['extra_data_parsed'] = $decoded;
                    if (!empty($decoded['is_duplicate'])) {
                        $isDraftOrDup = true;
                        $q['is_duplicate'] = true;
                    }
                    if (isset($decoded['is_final_version'])) {
                        $q['is_final_version'] = $isDraftOrDup ? false : $decoded['is_final_version'];
                    }
                    if (isset($decoded['is_initial_quote'])) {
                        $q['is_initial_quote'] = $decoded['is_initial_quote'];
                    }
                }
            }
            if ($isDraftOrDup) {
                $q['is_final_version'] = false;
                $q['is_final'] = false;
                $q['is_qc_approved'] = 0;
            } else if (!isset($q['is_final_version'])) {
                $q['is_final_version'] = ($q['status'] === 'Finalized' || !empty($q['is_final']));
            }
            if (!isset($q['is_initial_quote'])) {
                $q['is_initial_quote'] = !empty($q['is_initial']);
            }
        }
        return $quotes;
    }

    public function getQuoteDetails($quote_id)
    {
        // 1. Get Quote (exclude binary blob fields to ensure clean json_encode)
        $q_query = "SELECT quote_id, project_id, subtitle, quote_number, version, total_amount, discount_percent, status, created_by, created_at, updated_at, save_type, label, has_snapshot, extra_data, ack_token, acknowledged_at, acknowledged_ip, ack_email_sent_at, ack_status, lead_id FROM quotes WHERE quote_id = :id";
        $q_stmt = $this->conn->prepare($q_query);
        $q_stmt->execute(['id' => $quote_id]);
        $quote = $q_stmt->fetch(PDO::FETCH_ASSOC);

        if (!$quote)
            return null;

        $isDraftOrDup = (($quote['save_type'] ?? '') === 'draft' || ($quote['status'] ?? '') === 'draft');

        if (!empty($quote['extra_data'])) {
            $decoded = json_decode($quote['extra_data'], true);
            if (is_array($decoded)) {
                $quote['extra_data_parsed'] = $decoded;
                if (!empty($decoded['is_duplicate'])) {
                    $isDraftOrDup = true;
                }
                foreach ($decoded as $k => $v) {
                    if (!isset($quote[$k])) {
                        $quote[$k] = $v;
                    }
                }
            }
        }

        if ($isDraftOrDup) {
            $quote['is_final_version'] = false;
            $quote['is_final'] = false;
            $quote['is_qc_approved'] = 0;
            $quote['qc_status'] = 'not_sent';
            if (empty($quote['ack_email_sent_at']) && ($quote['status'] ?? '') !== 'proposal') {
                $quote['status'] = 'draft';
            }
            if (isset($quote['extra_data_parsed'])) {
                $quote['extra_data_parsed']['is_final_version'] = false;
                $quote['extra_data_parsed']['is_final'] = false;
                $quote['extra_data_parsed']['is_qc_approved'] = false;
                $quote['extra_data_parsed']['qc_status'] = 'not_sent';
            }
        }

        // 2. Get Sections
        try {
            $this->conn->exec("ALTER TABLE quote_sections ADD COLUMN IF NOT EXISTS custom_headings LONGTEXT DEFAULT NULL");
        } catch (\Exception $e) {}

        $s_query = "SELECT * FROM quote_sections WHERE quote_id = :id ORDER BY display_order";
        $s_stmt = $this->conn->prepare($s_query);
        $s_stmt->execute(['id' => $quote_id]);
        $sections = $s_stmt->fetchAll(PDO::FETCH_ASSOC);

        $extraSecHeadings = $quote['extra_data_parsed']['section_headings'] ?? [];
        if (is_string($extraSecHeadings)) {
            $extraSecHeadings = json_decode($extraSecHeadings, true) ?: [];
        }

        foreach ($sections as $sIdx => &$section) {
            $secId = $section['section_id'] ?? '';
            if (!empty($section['custom_headings']) && is_string($section['custom_headings'])) {
                $section['custom_headings'] = json_decode($section['custom_headings'], true);
            }
            if (empty($section['custom_headings'])) {
                $section['custom_headings'] = $extraSecHeadings[$secId] 
                    ?? ($extraSecHeadings[strval($secId)] 
                    ?? ($extraSecHeadings[$sIdx] 
                    ?? ($extraSecHeadings[strval($sIdx)] 
                    ?? ($extraSecHeadings[$section['section_name'] ?? ''] 
                    ?? null))));
            }

            // 3. Get Items for each section
            $i_query = "SELECT * FROM quote_items WHERE section_id = :sid ORDER BY display_order";
            $i_stmt = $this->conn->prepare($i_query);
            $i_stmt->execute(['sid' => $section['section_id']]);
            $section['items'] = $i_stmt->fetchAll(PDO::FETCH_ASSOC);
        }
        unset($section);

        $quote['sections'] = $sections;

        // Auto-resolve client_email and client_name from lead / project / client if not present
        if (empty($quote['client_email']) || empty($quote['client_name']) || $quote['client_name'] === 'Client') {
            $team = $this->resolveTeamEmailsForQuote($quote_id, $quote['project_id'] ?? null);
            if (!empty($team['client_email']) && empty($quote['client_email'])) {
                $quote['client_email'] = $team['client_email'];
            }
            if (!empty($team['client_name']) && (empty($quote['client_name']) || $quote['client_name'] === 'Client')) {
                $quote['client_name'] = $team['client_name'];
            }
        }

        return $quote;
    }

    public function saveQuoteState($data)
    {
        file_put_contents('debug_quote.log', "SAVE CALLED: " . date('Y-m-d H:i:s') . "\n" . print_r($data, true), FILE_APPEND);

        $eff_uid = $data['user_id'] ?? ($data['created_by'] ?? ($data['updated_by'] ?? null));
        $eff_role = $data['role'] ?? ($data['user_role'] ?? null);
        $raw_p_id = $data['project_id'] ?? 0;

        if (!$this->canDesignerModifyProject($raw_p_id, $eff_uid, $eff_role, $data)) {
            return [
                "success" => false,
                "message" => "Access Denied: You are not assigned to this project by the sales team. Only the assigned designer can create or update quotations for this project."
            ];
        }

        try {
            // Ensure schema columns exist BEFORE starting transaction (DDL causes implicit commit in MySQL)
            try {
                $this->conn->exec("ALTER TABLE quotes ADD COLUMN IF NOT EXISTS discount_percent DECIMAL(5,2) DEFAULT 0");
            } catch (Exception $e) {}
            try {
                $this->conn->exec("ALTER TABLE quotes ADD COLUMN IF NOT EXISTS save_type ENUM('draft','version') NOT NULL DEFAULT 'version'");
            } catch (Exception $e) {}
            try {
                $this->conn->exec("ALTER TABLE quotes ADD COLUMN IF NOT EXISTS label VARCHAR(100) NOT NULL DEFAULT ''");
            } catch (Exception $e) {}
            try {
                $this->conn->exec("ALTER TABLE quotes ADD COLUMN IF NOT EXISTS extra_data LONGTEXT DEFAULT NULL");
            } catch (Exception $e) {}
            try {
                $this->conn->exec("ALTER TABLE quote_sections ADD COLUMN IF NOT EXISTS custom_headings LONGTEXT DEFAULT NULL");
            } catch (Exception $e) {}

            try {
                $this->conn->exec("ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS width VARCHAR(50) DEFAULT ''");
            } catch (Exception $e) {}
            try {
                $this->conn->exec("ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS height VARCHAR(50) DEFAULT ''");
            } catch (Exception $e) {}
            try {
                $this->conn->exec("ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS sft VARCHAR(50) DEFAULT ''");
            } catch (Exception $e) {}
            try {
                $this->conn->exec("ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS rate_per_sft DECIMAL(10,2) DEFAULT 0");
            } catch (Exception $e) {}
            try {
                $this->conn->exec("ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS gst_rate DECIMAL(5,2) DEFAULT 18");
            } catch (Exception $e) {}
            try {
                $this->conn->exec("ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS pricing_mode VARCHAR(50) DEFAULT NULL");
            } catch (Exception $e) {}
            try {
                $this->conn->exec("ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS discount_percent DECIMAL(5,2) DEFAULT 0");
            } catch (Exception $e) {}
            try {
                $this->conn->exec("ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT ''");
            } catch (Exception $e) {}
            try {
                $this->conn->exec("ALTER TABLE quote_items MODIFY COLUMN brand LONGTEXT DEFAULT NULL");
            } catch (Exception $e) {}
            try {
                $this->conn->exec("ALTER TABLE quote_items MODIFY COLUMN hsn_sac LONGTEXT DEFAULT NULL");
            } catch (Exception $e) {}
            try {
                $this->conn->exec("ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS image_url LONGTEXT DEFAULT NULL");
                $this->conn->exec("ALTER TABLE quote_items MODIFY COLUMN image_url LONGTEXT DEFAULT NULL");
            } catch (Exception $e) {}
            try {
                $this->conn->exec("ALTER TABLE quote_items MODIFY COLUMN unit LONGTEXT DEFAULT NULL");
            } catch (Exception $e) {}
            try {
                $this->conn->exec("ALTER TABLE quote_items MODIFY COLUMN particulars LONGTEXT DEFAULT NULL");
            } catch (Exception $e) {}

            $raw_p_id = $data['project_id'] ?? 0;
            $project_id = intval(preg_replace('/[^0-9]/', '', (string)$raw_p_id));
            if ($project_id === 0) {
                try {
                    $maxStmt = $this->conn->query("SELECT COALESCE(MAX(project_id), 1000) as max_id FROM quotes");
                    $maxRow = $maxStmt->fetch(PDO::FETCH_ASSOC);
                    $project_id = intval($maxRow['max_id'] ?? 1000) + 1;
                } catch (Exception $e) {
                    $project_id = time();
                }
            }

            $this->ensureProjectExists($project_id, $data['subtitle'] ?? '', $data['total_amount'] ?? 0);

            $is_used_quote = $data['is_used_quote'] ?? false;
            
            $clean_id = intval(preg_replace('/[^0-9]/', '', (string)$project_id));
            $cur_st_stmt = $this->conn->prepare("SELECT status, ack_status, acknowledged_at, ack_email_sent_at FROM quotes WHERE (project_id = :pid OR project_id = :raw_id) AND status IS NOT NULL AND status != '' AND status != 'budgeted' ORDER BY quote_id DESC LIMIT 1");
            $cur_st_stmt->execute(['pid' => $clean_id, 'raw_id' => $project_id]);
            $cur_st_row = $cur_st_stmt->fetch(PDO::FETCH_ASSOC);
            $existing_st = $cur_st_row['status'] ?? null;

            // Check if proposal was ever sent for this project
            $chkProp = $this->conn->prepare("SELECT quote_id, ack_email_sent_at, status FROM quotes WHERE (project_id = :pid OR project_id = :raw_id) AND (ack_email_sent_at IS NOT NULL OR status IN ('proposal', 'proposal_sent')) ORDER BY quote_id DESC LIMIT 1");
            $chkProp->execute(['pid' => $clean_id, 'raw_id' => $project_id]);
            $propRow = $chkProp->fetch(PDO::FETCH_ASSOC);
            $hasEverSentProposal = !empty($propRow);

            if (!$hasEverSentProposal && $clean_id > 0) {
                $chkLead = $this->conn->prepare("SELECT status, d1_status FROM leads WHERE lead_id = :lid LIMIT 1");
                $chkLead->execute(['lid' => $clean_id]);
                $lRow = $chkLead->fetch(PDO::FETCH_ASSOC);
                if ($lRow && ($lRow['status'] === 'proposal_sent' || $lRow['d1_status'] === 'proposal_sent')) {
                    $hasEverSentProposal = true;
                }
            }

            // Check if client rejected this quotation or if lead is lost
            $isClientRejected = (
                (!empty($data['ack_status']) && $data['ack_status'] === 'rejected') ||
                (!empty($data['status']) && in_array(strtolower(trim($data['status'])), ['order_lost', 'rejected', 'lost'])) ||
                ($cur_st_row && (($cur_st_row['ack_status'] ?? '') === 'rejected' || ($cur_st_row['status'] ?? '') === 'order_lost'))
            );

            // Check if any previous quote for this project was accepted by client or converted
            $chkAcceptedQ = $this->conn->prepare("SELECT quote_id, ack_status, acknowledged_at, status FROM quotes WHERE (project_id = :pid OR project_id = :raw_id) AND (ack_status = 'accepted' OR status = 'order_converted') ORDER BY quote_id DESC LIMIT 1");
            $chkAcceptedQ->execute(['pid' => $clean_id, 'raw_id' => $project_id]);
            $acceptedQRow = $chkAcceptedQ->fetch(PDO::FETCH_ASSOC);
            $hasAnyAcceptedQuote = !empty($acceptedQRow);

            // STRICT: Only quotes that have been explicitly accepted by client can be considered accepted or converted
            $isClientAccepted = !$isClientRejected && (
                (!empty($data['ack_status']) && $data['ack_status'] === 'accepted') ||
                (!empty($data['status']) && in_array(strtolower(trim($data['status'])), ['order_converted', 'approved'])) ||
                $hasAnyAcceptedQuote ||
                ($cur_st_row && (($cur_st_row['ack_status'] ?? '') === 'accepted' || ($cur_st_row['status'] ?? '') === 'order_converted'))
            );

            // Check if this specific project/quote was already officially converted and accepted
            $is_initial_flow = !empty($data['is_initial_quote']) || (!empty($data['extra_data']) && is_array($data['extra_data']) && !empty($data['extra_data']['is_initial_quote']));
            $isAlreadyConvertedProj = false;
            if (!$isClientRejected && !$is_initial_flow && ($isClientAccepted || $hasAnyAcceptedQuote)) {
                if (!empty($data['status']) && strtolower(trim($data['status'])) === 'order_converted') {
                    $isAlreadyConvertedProj = true;
                } else if ($hasAnyAcceptedQuote && in_array(strtolower(trim($acceptedQRow['status'] ?? '')), ['order_converted', 'deal_done', 'deal_won'])) {
                    $isAlreadyConvertedProj = true;
                }
            }

            if ($isAlreadyConvertedProj) {
                $status = 'order_converted';
            } else if ($isClientRejected) {
                $status = (!empty($data['status']) && in_array(strtolower(trim($data['status'])), ['draft', 'proposal'])) ? $data['status'] : 'order_lost';
            } else if ($isClientAccepted) {
                $status = (!empty($data['status']) && in_array(strtolower(trim($data['status'])), ['order_converted', 'approved']) && $isAlreadyConvertedProj) ? 'order_converted' : 'approved';
            } else {
                $status = (!empty($data['status']) && !in_array(strtolower(trim($data['status'])), ['order_converted', 'approved']))
                    ? $data['status'] 
                    : (!empty($data['is_final_version']) ? 'Finalized' : ($hasEverSentProposal ? 'proposal' : ($existing_st && !in_array($existing_st, ['order_converted', 'approved']) ? $existing_st : ($is_used_quote ? 'used' : 'booked'))));
                if ($hasEverSentProposal && in_array(strtolower(trim($status)), ['booked', 'draft', 'pending', 'new', 'opened', ''])) {
                    $status = 'proposal';
                }
            }

            $this->conn->beginTransaction();

            // Get max version for this project across all statuses
            $clean_id = intval(preg_replace('/[^0-9]/', '', (string)$project_id));
            $v_query = "SELECT MAX(version) as max_v FROM quotes WHERE (project_id = :p_id OR project_id = :raw_id) AND (save_type = 'version' OR save_type IS NULL OR save_type = '')";
            $v_stmt = $this->conn->prepare($v_query);
            $v_stmt->execute(['p_id' => $clean_id, 'raw_id' => $project_id]);
            $v_res = $v_stmt->fetch(PDO::FETCH_ASSOC);
            $new_version = ($v_res && $v_res['max_v']) ? intval($v_res['max_v']) + 1 : 1;

            $subtitle = !empty($data['subtitle']) ? $data['subtitle'] : (!empty($data['client_name']) ? $data['client_name'] : '');
            if (empty($subtitle)) {
                $l_stmt = $this->conn->prepare("SELECT client_name FROM leads WHERE lead_id = :lid");
                $l_stmt->execute(['lid' => $project_id]);
                $l_row = $l_stmt->fetch(PDO::FETCH_ASSOC);
                if ($l_row && !empty($l_row['client_name'])) {
                    $subtitle = $l_row['client_name'];
                } else {
                    $p_stmt = $this->conn->prepare("SELECT p.project_name, c.name as client_name FROM projects p LEFT JOIN clients c ON p.client_id = c.client_id WHERE p.project_id = :pid");
                    $p_stmt->execute(['pid' => $project_id]);
                    $p_row = $p_stmt->fetch(PDO::FETCH_ASSOC);
                    if ($p_row) {
                        $subtitle = !empty($p_row['client_name']) ? $p_row['client_name'] : $p_row['project_name'];
                    }
                }
            }

            $existingExtra = [];
            if (!empty($data['extra_data'])) {
                $decoded = is_array($data['extra_data']) ? $data['extra_data'] : json_decode($data['extra_data'], true);
                if (is_array($decoded)) $existingExtra = $decoded;
            }

            // Clean additional_charges to prevent double-nesting { amount: { amount: X } }
            $rawAddCharges = $data['additional_charges'] ?? $data['additionalCharges'] ?? ($existingExtra['additional_charges'] ?? null);
            if (is_array($rawAddCharges) && is_array($rawAddCharges['amount'] ?? null)) {
                $rawAddCharges['amount'] = floatval($rawAddCharges['amount']['amount'] ?? $rawAddCharges['amount']['value'] ?? 0);
            }

            // Clean flat discount
            $rawFlatDisc = $data['flat_discount'] ?? $data['flatDiscount'] ?? null;
            if ($rawFlatDisc === null && isset($data['general_discount'])) {
                $rawFlatDisc = is_array($data['general_discount']) ? ($data['general_discount']['amount'] ?? null) : $data['general_discount'];
            }
            if ($rawFlatDisc === null) {
                $rawFlatDisc = $existingExtra['flat_discount'] ?? null;
            }

            $client_email = $data['client_email'] ?? $data['clientEmail'] ?? ($existingExtra['client_email'] ?? ($existingExtra['email'] ?? null));
            $client_phone = $data['client_phone'] ?? $data['clientPhone'] ?? ($existingExtra['client_phone'] ?? ($existingExtra['phone'] ?? null));
            $lead_id_val = !empty($data['lead_id']) ? intval($data['lead_id']) : ($existingExtra['lead_id'] ?? null);

            $extra_fields = array_merge($existingExtra, [
                'client_email' => $client_email,
                'client_phone' => $client_phone,
                'lead_id' => $lead_id_val,
                'applied_coupon' => $data['applied_coupon'] ?? $data['appliedCoupon'] ?? $data['coupon'] ?? $data['promo_code'] ?? ($existingExtra['applied_coupon'] ?? null),
                'additional_charges' => $rawAddCharges,
                'general_discount' => $data['general_discount'] ?? $data['generalDiscount'] ?? ($existingExtra['general_discount'] ?? null),
                'flat_discount' => $rawFlatDisc,
                'global_discount' => $data['global_discount'] ?? $data['globalDiscount'] ?? ($existingExtra['global_discount'] ?? null),
                'category_discounts' => $data['category_discounts'] ?? $data['categoryDiscounts'] ?? ($existingExtra['category_discounts'] ?? null),
                'overall_gst_enabled' => $data['overall_gst_enabled'] ?? ($existingExtra['overall_gst_enabled'] ?? true),
                'overall_gst_line_hidden' => $data['overall_gst_line_hidden'] ?? ($existingExtra['overall_gst_line_hidden'] ?? false),
                'overall_gst_rate' => isset($data['overall_gst_rate']) ? floatval($data['overall_gst_rate']) : ($existingExtra['overall_gst_rate'] ?? 0),
                'round_off_enabled' => $data['round_off_enabled'] ?? ($existingExtra['round_off_enabled'] ?? true),
                'custom_headings' => $data['custom_headings'] ?? ($existingExtra['custom_headings'] ?? null),
                'section_headings' => $data['section_headings'] ?? ($existingExtra['section_headings'] ?? null),
                'hidden_fields' => $data['hidden_fields'] ?? ($existingExtra['hidden_fields'] ?? null),
                'terms_list' => $data['terms_list'] ?? $data['terms'] ?? ($existingExtra['terms_list'] ?? ($existingExtra['terms'] ?? null)),
                'terms' => $data['terms_list'] ?? $data['terms'] ?? ($existingExtra['terms_list'] ?? ($existingExtra['terms'] ?? null)),
                'is_final_version' => $data['is_final_version'] ?? ($existingExtra['is_final_version'] ?? false),
                'is_initial_quote' => $data['is_initial_quote'] ?? ($existingExtra['is_initial_quote'] ?? false)
            ]);

            $extra_data_json = json_encode($extra_fields);

            $is_initial = ($new_version === 1) && (!empty($data['is_initial_quote']) || 
                          (!empty($data['extra_data']) && is_array($data['extra_data']) && !empty($data['extra_data']['is_initial_quote'])) ||
                          (!empty($data['extra_data']) && is_string($data['extra_data']) && strpos($data['extra_data'], '"is_initial_quote":true') !== false));

            if ($is_initial && ($project_id > 0 || !empty($subtitle))) {
                try {
                    $this->conn->exec("ALTER TABLE leads ADD COLUMN IF NOT EXISTS initial_quote_amount DECIMAL(15,2) DEFAULT NULL");
                } catch (Exception $e) {}
                try {
                    $totalAmt = floatval($data['total_amount'] ?? 0);
                    $rawPid = (string)($data['project_id'] ?? '');
                    $pCode = (string)($data['project_code'] ?? '');

                    $upLead = $this->conn->prepare("
                        UPDATE leads 
                        SET initial_quote_amount = COALESCE(initial_quote_amount, :amt) 
                        WHERE (
                            lead_id = :lid 
                            OR lead_id = :clean_id
                            OR manual_client_id = :rawpid 
                            OR manual_client_id = :pcode 
                            OR client_name = :subtitle 
                            OR LOWER(client_name) = LOWER(:subtitle)
                            OR CONCAT('PR-', lead_id) = :rawpid
                            OR CONCAT('PR-LEAD-', lead_id) = :rawpid
                        )
                    ");
                    $upLead->execute([
                        'amt' => $totalAmt,
                        'lid' => $project_id,
                        'clean_id' => $project_id,
                        'rawpid' => $rawPid,
                        'pcode' => $pCode,
                        'subtitle' => $subtitle
                    ]);
                } catch (Exception $e) {
                    file_put_contents('debug_quote.log', "UPDATE LEAD INITIAL AMT ERR: " . $e->getMessage() . "\n", FILE_APPEND);
                }
            }

            // Always create a new quote as the next version
            $quote_number = 'Livincart-QT-' . ($is_used_quote ? 'U-' : 'B-') . time() . '-v' . $new_version;
            $label = !empty($data['label']) ? $data['label'] : ('Version ' . $new_version);
            $ack_sent_val = $hasEverSentProposal ? ($propRow['ack_email_sent_at'] ?? date('Y-m-d H:i:s')) : null;
            $ack_st_val = ($isAlreadyConvertedProj || $isClientAccepted || $hasAnyAcceptedQuote) ? 'accepted' : (!empty($data['ack_status']) ? $data['ack_status'] : ($isClientRejected ? 'rejected' : 'pending'));
            $ack_at_val = ($ack_st_val === 'accepted') ? ($acceptedQRow['acknowledged_at'] ?? $cur_st_row['acknowledged_at'] ?? date('Y-m-d H:i:s')) : ($isClientRejected ? ($cur_st_row['acknowledged_at'] ?? date('Y-m-d H:i:s')) : null);
            $query = "INSERT INTO quotes (project_id, subtitle, quote_number, total_amount, discount_percent, created_by, updated_by, status, version, save_type, label, extra_data, lead_id, ack_email_sent_at, is_initial, is_qc_approved, ack_status, acknowledged_at) 
                      VALUES (:p_id, :subtitle, :q_num, :total, :discount, :u_id, :up_id, :status, :version, 'version', :label, :extra_data, :lead_id, :ack_sent, :is_init, 0, :ack_st, :ack_at)";
            $stmt = $this->conn->prepare($query);
            $stmt->execute([
                'p_id' => $project_id,
                'subtitle' => $subtitle,
                'q_num' => $quote_number,
                'total' => $data['total_amount'] ?? 0,
                'discount' => $data['discount_percent'] ?? 0,
                'u_id' => $data['created_by'] ?? 1,
                'up_id' => $data['updated_by'] ?? $data['user_id'] ?? ($data['created_by'] ?? 1),
                'status' => $status,
                'version' => $new_version,
                'label' => $label,
                'extra_data' => $extra_data_json,
                'lead_id' => $lead_id_val,
                'ack_sent' => $ack_sent_val,
                'is_init' => $is_initial ? 1 : 0,
                'ack_st' => $ack_st_val,
                'ack_at' => $ack_at_val
            ]);
            $quote_id = intval($this->conn->lastInsertId() ?: 0);
            if ($quote_id <= 0 && !empty($quote_number)) {
                $chkQid = $this->conn->prepare("SELECT quote_id FROM quotes WHERE quote_number = :qn ORDER BY quote_id DESC LIMIT 1");
                $chkQid->execute([':qn' => $quote_number]);
                $quote_id = intval($chkQid->fetchColumn() ?: 0);
            }

            // Insert Sections and Items
            $q_sections = $data['sections'] ?? [];
            if (is_string($q_sections)) {
                $q_sections = json_decode($q_sections, true) ?: [];
            }
            if (is_array($q_sections) && !empty($q_sections)) {
                foreach ($q_sections as $s_idx => $section) {
                    $s_name = trim($section['name'] ?? $section['section_name'] ?? $section['title'] ?? '');
                    if ($s_name === '') {
                        $s_name = 'Section ' . ($s_idx + 1);
                    }

                    $s_headings_val = !empty($section['custom_headings']) ? (is_string($section['custom_headings']) ? $section['custom_headings'] : json_encode($section['custom_headings'])) : null;
                    if (empty($s_headings_val) && !empty($extra_fields['section_headings'])) {
                        $secMap = $extra_fields['section_headings'];
                        $secKey = $section['id'] ?? $section['section_id'] ?? $s_idx;
                        $foundHeadings = $secMap[$secKey] ?? ($secMap[strval($secKey)] ?? ($secMap[$s_idx] ?? ($secMap[strval($s_idx)] ?? ($secMap[$s_name] ?? null))));
                        if (!empty($foundHeadings)) {
                            $s_headings_val = is_string($foundHeadings) ? $foundHeadings : json_encode($foundHeadings);
                        }
                    }

                    $s_query = "INSERT INTO quote_sections (quote_id, section_name, display_order, custom_headings) 
                                VALUES (:q_id, :name, :order, :headings)";
                    $s_stmt = $this->conn->prepare($s_query);
                    $s_stmt->execute([
                        'q_id' => $quote_id,
                        'name' => $s_name,
                        'order' => $s_idx,
                        'headings' => $s_headings_val
                    ]);
                    $section_id = intval($this->conn->lastInsertId() ?: 0);
                    if ($section_id <= 0 && $quote_id > 0) {
                        $chkSid = $this->conn->prepare("SELECT section_id FROM quote_sections WHERE quote_id = :qid AND section_name = :sname ORDER BY section_id DESC LIMIT 1");
                        $chkSid->execute([':qid' => $quote_id, ':sname' => $s_name]);
                        $section_id = intval($chkSid->fetchColumn() ?: 0);
                    }

                    if (isset($section['items']) && is_array($section['items'])) {
                        foreach ($section['items'] as $i_idx => $item) {
                            if (!is_array($item))
                                continue;
                            $i_query = "INSERT INTO quote_items 
                                        (section_id, particulars, brand, unit, quantity, used_quantity, width, height, sft, hsn_sac, image_url, rate, rate_per_sft, gst_rate, discount_percent, category, amount, pricing_mode, display_order) 
                                        VALUES (:s_id, :part, :brand, :unit, :qty, :u_qty, :width, :height, :sft, :hsn, :img, :rate, :r_sft, :gst, :disc, :cat, :amt, :pmode, :order)";
                            $i_stmt = $this->conn->prepare($i_query);
                            $p_mode = !empty($item['pricing_mode']) ? $item['pricing_mode'] : (empty($item['width']) && empty($item['height']) && empty($item['sft']) ? 'lumpsum' : 'dimensions');
                            $i_stmt->execute([
                                's_id' => $section_id,
                                'part' => !empty($item['particulars']) ? $item['particulars'] : 'Item',
                                'brand' => $item['brand'] ?? '',
                                'unit' => $item['unit'] ?? '',
                                'qty' => $item['quantity'] ?? 0,
                                'u_qty' => $item['used_quantity'] ?? 0,
                                'width' => $item['width'] ?? '',
                                'height' => $item['height'] ?? '',
                                'sft' => $item['sft'] ?? '',
                                'hsn' => $item['hsn_sac'] ?? '',
                                'img' => $item['image_url'] ?? '',
                                'rate' => $item['rate'] ?? 0,
                                'r_sft' => $item['rate_per_sft'] ?? 0,
                                'gst' => $item['gst_rate'] ?? 18,
                                'disc' => $item['discount_percent'] ?? 0,
                                'cat' => $item['category'] ?? '',
                                'amt' => $item['amount'] ?? 0,
                                'pmode' => $p_mode,
                                'order' => $i_idx
                            ]);
                        }
                    }
                }
            }

            // Project budget update:
            // STRICT IMMUTABILITY RULE: Projects retain their initial quotation budget until QC officially approves the final quotation!
            // Designer quote revisions, drafts, and version saves MUST NEVER mutate project total_budget.
            try {
                // Check if project exists in projects table
                $chkProjInit = $this->conn->prepare("SELECT initial_quote_amount, total_budget FROM projects WHERE (project_id = :pid OR project_code = :pcode) LIMIT 1");
                $chkProjInit->execute(['pid' => $project_id, 'pcode' => $raw_p_id]);
                $projRow = $chkProjInit->fetch(PDO::FETCH_ASSOC);

                if ($projRow) {
                    $hasProjInitial = floatval($projRow['initial_quote_amount'] ?? 0) > 0;
                    if (!$hasProjInitial) {
                        // Lock initial quote amount to existing total_budget or version 1 quote
                        $initAmt = floatval($projRow['total_budget'] ?? 0);
                        if ($initAmt <= 0) {
                            $q1 = $this->conn->prepare("SELECT total_amount FROM quotes WHERE (project_id = :pid OR project_id = :rawid) AND (is_initial = 1 OR version = 1) ORDER BY version ASC LIMIT 1");
                            $q1->execute(['pid' => $project_id, 'rawid' => $raw_p_id]);
                            $initAmt = floatval($q1->fetchColumn() ?: 0);
                        }
                        if ($initAmt <= 0 && $new_version === 1) {
                            $initAmt = floatval($data['total_amount'] ?? 0);
                        }
                        if ($initAmt > 0) {
                            $this->conn->prepare("UPDATE projects SET initial_quote_amount = :amt, total_budget = :amt WHERE (project_id = :pid OR project_code = :pcode) AND (initial_quote_amount IS NULL OR initial_quote_amount = 0)")->execute(['amt' => $initAmt, 'pid' => $project_id, 'pcode' => $raw_p_id]);
                        }
                    }
                    // For an existing project, saving a quote revision (new version or draft) MUST NEVER mutate projects.total_budget!
                } else {
                    $isMarkedInitial = ($new_version === 1) && (!empty($data['is_initial_quote']) || !empty($data['is_initial']));
                    if ($isMarkedInitial) {
                        $allIds = $this->resolveIdentifiers($project_id ?: $raw_p_id);
                        if (empty($allIds)) $allIds = [(string)($project_id ?: $raw_p_id)];
                        $placeholders = implode(',', array_fill(0, count($allIds), '?'));

                        $update_budget = "UPDATE projects 
                                          SET initial_quote_amount = ?, total_budget = ? 
                                          WHERE (project_id IN ($placeholders) OR project_code IN ($placeholders))
                                            AND (initial_quote_amount IS NULL OR initial_quote_amount = 0)
                                            AND COALESCE(is_final_quote_approved, 0) = 0";
                        $params = array_merge([$data['total_amount'] ?? 0, $data['total_amount'] ?? 0], $allIds, $allIds);
                        $this->conn->prepare($update_budget)->execute($params);

                        try {
                            $upLead = $this->conn->prepare("UPDATE leads 
                                                            SET initial_quote_amount = ?, total_budget = ? 
                                                            WHERE (lead_id IN ($placeholders) OR manual_client_id IN ($placeholders))
                                                              AND (initial_quote_amount IS NULL OR initial_quote_amount = 0)");
                            $upLead->execute(array_merge([$data['total_amount'] ?? 0, $data['total_amount'] ?? 0], $allIds, $allIds));
                        } catch (Exception $e) {}
                    }
                }
            } catch (Exception $e) {}

            // If quote marked as finalized, update ONLY the quote record (never project budget before QC approval)
            if (!empty($data['is_final_version']) || $status === 'Finalized') {
                try {
                    $this->conn->prepare("UPDATE quotes SET status = 'Finalized', is_final = 1 WHERE quote_id = :qid")->execute(['qid' => $quote_id]);
                } catch (Exception $e) {}
            }

            // Clean up any empty draft records for this project so they do not override the saved version
            try {
                $del_draft = "DELETE FROM quotes WHERE (project_id = :p_id OR project_id = :raw_id) AND save_type = 'draft' AND (total_amount = 0 OR version = 0)";
                $this->conn->prepare($del_draft)->execute(['p_id' => $project_id, 'raw_id' => $raw_p_id]);
            } catch (Exception $e) {}

            if ($this->conn->inTransaction()) {
                $this->conn->commit();
            }

            return [
                "success" => true,
                "message" => "Quote version saved successfully.",
                "quote_id" => $quote_id,
                "version" => $new_version,
                "data" => [
                    "quote_id" => $quote_id,
                    "quote_number" => $quote_number,
                    "version" => $new_version,
                    "label" => $label,
                    "status" => $status
                ]
            ];
        } catch (Exception $e) {
            file_put_contents('debug_quote.log', "SAVE ERROR: " . $e->getMessage() . "\n", FILE_APPEND);
            if ($this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            return ["success" => false, "message" => "Error saving quote: " . $e->getMessage()];
        }
    }

    /**
     * Send to QC — triggers QC notification email only when explicitly requested via 'Send to QC' button.
     * Subject format: Uploaded - Quote Version - [Rev No.] | Quality Check | Project ID [Project ID]
     */
    public function sendToQC($data)
    {
        try {
            $raw_p_id = $data['project_id'] ?? 0;
            $project_id = intval(preg_replace('/[^0-9]/', '', (string)$raw_p_id));
            $version_num = intval($data['version_num'] ?? $data['version'] ?? 1);
            $revNo = 'Rev-' . sprintf('%02d', $version_num);

            $proj_code = 'PR_' . ($project_id > 0 ? $project_id : time());

            // Send QC notification email via MailHelper
            $res = MailHelper::sendQCNotification($this->conn, 'uploaded', [
                'project_id' => $proj_code,
                'rev_no' => $revNo,
                'project_name' => $data['project_name'] ?? $data['client_name'] ?? 'Quotation Project',
                'customer_name' => $data['client_name'] ?? 'Client',
                'designer_name' => $data['designer_name'] ?? 'Designer',
                'qc_date' => date('d M Y')
            ]);

            return [
                "success" => true,
                "message" => "Quotation version sent to Quality Check (QC) successfully!",
                "data" => $res
            ];
        } catch (Exception $e) {
            return ["success" => false, "message" => "Error sending to QC: " . $e->getMessage()];
        }
    }

    public function getApprovedQuote($project_id, $is_used_quote = false, $client_name = null)
    {
        $raw_id = trim((string)$project_id);
        $cname = trim($client_name ?? '');
        $clean_cname = trim(preg_replace('/^(mr\.|mrs\.|ms\.|dr\.|m\/s)\s+/i', '', $cname));

        $quote = null;
        $allIds = [];
        if (!empty($raw_id) && $raw_id !== 'standalone') {
            $allIds = $this->resolveIdentifiers($raw_id);
            if (!in_array($raw_id, $allIds)) {
                $allIds[] = $raw_id;
            }
            $clean_id = intval(preg_replace('/[^0-9]/', '', $raw_id));
            if ($clean_id > 0 && !in_array((string)$clean_id, $allIds)) {
                $allIds[] = (string)$clean_id;
            }

            try {
                $pStmt = $this->conn->prepare("SELECT p.project_id, p.project_code, p.initial_quote_amount, p.total_budget, p.is_final_quote_approved, p.status as project_status, c.client_code, c.name as client_name, c.converted_from_lead_id, l.lead_id, l.manual_client_id, l.client_name as lead_client_name, l.initial_quote_amount as lead_initial_quote_amount 
                                               FROM projects p 
                                               LEFT JOIN clients c ON p.client_id = c.client_id 
                                               LEFT JOIN leads l ON (c.converted_from_lead_id = l.lead_id OR p.project_id = l.lead_id)
                                               WHERE p.project_id = :pid OR p.project_code = :pcode OR (l.lead_id = :lid AND l.lead_id > 0) OR (l.manual_client_id = :mcid AND l.manual_client_id != '')");
                $pStmt->execute([':pid' => $clean_id, ':pcode' => $raw_id, ':lid' => $clean_id, ':mcid' => $raw_id]);
                $pRow = $pStmt->fetch(PDO::FETCH_ASSOC);
                if ($pRow) {
                    if (!empty($pRow['project_id'])) $allIds[] = (string)$pRow['project_id'];
                    if (!empty($pRow['project_code'])) $allIds[] = (string)$pRow['project_code'];
                    if (!empty($pRow['client_code'])) $allIds[] = (string)$pRow['client_code'];
                    if (!empty($pRow['converted_from_lead_id'])) $allIds[] = (string)$pRow['converted_from_lead_id'];
                    if (!empty($pRow['lead_id'])) $allIds[] = (string)$pRow['lead_id'];
                    if (!empty($pRow['manual_client_id'])) $allIds[] = (string)$pRow['manual_client_id'];
                    if (empty($cname)) {
                        if (!empty($pRow['client_name'])) $cname = $pRow['client_name'];
                        elseif (!empty($pRow['lead_client_name'])) $cname = $pRow['lead_client_name'];
                    }
                }
            } catch (Exception $e) {}

            $allIds = array_values(array_unique(array_filter($allIds)));

            if (!empty($allIds)) {
                $placeholders = implode(',', array_fill(0, count($allIds), '?'));

                // 1. First priority: quotation with explicit QC approval (is_qc_approved = 1 or status = 'qc_approved')
                $q_qc = "SELECT q.quote_id FROM quotes q
                         WHERE (q.project_id IN ($placeholders) OR q.quote_number IN ($placeholders))
                           AND (q.is_qc_approved = 1 OR q.status = 'qc_approved')
                         ORDER BY q.version DESC, q.quote_id DESC LIMIT 1";
                $s_qc = $this->conn->prepare($q_qc);
                $s_qc->execute(array_merge($allIds, $allIds));
                $quote = $s_qc->fetch(PDO::FETCH_ASSOC);

                // STRICT IMMUTABILITY RULE:
                // If QC has NOT officially approved a newer version, the official quotation for the Balance Sheet
                // is STRICTLY the INITIAL agreed quotation. Unapproved designer revisions, drafts, and higher versions
                // are strictly excluded until QC approval!
                if (!$quote) {
                    // 2. Initial quotation (marked is_initial = 1, or version = 1, or earliest quote)
                    $q_init = "SELECT q.quote_id FROM quotes q
                               WHERE (q.project_id IN ($placeholders) OR q.quote_number IN ($placeholders))
                                 AND (q.is_initial = 1 OR q.version = 1 OR q.extra_data LIKE '%\"is_initial_quote\":true%')
                               ORDER BY (CASE WHEN q.is_initial = 1 THEN 1 ELSE 0 END) DESC, q.version ASC, q.quote_id ASC LIMIT 1";
                    $s_init = $this->conn->prepare($q_init);
                    $s_init->execute(array_merge($allIds, $allIds));
                    $quote = $s_init->fetch(PDO::FETCH_ASSOC);
                }

                // 3. Fallback: earliest quote
                if (!$quote) {
                    $q_early = "SELECT q.quote_id FROM quotes q
                                WHERE (q.project_id IN ($placeholders) OR q.quote_number IN ($placeholders))
                                ORDER BY q.version ASC, q.quote_id ASC LIMIT 1";
                    $s_early = $this->conn->prepare($q_early);
                    $s_early->execute(array_merge($allIds, $allIds));
                    $quote = $s_early->fetch(PDO::FETCH_ASSOC);
                }
            }
        }

        if (!$quote) return null;
        $quoteDetails = $this->getQuoteDetails($quote['quote_id']);
        if ($quoteDetails) {
            $isExplicitQcApproved = !empty($quoteDetails['is_qc_approved']) || ($quoteDetails['status'] ?? '') === 'qc_approved';
            if (!$isExplicitQcApproved) {
                // Not QC approved yet -> strictly lock total_amount to the initial quote amount
                $lockedInitAmt = 0;
                if (!empty($pRow['initial_quote_amount']) && floatval($pRow['initial_quote_amount']) > 0) {
                    $lockedInitAmt = floatval($pRow['initial_quote_amount']);
                } elseif (!empty($pRow['lead_initial_quote_amount']) && floatval($pRow['lead_initial_quote_amount']) > 0) {
                    $lockedInitAmt = floatval($pRow['lead_initial_quote_amount']);
                } elseif (!empty($pRow['total_budget']) && floatval($pRow['total_budget']) > 0) {
                    $lockedInitAmt = floatval($pRow['total_budget']);
                }
                if ($lockedInitAmt > 0) {
                    $quoteDetails['total_amount'] = $lockedInitAmt;
                } else if (!empty($quoteDetails['total_amount']) && floatval($quoteDetails['total_amount']) > 0) {
                    // Cache to projects table if missing
                    if (!empty($pRow['project_id'])) {
                        try {
                            $this->conn->prepare("UPDATE projects SET initial_quote_amount = :amt WHERE project_id = :pid AND (initial_quote_amount IS NULL OR initial_quote_amount = 0)")->execute([':amt' => floatval($quoteDetails['total_amount']), ':pid' => $pRow['project_id']]);
                        } catch (Exception $e) {}
                    }
                }
                $quoteDetails['is_initial'] = 1;
                $quoteDetails['is_qc_approved'] = 0;
            }
        }
        return $quoteDetails;
    }

    public function getLatestQuote($project_id, $is_used_quote = false, $client_name = null)
    {
        $raw_id = trim((string)$project_id);
        $cname = trim($client_name ?? '');
        $clean_cname = trim(preg_replace('/^(mr\.|mrs\.|ms\.|dr\.|m\/s)\s+/i', '', $cname));

        $quote = null;

        // 1. Resolve all linked identifiers (project_id, project_code, lead_id, manual_client_id)
        $allIds = [];
        if (!empty($raw_id) && $raw_id !== 'standalone') {
            $allIds = $this->resolveIdentifiers($raw_id);
            if (!in_array($raw_id, $allIds)) {
                $allIds[] = $raw_id;
            }
            $clean_id = intval(preg_replace('/[^0-9]/', '', $raw_id));
            if ($clean_id > 0 && !in_array((string)$clean_id, $allIds)) {
                $allIds[] = (string)$clean_id;
            }

            // Also check linked client/lead from projects table if raw_id is a project_id or project_code
            try {
                $pStmt = $this->conn->prepare("SELECT p.project_id, p.project_code, c.client_code, c.name as client_name, c.converted_from_lead_id, l.lead_id, l.manual_client_id, l.client_name as lead_client_name 
                                               FROM projects p 
                                               LEFT JOIN clients c ON p.client_id = c.client_id 
                                               LEFT JOIN leads l ON (c.converted_from_lead_id = l.lead_id OR p.project_id = l.lead_id)
                                               WHERE p.project_id = :pid OR p.project_code = :pcode OR (l.lead_id = :lid AND l.lead_id > 0) OR (l.manual_client_id = :mcid AND l.manual_client_id != '')");
                $pStmt->execute([':pid' => $clean_id, ':pcode' => $raw_id, ':lid' => $clean_id, ':mcid' => $raw_id]);
                $pRow = $pStmt->fetch(PDO::FETCH_ASSOC);
                if ($pRow) {
                    if (!empty($pRow['project_id'])) $allIds[] = (string)$pRow['project_id'];
                    if (!empty($pRow['project_code'])) $allIds[] = (string)$pRow['project_code'];
                    if (!empty($pRow['client_code'])) $allIds[] = (string)$pRow['client_code'];
                    if (!empty($pRow['converted_from_lead_id'])) $allIds[] = (string)$pRow['converted_from_lead_id'];
                    if (!empty($pRow['lead_id'])) $allIds[] = (string)$pRow['lead_id'];
                    if (!empty($pRow['manual_client_id'])) $allIds[] = (string)$pRow['manual_client_id'];
                    if (empty($cname)) {
                        if (!empty($pRow['client_name'])) $cname = $pRow['client_name'];
                        elseif (!empty($pRow['lead_client_name'])) $cname = $pRow['lead_client_name'];
                    }
                }
            } catch (Exception $e) {}

            $allIds = array_values(array_unique(array_filter($allIds)));

            if (!empty($allIds)) {
                $placeholders = implode(',', array_fill(0, count($allIds), '?'));
                $query = "SELECT q.quote_id FROM quotes q
                          WHERE q.project_id IN ($placeholders)
                             OR q.quote_number IN ($placeholders)
                          ORDER BY q.updated_at DESC, q.created_at DESC, q.quote_id DESC LIMIT 1";
                $stmt = $this->conn->prepare($query);
                $stmt->execute(array_merge($allIds, $allIds));
                $quote = $stmt->fetch(PDO::FETCH_ASSOC);
            }
        }

        // 2. SECONDARY FALLBACK BY CLIENT NAME MATCH
        if (!$quote && (!empty($cname) || !empty($clean_cname))) {
            $search_name = !empty($clean_cname) ? $clean_cname : $cname;
            $q_name = "SELECT quote_id FROM quotes 
                       WHERE (
                           LOWER(subtitle) = :cname 
                           OR LOWER(subtitle) = :clean_cname
                           OR LOWER(subtitle) LIKE :cname_like 
                           OR :cname_lower LIKE CONCAT('%', LOWER(subtitle), '%')
                       ) 
                       ORDER BY updated_at DESC, created_at DESC, quote_id DESC LIMIT 1";
            $s_name = $this->conn->prepare($q_name);
            $s_name->execute([
                'cname' => strtolower($cname),
                'clean_cname' => strtolower($clean_cname),
                'cname_like' => '%' . strtolower($search_name) . '%',
                'cname_lower' => strtolower($cname)
            ]);
            $quote = $s_name->fetch(PDO::FETCH_ASSOC);
        }

        // 3. DO NOT FALLBACK TO UNRELATED QUOTE IF A PROJECT ID OR CLIENT NAME WAS SPECIFIED
        if (!$quote)
            return null;

        return $this->getQuoteDetails($quote['quote_id']);
    }

    public function getQuoteHistory($project_id, $is_used_quote = false, $user_id = null, $role = null)
    {
        $designerContext = !empty($user_id) ? $this->resolveDesignerAssignments($user_id, $role) : null;
        if ($designerContext !== null) {
            $checkPid = strtolower(trim(strval($project_id)));
            $cleanNum = preg_replace('/\D/', '', $checkPid);
            $hasAccess = isset($designerContext['project_ids'][$checkPid]) ||
                         isset($designerContext['lead_ids'][$checkPid]) ||
                         isset($designerContext['codes'][$checkPid]) ||
                         ($cleanNum !== '' && (isset($designerContext['project_ids'][$cleanNum]) || isset($designerContext['lead_ids'][$cleanNum])));
            if (!$hasAccess) {
                return [];
            }
        }

        $allIds = $this->resolveIdentifiers($project_id);
        if (empty($allIds)) {
            $clean_id = intval(preg_replace('/[^0-9]/', '', (string)$project_id));
            $allIds = array_values(array_unique(array_filter([$clean_id, (string)$project_id])));
        }

        $placeholders = implode(',', array_fill(0, count($allIds), '?'));
        $qnumClause = "";
        $qnumLiterals = array_map(function($id) { return "'QTN-" . addslashes($id) . "'"; }, $allIds);
        if (!empty($qnumLiterals)) {
            $qnumClause = " OR quote_number IN (" . implode(',', $qnumLiterals) . ") ";
        }
        $query = "SELECT q.quote_id, q.project_id, q.quote_number, q.version, q.total_amount, q.discount_percent, q.subtitle, q.created_at, q.updated_at, q.created_by, q.updated_by, q.status, q.save_type, q.label, q.extra_data, q.ack_status, q.acknowledged_at, q.ack_email_sent_at,
                         COALESCE(NULLIF(uc.name, ''), 'Admin Sukku') as prepared_by_name,
                         COALESCE(NULLIF(uc.role, ''), 'admin') as prepared_by_role,
                         COALESCE(NULLIF(uu.name, ''), NULLIF(uc.name, ''), 'Admin Sukku') as updated_by_name,
                         COALESCE(NULLIF(uu.role, ''), NULLIF(uc.role, ''), 'admin') as updated_by_role
                  FROM quotes q
                  LEFT JOIN users uc ON (q.created_by = uc.user_id AND q.created_by > 0)
                  LEFT JOIN users uu ON (q.updated_by = uu.user_id AND q.updated_by > 0)
                  WHERE (q.project_id IN ($placeholders) $qnumClause)
                  OR LOWER(q.subtitle) IN (SELECT LOWER(client_name) FROM leads WHERE lead_id IN ($placeholders) OR manual_client_id IN ($placeholders))
                  ORDER BY q.version DESC, q.quote_id DESC";
        
        $params = array_merge($allIds, $allIds, $allIds);
        $stmt = $this->conn->prepare($query);
        $stmt->execute($params);
        $quotes = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($quotes as &$quote) {
            $details = $this->getQuoteDetails($quote['quote_id']);
            if ($details) {
                $quote['sections'] = $details['sections'] ?? [];
                if (isset($details['extra_data_parsed'])) {
                    $quote['extra_data_parsed'] = $details['extra_data_parsed'];
                    if (isset($details['extra_data_parsed']['is_initial_quote'])) {
                        $quote['is_initial_quote'] = $details['extra_data_parsed']['is_initial_quote'];
                    }
                }
                if (isset($details['is_initial_quote'])) {
                    $quote['is_initial_quote'] = $details['is_initial_quote'];
                }
            }
        }

        return $quotes;
    }

    public function deleteQuote($quote_id, $user_id = null)
    {
        $quote_id = intval($quote_id);
        if ($quote_id <= 0) {
            return ["success" => false, "message" => "Invalid quote ID"];
        }
        try {
            $stmt = $this->conn->prepare("UPDATE quotes SET is_deleted = 1, deleted_at = NOW(), deleted_by = :uid WHERE quote_id = :qid");
            $stmt->execute([
                'uid' => !empty($user_id) ? intval($user_id) : null,
                'qid' => $quote_id
            ]);
            return [
                "success" => true,
                "message" => "Quotation moved to Trash. It can be recovered within 30 days."
            ];
        } catch (Exception $e) {
            return ["success" => false, "message" => "Failed to delete quote: " . $e->getMessage()];
        }
    }

    public function restoreQuote($quote_id)
    {
        $quote_id = intval($quote_id);
        if ($quote_id <= 0) {
            return ["success" => false, "message" => "Invalid quote ID"];
        }
        try {
            $checkStmt = $this->conn->prepare("SELECT quote_id, quote_number, deleted_at, DATEDIFF(NOW(), deleted_at) as days_deleted FROM quotes WHERE quote_id = :qid AND is_deleted = 1");
            $checkStmt->execute(['qid' => $quote_id]);
            $qData = $checkStmt->fetch(PDO::FETCH_ASSOC);
            if (!$qData) {
                return ["success" => false, "message" => "Quote not found or is not currently in trash"];
            }

            $days = intval($qData['days_deleted'] ?? 0);
            if ($days > 30) {
                return ["success" => false, "message" => "Recovery window expired. This quote was deleted {$days} days ago and can only be recovered within 30 days."];
            }

            $stmt = $this->conn->prepare("UPDATE quotes SET is_deleted = 0, deleted_at = NULL, deleted_by = NULL WHERE quote_id = :qid");
            $stmt->execute(['qid' => $quote_id]);
            return [
                "success" => true,
                "message" => "Quotation " . ($qData['quote_number'] ?: ('QTN-' . $quote_id)) . " recovered successfully!"
            ];
        } catch (Exception $e) {
            return ["success" => false, "message" => "Failed to restore quote: " . $e->getMessage()];
        }
    }

    public function permanentDeleteQuote($quote_id)
    {
        $quote_id = intval($quote_id);
        if ($quote_id <= 0) {
            return ["success" => false, "message" => "Invalid quote ID"];
        }
        try {
            $this->conn->beginTransaction();
            // Delete items
            $secStmt = $this->conn->prepare("SELECT section_id FROM quote_sections WHERE quote_id = :qid");
            $secStmt->execute(['qid' => $quote_id]);
            $sections = $secStmt->fetchAll(PDO::FETCH_COLUMN);
            if (!empty($sections)) {
                $secPlaceholders = implode(',', array_fill(0, count($sections), '?'));
                $delItems = $this->conn->prepare("DELETE FROM quote_items WHERE section_id IN ($secPlaceholders)");
                $delItems->execute($sections);
            }
            // Delete sections
            $delSec = $this->conn->prepare("DELETE FROM quote_sections WHERE quote_id = :qid");
            $delSec->execute(['qid' => $quote_id]);
            // Delete quote
            $delQ = $this->conn->prepare("DELETE FROM quotes WHERE quote_id = :qid");
            $delQ->execute(['qid' => $quote_id]);
            $this->conn->commit();
            return ["success" => true, "message" => "Quote permanently deleted"];
        } catch (Exception $e) {
            if ($this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            return ["success" => false, "message" => "Failed to permanently delete quote: " . $e->getMessage()];
        }
    }

    private function resolveDesignerAssignments($user_id, $role = null)
    {
        if (empty($user_id)) {
            return null;
        }
        $uRole = strtolower($role ?? '');
        if (empty($uRole)) {
            $uStmt = $this->conn->prepare("SELECT role FROM users WHERE user_id = :uid LIMIT 1");
            $uStmt->execute([':uid' => $user_id]);
            $uRole = strtolower($uStmt->fetchColumn() ?: '');
        }
        $isAdmin = in_array($uRole, ['admin', 'superadmin', 'administrator', 'manager', 'sales_manager', 'general_manager', 'accountant']) || strpos($uRole, 'admin') !== false || strpos($uRole, 'manager') !== false;
        $isDesigner = !$isAdmin && (in_array($uRole, ['d1', 'd2', 'designer', 'lead_designer', 'associate_designer', 'ad', 'graphic_designer', 'gd']) || strpos($uRole, 'design') !== false || strpos($uRole, 'd1') !== false || strpos($uRole, 'd2') !== false);

        if (!$isDesigner) {
            return null; // Not restricted
        }

        $assignedLeadIds = [];
        $assignedProjectIds = [];
        $assignedCodes = [];
        $assignedClientNames = [];

        // 1. Leads assigned to this designer
        $ldStmt = $this->conn->prepare("SELECT lead_id, manual_client_id, client_name FROM leads 
                                        WHERE d1_assigned_to = :uid 
                                           OR FIND_IN_SET(:uid, d1_assigned_to) 
                                           OR associate_designer_assigned_id = :uid 
                                           OR FIND_IN_SET(:uid, associate_designer_assigned_id) 
                                           OR assigned_to = :uid");
        $ldStmt->execute([':uid' => $user_id]);
        while ($row = $ldStmt->fetch(PDO::FETCH_ASSOC)) {
            $lid = strval($row['lead_id']);
            $assignedLeadIds[$lid] = true;
            $assignedProjectIds[$lid] = true;
            if (!empty($row['manual_client_id'])) {
                $mc = strtolower(trim($row['manual_client_id']));
                $assignedCodes[$mc] = true;
                $assignedProjectIds[$mc] = true;
            }
            if (!empty($row['client_name'])) {
                $assignedClientNames[strtolower(trim($row['client_name']))] = true;
            }
        }

        // 2. Projects assigned to this designer
        $paStmt = $this->conn->prepare("SELECT p.project_id, p.project_code, p.project_name FROM projects p 
                                        LEFT JOIN project_assignments pa ON p.project_id = pa.project_id 
                                        WHERE (pa.user_id = :uid AND pa.status = 'active') OR p.created_by = :uid");
        $paStmt->execute([':uid' => $user_id]);
        while ($row = $paStmt->fetch(PDO::FETCH_ASSOC)) {
            $pid = strval($row['project_id']);
            $assignedProjectIds[$pid] = true;
            if (!empty($row['project_code'])) {
                $pc = strtolower(trim($row['project_code']));
                $assignedCodes[$pc] = true;
                $assignedProjectIds[$pc] = true;
            }
            if (!empty($row['project_name'])) {
                $assignedClientNames[strtolower(trim($row['project_name']))] = true;
            }
        }

        return [
            'is_designer' => true,
            'user_id' => $user_id,
            'lead_ids' => $assignedLeadIds,
            'project_ids' => $assignedProjectIds,
            'codes' => $assignedCodes,
            'client_names' => $assignedClientNames
        ];
    }

    public function canDesignerModifyProject($project_id, $user_id, $role = null, $data = [])
    {
        if (empty($user_id)) {
            return true;
        }

        if (empty($role)) {
            try {
                $uStmt = $this->conn->prepare("SELECT role FROM users WHERE user_id = :uid");
                $uStmt->execute([':uid' => $user_id]);
                $role = $uStmt->fetchColumn();
            } catch (Exception $e) {}
        }

        $r = strtolower(trim(strval($role ?? '')));
        $isDesigner = in_array($r, ['d1', 'd2', 'designer', 'lead_designer', 'associate_designer', 'ad', 'graphic_designer', 'gd']);
        $isAdmin = in_array($r, ['admin', 'superadmin', 'administrator', 'manager', 'sales_manager', 'general_manager', 'accountant', 'owner']);
        if (!$isDesigner || $isAdmin) {
            return true;
        }

        // Allow duplicate quote creation or if designer is creator
        if (!empty($data['is_duplicate']) || (!empty($data['created_by']) && intval($data['created_by']) === intval($user_id))) {
            return true;
        }

        $assignments = $this->resolveDesignerAssignments($user_id, $role);
        $cleanPid = strtolower(trim(strval($project_id ?? '')));
        $numPid = preg_replace('/\D/', '', $cleanPid);

        if (isset($assignments['project_ids'][$cleanPid]) ||
            isset($assignments['lead_ids'][$cleanPid]) ||
            isset($assignments['codes'][$cleanPid]) ||
            ($numPid !== '' && (isset($assignments['project_ids'][$numPid]) || isset($assignments['lead_ids'][$numPid])))) {
            return true;
        }

        if (!empty($data['project_code'])) {
            $pCode = strtolower(trim(strval($data['project_code'])));
            $cleanCode = preg_replace('/\D/', '', $pCode);
            if (isset($assignments['codes'][$pCode]) || isset($assignments['project_ids'][$pCode]) || ($cleanCode !== '' && isset($assignments['lead_ids'][$cleanCode]))) {
                return true;
            }
        }

        if (!empty($data['lead_id'])) {
            $lId = strval($data['lead_id']);
            if (isset($assignments['lead_ids'][$lId])) {
                return true;
            }
        }

        // Check if existing quote was created by this user
        if ($cleanPid !== '' || $numPid !== '') {
            try {
                $qCheck = $this->conn->prepare("SELECT created_by, updated_by FROM quotes WHERE project_id = :pid OR quote_id = :qid ORDER BY quote_id DESC LIMIT 1");
                $qCheck->execute([':pid' => $cleanPid, ':qid' => $cleanPid]);
                $existingQ = $qCheck->fetch(PDO::FETCH_ASSOC);
                if ($existingQ && (intval($existingQ['created_by']) === intval($user_id) || intval($existingQ['updated_by']) === intval($user_id))) {
                    return true;
                }
            } catch (Exception $e) {}
        }

        return false;
    }

    public function getAllQuotes($user_id = null, $role = null)
    {
        try {
            $this->conn->exec("SET SESSION sql_mode=(SELECT REPLACE(@@sql_mode,'ONLY_FULL_GROUP_BY',''))");
        } catch (Exception $e) {}

        // Auto-correct any corrupt rows where client rejected but status was mistakenly marked converted or approved
        try {
            $this->conn->exec("UPDATE quotes SET ack_status = 'rejected' WHERE (status = 'order_lost' OR status = 'rejected') AND ack_status != 'rejected'");
            $this->conn->exec("UPDATE quotes SET status = 'order_lost' WHERE ack_status = 'rejected' AND status != 'order_lost'");
            // Sync approved status for accepted quotes that are not yet converted
            $this->conn->exec("UPDATE quotes SET status = 'approved' WHERE ack_status = 'accepted' AND status != 'approved' AND status != 'order_converted' AND status != 'order_lost' AND status != 'rejected'");
            // Auto-heal any corrupt quotes where status was mistakenly set to order_converted without client acceptance
            $this->conn->exec("UPDATE quotes SET status = 'draft' WHERE status = 'order_converted' AND save_type = 'draft' AND (ack_status IS NULL OR ack_status != 'accepted')");
            $this->conn->exec("UPDATE quotes SET status = 'booked' WHERE status = 'order_converted' AND (save_type IS NULL OR save_type != 'draft') AND (ack_status IS NULL OR ack_status != 'accepted')");
        } catch (Exception $e) {}

        $designerContext = !empty($user_id) ? $this->resolveDesignerAssignments($user_id, $role) : null;

        // 1. Get all quotes ordered by latest version DESC (exclude binary pdf_snapshot/html_snapshot)
        $query = "SELECT q.quote_id, q.project_id, q.subtitle, q.quote_number, q.version, q.total_amount, q.discount_percent, q.status, q.created_by, q.updated_by, q.created_at, q.updated_at, q.save_type, q.label, q.has_snapshot, q.extra_data, q.is_initial, q.is_qc_approved, q.ack_token, q.acknowledged_at, q.acknowledged_ip, q.ack_email_sent_at, q.ack_status, q.lead_id,
                         COALESCE(q.is_deleted, 0) as is_deleted, q.deleted_at, q.deleted_by,
                         DATEDIFF(NOW(), q.deleted_at) as days_since_delete,
                         GREATEST(0, 30 - COALESCE(DATEDIFF(NOW(), q.deleted_at), 0)) as recovery_days_remaining,
                         COALESCE(NULLIF(ud.name, ''), 'Admin') as deleted_by_name,
                         COALESCE(NULLIF(ul_d1.name, ''), NULLIF(u_pa.name, ''), NULLIF(uc.name, ''), NULLIF(ul.name, ''), NULLIF(up.name, ''), 'Admin Sukku') as prepared_by_name,
                         COALESCE(NULLIF(ul_d1.role, ''), NULLIF(u_pa.role, ''), NULLIF(uc.role, ''), NULLIF(ul.role, ''), NULLIF(up.role, ''), 'admin') as prepared_by_role,
                         COALESCE(NULLIF(uu.name, ''), NULLIF(ul_d1.name, ''), NULLIF(uc.name, ''), NULLIF(ul.name, ''), NULLIF(up.name, ''), 'Admin Sukku') as updated_by_name,
                         COALESCE(NULLIF(uu.role, ''), NULLIF(ul_d1.role, ''), NULLIF(uc.role, ''), NULLIF(ul.role, ''), NULLIF(up.role, ''), 'admin') as updated_by_role,
                         COALESCE(NULLIF(p.project_code, ''), NULLIF(c.client_code, ''), NULLIF(l.manual_client_id, ''), CONCAT('PR-', l.lead_id)) as project_code,
                         COALESCE(NULLIF(p.project_name, ''), q.subtitle, 'Estimation Project') as project_name, 
                         COALESCE(NULLIF(c.name, ''), NULLIF(l.client_name, ''), q.subtitle, 'Client') as client_name,
                         COALESCE(c.email, l.email, c2.email) as client_email
                  FROM quotes q
                  LEFT JOIN users uc ON (q.created_by = uc.user_id AND q.created_by > 0)
                  LEFT JOIN users uu ON (q.updated_by = uu.user_id AND q.updated_by > 0)
                  LEFT JOIN users ud ON (q.deleted_by = ud.user_id AND q.deleted_by > 0)
                  LEFT JOIN projects p ON (q.project_id = p.project_id OR q.project_id = CAST(p.project_id AS CHAR) OR q.project_id = p.project_code)
                  LEFT JOIN users up ON (p.created_by = up.user_id AND p.created_by > 0)
                  LEFT JOIN clients c ON p.client_id = c.client_id
                  LEFT JOIN leads l ON ((q.lead_id IS NOT NULL AND q.lead_id > 0 AND q.lead_id = l.lead_id) OR q.project_id = l.lead_id OR q.project_id = CAST(l.lead_id AS CHAR) OR q.project_id = CONCAT('lead-', l.lead_id) OR q.project_id = l.manual_client_id OR (q.subtitle IS NOT NULL AND q.subtitle != '' AND (q.subtitle = l.client_name OR LOWER(q.subtitle) LIKE CONCAT('%', LOWER(l.client_name), '%'))))
                  LEFT JOIN clients c2 ON (c.client_id IS NULL AND q.subtitle IS NOT NULL AND q.subtitle != '' AND LOWER(c2.name) = LOWER(q.subtitle))
                  LEFT JOIN users ul ON (COALESCE(NULLIF(l.d1_assigned_to, 0), NULLIF(l.assigned_to, 0), NULLIF(l.created_by, 0)) = ul.user_id)
                  LEFT JOIN users ul_d1 ON (NULLIF(l.d1_assigned_to, 0) = ul_d1.user_id)
                  LEFT JOIN project_assignments pa_d ON ((p.project_id = pa_d.project_id OR l.lead_id = pa_d.project_id) AND pa_d.status = 'active' AND (pa_d.role LIKE '%design%' OR pa_d.role IN ('d1', 'd2')))
                  LEFT JOIN users u_pa ON (pa_d.user_id = u_pa.user_id)
                  ORDER BY q.updated_at DESC, q.created_at DESC, q.quote_id DESC";
        $stmt = $this->conn->prepare($query);
        $stmt->execute();
        $raw_quotes = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Filter quotes for designer: STRICTLY ONLY their assigned leads/projects OR quotes created/updated by them
        if ($designerContext !== null) {
            $raw_quotes = array_filter($raw_quotes, function($q) use ($designerContext, $user_id) {
                // If designer created or updated this quotation, ALWAYS include it in table history!
                if (!empty($user_id) && (intval($q['created_by'] ?? 0) === intval($user_id) || intval($q['updated_by'] ?? 0) === intval($user_id))) {
                    return true;
                }

                $rawPid = strtolower(trim(strval($q['project_id'] ?? '')));
                $cleanPid = preg_replace('/\D/', '', $rawPid);
                $rawCode = strtolower(trim(strval($q['project_code'] ?? '')));
                $rawSub = strtolower(trim(strval($q['subtitle'] ?? '')));
                $rawClient = strtolower(trim(strval($q['client_name'] ?? '')));
                $leadId = strval($q['lead_id'] ?? '');

                if ($leadId !== '' && isset($designerContext['lead_ids'][$leadId])) return true;
                if ($cleanPid !== '' && (isset($designerContext['lead_ids'][$cleanPid]) || isset($designerContext['project_ids'][$cleanPid]))) return true;
                if ($rawPid !== '' && (isset($designerContext['project_ids'][$rawPid]) || isset($designerContext['codes'][$rawPid]))) return true;
                if ($rawCode !== '' && isset($designerContext['codes'][$rawCode])) return true;
                if ($rawClient !== '' && isset($designerContext['client_names'][$rawClient])) return true;
                if ($rawSub !== '' && isset($designerContext['client_names'][$rawSub])) return true;

                return false;
            });
        }

        // Build lead and client email map to ensure client email is NEVER blank for any quotation
        $leadEmailMap = [];
        try {
            $lQuery = $this->conn->query("SELECT lead_id, manual_client_id, client_name, email FROM leads WHERE email IS NOT NULL AND email != ''");
            $allLeadsWithEmail = $lQuery->fetchAll(PDO::FETCH_ASSOC);
            foreach ($allLeadsWithEmail as $al) {
                $em = trim($al['email']);
                if (filter_var($em, FILTER_VALIDATE_EMAIL)) {
                    if (!empty($al['lead_id'])) $leadEmailMap['id_' . $al['lead_id']] = $em;
                    if (!empty($al['manual_client_id'])) $leadEmailMap['code_' . strtolower(trim($al['manual_client_id']))] = $em;
                    if (!empty($al['client_name'])) {
                        $cNameClean = preg_replace('/[^a-zA-Z0-9]/', '', strtolower($al['client_name']));
                        if (!empty($cNameClean)) $leadEmailMap['name_' . $cNameClean] = $em;
                        $cBase = preg_replace('/(_\d+|\(\d+\)|-\d+|\s+\d+|[_-]v\d+|\b(draft|v\d+)\b)/i', '', strtolower($al['client_name']));
                        $cBaseClean = preg_replace('/[^a-zA-Z0-9]/', '', $cBase);
                        if (!empty($cBaseClean)) $leadEmailMap['base_' . $cBaseClean] = $em;
                    }
                }
            }
        } catch (\Throwable $e) {}

        $quotes = [];
        $latest_per_project = [];
        $existing_p_ids = [];
        $project_proposal_sent = [];

        foreach ($raw_quotes as $q) {
            $isDel = !empty($q['is_deleted']) && intval($q['is_deleted']) === 1;
            if ($isDel) {
                // Keep each deleted quote individually visible in the list so it can be previewed/recovered
                $latest_per_project['deleted-' . $q['quote_id']] = $q;
                continue;
            }

            $rawPid = strval($q['project_id'] ?? '');
            $cleanPid = preg_replace('/\D/', '', $rawPid);
            $groupKey = ($cleanPid !== '') ? $cleanPid : ('q-' . $q['quote_id']);

            if ($cleanPid > 0) {
                $existing_p_ids[$cleanPid] = true;
            }

            // Track if ANY quote version for this project has had proposal sent
            $hasProposal = !empty($q['ack_email_sent_at']) || in_array(strtolower(trim(strval($q['status'] ?? ''))), ['proposal', 'proposal_sent', 'sent']);
            if ($hasProposal) {
                $project_proposal_sent[$groupKey] = $q['ack_email_sent_at'] ?: ($project_proposal_sent[$groupKey] ?? date('Y-m-d H:i:s'));
            }

            if (!isset($latest_per_project[$groupKey])) {
                $latest_per_project[$groupKey] = $q;
            }
        }

        foreach ($latest_per_project as $k => &$qItem) {
            if (isset($project_proposal_sent[$k])) {
                $qItem['has_proposal_sent'] = true;
                if (empty($qItem['ack_email_sent_at'])) {
                    $qItem['ack_email_sent_at'] = $project_proposal_sent[$k];
                }
                $curSt = strtolower(trim(strval($qItem['status'] ?? '')));
                if (in_array($curSt, ['draft', 'booked', 'pending', 'new', 'opened', 'created', ''])) {
                    $qItem['status'] = 'proposal';
                }
            }
        }
        unset($qItem);

        $quotes = array_values($latest_per_project);
        foreach ($quotes as &$realQ) {
            $realQ['is_placeholder'] = false;
            $realQ['is_synthetic'] = false;
            $realQ['is_real_quote'] = true;

            // Auto-fill client_email if missing or invalid
            if (empty($realQ['client_email']) || !filter_var($realQ['client_email'], FILTER_VALIDATE_EMAIL)) {
                // 1. Check extra_data
                if (!empty($realQ['extra_data'])) {
                    $ed = is_array($realQ['extra_data']) ? $realQ['extra_data'] : json_decode($realQ['extra_data'], true);
                    if (is_array($ed)) {
                        $exEm = $ed['client_email'] ?? $ed['email'] ?? $ed['last_email_to'] ?? '';
                        if (filter_var($exEm, FILTER_VALIDATE_EMAIL)) {
                            $realQ['client_email'] = trim($exEm);
                        }
                    }
                }

                // 2. Fallback to pre-indexed lead emails (by lead_id, project_id, code, clean name, base name)
                if (empty($realQ['client_email']) || !filter_var($realQ['client_email'], FILTER_VALIDATE_EMAIL)) {
                    $qPid = strval($realQ['project_id'] ?? '');
                    $cleanPid = preg_replace('/\D/', '', $qPid);
                    $qLeadId = strval($realQ['lead_id'] ?? '');
                    $qCode = strtolower(trim(strval($realQ['project_code'] ?? '')));
                    $qSub = strval($realQ['subtitle'] ?? $realQ['client_name'] ?? '');
                    $qClean = preg_replace('/[^a-zA-Z0-9]/', '', strtolower($qSub));
                    $qBase = preg_replace('/(_\d+|\(\d+\)|-\d+|\s+\d+|[_-]v\d+|\b(draft|v\d+)\b)/i', '', strtolower($qSub));
                    $qBaseClean = preg_replace('/[^a-zA-Z0-9]/', '', $qBase);

                    $dm = [];
                    $extractedNum = '';
                    if (preg_match('/(\d{4,})/', strval($realQ['quote_number'] ?? ''), $dm)) {
                        $extractedNum = $dm[1];
                    }

                    if ($qLeadId !== '' && isset($leadEmailMap['id_' . $qLeadId])) {
                        $realQ['client_email'] = $leadEmailMap['id_' . $qLeadId];
                    } elseif ($cleanPid !== '' && isset($leadEmailMap['id_' . $cleanPid])) {
                        $realQ['client_email'] = $leadEmailMap['id_' . $cleanPid];
                    } elseif ($extractedNum !== '' && isset($leadEmailMap['id_' . $extractedNum])) {
                        $realQ['client_email'] = $leadEmailMap['id_' . $extractedNum];
                    } elseif ($qCode !== '' && isset($leadEmailMap['code_' . $qCode])) {
                        $realQ['client_email'] = $leadEmailMap['code_' . $qCode];
                    } elseif ($qClean !== '' && isset($leadEmailMap['name_' . $qClean])) {
                        $realQ['client_email'] = $leadEmailMap['name_' . $qClean];
                    } elseif ($qBaseClean !== '' && isset($leadEmailMap['base_' . $qBaseClean])) {
                        $realQ['client_email'] = $leadEmailMap['base_' . $qBaseClean];
                    }
                }
            }
        }
        unset($realQ);

        // Return only real quotations created in the quotes table.
        // Leads and projects without quotations must NOT have automatic placeholder quotes.
        return $quotes;
    }

    /**
     * Save Draft — upserts a single 'draft' row per project+status_type.
     * Always overwrites the same row (only 1 draft allowed at a time).
     */
    public function saveDraft($data)
    {
        $eff_uid = $data['user_id'] ?? ($data['created_by'] ?? ($data['updated_by'] ?? null));
        $eff_role = $data['role'] ?? ($data['user_role'] ?? null);
        $raw_p_id = $data['project_id'] ?? 0;

        if (!$this->canDesignerModifyProject($raw_p_id, $eff_uid, $eff_role, $data)) {
            return [
                "success" => false,
                "message" => "Access Denied: You are not assigned to this project by the sales team. Only the assigned designer can create or save draft quotations for this project."
            ];
        }

        try {
            // Ensure columns exist
            try { $this->conn->exec("ALTER TABLE quotes ADD COLUMN IF NOT EXISTS save_type ENUM('draft','version') NOT NULL DEFAULT 'version'"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE quotes ADD COLUMN IF NOT EXISTS label VARCHAR(100) NOT NULL DEFAULT ''"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS width VARCHAR(50) DEFAULT ''"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS height VARCHAR(50) DEFAULT ''"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS sft VARCHAR(50) DEFAULT ''"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS hsn_sac VARCHAR(50) DEFAULT ''"); } catch (Exception $e) {}

            $raw_p_id = $data['project_id'] ?? 0;
            $project_id = intval(preg_replace('/[^0-9]/', '', (string)$raw_p_id));
            if ($project_id === 0) {
                try {
                    $maxStmt = $this->conn->query("SELECT COALESCE(MAX(project_id), 1000) as max_id FROM quotes");
                    $maxRow = $maxStmt->fetch(PDO::FETCH_ASSOC);
                    $project_id = intval($maxRow['max_id'] ?? 1000) + 1;
                } catch (Exception $e) {
                    $project_id = time();
                }
            }

            $this->ensureProjectExists($project_id, $data['subtitle'] ?? '', $data['total_amount'] ?? 0, $data['project_code'] ?? '');

            try {
                $this->conn->exec("ALTER TABLE quote_items MODIFY COLUMN unit LONGTEXT DEFAULT NULL");
            } catch (Exception $e) {}
            try {
                $this->conn->exec("ALTER TABLE quote_items MODIFY COLUMN particulars LONGTEXT DEFAULT NULL");
            } catch (Exception $e) {}
            try {
                $this->conn->exec("ALTER TABLE quotes ADD COLUMN IF NOT EXISTS is_initial TINYINT(1) DEFAULT 0");
            } catch (Exception $e) {}

            $is_used     = $data['is_used_quote'] ?? false;

            $cur_d_stmt = $this->conn->prepare("SELECT status FROM quotes WHERE (project_id = :pid OR project_id = :raw_id) AND status IS NOT NULL AND status != '' AND status != 'budgeted' ORDER BY quote_id DESC LIMIT 1");
            $cur_d_stmt->execute(['pid' => $project_id, 'raw_id' => $raw_p_id]);
            $cur_d_row = $cur_d_stmt->fetch(PDO::FETCH_ASSOC);
            $existing_d_st = $cur_d_row['status'] ?? null;

            // Check if proposal was ever sent for this project
            $chkProp = $this->conn->prepare("SELECT quote_id, ack_email_sent_at, status FROM quotes WHERE (project_id = :pid OR project_id = :raw_id) AND (ack_email_sent_at IS NOT NULL OR status IN ('proposal', 'proposal_sent')) ORDER BY quote_id DESC LIMIT 1");
            $chkProp->execute(['pid' => $project_id, 'raw_id' => $raw_p_id]);
            $propRow = $chkProp->fetch(PDO::FETCH_ASSOC);
            $hasEverSentProposal = !empty($propRow);

            if (!$hasEverSentProposal && $project_id > 0) {
                $chkLead = $this->conn->prepare("SELECT status, d1_status FROM leads WHERE lead_id = :lid OR manual_client_id = :pcode LIMIT 1");
                $chkLead->execute(['lid' => $project_id, 'pcode' => $raw_p_id]);
                $lRow = $chkLead->fetch(PDO::FETCH_ASSOC);
                if ($lRow && ($lRow['status'] === 'proposal_sent' || $lRow['d1_status'] === 'proposal_sent')) {
                    $hasEverSentProposal = true;
                }
            }

            // Check if client rejected this quotation or if lead is lost
            $isClientRejected = (
                (!empty($data['ack_status']) && $data['ack_status'] === 'rejected') ||
                (!empty($data['status']) && in_array(strtolower(trim($data['status'])), ['order_lost', 'rejected', 'lost'])) ||
                ($cur_d_row && (($cur_d_row['status'] ?? '') === 'order_lost' || ($cur_d_row['status'] ?? '') === 'rejected'))
            );

            // Check if any quote for this project was accepted by client or already converted
            $chkAcceptedDraft = $this->conn->prepare("SELECT quote_id, ack_status, acknowledged_at, status FROM quotes WHERE (project_id = :pid OR project_id = :raw_id) AND (ack_status = 'accepted' OR status = 'order_converted') ORDER BY quote_id DESC LIMIT 1");
            $chkAcceptedDraft->execute(['pid' => $project_id, 'raw_id' => $raw_p_id]);
            $acceptedDraftRow = $chkAcceptedDraft->fetch(PDO::FETCH_ASSOC);

            $is_initial_draft = !empty($data['is_initial_quote']) || (!empty($data['extra_data']) && is_array($data['extra_data']) && !empty($data['extra_data']['is_initial_quote']));
            $isAlreadyConvertedDraft = false;
            if (!$isClientRejected && !$is_initial_draft) {
                if (!empty($data['status']) && strtolower(trim($data['status'])) === 'order_converted') {
                    $isAlreadyConvertedDraft = true;
                } else if (!empty($acceptedDraftRow) && in_array(strtolower(trim($acceptedDraftRow['status'] ?? '')), ['order_converted', 'deal_done', 'deal_won'])) {
                    $isAlreadyConvertedDraft = true;
                }
            }

            $isClientAcceptedDraft = !$isClientRejected && (
                (!empty($data['ack_status']) && $data['ack_status'] === 'accepted') ||
                (!empty($data['status']) && $data['status'] === 'approved') ||
                (!empty($acceptedDraftRow) && (($acceptedDraftRow['ack_status'] ?? '') === 'accepted' || ($acceptedDraftRow['status'] ?? '') === 'approved'))
            );

            $draft_status_to_save = $isAlreadyConvertedDraft ? 'order_converted' : ($isClientAcceptedDraft ? 'approved' : 'draft');
            $status = $draft_status_to_save;
            $prop_ack_sent = $hasEverSentProposal ? ($propRow['ack_email_sent_at'] ?? date('Y-m-d H:i:s')) : null;
            $ack_status_to_save = $isClientRejected ? 'rejected' : ($isAlreadyConvertedDraft || $isClientAcceptedDraft ? 'accepted' : 'pending');
            $ack_at_to_save = ($ack_status_to_save === 'accepted') ? ($acceptedDraftRow['acknowledged_at'] ?? date('Y-m-d H:i:s')) : null;
            $total       = $data['total_amount'] ?? 0;
            $discount    = $data['discount_percent'] ?? 0;
            $created_by  = $data['created_by'] ?? 1;
            $subtitle    = $data['subtitle'] ?? '';
            $sections    = $data['sections'] ?? [];

            $draft_qnum = !empty($data['quote_number']) ? $data['quote_number'] : ('DRAFT-' . $project_id . '-' . ($is_used ? 'U' : 'B'));
            if (str_starts_with($draft_qnum, 'QTN-') || str_starts_with($draft_qnum, 'Livincart-QT-')) {
                // Drafts should always use DRAFT- prefix to avoid unique constraint collisions with official quote numbers
                $draft_qnum = 'DRAFT-' . $project_id . '-' . ($is_used ? 'U' : 'B');
            }

            // Check if quote_id was explicitly provided (numeric ID) - NEVER overwrite accepted quote
            $existing = null;
            if (!empty($data['quote_id']) && !str_starts_with((string)$data['quote_id'], 'p-') && !str_starts_with((string)$data['quote_id'], 'lead-')) {
                $qCheck = $this->conn->prepare("SELECT quote_id, ack_status, is_initial, extra_data, lead_id FROM quotes WHERE quote_id = :qid AND COALESCE(ack_status, '') != 'accepted' LIMIT 1");
                $qCheck->execute(['qid' => intval($data['quote_id'])]);
                $existing = $qCheck->fetch(PDO::FETCH_ASSOC);
            }

            // Check if a draft already exists for this project (or with this draft quote number) - NEVER overwrite accepted quote
            if (!$existing) {
                $check = $this->conn->prepare(
                    "SELECT quote_id, extra_data, lead_id FROM quotes WHERE (project_id = :p_id OR project_id = :raw_id OR quote_number = :qnum) AND save_type = 'draft' AND COALESCE(ack_status, '') != 'accepted' ORDER BY quote_id DESC LIMIT 1"
                );
                $check->execute(['p_id' => $project_id, 'raw_id' => $raw_p_id, 'qnum' => $draft_qnum]);
                $existing = $check->fetch(PDO::FETCH_ASSOC);
            }

            // Fallback check: if quote_number DRAFT-XXX exists under any save_type
            if (!$existing) {
                $qCheck = $this->conn->prepare("SELECT quote_id, extra_data, lead_id FROM quotes WHERE quote_number = :qnum AND COALESCE(ack_status, '') != 'accepted' LIMIT 1");
                $qCheck->execute(['qnum' => $draft_qnum]);
                $existing = $qCheck->fetch(PDO::FETCH_ASSOC);
            }

            try {
                $this->conn->exec("ALTER TABLE quote_sections ADD COLUMN IF NOT EXISTS custom_headings LONGTEXT DEFAULT NULL");
            } catch (Exception $e) {}

            $this->conn->beginTransaction();

            $existingExtra = [];
            if (!empty($existing['extra_data'])) {
                $dec = is_array($existing['extra_data']) ? $existing['extra_data'] : json_decode($existing['extra_data'], true);
                if (is_array($dec)) $existingExtra = $dec;
            }
            if (!empty($data['extra_data'])) {
                $decoded = is_array($data['extra_data']) ? $data['extra_data'] : json_decode($data['extra_data'], true);
                if (is_array($decoded)) $existingExtra = array_merge($existingExtra, $decoded);
            }

            // Clean additional_charges to prevent double-nesting { amount: { amount: X } }
            $rawAddCharges = $data['additional_charges'] ?? $data['additionalCharges'] ?? ($existingExtra['additional_charges'] ?? null);
            if (is_array($rawAddCharges) && is_array($rawAddCharges['amount'] ?? null)) {
                $rawAddCharges['amount'] = floatval($rawAddCharges['amount']['amount'] ?? $rawAddCharges['amount']['value'] ?? 0);
            }

            // Clean flat discount
            $rawFlatDisc = $data['flat_discount'] ?? $data['flatDiscount'] ?? null;
            if ($rawFlatDisc === null && isset($data['general_discount'])) {
                $rawFlatDisc = is_array($data['general_discount']) ? ($data['general_discount']['amount'] ?? null) : $data['general_discount'];
            }
            if ($rawFlatDisc === null) {
                $rawFlatDisc = $existingExtra['flat_discount'] ?? null;
            }

            $client_email = $data['client_email'] ?? $data['clientEmail'] ?? ($existingExtra['client_email'] ?? ($existingExtra['email'] ?? null));
            $client_phone = $data['client_phone'] ?? $data['clientPhone'] ?? ($existingExtra['client_phone'] ?? ($existingExtra['phone'] ?? null));
            $lead_id_val = !empty($data['lead_id']) ? intval($data['lead_id']) : (!empty($existing['lead_id']) ? intval($existing['lead_id']) : ($existingExtra['lead_id'] ?? null));

            $extra_fields = array_merge($existingExtra, [
                'client_email' => $client_email,
                'client_phone' => $client_phone,
                'lead_id' => $lead_id_val,
                'applied_coupon' => $data['applied_coupon'] ?? $data['appliedCoupon'] ?? $data['coupon'] ?? $data['promo_code'] ?? ($existingExtra['applied_coupon'] ?? null),
                'additional_charges' => $rawAddCharges,
                'general_discount' => $data['general_discount'] ?? $data['generalDiscount'] ?? ($existingExtra['general_discount'] ?? null),
                'flat_discount' => $rawFlatDisc,
                'global_discount' => $data['global_discount'] ?? $data['globalDiscount'] ?? ($existingExtra['global_discount'] ?? null),
                'category_discounts' => $data['category_discounts'] ?? ($existingExtra['category_discounts'] ?? null),
                'overall_gst_enabled' => $data['overall_gst_enabled'] ?? ($existingExtra['overall_gst_enabled'] ?? true),
                'overall_gst_line_hidden' => $data['overall_gst_line_hidden'] ?? ($existingExtra['overall_gst_line_hidden'] ?? false),
                'overall_gst_rate' => isset($data['overall_gst_rate']) ? floatval($data['overall_gst_rate']) : ($existingExtra['overall_gst_rate'] ?? 0),
                'round_off_enabled' => $data['round_off_enabled'] ?? ($existingExtra['round_off_enabled'] ?? true),
                'custom_headings' => $data['custom_headings'] ?? ($existingExtra['custom_headings'] ?? null),
                'section_headings' => $data['section_headings'] ?? ($existingExtra['section_headings'] ?? null),
                'hidden_fields' => $data['hidden_fields'] ?? ($existingExtra['hidden_fields'] ?? null),
                'terms_list' => $data['terms_list'] ?? $data['terms'] ?? ($existingExtra['terms_list'] ?? ($existingExtra['terms'] ?? null)),
                'terms' => $data['terms_list'] ?? $data['terms'] ?? ($existingExtra['terms_list'] ?? ($existingExtra['terms'] ?? null)),
                'is_final_version' => false,
                'is_final' => false,
                'is_qc_approved' => false,
                'qc_status' => 'not_sent',
                'is_duplicate' => !empty($data['is_duplicate']) || !empty($existingExtra['is_duplicate']),
                'is_initial_quote' => $data['is_initial_quote'] ?? ($existingExtra['is_initial_quote'] ?? false)
            ]);

            $extra_data_json = json_encode($extra_fields);

            // If project exists in projects table, lock initial_quote_amount and ensure draft is never marked initial
            $chkProjInit = $this->conn->prepare("SELECT initial_quote_amount, total_budget FROM projects WHERE (project_id = :pid OR project_code = :pcode) LIMIT 1");
            $chkProjInit->execute(['pid' => $project_id, 'pcode' => $raw_p_id]);
            $projRow = $chkProjInit->fetch(PDO::FETCH_ASSOC);

            if ($projRow) {
                $hasProjInitial = floatval($projRow['initial_quote_amount'] ?? 0) > 0;
                if (!$hasProjInitial) {
                    $initAmt = floatval($projRow['total_budget'] ?? 0);
                    if ($initAmt <= 0) {
                        $q1 = $this->conn->prepare("SELECT total_amount FROM quotes WHERE (project_id = :pid OR project_id = :rawid) AND (is_initial = 1 OR version = 1) ORDER BY version ASC LIMIT 1");
                        $q1->execute(['pid' => $project_id, 'rawid' => $raw_p_id]);
                        $initAmt = floatval($q1->fetchColumn() ?: 0);
                    }
                    if ($initAmt > 0) {
                        $this->conn->prepare("UPDATE projects SET initial_quote_amount = :amt WHERE (project_id = :pid OR project_code = :pcode) AND (initial_quote_amount IS NULL OR initial_quote_amount = 0)")->execute(['amt' => $initAmt, 'pid' => $project_id, 'pcode' => $raw_p_id]);
                    }
                }
                // Any designer draft for an active project is strictly a draft revision, NEVER an initial quote!
                $is_initial = false;
                // Never overwrite the initial quotation row itself if user was editing it
                if ($existing && (!empty($existing['is_initial']) || (intval($existing['quote_id'] ?? 0) > 0 && floatval($projRow['initial_quote_amount'] ?? 0) > 0))) {
                    $chkInitQuoteId = $this->conn->prepare("SELECT quote_id FROM quotes WHERE (project_id = :pid OR project_id = :rawid) AND (is_initial = 1 OR version = 1) ORDER BY version ASC LIMIT 1");
                    $chkInitQuoteId->execute(['pid' => $project_id, 'rawid' => $raw_p_id]);
                    $initQid = intval($chkInitQuoteId->fetchColumn() ?: 0);
                    if ($initQid > 0 && intval($existing['quote_id']) === $initQid) {
                        // Don't overwrite the initial quote record with the draft! Detach existing so a separate draft quote is saved.
                        $existing = null;
                    }
                }
            } else {
                $is_initial = !empty($data['is_initial_quote']) || 
                              (!empty($data['extra_data']) && is_array($data['extra_data']) && !empty($data['extra_data']['is_initial_quote'])) ||
                              (!empty($data['extra_data']) && is_string($data['extra_data']) && strpos($data['extra_data'], '"is_initial_quote":true') !== false);
            }

            if ($is_initial && ($project_id > 0 || !empty($subtitle))) {
                try {
                    $this->conn->exec("ALTER TABLE leads ADD COLUMN IF NOT EXISTS initial_quote_amount DECIMAL(15,2) DEFAULT NULL");
                } catch (Exception $e) {}
                try {
                    $totalAmt = floatval($data['total_amount'] ?? 0);
                    $rawPid = (string)($data['project_id'] ?? '');
                    $pCode = (string)($data['project_code'] ?? '');

                    $upLead = $this->conn->prepare("
                        UPDATE leads 
                        SET initial_quote_amount = COALESCE(initial_quote_amount, :amt) 
                        WHERE (
                            lead_id = :lid 
                            OR lead_id = :clean_id
                            OR manual_client_id = :rawpid 
                            OR manual_client_id = :pcode 
                            OR client_name = :subtitle 
                            OR LOWER(client_name) = LOWER(:subtitle)
                            OR CONCAT('PR-', lead_id) = :rawpid
                            OR CONCAT('PR-LEAD-', lead_id) = :rawpid
                        )
                    ");
                    $upLead->execute([
                        'amt' => $totalAmt,
                        'lid' => $project_id,
                        'clean_id' => $project_id,
                        'rawpid' => $rawPid,
                        'pcode' => $pCode,
                        'subtitle' => $subtitle
                    ]);
                } catch (Exception $e) {
                    file_put_contents('debug_quote.log', "UPDATE LEAD INITIAL AMT ERR DRAFT: " . $e->getMessage() . "\n", FILE_APPEND);
                }
            }

            if ($existing) {
                // Update existing draft header - preserve rejection state if client rejected, never convert unless client approved
                $quote_id = $existing['quote_id'];
                $ack_update_sql = $isAlreadyConvertedDraft
                    ? "ack_status='accepted', acknowledged_at=COALESCE(acknowledged_at, NOW())"
                    : ($isClientRejected || (($existing['ack_status'] ?? '') === 'rejected')
                        ? "ack_status='rejected'"
                        : "ack_status='pending', acknowledged_at=NULL, acknowledged_ip=NULL");
                $this->conn->prepare(
                    "UPDATE quotes SET total_amount=:total, discount_percent=:discount, subtitle=:sub, extra_data=:extra, lead_id=COALESCE(:lead_id, lead_id), updated_by=:uid, is_initial=:is_init, is_qc_approved=0, status=:draft_st, {$ack_update_sql}, ack_email_sent_at=COALESCE(ack_email_sent_at, :ack_sent), updated_at=NOW() WHERE quote_id=:qid"
                )->execute(['total' => $total, 'discount' => $discount, 'sub' => $subtitle, 'extra' => $extra_data_json, 'lead_id' => $lead_id_val, 'uid' => ($data['updated_by'] ?? $data['user_id'] ?? $created_by), 'is_init' => $is_initial ? 1 : 0, 'draft_st' => $draft_status_to_save, 'ack_sent' => $prop_ack_sent, 'qid' => $quote_id]);

                // Delete old sections + items
                $old_sections = $this->conn->prepare("SELECT section_id FROM quote_sections WHERE quote_id = :qid");
                $old_sections->execute(['qid' => $quote_id]);
                foreach ($old_sections->fetchAll(PDO::FETCH_ASSOC) as $os) {
                    $this->conn->prepare("DELETE FROM quote_items WHERE section_id = :sid")->execute(['sid' => $os['section_id']]);
                }
                $this->conn->prepare("DELETE FROM quote_sections WHERE quote_id = :qid")->execute(['qid' => $quote_id]);
            } else {
                // Ensure unique draft quote number without collisions
                $quote_number = $draft_qnum;
                $chkQnum = $this->conn->prepare("SELECT quote_id, project_id FROM quotes WHERE quote_number = :qnum LIMIT 1");
                $chkQnum->execute(['qnum' => $quote_number]);
                $dupQuote = $chkQnum->fetch(PDO::FETCH_ASSOC);

                if ($dupQuote) {
                    if (intval($dupQuote['project_id']) === $project_id || (string)$dupQuote['project_id'] === (string)$raw_p_id) {
                        // Same project quote row already has this quote number - update it instead of duplicate insert
                        $quote_id = intval($dupQuote['quote_id']);
                        $ack_update_sql = $isAlreadyConvertedDraft
                            ? "ack_status='accepted', acknowledged_at=COALESCE(acknowledged_at, NOW())"
                            : ($isClientRejected || (($dupQuote['ack_status'] ?? '') === 'rejected')
                                ? "ack_status='rejected'"
                                : "ack_status='pending', acknowledged_at=NULL, acknowledged_ip=NULL");
                        $this->conn->prepare(
                            "UPDATE quotes SET total_amount=:total, discount_percent=:discount, subtitle=:sub, extra_data=:extra, lead_id=COALESCE(:lead_id, lead_id), updated_by=:uid, is_initial=:is_init, is_qc_approved=0, status=:draft_st, {$ack_update_sql}, ack_email_sent_at=COALESCE(ack_email_sent_at, :ack_sent), updated_at=NOW() WHERE quote_id=:qid"
                        )->execute(['total' => $total, 'discount' => $discount, 'sub' => $subtitle, 'extra' => $extra_data_json, 'lead_id' => $lead_id_val, 'uid' => ($data['updated_by'] ?? $data['user_id'] ?? $created_by), 'is_init' => $is_initial ? 1 : 0, 'draft_st' => $draft_status_to_save, 'ack_sent' => $prop_ack_sent, 'qid' => $quote_id]);

                        $old_sections = $this->conn->prepare("SELECT section_id FROM quote_sections WHERE quote_id = :qid");
                        $old_sections->execute(['qid' => $quote_id]);
                        foreach ($old_sections->fetchAll(PDO::FETCH_ASSOC) as $os) {
                            $this->conn->prepare("DELETE FROM quote_items WHERE section_id = :sid")->execute(['sid' => $os['section_id']]);
                        }
                        $this->conn->prepare("DELETE FROM quote_sections WHERE quote_id = :qid")->execute(['qid' => $quote_id]);
                    } else {
                        // Different project has this quote_number, generate a guaranteed unique draft quote_number
                        $quote_number = 'DRAFT-' . $project_id . '-' . ($is_used ? 'U' : 'B') . '-' . time() . '-' . rand(100, 999);
                        $stmt = $this->conn->prepare(
                            "INSERT INTO quotes (project_id, subtitle, quote_number, total_amount, discount_percent, created_by, updated_by, status, version, save_type, label, extra_data, is_initial, is_qc_approved, lead_id, ack_email_sent_at, ack_status, acknowledged_at)
                             VALUES (:p_id, :sub, :qnum, :total, :discount, :uid, :up_id, :status, 0, 'draft', 'Draft', :extra, :is_init, 0, :lead_id, :ack_sent, :ack_st, :ack_at)"
                        );
                        $stmt->execute([
                            'p_id' => $project_id,
                            'sub' => $subtitle,
                            'qnum' => $quote_number,
                            'total' => $total,
                            'discount' => $discount,
                            'uid' => $created_by,
                            'up_id' => ($data['updated_by'] ?? $data['user_id'] ?? $created_by),
                            'status' => $draft_status_to_save,
                            'extra' => $extra_data_json,
                            'is_init' => $is_initial ? 1 : 0,
                            'lead_id' => $lead_id_val,
                            'ack_sent' => $prop_ack_sent,
                            'ack_st' => $ack_status_to_save,
                            'ack_at' => $ack_at_to_save
                        ]);
                        $quote_id = intval($this->conn->lastInsertId() ?: 0);
                    }
                } else {
                    $stmt = $this->conn->prepare(
                        "INSERT INTO quotes (project_id, subtitle, quote_number, total_amount, discount_percent, created_by, updated_by, status, version, save_type, label, extra_data, is_initial, is_qc_approved, lead_id, ack_status, acknowledged_at)
                         VALUES (:p_id, :sub, :qnum, :total, :discount, :uid, :up_id, :status, 0, 'draft', 'Draft', :extra, :is_init, 0, :lead_id, :ack_st, :ack_at)"
                    );
                    $stmt->execute([
                        'p_id' => $project_id,
                        'sub' => $subtitle,
                        'qnum' => $quote_number,
                        'total' => $total,
                        'discount' => $discount,
                        'uid' => $created_by,
                        'up_id' => ($data['updated_by'] ?? $data['user_id'] ?? $created_by),
                        'status' => $draft_status_to_save,
                        'extra' => $extra_data_json,
                        'is_init' => $is_initial ? 1 : 0,
                        'lead_id' => $lead_id_val,
                        'ack_st' => $ack_status_to_save,
                        'ack_at' => $ack_at_to_save
                    ]);
                    $quote_id = intval($this->conn->lastInsertId() ?: 0);
                }

                if ($quote_id <= 0) {
                    $chkQid = $this->conn->prepare("SELECT quote_id FROM quotes WHERE (project_id = :p_id OR project_id = :raw_id) AND save_type = 'draft' ORDER BY quote_id DESC LIMIT 1");
                    $chkQid->execute([':p_id' => $clean_id, ':raw_id' => $project_id]);
                    $quote_id = intval($chkQid->fetchColumn() ?: 0);
                }
            }

            // Re-insert sections and items
            if (is_string($sections)) {
                $sections = json_decode($sections, true) ?: [];
            }
            if (!is_array($sections)) {
                $sections = [];
            }

            foreach ($sections as $s_idx => $section) {
                $s_name = trim($section['name'] ?? $section['section_name'] ?? $section['title'] ?? '');
                if ($s_name === '') {
                    $s_name = 'Section ' . ($s_idx + 1);
                }
                $s_headings_val = !empty($section['custom_headings']) ? (is_string($section['custom_headings']) ? $section['custom_headings'] : json_encode($section['custom_headings'])) : null;
                if (empty($s_headings_val) && !empty($extra_fields['section_headings'])) {
                    $secMap = $extra_fields['section_headings'];
                    $secKey = $section['id'] ?? $section['section_id'] ?? $s_idx;
                    $foundHeadings = $secMap[$secKey] ?? ($secMap[strval($secKey)] ?? ($secMap[$s_idx] ?? ($secMap[strval($s_idx)] ?? ($secMap[$s_name] ?? null))));
                    if (!empty($foundHeadings)) {
                        $s_headings_val = is_string($foundHeadings) ? $foundHeadings : json_encode($foundHeadings);
                    }
                }
                $s_stmt = $this->conn->prepare(
                    "INSERT INTO quote_sections (quote_id, section_name, display_order, custom_headings) VALUES (:qid, :name, :ord, :headings)"
                );
                $s_stmt->execute(['qid' => $quote_id, 'name' => $s_name, 'ord' => $s_idx, 'headings' => $s_headings_val]);
                $section_id = intval($this->conn->lastInsertId() ?: 0);
                if ($section_id <= 0 && $quote_id > 0) {
                    $chkSid = $this->conn->prepare("SELECT section_id FROM quote_sections WHERE quote_id = :qid AND section_name = :sname ORDER BY section_id DESC LIMIT 1");
                    $chkSid->execute([':qid' => $quote_id, ':sname' => $s_name]);
                    $section_id = intval($chkSid->fetchColumn() ?: 0);
                }

                foreach (($section['items'] ?? []) as $i_idx => $item) {
                    if (!is_array($item)) continue;
                    $p_mode = !empty($item['pricing_mode']) ? $item['pricing_mode'] : (empty($item['width']) && empty($item['height']) && empty($item['sft']) ? 'lumpsum' : 'dimensions');
                    $this->conn->prepare(
                        "INSERT INTO quote_items (section_id, particulars, brand, unit, quantity, used_quantity, width, height, sft, hsn_sac, image_url, rate, rate_per_sft, gst_rate, discount_percent, category, amount, pricing_mode, display_order)
                         VALUES (:sid, :part, :brand, :unit, :qty, :uqty, :width, :height, :sft, :hsn, :img, :rate, :r_sft, :gst, :disc, :cat, :amt, :pmode, :ord)"
                    )->execute([
                        'sid'   => $section_id,
                        'part'  => !empty($item['particulars']) ? $item['particulars'] : 'Item',
                        'brand' => $item['brand'] ?? '',
                        'unit'  => $item['unit'] ?? '',
                        'qty'   => $item['quantity'] ?? 0,
                        'uqty'  => $item['used_quantity'] ?? 0,
                        'width' => $item['width'] ?? '',
                        'height'=> $item['height'] ?? '',
                        'sft'   => $item['sft'] ?? '',
                        'hsn'   => $item['hsn_sac'] ?? '',
                        'img'   => $item['image_url'] ?? '',
                        'rate'  => $item['rate'] ?? 0,
                        'r_sft' => $item['rate_per_sft'] ?? 0,
                        'gst'   => $item['gst_rate'] ?? 18,
                        'disc'  => $item['discount_percent'] ?? 0,
                        'cat'   => $item['category'] ?? '',
                        'amt'   => $item['amount'] ?? 0,
                        'pmode' => $p_mode,
                        'ord'   => $i_idx
                    ]);
                }
            }

            if ($this->conn->inTransaction()) {
                $this->conn->commit();
            }
            return ['success' => true, 'message' => 'Draft saved', 'quote_id' => $quote_id];
        } catch (Exception $e) {
            file_put_contents('debug_quote.log', "DRAFT ERROR: " . $e->getMessage() . "\n", FILE_APPEND);
            if ($this->conn->inTransaction()) $this->conn->rollBack();
            return ['success' => false, 'message' => 'Error saving draft: ' . $e->getMessage()];
        }
    }

    public function setInitialQuoteAmount($data)
    {
        try {
            $raw_p_id = $data['project_id'] ?? 0;
            $project_id = intval(preg_replace('/[^0-9]/', '', (string)$raw_p_id));
            $amount = floatval($data['amount'] ?? 0);
            $client_name = $data['client_name'] ?? '';
            $quote_id = $data['quote_id'] ?? null;

            $this->conn->exec("ALTER TABLE leads ADD COLUMN IF NOT EXISTS initial_quote_amount DECIMAL(15,2) DEFAULT NULL");
            $this->conn->exec("ALTER TABLE projects ADD COLUMN IF NOT EXISTS initial_quote_amount DECIMAL(15,2) DEFAULT NULL");
            $this->conn->exec("ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_final_quote_approved TINYINT(1) DEFAULT 0");

            // 1. Update leads table
            $upLead = $this->conn->prepare("
                UPDATE leads 
                SET initial_quote_amount = :amt 
                WHERE (
                    lead_id = :lid 
                    OR lead_id = :clean_id
                    OR manual_client_id = :rawpid 
                    OR client_name = :cname 
                    OR LOWER(client_name) = LOWER(:cname)
                    OR CONCAT('PR-', lead_id) = :rawpid
                    OR CONCAT('PR-LEAD-', lead_id) = :rawpid
                )
            ");
            $upLead->execute([
                'amt' => $amount,
                'lid' => $project_id,
                'clean_id' => $project_id,
                'rawpid' => (string)$raw_p_id,
                'cname' => $client_name
            ]);

            // 2. Update projects table if a project already exists (and not yet QC finalized and not already initialized)
            $upProj = $this->conn->prepare("
                UPDATE projects 
                SET initial_quote_amount = :amt,
                    total_budget = CASE WHEN COALESCE(is_final_quote_approved, 0) = 0 THEN :amt ELSE total_budget END
                WHERE (
                    project_id = :pid 
                    OR manual_client_id = :rawpid 
                    OR project_code = :rawpid
                    OR CONCAT('PR-', project_id) = :rawpid
                )
                AND (initial_quote_amount IS NULL OR initial_quote_amount = 0)
            ");
            $upProj->execute([
                'amt' => $amount,
                'pid' => $project_id,
                'rawpid' => (string)$raw_p_id
            ]);

            // 3. Update quotes table is_initial column and extra_data
            try {
                if ($quote_id) {
                    $upQCol = $this->conn->prepare("
                        UPDATE quotes 
                        SET is_initial = CASE WHEN quote_id = :qid THEN 1 ELSE 0 END 
                        WHERE project_id = :pid OR project_id = :rawpid OR quote_id = :qid
                    ");
                    $upQCol->execute(['qid' => $quote_id, 'pid' => $project_id, 'rawpid' => (string)$raw_p_id]);
                } else {
                    $upQCol = $this->conn->prepare("
                        UPDATE quotes 
                        SET is_initial = 1 
                        WHERE project_id = :pid OR project_id = :rawpid 
                        ORDER BY quote_id DESC LIMIT 1
                    ");
                    $upQCol->execute(['pid' => $project_id, 'rawpid' => (string)$raw_p_id]);
                }

                $qClause = "WHERE (project_id = :pid OR project_id = :rawpid)";
                $params = ['pid' => $project_id, 'rawpid' => (string)$raw_p_id];
                if (!empty($quote_id)) {
                    $qClause .= " OR quote_id = :qid";
                    $params['qid'] = $quote_id;
                }
                $qStmt = $this->conn->prepare("SELECT quote_id, extra_data FROM quotes " . $qClause);
                $qStmt->execute($params);
                $rows = $qStmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($rows as $row) {
                    $exData = !empty($row['extra_data']) ? (json_decode($row['extra_data'], true) ?: []) : [];
                    $isThis = ($quote_id && $row['quote_id'] == $quote_id);
                    $exData['is_initial_quote'] = $isThis;
                    $upQ = $this->conn->prepare("UPDATE quotes SET extra_data = :ex WHERE quote_id = :qid");
                    $upQ->execute(['ex' => json_encode($exData), 'qid' => $row['quote_id']]);
                }
            } catch (Exception $e) {}

            return ["success" => true, "message" => "Initial quotation amount locked successfully", "amount" => $amount];
        } catch (Exception $e) {
            return ["success" => false, "message" => "Error setting initial quote amount: " . $e->getMessage()];
        }
    }

    /**
     * Get Draft — loads the saved draft for a project (if any).
     */
    public function getDraft($project_id, $is_used_quote = false)
    {
        $clean_id = intval(preg_replace('/[^0-9]/', '', (string)$project_id));
        $stmt = $this->conn->prepare(
            "SELECT quote_id FROM quotes WHERE (project_id = :p_id OR project_id = :raw_id) AND save_type = 'draft' ORDER BY created_at DESC, updated_at DESC, quote_id DESC LIMIT 1"
        );
        $stmt->execute(['p_id' => $clean_id, 'raw_id' => $project_id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) return null;
        return $this->getQuoteDetails($row['quote_id']);
    }

    /**
     * Get Versions List — lightweight list of all saved versions (not drafts).
     */
    public function getVersionsList($project_id, $is_used_quote = false)
    {
        $clean_id = intval(preg_replace('/[^0-9]/', '', (string)$project_id));

        $query = "SELECT quote_id, version, total_amount, discount_percent, label, created_at, created_by, status, extra_data, save_type
                  FROM quotes
                  WHERE (project_id = :p_id OR project_id = :raw_id)
                    AND (save_type = 'version' OR save_type IS NULL OR save_type = '')
                  ORDER BY version DESC, created_at DESC, quote_id DESC";
        $stmt = $this->conn->prepare($query);
        $stmt->execute(['p_id' => $clean_id, 'raw_id' => $project_id]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Deduplicate rows by version number to eliminate duplicate history rows
        $uniqueVersionsMap = [];
        foreach ($rows as $row) {
            $vNum = intval($row['version'] ?? 1);
            if (!isset($uniqueVersionsMap[$vNum])) {
                $uniqueVersionsMap[$vNum] = $row;
            }
        }

        return array_values($uniqueVersionsMap);
    }

    private function ensureProjectExists($project_id, $subtitle = '', $total_amount = 0, $project_code = '')
    {
        try {
            $chk = $this->conn->prepare("SELECT project_id, project_code FROM projects WHERE project_id = :pid");
            $chk->execute(['pid' => $project_id]);
            $existingProj = $chk->fetch(PDO::FETCH_ASSOC);
            if (!$existingProj) {
                $pcode = !empty($project_code) ? $project_code : ('PR-' . $project_id);
                $ins = $this->conn->prepare(
                    "INSERT INTO projects (project_id, project_code, project_name, client_id, start_date, expected_end_date, total_budget, initial_quote_amount, created_by, status)
                     VALUES (:pid, :pcode, :pname, 1, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 30 DAY), :budget, :init_amt, 1, 'Quotation')"
                );
                $ins->execute([
                    'pid' => $project_id,
                    'pcode' => $pcode,
                    'pname' => !empty($subtitle) ? $subtitle : ('Project #' . $project_id),
                    'budget' => $total_amount,
                    'init_amt' => $total_amount
                ]);
            } else if (!empty($project_code) && (empty($existingProj['project_code']) || strpos($existingProj['project_code'], 'P-') === 0)) {
                $upCode = $this->conn->prepare("UPDATE projects SET project_code = :pcode WHERE project_id = :pid");
                $upCode->execute(['pcode' => $project_code, 'pid' => $project_id]);
            }
        } catch (Exception $e) {
            // Ignore if parent project record already exists
        }
    }

    public function sendEmail($data)
    {
        $to = $data['to'] ?? $data['client_email'] ?? '';
        $from = $data['from'] ?? 'quotes@livincart.com';
        $subject = $data['subject'] ?? 'Official Quotation - Livincart Interiors';
        $body = $data['content'] ?? $data['body'] ?? '';

        $projectId = $data['project_id'] ?? null;
        if (empty($projectId) && !empty($data['quote_number']) && stripos($data['quote_number'], 'MOM-') === 0) {
            $projectId = intval(substr($data['quote_number'], 4));
        }

        $isMomPdf = (!empty($data['quote_number']) && stripos($data['quote_number'], 'MOM-') === 0);

        if (empty($to) && !empty($projectId)) {
            try {
                // Securely query the database for the client email if not explicitly provided
                $p_query = "SELECT c.email as client_email 
                            FROM projects p
                            JOIN clients c ON p.client_id = c.client_id
                            WHERE p.project_id = :id";
                $p_stmt = $this->conn->prepare($p_query);
                $p_stmt->execute(['id' => $projectId]);
                $projInfo = $p_stmt->fetch(\PDO::FETCH_ASSOC);
                if ($projInfo && !empty($projInfo['client_email'])) {
                    $to = $projInfo['client_email'];
                }
            } catch (\Exception $dbEx) {
                error_log("Quote sendEmail DB lookup error: " . $dbEx->getMessage());
            }
        }
        
        if (empty($to)) {
            if ($isMomPdf) {
                return ["success" => false, "message" => "Client email address is missing."];
            }
            return ["success" => false, "message" => "Recipient client email address is required"];
        }

        try {
            require_once __DIR__ . '/../libs/AmpPHPMailer.php';
            
            $mail = new \AmpPHPMailer(true);
            $mail->isSMTP();
            $mail->Host       = 'smtp.gmail.com';
            $mail->SMTPAuth   = true;
            $mail->Username   = 'updates@livincart.com';
            $mail->Password   = 'kkzz omvh dzjs xqfu';
            $mail->SMTPSecure = \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
            $mail->Port       = 587;
            
            $mail->setFrom('updates@livincart.com', 'Livincart Interiors');
            $mail->addReplyTo('contact@livincart.com', 'Livincart Support');
            $mail->addAddress($to);
            $mail->isHTML(true);
            $mail->Subject = $subject;

            $cleanQNum = preg_replace('/[^a-zA-Z0-9_-]/', '', $data['quote_number'] ?? 'QTN-101');
            $hasValidPdf = false;

            // Attach PDF binary file
            $pdfBinary = '';
            $pdfSource = 'none';
            $targetQuoteId = intval($data['quote_id'] ?? $data['id'] ?? 0);
            $targetQuoteNum = trim($data['quote_number'] ?? '');
            if ($targetQuoteId <= 0 && !empty($targetQuoteNum)) {
                $chk = $this->conn->prepare("SELECT quote_id FROM quotes WHERE quote_number = :qnum");
                $chk->execute(['qnum' => $targetQuoteNum]);
                $fRow = $chk->fetch(\PDO::FETCH_ASSOC);
                if ($fRow) {
                    $targetQuoteId = intval($fRow['quote_id']);
                }
            }



            // 0-PRIORITY: For quotation emails (non-MOM), always try SimplePdfBuilder FIRST
            // pulls fresh data including sections, items, shutter_material, carcass_material,
            // and discount toggles so the emailed PDF always has the official 4-page layout with correct columns.
            if (!$isMomPdf && ($targetQuoteId > 0 || !empty($targetQuoteNum) || !empty($data['sections']) || !empty($data['quote_data']))) {
                try {
                    require_once __DIR__ . '/../helpers/SimplePdfBuilder.php';
                    $qRow = null;
                    if ($targetQuoteId > 0) {
                        $qStmt = $this->conn->prepare("SELECT * FROM quotes WHERE quote_id = :id");
                        $qStmt->execute(['id' => $targetQuoteId]);
                        $qRow = $qStmt->fetch(\PDO::FETCH_ASSOC);
                    }
                    if (!$qRow && !empty($targetQuoteNum)) {
                        $qStmt = $this->conn->prepare("SELECT * FROM quotes WHERE quote_number = :qnum");
                        $qStmt->execute(['qnum' => $targetQuoteNum]);
                        $qRow = $qStmt->fetch(\PDO::FETCH_ASSOC);
                    }
                    if (!$qRow && (!empty($data['sections']) || !empty($data['quote_data']))) {
                        $qRow = (!empty($data['quote_data']) && is_array($data['quote_data'])) ? $data['quote_data'] : $data;
                    }

                    if ($qRow) {
                        $actualQuoteId = intval($qRow['quote_id'] ?? $targetQuoteId);
                        // Merge incoming hidden_fields / discount data into extra
                        $existingExtra = [];
                        if (!empty($qRow['extra_data'])) {
                            $dec = is_array($qRow['extra_data']) ? $qRow['extra_data'] : json_decode($qRow['extra_data'], true);
                            if (is_array($dec)) $existingExtra = $dec;
                        }
                        $qd = (!empty($data['quote_data']) && is_array($data['quote_data'])) ? $data['quote_data'] : [];
                        $qdExtra = [];
                        if (!empty($qd['extra_data'])) {
                            $qdExtra = is_array($qd['extra_data']) ? $qd['extra_data'] : json_decode($qd['extra_data'], true);
                            if (!is_array($qdExtra)) $qdExtra = [];
                        }

                        // Clean and extract fields from payload / qd / extra
                        $inFlat = $data['flat_discount'] ?? $data['flatDiscount'] ?? $qd['flat_discount'] ?? $qd['flatDiscount'] ?? $qdExtra['flat_discount'] ?? $qdExtra['flatDiscount'] ?? null;
                        if ($inFlat === null && (!empty($data['general_discount']) || !empty($qd['general_discount']) || !empty($qdExtra['general_discount']))) {
                            $gd = $data['general_discount'] ?? $qd['general_discount'] ?? $qdExtra['general_discount'];
                            $inFlat = is_array($gd) ? ($gd['amount'] ?? $gd['value'] ?? null) : $gd;
                        }
                        if (is_array($inFlat)) {
                            $inFlat = $inFlat['amount'] ?? $inFlat['value'] ?? 0;
                        }

                        $inCoupon = $data['applied_coupon'] ?? $data['appliedCoupon'] ?? $data['coupon'] ?? $data['promo_code'] ?? $qd['applied_coupon'] ?? $qd['appliedCoupon'] ?? $qd['coupon'] ?? $qdExtra['applied_coupon'] ?? $qdExtra['appliedCoupon'] ?? null;

                        $inCharges = $data['additional_charges'] ?? $data['additionalCharges'] ?? $qd['additional_charges'] ?? $qd['additionalCharges'] ?? $qdExtra['additional_charges'] ?? $qdExtra['additionalCharges'] ?? null;
                        if (is_array($inCharges) && is_array($inCharges['amount'] ?? null)) {
                            $inCharges['amount'] = floatval($inCharges['amount']['amount'] ?? $inCharges['amount']['value'] ?? 0);
                        }

                        // Override with freshest data from the email payload if provided
                        $payloadOverrides = array_filter([
                            'hidden_fields'          => $data['hidden_fields']          ?? $qd['hidden_fields']          ?? $qdExtra['hidden_fields']          ?? null,
                            'category_discounts'     => $data['category_discounts']     ?? $qd['category_discounts']     ?? $qdExtra['category_discounts']     ?? null,
                            'global_discount'        => $data['global_discount']        ?? $qd['global_discount']        ?? $qdExtra['global_discount']        ?? null,
                            'general_discount'       => $data['general_discount']       ?? $qd['general_discount']       ?? $qdExtra['general_discount']       ?? null,
                            'flat_discount'          => $inFlat,
                            'applied_coupon'         => $inCoupon,
                            'additional_charges'     => $inCharges,
                            'overall_gst_enabled'    => $data['overall_gst_enabled']    ?? $qd['overall_gst_enabled']    ?? $qdExtra['overall_gst_enabled']    ?? null,
                            'overall_gst_line_hidden'=> $data['overall_gst_line_hidden']?? $qd['overall_gst_line_hidden']?? $qdExtra['overall_gst_line_hidden']?? null,
                            'overall_gst_rate'       => isset($data['overall_gst_rate']) ? floatval($data['overall_gst_rate']) : (isset($qd['overall_gst_rate']) ? floatval($qd['overall_gst_rate']) : (isset($qdExtra['overall_gst_rate']) ? floatval($qdExtra['overall_gst_rate']) : null)),
                            'round_off_enabled'      => $data['round_off_enabled']      ?? $qd['round_off_enabled']      ?? $qdExtra['round_off_enabled']      ?? null,
                            'custom_headings'        => $data['custom_headings']        ?? $qd['custom_headings']        ?? $qdExtra['custom_headings']        ?? null,
                            'section_headings'       => $data['section_headings']       ?? $qd['section_headings']       ?? $qdExtra['section_headings']       ?? null,
                            'terms_list'             => $data['terms_list']             ?? $data['terms']             ?? $qd['terms_list']             ?? $qd['terms']             ?? $qdExtra['terms_list']             ?? $qdExtra['terms']             ?? null,
                            'terms'                  => $data['terms_list']             ?? $data['terms']             ?? $qd['terms_list']             ?? $qd['terms']             ?? $qdExtra['terms_list']             ?? $qdExtra['terms']             ?? null,
                            'is_final_version'       => $data['is_final_version']       ?? $qd['is_final_version']       ?? $qdExtra['is_final_version']       ?? null,
                        ], function($v) { return $v !== null; });
                        $mergedExtra = array_merge($existingExtra, $payloadOverrides);
                        $qRow['extra_data'] = json_encode($mergedExtra);
                        $qRow['extra_data_parsed'] = $mergedExtra;

                        // Temporary server-side debug log of values received right before PDF render
                        @file_put_contents(__DIR__ . '/../debug_email_pdf.log', date('Y-m-d H:i:s') . " | QuoteID: {$actualQuoteId} | DEBUG RECEIVED VALUES: flat_discount=" . json_encode($mergedExtra['flat_discount'] ?? null) . ", applied_coupon=" . json_encode($mergedExtra['applied_coupon'] ?? null) . ", additional_charges=" . json_encode($mergedExtra['additional_charges'] ?? null) . "\n", FILE_APPEND);

                        if ($actualQuoteId > 0) {
                            // Fetch sections & items fresh from DB
                            $sStmt = $this->conn->prepare("SELECT * FROM quote_sections WHERE quote_id = :qid ORDER BY display_order, section_id ASC");
                            $sStmt->execute(['qid' => $actualQuoteId]);
                            $freshSections = $sStmt->fetchAll(\PDO::FETCH_ASSOC);
                            $extraSecHeadings = $mergedExtra['section_headings'] ?? [];
                            if (is_string($extraSecHeadings)) {
                                $extraSecHeadings = json_decode($extraSecHeadings, true) ?: [];
                            }
                            foreach ($freshSections as $fsIdx => &$fSec) {
                                $fSecId = $fSec['section_id'] ?? '';
                                if (!empty($fSec['custom_headings']) && is_string($fSec['custom_headings'])) {
                                    $fSec['custom_headings'] = json_decode($fSec['custom_headings'], true);
                                }
                                if (empty($fSec['custom_headings'])) {
                                    $fSec['custom_headings'] = $extraSecHeadings[$fSecId] 
                                        ?? ($extraSecHeadings[strval($fSecId)] 
                                        ?? ($extraSecHeadings[$fsIdx] 
                                        ?? ($extraSecHeadings[strval($fsIdx)] 
                                        ?? ($extraSecHeadings[$fSec['section_name'] ?? ''] 
                                        ?? null))));
                                }
                                $iStmt = $this->conn->prepare("SELECT * FROM quote_items WHERE section_id = :sid ORDER BY display_order, item_id ASC");
                                $iStmt->execute(['sid' => $fSec['section_id']]);
                                $fSec['items'] = $iStmt->fetchAll(\PDO::FETCH_ASSOC);
                            }
                            unset($fSec);
                            if (!empty($freshSections)) {
                                $qRow['sections'] = $freshSections;
                            }
                        }

                        if (empty($qRow['sections']) && !empty($data['sections'])) {
                            $qRow['sections'] = $data['sections'];
                        } elseif (empty($qRow['sections']) && !empty($data['quote_data']['sections'])) {
                            $qRow['sections'] = $data['quote_data']['sections'];
                        }

                        $freshPdf = \SimplePdfBuilder::generateQuotePdfBinary($qRow);
                        if (!empty($freshPdf) && strlen($freshPdf) > 5000) {
                            $pdfBinary = $freshPdf;
                            $pdfSource = 'SimplePdfBuilder Priority (Fresh DB Data)';
                            // Also save this fresh PDF snapshot to DB so DB snapshot is always up-to-date
                            if ($actualQuoteId > 0) {
                                try {
                                    $upStmt = $this->conn->prepare("UPDATE quotes SET pdf_snapshot = :pdf, has_snapshot = 1 WHERE quote_id = :id");
                                    $upStmt->bindParam(':pdf', $freshPdf, \PDO::PARAM_LOB);
                                    $upStmt->bindParam(':id', $actualQuoteId, \PDO::PARAM_INT);
                                    $upStmt->execute();
                                } catch (\Exception $e) {}
                            }
                        }
                    }
                } catch (\Exception $spbEx) {
                    error_log("sendEmail SimplePdfBuilder priority error: " . $spbEx->getMessage());
                }
            }

            // 0a. Check if client provided valid base64 PDF directly (e.g. MOM or custom uploaded PDF)
            if (empty($pdfBinary) && !empty($data['pdf_base64'])) {
                $rawBase64 = $data['pdf_base64'];
                if (strpos($rawBase64, 'base64,') !== false) {
                    $parts = explode('base64,', $rawBase64);
                    $rawBase64 = $parts[1] ?? $parts[0];
                }
                $decoded = base64_decode(trim($rawBase64));
                if (strlen($decoded) > 1000) {
                    $pdfBinary = $decoded;
                    $pdfSource = 'Client-provided base64 PDF';
                }
            }

            // 0b. Prioritize Backend Dompdf Vector Generation from HTML payload (Hostinger Shared Hosting Native PDF)
            if (empty($pdfBinary) && (!empty($data['pdf_html']) || !empty($data['html_content']))) {
                try {
                    $rawHtml = $data['pdf_html'] ?? $data['html_content'];

                    // 1. Replace Unicode Emoji characters (👤, 📋, 📅, 📍, 📞, ✉️, 🌐) with crisp vector icon images for Dompdf vector PDF generation
                    $pinSvg = 'data:image/svg+xml;base64,' . base64_encode('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ea580c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>');
                    $phoneSvg = 'data:image/svg+xml;base64,' . base64_encode('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ea580c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>');
                    $emailSvg = 'data:image/svg+xml;base64,' . base64_encode('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ea580c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>');
                    $globeSvg = 'data:image/svg+xml;base64,' . base64_encode('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.7 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10z"/></svg>');
                    $userSvg = 'data:image/svg+xml;base64,' . base64_encode('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0f172a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>');

                    $icPin = '<img src="' . $pinSvg . '" style="width: 10px; height: 10px; vertical-align: -1px; margin-right: 4px; display: inline-block;" />';
                    $icPhone = '<img src="' . $phoneSvg . '" style="width: 10px; height: 10px; vertical-align: -1px; margin-right: 4px; display: inline-block;" />';
                    $icEmail = '<img src="' . $emailSvg . '" style="width: 10px; height: 10px; vertical-align: -1px; margin-right: 4px; display: inline-block;" />';
                    $icGlobe = '<img src="' . $globeSvg . '" style="width: 10px; height: 10px; vertical-align: -1px; margin-right: 4px; display: inline-block;" />';
                    $icUser = '<img src="' . $userSvg . '" style="width: 10px; height: 10px; vertical-align: -1px; margin-right: 4px; display: inline-block;" />';
                    $icClip = '<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNlYTU4MGMiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTYgNGgyYTIgMiAwIDAgMSAyIDV2MTRhMiAyIDAgMCAxLTIgMkg2YTIgMiAwIDAgMS0yLTJWNmEyIDIgMCAwIDEgMi0yaDIiLz48cmVjdCB4PSI4IiB5PSIyIiB3aWR0aD0iOCIgaGVpZ2h0PSI0IiByeD0iMSIgcnk9IjEiLz48L3N2Zz4=" style="height: 20px; vertical-align: middle; margin-right: 8px;" />';
                    $icCal = '<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMzYjgyZjgiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB4PSIzIiB5PSI0IiB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHJ4PSIyIiByeT0iMiIvPjxsaW5lIHgxPSIxNiIgeTE9IjIiIHgyPSIxNiIgeTI9IjYiLz48bGluZSB4MT0iOCIgeTE9IjIiIHgyPSI4IiB5Mj0iNiIvPjxsaW5lIHgxPSIzIiB5MT0iMTAiIHgyPSIyMSIgeTI9IjEwIi8+PC9zdmc+" style="height: 20px; vertical-align: middle; margin-right: 8px;" />';

                    $rawHtml = str_replace(["\xEF\xB8\x8F", "\u{FE0F}"], '', $rawHtml);

                    $emojiMap = [
                        '📍' => $icPin,
                        '📞' => $icPhone,
                        '✉'  => $icEmail,
                        '🌐' => $icGlobe,
                        '👤' => $icUser,
                        '📋' => $icClip,
                        '📅' => $icCal
                    ];
                    $rawHtml = strtr($rawHtml, $emojiMap);

                    // 2. Embed Base64 Company Logo (1.png) safely by preserving existing image style attributes
                    $logoPath = __DIR__ . '/../../frontend/src/assets/1.png';
                    if (file_exists($logoPath)) {
                        $logoData = file_get_contents($logoPath);
                        $logoBase64 = 'data:image/png;base64,' . base64_encode($logoData);
                        $rawHtml = preg_replace('/src=["\'][^"\']*(?:1\.png|logo)[^"\']*["\']/i', 'src="' . $logoBase64 . '"', $rawHtml);
                    }

                    // 3. Clean up SVG tags to prevent rendering artifacts in Dompdf
                    $rawHtml = preg_replace('/<svg[^>]*>.*?<\/svg>/is', '', $rawHtml);

                    // 4. Clean up position fixed, transform, and convert display:flex to display:block on page containers for Dompdf page breaking
                    $rawHtml = preg_replace('/position:\s*fixed;?/i', 'position: relative;', $rawHtml);
                    $rawHtml = preg_replace('/\btransform:\s*[^;]+;?/i', '', $rawHtml);
                    $rawHtml = preg_replace('/(id=["\']pdf-page-[1234]["\'][^>]*style=["\'][^"\']*)display:\s*flex;?/i', '$1display: block;', $rawHtml);
                    $rawHtml = preg_replace('/(class=["\']page-break-[^"\']*["\'][^>]*style=["\'][^"\']*)display:\s*flex;?/i', '$1display: block;', $rawHtml);

                    // 5. Inject explicit inline page-break-after style on page containers
                    $rawHtml = preg_replace('/(id=["\']pdf-page-[1234]["\'][^>]*style=["\'])/i', '$1page-break-after: always !important; break-after: page !important; ', $rawHtml);
                    $rawHtml = preg_replace('/(class=["\']page-break-(?:cover|project-info|modules-summary)["\'][^>]*style=["\'])/i', '$1page-break-after: always !important; break-after: page !important; ', $rawHtml);
                    $rawHtml = preg_replace('/(class=["\'][^"\']*page-wrap(?!-last)[^"\']*["\'][^>]*style=["\'])/i', '$1page-break-after: always !important; break-after: page !important; ', $rawHtml);

                    // 6. Force page-break-before on agreements-contract-wrapper and package-page-break so Agreement starts on a fresh page
                    $rawHtml = preg_replace('/(class=["\'][^"\']*(?:agreements-contract-wrapper|package-page-break)[^"\']*["\'][^>]*style=["\'])/i', '$1page-break-before: always !important; break-before: page !important; clear: both !important; ', $rawHtml);

                    require_once __DIR__ . '/../libs/dompdf/autoload.inc.php';

                    $options = new \Dompdf\Options();
                    $options->set('isHtml5ParserEnabled', true);
                    $options->set('isRemoteEnabled', true);
                    $options->set('isFontSubsettingEnabled', false);
                    $options->set('defaultFont', 'DejaVu Sans');
                    $options->set('dpi', 96);

                    $dompdf = new \Dompdf\Dompdf($options);

                    // Ensure client signature is injected if missing from HTML payload but present in payload or database
                    if (strpos($rawHtml, 'Authorized Signatories from Client') !== false && strpos($rawHtml, 'alt="Client Signature"') === false) {
                        $clientSig = !empty($data['client_signature']) ? $data['client_signature'] : null;
                        if (empty($clientSig)) {
                            $checkPid = $data['project_id'] ?? $targetQuoteId ?? null;
                            $checkRef = $data['ref_id'] ?? null;
                            try {
                                if ($checkPid || $checkRef) {
                                    $sigStmt = $this->conn->prepare("SELECT client_signature FROM agreements WHERE (project_id = :pid OR ref_id = :ref OR id = :pid) AND client_signature IS NOT NULL AND client_signature != '' ORDER BY id DESC LIMIT 1");
                                    $sigStmt->execute([':pid' => $checkPid, ':ref' => $checkRef]);
                                    $clientSig = $sigStmt->fetchColumn() ?: null;
                                }
                                if (empty($clientSig) && $checkPid) {
                                    $pSigStmt = $this->conn->prepare("SELECT client_signature FROM projects WHERE (project_id = :pid OR project_code = :pid) AND client_signature IS NOT NULL AND client_signature != '' LIMIT 1");
                                    $pSigStmt->execute([':pid' => $checkPid]);
                                    $clientSig = $pSigStmt->fetchColumn() ?: null;
                                }
                            } catch (\Exception $sigLookupEx) {}
                        }
                        if (!empty($clientSig)) {
                            $sigImgHtml = '<img src="' . $clientSig . '" alt="Client Signature" style="height: 45px; max-width: 160px; object-fit: contain; display: block;" />';
                            $rawHtml = preg_replace(
                                '/(Authorized Signatories from Client.*?<div[^>]*>)(<\/div>)/s',
                                '$1' . $sigImgHtml . '$2',
                                $rawHtml,
                                1
                            );
                        }
                    }

                    // Wrap in clean, high-precision HTML document with DejaVu Sans built-in Unicode font
                    $fullDocumentHtml = '
                    <!DOCTYPE html>
                    <html>
                    <head>
                      <meta charset="UTF-8">
                      <style>
                        /* Set Dompdf @page margin to 0 and handle printable margin via wrapper padding */
                        @page { margin: 0px; }
                        * { box-sizing: border-box; }
                        html, body {
                          margin: 0 !important;
                          padding: 0 !important;
                          background-color: #ffffff;
                          color: #0f172a;
                        }
                        body {
                          font-family: "DejaVu Sans", Arial, Helvetica, sans-serif;
                          font-size: 9pt;
                          color: #0f172a;
                          margin: 0 !important;
                          padding: 0 !important;
                          background: #ffffff;
                        }
                        .pdf-explicit-margin-wrapper {
                          margin: 38px 45px 26px 45px !important;
                          width: 704px !important;
                          max-width: 704px !important;
                          padding: 0 !important;
                          box-sizing: border-box !important;
                        }

                        /* Hard Page Break Rules */
                        .package-page-break,
                        .agreements-contract-wrapper {
                          page-break-before: always !important;
                          break-before: page !important;
                          clear: both !important;
                          display: block !important;
                        }

                        .agreements-quotation-wrapper .page-wrap,
                        .agreements-print-preview .page-wrap,
                        .page-wrap {
                          page-break-after: always !important;
                          break-after: page !important;
                        }

                        /* Transparent signature spacer cell */
                        td.sig-spacer-td,
                        .sig-spacer-td {
                          border: none !important;
                          background-color: transparent !important;
                          background: transparent !important;
                          padding: 0 !important;
                        }

                        .agreements-quotation-wrapper .page-wrap,
                        .agreements-quotation-wrapper .page-wrap-last,
                        .agreements-print-preview .page-wrap,
                        .agreements-print-preview .page-wrap-last,
                        .page-wrap,
                        .page-wrap-last {
                          padding: 30px 12px 24px 12px !important;
                          width: 100% !important;
                          max-width: 100% !important;
                          box-sizing: border-box !important;
                        }

                        .agreements-contract-wrapper .page,
                        .page,
                        .contract-document {
                          padding-left: 12px !important;
                          padding-right: 12px !important;
                          width: 100% !important;
                          max-width: 100% !important;
                          box-sizing: border-box !important;
                        }
                        /* Allow text, tables, paragraphs, and list items to split naturally across pages */
                        table, p, li, ul, ol, div {
                          page-break-inside: auto !important;
                          break-inside: auto !important;
                        }

                        tr {
                          page-break-inside: avoid !important;
                          break-inside: avoid !important;
                        }

                        /* Prevent orphaned headings */
                        h1, h2, h3, h4, .subTitle {
                          page-break-after: avoid !important;
                          break-after: avoid !important;
                        }

                        p { margin: 0 0 3px 0; line-height: 1.45; }
                        
                        /* Content & Contract Data Tables in Dompdf */
                        .agreements-contract-wrapper table,
                        .contract-wrapper table,
                        .contract-document table,
                        .page-break-project-info table,
                        .page-break-modules-summary table,
                        .page-break-detail-tables table,
                        .page-break-terms-conditions table,
                        .item-table,
                        .summary-table {
                          width: 100% !important;
                          border-collapse: collapse !important;
                          margin: 6px 0 !important;
                          font-size: 8.5pt !important;
                        }

                        .agreements-contract-wrapper th,
                        .contract-wrapper th,
                        .contract-document th,
                        .page-break-project-info th,
                        .page-break-modules-summary th,
                        .page-break-detail-tables th,
                        .page-break-terms-conditions th,
                        .item-table th,
                        .summary-table th {
                          border: 1px solid #1e293b;
                          padding: 6px 8px;
                          font-weight: bold;
                          text-align: left;
                          background-color: rgba(254, 143, 62, 1) !important;
                          background: rgba(254, 143, 62, 1) !important;
                          color: #ffffff !important;
                        }

                        .agreements-contract-wrapper td,
                        .contract-wrapper td,
                        .contract-document td,
                        .page-break-project-info td,
                        .page-break-modules-summary td,
                        .page-break-detail-tables td,
                        .page-break-terms-conditions td,
                        .item-table td,
                        .summary-table td {
                          border: 1px solid #cbd5e1;
                          padding: 5px 6px;
                          vertical-align: top;
                          color: #0f172a;
                        }

                        /* Cover Page (#pdf-page-1) Explicit Design Preservation for Dompdf */
                        #pdf-page-1 table {
                          width: 100%;
                          margin: 0;
                          border-collapse: collapse;
                        }

                        #pdf-page-1 td {
                          border: none !important;
                          padding: 0;
                        }

                        #pdf-page-1 table.quote-header-details-table {
                          width: auto !important;
                          margin: 0 auto !important;
                          border: 2px solid #ea580c !important;
                          border-radius: 20px !important;
                          border-collapse: separate !important;
                          background-color: #ffffff !important;
                        }

                        #pdf-page-1 table.quote-header-details-table td {
                          border: none !important;
                          padding: 12px 24px !important;
                          vertical-align: middle !important;
                        }

                        #pdf-page-1 table.quote-header-details-table td+td {
                          border-left: 1.5px solid #fed7aa !important;
                        }

                        #pdf-page-1 .cover-card-orange-strip {
                          width: 100% !important;
                          background-color: #ea580c !important;
                          background: #ea580c !important;
                          border-collapse: collapse !important;
                        }

                        #pdf-page-1 .cover-card-orange-strip td {
                          border: none !important;
                          padding: 10px 14px !important;
                          color: #ffffff !important;
                          font-size: 8.5pt !important;
                          font-weight: 800 !important;
                          text-align: center !important;
                          vertical-align: middle !important;
                        }

                        #pdf-page-1 .cover-card-orange-strip td+td {
                          border-left: 1.5px solid #ffffff !important;
                        }

                        #pdf-page-1 .cover-card-light-strip {
                          width: 100% !important;
                          background-color: #fff7ed !important;
                          background: #fff7ed !important;
                          border-top: 1.5px solid #fed7aa !important;
                          border-collapse: collapse !important;
                        }

                        #pdf-page-1 .cover-card-light-strip td {
                          border: none !important;
                          padding: 10px 14px !important;
                          color: #0f172a !important;
                          font-size: 9pt !important;
                          font-weight: 900 !important;
                          text-align: center !important;
                          vertical-align: middle !important;
                        }

                        #pdf-page-1 .cover-card-light-strip td+td {
                          border-left: 1.5px solid #fed7aa !important;
                        }

                        ul, ol { margin: 4px 0; padding-left: 18px; }
                        li { margin-bottom: 4px; line-height: 1.45; }
                        /* Page break enforcement for Dompdf vector PDF generation */
                        .page-break,
                        .html2pdf__page-break,
                        .page-break-cover,
                        .page-break-project-info,
                        .page-break-modules-summary,
                        #pdf-page-1,
                        #pdf-page-2,
                        #pdf-page-3,
                        #pdf-page-4 {
                          page-break-after: always !important;
                          break-after: page !important;
                          page-break-inside: avoid !important;
                          break-inside: avoid !important;
                          clear: both !important;
                          display: block !important;
                          box-sizing: border-box !important;
                        }

                        .agreements-contract-wrapper {
                          clear: both !important;
                          display: block !important;
                        }
                        img { max-height: 48px; width: auto; max-width: 190px; object-fit: contain; }
                        .page-break-cover img, #pdf-page-1 img { max-height: none !important; }

                        /* Reset contract, quotation & handover page containers to zero padding */
                        .merged-package-wrapper,
                        .agreements-print-preview,
                        .agreements-contract-wrapper,
                        .contract-wrapper,
                        .contract-document,
                        .agreements-contract-wrapper .page,
                        .contract-wrapper .page,
                        div.page,
                        #pdf-page-1,
                        #pdf-page-2,
                        #pdf-page-3,
                        #pdf-page-4,
                        .page-break-cover,
                        .page-break-project-info,
                        .page-break-modules-summary {
                          padding: 0 !important;
                          margin: 0 auto !important;
                          width: 100% !important;
                          max-width: 100% !important;
                          box-shadow: none !important;
                          box-sizing: border-box !important;
                        }

                        /* Dompdf layout helper: convert flex container rows into table display for perfect alignment */
                        .merged-package-wrapper div[style*="display: flex"],
                        .merged-package-wrapper div[style*="display:flex"],
                        .agreements-print-preview div[style*="display: flex"],
                        .agreements-print-preview div[style*="display:flex"] {
                          display: table !important;
                          width: 100% !important;
                          table-layout: fixed !important;
                        }

                        /* List Item positioning fixes for Dompdf: force table display so number and text sit side-by-side */
                        div.listItem {
                          display: table !important;
                          width: 100% !important;
                          table-layout: fixed !important;
                          margin-bottom: 4px !important;
                        }
                        span.listNum, span[style*="width: 22px"], span[style*="width: 24px"], span[style*="width:22px"], span[style*="width:24px"] {
                          display: table-cell !important;
                          width: 24px !important;
                          vertical-align: top !important;
                          font-weight: bold !important;
                        }
                        span.listText {
                          display: table-cell !important;
                          vertical-align: top !important;
                          line-height: 1.45 !important;
                        }

                        /* Ensure nested tables display at 100% width without cell collapse */
                        table {
                          width: 100% !important;
                          border-collapse: collapse !important;
                        }

                        table.cover-card-orange-strip, table.cover-card-light-strip, table.quote-header-details-table {
                          width: 100% !important;
                          border-collapse: collapse !important;
                        }

                        .subTitle { font-weight: bold; font-size: 11pt; text-decoration: underline; color: #ea580c; margin-top: 8px !important; margin-bottom: 2px !important; page-break-after: avoid; }
                      </style>
                    </head>
                    <body>
                      <div class="pdf-explicit-margin-wrapper" style="margin: 38px 52px 26px 52px !important; width: 690px !important; max-width: 690px !important; padding: 0 !important; box-sizing: border-box !important;">
                        ' . $rawHtml . '
                      </div>
                    </body>
                    </html>
                    ';

                    // Save exact raw HTML payload for Chrome inspection before Dompdf::loadHtml()
                    file_put_contents(__DIR__ . '/../last_email_payload.html', $fullDocumentHtml);

                    $dompdf->loadHtml($fullDocumentHtml);
                    $dompdf->setPaper('A4', 'portrait');
                    $dompdf->render();

                    $pdfBinary = $dompdf->output();
                    file_put_contents(__DIR__ . '/../last_sent_email_output.pdf', $pdfBinary);
                    $pdfSource = 'Hostinger Backend Dompdf Vector Render';
                } catch (\Exception $domEx) {
                    error_log("Backend Dompdf error: " . $domEx->getMessage());
                }
            }

            // 1. Prioritize direct frontend Base64 PDF payload if sent and Dompdf not used
            if (empty($pdfBinary) && !empty($data['pdf_base64'])) {
                $rawBase64 = $data['pdf_base64'];
                if (strpos($rawBase64, 'base64,') !== false) {
                    $parts = explode('base64,', $rawBase64);
                    $rawBase64 = $parts[1] ?? $parts[0];
                }
                $pdfBinary = base64_decode(trim($rawBase64));
                $pdfSource = 'Frontend Base64 Payload';
            }

            // 2. If no frontend payload provided, fall back to DB snapshot / backend PDF
            if (empty($pdfBinary) && $targetQuoteId > 0) {
                // Persist any fresh hidden_fields, discounts, promo codes, or charges passed in email payload into DB extra_data
                if (isset($data['hidden_fields']) || isset($data['category_discounts']) || isset($data['applied_coupon']) || isset($data['additional_charges']) || isset($data['overall_gst_enabled']) || isset($data['round_off_enabled'])) {
                    try {
                        $qStmt = $this->conn->prepare("SELECT extra_data FROM quotes WHERE quote_id = :id");
                        $qStmt->execute(['id' => $targetQuoteId]);
                        $existingRow = $qStmt->fetch(PDO::FETCH_ASSOC);
                        $existingExtra = [];
                        if ($existingRow && !empty($existingRow['extra_data'])) {
                            $decoded = json_decode($existingRow['extra_data'], true);
                            if (is_array($decoded)) $existingExtra = $decoded;
                        }
                        $mergedExtra = array_merge($existingExtra, array_filter([
                            'applied_coupon' => $data['applied_coupon'] ?? $data['appliedCoupon'] ?? ($existingExtra['applied_coupon'] ?? null),
                            'additional_charges' => $data['additional_charges'] ?? ($existingExtra['additional_charges'] ?? null),
                            'general_discount' => $data['general_discount'] ?? ($existingExtra['general_discount'] ?? null),
                            'global_discount' => $data['global_discount'] ?? ($existingExtra['global_discount'] ?? null),
                            'category_discounts' => $data['category_discounts'] ?? ($existingExtra['category_discounts'] ?? null),
                            'overall_gst_enabled' => $data['overall_gst_enabled'] ?? ($existingExtra['overall_gst_enabled'] ?? true),
                            'overall_gst_line_hidden' => $data['overall_gst_line_hidden'] ?? ($existingExtra['overall_gst_line_hidden'] ?? false),
                            'overall_gst_rate' => isset($data['overall_gst_rate']) ? floatval($data['overall_gst_rate']) : ($existingExtra['overall_gst_rate'] ?? 0),
                            'round_off_enabled' => $data['round_off_enabled'] ?? ($existingExtra['round_off_enabled'] ?? true),
                            'custom_headings' => $data['custom_headings'] ?? ($existingExtra['custom_headings'] ?? null),
                            'section_headings' => $data['section_headings'] ?? ($existingExtra['section_headings'] ?? null),
                            'hidden_fields' => $data['hidden_fields'] ?? ($existingExtra['hidden_fields'] ?? null),
                            'is_final_version' => $data['is_final_version'] ?? ($existingExtra['is_final_version'] ?? false)
                        ], function($v) { return $v !== null; }));

                        $upExtraStmt = $this->conn->prepare("UPDATE quotes SET extra_data = :extra WHERE quote_id = :id");
                        $upExtraStmt->execute(['extra' => json_encode($mergedExtra), 'id' => $targetQuoteId]);
                    } catch (\Exception $ex) {}
                }

                try {
                    require_once __DIR__ . '/PdfController.php';
                    $pdfCtrl = new \PdfController($this->conn);
                    // Force refresh PDF snapshot via Puppeteer using latest DB settings
                    $pdfCtrl->createAndStoreSnapshot($targetQuoteId, $projectId ?? 0);

                    $snapRes = $pdfCtrl->getPdfForEmail($targetQuoteId, $projectId ?? 0);
                    if ($snapRes && !empty($snapRes['pdf_base64'])) {
                        $rawBase64 = $snapRes['pdf_base64'];
                        if (strpos($rawBase64, 'base64,') !== false) {
                            $parts = explode('base64,', $rawBase64);
                            $rawBase64 = $parts[1] ?? $parts[0];
                        }
                        $pdfBinary = base64_decode(trim($rawBase64));
                        $pdfSource = 'Database PDF Snapshot / Backend Render';
                    }
                } catch (\Exception $pdfSnapEx) {
                    error_log("sendEmail DB PDF snapshot fetch error: " . $pdfSnapEx->getMessage());
                }

                if (empty($pdfBinary) && ($targetQuoteId > 0 || !empty($targetQuoteNum) || !empty($data['sections']) || !empty($data['quote_data']))) {
                    try {
                        require_once __DIR__ . '/../helpers/SimplePdfBuilder.php';
                        $qRow = null;
                        if ($targetQuoteId > 0) {
                            $qStmt = $this->conn->prepare("SELECT * FROM quotes WHERE quote_id = :id");
                            $qStmt->execute(['id' => $targetQuoteId]);
                            $qRow = $qStmt->fetch(\PDO::FETCH_ASSOC);
                        }
                        if (!$qRow && !empty($targetQuoteNum)) {
                            $qStmt = $this->conn->prepare("SELECT * FROM quotes WHERE quote_number = :qnum");
                            $qStmt->execute(['qnum' => $targetQuoteNum]);
                            $qRow = $qStmt->fetch(\PDO::FETCH_ASSOC);
                        }
                        if (!$qRow && (!empty($data['sections']) || !empty($data['quote_data']))) {
                            $qRow = (!empty($data['quote_data']) && is_array($data['quote_data'])) ? $data['quote_data'] : $data;
                        }
                        if ($qRow) {
                            if (empty($qRow['sections']) && !empty($data['sections'])) {
                                $qRow['sections'] = $data['sections'];
                            } elseif (empty($qRow['sections']) && !empty($data['quote_data']['sections'])) {
                                $qRow['sections'] = $data['quote_data']['sections'];
                            }
                            $pdfBinary = \SimplePdfBuilder::generateQuotePdfBinary($qRow);
                            $pdfSource = 'Direct SimplePdfBuilder Fallback';
                        }
                    } catch (\Exception $spbEx) {
                        error_log("sendEmail direct SimplePdfBuilder error: " . $spbEx->getMessage());
                    }
                }
            }

            $byteLen = strlen($pdfBinary);
            file_put_contents('debug_email_pdf.log', date('Y-m-d H:i:s') . " | QuoteID: {$targetQuoteId} | To: {$to} | Source: {$pdfSource} | Size: {$byteLen} bytes\n", FILE_APPEND);

            if (!empty($pdfBinary) && $byteLen > 1000) {
                $attachmentName = !empty($data['pdf_filename']) ? preg_replace('/[^a-zA-Z0-9_\.-]/', '', $data['pdf_filename']) : "Quotation_{$cleanQNum}.pdf";
                if (substr(strtolower($attachmentName), -4) !== '.pdf') $attachmentName .= '.pdf';
                $mail->addStringAttachment($pdfBinary, $attachmentName, 'base64', 'application/pdf');
                @file_put_contents('c:/xampp/htdocs/livrcart/Production_Email_Attachment_Quote' . $targetQuoteId . '.pdf', $pdfBinary);
                @file_put_contents('C:/Users/Shaik Ansar/.gemini/antigravity-ide/brain/91c581a2-b340-4403-af55-f4e3d0a202c7/Production_Email_Attachment_Quote' . $targetQuoteId . '.pdf', $pdfBinary);
                $hasValidPdf = true;
            }

            if ($isMomPdf && !$hasValidPdf) {
                return ["success" => false, "message" => "Unable to attach MOM PDF."];
            }

            // Build Acknowledgement Action Buttons (ACCEPT and REJECT) for Quotations
            $ackBlockHtml = '';
            if (!$isMomPdf) {
                $actualQid = $targetQuoteId;
                if ($actualQid <= 0 && !empty($targetQuoteNum)) {
                    $chk = $this->conn->prepare("SELECT quote_id FROM quotes WHERE quote_number = :qnum");
                    $chk->execute(['qnum' => $targetQuoteNum]);
                    $actualQid = intval($chk->fetchColumn() ?: 0);
                }
                if ($actualQid <= 0 && !empty($targetQuoteNum)) {
                    $chk = $this->conn->prepare("SELECT quote_id FROM quotes WHERE quote_number LIKE :qnum ORDER BY quote_id DESC LIMIT 1");
                    $chk->execute(['qnum' => '%' . $targetQuoteNum . '%']);
                    $actualQid = intval($chk->fetchColumn() ?: 0);
                }

                $currentQRow = null;
                if ($actualQid > 0) {
                    $chkQ = $this->conn->prepare("SELECT quote_id, ack_token, ack_status, status FROM quotes WHERE quote_id = :id");
                    $chkQ->execute([':id' => $actualQid]);
                    $currentQRow = $chkQ->fetch(PDO::FETCH_ASSOC);
                }
                if (!$currentQRow && !empty($targetQuoteNum)) {
                    $chkQ = $this->conn->prepare("SELECT quote_id, ack_token, ack_status, status FROM quotes WHERE quote_number = :qnum");
                    $chkQ->execute([':qnum' => $targetQuoteNum]);
                    $currentQRow = $chkQ->fetch(PDO::FETCH_ASSOC);
                    if ($currentQRow && isset($currentQRow['quote_id'])) {
                        $actualQid = intval($currentQRow['quote_id']);
                    }
                }

                if ($currentQRow || $actualQid > 0) {
                    $isAlreadyAccepted = ($currentQRow && (($currentQRow['ack_status'] ?? '') === 'accepted' || in_array(strtolower($currentQRow['status'] ?? ''), ['approved', 'accepted', 'order_converted', 'won'])));
                    $isAlreadyRejected = ($currentQRow && (($currentQRow['ack_status'] ?? '') === 'rejected' || in_array(strtolower($currentQRow['status'] ?? ''), ['order_lost', 'rejected', 'declined'])));

                    // If quote was previously rejected, re-sending proposal resets the rejection state so client can review & accept/reject
                    if ($isAlreadyRejected && $actualQid > 0) {
                        try {
                            $this->conn->prepare("UPDATE quotes SET ack_status = 'pending', status = 'proposal', acknowledged_at = NULL, acknowledged_ip = NULL WHERE quote_id = :id")->execute([':id' => $actualQid]);
                        } catch (Exception $ex) {}
                        $isAlreadyRejected = false;
                        if ($currentQRow) {
                            $currentQRow['ack_status'] = 'pending';
                            $currentQRow['status'] = 'proposal';
                        }
                    }

                    if ($isAlreadyAccepted) {
                        $ackBlockHtml = '
                        <div style="background: linear-gradient(180deg, #f0fdf4 0%, #dcfce7 100%); border: 2px solid #16a34a; border-radius: 16px; padding: 26px 20px; margin: 26px 0; text-align: center; box-shadow: 0 4px 18px rgba(22, 163, 74, 0.12);">
                            <div style="margin-bottom: 16px;">
                                <div style="display: inline-block; background: #16a34a; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; font-weight: 800; padding: 13px 36px; border-radius: 10px; box-shadow: 0 4px 14px rgba(22, 163, 74, 0.35); text-transform: uppercase; letter-spacing: 0.5px;">
                                    &#10003;&nbsp; ACCEPTED
                                </div>
                            </div>
                            <div style="background: #ffffff; border: 1.5px solid #86efac; border-radius: 12px; padding: 10px 16px; margin: 0 auto 16px auto; max-width: 460px;">
                                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                                    <tr>
                                        <td style="text-align: left; vertical-align: middle; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif; font-size: 13.5px; font-weight: 800; color: #16a34a;">
                                            &#10004;&nbsp; Quotation Accepted Successfully &#10003;
                                        </td>
                                        <td style="text-align: right; vertical-align: middle;">
                                            <span style="background: #16a34a; color: #ffffff; padding: 4px 10px; border-radius: 8px; font-size: 11px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">
                                                CONFIRMED
                                            </span>
                                        </td>
                                    </tr>
                                </table>
                            </div>
                            <div style="font-size: 1.22rem; font-weight: 900; color: #14532d; margin-bottom: 6px;">
                                Quotation Proposal Officially Confirmed
                            </div>
                            <p style="font-size: 0.92rem; color: #166534; margin: 0 auto 16px auto; max-width: 480px; line-height: 1.55;">
                                Thank you! You have accepted the quotation proposal. Your project has been officially confirmed and our Admin, Design, and Sales teams have been notified!
                            </p>
                            <div style="font-size: 0.82rem; color: #15803d; font-weight: 700;">
                                🔒 Locked as Initial Quotation &bull; Project Onboarding in Progress
                            </div>
                        </div>';
                    } elseif ($isAlreadyRejected) {
                        $ackBlockHtml = '
                        <div style="background: #fef2f2; border: 2px solid #ef4444; border-radius: 16px; padding: 26px 20px; margin: 26px 0; text-align: center;">
                            <div style="margin-bottom: 16px;">
                                <div style="display: inline-block; background: #dc2626; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; font-weight: 800; padding: 13px 36px; border-radius: 10px; box-shadow: 0 4px 14px rgba(220, 38, 38, 0.3); text-transform: uppercase; letter-spacing: 0.5px;">
                                    &#10005;&nbsp; REJECTED
                                </div>
                            </div>
                            <div style="display: inline-block; background: #dc2626; color: #ffffff; border-radius: 20px; padding: 5px 18px; font-size: 0.8rem; font-weight: 800; text-transform: uppercase; margin-bottom: 10px;">
                                &#10005;&nbsp; Quotation Declined
                            </div>
                            <p style="font-size: 0.92rem; color: #991b1b; margin: 0 auto; max-width: 480px; line-height: 1.55;">
                                Your response has been recorded. We appreciate your consideration and hope to assist you in the future.
                            </p>
                        </div>';
                    } else {
                        // Always generate a fresh unique token when sending or re-sending quotation proposal
                        $token = null;
                        if ($actualQid > 0) {
                            $tokenRes = $this->generateAckToken($actualQid);
                            if ($tokenRes['success']) {
                                $token = $tokenRes['token'];
                            }
                        }
                        if (!$token && !empty($currentQRow['ack_token'])) {
                            $token = $currentQRow['ack_token'];
                        }
                        if (!empty($token)) {
                            $httpScheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
                            $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
                            if (defined('PUBLIC_ACK_URL') && !empty(PUBLIC_ACK_URL)) {
                                $baseUrl  = PUBLIC_ACK_URL . '?token=' . $token;
                            } elseif (strpos($host, 'bizools.in') !== false || (defined('IS_PRODUCTION') && IS_PRODUCTION && strpos($host, 'localhost') === false)) {
                                $baseUrl  = 'https://livincart.bizools.in/api/acknowledge.php?token=' . $token;
                            } elseif (strpos($host, 'localhost') !== false || strpos($host, '127.0.0.1') !== false) {
                                $lanIp = gethostbyname(gethostname());
                                if (!empty($lanIp) && $lanIp !== '127.0.0.1' && filter_var($lanIp, FILTER_VALIDATE_IP)) {
                                    $host = $lanIp;
                                }
                                $baseUrl  = $httpScheme . '://' . $host . '/livrcart/demoark/api/acknowledge.php?token=' . $token;
                            } else {
                                $baseUrl  = $httpScheme . '://' . $host . '/api/acknowledge.php?token=' . $token;
                            }
                            $acceptUrl = $baseUrl . '&action=accept';
                            $rejectUrl = $baseUrl . '&action=reject';

                            $ackBlockHtml = '
                            <div style="background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%); border: 1.5px solid #cbd5e1; border-radius: 16px; padding: 26px 20px; margin: 26px 0; text-align: center; box-shadow: 0 4px 18px rgba(15,23,42,0.05);">
                                <div style="background: #fff7ed; border: 1.5px solid #fed7aa; border-radius: 12px; padding: 12px 18px; margin: 0 auto 18px auto; max-width: 460px;">
                                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                                        <tr>
                                            <td style="text-align: left; vertical-align: middle; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif; font-size: 13.5px; font-weight: 800; color: #c2410c;">
                                                &#9203;&nbsp; Decision Pending: Review &amp; Authorize
                                            </td>
                                            <td style="text-align: right; vertical-align: middle;">
                                                <span style="background: #ea580c; color: #ffffff; padding: 4px 10px; border-radius: 8px; font-size: 11px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">
                                                    ACTION REQ.
                                                </span>
                                            </td>
                                        </tr>
                                    </table>
                                </div>
                                <div style="font-size: 1.15rem; font-weight: 900; color: #0f172a; margin-bottom: 6px;">
                                    Review &amp; Authorize Quotation
                                </div>
                                <p style="font-size: 0.88rem; color: #475569; margin: 0 auto 20px auto; max-width: 480px; line-height: 1.55;">
                                    Please review the quotation proposal and submit your official response:
                                </p>
                                <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto; width: 100%; max-width: 440px;">
                                    <tr>
                                        <td align="center" style="padding: 6px 6px; width: 50%;">
                                            <a href="' . $acceptUrl . '" target="_blank" style="display: block; background: #16a34a; background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 800; line-height: 1.25; text-align: center; text-decoration: none; padding: 13px 12px; border-radius: 10px; box-shadow: 0 4px 12px rgba(22, 163, 74, 0.3); text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #14532d; white-space: nowrap; box-sizing: border-box;">
                                                &#10003;&nbsp; ACCEPT QUOTATION
                                            </a>
                                        </td>
                                        <td align="center" style="padding: 6px 6px; width: 50%;">
                                            <a href="' . $rejectUrl . '" target="_blank" style="display: block; background: #fff5f5; color: #dc2626; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 800; line-height: 1.25; text-align: center; text-decoration: none; padding: 13px 12px; border-radius: 10px; box-shadow: 0 2px 8px rgba(220, 38, 38, 0.12); border: 1.5px solid #ef4444; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; box-sizing: border-box;">
                                                &#10005;&nbsp; REJECT QUOTATION
                                            </a>
                                        </td>
                                    </tr>
                                </table>
                                <div style="font-size: 0.78rem; color: #64748b; margin-top: 16px; line-height: 1.4;">
                                    🔒 Secure digital decision &bull; Once accepted, your project is officially booked and design onboarding commences automatically.
                                </div>
                            </div>';

                            try {
                                $this->conn->prepare("UPDATE quotes SET ack_email_sent_at = NOW() WHERE quote_id = :id")->execute([':id' => $actualQid]);
                            } catch (Exception $ex) {}

                            // Google AMP for Email Document (text/x-amp-html)
                            // Strictly only attach AMP if in production environment with public HTTPS endpoint
                            if (defined('IS_PRODUCTION') && IS_PRODUCTION && defined('AMP_ENDPOINT_URL') && !empty(AMP_ENDPOINT_URL)) {
                                require_once __DIR__ . '/../helpers/AmpQuoteEmailBuilder.php';
                                $ampEndpoint = AMP_ENDPOINT_URL;
                                $mail->AmpBody = \AmpQuoteEmailBuilder::buildAmpEmail(
                                    array_merge($currentQRow ?: [], [
                                        'quote_number' => $cleanQNum,
                                        'quote_id'     => $actualQid,
                                        'client_name'  => $data['to'] ?? $to,
                                        'total_amount' => $data['total_amount'] ?? ($currentQRow['total_amount'] ?? 0),
                                        'sections'     => $data['sections'] ?? []
                                    ]),
                                    $token,
                                    $ampEndpoint
                                );
                            }
                        }
                    }
                }
            }

            // Fallback plain text
            $mail->AltBody = "Please review your quotation proposal from Livincart Interiors.\nReference: {$cleanQNum}\nAccept: " . ($acceptUrl ?? '') . "\nReject: " . ($rejectUrl ?? '');

            // Styled HTML Email Body (text/html fallback)
            $formattedEmailBody = "
            <div style=\"font-family: 'Segoe UI', Arial, sans-serif; color: #0c1527; max-width: 650px; margin: 0 auto; background-color: #ffffff; border: 1.5px solid #ffe8c2; border-radius: 14px; padding: 24px; box-shadow: 0 4px 16px rgba(0,0,0,0.06);\">
                <div style=\"border-bottom: 2px solid #fca412; padding-bottom: 14px; margin-bottom: 18px;\">
                    <table role=\"presentation\" border=\"0\" cellpadding=\"0\" cellspacing=\"0\" width=\"100%\">
                        <tr>
                            <td style=\"width: 48px; vertical-align: middle;\">
                                <img src=\"https://livincart.bizools.in/api/assets/logo.png\" alt=\"Livincart\" style=\"height: 42px; width: 42px; object-fit: contain; border-radius: 8px; display: block;\" />
                            </td>
                            <td style=\"padding-left: 12px; vertical-align: middle;\">
                                <h2 style=\"margin: 0; color: #0c1527; font-size: 1.25rem;\">Livincart <span style=\"color: #fca412;\">Interiors</span></h2>
                                <p style=\"margin: 2px 0 0 0; color: #64748b; font-size: 0.85rem;\">Official " . ($isMomPdf ? "Minutes of Meeting & Stage Notes" : "Quotation Proposal & Estimate") . "</p>
                            </td>
                        </tr>
                    </table>
                </div>
                
                <div style=\"font-size: 0.95rem; line-height: 1.6; color: #1e293b; margin-bottom: 20px; white-space: pre-wrap;\">" . htmlspecialchars($body) . "</div>" . $ackBlockHtml . "

                <div style=\"background-color: #fff9f0; border: 1.5px solid #fca412; padding: 16px; border-radius: 10px; margin-bottom: 20px;\">
                    <div style=\"font-size: 0.8rem; font-weight: 800; color: #fca412; text-transform: uppercase;\">PDF Attachment Auto-Attached</div>
                    <div style=\"font-size: 1rem; font-weight: 800; color: #0c1527; margin-top: 4px;\">📄 " . (!empty($data['pdf_filename']) ? htmlspecialchars($data['pdf_filename']) : "Quotation_{$cleanQNum}.pdf") . "</div>
                    <div style=\"font-size: 0.85rem; color: #64748b; margin-top: 2px;\">Open the attached file for the official Minutes of Meeting and Project Stage details.</div>
                </div>

                <div style=\"border-top: 1px solid #e2e8f0; padding-top: 14px; font-size: 0.8rem; color: #94a3b8; text-align: center;\">
                    &copy; " . date('Y') . " Livincart Interiors • Professional Interior Design & Modulars
                </div>
            </div>";

            $mail->Body = $formattedEmailBody;
            
            $mail->send();

            $sentMessageId = $mail->getLastMessageID();
            $sentSubject   = $mail->Subject;
            $qidToUpdate   = $actualQid > 0 ? $actualQid : intval($data['quote_id'] ?? $data['id'] ?? 0);

            if ($qidToUpdate > 0) {
                try {
                    $u_stmt = $this->conn->prepare("UPDATE quotes SET status = 'proposal', ack_email_sent_at = NOW() WHERE quote_id = :qid");
                    $u_stmt->execute(['qid' => $qidToUpdate]);

                    $qExStmt = $this->conn->prepare("SELECT extra_data, project_id, lead_id, subtitle, quote_number, total_amount FROM quotes WHERE quote_id = :id");
                    $qExStmt->execute([':id' => $qidToUpdate]);
                    $qRowData = $qExStmt->fetch(\PDO::FETCH_ASSOC);
                    $rawEx = $qRowData['extra_data'] ?? '';
                    $exData = !empty($rawEx) ? json_decode($rawEx, true) : [];
                    if (!is_array($exData)) $exData = [];
                    $exData['last_email_message_id'] = $sentMessageId;
                    $exData['last_email_subject'] = $sentSubject;
                    $exData['last_email_to'] = $to;
                    $exData['last_email_sent_at'] = date('Y-m-d H:i:s');
                    $this->conn->prepare("UPDATE quotes SET extra_data = :ex WHERE quote_id = :id")->execute([
                        ':ex' => json_encode($exData),
                        ':id' => $qidToUpdate
                    ]);

                    // Automatically transition associated lead stage to 'proposal_sent'
                    if (!$isMomPdf) {
                        $leadIdCandidate = $data['lead_id'] ?? ($data['quote_data']['lead_id'] ?? ($qRowData['lead_id'] ?? null));
                        $projIdCandidate = $projectId ?? ($data['quote_data']['project_id'] ?? ($qRowData['project_id'] ?? null));
                        $codeCandidate = $data['manual_client_id'] ?? ($data['quote_data']['project_code'] ?? null);
                        $nameCandidate = $data['client_name'] ?? ($data['quote_data']['client_name'] ?? ($qRowData['subtitle'] ?? null));

                        $matchedLeadId = null;
                        if (!empty($leadIdCandidate) && is_numeric($leadIdCandidate)) {
                            $chkLead = $this->conn->prepare("SELECT lead_id FROM leads WHERE lead_id = :lid LIMIT 1");
                            $chkLead->execute([':lid' => intval($leadIdCandidate)]);
                            $matchedLeadId = $chkLead->fetchColumn() ?: null;
                        }

                        if (!$matchedLeadId && !empty($projIdCandidate) && is_numeric($projIdCandidate)) {
                            $chkLead = $this->conn->prepare("SELECT lead_id FROM leads WHERE lead_id = :lid LIMIT 1");
                            $chkLead->execute([':lid' => intval($projIdCandidate)]);
                            $matchedLeadId = $chkLead->fetchColumn() ?: null;
                        }

                        if (!$matchedLeadId && !empty($codeCandidate)) {
                            $chkLead = $this->conn->prepare("SELECT lead_id FROM leads WHERE manual_client_id = :c OR project_code = :c LIMIT 1");
                            $chkLead->execute([':c' => trim($codeCandidate)]);
                            $matchedLeadId = $chkLead->fetchColumn() ?: null;
                        }

                        if (!$matchedLeadId && !empty($projIdCandidate)) {
                            $chkLead = $this->conn->prepare("SELECT lead_id FROM leads WHERE manual_client_id = :c OR project_code = :c LIMIT 1");
                            $chkLead->execute([':c' => trim($projIdCandidate)]);
                            $matchedLeadId = $chkLead->fetchColumn() ?: null;
                        }

                        if (!$matchedLeadId && !empty($nameCandidate)) {
                            $chkLead = $this->conn->prepare("SELECT lead_id FROM leads WHERE LOWER(client_name) = LOWER(:cn) LIMIT 1");
                            $chkLead->execute([':cn' => trim($nameCandidate)]);
                            $matchedLeadId = $chkLead->fetchColumn() ?: null;
                        }

                        if ($matchedLeadId) {
                            // Link quote to lead_id if empty
                            $this->conn->prepare("UPDATE quotes SET lead_id = :lid WHERE quote_id = :qid AND (lead_id IS NULL OR lead_id = 0)")
                                ->execute([':lid' => $matchedLeadId, ':qid' => $qidToUpdate]);

                            // Transition lead status to proposal_sent (preserving d1_status for meeting)
                            $this->conn->prepare("UPDATE leads SET status = 'proposal_sent' WHERE lead_id = :lid AND status NOT IN ('won', 'converted', 'cancelled', 'lost')")
                                ->execute([':lid' => $matchedLeadId]);

                            // Insert lead note so it shows in sales notes & history
                            try {
                                $quoteNum = $qRowData['quote_number'] ?? ($data['quote_number'] ?? "Quote #$qidToUpdate");
                                $quoteTot = number_format(floatval($qRowData['total_amount'] ?? ($data['total_amount'] ?? 0)), 2);
                                $noteText = "✉️ Official Quotation Proposal ($quoteNum, Total: ₹$quoteTot) sent via email to $to.";
                                $insNote = $this->conn->prepare("INSERT INTO lead_notes (lead_id, note, created_by, created_at) VALUES (:lid, :n, :u, NOW())");
                                $insNote->execute([
                                    ':lid' => $matchedLeadId,
                                    ':n' => $noteText,
                                    ':u' => $data['user_id'] ?? ($data['created_by'] ?? 1)
                                ]);
                            } catch (\Throwable $nte) {}
                        }
                    }
                } catch (\Exception $ex) {
                    error_log("Failed to update extra_data or lead status after sendEmail: " . $ex->getMessage());
                }
            }

            if ($isMomPdf) {
                return ["success" => true, "message" => "MOM PDF sent successfully to " . $to];
            }
            return ["success" => true, "message" => "Quotation email & PDF sent successfully to " . $to];
        } catch (\Exception $e) {
            error_log("Quote sendEmail error: " . $e->getMessage());
            return ["success" => false, "message" => "Email failed to send via SMTP: " . $e->getMessage()];
        }
    }

    // ── Helper to resolve all stakeholders for a quote (Admin, Designer, Sales, Client) ──
    public function resolveTeamEmailsForQuote($quote_id, $project_id = null)
    {
        $conn = $this->conn;
        $result = [
            'client_email'   => '',
            'client_name'    => '',
            'designer_email' => null,
            'designer_name'  => 'Designer',
            'sales_email'    => null,
            'sales_name'     => 'Sales Team',
            'admin_emails'   => []
        ];

        try {
            require_once __DIR__ . '/../helpers/MailHelper.php';
            $result['admin_emails'] = \MailHelper::getAdminAndManagerEmails($conn);

            $quoteRow = null;
            if (!empty($quote_id)) {
                $qStmt = $conn->prepare("SELECT * FROM quotes WHERE quote_id = :id LIMIT 1");
                $qStmt->execute(['id' => intval($quote_id)]);
                $quoteRow = $qStmt->fetch(\PDO::FETCH_ASSOC);
            }

            // 1. Direct extra_data check on quote
            $exData = [];
            if (!empty($quoteRow['extra_data'])) {
                $ex = is_array($quoteRow['extra_data']) ? $quoteRow['extra_data'] : json_decode($quoteRow['extra_data'], true);
                if (is_array($ex)) {
                    $exData = $ex;
                    $candEm = $ex['client_email'] ?? $ex['email'] ?? $ex['last_email_to'] ?? '';
                    if (filter_var($candEm, FILTER_VALIDATE_EMAIL)) {
                        $result['client_email'] = trim($candEm);
                    }
                }
            }

            $rawPid = (string)($quoteRow['project_id'] ?? $project_id ?? '');
            $leadId = !empty($quoteRow['lead_id']) ? intval($quoteRow['lead_id']) : 0;
            if (!$leadId && !empty($exData['lead_id'])) {
                $leadId = intval($exData['lead_id']);
            }

            // Extract numeric sequence (e.g. 1792911730 from DRAFT-1792911730-B)
            $dm = [];
            $numericDigits = '';
            if (preg_match('/(\d{4,})/', (string)($quoteRow['quote_number'] ?? ''), $dm)) {
                $numericDigits = $dm[1];
            } elseif (preg_match('/(\d{4,})/', $rawPid, $dm)) {
                $numericDigits = $dm[1];
            }

            // Subtitle / Client Name Normalization
            $subName = trim((string)($quoteRow['subtitle'] ?? ''));
            $baseName = trim(preg_replace('/(_\d+|\(\d+\)|-\d+|\s+\d+|[_-]v\d+|\b(draft|v\d+)\b)/i', '', $subName));
            $baseClean = preg_replace('/[^a-zA-Z0-9]/', '', strtolower($baseName));

            // Search lead
            $leadRow = null;
            if ($leadId > 0) {
                $lStmt = $conn->prepare("SELECT * FROM leads WHERE lead_id = :lid LIMIT 1");
                $lStmt->execute([':lid' => $leadId]);
                $leadRow = $lStmt->fetch(\PDO::FETCH_ASSOC);
            }
            if (!$leadRow && !empty($rawPid)) {
                $lStmt = $conn->prepare("SELECT * FROM leads WHERE lead_id = :lid OR manual_client_id = :mcid LIMIT 1");
                $lStmt->execute([':lid' => $rawPid, ':mcid' => $rawPid]);
                $leadRow = $lStmt->fetch(\PDO::FETCH_ASSOC);
            }
            if (!$leadRow && !empty($numericDigits)) {
                $lStmt = $conn->prepare("SELECT * FROM leads WHERE (lead_id = :num OR manual_client_id = :num OR manual_client_id LIKE :like_num) AND email IS NOT NULL AND email != '' ORDER BY lead_id DESC LIMIT 1");
                $lStmt->execute([':num' => $numericDigits, ':like_num' => '%' . $numericDigits . '%']);
                $leadRow = $lStmt->fetch(\PDO::FETCH_ASSOC);
            }
            if (!$leadRow && !empty($subName)) {
                $lStmt = $conn->prepare("
                    SELECT * FROM leads 
                    WHERE (
                        client_name = :sub 
                        OR LOWER(client_name) = LOWER(:sub) 
                        OR LOWER(client_name) = LOWER(:base)
                        OR LOWER(client_name) LIKE :like_base
                        OR LOWER(:sub) LIKE CONCAT('%', LOWER(client_name), '%')
                        OR REPLACE(REPLACE(REPLACE(LOWER(client_name), '_', ''), '-', ''), ' ', '') = :clean_base
                    ) 
                    ORDER BY (CASE WHEN email IS NOT NULL AND email != '' THEN 0 ELSE 1 END), (CASE WHEN client_name = :sub THEN 1 WHEN LOWER(client_name) = LOWER(:base) THEN 2 ELSE 3 END), lead_id DESC 
                    LIMIT 1
                ");
                $lStmt->execute([
                    ':sub' => $subName,
                    ':base' => $baseName,
                    ':like_base' => '%' . $baseName . '%',
                    ':clean_base' => $baseClean
                ]);
                $leadRow = $lStmt->fetch(\PDO::FETCH_ASSOC);
            }

            if ($leadRow) {
                if (empty($result['client_name'])) $result['client_name'] = $leadRow['client_name'] ?? '';
                if (empty($result['client_email']) && !empty($leadRow['email']) && filter_var($leadRow['email'], FILTER_VALIDATE_EMAIL)) {
                    $result['client_email'] = trim($leadRow['email']);
                }

                // Designer from lead
                if (!empty($leadRow['d1_assigned_to'])) {
                    $d_ids = explode(',', $leadRow['d1_assigned_to']);
                    $first_d_id = trim($d_ids[0]);
                    $d_stmt = $conn->prepare("SELECT name, username FROM users WHERE user_id = :uid LIMIT 1");
                    $d_stmt->execute(['uid' => $first_d_id]);
                    $dRow = $d_stmt->fetch(\PDO::FETCH_ASSOC);
                    if ($dRow) {
                        $result['designer_name'] = $dRow['name'] ?: 'Designer';
                        if (filter_var($dRow['username'], FILTER_VALIDATE_EMAIL)) {
                            $result['designer_email'] = trim($dRow['username']);
                        }
                    }
                }

                // Sales from lead (assigned_to or created_by)
                $sales_uid = !empty($leadRow['assigned_to']) ? $leadRow['assigned_to'] : (!empty($leadRow['created_by']) ? $leadRow['created_by'] : null);
                if ($sales_uid) {
                    $s_stmt = $conn->prepare("SELECT name, username FROM users WHERE user_id = :uid LIMIT 1");
                    $s_stmt->execute(['uid' => $sales_uid]);
                    $sRow = $s_stmt->fetch(\PDO::FETCH_ASSOC);
                    if ($sRow) {
                        $result['sales_name'] = $sRow['name'] ?: 'Sales Team';
                        if (filter_var($sRow['username'], FILTER_VALIDATE_EMAIL)) {
                            $result['sales_email'] = trim($sRow['username']);
                        }
                    }
                }
            }

            // Also check project & client if applicable
            if (!empty($rawPid)) {
                $pStmt = $conn->prepare("SELECT p.*, c.name as client_name, c.email as client_email FROM projects p JOIN clients c ON p.client_id = c.client_id WHERE p.project_id = :pid OR p.project_code = :pcode LIMIT 1");
                $pStmt->execute([':pid' => $rawPid, ':pcode' => $rawPid]);
                $pRow = $pStmt->fetch(\PDO::FETCH_ASSOC);
                if ($pRow) {
                    if (empty($result['client_name'])) $result['client_name'] = $pRow['client_name'] ?? '';
                    if (empty($result['client_email']) && filter_var($pRow['client_email'] ?? '', FILTER_VALIDATE_EMAIL)) {
                        $result['client_email'] = trim($pRow['client_email']);
                    }
                    if (empty($result['designer_email']) && !empty($pRow['designer_id'])) {
                        $d_stmt = $conn->prepare("SELECT name, username FROM users WHERE user_id = :uid LIMIT 1");
                        $d_stmt->execute(['uid' => $pRow['designer_id']]);
                        $dRow = $d_stmt->fetch(\PDO::FETCH_ASSOC);
                        if ($dRow && filter_var($dRow['username'], FILTER_VALIDATE_EMAIL)) {
                            $result['designer_name'] = $dRow['name'] ?: 'Designer';
                            $result['designer_email'] = trim($dRow['username']);
                        }
                    }
                    if (empty($result['sales_email']) && !empty($pRow['created_by'])) {
                        $s_stmt = $conn->prepare("SELECT name, username FROM users WHERE user_id = :uid LIMIT 1");
                        $s_stmt->execute(['uid' => $pRow['created_by']]);
                        $sRow = $s_stmt->fetch(\PDO::FETCH_ASSOC);
                        if ($sRow && filter_var($sRow['username'], FILTER_VALIDATE_EMAIL)) {
                            $result['sales_name'] = $sRow['name'] ?: 'Sales Team';
                            $result['sales_email'] = trim($sRow['username']);
                        }
                    }
                }
            }

            // Also search clients table by name/code
            if (empty($result['client_email']) && (!empty($subName) || !empty($rawPid))) {
                $cStmt = $conn->prepare("
                    SELECT * FROM clients 
                    WHERE (
                        client_id = :rawpid 
                        OR client_code = :rawpid 
                        OR name = :sub 
                        OR LOWER(name) = LOWER(:sub) 
                        OR LOWER(name) = LOWER(:base)
                        OR LOWER(name) LIKE :like_base
                        OR LOWER(:sub) LIKE CONCAT('%', LOWER(name), '%')
                        OR REPLACE(REPLACE(REPLACE(LOWER(name), '_', ''), '-', ''), ' ', '') = :clean_base
                    ) 
                    AND email IS NOT NULL AND email != '' 
                    ORDER BY client_id DESC LIMIT 1
                ");
                $cStmt->execute([
                    ':rawpid' => $rawPid,
                    ':sub' => $subName,
                    ':base' => $baseName,
                    ':like_base' => '%' . $baseName . '%',
                    ':clean_base' => $baseClean
                ]);
                $cRow = $cStmt->fetch(\PDO::FETCH_ASSOC);
                if ($cRow && filter_var($cRow['email'], FILTER_VALIDATE_EMAIL)) {
                    $result['client_email'] = trim($cRow['email']);
                    if (empty($result['client_name'])) $result['client_name'] = $cRow['name'] ?? '';
                }
            }

            // Cache resolved client_email back into the quote row extra_data
            if (!empty($result['client_email']) && !empty($quote_id)) {
                try {
                    $exData['client_email'] = $result['client_email'];
                    if (!empty($leadRow['lead_id'])) $exData['lead_id'] = $leadRow['lead_id'];
                    $conn->prepare("UPDATE quotes SET extra_data = :ex WHERE quote_id = :qid AND (extra_data NOT LIKE '%client_email%' OR extra_data IS NULL)")
                         ->execute([':ex' => json_encode($exData), ':qid' => intval($quote_id)]);
                } catch (\Throwable $e) {}
            }
        } catch (\Exception $e) {
            error_log("resolveTeamEmailsForQuote error: " . $e->getMessage());
        }

        return $result;
    }

    // ── Generate & store a unique acknowledgement token for a quote ──
    public function generateAckToken($quote_id)
    {
        try {
            $id = intval($quote_id);
            if ($id <= 0) return ['success' => false, 'message' => 'Invalid quote ID'];

            $token = bin2hex(random_bytes(32)); // 64-char hex string

            $stmt = $this->conn->prepare(
                "UPDATE quotes SET ack_token = :token WHERE quote_id = :id"
            );
            $stmt->execute([':token' => $token, ':id' => $id]);

            return ['success' => true, 'token' => $token];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // ── Send official quotation acknowledgement email with Accept/Reject buttons ──
    public function sendAckEmail($data)
    {
        try {
            $quote_id = intval($data['quote_id'] ?? $data['id'] ?? 0);
            $client_email = trim($data['client_email'] ?? $data['to'] ?? '');
            $client_name  = trim($data['client_name']  ?? 'Valued Client');
            $quote_number = trim($data['quote_number'] ?? '');

            if ($quote_id <= 0 && !empty($quote_number)) {
                $chk = $this->conn->prepare("SELECT quote_id FROM quotes WHERE quote_number = :qnum");
                $chk->execute(['qnum' => $quote_number]);
                $quote_id = intval($chk->fetchColumn() ?: 0);
            }

            if ($quote_id <= 0) {
                return ['success' => false, 'message' => 'Quote ID is required'];
            }

            // Fetch quote details from DB
            $qStmt = $this->conn->prepare("SELECT * FROM quotes WHERE quote_id = :id");
            $qStmt->execute(['id' => $quote_id]);
            $qRow = $qStmt->fetch(PDO::FETCH_ASSOC);
            if (!$qRow) {
                return ['success' => false, 'message' => 'Quote not found'];
            }

            if (empty($quote_number)) {
                $quote_number = $qRow['quote_number'] ?: ('QT-' . $quote_id);
            }

            // Resolve all stakeholders (Admin, Designer, Sales, Client)
            $team = $this->resolveTeamEmailsForQuote($quote_id, $qRow['project_id'] ?? null);

            // Find client email if not supplied
            if (empty($client_email)) {
                $client_email = $team['client_email'];
                if (empty($client_name) || $client_name === 'Valued Client') {
                    $client_name = $team['client_name'] ?: $client_name;
                }
            }
            if (empty($client_name) || $client_name === 'Valued Client') {
                if (!empty($team['client_name'])) {
                    $client_name = $team['client_name'];
                }
            }

            if (!filter_var($client_email, FILTER_VALIDATE_EMAIL)) {
                return ['success' => false, 'message' => 'A valid client email address is required'];
            }

            $isAlreadyAccepted = (!empty($qRow['ack_status']) && $qRow['ack_status'] === 'accepted') || in_array(strtolower($qRow['status'] ?? ''), ['approved', 'accepted', 'order_converted', 'won']);
            $isAlreadyRejected = (!empty($qRow['ack_status']) && $qRow['ack_status'] === 'rejected') || in_array(strtolower($qRow['status'] ?? ''), ['order_lost', 'rejected', 'declined']);

            // If quote was previously rejected, re-sending proposal resets the rejection state so client can review & accept/reject
            if ($isAlreadyRejected && $quote_id > 0) {
                try {
                    $this->conn->prepare("UPDATE quotes SET ack_status = 'pending', status = 'proposal', acknowledged_at = NULL, acknowledged_ip = NULL WHERE quote_id = :id")->execute([':id' => $quote_id]);
                } catch (Exception $ex) {}
                $isAlreadyRejected = false;
                $qRow['ack_status'] = 'pending';
                $qRow['status'] = 'proposal';
            }

            $decisionBlock = '';
            $directLinksHtml = '';

            if ($isAlreadyAccepted) {
                $decisionBlock = '
                <div style="background: linear-gradient(180deg, #f0fdf4 0%, #dcfce7 100%); border: 2px solid #16a34a; border-radius: 16px; padding: 26px 20px; margin: 26px 0; text-align: center; box-shadow: 0 4px 18px rgba(22, 163, 74, 0.12);">
                    <div style="margin-bottom: 16px;">
                        <div style="display: inline-block; background: #16a34a; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; font-weight: 800; padding: 13px 36px; border-radius: 10px; box-shadow: 0 4px 14px rgba(22, 163, 74, 0.35); text-transform: uppercase; letter-spacing: 0.5px;">
                            &#10003;&nbsp; ACCEPTED
                        </div>
                    </div>
                    <div style="background: #ffffff; border: 1.5px solid #86efac; border-radius: 12px; padding: 10px 16px; margin: 0 auto 16px auto; max-width: 460px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                            <tr>
                                <td style="text-align: left; vertical-align: middle; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif; font-size: 13.5px; font-weight: 800; color: #16a34a;">
                                    &#10004;&nbsp; Quotation Accepted Successfully &#10003;
                                </td>
                                <td style="text-align: right; vertical-align: middle;">
                                    <span style="background: #16a34a; color: #ffffff; padding: 4px 10px; border-radius: 8px; font-size: 11px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">
                                        CONFIRMED
                                    </span>
                                </td>
                            </tr>
                        </table>
                    </div>
                    <div style="font-size: 1.22rem; font-weight: 900; color: #14532d; margin-bottom: 6px;">
                        Quotation Proposal Officially Confirmed
                    </div>
                    <p style="font-size: 0.92rem; color: #166534; margin: 0 auto 16px auto; max-width: 480px; line-height: 1.55;">
                        Thank you! You have accepted the quotation proposal. Your project has been officially confirmed and our Admin, Design, and Sales teams have been notified!
                    </p>
                    <div style="font-size: 0.82rem; color: #15803d; font-weight: 700;">
                        🔒 Locked as Initial Quotation &bull; Project Onboarding in Progress
                    </div>
                </div>';
            } elseif ($isAlreadyRejected) {
                $decisionBlock = '
                <div style="background: #fef2f2; border: 2px solid #ef4444; border-radius: 16px; padding: 26px 20px; margin: 26px 0; text-align: center;">
                    <div style="margin-bottom: 16px;">
                        <div style="display: inline-block; background: #dc2626; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; font-weight: 800; padding: 13px 36px; border-radius: 10px; box-shadow: 0 4px 14px rgba(220, 38, 38, 0.3); text-transform: uppercase; letter-spacing: 0.5px;">
                            &#10005;&nbsp; REJECTED
                        </div>
                    </div>
                    <div style="display: inline-block; background: #dc2626; color: #ffffff; border-radius: 20px; padding: 5px 18px; font-size: 0.8rem; font-weight: 800; text-transform: uppercase; margin-bottom: 10px;">
                        &#10005;&nbsp; Quotation Declined
                    </div>
                    <p style="font-size: 0.92rem; color: #991b1b; margin: 0 auto; max-width: 480px; line-height: 1.55;">
                        Your response has been recorded. We appreciate your consideration and hope to assist you in the future.
                    </p>
                </div>';
            } else {
                // Generate fresh unique acknowledgement token for proposal
                $tokenRes = $this->generateAckToken($quote_id);
                if (!$tokenRes['success']) return $tokenRes;
                $token = $tokenRes['token'];

                $httpScheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
                $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
                if (defined('PUBLIC_ACK_URL') && !empty(PUBLIC_ACK_URL)) {
                    $baseUrl  = PUBLIC_ACK_URL . '?token=' . $token;
                } elseif (strpos($host, 'bizools.in') !== false || (defined('IS_PRODUCTION') && IS_PRODUCTION && strpos($host, 'localhost') === false)) {
                    $baseUrl  = 'https://livincart.bizools.in/api/acknowledge.php?token=' . $token;
                } elseif (strpos($host, 'localhost') !== false || strpos($host, '127.0.0.1') !== false) {
                    $lanIp = gethostbyname(gethostname());
                    if (!empty($lanIp) && $lanIp !== '127.0.0.1' && filter_var($lanIp, FILTER_VALIDATE_IP)) {
                        $host = $lanIp;
                    }
                    $baseUrl  = $httpScheme . '://' . $host . '/livrcart/demoark/api/acknowledge.php?token=' . $token;
                } else {
                    $baseUrl  = $httpScheme . '://' . $host . '/api/acknowledge.php?token=' . $token;
                }
                $acceptUrl = $baseUrl . '&action=accept';
                $rejectUrl = $baseUrl . '&action=reject';

                $decisionBlock = '
                <div style="background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%); border: 1.5px solid #cbd5e1; border-radius: 16px; padding: 26px 20px; margin: 26px 0; text-align: center; box-shadow: 0 4px 18px rgba(15,23,42,0.05);">
                    <div style="background: #fff7ed; border: 1.5px solid #fed7aa; border-radius: 12px; padding: 12px 18px; margin: 0 auto 18px auto; max-width: 460px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                            <tr>
                                <td style="text-align: left; vertical-align: middle; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif; font-size: 13.5px; font-weight: 800; color: #c2410c;">
                                    &#9203;&nbsp; Decision Pending: Review &amp; Authorize
                                </td>
                                <td style="text-align: right; vertical-align: middle;">
                                    <span style="background: #ea580c; color: #ffffff; padding: 4px 10px; border-radius: 8px; font-size: 11px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">
                                        ACTION REQ.
                                    </span>
                                </td>
                            </tr>
                        </table>
                    </div>
                    <div style="font-size: 1.15rem; font-weight: 900; color: #0f172a; margin-bottom: 6px;">
                        Review &amp; Authorize Quotation
                    </div>
                    <p style="font-size: 0.88rem; color: #475569; margin: 0 auto 20px auto; max-width: 480px; line-height: 1.55;">
                        Please review the quotation proposal and submit your official response:
                    </p>
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto; width: 100%; max-width: 440px;">
                        <tr>
                            <td align="center" style="padding: 6px 6px; width: 50%;">
                                <a href="' . $acceptUrl . '" target="_blank" style="display: block; background: #16a34a; background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 800; line-height: 1.25; text-align: center; text-decoration: none; padding: 13px 12px; border-radius: 10px; box-shadow: 0 4px 12px rgba(22, 163, 74, 0.3); text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #14532d; white-space: nowrap; box-sizing: border-box;">
                                    &#10003;&nbsp; ACCEPT QUOTATION
                                </a>
                            </td>
                            <td align="center" style="padding: 6px 6px; width: 50%;">
                                <a href="' . $rejectUrl . '" target="_blank" style="display: block; background: #fff5f5; color: #dc2626; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 800; line-height: 1.25; text-align: center; text-decoration: none; padding: 13px 12px; border-radius: 10px; box-shadow: 0 2px 8px rgba(220, 38, 38, 0.12); border: 1.5px solid #ef4444; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; box-sizing: border-box;">
                                    &#10005;&nbsp; REJECT QUOTATION
                                </a>
                            </td>
                        </tr>
                    </table>
                    <div style="font-size: 0.78rem; color: #64748b; margin-top: 16px; line-height: 1.4;">
                        🔒 Secure digital decision &bull; Once accepted, your project is officially booked and design onboarding commences automatically.
                    </div>
                </div>';

                $directLinksHtml = '
                <p style="font-size:0.80rem;color:#94a3b8;line-height:1.6;margin-top:20px;">
                    Direct response links:<br>
                    Accept: <a href="' . $acceptUrl . '" style="color:#16a34a;word-break:break-all;">' . $acceptUrl . '</a><br>
                    Reject: <a href="' . $rejectUrl . '" style="color:#dc2626;word-break:break-all;">' . $rejectUrl . '</a>
                </p>';
            }

            $clientFirst = htmlspecialchars(explode(' ', $client_name)[0]);
            $formattedTotal = '₹' . number_format(floatval($qRow['total_amount'] ?? 0), 2);

            $body = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#f8fafc;">
<div style="font-family:Arial,sans-serif;max-width:620px;margin:20px auto;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);border:1px solid #e2e8f0;">
  <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);padding:26px 32px;display:flex;align-items:center;">
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td style="width:48px;vertical-align:middle;">
          <img src="https://livincart.bizools.in/api/assets/logo.png" alt="LivinCart" style="height:44px;width:44px;object-fit:contain;border-radius:10px;display:block;" />
        </td>
        <td style="padding-left:14px;vertical-align:middle;">
          <div style="font-size:1.1rem;font-weight:800;color:#ffffff;">LivinCart Private Limited</div>
          <div style="font-size:0.78rem;color:#94a3b8;margin-top:2px;">Interior Design &amp; Architecture &bull; Official Quotation</div>
        </td>
      </tr>
    </table>
  </div>
  <div style="padding:32px;">
    <p style="font-size:1.02rem;color:#0f172a;font-weight:700;margin:0 0 12px 0;">Dear ' . $clientFirst . ',</p>
    <p style="font-size:0.92rem;color:#334155;line-height:1.7;margin:0 0 20px 0;">
      Thank you for considering LivinCart. We have prepared and shared your official Quotation Proposal.
    </p>
    <div style="background:#fff7ed;border:1.5px solid #fed7aa;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="font-size:0.85rem;color:#7c2d12;font-weight:600;">Total Estimated Value:</td>
          <td style="font-size:1.15rem;color:#16a34a;font-weight:900;text-align:right;">' . $formattedTotal . '</td>
        </tr>
      </table>
    </div>

    ' . $decisionBlock . '
    ' . $directLinksHtml . '
  </div>
  <div style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;text-align:center;font-size:0.76rem;color:#94a3b8;">
    &copy; ' . date('Y') . ' LivinCart Private Limited &mdash;
    <a href="https://livincart.com" style="color:#fca412;text-decoration:none;">livincart.com</a>
  </div>
</div>
</body></html>';

            // Send via AmpPHPMailer (supports multipart/alternative with text/x-amp-html)
            require_once __DIR__ . '/../libs/AmpPHPMailer.php';
            require_once __DIR__ . '/../helpers/AmpQuoteEmailBuilder.php';

            $mail = new \AmpPHPMailer(true);
            $mail->Timeout   = 5;
            $mail->isSMTP();
            $mail->Host       = 'smtp.gmail.com';
            $mail->SMTPAuth   = true;
            $mail->Username   = 'updates@livincart.com';
            $mail->Password   = 'kkzz omvh dzjs xqfu';
            $mail->SMTPSecure = \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
            $mail->Port       = 587;
            $mail->CharSet    = 'UTF-8';

            $mail->setFrom('updates@livincart.com', 'LivinCart Quotations');
            
            // Client as strictly primary and sole recipient (no CC to internal teams initially)
            $mail->addAddress($client_email, $client_name);

            // Also attach PDF if snapshot exists
            if (!empty($qRow['pdf_snapshot']) && strlen($qRow['pdf_snapshot']) > 1000) {
                $cleanQNum = preg_replace('/[^a-zA-Z0-9_-]/', '', $quote_number);
                $mail->addStringAttachment($qRow['pdf_snapshot'], "Quotation_{$cleanQNum}.pdf", 'base64', 'application/pdf');
            } else {
                try {
                    require_once __DIR__ . '/../helpers/SimplePdfBuilder.php';
                    $pdfBinary = \SimplePdfBuilder::generateQuotePdfBinary($qRow);
                    if (!empty($pdfBinary) && strlen($pdfBinary) > 1000) {
                        $cleanQNum = preg_replace('/[^a-zA-Z0-9_-]/', '', $quote_number);
                        $mail->addStringAttachment($pdfBinary, "Quotation_{$cleanQNum}.pdf", 'base64', 'application/pdf');
                    }
                } catch (Exception $ePdf) {}
            }

            // Google AMP for Email Document (text/x-amp-html)
            // Strictly only attach AMP if in production environment with public HTTPS endpoint
            if (!empty($token) && defined('IS_PRODUCTION') && IS_PRODUCTION && defined('AMP_ENDPOINT_URL') && !empty(AMP_ENDPOINT_URL)) {
                $ampEndpoint = AMP_ENDPOINT_URL;
                $mail->AmpBody = \AmpQuoteEmailBuilder::buildAmpEmail(
                    array_merge($qRow ?: [], [
                        'quote_number' => $quote_number,
                        'quote_id'     => $quote_id,
                        'client_name'  => $client_name,
                        'total_amount' => $qRow['total_amount'] ?? 0
                    ]),
                    $token,
                    $ampEndpoint
                );
            }

            $mail->isHTML(true);
            $mail->Subject = 'Quotation Acknowledgement Request — ' . $quote_number . ' | LivinCart';
            $mail->Body    = $body;
            $mail->AltBody = 'Dear ' . strip_tags($clientFirst) . ', please review and respond to your LivinCart quotation proposal by visiting: ' . $acceptUrl;

            $mail->send();

            $sentMessageId = $mail->getLastMessageID();
            $sentSubject   = $mail->Subject;
            try {
                $qExStmt = $this->conn->prepare("SELECT extra_data, lead_id, project_id, subtitle FROM quotes WHERE quote_id = :id");
                $qExStmt->execute([':id' => $quote_id]);
                $qRowAck = $qExStmt->fetch(\PDO::FETCH_ASSOC);
                $rawEx = $qRowAck['extra_data'] ?? '';
                $exData = !empty($rawEx) ? json_decode($rawEx, true) : [];
                if (!is_array($exData)) $exData = [];
                $exData['last_email_message_id'] = $sentMessageId;
                $exData['last_email_subject'] = $sentSubject;
                $exData['last_email_to'] = $client_email;
                $exData['last_email_sent_at'] = date('Y-m-d H:i:s');
                $this->conn->prepare("UPDATE quotes SET status = 'proposal', extra_data = :ex, ack_email_sent_at = NOW() WHERE quote_id = :id")->execute([
                    ':ex' => json_encode($exData),
                    ':id' => $quote_id
                ]);

                // Also update associated lead status to proposal_sent
                $ackLeadId = $qRowAck['lead_id'] ?? null;
                if (empty($ackLeadId) && !empty($qRowAck['project_id']) && is_numeric($qRowAck['project_id'])) {
                    $chkLead = $this->conn->prepare("SELECT lead_id FROM leads WHERE lead_id = :lid LIMIT 1");
                    $chkLead->execute([':lid' => intval($qRowAck['project_id'])]);
                    $ackLeadId = $chkLead->fetchColumn() ?: null;
                }
                if ($ackLeadId) {
                    $this->conn->prepare("UPDATE leads SET status = 'proposal_sent' WHERE lead_id = :lid AND status NOT IN ('won', 'converted', 'cancelled', 'lost')")
                        ->execute([':lid' => $ackLeadId]);
                }
            } catch (\Exception $e) {}

            return ['success' => true, 'message' => 'Quotation acknowledgement email sent to ' . $client_email];
        } catch (Exception $e) {
            return ['success' => false, 'message' => 'Failed to send quotation acknowledgement email: ' . $e->getMessage()];
        }
    }

    public function updateStatus($quote_id, $status, $user_id = null)
    {
        try {
            $raw_id = (string)$quote_id;

            // 1. If quote_id starts with 'p-' (e.g. 'p-67'), it's an unquoted project placeholder
            if (strpos($raw_id, 'p-') === 0) {
                $pid = intval(substr($raw_id, 2));
                if ($pid > 0) {
                    $stmt = $this->conn->prepare("UPDATE quotes SET status = :st WHERE project_id = :pid");
                    $stmt->execute(['st' => $status, 'pid' => $pid]);

                    if ($stmt->rowCount() === 0) {
                        $ins = $this->conn->prepare("INSERT INTO quotes (project_id, quote_number, total_amount, status, save_type) VALUES (:pid, :qnum, 0, :st, 'draft')");
                        $ins->execute(['pid' => $pid, 'qnum' => 'QTN-P' . $pid, 'st' => $status]);
                    }
                }
                return ["success" => true, "message" => "Quote status updated to " . $status];
            }

            // 2. Otherwise it's a specific quotation row (quote_id) — update ONLY that exact quote_id
            $numeric_quote_id = intval(preg_replace('/[^0-9]/', '', $raw_id));
            if ($numeric_quote_id > 0) {
                $isResettingLost = ($status !== 'order_lost' && $status !== 'rejected' && $status !== 'cancelled' && $status !== 'declined');
                if ($isResettingLost) {
                    if (!empty($user_id)) {
                        $stmt = $this->conn->prepare("UPDATE quotes SET status = :st, ack_status = 'pending', acknowledged_at = NULL, acknowledged_ip = NULL, updated_by = :uid, updated_at = NOW() WHERE quote_id = :qid");
                        $stmt->execute(['st' => $status, 'uid' => $user_id, 'qid' => $numeric_quote_id]);
                    } else {
                        $stmt = $this->conn->prepare("UPDATE quotes SET status = :st, ack_status = 'pending', acknowledged_at = NULL, acknowledged_ip = NULL, updated_at = NOW() WHERE quote_id = :qid");
                        $stmt->execute(['st' => $status, 'qid' => $numeric_quote_id]);
                    }
                } else {
                    if (!empty($user_id)) {
                        $stmt = $this->conn->prepare("UPDATE quotes SET status = :st, updated_by = :uid, updated_at = NOW() WHERE quote_id = :qid");
                        $stmt->execute(['st' => $status, 'uid' => $user_id, 'qid' => $numeric_quote_id]);
                    } else {
                        $stmt = $this->conn->prepare("UPDATE quotes SET status = :st, updated_at = NOW() WHERE quote_id = :qid");
                        $stmt->execute(['st' => $status, 'qid' => $numeric_quote_id]);
                    }
                }
            }

            return ["success" => true, "message" => "Quote status updated to " . $status];
        } catch (Exception $e) {
            return ["success" => false, "message" => "Error updating quote status: " . $e->getMessage()];
        }
    }

    private function generateQuoteHtmlDocument($data)
    {
        $quote_id = $data['quote_id'] ?? null;
        $quote_number = $data['quote_number'] ?? 'QTN-101';
        
        $details = null;
        if ($quote_id && is_numeric($quote_id)) {
            $details = $this->getQuoteDetails($quote_id);
        }

        $client_name = htmlspecialchars($data['to'] ?? 'Valued Client');
        $total_amount = '0.00';
        $sections_html = '';

        if ($details) {
            $total_amount = number_format(floatval($details['total_amount'] ?? 0), 2);
            if (!empty($details['sections'])) {
                $sr = 1;
                foreach ($details['sections'] as $sec) {
                    $secName = htmlspecialchars($sec['section_name'] ?? 'General Items');
                    $sections_html .= "<tr style='background-color:#fff9f0;'><td colspan='6' style='padding:10px 14px; font-weight:800; color:#0c1527; font-size:0.9rem; text-transform:uppercase;'>{$secName}</td></tr>";
                    if (!empty($sec['items'])) {
                        foreach ($sec['items'] as $item) {
                            $part = htmlspecialchars($item['particulars'] ?? 'Item');
                            $brand = htmlspecialchars($item['brand'] ?? '-');
                            $qty = floatval($item['quantity'] ?? 1);
                            $unit = htmlspecialchars($item['unit'] ?? 'Pcs');
                            $rate = number_format(floatval($item['rate'] ?? 0), 2);
                            $amt = number_format(floatval($item['amount'] ?? 0), 2);
                            
                            $sections_html .= "
                            <tr style='border-bottom:1px solid #ffe8c2;'>
                                <td style='padding:8px 12px; text-align:center; font-weight:700; color:#64748b;'>{$sr}</td>
                                <td style='padding:8px 12px; font-weight:600; color:#0c1527;'>{$part}</td>
                                <td style='padding:8px 12px; color:#475569;'>{$brand}</td>
                                <td style='padding:8px 12px; text-align:center; color:#0c1527; font-weight:700;'>{$qty} {$unit}</td>
                                <td style='padding:8px 12px; text-align:right; color:#475569;'>₹{$rate}</td>
                                <td style='padding:8px 12px; text-align:right; font-weight:800; color:#0c1527;'>₹{$amt}</td>
                            </tr>";
                            $sr++;
                        }
                    }
                }
            }
        }

        $date_str = date('d M Y');

        return "
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset='utf-8'>
            <title>Quotation #{$quote_number}</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #0c1527; margin: 0; padding: 20px; background-color: #ffffff; }
                .container { max-width: 800px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 30px; border: 2px solid #ffe8c2; }
                .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #fca412; padding-bottom: 20px; margin-bottom: 20px; }
                .logo { font-size: 24px; font-weight: 900; color: #0c1527; text-transform: uppercase; letter-spacing: 1px; }
                .logo span { color: #fca412; }
                .q-title { text-align: right; }
                .q-title h2 { margin: 0; color: #fca412; font-size: 20px; font-weight: 800; text-transform: uppercase; }
                .q-title p { margin: 4px 0 0 0; color: #64748b; font-size: 13px; }
                .meta-table { width: 100%; margin-bottom: 24px; border-collapse: collapse; }
                .meta-table td { padding: 8px; vertical-align: top; font-size: 14px; }
                .items-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
                .items-table th { background-color: #0c1527; color: #ffffff; padding: 10px 12px; font-size: 12px; text-transform: uppercase; text-align: left; }
                .total-box { text-align: right; font-size: 18px; font-weight: 900; color: #0c1527; padding: 14px; background: #fff9f0; border: 1.5px solid #fca412; border-radius: 8px; margin-top: 10px; }
                .footer { margin-top: 30px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; }
            </style>
        </head>
        <body>
            <div class='container'>
                <div class='header'>
                    <div class='logo'>Livincart <span>Interiors</span></div>
                    <div class='q-title'>
                        <h2>OFFICIAL QUOTATION</h2>
                        <p>#{$quote_number} • Date: {$date_str}</p>
                    </div>
                </div>

                <table class='meta-table'>
                    <tr>
                        <td><strong>Quoted To:</strong> {$client_name}</td>
                        <td style='text-align:right;'><strong>Issued By:</strong> Livincart Interiors & Modulars</td>
                    </tr>
                </table>

                <table class='items-table'>
                    <thead>
                        <tr>
                            <th style='width:40px; text-align:center;'>#</th>
                            <th>Particulars / Description</th>
                            <th>Brand</th>
                            <th style='text-align:center;'>Qty</th>
                            <th style='text-align:right;'>Rate (₹)</th>
                            <th style='text-align:right;'>Amount (₹)</th>
                        </tr>
                    </thead>
                    <tbody>
                        " . (!empty($sections_html) ? $sections_html : "<tr><td colspan='6' style='padding:20px; text-align:center; color:#64748b;'>Full Quotation Details & Line Items Included</td></tr>") . "
                    </tbody>
                </table>

                <div class='total-box'>
                    Total Estimated Budget: ₹{$total_amount}
                </div>

                <div class='footer'>
                    Thank you for choosing Livincart Interiors. For queries, contact info@livincart.com
                </div>
            </div>
        </body>
        </html>";
    }
}
?>