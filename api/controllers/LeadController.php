<?php
// api/controllers/LeadController.php

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

    public function create($data)
    {
        // Ensure all required columns exist in leads table
        try {
            $this->conn->exec("ALTER TABLE " . $this->table_name . " ADD COLUMN client_address TEXT DEFAULT NULL");
        } catch (Exception $e) {
        }
        try {
            $this->conn->exec("ALTER TABLE " . $this->table_name . " ADD COLUMN manual_client_id VARCHAR(100) DEFAULT NULL");
        } catch (Exception $e) {
        }
        try {
            $this->conn->exec("ALTER TABLE " . $this->table_name . " ADD COLUMN project_scope TEXT DEFAULT NULL");
        } catch (Exception $e) {
        }
        try {
            $this->conn->exec("ALTER TABLE " . $this->table_name . " ADD COLUMN d1_assigned_to INT(11) DEFAULT NULL");
        } catch (Exception $e) {
        }
        try {
            $this->conn->exec("ALTER TABLE " . $this->table_name . " ADD COLUMN d1_booking_time DATETIME DEFAULT NULL");
        } catch (Exception $e) {
        }
        try {
            $this->conn->exec("ALTER TABLE " . $this->table_name . " ADD COLUMN d1_notes TEXT DEFAULT NULL");
        } catch (Exception $e) {
        }

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

        $query = "INSERT INTO " . $this->table_name . " 
                (lead_source, client_name, contact_number, email, location, client_address, project_type, estimated_budget, status, created_by, assigned_to, manual_client_id, project_scope) 
                VALUES (:lead_source, :client_name, :contact_number, :email, :location, :client_address, :project_type, :estimated_budget, 'enquiry', :created_by, :assigned_to, :manual_client_id, :project_scope)";

        $stmt = $this->conn->prepare($query);

        $lead_source = $data['lead_source'] ?? 'walk_in';
        $client_name = $data['client_name'] ?? '';
        $contact_number = $data['contact_number'] ?? '';
        $email = $data['email'] ?? null;
        $location = $data['location'] ?? null;
        $client_address = $data['client_address'] ?? null;
        $project_type = $data['project_type'] ?? null;
        $manual_client_id = $data['manual_client_id'] ?? null;
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

                return ["success" => true, "message" => "Lead created successfully and client registry entry initialized."];
            }
            $error = $stmt->errorInfo();
            return ["success" => false, "message" => "Unable to create lead: " . ($error[2] ?? 'Unknown error')];
        } catch (Exception $e) {
            return ["success" => false, "message" => "Database error creating lead: " . $e->getMessage()];
        }
    }

    public function getLeads()
    {
        $query = "SELECT * FROM " . $this->table_name . " ORDER BY created_at DESC";
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
        try {
            $this->conn->exec("ALTER TABLE " . $this->table_name . " MODIFY COLUMN status VARCHAR(50) DEFAULT 'enquiry'");
        } catch (Exception $e) {
            // Ignore if already updated
        }

        $query = "UPDATE " . $this->table_name . " SET status = :status WHERE lead_id = :lead_id";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':status', $status);
        $stmt->bindParam(':lead_id', $lead_id);

        if ($stmt->execute()) {
            if ($status === 'won' && $assignmentData) {
                return $this->convertToProject($lead_id, $assignmentData);
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

            $query = "UPDATE " . $this->table_name . " SET site_manager_assigned_to = :site_manager_id, site_manager_booking_time = :booking_time, site_manager_notes = :notes WHERE lead_id = :lead_id";
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

            $this->conn->commit();

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
                    
                    $mail->setFrom('updates@livincart.com', 'LivinCart System');
                    $mail->addAddress($d1_user['username'], $d1_user['name']);

                    $mail->isHTML(true);
                    $mail->Subject = "New Site Visit Assignment - " . ($lead['client_name'] ?? 'Client');
                    
                    $body = "<h2>You have a new site visit assignment</h2>";
                    $body .= "<p><strong>Client Name:</strong> " . ($lead['client_name'] ?? 'Unknown') . "</p>";
                    $body .= "<p><strong>Booking Date & Time:</strong> " . date('M j, Y, g:i A', strtotime($booking_time)) . "</p>";
                    $body .= "<p><strong>Assigned By:</strong> " . $assigned_by_name . "</p>";
                    if (!empty($notes)) {
                        $body .= "<p><strong>Notes:</strong> " . $notes . "</p>";
                    }
                    $body .= "<br><p>Please log in to the portal to view more details.</p>";
                    
                    $mail->Body = $body;
                    $mail->send();
                } catch (Exception $e) {
                    error_log("Mailer Error: " . $mail->ErrorInfo);
                }
            }

            return true;
        } catch (\PDOException $e) {
            $this->conn->rollBack();
            return false;
        }
    }


