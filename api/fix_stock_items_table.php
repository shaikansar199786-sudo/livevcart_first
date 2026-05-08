<?php
// api/fix_stock_items_table.php
// Run this once to create the project_stock_items table

$host = 'localhost';
$dbname = 'ark_pm_system';
$username = 'root';
$password = '';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Create project_stock_items table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `project_stock_items` (
            `id` int(11) NOT NULL AUTO_INCREMENT,
            `project_id` int(11) DEFAULT NULL,
            `name` varchar(200) NOT NULL,
            `category_name` varchar(200) NOT NULL,
            `unit` varchar(50) NOT NULL,
            `worth_in_rupees` decimal(12,2) NOT NULL DEFAULT 0.00,
            `status` enum('active','inactive') DEFAULT 'active',
            `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
            `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
            PRIMARY KEY (`id`),
            KEY `idx_project_id` (`project_id`),
            KEY `idx_category` (`category_name`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
    ");

    echo "<p style='color:green;font-family:sans-serif'>✅ Table <strong>project_stock_items</strong> created (or already exists).</p>";

    // Verify columns
    $cols = $pdo->query("DESCRIBE project_stock_items")->fetchAll(PDO::FETCH_ASSOC);
    echo "<table border='1' cellpadding='6' style='font-family:sans-serif;border-collapse:collapse'>";
    echo "<tr><th>Field</th><th>Type</th><th>Null</th><th>Default</th></tr>";
    foreach ($cols as $col) {
        echo "<tr><td>{$col['Field']}</td><td>{$col['Type']}</td><td>{$col['Null']}</td><td>{$col['Default']}</td></tr>";
    }
    echo "</table>";

} catch (PDOException $e) {
    echo "<p style='color:red;font-family:sans-serif'>❌ Error: " . $e->getMessage() . "</p>";
}
?>
