<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

require_once __DIR__ . "/../config/database.php";
$GLOBALS['conn'] = getMysqliConnection();
class Inventoryproject
{

    public function save($data)
    {

        $conn = $GLOBALS['conn'];

        if (!$data) {
            return [
                "status" => "error",
                "message" => "Invalid JSON input"
            ];
        }

        $project_id = $data->project_id ?? 0;
        $items = $data->items ?? [];

        if (!$project_id) {
            return [
                "status" => "error",
                "message" => "Project ID missing"
            ];
        }

        // delete old
        $conn->query("DELETE FROM project_inventory WHERE project_id = '$project_id'");

        // Check and add columns if not exists
        try {
            $conn->query("ALTER TABLE project_inventory ADD COLUMN discount DECIMAL(10,2) DEFAULT 0 AFTER quantity");
        } catch (Exception $e) {
        }
        try {
            $conn->query("ALTER TABLE project_inventory ADD COLUMN invoice_no VARCHAR(100) DEFAULT NULL AFTER project_id");
        } catch (Exception $e) {
        }
        try {
            $conn->query("ALTER TABLE project_inventory ADD COLUMN invoice_date DATE DEFAULT NULL AFTER invoice_no");
        } catch (Exception $e) {
        }

        foreach ($items as $item) {

            $invoice_no = $conn->real_escape_string($item->invoice_no ?? '');
            $invoice_date = $conn->real_escape_string($item->invoice_date ?? '');
            $vendor = $conn->real_escape_string($item->vendor ?? '');
            $item_name = $conn->real_escape_string($item->name ?? '');

            $rate = floatval($item->rate ?? 0);
            $qty = intval($item->qty ?? 0);
            $discount = floatval($item->discount ?? 0);

            $subtotal = $rate * $qty;
            $discountAmt = $subtotal * ($discount / 100);
            $amount = $subtotal - $discountAmt;
            $gst = $amount * 0.18;
            $total = $amount + $gst;

            $sql = "INSERT INTO project_inventory 
            (project_id, invoice_no, invoice_date, vendor, item_name, rate, quantity, discount, amount, gst, total)
            VALUES 
            ('$project_id', '$invoice_no', NULLIF('$invoice_date', ''), '$vendor', '$item_name', '$rate', '$qty', '$discount', '$amount', '$gst', '$total')";

            if (!$conn->query($sql)) {
                return [
                    "status" => "error",
                    "message" => $conn->error
                ];
            }
        }

        return [
            "status" => "success",
            "message" => "Inventory saved successfully"
        ];
    }
}

// ✅ METHOD HANDLING
$method = $_SERVER['REQUEST_METHOD'];


// 🔵 POST → SAVE
if ($method === 'POST') {

    $data = json_decode(file_get_contents("php://input"));

    $inventory = new Inventoryproject();
    echo json_encode($inventory->save($data));
    exit;
}


// 🟢 GET → FETCH
if ($method === 'GET') {

    $conn = $GLOBALS['conn'];
    $project_id = $_GET['project_id'] ?? 0;

    if (!$project_id) {
        echo json_encode([
            "status" => "error",
            "message" => "Project ID missing"
        ]);
        exit;
    }

    $sql = "SELECT * FROM project_inventory WHERE project_id = '$project_id'";
    $result = $conn->query($sql);

    $data = [];

    while ($row = $result->fetch_assoc()) {
        $data[] = $row;
    }

    echo json_encode([
        "status" => "success",
        "data" => $data
    ]);
    exit;
}
?>