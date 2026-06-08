<?php
require 'config/database.php';
$db = new Database();
$conn = $db->getConnection();

echo "=== CURRENT DATABASE CONNECTION ===\n";
echo "DB_NAME: " . DB_NAME . "\n\n";

echo "=== CHECK IF PROJECTS TABLE EXISTS ===\n";
try {
    $stmt = $conn->query("SHOW TABLES LIKE 'projects'");
    $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
    if (count($result) > 0) {
        echo "Projects table exists\n\n";
        
        echo "=== COUNT PROJECTS ===\n";
        $stmt = $conn->query("SELECT COUNT(*) as count FROM projects");
        $count = $stmt->fetch(PDO::FETCH_ASSOC)['count'];
        echo "Total projects: " . $count . "\n\n";
        
        if ($count > 0) {
            echo "=== LIST PROJECTS ===\n";
            $stmt = $conn->query("SELECT project_id, project_name FROM projects LIMIT 5");
            $projects = $stmt->fetchAll(PDO::FETCH_ASSOC);
            print_r($projects);
        }
    } else {
        echo "Projects table does NOT exist\n";
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}

echo "\n=== CHECK IF USERS TABLE EXISTS ===\n";
try {
    $stmt = $conn->query("SHOW TABLES LIKE 'users'");
    $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
    if (count($result) > 0) {
        echo "Users table exists\n";
        $stmt = $conn->query("SELECT COUNT(*) as count FROM users");
        echo "Total users: " . $stmt->fetch(PDO::FETCH_ASSOC)['count'] . "\n";
    } else {
        echo "Users table does NOT exist\n";
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
