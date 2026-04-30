<?php
// api/controllers/ClientController.php

class ClientController
{
    private $conn;
    private $table_name = "clients";

    public function __construct($db)
    {
        $this->conn = $db;
    }

    public function getAll()
    {
        $query = "SELECT c.*, p.project_id, COALESCE(p.project_name, c.projectname) as projectname, p.project_name as p_project_name 
                  FROM " . $this->table_name . " c
                  LEFT JOIN projects p ON c.client_id = p.client_id AND p.status = 'active'
                  WHERE c.status = 'active' 
                  ORDER BY c.created_at DESC";
        $stmt = $this->conn->prepare($query);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getDetails($client_id)
    {
        $query = "SELECT * FROM " . $this->table_name . " WHERE client_id = :id";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':id', $client_id);
        $stmt->execute();
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public function create($data)
    {
        $client_code = $this->generateClientCode();
        $query = "INSERT INTO " . $this->table_name . " 
                (client_code, name, projectname, email, phone, address, lead_source, created_by, status) 
                VALUES (:code, :name, :projectname, :email, :phone, :address, :source, :created_by, 'active')";

        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':code', $client_code);
        $stmt->bindParam(':name', $data['name']);
        $stmt->bindParam(':projectname', $data['projectname']);
        $stmt->bindParam(':email', $data['email']);
        $stmt->bindParam(':phone', $data['phone']);
        $stmt->bindParam(':address', $data['address']);
        $source = $data['lead_source'] ?? 'walk_in';
        $stmt->bindParam(':source', $source);
        $stmt->bindParam(':created_by', $data['created_by']);

        if ($stmt->execute()) {
            return $this->conn->lastInsertId();
        }
        return false;
    }

    private function generateClientCode()
    {
        $query = "SELECT client_id FROM " . $this->table_name . " ORDER BY client_id DESC LIMIT 1";
        $stmt = $this->conn->prepare($query);
        $stmt->execute();
        $last = $stmt->fetch(PDO::FETCH_ASSOC);
        $next_id = ($last ? (int) $last['client_id'] : 0) + 1;
        return 'ARK-CL-' . str_pad($next_id, 3, '0', STR_PAD_LEFT);
    }
}
?>