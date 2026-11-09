<?php
require_once __DIR__ . '/libs/dompdf/autoload.inc.php';
use Dompdf\Dompdf;
use Dompdf\Options;

$options = new Options();
$options->set('isHtml5ParserEnabled', true);
$options->set('isRemoteEnabled', true);
$options->set('defaultFont', 'DejaVu Sans');
$options->set('dpi', 96);

$dompdf = new Dompdf($options);

// Use exact QuoteController.php wrapper HTML
$htmlContent = file_get_contents(__DIR__ . '/raw_agreement.html');

$fullDocumentHtml = '
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page { margin: 15mm 24mm 15mm 24mm; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background-color: #ffffff;
      color: #0f172a;
    }
    body {
      font-family: "DejaVu Sans", Arial, Helvetica, sans-serif;
      font-size: 9pt;
      color: #0f172a;
      margin: 0;
      padding: 0;
      background: #ffffff;
    }
  </style>
</head>
<body>
' . $htmlContent . '
</body>
</html>';

// Add Dompdf marker
$fullDocumentHtml = str_replace('Livincart Works Contract', 'Livincart Works Contract DOMPDF_MARKER_999', $fullDocumentHtml);

$dompdf->loadHtml($fullDocumentHtml);
$dompdf->setPaper('A4', 'portrait');
$dompdf->render();

$pdfBytes = $dompdf->output();
file_put_contents(__DIR__ . '/dompdf_debug_output.pdf', $pdfBytes);

echo "Dompdf PDF generated! Size: " . strlen($pdfBytes) . " bytes\n";
echo "Page width in pt: " . $dompdf->getCanvas()->get_width() . "\n";
echo "Page height in pt: " . $dompdf->getCanvas()->get_height() . "\n";
