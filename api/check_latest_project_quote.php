<?php
require_once 'c:\xampp\htdocs\Livincart\api\config\database.php';
$db = new Database();
$conn = $db->getConnection();

// Get latest project
$stmt = $conn->query("SELECT project_id, project_name FROM projects ORDER BY project_id DESC LIMIT 1");
$project = $stmt->fetch(PDO::FETCH_ASSOC);

if ($project) {
    echo "Checking latest project: " . $project['project_name'] . " (ID: " . $project['project_id'] . ")\n";
    
    // Check quotes for this project
    $q_stmt = $conn->prepare("SELECT * FROM quotes WHERE project_id = ?");
    $q_stmt->execute([$project['project_id']]);
    $quotes = $q_stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (empty($quotes)) {
        echo "No quotes found for this project in the database.\n";
    } else {
        echo "Found " . count($quotes) . " quotes:\n";
        print_r($quotes);
    }
} else {
    echo "No projects found.\n";
}
?>
