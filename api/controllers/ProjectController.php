<?php
// api/controllers/ProjectController.php
class ProjectController
{
    private $conn;
    private $table_name = "projects";
    public function __construct($db)
    {
        $this->conn = $db;
    }
    public function create($data)
    {
        // Auto generate code if not provided
        $project_code = $data['project_code'] ?? 'ARK-PR-' . time();
        $expected_end_date = $data['expected_end_date'] ?? date('Y-m-d', strtotime('+6 months'));
        $total_budget = $data['total_budget'] ?? 0;

        $query = "INSERT INTO " . $this->table_name . " 
                (project_code, project_name, client_id, project_type, site_address, start_date, expected_end_date, total_budget, project_head_id, created_by, status) 
                VALUES (:project_code, :project_name, :client_id, :project_type, :site_address, :start_date, :expected_end_date, :total_budget, :project_head_id, :created_by, :status)";

        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':status', $data['status']);

        // Primary head for main table
        $primary_head_id = (!empty($data['project_heads']) && is_array($data['project_heads'])) ? $data['project_heads'][0] : ($data['project_head_id'] ?? null);

        $stmt->bindParam(':project_code', $project_code);
        $stmt->bindParam(':project_name', $data['project_name']);
        $stmt->bindParam(':client_id', $data['client_id']);
        $type_map = [
            'Architectural Design Consultation' => 'architecture',
            'Interior Design Consultation' => 'interior',
            'Arch + Interior' => 'both'
        ];
        $mapped_project_type = $type_map[$data['project_type']] ?? $data['project_type'];

        $stmt->bindParam(':project_type', $mapped_project_type);
        $stmt->bindParam(':site_address', $data['site_address']);
        $stmt->bindParam(':start_date', $data['start_date']);
        $stmt->bindParam(':expected_end_date', $expected_end_date);
        $stmt->bindParam(':total_budget', $total_budget);
        $stmt->bindParam(':project_head_id', $primary_head_id);
        $stmt->bindParam(':created_by', $data['created_by']);

