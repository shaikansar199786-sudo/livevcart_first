<?php
$agEdits = json_decode(file_get_contents('c:/xampp/htdocs/livrcart/demoark/agreements_edits.json'), true);
$qtEdits = json_decode(file_get_contents('c:/xampp/htdocs/livrcart/demoark/quotetab_edits.json'), true);

function applyDiffChain($initialCode, $edits) {
    $code = $initialCode;
    $applied = 0;
    foreach ($edits as $idx => $edit) {
        if (isset($edit['TargetContent']) && isset($edit['ReplacementContent'])) {
            $t = $edit['TargetContent'];
            $r = $edit['ReplacementContent'];
            
            if (strpos($code, $t) !== false) {
                $code = str_replace($t, $r, $code);
                $applied++;
            } else {
                // Try normalizing line endings (\r\n vs \n)
                $codeNorm = str_replace("\r\n", "\n", $code);
                $tNorm = str_replace("\r\n", "\n", $t);
                $rNorm = str_replace("\r\n", "\n", $r);
                if (strpos($codeNorm, $tNorm) !== false) {
                    $code = str_replace($tNorm, $rNorm, $codeNorm);
                    $applied++;
                } else {
                    echo "Edit $idx target failed match\n";
                }
            }
        }
    }
    return [$code, $applied];
}

// Check where the 1941 line Agreements.tsx is stored in logs or scratch files
$brainDir = 'C:/Users/Shaik Ansar/.gemini/antigravity-ide/brain/08d21b09-cae1-4405-85c4-ed87b54fdafd/.system_generated/logs/transcript_full.jsonl';
$log = file_get_contents($brainDir);

// Find any large snippet of Agreements.tsx or QuoteTab.tsx in transcript_full.jsonl
preg_match_all('/export default function Agreements[^\n]*/', $log, $agMatches);
preg_match_all('/const QuoteTab: React.FC[^\n]*/', $log, $qtMatches);

echo "Found " . count($agMatches[0]) . " Ag matches in log\n";
echo "Found " . count($qtMatches[0]) . " Qt matches in log\n";
