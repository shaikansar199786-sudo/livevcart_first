<?php
// Mock project ID and is_used
$_GET['project_id'] = 1; // Assuming project ID 1 exists
$_GET['is_used'] = 'false';

require_once 'c:\xampp\htdocs\Livincart\api\config\database.php';
require_once 'c:\xampp\htdocs\Livincart\api\controllers\QuoteController.php';

$db = new Database();
$conn = $db->getConnection();
$quote = new QuoteController($conn);

$result = $quote->getLatestQuote(1, false);

echo "--- GET LATEST QUOTE TEST ---\n";
print_r($result);
?>
