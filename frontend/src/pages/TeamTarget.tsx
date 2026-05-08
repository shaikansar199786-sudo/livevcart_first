import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { Plus, Trash2, Save, Printer, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

interface TargetRow {
    id?: number;
    project_id: string;
    project_name: string;
    team_member: string;
    task1: string;
    task2: string;
    status: 'pending' | 'in_progress' | 'done';
}

interface Project {
    project_id: string | number;
    project_name: string;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

const TEAM_MEMBERS = ['Ankita', 'Jayanth', 'Anusha', 'Rama', 'Anjani', 'Other'];

const TASK_OPTIONS = [
    'Detailed Drawings', '3D', 'Site plan', 'Elevation', 'MP Detailed Dwg',
    'Landscape', 'Site 3D', 'Layout plan', 'BOQ', 'Presentation', 'Working Drawings', 'Other'
];

const emptyRow = (): TargetRow => ({
    project_id: '',
    project_name: '',
    team_member: '',
    task1: '',
    task2: '',
    status: 'pending',
});

export const TeamTarget: React.FC = () => {
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [monthIdx, setMonthIdx] = useState(now.getMonth());
    const [rows, setRows] = useState<TargetRow[]>([emptyRow()]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const month = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
    const monthLabel = `${MONTHS[monthIdx].toUpperCase()} ${year}`;

    // Fetch projects for dropdown
    useEffect(() => {
        axios.get(`${API_BASE_URL}/projects`)
            .then(res => {
                if (res.data?.data) setProjects(res.data.data);
            })
            .catch(() => {});
    }, []);

    // Fetch targets for selected month
    const fetchTargets = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/team-targets?month=${month}`);
            if (res.data?.data?.length > 0) {
                setRows(res.data.data);
            } else {
                setRows([emptyRow()]);
            }
        } catch {
            setRows([emptyRow()]);
        } finally {
            setLoading(false);
        }
    }, [month]);

    useEffect(() => { fetchTargets(); }, [fetchTargets]);

    const updateRow = (idx: number, field: keyof TargetRow, value: string) => {
        setRows(prev => {
            const next = [...prev];
            next[idx] = { ...next[idx], [field]: value };
            // If project_id selected from dropdown, auto-fill project_name
            if (field === 'project_id' && value) {
                const proj = projects.find(p => String(p.project_id) === value);
                if (proj) next[idx].project_name = proj.project_name;
            }
            return next;
        });
        setSaved(false);
    };

    const addRow = () => setRows(prev => [...prev, emptyRow()]);

    const deleteRow = (idx: number) => {
        setRows(prev => prev.length === 1 ? [emptyRow()] : prev.filter((_, i) => i !== idx));
        setSaved(false);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const cleanRows = rows.filter(r => r.project_name || r.team_member || r.task1);
            await axios.post(`${API_BASE_URL}/team-targets`, { month, rows: cleanRows });
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch {
            alert('Failed to save. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const prevMonth = () => {
        if (monthIdx === 0) { setMonthIdx(11); setYear(y => y - 1); }
        else setMonthIdx(m => m - 1);
    };

    const nextMonth = () => {
        if (monthIdx === 11) { setMonthIdx(0); setYear(y => y + 1); }
        else setMonthIdx(m => m + 1);
    };

    const handlePrint = () => window.print();

    return (
        <div style={{ fontFamily: 'Inter, sans-serif' }}>
            {/* Page Header */}
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>Team Monthly Target</h2>
                    <p style={{ color: '#64748b', marginTop: '4px', fontSize: '0.9rem' }}>Assign and track monthly deliverables for the studio team.</p>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button onClick={handleSave} disabled={saving}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', backgroundColor: saved ? '#16a34a' : '#253b50', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem', transition: 'all 0.2s' }}>
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save'}
                    </button>
                    <button onClick={handlePrint}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', backgroundColor: '#0f766e', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem' }}>
                        <Printer size={16} /> Print
                    </button>
                </div>
            </div>

            {/* Month Navigator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', justifyContent: 'center' }}>
                <button onClick={prevMonth} className="no-print"
                    style={{ padding: '8px', backgroundColor: '#f1f5f9', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <ChevronLeft size={20} color="#253b50" />
                </button>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <select value={monthIdx} onChange={e => setMonthIdx(Number(e.target.value))}
                        className="no-print"
                        style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 700, color: '#253b50', fontSize: '1rem', background: 'white' }}>
                        {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                    </select>
                    <select value={year} onChange={e => setYear(Number(e.target.value))}
                        className="no-print"
                        style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: 700, color: '#253b50', fontSize: '1rem', background: 'white' }}>
                        {Array.from({ length: 6 }, (_, i) => now.getFullYear() - 2 + i).map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                    <span className="print-only" style={{ fontSize: '1.4rem', fontWeight: 900, color: '#253b50' }}>{monthLabel}</span>
                </div>
                <button onClick={nextMonth} className="no-print"
                    style={{ padding: '8px', backgroundColor: '#f1f5f9', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <ChevronRight size={20} color="#253b50" />
                </button>
            </div>

            {/* Print Title */}
            <div className="print-only" style={{ textAlign: 'center', marginBottom: '20px', fontWeight: 900, fontSize: '18px', color: '#253b50', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '2px solid #253b50', paddingBottom: '10px' }}>
                TARGET FOR STUDIO FOR {MONTHS[monthIdx].toUpperCase()} {year}
            </div>

            {/* Table */}
            <div style={{ borderRadius: '14px', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
                        <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 12px' }} />
                        <p>Loading targets...</p>
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#253b50', color: 'white' }}>
                                <th style={{ padding: '14px 10px', textAlign: 'center', width: '50px', fontSize: '0.8rem', fontWeight: 700 }}>S.NO</th>
                                <th style={{ padding: '14px 12px', textAlign: 'left', fontSize: '0.8rem', fontWeight: 700 }}>PROJECT NAME</th>
                                <th style={{ padding: '14px 12px', textAlign: 'left', width: '140px', fontSize: '0.8rem', fontWeight: 700 }}>TEAM MEMBER</th>
                                <th style={{ padding: '14px 12px', textAlign: 'left', width: '200px', fontSize: '0.8rem', fontWeight: 700 }}>TASK 1</th>
                                <th style={{ padding: '14px 12px', textAlign: 'left', width: '200px', fontSize: '0.8rem', fontWeight: 700 }}>TASK 2</th>
                                <th style={{ padding: '14px 10px', textAlign: 'center', width: '90px', fontSize: '0.8rem', fontWeight: 700 }}>STATUS</th>
                                <th className="no-print" style={{ padding: '14px 10px', textAlign: 'center', width: '50px', fontSize: '0.8rem', fontWeight: 700 }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, idx) => (
                        <tr key={idx} style={{
                                backgroundColor: row.status === 'done' ? '#dcfce7' : row.status === 'in_progress' ? '#fef9c3' : '#fee2e2',
                                borderBottom: '1px solid #e9eef3',
                                borderLeft: `4px solid ${row.status === 'done' ? '#16a34a' : row.status === 'in_progress' ? '#d97706' : '#dc2626'}`,
                                transition: 'background 0.2s'
                            }}>

                                    <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: '#64748b', fontSize: '0.85rem' }}>
                                        {idx + 1}
                                    </td>
                                    {/* Project Name - editable text + dropdown */}
                                    <td style={{ padding: '6px 8px' }}>
                                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                            <select
                                                className="no-print"
                                                value={row.project_id}
                                                onChange={e => updateRow(idx, 'project_id', e.target.value)}
                                                style={{ padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.8rem', color: '#334155', background: 'white', maxWidth: '160px' }}>
                                                <option value="">-- Select --</option>
                                                {projects.map(p => (
                                                    <option key={p.project_id} value={String(p.project_id)}>{p.project_name}</option>
                                                ))}
                                            </select>
                                            <input
                                                value={row.project_name}
                                                onChange={e => { updateRow(idx, 'project_id', ''); updateRow(idx, 'project_name', e.target.value); }}
                                                placeholder="Or type name..."
                                                style={{ flex: 1, padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.82rem', color: '#1e293b', outline: 'none', minWidth: 0 }}
                                            />
                                            <span className="print-only" style={{ fontSize: '0.85rem', color: '#1e293b', fontWeight: 500 }}>{row.project_name}</span>
                                        </div>
                                    </td>
                                    {/* Team Member */}
                                    <td style={{ padding: '6px 8px' }}>
                                        <select
                                            className="no-print"
                                            value={row.team_member}
                                            onChange={e => updateRow(idx, 'team_member', e.target.value)}
                                            style={{ width: '100%', padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.82rem', color: '#334155', background: 'white' }}>
                                            <option value="">-- Select --</option>
                                            {TEAM_MEMBERS.map(m => <option key={m} value={m}>{m}</option>)}
                                        </select>
                                        <span className="print-only" style={{ fontSize: '0.85rem' }}>{row.team_member}</span>
                                    </td>
                                    {/* Task 1 */}
                                    <td style={{ padding: '6px 8px' }}>
                                        <select
                                            className="no-print"
                                            value={row.task1}
                                            onChange={e => updateRow(idx, 'task1', e.target.value)}
                                            style={{ width: '100%', padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.82rem', color: '#334155', background: 'white' }}>
                                            <option value="">-- Select --</option>
                                            {TASK_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                        <span className="print-only" style={{ fontSize: '0.85rem' }}>{row.task1}</span>
                                    </td>
                                    {/* Task 2 */}
                                    <td style={{ padding: '6px 8px' }}>
                                        <select
                                            className="no-print"
                                            value={row.task2}
                                            onChange={e => updateRow(idx, 'task2', e.target.value)}
                                            style={{ width: '100%', padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.82rem', color: '#334155', background: 'white' }}>
                                            <option value="">-- None --</option>
                                            {TASK_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                        <span className="print-only" style={{ fontSize: '0.85rem' }}>{row.task2}</span>
                                    </td>
                                    {/* Status Color Markers */}
                                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
                                            {/* Red = Pending */}
                                            <button title="Pending" onClick={() => updateRow(idx, 'status', 'pending')}
                                                style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#ef4444', border: row.status === 'pending' ? '3px solid #1e293b' : '2px solid transparent', cursor: 'pointer', transition: 'all 0.15s', boxShadow: row.status === 'pending' ? '0 0 0 2px #ef444455' : 'none' }} />
                                            {/* Yellow = In Progress */}
                                            <button title="In Progress" onClick={() => updateRow(idx, 'status', 'in_progress')}
                                                style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#f59e0b', border: row.status === 'in_progress' ? '3px solid #1e293b' : '2px solid transparent', cursor: 'pointer', transition: 'all 0.15s', boxShadow: row.status === 'in_progress' ? '0 0 0 2px #f59e0b55' : 'none' }} />
                                            {/* Green = Done */}
                                            <button title="Done" onClick={() => updateRow(idx, 'status', 'done')}
                                                style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#16a34a', border: row.status === 'done' ? '3px solid #1e293b' : '2px solid transparent', cursor: 'pointer', transition: 'all 0.15s', boxShadow: row.status === 'done' ? '0 0 0 2px #16a34a55' : 'none' }} />
                                        </div>
                                        {/* Print label */}
                                        <span className="print-only" style={{ fontSize: '0.75rem', fontWeight: 700, color: row.status === 'done' ? '#16a34a' : row.status === 'in_progress' ? '#f59e0b' : '#ef4444' }}>
                                            {row.status === 'done' ? '✓ Done' : row.status === 'in_progress' ? '⏳ WIP' : '● Pending'}
                                        </span>
                                    </td>
                                    <td className="no-print" style={{ padding: '6px 8px', textAlign: 'center' }}>
                                        <button onClick={() => deleteRow(idx)}
                                            style={{ padding: '5px', backgroundColor: '#fee2e2', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Trash2 size={14} color="#dc2626" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Add Row Button */}
            <div className="no-print" style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-start' }}>
                <button onClick={addRow}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', backgroundColor: '#f1f5f9', border: '1.5px dashed #94a3b8', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, color: '#253b50', fontSize: '0.9rem', transition: 'all 0.2s' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#e0f2fe')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#f1f5f9')}>
                    <Plus size={16} /> Add Row
                </button>
            </div>

            {/* Stats Summary */}
            <div className="no-print" style={{ marginTop: '28px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
                {Array.from(new Set(rows.map(r => r.team_member).filter(Boolean))).map(member => {
                    const count = rows.filter(r => r.team_member === member).length;
                    return (
                        <div key={member} style={{ backgroundColor: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', textAlign: 'center' }}>
                            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#253b50' }}>{count}</div>
                            <div style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600, marginTop: '4px' }}>{member}</div>
                        </div>
                    );
                })}
                <div style={{ backgroundColor: '#253b50', padding: '16px', borderRadius: '12px', textAlign: 'center', color: 'white' }}>
                    <div style={{ fontSize: '1.8rem', fontWeight: 900 }}>{rows.filter(r => r.project_name).length}</div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, marginTop: '4px', opacity: 0.8 }}>Total Projects</div>
                </div>
            </div>
        </div>
    );
};

export default TeamTarget;
