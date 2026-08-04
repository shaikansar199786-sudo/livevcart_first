<?php
require_once 'config/database.php';
require_once 'controllers/LeadController.php';

$log = "Starting debug...\n";

try {
    $db = new Database();
    $conn = $db->getConnection();
    
    // Enable strict error mode for PDO to ensure we catch everything
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    $controller = new LeadController($conn);
    
    $data = [
        'client_name' => 'Ravi Rao',
        'contact_number' => '4567891230',
        'email' => 'ravi@gmail.com',
        'location' => 'P & T Colony',
        'client_address' => 'Some address',
        'project_type' => 'Furniture projects',
        'estimated_budget' => '',
        'lead_source' => '',
        'manual_client_id' => 'cl1001',
        'project_scope' => '2 BHK',
        'created_by' => null // We'll set this dynamically
    ];
    
    // Get a real user_id
    $u_q = $conn->query("SELECT user_id FROM users LIMIT 1");
    $u = $u_q->fetch(PDO::FETCH_ASSOC);
    $data['created_by'] = $u['user_id'] ?? 'no_user_found';
    
    $log .= "Using created_by: " . print_r($data['created_by'], true) . "\n";
    
    $result = $controller->create($data);
    $log .= "Result: " . print_r($result, true) . "\n";
} catch (Exception $e) {
    $log .= "CRITICAL DB ERROR: " . $e->getMessage() . "\n";
}

file_put_contents('debug_output.txt', $log);
echo "Done";
?>
