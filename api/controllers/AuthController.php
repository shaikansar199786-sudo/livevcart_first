<?php
// api/controllers/AuthController.php

class AuthController
{
    private $conn;
    private $table_name = "users";

    public function __construct($db)
    {
        $this->conn = $db;
    }

    public function login($identifier, $password = '')
    {
        $identifier = htmlspecialchars(strip_tags($identifier));
        
        $query = "SELECT user_id, name, username, password, role, status FROM " . $this->table_name . " WHERE username = :identifier OR role = :identifier LIMIT 0,1";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':identifier', $identifier);
        $stmt->execute();

        if ($stmt->rowCount() > 0) {
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            // Verify password
            if (empty($row['password']) || !password_verify($password, $row['password'])) {
                return ["success" => false, "message" => "Invalid credentials"];
            }
            $user_id = $row['user_id'];
            $name = $row['name'];
            $role = $row['role'];
            $username = $row['username'];
            $status = $row['status'];
            
            if ($status !== 'active') {
                return ["success" => false, "message" => "Account is inactive."];
            }
        } else {
            return ["success" => false, "message" => "Invalid credentials"];
        }

        $token = base64_encode(json_encode(["user_id" => $user_id, "role" => $role, "exp" => time() + 36000]));

        return [
            "success" => true,
            "message" => "Login successful",
            "data" => [
                "user_id" => $user_id,
                "name" => $name,
                "username" => $username,
                "role" => $role,
                "token" => $token
            ]
        ];
    }
    public function forgotPassword($email)
    {
        $email = htmlspecialchars(strip_tags($email));
        
        $query = "SELECT user_id, name FROM " . $this->table_name . " WHERE username = :email LIMIT 0,1";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':email', $email);
        $stmt->execute();

        if ($stmt->rowCount() > 0) {
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            $token = bin2hex(random_bytes(32));

            $update_query = "UPDATE " . $this->table_name . " SET reset_token = :token, reset_token_expires_at = DATE_ADD(NOW(), INTERVAL 1 HOUR) WHERE user_id = :user_id";
            $update_stmt = $this->conn->prepare($update_query);
            $update_stmt->bindParam(':token', $token);
            $update_stmt->bindParam(':user_id', $row['user_id']);
            
            if ($update_stmt->execute()) {
                // Determine base URL dynamically or fallback to localhost
                $base_url = 'http://localhost:5173'; // Default frontend URL
                if (isset($_SERVER['HTTP_ORIGIN'])) {
                    $base_url = $_SERVER['HTTP_ORIGIN'];
                }
                
                $reset_link = $base_url . '/reset-password?token=' . $token;
                
                // PHPMailer integration
                require_once __DIR__ . '/../libs/PHPMailer/src/Exception.php';
                require_once __DIR__ . '/../libs/PHPMailer/src/PHPMailer.php';
                require_once __DIR__ . '/../libs/PHPMailer/src/SMTP.php';
                
                $mail = new \PHPMailer\PHPMailer\PHPMailer(true);
                
                try {
                    // Server settings
                    $mail->isSMTP();
                    $mail->Host       = 'smtp.gmail.com';
                    $mail->SMTPAuth   = true;
                    $mail->Username   = 'updates@livincart.com'; 
                    $mail->Password   = 'kkzz omvh dzjs xqfu';
                    $mail->SMTPSecure = \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
                    $mail->Port       = 587;
                
                    // Recipients
                    $mail->setFrom('updates@livincart.com', 'Livincart System');
                    $mail->addAddress($email, $row['name']);
                
                    // Content
                    $mail->isHTML(true);
                    $mail->Subject = 'Livincart - Password Reset Request';
                    
                    $message = "Hello <b>" . $row['name'] . "</b>,<br><br>";
                    $message .= "You requested to reset your password. Click the link below to set a new password:<br><br>";
                    $message .= "<a href='" . $reset_link . "'>" . $reset_link . "</a><br><br>";
                    $message .= "This link will expire in 1 hour.<br><br>";
                    $message .= "If you didn't request this, you can safely ignore this email.<br>";
                    
                    $mail->Body = $message;
                    $mail->AltBody = strip_tags(str_replace('<br>', "\n", $message));
                
                    $mail->send();
                    
                    return [
                        "success" => true, 
                        "message" => "Password reset link has been sent to your email.",
                        "debug_link" => $reset_link
                    ];
                } catch (Exception $e) {
                    return [
                        "success" => false,
                        "message" => "Message could not be sent. Mailer Error: {$mail->ErrorInfo}",
                        "debug_link" => $reset_link
                    ];
                }
            }
        }
        
        // Return generic success to prevent email enumeration
        return ["success" => true, "message" => "If the email exists, a reset link has been sent."];
    }
    public function resetPassword($token, $new_password)
    {
        $token = htmlspecialchars(strip_tags($token));
        
        $query = "SELECT user_id FROM " . $this->table_name . " WHERE reset_token = :token AND reset_token_expires_at > NOW() LIMIT 0,1";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(':token', $token);
        $stmt->execute();

        if ($stmt->rowCount() > 0) {
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            $user_id = $row['user_id'];
            
            $hashed_password = password_hash($new_password, PASSWORD_BCRYPT);
            
            $update_query = "UPDATE " . $this->table_name . " SET password = :password, reset_token = NULL, reset_token_expires_at = NULL WHERE user_id = :user_id";
            $update_stmt = $this->conn->prepare($update_query);
            $update_stmt->bindParam(':password', $hashed_password);
            $update_stmt->bindParam(':user_id', $user_id);
            
            if ($update_stmt->execute()) {
                return ["success" => true, "message" => "Password has been successfully reset."];
            }
        }
        
        return ["success" => false, "message" => "Invalid or expired reset token."];
    }
}
?>