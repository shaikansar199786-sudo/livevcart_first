<?php
// api/controllers/AgreementController.php

class AgreementController
{
    private $conn;

    public function __construct($db)
    {
        $this->conn = $db;
        $this->ensureTable();
    }

    private function ensureTable()
    {
        $sql = "CREATE TABLE IF NOT EXISTS agreements (
            id INT AUTO_INCREMENT PRIMARY KEY,
            ref_id VARCHAR(100) NOT NULL,
            project_type VARCHAR(100) DEFAULT 'Interior Design',
            client_name VARCHAR(150) NOT NULL,
            address TEXT NOT NULL,
            contract_value VARCHAR(50) NOT NULL,
            contract_value_words TEXT NOT NULL,
            date DATE NOT NULL,
            place VARCHAR(150) NOT NULL,
            status VARCHAR(30) DEFAULT 'Draft',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_client (client_name),
            INDEX idx_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

        try {
            $this->conn->exec($sql);
            $this->conn->exec("ALTER TABLE agreements ADD COLUMN IF NOT EXISTS project_type VARCHAR(100) DEFAULT 'Interior Design'");
            $this->conn->exec("ALTER TABLE agreements ADD COLUMN IF NOT EXISTS project_id INT(11) DEFAULT NULL");
            $this->conn->exec("ALTER TABLE agreements ADD COLUMN IF NOT EXISTS pdf_snapshot LONGBLOB NULL");
            $this->conn->exec("ALTER TABLE agreements ADD COLUMN IF NOT EXISTS has_snapshot TINYINT(1) DEFAULT 0");
            $this->conn->exec("ALTER TABLE agreements ADD COLUMN IF NOT EXISTS html_snapshot LONGTEXT NULL");
            $this->conn->exec("ALTER TABLE agreements ADD COLUMN IF NOT EXISTS extra_data LONGTEXT NULL");
            $this->conn->exec("ALTER TABLE agreements ADD COLUMN IF NOT EXISTS client_signature LONGTEXT NULL");
            // Acknowledgement columns
            $this->conn->exec("ALTER TABLE agreements ADD COLUMN IF NOT EXISTS ack_token VARCHAR(100) NULL DEFAULT NULL");
            $this->conn->exec("ALTER TABLE agreements ADD COLUMN IF NOT EXISTS acknowledged_at DATETIME NULL DEFAULT NULL");
            $this->conn->exec("ALTER TABLE agreements ADD COLUMN IF NOT EXISTS acknowledged_ip VARCHAR(50) NULL DEFAULT NULL");
            $this->conn->exec("ALTER TABLE agreements ADD COLUMN IF NOT EXISTS ack_email_sent_at DATETIME NULL DEFAULT NULL");
            try { $this->conn->exec("ALTER TABLE agreements ADD UNIQUE INDEX idx_ack_token (ack_token)"); } catch (Exception $e2) {}
        } catch (Exception $e) {
            // Ignore if table exists
        }
    }

