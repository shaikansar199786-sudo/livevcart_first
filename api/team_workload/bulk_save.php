<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

require_once __DIR__ . '/../config/database.php';

$database = new Database();
$db = $database->getConnection();

$data = json_decode(file_get_contents("php://input"));

if (!$data) {
    echo json_encode(["success" => false, "message" => "No data provided"]);
    exit;
}

try {
    $db->beginTransaction();

    // 0. Clear all existing data to prevent duplicates (since we re-map everything)
    $db->exec("DELETE FROM team_workload_items");
    $db->exec("DELETE FROM team_workload_members");

    // 1. Process Members
    if (isset($data->members)) {
        $stmt = $db->prepare("INSERT INTO team_workload_members (name, `row_number`, order_index) VALUES (?, ?, ?)");
        foreach ($data->members as $m) {
            if (!empty($m->name)) {
                $stmt->execute([$m->name, $m->row_number, $m->order_index]);
            }
        }
    }

    // 2. Fetch all members again to get correct IDs (including newly inserted ones)
    $stmt = $db->query("SELECT id, name, `row_number`, order_index FROM team_workload_members");
    $allMembers = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 3. Clear all items (already done at step 0)

    // 4. Process Items
    if (isset($data->items)) {
        $stmt = $db->prepare("INSERT INTO team_workload_items (member_id, category, content, order_index) VALUES (?, ?, ?, ?)");
        foreach ($data->items as $item) {
            $memberId = 0;
            foreach ($allMembers as $am) {
                if ($am['order_index'] == $item->order_index_col && $am['row_number'] == $item->row_number_col) {
                    $memberId = $am['id'];
                    break;
                }
            }
            
            if ($memberId > 0 && !empty($item->content)) {
                $stmt->execute([$memberId, $item->category, $item->content, $item->order_index_row]);
            }
        }
    }

    $db->commit();
    echo json_encode(["success" => true]);

} catch (PDOException $e) {
    if ($db->inTransaction()) $db->rollBack();
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}
?>
