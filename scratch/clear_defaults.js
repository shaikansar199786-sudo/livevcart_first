const fs = require('fs');
let file = fs.readFileSync('c:/xampp/htdocs/livrcart/demoark/frontend/src/components/QuoteTab.tsx', 'utf8');

const regex = /const getDefaultSections = \(\): QuoteSection\[\] => \[[\s\S]*?\];/;
const replacement = 'const getDefaultSections = (): QuoteSection[] => [];';

file = file.replace(regex, replacement);
fs.writeFileSync('c:/xampp/htdocs/livrcart/demoark/frontend/src/components/QuoteTab.tsx', file);