    // List all agreements
    public function getAll()
    {
        try {
            $sql = "SELECT * FROM agreements ORDER BY created_at DESC";
            $stmt = $this->conn->prepare($sql);
            $stmt->execute();
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            $data = array_map(function($row) {
                unset($row['pdf_snapshot']);
                if (!empty($row['extra_data'])) {
                    $extra = json_decode($row['extra_data'], true);
                    if (is_array($extra)) {
                        $dbId = $row['id'];
                        $row = array_merge($row, $extra);
                        $row['id'] = $dbId;
                    }
                }
                unset($row['pdf_snapshot']);

                if (empty($row['client_signature'])) {
                    $pRef = $row['project_id'] ?? $row['ref_id'] ?? null;
                    if ($pRef) {
                        try {
                            $ps = $this->conn->prepare("SELECT client_signature FROM projects WHERE (project_id = :p OR project_code = :p) AND client_signature IS NOT NULL AND client_signature != '' LIMIT 1");
                            $ps->execute([':p' => $pRef]);
                            $s = $ps->fetchColumn();
                            if ($s) $row['client_signature'] = $s;
                            else {
                                $ls = $this->conn->prepare("SELECT client_signature FROM leads WHERE (lead_id = :p OR manual_client_id = :p) AND client_signature IS NOT NULL AND client_signature != '' LIMIT 1");
                                $ls->execute([':p' => $pRef]);
                                $s2 = $ls->fetchColumn();
                                if ($s2) $row['client_signature'] = $s2;
                            }
                        } catch (Exception $e) {}
                    }
                }

                return $row;
            }, $rows);
            return ['success' => true, 'data' => $data];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // Get single agreement
    public function getById($id)
    {
        try {
            $raw_id = trim((string)$id);
            $pid = intval(preg_replace('/[^0-9]/', '', $raw_id));
            
            // 1. Direct integer primary key lookup
            if (is_numeric($raw_id) && intval($raw_id) > 0) {
                $stmtNum = $this->conn->prepare("SELECT * FROM agreements WHERE id = :id LIMIT 1");
                $stmtNum->execute(['id' => intval($raw_id)]);
                $rowNum = $stmtNum->fetch(PDO::FETCH_ASSOC);
                if ($rowNum) {
                    unset($rowNum['pdf_snapshot']);
                    if (!empty($rowNum['extra_data'])) {
                        $extra = json_decode($rowNum['extra_data'], true);
                        if (is_array($extra)) {
                            $dbId = $rowNum['id'];
                            $rowNum = array_merge($rowNum, $extra);
                            $rowNum['id'] = $dbId;
                        }
                    }
                    unset($rowNum['pdf_snapshot']);
                    return ['success' => true, 'data' => $rowNum];
                }
            }

            // 2. Lookup by ref_id, project_id, project_code, or extra_data keys
            $sql = "SELECT * FROM agreements 
                    WHERE ref_id = :ref 
                       OR (project_id = :pid AND :pid > 0)
                       OR (extra_data IS NOT NULL AND (
                          extra_data LIKE :like_raw 
                          OR extra_data LIKE :like_pid
                       ))
                    ORDER BY id DESC LIMIT 1";
            $stmt = $this->conn->prepare($sql);
            $stmt->execute([
                ':ref' => $raw_id,
                ':pid' => $pid,
                ':like_raw' => '%"id":"' . $raw_id . '"%',
                ':like_pid' => $pid > 0 ? ('%"project_id":' . $pid . '%') : '%NON_EXISTENT%'
            ]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($row) {
                unset($row['pdf_snapshot']);
                if (!empty($row['extra_data'])) {
                    $extra = json_decode($row['extra_data'], true);
                    if (is_array($extra)) {
                        $dbId = $row['id'];
                        $row = array_merge($row, $extra);
                        $row['id'] = $dbId;
                    }
                }
                unset($row['pdf_snapshot']);

                if (empty($row['client_signature'])) {
                    $pRef = $row['project_id'] ?? $row['ref_id'] ?? null;
                    if ($pRef) {
                        try {
                            $ps = $this->conn->prepare("SELECT client_signature FROM projects WHERE (project_id = :p OR project_code = :p) AND client_signature IS NOT NULL AND client_signature != '' LIMIT 1");
                            $ps->execute([':p' => $pRef]);
                            $s = $ps->fetchColumn();
                            if ($s) $row['client_signature'] = $s;
                            else {
                                $ls = $this->conn->prepare("SELECT client_signature FROM leads WHERE (lead_id = :p OR manual_client_id = :p) AND client_signature IS NOT NULL AND client_signature != '' LIMIT 1");
                                $ls->execute([':p' => $pRef]);
                                $s2 = $ls->fetchColumn();
                                if ($s2) $row['client_signature'] = $s2;
                            }
                        } catch (Exception $e) {}
                    }
                }

                return ['success' => true, 'data' => $row];
            }
            return ['success' => false, 'message' => 'Agreement not found'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // Save or update agreement
    public function save($data)
    {
        try {
            $raw_id = !empty($data['id']) ? (string)$data['id'] : null;
            $ref_id = !empty($data['ref_id']) ? trim($data['ref_id']) : ('PR_' . time());
            $project_type = !empty($data['project_type']) ? trim($data['project_type']) : 'Interior Design';
            $client_name = !empty($data['client_name']) ? trim($data['client_name']) : 'Valued Client';
            $address = !empty($data['address']) ? trim($data['address']) : '';
            $contract_value = !empty($data['contract_value']) ? trim((string)$data['contract_value']) : '0';
            $contract_value_words = !empty($data['contract_value_words']) ? trim($data['contract_value_words']) : 'Zero Rupees Only';
            $date = !empty($data['date']) ? trim($data['date']) : date('Y-m-d');
            $place = !empty($data['place']) ? trim($data['place']) : 'Visakhapatnam';
            $status = !empty($data['status']) ? trim($data['status']) : 'Draft';

            $project_id = null;
            if (!empty($data['project_id'])) {
                $cleanP = intval(preg_replace('/[^0-9]/', '', (string)$data['project_id']));
                if ($cleanP > 0) $project_id = $cleanP;
            }
            if (!$project_id && $raw_id) {
                $cleanP = intval(preg_replace('/[^0-9]/', '', (string)$raw_id));
                if ($cleanP > 0) $project_id = $cleanP;
            }
            if (!$project_id && $ref_id) {
                $cleanP = intval(preg_replace('/[^0-9]/', '', (string)$ref_id));
                if ($cleanP > 0) $project_id = $cleanP;
            }

            $id_num = null;
            if ($raw_id) {
                if (strpos($raw_id, 'proj_') === 0) {
                    $pid = intval(substr($raw_id, 5));
                    if ($pid > 0) {
                        $chk = $this->conn->prepare("SELECT id FROM agreements WHERE ref_id = :ref OR ref_id = :ref2 OR project_id = :pid LIMIT 1");
                        $chk->execute(['ref' => $ref_id, 'ref2' => 'PR_' . $pid, 'pid' => $pid]);
                        $row = $chk->fetch(PDO::FETCH_ASSOC);
                        if ($row) {
                            $id_num = $row['id'];
                        }
                    }
                } else if (strpos($raw_id, 'quote_') === 0) {
                    $qid = intval(substr($raw_id, 6));
                    if ($qid > 0 || $project_id > 0) {
                        $chk = $this->conn->prepare("SELECT id FROM agreements WHERE ref_id = :ref OR project_id = :pid OR ref_id = :qref LIMIT 1");
                        $chk->execute(['ref' => $ref_id, 'pid' => $project_id ?: $qid, 'qref' => 'quote_' . $qid]);
                        $row = $chk->fetch(PDO::FETCH_ASSOC);
                        if ($row) {
                            $id_num = $row['id'];
                        }
                    }
                } else if (is_numeric($raw_id) && intval($raw_id) > 0) {
                    $chkNum = $this->conn->prepare("SELECT id FROM agreements WHERE id = :id LIMIT 1");
                    $chkNum->execute(['id' => intval($raw_id)]);
                    if ($chkNum->fetch(PDO::FETCH_ASSOC)) {
                        $id_num = intval($raw_id);
                    }
                }
            }

            // Check if ref_id or project_id already exists if id_num is not set yet
            if (!$id_num) {
                $sqlChk = "SELECT id FROM agreements WHERE 1=0";
                $paramsChk = [];
                if (!empty($ref_id)) {
                    $sqlChk .= " OR ref_id = :ref";
                    $paramsChk['ref'] = $ref_id;
                }
                if (!empty($project_id)) {
                    $sqlChk .= " OR project_id = :pid";
                    $paramsChk['pid'] = $project_id;
                }
                $sqlChk .= " LIMIT 1";
                if (!empty($paramsChk)) {
                    $chkRef = $this->conn->prepare($sqlChk);
                    $chkRef->execute($paramsChk);
                    $rowRef = $chkRef->fetch(PDO::FETCH_ASSOC);
                    if ($rowRef) {
                        $id_num = $rowRef['id'];
                    }
                }
            }

            // Clean up $data['id'] before JSON serialization into extra_data
            if ($id_num) {
                $data['id'] = $id_num;
            }
            $extra_data = json_encode($data);

            $client_sig = !empty($data['client_signature']) ? $data['client_signature'] : null;
            if (!$client_sig && !empty($project_id)) {
                try {
                    $psigStmt = $this->conn->prepare("SELECT client_signature FROM projects WHERE project_id = :pid AND client_signature IS NOT NULL AND client_signature != '' LIMIT 1");
                    $psigStmt->execute([':pid' => $project_id]);
                    $client_sig = $psigStmt->fetchColumn() ?: null;
                } catch (Exception $e) {}
            }

            if ($id_num) {
                // Update
                $sql = "UPDATE agreements SET 
                            ref_id = :ref_id, 
                            project_id = :project_id,
                            project_type = :project_type,
                            client_name = :client_name, 
                            address = :address, 
                            contract_value = :contract_value, 
                            contract_value_words = :contract_value_words, 
                            date = :date, 
                            place = :place, 
                            status = :status,
                            extra_data = :extra_data" . ($client_sig ? ", client_signature = :client_sig" : "") . "
                        WHERE id = :id";
                $stmt = $this->conn->prepare($sql);
                $params = [
                    ':id' => $id_num,
                    ':ref_id' => $ref_id,
                    ':project_id' => $project_id,
                    ':project_type' => $project_type,
                    ':client_name' => $client_name,
                    ':address' => $address,
                    ':contract_value' => $contract_value,
                    ':contract_value_words' => $contract_value_words,
                    ':date' => $date,
                    ':place' => $place,
                    ':status' => $status,
                    ':extra_data' => $extra_data
                ];
                if ($client_sig) {
                    $params[':client_sig'] = $client_sig;
                }
                $stmt->execute($params);

                if ($project_id && $project_id > 0) {
                    try {
                        $stSync = (strtolower($status) === 'signed' || strtolower($status) === 'approved') ? 'Signed' : $status;
                        $this->conn->prepare("UPDATE quotes SET status = :st WHERE project_id = :pid")->execute(['st' => $stSync, 'pid' => $project_id]);
                        $isSignedOrApproved = (strtolower($status) === 'signed' || strtolower($status) === 'approved');
                        if ($client_sig || $isSignedOrApproved) {
                            $this->conn->prepare("UPDATE projects SET works_contract_done = 1, works_contract_signed = 1" . ($client_sig ? ", client_signature = :sig" : "") . " WHERE project_id = :pid OR id = :pid")->execute($client_sig ? [':sig' => $client_sig, ':pid' => $project_id] : [':pid' => $project_id]);
                        }
                    } catch (Exception $e) {}
                }

                return ['success' => true, 'message' => 'Agreement updated successfully', 'id' => $id_num];
            } else {
                // Insert
                $sql = "INSERT INTO agreements 
                            (ref_id, project_id, project_type, client_name, address, contract_value, contract_value_words, date, place, status, extra_data" . ($client_sig ? ", client_signature" : "") . ")
                        VALUES 
                            (:ref_id, :project_id, :project_type, :client_name, :address, :contract_value, :contract_value_words, :date, :place, :status, :extra_data" . ($client_sig ? ", :client_sig" : "") . ")";
                $stmt = $this->conn->prepare($sql);
                $params = [
                    ':ref_id' => $ref_id,
                    ':project_id' => $project_id,
                    ':project_type' => $project_type,
                    ':client_name' => $client_name,
                    ':address' => $address,
                    ':contract_value' => $contract_value,
                    ':contract_value_words' => $contract_value_words,
                    ':date' => $date,
                    ':place' => $place,
                    ':status' => $status,
                    ':extra_data' => $extra_data
                ];
                if ($client_sig) {
                    $params[':client_sig'] = $client_sig;
                }
                $stmt->execute($params);

                $newId = $this->conn->lastInsertId();
                if ($project_id && $project_id > 0) {
                    try {
                        $stSync = (strtolower($status) === 'signed' || strtolower($status) === 'approved') ? 'Signed' : $status;
                        $this->conn->prepare("UPDATE quotes SET status = :st WHERE project_id = :pid")->execute(['st' => $stSync, 'pid' => $project_id]);
                        $isSignedOrApproved = (strtolower($status) === 'signed' || strtolower($status) === 'approved');
                        if ($client_sig || $isSignedOrApproved) {
                            $this->conn->prepare("UPDATE projects SET works_contract_done = 1, works_contract_signed = 1" . ($client_sig ? ", client_signature = :sig" : "") . " WHERE project_id = :pid OR id = :pid")->execute($client_sig ? [':sig' => $client_sig, ':pid' => $project_id] : [':pid' => $project_id]);
                        }
                    } catch (Exception $e) {}
                }

                return ['success' => true, 'message' => 'Agreement saved successfully', 'id' => $newId];
            }
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // Update status for single agreement
    public function updateStatus($id, $status, $ref_id = null)
    {
        try {
            if (!empty($id)) {
                $raw_id = (string)$id;
                if (strpos($raw_id, 'proj_') === 0) {
                    $pid = intval(substr($raw_id, 5));
                    if ($pid > 0) {
                        $refCode = $ref_id ? $ref_id : ("PR_" . $pid);
                        $stmt = $this->conn->prepare("UPDATE agreements SET status = :st WHERE ref_id = :ref OR id = :pid");
                        $stmt->execute(['st' => $status, 'ref' => $refCode, 'pid' => $pid]);

                        // Also keep quote status in sync if project exists
                        $this->conn->prepare("UPDATE quotes SET status = :st WHERE project_id = :pid")->execute(['st' => $status, 'pid' => $pid]);
                    }
                    return ['success' => true, 'message' => 'Status updated'];
                }

                $numeric_id = intval(preg_replace('/[^0-9]/', '', $raw_id));
                if ($numeric_id > 0) {
                    $stmt = $this->conn->prepare("UPDATE agreements SET status = :st WHERE id = :id");
                    $stmt->execute(['st' => $status, 'id' => $numeric_id]);
                }
            } elseif (!empty($ref_id)) {
                $stmt = $this->conn->prepare("UPDATE agreements SET status = :st WHERE ref_id = :ref");
                $stmt->execute(['st' => $status, 'ref' => $ref_id]);
            }
            return ['success' => true, 'message' => 'Status updated successfully'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // Delete agreement
    public function delete($id)
    {
        try {
            $sql = "DELETE FROM agreements WHERE id = :id";
            $stmt = $this->conn->prepare($sql);
            $stmt->execute([':id' => $id]);
            return ['success' => true, 'message' => 'Agreement deleted successfully'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // ── Generate & store a unique acknowledgement token ──────────────
    public function generateAckToken($agreement_id)
    {
        try {
            $id = intval($agreement_id);
            if ($id <= 0) return ['success' => false, 'message' => 'Invalid agreement ID'];

            $token = bin2hex(random_bytes(32)); // 64-char hex string

            $stmt = $this->conn->prepare(
                "UPDATE agreements SET ack_token = :token WHERE id = :id"
            );
            $stmt->execute([':token' => $token, ':id' => $id]);

            return ['success' => true, 'token' => $token];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    // ── Send acknowledgement request email to client ──────────────────
    public function sendAckEmail($data)
    {
        try {
            $agreement_id = intval($data['agreement_id'] ?? 0);
            $client_email = trim($data['client_email'] ?? '');
            $client_name  = trim($data['client_name']  ?? 'Valued Client');
            $ref_id       = trim($data['ref_id']       ?? '');

            if ($agreement_id <= 0) {
                return ['success' => false, 'message' => 'Agreement ID is required'];
            }
            if (!filter_var($client_email, FILTER_VALIDATE_EMAIL)) {
                return ['success' => false, 'message' => 'A valid client email address is required'];
            }

            // Generate a fresh unique token
            $tokenResult = $this->generateAckToken($agreement_id);
            if (!$tokenResult['success']) return $tokenResult;
            $token = $tokenResult['token'];

            // Build public acknowledgement URL
            if (defined('PUBLIC_ACK_URL') && !empty(PUBLIC_ACK_URL)) {
                $ack_url = PUBLIC_ACK_URL . '?token=' . $token;
            } elseif (defined('IS_PRODUCTION') && IS_PRODUCTION) {
                $ack_url = 'https://livincart.bizools.in/api/acknowledge.php?token=' . $token;
            } else {
                $httpScheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
                $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
                if (strpos($host, 'localhost') !== false || strpos($host, '127.0.0.1') !== false) {
                    $lanIp = gethostbyname(gethostname());
                    if (!empty($lanIp) && $lanIp !== '127.0.0.1' && filter_var($lanIp, FILTER_VALIDATE_IP)) {
                        $host = $lanIp;
                    }
                }
                $ack_url = $httpScheme . '://' . $host . '/livrcart/demoark/api/acknowledge.php?token=' . $token;
            }

            // ── Compose branded email body ────────────────────────────
            $clientFirst = htmlspecialchars(explode(' ', $client_name)[0]);
            $refDisplay  = $ref_id ? ' (Ref: <strong>' . htmlspecialchars($ref_id) . '</strong>)' : '';

            $body = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
  <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);padding:24px 32px;border-radius:14px 14px 0 0;display:flex;align-items:center;gap:14px;">
    <div style="background:#fca412;width:40px;height:40px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;font-weight:900;color:#0f172a;font-size:1.3rem;line-height:1;">L</div>
    <div style="color:#fff;margin-left:14px;">
      <div style="font-size:1.05rem;font-weight:800;">LivinCart Private Limited</div>
      <div style="font-size:0.76rem;color:#94a3b8;margin-top:2px;">Interior Design &amp; Architecture</div>
    </div>
  </div>
  <div style="background:#ffffff;padding:32px;border:1px solid #e2e8f0;border-top:none;">
    <p style="font-size:1rem;color:#0f172a;font-weight:700;margin-bottom:6px;">Dear ' . $clientFirst . ',</p>
    <p style="font-size:0.92rem;color:#334155;line-height:1.7;margin-bottom:20px;">
      Thank you for choosing LivinCart. We have shared our project agreement with you' . $refDisplay . '.<br><br>
      Please click the button below to <strong>acknowledge receipt</strong> of the agreement document.
      This helps us confirm you have received and reviewed the document.
    </p>
    <div style="text-align:center;margin:28px 0;">
      <a href="' . $ack_url . '"
         style="display:inline-block;background:#16a34a;color:#ffffff;font-size:1rem;
                font-weight:800;padding:14px 36px;border-radius:10px;
                text-decoration:none;letter-spacing:0.3px;
                box-shadow:0 4px 14px rgba(22,163,74,0.35);">&#10003;&nbsp; Acknowledge Receipt</a>
    </div>
    <p style="font-size:0.80rem;color:#94a3b8;line-height:1.6;">
      If the button does not work, copy and paste this link into your browser:<br>
      <a href="' . $ack_url . '" style="color:#2563eb;word-break:break-all;">' . $ack_url . '</a>
    </p>
    <hr style="border:none;border-top:1px solid #f1f5f9;margin:24px 0;">
    <p style="font-size:0.78rem;color:#94a3b8;">
      If you did not expect this email, please contact your LivinCart representative directly.
    </p>
  </div>
  <div style="background:#f8fafc;padding:14px 32px;border:1px solid #e2e8f0;border-top:none;
              border-radius:0 0 14px 14px;text-align:center;font-size:0.76rem;color:#94a3b8;">
    &copy; LivinCart Private Limited &mdash;
    <a href="https://livincart.com" style="color:#fca412;text-decoration:none;">livincart.com</a>
  </div>
</div>
</body></html>';

            // ── Send via PHPMailer ─────────────────────────────────────
            require_once __DIR__ . '/../libs/PHPMailer/src/Exception.php';
            require_once __DIR__ . '/../libs/PHPMailer/src/PHPMailer.php';
            require_once __DIR__ . '/../libs/PHPMailer/src/SMTP.php';

            $mail = new \PHPMailer\PHPMailer\PHPMailer(true);
            $mail->Timeout   = 5;
            $mail->isSMTP();
            $mail->Host       = 'smtp.gmail.com';
            $mail->SMTPAuth   = true;   
            $mail->Username   = 'updates@livincart.com';
            $mail->Password   = 'kkzz omvh dzjs xqfu';
            $mail->SMTPSecure = \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
            $mail->Port       = 587;
            $mail->CharSet    = 'UTF-8';

            $mail->setFrom('updates@livincart.com', 'LivinCart Team');
            $mail->addAddress($client_email, $client_name);

            $subject = 'Agreement Acknowledgement Request'
                . ($ref_id ? ' — ' . $ref_id : '')
                . ' | LivinCart';

            $mail->isHTML(true);
            $mail->Subject = $subject;
            $mail->Body    = $body;
            $mail->AltBody = 'Dear ' . strip_tags($clientFirst) . ', please acknowledge receipt of your LivinCart agreement by visiting: ' . $ack_url;

            $mail->send();

            // Record that ack email was dispatched
            $this->conn->prepare(
                "UPDATE agreements SET ack_email_sent_at = NOW() WHERE id = :id"
            )->execute([':id' => $agreement_id]);

            return ['success' => true, 'message' => 'Acknowledgement email sent to ' . $client_email];

        } catch (Exception $e) {
            return ['success' => false, 'message' => 'Failed to send email: ' . $e->getMessage()];
        }
    }
}
