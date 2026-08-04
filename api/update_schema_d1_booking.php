<?php
require_once __DIR__ . '/config/database.php';

try {
    $db = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME, DB_USER, DB_PASS);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // 1. Add columns to leads table
    try {
        $db->exec("ALTER TABLE leads ADD COLUMN d1_assigned_to INT DEFAULT NULL");
        $db->exec("ALTER TABLE leads ADD CONSTRAINT fk_d1_assigned FOREIGN KEY (d1_assigned_to) REFERENCES users(user_id)");
        echo "Added d1_assigned_to to leads.\n";
    } catch (Exception $e) {
        echo "d1_assigned_to might already exist: " . $e->getMessage() . "\n";
    }

    try {
        $db->exec("ALTER TABLE leads ADD COLUMN d1_booking_time DATETIME DEFAULT NULL");
        echo "Added d1_booking_time to leads.\n";
    } catch (Exception $e) {
        echo "d1_booking_time might already exist: " . $e->getMessage() . "\n";
    }

    // 2. Create notifications table
    $sql = "CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_is_read (is_read)
    )";
    $db->exec($sql);
    echo "Notifications table checked/created.\n";

    echo "Schema update completed successfully.\n";

} catch (PDOException $e) {
    echo "Database Error: " . $e->getMessage() . "\n";
}
?>
