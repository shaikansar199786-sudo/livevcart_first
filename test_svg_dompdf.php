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

$pinSvg = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="%23ea580c"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>';
$phoneSvg = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="%23ea580c"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>';
$clipSvg = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="%23f97316"><path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 16H5V5h2v2h10V5h2v14z"/></svg>';

$html = '
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: "DejaVu Sans", sans-serif; font-size: 10pt; }
  </style>
</head>
<body>
  <p><img src="' . $pinSvg . '" style="height:14px; vertical-align:middle; margin-right:4px;" /> Visakhapatnam, Andhra Pradesh</p>
  <p><img src="' . $phoneSvg . '" style="height:14px; vertical-align:middle; margin-right:4px;" /> +91 7702312351</p>
  <p><img src="' . $clipSvg . '" style="height:22px; vertical-align:middle; margin-right:6px;" /> QTN-DC-PR_2026_578/01</p>
</body>
</html>
';

$dompdf->loadHtml($html);
$dompdf->setPaper('A4', 'portrait');
$dompdf->render();

$pdfOutput = $dompdf->output();
file_put_contents(__DIR__ . '/test_svg_out.pdf', $pdfOutput);
echo "SVG icon test PDF generated: " . strlen($pdfOutput) . " bytes\n";
