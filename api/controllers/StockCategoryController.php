<?php
// api/controllers/StockCategoryController.php

class StockCategoryController
{
    private $conn;

    public function __construct($db)
    {
        $this->conn = $db;
    }

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
        $query = "SELECT * FROM project_stock_categories WHERE project_id = :p_id ORDER BY created_at DESC";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':p_id', $project_id);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    public function deleteCategory($id)
    {
        $query = "DELETE FROM project_stock_categories WHERE id = :id";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':id', $id);
        if ($stmt->execute()) {
            return ["success" => true, "message" => "Stock category deleted."];
        }
        return ["success" => false, "message" => "Failed to delete stock category."];
    }
}
?>
