<?php
// api/workers/send_lead_email.php
// Dedicated background worker for sending lead creation notification emails

// Ignore any script execution time limit for email delivery
@set_time_limit(60);
@ini_set('memory_limit', '256M');

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../libs/PHPMailer/src/Exception.php';
require_once __DIR__ . '/../libs/PHPMailer/src/PHPMailer.php';
require_once __DIR__ . '/../libs/PHPMailer/src/SMTP.php';

function sendLeadCreatedEmail($lead_id, $conn = null)
{
    $lead_id = intval($lead_id);
    if ($lead_id <= 0) {
        return false;
    }

    if (!$conn) {
        $db = new Database();
        $conn = $db->getConnection();
    }

    if (!$conn) {
        return false;
    }

    $log_file = __DIR__ . '/../lead_mail_debug.log';

    try {
        // Fetch lead details
        $stmt = $conn->prepare("SELECT lead_id, client_name, lead_source, assigned_to FROM leads WHERE lead_id = :id LIMIT 1");
        $stmt->execute(['id' => $lead_id]);
        $lead = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$lead) {
            file_put_contents($log_file, date('[Y-m-d H:i:s] ') . "WORKER: Lead #$lead_id not found in DB\n", FILE_APPEND);
            return false;
        }

        $client_name = $lead['client_name'] ?? 'New Lead';
        $lead_source = $lead['lead_source'] ?? 'walk_in';
        $assigned_to = $lead['assigned_to'] ?? null;

        // 1. Fetch strictly Admin and Project Manager users
        $recipients_stmt = $conn->prepare("
            SELECT DISTINCT name, username 
            FROM users 
            WHERE (LOWER(role) IN ('admin', 'superadmin', 'project_manager', 'project_head', 'manager') OR LOWER(role) LIKE '%project_manager%')
              AND (status = 'active' OR status IS NULL)
              AND username IS NOT NULL AND username != ''
        ");
        $recipients_stmt->execute();
        $recipients = $recipients_stmt->fetchAll(PDO::FETCH_ASSOC);

        // Always include primary admin recipient emails
        $target_list = [
            'shaiksalman9951@gmail.com' => 'Manager / Admin',
            'updates@livincart.com' => 'LivinCart Admin'
        ];

        foreach ($recipients as $r) {
            $email_addr = trim($r['username']);
            if (strpos($email_addr, '@test.com') !== false || strpos($email_addr, '@example.com') !== false) {
                continue;
            }
            if (filter_var($email_addr, FILTER_VALIDATE_EMAIL) && !isset($target_list[$email_addr])) {
                $target_list[$email_addr] = $r['name'] ?? 'Admin/PM';
            }
        }

        // 2. Fetch assigned salesperson email ONLY
        $assigned_person_name = 'Unassigned';
        if (!empty($assigned_to)) {
            $au_stmt = $conn->prepare("SELECT name, username FROM users WHERE user_id = :uid");
            $au_stmt->execute(['uid' => $assigned_to]);
            $au_user = $au_stmt->fetch(PDO::FETCH_ASSOC);
            if ($au_user && !empty($au_user['name'])) {
                $assigned_person_name = $au_user['name'];
                $sales_email = trim($au_user['username'] ?? '');
                if (filter_var($sales_email, FILTER_VALIDATE_EMAIL) && strpos($sales_email, '@test.com') === false && strpos($sales_email, '@example.com') === false) {
                    $target_list[$sales_email] = $assigned_person_name;
                }
            }
        }

        $source_formatted = ucwords(str_replace('_', ' ', $lead_source));
        $subject = "New Lead Created – " . $client_name;

        $email_body = "Hi Team,<br><br>";
        $email_body .= "A new lead has been created.<br><br>";
        $email_body .= "<b>Lead:</b> " . htmlspecialchars($client_name) . "<br>";
        $email_body .= "<b>Source:</b> " . htmlspecialchars($source_formatted) . "<br>";
        $email_body .= "<b>Assigned To:</b> " . htmlspecialchars($assigned_person_name) . "<br><br>";
        $email_body .= "Please follow up and update the lead status.<br><br>";
        $email_body .= "Regards,<br>LivinCart Team";

        $alt_body = "Hi Team,\n\nA new lead has been created.\n\nLead: " . $client_name . "\nSource: " . $source_formatted . "\nAssigned To: " . $assigned_person_name . "\n\nPlease follow up and update the lead status.\n\nRegards,\nLivinCart Team";

        file_put_contents($log_file, date('[Y-m-d H:i:s] ') . "--- ASYNC LEAD EMAIL DISPATCH for lead: $client_name (ID: $lead_id, Recipients: " . implode(', ', array_keys($target_list)) . ") ---\n", FILE_APPEND);

        $mail = new \PHPMailer\PHPMailer\PHPMailer(true);
        $mail->isSMTP();
        $mail->Host = 'smtp.gmail.com';
        $mail->SMTPAuth = true;
        $mail->Username = 'updates@livincart.com';
        $mail->Password = 'kkzz omvh dzjs xqfu';
        $mail->SMTPSecure = \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port = 587;
        $mail->Timeout = 10;
        $mail->setFrom('updates@livincart.com', 'LivinCart System');

        foreach ($target_list as $email_addr => $recip_name) {
            if (filter_var($email_addr, FILTER_VALIDATE_EMAIL)) {
                $mail->addAddress($email_addr, $recip_name);
            }
        }

        $mail->isHTML(true);
        $mail->Subject = $subject;
        $mail->Body = $email_body;
        $mail->AltBody = $alt_body;

        $mail->send();
        file_put_contents($log_file, date('[Y-m-d H:i:s] ') . "SUCCESS async lead email batch for lead ID $lead_id\n--- END ASYNC DISPATCH ---\n\n", FILE_APPEND);
        return true;
    } catch (Exception $e) {
        file_put_contents($log_file, date('[Y-m-d H:i:s] ') . "ERROR async lead email batch for lead ID $lead_id: " . $e->getMessage() . "\n--- END ASYNC DISPATCH (WITH ERROR) ---\n\n", FILE_APPEND);
        return false;
    }
}

// If invoked via CLI or HTTP
$leadId = 0;
if (php_sapi_name() === 'cli' && isset($argv[1])) {
    $leadId = intval($argv[1]);
} elseif (isset($_REQUEST['lead_id'])) {
    $leadId = intval($_REQUEST['lead_id']);
}

if ($leadId > 0) {
    // If called via HTTP, ensure connection is closed or output is sent
    if (php_sapi_name() !== 'cli') {
        ignore_user_abort(true);
        ob_start();
        echo json_encode(["status" => "processing", "lead_id" => $leadId]);
        header("Content-Length: " . ob_get_length());
        header("Connection: close");
        header("Content-Type: application/json");
        ob_end_flush();
        flush();
    }
    sendLeadCreatedEmail($leadId);
}
