<?php
require 'config/database.php';
require 'controllers/ProjectController.php';

$db = new Database();
$conn = $db->getConnection();
$project = new ProjectController($conn);

// Simulate API call with different user roles
echo "=== SIMULATING API CALLS ===\n\n";

echo "1. No user filter (admin/principal_architect):\n";
$result = $project->getAll(null, null);
echo json_encode(["success" => true, "data" => $result], JSON_PRETTY_PRINT);
echo "\n\n";

echo "2. With user_id and role parameters:\n";
$u_id = $_GET['user_id'] ?? null;
$role = $_GET['role'] ?? null;
if ($u_id && $role) {
    $result = $project->getAll($u_id, $role);
    echo json_encode(["success" => true, "data" => $result], JSON_PRETTY_PRINT);
} else {
    echo "Pass ?user_id=X&role=Y to test specific user\n";
}
?>
