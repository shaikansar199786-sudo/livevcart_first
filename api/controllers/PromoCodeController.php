<?php
// api/controllers/PromoCodeController.php

class PromoCodeController {
    private $db;

    public function __construct($db) {
        $this->db = $db;
    }

    public function getAllPromoCodes() {
        try {
            $stmt = $this->db->query("SELECT id, code, discount_type, discount_value, description, created_at FROM promo_codes ORDER BY id ASC");
            $codes = $stmt->fetchAll(PDO::FETCH_ASSOC);
            return ["success" => true, "data" => $codes];
        } catch (Exception $e) {
            return ["success" => false, "message" => $e->getMessage()];
        }
    }

    public function createPromoCode($data) {
        try {
            $code = strtoupper(trim($data['code'] ?? ''));
            $discountType = strtolower(trim($data['discount_type'] ?? 'percent'));
            $discountValue = floatval($data['discount_value'] ?? 0);
            $description = trim($data['description'] ?? '');

            if (empty($code)) {
                return ["success" => false, "message" => "Promo code name is required"];
            }
            if ($discountValue <= 0) {
                return ["success" => false, "message" => "Discount value must be greater than 0"];
            }
            if ($discountType === 'percent' && $discountValue > 100) {
                return ["success" => false, "message" => "Percentage discount cannot exceed 100%"];
            }

            // Check duplicate
            $check = $this->db->prepare("SELECT id FROM promo_codes WHERE code = :code");
            $check->execute(['code' => $code]);
            if ($check->fetch()) {
                // Update existing if already present
                $upd = $this->db->prepare("UPDATE promo_codes SET discount_type = :type, discount_value = :val, description = :desc WHERE code = :code");
                $upd->execute([
                    'type' => $discountType,
                    'val' => $discountValue,
                    'desc' => $description,
                    'code' => $code
                ]);
                return ["success" => true, "message" => "Promo code updated successfully", "code" => $code];
            }

            $stmt = $this->db->prepare("INSERT INTO promo_codes (code, discount_type, discount_value, description) VALUES (:code, :type, :val, :desc)");
            $stmt->execute([
                'code' => $code,
                'type' => $discountType,
                'val' => $discountValue,
                'desc' => $description
            ]);

            return ["success" => true, "message" => "Promo code created successfully", "code" => $code];
        } catch (Exception $e) {
            return ["success" => false, "message" => $e->getMessage()];
        }
    }

    public function deletePromoCode($id) {
        try {
            $stmt = $this->db->prepare("DELETE FROM promo_codes WHERE id = :id");
            $stmt->execute(['id' => $id]);
            return ["success" => true, "message" => "Promo code deleted successfully"];
        } catch (Exception $e) {
            return ["success" => false, "message" => $e->getMessage()];
        }
    }
}
