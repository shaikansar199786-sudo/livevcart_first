<?php
$logPath = 'C:/Users/Shaik Ansar/.gemini/antigravity-ide/brain/364ae30b-388d-4ed4-9737-b6f6d54f5ebb/.system_generated/logs/transcript_full.jsonl';
$handle = fopen($logPath, 'r');

$latestQuoteTab = null;
$latestAgreements = null;

while (($line = fgets($handle)) !== false) {
    if (strpos($line, 'QuoteTab.tsx') !== false || strpos($line, 'Agreements.tsx') !== false) {
        $json = json_decode($line, true);
        if ($json && isset($json['tool_calls'])) {
            foreach ($json['tool_calls'] as $tc) {
                $args = $tc['args'] ?? [];
                $file = $args['TargetFile'] ?? '';
                $code = $args['CodeContent'] ?? null;
                if ($code) {
                    if (strpos($file, 'QuoteTab.tsx') !== false && strlen($code) > 50000) {
                        $latestQuoteTab = $code;
                    }
                    if (strpos($file, 'Agreements.tsx') !== false && strlen($code) > 50000) {
                        $latestAgreements = $code;
                    }
                }
            }
        }
    }
}
fclose($handle);

if ($latestQuoteTab) {
    file_put_contents('c:/xampp/htdocs/livrcart/demoark/frontend/src/components/QuoteTab.tsx', $latestQuoteTab);
    echo "Restored QuoteTab.tsx (" . strlen($latestQuoteTab) . " bytes)\n";
} else {
    echo "QuoteTab.tsx not found in 364 log\n";
}

if ($latestAgreements) {
    file_put_contents('c:/xampp/htdocs/livrcart/demoark/frontend/src/pages/Agreements.tsx', $latestAgreements);
    echo "Restored Agreements.tsx (" . strlen($latestAgreements) . " bytes)\n";
} else {
    echo "Agreements.tsx not found in 364 log\n";
}
