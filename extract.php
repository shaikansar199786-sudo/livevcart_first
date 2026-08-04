<?php
$logFile = 'C:/Users/Shaik Ansar/.gemini/antigravity-ide/brain/08d21b09-cae1-4405-85c4-ed87b54fdafd/.system_generated/logs/transcript_full.jsonl';
$handle = fopen($logFile, 'r');
$matches = [];
$step = 0;

while (($line = fgets($handle)) !== false) {
    $step++;
    if (strpos($line, 'Agreements.tsx') !== false && strpos($line, 'LivincartFurnitureContract') !== false) {
        $json = json_decode($line, true);
        if ($json && isset($json['tool_calls'])) {
            foreach ($json['tool_calls'] as $tc) {
                if (isset($tc['args']['TargetFile']) && strpos($tc['args']['TargetFile'], 'Agreements.tsx') !== false) {
                    $content = $tc['args']['CodeContent'] ?? $tc['args']['ReplacementContent'] ?? null;
                    if ($content && strlen($content) > 10000) {
                        file_put_contents("c:/xampp/htdocs/livrcart/demoark/Agreements_step_{$step}.tsx", $content);
                        echo "Extracted step {$step} length " . strlen($content) . "\n";
                    }
                }
            }
        }
    }
}
fclose($handle);
