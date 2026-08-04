<?php
$brainDir = 'C:/Users/Shaik Ansar/.gemini/antigravity-ide/brain/';
$convDirs = glob($brainDir . '*', GLOB_ONLYDIR);

foreach ($convDirs as $conv) {
    $logFiles = [
        $conv . '/.system_generated/logs/transcript_full.jsonl',
        $conv . '/.system_generated/logs/transcript.jsonl'
    ];

    foreach ($logFiles as $logPath) {
        if (!file_exists($logPath)) continue;

        $handle = fopen($logPath, 'r');
        $step = 0;
        while (($line = fgets($handle)) !== false) {
            $step++;
            if (strpos($line, 'Agreements.tsx') !== false && (strpos($line, 'write_to_file') !== false || strpos($line, 'CodeContent') !== false)) {
                $json = json_decode($line, true);
                if ($json && isset($json['tool_calls'])) {
                    foreach ($json['tool_calls'] as $tc) {
                        $args = $tc['args'] ?? [];
                        if (isset($args['TargetFile']) && strpos($args['TargetFile'], 'Agreements.tsx') !== false && isset($args['CodeContent'])) {
                            $out = "c:/xampp/htdocs/livrcart/demoark/Agreements_restored_" . basename($conv) . "_{$step}.tsx";
                            file_put_contents($out, $args['CodeContent']);
                            echo "Saved {$out} (" . strlen($args['CodeContent']) . " bytes)\n";
                        }
                    }
                }
            }
        }
        fclose($handle);
    }
}
