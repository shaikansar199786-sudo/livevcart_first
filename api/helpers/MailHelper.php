<?php
// api/helpers/MailHelper.php

require_once __DIR__ . '/../libs/PHPMailer/src/Exception.php';
require_once __DIR__ . '/../libs/PHPMailer/src/PHPMailer.php';
require_once __DIR__ . '/../libs/PHPMailer/src/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

class MailHelper
{
    private static $smtpHost = 'smtp.gmail.com';
    private static $smtpUser = 'updates@livincart.com';
    private static $smtpPass = 'kkzz omvh dzjs xqfu';
    private static $smtpPort = 587;

    /**
     * Send email via PHPMailer SMTP
     */
    public static function sendMail($recipients, $subject, $bodyContent, $attachments = [], $customHeaders = [], $ampContent = null)
    {
        if (empty($recipients)) {
            return false;
        }

        if (!is_array($recipients)) {
            $recipients = [$recipients];
        }

        // Clean & filter recipient list
        $cleanRecipients = [];
        foreach ($recipients as $r) {
            $r = trim($r);
            if (filter_var($r, FILTER_VALIDATE_EMAIL) && !in_array($r, $cleanRecipients)) {
                // Ignore dummy test domains
                if (strpos($r, '@test.com') === false && strpos($r, '@example.com') === false) {
                    $cleanRecipients[] = $r;
                }
            }
        }

        if (empty($cleanRecipients)) {
            return false;
        }

        try {
            if (!empty($ampContent)) {
                require_once __DIR__ . '/../libs/AmpPHPMailer.php';
                $mail = new AmpPHPMailer(true);
                $mail->AmpBody = $ampContent;
            } else {
                $mail = new PHPMailer(true);
            }

            $mail->isSMTP();
            $mail->Timeout    = 6;
            $mail->Host       = self::$smtpHost;
            $mail->SMTPAuth   = true;
            $mail->Username   = self::$smtpUser;
            $mail->Password   = self::$smtpPass;
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
            $mail->Port       = self::$smtpPort;
            $mail->CharSet    = 'UTF-8';

            $mail->setFrom(self::$smtpUser, 'LivinCart Team');

            foreach ($cleanRecipients as $toEmail) {
                $mail->addAddress($toEmail);
            }

            // Custom headers (such as In-Reply-To, References for email threading)
            if (!empty($customHeaders) && is_array($customHeaders)) {
                foreach ($customHeaders as $hName => $hVal) {
                    if (!empty($hVal)) {
                        $mail->addCustomHeader($hName, $hVal);
                    }
                }
            }

            // Wrap body content in a styled HTML email container
            $styledHtml = self::wrapInTemplate($subject, $bodyContent);

            $mail->isHTML(true);
            $mail->Subject = $subject;
            $mail->Body    = $styledHtml;
            $mail->AltBody = strip_tags(str_replace(['<br>', '<br/>', '<br />'], "\n", $bodyContent));

            // Attachments
            if (!empty($attachments)) {
                foreach ($attachments as $att) {
                    if (isset($att['path']) && file_exists($att['path'])) {
                        $name = $att['name'] ?? basename($att['path']);
                        $mail->addAttachment($att['path'], $name);
                    } elseif (isset($att['binary']) && isset($att['name'])) {
                        $mail->addStringAttachment($att['binary'], $att['name'], 'base64', $att['mime'] ?? 'application/pdf');
                    }
                }
            }

            return $mail->send();
        } catch (Exception $e) {
            error_log("MailHelper Error: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Wrap email content in HTML layout template
     */
    private static function wrapInTemplate($subject, $bodyContent)
    {
        return "
        <div style=\"font-family: 'Segoe UI', Arial, Helvetica, sans-serif; background-color: #f8fafc; padding: 30px 10px; color: #1e293b;\">
            <div style=\"max-width: 620px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1.5px solid #ffe8c2; overflow: hidden; box-shadow: 0 4px 14px rgba(0,0,0,0.05);\">
                <div style=\"background-color: #0c1527; padding: 20px 24px; border-bottom: 3px solid #fca412;\">
                    <h2 style=\"margin: 0; color: #ffffff; font-size: 1.4rem; font-weight: 700;\">LivinCart <span style=\"color: #fca412;\">Interiors</span></h2>
                    <p style=\"margin: 4px 0 0 0; color: #94a3b8; font-size: 0.82rem;\">Official Notification & Updates</p>
                </div>
                <div style=\"padding: 28px 24px; font-size: 0.95rem; line-height: 1.6; color: #334155;\">
                    {$bodyContent}
                </div>
                <div style=\"background-color: #f1f5f9; padding: 16px 24px; text-align: center; font-size: 0.8rem; color: #64748b; border-top: 1px solid #e2e8f0;\">
                    <p style=\"margin: 0 0 4px 0;\">LivinCart and Services Private Limited</p>
                    <p style=\"margin: 0;\">This is an automated system notification. Please do not reply directly to this email.</p>
                </div>
            </div>
        </div>";
    }

    /**
     * Fetch Admin & Manager emails
     */
    public static function getAdminAndManagerEmails($conn)
    {
        try {
            $stmt = $conn->prepare("SELECT DISTINCT username FROM users WHERE (LOWER(role) IN ('admin', 'manager', 'project_head') OR LOWER(role) LIKE '%manager%' OR LOWER(role) = 'admin') AND (status = 'active' OR status IS NULL)");
            $stmt->execute();
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $emails = ['shaiksalman9951@gmail.com', 'updates@livincart.com'];
            foreach ($rows as $r) {
                if (!empty($r['username']) && filter_var($r['username'], FILTER_VALIDATE_EMAIL)) {
                    $emails[] = trim($r['username']);
                }
            }
            return array_values(array_unique(array_filter($emails)));
        } catch (Exception $e) {
            return ['shaiksalman9951@gmail.com', 'updates@livincart.com'];
        }
    }

    /**
     * Fetch email for specific user_id
     */
    public static function getUserEmail($conn, $user_id)
    {
        if (empty($user_id)) return null;
        try {
            $stmt = $conn->prepare("SELECT username FROM users WHERE user_id = :uid LIMIT 1");
            $stmt->execute([':uid' => $user_id]);
            $u = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($u && !empty($u['username']) && filter_var($u['username'], FILTER_VALIDATE_EMAIL)) {
                return trim($u['username']);
            }
        } catch (Exception $e) {}
        return null;
    }

    // -------------------------------------------------------------
    // CATEGORY 1: NEW LEAD CREATION
    // -------------------------------------------------------------
    public static function sendNewLeadNotification($conn, $leadData)
    {
        $leadName = $leadData['client_name'] ?? 'New Lead';
        $source = ucwords(str_replace('_', ' ', $leadData['lead_source'] ?? 'Direct'));
        $assignedTo = $leadData['assigned_person_name'] ?? 'Unassigned';

        $subject = "New Lead Created – " . $leadName;

        $body = "Hi Team,<br><br>
        A new lead has been created.<br><br>
        <b>Lead:</b> " . htmlspecialchars($leadName) . "<br>
        <b>Source:</b> " . htmlspecialchars($source) . "<br>
        <b>Assigned To:</b> " . htmlspecialchars($assignedTo) . "<br><br>
        Please follow up and update the lead status.<br><br>
        Regards,<br>
        <b>LivinCart Team</b>";

        $recipients = self::getAdminAndManagerEmails($conn);
        return self::sendMail($recipients, $subject, $body);
    }

    // -------------------------------------------------------------
    // CATEGORY 2: INITIAL MEETING / DESIGNER CONSULTATION
    // -------------------------------------------------------------
    public static function sendDesignerMeetingNotification($conn, $type, $data)
    {
        $designerEmail = $data['designer_email'] ?? self::getUserEmail($conn, $data['designer_id'] ?? null);
        $clientEmail = $data['client_email'] ?? null;
        $designerName = $data['designer_name'] ?? 'Designer';
        $clientName = $data['client_name'] ?? 'Client';
        $clientPhone = $data['client_phone'] ?? '';
        $projectType = $data['project_type'] ?? 'Interior Project';
        $meetingDateTime = $data['meeting_datetime'] ?? date('d M Y, h:i A');
        $meetingMode = $data['meeting_mode'] ?? 'Online';
        $meetingLink = $data['meeting_link'] ?? '';
        $salesPersonName = $data['sales_person_name'] ?? 'Sales Team';
        $notes = $data['notes'] ?? '';
        $projectId = $data['project_id'] ?? '';

        $recipients = array_filter([$designerEmail, $clientEmail]);

        switch ($type) {
            case 'booked':
                $subject = "Assigned - New Initial Meeting | Livincart";
                $body = "Hello " . htmlspecialchars($designerName) . ",<br><br>
                A new meeting slot has been booked for you by the Sales Team.<br><br>
                <b>Meeting Details:</b><br>
                • <b>Client Name:</b> " . htmlspecialchars($clientName) . "<br>
                • <b>Contact Number:</b> " . htmlspecialchars($clientPhone) . "<br>
                • <b>Project Type:</b> " . htmlspecialchars($projectType) . "<br>
                • <b>Meeting Date & Time:</b> " . htmlspecialchars($meetingDateTime) . "<br>
                • <b>Meeting Mode:</b> " . htmlspecialchars($meetingMode) . "<br>";
                if ($meetingLink) $body .= "• <b>Meeting Link:</b> <a href=\"{$meetingLink}\">{$meetingLink}</a><br>";
                $body .= "• <b>Booked By:</b> " . htmlspecialchars($salesPersonName) . "<br>";
                if ($notes) $body .= "• <b>Notes:</b> " . htmlspecialchars($notes) . "<br>";
                $body .= "<br>Please review the client details and be available at the scheduled meeting time.<br><br>
                Thank you,<br><b>Livincart System</b>";
                break;

            case 'transferred':
                $subject = "Transfered - New Initial Meeting Assigned | Livincart";
                $body = "Hello " . htmlspecialchars($designerName) . ",<br><br>
                A project consultation has been assigned to you.<br><br>
                <b>Assignment Details:</b><br>
                • <b>Client Name:</b> " . htmlspecialchars($clientName) . "<br>
                • <b>Meeting Date & Time:</b> " . htmlspecialchars($meetingDateTime) . "<br>
                • <b>Previous Designer:</b> " . htmlspecialchars($data['previous_designer'] ?? 'N/A') . "<br>
                • <b>Assigned By:</b> " . htmlspecialchars($salesPersonName) . "<br>";
                if ($notes) $body .= "• <b>Notes:</b> " . htmlspecialchars($notes) . "<br>";
                $body .= "<br>Please review the project details and be available for the scheduled consultation.<br><br>
                Best Regards,<br><b>Team Livincart</b>";
                break;

            case 'rescheduled':
                $subject = "Rescheduled - New Initial Meeting | Livincart";
                $body = "Hello " . htmlspecialchars($designerName) . ",<br><br>
                Your initial meeting has been rescheduled by the Sales Team.<br><br>
                <b>Updated Meeting Details:</b><br>
                • <b>Client Name:</b> " . htmlspecialchars($clientName) . "<br>
                • <b>Contact Number:</b> " . htmlspecialchars($clientPhone) . "<br>
                • <b>Project Type:</b> " . htmlspecialchars($projectType) . "<br>
                • <b>Previous Date & Time:</b> " . htmlspecialchars($data['old_datetime'] ?? 'N/A') . "<br>
                • <b>New Date & Time:</b> " . htmlspecialchars($meetingDateTime) . "<br>
                • <b>Meeting Mode:</b> " . htmlspecialchars($meetingMode) . "<br>";
                if ($meetingLink) $body .= "• <b>Meeting Link:</b> <a href=\"{$meetingLink}\">{$meetingLink}</a><br>";
                $body .= "• <b>Rescheduled By:</b> " . htmlspecialchars($salesPersonName) . "<br>";
                if ($notes) $body .= "• <b>Notes:</b> " . htmlspecialchars($notes) . "<br>";
                $body .= "<br>Please review the updated meeting details and be available at the revised time.<br><br>
                Thank you,<br><b>Livincart System</b>";
                break;

            case 'cancelled':
                $subject = "Cancelled - New Initial Meeting | Livincart";
                $body = "Hello " . htmlspecialchars($designerName) . ",<br><br>
                Your scheduled initial meeting has been cancelled.<br><br>
                <b>Cancelled Meeting Details:</b><br>
                • <b>Client Name:</b> " . htmlspecialchars($clientName) . "<br>
                • <b>Contact Number:</b> " . htmlspecialchars($clientPhone) . "<br>
                • <b>Scheduled Date & Time:</b> " . htmlspecialchars($meetingDateTime) . "<br>
                • <b>Cancelled By:</b> " . htmlspecialchars($salesPersonName) . "<br>";
                if (!empty($data['reason'])) $body .= "• <b>Reason:</b> " . htmlspecialchars($data['reason']) . "<br>";
                $body .= "<br>The scheduled meeting is no longer active.<br><br>
                Thank you,<br><b>Livincart System</b>";
                break;

            case 'completed':
                $subject = "Completed - New Initial Meeting | LivinCart | Project ID " . $projectId;
                $body = "Hello " . htmlspecialchars($designerName) . ",<br><br>
                The Initial Design Consultation for the below project has been completed.<br><br>
                • <b>Project ID:</b> " . htmlspecialchars($projectId) . "<br>
                • <b>Client Name:</b> " . htmlspecialchars($clientName) . "<br>
                • <b>Meeting Date:</b> " . htmlspecialchars($meetingDateTime) . "<br><br>
                Kindly proceed with the design process as per the discussed requirements.<br><br>
                Regards,<br><b>Team LivinCart</b>";
                break;
            default:
                return false;
        }

        return self::sendMail($recipients, $subject, $body);
    }

    // -------------------------------------------------------------
    // CATEGORY 3: QUOTATION MAILER
    // -------------------------------------------------------------
    public static function sendQuotationNotification($conn, $type, $data, $attachments = [])
    {
        $clientEmail = $data['client_email'] ?? $data['to'] ?? '';
        $clientName = $data['client_name'] ?? 'Valued Client';
        $quoteNo = $data['quote_number'] ?? 'QTN-101';
        $date = $data['date'] ?? date('d M Y');
        $validUntil = $data['valid_until'] ?? date('d M Y', strtotime('+15 days'));
        $totalAmount = isset($data['total_amount']) ? '₹' . number_format($data['total_amount'], 2) : '';

        if ($type === 'initial') {
            $subject = "Initial Quotation_#{$quoteNo} | Livincart";
            $body = "Dear " . htmlspecialchars($clientName) . ",<br><br>
            Greetings from LivinCart! Please find your quotation attached.<br><br>
            <b>Quotation Summary:</b><br>
            • <b>Client Name:</b> " . htmlspecialchars($clientName) . "<br>
            • <b>Date:</b> " . htmlspecialchars($date) . "<br>
            • <b>Valid Until:</b> " . htmlspecialchars($validUntil) . "<br>";
            if ($totalAmount) $body .= "• <b>Total Amount:</b> " . htmlspecialchars($totalAmount) . "<br>";
            $body .= "<br>Please review the attached quotation and let us know if you need any modifications. We will be happy to assist you.<br><br>
            Thank you for considering LivinCart. We look forward to working with you.<br><br>
            Warm Regards,<br><b>Team LivinCart</b>";
        } else {
            $revNo = $data['rev_no'] ?? 'Rev.01';
            $subject = "Revised Quotation – #{$quoteNo} | Livincart";
            $body = "Dear " . htmlspecialchars($clientName) . ",<br><br>
            Please find the revised quotation attached for your review.<br><br>
            • <b>Client Name:</b> " . htmlspecialchars($clientName) . "<br>
            • <b>Quotation Date:</b> " . htmlspecialchars($date) . "<br>
            • <b>Valid Until:</b> " . htmlspecialchars($validUntil) . "<br><br>
            Please let us know if you require any further modifications.<br><br>
            Thank you for choosing LivinCart.<br><br>
            Regards,<br><b>Team LivinCart</b>";
        }

        return self::sendMail($clientEmail, $subject, $body, $attachments);
    }

    // -------------------------------------------------------------
    // CATEGORY 4: CLIENT MEETING FORMAT
    // -------------------------------------------------------------
    public static function sendClientMeetingNotification($conn, $type, $data)
    {
        $clientEmail = $data['client_email'] ?? '';
        $clientName = $data['client_name'] ?? 'Client';
        $dateTime = $data['datetime'] ?? date('M d, Y, h:i A');
        $scheduledBy = $data['scheduled_by'] ?? 'LivinCart Team';
        $mode = $data['mode'] ?? 'Online';
        $link = $data['link'] ?? '';

        if (empty($clientEmail)) return false;

        switch ($type) {
            case 'scheduled':
                $subject = "Livincart – Initial Design Consultation Scheduled";
                $body = "Hello " . htmlspecialchars($clientName) . ",<br><br>
                Your initial design consultation has been successfully scheduled.<br><br>
                <b>Meeting Details:</b><br>
                • <b>Date & Time:</b> " . htmlspecialchars($dateTime) . "<br>
                • <b>Scheduled By:</b> " . htmlspecialchars($scheduledBy) . "<br>
                • <b>Meeting Mode:</b> " . htmlspecialchars($mode) . "<br>";
                if ($link) $body .= "• <b>Meeting Link:</b> <a href=\"{$link}\">{$link}</a><br>";
                $body .= "<br>We look forward to discussing your project requirements and helping you bring your ideas to life.<br><br>
                Best Regards,<br><b>The Livincart Team</b>";
                break;

            case 'rescheduled':
                $subject = "Livincart – Rescheduled Initial Design Consultation";
                $body = "Hello " . htmlspecialchars($clientName) . ",<br><br>
                Your scheduled meeting has been rescheduled.<br><br>
                <b>Updated Meeting Details:</b><br>
                • <b>Client Name:</b> " . htmlspecialchars($clientName) . "<br>
                • <b>Previous Date & Time:</b> " . htmlspecialchars($data['old_datetime'] ?? 'N/A') . "<br>
                • <b>New Date & Time:</b> " . htmlspecialchars($dateTime) . "<br>
                • <b>Rescheduled By:</b> " . htmlspecialchars($scheduledBy) . "<br>";
                if (!empty($data['reason'])) $body .= "• <b>Reason:</b> " . htmlspecialchars($data['reason']) . "<br>";
                $body .= "<br>Please update your schedule and be available at the revised meeting time.<br><br>
                Best Regards,<br><b>The Livincart Team</b>";
                break;

            case 'cancelled':
                $subject = "Livincart – Cancelled Initial Design Consultation";
                $body = "Hello " . htmlspecialchars($clientName) . ",<br><br>
                Your scheduled initial design consultation has been cancelled.<br><br>
                <b>Cancelled Meeting Details:</b><br>
                • <b>Client Name:</b> " . htmlspecialchars($clientName) . "<br>
                • <b>Previous Meeting Date & Time:</b> " . htmlspecialchars($dateTime) . "<br>
                • <b>Cancelled By:</b> " . htmlspecialchars($scheduledBy) . "<br>";
                if (!empty($data['reason'])) $body .= "• <b>Reason:</b> " . htmlspecialchars($data['reason']) . "<br>";
                $body .= "<br>The scheduled meeting is no longer active.<br><br>
                Best Regards,<br><b>The Livincart Team</b>";
                break;

            case 'completed':
                $subject = "LivinCart – Initial Design Consultation Completed";
                $body = "Hello " . htmlspecialchars($clientName) . ",<br><br>
                Thank you for attending the Initial Design Consultation. The meeting has been successfully completed.<br><br>
                <b>Meeting Details:</b><br>
                • <b>Client Name:</b> " . htmlspecialchars($clientName) . "<br>
                • <b>Meeting Date & Time:</b> " . htmlspecialchars($dateTime) . "<br>
                • <b>Meeting Mode:</b> " . htmlspecialchars($mode) . "<br>
                • <b>Consultation Conducted By:</b> " . htmlspecialchars($data['designer_name'] ?? 'LivinCart Designer') . "<br><br>
                Our design team will now proceed with the next stage of your project and will keep you informed of upcoming milestones.<br><br>
                Best Regards,<br><b>The LivinCart Team</b>";
                break;
            default:
                return false;
        }

        return self::sendMail($clientEmail, $subject, $body);
    }

    // -------------------------------------------------------------
    // CATEGORY 5: ORDER BOOKED / ONBOARDING
    // -------------------------------------------------------------
    public static function sendOrderBookedNotification($conn, $data)
    {
        $projectId = $data['project_id'] ?? 'PRJ-101';
        $clientName = $data['client_name'] ?? 'Client';
        $clientEmail = $data['client_email'] ?? $data['email'] ?? '';
        if (empty($clientEmail) && !empty($data['lead_id']) && $conn) {
            try {
                $cl_stmt = $conn->prepare("SELECT email FROM leads WHERE lead_id = :lid LIMIT 1");
                $cl_stmt->execute(['lid' => $data['lead_id']]);
                $cl_row = $cl_stmt->fetch(PDO::FETCH_ASSOC);
                if ($cl_row && !empty($cl_row['email'])) {
                    $clientEmail = $cl_row['email'];
                }
            } catch (Exception $e) {}
        }
        $designerName = $data['designer_name'] ?? 'Designer';
        $designerEmail = $data['designer_email'] ?? self::getUserEmail($conn, $data['designer_id'] ?? null);
        $onboardingDate = $data['onboarding_date'] ?? date('d M Y');
        $projectName = $data['project_name'] ?? 'Interior Project';
        $pmName = $data['project_manager'] ?? 'Assigned Project Manager';
        $salesName = $data['sales_name'] ?? 'Sales Team';
        $salesEmail = $data['sales_email'] ?? null;
        $totalBudget = !empty($data['total_budget']) ? floatval($data['total_budget']) : 0;
        $totalBudgetFormatted = $totalBudget > 0 ? ('₹' . number_format($totalBudget, 2)) : '';

        // 1. Designer Notice
        if ($designerEmail) {
            $subjDesigner = "Order Confirmed – Client Onboarded | LivinCart | Project ID " . $projectId;
            $bodyDesigner = "Hello " . htmlspecialchars($designerName) . ",<br><br>
            The client has been successfully onboarded, and the Initial Design Consultation / Quotation Acceptance has been completed.<br><br>
            • <b>Project ID:</b> " . htmlspecialchars($projectId) . "<br>
            • <b>Client Name:</b> " . htmlspecialchars($clientName) . "<br>
            • <b>Onboarding Date:</b> " . htmlspecialchars($onboardingDate) . "<br><br>
            Kindly proceed with the design phase as per the agreed requirements and project timeline.<br><br>
            Regards,<br><b>Team LivinCart</b>";
            self::sendMail($designerEmail, $subjDesigner, $bodyDesigner);
        }

        // 2. Client Welcome
        if ($clientEmail) {
            $subjClient = "Welcome to LivinCart | Order Confirmed | Project ID " . $projectId;
            $bodyClient = "Dear " . htmlspecialchars($clientName) . ",<br><br>
            Welcome to LivinCart and Services Private Limited! Your quotation proposal has been officially accepted, your project has been onboarded, and we are excited to begin your interior journey with us.<br><br>
            <b>Project Details:</b><br>
            • <b>Project ID:</b> " . htmlspecialchars($projectId) . "<br>
            • <b>Project Name:</b> " . htmlspecialchars($projectName) . "<br>
            • <b>Project Manager:</b> " . htmlspecialchars($pmName) . "<br>
            • <b>Onboarding Date:</b> " . htmlspecialchars($onboardingDate) . "<br><br>
            Our team will guide you through each stage of your project and keep you informed throughout the process.<br><br>
            Thank you for choosing LivinCart. We look forward to creating your dream space.<br><br>
            Regards,<br><b>Team LivinCart</b>";
            self::sendMail($clientEmail, $subjClient, $bodyClient);
        }

        // 3. Admin & Management Notice
        $adminEmails = self::getAdminAndManagerEmails($conn);
        if (!empty($adminEmails)) {
            $subjAdmin = "Order Booked & Confirmed – " . $clientName . " | Project ID " . $projectId . " | LivinCart";
            $bodyAdmin = "Hello Admin & Management Team,<br><br>
            Great news! A quotation proposal has been accepted, and the project is officially confirmed and onboarded.<br><br>
            <b>Project Summary:</b><br>
            • <b>Project ID:</b> " . htmlspecialchars($projectId) . "<br>
            • <b>Project Name:</b> " . htmlspecialchars($projectName) . "<br>
            • <b>Client Name:</b> " . htmlspecialchars($clientName) . "<br>
            • <b>Client Email:</b> " . htmlspecialchars($clientEmail ?: 'N/A') . "<br>
            • <b>Assigned Designer:</b> " . htmlspecialchars($designerName) . ($designerEmail ? " (" . htmlspecialchars($designerEmail) . ")" : "") . "<br>
            • <b>Sales Executive:</b> " . htmlspecialchars($salesName) . ($salesEmail ? " (" . htmlspecialchars($salesEmail) . ")" : "") . "<br>
            • <b>Project Manager:</b> " . htmlspecialchars($pmName) . "<br>" .
            ($totalBudgetFormatted ? "• <b>Total Budget:</b> " . htmlspecialchars($totalBudgetFormatted) . "<br>" : "") .
            "• <b>Confirmation Date:</b> " . htmlspecialchars($onboardingDate) . "<br><br>
            The lead has been automatically converted into an active project in the LivinCart system.<br><br>
            Regards,<br><b>Team LivinCart</b>";
            self::sendMail($adminEmails, $subjAdmin, $bodyAdmin);
        }

        // 4. Sales Team Notice
        if ($salesEmail && $salesEmail !== $clientEmail) {
            $subjSales = "Deal Won! Order Confirmed – " . $clientName . " | Project ID " . $projectId . " | LivinCart";
            $bodySales = "Hello " . htmlspecialchars($salesName) . ",<br><br>
            Congratulations! Your client <b>" . htmlspecialchars($clientName) . "</b> has officially accepted the quotation proposal and the order is now booked!<br><br>
            <b>Project Details:</b><br>
            • <b>Project ID:</b> " . htmlspecialchars($projectId) . "<br>
            • <b>Client Name:</b> " . htmlspecialchars($clientName) . "<br>
            • <b>Assigned Designer:</b> " . htmlspecialchars($designerName) . "<br>" .
            ($totalBudgetFormatted ? "• <b>Total Project Budget:</b> " . htmlspecialchars($totalBudgetFormatted) . "<br>" : "") .
            "• <b>Confirmation Date:</b> " . htmlspecialchars($onboardingDate) . "<br><br>
            The lead has been converted to an active project and design onboarding is underway.<br><br>
            Great job,<br><b>Team LivinCart</b>";
            self::sendMail($salesEmail, $subjSales, $bodySales);
        }

        return true;
    }

    /**
     * CATEGORY: INITIAL QUOTATION ACCEPTANCE NOTIFICATION
     * Sent when client accepts the initial quotation proposal in the email.
     * Notifies Admin, Project Manager, Designer, and Sales that Initial Quote is Accepted.
     * Clarifies that Order Confirmation is pending 100% Stage 1 Token Advance payment.
     */
    public static function sendInitialQuoteAcceptedNotification($conn, $data)
    {
        $quoteId = $data['quote_id'] ?? '';
        $refId = $data['ref_id'] ?? ('QT-' . $quoteId);
        $clientName = $data['client_name'] ?? 'Client';
        $clientEmail = $data['client_email'] ?? '';
        $designerName = $data['designer_name'] ?? 'Designer';
        $designerEmail = $data['designer_email'] ?? self::getUserEmail($conn, $data['designer_id'] ?? null);
        $salesName = $data['sales_name'] ?? 'Sales Team';
        $salesEmail = $data['sales_email'] ?? null;
        $totalBudget = !empty($data['quote_amt']) ? floatval($data['quote_amt']) : (!empty($data['total_budget']) ? floatval($data['total_budget']) : 0);
        $totalBudgetFormatted = $totalBudget > 0 ? ('₹' . number_format($totalBudget, 2)) : '';
        $acceptedDate = date('d M Y, h:i A');

        // 1. Admin & Project Managers Notice
        $adminEmails = self::getAdminAndManagerEmails($conn);
        if (!empty($adminEmails)) {
            $subjAdmin = "Initial Quotation Accepted by Client – " . $clientName . " | " . $refId . " | LivinCart";
            $bodyAdmin = "Hello Admin & Management Team,<br><br>
            Client <b>" . htmlspecialchars($clientName) . "</b> has officially accepted the <b>Initial Quotation Proposal</b>.<br><br>
            <b>Proposal Summary:</b><br>
            • <b>Quotation Ref:</b> " . htmlspecialchars($refId) . "<br>
            • <b>Client Name:</b> " . htmlspecialchars($clientName) . "<br>
            • <b>Client Email:</b> " . htmlspecialchars($clientEmail ?: 'N/A') . "<br>
            • <b>Assigned Designer:</b> " . htmlspecialchars($designerName) . ($designerEmail ? " (" . htmlspecialchars($designerEmail) . ")" : "") . "<br>
            • <b>Sales Executive:</b> " . htmlspecialchars($salesName) . ($salesEmail ? " (" . htmlspecialchars($salesEmail) . ")" : "") . "<br>" .
            ($totalBudgetFormatted ? "• <b>Quotation Amount:</b> " . htmlspecialchars($totalBudgetFormatted) . "<br>" : "") .
            "• <b>Accepted Date:</b> " . htmlspecialchars($acceptedDate) . "<br><br>
            <b>Status:</b> Initial Quotation Accepted.<br>
            <b>⚠️ Next Action:</b> Order Confirmation and Project Start will take place ONLY after 100% of <b>Stage 1: Token Advance</b> is received and verified.<br><br>
            Regards,<br><b>Team LivinCart</b>";
            self::sendMail($adminEmails, $subjAdmin, $bodyAdmin);
        }

        // 2. Designer Notice
        if ($designerEmail) {
            $subjDesigner = "Initial Quotation Accepted – " . $clientName . " | " . $refId . " | LivinCart";
            $bodyDesigner = "Hello " . htmlspecialchars($designerName) . ",<br><br>
            Your client <b>" . htmlspecialchars($clientName) . "</b> has accepted the Initial Quotation proposal (Ref: " . htmlspecialchars($refId) . ").<br><br>
            • <b>Client Name:</b> " . htmlspecialchars($clientName) . "<br>
            • <b>Quotation Ref:</b> " . htmlspecialchars($refId) . "<br>" .
            ($totalBudgetFormatted ? "• <b>Quotation Amount:</b> " . htmlspecialchars($totalBudgetFormatted) . "<br>" : "") .
            "• <b>Accepted Date:</b> " . htmlspecialchars($acceptedDate) . "<br><br>
            <b>Next Step:</b> Awaiting Stage 1: Token Advance payment to confirm order and commence project site kick-off.<br><br>
            Regards,<br><b>Team LivinCart</b>";
            self::sendMail($designerEmail, $subjDesigner, $bodyDesigner);
        }

        // 3. Sales Notice
        if ($salesEmail && $salesEmail !== $clientEmail) {
            $subjSales = "Initial Quotation Accepted – " . $clientName . " | " . $refId . " | LivinCart";
            $bodySales = "Hello " . htmlspecialchars($salesName) . ",<br><br>
            Client <b>" . htmlspecialchars($clientName) . "</b> has accepted the Initial Quotation proposal (Ref: " . htmlspecialchars($refId) . ").<br><br>
            • <b>Client Name:</b> " . htmlspecialchars($clientName) . "<br>
            • <b>Quotation Ref:</b> " . htmlspecialchars($refId) . "<br>" .
            ($totalBudgetFormatted ? "• <b>Quotation Amount:</b> " . htmlspecialchars($totalBudgetFormatted) . "<br>" : "") .
            "• <b>Accepted Date:</b> " . htmlspecialchars($acceptedDate) . "<br><br>
            Please coordinate with the client to collect the 100% Stage 1: Token Advance payment to officially book the order.<br><br>
            Regards,<br><b>Team LivinCart</b>";
            self::sendMail($salesEmail, $subjSales, $bodySales);
        }

        return true;
    }

    // -------------------------------------------------------------
    // CATEGORY 6: D1 MEASUREMENT SLOT
    // -------------------------------------------------------------
    public static function sendD1MeasurementNotification($conn, $type, $data)
    {
        $d1Email = $data['d1_email'] ?? self::getUserEmail($conn, $data['d1_user_id'] ?? null);
        $clientEmail = $data['client_email'] ?? '';
        $recipients = array_filter([$d1Email, $clientEmail]);

        $measPersonName = $data['d1_name'] ?? 'Measurement Engineer';
        $clientName = $data['client_name'] ?? 'Client';
        $dateTime = $data['datetime'] ?? date('d M Y, h:i A');
        $address = $data['address'] ?? '';
        $assignedBy = $data['assigned_by'] ?? 'Sales Team';
        $notes = $data['notes'] ?? '';
        $projectId = $data['project_id'] ?? '';
        $scopeOfWork = $data['scope_of_work'] ?? 'Complete Site Measurement';

        switch ($type) {
            case 'booked':
                $subject = "D1 Measurement Slot Booked | Livincart";
                $body = "Hello " . htmlspecialchars($measPersonName) . ",<br><br>
                A new measurement slot has been booked for you.<br><br>
                <b>Measurement Details:</b><br>
                • <b>Client Name:</b> " . htmlspecialchars($clientName) . "<br>
                • <b>Date & Time:</b> " . htmlspecialchars($dateTime) . "<br>
                • <b>Scope of Work:</b> " . htmlspecialchars($scopeOfWork) . "<br>
                • <b>Property Address:</b> " . htmlspecialchars($address) . "<br>
                • <b>Assigned By:</b> " . htmlspecialchars($assignedBy) . "<br>";
                if ($notes) $body .= "• <b>Notes:</b> " . htmlspecialchars($notes) . "<br>";
                $body .= "<br>Please be available at the scheduled time to take the site measurements.<br><br>
                Best Regards,<br><b>Team Livincart</b>";
                break;

            case 'rescheduled':
                $subject = "Rescheduled D1 Measurement Slot | Livincart";
                $body = "Hello " . htmlspecialchars($measPersonName) . ",<br><br>
                Your scheduled measurement appointment has been rescheduled.<br><br>
                <b>Updated Measurement Details:</b><br>
                • <b>Client Name:</b> " . htmlspecialchars($clientName) . "<br>
                • <b>Previous Date & Time:</b> " . htmlspecialchars($data['old_datetime'] ?? 'N/A') . "<br>
                • <b>New Date & Time:</b> " . htmlspecialchars($dateTime) . "<br>
                • <b>Project Address:</b> " . htmlspecialchars($address) . "<br>
                • <b>Rescheduled By:</b> " . htmlspecialchars($assignedBy) . "<br>";
                if ($notes) $body .= "• <b>Notes:</b> " . htmlspecialchars($notes) . "<br>";
                $body .= "<br>Please update your schedule and be available at the revised time.<br><br>
                Best Regards,<br><b>Team Livincart</b>";
                break;

            case 'cancelled':
                $subject = "Cancelled - D1 Measurement Slot | Livincart";
                $body = "Hello " . htmlspecialchars($measPersonName) . ",<br><br>
                Your scheduled measurement appointment has been cancelled.<br><br>
                <b>Cancelled Measurement Details:</b><br>
                • <b>Client Name:</b> " . htmlspecialchars($clientName) . "<br>
                • <b>Scheduled Date & Time:</b> " . htmlspecialchars($dateTime) . "<br>
                • <b>Project Address:</b> " . htmlspecialchars($address) . "<br>
                • <b>Cancelled By:</b> " . htmlspecialchars($assignedBy) . "<br>";
                if (!empty($data['reason'])) $body .= "• <b>Reason:</b> " . htmlspecialchars($data['reason']) . "<br>";
                $body .= "<br>The scheduled measurement appointment is no longer active.<br><br>
                Best Regards,<br><b>Team Livincart</b>";
                break;

            case 'transferred':
                $subject = "Transferred - D1 Measurement Slot | Livincart";
                $body = "Hello " . htmlspecialchars($measPersonName) . ",<br><br>
                A D1 measurement slot has been transferred to you.<br><br>
                <b>Measurement Details:</b><br>
                • <b>Client Name:</b> " . htmlspecialchars($clientName) . "<br>
                • <b>Date & Time:</b> " . htmlspecialchars($dateTime) . "<br>
                • <b>Project Address:</b> " . htmlspecialchars($address) . "<br>
                • <b>Transferred From:</b> " . htmlspecialchars($data['previous_person'] ?? 'N/A') . "<br>
                • <b>Transferred By:</b> " . htmlspecialchars($assignedBy) . "<br>";
                if ($notes) $body .= "• <b>Notes:</b> " . htmlspecialchars($notes) . "<br>";
                $body .= "<br>Please review the measurement details and be available at the scheduled time.<br><br>
                Best Regards,<br><b>Team Livincart</b>";
                break;

            case 'completed':
                $subject = "Completed - D1 Measurement | LivinCart";
                $body = "Hello " . htmlspecialchars($data['designer_name'] ?? 'Designer') . ",<br><br>
                The scheduled D1 site measurement has been successfully completed.<br><br>
                <b>Measurement Details:</b><br>
                • <b>Project ID:</b> " . htmlspecialchars($projectId) . "<br>
                • <b>Client Name:</b> " . htmlspecialchars($clientName) . "<br>
                • <b>Measurement Date & Time:</b> " . htmlspecialchars($dateTime) . "<br>
                • <b>Scope of Work:</b> " . htmlspecialchars($scopeOfWork) . "<br>
                • <b>Property Address:</b> " . htmlspecialchars($address) . "<br>
                • <b>Measured By:</b> " . htmlspecialchars($measPersonName) . "<br>";
                if (!empty($data['remarks'])) $body .= "• <b>Remarks:</b> " . htmlspecialchars($data['remarks']) . "<br>";
                $body .= "<br>Kindly log in to the system to review the submitted measurements and proceed with the design process.<br><br>
                Best Regards,<br><b>Team LivinCart</b>";
                break;
            default:
                return false;
        }

        return self::sendMail($recipients, $subject, $body);
    }

    // -------------------------------------------------------------
    // CATEGORY 7: MASKING SLOT
    // -------------------------------------------------------------
    public static function sendMaskingSlotNotification($conn, $type, $data)
    {
        $pmEmail = $data['pm_email'] ?? self::getUserEmail($conn, $data['pm_id'] ?? null);
        $maskingTeamEmails = self::getAdminAndManagerEmails($conn);
        $recipients = array_unique(array_filter(array_merge([$pmEmail], $maskingTeamEmails)));

        $pmName = $data['pm_name'] ?? 'Project Manager';
        $clientName = $data['client_name'] ?? 'Client';
        $dateTime = $data['datetime'] ?? date('d M Y, h:i A');
        $projectId = $data['project_id'] ?? '';
        $address = $data['address'] ?? '';
        $assignedBy = $data['assigned_by'] ?? 'Designer';
        $notes = $data['notes'] ?? '';

        switch ($type) {
            case 'booked':
                $subject = "Masking Slot Booked | Livincart | Project ID " . $projectId;
                $body = "Hello " . htmlspecialchars($pmName) . ",<br><br>
                A new masking slot has been booked for you.<br><br>
                <b>Masking Details:</b><br>
                • <b>Client Name:</b> " . htmlspecialchars($clientName) . "<br>
                • <b>Date & Time:</b> " . htmlspecialchars($dateTime) . "<br>
                • <b>Project ID:</b> " . htmlspecialchars($projectId) . "<br>
                • <b>Project Address:</b> " . htmlspecialchars($address) . "<br>
                • <b>Assigned By:</b> " . htmlspecialchars($assignedBy) . "<br>";
                if ($notes) $body .= "• <b>Notes:</b> " . htmlspecialchars($notes) . "<br>";
                $body .= "<br>Please be available at the scheduled time to oversee and complete the masking process.<br><br>
                Best Regards,<br><b>The Livincart Team</b>";
                break;

            case 'rescheduled':
                $subject = "Masking Slot Rescheduled | Livincart | Project ID " . $projectId;
                $body = "Hello " . htmlspecialchars($pmName) . ",<br><br>
                Your scheduled masking slot has been rescheduled.<br><br>
                <b>Updated Masking Details:</b><br>
                • <b>Client Name:</b> " . htmlspecialchars($clientName) . "<br>
                • <b>Previous Date & Time:</b> " . htmlspecialchars($data['old_datetime'] ?? 'N/A') . "<br>
                • <b>New Date & Time:</b> " . htmlspecialchars($dateTime) . "<br>
                • <b>Project ID:</b> " . htmlspecialchars($projectId) . "<br>
                • <b>Project Address:</b> " . htmlspecialchars($address) . "<br>
                • <b>Rescheduled By:</b> " . htmlspecialchars($assignedBy) . "<br>";
                if ($notes) $body .= "• <b>Notes:</b> " . htmlspecialchars($notes) . "<br>";
                $body .= "<br>Please update your schedule and be available at the revised time.<br><br>
                Best Regards,<br><b>Team Livincart</b>";
                break;

            case 'cancelled':
                $subject = "Masking Slot Cancelled | Livincart | Project ID " . $projectId;
                $body = "Hello " . htmlspecialchars($pmName) . ",<br><br>
                The scheduled masking slot for the below project has been cancelled.<br><br>
                <b>Cancelled Masking Details:</b><br>
                • <b>Client Name:</b> " . htmlspecialchars($clientName) . "<br>
                • <b>Project ID:</b> " . htmlspecialchars($projectId) . "<br>
                • <b>Cancelled Date & Time:</b> " . htmlspecialchars($dateTime) . "<br>
                • <b>Project Address:</b> " . htmlspecialchars($address) . "<br>
                • <b>Cancelled By:</b> " . htmlspecialchars($assignedBy) . "<br>";
                if (!empty($data['reason'])) $body .= "• <b>Reason:</b> " . htmlspecialchars($data['reason']) . "<br>";
                $body .= "<br>Kindly update your schedule accordingly.<br><br>
                Best Regards,<br><b>Team Livincart</b>";
                break;

            case 'completed':
                $subject = "Masking Completed | Livincart | Project ID " . $projectId;
                $body = "Hello " . htmlspecialchars($pmName) . ",<br><br>
                The masking work for the below project has been successfully completed.<br><br>
                • <b>Project ID:</b> " . htmlspecialchars($projectId) . "<br>
                • <b>Client Name:</b> " . htmlspecialchars($clientName) . "<br>
                • <b>Completion Date:</b> " . htmlspecialchars($dateTime) . "<br>
                • <b>Completed By:</b> " . htmlspecialchars($data['completed_by'] ?? $pmName) . "<br><br>
                The project is now ready for the next stage.<br><br>
                Regards,<br><b>Team Livincart</b>";
                break;
            default:
                return false;
        }

        return self::sendMail($recipients, $subject, $body);
    }

    // -------------------------------------------------------------
    // CATEGORY 8: QUALITY CHECK (QC)
    // -------------------------------------------------------------
    public static function sendQCNotification($conn, $type, $data, $attachments = [])
    {
        $qcEmail = $data['qc_email'] ?? self::getUserEmail($conn, $data['qc_id'] ?? null);
        $designerEmail = $data['designer_email'] ?? self::getUserEmail($conn, $data['designer_id'] ?? null);
        $teamEmails = self::getAdminAndManagerEmails($conn);
        $recipients = array_unique(array_filter(array_merge([$qcEmail, $designerEmail, $data['client_email'] ?? null], $teamEmails)));

        $projectId = $data['project_id'] ?? 'PRJ-101';
        $projectName = $data['project_name'] ?? 'Project';
        $customerName = $data['customer_name'] ?? 'Customer';
        $designerName = $data['designer_name'] ?? 'Designer';
        $qcName = $data['qc_name'] ?? 'QC Engineer';
        $revNo = $data['rev_no'] ?? 'Rev-00';
        $qcDate = $data['qc_date'] ?? date('d M Y');
        $qcTime = $data['qc_time'] ?? date('h:i A');

        switch ($type) {
            case 'booked':
                $subject = "Slot Booked | Quality Check – Project ID {$projectId} | Livincart";
                $body = "Dear " . htmlspecialchars($qcName) . ",<br><br>
                A Quality Check slot has been booked for the following project.<br><br>
                <b>Project Details:</b><br>
                • <b>Project ID:</b> " . htmlspecialchars($projectId) . "<br>
                • <b>Project Name:</b> " . htmlspecialchars($projectName) . "<br>
                • <b>Customer Name:</b> " . htmlspecialchars($customerName) . "<br>
                • <b>Designer:</b> " . htmlspecialchars($designerName) . "<br>
                • <b>QC Date:</b> " . htmlspecialchars($qcDate) . "<br>
                • <b>QC Time:</b> " . htmlspecialchars($qcTime) . "<br><br>
                Please coordinate with the designer if any additional information or site access is required.<br><br>
                Regards,<br><b>{$designerName} (Design Team)</b>";
                break;

            case 'uploaded':
                $subject = "Uploaded - Quote Version - {$revNo} | Quality Check | Project ID {$projectId}";
                $body = "Dear Quality Check Team,<br><br>
                Please find the updated drawings attached for Quality Check.<br><br>
                <b>Submission Details:</b><br>
                • <b>Project ID:</b> " . htmlspecialchars($projectId) . "<br>
                • <b>Project Name:</b> " . htmlspecialchars($projectName) . "<br>
                • <b>Customer Name:</b> " . htmlspecialchars($customerName) . "<br>
                • <b>Drawing Version:</b> " . htmlspecialchars($revNo) . "<br>
                • <b>Submission Date:</b> " . htmlspecialchars($qcDate) . "<br>
                • <b>Designer:</b> " . htmlspecialchars($designerName) . "<br>";
                if (!empty($data['reason'])) $body .= "• <b>Reason:</b> " . htmlspecialchars($data['reason']) . "<br>";
                $body .= "<br>Kindly review the attached drawings and share your observations or approval.<br><br>
                Regards,<br><b>{$designerName}</b>";
                break;

            case 'rescheduled':
                $subject = "Rescheduled - Quote Version - {$revNo} | Quality Check | Project ID {$projectId}";
                $body = "Dear " . htmlspecialchars($designerName) . ",<br><br>
                The Quality Check for the submitted drawings has been rescheduled.<br><br>
                <b>Rescheduled QC Details:</b><br>
                • <b>Project ID:</b> " . htmlspecialchars($projectId) . "<br>
                • <b>Project Name:</b> " . htmlspecialchars($projectName) . "<br>
                • <b>Customer Name:</b> " . htmlspecialchars($customerName) . "<br>
                • <b>Drawing Version:</b> " . htmlspecialchars($revNo) . "<br>
                • <b>Previous QC Date:</b> " . htmlspecialchars($data['old_qc_date'] ?? 'N/A') . "<br>
                • <b>Revised QC Date:</b> " . htmlspecialchars($qcDate) . "<br>
                • <b>Rescheduled By:</b> " . htmlspecialchars($data['rescheduled_by'] ?? $qcName) . "<br><br>
                <b>Status:</b> Quality Check Rescheduled<br><br>
                Regards,<br><b>{$qcName} (QC Team)</b>";
                break;

            case 'rejected':
                $subject = "Rejected - Quote Version - {$revNo} | Quality Check | Project ID {$projectId}";
                $body = "Dear " . htmlspecialchars($designerName) . ",<br><br>
                The submitted drawings have been reviewed by the Quality Check Team and require revisions before approval.<br><br>
                <b>Review Details:</b><br>
                • <b>Project ID:</b> " . htmlspecialchars($projectId) . "<br>
                • <b>Project Name:</b> " . htmlspecialchars($projectName) . "<br>
                • <b>Customer Name:</b> " . htmlspecialchars($customerName) . "<br>
                • <b>Drawing Version:</b> " . htmlspecialchars($revNo) . "<br>
                • <b>Review Date:</b> " . htmlspecialchars($qcDate) . "<br>
                • <b>QC:</b> " . htmlspecialchars($qcName) . "<br><br>
                <b>QC Observations / Rejection Remarks:</b><br>" . nl2br(htmlspecialchars($data['qc_comments'] ?? 'Revisions required.')) . "<br><br>
                <b>Status: Rejected – Resubmission Required</b><br><br>
                Regards,<br><b>{$qcName}</b>";
                break;

            case 'approved':
                $subject = "Approved - Quote Version - {$revNo} | Quality Check | Project ID {$projectId}";
                $body = "Dear " . htmlspecialchars($designerName) . ",<br><br>
                The submitted drawings have been successfully reviewed and approved by the Quality Check Team.<br><br>
                <b>Review Details:</b><br>
                • <b>Project ID:</b> " . htmlspecialchars($projectId) . "<br>
                • <b>Project Name:</b> " . htmlspecialchars($projectName) . "<br>
                • <b>Customer Name:</b> " . htmlspecialchars($customerName) . "<br>
                • <b>Drawing Version:</b> " . htmlspecialchars($revNo) . "<br>
                • <b>Review Date:</b> " . htmlspecialchars($qcDate) . "<br>
                • <b>QC:</b> " . htmlspecialchars($qcName) . "<br><br>
                <b>Status: Approved – Ready for Execution</b><br><br>
                Regards,<br><b>{$qcName}</b>";
                break;
            default:
                return false;
        }

        return self::sendMail($recipients, $subject, $body, $attachments);
    }

    // -------------------------------------------------------------
    // CATEGORY 9: WORKS CONTRACT / AGREEMENT
    // -------------------------------------------------------------
    public static function sendWorksContractNotification($conn, $type, $data, $attachments = [])
    {
        $clientEmail = $data['client_email'] ?? '';
        $customerName = $data['customer_name'] ?? 'Valued Client';
        $projectId = $data['project_id'] ?? 'PRJ-101';
        $projectName = $data['project_name'] ?? 'Interior Project';
        $agreementNo = $data['agreement_no'] ?? 'AGR-101';
        $agreementDate = $data['agreement_date'] ?? date('d M Y');
        $projectValue = isset($data['project_value']) ? '₹' . number_format($data['project_value'], 2) : 'N/A';
        $pmName = $data['project_manager'] ?? 'Project Manager';

        if (empty($clientEmail)) return false;

        if ($type === 'sent') {
            $subject = "Livincart-Works Contract Sent– Project ID " . $projectId;
            $body = "Dear " . htmlspecialchars($customerName) . ",<br><br>
            Please find the attached Service Agreement for your review and signature.<br><br>
            <b>Agreement Details:</b><br>
            • <b>Project ID:</b> " . htmlspecialchars($projectId) . "<br>
            • <b>Agreement No.:</b> " . htmlspecialchars($agreementNo) . "<br>
            • <b>Customer Name:</b> " . htmlspecialchars($customerName) . "<br>
            • <b>Project Name:</b> " . htmlspecialchars($projectName) . "<br>
            • <b>Agreement Date:</b> " . htmlspecialchars($agreementDate) . "<br>
            • <b>Project Value:</b> " . htmlspecialchars($projectValue) . "<br>
            • <b>Project Manager:</b> " . htmlspecialchars($pmName) . "<br><br>
            Kindly sign and return the executed copy to initiate your project.<br><br>
            Kind Regards,<br><b>LivinCart and Services Private Limited</b>";
        } else {
            $subject = "Livincart - Works Contract Approved | Project ID " . $projectId;
            $body = "Dear " . htmlspecialchars($customerName) . ",<br><br>
            Thank you for signing and approving the Works Contract for your project. Your project has now been successfully confirmed and will proceed as per agreed terms.<br><br>
            <b>Project Details:</b><br>
            • <b>Project ID:</b> " . htmlspecialchars($projectId) . "<br>
            • <b>Project Name:</b> " . htmlspecialchars($projectName) . "<br>
            • <b>Works Contract No.:</b> " . htmlspecialchars($agreementNo) . "<br>
            • <b>Approval Date:</b> " . htmlspecialchars(date('d M Y')) . "<br>
            • <b>Project Manager:</b> " . htmlspecialchars($pmName) . "<br><br>
            Our Project Manager will contact you shortly regarding the next steps.<br><br>
            Regards,<br><b>LivinCart and Services Private Limited</b>";
        }

        // Automatically attach fresh Agreement PDF if no attachments provided
        if (empty($attachments) && (!empty($data['agreement_id']) || !empty($data['agreement_no']) || !empty($projectId))) {
            try {
                require_once __DIR__ . '/../controllers/PdfController.php';
                $pdfController = new PdfController($conn);
                $agId = $data['agreement_id'] ?? $data['agreement_no'] ?? $projectId;
                $resPdf = $pdfController->getAgreementPdfForEmail($agId, $data);
                if ($resPdf['success'] && !empty($resPdf['pdf_base64'])) {
                    $pdfDataUri = $resPdf['pdf_base64'];
                    $base64 = strpos($pdfDataUri, ',') !== false ? explode(',', $pdfDataUri)[1] : $pdfDataUri;
                    $pdfBytes = base64_decode($base64);
                    if ($pdfBytes) {
                        $attName = 'Quote_Agreement_Handover_Package_' . ($agreementNo ?: $projectId) . '.pdf';
                        $attachments[] = [
                            'binary' => $pdfBytes,
                            'name'   => $attName,
                            'mime'   => 'application/pdf'
                        ];
                    }
                }
            } catch (Exception $pdfErr) {
                error_log("MailHelper auto-agreement PDF error: " . $pdfErr->getMessage());
            }
        }

        return self::sendMail($clientEmail, $subject, $body, $attachments);
    }

    // -------------------------------------------------------------
    // CATEGORY 10: PRODUCTION & DELIVERY STATUS
    // -------------------------------------------------------------
    public static function sendProductionStatusNotification($conn, $type, $data)
    {
        $clientEmail = $data['client_email'] ?? '';
        $teamEmails = self::getAdminAndManagerEmails($conn);
        $recipients = array_unique(array_filter(array_merge([$clientEmail], $teamEmails)));

        $customerName = $data['customer_name'] ?? 'Valued Client';
        $projectId = $data['project_id'] ?? 'PRJ-101';
        $projectName = $data['project_name'] ?? 'Project';
        $dateStr = $data['date'] ?? date('d M Y');

        switch ($type) {
            case 'production_start':
                $subject = "Livincart - Production Started | Project ID " . $projectId;
                $body = "Dear " . htmlspecialchars($customerName) . ",<br><br>
                We are pleased to inform you that your project has successfully cleared the Quality Check stage, and production has now commenced.<br><br>
                <b>Project Details</b><br><br>
                <b>Project ID:</b> " . htmlspecialchars($projectId) . "<br>
                <b>Project Name:</b> " . htmlspecialchars($projectName) . "<br>
                <b>Production Start Date:</b> " . htmlspecialchars($dateStr) . "<br>
                <b>Expected Completion Date:</b> " . htmlspecialchars($data['expected_completion_date'] ?? 'As per timeline') . "<br><br>
                Our production team has initiated the manufacturing process in accordance with the approved drawings and specifications. We will keep you updated on the progress and notify you once your project is ready for installation.<br><br>
                Thank you for choosing LivinCart and Services Private Limited.<br><br>
                Regards,<br>
                <b>Team LivinCart</b>";
                break;

            case 'ready_to_dispatch':
                $subject = "Livincart - Ready for Dispatch | Project ID " . $projectId;
                $body = "Dear " . htmlspecialchars($customerName) . ",<br><br>
                We are pleased to inform you that your project has been successfully completed in production and is ready for dispatch.<br><br>
                <b>Project Details</b><br><br>
                <b>Project ID:</b> " . htmlspecialchars($projectId) . "<br>
                <b>Project Name:</b> " . htmlspecialchars($projectName) . "<br>
                <b>Dispatch Status:</b> Ready for Dispatch<br>
                <b>Expected Dispatch Date:</b> " . htmlspecialchars($dateStr) . "<br><br>
                Our logistics team will coordinate with you regarding the delivery and installation schedule.<br><br>
                Thank you for choosing LivinCart and Services Private Limited.<br><br>
                Regards,<br>
                <b>Team LivinCart</b>";
                break;

            case 'delivered':
                $subject = "Livincart - Delivered to Site | Project ID " . $projectId;
                $body = "Dear " . htmlspecialchars($customerName) . ",<br><br>
                We are pleased to inform you that your project materials have been successfully delivered to the project site.<br><br>
                <b>Delivery Details</b><br><br>
                <b>Project ID:</b> " . htmlspecialchars($projectId) . "<br>
                <b>Project Name:</b> " . htmlspecialchars($projectName) . "<br>
                <b>Delivery Date:</b> " . htmlspecialchars($dateStr) . "<br>
                <b>Delivery Location:</b> " . htmlspecialchars($data['address'] ?? $data['location'] ?? 'Site Address') . "<br><br>
                Our installation team will coordinate with you regarding the installation schedule and next steps.<br><br>
                Thank you for choosing LivinCart and Services Private Limited.<br><br>
                Regards,<br>
                <b>Team LivinCart</b>";
                break;

            case 'handover_sent':
                $subject = "Livincart - Project Handover Agreement | Project ID " . $projectId;
                $body = "Dear " . htmlspecialchars($customerName) . ",<br><br>
                We are pleased to inform you that your LivinCart Project has been completed and is ready for handover.<br><br>
                Please find the attached Project Handover Agreement for your review and signature. Upon execution, the project will be officially handed over, and the applicable warranty period will commence as per the Works Contract and Warranty Policy.<br><br>
                Kindly sign and return a copy for our records.<br><br>
                Thank you for choosing LivinCart and Services Private Limited. We appreciate your trust and look forward to serving you again.<br><br>
                Regards,<br>
                <b>LivinCart and Services Private Limited</b><br>
                Customer Support Team";
                break;

            case 'handover_completed':
                $subject = "Livincart - Project Handover Completed | Project ID " . $projectId;
                $body = "Dear " . htmlspecialchars($customerName) . ",<br><br>
                We are pleased to inform you that your LivinCart Project has been successfully handed over.<br><br>
                Your signed Project Handover Agreement has been received, and the handover process is now complete. The applicable warranty for your project is effective from the handover date, in accordance with the Works Contract and Warranty Policy.<br><br>
                <b>Project Details</b><br><br>
                <b>Project ID:</b> " . htmlspecialchars($projectId) . "<br>
                <b>Project Name:</b> " . htmlspecialchars($projectName) . "<br>
                <b>Handover Date:</b> " . htmlspecialchars($dateStr) . "<br>
                <b>Warranty Start Date:</b> " . htmlspecialchars($dateStr) . "<br><br>
                Thank you for choosing LivinCart and Services Private Limited. It has been our pleasure to serve you, and we look forward to assisting you with any future requirements.<br><br>
                Regards,<br>
                <b>LivinCart and Services Private Limited</b><br>
                Customer Support Team";
                break;
            default:
                return false;
        }

        return self::sendMail($recipients, $subject, $body);
    }

    // -------------------------------------------------------------
    // CATEGORY 11: REIMBURSEMENT REQUEST
    // -------------------------------------------------------------
    public static function sendReimbursementNotification($conn, $type, $data)
    {
        $employeeName = $data['employee_name'] ?? 'Employee';
        $employeeEmail = $data['employee_email'] ?? self::getUserEmail($conn, $data['employee_id'] ?? null);
        $amount = number_format((float)($data['amount'] ?? 0), 2);
        $projectId = $data['project_id'] ?? 'General';
        $dateStr = $data['date'] ?? date('d M Y');
        $description = $data['description'] ?? $data['category'] ?? 'Expense Claim';
        $expenseType = $data['category'] ?? $description;

        $adminEmails = self::getAdminAndManagerEmails($conn);
        $recipients = array_unique(array_filter(array_merge([$employeeEmail], $adminEmails)));

        $reimbCode = $data['reimbursement_code'] ?? '';
        $reimbCodeHtml = !empty($reimbCode) ? "<b>Reimbursement ID:</b> " . htmlspecialchars($reimbCode) . "<br>" : "";

        switch ($type) {
            case 'submitted':
                $subject = "Reimbursement Request – " . (!empty($reimbCode) ? "{$reimbCode} | " : "") . "Livincart {$employeeName} | ₹{$amount}";
                $body = "Dear Team,<br><br>
                A reimbursement request has been submitted by <b>" . htmlspecialchars($employeeName) . "</b> for <b>₹{$amount}</b> towards <b>" . htmlspecialchars($expenseType) . "</b>.<br><br>
                {$reimbCodeHtml}
                <b>Project ID:</b> " . htmlspecialchars($projectId) . "<br>
                <b>Expense Date:</b> " . htmlspecialchars($dateStr) . "<br>
                <b>Amount:</b> ₹{$amount}<br>
                <b>Description:</b> " . htmlspecialchars($description) . "<br><br>
                Kindly review the request and proceed with the approval.<br><br>
                Regards,<br>
                <b>LivinCart Team</b>";
                break;

            case 'approved':
                $subject = "Reimbursement Approved – " . (!empty($reimbCode) ? "{$reimbCode} | " : "") . "LivinCart {$employeeName} | ₹{$amount}";
                $body = "Dear Team,<br><br>
                The reimbursement request submitted by <b>" . htmlspecialchars($employeeName) . "</b> for <b>₹{$amount}</b> towards <b>" . htmlspecialchars($expenseType) . "</b> has been approved.<br><br>
                {$reimbCodeHtml}
                <b>Project ID:</b> " . htmlspecialchars($projectId) . "<br>
                <b>Expense Date:</b> " . htmlspecialchars($dateStr) . "<br>
                <b>Amount:</b> ₹{$amount}<br>
                <b>Description:</b> " . htmlspecialchars($description) . "<br><br>
                Kindly proceed with the reimbursement process.<br><br>
                Regards,<br>
                <b>LivinCart Team</b>";
                break;

            case 'rejected':
                $subject = "Reimbursement Rejected – " . (!empty($reimbCode) ? "{$reimbCode} | " : "") . "LivinCart {$employeeName} | ₹{$amount}";
                $body = "Dear Team,<br><br>
                The reimbursement request submitted by <b>" . htmlspecialchars($employeeName) . "</b> for <b>₹{$amount}</b> towards <b>" . htmlspecialchars($expenseType) . "</b> has been rejected.<br><br>
                {$reimbCodeHtml}
                <b>Project ID:</b> " . htmlspecialchars($projectId) . "<br>
                <b>Expense Date:</b> " . htmlspecialchars($dateStr) . "<br>
                <b>Amount:</b> ₹{$amount}<br>
                <b>Description:</b> " . htmlspecialchars($description) . "<br>
                <b>Reason for Rejection:</b> " . htmlspecialchars($data['reason'] ?? 'Not specified') . "<br><br>
                Kindly review the reason and take the necessary action.<br><br>
                Regards,<br>
                <b>LivinCart Team</b>";
                break;
            default:
                return false;
        }

        return self::sendMail($recipients, $subject, $body);
    }

    // -------------------------------------------------------------
    // CATEGORY 12: PAYMENT APPROVALS
    // -------------------------------------------------------------
    public static function sendPaymentApprovalNotification($conn, $type, $data)
    {
        $category = $data['category'] ?? 'Material / Vendor';
        $amount = number_format($data['amount'] ?? 0, 2);
        $vendorName = $data['vendor_name'] ?? $data['person_name'] ?? 'Vendor';
        $description = $data['description'] ?? 'Payment Request';
        $dueDate = $data['due_date'] ?? date('d M Y');

        $recipients = self::getAdminAndManagerEmails($conn);

        switch ($type) {
            case 'requested':
                $subject = "Payment Approval Request–Livincart {$category} | ₹{$amount}";
                $body = "Dear Management,<br><br>
                A payment request has been submitted for <b>₹{$amount}</b> towards <b>" . htmlspecialchars($category) . "</b>.<br><br>
                • <b>Party/Vendor:</b> " . htmlspecialchars($vendorName) . "<br>
                • <b>Purpose:</b> " . htmlspecialchars($description) . "<br>
                • <b>Amount:</b> ₹{$amount}<br>
                • <b>Due Date:</b> " . htmlspecialchars($dueDate) . "<br><br>
                Kindly review and approve the payment.<br><br>
                Regards,<br><b>LivinCart Team</b>";
                break;

            case 'approved':
                $subject = "Payment Approved – Livincart {$category} | ₹{$amount}";
                $body = "Dear Team,<br><br>
                The payment request for <b>₹{$amount}</b> towards <b>" . htmlspecialchars($category) . "</b> has been approved.<br><br>
                • <b>Party/Vendor:</b> " . htmlspecialchars($vendorName) . "<br>
                • <b>Amount:</b> ₹{$amount}<br><br>
                Please proceed with the payment disbursement.<br><br>
                Regards,<br><b>LivinCart Team</b>";
                break;

            case 'rejected':
                $subject = "Payment Request Rejected – Livincart {$category} | ₹{$amount}";
                $body = "Dear Team,<br><br>
                The payment request of <b>₹{$amount}</b> towards <b>" . htmlspecialchars($category) . "</b> has been rejected.<br><br>
                • <b>Party/Vendor:</b> " . htmlspecialchars($vendorName) . "<br>
                • <b>Reason:</b> " . htmlspecialchars($data['reason'] ?? 'Not specified') . "<br><br>
                Please review the remarks and take necessary action.<br><br>
                Regards,<br><b>LivinCart Team</b>";
                break;
            default:
                return false;
        }

        return self::sendMail($recipients, $subject, $body);
    }
}
?>
