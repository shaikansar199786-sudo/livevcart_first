<?php
$logPath = 'C:/Users/Shaik Ansar/.gemini/antigravity-ide/brain/08d21b09-cae1-4405-85c4-ed87b54fdafd/.system_generated/logs/transcript_full.jsonl';
$handle = fopen($logPath, 'r');
$lastQuoteTab = null;
$lastAgreements = null;

while (($line = fgets($handle)) !== false) {
    if (strpos($line, 'QuoteTab.tsx') !== false || strpos($line, 'Agreements.tsx') !== false) {
        $json = json_decode($line, true);
        if ($json && isset($json['tool_calls'])) {
            foreach ($json['tool_calls'] as $tc) {
                $args = $tc['args'] ?? [];
                $file = $args['TargetFile'] ?? '';
                $content = $args['CodeContent'] ?? null;
                if ($content) {
                    if (strpos($file, 'QuoteTab.tsx') !== false && strlen($content) > 100000) {
                        $lastQuoteTab = $content;
                    }
                    if (strpos($file, 'Agreements.tsx') !== false && strlen($content) > 80000) {
                        $lastAgreements = $content;
                    }
                }
            }
        }
    }
}
fclose($handle);

if ($lastQuoteTab) {
    file_put_contents('c:/xampp/htdocs/livrcart/demoark/frontend/src/components/QuoteTab.tsx', $lastQuoteTab);
    echo "Restored QuoteTab.tsx (" . strlen($lastQuoteTab) . " bytes)\n";
} else {
    echo "No full QuoteTab.tsx found in write_to_file, looking in diffs...\n";
}

if ($lastAgreements) {
    file_put_contents('c:/xampp/htdocs/livrcart/demoark/frontend/src/pages/Agreements.tsx', $lastAgreements);
    echo "Restored Agreements.tsx (" . strlen($lastAgreements) . " bytes)\n";
} else {
    echo "No full Agreements.tsx found in write_to_file, looking in diffs...\n";
}
