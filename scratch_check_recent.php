<?php
$_GET['token'] = 'fab063566d5dff4bd43530b8de84c1a71b0f27fedcd0cdb1446b1db0dc7d5d66';
$_GET['action'] = 'accept';
ob_start();
include __DIR__ . '/api/acknowledge.php';
$out = ob_get_clean();

echo "Heading: " . $heading . "\n";
echo "Status: " . $status . "\n";
echo "Message: " . $message . "\n";
echo "Has interactiveButtonsBlock: " . (strpos($out, 'interactiveButtonsBlock') !== false ? 'YES' : 'NO') . "\n";
echo "Has 'Quotation Accepted Successfully': " . (strpos($out, 'Quotation Accepted Successfully') !== false ? 'YES' : 'NO') . "\n";
