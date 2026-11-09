<?php
require_once __DIR__ . '/libs/dompdf/autoload.inc.php';
use Dompdf\Dompdf;
use Dompdf\Options;

$options = new Options();
$options->set('isHtml5ParserEnabled', true);
$options->set('isRemoteEnabled', true);
$options->set('isFontSubsettingEnabled', false);
$options->set('defaultFont', 'DejaVu Sans');
$options->set('dpi', 96);

$dompdf = new Dompdf($options);

// Remove page-break-before from page 2 to eliminate blank empty page
$page1Html = '
<div id="pdf-page-1" class="page-break-cover" style="background-color: #ffffff; padding: 1px 0; position: relative; box-sizing: border-box; page-break-after: always; break-after: page; margin-bottom: 0;">
    <!-- Top Header -->
    <table style="width: 100%; border-collapse: collapse; border-bottom: 2.5px solid #ea580c; padding-bottom: 12px; margin-bottom: 0px;">
        <tbody>
            <tr>
                <td style="width: 50%; vertical-align: top; border: none; padding: 0;">
                    <div style="font-size: 15pt; font-weight: 900; color: #000000; margin-bottom: 2px;">Livincart Private Limited</div>
                    <div style="font-size: 8pt; color: #64748b; font-weight: 500;">Official Quotation &amp; Estimation Workspace</div>
                </td>
                <td style="width: 50%; vertical-align: top; text-align: right; border: none; padding: 0;">
                    <div style="font-size: 9.5pt; font-weight: 900; color: #000000; margin-bottom: 4px;">LIVINCART AND SERVICES PRIVATE LIMITED</div>
                    <div style="font-size: 7.5pt; color: #475569; font-weight: 600; margin-top: 4px;">
                        <span style="margin-right: 10px;">▪ Visakhapatnam, Andhra Pradesh – 530020</span>
                        <span>▪ +91 7702312351</span>
                    </div>
                    <div style="font-size: 7.5pt; color: #475569; font-weight: 600; margin-top: 2px;">
                        <span style="margin-right: 10px;">▪ contact@livincart.com</span>
                        <span>▪ www.livincart.com</span>
                    </div>
                </td>
            </tr>
        </tbody>
    </table>

    <!-- Center Hero Block -->
    <div style="text-align: center; padding-top: 60px; margin: 0 auto;">
        <div style="font-size: 13pt; font-weight: 900; color: #000000; margin-bottom: 10px;">LIVINCART AND SERVICES PRIVATE LIMITED</div>
        <div style="width: 160px; height: 0px; border-bottom: 3.5px solid #ea580c; margin: 8px auto 20px;"></div>

        <h1 style="margin: 0; font-size: 20pt; font-weight: 900; color: #000000;">OFFICIAL QUOTATION &amp;</h1>
        <h1 style="margin: 4px 0 0 0; font-size: 22pt; font-weight: 900; color: #ea580c;">
            PROJECT ESTIMATE (FINAL VERSION)
        </h1>
        <div style="width: 200px; height: 0px; border-bottom: 3.5px solid #ea580c; margin: 10px auto 24px;"></div>

        <!-- Quote Details Box -->
        <table class="quote-header-details-table" style="margin: 0 auto; border: 2px solid #ea580c; border-radius: 16px; border-collapse: separate; background-color: #ffffff;">
            <tbody>
                <tr>
                    <td style="border: none; padding: 12px 20px; vertical-align: middle; text-align: left;">
                        <div style="display: inline-block; vertical-align: middle; font-size: 16pt; margin-right: 8px;">▪</div>
                        <div style="display: inline-block; vertical-align: middle; text-align: left;">
                            <div style="font-size: 8.5pt; color: #64748b; font-weight: 600;">Quote No.</div>
                            <div style="font-size: 10.5pt; font-weight: 900; color: #000000; white-space: nowrap;">QTN-101-v1</div>
                        </div>
                    </td>
                    <td style="border: none; border-left: 1.5px solid #fed7aa; padding: 12px 20px; vertical-align: middle; text-align: left;">
                        <div style="display: inline-block; vertical-align: middle; font-size: 16pt; margin-right: 8px;">▪</div>
                        <div style="display: inline-block; vertical-align: middle; text-align: left;">
                            <div style="font-size: 8.5pt; color: #64748b; font-weight: 600;">Date</div>
                            <div style="font-size: 10.5pt; font-weight: 900; color: #000000; white-space: nowrap;">10 Sept 2026</div>
                        </div>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>

    <!-- Bottom Contact Card -->
    <div style="padding-top: 70px; margin: 0;">
        <div style="border: 2px solid #ea580c; border-radius: 16px; background-color: #ffffff; overflow: hidden;">
            <table class="cover-card-orange-strip" style="width: 100%; background-color: #ea580c; background: #ea580c; border-collapse: collapse;">
                <tbody>
                    <tr>
                        <td style="width: 36%; border: none; padding: 10px 12px; color: #ffffff; font-size: 8.5pt; font-weight: 800; vertical-align: middle; text-align: center;">
                            <span style="font-size: 10pt; margin-right: 4px;">▪</span> Visakhapatnam, Andhra Pradesh 530020
                        </td>
                        <td style="width: 28%; border: none; border-left: 1.5px solid #ffffff; padding: 10px 12px; color: #ffffff; font-size: 8.5pt; font-weight: 800; vertical-align: middle; text-align: center;">
                            <span style="font-size: 10pt; margin-right: 4px;">▪</span> +91 7702312351
                        </td>
                        <td style="width: 36%; border: none; border-left: 1.5px solid #ffffff; padding: 10px 12px; color: #ffffff; font-size: 8.5pt; font-weight: 800; vertical-align: middle; text-align: center;">
                            <span style="font-size: 10pt; margin-right: 4px;">▪</span> contact@livincart.com
                        </td>
                    </tr>
                </tbody>
            </table>

            <table class="cover-card-light-strip" style="width: 100%; background-color: #fff7ed; background: #fff7ed; border-top: 1.5px solid #fed7aa; border-collapse: collapse;">
                <tbody>
                    <tr>
                        <td style="width: 50%; border: none; padding: 8px 12px; color: #0f172a; font-size: 9pt; font-weight: 900; vertical-align: middle; text-align: center;">
                            <span style="color: #ea580c; font-size: 10pt; margin-right: 6px;">▪</span> www.livincart.com
                        </td>
                        <td style="width: 50%; border: none; border-left: 1.5px solid #fed7aa; padding: 8px 12px; color: #0f172a; font-size: 9pt; font-weight: 900; vertical-align: middle; text-align: center;">
                            <span style="color: #ea580c; font-size: 10pt; margin-right: 6px;">▪</span> Livincart Team
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</div>

