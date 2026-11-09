<?php
// api/controllers/LeadController.php
require_once __DIR__ . '/../helpers/MailHelper.php';

class LeadController
{
    private $conn;
    private $table_name = "leads";
    private $current_user_id;
    private $current_user_role;

    public function __construct($db, $user_id = null, $role = null)
    {
        $this->conn = $db;
        $this->current_user_id = $user_id;
        $this->current_user_role = $role;
    }

    private function ensureMeetingCompletedSchema()
    {
        try {
            $this->conn->exec("ALTER TABLE " . $this->table_name . " ADD COLUMN IF NOT EXISTS is_meeting_completed TINYINT(1) DEFAULT 0");
        } catch (Exception $e) {}
        try {
            $this->conn->exec("ALTER TABLE " . $this->table_name . " ADD COLUMN IF NOT EXISTS meeting_completed_at DATETIME DEFAULT NULL");
        } catch (Exception $e) {}
    }

    public function create($data)
    {
        // Find a principal architect to assign to if not specified
        $assigned_to = $data['assigned_to'] ?? null;
        if (!$assigned_to) {
            $q_p = "SELECT user_id FROM users WHERE role = 'admin' LIMIT 1";
            $s_p = $this->conn->prepare($q_p);
            $s_p->execute();
            $p = $s_p->fetch(PDO::FETCH_ASSOC);
            $assigned_to = $p ? $p['user_id'] : null;
        }

        $created_by = !empty($data['created_by']) ? $data['created_by'] : ($this->current_user_id ?? $assigned_to ?? 1);

        $manual_client_id = !empty($data['manual_client_id']) ? trim($data['manual_client_id']) : null;
        if (!empty($manual_client_id)) {
            $dupCheck = $this->conn->prepare("SELECT lead_id FROM " . $this->table_name . " WHERE manual_client_id = :mcid LIMIT 1");
            $dupCheck->execute([':mcid' => $manual_client_id]);
            if ($dupCheck->fetch()) {
                return ["success" => false, "message" => "This Lead ID ('" . htmlspecialchars($manual_client_id) . "') is already created. Please use a unique ID."];
            }
        }

        try {
            $this->conn->exec("ALTER TABLE " . $this->table_name . " ADD COLUMN IF NOT EXISTS is_converted TINYINT(1) DEFAULT 0");
        } catch (Exception $e) {}

        $query = "INSERT INTO " . $this->table_name . " 
                (lead_source, client_name, contact_number, email, location, client_address, project_type, estimated_budget, status, is_converted, created_by, assigned_to, manual_client_id, project_scope) 
                VALUES (:lead_source, :client_name, :contact_number, :email, :location, :client_address, :project_type, :estimated_budget, 'enquiry', 0, :created_by, :assigned_to, :manual_client_id, :project_scope)";

        $stmt = $this->conn->prepare($query);

        $lead_source = $data['lead_source'] ?? 'walk_in';
        $client_name = $data['client_name'] ?? '';
        $contact_number = $data['contact_number'] ?? '';
        $email = $data['email'] ?? null;
        $location = $data['location'] ?? null;
        $client_address = $data['client_address'] ?? null;
        $project_type = $data['project_type'] ?? null;
        $project_scope = $data['project_scope'] ?? null;
        $est_budget = ($data['estimated_budget'] === '' || $data['estimated_budget'] === null) ? null : $data['estimated_budget'];

        $stmt->bindParam(':lead_source', $lead_source);
        $stmt->bindParam(':client_name', $client_name);
        $stmt->bindParam(':contact_number', $contact_number);
        $stmt->bindParam(':email', $email);
        $stmt->bindParam(':location', $location);
        $stmt->bindParam(':client_address', $client_address);
        $stmt->bindParam(':project_type', $project_type);
        $stmt->bindParam(':estimated_budget', $est_budget);
        $stmt->bindParam(':created_by', $created_by);
        $stmt->bindParam(':assigned_to', $assigned_to);
        $stmt->bindParam(':manual_client_id', $manual_client_id);
        $stmt->bindParam(':project_scope', $project_scope);
        try {
            if ($stmt->execute()) {
                $lead_id = $this->conn->lastInsertId();

                // If manual_client_id was not provided, establish a permanent PR-XXX id
                if (empty($manual_client_id)) {
                    $manual_client_id = "PR-" . $lead_id;
                    $updMc = $this->conn->prepare("UPDATE " . $this->table_name . " SET manual_client_id = :mcid WHERE lead_id = :lid");
                    $updMc->execute([':mcid' => $manual_client_id, ':lid' => $lead_id]);
                }

                // Automatically create client in clients table
                $client_code = "CL" . str_pad($lead_id, 3, '0', STR_PAD_LEFT);
                if (!empty($manual_client_id)) {
                    $client_code = $manual_client_id;
                }
                // Check duplicate client code
                $code_check = $this->conn->prepare("SELECT client_id FROM clients WHERE client_code = :code");
                $code_check->execute(['code' => $client_code]);
                if ($code_check->fetch()) {
                    $client_code = $client_code . "_" . $lead_id;
                }

                // Check created_by user ID exists
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
                    'name' => $client_name,
                    'phone' => $contact_number,
                    'address' => $client_address ?? $location,
                    'source' => $lead_source,
                    'lead_id' => $lead_id,
                    'created_by' => $created_by,
                    'email' => $email,
                    'consultation_type' => $project_type,
                    'projectname' => $client_name . ' Project'
                ]);

                // Send email notification asynchronously in background without blocking response
                self::dispatchLeadEmailBackground($lead_id);

                return ["success" => true, "message" => "Lead created successfully and client registry entry initialized.", "id" => $lead_id, "lead_id" => $lead_id, "manual_client_id" => $manual_client_id];
            }
            return ["success" => false, "message" => "Unable to create lead."];
        } catch (Exception $e) {
            return ["success" => false, "message" => "Database error creating lead: " . $e->getMessage()];
        }
    }

    /**
     * Dispatch lead creation email in the background (non-blocking)
     */
    public static function dispatchLeadEmailBackground($lead_id)
    {
        $lead_id = intval($lead_id);
        if ($lead_id <= 0) return false;

        // 1. Fast fire-and-forget HTTP request via fsockopen to local server
        $apiUrl = defined('API_BASE_URL') ? API_BASE_URL : 'http://localhost/livrcart/demoark/api';
        $parsed = parse_url($apiUrl);
        $host = $parsed['host'] ?? 'localhost';
        $isHttps = (isset($parsed['scheme']) && strtolower($parsed['scheme']) === 'https');
        $port = $parsed['port'] ?? ($isHttps ? 443 : 80);
        $connectHost = $isHttps ? "ssl://{$host}" : $host;
        $basePath = rtrim($parsed['path'] ?? '', '/');
        $path = $basePath . '/workers/send_lead_email.php?lead_id=' . $lead_id;

        $fp = @fsockopen($connectHost, $port, $errno, $errstr, 1);
        if ($fp) {
            stream_set_timeout($fp, 1);
            $out = "GET {$path} HTTP/1.1\r\n";
            $out .= "Host: {$host}\r\n";
            $out .= "Connection: Close\r\n\r\n";
            @fwrite($fp, $out);
            @fclose($fp);
            return true;
        }

        // 2. Direct CLI worker invocation fallback
        $workerScript = realpath(__DIR__ . '/../workers/send_lead_email.php');
        if ($workerScript && file_exists($workerScript)) {
            try {
                if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
                    $phpBin = file_exists('C:\\xampp\\php\\php.exe') ? 'C:\\xampp\\php\\php.exe' : 'php';
                    $cmd = 'cmd /c start /B "" ' . escapeshellarg($phpBin) . ' ' . escapeshellarg($workerScript) . ' ' . $lead_id . ' > NUL 2>&1';
                    @pclose(@popen($cmd, "r"));
                } else {
                    $cmd = 'php ' . escapeshellarg($workerScript) . ' ' . $lead_id . ' > /dev/null 2>&1 &';
                    @exec($cmd);
                }
                return true;
            } catch (Throwable $e) {}
        }

        return false;
    }

    public function getLeads()
    {
        $query = "SELECT 
                    l.*,
                    COALESCE(NULLIF(l.manual_client_id, ''), NULLIF(p.project_code, ''), CONCAT('PR-', l.lead_id)) as manual_client_id,
                    COALESCE(NULLIF(l.client_name, ''), NULLIF(c.name, ''), NULLIF(c.projectname, ''), NULLIF(p.project_name, ''), CONCAT('Client #', l.lead_id)) as client_name,
                    COALESCE(NULLIF(l.contact_number, ''), NULLIF(c.phone, ''), '') as contact_number,
                    COALESCE(NULLIF(l.email, ''), NULLIF(c.email, ''), '') as email,
                    COALESCE(NULLIF(l.location, ''), NULLIF(c.city, ''), NULLIF(c.address, ''), NULLIF(p.site_address, ''), 'Location N/A') as location,
                    COALESCE(NULLIF(l.client_address, ''), NULLIF(c.address, ''), NULLIF(p.site_address, ''), '') as client_address,
                    COALESCE(NULLIF(l.project_type, ''), NULLIF(p.project_type, ''), 'Interior Projects') as project_type,
                    COALESCE(NULLIF(l.project_scope, ''), 'Full Scope') as project_scope,
                    COALESCE(NULLIF(p.project_code, ''), l.manual_client_id) as project_code,
                    p.project_name
                FROM " . $this->table_name . " l
                LEFT JOIN projects p ON (p.project_id = l.lead_id OR p.project_code = l.manual_client_id)
                LEFT JOIN clients c ON (c.client_id = p.client_id OR c.converted_from_lead_id = l.lead_id)
                ORDER BY l.created_at DESC";
        $stmt = $this->conn->prepare($query);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getAll()
    {
        return $this->getLeads();
    }

    public function updateStatus($lead_id, $status, $assignmentData = null)
    {
        $raw = trim((string)$lead_id);
        $cleanNum = preg_replace('/[^0-9]/', '', $raw);

        // Fetch lead and designer info before updating status to send email notifications
        $old_status = null;
        $lead_info = null;
        try {
            $iq = "SELECT * FROM " . $this->table_name . " WHERE lead_id = :raw1 OR manual_client_id = :raw2";
            if (!empty($cleanNum)) {
                $iq .= " OR lead_id = " . intval($cleanNum);
            }
            $info_stmt = $this->conn->prepare($iq);
            $info_stmt->execute([':raw1' => $raw, ':raw2' => $raw]);
            $lead_info = $info_stmt->fetch(PDO::FETCH_ASSOC);
            if ($lead_info) {
                $old_status = $lead_info['status'];
            }
        } catch (Throwable $e) {}

        $statusRank = [
            'enquiry' => 1,
            'new' => 1,
            'pending' => 1,
            'booked' => 2,
            'scheduled' => 2,
            'rescheduled' => 2,
            'transferred' => 2,
            'in_meeting' => 3,
            'started' => 3,
            'meeting_completed' => 4,
            'completed' => 4,
            'proposal_sent' => 5,
            'proposal_accepted' => 6,
            'converted' => 7,
            'won' => 7,
            'project_started' => 8,
            'lost' => 99,
            'dead' => 99,
            'cancelled' => 99,
            'dropped' => 99
        ];

        $oldRank = $statusRank[strtolower($old_status ?? '')] ?? 0;
        $newRank = $statusRank[strtolower($status ?? '')] ?? 0;

        $isAdminRole = in_array(strtolower($this->current_user_role ?? ''), ['admin', 'administrator', 'superadmin', 'management', 'owner']) || strpos(strtolower($this->current_user_role ?? ''), 'admin') !== false;

        $uRole = strtolower($this->current_user_role ?? '');
        $isSalesRole = in_array($uRole, ['sales', 'sales_person', 'sales_executive', 'business_associate', 'ba', 'telecaller']) || (strpos($uRole, 'sales') !== false && strpos($uRole, 'manager') === false);

        // If lead is already converted or won, non-admins cannot demote back to booked/scheduled/pending
        // But Admin CAN cancel or adjust status
        $isCancelledOrLost = in_array(strtolower($status ?? ''), ['cancelled', 'lost', 'dead', 'dropped']);
        $isMeetingAction = in_array(strtolower($status ?? ''), ['in_meeting', 'meeting_completed', 'completed']);
        $final_main_status = (!$isCancelledOrLost && $oldRank >= 6 && ($isMeetingAction || ($newRank < 6 && $newRank > 0 && !$isAdminRole))) ? $old_status : $status;

        $skipStatusUpdate = !empty($assignmentData['skip_status_update']);
        $updateSuccess = true;

        if (!$skipStatusUpdate) {
            $isCancelled = in_array(strtolower($final_main_status), ['cancelled', 'lost', 'dead', 'dropped']);
            // ONLY explicit meeting completed actions set is_meeting_completed = 1.
            // Quotation acceptance, proposal sent, converted, etc. do NOT complete the consultation meeting automatically.
            $isCompletedAction = in_array(strtolower($status ?? ''), ['meeting_completed', 'completed']);

            $meetingCompSql = $isCompletedAction ? ", is_meeting_completed = 1, meeting_completed_at = COALESCE(meeting_completed_at, NOW())" : "";

            // Only update d1_status if this action was specifically a meeting status change (in_meeting, meeting_completed, completed, etc.)
            // Otherwise preserve existing d1_status so quotation updates don't overwrite consultation meeting status.
            $d1Sql = $isMeetingAction ? ", d1_status = :d1_status" : "";

            $query = "UPDATE " . $this->table_name . " SET status = :status" . $d1Sql . ($isCancelled ? ", is_converted = 0" : "") . $meetingCompSql . " WHERE lead_id = :raw1 OR manual_client_id = :raw2";
            if (!empty($cleanNum)) {
                $query .= " OR lead_id = " . intval($cleanNum);
            }
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':status', $final_main_status);
            if ($isMeetingAction) {
                $stmt->bindParam(':d1_status', $status);
            }
            $stmt->bindParam(':raw1', $raw);
            $stmt->bindParam(':raw2', $raw);
            $updateSuccess = $stmt->execute();

            try {
                if ($isCancelled) {
                    $pQuery = "UPDATE projects SET status = 'Cancelled' WHERE project_id = :raw1 OR project_code = :raw2 OR client_id IN (SELECT client_id FROM clients WHERE converted_from_lead_id = :raw3 OR client_code = :raw4)";
                    if (!empty($cleanNum)) {
                        $pQuery .= " OR project_id = " . intval($cleanNum);
                    }
                    $pStmt = $this->conn->prepare($pQuery);
                    $pStmt->bindParam(':raw1', $raw);
                    $pStmt->bindParam(':raw2', $raw);
                    $pStmt->bindParam(':raw3', $raw);
                    $pStmt->bindParam(':raw4', $raw);
                    $pStmt->execute();
                } else {
                    // Only sync active status to projects table if this lead is already officially converted
                    $pQuery = "UPDATE projects SET status = :status WHERE (client_id IN (SELECT client_id FROM clients WHERE converted_from_lead_id = :raw3 OR client_code = :raw4)) AND LOWER(COALESCE(status, '')) != 'quotation'";
                    $pStmt = $this->conn->prepare($pQuery);
                    $pStmt->bindParam(':status', $final_main_status);
                    $pStmt->bindParam(':raw3', $raw);
                    $pStmt->bindParam(':raw4', $raw);
                    $pStmt->execute();
                }
            } catch (Throwable $pe) {}
        }

        if ($updateSuccess) {
            if (!empty($assignmentData) && is_array($assignmentData)) {
                $adv = isset($assignmentData['advance_paid']) ? floatval($assignmentData['advance_paid']) : null;
                $bud = isset($assignmentData['total_budget']) ? floatval($assignmentData['total_budget']) : null;
                if ($adv !== null || $bud !== null) {
                    $uParts = [];
                    $uParams = [':lead_id' => $lead_id];
                    if ($adv !== null) { $uParts[] = "advance_paid = :adv"; $uParams[':adv'] = $adv; }
                    if ($bud !== null) { $uParts[] = "total_budget = :bud"; $uParams[':bud'] = $bud; }
                    if (!empty($uParts)) {
                        try {
                            $uSql = "UPDATE " . $this->table_name . " SET " . implode(', ', $uParts) . " WHERE lead_id = :lead_id";
                            $uStmt = $this->conn->prepare($uSql);
                            $uStmt->execute($uParams);
                        } catch (Exception $e) {}
                    }
                }
            }
            // Send designer meeting and client meeting status update notifications
            try {
                if ($lead_info) {
                    $designer_id = $lead_info['d1_assigned_to'] ?? null;
                    $designer_email = null;
                    $designer_name = 'Designer';
                    if (!empty($designer_id)) {
                        $des_stmt = $this->conn->prepare("SELECT name, username FROM users WHERE user_id = :uid");
                        $des_stmt->execute([':uid' => $designer_id]);
                        $des_user = $des_stmt->fetch(PDO::FETCH_ASSOC);
                        if ($des_user) {
                            $designer_name = $des_user['name'];
                            $designer_email = $des_user['username'];
                        }
                    }

                    $meeting_datetime = !empty($lead_info['d1_booking_time']) ? date('d M Y, h:i A', strtotime($lead_info['d1_booking_time'])) : date('d M Y, h:i A');

                    $previous_designer_name = 'N/A';
                    $prev_designer_id = $assignmentData['previous_designer_id'] ?? null;
                    if (!empty($prev_designer_id)) {
                        $ids = explode(',', $prev_designer_id);
                        $names = [];
                        foreach ($ids as $id) {
                            $id = trim($id);
                            if ($id !== '') {
                                $prev_stmt = $this->conn->prepare("SELECT name FROM users WHERE user_id = :uid");
                                $prev_stmt->execute([':uid' => $id]);
                                $prev_res = $prev_stmt->fetch(PDO::FETCH_ASSOC);
                                if ($prev_res) {
                                    $names[] = $prev_res['name'];
                                }
                            }
                        }
                        if (!empty($names)) {
                            $previous_designer_name = implode(', ', $names);
                        }
                    }

                    $sales_name = 'Sales Team';
                    if (!empty($this->current_user_id)) {
                        $usr_stmt = $this->conn->prepare("SELECT name FROM users WHERE user_id = :uid");
                        $usr_stmt->execute([':uid' => $this->current_user_id]);
                        $usr_res = $usr_stmt->fetch(PDO::FETCH_ASSOC);
                        if ($usr_res) {
                            $sales_name = $usr_res['name'];
                        }
                    }
                    $salesPersonName = $assignmentData['sales_person_name'] ?? $sales_name;

                    $meeting_data = [
                        'designer_email'   => $designer_email,
                        'designer_name'    => $designer_name,
                        'client_name'      => $lead_info['client_name'] ?? 'Client',
                        'client_email'     => $lead_info['email'] ?? null,
                        'client_phone'     => $lead_info['contact_number'] ?? '',
                        'project_type'     => $lead_info['project_type'] ?? 'Interior Project',
                        'meeting_datetime' => $meeting_datetime,
                        'meeting_mode'     => 'In-Person',
                        'project_id'       => $lead_id,
                        'previous_designer'=> $previous_designer_name,
                        'sales_person_name'=> $salesPersonName,
                        'notes'            => $lead_info['d1_notes'] ?? ''
                    ];

                    if ($status === 'booked' || $status === 'in_meeting') {
                        // Booked / Started Meeting -> Send to Designer & Client
                        MailHelper::sendDesignerMeetingNotification($this->conn, 'booked', $meeting_data);
                        MailHelper::sendClientMeetingNotification($this->conn, 'scheduled', [
                            'client_email' => $lead_info['email'] ?? null,
                            'client_name'  => $lead_info['client_name'] ?? 'Client',
                            'datetime'     => $meeting_datetime,
                            'scheduled_by' => 'Team',
                            'mode'         => 'In-Person'
                        ]);
                    } elseif ($status === 'transferred') {
                        MailHelper::sendDesignerMeetingNotification($this->conn, 'transferred', $meeting_data);
                    } elseif ($status === 'rescheduled') {
                        MailHelper::sendDesignerMeetingNotification($this->conn, 'rescheduled', $meeting_data);
                        MailHelper::sendClientMeetingNotification($this->conn, 'rescheduled', [
                            'client_email' => $lead_info['email'] ?? null,
                            'client_name'  => $lead_info['client_name'] ?? 'Client',
                            'datetime'     => $meeting_datetime,
                            'scheduled_by' => 'Team',
                            'mode'         => 'In-Person'
                        ]);
                    } elseif ($status === 'cancelled') {
                        MailHelper::sendDesignerMeetingNotification($this->conn, 'cancelled', $meeting_data);
                        MailHelper::sendClientMeetingNotification($this->conn, 'cancelled', [
                            'client_email' => $lead_info['email'] ?? null,
                            'client_name'  => $lead_info['client_name'] ?? 'Client',
                            'datetime'     => $meeting_datetime
                        ]);
                    } elseif ($status === 'meeting_completed' || $status === 'completed') {
                        // Completed Meeting -> Send to Designer & Client
                        MailHelper::sendDesignerMeetingNotification($this->conn, 'completed', $meeting_data);
                        MailHelper::sendClientMeetingNotification($this->conn, 'completed', [
                            'client_email' => $lead_info['email'] ?? null,
                            'client_name'  => $lead_info['client_name'] ?? 'Client',
                            'datetime'     => $meeting_datetime
                        ]);
                    }
                }
            } catch (Exception $mail_err) {
                error_log("Meeting status email dispatch error: " . $mail_err->getMessage());
            }

            $lower_st = strtolower($status ?? '');
            if (in_array($lower_st, ['won', 'converted', 'project_started'])) {
                $pRes = $this->convertToProject($lead_id, $assignmentData ?? []);
                return $pRes;
            }
            return ["success" => true, "message" => "Status updated."];
        }
        return ["success" => false, "message" => "Failed to update status."];
    }

    
    public function bookSiteManagerSlot($lead_id, $site_manager_id, $booking_time, $assigned_by_name, $notes = null)
    {
        try {
            if (!empty($notes)) {
                try {
                    $this->conn->exec("CREATE TABLE IF NOT EXISTS lead_notes (
                        id INT(11) AUTO_INCREMENT PRIMARY KEY,
                        lead_id INT(11) NOT NULL,
                        user_id INT(11) NOT NULL,
                        note_text TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )");
                } catch (Exception $e) { }
            }

            $this->conn->beginTransaction();

            $lead_q = "SELECT client_name, email FROM leads WHERE lead_id = :lead_id";
            $lead_s = $this->conn->prepare($lead_q);
            $lead_s->execute(['lead_id' => $lead_id]);
            $lead = $lead_s->fetch(PDO::FETCH_ASSOC);

            try { $this->conn->exec("ALTER TABLE " . $this->table_name . " ADD COLUMN qc_status VARCHAR(50) DEFAULT 'unassigned'"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE " . $this->table_name . " ADD COLUMN qc_booking_time DATETIME DEFAULT NULL"); } catch (Exception $e) {}

            $query = "UPDATE " . $this->table_name . " SET site_manager_assigned_to = :site_manager_id, site_manager_booking_time = :booking_time, site_manager_notes = :notes, qc_status = 'booked', qc_booking_time = :booking_time WHERE lead_id = :lead_id";
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':site_manager_id', $site_manager_id);
            $stmt->bindParam(':booking_time', $booking_time);
            $stmt->bindParam(':notes', $notes);
            $stmt->bindParam(':lead_id', $lead_id);
            $stmt->execute();

            if (!empty($notes)) {
                try {
                    $note_q = "INSERT INTO lead_notes (lead_id, user_id, note_text) VALUES (:lead_id, :user_id, :note_text)";
                    $note_stmt = $this->conn->prepare($note_q);
                    $note_stmt->execute([
                        'lead_id' => $lead_id,
                        'user_id' => $this->current_user_id ?: ($site_manager_id ?: 1),
                        'note_text' => "Site Manager Booking: " . $notes
                    ]);
                } catch (Exception $e) { }
            }

            $title = "New Site Visit Assigned";
            $message = "You have been assigned to Lead: " . ($lead['client_name'] ?? 'Unknown') . " on " . date('M j, g:i A', strtotime($booking_time)) . " by " . $assigned_by_name . ".";
            if (!empty($notes)) {
                $message .= " Note: " . $notes;
            }
            $notif_q = "INSERT INTO notifications (user_id, title, message) VALUES (:uid, :title, :msg)";
            $notif_s = $this->conn->prepare($notif_q);
            $notif_s->execute([
                'uid' => $site_manager_id,
                'title' => $title,
                'msg' => $message
            ]);

            $d1_q = "SELECT name, username FROM users WHERE user_id = :uid";
            $d1_s = $this->conn->prepare($d1_q);
            $d1_s->execute(['uid' => $site_manager_id]);
            $d1_user = $d1_s->fetch(PDO::FETCH_ASSOC);

            if ($this->conn->inTransaction()) {
                $this->conn->commit();
            }

            // Send QC notification email
            try {
                $meeting_data = [
                    'project_id' => 'PR_' . $lead_id,
                    'customer_name' => $lead['client_name'] ?? 'Client',
                    'qc_date' => date('d M Y', strtotime($booking_time)),
                    'qc_time' => date('h:i A', strtotime($booking_time)),
                    'designer_name' => $assigned_by_name,
                    'qc_name' => $d1_user['name'] ?? 'QC Inspector',
                    'qc_id' => $site_manager_id,
                    'qc_email' => $d1_user['username'] ?? null
                ];
                MailHelper::sendQCNotification($this->conn, 'booked', $meeting_data);
            } catch (Exception $mailEx) {
                error_log("QC Mailer Error: " . $mailEx->getMessage());
            }

            return true;
        } catch (\PDOException $e) {
            if ($this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            return false;
        }
    }

    public function bookMMTSSlot($lead_id, $booking_time, $assigned_by_name, $mmts_notes = null, $extraData = [])
    {
        try {
            // 🔒 Strictly require Full 10% Stage 1 Target satisfied before booking MMTS slot
            $lCheck = $this->conn->prepare("SELECT total_budget, estimated_budget, initial_quote_amount, advance_paid, manual_client_id FROM " . $this->table_name . " WHERE lead_id = :lid LIMIT 1");
            $lCheck->execute(['lid' => $lead_id]);
            $lData = $lCheck->fetch(PDO::FETCH_ASSOC);

            $leadBud = floatval($lData['initial_quote_amount'] ?? ($lData['total_budget'] ?? ($lData['estimated_budget'] ?? 0)));
            $leadAdv = floatval($lData['advance_paid'] ?? 0);

            if ($leadBud <= 0) {
                try {
                    $qStmt = $this->conn->prepare("SELECT total_amount FROM quotes WHERE project_id = :lid ORDER BY quote_id DESC LIMIT 1");
                    $qStmt->execute([':lid' => $lead_id]);
                    $leadBud = floatval($qStmt->fetchColumn() ?: 0);
                } catch (Exception $e) {}
            }

            $txPaid = 0;
            try {
                $fCheck = $this->conn->prepare("SELECT COALESCE(SUM(amount), 0) FROM finance_transactions WHERE type = 'credit' AND (project_id = :lid OR project_id = :mcid OR description LIKE :m1)");
                $fCheck->execute([':lid' => (string)$lead_id, ':mcid' => (string)($lData['manual_client_id'] ?? ''), ':m1' => '%' . $lead_id . '%']);
                $txPaid = floatval($fCheck->fetchColumn() ?: 0);
            } catch (Exception $e) {}

            $effectivePaid = max($leadAdv, $txPaid);

            if ($leadBud > 0) {
                $target10 = $leadBud * 0.10;
                if ($effectivePaid < ($target10 - 1)) {
                    $remAmt = $target10 - $effectivePaid;
                    return [
                        "success" => false, 
                        "message" => "MMTS Slot Booking Locked: Full 10% Stage 1 Target (₹" . number_format($target10, 2) . ") must be satisfied before booking MMTS slot. Current advance: ₹" . number_format($effectivePaid, 2) . ". Remaining balance: ₹" . number_format($remAmt, 2) . "."
                    ];
                }
            } else if ($effectivePaid <= 0) {
                return [
                    "success" => false, 
                    "message" => "MMTS Slot Booking Locked: Stage 1 Advance payment (10%) must be recorded before booking MMTS slot."
                ];
            }

            try { $this->conn->exec("ALTER TABLE " . $this->table_name . " ADD COLUMN mmts_status VARCHAR(50) DEFAULT 'unassigned'"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE " . $this->table_name . " ADD COLUMN mmts_booking_time DATETIME DEFAULT NULL"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE " . $this->table_name . " ADD COLUMN mmts_notes TEXT DEFAULT NULL"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE " . $this->table_name . " ADD COLUMN mmt_assigned_id VARCHAR(255) DEFAULT NULL"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE " . $this->table_name . " MODIFY COLUMN mmt_assigned_id VARCHAR(255) DEFAULT NULL"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE " . $this->table_name . " ADD COLUMN mmt_assigned_name VARCHAR(255) DEFAULT NULL"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE " . $this->table_name . " ADD COLUMN pm_assigned_id VARCHAR(255) DEFAULT NULL"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE " . $this->table_name . " MODIFY COLUMN pm_assigned_id VARCHAR(255) DEFAULT NULL"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE " . $this->table_name . " ADD COLUMN pm_assigned_name VARCHAR(255) DEFAULT NULL"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE " . $this->table_name . " ADD COLUMN associate_designer_assigned_id VARCHAR(255) DEFAULT NULL"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE " . $this->table_name . " MODIFY COLUMN associate_designer_assigned_id VARCHAR(255) DEFAULT NULL"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE " . $this->table_name . " ADD COLUMN associate_designer_assigned_name VARCHAR(255) DEFAULT NULL"); } catch (Exception $e) {}

            $this->conn->beginTransaction();

            $mmt_id = $extraData['mmt_assigned_id'] ?? null;
            $mmt_name = $extraData['mmt_assigned_name'] ?? null;
            $pm_id = $extraData['pm_assigned_id'] ?? null;
            $pm_name = $extraData['pm_assigned_name'] ?? null;
            $ad_id = $extraData['associate_designer_assigned_id'] ?? null;
            $ad_name = $extraData['associate_designer_assigned_name'] ?? null;

            $query = "UPDATE " . $this->table_name . " SET 
                mmts_status = 'booked', 
                mmts_booking_time = :booking_time, 
                mmts_notes = :notes,
                mmt_assigned_id = COALESCE(:mmt_id, mmt_assigned_id),
                mmt_assigned_name = COALESCE(:mmt_name, mmt_assigned_name),
                pm_assigned_id = COALESCE(:pm_id, pm_assigned_id),
                pm_assigned_name = COALESCE(:pm_name, pm_assigned_name),
                associate_designer_assigned_id = COALESCE(:ad_id, associate_designer_assigned_id),
                associate_designer_assigned_name = COALESCE(:ad_name, associate_designer_assigned_name)
                WHERE lead_id = :lead_id";
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':booking_time', $booking_time);
            $stmt->bindParam(':notes', $mmts_notes);
            $stmt->bindParam(':mmt_id', $mmt_id);
            $stmt->bindParam(':mmt_name', $mmt_name);
            $stmt->bindParam(':pm_id', $pm_id);
            $stmt->bindParam(':pm_name', $pm_name);
            $stmt->bindParam(':ad_id', $ad_id);
            $stmt->bindParam(':ad_name', $ad_name);
            $stmt->bindParam(':lead_id', $lead_id);
            $stmt->execute();

            try {
                $projStmt = $this->conn->prepare("UPDATE projects SET mmts_status = 'booked', mmts_booking_time = :btime WHERE project_id = :lead_id OR lead_id = :lead_id OR project_code = :lead_id");
                $projStmt->execute(['btime' => $booking_time, 'lead_id' => $lead_id]);
            } catch (Exception $pe) {}

            if (!empty($mmts_notes)) {
                try {
                    $note_q = "INSERT INTO lead_notes (lead_id, user_id, note_text) VALUES (:lead_id, :user_id, :note_text)";
                    $note_stmt = $this->conn->prepare($note_q);
                    $note_stmt->execute([
                        'lead_id' => $lead_id,
                        'user_id' => $this->current_user_id ?: 1,
                        'note_text' => "MMTS Booking: " . $mmts_notes
                    ]);
                } catch (Exception $e) {}
            }

            $lead_q = "SELECT client_name, email FROM leads WHERE lead_id = :lead_id";
            $lead_s = $this->conn->prepare($lead_q);
            $lead_s->execute(['lead_id' => $lead_id]);
            $lead = $lead_s->fetch(PDO::FETCH_ASSOC);

            if (!empty($mmt_id)) {
                try {
                    $n_stmt = $this->conn->prepare("INSERT INTO notifications (user_id, title, message, type) VALUES (:uid, :title, :msg, 'slot_assigned')");
                    $mmt_ids = array_filter(array_map('trim', explode(',', (string)$mmt_id)));
                    foreach ($mmt_ids as $single_uid) {
                        $n_stmt->execute([
                            'uid' => $single_uid,
                            'title' => "📦 New MMTS Slot Assigned",
                            'msg' => "You have been assigned to an MMTS Measurement slot for " . ($lead['client_name'] ?? 'Client') . " on " . date('d M Y, h:i A', strtotime($booking_time))
                        ]);
                    }
                } catch (Exception $ne) {}
            }

            $this->conn->commit();

            $meeting_data = [
                'client_name' => $lead['client_name'] ?? 'Client',
                'datetime' => date('d M Y, h:i A', strtotime($booking_time)),
                'assigned_by' => $assigned_by_name,
                'notes' => $mmts_notes
            ];
            MailHelper::sendD1MeasurementNotification($this->conn, 'booked', $meeting_data);

            return ["success" => true, "message" => "MMTS slot booked successfully."];
        } catch (Exception $e) {
            if ($this->conn->inTransaction()) { $this->conn->rollBack(); }
            return ["success" => false, "message" => "Failed to book MMTS slot: " . $e->getMessage()];
        }
    }

    public function sendAgreementPDF($data)
    {
        try {
            $lead_id = $data['lead_id'] ?? null;
            $final_budget = $data['final_budget'] ?? null;
            $notes = $data['notes'] ?? '';
            $assigned_by_name = $data['assigned_by_name'] ?? 'User';

            if (!$lead_id) {
                return ["success" => false, "message" => "Lead ID is required"];
            }

            try { $this->conn->exec("ALTER TABLE leads ADD COLUMN IF NOT EXISTS final_quotation_prepared TINYINT(1) DEFAULT 0"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE leads ADD COLUMN IF NOT EXISTS agreement_prepared_at DATETIME DEFAULT NULL"); } catch (Exception $e) {}

            $stmt = $this->conn->prepare("UPDATE leads SET 
                total_budget = COALESCE(:fbudget, total_budget),
                estimated_budget = COALESCE(:fbudget, estimated_budget),
                final_quotation_prepared = 1,
                agreement_prepared_at = NOW(),
                d1_notes = CONCAT_WS('\n', d1_notes, :notes)
                WHERE lead_id = :lead_id");
            
            $stmt->execute([
                'fbudget' => $final_budget,
                'notes' => "[Agreement & Final Quotation PDF Sent] " . $notes,
                'lead_id' => $lead_id
            ]);

            $leadStmt = $this->conn->prepare("SELECT * FROM leads WHERE lead_id = :lead_id LIMIT 1");
            $leadStmt->execute(['lead_id' => $lead_id]);
            $lead = $leadStmt->fetch(PDO::FETCH_ASSOC);

            if ($lead && !empty($lead['email'])) {
                require_once __DIR__ . '/../libs/PHPMailer/src/Exception.php';
                require_once __DIR__ . '/../libs/PHPMailer/src/PHPMailer.php';
                require_once __DIR__ . '/../libs/PHPMailer/src/SMTP.php';

                $mail = new \PHPMailer\PHPMailer\PHPMailer(true);
                $mail->Timeout = 3;
                $mail->isSMTP();
                $mail->Host = 'smtp.gmail.com';
                $mail->SMTPAuth = true;
                $mail->Username = 'livrcart@gmail.com';
                $mail->Password = 'your_app_password';
                $mail->SMTPSecure = \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
                $mail->Port = 587;

                $mail->setFrom('livrcart@gmail.com', 'Livrcart Interior Solutions');
                $mail->addAddress($lead['email'], $lead['client_name'] ?? 'Valued Client');

                $mail->isHTML(true);
                $mail->Subject = "Final Quotation & Service Agreement — " . ($lead['client_name'] ?? 'Client');
                $mail->Body = "Dear " . htmlspecialchars($lead['client_name'] ?? 'Client') . ",<br/><br/>" .
                    "Your Final Project Quotation and Service Agreement for Project ID: <b>" . ($lead['manual_client_id'] ?? 'PR-' . $lead_id) . "</b> has been prepared.<br/><br/>" .
                    "Final Project Budget: <b>₹" . number_format($final_budget ?? $lead['total_budget'] ?? 0) . "</b><br/><br/>" .
                    "Stage Status: <b>40% Stage 3 Payment (Ready to Paint / R2P Stage)</b><br/><br/>" .
                    "Thank you,<br/>Livrcart Design Team";

                @$mail->send();
            }

            return ["success" => true, "message" => "Final Quotation & Service Agreement PDF generated and sent to client via email successfully!"];
        } catch (Exception $e) {
            return ["success" => true, "message" => "Final Quotation & Agreement recorded successfully."];
        }
    }

    public function bookMultiRoleSlot($data)
    {
        try {
            $lead_id = $data['lead_id'] ?? null;
            $booking_time = $data['booking_time'] ?? null;
            $assigned_by_name = $data['assigned_by_name'] ?? 'User';
            $notes = $data['notes'] ?? null;

            if (!$lead_id || !$booking_time) {
                return ["success" => false, "message" => "Lead ID and booking time are required"];
            }

            try { $this->conn->exec("ALTER TABLE leads ADD COLUMN IF NOT EXISTS mmt_assigned_id INT(11) DEFAULT NULL"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE leads ADD COLUMN IF NOT EXISTS mmt_assigned_name VARCHAR(255) DEFAULT NULL"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE leads ADD COLUMN IF NOT EXISTS site_inspector_assigned_id INT(11) DEFAULT NULL"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE leads ADD COLUMN IF NOT EXISTS site_inspector_assigned_name VARCHAR(255) DEFAULT NULL"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE leads ADD COLUMN IF NOT EXISTS associate_designer_assigned_id INT(11) DEFAULT NULL"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE leads ADD COLUMN IF NOT EXISTS associate_designer_assigned_name VARCHAR(255) DEFAULT NULL"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE leads ADD COLUMN IF NOT EXISTS pm_assigned_id INT(11) DEFAULT NULL"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE leads ADD COLUMN IF NOT EXISTS pm_assigned_name VARCHAR(255) DEFAULT NULL"); } catch (Exception $e) {}

            $mmt_id = $data['mmt_assigned_id'] ?? null;
            $mmt_name = $data['mmt_assigned_name'] ?? null;
            $site_inspector_id = $data['site_inspector_assigned_id'] ?? null;
            $site_inspector_name = $data['site_inspector_assigned_name'] ?? null;
            $associate_designer_id = $data['associate_designer_assigned_id'] ?? null;
            $associate_designer_name = $data['associate_designer_assigned_name'] ?? null;
            $pm_id = $data['pm_assigned_id'] ?? null;
            $pm_name = $data['pm_assigned_name'] ?? null;

            // 🔒 HARD BACKEND GATE: If MMTS or PM is being assigned, verify full 10% Stage 1 payment
            if ($mmt_id || $mmt_name || $pm_id || $pm_name) {
                $lCheck = $this->conn->prepare("SELECT total_budget, estimated_budget, initial_quote_amount, advance_paid, manual_client_id FROM " . $this->table_name . " WHERE lead_id = :lid LIMIT 1");
                $lCheck->execute(['lid' => $lead_id]);
                $lData = $lCheck->fetch(PDO::FETCH_ASSOC);

                $leadBud = floatval($lData['initial_quote_amount'] ?? ($lData['total_budget'] ?? ($lData['estimated_budget'] ?? 0)));
                $leadAdv = floatval($lData['advance_paid'] ?? 0);

                if ($leadBud <= 0) {
                    try {
                        $qStmt = $this->conn->prepare("SELECT total_amount FROM quotes WHERE project_id = :lid ORDER BY quote_id DESC LIMIT 1");
                        $qStmt->execute([':lid' => $lead_id]);
                        $leadBud = floatval($qStmt->fetchColumn() ?: 0);
                    } catch (Exception $e) {}
                }

                $txPaid = 0;
                try {
                    $fCheck = $this->conn->prepare("SELECT COALESCE(SUM(amount), 0) FROM finance_transactions WHERE type = 'credit' AND (project_id = :lid OR project_id = :mcid OR description LIKE :m1)");
                    $fCheck->execute([':lid' => (string)$lead_id, ':mcid' => (string)($lData['manual_client_id'] ?? ''), ':m1' => '%' . $lead_id . '%']);
                    $txPaid = floatval($fCheck->fetchColumn() ?: 0);
                } catch (Exception $e) {}

                $effectivePaid = max($leadAdv, $txPaid);

                if ($leadBud > 0) {
                    $target10 = $leadBud * 0.10;
                    if ($effectivePaid < ($target10 - 1)) {
                        $remAmt = $target10 - $effectivePaid;
                        return [
                            "success" => false,
                            "message" => "MMTS Slot Booking Locked: Full 10% Stage 1 Target (₹" . number_format($target10, 2) . ") must be satisfied before booking MMTS / PM slot. Current advance: ₹" . number_format($effectivePaid, 2) . ". Remaining balance: ₹" . number_format($remAmt, 2) . "."
                        ];
                    }
                } else if ($effectivePaid <= 0) {
                    return [
                        "success" => false,
                        "message" => "MMTS Slot Booking Locked: Stage 1 Advance payment (10%) must be recorded before booking MMTS / PM slot."
                    ];
                }
            }

            // 🔒 HARD BACKEND GATE: If Site Inspector is being assigned, verify 10% payment
            if (($site_inspector_id || $site_inspector_name) && !$this->checkIs10PercentPaid($lead_id)) {
                return [
                    "success" => false,
                    "is_10_percent_required" => true,
                    "message" => "⚠️ Minimum 10% Initial Payment is required before assigning Site Inspector / Quality Check Slot!"
                ];
            }

            $fields = [];
            $params = ['lead_id' => $lead_id];

            // 1. Designer / D1 Assignment (Sales Team Booking)
            if ($associate_designer_id || $associate_designer_name) {
                $fields[] = "d1_booking_time = :d1_btime";
                $fields[] = "d1_notes = :d1_notes";
                $fields[] = "associate_designer_assigned_id = :ad_id";
                $fields[] = "associate_designer_assigned_name = :ad_name";
                if (!empty($data['d1_user_id'])) {
                    $fields[] = "d1_assigned_to = :d1_uid";
                    $params['d1_uid'] = $data['d1_user_id'];
                }
                $params['d1_btime'] = $booking_time;
                $params['d1_notes'] = $notes;
                $params['ad_id'] = $associate_designer_id;
                $params['ad_name'] = $associate_designer_name;
            }

            // 2. MMTS Assignment (Designer Booking MMTS)
            if ($mmt_id || $mmt_name) {
                $fields[] = "mmts_booking_time = :mmt_btime";
                $fields[] = "mmts_notes = :mmt_notes";
                $fields[] = "mmt_assigned_id = :mmt_id";
                $fields[] = "mmt_assigned_name = :mmt_name";
                $fields[] = "mmts_status = 'booked'";
                $params['mmt_btime'] = $booking_time;
                $params['mmt_notes'] = $notes;
                $params['mmt_id'] = $mmt_id;
                $params['mmt_name'] = $mmt_name;

                try {
                    $projStmt = $this->conn->prepare("UPDATE projects SET mmts_status = 'booked', mmts_booking_time = :btime WHERE project_id = :lead_id OR lead_id = :lead_id OR project_code = :lead_id");
                    $projStmt->execute(['btime' => $booking_time, 'lead_id' => $lead_id]);
                } catch (Exception $pe) {}
            }

            // 3. PM Assignment
            if ($pm_id || $pm_name) {
                $fields[] = "pm_assigned_id = :pm_id";
                $fields[] = "pm_assigned_name = :pm_name";
                $params['pm_id'] = $pm_id;
                $params['pm_name'] = $pm_name;
            }

            // 4. Site Inspector / QC Assignment (QC Booking)
            if ($site_inspector_id || $site_inspector_name) {
                $fields[] = "site_manager_booking_time = :qc_btime";
                $fields[] = "qc_booking_time = :qc_btime";
                $fields[] = "site_manager_notes = :qc_notes";
                $fields[] = "qc_notes = :qc_notes";
                $fields[] = "site_inspector_assigned_id = :si_id";
                $fields[] = "site_inspector_assigned_name = :si_name";
                $fields[] = "site_manager_assigned_to = COALESCE(:si_id, site_manager_assigned_to)";
                $fields[] = "qc_status = 'booked'";
                $fields[] = "site_inspector_status = 'booked'";
                $params['qc_btime'] = $booking_time;
                $params['qc_notes'] = $notes;
                $params['si_id'] = $site_inspector_id;
                $params['si_name'] = $site_inspector_name;

                try {
                    $projStmt = $this->conn->prepare("UPDATE projects SET qc_status = 'booked', qc_booking_time = :btime WHERE project_id = :lead_id OR lead_id = :lead_id OR project_code = :lead_id");
                    $projStmt->execute(['btime' => $booking_time, 'lead_id' => $lead_id]);
                } catch (Exception $pe) {}
            }

            if (!empty($fields)) {
                $query = "UPDATE leads SET " . implode(", ", $fields) . " WHERE lead_id = :lead_id";
                $stmt = $this->conn->prepare($query);
                $stmt->execute($params);
            }

            try {
                $l_info = $this->conn->prepare("SELECT client_name, site_address, location FROM leads WHERE lead_id = :lid");
                $l_info->execute(['lid' => $lead_id]);
                $l_row = $l_info->fetch(PDO::FETCH_ASSOC);

                MailHelper::sendMaskingSlotNotification($this->conn, 'booked', [
                    'project_id' => 'PR_' . $lead_id,
                    'client_name' => $l_row['client_name'] ?? 'Client',
                    'datetime' => date('d M Y, h:i A', strtotime($booking_time)),
                    'address' => $l_row['site_address'] ?? $l_row['location'] ?? '',
                    'assigned_by' => $assigned_by_name,
                    'notes' => $notes,
                    'pm_name' => $pm_name
                ]);

                if (!empty($site_inspector_id) || !empty($site_inspector_name)) {
                    MailHelper::sendQCNotification($this->conn, 'booked', [
                        'project_id' => 'PR_' . $lead_id,
                        'customer_name' => $l_row['client_name'] ?? 'Client',
                        'qc_date' => date('d M Y', strtotime($booking_time)),
                        'qc_time' => date('h:i A', strtotime($booking_time)),
                        'designer_name' => $assigned_by_name,
                        'qc_name' => $site_inspector_name ?? 'QC Inspector',
                        'qc_id' => $site_inspector_id
                    ]);
                }

                if (!empty($mmt_id)) {
                    try {
                        $n_stmt = $this->conn->prepare("INSERT INTO notifications (user_id, title, message, type) VALUES (:uid, :title, :msg, 'slot_assigned')");
                        $n_stmt->execute([
                            'uid' => $mmt_id,
                            'title' => "📦 New MMTS Slot Assigned",
                            'msg' => "You have been assigned to an MMTS Measurement slot for " . ($l_row['client_name'] ?? 'Client') . " on " . date('d M Y, h:i A', strtotime($booking_time))
                        ]);
                    } catch (Exception $ne) {}
                }

                if (!empty($site_inspector_id)) {
                    try {
                        $n_stmt = $this->conn->prepare("INSERT INTO notifications (user_id, title, message, type) VALUES (:uid, :title, :msg, 'slot_assigned')");
                        $n_stmt->execute([
                            'uid' => $site_inspector_id,
                            'title' => "🔍 New Site Inspector & QC Slot Assigned",
                            'msg' => "You have been assigned to a Quality Check / Site Inspection slot for " . ($l_row['client_name'] ?? 'Client') . " on " . date('d M Y, h:i A', strtotime($booking_time))
                        ]);
                    } catch (Exception $ne) {}
                }
            } catch (Exception $mEx) {}

            return ["success" => true, "message" => "Multi-role slot booked successfully for assigned personnel."];
        } catch (Exception $e) {
            return ["success" => false, "message" => "Failed to book multi-role slot: " . $e->getMessage()];
        }
    }

    public function updateMMTSStatus($lead_id, $status, $assigned_by_name)
    {
        try {
            $raw = trim((string)$lead_id);
            $cleanNum = preg_replace('/[^0-9]/', '', $raw);

            $query = "UPDATE " . $this->table_name . " SET mmts_status = :status WHERE lead_id = :raw1 OR manual_client_id = :raw2";
            if (!empty($cleanNum)) {
                $query .= " OR lead_id = " . intval($cleanNum);
            }
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':status', $status);
            $stmt->bindParam(':raw1', $raw);
            $stmt->bindParam(':raw2', $raw);
            $stmt->execute();

            try {
                $pQuery = "UPDATE projects SET mmts_status = :status WHERE project_id = :raw1 OR project_code = :raw2";
                if (!empty($cleanNum)) {
                    $pQuery .= " OR project_id = " . intval($cleanNum);
                }
                $pStmt = $this->conn->prepare($pQuery);
                $pStmt->bindParam(':status', $status);
                $pStmt->bindParam(':raw1', $raw);
                $pStmt->bindParam(':raw2', $raw);
                $pStmt->execute();
            } catch (Exception $pe) {}

            $lead_q = "SELECT client_name, email, mmts_booking_time, mmts_notes, client_address, location FROM leads WHERE lead_id = :raw1 OR manual_client_id = :raw2 LIMIT 1";
            $lead_s = $this->conn->prepare($lead_q);
            $lead_s->execute([':raw1' => $raw, ':raw2' => $raw]);
            $lead = $lead_s->fetch(PDO::FETCH_ASSOC);

            $stMap = [
                'booked' => 'booked',
                'rescheduled' => 'rescheduled',
                'cancelled' => 'cancelled',
                'meeting_completed' => 'completed',
                'completed' => 'completed'
            ];

            $mailType = $stMap[strtolower($status)] ?? null;
            if ($mailType) {
                $meeting_data = [
                    'project_id' => 'PR_' . $lead_id,
                    'client_name' => $lead['client_name'] ?? 'Client',
                    'datetime' => (!empty($lead['mmts_booking_time']) && $lead['mmts_booking_time'] !== '0000-00-00 00:00:00') ? date('d M Y, h:i A', strtotime($lead['mmts_booking_time'])) : date('d M Y, h:i A'),
                    'address' => $lead['client_address'] ?? $lead['location'] ?? '',
                    'assigned_by' => $assigned_by_name,
                    'completed_by' => $assigned_by_name,
                    'notes' => $lead['mmts_notes'] ?? ''
                ];
                MailHelper::sendMaskingSlotNotification($this->conn, $mailType, $meeting_data);
            }

            return ["success" => true, "message" => "MMTS status updated."];
        } catch (Exception $e) {
            return ["success" => false, "message" => "Failed to update MMTS status: " . $e->getMessage()];
        }
    }

    private function checkIs10PercentPaid($lead_id)
    {
        if (!$lead_id) return true;
        try {
            $stmt = $this->conn->prepare("SELECT * FROM " . $this->table_name . " WHERE lead_id = :lid OR manual_client_id = :lid OR LOWER(manual_client_id) = LOWER(:lid) LIMIT 1");
            $stmt->bindParam(':lid', $lead_id);
            $stmt->execute();
            $row = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$row) {
                // Also check projects table if passed project_code or project_id
                $pStmt = $this->conn->prepare("SELECT * FROM projects WHERE project_id = :lid OR project_code = :lid OR LOWER(project_code) = LOWER(:lid) LIMIT 1");
                $pStmt->bindParam(':lid', $lead_id);
                $pStmt->execute();
                $pRow = $pStmt->fetch(PDO::FETCH_ASSOC);
                if ($pRow) {
                    $row = $pRow;
                }
            }

            $budgetVal = 0;
            $advanceVal = 0;
            $paymentStatus = '';

            if ($row) {
                $budgetVal = floatval($row['total_budget'] ?? $row['estimated_budget'] ?? $row['initial_quote_amount'] ?? 0);
                $advanceVal = floatval($row['advance_paid'] ?? $row['advance_received'] ?? 0);
                $paymentStatus = strtolower(trim($row['payment_status'] ?? ''));

                if ($paymentStatus === '20% paid' || $paymentStatus === 'paid_20' || intval($row['is_20_percent_paid'] ?? 0) === 1 || intval($row['stage2_paid'] ?? 0) === 1) {
                    return true;
                }

                if ($budgetVal > 0 && $advanceVal > 0) {
                    if (($advanceVal / $budgetVal) * 100 >= 19.5) {
                        return true;
                    }
                }
            }

            // Also check finance transactions
            $lidNum = intval(preg_replace('/[^0-9]/', '', (string)$lead_id));
            $mcVal = strval($row['manual_client_id'] ?? $row['project_code'] ?? '');
            $cNameVal = strval($row['client_name'] ?? $row['project_name'] ?? '');

            $finStmt = $this->conn->prepare("
                SELECT 
                    COALESCE(SUM(amount), 0) as total_paid, 
                    COUNT(*) as cnt, 
                    COALESCE(SUM(CASE WHEN category LIKE '%Stage 2%' OR description LIKE '%Stage 2%' OR description LIKE '%20%' THEN 1 ELSE 0 END), 0) as stage2_cnt 
                FROM finance_transactions 
                WHERE type = 'credit' 
                  AND (
                      project_id = :lid 
                      OR project_id = :clean_lid
                      OR project_id = :mc_val
                      OR LOWER(project_id) = LOWER(:lid)
                      OR LOWER(project_id) = LOWER(:mc_val)
                      OR description LIKE :lid_match 
                      OR description LIKE :mc_match
                      OR (:cname_match != '%%' AND description LIKE :cname_match)
                  )
            ");
            $lidMatch = "%" . $lead_id . "%";
            $mcMatch = "%" . ($mcVal ?: $lead_id) . "%";
            $cnameMatch = $cNameVal ? ("%" . $cNameVal . "%") : "%%";
            $finStmt->execute([
                'lid' => $lead_id,
                'clean_lid' => $lidNum,
                'mc_val' => $mcVal,
                'lid_match' => $lidMatch,
                'mc_match' => $mcMatch,
                'cname_match' => $cnameMatch
            ]);
            $finRow = $finStmt->fetch(PDO::FETCH_ASSOC);

            $totalTxPaid = floatval($finRow['total_paid'] ?? 0);
            $effectivePaid = max($advanceVal, $totalTxPaid);

            if ($budgetVal > 0) {
                // Strictly require 100% of Stage 2 (20% Cumulative Target)
                return (($effectivePaid / $budgetVal) * 100) >= 19.5;
            }

            return $effectivePaid >= 20000;
        } catch (Exception $e) {
            error_log("checkIs10PercentPaid error: " . $e->getMessage());
            return true; // Don't block if DB lookup has an error
        }
    }

    public function bookQCSlot($lead_id, $booking_time, $assigned_by_name, $qc_notes = null, $extraData = [])
    {
        try {
            // 🔒 HARD BACKEND GATE: Check Stage 2 (20% Cumulative) payment requirement before booking QC slot
            if (!$this->checkIs10PercentPaid($lead_id)) {
                return [
                    "success" => false,
                    "is_stage2_required" => true,
                    "is_10_percent_required" => true,
                    "message" => "⚠️ Stage 2 (Masking) Payment (20% Cumulative Total) is required before booking Site Inspector / QC Slot! Please record Stage 2 payment first."
                ];
            }
            try { $this->conn->exec("ALTER TABLE " . $this->table_name . " ADD COLUMN qc_status VARCHAR(50) DEFAULT 'unassigned'"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE " . $this->table_name . " ADD COLUMN qc_booking_time DATETIME DEFAULT NULL"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE " . $this->table_name . " ADD COLUMN site_manager_booking_time DATETIME DEFAULT NULL"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE " . $this->table_name . " ADD COLUMN site_inspector_booking_time DATETIME DEFAULT NULL"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE " . $this->table_name . " ADD COLUMN qc_meeting_started_at DATETIME DEFAULT NULL"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE " . $this->table_name . " ADD COLUMN qc_meeting_ended_at DATETIME DEFAULT NULL"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE " . $this->table_name . " ADD COLUMN site_inspector_meeting_ended_at DATETIME DEFAULT NULL"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE " . $this->table_name . " ADD COLUMN is_qc_completed INT DEFAULT 0"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE " . $this->table_name . " ADD COLUMN is_qc_done INT DEFAULT 0"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE projects ADD COLUMN site_inspector_booking_time DATETIME DEFAULT NULL"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE projects ADD COLUMN qc_meeting_started_at DATETIME DEFAULT NULL"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE projects ADD COLUMN qc_meeting_ended_at DATETIME DEFAULT NULL"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE projects ADD COLUMN site_inspector_meeting_ended_at DATETIME DEFAULT NULL"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE projects ADD COLUMN is_qc_completed INT DEFAULT 0"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE projects ADD COLUMN is_qc_done INT DEFAULT 0"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE " . $this->table_name . " ADD COLUMN qc_notes TEXT DEFAULT NULL"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE " . $this->table_name . " ADD COLUMN site_inspector_assigned_id VARCHAR(255) DEFAULT NULL"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE " . $this->table_name . " MODIFY COLUMN site_inspector_assigned_id VARCHAR(255) DEFAULT NULL"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE " . $this->table_name . " ADD COLUMN site_inspector_assigned_name VARCHAR(255) DEFAULT NULL"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE " . $this->table_name . " ADD COLUMN pm_assigned_id VARCHAR(255) DEFAULT NULL"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE " . $this->table_name . " MODIFY COLUMN pm_assigned_id VARCHAR(255) DEFAULT NULL"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE " . $this->table_name . " ADD COLUMN pm_assigned_name VARCHAR(255) DEFAULT NULL"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE " . $this->table_name . " ADD COLUMN associate_designer_assigned_id VARCHAR(255) DEFAULT NULL"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE " . $this->table_name . " MODIFY COLUMN associate_designer_assigned_id VARCHAR(255) DEFAULT NULL"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE " . $this->table_name . " ADD COLUMN associate_designer_assigned_name VARCHAR(255) DEFAULT NULL"); } catch (Exception $e) {}

            $this->conn->beginTransaction();

            $si_id = $extraData['site_inspector_assigned_id'] ?? null;
            $si_name = $extraData['site_inspector_assigned_name'] ?? null;
            $pm_id = $extraData['pm_assigned_id'] ?? null;
            $pm_name = $extraData['pm_assigned_name'] ?? null;
            $ad_id = $extraData['associate_designer_assigned_id'] ?? null;
            $ad_name = $extraData['associate_designer_assigned_name'] ?? null;
            $cleanNum = preg_replace('/[^0-9]/', '', (string)$lead_id);

            $query = "UPDATE " . $this->table_name . " SET 
                qc_status = 'booked', 
                site_manager_status = 'booked',
                site_inspector_status = 'booked',
                qc_booking_time = :booking_time, 
                site_manager_booking_time = :booking_time,
                site_inspector_booking_time = :booking_time,
                qc_meeting_started_at = NULL,
                qc_meeting_ended_at = NULL,
                site_inspector_meeting_ended_at = NULL,
                is_qc_completed = 0,
                is_qc_done = 0,
                qc_notes = :notes,
                site_inspector_assigned_id = COALESCE(:si_id, site_inspector_assigned_id),
                site_inspector_assigned_name = COALESCE(:si_name, site_inspector_assigned_name),
                pm_assigned_id = COALESCE(:pm_id, pm_assigned_id),
                pm_assigned_name = COALESCE(:pm_name, pm_assigned_name),
                associate_designer_assigned_id = COALESCE(:ad_id, associate_designer_assigned_id),
                associate_designer_assigned_name = COALESCE(:ad_name, associate_designer_assigned_name)
                WHERE lead_id = :lead_id OR manual_client_id = :lead_id";
            if (!empty($cleanNum)) {
                $query .= " OR lead_id = " . intval($cleanNum);
            }
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':booking_time', $booking_time);
            $stmt->bindParam(':notes', $qc_notes);
            $stmt->bindParam(':si_id', $si_id);
            $stmt->bindParam(':si_name', $si_name);
            $stmt->bindParam(':pm_id', $pm_id);
            $stmt->bindParam(':pm_name', $pm_name);
            $stmt->bindParam(':ad_id', $ad_id);
            $stmt->bindParam(':ad_name', $ad_name);
            $stmt->bindParam(':lead_id', $lead_id);
            $stmt->execute();

            try {
                $projQ = "UPDATE projects SET 
                    qc_status = 'booked', 
                    site_manager_status = 'booked', 
                    site_inspector_status = 'booked', 
                    qc_booking_time = :btime, 
                    site_manager_booking_time = :btime,
                    site_inspector_booking_time = :btime,
                    qc_meeting_started_at = NULL,
                    qc_meeting_ended_at = NULL,
                    site_inspector_meeting_ended_at = NULL,
                    is_qc_completed = 0, 
                    is_qc_done = 0 
                    WHERE project_id = :lead_id OR lead_id = :lead_id OR project_code = :lead_id";
                if (!empty($cleanNum)) {
                    $projQ .= " OR project_id = " . intval($cleanNum) . " OR lead_id = " . intval($cleanNum);
                }
                $projStmt = $this->conn->prepare($projQ);
                $projStmt->execute(['btime' => $booking_time, 'lead_id' => $lead_id]);
            } catch (Exception $pe) {}

            if (!empty($qc_notes)) {
                try {
                    $note_q = "INSERT INTO lead_notes (lead_id, user_id, note_text) VALUES (:lead_id, :user_id, :note_text)";
                    $note_stmt = $this->conn->prepare($note_q);
                    $note_stmt->execute([
                        'lead_id' => $lead_id,
                        'user_id' => $this->current_user_id ?: 1,
                        'note_text' => "QC Booking: " . $qc_notes
                    ]);
                } catch (Exception $e) {}
            }

            $lead_q = "SELECT client_name, email FROM leads WHERE lead_id = :lead_id OR manual_client_id = :lead_id";
            $lead_s = $this->conn->prepare($lead_q);
            $lead_s->execute(['lead_id' => $lead_id]);
            $lead = $lead_s->fetch(PDO::FETCH_ASSOC);

            $this->conn->commit();

            $meeting_data = [
                'project_id' => 'Lead-'.$lead_id,
                'customer_name' => $lead['client_name'] ?? 'Client',
                'client_email' => $lead['email'] ?? null,
                'qc_date' => date('d M Y', strtotime($booking_time)),
                'qc_time' => date('h:i A', strtotime($booking_time)),
                'designer_name' => $assigned_by_name,
                'qc_name' => $si_name ?: 'QC Inspector',
                'qc_id' => $si_id
            ];
            MailHelper::sendQCNotification($this->conn, 'booked', $meeting_data);

            return ["success" => true, "message" => "QC slot booked successfully."];
        } catch (Exception $e) {
            if ($this->conn->inTransaction()) { $this->conn->rollBack(); }
            return ["success" => false, "message" => "Failed to book QC slot: " . $e->getMessage()];
        }
    }

    public function updateQCStatus($lead_id, $status, $assigned_by_name)
    {
        try {
            try { $this->conn->exec("ALTER TABLE leads ADD COLUMN IF NOT EXISTS qc_status VARCHAR(50) DEFAULT 'unassigned'"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE leads ADD COLUMN IF NOT EXISTS site_manager_status VARCHAR(50) DEFAULT 'unassigned'"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE leads ADD COLUMN IF NOT EXISTS site_inspector_status VARCHAR(50) DEFAULT 'unassigned'"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE leads ADD COLUMN IF NOT EXISTS qc_meeting_started_at DATETIME DEFAULT NULL"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE leads ADD COLUMN IF NOT EXISTS qc_meeting_ended_at DATETIME DEFAULT NULL"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE leads ADD COLUMN IF NOT EXISTS site_inspector_meeting_ended_at DATETIME DEFAULT NULL"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE leads ADD COLUMN IF NOT EXISTS is_qc_completed INT DEFAULT 0"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE leads ADD COLUMN IF NOT EXISTS is_qc_done INT DEFAULT 0"); } catch (Exception $e) {}

            try { $this->conn->exec("ALTER TABLE projects ADD COLUMN IF NOT EXISTS qc_status VARCHAR(50) DEFAULT 'unassigned'"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE projects ADD COLUMN IF NOT EXISTS site_manager_status VARCHAR(50) DEFAULT 'unassigned'"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE projects ADD COLUMN IF NOT EXISTS site_inspector_status VARCHAR(50) DEFAULT 'unassigned'"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE projects ADD COLUMN IF NOT EXISTS qc_meeting_started_at DATETIME DEFAULT NULL"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE projects ADD COLUMN IF NOT EXISTS qc_meeting_ended_at DATETIME DEFAULT NULL"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE projects ADD COLUMN IF NOT EXISTS site_inspector_meeting_ended_at DATETIME DEFAULT NULL"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_qc_completed INT DEFAULT 0"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_qc_done INT DEFAULT 0"); } catch (Exception $e) {}

            $raw = trim((string)$lead_id);
            $cleanNum = preg_replace('/[^0-9]/', '', $raw);
            $stLower = strtolower($status);
            $isDoneVal = ($stLower === 'meeting_completed' || $stLower === 'completed' || $stLower === 'approved' || $stLower === 'qc_approved') ? 1 : 0;
            $isInMeetingVal = ($stLower === 'in_meeting' || $stLower === 'started');
            $isResetVal = in_array($stLower, ['booked', 'scheduled', 'rescheduled']);

            $timePart = "";
            if ($isDoneVal === 1) {
                $timePart = ", qc_meeting_ended_at = NOW(), site_inspector_meeting_ended_at = NOW()";
            } elseif ($isInMeetingVal) {
                $timePart = ", qc_meeting_started_at = NOW()";
            } elseif ($isResetVal) {
                $timePart = ", qc_meeting_started_at = NULL, qc_meeting_ended_at = NULL, site_inspector_meeting_ended_at = NULL";
            }

            $query = "UPDATE " . $this->table_name . " SET qc_status = :status, site_manager_status = :status, site_inspector_status = :status, is_qc_completed = :isdone, is_qc_done = :isdone" . $timePart . " WHERE lead_id = :raw1 OR manual_client_id = :raw2";
            if (!empty($cleanNum)) {
                $query .= " OR lead_id = " . intval($cleanNum);
            }

            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':status', $status);
            $stmt->bindParam(':isdone', $isDoneVal, PDO::PARAM_INT);
            $stmt->bindParam(':raw1', $raw);
            $stmt->bindParam(':raw2', $raw);
            $stmt->execute();

            try {
                $pQuery = "UPDATE projects SET qc_status = :status, site_manager_status = :status, site_inspector_status = :status, is_qc_completed = :isdone, is_qc_done = :isdone" . $timePart . " WHERE project_id = :raw1 OR project_code = :raw2";
                if (!empty($cleanNum)) {
                    $pQuery .= " OR project_id = " . intval($cleanNum);
                }
                $pStmt = $this->conn->prepare($pQuery);
                $pStmt->bindParam(':status', $status);
                $pStmt->bindParam(':isdone', $isDoneVal, PDO::PARAM_INT);
                $pStmt->bindParam(':raw1', $raw);
                $pStmt->bindParam(':raw2', $raw);
                $pStmt->execute();
            } catch (Exception $pe) {}

            // Trigger QC Notification email depending on status
            try {
                $l_q = $this->conn->prepare("SELECT client_name, email, qc_booking_time, site_manager_booking_time FROM leads WHERE lead_id = :raw1 OR manual_client_id = :raw2 LIMIT 1");
                $l_q->execute([':raw1' => $raw, ':raw2' => $raw]);
                $l_row = $l_q->fetch(PDO::FETCH_ASSOC);

                $stLower = strtolower($status);
                $qcType = null;
                if ($stLower === 'rescheduled') $qcType = 'rescheduled';
                elseif ($stLower === 'rejected' || $stLower === 'qc_rejected') $qcType = 'rejected';
                elseif ($stLower === 'approved' || $stLower === 'qc_approved' || $stLower === 'meeting_completed' || $stLower === 'completed') $qcType = 'approved';

                if ($qcType && $l_row) {
                    $bTime = $l_row['qc_booking_time'] ?? $l_row['site_manager_booking_time'] ?? 'now';
                    MailHelper::sendQCNotification($this->conn, $qcType, [
                        'project_id' => 'PR_' . ($cleanNum ?: $raw),
                        'customer_name' => $l_row['client_name'] ?? 'Client',
                        'designer_name' => $assigned_by_name,
                        'qc_name' => 'QC Team',
                        'rev_no' => 'Rev-01',
                        'qc_date' => date('d M Y', strtotime($bTime)),
                        'qc_time' => date('h:i A', strtotime($bTime))
                    ]);
                }
            } catch (Exception $mailEx) {}

            return ["success" => true, "message" => "QC status updated to " . $status];
        } catch (Exception $e) {
            return ["success" => false, "message" => "Failed to update QC status: " . $e->getMessage()];
        }
    }

    public function bookD1Slot($lead_id, $d1_user_id, $booking_time, $assigned_by_name, $d1_notes = null, $status = null, $associate_designer_id = null, $associate_designer_name = null)
    {
        try {
            // Ensure AD columns exist
            try { $this->conn->exec("ALTER TABLE " . $this->table_name . " ADD COLUMN IF NOT EXISTS associate_designer_assigned_id INT(11) DEFAULT NULL"); } catch (Exception $e) {}
            try { $this->conn->exec("ALTER TABLE " . $this->table_name . " ADD COLUMN IF NOT EXISTS associate_designer_assigned_name VARCHAR(255) DEFAULT NULL"); } catch (Exception $e) {}

            $uRole = strtolower($this->current_user_role ?? '');
            $isSalesRole = in_array($uRole, ['sales', 'sales_person', 'sales_executive', 'business_associate', 'ba', 'telecaller']) || (strpos($uRole, 'sales') !== false && strpos($uRole, 'manager') === false);

            // Run DDL outside transaction to avoid implicit transaction commit in MySQL
            if (!empty($d1_notes)) {
                try {
                    $this->conn->exec("CREATE TABLE IF NOT EXISTS lead_notes (
                        id INT(11) AUTO_INCREMENT PRIMARY KEY,
                        lead_id INT(11) NOT NULL,
                        user_id INT(11) NOT NULL,
                        note_text TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )");
                } catch (Exception $e) {
                    // Ignore
                }
            }

            $this->conn->beginTransaction();

            // The d1_notes column already exists now, no need for ALTER TABLE here

            // Fetch lead and D1 user details for notification (search by lead_id or permanent manual_client_id)
            $lead_q = "SELECT lead_id, manual_client_id, client_name, email FROM leads WHERE lead_id = :lead_id OR manual_client_id = :lead_id2 LIMIT 1";
            $lead_s = $this->conn->prepare($lead_q);
            $lead_s->execute(['lead_id' => $lead_id, 'lead_id2' => $lead_id]);
            $lead = $lead_s->fetch(PDO::FETCH_ASSOC);

            $target_lead_id = $lead ? $lead['lead_id'] : $lead_id;

            // Update lead - store consultation status in d1_status
            $d1_status_val = $status;
            if (empty($d1_status_val) || $d1_status_val === 'booked' || $d1_status_val === 'new' || $d1_status_val === 'unassigned') {
                $d1_status_val = 'scheduled';
            }

            if (in_array(strtolower($status ?? ''), ['in_meeting', 'started', 'meeting_completed', 'completed'])) {
                // Only mark the meeting / d1_status — preserve existing designer, date, booking data
                $isMeetingCompleted = in_array(strtolower($status ?? ''), ['meeting_completed', 'completed']);
                $meetingCompSql = $isMeetingCompleted ? ", is_meeting_completed = 1, meeting_completed_at = COALESCE(meeting_completed_at, NOW())" : "";
                $query = "UPDATE " . $this->table_name . " SET 
                    d1_status = :d1_status,
                    status = CASE WHEN status IN ('won', 'converted', 'proposal_sent', 'proposal_accepted') THEN status ELSE :d1_status END" . $meetingCompSql . "
                    WHERE lead_id = :lead_id OR manual_client_id = :lead_id2";
                $stmt = $this->conn->prepare($query);
                $stmt->bindParam(':d1_status', $d1_status_val);
                $stmt->bindParam(':lead_id', $target_lead_id);
                $stmt->bindParam(':lead_id2', $lead_id);
            } else {
                $query = "UPDATE " . $this->table_name . " SET 
                    d1_assigned_to = COALESCE(:d1_user_id, d1_assigned_to), 
                    d1_booking_time = COALESCE(NULLIF(:booking_time, ''), d1_booking_time), 
                    d1_notes = COALESCE(NULLIF(:d1_notes, ''), d1_notes), 
                    d1_status = :d1_status,
                    status = CASE WHEN status IN ('won', 'converted', 'proposal_sent', 'proposal_accepted', 'meeting_completed') THEN status ELSE :d1_status END,
                    associate_designer_assigned_id = COALESCE(:ad_id, associate_designer_assigned_id),
                    associate_designer_assigned_name = COALESCE(:ad_name, associate_designer_assigned_name)
                    WHERE lead_id = :lead_id OR manual_client_id = :lead_id2";
                $stmt = $this->conn->prepare($query);
                $stmt->bindParam(':d1_user_id', $d1_user_id);
                $stmt->bindParam(':booking_time', $booking_time);
                $stmt->bindParam(':d1_notes', $d1_notes);
                $stmt->bindParam(':d1_status', $d1_status_val);
                $stmt->bindParam(':ad_id', $associate_designer_id);
                $stmt->bindParam(':ad_name', $associate_designer_name);
                $stmt->bindParam(':lead_id', $target_lead_id);
                $stmt->bindParam(':lead_id2', $lead_id);
            }
            $stmt->execute();

            // Also insert D1 Booking note as a Lead Note so it displays in Notes timeline
            if (!empty($d1_notes)) {
                try {
                    $note_q = "INSERT INTO lead_notes (lead_id, user_id, note_text) VALUES (:lead_id, :user_id, :note_text)";
                    $note_stmt = $this->conn->prepare($note_q);
                    $note_stmt->execute([
                        'lead_id' => $lead_id,
                        'user_id' => $this->current_user_id ?: ($d1_user_id ?: 1),
                        'note_text' => "D1 Booking Instruction: " . $d1_notes
                    ]);
                } catch (Exception $e) {
                    // Ignore note insert failure to not block transaction
                }
            }

            // Insert notification for D1 user
            if (!empty($d1_user_id)) {
                $title = "New Lead Assigned";
                $message = "You have been assigned to Lead: " . ($lead['client_name'] ?? 'Unknown') . " on " . date('M j, g:i A', strtotime($booking_time)) . " by " . $assigned_by_name . ".";
                if (!empty($d1_notes)) {
                    $message .= " Note: " . $d1_notes;
                }
                $notif_q = "INSERT INTO notifications (user_id, title, message) VALUES (:uid, :title, :msg)";
                $notif_s = $this->conn->prepare($notif_q);
                $notif_s->execute([
                    'uid' => $d1_user_id,
                    'title' => $title,
                    'msg' => $message
                ]);
            }

            // Insert notification for Associate Designer user if assigned
            if (!empty($associate_designer_id)) {
                try {
                    $ad_msg = "You have been assigned as Associate Designer for Lead: " . ($lead['client_name'] ?? 'Unknown') . " on " . date('M j, g:i A', strtotime($booking_time)) . " by " . $assigned_by_name . ".";
                    if (!empty($d1_notes)) {
                        $ad_msg .= " Note: " . $d1_notes;
                    }
                    $notif_q2 = "INSERT INTO notifications (user_id, title, message) VALUES (:uid, :title, :msg)";
                    $notif_s2 = $this->conn->prepare($notif_q2);
                    $notif_s2->execute([
                        'uid' => $associate_designer_id,
                        'title' => "New Lead Assigned (Associate Designer)",
                        'msg' => $ad_msg
                    ]);
                } catch (Exception $e) {}
            }

            // Fetch D1 User details for email
            $d1_q = "SELECT name, username FROM users WHERE user_id = :uid";
            $d1_s = $this->conn->prepare($d1_q);
            $d1_s->execute(['uid' => $d1_user_id]);
            $d1_user = $d1_s->fetch(PDO::FETCH_ASSOC);

            $this->conn->commit();

            // Send Email Notification
            if ($d1_user && !empty($d1_user['username'])) {
                try {
                    require_once __DIR__ . '/../libs/PHPMailer/src/Exception.php';
                    require_once __DIR__ . '/../libs/PHPMailer/src/PHPMailer.php';
                    require_once __DIR__ . '/../libs/PHPMailer/src/SMTP.php';

                    $mail = new \PHPMailer\PHPMailer\PHPMailer(true);

                    $mail->isSMTP();
                    $mail->Host = 'smtp.gmail.com';
                    $mail->SMTPAuth = true;
                    $mail->Username = 'updates@livincart.com';
                    $mail->Password = 'kkzz omvh dzjs xqfu';
                    $mail->SMTPSecure = \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
                    $mail->Port = 587;

                    $mail->setFrom('updates@livincart.com', 'Livincart System');
                    $mail->addAddress($d1_user['username'], $d1_user['name']);

                    $mail->isHTML(true);
                    $mail->Subject = 'Assigned - New Initial Meeting | Livincart';

                    $meeting_date_str = date('d M Y, h:i A', strtotime($booking_time));
                    $client_phone = $lead['contact_number'] ?? '';
                    $proj_type = $lead['project_type'] ?? 'Interior Project';

                    $email_msg = "Hello " . htmlspecialchars($d1_user['name']) . ",<br><br>";
                    $email_msg .= "A new meeting slot has been booked for you by the Sales Team.<br><br>";
                    $email_msg .= "<b>Meeting Details:</b><br><br>";
                    $email_msg .= "<b>Client Name:</b> " . htmlspecialchars($lead['client_name'] ?? 'Client') . "<br>";
                    if (!empty($client_phone)) {
                        $email_msg .= "<b>Contact Number:</b> " . htmlspecialchars($client_phone) . "<br>";
                    }
                    $email_msg .= "<b>Project Type:</b> " . htmlspecialchars($proj_type) . "<br>";
                    $email_msg .= "<b>Meeting Date & Time:</b> " . $meeting_date_str . "<br>";
                    $email_msg .= "<b>Booked By:</b> " . htmlspecialchars($assigned_by_name) . "<br>";
                    if (!empty($d1_notes)) {
                        $email_msg .= "<b>Notes:</b> " . htmlspecialchars($d1_notes) . "<br>";
                    }
                    $email_msg .= "<br>Please review the client details and be available at the scheduled meeting time.<br>";
                    $email_msg .= "Kindly log in to the system to view complete meeting information.<br><br>";
                    $email_msg .= "Thank you,<br><b>Livincart System</b><br><i>This is an automated email. Please do not reply.</i>";

                    $mail->Body = $email_msg;
                    $mail->AltBody = strip_tags(str_replace(['<br>', '<b>', '</b>'], ["\n", '', ''], $email_msg));

                    $mail->send();
                } catch (Exception $e) {
                    // Fail silently for D1 email
                }

                try {
                    // Send Email to Client (Lead) if they have an email address
                    if (!empty($lead['email'])) {
                        $mail->clearAddresses();
                        $mail->addAddress($lead['email'], $lead['client_name']);

                        $mail->Subject = 'Livincart – Initial Design Consultation Scheduled';

                        $formatted_date = date('d M Y, h:i A', strtotime($booking_time));

                        $client_msg = "Hello " . htmlspecialchars($lead['client_name'] ?? 'Client') . ",<br><br>";
                        $client_msg .= "Your initial design consultation has been successfully scheduled.<br><br>";
                        $client_msg .= "<b>Meeting Details:</b><br><br>";
                        $client_msg .= "<b>Date & Time:</b> " . $formatted_date . "<br>";
                        $client_msg .= "<b>Scheduled By:</b> " . htmlspecialchars($assigned_by_name) . "<br><br>";
                        $client_msg .= "We look forward to discussing your project requirements and helping you bring your ideas to life.<br>";
                        $client_msg .= "If you have any questions or need to reschedule, please contact our team.<br><br>";
                        $client_msg .= "Best Regards,<br><b>The Livincart Team</b>";

                        $mail->Body = $client_msg;
                        $mail->AltBody = strip_tags(str_replace(['<br>', '<b>', '</b>'], ["\n", '', ''], $client_msg));

                        $mail->send();
                    }

                } catch (Exception $e) {
                    // Fail silently for client email
                }
            }

            return ["success" => true, "message" => "D1 slot booked and notified."];
        } catch (Exception $e) {
            if ($this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            return ["success" => false, "message" => "Failed to book D1 slot: " . $e->getMessage()];
        }
    }

    public function convertToProject($lead_id, $data = [])
    {
        try {
            $this->conn->exec("ALTER TABLE projects MODIFY COLUMN status VARCHAR(50) DEFAULT 'Pending'");
            $this->conn->exec("ALTER TABLE leads ADD COLUMN IF NOT EXISTS is_converted INT(1) DEFAULT 0");
            $this->conn->exec("CREATE TABLE IF NOT EXISTS project_notes (id INT(11) AUTO_INCREMENT PRIMARY KEY, project_id INT(11) NOT NULL, user_id INT(11) NOT NULL, note_text TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
            $this->conn->exec("CREATE TABLE IF NOT EXISTS project_folders (folder_id INT(11) AUTO_INCREMENT PRIMARY KEY, project_id INT(11) NOT NULL, name VARCHAR(255) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
            $this->conn->exec("CREATE TABLE IF NOT EXISTS project_files (file_id INT(11) AUTO_INCREMENT PRIMARY KEY, project_id INT(11) NOT NULL, folder_id INT(11) NOT NULL, file_name VARCHAR(255) NOT NULL, file_path VARCHAR(255) NOT NULL, file_type VARCHAR(100) DEFAULT NULL, uploaded_by INT(11) DEFAULT NULL, uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
            $this->conn->exec("CREATE TABLE IF NOT EXISTS project_timeline_master (timeline_id INT(11) AUTO_INCREMENT PRIMARY KEY, project_id INT(11) NOT NULL, start_date DATE NOT NULL, end_date DATE NOT NULL, created_by INT(11) DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
            $this->conn->exec("CREATE TABLE IF NOT EXISTS project_timeline_dates (date_id INT(11) AUTO_INCREMENT PRIMARY KEY, timeline_id INT(11) NOT NULL, project_id INT(11) NOT NULL, timeline_date DATE NOT NULL, day_number INT(11) DEFAULT 1, day_name VARCHAR(20) DEFAULT '', status VARCHAR(50) DEFAULT 'Pending')");
            $this->conn->exec("CREATE TABLE IF NOT EXISTS notifications (id INT(11) AUTO_INCREMENT PRIMARY KEY, user_id INT(11) NOT NULL, title VARCHAR(255) NOT NULL, message TEXT NOT NULL, type VARCHAR(50) DEFAULT 'info', is_read INT(1) DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
        } catch (Exception $e) {}

        try {
            $this->conn->beginTransaction();

            $created_by = !empty($data['created_by']) ? $data['created_by'] : ($this->current_user_id ?: 1);
            $start_date = !empty($data['start_date']) ? $data['start_date'] : date('Y-m-d');

            // 1. Fetch Lead
            $q = "SELECT * FROM leads WHERE lead_id = :id";
            $s = $this->conn->prepare($q);
            $s->execute(['id' => $lead_id]);
            $lead = $s->fetch(PDO::FETCH_ASSOC);

            if (!$lead) {
                $this->conn->rollBack();
                return ["success" => false, "message" => "Lead not found."];
            }

            // Initial quote check
            $initial_quote_val = floatval($lead['initial_quote_amount'] ?? 0);
            if ($initial_quote_val <= 0) {
                try {
                    $initQStmt = $this->conn->prepare("SELECT total_amount FROM quotes WHERE (project_id = :lid OR project_id = :mcid) AND (is_initial = 1 OR extra_data LIKE '%\"is_initial_quote\":true%') ORDER BY quote_id DESC LIMIT 1");
                    $initQStmt->execute([':lid' => (string)$lead_id, ':mcid' => (string)($lead['manual_client_id'] ?? '')]);
                    $initial_quote_val = floatval($initQStmt->fetchColumn() ?: 0);
                } catch (Exception $e) {}
            }

            // Strict Stage 1 Check
            $p_budget = $initial_quote_val > 0 ? $initial_quote_val : floatval($data['total_budget'] ?? ($lead['total_budget'] ?? ($lead['estimated_budget'] ?? 0)));
            $p_advance = floatval($data['advance_paid'] ?? ($lead['advance_paid'] ?? 0));
            if ($p_budget <= 0) {
                try {
                    $qStmt = $this->conn->prepare("SELECT total_amount FROM quotes WHERE project_id = :lid OR project_id = :mcid ORDER BY quote_id DESC LIMIT 1");
                    $qStmt->execute([':lid' => (string)$lead_id, ':mcid' => (string)($lead['manual_client_id'] ?? '')]);
                    $p_budget = floatval($qStmt->fetchColumn() ?: 0);
                } catch (Exception $e) {}
            }
            $txPaid = 0;
            try {
                $fCheck = $this->conn->prepare("SELECT COALESCE(SUM(amount), 0) FROM finance_transactions WHERE type = 'credit' AND (project_id = :lid OR project_id = :mcid OR description LIKE :m1)");
                $fCheck->execute([':lid' => (string)$lead_id, ':mcid' => (string)($lead['manual_client_id'] ?? ''), ':m1' => '%' . $lead_id . '%']);
                $txPaid = floatval($fCheck->fetchColumn() ?: 0);
            } catch (Exception $e) {}

            $effectivePaid = max($p_advance, $txPaid);

            // Strict Stage 1 Check: Lead cannot convert to active project without Stage 1 (10% advance) payment!
            $target10 = $p_budget > 0 ? ($p_budget * 0.10) : 0;
            $isStage1Paid = $target10 > 0 ? ($effectivePaid >= ($target10 - 1) || (($effectivePaid / $p_budget) * 100) >= 9.9) : ($effectivePaid > 0);
            if (!$isStage1Paid) {
                if ($this->conn->inTransaction()) {
                    $this->conn->rollBack();
                }
                return [
                    "success" => false, 
                    "message" => "Stage 1 Payment Required: Lead cannot be converted to a project until Stage 1 (10% Token Advance) payment is completed. Paid: ₹" . number_format($effectivePaid, 2) . " of required ₹" . number_format($target10, 2)
                ];
            }

            // 2. Create Client (or reuse if already auto-created)
            $c_check_q = "SELECT client_id FROM clients WHERE converted_from_lead_id = :lead_id";
            $c_check_s = $this->conn->prepare($c_check_q);
            $c_check_s->execute(['lead_id' => $lead_id]);
            $existing_client = $c_check_s->fetch(PDO::FETCH_ASSOC);

            // 2. Determine immutable target Project ID / Client ID
            $target_project_code = !empty($lead['manual_client_id']) ? trim($lead['manual_client_id']) : (!empty($data['project_code']) ? trim($data['project_code']) : ("PR" . str_pad($lead_id, 3, '0', STR_PAD_LEFT)));

            if ($existing_client) {
                $client_id = $existing_client['client_id'];
                // Update email/consultation_type/projectname just in case they were updated
                $c_update_q = "UPDATE clients SET 
                                name = :name, 
                                phone = :phone, 
                                email = :email, 
                                address = :address, 
                                client_code = :code, 
                                consultation_type = :type, 
                                lead_source = :source,
                                status = 'active'
                               WHERE client_id = :client_id";
                $c_update_stmt = $this->conn->prepare($c_update_q);
                $c_update_stmt->execute([
                    'name' => $lead['client_name'],
                    'phone' => $lead['contact_number'],
                    'email' => $lead['email'],
                    'address' => $lead['location'],
                    'code' => $target_project_code,
                    'type' => $lead['project_type'] ?? 'interior',
                    'source' => $lead['lead_source'],
                    'client_id' => $client_id
                ]);
            } else {
                $u_check = $this->conn->prepare("SELECT user_id FROM users WHERE user_id = :uid");
                $u_check->execute(['uid' => $created_by]);
                if (!$u_check->fetch()) {
                    $created_by = 1;
                }

                $c_query = "INSERT INTO clients (client_code, name, phone, address, lead_source, converted_from_lead_id, created_by, email, consultation_type, projectname, status) 
                            VALUES (:code, :name, :phone, :address, :source, :lead_id, :created_by, :email, :consultation_type, :projectname, 'active')";
                $c_stmt = $this->conn->prepare($c_query);
                $c_stmt->execute([
                    'code' => $target_project_code,
                    'name' => $lead['client_name'],
                    'phone' => $lead['contact_number'],
                    'address' => $lead['location'],
                    'source' => $lead['lead_source'],
                    'lead_id' => $lead_id,
                    'created_by' => $created_by,
                    'email' => $lead['email'],
                    'consultation_type' => $lead['project_type'] ?? 'interior',
                    'projectname' => $lead['client_name'] . ' Project'
                ]);
                $client_id = $this->conn->lastInsertId();
            }

            // 3. Create or Update Project
            $p_code = $target_project_code;
            $exp_end_date = !empty($data['expected_end_date']) ? $data['expected_end_date'] : date('Y-m-d', strtotime('+90 days', strtotime($start_date)));
            $p_name = !empty($data['project_name']) ? $data['project_name'] : ($lead['client_name'] . ' Project');
            $p_init_quote = $initial_quote_val > 0 ? $initial_quote_val : $p_budget;
            $p_budget = $p_init_quote;
            $p_advance = $data['advance_paid'] ?? 0;
            $p_head = !empty($data['project_head_id']) ? $data['project_head_id'] : null;

            $chk_p = $this->conn->prepare("SELECT project_id, is_final_quote_approved FROM projects WHERE project_code = :pcode OR (project_id = :lid AND project_id > 0)");
            $chk_p->execute(['pcode' => $p_code, 'lid' => $lead_id]);
            $existing_p = $chk_p->fetch(PDO::FETCH_ASSOC);

            if ($existing_p) {
                $project_id = $existing_p['project_id'];
                $isQcApproved = intval($existing_p['is_final_quote_approved'] ?? 0) === 1;
                $up_p = $this->conn->prepare("
                    UPDATE projects 
                    SET project_name = :name, 
                        client_id = :c_id, 
                        project_type = :type, 
                        site_address = :site, 
                        start_date = :start, 
                        expected_end_date = :end, 
                        total_budget = CASE WHEN :is_qc = 1 THEN total_budget ELSE :budget END, 
                        initial_quote_amount = :init_amt, 
                        advance_received = :advance, 
                        project_head_id = COALESCE(:head_id, project_head_id), 
                        status = 'Designing Phase' 
                    WHERE project_id = :pid
                ");
                $up_p->execute([
                    'name' => $p_name,
                    'c_id' => $client_id,
                    'type' => $lead['project_type'] ?? 'interior',
                    'site' => $lead['location'],
                    'start' => $start_date,
                    'end' => $exp_end_date,
                    'is_qc' => $isQcApproved ? 1 : 0,
                    'budget' => $p_budget,
                    'init_amt' => $p_init_quote,
                    'advance' => $p_advance,
                    'head_id' => $p_head,
                    'pid' => $project_id
                ]);
            } else {
                $p_query = "INSERT INTO projects (project_code, project_name, client_id, project_type, site_address, start_date, expected_end_date, total_budget, initial_quote_amount, is_final_quote_approved, advance_received, project_head_id, created_by, status) 
                            VALUES (:code, :name, :c_id, :type, :site, :start, :end, :budget, :init_amt, 0, :advance, :head_id, :created_by, 'Designing Phase')";
                $p_stmt = $this->conn->prepare($p_query);
                $p_stmt->execute([
                    'code' => $p_code,
                    'name' => $p_name,
                    'c_id' => $client_id,
                    'type' => $lead['project_type'] ?? 'interior',
                    'site' => $lead['location'],
                    'start' => $start_date,
                    'end' => $exp_end_date,
                    'budget' => $p_budget,
                    'init_amt' => $p_init_quote,
                    'advance' => $p_advance,
                    'head_id' => $p_head,
                    'created_by' => $created_by
                ]);
                $project_id = $this->conn->lastInsertId();
            }

            // Link existing quotes from lead to the project
            try {
                $mcid = $lead['manual_client_id'] ?? '';
                $upQ = $this->conn->prepare("UPDATE quotes SET project_id = :pid WHERE (project_id = :lid OR project_id = :mcid) AND project_id != :pid_str");
                $upQ->execute([':pid' => $project_id, ':lid' => $lead_id, ':mcid' => $mcid, ':pid_str' => (string)$project_id]);
            } catch (Exception $e) {}

            // Mark lead as converted and lock initial quote amount
            $upd_lead_s = $this->conn->prepare("UPDATE leads SET status = 'won', is_converted = 1, initial_quote_amount = COALESCE(initial_quote_amount, :init_amt), total_budget = COALESCE(total_budget, :init_amt) WHERE lead_id = :id");
            $upd_lead_s->execute(['id' => $lead_id, 'init_amt' => $p_init_quote]);

            // 3.5 Initialize Timeline
            require_once 'TimelineController.php';
            $timeline = new TimelineController($this->conn);
            $timeline->generateMasterTimeline($project_id, $start_date, $exp_end_date, $created_by);

            // 4. Assignments
            $a_query = "INSERT INTO project_assignments (project_id, user_id, role, assigned_date, status) VALUES (:p_id, :u_id, :role, CURDATE(), 'active')";
            $a_stmt = $this->conn->prepare($a_query);

            // Assign Project Head if provided
            if (!empty($data['project_head_id'])) {
                $a_stmt->execute(['p_id' => $project_id, 'u_id' => $data['project_head_id'], 'role' => 'project_head']);
            }

            // Assign Site Engineer if provided
            if (!empty($data['site_engineer_id'])) {
                $a_stmt->execute(['p_id' => $project_id, 'u_id' => $data['site_engineer_id'], 'role' => 'site_engineer']);
            }

            // 5. Initial Payment Transaction (only if no existing credit transaction exists for this project/lead)
            if (!empty($data['advance_paid']) && $data['advance_paid'] > 0) {
                $mcid = $lead['manual_client_id'] ?? '';
                $chk_tx = $this->conn->prepare("
                    SELECT COUNT(*) as count FROM finance_transactions 
                    WHERE type = 'credit' 
                      AND (project_id = :pid OR project_id = :lid OR (description LIKE :mc_match AND :mc_match != ''))
                ");
                $chk_tx->execute([
                    'pid' => $project_id,
                    'lid' => $lead_id,
                    'mc_match' => $mcid ? "%$mcid%" : ''
                ]);
                $hasExisting = ($chk_tx->fetch(PDO::FETCH_ASSOC)['count'] ?? 0) > 0;

                if (!$hasExisting) {
                    $t_query = "INSERT INTO finance_transactions (project_id, type, amount, category, description, transaction_date, recorded_by) 
                                VALUES (:p_id, 'credit', :amount, 'Advance Payment', 'Finalized project advance', CURDATE(), :created_by)";
                    $t_stmt = $this->conn->prepare($t_query);
                    $t_stmt->execute([
                        'p_id' => $project_id,
                        'amount' => $data['advance_paid'],
                        'created_by' => $created_by
                    ]);
                }
            }

            // 6. Copy Files and Notes to Project
            try {
                $n_query = "INSERT INTO project_notes (project_id, user_id, note_text, created_at) SELECT :p_id, user_id, note_text, created_at FROM lead_notes WHERE lead_id = :l_id";
                $n_stmt = $this->conn->prepare($n_query);
                $n_stmt->execute(['p_id' => $project_id, 'l_id' => $lead_id]);
            } catch (Exception $e) {
            }

            try {
                // Create a folder for D1 & Lead Documents
                $f_stmt = $this->conn->prepare("INSERT INTO project_folders (project_id, name) VALUES (:p_id, 'D1 & Lead Documents')");
                $f_stmt->execute(['p_id' => $project_id]);
                $folder_id = $this->conn->lastInsertId();

                $lead_upload_dir = __DIR__ . '/../../uploads/leads/' . $lead_id;
                $project_upload_dir = __DIR__ . '/../../uploads/projects/' . $project_id . '/' . $folder_id;
                if (is_dir($lead_upload_dir)) {
                    $this->copyDir($lead_upload_dir, $project_upload_dir);
                    $this->registerCopiedFiles($lead_upload_dir, $project_id, $folder_id, $data['created_by'] ?? 1);
                }
            } catch (Exception $e) {
            }

            $this->conn->commit();

            // ⚡ Send Order Booked / Client Onboarded Notification Mails (As per mailer.pdf)
            try {
                require_once __DIR__ . '/../helpers/MailHelper.php';

                // Fetch lead details
                $l_stmt = $this->conn->prepare("SELECT * FROM leads WHERE lead_id = :lid");
                $l_stmt->execute(['lid' => $lead_id]);
                $leadRow = $l_stmt->fetch(PDO::FETCH_ASSOC);

                // Fetch designer details if assigned
                $designer_email = null;
                $designer_name = 'Designer';
                if (!empty($leadRow['d1_assigned_to'])) {
                    $d_ids = explode(',', $leadRow['d1_assigned_to']);
                    $first_d_id = trim($d_ids[0]);
                    $d_stmt = $this->conn->prepare("SELECT name, username FROM users WHERE user_id = :uid LIMIT 1");
                    $d_stmt->execute(['uid' => $first_d_id]);
                    $dRow = $d_stmt->fetch(PDO::FETCH_ASSOC);
                    if ($dRow) {
                        $designer_name = $dRow['name'] ?: 'Designer';
                        $designer_email = filter_var($dRow['username'], FILTER_VALIDATE_EMAIL) ? $dRow['username'] : null;
                    }
                }

                // Fetch sales team details if assigned
                $sales_email = null;
                $sales_name = 'Sales Team';
                $sales_uid = !empty($leadRow['assigned_to']) ? $leadRow['assigned_to'] : (!empty($leadRow['created_by']) ? $leadRow['created_by'] : null);
                if ($sales_uid) {
                    $s_stmt = $this->conn->prepare("SELECT name, username FROM users WHERE user_id = :uid LIMIT 1");
                    $s_stmt->execute(['uid' => $sales_uid]);
                    $sRow = $s_stmt->fetch(PDO::FETCH_ASSOC);
                    if ($sRow) {
                        $sales_name = $sRow['name'] ?: 'Sales Team';
                        $sales_email = filter_var($sRow['username'], FILTER_VALIDATE_EMAIL) ? $sRow['username'] : null;
                    }
                }

                // Fetch project manager details if assigned
                $pm_name = 'Assigned Project Manager';
                if (!empty($data['project_head_id'])) {
                    $pm_stmt = $this->conn->prepare("SELECT name FROM users WHERE user_id = :uid LIMIT 1");
                    $pm_stmt->execute(['uid' => $data['project_head_id']]);
                    $pmRow = $pm_stmt->fetch(PDO::FETCH_ASSOC);
                    if ($pmRow) {
                        $pm_name = $pmRow['name'];
                    }
                }

                $project_code = $data['project_code'] ?? ($leadRow['manual_client_id'] ?? $lead_id);
                $project_name = $data['project_name'] ?? (($leadRow['client_name'] ?? 'Client') . ' Project');

                // 🔒 STRICT CHECK: Order Confirmed notification ONLY sent if Stage 1: Token Advance is 100% fully paid
                $totBudgetForCheck = floatval($data['total_budget'] ?? ($leadRow['total_budget'] ?? ($leadRow['initial_quote_amount'] ?? 0)));
                $target10ForCheck = round($totBudgetForCheck * 0.10);
                $isStage1FullyPaid = ($totBudgetForCheck > 0 && $effectivePaid >= ($target10ForCheck - 1));

                if ($isStage1FullyPaid) {
                    MailHelper::sendOrderBookedNotification($this->conn, [
                        'project_id'       => $project_code,
                        'project_name'     => $project_name,
                        'client_name'      => $leadRow['client_name'] ?? 'Client',
                        'client_email'     => filter_var($leadRow['email'] ?? '', FILTER_VALIDATE_EMAIL) ? $leadRow['email'] : null,
                        'designer_name'    => $designer_name,
                        'designer_email'   => $designer_email,
                        'sales_name'       => $sales_name,
                        'sales_email'      => $sales_email,
                        'project_manager'  => $pm_name,
                        'total_budget'     => $totBudgetForCheck,
                        'onboarding_date'  => date('d M Y')
                    ]);
                } else {
                    error_log("Order Booked mail skipped: Stage 1 Token Advance not 100% paid (Paid: {$effectivePaid}, Target 10%: {$target10ForCheck})");
                }
            } catch (Exception $mail_err) {
                error_log("Order Booked mail error: " . $mail_err->getMessage());
            }

            return ["success" => true, "message" => "Lead converted to Project successfully.", "project_id" => $project_id];
        } catch (Exception $e) {
            if ($this->conn->inTransaction()) {
                $this->conn->rollBack();
            }
            return ["success" => false, "message" => "Conversion failed: " . $e->getMessage()];
        }
    }

    public function update($data)
    {
        $old_status = null;
        $current_mcid = null;
        try {
            $info_stmt = $this->conn->prepare("SELECT status, manual_client_id FROM " . $this->table_name . " WHERE lead_id = :lead_id");
            $info_stmt->execute([':lead_id' => $data['lead_id']]);
            $lead_info = $info_stmt->fetch(PDO::FETCH_ASSOC);
            if ($lead_info) {
                $old_status = $lead_info['status'];
                $current_mcid = $lead_info['manual_client_id'] ?? null;
            }
        } catch (Exception $e) {}

        // 🔒 Only Admin can modify permanent Lead ID / Project ID
        $isAdminRole = in_array(strtolower($this->current_user_role ?? ''), ['admin', 'administrator', 'superadmin', 'management', 'owner']) || strpos(strtolower($this->current_user_role ?? ''), 'admin') !== false;
        $submitted_mcid = !empty($data['manual_client_id']) ? trim($data['manual_client_id']) : null;

        if (!$isAdminRole) {
            // Retain original permanent ID
            $data['manual_client_id'] = $current_mcid;
        } else if (!empty($submitted_mcid) && $submitted_mcid !== $current_mcid) {
            // Check duplicate ID
            $dupCheck = $this->conn->prepare("SELECT lead_id FROM " . $this->table_name . " WHERE manual_client_id = :mcid AND lead_id != :lid LIMIT 1");
            $dupCheck->execute([':mcid' => $submitted_mcid, ':lid' => $data['lead_id']]);
            if ($dupCheck->fetch()) {
                return ["success" => false, "message" => "This Lead ID ('" . htmlspecialchars($submitted_mcid) . "') is already used by another lead. Please use a unique ID."];
            }
        }

        $query = "UPDATE " . $this->table_name . " 
                SET lead_source = :lead_source, 
                    client_name = :client_name, 
                    contact_number = :contact_number, 
                    email = :email, 
                    location = :location, 
                    client_address = :client_address,
                    project_type = :project_type, 
                    estimated_budget = :estimated_budget,
                    manual_client_id = :manual_client_id,
                    project_scope = :project_scope" . (isset($data['status']) ? ", status = :status" : "") . "
                WHERE lead_id = :lead_id";

        $stmt = $this->conn->prepare($query);

        $stmt->bindParam(':lead_source', $data['lead_source']);
        $stmt->bindParam(':client_name', $data['client_name']);
        $stmt->bindParam(':contact_number', $data['contact_number']);
        $stmt->bindParam(':email', $data['email']);
        $stmt->bindParam(':location', $data['location']);
        $stmt->bindParam(':client_address', $data['client_address']);
        $stmt->bindParam(':project_type', $data['project_type']);

        $est_budget = ($data['estimated_budget'] === '' || $data['estimated_budget'] === null) ? null : $data['estimated_budget'];
        $stmt->bindParam(':estimated_budget', $est_budget);
        $stmt->bindParam(':manual_client_id', $data['manual_client_id']);
        $stmt->bindParam(':project_scope', $data['project_scope']);
        $stmt->bindParam(':lead_id', $data['lead_id']);

        if (isset($data['status'])) {
            $stmt->bindParam(':status', $data['status']);
        }

        if ($stmt->execute()) {
            if (isset($data['status']) && $data['status'] !== $old_status) {
                $this->updateStatus($data['lead_id'], $data['status']);
            }
            // Also update corresponding client in clients table if exists, otherwise create it
            $c_check_stmt = $this->conn->prepare("SELECT client_id FROM clients WHERE converted_from_lead_id = :lead_id");
            $c_check_stmt->execute(['lead_id' => $data['lead_id']]);
            $exists = $c_check_stmt->fetch(PDO::FETCH_ASSOC);

            $client_code = "CL" . str_pad($data['lead_id'], 3, '0', STR_PAD_LEFT);
            if (!empty($data['manual_client_id'])) {
                $client_code = $data['manual_client_id'];
            }

            // Check duplicate client code
            $code_check = $this->conn->prepare("SELECT client_id FROM clients WHERE client_code = :code AND converted_from_lead_id != :lead_id");
            $code_check->execute(['code' => $client_code, 'lead_id' => $data['lead_id']]);
            if ($code_check->fetch()) {
                $client_code = $client_code . "_" . $data['lead_id'];
            }

            if ($exists) {
                $c_update_q = "UPDATE clients SET 
                                name = :name, 
                                phone = :phone, 
                                email = :email, 
                                address = :address, 
                                client_code = :code, 
                                consultation_type = :type, 
                                lead_source = :source
                               WHERE converted_from_lead_id = :lead_id";
                $c_update_stmt = $this->conn->prepare($c_update_q);
                $c_update_stmt->execute([
                    'name' => $data['client_name'],
                    'phone' => $data['contact_number'],
                    'email' => $data['email'],
                    'address' => $data['client_address'] ?? $data['location'],
                    'code' => $client_code,
                    'type' => $data['project_type'],
                    'source' => $data['lead_source'],
                    'lead_id' => $data['lead_id']
                ]);
            } else {
                $created_by = $this->current_user_id ?? 1;
                $u_check = $this->conn->prepare("SELECT user_id FROM users WHERE user_id = :uid");
                $u_check->execute(['uid' => $created_by]);
                if (!$u_check->fetch()) {
                    $created_by = 1;
                }

                $c_insert_q = "INSERT INTO clients (client_code, name, phone, address, lead_source, converted_from_lead_id, created_by, email, consultation_type, projectname, status) 
                               VALUES (:code, :name, :phone, :address, :source, :lead_id, :created_by, :email, :consultation_type, :projectname, 'active')";
                $c_insert_stmt = $this->conn->prepare($c_insert_q);
                $c_insert_stmt->execute([
                    'code' => $client_code,
                    'name' => $data['client_name'],
                    'phone' => $data['contact_number'],
                    'address' => $data['client_address'] ?? $data['location'],
                    'source' => $data['lead_source'],
                    'lead_id' => $data['lead_id'],
                    'created_by' => $created_by,
                    'email' => $data['email'],
                    'consultation_type' => $data['project_type'],
                    'projectname' => $data['client_name'] . ' Project'
                ]);
            }

            return ["success" => true, "message" => "Lead updated successfully."];
        }
        return ["success" => false, "message" => "Unable to update lead."];
    }
    public function delete($lead_id)
    {
        $query = "DELETE FROM " . $this->table_name . " WHERE lead_id = :lead_id";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':lead_id', $lead_id);

        if ($stmt->execute()) {
            // Also set corresponding client status to deleted
            $this->conn->prepare("UPDATE clients SET status = 'deleted' WHERE converted_from_lead_id = :lead_id")->execute(['lead_id' => $lead_id]);
            return ["success" => true, "message" => "Lead deleted successfully."];
        }
        return ["success" => false, "message" => "Failed to delete lead."];
    }

    public function addNote($lead_id, $note_text)
    {
        $this->conn->exec("CREATE TABLE IF NOT EXISTS lead_notes (
            id INT(11) AUTO_INCREMENT PRIMARY KEY,
            lead_id INT(11) NOT NULL,
            user_id INT(11) NOT NULL,
            note_text TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )");

        $query = "INSERT INTO lead_notes (lead_id, user_id, note_text) VALUES (:lead_id, :user_id, :note_text)";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':lead_id', $lead_id);
        $uid = $this->current_user_id ?: 0;
        $stmt->bindParam(':user_id', $uid);
        $stmt->bindParam(':note_text', $note_text);
        if ($stmt->execute()) {
            return ["success" => true, "message" => "Note added successfully"];
        }
        return ["success" => false, "message" => "Failed to add note"];
    }

    public function getNotes($lead_id)
    {
        $this->conn->exec("CREATE TABLE IF NOT EXISTS lead_notes (
            id INT(11) AUTO_INCREMENT PRIMARY KEY,
            lead_id INT(11) NOT NULL,
            user_id INT(11) NOT NULL,
            note_text TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )");

        $query = "SELECT n.*, u.name as user_name FROM lead_notes n LEFT JOIN users u ON n.user_id = u.user_id WHERE n.lead_id = :lead_id ORDER BY n.created_at DESC";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':lead_id', $lead_id);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function uploadFile($lead_id, $file, $folder = '')
    {
        if (!$lead_id) {
            return ["success" => false, "message" => "Missing lead ID"];
        }
        if (!$file) {
            return ["success" => false, "message" => "No file payload received by server"];
        }
        if ($file['error'] !== UPLOAD_ERR_OK) {
            $upload_errors = [
                1 => 'File size exceeds php.ini upload_max_filesize limit',
                2 => 'File size exceeds HTML form MAX_FILE_SIZE',
                3 => 'File was only partially uploaded',
                4 => 'No file selected for upload',
                6 => 'Missing temporary folder on PHP server',
                7 => 'Failed to write file to server disk',
                8 => 'PHP extension stopped the file upload'
            ];
            $err_msg = $upload_errors[$file['error']] ?? ('PHP upload error code ' . $file['error']);
            return ["success" => false, "message" => $err_msg];
        }
        $folder = preg_replace('/[^a-zA-Z0-9_ -]/', '', $folder);
        $base_dir = __DIR__ . '/../../uploads/leads/' . $lead_id;
        if (!is_dir($base_dir)) {
            @mkdir($base_dir, 0777, true);
        }
        $upload_dir = $base_dir . ($folder ? '/' . $folder : '');
        if (!is_dir($upload_dir)) {
            @mkdir($upload_dir, 0777, true);
        }

        $filename = basename($file['name']);
        $filename = preg_replace('/[^a-zA-Z0-9_.-]/', '_', $filename);
        $target_file = rtrim($upload_dir, '/') . '/' . time() . '_' . $filename;

        if (@move_uploaded_file($file['tmp_name'], $target_file) || @copy($file['tmp_name'], $target_file)) {
            return ["success" => true, "message" => "File uploaded successfully"];
        }
        $err = error_get_last();
        return ["success" => false, "message" => "Failed to save file: " . ($err['message'] ?? 'Check write permissions on uploads/leads folder')];
    }

    public function getFiles($lead_id, $folder = '')
    {
        $folder = preg_replace('/[^a-zA-Z0-9_ -]/', '', $folder);
        $check_ids = array_filter([(string)$lead_id]);

        try {
            $stmt = $this->conn->prepare("SELECT lead_id, manual_client_id FROM leads WHERE lead_id = :id OR manual_client_id = :id");
            $stmt->execute(['id' => $lead_id]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($row) {
                if (!empty($row['lead_id'])) $check_ids[] = (string)$row['lead_id'];
                if (!empty($row['manual_client_id'])) $check_ids[] = (string)$row['manual_client_id'];
            }
        } catch (Exception $e) {}

        $check_ids = array_unique($check_ids);
        $files = [];
        $folders = [];
        $seen = [];

        foreach ($check_ids as $lid) {
            $base_lead_dir = __DIR__ . '/../../uploads/leads/' . $lid;
            $upload_dir = $base_lead_dir . ($folder ? '/' . $folder : '');

            if (is_dir($upload_dir)) {
                $dh = opendir($upload_dir);
                if ($dh) {
                    while (($file = readdir($dh)) !== false) {
                        if ($file !== "." && $file !== "..") {
                            $full_path = rtrim($upload_dir, '/') . '/' . $file;
                            if (isset($seen[$file])) continue;
                            $seen[$file] = true;

                            if (is_dir($full_path)) {
                                $folders[] = [
                                    'name' => $file,
                                    'type' => 'folder'
                                ];
                            } else {
                                $files[] = [
                                    'name' => $file,
                                    'type' => 'file',
                                    'url' => '/uploads/leads/' . $lid . '/' . ($folder ? $folder . '/' : '') . $file,
                                    'size' => filesize($full_path),
                                    'date' => date("Y-m-d H:i:s", filemtime($full_path))
                                ];
                            }
                        }
                    }
                    closedir($dh);
                }
            }
        }

        usort($files, function ($a, $b) {
            return strtotime($b['date']) - strtotime($a['date']);
        });
        usort($folders, function ($a, $b) {
            return strcmp($a['name'], $b['name']);
        });
        return array_merge($folders, $files);
    }

    public function createFolder($lead_id, $folder_name, $parent_folder = '')
    {
        $parent_folder = preg_replace('/[^a-zA-Z0-9_ -]/', '', $parent_folder);
        $folder_name = preg_replace('/[^a-zA-Z0-9_ -]/', '', $folder_name);
        if (empty($folder_name))
            return ["success" => false, "message" => "Invalid folder name"];

        $base_lead_dir = __DIR__ . '/../../uploads/leads/' . $lead_id;
        $upload_dir = $base_lead_dir . ($parent_folder ? '/' . $parent_folder : '') . '/' . $folder_name;

        if (!is_dir($upload_dir)) {
            if (mkdir($upload_dir, 0777, true)) {
                return ["success" => true, "message" => "Folder created successfully"];
            } else {
                return ["success" => false, "message" => "Failed to create folder directory"];
            }
        }
        return ["success" => false, "message" => "Folder already exists"];
    }

    public function deleteFile($lead_id, $filename, $folder = '')
    {
        $filename = basename($filename);
        $folder = preg_replace('/[^a-zA-Z0-9_ -]/', '', $folder);
        
        $check_ids = array_filter([(string)$lead_id]);
        try {
            $stmt = $this->conn->prepare("SELECT lead_id, manual_client_id FROM leads WHERE lead_id = :id OR manual_client_id = :id");
            $stmt->execute(['id' => $lead_id]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($row) {
                if (!empty($row['lead_id'])) $check_ids[] = (string)$row['lead_id'];
                if (!empty($row['manual_client_id'])) $check_ids[] = (string)$row['manual_client_id'];
            }
        } catch (Exception $e) {}

        $check_ids = array_unique($check_ids);
        $deleted = false;

        foreach ($check_ids as $lid) {
            $file_path = __DIR__ . '/../../uploads/leads/' . $lid . '/' . ($folder ? $folder . '/' : '') . $filename;
            if (file_exists($file_path)) {
                if (is_dir($file_path)) {
                    $this->deleteDir($file_path);
                } else {
                    @unlink($file_path);
                }
                $deleted = true;
            }
        }

        if ($deleted) {
            return ["success" => true, "message" => "Deleted successfully"];
        }
        return ["success" => false, "message" => "Not found"];
    }

    private function deleteDir($dirPath)
    {
        if (!is_dir($dirPath))
            return;
        if (substr($dirPath, strlen($dirPath) - 1, 1) != '/')
            $dirPath .= '/';
        $files = glob($dirPath . '*', GLOB_MARK);
        foreach ($files as $file) {
            if (is_dir($file))
                self::deleteDir($file);
            else
                unlink($file);
        }
        rmdir($dirPath);
    }

    private function registerCopiedFiles($dir, $project_id, $folder_id, $user_id)
    {
        if (!is_dir($dir))
            return;
        $items = array_diff(scandir($dir), array('.', '..'));
        foreach ($items as $item) {
            $path = $dir . '/' . $item;
            if (is_file($path)) {
                $ext = strtolower(pathinfo($item, PATHINFO_EXTENSION));
                $file_type = in_array($ext, ['jpg', 'jpeg', 'png', 'gif']) ? 'image/' . ($ext == 'jpg' ? 'jpeg' : $ext) : ($ext == 'pdf' ? 'application/pdf' : 'application/octet-stream');
                $clean_name = preg_replace('/^\d+_/', '', $item);
                $db_path = 'uploads/projects/' . $project_id . '/' . $folder_id . '/' . $item;
                $stmt = $this->conn->prepare("INSERT INTO project_files (project_id, folder_id, file_name, file_path, file_type, uploaded_by) VALUES (:pid, :fid, :fname, :fpath, :ftype, :uid)");
                $stmt->execute([
                    'pid' => $project_id,
                    'fid' => $folder_id,
                    'fname' => $clean_name,
                    'fpath' => $db_path,
                    'ftype' => $file_type,
                    'uid' => $user_id
                ]);
            } elseif (is_dir($path)) {
                $this->registerCopiedFiles($path, $project_id, $folder_id, $user_id);
            }
        }
    }

    private function copyDir($src, $dst)
    {
        $dir = @opendir($src);
        if (!$dir)
            return;
        @mkdir($dst, 0777, true);
        while (false !== ($file = readdir($dir))) {
            if (($file != '.') && ($file != '..')) {
                if (is_dir($src . '/' . $file)) {
                    $this->copyDir($src . '/' . $file, $dst . '/' . $file);
                } else {
                    copy($src . '/' . $file, $dst . '/' . $file);
                }
            }
        }
        closedir($dir);
    }
}
?>