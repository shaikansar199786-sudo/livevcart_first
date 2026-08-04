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
    CheckCircle2,
    Search
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

type TrackerCategory = 'architectural' | 'interior' | 'site';

interface StageSubTask {
    id: string;
    name: string;
    category: string;
    status: 'done' | 'completed' | 'ongoing' | 'in_progress' | 'pending_approval' | 'planned' | 'pending' | 'overdue';
    color: string;
}

interface TrackerRow {
    id?: number;
    project_id: string;
    project_code?: string;
    project_name: string;
    staff_name: string;
    column_data: Record<string, string>;
    stage_tasks?: Record<string, StageSubTask[]>;
}

interface Project {
    project_id: string | number;
    project_code?: string;
    project_name: string;
    project_type?: string;
    project_head_name?: string;
    client_name?: string;
    status?: string;
}

const SITE_COLUMNS: string[] = [
    '1. Initial Works',
    '2. False Ceiling',
    '3. Elec. Chipping',
    '4. Plumbing/Sanitary',
    '5. Painting',
    '6. Carpentry',
    '7. Granite & Tiles',
    '8. Glass/Mirror',
    '9. Sanitary & Bath',
    '10. Elec. Fitments',
    '11. Furniture',
    '12. Deep Cleaning',
    '13. Curtains',
    '14. Handover'
];

const CATEGORIES = [
    { id: 'interior', label: 'Interior Projects', icon: Home, color: '#8b5cf6' },
    { id: 'architectural', label: 'Furniture projects', icon: Building2, color: '#3b82f6' },
    { id: 'site', label: 'Execution Projects', icon: CheckCircle2, color: '#10b981' }
];

const INTERIOR_COLUMNS: string[] = [
    '1. Initial Works',
    '2. False Ceiling',
    '3. Elec. Chipping',
    '4. Plumbing/Sanitary',
    '5. Painting',
    '6. Carpentry',
    '7. Granite & Tiles',
    '8. Glass/Mirror',
    '9. Sanitary & Bath',
    '10. Elec. Fitments',
    '11. Furniture',
    '12. Deep Cleaning',
    '13. Curtains',
    '14. Handover'
];

const ARCHITECTURAL_COLUMNS: string[] = [
    'DD',
    '3D Approval',
    '2D',
    'QC1',
    'Masking',
    'Signoff',
    'Final 2D',
    'QC2',
    'Final Quote',
    'R2P'
];

const getStatusColor = (status: string) => {
    switch (status) {
        case 'done':
        case 'completed': return '#22c55e'; // Green ✓
        case 'ongoing':
        case 'in_progress': return '#f97316'; // Orange ...
        case 'pending_approval': return '#eab308'; // Yellow ...
        case 'planned': return '#94a3b8'; // Grey
        case 'overdue': return '#ef4444'; // Red
        default: return 'transparent';
    }
};

const emptyRow = (cols: string[]): TrackerRow => {
    const data: Record<string, string> = {};
    cols.forEach(col => { data[col] = 'pending'; });
    return {
        project_id: '',
        project_code: '',
        project_name: '',
        staff_name: '',
        column_data: data,
    };
};

