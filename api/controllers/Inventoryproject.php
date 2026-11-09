<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, DELETE");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

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

        // Check and add columns if not exists
        try {
            $conn->query("ALTER TABLE project_inventory ADD COLUMN discount DECIMAL(10,2) DEFAULT 0 AFTER quantity");
        } catch (Exception $e) {}
        try {
            $conn->query("ALTER TABLE project_inventory ADD COLUMN invoice_no VARCHAR(100) DEFAULT NULL AFTER project_id");
        } catch (Exception $e) {}
        try {
            $conn->query("ALTER TABLE project_inventory ADD COLUMN invoice_date DATE DEFAULT NULL AFTER invoice_no");
        } catch (Exception $e) {}
        try {
            $conn->query("ALTER TABLE project_inventory ADD COLUMN category VARCHAR(100) DEFAULT NULL AFTER invoice_date");
        } catch (Exception $e) {}
        try {
            $conn->query("ALTER TABLE project_inventory ADD COLUMN payment_status VARCHAR(50) DEFAULT 'Unpaid' AFTER total");
        } catch (Exception $e) {}
        try {
            $conn->query("ALTER TABLE project_inventory ADD COLUMN paid DECIMAL(10,2) DEFAULT 0 AFTER payment_status");
        } catch (Exception $e) {}
        try {
            $conn->query("ALTER TABLE project_inventory ADD COLUMN unpaid DECIMAL(10,2) DEFAULT 0 AFTER paid");
        } catch (Exception $e) {}
        try {
            $conn->query("ALTER TABLE project_inventory ADD COLUMN payment_mode VARCHAR(50) DEFAULT 'Cash' AFTER unpaid");
        } catch (Exception $e) {}
        try {
            $conn->query("ALTER TABLE project_inventory ADD COLUMN payment_date DATE DEFAULT NULL AFTER payment_mode");
        } catch (Exception $e) {}
        try {
            $conn->query("ALTER TABLE project_inventory ADD COLUMN invoice_image LONGTEXT DEFAULT NULL AFTER payment_date");
        } catch (Exception $e) {}
        try {
            $conn->query("ALTER TABLE project_inventory ADD COLUMN approval_status VARCHAR(50) DEFAULT 'approved'");
        } catch (Exception $e) {}
        try {
            $conn->query("ALTER TABLE project_inventory ADD COLUMN approved_by VARCHAR(100) NULL");
        } catch (Exception $e) {}
        try {
            $conn->query("ALTER TABLE project_inventory ADD COLUMN approved_at DATETIME NULL");
        } catch (Exception $e) {}

        $keep_ids = [];

        foreach ($items as $item) {
            $id = isset($item->id) ? intval($item->id) : 0;
            $invoice_no = $conn->real_escape_string($item->invoice_no ?? '');
            $invoice_date = $conn->real_escape_string($item->invoice_date ?? '');
            $vendor = $conn->real_escape_string($item->vendor ?? '');
            $category = $conn->real_escape_string($item->category ?? '');
            $item_name = $conn->real_escape_string($item->name ?? '');

            $rate = floatval($item->rate ?? 0);
            $qty = intval($item->qty ?? 0);
            $discount = floatval($item->discount ?? 0);
            $paid = floatval($item->paid ?? 0);
            $unpaid = floatval($item->unpaid ?? 0);
            $payment_status = $conn->real_escape_string($item->payment_status ?? 'Unpaid');
            $payment_mode = $conn->real_escape_string($item->payment_mode ?? 'Cash');
            $payment_date = $conn->real_escape_string($item->payment_date ?? '');
            $invoice_image = $conn->real_escape_string($item->invoice_image ?? '');
            $approval_status = $conn->real_escape_string($item->approval_status ?? ($data->approval_status ?? 'approved'));
            $approved_by = $conn->real_escape_string($item->approved_by ?? ($data->approved_by ?? ''));

            $subtotal = $rate * $qty;
            $discountAmt = $subtotal * ($discount / 100);
            $amount = $subtotal - $discountAmt;
            $gst = $amount * 0.18;
            $total = $amount + $gst;

            if ($id > 0) {
                $sql = "UPDATE project_inventory SET
                    invoice_no = '$invoice_no',
                    invoice_date = NULLIF('$invoice_date', ''),
                    vendor = '$vendor',
                    category = '$category',
                    item_name = '$item_name',
                    rate = '$rate',
                    quantity = '$qty',
                    discount = '$discount',
                    amount = '$amount',
                    gst = '$gst',
                    total = '$total',
                    payment_status = '$payment_status',
                    paid = '$paid',
                    unpaid = '$unpaid',
                    payment_mode = '$payment_mode',
                    payment_date = NULLIF('$payment_date', ''),
                    invoice_image = '$invoice_image',
                    approval_status = '$approval_status',
                    approved_by = NULLIF('$approved_by', '')
                    WHERE id = '$id' AND project_id = '$project_id'";

                if ($conn->query($sql)) {
                    $keep_ids[] = $id;
                } else {
                    return ["status" => "error", "message" => $conn->error];
                }
            } else {
                $sql = "INSERT INTO project_inventory
                (project_id, invoice_no, invoice_date, vendor, category, item_name, rate, quantity, discount, amount, gst, total, payment_status, paid, unpaid, payment_mode, payment_date, invoice_image, approval_status, approved_by)
                VALUES
                ('$project_id', '$invoice_no', NULLIF('$invoice_date', ''), '$vendor', '$category', '$item_name', '$rate', '$qty', '$discount', '$amount', '$gst', '$total', '$payment_status', '$paid', '$unpaid', '$payment_mode', NULLIF('$payment_date', ''), '$invoice_image', '$approval_status', NULLIF('$approved_by', ''))";

                if ($conn->query($sql)) {
                    $keep_ids[] = $conn->insert_id;
                } else {
                    return ["status" => "error", "message" => $conn->error];
                }
            }
        }

        if (!empty($keep_ids)) {
            $ids_str = implode(',', $keep_ids);
            // Delete items that were removed, excluding transferred items since they belong to another project, wait, this project_id is for this project, so it's correct.
            $conn->query("DELETE FROM project_inventory WHERE project_id = '$project_id' AND id NOT IN ($ids_str)");
        } else {
            $conn->query("DELETE FROM project_inventory WHERE project_id = '$project_id'");
        }

        return [
            "status" => "success",
            "message" => "Inventory saved successfully"
        ];
    }
}

