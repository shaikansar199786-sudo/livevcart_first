<?php
require_once __DIR__ . '/api/config/database.php';
require_once __DIR__ . '/api/libs/dompdf/autoload.inc.php';
require_once __DIR__ . '/api/controllers/QuoteController.php';

use Dompdf\Dompdf;
use Dompdf\Options;

// Load company logo
$logoPath = __DIR__ . '/frontend/src/assets/1.png';
$logoBase64 = '';
if (file_exists($logoPath)) {
    $logoBase64 = 'data:image/png;base64,' . base64_encode(file_get_contents($logoPath));
}

$pinSvg = 'data:image/svg+xml;base64,' . base64_encode('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ea580c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>');
$phoneSvg = 'data:image/svg+xml;base64,' . base64_encode('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ea580c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>');
$emailSvg = 'data:image/svg+xml;base64,' . base64_encode('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ea580c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>');
$globeSvg = 'data:image/svg+xml;base64,' . base64_encode('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.7 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10z"/></svg>');

$pinSvgW = 'data:image/svg+xml;base64,' . base64_encode('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>');
$phoneSvgW = 'data:image/svg+xml;base64,' . base64_encode('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>');
$emailSvgW = 'data:image/svg+xml;base64,' . base64_encode('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>');
$userSvg = 'data:image/svg+xml;base64,' . base64_encode('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0f172a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>');

$icClip = 'data:image/svg+xml;base64,' . base64_encode('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ea580c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>');
$icCal = 'data:image/svg+xml;base64,' . base64_encode('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>');

$icPin = '<img src="' . $pinSvg . '" style="width: 10px; height: 10px; vertical-align: -1px; margin-right: 4px; display: inline-block;" />';
$icPhone = '<img src="' . $phoneSvg . '" style="width: 10px; height: 10px; vertical-align: -1px; margin-right: 4px; display: inline-block;" />';
$icEmail = '<img src="' . $emailSvg . '" style="width: 10px; height: 10px; vertical-align: -1px; margin-right: 4px; display: inline-block;" />';
$icGlobe = '<img src="' . $globeSvg . '" style="width: 10px; height: 10px; vertical-align: -1px; margin-right: 4px; display: inline-block;" />';

$icPinW = '<img src="' . $pinSvgW . '" style="width: 10px; height: 10px; vertical-align: -1px; margin-right: 4px; display: inline-block;" />';
$icPhoneW = '<img src="' . $phoneSvgW . '" style="width: 10px; height: 10px; vertical-align: -1px; margin-right: 4px; display: inline-block;" />';
$icEmailW = '<img src="' . $emailSvgW . '" style="width: 10px; height: 10px; vertical-align: -1px; margin-right: 4px; display: inline-block;" />';
$icUser = '<img src="' . $userSvg . '" style="width: 10px; height: 10px; vertical-align: -1px; margin-right: 4px; display: inline-block;" />';