export const LivincartProjectTimelines: React.FC = () => {
    const { user } = useAuth();
    const [category, setCategory] = useState<TrackerCategory>('architectural');
    const [rows, setRows] = useState<TrackerRow[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(true);
    const [saving, setSaving] = useState<boolean>(false);
    const [saved, setSaved] = useState<boolean>(false);
    const [approvalModal, setApprovalModal] = useState<{ open: boolean; mode: 'warning' | 'admin_action'; rowIdx?: number; colName?: string; projectName?: string }>({ open: false, mode: 'warning' });

    const currentColumns = category === 'architectural' ? ARCHITECTURAL_COLUMNS : (category === 'site' ? SITE_COLUMNS : INTERIOR_COLUMNS);

    // Fetch system projects and saved stage tracker state strictly filtered per category
    const fetchTrackerRows = useCallback(async () => {
        setLoading(true);
        setRows([]); // Clear existing rows to prevent bleed
        try {
            // 1. Fetch system projects
            const projRes = await axios.get(`${API_BASE_URL}/projects`);
            const fetchedProjects: Project[] = projRes.data?.data || [];
            setProjects(fetchedProjects);            // 2. Fetch saved tracker status data for ALL categories to make sure we don't lose data on tab changes
            const [resArch, resInt, resSite] = await Promise.all([
                axios.get(`${API_BASE_URL}/project-trackers?category=architectural`),
                axios.get(`${API_BASE_URL}/project-trackers?category=interior`),
                axios.get(`${API_BASE_URL}/project-trackers?category=site`)
            ]);
            const savedTrackerRows: TrackerRow[] = [
                ...(resArch.data?.data || []),
                ...(resInt.data?.data || []),
                ...(resSite.data?.data || [])
            ];
            const cols = category === 'architectural' ? ARCHITECTURAL_COLUMNS : (category === 'site' ? SITE_COLUMNS : INTERIOR_COLUMNS);

            // 3. Fetch project timeline state for all system projects across designer, execution, pm
            const timelineStateMap: Record<string, { tasks: any[], completions: any }> = {};
            const todayStr = new Date().toISOString().split('T')[0];

            // Process requests sequentially instead of 18 concurrent to avoid overwhelming XAMPP
            for (const p of fetchedProjects) {
                try {
                    const resDes = await axios.get(`${API_BASE_URL}/controllers/timeline/state.php?project_id=${p.project_id}&type=designer`);
                    const resExec = await axios.get(`${API_BASE_URL}/controllers/timeline/state.php?project_id=${p.project_id}&type=execution`);
                    const resPM = await axios.get(`${API_BASE_URL}/controllers/timeline/state.php?project_id=${p.project_id}&type=pm`);
                    
                    const pId = String(p.project_id);
                    if (!timelineStateMap[pId]) {
                        timelineStateMap[pId] = { tasks: [], completions: {} };
                    }
                    
                    const allData = [resDes.data, resExec.data, resPM.data];
                    allData.forEach(d => {
                        if (d && d.success) {
                            timelineStateMap[pId].tasks.push(...(d.tasks || []));
                            timelineStateMap[pId].completions = {
                                ...timelineStateMap[pId].completions,
                                ...(d.completions || {})
                            };
                        }
                    });
                } catch (err) {
                    console.error('Failed to fetch timeline state for project', p.project_id, err);
                }
            }

            const mergedRows: TrackerRow[] = [];
            const normalizeCat = (s: string) => String(s || '').toLowerCase().replace(/^[0-9]+\.\s*/, '').replace(/[^a-z0-9]/g, '');

            fetchedProjects.forEach(p => {
                const pId = String(p.project_id);
                const numId = p.project_code && String(p.project_code).includes('-')
                    ? String(p.project_code).split('-').pop()
                    : null;
                    
                const existing = savedTrackerRows.find(r =>
                    (r.project_id && String(r.project_id) === pId) ||
                    (numId && r.project_id && String(r.project_id) === numId) ||
                    (r.project_name && r.project_name.toLowerCase().trim() === p.project_name.toLowerCase().trim())
                );

                const pTimeline = timelineStateMap[pId] || (numId ? timelineStateMap[numId] : undefined);
                
                const data: Record<string, string> = existing ? { ...existing.column_data } : {};
                const stageTasks: Record<string, StageSubTask[]> = {};

                const pType = (p.project_type || '').toLowerCase();
                const isFurniture = pType.includes('furniture') || pType.includes('architectural');
                const rowColumns = isFurniture ? ARCHITECTURAL_COLUMNS : INTERIOR_COLUMNS;

                rowColumns.forEach(c => {
                    const cNorm = normalizeCat(c);
                    stageTasks[c] = [];

                    if (pTimeline && pTimeline.tasks && pTimeline.tasks.length > 0) {
                        const catTasks = pTimeline.tasks.filter(t => {
                            const tNorm = normalizeCat(t.category);
                            return tNorm === cNorm || (tNorm.length > 2 && cNorm.length > 2 && (tNorm.includes(cNorm) || cNorm.includes(tNorm)));
                        });

                        catTasks.forEach(t => {
                            const taskCompletions = pTimeline.completions[String(t.id)] || pTimeline.completions[t.id] || {};
                            const statuses = Object.values(taskCompletions) as string[];

                            let taskStatus: StageSubTask['status'] = 'pending';
                            if (statuses.includes('done') || (t as any).status === 'done' || (t as any).status === 'completed') {
                                taskStatus = 'done';
                            } else if (statuses.includes('pending_approval') || (t as any).status === 'pending_approval') {
                                taskStatus = 'pending_approval';
                            } else if (statuses.includes('ongoing') || statuses.includes('in_progress') || (t as any).status === 'ongoing' || (t as any).status === 'in_progress') {
                                taskStatus = 'ongoing';
                            } else if (statuses.includes('planned') || (t as any).status === 'planned' || t.startDate || t.endDate) {
                                if (t.endDate && t.endDate < todayStr) {
                                    taskStatus = 'overdue';
                                } else {
                                    taskStatus = 'planned';
                                }
                            } else if ((t as any).status) {
                                taskStatus = (t as any).status;
                            }

                            const taskIdStr = String(t.id);
                            const existingSt = stageTasks[c].find(st => st.id === taskIdStr);
                            if (!existingSt) {
                                stageTasks[c].push({
                                    id: taskIdStr,
                                    name: t.name || c,
                                    category: c,
                                    status: taskStatus,
                                    color: getStatusColor(taskStatus)
                                });
                            } else {
                                if (taskStatus === 'done' || (taskStatus === 'ongoing' && existingSt.status !== 'done')) {
                                    existingSt.status = taskStatus;
                                    existingSt.color = getStatusColor(taskStatus);
                                }
                            }
                        });

                        if (stageTasks[c].length > 0) {
                            const isAllDone = stageTasks[c].every(st => st.status === 'done' || st.status === 'completed');
                            const hasSomeDone = stageTasks[c].some(st => st.status === 'done' || st.status === 'completed');
                            
                            if (isAllDone) {
                                data[c] = 'done';
                            } else if (stageTasks[c].some(st => st.status === 'pending_approval')) {
                                data[c] = 'pending_approval';
                            } else if (hasSomeDone || stageTasks[c].some(st => st.status === 'ongoing' || st.status === 'in_progress')) {
                                data[c] = 'ongoing';
                            } else if (stageTasks[c].some(st => st.status === 'planned')) {
                                data[c] = 'planned';
                            } else if (stageTasks[c].some(st => st.status === 'overdue')) {
                                data[c] = 'overdue';
                            }
                        }
                    }

                    if (!data[c]) data[c] = 'pending';
                });

                mergedRows.push({
                    id: existing?.id,
                    project_id: pId,
                    project_code: p.project_code || existing?.project_code || '',
                    project_name: p.project_name,
                    staff_name: existing?.staff_name || p.project_head_name || '',
                    column_data: data,
                    stage_tasks: stageTasks
                });
            });

            // Add saved rows for this category that aren't in system projects
            savedTrackerRows.forEach(sr => {
                const alreadyIncluded = mergedRows.some(mr => mr.project_name.toLowerCase().trim() === sr.project_name.toLowerCase().trim());
                if (!alreadyIncluded && sr.project_name) {
                    const updatedColData = { ...sr.column_data };
                    cols.forEach(c => {
                        if (!updatedColData[c]) updatedColData[c] = 'pending';
                    });
                    mergedRows.push({ ...sr, column_data: updatedColData });
                }
            });

            // If no projects exist for this category, start with 1 clean empty row
            if (mergedRows.length === 0) {
                mergedRows.push(emptyRow(cols));
            }

            setRows(mergedRows);
        } catch (err) {
            console.error('Error loading project timelines', err);
            const cols = category === 'architectural' ? ARCHITECTURAL_COLUMNS : (category === 'site' ? SITE_COLUMNS : INTERIOR_COLUMNS);
            setRows([emptyRow(cols)]);
        } finally {
            setLoading(false);
        }
    }, [category]);

    useEffect(() => { fetchTrackerRows(); }, [fetchTrackerRows]);

    const handleCategoryChange = (newCategory: TrackerCategory) => {
        if (newCategory === category) return;
        setCategory(newCategory);
    };

    const updateRow = (idx: number, field: keyof TrackerRow, value: any) => {
        setRows(prev => {
            const next = [...prev];
            next[idx] = { ...next[idx], [field]: value };

            if (field === 'project_name' && value) {
                const matchedProj = projects.find(p => (p.project_name || '').toLowerCase() === String(value).toLowerCase());
                if (matchedProj) {
                    next[idx].project_id = String(matchedProj.project_id);
                    next[idx].project_code = matchedProj.project_code || '';
                    if (!next[idx].staff_name && matchedProj.project_head_name) {
                        next[idx].staff_name = matchedProj.project_head_name;
                    }
                }
            }
            return next;
        });
        setSaved(false);
    };

    const cycleStatus = (rowIdx: number, colName: string) => {
        const isRealAdmin = ['admin', 'project_head', 'project_manager', 'manager'].includes(String(user?.role || '').toLowerCase());
        const row = rows[rowIdx];
        if (!row) return;
        const projectName = row.project_name || 'Project';

        const subTasks = row.stage_tasks?.[colName] || [];
        const subStatus = subTasks.length > 0
            ? (subTasks.find(st => st.status === 'done' || st.status === 'completed') ||
               subTasks.find(st => st.status === 'pending_approval') ||
               subTasks.find(st => st.status === 'ongoing' || st.status === 'in_progress') ||
               subTasks.find(st => st.status === 'planned') ||
               subTasks.find(st => st.status === 'overdue'))?.status
            : null;

        const current = (subStatus && subStatus !== 'pending') ? subStatus : (row.column_data?.[colName] || 'pending');

        // IF CURRENT STATUS IS PENDING APPROVAL:
        if (current === 'pending_approval') {
            if (!isRealAdmin) {
                // Non-admin clicking on pending approval: Show warning popup! Cannot change color until Admin accepts.
                setApprovalModal({ open: true, mode: 'warning', rowIdx, colName, projectName });
                return;
            } else {
                // Admin clicking on pending approval: Show Admin approval action modal!
                setApprovalModal({ open: true, mode: 'admin_action', rowIdx, colName, projectName });
                return;
            }
        }

        // IF CURRENT IS DONE (GREEN) & USER IS NOT ADMIN:
        if ((current === 'done' || current === 'completed') && !isRealAdmin) {
            setApprovalModal({ open: true, mode: 'warning', rowIdx, colName, projectName });
            return;
        }

        let next = 'pending';
        if (current === 'pending' || current === 'planned') next = 'ongoing';
        else if (current === 'ongoing' || current === 'in_progress') next = 'pending_approval';
        else if (current === 'done' || current === 'completed') next = 'pending';

        setRows(prev => {
            const nextRows = [...prev];
            const updatedColumnData = { ...(nextRows[rowIdx].column_data || {}), [colName]: next };
            const updatedStageTasks = { ...(nextRows[rowIdx].stage_tasks || {}) };

            if (updatedStageTasks[colName] && updatedStageTasks[colName].length > 0) {
                updatedStageTasks[colName] = updatedStageTasks[colName].map(st => ({
                    ...st,
                    status: next as any,
                    color: getStatusColor(next)
                }));
            }

            nextRows[rowIdx] = {
                ...nextRows[rowIdx],
                column_data: updatedColumnData,
                stage_tasks: updatedStageTasks
            };
            return nextRows;
        });
        setSaved(false);

        if (next === 'pending_approval') {
            axios.post(`${API_BASE_URL}/notifications/notify-admin`, {
                title: 'Designer Timeline Task Approval Request',
                message: `Stage '${colName}' in '${projectName}' is waiting for Admin approval.`
            }).catch(e => console.error(e));

            setApprovalModal({ open: true, mode: 'warning', rowIdx, colName, projectName });
        }
    };

    const handleAdminAcceptStage = (rowIdx: number, colName: string) => {
        setRows(prev => {
            const nextRows = [...prev];
            const updatedColumnData = { ...(nextRows[rowIdx].column_data || {}), [colName]: 'done' };
            const updatedStageTasks = { ...(nextRows[rowIdx].stage_tasks || {}) };

            if (updatedStageTasks[colName] && updatedStageTasks[colName].length > 0) {
                updatedStageTasks[colName] = updatedStageTasks[colName].map(st => ({
                    ...st,
                    status: 'done',
                    color: getStatusColor('done')
                }));
            }

            nextRows[rowIdx] = {
                ...nextRows[rowIdx],
                column_data: updatedColumnData,
                stage_tasks: updatedStageTasks
            };
            return nextRows;
        });
        setSaved(false);
        setApprovalModal({ open: false, mode: 'warning' });
    };

    const addRow = () => {
        setRows(prev => [...prev, emptyRow(currentColumns)]);
    };

    const deleteRow = (idx: number) => {
        setRows(prev => prev.length === 1 ? [emptyRow(currentColumns)] : prev.filter((_, i) => i !== idx));
        setSaved(false);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const cleanRows = rows.filter(r => (r.project_name && r.project_name.trim()) || (r.staff_name && r.staff_name.trim()));
            
            const archRows: any[] = [];
            const intRows: any[] = [];
            const siteRows: any[] = [];

            cleanRows.forEach(r => {
                const originalProj = projects.find(p => String(p.project_id) === String(r.project_id));
                const pType = originalProj ? (originalProj.project_type || '').toLowerCase() : '';
                const isFurniture = pType.includes('furniture') || pType.includes('architectural');
                
                const maskingStatus = r.column_data['Masking'] || r.column_data['5. Masking'] || '';
                const hasStartedMasking = maskingStatus === 'ongoing' || maskingStatus === 'done' || maskingStatus === 'completed';

                if (hasStartedMasking) {
                    siteRows.push(r);
                } else if (isFurniture) {
                    archRows.push(r);
                } else {
                    intRows.push(r);
                }
            });

            await Promise.all([
                axios.post(`${API_BASE_URL}/project-trackers`, { category: 'architectural', rows: archRows }),
                axios.post(`${API_BASE_URL}/project-trackers`, { category: 'interior', rows: intRows }),
                axios.post(`${API_BASE_URL}/project-trackers`, { category: 'site', rows: siteRows })
            ]);

            // Automatically sync completed status to projects API if all stages done
            cleanRows.forEach(r => {
                if (r.project_id) {
                    const originalProj = projects.find(p => String(p.project_id) === String(r.project_id));
                    const isFurniture = originalProj && ((originalProj.project_type || '').toLowerCase().includes('furniture') || (originalProj.project_type || '').toLowerCase().includes('architectural'));
                    const cols = isFurniture ? ARCHITECTURAL_COLUMNS : INTERIOR_COLUMNS;
                    const doneCount = cols.filter(c => r.column_data[c] === 'done').length;
                    if (doneCount === cols.length && cols.length > 0) {
                        axios.post(`${API_BASE_URL}/projects/update-status`, {
                            project_id: r.project_id,
                            status: 'completed'
                        }).catch(() => { });
                    }
                }
            });

            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch {
            alert('Failed to save changes.');
        } finally {
            setSaving(false);
        }
    };

    // Removed inner getStatusColor to allow the outer comprehensive one to take effect

    // Calculate Project Completion State
    const calculateProjectStatus = (columnData: Record<string, string>, cols: string[]) => {
        if (cols.length === 0) return { isComplete: false, percent: 0, label: 'Pending', bg: '#f1f5f9', color: '#64748b' };

        const doneCount = cols.filter(c => columnData[c] === 'done').length;
        const inProgressCount = cols.filter(c => columnData[c] === 'in_progress').length;
        const percent = Math.round((doneCount / cols.length) * 100);

        if (doneCount === cols.length) {
            return { isComplete: true, percent: 100, label: '✓ COMPLETED', bg: '#dcfce7', color: '#15803d' };
        }
        if (doneCount > 0 || inProgressCount > 0) {
            return { isComplete: false, percent, label: `${doneCount}/${cols.length} Done (${percent}%)`, bg: '#fef3c7', color: '#b45309' };
        }

        return { isComplete: false, percent: 0, label: 'Pending', bg: '#f1f5f9', color: '#64748b' };
    };

    const displayedRows = rows.filter(r => {
        const q = searchQuery.toLowerCase();
        const matchesSearch = (r.project_name || '').toLowerCase().includes(q) ||
            (r.project_code || '').toLowerCase().includes(q) ||
            (r.staff_name || '').toLowerCase().includes(q);

        if (!matchesSearch) return false;

        const originalProj = projects.find(p => String(p.project_id) === String(r.project_id));
        const pType = originalProj ? (originalProj.project_type || '').toLowerCase() : '';
        const isFurniture = pType.includes('furniture') || pType.includes('architectural');
        const isInterior = pType.includes('interior') || (!isFurniture && pType.length > 0);

        const maskingStatus = r.column_data['Masking'] || r.column_data['5. Masking'] || '';
        const hasStartedMasking = maskingStatus === 'ongoing' || maskingStatus === 'done' || maskingStatus === 'completed';

        if (category === 'site') {
            return hasStartedMasking;
        } else if (category === 'architectural') {
            return isFurniture && !hasStartedMasking;
        } else if (category === 'interior') {
            return isInterior && !hasStartedMasking;
        }
        return true;
    });

    return (
        <div style={{
            backgroundColor: '#f8fafc',
            minHeight: '100vh',
            padding: '20px',
            fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
        }}>
            {/* DEBUG BANNER FOR PROJECT 68 */}
            <div style={{ backgroundColor: 'red', color: 'white', padding: '10px', marginBottom: '20px', fontWeight: 'bold' }}>
                DEBUG INFO: Project 68 DD Column Data = {rows.find(r => String(r.project_id) === '68')?.column_data['DD'] || 'EMPTY'}, 
                3D Column Data = {rows.find(r => String(r.project_id) === '68')?.column_data['3D Approval'] || 'EMPTY'}
            </div>
            {/* Category Switcher & Search */}
            <div className="no-print" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '16px',
                marginBottom: '24px',
                backgroundColor: 'white',
                padding: '12px 20px',
                borderRadius: '16px',
                boxShadow: '0 4px 15px rgba(0,0,0,0.04)',
                border: '1px solid #e2e8f0'
            }}>
                {/* Category Switcher */}
                <div style={{ display: 'flex', gap: '8px' }}>
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => handleCategoryChange(cat.id as TrackerCategory)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '10px 20px',
                                backgroundColor: category === cat.id ? '#253b50' : 'transparent',
                                color: category === cat.id ? 'white' : '#64748b',
                                border: 'none',
                                borderRadius: '10px',
                                cursor: 'pointer',
                                fontWeight: 700,
                                fontSize: '0.88rem',
                                transition: 'all 0.2s'
                            }}
                        >
                            <cat.icon size={16} />
                            {cat.label}
                        </button>
                    ))}
                </div>

                {/* Search Bar */}
                <div style={{ position: 'relative', width: '280px' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search projects..."
                        style={{
                            width: '100%',
                            padding: '9px 12px 9px 36px',
                            borderRadius: '10px',
                            border: '1px solid #cbd5e1',
                            fontSize: '0.85rem',
                            outline: 'none',
                            boxSizing: 'border-box'
                        }}
                    />
                </div>
            </div>

            {/* Floating Action Buttons */}
            <div className="no-print" style={{
                position: 'fixed',
                bottom: '30px',
                right: '30px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                zIndex: 1000
            }}>
                <button onClick={handleSave} disabled={saving} title="Save Changes"
                    style={{
                        width: '56px', height: '56px', borderRadius: '28px', backgroundColor: saved ? '#22c55e' : '#253b50', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(37,59,80,0.3)', transition: 'all 0.3s'
                    }}>
                    {saving ? <Loader2 size={24} className="animate-spin" /> : <Save size={24} />}
                </button>
                <button onClick={addRow} title="Add Project Row"
                    style={{
                        width: '56px', height: '56px', borderRadius: '28px', backgroundColor: '#3b82f6', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(59,130,246,0.3)'
                    }}>
                    <Plus size={24} />
                </button>
            </div>

            {/* TRACKER MATRIX TABLE */}
            <div className="tracker-card" style={{
                backgroundColor: 'white',
                borderRadius: '24px',
                padding: '30px',
                boxShadow: '0 10px 40px rgba(0,0,0,0.04)',
                border: '1px solid #eef2f6'
            }}>
                {/* Banner Header */}
                <div style={{
                    textAlign: 'center',
                    marginBottom: '24px',
                    backgroundColor: '#dae8fc',
                    padding: '12px',
                    borderRadius: '10px',
                    border: '1px solid #b4c7e7'
                }}>
                    <h1 style={{
                        margin: 0,
                        fontSize: '1.2rem',
                        fontWeight: 900,
                        color: '#0f172a',
                        letterSpacing: '1px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px'
                    }}>
                        {CATEGORIES.find(c => c.id === category)?.label}
                    </h1>
                </div>                {loading ? (
                    <div style={{ textAlign: 'center', padding: '100px' }}>
                        <Loader2 size={44} className="animate-spin" color="#253b50" />
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {displayedRows.map((row, idx) => {
                            const originalProj = projects.find(p => String(p.project_id) === String(row.project_id));
                            const isFurniture = originalProj 
                                ? ((originalProj.project_type || '').toLowerCase().includes('furniture') || (originalProj.project_type || '').toLowerCase().includes('architectural'))
                                : category === 'architectural';
                            
                            const rowColumns = isFurniture ? ARCHITECTURAL_COLUMNS : INTERIOR_COLUMNS;
                            const hasSubCols = rowColumns.some(col => (row.stage_tasks?.[col]?.length || 0) > 1);
                            
                            const rowThemeColor = isFurniture ? '#3b82f6' : '#8b5cf6';
                            const rowThemeBg = isFurniture ? '#eff6ff' : '#f5f3ff';
                            
                            const projStatus = calculateProjectStatus(row.column_data, rowColumns);
                            const originalIndex = rows.indexOf(row);
                            const targetIndex = originalIndex >= 0 ? originalIndex : idx;

                            return (
                                <div key={idx} style={{
                                    overflowX: 'auto',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '14px',
                                    padding: '14px',
                                    backgroundColor: '#ffffff',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
                                }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 'max-content' }}>
                                        <thead>
                                            <tr style={{ backgroundColor: '#f1f5f9' }}>
                                                <th rowSpan={hasSubCols ? 2 : 1} style={{ width: '45px', padding: '10px 8px', border: '1px solid #cbd5e1', fontSize: '0.75rem', fontWeight: 800, color: '#475569', textAlign: 'center', verticalAlign: 'middle' }}>Sno</th>
                                                <th rowSpan={hasSubCols ? 2 : 1} style={{ width: '220px', padding: '10px 12px', border: '1px solid #cbd5e1', fontSize: '0.75rem', fontWeight: 800, color: '#475569', textAlign: 'left', verticalAlign: 'middle' }}>Project Name</th>
                                                <th rowSpan={hasSubCols ? 2 : 1} style={{ width: '140px', padding: '10px 12px', border: '1px solid #cbd5e1', fontSize: '0.75rem', fontWeight: 800, color: '#475569', textAlign: 'left', verticalAlign: 'middle' }}>
                                                    {isFurniture ? 'Project Architect' : (category === 'site' ? 'Site PM / Staff' : 'Staff')}
                                                </th>

                                                {/* The Dynamic Pipeline Stage Main Headers */}
                                                {rowColumns.map((col, cIdx) => {
                                                    const subTasks = row.stage_tasks?.[col] || [];
                                                    const count = Math.max(1, subTasks.length);

                                                    return (
                                                        <th
                                                            key={`col-${cIdx}`}
                                                            colSpan={count}
                                                            rowSpan={hasSubCols && count === 1 ? 2 : 1}
                                                            style={{
                                                                padding: '8px 6px',
                                                                border: '1px solid #cbd5e1',
                                                                fontSize: '0.75rem',
                                                                fontWeight: 800,
                                                                color: rowThemeColor,
                                                                backgroundColor: rowThemeBg,
                                                                textAlign: 'center',
                                                                verticalAlign: 'middle',
                                                                minWidth: `${100 * count}px`
                                                            }}
                                                        >
                                                            {col}
                                                        </th>
                                                    );
                                                })}

                                                {/* Real-Time Project Status Column */}
                                                <th rowSpan={hasSubCols ? 2 : 1} style={{ width: '130px', padding: '10px 8px', border: '1px solid #cbd5e1', fontSize: '0.75rem', fontWeight: 800, color: '#475569', textAlign: 'center', verticalAlign: 'middle' }}>
                                                    Overall Status
                                                </th>
                                                <th rowSpan={hasSubCols ? 2 : 1} className="no-print" style={{ width: '40px', border: '1px solid #cbd5e1', verticalAlign: 'middle' }}></th>
                                            </tr>

                                            {/* Sub-Header Row for divided working items */}
                                            {hasSubCols && (
                                                <tr style={{ backgroundColor: '#e2e8f0' }}>
                                                    {rowColumns.map(col => {
                                                        const subTasks = row.stage_tasks?.[col] || [];
                                                        if (subTasks.length <= 1) return null;
                                                        return subTasks.map((st, stIdx) => (
                                                            <th
                                                                key={`subcol-${st.id}-${stIdx}`}
                                                                style={{
                                                                    padding: '6px 4px',
                                                                    border: '1px solid #cbd5e1',
                                                                    fontSize: '0.68rem',
                                                                    fontWeight: 700,
                                                                    color: '#334155',
                                                                    backgroundColor: '#cbd5e1',
                                                                    textAlign: 'center',
                                                                    verticalAlign: 'middle',
                                                                    minWidth: '95px'
                                                                }}
                                                            >
                                                                {st.name}
                                                            </th>
                                                        ));
                                                    })}
                                                </tr>
                                            )}
                                        </thead>
                                        <tbody>
                                            <tr style={{ backgroundColor: projStatus.isComplete ? '#f0fdf4' : 'transparent' }}>
                                                {/* Sno */}
                                                <td style={{ padding: '8px', border: '1px solid #cbd5e1', textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>
                                                    {idx + 1}
                                                </td>

                                                {/* Project Name */}
                                                <td style={{ padding: '0', border: '1px solid #cbd5e1' }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px 0 12px' }}>
                                                            {row.project_code && (
                                                                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#253b50', letterSpacing: '0.5px' }}>
                                                                    {row.project_code}
                                                                </span>
                                                            )}
                                                            <span style={{ 
                                                                fontSize: '0.65rem', 
                                                                fontWeight: 800, 
                                                                color: rowThemeColor, 
                                                                backgroundColor: rowThemeBg, 
                                                                padding: '2px 6px', 
                                                                borderRadius: '4px',
                                                                textTransform: 'uppercase'
                                                            }}>
                                                                {isFurniture ? 'Furniture' : 'Interior'}
                                                            </span>
                                                        </div>
                                                        {String(row.project_id) === '68' && (
                                                            <div style={{ color: 'red', fontSize: '10px', padding: '0 12px' }}>
                                                                Tasks: {Object.keys(row.stage_tasks || {}).length}
                                                            </div>
                                                        )}
                                                        <input
                                                            value={row.project_name}
                                                            onChange={e => updateRow(targetIndex, 'project_name', e.target.value)}
                                                            style={{ width: '100%', border: 'none', padding: '2px 12px 8px 12px', fontSize: '0.78rem', fontWeight: 700, color: '#1e293b', outline: 'none', background: 'transparent' }}
                                                            placeholder="Enter Project Name..."
                                                        />
                                                    </div>
                                                </td>

                                                {/* Staff / Architect */}
                                                <td style={{ padding: '0', border: '1px solid #cbd5e1' }}>
                                                    <input
                                                        value={row.staff_name}
                                                        onChange={e => updateRow(targetIndex, 'staff_name', e.target.value)}
                                                        style={{ width: '100%', border: 'none', padding: '10px 12px', fontSize: '0.75rem', color: '#475569', outline: 'none', background: 'transparent' }}
                                                        placeholder="Enter Name..."
                                                    />
                                                </td>

                                                {/* Stage Columns Status Cells (Divided sub-cells with vertical lines) */}
                                                {rowColumns.map((col, cIdx) => {
                                                    const subTasks = row.stage_tasks?.[col] || [];

                                                    if (subTasks.length > 1) {
                                                        return subTasks.map((st, stIdx) => {
                                                            const stBg = getStatusColor(st.status);
                                                            return (
                                                                <td
                                                                    key={`row-${idx}-col-${cIdx}-st-${stIdx}`}
                                                                    title={`${st.name} (${st.status.toUpperCase()})`}
                                                                    style={{
                                                                        padding: 0,
                                                                        border: '1px solid #cbd5e1',
                                                                        backgroundColor: stBg,
                                                                        cursor: 'pointer',
                                                                        position: 'relative',
                                                                        minWidth: '95px'
                                                                    }}
                                                                >
                                                                    <div className="status-overlay" style={{
                                                                        height: '36px',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        fontSize: '0.65rem',
                                                                        color: st.status === 'pending' ? 'transparent' : 'white',
                                                                        fontWeight: 800
                                                                    }}>
                                                                        {st.status === 'done' || st.status === 'completed' ? '✓' : (st.status === 'ongoing' || st.status === 'in_progress' || st.status === 'pending_approval' || st.status === 'planned' || st.status === 'overdue') ? '...' : ''}
                                                                    </div>
                                                                </td>
                                                            );
                                                        });
                                                    } else {
                                                        const subStatus = subTasks.length > 0
                                                             ? (subTasks.find(st => st.status === 'done' || st.status === 'completed') ||
                                                                subTasks.find(st => st.status === 'pending_approval') ||
                                                                subTasks.find(st => st.status === 'ongoing' || st.status === 'in_progress') ||
                                                                subTasks.find(st => st.status === 'planned') ||
                                                                subTasks.find(st => st.status === 'overdue'))?.status
                                                             : null;

                                                        const status = (subStatus && subStatus !== 'pending') ? subStatus : (row.column_data?.[col] || 'pending');
                                                        const cellBg = getStatusColor(status);

                                                        return (
                                                            <td
                                                                key={`row-${idx}-col-${cIdx}`}
                                                                onClick={() => cycleStatus(targetIndex, col)}
                                                                style={{
                                                                    padding: 0,
                                                                    border: '1px solid #cbd5e1',
                                                                    backgroundColor: cellBg,
                                                                    cursor: 'pointer',
                                                                    position: 'relative',
                                                                    minWidth: '95px'
                                                                }}
                                                            >
                                                                <div className="status-overlay" style={{
                                                                    height: '36px',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    fontSize: '0.65rem',
                                                                    color: status === 'pending' ? 'transparent' : 'white',
                                                                    fontWeight: 800
                                                                }}>
                                                                    {status === 'done' || status === 'completed' ? '✓' : (status === 'ongoing' || status === 'in_progress' || status === 'pending_approval' || status === 'planned' || status === 'overdue') ? '...' : ''}
                                                                </div>
                                                            </td>
                                                        );
                                                    }
                                                })}

                                                {/* Real-time Project Status Reflection */}
                                                <td style={{ padding: '6px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
                                                    <span style={{
                                                        fontSize: '0.68rem',
                                                        fontWeight: 800,
                                                        padding: '4px 8px',
                                                        borderRadius: '6px',
                                                        backgroundColor: projStatus.bg,
                                                        color: projStatus.color,
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }}>
                                                        {projStatus.isComplete && <CheckCircle2 size={12} />}
                                                        {projStatus.label}
                                                    </span>
                                                </td>

                                                {/* Delete Row Button */}
                                                <td className="no-print" style={{ padding: '4px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
                                                    <button onClick={() => deleteRow(targetIndex)} style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.color = '#ef4444'} onMouseLeave={e => e.currentTarget.style.color = '#cbd5e1'}>
                                                        <Trash2 size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Status Legend */}
                <div className="no-print" style={{ marginTop: '28px', display: 'flex', gap: '22px', justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#1e293b', fontWeight: 800 }}>
                        <div style={{ width: '14px', height: '14px', backgroundColor: '#22c55e', borderRadius: '3px' }} /> COMPLETED
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#1e293b', fontWeight: 800 }}>
                        <div style={{ width: '14px', height: '14px', backgroundColor: '#f97316', borderRadius: '3px' }} /> ONGOING
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#1e293b', fontWeight: 800 }}>
                        <div style={{ width: '14px', height: '14px', backgroundColor: '#eab308', borderRadius: '3px' }} /> PENDING APPROVAL
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#1e293b', fontWeight: 800 }}>
                        <div style={{ width: '14px', height: '14px', backgroundColor: '#ef4444', borderRadius: '3px' }} /> OVERDUE
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#1e293b', fontWeight: 800 }}>
                        <div style={{ width: '14px', height: '14px', backgroundColor: '#94a3b8', borderRadius: '3px' }} /> PLANNED
                    </div>
                </div>
                {/* Pending Approval Modal Popup */}
                {approvalModal.open && (
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 99999,
                        padding: '20px'
                    }}>
                        <div style={{
                            backgroundColor: '#ffffff',
                            borderRadius: '16px',
                            maxWidth: '450px',
                            width: '100%',
                            padding: '28px',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                            border: '1px solid #e2e8f0',
                            textAlign: 'center'
                        }}>
                            {approvalModal.mode === 'warning' ? (
                                <>
                                    <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#fef9c3', color: '#ca8a04', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
                                        <span style={{ fontSize: '28px' }}>⚠️</span>
                                    </div>
                                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: '0 0 10px 0' }}>
                                        Pending Admin Approval
                                    </h3>
                                    <p style={{ fontSize: '0.9rem', color: '#475569', lineHeight: 1.5, margin: '0 0 24px 0' }}>
                                        Stage <strong>"{approvalModal.colName}"</strong> for <strong>"{approvalModal.projectName}"</strong> is currently in <strong>PENDING APPROVAL</strong> status (Yellow color).
                                        <br /><br />
                                        It will remain in <strong>Pending Approval</strong> state until the Admin reviews and accepts it. <strong>Once Admin accepts it, the color will change to GREEN.</strong>
                                    </p>
                                    <button
                                        onClick={() => setApprovalModal({ open: false, mode: 'warning' })}
                                        style={{
                                            width: '100%',
                                            padding: '12px 20px',
                                            backgroundColor: '#253b50',
                                            color: '#ffffff',
                                            border: 'none',
                                            borderRadius: '10px',
                                            fontWeight: 700,
                                            fontSize: '0.95rem',
                                            cursor: 'pointer',
                                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                        }}
                                    >
                                        Understood
                                    </button>
                                </>
                            ) : (
                                <>
                                    <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
                                        <span style={{ fontSize: '28px' }}>📋</span>
                                    </div>
                                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: '0 0 10px 0' }}>
                                        Admin Approval Required
                                    </h3>
                                    <p style={{ fontSize: '0.9rem', color: '#475569', lineHeight: 1.5, margin: '0 0 24px 0' }}>
                                        Would you like to accept and approve stage <strong>"{approvalModal.colName}"</strong> for <strong>"{approvalModal.projectName}"</strong>?
                                        <br /><br />
                                        Accepting will change the status to <strong>COMPLETED</strong> and update the cell color to <strong>GREEN</strong>.
                                    </p>
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <button
                                            onClick={() => setApprovalModal({ open: false, mode: 'warning' })}
                                            style={{
                                                flex: 1,
                                                padding: '12px',
                                                backgroundColor: '#f1f5f9',
                                                color: '#475569',
                                                border: '1px solid #cbd5e1',
                                                borderRadius: '10px',
                                                fontWeight: 700,
                                                fontSize: '0.9rem',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={() => handleAdminAcceptStage(approvalModal.rowIdx!, approvalModal.colName!)}
                                            style={{
                                                flex: 1,
                                                padding: '12px',
                                                backgroundColor: '#16a34a',
                                                color: '#ffffff',
                                                border: 'none',
                                                borderRadius: '10px',
                                                fontWeight: 700,
                                                fontSize: '0.9rem',
                                                cursor: 'pointer',
                                                boxShadow: '0 4px 6px -1px rgba(22, 163, 74, 0.2)'
                                            }}
                                        >
                                            ✓ Accept & Turn Green
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    .no-print { display: none !important; }
                    body { background-color: white !important; padding: 0 !important; }
                    .tracker-card { border: none !important; box-shadow: none !important; padding: 0 !important; }
                    table { -webkit-print-color-adjust: exact; }
                }
            `}} />
        </div>
    );
};

export default LivincartProjectTimelines;
