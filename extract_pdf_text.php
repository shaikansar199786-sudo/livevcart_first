<?php
// extract_pdf_text.php
$filename = 'Interior_Vendor_Service_Agreemt.pdf';
if (!file_exists($filename)) {
    echo "File not found: $filename\n";
    exit;
}

$content = file_get_contents($filename);

// Extract stream text from PDF
preg_match_all('/stream[\r\n]+(.*?)[\r\n]+endstream/s', $content, $streams);

$allText = '';
foreach ($streams[1] as $stream) {
    // Try gzuncompress if deflated
    $uncompressed = @gzuncompress($stream);
    if ($uncompressed !== false) {
        $allText .= $uncompressed . "\n";
    } else {
        $allText .= $stream . "\n";
    }
}

// Extract text inside TJ / Tj blocks
preg_match_all('/\((.*?)\)\s*Tj/s', $allText, $tjMatches);
if (!empty($tjMatches[1])) {
    echo "--- TEXT Tj --- \n";
    echo implode("\n", $tjMatches[1]) . "\n";
}

preg_match_all('/\[(.*?)\]\s*TJ/s', $allText, $TJMatches);
if (!empty($TJMatches[1])) {
    echo "--- TEXT TJ --- \n";
    foreach ($TJMatches[1] as $TJ) {
        preg_match_all('/\((.*?)\)/', $TJ, $strMatches);
        if (!empty($strMatches[1])) {
            echo implode('', $strMatches[1]) . "\n";
        }
    }
}

// Fallback: output plain readable strings
if (empty($tjMatches[1]) && empty($TJMatches[1])) {
    preg_match_all('/[A-Za-z0-9\s\.\,\:\;\-\(\)\'\"]{5,}/', $allText, $plainMatches);
    echo implode("\n", array_slice($plainMatches[0], 0, 200));
}
?>
