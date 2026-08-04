const fs = require('fs');
let file = fs.readFileSync('c:/xampp/htdocs/livrcart/demoark/api/controllers/LeadController.php', 'utf8');

const newFunc = \
    public function bookSiteManagerSlot(\, \, \, \, \ = null)
    {
        try {
            if (!empty(\)) {
                try {
                    \->conn->exec("CREATE TABLE IF NOT EXISTS lead_notes (
                        id INT(11) AUTO_INCREMENT PRIMARY KEY,
                        lead_id INT(11) NOT NULL,
                        user_id INT(11) NOT NULL,
                        note_text TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )");
                } catch (Exception \) { }
            }

            \->conn->beginTransaction();

            \ = "SELECT client_name, email FROM leads WHERE lead_id = :lead_id";
            \ = \->conn->prepare(\);
            \->execute(['lead_id' => \]);
            \ = \->fetch(PDO::FETCH_ASSOC);

            \ = "UPDATE " . \->table_name . " SET site_manager_assigned_to = :site_manager_id, site_manager_booking_time = :booking_time, site_manager_notes = :notes WHERE lead_id = :lead_id";
            \ = \->conn->prepare(\);
            \->bindParam(':site_manager_id', \);
            \->bindParam(':booking_time', \);
            \->bindParam(':notes', \);
            \->bindParam(':lead_id', \);
            \->execute();

            if (!empty(\)) {
                try {
                    \ = "INSERT INTO lead_notes (lead_id, user_id, note_text) VALUES (:lead_id, :user_id, :note_text)";
                    \ = \->conn->prepare(\);
                    \->execute([
                        'lead_id' => \,
                        'user_id' => \->current_user_id ?: (\ ?: 1),
                        'note_text' => "Site Manager Booking: " . \
                    ]);
                } catch (Exception \) { }
            }

            \ = "New Site Visit Assigned";
            \ = "You have been assigned to Lead: " . (\['client_name'] ?? 'Unknown') . " on " . date('M j, g:i A', strtotime(\)) . " by " . \ . ".";
            if (!empty(\)) {
                \ .= " Note: " . \;
            }
            \ = "INSERT INTO notifications (user_id, title, message) VALUES (:uid, :title, :msg)";
            \ = \->conn->prepare(\);
            \->execute([
                'uid' => \,
                'title' => \,
                'msg' => \
            ]);

            \ = "SELECT name, username FROM users WHERE user_id = :uid";
            \ = \->conn->prepare(\);
            \->execute(['uid' => \]);
            \ = \->fetch(PDO::FETCH_ASSOC);

            \->conn->commit();

            if (\ && !empty(\['username'])) {
                try {
                    require_once __DIR__ . '/../libs/PHPMailer/src/Exception.php';
                    require_once __DIR__ . '/../libs/PHPMailer/src/PHPMailer.php';
                    require_once __DIR__ . '/../libs/PHPMailer/src/SMTP.php';

                    \ = new \PHPMailer\PHPMailer\PHPMailer(true);
                    \->isSMTP();
                    \->Host = 'smtp.gmail.com';
                    \->SMTPAuth = true;
                    \->Username = 'updates@livincart.com';
                    \->Password = 'kkzz omvh dzjs xqfu';
                    \->SMTPSecure = \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
                    \->Port = 587;
                    
                    \->setFrom('updates@livincart.com', 'LivinCart System');
                    \->addAddress(\['username'], \['name']);

                    \->isHTML(true);
                    \->Subject = "New Site Visit Assignment - " . (\['client_name'] ?? 'Client');
                    
                    \ = "<h2>You have a new site visit assignment</h2>";
                    \ .= "<p><strong>Client Name:</strong> " . (\['client_name'] ?? 'Unknown') . "</p>";
                    \ .= "<p><strong>Booking Date & Time:</strong> " . date('M j, Y, g:i A', strtotime(\)) . "</p>";
                    \ .= "<p><strong>Assigned By:</strong> " . \ . "</p>";
                    if (!empty(\)) {
                        \ .= "<p><strong>Notes:</strong> " . \ . "</p>";
                    }
                    \ .= "<br><p>Please log in to the portal to view more details.</p>";
                    
                    \->Body = \;
                    \->send();
                } catch (Exception \) {
                    error_log("Mailer Error: " . \->ErrorInfo);
                }
            }

            return true;
        } catch (\PDOException \) {
            \->conn->rollBack();
            return false;
        }
    }
\;

const insertIdx = file.indexOf('public function bookD1Slot');
if (insertIdx !== -1) {
    file = file.slice(0, insertIdx) + newFunc + "\n\n" + file.slice(insertIdx);
    fs.writeFileSync('c:/xampp/htdocs/livrcart/demoark/api/controllers/LeadController.php', file);
    console.log('SUCCESS');
} else {
    console.log('FAILED TO FIND function');
}
