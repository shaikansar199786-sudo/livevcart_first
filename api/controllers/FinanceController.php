<?php
// api/controllers/FinanceController.php

class FinanceController
{
    private $conn;

    public function __construct($db)
    {
        $this->conn = $db;
    }

    public function recordTransaction($data)
    {
        // project_id can be null if it's a general transaction
        $project_id = !empty($data['project_id']) ? $data['project_id'] : null;

        $query = "INSERT INTO finance_transactions 
                (project_id, type, amount, payment_mode, category, person_name, description, transaction_date, recorded_by) 
                VALUES (:project_id, :type, :amount, :payment_mode, :category, :person_name, :description, :date, :recorded_by)";

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
        
        $description = $data['description'] ?? null;
        $stmt->bindParam(':description', $description);
        
        $date = $data['date'] ?? date('Y-m-d');
        $stmt->bindParam(':date', $date);
        
        $recorded_by = $data['recorded_by'] ?? 1;
        $stmt->bindParam(':recorded_by', $recorded_by);

        try {
            if ($stmt->execute()) {
                return ["success" => true, "message" => "Transaction recorded."];
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
                    SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END) as total_spent
                  FROM finance_transactions 
                  WHERE project_id = :p_id";

        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':p_id', $project_id);
        $stmt->execute();
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public function getAllTransactions($project_id = null)
    {
        $query = "SELECT ft.*, p.project_name 
                  FROM finance_transactions ft
                  LEFT JOIN projects p ON ft.project_id = p.project_id";

        if ($project_id) {
            $query .= " WHERE ft.project_id = :p_id";
        }
        $query .= " ORDER BY ft.transaction_date DESC, ft.transaction_id DESC";

        $stmt = $this->conn->prepare($query);
        if ($project_id) {
            $stmt->bindParam(':p_id', $project_id);
        }
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function updateTransaction($id, $data)
    {
        $query = "UPDATE finance_transactions 
                  SET amount = :amount, 
                      payment_mode = :payment_mode, 
                      person_name = :person_name, 
                      description = :description, 
                      transaction_date = :date
                  WHERE transaction_id = :id";

        $stmt = $this->conn->prepare($query);

        $stmt->bindParam(':id', $id);
        $stmt->bindParam(':amount', $data['amount']);
        
        $payment_mode = $data['payment_mode'] ?? null;
        $stmt->bindParam(':payment_mode', $payment_mode);
        
        $person_name = $data['person_name'] ?? null;
        $stmt->bindParam(':person_name', $person_name);
        
        $description = $data['description'] ?? null;
        $stmt->bindParam(':description', $description);
        
        $date = $data['date'] ?? date('Y-m-d');
        $stmt->bindParam(':date', $date);

        try {
            if ($stmt->execute()) {
                return ["success" => true, "message" => "Transaction updated."];
            }
        } catch (PDOException $e) {
            return ["success" => false, "message" => "Database error: " . $e->getMessage()];
        }
        
        return ["success" => false, "message" => "Failed to update transaction."];
    }

    public function deleteTransaction($id)
    {
        $query = "DELETE FROM finance_transactions WHERE transaction_id = :id";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':id', $id);

        try {
            if ($stmt->execute()) {
                return ["success" => true, "message" => "Transaction deleted."];
            }
        } catch (PDOException $e) {
            return ["success" => false, "message" => "Database error: " . $e->getMessage()];
        }
        
        return ["success" => false, "message" => "Failed to delete transaction."];
    }
}
?>