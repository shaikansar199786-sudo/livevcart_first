const fs = require('fs');
let content = fs.readFileSync('c:/xampp/htdocs/livrcart/demoark/frontend/src/pages/Agreements.tsx', 'utf8');

// 1. Add states
content = content.replace(
  "  /* ── Share Email Modal State ── */\n  const [shareModalAgreement, setShareModalAgreement] = useState<any | null>(null);",
  "  /* ── Share Email Modal State ── */\n  const [isShareModalOpen, setIsShareModalOpen] = useState(false);\n  const [shareModalAgreement, setShareModalAgreement] = useState<any | null>(null);\n  const [showCreateModal, setShowCreateModal] = useState(false);\n  const [createInputId, setCreateInputId] = useState('');\n  const [createFoundData, setCreateFoundData] = useState<any>(null);\n  const [createError, setCreateError] = useState('');"
);

// 2. Remove lead and project population
const fetchReplaceStart = "      // Transform projects added by Sales into automatic agreement records";
const fetchReplaceEnd = "      setAgreements([...savedAgreements, ...projectAgreements, ...leadAgreements]);\n    } catch (err) {";

const startIndex = content.indexOf(fetchReplaceStart);
const endIndex = content.indexOf(fetchReplaceEnd);
if (startIndex !== -1 && endIndex !== -1) {
  content = content.slice(0, startIndex) + "      setAgreements(savedAgreements);\n    } catch (err) {" + content.slice(endIndex + fetchReplaceEnd.length);
} else {
  console.log("Could not find fetch replacement part");
}

// 3. Update create button
content = content.replace(
  "onClick={() => { resetForm(); setIsListView(false); }}",
  "onClick={() => setShowCreateModal(true)}"
);

// 4. Add modal at the end
const modalContent = `
      {/* CREATE NEW AGREEMENT MODAL */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
            <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '90%', maxWidth: '500px', padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', marginBottom: '20px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a', fontWeight: 800 }}>Create New Agreement</h3>
                    <button onClick={() => { setShowCreateModal(false); setCreateInputId(''); setCreateFoundData(null); setCreateError(''); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                        <X size={20} />
                    </button>
                </div>
                
                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>Project ID / Client ID (e.g. PR-101)</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <input 
                            type="text"
                            placeholder="Enter ID..."
                            value={createInputId}
                            onChange={(e) => setCreateInputId(e.target.value)}
                            style={{ flex: 1, padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', outline: 'none' }}
                        />
                        <button 
                            onClick={() => {
                                setCreateError('');
                                const cleanId = createInputId.replace(/^PR-/i, '').replace(/^LEAD-/i, '').replace(/^PRJ-/i, '');
                                let found = null;
                                
                                // Fetch leads
                                fetch(\`\${API_BASE_URL}/leads\`).then(r => r.json()).then(res => {
                                    const leads = res.data || [];
                                    const l = leads.find((x: any) => String(x.lead_id) === cleanId || x.project_id === createInputId);
                                    if (l) {
                                        found = {
                                            id: \`lead_\${l.lead_id}\`,
                                            isFromLead: true,
                                            lead_id: l.lead_id,
                                            ref_id: \`PR_LEAD_\${l.lead_id}\`,
                                            client_name: l.client_name,
                                            address: l.client_address || l.location || 'Visakhapatnam',
                                            contract_value: parseFloat(l.estimated_budget || 0) > 0 ? parseFloat(l.estimated_budget).toLocaleString() : '0',
                                            contract_value_words: 'Zero Rupees',
                                            date: l.created_at ? l.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
                                            place: 'Visakhapatnam',
                                            client_phone: l.contact_number,
                                            client_email: l.email
                                        };
                                        setCreateFoundData(found);
                                        return;
                                    }
                                    
                                    fetch(\`\${API_BASE_URL}/projects\`).then(r => r.json()).then(resP => {
                                        const projects = resP.data || [];
                                        const p = projects.find((x: any) => String(x.project_id) === cleanId || x.project_code === createInputId);
                                        if (p) {
                                            found = {
                                                id: \`proj_\${p.project_id}\`,
                                                isFromProject: true,
                                                project_id: p.project_id,
                                                ref_id: p.project_code || \`PR_\${p.project_id}\`,
                                                client_name: p.client_name || p.project_name || 'Client',
                                                address: p.site_address || 'Visakhapatnam',
                                                contract_value: parseFloat(p.total_budget || 0).toLocaleString(),
                                                contract_value_words: 'Zero Rupees',
                                                date: p.start_date || (p.created_at ? p.created_at.split('T')[0] : new Date().toISOString().split('T')[0]),
                                                place: 'Visakhapatnam',
                                                client_phone: p.client_phone,
                                                client_email: p.client_email
                                            };
                                            setCreateFoundData(found);
                                        } else {
                                            setCreateError('No lead or project found with that ID.');
                                            setCreateFoundData(null);
                                        }
                                    });
                                });
                            }}
                            style={{ padding: '0 16px', backgroundColor: '#334155', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                        >Search</button>
                    </div>
                    {createError && <p style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '8px', marginBottom: 0 }}>{createError}</p>}
                </div>

                {createFoundData && (
                    <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
                        <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#64748b' }}><strong>Client Name:</strong> {createFoundData.client_name}</p>
                        <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#64748b' }}><strong>Location:</strong> {createFoundData.address}</p>
                        <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#64748b' }}><strong>Estimated Value:</strong> ₹{createFoundData.contract_value}</p>
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button onClick={() => { setShowCreateModal(false); setCreateFoundData(null); }} style={{ padding: '10px 16px', backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                    <button 
                        disabled={!createFoundData}
                        onClick={() => {
                            setShowCreateModal(false);
                            resetForm();
                            setClientName(createFoundData.client_name || '');
                            setRefId(createFoundData.ref_id || '');
                            setAddress(createFoundData.address || 'Visakhapatnam');
                            
                            const amt = String(createFoundData.contract_value || '0').replace(/,/g, '');
                            setFeeAmount(amt);
                            
                            setIsListView(false);
                            setCreateFoundData(null);
                            setCreateInputId('');
                        }} 
                        style={{ padding: '10px 16px', backgroundColor: '#ea580c', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: createFoundData ? 'pointer' : 'not-allowed', opacity: createFoundData ? 1 : 0.5 }}
                    >
                        Proceed to Editor
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
`;
content = content.replace("    </div>\n  );\n};\n", modalContent);
fs.writeFileSync('c:/xampp/htdocs/livrcart/demoark/frontend/update_agreements.js', content, 'utf8');
