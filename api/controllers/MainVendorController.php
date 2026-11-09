<?php
// api/controllers/MainVendorController.php

class MainVendorController {
    private $db;
    private $conn;

    public function __construct() {
        $this->db = new Database();
        $this->conn = $this->db->getConnection();
        $this->ensureTableExists();
    }

    private function ensureTableExists() {
        try {
            $sql = "CREATE TABLE IF NOT EXISTS main_vendors (
                id INT AUTO_INCREMENT PRIMARY KEY,
                vendor_name VARCHAR(255) NOT NULL,
                category VARCHAR(100) DEFAULT 'Main Vendor',
                status VARCHAR(100) DEFAULT 'Pending',
                contact_person VARCHAR(255) DEFAULT NULL,
                phone VARCHAR(100) DEFAULT NULL,
                email VARCHAR(255) DEFAULT NULL,
                address TEXT DEFAULT NULL,
                gst_number VARCHAR(100) DEFAULT NULL,
                pan_number VARCHAR(100) DEFAULT NULL,
                pan_file LONGTEXT DEFAULT NULL,
                aadhar_number VARCHAR(100) DEFAULT NULL,
                aadhar_file LONGTEXT DEFAULT NULL,
                photo LONGTEXT DEFAULT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;";
            $this->conn->exec($sql);

            try {
                $this->conn->exec("ALTER TABLE main_vendors ADD COLUMN status VARCHAR(100) DEFAULT 'Pending';");
            } catch (Exception $e) {}
        } catch (Exception $e) {
            error_log('Error ensuring main_vendors table exists: ' . $e->getMessage());
        }
    }

    public function getAllMainVendors() {
        try {
            $stmt = $this->conn->query("SELECT * FROM main_vendors ORDER BY vendor_name ASC");
            $vendors = $stmt->fetchAll(PDO::FETCH_ASSOC);
            return ["success" => true, "data" => $vendors];
        } catch (PDOException $e) {
            return ["success" => false, "message" => "Database Error: " . $e->getMessage()];
        }
    }

    public function createMainVendor($data) {
        try {
            $vendor_name = trim($data['vendor_name'] ?? '');
            if (empty($vendor_name)) {
                return ["success" => false, "status" => "error", "message" => "Vendor name is required"];
            }

            $category = $data['category'] ?? 'Main Vendor';
            $vendor_status = $data['status'] ?? 'Pending';
            $contact_person = $data['contact_person'] ?? '';
            $phone = $data['phone'] ?? '';
            $email = $data['email'] ?? '';
            $address = $data['address'] ?? '';
            $gst_number = $data['gst_number'] ?? '';
            $pan_number = $data['pan_number'] ?? '';
            $pan_file = $data['pan_file'] ?? null;
            $aadhar_number = $data['aadhar_number'] ?? '';
            $aadhar_file = $data['aadhar_file'] ?? null;
            $photo = $data['photo'] ?? null;

            $stmt = $this->conn->prepare("INSERT INTO main_vendors 
                (vendor_name, category, status, contact_person, phone, email, address, gst_number, pan_number, pan_file, aadhar_number, aadhar_file, photo)
                VALUES 
                (:vendor_name, :category, :status, :contact_person, :phone, :email, :address, :gst_number, :pan_number, :pan_file, :aadhar_number, :aadhar_file, :photo)");

            $stmt->execute([
                ':vendor_name' => $vendor_name,
                ':category' => $category,
                ':status' => $vendor_status,
                ':contact_person' => $contact_person,
                ':phone' => $phone,
                ':email' => $email,
                ':address' => $address,
                ':gst_number' => $gst_number,
                ':pan_number' => $pan_number,
                ':pan_file' => $pan_file,
                ':aadhar_number' => $aadhar_number,
                ':aadhar_file' => $aadhar_file,
                ':photo' => $photo
            ]);

            return [
                "success" => true,
                "status" => "success",
                "message" => "Main Vendor created successfully",
                "vendor_id" => $this->conn->lastInsertId()
            ];
        } catch (PDOException $e) {
            return ["success" => false, "status" => "error", "message" => "Database Error: " . $e->getMessage()];
        }
    }

    public function updateMainVendor($data) {
        try {
            $id = intval($data['id'] ?? $data['vendor_id'] ?? 0);
            if (!$id) {
                return ["success" => false, "status" => "error", "message" => "Main Vendor ID missing"];
            }

            // Quick status-only update support
            if (isset($data['status']) && count($data) <= 6) {
                $userRole = $_SERVER['HTTP_X_USER_ROLE'] ?? ($data['user_role'] ?? '');
                $userRoleLower = strtolower(trim($userRole));
                $isAdmin = in_array($userRoleLower, ['admin', 'administrator', 'superadmin', 'management', 'owner']) || strpos($userRoleLower, 'admin') !== false;

                if (strtoupper($data['status']) === 'APPROVED' && !empty($userRole) && !$isAdmin) {
                    return ["success" => false, "status" => "error", "message" => "Access Denied: Only Admin can approve vendor quotations."];
                }

                $stmt = $this->conn->prepare("UPDATE main_vendors SET status = :status WHERE id = :id");
                $stmt->execute([':status' => $data['status'], ':id' => $id]);
                return ["success" => true, "status" => "success", "message" => "Vendor status updated successfully"];
            }

            $vendor_name = trim($data['vendor_name'] ?? '');
            if (empty($vendor_name)) {
                return ["success" => false, "status" => "error", "message" => "Vendor name is required"];
            }

            $stmt = $this->conn->prepare("UPDATE main_vendors SET
                vendor_name = :vendor_name,
                category = :category,
                status = :status,
                contact_person = :contact_person,
                phone = :phone,
                email = :email,
                address = :address,
                gst_number = :gst_number,
                pan_number = :pan_number,
                pan_file = COALESCE(:pan_file, pan_file),
                aadhar_number = :aadhar_number,
                aadhar_file = COALESCE(:aadhar_file, aadhar_file),
                photo = COALESCE(:photo, photo)
                WHERE id = :id");

            $stmt->execute([
                ':vendor_name' => $vendor_name,
                ':category' => $data['category'] ?? 'Main Vendor',
                ':status' => $data['status'] ?? 'Pending',
                ':contact_person' => $data['contact_person'] ?? '',
                ':phone' => $data['phone'] ?? '',
                ':email' => $data['email'] ?? '',
                ':address' => $data['address'] ?? '',
                ':gst_number' => $data['gst_number'] ?? '',
                ':pan_number' => $data['pan_number'] ?? '',
                ':pan_file' => $data['pan_file'] ?? null,
                ':aadhar_number' => $data['aadhar_number'] ?? '',
                ':aadhar_file' => $data['aadhar_file'] ?? null,
                ':photo' => $data['photo'] ?? null,
                ':id' => $id
            ]);

            return [
                "success" => true,
                "status" => "success",
                "message" => "Main Vendor updated successfully"
            ];
        } catch (PDOException $e) {
            return ["success" => false, "status" => "error", "message" => "Database Error: " . $e->getMessage()];
        }
    }
}
