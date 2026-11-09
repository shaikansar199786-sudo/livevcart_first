const fs = require('fs');
let s = fs.readFileSync('demoark/frontend/src/pages/D1Leads.tsx', 'utf8').replace(/\r\n/g, '\n');

const target = `            if (openMmts === 'true') {
              setModalTab('mmts');
              setSiteModalRoleTab('mmt');
            } else if (openQc === 'true') {
              const is20Paid = isTwentyPercentPaidForLead(matched) || isTenPercentPaidForLead(matched);
              if (is20Paid) {
                setModalTab('qc');
              } else {
                setModalTab('files');
                setCollectLead(matched);
                const bVal = parseFloat(matched.total_budget as any) || parseFloat(matched.estimated_budget as any) || 0;
                const req10 = Math.round(bVal * 0.10) || 5000;
                setCollectAmount(String(req10));
                setShowCollectModal(true);
              }
            }`;

const repl = `            if (openMmts === 'true') {
              setModalTab('mmts');
              setSiteModalRoleTab('mmt');
            } else if (openQc === 'true') {
              setModalTab('qc');
              setSiteModalRoleTab('site_inspector');
            }`;

if (s.includes(target)) {
  s = s.replace(target, repl);
  fs.writeFileSync('demoark/frontend/src/pages/D1Leads.tsx', s.replace(/\n/g, '\r\n'), 'utf8');
  console.log('Replaced D1Leads fetch openQc handler');
} else {
  console.log('Target not found in D1Leads');
}

