const fs = require('fs');
let file = fs.readFileSync('c:/xampp/htdocs/livrcart/demoark/frontend/src/pages/D1Leads.tsx', 'utf8');

const smDisplay = \
                          {/* Site Manager Info */}
                          {lead.site_manager_assigned_to && (
                            <div style={{ fontSize: '0.8rem', color: '#4b5563', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', borderTop: '1px dashed #e5e7eb', paddingTop: '6px' }}>
                              <span style={{ fontWeight: 600 }}>Site Manager / MMT:</span>
                              <span style={{ color: '#111827' }}>
                                {team.find(t => String(t.user_id) === String(lead.site_manager_assigned_to))?.name || \ID #\\}
                              </span>
                              {lead.site_manager_booking_time && (
                                <span style={{ color: '#ea580c', fontWeight: 600, marginLeft: '4px' }}>
                                  ({new Date(lead.site_manager_booking_time).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })})
                                </span>
                              )}
                            </div>
                          )}
\;

file = file.replace('</div>\n    \n                          <div style={{ fontSize: \'0.8rem\'', '</div>\n    \n' + smDisplay + '                          <div style={{ fontSize: \'0.8rem\'');

fs.writeFileSync('c:/xampp/htdocs/livrcart/demoark/frontend/src/pages/D1Leads.tsx', file);
