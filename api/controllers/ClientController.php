<?php
// api/controllers/ClientController.php

class ClientController
{
    private $conn;
    private $table_name = "clients";
    private $current_user_id;
    private $current_user_role;

    public function __construct($db, $user_id = null, $role = null)
    {
        $this->conn = $db;
        $this->current_user_id = $user_id;
        $this->current_user_role = $role;
    }

    public function getAll()
    {
        // 1. Sync missing leads to clients table first to ensure historical leads appear
        try {
            $sync_query = "SELECT l.* FROM leads l LEFT JOIN clients c ON l.lead_id = c.converted_from_lead_id WHERE c.client_id IS NULL";
            $sync_stmt = $this->conn->prepare($sync_query);
            $sync_stmt->execute();
            $missing_leads = $sync_stmt->fetchAll(PDO::FETCH_ASSOC);

            foreach ($missing_leads as $lead) {
                // Generate a client code
                $type = $lead['project_type'] ?? 'Furniture projects';
                $client_code = $this->generateClientCode($type);

                // Ensure duplicate code handling
                $code_check = $this->conn->prepare("SELECT client_id FROM clients WHERE client_code = :code");
                $code_check->execute(['code' => $client_code]);
                if ($code_check->fetch()) {
                    $client_code = $client_code . "_" . $lead['lead_id'];
                }

                // Check created_by user ID exists
                $created_by = $lead['created_by'];
                $u_check = $this->conn->prepare("SELECT user_id FROM users WHERE user_id = :uid");
                $u_check->execute(['uid' => $created_by]);
                if (!$u_check->fetch()) {
                    $created_by = 1;
                }

                $c_query = "INSERT INTO clients (client_code, name, phone, address, lead_source, converted_from_lead_id, created_by, email, consultation_type, projectname, status) 
                            VALUES (:code, :name, :phone, :address, :source, :lead_id, :created_by, :email, :consultation_type, :projectname, 'active')";
                $c_stmt = $this->conn->prepare($c_query);
                $c_stmt->execute([
                    'code' => $client_code,
                    'name' => $lead['client_name'],
                    'phone' => $lead['contact_number'],
                    'address' => $lead['client_address'] ?? $lead['location'],
                    'source' => $lead['lead_source'],
                    'lead_id' => $lead['lead_id'],
                    'created_by' => $created_by,
                    'email' => $lead['email'],
                    'consultation_type' => $type,
                    'projectname' => $lead['client_name'] . ' Project'
                ]);
            }
        } catch (Exception $e) {
            // Log or ignore errors to not block page loading
        }

        // 2. Database status sanitization
        try {
            $this->conn->exec("UPDATE clients SET status = 'active' WHERE status IS NULL OR status = ''");
        } catch (Exception $e) {
            // Ignore
        }

        // 3. Fetch all clients without role restrictions to display everything to all roles
        $query = "SELECT DISTINCT c.*, p.project_id, COALESCE(p.project_name, c.projectname) as projectname, p.project_name as p_project_name 
                  FROM " . $this->table_name . " c
                  LEFT JOIN projects p ON c.client_id = p.client_id
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
        $type = $data['consultation_type'] ?? 'Furniture projects';
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
            $fy = substr($currentYear, 2) . '-' . substr((int) $currentYear + 1, 2);
        } else {
            $fy = substr((int) $currentYear - 1, 2) . '-' . substr($currentYear, 2);
        }

        // Get prefix based on type
        $prefix = 'FP'; // Default
        if ($type === 'Furniture projects') {
            $prefix = 'FP';
        } elseif ($type === 'Interior Projects') {
            $prefix = 'IP';
        } elseif ($type === 'Site Execution Tracker') {
            $prefix = 'SET';
        }

        // Find the last number for this specific type and financial year to ensure sequential numbering
        $search = $prefix . "/" . $fy . "/%";
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

        return $prefix . '/' . $fy . '/' . str_pad($next_id, 3, '0', STR_PAD_LEFT);
    }

    public function update($data)
    {
        $query = "UPDATE " . $this->table_name . " SET 
                  name = :name, 
                  projectname = :projectname, 
                  consultation_type = :type, 
                  email = :email, 
                  phone = :phone, 
                  address = :address 
                  WHERE client_id = :id";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':name', $data['name']);
        $stmt->bindParam(':projectname', $data['projectname']);
        $stmt->bindParam(':type', $data['consultation_type']);
        $stmt->bindParam(':email', $data['email']);
        $stmt->bindParam(':phone', $data['phone']);
        $stmt->bindParam(':address', $data['address']);
        $stmt->bindParam(':id', $data['client_id']);

        if ($stmt->execute()) {
            return ["success" => true, "message" => "Client updated successfully"];
        }
        return ["success" => false, "message" => "Failed to update client"];
    }

    public function delete($id)
    {
        $query = "UPDATE " . $this->table_name . " SET status = 'deleted' WHERE client_id = :id";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':id', $id);
        if ($stmt->execute()) {
            return ["success" => true, "message" => "Client deleted successfully"];
        }
        return ["success" => false, "message" => "Failed to delete client"];
    }
}
?>