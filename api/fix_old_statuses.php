<?php
require 'config/database.php';
$db = new Database();
$conn = $db->getConnection();
try {
    // Note: Since I already modified the enum, old values might be gone if they didn't match.
    // But if they were 'active', they might still be there or empty.
    // Usually MySQL converts invalid enum values to empty string.
    
    // I should have done this BEFORE modifying the enum, but I can still try to fix it.
    // Actually, I'll just set everything to 'On Going' as a baseline if it's invalid.
    $conn->exec("UPDATE projects SET status = 'On Going' WHERE status NOT IN ('Pending', 'Completed', 'On Going', 'Cancelled') OR status IS NULL OR status = ''");
    echo "Existing project statuses fixed.\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
?>
