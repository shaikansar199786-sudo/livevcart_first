<?php
// api/controllers/ProjectController.php
require_once __DIR__ . '/../helpers/MailHelper.php';
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
        $role_norm = strtolower(trim($this->current_user_role ?? ''));
        if (!empty($role_norm) && !in_array($role_norm, ['admin', 'super_admin', 'superadmin'])) {
            return ["success" => false, "message" => "Access denied: Only administrators can create or launch new projects."];
        }

        // Auto generate code if not provided
        $project_code = !empty($data['project_code']) ? trim($data['project_code']) : $this->generateNextCode($data['project_type'] ?? null);
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
                    if (!empty($ph_id)) $this->assignTeam($project_id, $ph_id, 'project_head');
                }
            }

            // 3. Assign Site Engineers if provided
            if (isset($data['site_engineer_id']) && !empty($data['site_engineer_id'])) {
                $this->assignTeam($project_id, $data['site_engineer_id'], 'site_engineer');
            }
            if (isset($data['site_engineers']) && is_array($data['site_engineers'])) {
                foreach ($data['site_engineers'] as $se_id) {
                    if (!empty($se_id)) $this->assignTeam($project_id, $se_id, 'site_engineer');
                }
            }

            // 4. Assign Designers (D1 / D2) if provided
            if (isset($data['designer_id']) && !empty($data['designer_id'])) {
                $this->assignTeam($project_id, $data['designer_id'], 'designer');
            }
            if (isset($data['designers']) && is_array($data['designers'])) {
                foreach ($data['designers'] as $d_id) {
                    if (!empty($d_id)) $this->assignTeam($project_id, $d_id, 'designer');
                }
            }

            // 5. Assign Associate Designers (AD) if provided
            if (isset($data['associate_designer_id']) && !empty($data['associate_designer_id'])) {
                $this->assignTeam($project_id, $data['associate_designer_id'], 'associate_designer');
            }
            if (isset($data['associate_designers']) && is_array($data['associate_designers'])) {
                foreach ($data['associate_designers'] as $ad_id) {
                    if (!empty($ad_id)) $this->assignTeam($project_id, $ad_id, 'associate_designer');
                }
            }

            // 6. Assign QC Inspectors if provided
            if (isset($data['qc_id']) && !empty($data['qc_id'])) {
                $this->assignTeam($project_id, $data['qc_id'], 'qc');
            }
            if (isset($data['qc_inspectors']) && is_array($data['qc_inspectors'])) {
                foreach ($data['qc_inspectors'] as $qc_id) {
                    if (!empty($qc_id)) $this->assignTeam($project_id, $qc_id, 'qc');
                }
            }

            // Trigger Onboarding Emails for Designer & Client (mailer.pdf Pages 26 & 28)
            try {
                $this->sendOnboardingEmails($project_id, $data);
            } catch (Exception $ex) {
                error_log("Onboarding email error: " . $ex->getMessage());
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

            // 3. Re-assign Project Head(s)
            if (isset($data['project_head_id']) && !empty($data['project_head_id'])) {
                $this->assignTeam($project_id, $data['project_head_id'], 'project_head');
            }
            if (isset($data['project_heads']) && is_array($data['project_heads'])) {
                foreach ($data['project_heads'] as $ph_id) {
                    if (!empty($ph_id)) $this->assignTeam($project_id, $ph_id, 'project_head');
                }
            }

            // 4. Re-assign Site Engineer(s)
            if (isset($data['site_engineer_id']) && !empty($data['site_engineer_id'])) {
                $this->assignTeam($project_id, $data['site_engineer_id'], 'site_engineer');
            }
            if (isset($data['site_engineers']) && is_array($data['site_engineers'])) {
                foreach ($data['site_engineers'] as $se_id) {
                    if (!empty($se_id)) $this->assignTeam($project_id, $se_id, 'site_engineer');
                }
            }

            // 5. Re-assign Designers
            if (isset($data['designer_id']) && !empty($data['designer_id'])) {
                $this->assignTeam($project_id, $data['designer_id'], 'designer');
            }
            if (isset($data['designers']) && is_array($data['designers'])) {
                foreach ($data['designers'] as $d_id) {
                    if (!empty($d_id)) $this->assignTeam($project_id, $d_id, 'designer');
                }
            }

            // 6. Re-assign Associate Designer (AD)
            if (isset($data['associate_designer_id']) && !empty($data['associate_designer_id'])) {
                $this->assignTeam($project_id, $data['associate_designer_id'], 'associate_designer');
            }
            if (isset($data['associate_designers']) && is_array($data['associate_designers'])) {
                foreach ($data['associate_designers'] as $ad_id) {
                    if (!empty($ad_id)) $this->assignTeam($project_id, $ad_id, 'associate_designer');
                }
            }

            // 7. Re-assign QC Inspectors
            if (isset($data['qc_id']) && !empty($data['qc_id'])) {
                $this->assignTeam($project_id, $data['qc_id'], 'qc');
            }
            if (isset($data['qc_inspectors']) && is_array($data['qc_inspectors'])) {
                foreach ($data['qc_inspectors'] as $qc_id) {
                    if (!empty($qc_id)) $this->assignTeam($project_id, $qc_id, 'qc');
                }
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
        if (empty($project_id) || empty($user_id)) return false;
        // Avoid duplicate active assignment of same user with same role
        $chk = $this->conn->prepare("SELECT assignment_id FROM project_assignments WHERE project_id = :p_id AND user_id = :u_id AND role = :role AND status = 'active' LIMIT 1");
        $chk->execute([':p_id' => $project_id, ':u_id' => $user_id, ':role' => $role]);
        if ($chk->fetch()) {
            return true;
        }

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
        $status_norm = strtolower(trim($status));
        if (in_array($status_norm, ['completed', 'closed', 'handover', 'handover proposal sent'])) {
            // Strict Milestone Check: Project cannot be closed or handed over without full 100% payment (Stage 5 milestone)
            $p_stmt = $this->conn->prepare("SELECT total_budget, initial_quote_amount, status, project_code FROM " . $this->table_name . " WHERE project_id = :id LIMIT 1");
            $p_stmt->execute([':id' => $project_id]);
            $p_row = $p_stmt->fetch(PDO::FETCH_ASSOC);
            $total_budget = floatval($p_row['total_budget'] ?? 0);

            // Check if latest quote has contract total (ONLY if officially QC approved or Signed)
            try {
                $q_stmt = $this->conn->prepare("SELECT total_amount, version, status, is_qc_approved, is_initial FROM quotes WHERE (project_id = :pid OR project_id = :pcode) AND (is_qc_approved = 1 OR status = 'Signed' OR status = 'qc_approved') ORDER BY is_qc_approved DESC, version DESC, quote_id DESC LIMIT 1");
                $q_stmt->execute([':pid' => $project_id, ':pcode' => $p_row['project_code'] ?? '']);
                $q_row = $q_stmt->fetch(PDO::FETCH_ASSOC);
                if ($q_row && floatval($q_row['total_amount'] ?? 0) > 0) {
                    $total_budget = floatval($q_row['total_amount']);
                }
            } catch (\Exception $e) {}

            if ($total_budget <= 0) {
                $total_budget = floatval($p_row['initial_quote_amount'] ?? 0);
            }

            $ft_stmt = $this->conn->prepare("SELECT COALESCE(SUM(amount), 0) as total_paid FROM finance_transactions WHERE project_id = :id AND type = 'credit'");
            $ft_stmt->execute([':id' => $project_id]);
            $ft_row = $ft_stmt->fetch(PDO::FETCH_ASSOC);
            $total_paid = floatval($ft_row['total_paid'] ?? 0);

            if ($total_budget > 0 && $total_paid < ($total_budget * 0.995)) {
                return [
                    "success" => false, 
                    "message" => "Strict Milestone Gate: Project cannot be closed or handed over without full 100% payment (Stage 5 milestone). Paid: ₹" . number_format($total_paid, 2) . " of ₹" . number_format($total_budget, 2)
                ];
            }
        }

        $query = "UPDATE " . $this->table_name . " SET status = :status WHERE project_id = :id";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':status', $status);
        $stmt->bindParam(':id', $project_id);
        if ($stmt->execute()) {
            return ["success" => true, "message" => "Project status updated."];
        }
        return ["success" => false, "message" => "Failed to update project status."];
    }

    public function updateStage($project_id, $stage)
    {
        $stage_norm = strtolower(trim($stage));
        $needs_95 = in_array($stage_norm, ['ready_to_dispatch', 'ready to dispatch', 'dispatch', 'in_transit', 'in transit', 'delivery', 'installation']);
        $needs_100 = in_array($stage_norm, ['handover', 'handover_completed', 'handover_sent']);

        if ($needs_95 || $needs_100) {
            $p_stmt = $this->conn->prepare("SELECT total_budget, initial_quote_amount, project_code FROM " . $this->table_name . " WHERE project_id = :id LIMIT 1");
            $p_stmt->execute([':id' => $project_id]);
            $p_row = $p_stmt->fetch(PDO::FETCH_ASSOC);
            $total_budget = floatval($p_row['total_budget'] ?? 0);

            // Check if latest quote has contract total (ONLY if officially QC approved or Signed)
            try {
                $q_stmt = $this->conn->prepare("SELECT total_amount, version, status, is_qc_approved, is_initial FROM quotes WHERE (project_id = :pid OR project_id = :pcode) AND (is_qc_approved = 1 OR status = 'Signed' OR status = 'qc_approved') ORDER BY is_qc_approved DESC, version DESC, quote_id DESC LIMIT 1");
                $q_stmt->execute([':pid' => $project_id, ':pcode' => $p_row['project_code'] ?? '']);
                $q_row = $q_stmt->fetch(PDO::FETCH_ASSOC);
                if ($q_row && floatval($q_row['total_amount'] ?? 0) > 0) {
                    $total_budget = floatval($q_row['total_amount']);
                }
            } catch (\Exception $e) {}

            if ($total_budget <= 0) {
                $total_budget = floatval($p_row['initial_quote_amount'] ?? 0);
            }

            $ft_stmt = $this->conn->prepare("SELECT COALESCE(SUM(amount), 0) as total_paid FROM finance_transactions WHERE project_id = :id AND type = 'credit'");
            $ft_stmt->execute([':id' => $project_id]);
            $ft_row = $ft_stmt->fetch(PDO::FETCH_ASSOC);
            $total_paid = floatval($ft_row['total_paid'] ?? 0);

            if ($needs_100 && $total_budget > 0 && $total_paid < ($total_budget * 0.995)) {
                return [
                    "success" => false,
                    "message" => "Strict Milestone Gate: Cannot advance to Handover without full 100% payment (Stage 5 milestone). Paid: ₹" . number_format($total_paid, 2) . " of ₹" . number_format($total_budget, 2)
                ];
            }
            if ($needs_95 && $total_budget > 0 && $total_paid < ($total_budget * 0.945)) {
                return [
                    "success" => false,
                    "message" => "Strict Milestone Gate: Cannot advance to Ready to Dispatch / Material Dispatch without 95% cumulative payment (Stage 4 milestone). Paid: ₹" . number_format($total_paid, 2) . " of ₹" . number_format($total_budget, 2)
                ];
            }
        }

        $query = "UPDATE " . $this->table_name . " SET project_stage = :stage WHERE project_id = :id";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':stage', $stage);
        $stmt->bindParam(':id', $project_id);
        if ($stmt->execute()) {
            // Trigger production/delivery status emails
            try {
                $stageEmailMap = [
                    'production_started' => 'production_start',
                    'ready_to_dispatch'  => 'ready_to_dispatch',
                    'delivered'          => 'delivered',
                    'handover_sent'      => 'handover_sent',
                    'handover_completed' => 'handover_completed',
                ];

                if (isset($stageEmailMap[$stage])) {
                    $projStmt = $this->conn->prepare(
                        "SELECT p.*, c.name as client_name, c.email as client_email, c.phone as client_phone
                         FROM projects p
                         LEFT JOIN clients c ON p.client_id = c.client_id
                         WHERE p.project_id = :pid LIMIT 1"
                    );
                    $projStmt->execute([':pid' => $project_id]);
                    $proj = $projStmt->fetch(PDO::FETCH_ASSOC);

                    if ($proj) {
                        MailHelper::sendProductionStatusNotification($this->conn, $stageEmailMap[$stage], [
                            'project_id'   => $proj['project_code'] ?? $project_id,
                            'project_name' => $proj['project_name'] ?? 'Project',
                            'customer_name'=> $proj['client_name'] ?? 'Valued Client',
                            'client_email' => $proj['client_email'] ?? null,
                            'date'         => date('d M Y'),
                        ]);
                    }
                }
            } catch (Exception $ex) {
                error_log("updateStage mail error: " . $ex->getMessage());
            }

            return ["success" => true, "message" => "Project stage updated."];
        }
        return ["success" => false, "message" => "Failed to update project stage."];
    }

    public function updateStage5State($project_id, $state)
    {
        try {
            $this->conn->exec("ALTER TABLE projects ADD COLUMN IF NOT EXISTS stage5_state LONGTEXT DEFAULT NULL");
        } catch (Exception $e) {}

        $json = is_string($state) ? $state : json_encode($state);
        $query = "UPDATE " . $this->table_name . " SET stage5_state = :state WHERE project_id = :id";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':state', $json);
        $stmt->bindParam(':id', $project_id);
        if ($stmt->execute()) {
            return ["success" => true, "message" => "Stage 5 state updated."];
        }
        return ["success" => false, "message" => "Failed to update Stage 5 state."];
    }

    public function updateClientSignature($project_id, $signature, $lead_id = null)
    {
        try {
            $this->conn->exec("ALTER TABLE projects ADD COLUMN IF NOT EXISTS client_signature LONGTEXT DEFAULT NULL");
            $this->conn->exec("ALTER TABLE leads ADD COLUMN IF NOT EXISTS client_signature LONGTEXT DEFAULT NULL");
            $this->conn->exec("ALTER TABLE agreements ADD COLUMN IF NOT EXISTS client_signature LONGTEXT DEFAULT NULL");
            $this->conn->exec("ALTER TABLE quotes ADD COLUMN IF NOT EXISTS client_signature LONGTEXT DEFAULT NULL");
        } catch (Exception $e) {}

        $updated = false;

        // 1. Update projects table
        if (!empty($project_id)) {
            $stmt = $this->conn->prepare("UPDATE projects SET client_signature = :sig WHERE project_id = :id OR project_code = :pcode");
            $stmt->execute([':sig' => $signature, ':id' => $project_id, ':pcode' => $project_id]);
            if ($stmt->rowCount() > 0) $updated = true;

            // Also find associated client/lead
            try {
                $cStmt = $this->conn->prepare("SELECT c.converted_from_lead_id FROM projects p JOIN clients c ON p.client_id = c.client_id WHERE p.project_id = :pid LIMIT 1");
                $cStmt->execute([':pid' => $project_id]);
                $cLeadId = $cStmt->fetchColumn();
                if ($cLeadId) $lead_id = $cLeadId;
            } catch (Exception $e) {}
        }

        // 2. Update leads table if lead_id or matching project_id
        $target_lead = $lead_id ?? $project_id;
        if (!empty($target_lead)) {
            try {
                $lStmt = $this->conn->prepare("UPDATE leads SET client_signature = :sig WHERE lead_id = :lid OR manual_client_id = :mid");
                $lStmt->execute([':sig' => $signature, ':lid' => $target_lead, ':mid' => $target_lead]);
                if ($lStmt->rowCount() > 0) $updated = true;
            } catch (Exception $e) {}
        }

        // 3. Update agreements table if exists for project or ref_id
        if (!empty($project_id)) {
            try {
                $aStmt = $this->conn->prepare("UPDATE agreements SET client_signature = :sig WHERE project_id = :pid OR ref_id = :ref OR id = :pid");
                $aStmt->execute([':sig' => $signature, ':pid' => $project_id, ':ref' => $project_id]);
                if ($aStmt->rowCount() > 0) $updated = true;
            } catch (Exception $e) {}

            try {
                $qStmt = $this->conn->prepare("UPDATE quotes SET client_signature = :sig WHERE project_id = :pid");
                $qStmt->execute([':sig' => $signature, ':pid' => $project_id]);
                if ($qStmt->rowCount() > 0) $updated = true;
            } catch (Exception $e) {}
        }

        return ["success" => true, "message" => "Client signature saved successfully.", "signature" => $signature];
    }

    public function resolveDesignerAssignedProjectIds($user_id, $role = null)
    {
        if (empty($user_id)) return null;

        if (empty($role)) {
            try {
                $uStmt = $this->conn->prepare("SELECT role FROM users WHERE user_id = :uid");
                $uStmt->execute([':uid' => $user_id]);
                $role = $uStmt->fetchColumn();
            } catch (Exception $e) {}
        }

        $r = strtolower(trim(strval($role ?? '')));
        $isDesigner = in_array($r, ['d1', 'd2', 'designer', 'lead_designer', 'associate_designer', 'ad', 'graphic_designer', 'gd']);
        $isAdmin = in_array($r, ['admin', 'superadmin', 'administrator', 'manager', 'sales_manager', 'general_manager', 'accountant', 'owner']);
        if (!$isDesigner || $isAdmin) {
            return null; // Not restricted: Admins and non-designers
        }

        $allowedProjectIds = [];

        // 1. Check project_assignments
        try {
            $paStmt = $this->conn->prepare("SELECT project_id FROM project_assignments WHERE user_id = :uid AND status = 'active'");
            $paStmt->execute([':uid' => $user_id]);
            while ($pid = $paStmt->fetchColumn()) {
                if ($pid) $allowedProjectIds[strval($pid)] = true;
            }
        } catch (Exception $e) {}

        // 2. Check projects table where designer_id = uid or created_by = uid
        try {
            $pStmt = $this->conn->prepare("SELECT project_id, project_code FROM projects WHERE (created_by = :uid)");
            $pStmt->execute([':uid' => $user_id]);
            while ($row = $pStmt->fetch(PDO::FETCH_ASSOC)) {
                if (!empty($row['project_id'])) $allowedProjectIds[strval($row['project_id'])] = true;
                if (!empty($row['project_code'])) $allowedProjectIds[strtolower(trim($row['project_code']))] = true;
            }
        } catch (Exception $e) {}

        // 3. Check leads table where d1_assigned_to = uid or associate_designer_assigned_id = uid or assigned_to = uid
        try {
            $ldStmt = $this->conn->prepare("SELECT lead_id, manual_client_id FROM leads 
                                            WHERE d1_assigned_to = :uid 
                                               OR FIND_IN_SET(:uid, d1_assigned_to) 
                                               OR associate_designer_assigned_id = :uid 
                                               OR FIND_IN_SET(:uid, associate_designer_assigned_id) 
                                               OR assigned_to = :uid");
            $ldStmt->execute([':uid' => $user_id]);
            while ($row = $ldStmt->fetch(PDO::FETCH_ASSOC)) {
                $lid = strval($row['lead_id']);
                $allowedProjectIds[$lid] = true;
                if (!empty($row['manual_client_id'])) {
                    $mc = strtolower(trim($row['manual_client_id']));
                    $allowedProjectIds[$mc] = true;
                }

                // Also find if a project exists for this lead
                $lpStmt = $this->conn->prepare("SELECT p.project_id FROM projects p 
                                                LEFT JOIN clients c ON p.client_id = c.client_id 
                                                WHERE c.converted_from_lead_id = :lid OR p.project_code = :mc OR p.project_id = :lid");
                $lpStmt->execute([':lid' => $lid, ':mc' => $row['manual_client_id'] ?? '']);
                while ($p_id = $lpStmt->fetchColumn()) {
                    if ($p_id) $allowedProjectIds[strval($p_id)] = true;
                }
            }
        } catch (Exception $e) {}

        return $allowedProjectIds;
    }

    public function getAll($user_id = null, $role = null)
    {
        $eff_uid = $user_id ?? $this->current_user_id;
        $eff_role = $role ?? $this->current_user_role;

        $allowedIds = $this->resolveDesignerAssignedProjectIds($eff_uid, $eff_role);

        $query = "SELECT DISTINCT p.*, c.name as client_name, c.email as client_email, c.phone as client_phone, u.name as project_head_name,
                         l.is_converted as lead_is_converted, l.status as lead_status, l.advance_paid as lead_advance_paid
                  FROM " . $this->table_name . " p
                  LEFT JOIN clients c ON p.client_id = c.client_id
                  LEFT JOIN users u ON p.project_head_id = u.user_id
                  LEFT JOIN leads l ON (c.converted_from_lead_id = l.lead_id OR p.project_id = l.lead_id OR p.project_code = l.manual_client_id)
                  WHERE LOWER(COALESCE(p.status, '')) NOT IN ('quotation', 'draft quotation', 'draft', 'proposal_accepted', 'proposal_sent', 'in_meeting', 'meeting_completed', 'cancelled', 'lost', 'lead', 'pending')
                    AND (
                        -- Pure projects created directly (not from a lead)
                        (l.lead_id IS NULL AND c.converted_from_lead_id IS NULL)
                        -- OR lead-derived projects that are officially converted with Stage 1 payment satisfied
                        OR (
                            COALESCE(l.is_converted, 0) = 1
                            AND (
                                COALESCE(p.advance_received, 0) > 0 
                                OR COALESCE(l.advance_paid, 0) > 0
                                OR LOWER(COALESCE(p.status, '')) IN ('designing phase', 'execution', 'site in progress', 'completed', 'won')
                            )
                        )
                    )
                  ORDER BY p.created_at DESC";

        $stmt = $this->conn->prepare($query);
        $stmt->execute();
        $projects = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Fetch team assignments for each project and enforce strict budget immutability
        foreach ($projects as &$project) {
            $project['team'] = $this->getTeamMembers($project['project_id']);
            $isQcApp = intval($project['is_final_quote_approved'] ?? 0) === 1 || ($project['status'] ?? '') === 'qc_approved';
            $initB = floatval($project['initial_quote_amount'] ?? 0);
            if (!$isQcApp && $initB > 0) {
                $project['total_budget'] = $initB;
            }
        }

        // Strict filter for designers: ONLY projects assigned to them
        if ($allowedIds !== null) {
            $projects = array_values(array_filter($projects, function($p) use ($allowedIds, $eff_uid) {
                $pid = strval($p['project_id'] ?? '');
                $pcode = strtolower(trim(strval($p['project_code'] ?? '')));
                
                if ($pid !== '' && isset($allowedIds[$pid])) return true;
                if ($pcode !== '' && isset($allowedIds[$pcode])) return true;

                // Also check team array
                if (!empty($p['team']) && is_array($p['team'])) {
                    foreach ($p['team'] as $tm) {
                        if (strval($tm['user_id'] ?? '') === strval($eff_uid)) {
                            return true;
                        }
                    }
                }

                return false;
            }));
        }

        return $projects;
    }

    public function getDetailedStats($project_id, $user_id = null, $role = null)
    {
        $eff_uid = $user_id ?? $this->current_user_id;
        $eff_role = $role ?? $this->current_user_role;
        $allowedIds = $this->resolveDesignerAssignedProjectIds($eff_uid, $eff_role);

        if ($allowedIds !== null) {
            $pid = strval($project_id);
            if (!isset($allowedIds[$pid])) {
                $chkStmt = $this->conn->prepare("SELECT project_code FROM projects WHERE project_id = :id");
                $chkStmt->execute([':id' => $project_id]);
                $pcode = strtolower(trim(strval($chkStmt->fetchColumn() ?: '')));
                if ($pcode === '' || !isset($allowedIds[$pcode])) {
                    return null; // Access denied / Not assigned to this designer
                }
            }
        }

        // 1. Basic Project Info
        $p_query = "SELECT p.*, c.name as client_name, c.phone as client_phone, c.address as client_address, c.email as client_email, u.name as project_head_name 
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
        // Paid Amount - resolve all linked identifiers (project_id, converted_from_lead_id, project_code, and description match)
        $lead_id = null;
        $proj_code = $project['project_code'] ?? '';
        if (!empty($project['client_id'])) {
            $c_stmt = $this->conn->prepare("SELECT converted_from_lead_id FROM clients WHERE client_id = :cid LIMIT 1");
            $c_stmt->execute([':cid' => $project['client_id']]);
            $lead_id = $c_stmt->fetchColumn();
        }

        $id_list = array_unique(array_filter([$project_id, $lead_id, $proj_code]));
        $id_clauses = [];
        $pay_params = [];
        foreach (array_values($id_list) as $idx => $val) {
            $key = ":pid_" . $idx;
            $id_clauses[] = "project_id = $key";
            $pay_params[$key] = $val;
        }
        if ($proj_code && strlen($proj_code) >= 3) {
            $id_clauses[] = "description LIKE :pcode_match";
            $pay_params[':pcode_match'] = "%" . $proj_code . "%";
        }
        $where_clause = !empty($id_clauses) ? "(" . implode(" OR ", $id_clauses) . ")" : "project_id = :id";
        if (empty($id_clauses)) {
            $pay_params[':id'] = $project_id;
        }

        $pay_query = "SELECT COALESCE(SUM(amount), 0) as total_paid FROM finance_transactions WHERE type = 'credit' AND $where_clause";
        $pay_stmt = $this->conn->prepare($pay_query);
        $pay_stmt->execute($pay_params);
        $total_paid = floatval($pay_stmt->fetch(PDO::FETCH_ASSOC)['total_paid'] ?? 0);
        
        // Fallback to advance_received if greater than transactions
        $adv_val = floatval($project['advance_received'] ?? 0);
        if ($adv_val > $total_paid) {
            $total_paid = $adv_val;
        }

        // Inventory Spent
        $inv_query = "SELECT SUM(total_amount) as total_spent FROM inventory WHERE project_id = :id";
        $inv_stmt = $this->conn->prepare($inv_query);
        $inv_stmt->execute(['id' => $project_id]);
        $total_spent = $inv_stmt->fetch(PDO::FETCH_ASSOC)['total_spent'] ?? 0;

        // Resolve initial quote amount (fixed contract quotation accepted at project start)
        $initialQuoteAmt = floatval($project['initial_quote_amount'] ?? 0);
        if ($initialQuoteAmt <= 0) {
            try {
                $q_init = $this->conn->prepare("SELECT total_amount FROM quotes WHERE (project_id = :pid OR project_id = :pcode) AND (is_initial = 1 OR version = 1 OR extra_data LIKE '%\"is_initial_quote\":true%') ORDER BY (CASE WHEN is_initial = 1 THEN 1 ELSE 0 END) DESC, version ASC, quote_id ASC LIMIT 1");
                $q_init->execute([':pid' => $project_id, ':pcode' => $project['project_code'] ?? '']);
                $init_row = $q_init->fetch(PDO::FETCH_ASSOC);
                if ($init_row && floatval($init_row['total_amount'] ?? 0) > 0) {
                    $initialQuoteAmt = floatval($init_row['total_amount']);
                    try {
                        $this->conn->prepare("UPDATE projects SET initial_quote_amount = :iamt WHERE project_id = :pid AND (initial_quote_amount IS NULL OR initial_quote_amount = 0)")->execute([':iamt' => $initialQuoteAmt, ':pid' => $project_id]);
                    } catch (\Exception $e) {}
                }
            } catch (\Exception $e) {}
        }
        if ($initialQuoteAmt <= 0) {
            $initialQuoteAmt = floatval($project['total_budget'] ?? 0);
        }

        // Check if there is an officially QC-approved quotation version
        $isQcFinalApproved = false;
        $approvedQuoteAmt = 0;
        try {
            $q_app_stmt = $this->conn->prepare("SELECT quote_id, total_amount, version, status, is_qc_approved FROM quotes WHERE (project_id = :pid OR project_id = :pcode) AND (is_qc_approved = 1 OR status = 'qc_approved') ORDER BY version DESC, quote_id DESC LIMIT 1");
            $q_app_stmt->execute([':pid' => $project_id, ':pcode' => $project['project_code'] ?? '']);
            $app_quote = $q_app_stmt->fetch(PDO::FETCH_ASSOC);
            if ($app_quote && floatval($app_quote['total_amount'] ?? 0) > 0) {
                $approvedQuoteAmt = floatval($app_quote['total_amount']);
                $isQcFinalApproved = true;
            }
        } catch (\Exception $e) {}

        // STRICT IMMUTABILITY RULE:
        // Until QC officially approves the final stage of a new quotation version,
        // the project budget MUST strictly remain the fixed initial accepted quotation amount!
        if ($isQcFinalApproved && $approvedQuoteAmt > 0) {
            $effectiveBudget = $approvedQuoteAmt;
        } else {
            $isQcFinalApproved = false;
            $effectiveBudget = $initialQuoteAmt > 0 ? $initialQuoteAmt : floatval($project['total_budget'] ?? 0);
        }

        $project['total_budget'] = $effectiveBudget;
        $project['approved_quote_amount'] = $effectiveBudget;
        $project['initial_quote_amount'] = $initialQuoteAmt > 0 ? $initialQuoteAmt : $effectiveBudget;
        $project['is_final_quote_approved'] = $isQcFinalApproved ? 1 : 0;

        // Auto-sync in projects table if different
        try {
            $up_b = $this->conn->prepare("UPDATE projects SET total_budget = :tb, initial_quote_amount = COALESCE(initial_quote_amount, :iamt), is_final_quote_approved = :is_app WHERE project_id = :pid AND (total_budget != :tb2 OR is_final_quote_approved != :is_app2 OR total_budget IS NULL)");
            $up_b->execute([':tb' => $effectiveBudget, ':iamt' => $initialQuoteAmt, ':is_app' => $isQcFinalApproved ? 1 : 0, ':pid' => $project_id, ':tb2' => $effectiveBudget, ':is_app2' => $isQcFinalApproved ? 1 : 0]);
        } catch (\Exception $e) {}

        // Also fetch latest quotation amount (e.g. revision being edited by designer)
        $latestQuoteAmt = $effectiveBudget;
        try {
            $q_lat = $this->conn->prepare("SELECT quote_id, total_amount, version, status, is_qc_approved FROM quotes WHERE (project_id = :pid OR project_id = :pcode) ORDER BY version DESC, quote_id DESC LIMIT 1");
            $q_lat->execute([':pid' => $project_id, ':pcode' => $project['project_code'] ?? '']);
            $lat_quote = $q_lat->fetch(PDO::FETCH_ASSOC);
            if ($lat_quote && floatval($lat_quote['total_amount'] ?? 0) > 0) {
                $latestQuoteAmt = floatval($lat_quote['total_amount']);
                $project['latest_quote_id'] = $lat_quote['quote_id'];
                $project['latest_quote_version'] = $lat_quote['version'];
                $project['latest_quote_status'] = $lat_quote['status'];
            }
        } catch (\Exception $e) {}
        $project['latest_quote_amount'] = $latestQuoteAmt;
        $project['has_pending_quote_revision'] = (abs($latestQuoteAmt - $effectiveBudget) > 0.01);

        $project['total_paid'] = $total_paid;
        $project['total_spent'] = $total_spent;
        $project['remaining_balance'] = max(0, floatval($project['total_budget']) - $total_paid);

        // Fetch associated lead details for mmts_status & qc_status sync
        try {
            $l_fetch = $this->conn->prepare("SELECT lead_id, mmts_status, mmts_booking_time, qc_status, qc_booking_time, site_manager_booking_time, d1_booking_time, mmt_assigned_name, site_inspector_assigned_name, associate_designer_assigned_name, pm_assigned_name, status as lead_status, client_signature FROM leads WHERE lead_id = :p_id OR lead_id = (SELECT converted_from_lead_id FROM clients WHERE client_id = :c_id LIMIT 1) LIMIT 1");
            $l_fetch->execute([':p_id' => $project_id, ':c_id' => $project['client_id'] ?? 0]);
            $lead_data = $l_fetch->fetch(PDO::FETCH_ASSOC);
            if ($lead_data) {
                if (empty($project['mmts_status']) || $project['mmts_status'] === 'Not Booked') {
                    $project['mmts_status'] = $lead_data['mmts_status'] ?? $project['mmts_status'] ?? null;
                }
                if (empty($project['mmts_booking_time'])) {
                    $project['mmts_booking_time'] = $lead_data['mmts_booking_time'] ?? null;
                }
                if (empty($project['qc_status'])) {
                    $project['qc_status'] = $lead_data['qc_status'] ?? $lead_data['lead_status'] ?? null;
                }
                if (empty($project['qc_booking_time'])) {
                    $project['qc_booking_time'] = $lead_data['qc_booking_time'] ?? $lead_data['site_manager_booking_time'] ?? null;
                }
                if (empty($project['client_signature']) && !empty($lead_data['client_signature'])) {
                    $project['client_signature'] = $lead_data['client_signature'];
                }
                $project['lead_info'] = $lead_data;
                $project['converted_from_lead_id'] = $lead_data['lead_id'];
                $project['lead_id'] = $lead_data['lead_id'];
            }
        } catch (Exception $e) {}

        if (empty($project['client_signature'])) {
            try {
                $a_fetch = $this->conn->prepare("SELECT client_signature FROM agreements WHERE (project_id = :p_id OR ref_id = :pcode) AND client_signature IS NOT NULL AND client_signature != '' LIMIT 1");
                $a_fetch->execute([':p_id' => $project_id, ':pcode' => $project['project_code'] ?? '']);
                $a_sig = $a_fetch->fetchColumn();
                if ($a_sig) $project['client_signature'] = $a_sig;
            } catch (Exception $e) {}
        }

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
        $members = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $existingUserRoles = [];
        foreach ($members as $m) {
            $existingUserRoles[$m['user_id'] . '_' . ($m['assignment_role'] ?? $m['role'])] = true;
        }

        // Also resolve project_head_id from projects table if not already assigned
        try {
            $pHeadStmt = $this->conn->prepare("SELECT project_head_id, created_by FROM projects WHERE project_id = :p_id LIMIT 1");
            $pHeadStmt->execute([':p_id' => $project_id]);
            $pHeadRow = $pHeadStmt->fetch(PDO::FETCH_ASSOC);
            if ($pHeadRow && !empty($pHeadRow['project_head_id'])) {
                $phKey = $pHeadRow['project_head_id'] . '_project_head';
                if (!isset($existingUserRoles[$phKey])) {
                    $uStmt = $this->conn->prepare("SELECT user_id, name, role, phone FROM users WHERE user_id = :uid LIMIT 1");
                    $uStmt->execute([':uid' => $pHeadRow['project_head_id']]);
                    $uRow = $uStmt->fetch(PDO::FETCH_ASSOC);
                    if ($uRow) {
                        $uRow['assignment_role'] = 'project_head';
                        $members[] = $uRow;
                        $existingUserRoles[$phKey] = true;
                    }
                }
            }
        } catch (Exception $ex) {}

        // Also resolve associated lead to pick up MMTS, QC Inspector, PM, Designer, and Sales personnel assigned on lead
        try {
            $lStmt = $this->conn->prepare("
                SELECT l.d1_assigned_to, l.site_manager_assigned_to, l.mmt_assigned_id, l.site_inspector_assigned_id, l.pm_assigned_id, l.associate_designer_assigned_id, l.assigned_to, l.created_by
                FROM leads l
                WHERE l.lead_id = :p_id 
                   OR l.lead_id = (SELECT c.converted_from_lead_id FROM clients c JOIN projects p ON p.client_id = c.client_id WHERE p.project_id = :p_id LIMIT 1)
                   OR l.manual_client_id = (SELECT project_code FROM projects WHERE project_id = :p_id LIMIT 1)
                LIMIT 1
            ");
            $lStmt->execute([':p_id' => $project_id]);
            $lead = $lStmt->fetch(PDO::FETCH_ASSOC);

            if ($lead) {
                $roleIdMaps = [
                    'designer' => array_filter(array_map('trim', explode(',', $lead['d1_assigned_to'] ?? ''))),
                    'site_inspector' => array_merge(
                        array_filter(array_map('trim', explode(',', $lead['site_inspector_assigned_id'] ?? ''))),
                        array_filter(array_map('trim', explode(',', $lead['site_manager_assigned_to'] ?? '')))
                    ),
                    'pm' => array_filter(array_map('trim', explode(',', $lead['pm_assigned_id'] ?? ''))),
                    'mmt' => array_filter(array_map('trim', explode(',', $lead['mmt_assigned_id'] ?? ''))),
                    'associate_designer' => array_filter(array_map('trim', explode(',', $lead['associate_designer_assigned_id'] ?? ''))),
                    'sales' => array_filter(array_map('trim', explode(',', ($lead['assigned_to'] ?? '') . ',' . ($lead['created_by'] ?? '')))),
                ];

                foreach ($roleIdMaps as $assignedRole => $userArray) {
                    foreach ($userArray as $uId) {
                        if (empty($uId) || !is_numeric($uId)) continue;
                        $key = $uId . '_' . $assignedRole;
                        if (!isset($existingUserRoles[$key])) {
                            $uStmt = $this->conn->prepare("SELECT user_id, name, role, phone FROM users WHERE user_id = :uid LIMIT 1");
                            $uStmt->execute([':uid' => $uId]);
                            $uRow = $uStmt->fetch(PDO::FETCH_ASSOC);
                            if ($uRow) {
                                $uRow['assignment_role'] = $assignedRole;
                                $members[] = $uRow;
                                $existingUserRoles[$key] = true;
                            }
                        }
                    }
                }
            }
        } catch (Exception $ex) {}

        return $members;
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
                        p.initial_quote_amount,
                        p.is_final_quote_approved,
                        p.project_type,
                        p.client_id,
                        p.status,
                        p.created_at,
                        p.start_date,
                        p.expected_end_date,
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
                          WHERE type = 'debit' AND (payment_mode IS NULL OR payment_mode != 'Unpaid')
                          GROUP BY project_id
                      ) ft_debit ON p.project_id = ft_debit.project_id
                      LEFT JOIN (
                          SELECT project_id, SUM(total) as total_inv 
                          FROM project_inventory 
                          GROUP BY project_id
                      ) inv ON p.project_id = inv.project_id
                      WHERE LOWER(COALESCE(p.status, '')) NOT IN ('quotation', 'draft quotation', 'draft')
                      ORDER BY p.created_at DESC";

            $stmt = $this->conn->prepare($query);
            $stmt->execute();
            $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Exception $e) {
            $query = "SELECT 
                        p.project_id, 
                        p.project_name, 
                        p.total_budget,
                        p.initial_quote_amount,
                        p.is_final_quote_approved,
                        p.project_type,
                        p.client_id,
                        p.status,
                        p.created_at,
                        p.start_date,
                        p.expected_end_date,
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
                          WHERE type = 'debit' AND (payment_mode IS NULL OR payment_mode != 'Unpaid')
                          GROUP BY project_id
                      ) ft_debit ON p.project_id = ft_debit.project_id
                      WHERE LOWER(COALESCE(p.status, '')) NOT IN ('quotation', 'draft quotation', 'draft')
                      ORDER BY p.created_at DESC";

            $stmt = $this->conn->prepare($query);
            $stmt->execute();
            $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
        }

        $data = [];
        foreach ($results as $row) {
            $isQcApproved = intval($row['is_final_quote_approved'] ?? 0) === 1 || ($row['status'] ?? '') === 'qc_approved';
            $initBudget = floatval($row['initial_quote_amount'] ?? 0);
            if ($initBudget <= 0) {
                try {
                    $q_init = $this->conn->prepare("SELECT total_amount FROM quotes WHERE (project_id = :pid OR project_id = :pcode) AND (is_initial = 1 OR version = 1 OR extra_data LIKE '%\"is_initial_quote\":true%') ORDER BY (CASE WHEN is_initial = 1 THEN 1 ELSE 0 END) DESC, version ASC, quote_id ASC LIMIT 1");
                    $q_init->execute([':pid' => $row['project_id'], ':pcode' => $row['project_code'] ?? '']);
                    $q_amt = floatval($q_init->fetchColumn() ?: 0);
                    if ($q_amt > 0) {
                        $initBudget = $q_amt;
                        try {
                            $this->conn->prepare("UPDATE projects SET initial_quote_amount = :amt WHERE project_id = :pid AND (initial_quote_amount IS NULL OR initial_quote_amount = 0)")->execute([':amt' => $initBudget, ':pid' => $row['project_id']]);
                        } catch (\Exception $e) {}
                    }
                } catch (\Exception $e) {}
            }
            if ($initBudget <= 0) {
                $initBudget = floatval($row['total_budget'] ?? 0);
            }

            // Verify if an explicit QC approved quote exists
            $approvedAmt = 0;
            if ($isQcApproved) {
                try {
                    $q_app = $this->conn->prepare("SELECT total_amount FROM quotes WHERE (project_id = :pid OR project_id = :pcode) AND (is_qc_approved = 1 OR status = 'qc_approved') ORDER BY version DESC, quote_id DESC LIMIT 1");
                    $q_app->execute([':pid' => $row['project_id'], ':pcode' => $row['project_code'] ?? '']);
                    $approvedAmt = floatval($q_app->fetchColumn() ?: 0);
                } catch (\Exception $e) {}
            }

            // STRICT IMMUTABILITY RULE:
            // Total budget is strictly fixed to the initial quotation until QC officially approves the final revision!
            $budget = ($isQcApproved && $approvedAmt > 0) ? $approvedAmt : ($initBudget > 0 ? $initBudget : floatval($row['total_budget'] ?? 0));
            $advance = floatval($row['total_paid']);
            $spent = floatval($row['total_debit']) + floatval($row['total_inventory']);
            $profit = $budget - $spent;

            $data[] = [
                'project_id' => $row['project_id'],
                'project_name' => $row['project_name'],
                'total_budget' => $budget,
                'initial_quote_amount' => $initBudget,
                'is_final_quote_approved' => intval($row['is_final_quote_approved'] ?? 0),
                'advance_paid' => $advance,
                'total_spent' => $spent,
                'profit' => $profit,
                'project_type' => $row['project_type'],
                'status' => $row['status'] ?? '',
                'created_at' => $row['created_at'],
                'start_date' => $row['start_date'],
                'expected_end_date' => $row['expected_end_date']
            ];
        }

        return ["success" => true, "data" => $data];
    }

    private function sendOnboardingEmails($project_id, $data)
    {
        try {
            require_once __DIR__ . '/../libs/PHPMailer/src/Exception.php';
            require_once __DIR__ . '/../libs/PHPMailer/src/PHPMailer.php';
            require_once __DIR__ . '/../libs/PHPMailer/src/SMTP.php';

            $onboarding_date = date('d M Y');
            $customer_name = $data['client_name'] ?? 'Customer';
            $project_name = $data['project_name'] ?? ('Project #' . $project_id);
            $project_manager_name = 'Project Manager';

            if (!empty($data['project_head_id'])) {
                $headStmt = $this->conn->prepare("SELECT name FROM users WHERE user_id = :uid");
                $headStmt->execute(['uid' => $data['project_head_id']]);
                $head = $headStmt->fetch(PDO::FETCH_ASSOC);
                if ($head && !empty($head['name'])) {
                    $project_manager_name = $head['name'];
                }
            }

            // 1. Designer Email (mailer.pdf Page 26)
            $designer_email = null;
            $designer_name = 'Designer';
            if (!empty($data['lead_id'])) {
                $leadStmt = $this->conn->prepare("SELECT d1_assigned_to FROM leads WHERE lead_id = :lid");
                $leadStmt->execute(['lid' => $data['lead_id']]);
                $leadInfo = $leadStmt->fetch(PDO::FETCH_ASSOC);
                if (!empty($leadInfo['d1_assigned_to'])) {
                    $uStmt = $this->conn->prepare("SELECT name, username FROM users WHERE user_id = :uid");
                    $uStmt->execute(['uid' => $leadInfo['d1_assigned_to']]);
                    $uRow = $uStmt->fetch(PDO::FETCH_ASSOC);
                    if ($uRow) {
                        $designer_name = $uRow['name'];
                        $designer_email = $uRow['username'];
                    }
                }
            }

            if ($designer_email && filter_var($designer_email, FILTER_VALIDATE_EMAIL)) {
                try {
                    $mail1 = new \PHPMailer\PHPMailer\PHPMailer(true);
                    $mail1->isSMTP();
                    $mail1->Host = 'smtp.gmail.com';
                    $mail1->SMTPAuth = true;
                    $mail1->Username = 'updates@livincart.com';
                    $mail1->Password = 'kkzz omvh dzjs xqfu';
                    $mail1->SMTPSecure = \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
                    $mail1->Port = 587;
                    $mail1->setFrom('updates@livincart.com', 'LivinCart System');
                    $mail1->addAddress($designer_email, $designer_name);

                    $mail1->isHTML(true);
                    $mail1->Subject = "Order Confirmed– Client Onboarded | LivinCart | Project ID " . $project_id;
                    $d_msg = "Hello " . htmlspecialchars($designer_name) . ",<br><br>";
                    $d_msg .= "The client has been successfully onboarded, and the Initial Design Consultation has been completed.<br><br>";
                    $d_msg .= "<b>Project ID:</b> " . htmlspecialchars($project_id) . "<br>";
                    $d_msg .= "<b>Client Name:</b> " . htmlspecialchars($customer_name) . "<br>";
                    $d_msg .= "<b>Onboarding Date:</b> " . $onboarding_date . "<br><br>";
                    $d_msg .= "Kindly proceed with the design phase as per the agreed requirements and project timeline.<br><br>";
                    $d_msg .= "Regards,<br><b>Team LivinCart</b>";

                    $mail1->Body = $d_msg;
                    $mail1->send();
                } catch (Exception $e) {}
            }

            // 2. Client Welcome Email (mailer.pdf Page 28)
            $client_email = $data['client_email'] ?? $data['email'] ?? null;
            if (empty($client_email) && !empty($data['lead_id'])) {
                $cl_stmt = $this->conn->prepare("SELECT email FROM leads WHERE lead_id = :lid LIMIT 1");
                $cl_stmt->execute(['lid' => $data['lead_id']]);
                $cl_row = $cl_stmt->fetch(PDO::FETCH_ASSOC);
                if ($cl_row && !empty($cl_row['email'])) {
                    $client_email = $cl_row['email'];
                }
            }
            if (empty($client_email) && !empty($client_id)) {
                $cl_stmt = $this->conn->prepare("SELECT email FROM clients WHERE client_id = :cid LIMIT 1");
                $cl_stmt->execute(['cid' => $client_id]);
                $cl_row = $cl_stmt->fetch(PDO::FETCH_ASSOC);
                if ($cl_row && !empty($cl_row['email'])) {
                    $client_email = $cl_row['email'];
                }
            }

            if ($client_email && filter_var($client_email, FILTER_VALIDATE_EMAIL)) {
                try {
                    $mail2 = new \PHPMailer\PHPMailer\PHPMailer(true);
                    $mail2->isSMTP();
                    $mail2->Host = 'smtp.gmail.com';
                    $mail2->SMTPAuth = true;
                    $mail2->Username = 'updates@livincart.com';
                    $mail2->Password = 'kkzz omvh dzjs xqfu';
                    $mail2->SMTPSecure = \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
                    $mail2->Port = 587;
                    $mail2->setFrom('updates@livincart.com', 'LivinCart System');
                    $mail2->addAddress($client_email, $customer_name);

                    $mail2->isHTML(true);
                    $mail2->Subject = "Welcome to LivinCart | Order Confirmed | Project ID " . $project_id;
                    $c_msg = "Dear " . htmlspecialchars($customer_name) . ",<br><br>";
                    $c_msg .= "Welcome to LivinCart and Services Private Limited!<br><br>";
                    $c_msg .= "Your project has been successfully onboarded, and we are excited to begin your interior journey with us.<br><br>";
                    $c_msg .= "<b>Project Details</b><br>";
                    $c_msg .= "<b>Project ID:</b> " . htmlspecialchars($project_id) . "<br>";
                    $c_msg .= "<b>Project Name:</b> " . htmlspecialchars($project_name) . "<br>";
                    $c_msg .= "<b>Project Manager:</b> " . htmlspecialchars($project_manager_name) . "<br>";
                    $c_msg .= "<b>Onboarding Date:</b> " . $onboarding_date . "<br><br>";
                    $c_msg .= "Our team will guide you through each stage of your project and keep you informed throughout the process.<br><br>";
                    $c_msg .= "Thank you for choosing LivinCart. We look forward to creating your dream space.<br><br>";
                    $c_msg .= "Regards,<br><b>Team LivinCart</b>";

                    $mail2->Body = $c_msg;
                    $mail2->send();
                } catch (Exception $e) {
                    error_log("Onboarding client email failed: " . $e->getMessage());
                }
            }
        } catch (Exception $ex) {}
    }

    public function generateNextCode($project_type = null)
    {
        $dateStr = date('dm'); // e.g. 2609
        $isFactory = ($project_type && (
            in_array($project_type, ['Factory Tab', 'Factory Job', 'Factory', 'factory']) ||
            strpos(strtolower($project_type), 'factory') !== false
        ));

        if ($isFactory) {
            $prefix = "VM-JW-" . $dateStr . "-";
        } else {
            $prefix = "VM-PW-R-";
        }

        $query = "SELECT project_code FROM " . $this->table_name . " WHERE project_code LIKE :prefix";
        $stmt = $this->conn->prepare($query);
        $likePrefix = $prefix . '%';
        $stmt->bindParam(':prefix', $likePrefix);
        $stmt->execute();
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $maxSeq = -1;
        foreach ($rows as $row) {
            $code = trim($row['project_code']);
            if (preg_match('/' . preg_quote($prefix, '/') . '(\d+)$/', $code, $matches)) {
                $seq = intval($matches[1]);
                if ($seq > $maxSeq) {
                    $maxSeq = $seq;
                }
            }
        }

        $nextSeq = $maxSeq + 1;
        return $prefix . str_pad($nextSeq, 2, '0', STR_PAD_LEFT);
    }
}
?>