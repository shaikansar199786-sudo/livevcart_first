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

    public function getSummary($period = 'all', $project_type = 'all', $start_date = null, $end_date = null)
    {
        $stats = [];
        $u_id = $this->current_user_id;
        $u_role = $this->current_user_role;

        // ─── Build date filter for tables that have created_at ────────────────
        $created_date_clause = '';
        $date_params = [];

        if ($period === 'last_month') {
            $created_date_clause = " AND created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)";
        } elseif ($period === 'last_3_months') {
            $created_date_clause = " AND created_at >= DATE_SUB(NOW(), INTERVAL 3 MONTH)";
        } elseif ($period === 'last_6_months') {
            $created_date_clause = " AND created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)";
        } elseif ($period === 'this_year') {
            $created_date_clause = " AND YEAR(created_at) = YEAR(NOW())";
        } elseif (preg_match('/^year_(\d{4})$/', $period, $m)) {
            $yr = (int)$m[1];
            $created_date_clause = " AND YEAR(created_at) = {$yr}";
        } elseif ($period === 'custom' && $start_date && $end_date) {
            $created_date_clause = " AND created_at BETWEEN :cdate_start AND :cdate_end";
            $date_params[':cdate_start'] = $start_date . ' 00:00:00';
            $date_params[':cdate_end']   = $end_date   . ' 23:59:59';
        }

        // ─── Build date filter for finance_transactions (uses transaction_date) ─
        $fin_date_clause = '';
        $fin_params = [];

        if ($period === 'last_month') {
            $fin_date_clause = " AND transaction_date >= DATE_SUB(NOW(), INTERVAL 1 MONTH)";
        } elseif ($period === 'last_3_months') {
            $fin_date_clause = " AND transaction_date >= DATE_SUB(NOW(), INTERVAL 3 MONTH)";
        } elseif ($period === 'last_6_months') {
            $fin_date_clause = " AND transaction_date >= DATE_SUB(NOW(), INTERVAL 6 MONTH)";
        } elseif ($period === 'this_year') {
            $fin_date_clause = " AND YEAR(transaction_date) = YEAR(NOW())";
        } elseif (preg_match('/^year_(\d{4})$/', $period, $m)) {
            $yr = (int)$m[1];
            $fin_date_clause = " AND YEAR(transaction_date) = {$yr}";
        } elseif ($period === 'custom' && $start_date && $end_date) {
            $fin_date_clause = " AND transaction_date BETWEEN :fdate_start AND :fdate_end";
            $fin_params[':fdate_start'] = $start_date . ' 00:00:00';
            $fin_params[':fdate_end']   = $end_date   . ' 23:59:59';
        }

        // ─── Project type filter ───────────────────────────────────────────────
        $ptype_clause = '';
        if ($project_type === 'furniture') {
            $ptype_clause = " AND (p.project_type LIKE '%furniture%' OR p.project_type LIKE '%architectural%')";
        } elseif ($project_type === 'interior') {
            $ptype_clause = " AND p.project_type LIKE '%interior%'";
        }

        // ─── 1. Active Projects ───────────────────────────────────────────────
        $proj_where = "(p.status = 'active' OR LOWER(p.status) NOT IN ('lost', 'cancelled', 'completed', 'handover', 'finished'))";
        $proj_join  = '';
        $proj_bind  = [];

        if ($u_id && in_array($u_role, ['site_engineer', 'd1', 'd2', 'project_manager'])) {
            $proj_join  = " LEFT JOIN project_assignments pa ON pa.project_id = p.project_id";
            $proj_where .= " AND (pa.user_id = :u_id OR p.created_by = :u_id)";
            $proj_bind[':u_id'] = $u_id;
        } elseif ($u_id && $u_role === 'sales') {
            $proj_where .= " AND p.created_by = :u_id";
            $proj_bind[':u_id'] = $u_id;
        }

        $proj_sql = "SELECT COUNT(DISTINCT p.project_id) AS count
                     FROM projects p {$proj_join}
                     WHERE {$proj_where} {$ptype_clause} " .
                    str_replace('created_at', 'p.created_at', $created_date_clause);

        $stmt = $this->conn->prepare($proj_sql);
        foreach ($proj_bind as $k => $v)  $stmt->bindValue($k, $v);
        foreach ($date_params as $k => $v) $stmt->bindValue($k, $v);
        $stmt->execute();
        $stats['active_projects'] = (int)($stmt->fetch(PDO::FETCH_ASSOC)['count'] ?? 0);

        // ─── 2. Pending Leads ─────────────────────────────────────────────────
        $lead_where = "status != 'converted'";
        $lead_bind  = [];

        if ($u_id && $u_role === 'sales') {
            $lead_where .= " AND created_by = :u_id";
            $lead_bind[':u_id'] = $u_id;
        } elseif ($u_id && $u_role === 'd1') {
            $lead_where .= " AND d1_assigned_to = :u_id";
            $lead_bind[':u_id'] = $u_id;
        } elseif ($u_id && in_array($u_role, ['site_engineer', 'project_manager'])) {
            $lead_where .= " AND (created_by = :u_id OR assigned_to = :u_id)";
            $lead_bind[':u_id'] = $u_id;
        }

        $lead_sql = "SELECT COUNT(*) AS count FROM leads WHERE {$lead_where} {$created_date_clause}";
        $stmt = $this->conn->prepare($lead_sql);
        foreach ($lead_bind as $k => $v)  $stmt->bindValue($k, $v);
        foreach ($date_params as $k => $v) $stmt->bindValue($k, $v);
        $stmt->execute();
        $stats['pending_leads'] = (int)($stmt->fetch(PDO::FETCH_ASSOC)['count'] ?? 0);

        // ─── 3. Total Clients ─────────────────────────────────────────────────
        $client_join  = '';
        $client_where = '1=1';
        $client_bind  = [];

        if ($u_id && in_array($u_role, ['site_engineer', 'd1', 'd2', 'project_manager'])) {
            $client_join  = " LEFT JOIN projects p ON p.client_id = c.client_id
                              LEFT JOIN project_assignments pa ON pa.project_id = p.project_id";
            $client_where = "(pa.user_id = :u_id OR c.created_by = :u_id)";
            $client_bind[':u_id'] = $u_id;
        } elseif ($u_id && $u_role === 'sales') {
            $client_where = "c.created_by = :u_id";
            $client_bind[':u_id'] = $u_id;
        }

        $client_sql = "SELECT COUNT(DISTINCT c.client_id) AS count
                       FROM clients c {$client_join}
                       WHERE {$client_where} " .
                      str_replace('created_at', 'c.created_at', $created_date_clause);

        $stmt = $this->conn->prepare($client_sql);
        foreach ($client_bind as $k => $v) $stmt->bindValue($k, $v);
        foreach ($date_params as $k => $v) $stmt->bindValue($k, $v);
        $stmt->execute();
        $stats['total_clients'] = (int)($stmt->fetch(PDO::FETCH_ASSOC)['count'] ?? 0);

        // ─── 4. Financial (admin/accountant only) ────────────────────────────
        if (in_array($u_role, ['admin', 'accountant'])) {
            $fin_sql = "SELECT
                            SUM(CASE WHEN type='credit' THEN amount ELSE 0 END)                                                           AS income,
                            SUM(CASE WHEN type='debit' AND (payment_mode IS NULL OR payment_mode != 'Unpaid') AND COALESCE(approval_status, 'approved') = 'approved' THEN amount ELSE 0 END) AS expense
                        FROM finance_transactions
                        WHERE 1=1 {$fin_date_clause}";
            $stmt = $this->conn->prepare($fin_sql);
            foreach ($fin_params as $k => $v) $stmt->bindValue($k, $v);
            $stmt->execute();
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            $stats['total_income']  = (float)($row['income']  ?? 0);
            $stats['total_expense'] = (float)($row['expense'] ?? 0);
        } else {
            $stats['total_income']  = 0;
            $stats['total_expense'] = 0;
        }

        // ─── 5. Recent Projects ───────────────────────────────────────────────
        $rp_join  = '';
        $rp_where = '1=1';
        $rp_bind  = [];

        if ($u_id && in_array($u_role, ['site_engineer', 'd1', 'd2', 'project_manager'])) {
            $rp_join  = " LEFT JOIN project_assignments pa ON pa.project_id = p.project_id";
            $rp_where = "(pa.user_id = :u_id OR p.created_by = :u_id)";
            $rp_bind[':u_id'] = $u_id;
        } elseif ($u_id && $u_role === 'sales') {
            $rp_where = "p.created_by = :u_id";
            $rp_bind[':u_id'] = $u_id;
        }

        $rp_sql = "SELECT DISTINCT p.project_name, p.total_budget
                   FROM projects p {$rp_join}
                   WHERE {$rp_where} {$ptype_clause} " .
                  str_replace('created_at', 'p.created_at', $created_date_clause) .
                  " ORDER BY p.created_at DESC LIMIT 5";

        $stmt = $this->conn->prepare($rp_sql);
        foreach ($rp_bind as $k => $v)  $stmt->bindValue($k, $v);
        foreach ($date_params as $k => $v) $stmt->bindValue($k, $v);
        $stmt->execute();
        $stats['recent_projects_data'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // ─── 6. Expense by Category ───────────────────────────────────────────
        if (in_array($u_role, ['admin', 'accountant'])) {
            $cat_sql = "SELECT category AS name, SUM(amount) AS value
                        FROM finance_transactions
                        WHERE type = 'debit' AND COALESCE(approval_status, 'approved') = 'approved' {$fin_date_clause}
                        GROUP BY category";
            $stmt = $this->conn->prepare($cat_sql);
            foreach ($fin_params as $k => $v) $stmt->bindValue($k, $v);
            $stmt->execute();
            $stats['expense_category_data'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } else {
            $stats['expense_category_data'] = [];
        }

        // ─── 7. Tasks Summary (Approved, Pending, Rejected, Cancelled) ──────────
        $task_sql = "SELECT 
                        COUNT(*) AS total,
                        SUM(CASE WHEN status IN ('accepted', 'ongoing', 'completed') THEN 1 ELSE 0 END) AS approved,
                        SUM(CASE WHEN status IN ('pending_admin_review', 'pending_completion_review') THEN 1 ELSE 0 END) AS pending,
                        SUM(CASE WHEN status IN ('rejected', 'completion_rejected') THEN 1 ELSE 0 END) AS rejected,
                        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled
                     FROM mb_tasks
                     WHERE 1=1 " . str_replace('created_at', 'created_at', $created_date_clause);
        try {
            $stmt = $this->conn->prepare($task_sql);
            foreach ($date_params as $k => $v) $stmt->bindValue($k, $v);
            $stmt->execute();
            $task_row = $stmt->fetch(PDO::FETCH_ASSOC);
            $stats['tasks_total'] = (int)($task_row['total'] ?? 0);
            $stats['tasks_approved'] = (int)($task_row['approved'] ?? 0);
            $stats['tasks_pending'] = (int)($task_row['pending'] ?? 0);
            $stats['tasks_rejected'] = (int)($task_row['rejected'] ?? 0);
            $stats['tasks_cancelled'] = (int)($task_row['cancelled'] ?? 0);
        } catch (\Exception $e) {
            $stats['tasks_total'] = 0;
            $stats['tasks_approved'] = 0;
            $stats['tasks_pending'] = 0;
            $stats['tasks_rejected'] = 0;
            $stats['tasks_cancelled'] = 0;
        }

        return ["success" => true, "data" => $stats];
    }
}