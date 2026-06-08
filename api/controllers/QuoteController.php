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
            $quote_number = 'ARK-QT-' . time();
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
                                        (section_id, particulars, brand, unit, quantity, rate, amount, display_order) 
                                        VALUES (:s_id, :part, :brand, :unit, :qty, :rate, :amt, :order)";
                            $i_stmt = $this->conn->prepare($i_query);
                            $i_stmt->execute([
                                's_id' => $section_id,
                                'part' => $item['particulars'],
                                'brand' => $item['brand'] ?? '',
                                'unit' => $item['unit'] ?? '',
                                'qty' => $item['quantity'] ?? 0,
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
            $this->conn->beginTransaction();

            $project_id = $data['project_id'];
            $is_used_quote = $data['is_used_quote'] ?? false;
            $status = $is_used_quote ? 'used' : 'budgeted';

            // Check if quote exists for this project and status
            $check_query = "SELECT quote_id FROM quotes WHERE project_id = :p_id AND status = :status LIMIT 1";
            $stmt = $this->conn->prepare($check_query);
            $stmt->execute(['p_id' => $project_id, 'status' => $status]);
            $quote = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($quote) {
                $quote_id = $quote['quote_id'];
                // Delete old sections and items
                $s_ids_query = "SELECT section_id FROM quote_sections WHERE quote_id = :q_id";
                $s_stmt = $this->conn->prepare($s_ids_query);
                $s_stmt->execute(['q_id' => $quote_id]);
                $s_ids = $s_stmt->fetchAll(PDO::FETCH_COLUMN);

                if (!empty($s_ids)) {
                    $placeholders = implode(',', array_fill(0, count($s_ids), '?'));
                    $this->conn->prepare("DELETE FROM quote_items WHERE section_id IN ($placeholders)")->execute($s_ids);
                }
                $this->conn->prepare("DELETE FROM quote_sections WHERE quote_id = ?")->execute([$quote_id]);

                // Update total amount and subtitle
                $update_q = "UPDATE quotes SET total_amount = :total, subtitle = :subtitle, updated_at = CURRENT_TIMESTAMP WHERE quote_id = :q_id";
                $this->conn->prepare($update_q)->execute(['total' => $data['total_amount'], 'subtitle' => $data['subtitle'] ?? '', 'q_id' => $quote_id]);
            } else {
                // Create new quote
                $quote_number = 'ARK-QT-' . ($is_used_quote ? 'U-' : 'B-') . time();
                $query = "INSERT INTO quotes (project_id, subtitle, quote_number, total_amount, created_by, status) 
                          VALUES (:p_id, :subtitle, :q_num, :total, :u_id, :status)";
                $stmt = $this->conn->prepare($query);
                $stmt->execute([
                    'p_id' => $project_id,
                    'subtitle' => $data['subtitle'] ?? '',
                    'q_num' => $quote_number,
                    'total' => $data['total_amount'] ?? 0,
                    'u_id' => $data['created_by'] ?? 1, // Fallback to 1 if user_id is missing
                    'status' => $status
                ]);
                $quote_id = $this->conn->lastInsertId();
            }

            // Insert Sections and Items
            if (isset($data['sections']) && is_array($data['sections']) && !empty($data['sections'])) {
                foreach ($data['sections'] as $s_idx => $section) {
                    if (!isset($section['name']) || empty($section['name'])) continue;
                    
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
                            if (!is_array($item)) continue;
                            $i_query = "INSERT INTO quote_items 
                                        (section_id, particulars, brand, unit, quantity, used_quantity, rate, amount, display_order) 
                                        VALUES (:s_id, :part, :brand, :unit, :qty, :u_qty, :rate, :amt, :order)";
                            $i_stmt = $this->conn->prepare($i_query);
                            $i_stmt->execute([
                                's_id' => $section_id,
                                'part' => $item['particulars'] ?? '',
                                'brand' => $item['brand'] ?? '',
                                'unit' => $item['unit'] ?? '',
                                'qty' => $item['quantity'] ?? 0,
                                'u_qty' => $item['used_quantity'] ?? 0,
                                'rate' => $item['rate'] ?? 0,
                                'amt' => $item['amount'] ?? 0,
                                'order' => $i_idx
                            ]);
                        }
                    }
                }
            }

            $this->conn->commit();
            return ["success" => true, "message" => "Quote saved successfully"];
        } catch (Exception $e) {
            file_put_contents('debug_quote.log', "SAVE ERROR: " . $e->getMessage() . "\n", FILE_APPEND);
            if ($this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            return ["success" => false, "message" => "Error saving quote: " . $e->getMessage()];
        }
    }

    public function getLatestQuote($project_id, $is_used_quote = false)
    {
        $status = $is_used_quote ? 'used' : 'budgeted';
        $query = "SELECT quote_id FROM quotes WHERE project_id = :p_id AND status = :status ORDER BY created_at DESC LIMIT 1";
        $stmt = $this->conn->prepare($query);
        $stmt->execute(['p_id' => $project_id, 'status' => $status]);
        $quote = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$quote) return null;

        return $this->getQuoteDetails($quote['quote_id']);
    }
}
?>