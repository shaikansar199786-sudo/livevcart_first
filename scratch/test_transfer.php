<?php
require_once __DIR__ . '/../config/database.php';
$db = new Database();
$conn = $db->getConnection();

// Let's check what's in project_inventory
$res = $conn->query("SELECT * FROM project_inventory LIMIT 1");
if ($res) {
    $row = $res->fetch(PDO::FETCH_ASSOC);
    if ($row) {
        $id = $row['id'];
        
        $ch = curl_init('http://localhost/ARK/api/controllers/Inventoryproject.php');
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "PUT");
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
            'id' => $id,
            'stock_status' => 'transferred',
            'transfer_qty' => 1,
            'target_project_id' => 2
        ]));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        $result = curl_exec($ch);
        echo "API Result: " . $result;
    } else {
        echo "No items in project_inventory";
    }
} else {
    echo "Query failed";
}
