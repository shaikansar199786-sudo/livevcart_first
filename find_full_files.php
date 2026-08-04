<?php
$brainDir = 'C:/Users/Shaik Ansar/.gemini/antigravity-ide/brain/';
$convDirs = glob($brainDir . '*', GLOB_ONLYDIR);

$bestQuoteTab = null;
$bestAgreements = null;

foreach ($convDirs as $conv) {
    $logFiles = [
        $conv . '/.system_generated/logs/transcript_full.jsonl',
        $conv . '/.system_generated/logs/transcript.jsonl'
    ];

    foreach ($logFiles as $logPath) {
        if (!file_exists($logPath)) continue;

        $handle = fopen($logPath, 'r');
        while (($line = fgets($handle)) !== false) {
            if (strpos($line, 'QuoteTab.tsx') !== false || strpos($line, 'Agreements.tsx') !== false) {
                $json = json_decode($line, true);
                if ($json && isset($json['tool_calls'])) {
                    foreach ($json['tool_calls'] as $tc) {
                        $args = $tc['args'] ?? [];
                        $file = $args['TargetFile'] ?? '';
                        $code = $args['CodeContent'] ?? null;
                        if ($code) {
                            if (strpos($file, 'QuoteTab.tsx') !== false && strlen($code) > 100000) {
                                $bestQuoteTab = $code;
                            }
                            if (strpos($file, 'Agreements.tsx') !== false && strlen($code) > 60000) {
                                $bestAgreements = $code;
                            }
                        }
                    }
                }
            }
        }
        fclose($handle);
    }
}

if ($bestQuoteTab) {
    file_put_contents('c:/xampp/htdocs/livrcart/demoark/frontend/src/components/QuoteTab.tsx', $bestQuoteTab);
    echo "Restored QuoteTab.tsx (" . strlen($bestQuoteTab) . " bytes)\n";
} else {
    echo "QuoteTab.tsx full file not found in brain logs.\n";
}

if ($bestAgreements) {
    file_put_contents('c:/xampp/htdocs/livrcart/demoark/frontend/src/pages/Agreements.tsx', $bestAgreements);
    echo "Restored Agreements.tsx (" . strlen($bestAgreements) . " bytes)\n";
} else {
    echo "Agreements.tsx full file not found in brain logs.\n";
}
