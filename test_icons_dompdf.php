<?php
require_once __DIR__ . '/api/libs/dompdf/autoload.inc.php';
use Dompdf\Dompdf;
use Dompdf\Options;

$options = new Options();
$options->set('isHtml5ParserEnabled', true);
$options->set('isRemoteEnabled', true);
$options->set('defaultFont', 'DejaVu Sans');
$options->set('dpi', 96);

$dompdf = new Dompdf($options);

// Test SVG/HTML icons in Dompdf
$html = '
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: "DejaVu Sans", sans-serif; font-size: 10pt; }
    .icon-orange { color: #ea580c; font-weight: bold; font-size: 11pt; margin-right: 4px; }
  </style>
</head>
<body>
  <p><span class="icon-orange">&#9993;</span> contact@livincart.com</p>
  <p><span class="icon-orange">&#9742;</span> +91 7702312351</p>
  <p><span class="icon-orange">&#127760;</span> www.livincart.com</p>
</body>
</html>
';

$dompdf->loadHtml($html);
$dompdf->setPaper('A4', 'portrait');
$dompdf->render();

$pdfOutput = $dompdf->output();
file_put_contents(__DIR__ . '/test_icons_out.pdf', $pdfOutput);
echo "Icon test PDF generated: " . strlen($pdfOutput) . " bytes\n";
