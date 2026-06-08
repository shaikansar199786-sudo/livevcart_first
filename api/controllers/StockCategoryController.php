<?php
// api/controllers/StockCategoryController.php

class StockCategoryController
{
    private $conn;

    public function __construct($db)
    {
        $this->conn = $db;
    }

    // ─── CATEGORIES ───────────────────────────────────────────────

    public function addCategory($data)
    {
        $query = "INSERT INTO project_stock_categories (project_id, category_name) VALUES (:project_id, :category_name)";
        $stmt = $this->conn->prepare($query);

        $stmt->bindParam(':project_id', $data['project_id']);
        $stmt->bindParam(':category_name', $data['category_name']);

        if ($stmt->execute()) {
            return ["success" => true, "message" => "Stock category added."];
        }
        return ["success" => false, "message" => "Failed to add stock category."];
    }

    public function getProjectCategories($project_id)
    {
        // Fetch all unique category names globally
        $query = "SELECT MIN(id) as id, category_name, MIN(created_at) as created_at 
                  FROM project_stock_categories 
                  GROUP BY category_name 
                  ORDER BY created_at DESC";
        $stmt = $this->conn->prepare($query);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function deleteCategory($id)
    {
        $query = "SELECT category_name FROM project_stock_categories WHERE id = :id";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':id', $id);
        $stmt->execute();
        $cat = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($cat) {
            $del_query = "DELETE FROM project_stock_categories WHERE category_name = :cat_name";
            $del_stmt = $this->conn->prepare($del_query);
            $del_stmt->bindParam(':cat_name', $cat['category_name']);
            if ($del_stmt->execute()) {
                return ["success" => true, "message" => "Stock category deleted globally."];
            }
        }
        return ["success" => false, "message" => "Failed to delete stock category."];
    }

    // ─── STOCK ITEMS ──────────────────────────────────────────────

    public function addItem($data)
    {
        $query = "INSERT INTO project_stock_items 
                    (project_id, name, category_name, unit, quantity, worth_in_rupees, status) 
                  VALUES 
                    (:project_id, :name, :category_name, :unit, :quantity, :worth_in_rupees, :status)";
        $stmt = $this->conn->prepare($query);

        $stmt->bindParam(':project_id',     $data['project_id']);
        $stmt->bindParam(':name',           $data['name']);
        $stmt->bindParam(':category_name',  $data['category_name']);
        $stmt->bindParam(':unit',           $data['unit']);
        $stmt->bindParam(':quantity',       $data['quantity']);
        $stmt->bindParam(':worth_in_rupees',$data['worth_in_rupees']);
        $status = 'pending'; // Initial status is always pending
        $stmt->bindParam(':status',         $status);

        if ($stmt->execute()) {
            return ["success" => true, "message" => "Stock item added.", "id" => $this->conn->lastInsertId()];
        }
        return ["success" => false, "message" => "Failed to add stock item."];
    }

    public function updateUsage($data)
    {
        // Add quantity_used column if it doesn't exist
        try {
            $this->conn->exec("ALTER TABLE project_stock_items ADD COLUMN quantity_used INT DEFAULT 0 AFTER quantity");
        } catch (Exception $e) {}

        // Add is_checked column if it doesn't exist
        try {
            $this->conn->exec("ALTER TABLE project_stock_items ADD COLUMN is_checked TINYINT DEFAULT 0 AFTER quantity_used");
        } catch (Exception $e) {}

        $is_checked = isset($data['is_checked']) ? ($data['is_checked'] ? 1 : 0) : 0;
        $query = "UPDATE project_stock_items
                  SET quantity_used = :quantity_used, is_checked = :is_checked
                  WHERE id = :id";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':id',            $data['id']);
        $stmt->bindParam(':quantity_used', $data['quantity_used']);
        $stmt->bindParam(':is_checked',    $is_checked);

        if ($stmt->execute()) {
            return ["success" => true, "message" => "Usage updated."];
        }
        return ["success" => false, "message" => "Failed to update usage."];
    }

    public function transferItem($data)
    {
        // $data = [item_id, target_project_id, transfer_qty]
        $this->conn->beginTransaction();
        try {
            // 1. Get original item
            $query = "SELECT * FROM project_stock_items WHERE id = :id";
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':id', $data['item_id']);
            $stmt->execute();
            $item = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$item) throw new Exception("Item not found");
            
            $availableQty = $item['quantity'] - ($item['quantity_used'] ?? 0);
            if ($availableQty < $data['transfer_qty']) throw new Exception("Insufficient quantity available for transfer");

            // 2. Reduce quantity from original item
            $newQty = $item['quantity'] - $data['transfer_qty'];
            $updQuery = "UPDATE project_stock_items SET quantity = :new_qty WHERE id = :id";
            $updStmt = $this->conn->prepare($updQuery);
            $updStmt->bindParam(':new_qty', $newQty);
            $updStmt->bindParam(':id', $data['item_id']);
            $updStmt->execute();

            // 3. Add item to new project (Mark as transferred)
            $insQuery = "INSERT INTO project_stock_items 
                        (project_id, name, category_name, unit, quantity, worth_in_rupees, status, is_transferred, from_project_id) 
                      VALUES 
                        (:project_id, :name, :category_name, :unit, :quantity, :worth_in_rupees, :status, 1, :from_project_id)";
            $insStmt = $this->conn->prepare($insQuery);
            $insStmt->bindParam(':project_id',     $data['target_project_id']);
            $insStmt->bindParam(':name',           $item['name']);
            $insStmt->bindParam(':category_name',  $item['category_name']);
            $insStmt->bindParam(':unit',           $item['unit']);
            $insStmt->bindParam(':quantity',       $data['transfer_qty']);
            $insStmt->bindParam(':worth_in_rupees',$item['worth_in_rupees']);
            $insStmt->bindParam(':status',         $item['status']);
            $insStmt->bindParam(':from_project_id',$item['project_id']);
            $insStmt->execute();

            $this->conn->commit();
            return ["success" => true, "message" => "Transfer successful."];
        } catch (Exception $e) {
            $this->conn->rollBack();
            return ["success" => false, "message" => $e->getMessage()];
        }
    }

    public function getItems($project_id)
    {
        $query = "SELECT * FROM project_stock_items WHERE project_id = :project_id ORDER BY created_at DESC";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':project_id', $project_id);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function deleteItem($id)
    {
        $query = "DELETE FROM project_stock_items WHERE id = :id";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':id', $id);
        if ($stmt->execute()) {
            return ["success" => true, "message" => "Stock item deleted."];
        }
        return ["success" => false, "message" => "Failed to delete stock item."];
    }

    public function updateItem($data)
    {
        $query = "UPDATE project_stock_items 
                  SET name = :name, category_name = :category_name, unit = :unit,
                      quantity = :quantity, worth_in_rupees = :worth_in_rupees, status = :status
                  WHERE id = :id";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':id',             $data['id']);
        $stmt->bindParam(':name',           $data['name']);
        $stmt->bindParam(':category_name',  $data['category_name']);
        $stmt->bindParam(':unit',           $data['unit']);
        $stmt->bindParam(':quantity',       $data['quantity']);
        $stmt->bindParam(':worth_in_rupees',$data['worth_in_rupees']);
        $stmt->bindParam(':status',         $data['status']);

        if ($stmt->execute()) {
            return ["success" => true, "message" => "Stock item updated."];
        }
        return ["success" => false, "message" => "Failed to update stock item."];
    }
}
?>
