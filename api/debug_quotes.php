<?php
require_once 'c:\xampp\htdocs\Livincart\api\config\database.php';

try {
    $db = new Database();
    $conn = $db->getConnection();

    $stmt = $conn->query("SELECT * FROM quotes");
    $quotes = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo "--- QUOTES TABLE DATA ---\n";
    print_r($quotes);

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
