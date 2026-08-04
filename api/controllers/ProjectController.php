<?php
// api/controllers/ProjectController.php
class ProjectController
{
    private $conn;
    private $table_name = "projects";
    private $current_user_id;
    private $current_user_role;

    public function __construct($db, $user_id = null, $role = null)
    {
        $this->conn = $db;
        $this->current_user_id = $user_id;
        $this->current_user_role = $role;
    }
    public function create($data)
    {
        // Auto generate code if not provided
        $project_code = $data['project_code'] ?? 'Livincart-PR-' . time();
        $expected_end_date = $data['expected_end_date'] ?? date('Y-m-d', strtotime('+6 months'));
        $total_budget = $data['total_budget'] ?? 0;

        $query = "INSERT INTO " . $this->table_name . " 
                (project_code, project_name, client_id, project_type, site_address, start_date, expected_end_date, total_budget, project_head_id, created_by, status) 
                VALUES (:project_code, :project_name, :client_id, :project_type, :site_address, :start_date, :expected_end_date, :total_budget, :project_head_id, :created_by, :status)";

        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':status', $data['status']);

        // Primary head for main table
        $primary_head_id = (!empty($data['project_heads']) && is_array($data['project_heads'])) ? $data['project_heads'][0] : ($data['project_head_id'] ?? null);

        // Auto resolve client_id from client_name if missing
        $client_id = $data['client_id'] ?? null;
        if (empty($client_id) && !empty($data['client_name'])) {
            $c_stmt = $this->conn->prepare("SELECT client_id FROM clients WHERE LOWER(name) = LOWER(:cname) LIMIT 1");
            $c_stmt->execute([':cname' => trim($data['client_name'])]);
            $client_row = $c_stmt->fetch(PDO::FETCH_ASSOC);
            if ($client_row) {
                $client_id = $client_row['client_id'];
            } else {
                $ins_c = $this->conn->prepare("INSERT INTO clients (name, phone, address, created_at) VALUES (:cname, '0000000000', 'Main Address', NOW())");
                $ins_c->execute([':cname' => trim($data['client_name'])]);
                $client_id = $this->conn->lastInsertId();
            }
        }

