<?php
// api/helpers/logoData.php
// Embedded Base64 Image Assets for SimplePdfBuilder and Emails

if (!defined('LIVINCART_LOGO_BASE64')) {
    $logoFile = __DIR__ . '/../assets/logo.png';
    if (!file_exists($logoFile)) $logoFile = __DIR__ . '/../assets/1.png';
    if (!file_exists($logoFile)) $logoFile = __DIR__ . '/../uploads/logo.png';
    if (!file_exists($logoFile)) $logoFile = __DIR__ . '/../uploads/1.png';
    if (file_exists($logoFile)) {
        define('LIVINCART_LOGO_BASE64', 'data:image/png;base64,' . base64_encode(file_get_contents($logoFile)));
    } else {
        define('LIVINCART_LOGO_BASE64', '');
    }
}

if (!defined('LIVINCART_SIGNATURE_BASE64')) {
    $sigFile = __DIR__ . '/../assets/LIVE CART SINGTU.png';
    if (!file_exists($sigFile)) $sigFile = __DIR__ . '/../uploads/LIVE CART SINGTU.png';
    if (file_exists($sigFile)) {
        define('LIVINCART_SIGNATURE_BASE64', 'data:image/png;base64,' . base64_encode(file_get_contents($sigFile)));
    } else {
        define('LIVINCART_SIGNATURE_BASE64', '');
    }
}