public function bookD1Slot($lead_id, $d1_user_id, $booking_time, $assigned_by_name, $d1_notes = null)
    {
        try {
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

            // Fetch lead and D1 user details for notification
            $lead_q = "SELECT client_name, email FROM leads WHERE lead_id = :lead_id";
            $lead_s = $this->conn->prepare($lead_q);
            $lead_s->execute(['lead_id' => $lead_id]);
            $lead = $lead_s->fetch(PDO::FETCH_ASSOC);

            // Update lead
            $query = "UPDATE " . $this->table_name . " SET d1_assigned_to = :d1_user_id, d1_booking_time = :booking_time, d1_notes = :d1_notes WHERE lead_id = :lead_id";
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':d1_user_id', $d1_user_id);
            $stmt->bindParam(':booking_time', $booking_time);
            $stmt->bindParam(':d1_notes', $d1_notes);
            $stmt->bindParam(':lead_id', $lead_id);
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
                    $mail->Subject = 'Livincart - New D1 Slot Booked';

                    $email_msg = "Hello <b>" . $d1_user['name'] . "</b>,<br><br>";
                    $email_msg .= "A new D1 slot has been booked for you.<br><br>";
                    $email_msg .= "<b>Client Name:</b> " . ($lead['client_name'] ?? 'Unknown') . "<br>";
                    $email_msg .= "<b>Date & Time:</b> " . date('M j, Y, g:i A', strtotime($booking_time)) . "<br>";
                    $email_msg .= "<b>Booked By:</b> " . $assigned_by_name . "<br>";
                    if (!empty($d1_notes)) {
                        $email_msg .= "<b>Notes:</b> " . $d1_notes . "<br>";
                    }
                    $email_msg .= "<br>Please log in to the system to view more details.<br>";

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

                        $mail->Subject = 'Livincart - Design Consultation Scheduled';

                        $formatted_date = date('M j, Y, g:i A', strtotime($booking_time));

                        $client_msg = "Hello <b>" . ($lead['client_name'] ?? 'Client') . "</b>,<br><br>";
                        $client_msg .= "Your design consultation slot has been successfully booked!<br><br>";
                        $client_msg .= "<b>Date & Time:</b> " . $formatted_date . "<br>";
                        $client_msg .= "<b>Assigned Designer:</b> " . $d1_user['name'] . "<br>";
                        $client_msg .= "<b>Booked By:</b> " . $assigned_by_name . "<br><br>";
                        $client_msg .= "We look forward to discussing your project with you.<br><br>";
                        $client_msg .= "Best Regards,<br>The Livincart Team";

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

    private function convertToProject($lead_id, $data)
    {
        try {
            $this->conn->exec("ALTER TABLE projects MODIFY COLUMN status VARCHAR(50) DEFAULT 'Pending'");
        } catch (Exception $e) {
            // Ignore if already done
        }

        try {
            $this->conn->beginTransaction();

            // 1. Fetch Lead
            $q = "SELECT * FROM leads WHERE lead_id = :id";
            $s = $this->conn->prepare($q);
            $s->execute(['id' => $lead_id]);
            $lead = $s->fetch(PDO::FETCH_ASSOC);

            // 2. Create Client (or reuse if already auto-created)
            $c_check_q = "SELECT client_id FROM clients WHERE converted_from_lead_id = :lead_id";
            $c_check_s = $this->conn->prepare($c_check_q);
            $c_check_s->execute(['lead_id' => $lead_id]);
            $existing_client = $c_check_s->fetch(PDO::FETCH_ASSOC);

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
                $client_code = "CL" . str_pad($lead_id, 3, '0', STR_PAD_LEFT);
                if (!empty($lead['manual_client_id'])) {
                    $client_code = $lead['manual_client_id'];
                }

                // Check duplicate client code
                $code_check = $this->conn->prepare("SELECT client_id FROM clients WHERE client_code = :code AND client_id != :client_id");
                $code_check->execute(['code' => $client_code, 'client_id' => $client_id]);
                if ($code_check->fetch()) {
                    $client_code = $client_code . "_" . $lead_id;
                }

                $c_update_stmt->execute([
                    'name' => $lead['client_name'],
                    'phone' => $lead['contact_number'],
                    'email' => $lead['email'],
                    'address' => $lead['location'],
                    'code' => $client_code,
                    'type' => $lead['project_type'] ?? 'interior',
                    'source' => $lead['lead_source'],
                    'client_id' => $client_id
                ]);
            } else {
                $client_code = "CL" . str_pad($lead_id, 3, '0', STR_PAD_LEFT);
                if (!empty($lead['manual_client_id'])) {
                    $client_code = $lead['manual_client_id'];
                }

                // Check duplicate client code
                $code_check = $this->conn->prepare("SELECT client_id FROM clients WHERE client_code = :code");
                $code_check->execute(['code' => $client_code]);
                if ($code_check->fetch()) {
                    $client_code = $client_code . "_" . $lead_id;
                }

                $created_by = $data['created_by'] ?? 1;
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

            // 3. Create Project
            $p_code = "PR" . str_pad($lead_id, 3, '0', STR_PAD_LEFT);

            // Check duplicate project code
            $p_code_check = $this->conn->prepare("SELECT project_id FROM projects WHERE project_code = :code");
            $p_code_check->execute(['code' => $p_code]);
            if ($p_code_check->fetch()) {
                $p_code = $p_code . "_" . $lead_id;
            }

            $p_query = "INSERT INTO projects (project_code, project_name, client_id, project_type, site_address, start_date, expected_end_date, total_budget, advance_received, project_head_id, created_by, status) 
                        VALUES (:code, :name, :c_id, :type, :site, :start, :end, :budget, :advance, :head_id, :created_by, 'Designing Phase')";
            $p_stmt = $this->conn->prepare($p_query);
            $p_stmt->execute([
                'code' => $p_code,
                'name' => $data['project_name'],
                'c_id' => $client_id,
                'type' => $lead['project_type'] ?? 'interior',
                'site' => $lead['location'],
                'start' => $data['start_date'],
                'end' => !empty($data['expected_end_date']) ? $data['expected_end_date'] : null,
                'budget' => $data['total_budget'] ?? 0,
                'advance' => $data['advance_paid'] ?? 0,
                'head_id' => !empty($data['project_head_id']) ? $data['project_head_id'] : null,
                'created_by' => $data['created_by']
            ]);
            $project_id = $this->conn->lastInsertId();

            // 3.5 Initialize Timeline
            require_once 'TimelineController.php';
            $timeline = new TimelineController($this->conn);
            $timeline->generateMasterTimeline($project_id, $data['start_date'], $data['expected_end_date'], $data['created_by']);

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

            // 5. Initial Payment Transaction (if advance paid > 0)
            if ($data['advance_paid'] > 0) {
                $t_query = "INSERT INTO finance_transactions (project_id, type, amount, category, description, transaction_date, recorded_by) 
                            VALUES (:p_id, 'credit', :amount, 'Advance Payment', 'Finalized project advance', CURDATE(), :created_by)";
                $t_stmt = $this->conn->prepare($t_query);
                $t_stmt->execute([
                    'p_id' => $project_id,
                    'amount' => $data['advance_paid'],
                    'created_by' => $data['created_by']
                ]);
            }

            // 6. Copy Files and Notes to Project
            $n_query = "INSERT INTO project_notes (project_id, user_id, note_text, created_at) SELECT :p_id, user_id, note_text, created_at FROM lead_notes WHERE lead_id = :l_id";
            try {
                // Ensure project notes table exists implicitly
                $this->conn->exec("CREATE TABLE IF NOT EXISTS project_notes (id INT(11) AUTO_INCREMENT PRIMARY KEY, project_id INT(11) NOT NULL, user_id INT(11) NOT NULL, note_text TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
                $n_stmt = $this->conn->prepare($n_query);
                $n_stmt->execute(['p_id' => $project_id, 'l_id' => $lead_id]);
            } catch (Exception $e) {
            }

            try {
                // Create project_folders and project_files tables if not exist
                $this->conn->exec("CREATE TABLE IF NOT EXISTS project_folders (
                    folder_id INT(11) AUTO_INCREMENT PRIMARY KEY,
                    project_id INT(11) NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )");
                $this->conn->exec("CREATE TABLE IF NOT EXISTS project_files (
                    file_id INT(11) AUTO_INCREMENT PRIMARY KEY,
                    project_id INT(11) NOT NULL,
                    folder_id INT(11) NOT NULL,
                    file_name VARCHAR(255) NOT NULL,
                    file_path VARCHAR(255) NOT NULL,
                    file_type VARCHAR(100) DEFAULT NULL,
                    uploaded_by INT(11) DEFAULT NULL,
                    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )");

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
            return ["success" => true, "message" => "Lead converted to Project successfully.", "project_id" => $project_id];
        } catch (Exception $e) {
            $this->conn->rollBack();
            return ["success" => false, "message" => "Conversion failed: " . $e->getMessage()];
        }
    }

    public function update($data)
    {
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
                    project_scope = :project_scope
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

        if ($stmt->execute()) {
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
        $base_lead_dir = __DIR__ . '/../../uploads/leads/' . $lead_id;
        $upload_dir = $base_lead_dir . ($folder ? '/' . $folder : '');

        $files = [];
        $folders = [];
        if (is_dir($upload_dir)) {
            $dh = opendir($upload_dir);
            if ($dh) {
                while (($file = readdir($dh)) !== false) {
                    if ($file !== "." && $file !== "..") {
                        $full_path = rtrim($upload_dir, '/') . '/' . $file;
                        if (is_dir($full_path)) {
                            $folders[] = [
                                'name' => $file,
                                'type' => 'folder'
                            ];
                        } else {
                            $files[] = [
                                'name' => $file,
                                'type' => 'file',
                                'url' => '/demoark/uploads/leads/' . $lead_id . '/' . ($folder ? $folder . '/' : '') . $file,
                                'size' => filesize($full_path),
                                'date' => date("Y-m-d H:i:s", filemtime($full_path))
                            ];
                        }
                    }
                }
                closedir($dh);
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
        $file_path = __DIR__ . '/../../uploads/leads/' . $lead_id . '/' . ($folder ? $folder . '/' : '') . $filename;
        if (file_exists($file_path)) {
            if (is_dir($file_path)) {
                $this->deleteDir($file_path);
            } else {
                unlink($file_path);
            }
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