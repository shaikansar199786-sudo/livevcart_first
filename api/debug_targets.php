<?php
require 'config/database.php';
$db = new Database();
$conn = $db->getConnection();
try {
    $stmt = $conn->query("DESCRIBE team_targets");
    print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
    $stmt = $conn->query("SELECT * FROM team_targets");
    print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
?>