$quoteHtml = '
<div id="pdf-page-1" class="page-break-cover" style="background-color: #ffffff; padding: 0; box-sizing: border-box; page-break-after: always; break-after: page;">
  <!-- Outer table: 5 rows - header | top-spacer | middle content | bottom-spacer | footer -->
  <table style="width: 100%; border-collapse: collapse;">
    <tbody>

      <!-- ROW 1: Top header -->
      <tr style="vertical-align: top;">
        <td style="border: none; padding: 0; vertical-align: top;">
          <table style="width: 100%; border-collapse: collapse; border-bottom: 2.5px solid #ea580c; padding-bottom: 12px; margin-bottom: 0px;">
            <tbody>
              <tr>
                <td style="width: 50%; vertical-align: middle; border: none; padding: 0;">
                  <table style="border-collapse: collapse; margin: 0; padding: 0;">
                    <tr>
                      <td style="vertical-align: middle; padding: 0 12px 0 0; border: none;">
                        <img src="' . $logoBase64 . '" alt="Logo" style="height: 48px; width: auto; object-fit: contain; display: block;" />
                      </td>
                      <td style="vertical-align: middle; padding: 0; border: none; text-align: left;">
                        <div style="font-size: 13pt; font-weight: 900; color: #000000; line-height: 1.2; white-space: nowrap;">Livincart Private Limited</div>
                        <div style="font-size: 7.5pt; color: #64748b; font-weight: 500; margin-top: 2px; white-space: nowrap;">Official Quotation &amp; Estimation Workspace</div>
                      </td>
                    </tr>
                  </table>
                </td>
                <td style="width: 50%; vertical-align: middle; text-align: right; border: none; padding: 0;">
                  <div style="font-size: 9.5pt; font-weight: 900; color: #000000; margin-bottom: 4px;">LIVINCART AND SERVICES PRIVATE LIMITED</div>
                  <div style="font-size: 7.5pt; color: #475569; font-weight: 600; line-height: 1.35; white-space: nowrap; margin-bottom: 2px;">
                    ' . $icPin . ' Visakhapatnam, Andhra Pradesh &#8211; 530020
                  </div>
                  <div style="font-size: 7.5pt; color: #475569; font-weight: 600; line-height: 1.35; white-space: nowrap; margin-bottom: 2px;">
                    ' . $icPhone . ' +91 7702312351
                  </div>
                  <div style="font-size: 7.5pt; color: #475569; font-weight: 600; line-height: 1.35; white-space: nowrap;">
                    ' . $icEmail . ' contact@livincart.com &nbsp;&nbsp; ' . $icGlobe . ' www.livincart.com
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </td>
      </tr>

      <!-- ROW 2: Top Spacer (220px) -->
      <tr style="height: 220px;">
        <td style="border: none; padding: 0; height: 220px;">&nbsp;</td>
      </tr>

      <!-- ROW 3: Center Hero Content -->
      <tr>
        <td style="border: none; padding: 0; vertical-align: middle; text-align: center;">
          <div style="text-align: center; margin: 0 auto;">
            <img src="' . $logoBase64 . '" alt="Logo Center" style="height: 80px; width: auto; object-fit: contain; margin-bottom: 14px;" />
            <div style="font-size: 13.5pt; font-weight: 900; color: #000000; margin-bottom: 8px; letter-spacing: 0.5px;">LIVINCART AND SERVICES PRIVATE LIMITED</div>
            <div style="width: 160px; height: 0px; border-bottom: 3.5px solid #ea580c; margin: 8px auto 22px;"></div>

            <h1 style="margin: 0; font-size: 24pt; font-weight: 900; color: #000000; letter-spacing: 0.5px;">OFFICIAL QUOTATION &amp;</h1>
            <h1 style="margin: 6px 0 0 0; font-size: 26pt; font-weight: 900; color: #ea580c; letter-spacing: 0.5px;">PROJECT ESTIMATE</h1>
            <div style="width: 200px; height: 0px; border-bottom: 3.5px solid #ea580c; margin: 12px auto 26px;"></div>

            <!-- Quote Details Box -->
            <table class="quote-header-details-table" style="margin: 0 auto; border: 2px solid #ea580c; border-radius: 20px; border-collapse: separate; background-color: #ffffff;">
              <tbody>
                <tr>
                  <td style="border: none; padding: 12px 24px; vertical-align: middle; text-align: left;">
                    <img src="' . $icClip . '" style="width: 18px; height: 18px; vertical-align: middle; margin-right: 8px; float: left;" />
                    <div style="display: inline-block; vertical-align: middle; text-align: left;">
                      <div style="font-size: 8.5pt; color: #64748b; font-weight: 600;">Quote No.</div>
                      <div style="font-size: 11pt; font-weight: 900; color: #000000; white-space: nowrap;">QTN-PR_74</div>
                    </div>
                  </td>
                  <td style="border: none; border-left: 1.5px solid #fed7aa; padding: 12px 24px; vertical-align: middle; text-align: left;">
                    <img src="' . $icCal . '" style="width: 18px; height: 18px; vertical-align: middle; margin-right: 8px; float: left;" />
                    <div style="display: inline-block; vertical-align: middle; text-align: left;">
                      <div style="font-size: 8.5pt; color: #64748b; font-weight: 600;">Date</div>
                      <div style="font-size: 11pt; font-weight: 900; color: #000000; white-space: nowrap;">2026-09-03</div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </td>
      </tr>

      <!-- ROW 4: Bottom Spacer (220px) -->
      <tr style="height: 220px;">
        <td style="border: none; padding: 0; height: 220px;">&nbsp;</td>
      </tr>

      <!-- ROW 5: Bottom Contact Card (Locked at bottom edge) -->
      <tr style="vertical-align: bottom;">
        <td style="border: none; padding: 0; vertical-align: bottom;">
          <div style="border: 2px solid #ea580c; border-radius: 18px; background-color: #ffffff; overflow: hidden;">
            <table class="cover-card-orange-strip" style="width: 100%; background-color: #ea580c; background: #ea580c; border-collapse: collapse;">
              <tbody>
                <tr>
                  <td style="width: 38%; border: none; padding: 10px 14px; color: #ffffff; font-size: 8.5pt; font-weight: 800; vertical-align: middle; text-align: center; white-space: nowrap;">
                    ' . $icPinW . ' Visakhapatnam, Andhra Pradesh 530020
                  </td>
                  <td style="width: 26%; border: none; border-left: 1.5px solid #ffffff; padding: 10px 14px; color: #ffffff; font-size: 8.5pt; font-weight: 800; vertical-align: middle; text-align: center; white-space: nowrap;">
                    ' . $icPhoneW . ' +91 7702312351
                  </td>
                  <td style="width: 36%; border: none; border-left: 1.5px solid #ffffff; padding: 10px 14px; color: #ffffff; font-size: 8.5pt; font-weight: 800; vertical-align: middle; text-align: center; white-space: nowrap;">
                    ' . $icEmailW . ' contact@livincart.com
                  </td>
                </tr>
              </tbody>
            </table>

            <table class="cover-card-light-strip" style="width: 100%; background-color: #fff7ed; background: #fff7ed; border-top: 1.5px solid #fed7aa; border-collapse: collapse;">
              <tbody>
                <tr>
                  <td style="width: 50%; border: none; padding: 10px 14px; color: #0f172a; font-size: 9pt; font-weight: 900; vertical-align: middle; text-align: center; white-space: nowrap;">
                    ' . $icGlobe . ' www.livincart.com
                  </td>
                  <td style="width: 50%; border: none; border-left: 1.5px solid #fed7aa; padding: 10px 14px; color: #0f172a; font-size: 9pt; font-weight: 900; vertical-align: middle; text-align: center; white-space: nowrap;">
                    ' . $icUser . ' Livincart Team
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </td>
      </tr>

    </tbody>
  </table>
