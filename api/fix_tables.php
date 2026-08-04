<?php
require_once 'c:\xampp\htdocs\Livincart\api\config\database.php';

try {
    $db = new Database();
    $conn = $db->getConnection();

    // 1. Create quotes table
    $conn->exec("CREATE TABLE IF NOT EXISTS quotes (
        quote_id INT AUTO_INCREMENT PRIMARY KEY,
        project_id INT NOT NULL,
        quote_number VARCHAR(50) UNIQUE NOT NULL,
        total_amount DECIMAL(15, 2) NOT NULL,
        created_by INT NOT NULL,
        status ENUM('budgeted', 'used', 'draft') DEFAULT 'budgeted',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
    )");

    // 2. Create quote_sections table
    $conn->exec("CREATE TABLE IF NOT EXISTS quote_sections (
        section_id INT AUTO_INCREMENT PRIMARY KEY,
        quote_id INT NOT NULL,
        section_name VARCHAR(200) NOT NULL,
        display_order INT DEFAULT 0,
        FOREIGN KEY (quote_id) REFERENCES quotes(quote_id) ON DELETE CASCADE
    )");

    // 3. Create quote_items table
    $conn->exec("CREATE TABLE IF NOT EXISTS quote_items (
        item_id INT AUTO_INCREMENT PRIMARY KEY,
        section_id INT NOT NULL,
        particulars TEXT NOT NULL,
        brand VARCHAR(100),
        unit VARCHAR(20),
        quantity DECIMAL(12, 2) DEFAULT 0,
        used_quantity DECIMAL(12, 2) DEFAULT 0,
        rate DECIMAL(12, 2) DEFAULT 0,
        amount DECIMAL(15, 2) DEFAULT 0,
        display_order INT DEFAULT 0,
        FOREIGN KEY (section_id) REFERENCES quote_sections(section_id) ON DELETE CASCADE
    )");

    echo "Tables 'quotes', 'quote_sections', and 'quote_items' checked/created successfully.\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
