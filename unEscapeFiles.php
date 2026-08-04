<?php
$brainDir = 'C:/Users/Shaik Ansar/.gemini/antigravity-ide/brain/';
$convDirs = glob($brainDir . '*', GLOB_ONLYDIR);

$lastAgCode = null;
$lastQtCode = null;

foreach ($convDirs as $conv) {
    $logPath = $conv . '/.system_generated/logs/transcript_full.jsonl';
    if (!file_exists($logPath)) continue;

    $handle = fopen($logPath, 'r');
    while (($line = fgets($handle)) !== false) {
        if (strpos($line, 'Agreements.tsx') !== false || strpos($line, 'QuoteTab.tsx') !== false) {
            $json = json_decode($line, true);
            if ($json && isset($json['tool_calls'])) {
                foreach ($json['tool_calls'] as $tc) {
                    $args = $tc['args'] ?? [];
                    $file = $args['TargetFile'] ?? '';
                    $code = $args['CodeContent'] ?? null;
                    if ($code) {
                        if (strpos($file, 'Agreements.tsx') !== false && strlen($code) > 40000) {
                            $lastAgCode = $code;
                        }
                        if (strpos($file, 'QuoteTab.tsx') !== false && strlen($code) > 100000) {
                            $lastQtCode = $code;
                        }
                    }
                }
            }
        }
    }
    fclose($handle);
}

if ($lastAgCode) {
    file_put_contents('c:/xampp/htdocs/livrcart/demoark/frontend/src/pages/Agreements.tsx', $lastAgCode);
    echo "Restored Agreements.tsx (" . strlen($lastAgCode) . " bytes)\n";
}

if ($lastQtCode) {
    file_put_contents('c:/xampp/htdocs/livrcart/demoark/frontend/src/components/QuoteTab.tsx', $lastQtCode);
    echo "Restored QuoteTab.tsx (" . strlen($lastQtCode) . " bytes)\n";
}