</div>';


$quoteHtml .= '
<div id="pdf-page-2" class="page-break-project-info" style="background-color: #ffffff; padding: 0; position: relative; box-sizing: border-box; page-break-after: always; break-after: page;">
    <h2 style="font-size: 16pt; font-weight: 900; color: #ea580c; border-bottom: 2px solid #ea580c; padding-bottom: 6px; margin-bottom: 20px;">PROJECT INFORMATION</h2>
</div>

<div class="agreements-contract-wrapper" style="padding: 0;">
    <h2 style="font-size: 16pt; font-weight: 900; color: #ea580c; border-bottom: 2px solid #ea580c; padding-bottom: 6px; margin-bottom: 16px;">WORKS CONTRACT AGREEMENT</h2>
</div>
';

$rawHtml = $quoteHtml;

$icPin = '<img src="' . $pinSvg . '" style="width: 10px; height: 10px; vertical-align: middle; margin-right: 3px;" />';
$icPhone = '<img src="' . $phoneSvg . '" style="width: 10px; height: 10px; vertical-align: middle; margin-right: 3px;" />';
$icEmail = '<img src="' . $emailSvg . '" style="width: 10px; height: 10px; vertical-align: middle; margin-right: 3px;" />';
$icGlobe = '<img src="' . $globeSvg . '" style="width: 10px; height: 10px; vertical-align: middle; margin-right: 3px;" />';
$icUser = '<img src="' . $userSvg . '" style="width: 10px; height: 10px; vertical-align: middle; margin-right: 4px;" />';
$icClip = '<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNlYTU4MGMiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTYgNGgyYTIgMiAwIDAgMSAyIDJ2MTRhMiAyIDAgMCAxLTIgMkg2YTIgMiAwIDAgMS0yLTJWNmEyIDIgMCAwIDEgMi0yaDIiLz48cmVjdCB4PSI4IiB5PSIyIiB3aWR0aD0iOCIgaGVpZ2h0PSI0IiByeD0iMSIgcnk9IjEiLz48L3N2Zz4=" width="20" height="20" style="height: 20px; vertical-align: middle; margin-right: 8px;" />';
$icCal = '<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMzYjgyZjYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB4PSIzIiB5PSI0IiB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHJ4PSIyIiByeT0iMiIvPjxsaW5lIHgxPSIxNiIgeTE9IjIiIHgyPSIxNiIgeTI9IjYiLz48bGluZSB4MT0iOCIgeTE9IjIiIHgyPSI4IiB5Mj0iNiIvPjxsaW5lIHgxPSIzIiB5MT0iMTAiIHgyPSIyMSIgeTI9IjEwIi8+PC9zdmc+" width="20" height="20" style="height: 20px; vertical-align: middle; margin-right: 8px;" />';

