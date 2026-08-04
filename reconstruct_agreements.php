<?php
$logPath = 'C:/Users/Shaik Ansar/.gemini/antigravity-ide/brain/08d21b09-cae1-4405-85c4-ed87b54fdafd/.system_generated/logs/transcript_full.jsonl';
$handle = fopen($logPath, 'r');
$diffs = [];

while (($line = fgets($handle)) !== false) {
    if (strpos($line, 'Agreements.tsx') !== false && strpos($line, 'replace_file_content') !== false) {
        $json = json_decode($line, true);
        if ($json && isset($json['tool_calls'])) {
            foreach ($json['tool_calls'] as $tc) {
                $args = $tc['args'] ?? [];
                if (isset($args['TargetFile']) && strpos($args['TargetFile'], 'Agreements.tsx') !== false) {
                    if (isset($args['TargetContent']) && isset($args['ReplacementContent'])) {
                        $diffs[] = [
                            'target' => $args['TargetContent'],
                            'replacement' => $args['ReplacementContent']
                        ];
                    }
                }
            }
        }
    }
}
fclose($handle);

echo "Found " . count($diffs) . " replacement diffs for Agreements.tsx\n";
$baseCode = file_get_contents('c:/xampp/htdocs/livrcart/demoark/Agreements_restored_2f81a2bd-443b-41ef-82ec-f20a4cdac487_424.tsx');

// Apply diffs up to 2 hours ago (around diff 30 out of 45)
foreach ($diffs as $idx => $d) {
    $baseCode = str_replace($d['target'], $d['replacement'], $baseCode);
    if ($idx == 25 || $idx == 30 || $idx == 35 || $idx == count($diffs) - 1) {
        file_put_contents("c:/xampp/htdocs/livrcart/demoark/Agreements_reconstructed_{$idx}.tsx", $baseCode);
        echo "Saved reconstruction at diff {$idx} (" . strlen($baseCode) . " bytes)\n";
    }
}
