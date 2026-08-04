<?php
// api/controllers/QuoteController.php

class QuoteController
{
    private $conn;

    public function __construct($db)
    {
        $this->conn = $db;
    }

    public function createQuote($data)
    {
        try {
            $this->conn->beginTransaction();

            // 1. Create Quote Entry
            $quote_number = 'Livincart-QT-' . time();
            $query = "INSERT INTO quotes (project_id, quote_number, total_amount, created_by, status) 
                      VALUES (:p_id, :q_num, :total, :u_id, 'draft')";
            $stmt = $this->conn->prepare($query);
            $stmt->execute([
                'p_id' => $data['project_id'],
                'q_num' => $quote_number,
                'total' => $data['total_amount'] ?? 0,
                'u_id' => $data['created_by']
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
                        'name' => $section['name'],
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

            $this->conn->commit();
            return ["success" => true, "message" => "Quote created successfully", "quote_id" => $quote_id];
        } catch (Exception $e) {
            $this->conn->rollBack();
            return ["success" => false, "message" => "Error creating quote: " . $e->getMessage()];
        }
    }

    public function getQuotesByProject($project_id)
    {
        $query = "SELECT * FROM quotes WHERE project_id = :p_id ORDER BY created_at DESC";
        $stmt = $this->conn->prepare($query);
        $stmt->execute(['p_id' => $project_id]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getQuoteDetails($quote_id)
    {
        // 1. Get Quote
        $q_query = "SELECT * FROM quotes WHERE quote_id = :id";
        $q_stmt = $this->conn->prepare($q_query);
        $q_stmt->execute(['id' => $quote_id]);
        $quote = $q_stmt->fetch(PDO::FETCH_ASSOC);

        if (!$quote)
            return null;

        // 2. Get Sections
        $s_query = "SELECT * FROM quote_sections WHERE quote_id = :id ORDER BY display_order";
        $s_stmt = $this->conn->prepare($s_query);
        $s_stmt->execute(['id' => $quote_id]);
        $sections = $s_stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($sections as &$section) {
            // 3. Get Items for each section
            $i_query = "SELECT * FROM quote_items WHERE section_id = :sid ORDER BY display_order";
            $i_stmt = $this->conn->prepare($i_query);
            $i_stmt->execute(['sid' => $section['section_id']]);
            $section['items'] = $i_stmt->fetchAll(PDO::FETCH_ASSOC);
        }

        $quote['sections'] = $sections;
        return $quote;
    }

    public function saveQuoteState($data)
    {
        file_put_contents('debug_quote.log', "SAVE CALLED: " . date('Y-m-d H:i:s') . "\n" . print_r($data, true), FILE_APPEND);
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
                $this->conn->exec("ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS width VARCHAR(50) DEFAULT ''");
            } catch (Exception $e) {}
            try {
                $this->conn->exec("ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS height VARCHAR(50) DEFAULT ''");
            } catch (Exception $e) {}
            try {
                $this->conn->exec("ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS sft VARCHAR(50) DEFAULT ''");
            } catch (Exception $e) {}
            try {
                $this->conn->exec("ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS hsn_sac VARCHAR(50) DEFAULT ''");
            } catch (Exception $e) {}
            try {
                $this->conn->exec("ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS image_url LONGTEXT DEFAULT NULL");
                $this->conn->exec("ALTER TABLE quote_items MODIFY COLUMN image_url LONGTEXT DEFAULT NULL");
            } catch (Exception $e) {}

            $raw_p_id = $data['project_id'] ?? 0;
            $project_id = intval(preg_replace('/[^0-9]/', '', (string)$raw_p_id));
            if ($project_id === 0) $project_id = 1;

            $this->ensureProjectExists($project_id, $data['subtitle'] ?? '', $data['total_amount'] ?? 0);

            $is_used_quote = $data['is_used_quote'] ?? false;
            $status = $is_used_quote ? 'used' : 'budgeted';

            $this->conn->beginTransaction();

            // Get max version for this project and status
            $v_query = "SELECT MAX(version) as max_v FROM quotes WHERE project_id = :p_id AND status = :status AND (save_type = 'version' OR save_type IS NULL OR save_type = '')";
            $v_stmt = $this->conn->prepare($v_query);
            $v_stmt->execute(['p_id' => $project_id, 'status' => $status]);
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

            // Always create a new quote as the next version
            $quote_number = 'Livincart-QT-' . ($is_used_quote ? 'U-' : 'B-') . time() . '-v' . $new_version;
            $label = 'Version ' . $new_version;
            $query = "INSERT INTO quotes (project_id, subtitle, quote_number, total_amount, discount_percent, created_by, status, version, save_type, label) 
                      VALUES (:p_id, :subtitle, :q_num, :total, :discount, :u_id, :status, :version, 'version', :label)";
            $stmt = $this->conn->prepare($query);
            $stmt->execute([
                'p_id' => $project_id,
                'subtitle' => $subtitle,
                'q_num' => $quote_number,
                'total' => $data['total_amount'] ?? 0,
                'discount' => $data['discount_percent'] ?? 0,
                'u_id' => $data['created_by'] ?? 1,
                'status' => $status,
                'version' => $new_version,
                'label' => $label
            ]);
            $quote_id = $this->conn->lastInsertId();

            // Insert Sections and Items
            if (isset($data['sections']) && is_array($data['sections']) && !empty($data['sections'])) {
                foreach ($data['sections'] as $s_idx => $section) {
                    if (!isset($section['name']) || empty($section['name']))
                        continue;

                    $s_query = "INSERT INTO quote_sections (quote_id, section_name, display_order) 
                                VALUES (:q_id, :name, :order)";
                    $s_stmt = $this->conn->prepare($s_query);
                    $s_stmt->execute([
                        'q_id' => $quote_id,
                        'name' => $section['name'],
                        'order' => $s_idx
                    ]);
                    $section_id = $this->conn->lastInsertId();

                    if (isset($section['items']) && is_array($section['items'])) {
                        foreach ($section['items'] as $i_idx => $item) {
                            if (!is_array($item))
                                continue;
                            $i_query = "INSERT INTO quote_items 
                                        (section_id, particulars, brand, unit, quantity, used_quantity, width, height, sft, hsn_sac, image_url, rate, amount, display_order) 
                                        VALUES (:s_id, :part, :brand, :unit, :qty, :u_qty, :width, :height, :sft, :hsn, :img, :rate, :amt, :order)";
                            $i_stmt = $this->conn->prepare($i_query);
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
                                'amt' => ($item['quantity'] ?? 0) * ($item['rate'] ?? 0),
                                'order' => $i_idx
                            ]);
                        }
                    }
                }
            }

            // Update the total_budget in projects table to match saved quote amount
            try {
                $update_budget = "UPDATE projects SET total_budget = :total WHERE project_id = :p_id";
                $this->conn->prepare($update_budget)->execute([
                    'total' => $data['total_amount'] ?? 0,
                    'p_id' => $project_id
                ]);
            } catch (Exception $e) {}

            if ($this->conn->inTransaction()) {
                $this->conn->commit();
            }
            return ["success" => true, "message" => "Quote saved successfully", "quote_id" => $quote_id];
        } catch (Exception $e) {
            file_put_contents('debug_quote.log', "SAVE ERROR: " . $e->getMessage() . "\n", FILE_APPEND);
            if ($this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            return ["success" => false, "message" => "Error saving quote: " . $e->getMessage()];
        }
    }

    public function getLatestQuote($project_id, $is_used_quote = false, $client_name = null)
    {
        $clean_id = intval(preg_replace('/[^0-9]/', '', (string)$project_id));
        $raw_id = trim((string)$project_id);
        $cname = trim($client_name ?? '');
        $clean_cname = trim(preg_replace('/^(mr\.|mrs\.|ms\.|dr\.|m\/s)\s+/i', '', $cname));

        $quote = null;

        // 1. PRIMARY MATCH BY ID: Match by project_id / lead_id first if project_id is provided
        if (!empty($raw_id) && $raw_id !== 'standalone' && ($clean_id > 0 || strlen($raw_id) > 1)) {
            $query = "SELECT quote_id FROM quotes 
                      WHERE (project_id = :p_id OR project_id = :raw_id) 
                      ORDER BY quote_id DESC LIMIT 1";
            $stmt = $this->conn->prepare($query);
            $stmt->execute(['p_id' => $clean_id, 'raw_id' => $raw_id]);
            $quote = $stmt->fetch(PDO::FETCH_ASSOC);
        }

        // 2. SECONDARY FALLBACK BY NAME: If not found by ID, search by client_name / subtitle
        if (!$quote && (!empty($cname) || !empty($clean_cname))) {
            $search_name = !empty($clean_cname) ? $clean_cname : $cname;
            $q_name = "SELECT quote_id FROM quotes 
                       WHERE (
                           LOWER(subtitle) = :cname 
                           OR LOWER(subtitle) = :clean_cname
                           OR LOWER(subtitle) LIKE :cname_like 
                           OR :cname_lower LIKE CONCAT('%', LOWER(subtitle), '%')
                       ) 
                       ORDER BY quote_id DESC LIMIT 1";
            $s_name = $this->conn->prepare($q_name);
            $s_name->execute([
                'cname' => strtolower($cname),
                'clean_cname' => strtolower($clean_cname),
                'cname_like' => '%' . strtolower($search_name) . '%',
                'cname_lower' => strtolower($cname)
            ]);
            $quote = $s_name->fetch(PDO::FETCH_ASSOC);
        }

        if (!$quote)
            return null;

        return $this->getQuoteDetails($quote['quote_id']);
    }

    public function getQuoteHistory($project_id, $is_used_quote = false)
    {
        $clean_id = intval(preg_replace('/[^0-9]/', '', (string)$project_id));

        $query = "SELECT quote_id, project_id, quote_number, version, total_amount, discount_percent, subtitle, created_at, created_by, status 
                  FROM quotes 
                  WHERE (project_id = :p_id OR project_id = :raw_id) 
                  ORDER BY version DESC, quote_id DESC";
        
        $stmt = $this->conn->prepare($query);
        $stmt->execute(['p_id' => $clean_id, 'raw_id' => $project_id]);
        $quotes = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($quotes as &$quote) {
            $details = $this->getQuoteDetails($quote['quote_id']);
            $quote['sections'] = $details ? $details['sections'] : [];
        }

        return $quotes;
    }

    public function getAllQuotes()
    {
        // 1. Get all quotes ordered by latest quote_id DESC
        $query = "SELECT q.*, 
                         COALESCE(NULLIF(p.project_name, ''), q.subtitle, 'Estimation Project') as project_name, 
                         COALESCE(NULLIF(c.name, ''), q.subtitle, 'Client') as client_name 
                  FROM quotes q
                  LEFT JOIN projects p ON (q.project_id = p.project_id OR q.project_id = CAST(p.project_id AS CHAR))
                  LEFT JOIN clients c ON p.client_id = c.client_id
                  ORDER BY q.quote_id DESC";
        $stmt = $this->conn->prepare($query);
        $stmt->execute();
        $raw_quotes = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Deduplicate quotes by normalized client_name / subtitle / project_id so each lead/client appears ONLY ONCE (latest version)
        $quotes = [];
        $seen_keys = [];
        $existing_p_ids = [];
        $existing_client_names = [];

        foreach ($raw_quotes as $q) {
            $client_key = strtolower(trim($q['client_name'] ?? ''));
            $proj_key = strtolower(trim((string)($q['project_id'] ?? '')));

            // Key to deduplicate: prefer client_name if non-generic, else project_id
            $dedup_key = (!empty($client_key) && $client_key !== 'client' && $client_key !== 'valued client' && $client_key !== 'estimation project') 
                         ? $client_key 
                         : $proj_key;

            if (empty($dedup_key) || !in_array($dedup_key, $seen_keys)) {
                if (!empty($dedup_key)) {
                    $seen_keys[] = $dedup_key;
                }
                $existing_p_ids[] = intval($q['project_id']);
                if (!empty($client_key)) {
                    $existing_client_names[] = $client_key;
                }

                $details = $this->getQuoteDetails($q['quote_id']);
                $q['sections'] = $details ? $details['sections'] : [];
                $quotes[] = $q;
            }
        }

        // 2. Fetch ALL Sales Leads from `leads` table (added by Sales Team)
        try {
            $lead_query = "SELECT lead_id, client_name, manual_client_id, project_type, estimated_budget, created_at
                           FROM leads
                           ORDER BY created_at DESC";
            $lead_stmt = $this->conn->prepare($lead_query);
            $lead_stmt->execute();
            $all_leads = $lead_stmt->fetchAll(PDO::FETCH_ASSOC);

            foreach ($all_leads as $lead) {
                $lid = intval($lead['lead_id']);
                $lead_cname = strtolower(trim($lead['client_name'] ?? ''));

                if ($lid > 0 && !in_array($lid, $existing_p_ids) && (empty($lead_cname) || !in_array($lead_cname, $existing_client_names))) {
                    $seen_keys[] = !empty($lead_cname) ? $lead_cname : 'lead-' . $lid;
                    if (!empty($lead_cname)) $existing_client_names[] = $lead_cname;

                    $quotes[] = [
                        'quote_id' => 'lead-' . $lid,
                        'project_id' => $lid,
                        'version' => 1,
                        'total_amount' => floatval($lead['estimated_budget'] ?? 0),
                        'discount_percent' => 0,
                        'status' => 'draft',
                        'save_type' => 'draft',
                        'created_at' => $lead['created_at'] ?? date('Y-m-d H:i:s'),
                        'project_name' => !empty($lead['project_type']) ? $lead['project_type'] : 'Lead #' . $lid,
                        'client_name' => !empty($lead['client_name']) ? $lead['client_name'] : 'Sales Lead #' . $lid,
                        'subtitle' => !empty($lead['client_name']) ? $lead['client_name'] : 'Sales Lead',
                        'sections' => []
                    ];
                }
            }
        } catch (Exception $e) {
            // Ignore if leads table fails
        }

        // 3. Include any projects from `projects` table not already included
        try {
            $p_query = "SELECT p.project_id, p.project_name, c.name as client_name, p.created_at
                        FROM projects p
                        LEFT JOIN clients c ON p.client_id = c.client_id
                        ORDER BY p.created_at DESC";
            $p_stmt = $this->conn->prepare($p_query);
            $p_stmt->execute();
            $all_projects = $p_stmt->fetchAll(PDO::FETCH_ASSOC);

            foreach ($all_projects as $proj) {
                $pid = intval($proj['project_id']);
                $proj_cname = strtolower(trim($proj['client_name'] ?? ''));

                if ($pid > 0 && !in_array($pid, $existing_p_ids) && (empty($proj_cname) || !in_array($proj_cname, $existing_client_names))) {
                    $quotes[] = [
                        'quote_id' => 'p-' . $pid,
                        'project_id' => $pid,
                        'version' => 1,
                        'total_amount' => 0.00,
                        'discount_percent' => 0,
                        'status' => 'draft',
                        'save_type' => 'draft',
                        'created_at' => $proj['created_at'] ?? date('Y-m-d H:i:s'),
                        'project_name' => !empty($proj['project_name']) ? $proj['project_name'] : 'Project #' . $pid,
                        'client_name' => !empty($proj['client_name']) ? $proj['client_name'] : 'Project Lead',
                        'subtitle' => 'Project Lead',
                        'sections' => []
                    ];
                }
            }
        } catch (Exception $e) {
            // Ignore if projects table lookup fails
        }

        return $quotes;
    }

    /**
     * Save Draft — upserts a single 'draft' row per project+status_type.
     * Always overwrites the same row (only 1 draft allowed at a time).
     */
    public function saveDraft($data)
    {
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
            if ($project_id === 0) $project_id = 1;

            $this->ensureProjectExists($project_id, $data['subtitle'] ?? '', $data['total_amount'] ?? 0);

            $is_used     = $data['is_used_quote'] ?? false;
            $status      = $is_used ? 'used' : 'budgeted';
            $total       = $data['total_amount'] ?? 0;
            $discount    = $data['discount_percent'] ?? 0;
            $created_by  = $data['created_by'] ?? 1;
            $subtitle    = $data['subtitle'] ?? '';
            $sections    = $data['sections'] ?? [];

            // Check if a draft already exists for this project+status
            $check = $this->conn->prepare(
                "SELECT quote_id FROM quotes WHERE project_id = :p_id AND status = :status AND save_type = 'draft' LIMIT 1"
            );
            $check->execute(['p_id' => $project_id, 'status' => $status]);
            $existing = $check->fetch(PDO::FETCH_ASSOC);

            $this->conn->beginTransaction();

            if ($existing) {
                // Update existing draft header
                $quote_id = $existing['quote_id'];
                $this->conn->prepare(
                    "UPDATE quotes SET total_amount=:total, discount_percent=:discount, subtitle=:sub, updated_at=NOW() WHERE quote_id=:qid"
                )->execute(['total' => $total, 'discount' => $discount, 'sub' => $subtitle, 'qid' => $quote_id]);

                // Delete old sections + items
                $old_sections = $this->conn->prepare("SELECT section_id FROM quote_sections WHERE quote_id = :qid");
                $old_sections->execute(['qid' => $quote_id]);
                foreach ($old_sections->fetchAll(PDO::FETCH_ASSOC) as $os) {
                    $this->conn->prepare("DELETE FROM quote_items WHERE section_id = :sid")->execute(['sid' => $os['section_id']]);
                }
                $this->conn->prepare("DELETE FROM quote_sections WHERE quote_id = :qid")->execute(['qid' => $quote_id]);
            } else {
                // Insert new draft row
                $quote_number = 'DRAFT-' . $project_id . '-' . ($is_used ? 'U' : 'B');
                $stmt = $this->conn->prepare(
                    "INSERT INTO quotes (project_id, subtitle, quote_number, total_amount, discount_percent, created_by, status, version, save_type, label)
                     VALUES (:p_id, :sub, :qnum, :total, :discount, :uid, :status, 0, 'draft', 'Draft')"
                );
                $stmt->execute([
                    'p_id' => $project_id, 'sub' => $subtitle, 'qnum' => $quote_number,
                    'total' => $total, 'discount' => $discount, 'uid' => $created_by, 'status' => $status
                ]);
                $quote_id = $this->conn->lastInsertId();
            }

            // Re-insert sections and items
            foreach ($sections as $s_idx => $section) {
                if (empty($section['name'])) continue;
                $s_stmt = $this->conn->prepare(
                    "INSERT INTO quote_sections (quote_id, section_name, display_order) VALUES (:qid, :name, :ord)"
                );
                $s_stmt->execute(['qid' => $quote_id, 'name' => $section['name'], 'ord' => $s_idx]);
                $section_id = $this->conn->lastInsertId();

                foreach (($section['items'] ?? []) as $i_idx => $item) {
                    if (!is_array($item)) continue;
                    $this->conn->prepare(
                        "INSERT INTO quote_items (section_id, particulars, brand, unit, quantity, used_quantity, width, height, sft, hsn_sac, image_url, rate, amount, display_order)
                         VALUES (:sid, :part, :brand, :unit, :qty, :uqty, :width, :height, :sft, :hsn, :img, :rate, :amt, :ord)"
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
                        'amt'   => $item['amount'] ?? 0,
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

    /**
     * Get Draft — loads the saved draft for a project (if any).
     */
    public function getDraft($project_id, $is_used_quote = false)
    {
        $clean_id = intval(preg_replace('/[^0-9]/', '', (string)$project_id));
        $status = $is_used_quote ? 'used' : 'budgeted';
        $stmt = $this->conn->prepare(
            "SELECT quote_id FROM quotes WHERE (project_id = :p_id OR project_id = :raw_id) AND status = :status AND save_type = 'draft' LIMIT 1"
        );
        $stmt->execute(['p_id' => $clean_id, 'raw_id' => $project_id, 'status' => $status]);
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
        $status = $is_used_quote ? 'used' : 'budgeted';

        $query = "SELECT quote_id, version, total_amount, discount_percent, label, created_at, created_by
                  FROM quotes
                  WHERE (project_id = :p_id OR project_id = :raw_id)
                    AND status = :status
                    AND (save_type = 'version' OR save_type IS NULL OR save_type = '')
                  ORDER BY version DESC, quote_id DESC";
        $stmt = $this->conn->prepare($query);
        $stmt->execute(['p_id' => $clean_id, 'raw_id' => $project_id, 'status' => $status]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    private function ensureProjectExists($project_id, $subtitle = '', $total_amount = 0)
    {
        try {
            $chk = $this->conn->prepare("SELECT project_id FROM projects WHERE project_id = :pid");
            $chk->execute(['pid' => $project_id]);
            if (!$chk->fetch()) {
                $ins = $this->conn->prepare(
                    "INSERT INTO projects (project_id, project_code, project_name, client_id, start_date, expected_end_date, total_budget, created_by)
                     VALUES (:pid, :pcode, :pname, 1, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 30 DAY), :budget, 1)"
                );
                $ins->execute([
                    'pid' => $project_id,
                    'pcode' => 'P-' . $project_id,
                    'pname' => !empty($subtitle) ? $subtitle : ('Project #' . $project_id),
                    'budget' => $total_amount
                ]);
            }
        } catch (Exception $e) {
            // Ignore if parent project record already exists
        }
    }
}
?>