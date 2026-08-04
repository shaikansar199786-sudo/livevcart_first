<?php
// api/check_tables.php
require_once 'config/database.php';

try {
    $db = new Database();
    $conn = $db->getConnection();

    $stmt = $conn->query("SHOW TABLES");
    $results = $stmt->fetchAll(PDO::FETCH_COLUMN);

    echo "<pre>";
    print_r($results);
    echo "</pre>";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
?>
