<?php
// 1. Rebuild Agreements.tsx
$agEdits = json_decode(file_get_contents('c:/xampp/htdocs/livrcart/demoark/agreements_edits.json'), true);
$agCode = file_get_contents('c:/xampp/htdocs/livrcart/demoark/frontend/src/pages/Agreements.tsx');

$appliedAg = 0;
foreach ($agEdits as $idx => $edit) {
    if (isset($edit['TargetContent']) && isset($edit['ReplacementContent'])) {
        $target = $edit['TargetContent'];
        $replacement = $edit['ReplacementContent'];
        if (strpos($agCode, $target) !== false) {
            $agCode = str_replace($target, $replacement, $agCode);
            $appliedAg++;
        } else {
            echo "Ag Edit $idx target not found\n";
        }
    }
}
file_put_contents('c:/xampp/htdocs/livrcart/demoark/frontend/src/pages/Agreements.tsx', $agCode);
echo "Applied $appliedAg / " . count($agEdits) . " edits to Agreements.tsx (" . strlen($agCode) . " bytes)\n";

// 2. Rebuild QuoteTab.tsx
$qtEdits = json_decode(file_get_contents('c:/xampp/htdocs/livrcart/demoark/quotetab_edits.json'), true);
$qtCode = file_get_contents('c:/xampp/htdocs/livrcart/demoark/frontend/src/components/QuoteTab.tsx');

$appliedQt = 0;
foreach ($qtEdits as $idx => $edit) {
    if (isset($edit['TargetContent']) && isset($edit['ReplacementContent'])) {
        $target = $edit['TargetContent'];
        $replacement = $edit['ReplacementContent'];
        if (strpos($qtCode, $target) !== false) {
            $qtCode = str_replace($target, $replacement, $qtCode);
            $appliedQt++;
        } else {
            echo "QuoteTab Edit $idx target not found\n";
        }
    }
}
file_put_contents('c:/xampp/htdocs/livrcart/demoark/frontend/src/components/QuoteTab.tsx', $qtCode);
echo "Applied $appliedQt / " . count($qtEdits) . " edits to QuoteTab.tsx (" . strlen($qtCode) . " bytes)\n";
