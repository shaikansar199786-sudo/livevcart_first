<?php
$logPath = 'C:/Users/Shaik Ansar/.gemini/antigravity-ide/brain/08d21b09-cae1-4405-85c4-ed87b54fdafd/.system_generated/logs/transcript_full.jsonl';
$handle = fopen($logPath, 'r');

$agreementsEdits = [];
$quoteTabEdits = [];

while (($line = fgets($handle)) !== false) {
    $json = json_decode($line, true);
    if ($json && isset($json['tool_calls'])) {
        foreach ($json['tool_calls'] as $tc) {
            $args = $tc['args'] ?? [];
            $file = $args['TargetFile'] ?? '';
            if (strpos($file, 'Agreements.tsx') !== false) {
                $agreementsEdits[] = $args;
            }
            if (strpos($file, 'QuoteTab.tsx') !== false) {
                $quoteTabEdits[] = $args;
            }
        }
    }
}
fclose($handle);

echo "Found " . count($agreementsEdits) . " edits for Agreements.tsx\n";
echo "Found " . count($quoteTabEdits) . " edits for QuoteTab.tsx\n";

file_put_contents('c:/xampp/htdocs/livrcart/demoark/agreements_edits.json', json_encode($agreementsEdits, JSON_PRETTY_PRINT));
file_put_contents('c:/xampp/htdocs/livrcart/demoark/quotetab_edits.json', json_encode($quoteTabEdits, JSON_PRETTY_PRINT));
