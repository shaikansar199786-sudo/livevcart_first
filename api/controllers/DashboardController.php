<?php
// api/controllers/DashboardController.php

class DashboardController
{
    private $conn;
    private $current_user_id;
    private $current_user_role;

    public function __construct($db, $user_id = null, $role = null)
    {
        $this->conn = $db;
        $this->current_user_id = $user_id;
        $this->current_user_role = $role;
    }

    public function getSummary()
    {
        $stats = [];
        $u_id = $this->current_user_id;
        $u_role = $this->current_user_role;

        // Base project query
        $proj_query = "SELECT COUNT(DISTINCT p.project_id) as count FROM projects p ";
        if ($u_id && in_array($u_role, ['site_engineer', 'd1', 'd2', 'project_manager'])) {
            $proj_query .= " LEFT JOIN project_assignments pa ON pa.project_id = p.project_id WHERE p.status = 'active' AND (pa.user_id = :u_id OR p.created_by = :u_id)";
        } elseif ($u_id && $u_role === 'sales') {
            $proj_query .= " WHERE p.status = 'active' AND p.created_by = :u_id";
        } else {
            $proj_query .= " WHERE p.status = 'active'";
        }
        
        $stmt = $this->conn->prepare($proj_query);
        if ($u_id && $u_role !== 'admin') {
            $stmt->bindParam(':u_id', $u_id);
        }
        $stmt->execute();
        $stats['active_projects'] = $stmt->fetch(PDO::FETCH_ASSOC)['count'];

        // Pending Leads
        $lead_query = "SELECT COUNT(*) as count FROM leads WHERE status != 'converted'";
        if ($u_id && $u_role === 'sales') {
            $lead_query .= " AND created_by = :u_id";
        } elseif ($u_id && $u_role === 'd1') {
            $lead_query .= " AND d1_assigned_to = :u_id";
        } elseif ($u_id && in_array($u_role, ['site_engineer', 'project_manager'])) {
            $lead_query .= " AND (created_by = :u_id OR assigned_to = :u_id)";
        }
        
        $stmt = $this->conn->prepare($lead_query);
        if ($u_id && $u_role !== 'admin') {
            $stmt->bindParam(':u_id', $u_id);
        }
        $stmt->execute();
        $stats['pending_leads'] = $stmt->fetch(PDO::FETCH_ASSOC)['count'];

        // Total Clients
        $client_query = "SELECT COUNT(DISTINCT c.client_id) as count FROM clients c ";
        if ($u_id && in_array($u_role, ['site_engineer', 'd1', 'd2', 'project_manager'])) {
            $client_query .= " LEFT JOIN projects p ON p.client_id = c.client_id LEFT JOIN project_assignments pa ON pa.project_id = p.project_id WHERE (pa.user_id = :u_id OR c.created_by = :u_id)";
        } elseif ($u_id && $u_role === 'sales') {
            $client_query .= " WHERE c.created_by = :u_id";
        }
        
        $stmt = $this->conn->prepare($client_query);
        if ($u_id && $u_role !== 'admin') {
            $stmt->bindParam(':u_id', $u_id);
        }
        $stmt->execute();
        $stats['total_clients'] = $stmt->fetch(PDO::FETCH_ASSOC)['count'];

        // Financial Overview (Restrict to admin/accountant usually, or show user's project finances)
        // For simplicity, if not admin/accountant, show 0 or skip
        if (in_array($u_role, ['admin', 'accountant'])) {
            $stmt = $this->conn->prepare("SELECT 
                                            SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END) as income,
                                            SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END) as expense
                                          FROM finance_transactions");
            $stmt->execute();
            $finance = $stmt->fetch(PDO::FETCH_ASSOC);
            $stats['total_income'] = $finance['income'] ?? 0;
            $stats['total_expense'] = $finance['expense'] ?? 0;
        } else {
            $stats['total_income'] = 0;
            $stats['total_expense'] = 0;
        }

        // Recently Completed/Updated Projects (for a chart)
        $recent_query = "SELECT DISTINCT p.project_name, p.total_budget FROM projects p ";
        if ($u_id && in_array($u_role, ['site_engineer', 'd1', 'd2', 'project_manager'])) {
            $recent_query .= " LEFT JOIN project_assignments pa ON pa.project_id = p.project_id WHERE (pa.user_id = :u_id OR p.created_by = :u_id) ";
        } elseif ($u_id && $u_role === 'sales') {
            $recent_query .= " WHERE p.created_by = :u_id ";
        }
        $recent_query .= " ORDER BY p.created_at DESC LIMIT 5";
        $stmt = $this->conn->prepare($recent_query);
        if ($u_id && $u_role !== 'admin') {
            $stmt->bindParam(':u_id', $u_id);
        }
        $stmt->execute();
        $stats['recent_projects_data'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Expense by Category (Admin only)
        if (in_array($u_role, ['admin', 'accountant'])) {
            $stmt = $this->conn->prepare("SELECT category as name, SUM(amount) as value FROM finance_transactions WHERE type = 'debit' GROUP BY category");
            $stmt->execute();
            $stats['expense_category_data'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } else {
            $stats['expense_category_data'] = [];
        }

        return ["success" => true, "data" => $stats];
    }
}
?>