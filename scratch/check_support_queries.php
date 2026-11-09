<?php
require_once __DIR__ . '/../api/config/database.php';
$database = new Database();
$db = $database->getConnection();

try {
    $stmt = $db->query("SHOW TABLES LIKE 'support_queries'");
    $tables = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo "Tables matching support_queries:\n";
    print_r($tables);

    if (!empty($tables)) {
        $desc = $db->query("DESCRIBE support_queries")->fetchAll(PDO::FETCH_ASSOC);
        echo "Columns in support_queries:\n";
        print_r($desc);

        $rows = $db->query("SELECT * FROM support_queries ORDER BY id DESC LIMIT 5")->fetchAll(PDO::FETCH_ASSOC);
        echo "Recent support_queries rows:\n";
        print_r($rows);
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}

