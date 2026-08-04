const fs = require('fs');
let file = fs.readFileSync('c:/xampp/htdocs/livrcart/demoark/frontend/src/pages/D1Leads.tsx', 'utf8');
const startIdx = file.indexOf('<table style={{ width: \'100%\', borderCollapse: \'collapse\', textAlign: \'left\' }}>');
const endIdx = file.indexOf('</table>', startIdx) + 8;
const tableCode = fs.readFileSync('c:/xampp/htdocs/livrcart/demoark/scratch_table_2.txt', 'utf8').trim();
file = file.slice(0, startIdx) + tableCode + file.slice(endIdx);
fs.writeFileSync('c:/xampp/htdocs/livrcart/demoark/frontend/src/pages/D1Leads.tsx', file);
