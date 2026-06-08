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

    // The data should contain members and their items
    // For simplicity, we'll clear and re-insert items for existing members, 
    // or we can handle it more gracefully.
    
    // Update member name
    if (isset($data->action) && $data->action === 'update_member') {
        $query = "UPDATE team_workload_members SET name = :name WHERE id = :id";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':name', $data->name);
        $stmt->bindParam(':id', $data->id);
        $stmt->execute();
        
        $db->commit();
        echo json_encode(["success" => true]);
        exit;
    }

    // If the request is to add a new member
    if (isset($data->action) && $data->action === 'add_member') {
        $query = "INSERT INTO team_workload_members (name, `row_number`, order_index) VALUES (:name, :row_number, :order_index)";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':name', $data->name);
        $stmt->bindParam(':row_number', $data->row_number);
        $stmt->bindParam(':order_index', $data->order_index);
        $stmt->execute();
        $member_id = $db->lastInsertId();
        
        $db->commit();
        echo json_encode(["success" => true, "id" => $member_id]);
        exit;
    }

    // If the request is to save an item
    if (isset($data->action) && $data->action === 'save_item') {
        if (isset($data->id) && $data->id > 0) {
            $query = "UPDATE team_workload_items SET content = :content WHERE id = :id";
            $stmt = $db->prepare($query);
            $stmt->bindParam(':content', $data->content);
            $stmt->bindParam(':id', $data->id);
        } else {
            $query = "INSERT INTO team_workload_items (member_id, category, content, order_index) VALUES (:member_id, :category, :content, :order_index)";
            $stmt = $db->prepare($query);
            $stmt->bindParam(':member_id', $data->member_id);
            $stmt->bindParam(':category', $data->category);
            $stmt->bindParam(':content', $data->content);
            $stmt->bindParam(':order_index', $data->order_index);
        }
        $stmt->execute();
        
        $db->commit();
        echo json_encode(["success" => true]);
        exit;
    }

    // Delete item
    if (isset($data->action) && $data->action === 'delete_item') {
        $query = "DELETE FROM team_workload_items WHERE id = :id";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':id', $data->id);
        $stmt->execute();
        
        $db->commit();
        echo json_encode(["success" => true]);
        exit;
    }

    $db->commit();
    echo json_encode(["success" => true]);

} catch (PDOException $e) {
    $db->rollBack();
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}
?>
