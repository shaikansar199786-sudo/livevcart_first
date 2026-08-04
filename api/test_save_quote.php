<?php
require_once 'c:\xampp\htdocs\Livincart\api\config\database.php';
require_once 'c:\xampp\htdocs\Livincart\api\controllers\QuoteController.php';

$db = new Database();
$conn = $db->getConnection();
$quote = new QuoteController($conn);

$data = [
    'project_id' => 1,
    'is_used_quote' => false,
    'total_amount' => 5000000.00,
    'created_by' => 1,
    'sections' => [
        [
            'name' => 'TEST SECTION',
            'items' => [
                [
                    'particulars' => 'Test Item',
                    'brand' => 'Test Brand',
                    'unit' => 'no',
                    'quantity' => 10,
                    'used_quantity' => 0,
                    'rate' => 1000,
                    'amount' => 10000
                ]
            ]
        ]
    ]
];

$result = $quote->saveQuoteState($data);

echo "--- SAVE QUOTE TEST ---\n";
print_r($result);
?>