        $stmt->bindParam(':project_code', $project_code);
        $stmt->bindParam(':project_name', $data['project_name']);
        $stmt->bindParam(':client_id', $client_id);
        $type_map = [
            'Furniture projects' => 'Furniture projects',
            'Interior Projects' => 'Interior Projects',
            'Site Execution Tracker' => 'Site Execution Tracker',
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

            // Auto link existing quotes and agreements from lead to newly created project_id
            if (!empty($data['lead_id']) || !empty($data['old_project_id'])) {
                $old_p_id = $data['lead_id'] ?? $data['old_project_id'];
                $clean_num = preg_replace('/[^0-9]/', '', (string)$old_p_id);
                $up_q = $this->conn->prepare("UPDATE quotes SET project_id = :new_id WHERE project_id = :old_id OR project_id = :lead_str OR project_id = :num_str");
                $up_q->execute([
                    ':new_id' => $project_id,
                    ':old_id' => $old_p_id,
                    ':lead_str' => 'lead_' . $clean_num,
                    ':num_str' => $clean_num
                ]);

                try {
                    $up_ag = $this->conn->prepare("UPDATE agreements SET ref_id = :ref_code WHERE ref_id = :old_id OR ref_id = :lead_str OR ref_id = :num_str OR (client_name = :c_name AND client_name != '')");
                    $up_ag->execute([
                        ':ref_code' => 'PR_' . $project_id,
                        ':old_id' => $old_p_id,
                        ':lead_str' => 'lead_' . $clean_num,
                        ':num_str' => $clean_num,
                        ':c_name' => $data['client_name'] ?? ''
                    ]);
                } catch (Exception $ex) {}

                try {
                    $l_stmt = $this->conn->prepare("SELECT d1_assigned_to, site_manager_assigned_to FROM leads WHERE lead_id = :lead_id");
                    $l_stmt->execute([':lead_id' => $clean_num]);
                    $lead_info = $l_stmt->fetch(PDO::FETCH_ASSOC);
                    if ($lead_info) {
                        if (!empty($lead_info['d1_assigned_to'])) {
                            $d1_ids = array_filter(array_map('trim', explode(',', $lead_info['d1_assigned_to'])));
                            foreach ($d1_ids as $d1_id) {
                                $this->assignTeam($project_id, $d1_id, 'designer');
                            }
                        }
                        if (!empty($lead_info['site_manager_assigned_to'])) {
                            $sm_ids = array_filter(array_map('trim', explode(',', $lead_info['site_manager_assigned_to'])));
                            foreach ($sm_ids as $sm_id) {
                                $this->assignTeam($project_id, $sm_id, 'site_manager');
                            }
                        }
                    }
                } catch (Exception $ex) {}
            }

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
                      SET project_name = :name, site_address = :site, start_date = :start, expected_end_date = :end, project_head_id = :head, status = :status, project_type = :project_type 
                      WHERE project_id = :id";
            $stmt = $this->conn->prepare($query);
            $stmt->execute([
                'name' => $data['project_name'],
                'site' => $data['site_address'],
                'start' => $data['start_date'],
                'end' => $data['expected_end_date'],
                'head' => $data['project_head_id'],
                'status' => $data['status'] ?? 'Pending',
                'project_type' => $data['project_type'] ?? 'interior',
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

    public function updateStatus($project_id, $status)
    {
        $query = "UPDATE " . $this->table_name . " SET status = :status WHERE project_id = :id";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':status', $status);
        $stmt->bindParam(':id', $project_id);
        if ($stmt->execute()) {
            return ["success" => true, "message" => "Project status updated."];
        }
        return ["success" => false, "message" => "Failed to update project status."];
    }

    public function getAll($user_id = null, $role = null)
    {
        $query = "SELECT DISTINCT p.*, c.name as client_name, c.phone as client_phone, u.name as project_head_name 
                  FROM " . $this->table_name . " p
                  LEFT JOIN clients c ON p.client_id = c.client_id
                  LEFT JOIN users u ON p.project_head_id = u.user_id
                  ORDER BY p.created_at DESC";

        $stmt = $this->conn->prepare($query);
        $stmt->execute();
        $projects = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Fetch team assignments for each project
        foreach ($projects as &$project) {
            $project['team'] = $this->getTeamMembers($project['project_id']);
        }

        return $projects;
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

        // Auto-assign designer and site manager from lead if missing in project assignments
        try {
            $check_assigned = $this->conn->prepare("SELECT COUNT(*) as count FROM project_assignments WHERE project_id = :p_id AND role IN ('designer', 'site_manager')");
            $check_assigned->execute([':p_id' => $project_id]);
            $count = $check_assigned->fetch(PDO::FETCH_ASSOC)['count'] ?? 0;
            if ($count == 0) {
                $l_stmt = $this->conn->prepare("SELECT c.converted_from_lead_id FROM clients c JOIN projects p ON p.client_id = c.client_id WHERE p.project_id = :p_id");
                $l_stmt->execute([':p_id' => $project_id]);
                $lead_id = $l_stmt->fetch(PDO::FETCH_ASSOC)['converted_from_lead_id'] ?? null;
                if ($lead_id) {
                    $l_stmt2 = $this->conn->prepare("SELECT d1_assigned_to, site_manager_assigned_to FROM leads WHERE lead_id = :lead_id");
                    $l_stmt2->execute([':lead_id' => $lead_id]);
                    $lead_info = $l_stmt2->fetch(PDO::FETCH_ASSOC);
                    if ($lead_info) {
                        if (!empty($lead_info['d1_assigned_to'])) {
                            $d1_ids = array_filter(array_map('trim', explode(',', $lead_info['d1_assigned_to'])));
                            foreach ($d1_ids as $d1_id) {
                                $this->assignTeam($project_id, $d1_id, 'designer');
                            }
                        }
                        if (!empty($lead_info['site_manager_assigned_to'])) {
                            $sm_ids = array_filter(array_map('trim', explode(',', $lead_info['site_manager_assigned_to'])));
                            foreach ($sm_ids as $sm_id) {
                                $this->assignTeam($project_id, $sm_id, 'site_manager');
                            }
                        }
                    }
                }
            }
        } catch (Exception $ex) {}

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
    public function delete($project_id)
    {
        try {
            $this->conn->beginTransaction();

            // Delete quote items first
            try {
                $del_q_items = "DELETE FROM quote_items WHERE quote_id IN (SELECT quote_id FROM quotes WHERE project_id = :id)";
                $stmt_qi = $this->conn->prepare($del_q_items);
                $stmt_qi->execute(['id' => $project_id]);
            } catch (Exception $e) {
            }

            // Delete quotes
            try {
                $del_quotes = "DELETE FROM quotes WHERE project_id = :id";
                $stmt_q = $this->conn->prepare($del_quotes);
                $stmt_q->execute(['id' => $project_id]);
            } catch (Exception $e) {
            }

            // Delete assignments
            try {
                $del_assign = "DELETE FROM project_assignments WHERE project_id = :id";
                $stmt_a = $this->conn->prepare($del_assign);
                $stmt_a->execute(['id' => $project_id]);
            } catch (Exception $e) {
            }

            // Delete inventory
            try {
                $del_inv = "DELETE FROM project_inventory WHERE project_id = :id";
                $stmt_inv = $this->conn->prepare($del_inv);
                $stmt_inv->execute(['id' => $project_id]);
            } catch (Exception $e) {
            }

            // Delete timeline
            try {
                $del_tl = "DELETE FROM project_timeline WHERE project_id = :id";
                $stmt_tl = $this->conn->prepare($del_tl);
                $stmt_tl->execute(['id' => $project_id]);
            } catch (Exception $e) {
            }

            // Delete trackers
            try {
                $del_tr = "DELETE FROM project_trackers WHERE project_id = :id";
                $stmt_tr = $this->conn->prepare($del_tr);
                $stmt_tr->execute(['id' => $project_id]);
            } catch (Exception $e) {
            }

            // Delete project
            $del_proj = "DELETE FROM " . $this->table_name . " WHERE project_id = :id";
            $stmt_p = $this->conn->prepare($del_proj);
            $stmt_p->execute(['id' => $project_id]);

            $this->conn->commit();
            return ["success" => true, "message" => "Project deleted successfully."];
        } catch (Exception $e) {
            $this->conn->rollBack();
            return ["success" => false, "message" => "Failed to delete project: " . $e->getMessage()];
        }
    }

    public function getFinancialOverview()
    {
        try {
            $query = "SELECT 
                        p.project_id, 
                        p.project_name, 
                        p.total_budget,
                        COALESCE(ft_credit.total_credit, 0) as total_paid,
                        COALESCE(ft_debit.total_debit, 0) as total_debit,
                        COALESCE(inv.total_inv, 0) as total_inventory
                      FROM projects p
                      LEFT JOIN (
                          SELECT project_id, SUM(amount) as total_credit 
                          FROM finance_transactions 
                          WHERE type = 'credit' 
                          GROUP BY project_id
                      ) ft_credit ON p.project_id = ft_credit.project_id
                      LEFT JOIN (
                          SELECT project_id, SUM(amount) as total_debit 
                          FROM finance_transactions 
                          WHERE type = 'debit' 
                          GROUP BY project_id
                      ) ft_debit ON p.project_id = ft_debit.project_id
                      LEFT JOIN (
                          SELECT project_id, SUM(total) as total_inv 
                          FROM project_inventory 
                          GROUP BY project_id
                      ) inv ON p.project_id = inv.project_id
                      ORDER BY p.created_at DESC";

            $stmt = $this->conn->prepare($query);
            $stmt->execute();
            $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Exception $e) {
            $query = "SELECT 
                        p.project_id, 
                        p.project_name, 
                        p.total_budget,
                        COALESCE(ft_credit.total_credit, 0) as total_paid,
                        COALESCE(ft_debit.total_debit, 0) as total_debit,
                        0 as total_inventory
                      FROM projects p
                      LEFT JOIN (
                          SELECT project_id, SUM(amount) as total_credit 
                          FROM finance_transactions 
                          WHERE type = 'credit' 
                          GROUP BY project_id
                      ) ft_credit ON p.project_id = ft_credit.project_id
                      LEFT JOIN (
                          SELECT project_id, SUM(amount) as total_debit 
                          FROM finance_transactions 
                          WHERE type = 'debit' 
                          GROUP BY project_id
                      ) ft_debit ON p.project_id = ft_debit.project_id
                      ORDER BY p.created_at DESC";

            $stmt = $this->conn->prepare($query);
            $stmt->execute();
            $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
        }

        $data = [];
        foreach ($results as $row) {
            $budget = floatval($row['total_budget']);
            $advance = floatval($row['total_paid']);
            $spent = floatval($row['total_debit']) + floatval($row['total_inventory']);
            $profit = $budget - $spent;

            $data[] = [
                'project_id' => $row['project_id'],
                'project_name' => $row['project_name'],
                'total_budget' => $budget,
                'advance_paid' => $advance,
                'total_spent' => $spent,
                'profit' => $profit
            ];
        }

        return ["success" => true, "data" => $data];
    }
}
?>