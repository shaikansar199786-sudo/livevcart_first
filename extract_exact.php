<?php
$logPath = 'C:/Users/Shaik Ansar/.gemini/antigravity-ide/brain/08d21b09-cae1-4405-85c4-ed87b54fdafd/.system_generated/logs/transcript_full.jsonl';
$handle = fopen($logPath, 'r');
$step = 0;

while (($line = fgets($handle)) !== false) {
    $step++;
    if (strpos($line, 'Agreements.tsx') !== false && (strpos($line, 'write_to_file') !== false || strpos($line, 'replace_file_content') !== false)) {
        $json = json_decode($line, true);
        if ($json && isset($json['tool_calls'])) {
            foreach ($json['tool_calls'] as $tc) {
                $args = $tc['args'] ?? [];
                if (isset($args['TargetFile']) && strpos($args['TargetFile'], 'Agreements.tsx') !== false) {
                    if (isset($args['CodeContent']) && strlen($args['CodeContent']) > 5000) {
                        file_put_contents("c:/xampp/htdocs/livrcart/demoark/Agreements_full_step_{$step}.tsx", $args['CodeContent']);
                        echo "Step {$step} full write: " . strlen($args['CodeContent']) . " bytes\n";
                    }
                }
            }
        }
    }
}
fclose($handle);
