<?php
// api/controllers/MonthlyIncomeController.php

class MonthlyIncomeController {
    private $conn;
    private $table_name = "monthly_income";

    public function __construct($db) {
        $this->conn = $db;
    }

    public function getByMonth($month_year) {
        $query = "SELECT * FROM " . $this->table_name . " WHERE month_year = :month_year ORDER BY category, created_at";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':month_year', $month_year);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getMonths() {
        $query = "SELECT DISTINCT month_year FROM " . $this->table_name . " ORDER BY created_at DESC";
        $stmt = $this->conn->prepare($query);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_COLUMN);
    }

    public function save($month_year, $rows) {
        try {
            $this->conn->beginTransaction();

            // Delete existing entries for this month
            $delete_query = "DELETE FROM " . $this->table_name . " WHERE month_year = :month_year";
            $delete_stmt = $this->conn->prepare($delete_query);
            $delete_stmt->bindParam(':month_year', $month_year);
            $delete_stmt->execute();

            // Insert new entries
            $insert_query = "INSERT INTO " . $this->table_name . " (month_year, category, description, amount, transaction_date) VALUES (:month_year, :category, :description, :amount, :transaction_date)";
            $insert_stmt = $this->conn->prepare($insert_query);

            foreach ($rows as $row) {
                if (!empty($row['description']) || !empty($row['amount'])) {
                    $insert_stmt->bindParam(':month_year', $month_year);
                    $insert_stmt->bindParam(':category', $row['category']);
                    $insert_stmt->bindParam(':description', $row['description']);
                    $amount = floatval($row['amount'] ?? 0);
                    $insert_stmt->bindParam(':amount', $amount);
                    $transaction_date = !empty($row['date']) ? $row['date'] : null;
                    $insert_stmt->bindParam(':transaction_date', $transaction_date);
                    $insert_stmt->execute();
                }
            }

            $this->conn->commit();
            return ["success" => true, "message" => "Monthly income saved successfully"];
        } catch (Exception $e) {
            if ($this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            return ["success" => false, "message" => "Error: " . $e->getMessage()];
        }
    }
}
?>
