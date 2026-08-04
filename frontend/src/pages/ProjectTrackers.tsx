import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import {
    Plus,
    Trash2,
    Save,
    Loader2,
    Building2,
    Home,
    Hammer,
    CheckCircle2,
    Clock,
    Circle,
    Edit3,
    Check
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

type TrackerCategory = 'architectural' | 'interior';

interface TrackerRow {
    id?: number;
    project_id: string;
    project_name: string;
    staff_name: string;
    column_data: Record<string, string>;
}

interface Project {
    project_id: string | number;
    project_name: string;
}

const CATEGORIES = [
    { id: 'architectural', label: 'Furniture projects', icon: Building2, color: '#3b82f6' },
    { id: 'interior', label: 'Interior Projects', icon: Home, color: '#8b5cf6' },
];

const DEFAULT_COLUMNS: Record<TrackerCategory, string[]> = {
    architectural: [
        'DD', '3D Approval', '2D', 'QC1',
        'Masking', 'Signoff', 'Final 2D', 'QC2', 'Final Quote', 'R2P'
    ],
    interior: [
        '1. Initial Works', '2. False Ceiling', '3. Elec. Chipping', '4. Plumbing/Sanitary',
        '5. Painting', '6. Carpentry', '7. Granite & Tiles', '8. Glass/Mirror',
        '9. Sanitary & Bath', '10. Elec. Fitments', '11. Furniture', '12. Deep Cleaning',
        '13. Curtains', '14. Handover'
    ]
};

const STAFF_NAMES = ['Ankita', 'Jayanth', 'Anusha', 'Rama', 'Anjani', 'Aman', 'Santoshini', 'Swarna', 'Other'];

const emptyRow = (category: TrackerCategory, currentColumns: Record<TrackerCategory, string[]>): TrackerRow => {
    const data: Record<string, string> = {};
    currentColumns[category].forEach(col => { data[col] = 'pending'; });
    return {
        project_id: '',
        project_name: '',
        staff_name: '',
        column_data: data,
    };
};

export const ProjectTrackers: React.FC = () => {
    const { user } = useAuth();
    const [category, setCategory] = useState<TrackerCategory>('interior');
    const [customColumns, setCustomColumns] = useState<Record<TrackerCategory, string[]>>(() => {
        const saved = localStorage.getItem('tracker_columns');
        return saved ? JSON.parse(saved) : DEFAULT_COLUMNS;
    });
    const customColumnsRef = React.useRef(customColumns);
    const [isEditingColumns, setIsEditingColumns] = useState(false);
    const [draggedColIdx, setDraggedColIdx] = useState<number | null>(null);

    const [rows, setRows] = useState<TrackerRow[]>([emptyRow('interior', customColumns)]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    // Save columns to local storage when they change
    useEffect(() => {
        localStorage.setItem('tracker_columns', JSON.stringify(customColumns));
        customColumnsRef.current = customColumns;
    }, [customColumns]);

    useEffect(() => {
        axios.get(`${API_BASE_URL}/projects`).then(res => {
            if (res.data?.data) setProjects(res.data.data);
        }).catch(() => { });
    }, []);

    const fetchTrackers = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/project-trackers?category=${category}`);
            if (res.data?.data?.length > 0) {
                setRows(res.data.data);
            } else {
                const cols = customColumnsRef.current;
                setRows([emptyRow(category, cols), emptyRow(category, cols), emptyRow(category, cols)]);
            }
        } catch {
            setRows([emptyRow(category, customColumnsRef.current)]);
        } finally {
            setLoading(false);
        }
    }, [category]);

    useEffect(() => { fetchTrackers(); }, [fetchTrackers]);

    const updateRow = (idx: number, field: keyof TrackerRow, value: any) => {
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

    const cycleStatus = (rowIdx: number, colName: string) => {
        const statuses = ['pending', 'in_progress', 'done'];
        const current = rows[rowIdx].column_data[colName] || 'pending';
        const next = statuses[(statuses.indexOf(current) + 1) % statuses.length];

        setRows(prev => {
            const nextRows = [...prev];
            nextRows[rowIdx].column_data = { ...nextRows[rowIdx].column_data, [colName]: next };
            return nextRows;
        });
        setSaved(false);
    };

    const handleDropColumn = (dropIdx: number) => {
        if (draggedColIdx === null || draggedColIdx === dropIdx) return;
        setCustomColumns(prev => {
            const next = { ...prev };
            const cols = [...next[category]];
            const [movedCol] = cols.splice(draggedColIdx, 1);
            cols.splice(dropIdx, 0, movedCol);
            next[category] = cols;
            return next;
        });
        setDraggedColIdx(null);
    };

    const addRow = () => setRows(prev => [...prev, emptyRow(category, customColumns)]);

    const deleteRow = (idx: number) => {
        setRows(prev => prev.length === 1 ? [emptyRow(category, customColumns)] : prev.filter((_, i) => i !== idx));
        setSaved(false);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const cleanRows = rows.filter(r => r.project_name || r.staff_name);
            await axios.post(`${API_BASE_URL}/project-trackers`, { category, rows: cleanRows });
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch {
            alert('Failed to save.');
        } finally {
            setSaving(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'done': return '#22c55e'; // Vibrant Green
            case 'in_progress': return '#eab308'; // Vibrant Yellow
            default: return 'transparent';
        }
    };

    return (
        <div style={{
            backgroundColor: '#f8fafc',
            minHeight: '100vh',
            padding: '20px',
            fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
        }}>
            {/* Premium Tab Bar */}
            <div className="no-print" style={{
                display: 'flex',
                gap: '8px',
                backgroundColor: 'white',
                padding: '8px',
                borderRadius: '16px',
                boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
                marginBottom: '32px',
                width: 'fit-content',
                margin: '0 auto 32px'
            }}>
                {CATEGORIES.map(cat => (
                    <button
                        key={cat.id}
                        onClick={() => setCategory(cat.id as TrackerCategory)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '12px 24px',
                            backgroundColor: category === cat.id ? 'black' : 'transparent',
                            color: category === cat.id ? 'white' : '#64748b',
                            border: 'none',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            fontWeight: 700,
                            fontSize: '0.9rem',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            transform: category === cat.id ? 'scale(1.05)' : 'scale(1)'
                        }}
                    >
                        <cat.icon size={18} />
                        {cat.label}
                    </button>
                ))}
            </div>

            {/* Action Buttons */}
            <div className="no-print" style={{
                position: 'fixed',
                bottom: '30px',
                right: '30px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                zIndex: 1000
            }}>
                <button onClick={handleSave} disabled={saving}
                    style={{
                        width: '56px', height: '56px', borderRadius: '28px', backgroundColor: saved ? '#22c55e' : 'black', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(37,59,80,0.3)', transition: 'all 0.3s'
                    }}>
                    {saving ? <Loader2 size={24} className="animate-spin" /> : <Save size={24} />}
                </button>
                <button onClick={addRow}
                    style={{
                        width: '56px', height: '56px', borderRadius: '28px', backgroundColor: '#3b82f6', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(59,130,246,0.3)'
                    }}>
                    <Plus size={24} />
                </button>
            </div>

            {/* Tracker Content */}
            <div className="tracker-card" style={{
                backgroundColor: 'white',
                borderRadius: '24px',
                padding: '40px',
                boxShadow: '0 10px 40px rgba(0,0,0,0.04)',
                border: '1px solid #eef2f6'
            }}>
                {/* Image-Style Header */}
                <div style={{
                    textAlign: 'center',
                    marginBottom: '30px',
                    backgroundColor: '#dae8fc',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #b4c7e7'
                }}>
                    <h1 style={{
                        margin: 0,
                        fontSize: '1.2rem',
                        fontWeight: 900,
                        color: 'black',
                        letterSpacing: '2px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px'
                    }}>
                        {CATEGORIES.find(c => c.id === category)?.label}
                        {(user?.role === 'admin' || user?.role === 'accountant') && (
                            <button
                                onClick={() => setIsEditingColumns(!isEditingColumns)}
                                style={{
                                    background: isEditingColumns ? '#22c55e' : 'transparent',
                                    color: isEditingColumns ? 'white' : '#64748b',
                                    border: isEditingColumns ? 'none' : '1px solid #cbd5e1',
                                    borderRadius: '6px',
                                    padding: '6px 12px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    fontSize: '0.75rem',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {isEditingColumns ? <Check size={14} /> : <Edit3 size={14} />}
                                {isEditingColumns ? 'Done Editing' : 'Edit Columns'}
                            </button>
                        )}
                    </h1>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '100px' }}><Loader2 size={48} className="animate-spin" color="black" /></div>
                ) : (
                    <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '70vh' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 'max-content' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f1f5f9' }}>
                                    <th style={{ width: '45px', padding: '12px', border: '1px solid #cbd5e1', fontSize: '0.65rem', fontWeight: 800, color: '#475569' }}>Sno</th>
                                    <th style={{ width: '220px', padding: '12px', border: '1px solid #cbd5e1', fontSize: '0.65rem', fontWeight: 800, color: '#475569', textAlign: 'left' }}>Project Name</th>
                                    <th style={{ width: '130px', padding: '12px', border: '1px solid #cbd5e1', fontSize: '0.65rem', fontWeight: 800, color: '#475569', textAlign: 'left' }}>
                                        {category === 'interior' ? 'Staff' : 'Project Architect'}
                                    </th>
                                    {customColumns[category].map((col, cIdx) => (
                                        <th 
                                            key={`col-${cIdx}`}
                                            draggable={isEditingColumns}
                                            onDragStart={() => isEditingColumns && setDraggedColIdx(cIdx)}
                                            onDragOver={e => isEditingColumns && e.preventDefault()}
                                            onDrop={() => isEditingColumns && handleDropColumn(cIdx)}
                                            style={{
                                                padding: '8px 4px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '0.65rem',
                                                fontWeight: 800,
                                                color: '#475569',
                                                writingMode: (category as string) === 'site' && !isEditingColumns ? 'vertical-lr' : 'horizontal-tb',
                                                transform: (category as string) === 'site' && !isEditingColumns ? 'rotate(180deg)' : 'none',
                                                textAlign: 'center',
                                                verticalAlign: (category as string) === 'site' && !isEditingColumns ? 'bottom' : 'middle',
                                                height: (category as string) === 'site' && !isEditingColumns ? '120px' : 'auto',
                                                minWidth: (category as string) === 'site' && !isEditingColumns ? 'auto' : '80px',
                                                cursor: isEditingColumns ? 'grab' : 'default',
                                                opacity: draggedColIdx === cIdx ? 0.5 : 1,
                                            }}
                                        >
                                            {isEditingColumns ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', height: '100%', alignItems: 'center' }}>
                                                    <textarea
                                                        value={col}
                                                        onChange={e => {
                                                            const newVal = e.target.value;
                                                            setCustomColumns(prev => {
                                                                const next = { ...prev };
                                                                next[category] = [...next[category]];
                                                                // Copy old data to new col name if it exists to preserve status
                                                                const oldName = next[category][cIdx];
                                                                setRows(r => r.map(row => {
                                                                    if (row.column_data[oldName]) {
                                                                        const newData = { ...row.column_data };
                                                                        newData[newVal] = newData[oldName];
                                                                        delete newData[oldName];
                                                                        return { ...row, column_data: newData };
                                                                    }
                                                                    return row;
                                                                }));
                                                                
                                                                next[category][cIdx] = newVal;
                                                                return next;
                                                            });
                                                        }}
                                                        style={{
                                                            width: '100%',
                                                            height: '100%',
                                                            minHeight: '80px',
                                                            padding: '4px',
                                                            fontSize: '0.65rem',
                                                            border: '1px solid #3b82f6',
                                                            borderRadius: '4px',
                                                            textAlign: 'center',
                                                            writingMode: 'horizontal-tb',
                                                            resize: 'none',
                                                            overflow: 'auto'
                                                        }}
                                                    />
                                                    <button
                                                        onClick={() => {
                                                            if (!window.confirm(`Are you sure you want to delete the column "${col}"?`)) return;
                                                            setCustomColumns(prev => {
                                                                const next = { ...prev };
                                                                next[category] = [...next[category]];
                                                                next[category].splice(cIdx, 1);
                                                                return next;
                                                            });
                                                        }}
                                                        style={{
                                                            background: '#ef4444',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: '4px',
                                                            padding: '4px 8px',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            width: '100%'
                                                        }}
                                                        title="Delete this column"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            ) : (
                                                col
                                            )}
                                        </th>
                                    ))}
                                    {isEditingColumns && (
                                        <th style={{ padding: '8px', border: '1px solid #cbd5e1', textAlign: 'center', minWidth: '100px' }}>
                                            <button
                                                onClick={() => {
                                                    const newColName = 'New Column ' + (customColumns[category].length + 1);
                                                    setCustomColumns(prev => {
                                                        const next = { ...prev };
                                                        next[category] = [...next[category], newColName];
                                                        return next;
                                                    });
                                                    setRows(prev => prev.map(row => ({
                                                        ...row,
                                                        column_data: {
                                                            ...row.column_data,
                                                            [newColName]: 'pending'
                                                        }
                                                    })));
                                                }}
                                                style={{
                                                    background: '#3b82f6',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    padding: '6px 12px',
                                                    cursor: 'pointer',
                                                    fontSize: '0.7rem',
                                                    fontWeight: 'bold',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '4px',
                                                    margin: '0 auto'
                                                }}
                                            >
                                                <Plus size={14} /> Add Column
                                            </button>
                                        </th>
                                    )}
                                    <th className="no-print" style={{ width: '40px', border: '1px solid #cbd5e1' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, idx) => (
                                    <tr key={idx}>
                                        <td style={{ padding: '8px', border: '1px solid #cbd5e1', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>{idx + 1}</td>
                                        <td style={{ padding: '0', border: '1px solid #cbd5e1' }}>
                                            <input
                                                value={row.project_name}
                                                onChange={e => updateRow(idx, 'project_name', e.target.value)}
                                                style={{ width: '100%', border: 'none', padding: '10px 12px', fontSize: '0.75rem', fontWeight: 600, color: '#1e293b', outline: 'none', background: 'transparent' }}
                                                placeholder="Enter Project Name..."
                                            />
                                            <span className="print-only" style={{ fontSize: '0.75rem', fontWeight: 600, padding: '10px 12px', display: 'none' }}>{row.project_name}</span>
                                        </td>
                                        <td style={{ padding: '0', border: '1px solid #cbd5e1' }}>
                                            <input
                                                value={row.staff_name}
                                                onChange={e => updateRow(idx, 'staff_name', e.target.value)}
                                                style={{ width: '100%', border: 'none', padding: '10px 12px', fontSize: '0.75rem', color: '#475569', outline: 'none', background: 'transparent' }}
                                                placeholder="Enter Name..."
                                            />
                                            <span className="print-only" style={{ fontSize: '0.75rem', padding: '10px 12px', display: 'none' }}>{row.staff_name}</span>
                                        </td>
                                        {customColumns[category].map((col, cIdx) => {
                                            const status = row.column_data?.[col] || 'pending';
                                            return (
                                                <td
                                                    key={`row-${idx}-col-${cIdx}`}
                                                    onClick={() => !isEditingColumns && cycleStatus(idx, col)}
                                                    style={{
                                                        padding: 0,
                                                        border: '1px solid #cbd5e1',
                                                        backgroundColor: getStatusColor(status),
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s',
                                                        position: 'relative'
                                                    }}
                                                >
                                                    <div className="status-overlay" style={{
                                                        height: '32px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '0.55rem',
                                                        color: status === 'pending' ? 'transparent' : 'white',
                                                        fontWeight: 800
                                                    }}>
                                                        {status === 'done' ? '✓' : status === 'in_progress' ? '...' : ''}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                        <td className="no-print" style={{ padding: '4px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
                                            <button onClick={() => deleteRow(idx)} style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.color = '#ef4444'} onMouseLeave={e => e.currentTarget.style.color = '#cbd5e1'}>
                                                <Trash2 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Legend */}
                <div className="no-print" style={{ marginTop: '30px', display: 'flex', gap: '20px', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                        <div style={{ width: '16px', height: '16px', backgroundColor: '#22c55e', borderRadius: '4px' }} /> Done
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                        <div style={{ width: '16px', height: '16px', backgroundColor: '#eab308', borderRadius: '4px' }} /> In Progress
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                        <div style={{ width: '16px', height: '16px', border: '1px solid #cbd5e1', borderRadius: '4px' }} /> Pending
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    .no-print { display: none !important; }
                    body { background-color: white !important; padding: 0 !important; }
                    .tracker-card { border: none !important; box-shadow: none !important; padding: 0 !important; }
                    table { -webkit-print-color-adjust: exact; }
                }
                .tracker-card:hover .status-overlay {
                    opacity: 1;
                }
            `}} />
        </div>
    );
};

export default ProjectTrackers;
