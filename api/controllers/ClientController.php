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
        $type = $data['consultation_type'] ?? 'Interior Design';
        $client_code = $this->generateClientCode($type);
        
        $query = "INSERT INTO " . $this->table_name . " 
                (client_code, name, projectname, consultation_type, email, phone, address, lead_source, created_by, status) 
                VALUES (:code, :name, :projectname, :type, :email, :phone, :address, :source, :created_by, 'active')";

        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':code', $client_code);
        $stmt->bindParam(':name', $data['name']);
        $stmt->bindParam(':projectname', $data['projectname']);
        $stmt->bindParam(':type', $type);
        $stmt->bindParam(':email', $data['email']);
        $stmt->bindParam(':phone', $data['phone']);
        $stmt->bindParam(':address', $data['address']);
        $source = $data['lead_source'] ?? 'walk_in';
        $stmt->bindParam(':source', $source);
        $stmt->bindParam(':created_by', $data['created_by']);

        if ($stmt->execute()) {
            return ["success" => true, "client_id" => $this->conn->lastInsertId(), "client_code" => $client_code];
        }
        return false;
    }

    private function generateClientCode($type)
    {
        $currentMonth = date('m');
        $currentYear = date('Y');
        
        // Financial Year logic (April to March)
        if ($currentMonth >= 4) {
            $fy = substr($currentYear, 2) . '-' . substr((int)$currentYear + 1, 2);
        } else {
            $fy = substr((int)$currentYear - 1, 2) . '-' . substr($currentYear, 2);
        }

        // Get prefix based on type
        $prefix = 'ADC'; // Default
        if ($type === 'Architectural Design Consultation') {
            $prefix = 'ADC';
        } elseif ($type === 'Interior Design Consultation') {
            $prefix = 'IDC';
        } elseif ($type === 'Arch + Interior') {
            $prefix = 'IE';
        }

        // Find the last number for this specific type and financial year to ensure sequential numbering
        $search = "ARK/" . $prefix . "/" . $fy . "/%";
        $query = "SELECT client_code FROM " . $this->table_name . " WHERE client_code LIKE :search ORDER BY client_id DESC LIMIT 1";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':search', $search);
        $stmt->execute();
        $last = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($last) {
            $parts = explode('/', $last['client_code']);
            $last_num = (int) end($parts);
            $next_id = $last_num + 1;
        } else {
            $next_id = 1;
        }
        
        return 'ARK/' . $prefix . '/' . $fy . '/' . str_pad($next_id, 3, '0', STR_PAD_LEFT);
    }
}
?>