// Strip unicode variation selector 16 (\uFE0F) to prevent Dompdf purple square box artifacts
$rawHtml = str_replace(["\xEF\xB8\x8F", "\u{FE0F}"], '', $rawHtml);

$emojiMap = [
    '📍' => $icPin,
    '📞' => $icPhone,
    '✉'  => $icEmail,
    '🌐' => $icGlobe,
    '👤' => $icUser,
    '📋' => $icClip,
    '📅' => $icCal
];
$rawHtml = strtr($rawHtml, $emojiMap);

$rawHtml = preg_replace('/(id=["\']pdf-page-[1234]["\'][^>]*style=["\'])/i', '$1page-break-after: always !important; break-after: page !important; ', $rawHtml);
$rawHtml = preg_replace('/(class=["\']page-break-(?:cover|project-info|modules-summary)["\'][^>]*style=["\'])/i', '$1page-break-after: always !important; break-after: page !important; ', $rawHtml);

$options = new Options();
$options->set('isHtml5ParserEnabled', true);
$options->set('isRemoteEnabled', true);
$options->set('isFontSubsettingEnabled', false);
$options->set('defaultFont', 'DejaVu Sans');
$options->set('dpi', 96);

$dompdf = new Dompdf($options);

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
    table, p, li, ul, ol, div {
      page-break-inside: auto !important;
      break-inside: auto !important;
    }
    tr {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    h1, h2, h3, h4, .subTitle {
      page-break-after: avoid !important;
      break-after: avoid !important;
    }
    p { margin: 0 0 3px 0; line-height: 1.45; }
    
    /* Content & Contract Data Tables in Dompdf */
    .agreements-contract-wrapper table,
    .contract-wrapper table,
    .contract-document table,
    .page-break-project-info table,
    .page-break-modules-summary table,
    .page-break-detail-tables table,
    .page-break-terms-conditions table,
    .item-table,
    .summary-table {
      width: 100% !important;
      border-collapse: collapse !important;
      margin: 6px 0 !important;
      font-size: 8.5pt !important;
    }

    .agreements-contract-wrapper th,
    .contract-wrapper th,
    .contract-document th,
    .page-break-project-info th,
    .page-break-modules-summary th,
    .page-break-detail-tables th,
    .page-break-terms-conditions th,
    .item-table th,
    .summary-table th {
      border: 1px solid #1e293b;
      padding: 6px 8px;
      font-weight: bold;
      text-align: left;
      background-color: rgba(254, 143, 62, 1) !important;
      background: rgba(254, 143, 62, 1) !important;
      color: #ffffff !important;
    }

    .agreements-contract-wrapper td,
    .contract-wrapper td,
    .contract-document td,
    .page-break-project-info td,
    .page-break-modules-summary td,
    .page-break-detail-tables td,
    .page-break-terms-conditions td,
    .item-table td,
    .summary-table td {
      border: 1px solid #cbd5e1;
      padding: 5px 6px;
      vertical-align: top;
      color: #0f172a;
    }

    /* Cover Page (#pdf-page-1) Explicit Design Preservation for Dompdf */
    #pdf-page-1 table {
      width: 100%;
      margin: 0;
      border-collapse: collapse;
    }

    #pdf-page-1 td {
      border: none !important;
      padding: 0;
    }

    #pdf-page-1 table.quote-header-details-table {
      width: auto !important;
      margin: 0 auto !important;
      border: 2px solid #ea580c !important;
      border-radius: 20px !important;
      border-collapse: separate !important;
      background-color: #ffffff !important;
    }

    #pdf-page-1 table.quote-header-details-table td {
      border: none !important;
      padding: 12px 24px !important;
      vertical-align: middle !important;
    }

    #pdf-page-1 table.quote-header-details-table td+td {
      border-left: 1.5px solid #fed7aa !important;
    }

    #pdf-page-1 .cover-card-orange-strip {
      width: 100% !important;
      background-color: #ea580c !important;
      background: #ea580c !important;
      border-collapse: collapse !important;
    }

    #pdf-page-1 .cover-card-orange-strip td {
      border: none !important;
      padding: 10px 14px !important;
      color: #ffffff !important;
      font-size: 8.5pt !important;
      font-weight: 800 !important;
      text-align: center !important;
      vertical-align: middle !important;
    }

    #pdf-page-1 .cover-card-orange-strip td+td {
      border-left: 1.5px solid #ffffff !important;
    }

    #pdf-page-1 .cover-card-light-strip {
      width: 100% !important;
      background-color: #fff7ed !important;
      background: #fff7ed !important;
      border-top: 1.5px solid #fed7aa !important;
      border-collapse: collapse !important;
    }

    #pdf-page-1 .cover-card-light-strip td {
      border: none !important;
      padding: 10px 14px !important;
      color: #0f172a !important;
      font-size: 9pt !important;
      font-weight: 900 !important;
      text-align: center !important;
      vertical-align: middle !important;
    }

    #pdf-page-1 .cover-card-light-strip td+td {
      border-left: 1.5px solid #fed7aa !important;
    }
    /* Cover page: page-break-after but NO avoid-inside so table height works */
    #pdf-page-1 {
      page-break-after: always !important;
      break-after: page !important;
      box-sizing: border-box !important;
    }
    .page-break,
    .html2pdf__page-break,
    .page-break-cover,
    .page-break-project-info,
    .page-break-modules-summary,
    #pdf-page-2,
    #pdf-page-3,
    #pdf-page-4 {
      page-break-after: always !important;
      break-after: page !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      clear: both !important;
      display: block !important;
      box-sizing: border-box !important;
    }
    .agreements-contract-wrapper {
      clear: both !important;
      display: block !important;
    }
    .merged-package-wrapper,
    .agreements-print-preview,
    .agreements-contract-wrapper,
    .contract-wrapper,
    .contract-document,
    .agreements-contract-wrapper .page,
    .contract-wrapper .page,
    div.page,
    #pdf-page-2,
    #pdf-page-3,
    #pdf-page-4,
    .page-break-cover,
    .page-break-project-info,
    .page-break-modules-summary {
      padding: 0 !important;
      margin: 0 auto !important;
      width: 100% !important;
      max-width: 100% !important;
      box-shadow: none !important;
      box-sizing: border-box !important;
    }
  </style>
</head>
<body>
  <div class="pdf-explicit-margin-wrapper" style="margin: 38px 52px 26px 52px !important; width: 690px !important; max-width: 690px !important; padding: 0 !important; box-sizing: border-box !important;">
    ' . $rawHtml . '
  </div>
</body>
</html>';

$dompdf->loadHtml($fullDocumentHtml);
$dompdf->setPaper('A4', 'portrait');
$dompdf->render();

$pdfOutput = $dompdf->output();
$outputPath = __DIR__ . '/final_merged_package_proof.pdf';
file_put_contents($outputPath, $pdfOutput);
echo "Final updated font-weight and font-size PDF proof generated: " . strlen($pdfOutput) . " bytes at " . $outputPath . "\n";
