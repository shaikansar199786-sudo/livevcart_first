<?php
// api/fix_clients_table.php
require_once 'config/database.php';

try {
    $db = new Database();
    $conn = $db->getConnection();

    echo "Updating clients table...<br>";

    // Add consultation_type if missing
    $conn->exec("ALTER TABLE clients ADD COLUMN IF NOT EXISTS consultation_type VARCHAR(50) AFTER projectname");
    echo "Column 'consultation_type' checked/added.<br>";

    echo "Success: Clients table updated successfully.";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
?>
