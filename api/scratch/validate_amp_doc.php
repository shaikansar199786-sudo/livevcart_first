<?php
require_once __DIR__ . '/../helpers/AmpQuoteEmailBuilder.php';

$quoteData = [
    'quote_id' => 320,
    'quote_number' => 'QTN-lvit-2',
    'client_name' => 'Shaik Salman',
    'total_amount' => 8750.00,
    'sections' => [
        ['section_name' => 'Living Room Modulars'],
        ['section_name' => 'Kitchen Cabinetry']
    ]
];
$token = '5c0bbdaec931690867be12fbcc108dc3df5273e830d07bcb465ad4462b2fd9e6';
$endpoint = 'https://livincart.com/api/acknowledge.php';

$ampDoc = AmpQuoteEmailBuilder::buildAmpEmail($quoteData, $token, $endpoint);
$outPath = __DIR__ . '/sample_amp_email.html';
file_put_contents($outPath, $ampDoc);

echo "Saved AMP email to: {$outPath} (" . strlen($ampDoc) . " bytes)\n";
