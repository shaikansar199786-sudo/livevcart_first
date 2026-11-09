// src/pages/PrintMomView.tsx
// Dedicated unauthenticated print page for Puppeteer PDF generation of MOM.
// Emits a #print-ready sentinel when rendering is complete.

import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Calendar } from 'lucide-react';
import liveLogo from '../assets/1.png';
import { API_BASE_URL } from '../config';

interface StageNote {
    category: string;
    startDate: string;
    endDate: string;
    note: string;
    source: string;
    deleted?: boolean;
    isDeleted?: boolean;
}

interface ProjectData {
    project_id: string | number;
    project_code: string;
    project_name: string;
    client_name: string;
    client_phone: string;
    client_address: string;
    client_email?: string;
    site_address?: string;
    start_date: string;
    expected_end_date: string;
    project_stage?: string;
    project_head_name?: string;
}

interface QuoteData {
    quote_id?: number;
    version?: number;
    created_at?: string;
}

export const PrintMomView: React.FC = () => {
    const { projectId } = useParams<{ projectId: string }>();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token') || '';
    const apiBase = searchParams.get('api') || API_BASE_URL || 'http://localhost/livrcart/demoark/api';

    const [project, setProject] = useState<ProjectData | null>(null);
    const [latestQuote, setLatestQuote] = useState<QuoteData | null>(null);
    const [stageNotes, setStageNotes] = useState<StageNote[]>([]);
    const [error, setError] = useState<string>('');
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const origBodyBg = document.body.style.backgroundColor;
        const origDocBg = document.documentElement.style.backgroundColor;
        document.body.style.backgroundColor = '#ffffff';
        document.body.style.background = '#ffffff';
        document.documentElement.style.backgroundColor = '#ffffff';
        document.documentElement.style.background = '#ffffff';

        return () => {
            document.body.style.backgroundColor = origBodyBg;
            document.body.style.background = origBodyBg;
            document.documentElement.style.backgroundColor = origDocBg;
            document.documentElement.style.background = origDocBg;
        };
    }, []);

    useEffect(() => {
        if (!projectId) {
            setError('Missing projectId parameter');
            return;
        }

        const loadData = async () => {
            try {
                // If token is provided, validate and load secure data
                if (token) {
                    const res = await axios.post(`${apiBase}/pdf/validate-mom-token`, {
                        project_id: parseInt(projectId, 10),
                        token
                    });
                    if (res.data?.success && res.data?.project) {
                        setProject(res.data.project);
                        setLatestQuote(res.data.latest_quote);
                        setStageNotes(res.data.stage_notes || []);
                        setTimeout(() => setReady(true), 400);
                        return;
                    }
                }

                // Fallback / local authenticated dev load
                const [projRes, quoteRes, notesRes] = await Promise.all([
                    axios.get(`${apiBase}/projects/${projectId}`),
                    axios.get(`${apiBase}/quotes/latest?project_id=${projectId}&is_used=false`).catch(() => null),
                    axios.get(`${apiBase}/controllers/timeline/stage-notes.php?project_id=${projectId}`)
                ]);

                if (projRes.data?.success && projRes.data?.data) {
                    setProject(projRes.data.data);
                } else if (projRes.data) {
                    setProject(projRes.data);
                }

                if (quoteRes && quoteRes.data?.success && quoteRes.data?.data) {
                    setLatestQuote(quoteRes.data.data);
                }

                if (notesRes.data?.success && notesRes.data?.data) {
                    setStageNotes(notesRes.data.data);
                } else if (notesRes.data && Array.isArray(notesRes.data)) {
                    setStageNotes(notesRes.data);
                } else if (notesRes.data && Array.isArray(notesRes.data.data)) {
                    setStageNotes(notesRes.data.data);
                }

                setTimeout(() => setReady(true), 400);
            } catch (err: any) {
                console.error('PrintMomView loading error:', err);
                setError(err.response?.data?.message || err.message || 'Failed to load MOM data');
                setTimeout(() => setReady(true), 400);
            }
        };

        loadData();
    }, [projectId, token, apiBase]);

    const autoPrint = searchParams.get('autoPrint') === 'true';

    useEffect(() => {
        if (ready && autoPrint && project) {
            const timer = setTimeout(() => {
                window.print();
            }, 600);
            return () => clearTimeout(timer);
        }
    }, [ready, autoPrint, project]);

    if (error) {
        return (
            <div style={{ padding: '40px', fontFamily: 'Inter, sans-serif', color: '#ef4444' }}>
                <h2>MOM PDF Generation Error</h2>
                <p>{error}</p>
            </div>
        );
    }

    if (!project) {
        return (
            <div style={{ padding: '40px', fontFamily: 'Inter, sans-serif', color: '#64748b' }}>
                <p>Loading project details...</p>
            </div>
        );
    }

    // Filter by source type if passed in URL query params (designer vs pm vs all)
    const filterType = (searchParams.get('type') || searchParams.get('source') || searchParams.get('filter') || '').toLowerCase();

    // Filter out deleted notes, active notes, and respect filterType
    const activeStageNotes = stageNotes.filter(n => {
        if (n.deleted || n.isDeleted) return false;
        if (n.category.startsWith('timeline_active_note_')) return false;
        if (filterType === 'designer' && n.source && n.source !== 'designer') return false;
        if ((filterType === 'pm' || filterType === 'project_manager') && n.source && n.source !== 'pm') return false;
        return true;
    });

    const activeDesignerNoteObj = stageNotes.find(n => n.category === 'timeline_active_note_designer');
    const activePmNoteObj = stageNotes.find(n => n.category === 'timeline_active_note_pm');
    const designerActiveNote = (filterType === 'pm' || filterType === 'project_manager') ? '' : (activeDesignerNoteObj?.note || '');
    const pmActiveNote = filterType === 'designer' ? '' : (activePmNoteObj?.note || '');

    const versionNum = latestQuote?.version || 1;
    const clientName = project.client_name || 'Valued Client';
    const formattedProjId = project.project_id ? `DC-${project.project_id}` : 'DC-1';

    const quoteDateRaw = latestQuote?.created_at || project.start_date || new Date().toISOString();
    const savedDate = new Date(quoteDateRaw).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

    return (
        <div style={{ backgroundColor: '#ffffff', width: '100%', margin: 0, padding: 0, fontFamily: 'Inter, system-ui, sans-serif' }}>
            <style>{`
                @page { size: A4; margin: 0 !important; }
                html, body, #root {
                    background-color: #ffffff !important;
                    background: #ffffff !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    width: 100% !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                @media print {
                    .no-print {
                        display: none !important;
                    }
                }
                .mom-page {
                    width: 210mm;
                    min-height: 297mm;
                    margin: 0 auto;
                    box-sizing: border-box;
                    background-color: #ffffff;
                    position: relative;
                    page-break-after: always;
                    break-after: page;
                    overflow: hidden;
                }
                .mom-content-note { font-size: 18px; line-height: 1.6; color: #374151; }
                .mom-content-note p { margin: 0 0 8px 0; }
                .mom-content-note ul, .mom-content-note ol { margin: 0 0 10px 0; padding-left: 22px; }
                .mom-content-note li { margin-bottom: 4px; }
                .mom-content-note a { color: #ea580c; text-decoration: underline; }
            `}</style>

            {/* Top Toolbar (Hidden on Print) */}
            <div className="no-print" style={{
                position: 'sticky', top: 0, zIndex: 9999,
                backgroundColor: '#0c1527', color: '#ffffff',
                padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                boxShadow: '0 4px 14px rgba(0,0,0,0.15)', borderBottom: '2px solid #ea580c'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fca412' }}>📋 Livincart MOM Print &amp; PDF</span>
                    <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>• Tip: In the browser print dialog, choose Destination: <strong>"Save as PDF"</strong> to download a PDF file.</span>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => window.print()} style={{
                        backgroundColor: '#ea580c', color: '#ffffff', border: 'none',
                        padding: '8px 18px', borderRadius: '8px', fontWeight: 800, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem'
                    }}>
                        🖨️ Print / Save as PDF
                    </button>
                    <button onClick={() => window.close()} style={{
                        backgroundColor: '#334155', color: '#ffffff', border: 'none',
                        padding: '8px 14px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem'
                    }}>
                        ✕ Close
                    </button>
                </div>
            </div>

            {/* ── PAGE 1: COVER PAGE ── */}
            <div className="mom-page" style={{ padding: '12mm 0mm' }}>
                {/* Top Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3px solid #ea580c', paddingBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <img src={liveLogo} alt="Logo" style={{ height: '56px', objectFit: 'contain' }} />
                        <div>
                            <div style={{ fontSize: '16pt', fontWeight: 900, color: '#000000', marginBottom: '2px' }}>Livincart Private Limited</div>
                            <div style={{ fontSize: '9pt', color: '#64748b', fontWeight: 500 }}>Official Quotation &amp; Estimation Workspace</div>
                        </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '11pt', fontWeight: 900, color: '#000000', marginBottom: '4px' }}>LIVINCART AND SERVICES PRIVATE LIMITED</div>
                        <div style={{ fontSize: '8.5pt', color: '#475569', fontWeight: 600, marginTop: '3px' }}>
                            <span style={{ marginRight: '10px' }}>Visakhapatnam, Andhra Pradesh – 530020</span>
                            <span>+91 7702312351</span>
                        </div>
                        <div style={{ fontSize: '8.5pt', color: '#475569', fontWeight: 600, marginTop: '2px' }}>
                            <span style={{ marginRight: '10px' }}>contact@livincart.com</span>
                            <span>www.livincart.com</span>
                        </div>
                    </div>
                </div>

                {/* Center Hero — 30px title font size */}
                <div style={{ textAlign: 'center', paddingTop: '45mm', paddingBottom: '20mm', width: '100%' }}>
                    <img src={liveLogo} alt="Logo Center" style={{ height: '90px', objectFit: 'contain', display: 'block', margin: '0 auto 22px auto' }} />
                    <div style={{ fontSize: '17px', fontWeight: 900, color: '#111827', letterSpacing: '0.8px', marginBottom: '8px', textTransform: 'uppercase' }}>
                        LIVINCART AND SERVICES PRIVATE LIMITED
                    </div>
                    <div style={{ width: '130px', height: '3px', backgroundColor: '#ea580c', margin: '12px auto 32px auto' }} />

                    <div style={{ fontSize: '28px', fontWeight: 900, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.8px', lineHeight: 1.25 }}>
                        MINUTES OF MEETING &amp;
                    </div>
                    <div style={{ fontSize: '30px', fontWeight: 900, color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.8px', marginTop: '8px', lineHeight: 1.25 }}>
                        PROJECT STAGE NOTES (MOM)
                    </div>
                    <div style={{ width: '170px', height: '3px', backgroundColor: '#ea580c', margin: '18px auto 42px auto' }} />

                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '32px', borderRadius: '12px', padding: '18px 42px', backgroundColor: '#fff7ed' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Project ID</div>
                            <div style={{ fontSize: '16px', fontWeight: 900, color: '#111827', whiteSpace: 'nowrap' }}>{project.project_code || formattedProjId}</div>
                        </div>
                        <div style={{ width: '1.5px', height: '36px', backgroundColor: '#fbd5aa' }} />
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Date</div>
                            <div style={{ fontSize: '16px', fontWeight: 900, color: '#111827', whiteSpace: 'nowrap' }}>{savedDate}</div>
                        </div>
                    </div>
                </div>

                {/* Bottom Contact Footer — Increased Font Size (12pt / 16px) */}
                <div style={{ position: 'absolute', bottom: '1mm', left: '10mm', right: '10mm', overflow: 'hidden', borderRadius: '10px' }}>
                    <div style={{ backgroundColor: '#ea580c', padding: '14px 26px', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11.5pt', fontWeight: 700 }}>
                        <span>📍 Visakhapatnam, Andhra Pradesh 530020</span>
                        <span style={{ opacity: 0.6 }}>|</span>
                        <span>📞 +91 7702312351</span>
                        <span style={{ opacity: 0.6 }}>|</span>
                        <span>✉️ contact@livincart.com</span>
                    </div>
                    <div style={{ backgroundColor: '#fff7ed', padding: '12px 26px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11.5pt', fontWeight: 800, color: '#111827' }}>
                        <span>🌐 www.livincart.com</span>
                        <span>👤 Client: {clientName}</span>
                    </div>
                </div>
            </div>

            {/* ── PAGE 2+: STAGE NOTES PAGE (8mm margins for wide zoom-out view) ── */}
            <div className="mom-page" style={{ padding: '12mm 0mm 16mm 0mm' }}>
                {/* Mini header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #ea580c', paddingBottom: '12px', marginBottom: '22px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <img src={liveLogo} alt="Logo" style={{ height: '40px', objectFit: 'contain' }} />
                        <div style={{ fontSize: '13pt', fontWeight: 900, color: '#111827' }}>Livincart Private Limited</div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '10pt', color: '#6b7280', fontWeight: 600, lineHeight: 1.5 }}>
                        <div>{project.project_name}</div>
                        <div>Client: {clientName}</div>
                    </div>
                </div>

                {/* Section heading: 26px bold */}
                <div style={{ marginBottom: '20px' }}>
                    <div style={{ fontSize: '26px', fontWeight: 800, color: '#111827', letterSpacing: '0.4px', textTransform: 'uppercase' }}>MOM STAGES</div>
                    <div style={{ width: '44px', height: '4px', backgroundColor: '#ea580c', marginTop: '6px' }} />
                </div>

                {/* Project brief — background fill, NO BORDER */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: '32px', rowGap: '14px', marginBottom: '24px', padding: '18px 24px', backgroundColor: '#fff7ed', borderRadius: '10px' }}>
                    {([
                        ['PROJECT NAME', project.project_name],
                        ['CLIENT NAME', clientName],
                        ['PROJECT CODE', project.project_code || formattedProjId],
                        ['MOM DATE', new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })],
                    ] as [string, string][]).map(([label, val]) => (
                        <div key={label}>
                            <div style={{ fontSize: '12px', color: '#ea580c', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '3px' }}>{label}</div>
                            <div style={{ fontSize: '16px', fontWeight: 800, color: '#111827' }}>{val}</div>
                        </div>
                    ))}
                </div>

                {/* ── STAGES TABLE (Exact Same Table Format as Stage Notes / MOM) ── */}
                <div style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    border: '1.5px solid #cbd5e1',
                    overflow: 'hidden',
                    marginBottom: '24px'
                }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#fff8f0', borderBottom: '2px solid #fed7aa' }}>
                                <th style={{ padding: '14px 18px', fontSize: '14px', fontWeight: 800, color: '#0f172a', width: '140px', borderBottom: '2px solid #fed7aa' }}>Stage</th>
                                <th style={{ padding: '14px 18px', fontSize: '14px', fontWeight: 800, color: '#0f172a', width: '155px', borderBottom: '2px solid #fed7aa' }}>Start Date</th>
                                <th style={{ padding: '14px 18px', fontSize: '14px', fontWeight: 800, color: '#0f172a', width: '155px', borderBottom: '2px solid #fed7aa' }}>End Date</th>
                                <th style={{ padding: '14px 18px', fontSize: '14px', fontWeight: 800, color: '#0f172a', borderBottom: '2px solid #fed7aa' }}>Description</th>
                            </tr>
                        </thead>
                        <tbody>
                            {activeStageNotes.length > 0 ? (
                                activeStageNotes.map((stage, idx) => {
                                    const cat = (stage.category || '').toLowerCase().trim();
                                    let badge = { bg: '#eff6ff', text: '#2563eb' };
                                    if (cat.includes('3d') || cat.includes('approval') || cat.includes('concept')) {
                                        badge = { bg: '#fef3c7', text: '#d97706' };
                                    } else if (cat.includes('qc') || cat.includes('check') || cat.includes('verify')) {
                                        badge = { bg: '#f3e8ff', text: '#9333ea' };
                                    } else if (cat.includes('mask') || cat.includes('lost') || cat.includes('critical')) {
                                        badge = { bg: '#fee2e2', text: '#dc2626' };
                                    } else if (cat.includes('handover') || cat.includes('complete') || cat.includes('install')) {
                                        badge = { bg: '#dcfce7', text: '#15803d' };
                                    } else if (cat.includes('production') || cat.includes('dispatch') || cat.includes('r2p')) {
                                        badge = { bg: '#ffedd5', text: '#ea580c' };
                                    }

                                    const sDateFormatted = stage.startDate ? new Date(stage.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
                                    const eDateFormatted = stage.endDate ? new Date(stage.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

                                    return (
                                        <tr
                                            key={stage.category + idx}
                                            style={{
                                                borderBottom: '1px solid #cbd5e1',
                                                backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fcfcfd',
                                                pageBreakInside: 'avoid'
                                            }}
                                        >
                                            <td style={{ padding: '12px 18px', verticalAlign: 'middle', whiteSpace: 'nowrap', borderBottom: '1px solid #cbd5e1' }}>
                                                <span style={{
                                                    display: 'inline-block',
                                                    padding: '5px 16px',
                                                    borderRadius: '20px',
                                                    fontSize: '13px',
                                                    fontWeight: 700,
                                                    backgroundColor: badge.bg,
                                                    color: badge.text,
                                                    textAlign: 'center',
                                                    minWidth: '54px'
                                                }}>
                                                    {stage.category}
                                                </span>
                                            </td>
                                            <td style={{ padding: '12px 18px', verticalAlign: 'middle', whiteSpace: 'nowrap', fontSize: '14px', color: '#475569', fontWeight: 600, borderBottom: '1px solid #cbd5e1' }}>
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                                    <Calendar size={15} color="#ea580c" />
                                                    {sDateFormatted}
                                                </span>
                                            </td>
                                            <td style={{ padding: '12px 18px', verticalAlign: 'middle', whiteSpace: 'nowrap', fontSize: '14px', color: '#475569', fontWeight: 600, borderBottom: '1px solid #cbd5e1' }}>
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                                    <Calendar size={15} color="#ea580c" />
                                                    {eDateFormatted}
                                                </span>
                                            </td>
                                            <td style={{ padding: '12px 18px', verticalAlign: 'middle', fontSize: '14px', color: '#334155', lineHeight: 1.55, borderBottom: '1px solid #cbd5e1' }}>
                                                {stage.note ? (
                                                    <div
                                                        className="mom-content-note"
                                                        dangerouslySetInnerHTML={{ __html: stage.note.replace(/\n/g, '<br/>') }}
                                                    />
                                                ) : (
                                                    <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>—</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={4} style={{ padding: '36px 0', color: '#9ca3af', fontSize: '15px', textAlign: 'center', borderBottom: '1px solid #cbd5e1' }}>
                                        No stage notes available for this project.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Active Notes: 26px heading — BRAND LOGO BACKGROUND COLOR ONLY (#fff7ed) */}
                {(designerActiveNote || pmActiveNote) && (
                    <div style={{ marginTop: '30px', padding: '22px 24px', backgroundColor: '#fff7ed', borderRadius: '10px' }}>
                        <div style={{ fontSize: '26px', fontWeight: 800, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '18px' }}>Timeline Active Notes</div>
                        {designerActiveNote && (
                            <div style={{ marginBottom: pmActiveNote ? '16px' : '0', backgroundColor: '#ffffff', padding: '16px 20px', borderRadius: '8px' }}>
                                <div style={{ fontSize: '15px', fontWeight: 800, color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Designer Active Note</div>
                                <div className="mom-content-note" dangerouslySetInnerHTML={{ __html: designerActiveNote }} />
                            </div>
                        )}
                        {pmActiveNote && (
                            <div style={{ backgroundColor: '#ffffff', padding: '16px 20px', borderRadius: '8px' }}>
                                <div style={{ fontSize: '15px', fontWeight: 800, color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Project Manager Active Note</div>
                                <div className="mom-content-note" dangerouslySetInnerHTML={{ __html: pmActiveNote }} />
                            </div>
                        )}
                    </div>
                )}

                {/* Page footer */}
                <div style={{ position: 'absolute', bottom: '9mm', left: '10mm', right: '10mm', borderTop: '1.5px solid #e5e7eb', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', fontSize: '9pt', color: '#9ca3af' }}>
                    <span>Livincart Private Limited &copy; {new Date().getFullYear()}</span>
                    <span>Confidential — For Client Use Only</span>
                    <span>Page 2</span>
                </div>
            </div>

            {ready && <div id="print-ready" style={{ display: 'none' }} />}
        </div>
    );
};
export default PrintMomView;