// ✅ METHOD HANDLING
$method = $_SERVER['REQUEST_METHOD'];


// 🔵 POST → SAVE OR APPROVE/REJECT
if ($method === 'POST') {

    $data = json_decode(file_get_contents("php://input"));
    $conn = $GLOBALS['conn'];

    if (isset($data->action) && in_array($data->action, ['approve_invoice', 'reject_invoice'])) {
        $status = $data->action === 'approve_invoice' ? 'approved' : 'rejected';
        $pId = intval($data->project_id ?? 0);
        $invNo = $conn->real_escape_string($data->invoice_no ?? '');
        $apprBy = $conn->real_escape_string($data->approved_by ?? '');

        try {
            $conn->query("ALTER TABLE project_inventory ADD COLUMN approval_status VARCHAR(50) DEFAULT 'approved'");
            $conn->query("ALTER TABLE project_inventory ADD COLUMN approved_by VARCHAR(100) NULL");
            $conn->query("ALTER TABLE project_inventory ADD COLUMN approved_at DATETIME NULL");
        } catch (Exception $e) {}

        $whereClause = "project_id = '$pId'";
        if ($invNo !== '') {
            $whereClause .= " AND invoice_no = '$invNo'";
        }
        if (isset($data->id) && intval($data->id) > 0) {
            $itId = intval($data->id);
            $whereClause .= " AND id = '$itId'";
        }

        $sql = "UPDATE project_inventory SET approval_status = '$status', approved_by = '$apprBy', approved_at = NOW() WHERE $whereClause";
        if ($conn->query($sql)) {
            echo json_encode(["status" => "success", "message" => "Invoice " . ($status === 'approved' ? 'approved and added to balance sheet' : 'rejected')]);
        } else {
            echo json_encode(["status" => "error", "message" => $conn->error]);
        }
        exit;
    }

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

// 🟢 PUT → UPDATE (USAGE OR STOCK STATUS)
if ($method === 'PUT') {
    $conn = $GLOBALS['conn'];
    $input = json_decode(file_get_contents('php://input'), true);
    $id = $input['id'] ?? 0;

    if (!$id) {
        echo json_encode([
            "status" => "error",
            "message" => "Item ID missing"
        ]);
        exit;
    }

    // Check if updating usage or stock status
    if (isset($input['quantity_used'])) {
        // Add quantity_used column if it doesn't exist
        try {
            $conn->query("ALTER TABLE project_inventory ADD COLUMN quantity_used INT DEFAULT 0 AFTER quantity");
        } catch (Exception $e) {}

        $quantity_used = $input['quantity_used'] ?? 0;
        $sql = "UPDATE project_inventory SET quantity_used = '$quantity_used' WHERE id = '$id'";

        if ($conn->query($sql)) {
            echo json_encode([
                "status" => "success",
                "message" => "Usage updated successfully"
            ]);
        } else {
            echo json_encode([
                "status" => "error",
                "message" => $conn->error
            ]);
        }
    } elseif (isset($input['stock_status'])) {
        // Add stock_status column if it doesn't exist
        try {
            $conn->query("ALTER TABLE project_inventory ADD COLUMN stock_status VARCHAR(50) DEFAULT 'pending' AFTER payment_mode");
        } catch (Exception $e) {}

        // Add transfer_qty column if it doesn't exist
        try {
            $conn->query("ALTER TABLE project_inventory ADD COLUMN transfer_qty INT DEFAULT 0 AFTER stock_status");
        } catch (Exception $e) {}

        // Add target_project_id column if it doesn't exist
        try {
            $conn->query("ALTER TABLE project_inventory ADD COLUMN target_project_id INT DEFAULT NULL AFTER transfer_qty");
        } catch (Exception $e) {}

        $stock_status = $input['stock_status'] ?? '';
        $transfer_qty = $input['transfer_qty'] ?? 0;
        $target_project_id = $input['target_project_id'] ?? null;

        // If transferring to another project
        if ($stock_status === 'transferred' && $target_project_id && $transfer_qty > 0) {
            // Get the original item
            $sql = "SELECT * FROM project_inventory WHERE id = '$id'";
            $result = $conn->query($sql);
            $original_item = $result->fetch_assoc();

            if ($original_item) {
                $original_qty = $original_item['quantity'];
                $remaining_qty = $original_qty - $transfer_qty;

                $rate = floatval($original_item['rate'] ?? 0);
                $discount = floatval($original_item['discount'] ?? 0);

                // Recalculate for original (remaining) item
                $rem_subtotal = $rate * $remaining_qty;
                $rem_discountAmt = $rem_subtotal * ($discount / 100);
                $rem_amount = $rem_subtotal - $rem_discountAmt;
                $rem_gst = $rem_amount * 0.18;
                $rem_total = $rem_amount + $rem_gst;
                
                $rem_paid = floatval($original_item['paid'] ?? 0);
                $rem_unpaid = $rem_total - $rem_paid;
                if ($rem_unpaid < 0) $rem_unpaid = 0;

                // Update original item - reduce quantity, recalculate amounts, and accumulate transfer_qty
                $new_transfer_qty = intval($original_item['transfer_qty'] ?? 0) + $transfer_qty;
                $new_stock_status = ($remaining_qty <= 0) ? 'transferred' : $original_item['stock_status'];

                $update_sql = "UPDATE project_inventory SET
                    quantity = '$remaining_qty',
                    amount = '$rem_amount',
                    gst = '$rem_gst',
                    total = '$rem_total',
                    unpaid = '$rem_unpaid',
                    stock_status = '$new_stock_status',
                    transfer_qty = '$new_transfer_qty',
                    target_project_id = '$target_project_id'
                    WHERE id = '$id'";

                if ($conn->query($update_sql)) {
                    // Recalculate for new transferred item
                    $trans_subtotal = $rate * $transfer_qty;
                    $trans_discountAmt = $trans_subtotal * ($discount / 100);
                    $trans_amount = $trans_subtotal - $trans_discountAmt;
                    $trans_gst = $trans_amount * 0.18;
                    $trans_total = $trans_amount + $trans_gst;

                    // Create new record in target project
                    $insert_sql = "INSERT INTO project_inventory
                    (project_id, invoice_no, invoice_date, vendor, category, item_name, rate, quantity, discount, amount, gst, total, payment_status, paid, unpaid, payment_mode, stock_status)
                    VALUES
                    ('$target_project_id',
                     '" . $conn->real_escape_string($original_item['invoice_no'] ?? '') . "',
                     NULLIF('" . $conn->real_escape_string($original_item['invoice_date'] ?? '') . "', ''),
                     '" . $conn->real_escape_string($original_item['vendor'] ?? '') . "',
                     '" . $conn->real_escape_string($original_item['category'] ?? '') . "',
                     '" . $conn->real_escape_string($original_item['item_name'] ?? '') . "',
                     '$rate',
                     '$transfer_qty',
                     '$discount',
                     '$trans_amount',
                     '$trans_gst',
                     '$trans_total',
                     'Unpaid',
                     0,
                     '$trans_total',
                     'Cash',
                     'pending')";

                    if ($conn->query($insert_sql)) {
                        echo json_encode([
                            "status" => "success",
                            "message" => "Transfer successful - item moved to target project"
                        ]);
                    } else {
                        echo json_encode([
                            "status" => "error",
                            "message" => "Failed to create item in target project: " . $conn->error
                        ]);
                    }
                } else {
                    echo json_encode([
                        "status" => "error",
                        "message" => "Failed to update original item: " . $conn->error
                    ]);
                }
            } else {
                echo json_encode([
                    "status" => "error",
                    "message" => "Original item not found"
                ]);
            }
        } else {
            // Simple status update without transfer
            $sql = "UPDATE project_inventory SET stock_status = '$stock_status', transfer_qty = '$transfer_qty' WHERE id = '$id'";

            if ($conn->query($sql)) {
                echo json_encode([
                    "status" => "success",
                    "message" => "Stock status updated successfully"
                ]);
            } else {
                echo json_encode([
                    "status" => "error",
                    "message" => $conn->error
                ]);
            }
        }
    } else {
        echo json_encode([
            "status" => "error",
            "message" => "No valid field to update"
        ]);
    }
    exit;
}
?>