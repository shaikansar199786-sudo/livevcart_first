<?php
$conn = new mysqli('localhost', 'root', '', 'prestLivincart');
$stmt = $conn->prepare("INSERT INTO vendors (vendor_name, vendor_code, status, category) VALUES ('Test From Script', 'TFS-001', 'active', 'General')");
if($stmt->execute()) echo "Inserted!";
else echo "Error: " . $conn->error;
?>
