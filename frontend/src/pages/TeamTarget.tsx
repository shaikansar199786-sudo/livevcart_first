import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { Plus, Trash2, Save, ChevronLeft, ChevronRight, Loader2, Columns } from 'lucide-react';

interface DynamicTask {
    value: string;
    status: 'pending' | 'in_progress' | 'done';
}

interface TargetRow {
    id?: number;
    project_id: string;
    project_name: string;
    team_member: string;
    dynamic_tasks: DynamicTask[];
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
    dynamic_tasks: [],
});

export const TeamTarget: React.FC = () => {
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [monthIdx, setMonthIdx] = useState(now.getMonth());
    const [rows, setRows] = useState<TargetRow[]>([emptyRow()]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [numTasks, setNumTasks] = useState(2);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const month = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
    const monthLabel = `${MONTHS[monthIdx].toUpperCase()} ${year}`;

    useEffect(() => {
        axios.get(`${API_BASE_URL}/projects`)
            .then(res => {
                if (res.data?.data) setProjects(res.data.data);
            })
            .catch(() => { });

        axios.get(`${API_BASE_URL}/users`)
            .then(res => {
                if (res.data?.data) setUsers(res.data.data);
            })
            .catch(() => { });
    }, []);

    const fetchTargets = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/team-targets?month=${month}`);
            if (res.data?.data?.length > 0) {
                let maxT = 2;
                const mappedRows = res.data.data.map((row: any) => {
                    let dt = row.dynamic_tasks || [];
                    // fallback to legacy task1 and task2 if dynamic_tasks empty
                    if (dt.length === 0 && (row.task1 || row.task2)) {
                        dt = [
                            { value: row.task1 || '', status: row.task1_status || 'pending' },
                            { value: row.task2 || '', status: row.task2_status || 'pending' }
                        ];
                    }
                    if (dt.length > maxT) maxT = dt.length;
                    return {
                        ...row,
                        dynamic_tasks: dt
                    };
                });
                setNumTasks(maxT);
                setRows(mappedRows);
            } else {
                setNumTasks(2);
                setRows([emptyRow()]);
            }
        } catch {
            setNumTasks(2);
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
            if (field === 'project_id' && value) {
                const proj = projects.find(p => String(p.project_id) === value);
                if (proj) next[idx].project_name = proj.project_name;
            }
            return next;
        });
        setSaved(false);
    };

    const updateDynamicTask = (rowIdx: number, taskIdx: number, field: keyof DynamicTask, value: string) => {
        setRows(prev => {
            const next = [...prev];
            const dt = [...(next[rowIdx].dynamic_tasks || [])];
            while (dt.length <= taskIdx) dt.push({ value: '', status: 'pending' });
            dt[taskIdx] = { ...dt[taskIdx], [field]: value };
            next[rowIdx] = { ...next[rowIdx], dynamic_tasks: dt };
            return next;
        });
        setSaved(false);
    };

    const deleteTaskColumn = (taskIdx: number) => {
        if (!window.confirm(`Are you sure you want to delete Task ${taskIdx + 1} for all rows?`)) return;
        setRows(prev => prev.map(row => {
            const dt = [...(row.dynamic_tasks || [])];
            if (dt.length > taskIdx) {
                dt.splice(taskIdx, 1);
            }
            return { ...row, dynamic_tasks: dt };
        }));
        setNumTasks(n => Math.max(1, n - 1));
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
            const cleanRows = rows.filter(r => r.project_name || r.team_member || r.dynamic_tasks?.some(t => t.value));
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

    return (
        <div style={{ fontFamily: 'Inter, sans-serif' }}>
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>Team Monthly Target</h2>
                    <p style={{ color: '#64748b', marginTop: '4px', fontSize: '0.9rem' }}>Assign and track monthly deliverables for the studio team.</p>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button onClick={() => setNumTasks(n => n + 1)} className="no-print"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', backgroundColor: '#e2e8f0', color: '#1e293b', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', transition: 'all 0.2s' }}>
                        <Columns size={16} /> Add Task Column
                    </button>
                    <button onClick={handleSave} disabled={saving}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', backgroundColor: saved ? '#16a34a' : '#fca311', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem', transition: 'all 0.2s' }}>
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save'}
                    </button>
                </div>
            </div>

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

            <div className="print-only" style={{ textAlign: 'center', marginBottom: '20px', fontWeight: 900, fontSize: '18px', color: '#253b50', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '2px solid #253b50', paddingBottom: '10px' }}>
                TARGET FOR STUDIO FOR {MONTHS[monthIdx].toUpperCase()} {year}
            </div>

            <div style={{ borderRadius: '14px', overflowX: 'auto', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
                        <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 12px' }} />
                        <p>Loading targets...</p>
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1000px' }}>
                        <thead>
                            <tr style={{ backgroundColor: 'black', color: 'white' }}>
                                <th style={{ padding: '14px 10px', textAlign: 'center', width: '50px', fontSize: '0.8rem', fontWeight: 700 }}>S.NO</th>
                                <th style={{ padding: '14px 12px', textAlign: 'left', minWidth: '180px', fontSize: '0.8rem', fontWeight: 700 }}>PROJECT NAME</th>
                                <th style={{ padding: '14px 12px', textAlign: 'left', minWidth: '120px', fontSize: '0.8rem', fontWeight: 700 }}>TEAM MEMBER</th>
                                {Array.from({ length: numTasks }).map((_, i) => (
                                    <th key={i} style={{ padding: '14px 12px', textAlign: 'left', minWidth: '220px', fontSize: '0.8rem', fontWeight: 700 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span>TASK {i + 1}</span>
                                            {numTasks > 1 && (
                                                <button onClick={() => deleteTaskColumn(i)} className="no-print" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#334155'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'} title={`Delete Task ${i + 1}`}>
                                                    <Trash2 size={14} color="#ef4444" />
                                                </button>
                                            )}
                                        </div>
                                    </th>
                                ))}
                                <th className="no-print" style={{ padding: '14px 10px', textAlign: 'center', width: '50px', fontSize: '0.8rem', fontWeight: 700 }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid #e9eef3', transition: 'background 0.2s' }}>
                                    <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: '#64748b', fontSize: '0.85rem' }}>{idx + 1}</td>
                                    <td style={{ padding: '6px 8px' }}>
                                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                            <select className="no-print" value={row.project_id} onChange={e => updateRow(idx, 'project_id', e.target.value)} style={{ padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.8rem', color: '#334155', background: 'white', maxWidth: '160px' }}>
                                                <option value="">-- Select --</option>
                                                {projects.map(p => <option key={p.project_id} value={String(p.project_id)}>{p.project_name}</option>)}
                                            </select>
                                            <input value={row.project_name} onChange={e => { updateRow(idx, 'project_id', ''); updateRow(idx, 'project_name', e.target.value); }} placeholder="Or type name..." style={{ flex: 1, padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.82rem', color: '#1e293b', outline: 'none', minWidth: 0 }} />
                                            <span className="print-only" style={{ fontSize: '0.85rem', color: '#1e293b', fontWeight: 500 }}>{row.project_name}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '6px 8px' }}>
                                        <select className="no-print" value={row.team_member} onChange={e => updateRow(idx, 'team_member', e.target.value)} style={{ width: '100%', padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.82rem', color: '#334155', background: 'white' }}>
                                            <option value="">-- Select --</option>
                                            {users.map(u => <option key={u.user_id} value={u.name}>{u.name} ({u.role})</option>)}
                                        </select>
                                        <span className="print-only" style={{ fontSize: '0.85rem' }}>{row.team_member}</span>
                                    </td>
                                    
                                    {Array.from({ length: numTasks }).map((_, taskIdx) => {
                                        const task = row.dynamic_tasks?.[taskIdx] || { value: '', status: 'pending' };
                                        return (
                                            <td key={taskIdx} style={{ padding: '6px 8px', backgroundColor: task.status === 'done' ? '#dcfce7' : task.status === 'in_progress' ? '#fef9c3' : '#fee2e2', borderLeft: `3px solid ${task.status === 'done' ? '#16a34a' : task.status === 'in_progress' ? '#d97706' : '#dc2626'}` }}>
                                                <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                                        <button title="Pending" onClick={() => updateDynamicTask(idx, taskIdx, 'status', 'pending')} style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#ef4444', border: task.status === 'pending' ? '2px solid #1e293b' : '2px solid transparent', cursor: 'pointer', transition: 'all 0.15s' }} />
                                                        <button title="In Progress" onClick={() => updateDynamicTask(idx, taskIdx, 'status', 'in_progress')} style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#f59e0b', border: task.status === 'in_progress' ? '2px solid #1e293b' : '2px solid transparent', cursor: 'pointer', transition: 'all 0.15s' }} />
                                                        <button title="Done" onClick={() => updateDynamicTask(idx, taskIdx, 'status', 'done')} style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#16a34a', border: task.status === 'done' ? '2px solid #1e293b' : '2px solid transparent', cursor: 'pointer', transition: 'all 0.15s' }} />
                                                    </div>
                                                    <select value={task.value} onChange={e => updateDynamicTask(idx, taskIdx, 'value', e.target.value)} style={{ width: '100%', padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.82rem', color: '#334155', background: 'white' }}>
                                                        <option value="">-- None --</option>
                                                        {TASK_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                                                    </select>
                                                </div>
                                                <span className="print-only" style={{ fontSize: '0.85rem' }}>{task.value}</span>
                                            </td>
                                        );
                                    })}

                                    <td className="no-print" style={{ padding: '6px 8px', textAlign: 'center' }}>
                                        <button onClick={() => deleteRow(idx)} style={{ padding: '5px', backgroundColor: '#fee2e2', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Trash2 size={14} color="#dc2626" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <div className="no-print" style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-start' }}>
                <button onClick={addRow}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', backgroundColor: '#f1f5f9', border: '1.5px dashed #94a3b8', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, color: '#253b50', fontSize: '0.9rem', transition: 'all 0.2s' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#e0f2fe')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#f1f5f9')}>
                    <Plus size={16} /> Add Row
                </button>
            </div>

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
                <div style={{ backgroundColor: 'black', padding: '16px', borderRadius: '12px', textAlign: 'center', color: 'white' }}>
                    <div style={{ fontSize: '1.8rem', fontWeight: 900 }}>{rows.filter(r => r.project_name).length}</div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, marginTop: '4px', opacity: 0.8 }}>Total Projects</div>
                </div>
            </div>
        </div>
    );
};

export default TeamTarget;
