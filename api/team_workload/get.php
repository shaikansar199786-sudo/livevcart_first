<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

require_once __DIR__ . '/../config/database.php';

$database = new Database();
$db = $database->getConnection();

try {
    // Get members
    $query = "SELECT * FROM team_workload_members ORDER BY `row_number`, order_index";
    $stmt = $db->prepare($query);
    $stmt->execute();
    $members = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Get items
    $query = "SELECT * FROM team_workload_items ORDER BY order_index";
    $stmt = $db->prepare($query);
    $stmt->execute();
    $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Group items by member and category
    foreach ($members as &$member) {
        $member['items'] = [
            'RED' => [],
            'YELLOW' => [],
            'GREEN' => []
        ];
        foreach ($items as $item) {
            if ($item['member_id'] == $member['id']) {
                $member['items'][$item['category']][] = $item;
            }
        }
    }

    // Get row counts from config
    $query = "SELECT * FROM team_workload_config";
    $stmt = $db->query($query);
    $configs = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $rowCounts = ['RED' => 3, 'YELLOW' => 3, 'GREEN' => 3];
    foreach ($configs as $config) {
        $rowCounts[$config['category']] = (int)$config['row_count'];
    }

    echo json_encode([
        "success" => true,
        "data" => $members,
        "rowCounts" => $rowCounts
    ]);

} catch (PDOException $e) {
    echo json_encode([
        "success" => false,
        "message" => $e->getMessage()
    ]);
}
?>