        if ($stmt->execute()) {
            $project_id = $this->conn->lastInsertId();

            // 1. Initialize Timeline Master & Generate Dates
            require_once 'TimelineController.php';
            $timeline = new TimelineController($this->conn);
            $timeline->generateMasterTimeline($project_id, $data['start_date'], $expected_end_date, $data['created_by']);

            // 2. Assign Project Head explicitly in assignments table
            if (isset($data['project_head_id']) && !empty($data['project_head_id'])) {
                $this->assignTeam($project_id, $data['project_head_id'], 'project_head');
            }
            if (isset($data['project_heads']) && is_array($data['project_heads'])) {
                foreach ($data['project_heads'] as $ph_id) {
                    $this->assignTeam($project_id, $ph_id, 'project_head');
                }
            }

            // 3. Assign Site Engineers if provided
            if (isset($data['site_engineer_id'])) {
                $this->assignTeam($project_id, $data['site_engineer_id'], 'site_engineer');
            }
            if (isset($data['site_engineers']) && is_array($data['site_engineers'])) {
                foreach ($data['site_engineers'] as $se_id) {
                    $this->assignTeam($project_id, $se_id, 'site_engineer');
                }
            }

            return ["success" => true, "message" => "Project created, timeline generated and team assigned.", "project_id" => $project_id];
        }
        return ["success" => false, "message" => "Unable to create project."];
    }

    public function update($project_id, $data)
    {
        try {
            $this->conn->beginTransaction();

            // 1. Update project details
            $query = "UPDATE " . $this->table_name . " 
                      SET project_name = :name, site_address = :site, start_date = :start, expected_end_date = :end, project_head_id = :head, status = :status 
                      WHERE project_id = :id";
            $stmt = $this->conn->prepare($query);
            $stmt->execute([
                'name' => $data['project_name'],
                'site' => $data['site_address'],
                'start' => $data['start_date'],
                'end' => $data['expected_end_date'],
                'head' => $data['project_head_id'],
                'status' => $data['status'] ?? 'Pending',
                'id' => $project_id
            ]);

            // 2. Disable old team assignments
            $del_query = "UPDATE project_assignments SET status = 'inactive' WHERE project_id = :id";
            $del_stmt = $this->conn->prepare($del_query);
            $del_stmt->execute(['id' => $project_id]);

            // 3. Re-assign Project Head
            if (isset($data['project_head_id'])) {
                $this->assignTeam($project_id, $data['project_head_id'], 'project_head');
            }

            // 4. Re-assign Site Engineer
            if (isset($data['site_engineer_id'])) {
                $this->assignTeam($project_id, $data['site_engineer_id'], 'site_engineer');
            }

            $this->conn->commit();
            return ["success" => true, "message" => "Project updated successfully."];
        } catch (Exception $e) {
            $this->conn->rollBack();
            return ["success" => false, "message" => "Failed to update project: " . $e->getMessage()];
        }
    }

    public function updateBudget($project_id, $budget)
    {
        $query = "UPDATE " . $this->table_name . " SET total_budget = :budget WHERE project_id = :id";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':budget', $budget);
        $stmt->bindParam(':id', $project_id);

        if ($stmt->execute()) {
            return ["success" => true, "message" => "Budget updated successfully."];
        }
        return ["success" => false, "message" => "Failed to update budget."];
    }

    private function assignTeam($project_id, $user_id, $role)
    {
        $query = "INSERT INTO project_assignments (project_id, user_id, role, assigned_date, status) 
                  VALUES (:p_id, :u_id, :role, CURDATE(), 'active')";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':p_id', $project_id);
        $stmt->bindParam(':u_id', $user_id);
        $stmt->bindParam(':role', $role);
        return $stmt->execute();
    }

    public function getAll($user_id = null, $role = null)
    {
        $query = "SELECT p.*, c.name as client_name, c.phone as client_phone, u.name as project_head_name 
                  FROM " . $this->table_name . " p
                  LEFT JOIN clients c ON p.client_id = c.client_id
                  LEFT JOIN users u ON p.project_head_id = u.user_id";

        // Filter for Project Head or Site Engineer
        if ($user_id && in_array($role, ['project_head', 'site_engineer'])) {
            $query .= " JOIN project_assignments pa ON p.project_id = pa.project_id 
                        WHERE pa.user_id = :u_id AND pa.status = 'active'";
        }

        $query .= " ORDER BY p.created_at DESC";
        $stmt = $this->conn->prepare($query);

        if ($user_id && in_array($role, ['project_head', 'site_engineer'])) {
            $stmt->bindParam(':u_id', $user_id);
        }

        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getDetailedStats($project_id)
    {
        // 1. Basic Project Info
        $p_query = "SELECT p.*, c.name as client_name, c.phone as client_phone, c.address as client_address, u.name as project_head_name 
                    FROM projects p
                    JOIN clients c ON p.client_id = c.client_id
                    LEFT JOIN users u ON p.project_head_id = u.user_id
                    WHERE p.project_id = :id";
        $p_stmt = $this->conn->prepare($p_query);
        $p_stmt->execute(['id' => $project_id]);
        $project = $p_stmt->fetch(PDO::FETCH_ASSOC);

        if (!$project)
            return null;

        // 2. Financials
        // Paid Amount
        $pay_query = "SELECT SUM(amount) as total_paid FROM finance_transactions WHERE project_id = :id AND type = 'credit'";
        $pay_stmt = $this->conn->prepare($pay_query);
        $pay_stmt->execute(['id' => $project_id]);
        $total_paid = $pay_stmt->fetch(PDO::FETCH_ASSOC)['total_paid'] ?? 0;

        // Inventory Spent
        $inv_query = "SELECT SUM(total_amount) as total_spent FROM inventory WHERE project_id = :id";
        $inv_stmt = $this->conn->prepare($inv_query);
        $inv_stmt->execute(['id' => $project_id]);
        $total_spent = $inv_stmt->fetch(PDO::FETCH_ASSOC)['total_spent'] ?? 0;

        $project['total_paid'] = $total_paid;
        $project['total_spent'] = $total_spent;
        $project['remaining_balance'] = $project['total_budget'] - $total_paid;

        // 3. Team
        $project['team'] = $this->getTeamMembers($project_id);

        return $project;
    }

    public function getTeamMembers($project_id)
    {
        $query = "SELECT u.user_id, u.name, u.role, u.phone, pa.role as assignment_role 
                  FROM project_assignments pa
                  JOIN users u ON pa.user_id = u.user_id
                  WHERE pa.project_id = :p_id AND pa.status = 'active'";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':p_id', $project_id);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}
?>