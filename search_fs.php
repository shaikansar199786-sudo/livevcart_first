<?php
function searchDir($dir, $pattern) {
    $it = new RecursiveDirectoryIterator($dir, RecursiveDirectoryIterator::SKIP_DOTS);
    $files = new RecursiveIteratorIterator($it);
    foreach ($files as $file) {
        if ($file->isDir()) continue;
        if (strpos($file->getPathname(), 'node_modules') !== false) continue;
        if (strpos($file->getPathname(), '.git') !== false) continue;
        
        if (strpos($file->getFilename(), '.tsx') !== false || strpos($file->getFilename(), '.jsonl') !== false || strpos($file->getFilename(), '.txt') !== false) {
            $c = @file_get_contents($file->getPathname());
            if ($c && strpos($c, $pattern) !== false) {
                echo "Match: " . $file->getPathname() . " (" . strlen($c) . " bytes)\n";
            }
        }
    }
}

echo "=== Searching for Agreements.tsx ===\n";
searchDir('c:/xampp/htdocs/livrcart/demoark', 'export default function Agreements');
searchDir('C:/Users/Shaik Ansar/.gemini/antigravity-ide/brain', 'export default function Agreements');

echo "=== Searching for QuoteTab.tsx ===\n";
searchDir('c:/xampp/htdocs/livrcart/demoark', 'const QuoteTab');
searchDir('C:/Users/Shaik Ansar/.gemini/antigravity-ide/brain', 'const QuoteTab');
