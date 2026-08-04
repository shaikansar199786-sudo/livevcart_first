<?php
require_once 'config/database.php';
require_once 'controllers/AuthController.php';
$db = new Database();
$conn = $db->getConnection();
$auth = new AuthController($conn);

$result = $auth->forgotPassword('Admin123'); // testing with the username "Admin123" because we kept the DB username field as "email" conceptually. Wait, is the email "Admin123"? The user uses Admin123 as username currently. Let's see if the token gets set.
echo json_encode($result);
?>
