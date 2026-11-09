<?php
require_once __DIR__ . '/../libs/PHPMailer/src/Exception.php';
require_once __DIR__ . '/../libs/PHPMailer/src/PHPMailer.php';
use PHPMailer\PHPMailer\PHPMailer;

$mail = new PHPMailer();
$mail->setFrom('updates@livincart.com', 'Test');
$mail->addAddress('test@example.com');
$mail->Subject = 'Re: Test Subject';
$mail->Body = 'Test Body';
$origId = '<test-id-123@livincart.com>';
$mail->addCustomHeader('In-Reply-To', $origId);
$mail->addCustomHeader('References', $origId);
$mail->preSend();
echo "Headers:\n" . $mail->createHeader() . "\n";
