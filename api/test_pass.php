<?php
$hash = '$2y$10$Q8A9ovVUTAy8Bg/1bz75b.OBOH8Wh2Vq00oU7mQhCMSjFU4v.I0wC';
$attempts = ['admin', 'password', '123456', 'admin123', 'admin@123', 'demo'];
foreach ($attempts as $pass) {
    echo $pass . ': ' . (password_verify($pass, $hash) ? 'YES' : 'NO') . "\n";
}
?>
