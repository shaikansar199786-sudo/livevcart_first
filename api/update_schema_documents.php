<?php
require_once __DIR__ . '/config/database.php';

try {
    $db = new Database();
    $conn = $db->getConnection();

    // Create project_folders table
    $query = "CREATE TABLE IF NOT EXISTS project_folders (
        folder_id INT AUTO_INCREMENT PRIMARY KEY,
        project_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
    )";
    $conn->exec($query);
    echo "project_folders table created successfully.\n";

    // Create project_files table
    $query = "CREATE TABLE IF NOT EXISTS project_files (
        file_id INT AUTO_INCREMENT PRIMARY KEY,
        project_id INT NOT NULL,
        folder_id INT NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(255) NOT NULL,
        file_type VARCHAR(50) NOT NULL,
        uploaded_by INT,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
        FOREIGN KEY (folder_id) REFERENCES project_folders(folder_id) ON DELETE CASCADE,
        FOREIGN KEY (uploaded_by) REFERENCES users(user_id) ON DELETE SET NULL
    )";
    $conn->exec($query);
    echo "project_files table created successfully.\n";

} catch(PDOException $e) {
    echo "Database Error: " . $e->getMessage() . "\n";
} catch(Exception $e) {
    echo "General Error: " . $e->getMessage() . "\n";
}
?>
