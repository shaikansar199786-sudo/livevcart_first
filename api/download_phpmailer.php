<?php
// Download PHPMailer files from GitHub
$files = [
    'Exception.php' => 'https://raw.githubusercontent.com/PHPMailer/PHPMailer/master/src/Exception.php',
    'PHPMailer.php' => 'https://raw.githubusercontent.com/PHPMailer/PHPMailer/master/src/PHPMailer.php',
    'SMTP.php'      => 'https://raw.githubusercontent.com/PHPMailer/PHPMailer/master/src/SMTP.php'
];

$libs_dir = __DIR__ . '/libs/PHPMailer/src';
if (!is_dir($libs_dir)) {
    mkdir($libs_dir, 0777, true);
}

foreach ($files as $name => $url) {
    $content = file_get_contents($url);
    if ($content !== false) {
        file_put_contents($libs_dir . '/' . $name, $content);
        echo "Downloaded $name\n";
    } else {
        echo "Failed to download $name\n";
    }
}
?>