<div id="pdf-page-2" class="page-break-project-info" style="background-color: #ffffff; padding: 16px 24px 20px 24px; position: relative; box-sizing: border-box; page-break-after: always; break-after: page; margin-bottom: 0;">
    <div>
        <!-- Header -->
        <table style="width: 100%; border-collapse: collapse; border-bottom: 2.5px solid #ea580c; padding-bottom: 14px; margin-bottom: 28px;">
            <tbody>
                <tr>
                    <td style="width: 50%; vertical-align: top; border: none; padding: 0;">
                        <div style="font-size: 15pt; font-weight: 900; color: #000000; margin-bottom: 2px;">Livincart Private Limited</div>
                        <div style="font-size: 8pt; color: #64748b; font-weight: 500;">Official Quotation &amp; Estimation Workspace</div>
                    </td>
                    <td style="width: 50%; vertical-align: top; text-align: right; border: none; padding: 0;">
                        <div style="font-size: 9.5pt; font-weight: 900; color: #000000; margin-bottom: 4px;">LIVINCART AND SERVICES PRIVATE LIMITED</div>
                    </td>
                </tr>
            </tbody>
        </table>
        <!-- Title -->
        <div style="margin-bottom: 28px;">
            <h2 style="margin: 0; font-size: 20pt; font-weight: 900; color: #0f172a;">PROJECT INFORMATION</h2>
            <div style="width: 80px; height: 4px; background-color: #ea580c; margin-top: 8px;"></div>
        </div>
    </div>
</div>
';

$fullDocumentHtml = '
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page { margin: 0px; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background-color: #ffffff;
      color: #0f172a;
    }
    body {
      font-family: "DejaVu Sans", Arial, Helvetica, sans-serif;
      font-size: 9pt;
      color: #0f172a;
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff;
    }
    .pdf-explicit-margin-wrapper {
      margin: 38px 52px 26px 52px !important;
      width: 690px !important;
      max-width: 690px !important;
      padding: 0 !important;
      box-sizing: border-box !important;
    }
    .page-break,
    .page-break-cover,
    .page-break-project-info,
    #pdf-page-1,
    #pdf-page-2 {
      page-break-after: always !important;
      break-after: page !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      clear: both !important;
      display: block !important;
      box-sizing: border-box !important;
    }
  </style>
</head>
<body>
<div class="pdf-explicit-margin-wrapper">
' . $page1Html . '
</div>
</body>
</html>';

$dompdf->loadHtml($fullDocumentHtml);
$dompdf->setPaper('A4', 'portrait');
$dompdf->render();

$pdfBytes = $dompdf->output();
file_put_contents(__DIR__ . '/test_cover_page.pdf', $pdfBytes);

echo "Cover PDF generated! Size: " . strlen($pdfBytes) . " bytes\n";
