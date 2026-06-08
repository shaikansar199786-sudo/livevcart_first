<?php
// Test monthly income save
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: application/json');

require 'config/database.php';
require 'controllers/MonthlyIncomeController.php';

$database = new Database();
$conn = $database->getConnection();

$incomeCtrl = new MonthlyIncomeController($conn);

// Test save
$test_month = '2026-06';
$test_rows = [
    ['category' => 'elegance', 'description' => 'Test', 'amount' => '1000', 'date' => '2026-06-01']
];

try {
    $result = $incomeCtrl->save($test_month, $test_rows);
    echo json_encode([
        "success" => true,
        "result" => $result,
        "message" => "Save test completed"
    ]);
} catch (Exception $e) {
    echo json_encode([
        "success" => false,
        "error" => $e->getMessage(),
        "trace" => $e->getTraceAsString()
    ]);
}
