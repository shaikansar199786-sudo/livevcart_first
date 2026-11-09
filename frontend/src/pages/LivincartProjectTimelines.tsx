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
    Search,
    RotateCcw,
    Filter,
    Clock,
    ExternalLink,
    Briefcase
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { computeProjectAutoStage } from './Projects';

type TrackerCategory = 'architectural' | 'interior' | 'commercial' | 'site' | 'completed';

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
    designer_columns?: string[];
    pm_columns?: string[];
    custom_columns?: string[];
}

interface Project {
    project_id: string | number;
    project_code?: string;
    project_name: string;
    project_type?: string;
    project_head_name?: string;
    client_name?: string;
    status?: string;
    total_budget?: number;
    initial_quote_amount?: number;
    is_final_quote_approved?: number;
    stage2_paid?: number;
    stage3_paid?: number;
    stage4_paid?: number;
    stage5_paid?: number;
    advance_paid?: number;
    advance_received?: number;
    total_paid?: number;
    paid_amount?: number;
    payment_status?: string;
    project_stage?: string;
    qc_status?: string;
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
    { id: 'commercial', label: 'Commercial Projects', icon: Briefcase, color: '#f59e0b' },
    { id: 'site', label: 'Execution Projects', icon: CheckCircle2, color: '#10b981' },
    { id: 'completed', label: 'Completed Projects', icon: CheckCircle2, color: '#22c55e' }
];

const INTERIOR_COLUMNS: string[] = [
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

const PM_COLUMNS: string[] = [
    'Product Distribution',
    'Ready to Dispatch',
    'In Transit',
    'Delivery',
    'Kickoff_M',
    'HDS',
    'Material Segregation',
    'QC',
    'Installation',
    'Final QC',
    'Handover'
];

const COMBINED_EXECUTION_COLUMNS: string[] = [
    ...ARCHITECTURAL_COLUMNS,
    ...PM_COLUMNS
];

const ALL_TRACKER_COLUMNS: string[] = Array.from(new Set([
    ...ARCHITECTURAL_COLUMNS,
    ...PM_COLUMNS,
    ...SITE_COLUMNS
]));

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
const normalizeCat = (s: string) => String(s || '').toLowerCase().replace(/^[0-9]+\.\s*/, '').replace(/[^a-z0-9]/g, '');

export const LivincartProjectTimelines: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [category, setCategory] = useState<TrackerCategory>('architectural');
    const [rows, setRows] = useState<TrackerRow[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [statementPeriod, setStatementPeriod] = useState<string>('all');
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [customStartDate, setCustomStartDate] = useState<string>('');
    const [customEndDate, setCustomEndDate] = useState<string>('');
    const [projectTypeFilter, setProjectTypeFilter] = useState<string>('all');
    const [staffFilter, setStaffFilter] = useState<string>('all');
    const [loading, setLoading] = useState<boolean>(true);
    const [saving, setSaving] = useState<boolean>(false);
    const [saved, setSaved] = useState<boolean>(false);
    const [executionViewMode, setExecutionViewMode] = useState<'combined' | 'execution' | 'designer'>('combined');
    const [approvalModal, setApprovalModal] = useState<{ open: boolean; mode: 'warning' | 'admin_action'; rowIdx?: number; colName?: string; projectName?: string }>({ open: false, mode: 'warning' });

    const handleResetFilters = () => {
        setSearchQuery('');
        setStatementPeriod('all');
        setProjectTypeFilter('all');
        setSelectedYear(new Date().getFullYear());
        setCustomStartDate('');
        setCustomEndDate('');
        setStaffFilter('all');
    };

    const navigateToProjectOverview = (projectId: string | number) => {
        if (!projectId) return;
        try {
            localStorage.setItem(`active_project_tab_${projectId}`, 'overview');
        } catch (e) {}
        navigate(`/projects/${projectId}?tab=overview`);
    };

    const currentColumns = (category === 'site' || category === 'completed')
        ? (executionViewMode === 'combined' ? COMBINED_EXECUTION_COLUMNS : (executionViewMode === 'designer' ? ARCHITECTURAL_COLUMNS : PM_COLUMNS))
        : ARCHITECTURAL_COLUMNS;

    // Fetch system projects and saved stage tracker state strictly filtered per category
    const fetchTrackerRows = useCallback(async () => {
        setLoading(true);
        setRows([]); // Clear existing rows to prevent bleed
        try {
            // 1. Fetch system projects & finance transactions
            const [projRes, txRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/projects`),
                axios.get(`${API_BASE_URL}/finance/transactions`).catch(() => ({ data: { data: [] } }))
            ]);
            const fetchedProjects: Project[] = projRes.data?.data || [];
            const fetchedTransactions: any[] = txRes.data?.data || [];
            setProjects(fetchedProjects);
            setTransactions(fetchedTransactions);            // 2. Fetch saved tracker status data for ALL categories including completed
            const [resArch, resInt, resComm, resSite, resComp] = await Promise.all([
                axios.get(`${API_BASE_URL}/project-trackers?category=architectural`).catch(() => ({ data: { data: [] } })),
                axios.get(`${API_BASE_URL}/project-trackers?category=interior`).catch(() => ({ data: { data: [] } })),
                axios.get(`${API_BASE_URL}/project-trackers?category=commercial`).catch(() => ({ data: { data: [] } })),
                axios.get(`${API_BASE_URL}/project-trackers?category=site`).catch(() => ({ data: { data: [] } })),
                axios.get(`${API_BASE_URL}/project-trackers?category=completed`).catch(() => ({ data: { data: [] } }))
            ]);
            const savedTrackerRows: TrackerRow[] = [
                ...(resArch.data?.data || []),
                ...(resInt.data?.data || []),
                ...(resComm.data?.data || []),
                ...(resSite.data?.data || []),
                ...(resComp.data?.data || [])
            ];
            const cols = category === 'site' ? PM_COLUMNS : ARCHITECTURAL_COLUMNS;

            // 3. Fetch project timeline state for all system projects across designer, execution, pm
            const timelineStateMap: Record<string, {
                tasks: any[];
                completions: any;
                designerCategories: string[];
                pmCategories: string[];
                customCategories: string[];
            }> = {};
            const todayStr = new Date().toISOString().split('T')[0];

            // Process requests sequentially instead of 18 concurrent to avoid overwhelming XAMPP
            for (const p of fetchedProjects) {
                try {
                    const resDes = await axios.get(`${API_BASE_URL}/controllers/timeline/state.php?project_id=${p.project_id}&type=designer`);
                    const resExec = await axios.get(`${API_BASE_URL}/controllers/timeline/state.php?project_id=${p.project_id}&type=execution`);
                    const resPM = await axios.get(`${API_BASE_URL}/controllers/timeline/state.php?project_id=${p.project_id}&type=pm`);
                    
                    const pId = String(p.project_id);
                    if (!timelineStateMap[pId]) {
                        timelineStateMap[pId] = {
                            tasks: [],
                            completions: {},
                            designerCategories: [],
                            pmCategories: [],
                            customCategories: []
                        };
                    }
                    
                    if (resDes.data && resDes.data.success) {
                        const dTasks = resDes.data.tasks || [];
                        const dOrder = resDes.data.categoryOrder || [];
                        const dCustom = resDes.data.customCategories || [];
                        const dTaskCats = dTasks.map((t: any) => t.category).filter(Boolean);
                        const combinedD = Array.from(new Set([...dOrder, ...dCustom, ...dTaskCats]));
                        const customOnlyD = combinedD.filter((c: string) => !ARCHITECTURAL_COLUMNS.some(ac => ac.toLowerCase().trim() === c.toLowerCase().trim()));
                        timelineStateMap[pId].designerCategories = customOnlyD;
                        timelineStateMap[pId].customCategories.push(...customOnlyD);
                        timelineStateMap[pId].tasks.push(...dTasks);
                        timelineStateMap[pId].completions = {
                            ...timelineStateMap[pId].completions,
                            ...(resDes.data.completions || {})
                        };
                    }

                    if (resExec.data && resExec.data.success) {
                        const eTasks = resExec.data.tasks || [];
                        timelineStateMap[pId].tasks.push(...eTasks);
                        timelineStateMap[pId].completions = {
                            ...timelineStateMap[pId].completions,
                            ...(resExec.data.completions || {})
                        };
                    }

                    if (resPM.data && resPM.data.success) {
                        const pTasks = resPM.data.tasks || [];
                        const pOrder = resPM.data.categoryOrder || [];
                        const pCustom = resPM.data.customCategories || [];
                        const pTaskCats = pTasks.map((t: any) => t.category).filter(Boolean);
                        const combinedP = Array.from(new Set([...pOrder, ...pCustom, ...pTaskCats]));
                        const customOnlyP = combinedP.filter((c: string) => !PM_COLUMNS.some(pm => pm.toLowerCase().trim() === c.toLowerCase().trim()));
                        timelineStateMap[pId].pmCategories = customOnlyP;
                        timelineStateMap[pId].customCategories.push(...customOnlyP);
                        timelineStateMap[pId].tasks.push(...pTasks);
                        timelineStateMap[pId].completions = {
                            ...timelineStateMap[pId].completions,
                            ...(resPM.data.completions || {})
                        };
                    }
                } catch (err) {
                    console.error('Failed to fetch timeline state for project', p.project_id, err);
                }
            }

            const mergedRows: TrackerRow[] = [];

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
                
                const projDesignerCols = Array.from(new Set([...ARCHITECTURAL_COLUMNS, ...(pTimeline?.designerCategories || [])]));
                const projPmCols = Array.from(new Set([...PM_COLUMNS, ...(pTimeline?.pmCategories || [])]));
                const projAllCols = Array.from(new Set([...ALL_TRACKER_COLUMNS, ...projDesignerCols, ...projPmCols]));

                const data: Record<string, string> = existing ? { ...existing.column_data } : {};
                const stageTasks: Record<string, StageSubTask[]> = {};

                projAllCols.forEach(c => {
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
                    stage_tasks: stageTasks,
                    designer_columns: projDesignerCols,
                    pm_columns: projPmCols,
                    custom_columns: pTimeline?.customCategories || []
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
            const cols = category === 'architectural' ? ARCHITECTURAL_COLUMNS : (category === 'site' ? PM_COLUMNS : INTERIOR_COLUMNS);
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

        const originalProj = projects.find(p => String(p.project_id) === String(row.project_id));
        const autoInfo = originalProj ? computeProjectAutoStage(originalProj, transactions) : null;

        const cNorm = normalizeCat(colName);
        const isHandover = colName === '14. Handover' || colName === 'Handover' || cNorm.includes('handover');
        const isStage4Col = ['readytodispatch', 'dispatch', 'intransit', 'transit', 'delivery', 'kickoffm', 'kickoff', 'hds', 'materialsegregation', 'installation', 'finalqc'].some(k => cNorm.includes(k));

        if (isHandover && !autoInfo?.isStage5Complete) {
            alert(`🔒 Handover Stage Locked: Project requires 100% full payment (Stage 5 milestone) before Handover can be marked. (Current paid: ${Math.round(autoInfo?.paidPercent || 0)}%)`);
            return;
        }

        if (isStage4Col && !autoInfo?.isStage4Complete) {
            alert(`🔒 Stage 4 Locked: Ready to Dispatch / Material Dispatch requires 90% milestone payment (Stage 4) before progressing. (Current paid: ${Math.round(autoInfo?.paidPercent || 0)}%)`);
            return;
        }

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
            setTimeout(() => handleSave(nextRows), 100);
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

    const handleAdminAcceptStage = async (rowIdx: number, colName: string) => {
        const row = rows[rowIdx];
        const originalProj = projects.find(p => String(p.project_id) === String(row?.project_id));
        const autoInfo = originalProj ? computeProjectAutoStage(originalProj, transactions) : null;

        const cNorm = normalizeCat(colName);
        const isHandover = colName === '14. Handover' || colName === 'Handover' || cNorm.includes('handover');
        const isStage4Col = ['readytodispatch', 'dispatch', 'intransit', 'transit', 'delivery', 'kickoffm', 'kickoff', 'hds', 'materialsegregation', 'installation', 'finalqc'].some(k => cNorm.includes(k));

        if (isHandover && !autoInfo?.isStage5Complete) {
            alert(`🔒 Cannot Approve Handover: Project requires 100% full payment (Stage 5 milestone) before Handover can be marked done.`);
            return;
        }

        if (isStage4Col && !autoInfo?.isStage4Complete) {
            alert(`🔒 Cannot Approve Stage 4: Project requires 90% milestone payment (Stage 4) before dispatch / site stages can be marked done.`);
            return;
        }
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
            setTimeout(() => handleSave(nextRows), 100);
            return nextRows;
        });

        // Also sync to timeline API for persistence across ProjectDetails
        if (row && row.project_id) {
            try {
                const isSiteOrPm = SITE_COLUMNS.includes(colName) || PM_COLUMNS.includes(colName) || (row.pm_columns && row.pm_columns.includes(colName));
                const syncTypes = isSiteOrPm ? ['execution', 'pm'] : ['designer'];

                for (const tType of syncTypes) {
                    const res = await axios.get(`${API_BASE_URL}/controllers/timeline/state.php?project_id=${row.project_id}&type=${tType}`);
                    if (res.data?.success) {
                        const tTasks = res.data.tasks || [];
                        const tCompletions = res.data.completions || {};
                        const catNorm = normalizeCat(colName);
                        tTasks.forEach((t: any) => {
                            const tNorm = normalizeCat(t.category);
                            if (tNorm === catNorm || (tNorm.length > 2 && catNorm.length > 2 && (tNorm.includes(catNorm) || catNorm.includes(tNorm)))) {
                                const tId = String(t.id);
                                if (!tCompletions[tId]) tCompletions[tId] = {};
                                if (t.startDate && t.endDate) {
                                    const curD = new Date(t.startDate);
                                    const endD = new Date(t.endDate);
                                    while (curD <= endD) {
                                        const dStr = curD.toISOString().split('T')[0];
                                        tCompletions[tId][dStr] = 'done';
                                        curD.setDate(curD.getDate() + 1);
                                    }
                                }
                                Object.keys(tCompletions[tId]).forEach(d => {
                                    tCompletions[tId][d] = 'done';
                                });
                            }
                        });
                        await axios.post(`${API_BASE_URL}/controllers/timeline/save-state.php`, {
                            project_id: row.project_id,
                            tasks: tTasks,
                            completions: tCompletions,
                            created_by: user?.user_id || 1,
                            type: tType
                        });
                    }
                }
            } catch (err) {
                console.error('Failed to sync accepted stage to project timeline', err);
            }
        }

        setSaved(false);
        setApprovalModal({ open: false, mode: 'warning' });
    };

    const handleAdminRejectStage = async (rowIdx: number, colName: string) => {
        const row = rows[rowIdx];
        setRows(prev => {
            const nextRows = [...prev];
            const updatedColumnData = { ...(nextRows[rowIdx].column_data || {}), [colName]: 'ongoing' };
            const updatedStageTasks = { ...(nextRows[rowIdx].stage_tasks || {}) };

            if (updatedStageTasks[colName] && updatedStageTasks[colName].length > 0) {
                updatedStageTasks[colName] = updatedStageTasks[colName].map(st => ({
                    ...st,
                    status: 'ongoing',
                    color: getStatusColor('ongoing')
                }));
            }

            nextRows[rowIdx] = {
                ...nextRows[rowIdx],
                column_data: updatedColumnData,
                stage_tasks: updatedStageTasks
            };
            setTimeout(() => handleSave(nextRows), 100);
            return nextRows;
        });

        // Also sync to timeline API for persistence across ProjectDetails
        if (row && row.project_id) {
            try {
                const isSiteOrPm = SITE_COLUMNS.includes(colName) || PM_COLUMNS.includes(colName) || (row.pm_columns && row.pm_columns.includes(colName));
                const syncTypes = isSiteOrPm ? ['execution', 'pm'] : ['designer'];

                for (const tType of syncTypes) {
                    const res = await axios.get(`${API_BASE_URL}/controllers/timeline/state.php?project_id=${row.project_id}&type=${tType}`);
                    if (res.data?.success) {
                        const tTasks = res.data.tasks || [];
                        const tCompletions = res.data.completions || {};
                        const catNorm = normalizeCat(colName);
                        tTasks.forEach((t: any) => {
                            const tNorm = normalizeCat(t.category);
                            if (tNorm === catNorm || (tNorm.length > 2 && catNorm.length > 2 && (tNorm.includes(catNorm) || catNorm.includes(tNorm)))) {
                                const tId = String(t.id);
                                if (!tCompletions[tId]) tCompletions[tId] = {};
                                if (t.startDate && t.endDate) {
                                    const curD = new Date(t.startDate);
                                    const endD = new Date(t.endDate);
                                    while (curD <= endD) {
                                        const dStr = curD.toISOString().split('T')[0];
                                        tCompletions[tId][dStr] = 'ongoing';
                                        curD.setDate(curD.getDate() + 1);
                                    }
                                }
                                Object.keys(tCompletions[tId]).forEach(d => {
                                    tCompletions[tId][d] = 'ongoing';
                                });
                            }
                        });
                        await axios.post(`${API_BASE_URL}/controllers/timeline/save-state.php`, {
                            project_id: row.project_id,
                            tasks: tTasks,
                            completions: tCompletions,
                            created_by: user?.user_id || 1,
                            type: tType
                        });
                    }
                }
            } catch (err) {
                console.error('Failed to sync rejected stage to project timeline', err);
            }
        }

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

    const handleSave = async (customRows?: TrackerRow[]) => {
        setSaving(true);
        try {
            const rowsToSave = customRows || rows;
            const cleanRows = rowsToSave.filter(r => (r.project_name && r.project_name.trim()) || (r.staff_name && r.staff_name.trim()));
            
            const archRows: any[] = [];
            const intRows: any[] = [];
            const commRows: any[] = [];
            const siteRows: any[] = [];
            const compRows: any[] = [];

            cleanRows.forEach(r => {
                const originalProj = projects.find(p => String(p.project_id) === String(r.project_id));
                const autoInfo = originalProj ? computeProjectAutoStage(originalProj, transactions) : null;
                const pStatus = String(originalProj?.status || r.column_data?.['status'] || '').toLowerCase();
                const data = r.column_data || {};
                const isHandoverDone = data['14. Handover'] === 'done' || data['14. Handover'] === 'completed' ||
                    data['Handover'] === 'done' || data['Handover'] === 'completed';

                // Strictly require Stage 5 100% payment completion to be categorized under Completed Projects
                const isProjCompleted = Boolean(autoInfo?.isStage5Complete && (
                    ['completed', 'done', 'finished', 'handover', 'won'].includes(pStatus) ||
                    String((originalProj as any)?.project_stage || '').toLowerCase() === 'handover' ||
                    isHandoverDone
                ));

                if (isProjCompleted) {
                    compRows.push(r);
                } else {
                    const pType = originalProj ? (originalProj.project_type || '').toLowerCase() : '';
                    const isFurniture = pType.includes('furniture') || pType.includes('architectural');
                    const isCommercial = pType.includes('commercial');
                    const maskingStatus = data['Masking'] || data['5. Masking'] || '';
                    const hasStartedMasking = maskingStatus === 'ongoing' || maskingStatus === 'done' || maskingStatus === 'completed';
                    const r2pStatus = data['R2P'] || '';
                    const hasStartedR2P = r2pStatus === 'ongoing' || r2pStatus === 'done' || r2pStatus === 'completed';
                    const pStage = String((originalProj as any)?.project_stage || '').toLowerCase();
                    const hasExecutionStage = pStage === 'r2p' || pStage === 'execution' || pStage === 'production';
                    const hasStartedExecution = hasStartedMasking || hasStartedR2P || hasExecutionStage;

                    if (hasStartedExecution) {
                        siteRows.push(r);
                    } else if (isCommercial) {
                        commRows.push(r);
                    } else if (isFurniture) {
                        archRows.push(r);
                    } else {
                        intRows.push(r);
                    }
                }
            });

            await Promise.all([
                axios.post(`${API_BASE_URL}/project-trackers`, { category: 'architectural', rows: archRows }).catch(() => {}),
                axios.post(`${API_BASE_URL}/project-trackers`, { category: 'interior', rows: intRows }).catch(() => {}),
                axios.post(`${API_BASE_URL}/project-trackers`, { category: 'commercial', rows: commRows }).catch(() => {}),
                axios.post(`${API_BASE_URL}/project-trackers`, { category: 'site', rows: siteRows }).catch(() => {}),
                axios.post(`${API_BASE_URL}/project-trackers`, { category: 'completed', rows: compRows }).catch(() => {})
            ]);

            // Automatically sync completed status to projects API only if Handover is marked completed AND Stage 5 is 100% paid
            cleanRows.forEach(r => {
                if (r.project_id) {
                    const data = r.column_data || {};
                    const isHandoverDone = data['14. Handover'] === 'done' || data['14. Handover'] === 'completed' ||
                        data['Handover'] === 'done' || data['Handover'] === 'completed';
                    const targetProj = projects.find(p => String(p.project_id) === String(r.project_id));
                    const autoInfo = targetProj ? computeProjectAutoStage(targetProj, transactions) : null;
                    if (isHandoverDone && autoInfo?.isStage5Complete) {
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
        const autoInfo = originalProj ? computeProjectAutoStage(originalProj, transactions) : null;
        const pStatus = String(originalProj?.status || r.column_data?.['status'] || '').toLowerCase();

        // Determine if project is completed (strictly requires 100% Stage 5 payment)
        const isCompleted = Boolean(autoInfo?.isStage5Complete && (
            ['completed', 'done', 'finished', 'handover', 'won'].includes(pStatus) ||
            String((originalProj as any)?.project_stage || '').toLowerCase() === 'handover' ||
            (r.column_data && (r.column_data['14. Handover'] === 'done' || r.column_data['14. Handover'] === 'completed' ||
             r.column_data['Handover'] === 'done' || r.column_data['Handover'] === 'completed'))
        ));

        // Filter by Category tab
        if (category === 'completed') {
            if (!isCompleted) return false;
        } else {
            // Hide completed projects from active tabs (interior, architectural, site)
            if (isCompleted) return false;

            const pType = originalProj ? (originalProj.project_type || '').toLowerCase() : '';
            const isFurniture = pType.includes('furniture') || pType.includes('architectural');
            const isCommercial = pType.includes('commercial');
            const isInterior = !isFurniture && !isCommercial;

            const maskingStatus = r.column_data['Masking'] || r.column_data['5. Masking'] || '';
            const hasStartedMasking = maskingStatus === 'ongoing' || maskingStatus === 'done' || maskingStatus === 'completed';
            const r2pStatus = r.column_data['R2P'] || '';
            const hasStartedR2P = r2pStatus === 'ongoing' || r2pStatus === 'done' || r2pStatus === 'completed';
            const pStage = String((originalProj as any)?.project_stage || '').toLowerCase();
            const hasExecutionStage = pStage === 'r2p' || pStage === 'execution' || pStage === 'production';
            const hasStartedExecution = hasStartedMasking || hasStartedR2P || hasExecutionStage;

            if (category === 'site') {
                if (!hasStartedExecution) return false;
            } else if (category === 'commercial') {
                if (projectTypeFilter !== 'all' && !isCommercial) return false;
                if (hasStartedExecution) return false;
                if (!isCommercial) return false;
            } else if (category === 'architectural') {
                if (projectTypeFilter !== 'all' && !isFurniture) return false;
                if (hasStartedExecution) return false;
                if (!isFurniture) return false;
            } else if (category === 'interior') {
                if (projectTypeFilter !== 'all' && !isInterior) return false;
                if (hasStartedExecution) return false;
                if (!isInterior) return false;
            }
        }

        const pType = originalProj ? (originalProj.project_type || '').toLowerCase() : '';
        const isFurniture = pType.includes('furniture') || pType.includes('architectural');
        const isCommercial = pType.includes('commercial');
        const isInterior = !isFurniture && !isCommercial;

        // Project Type Filter
        if (projectTypeFilter === 'furniture' && !isFurniture) return false;
        if (projectTypeFilter === 'interior' && !isInterior) return false;
        if (projectTypeFilter === 'commercial' && !isCommercial) return false;

        // Statement Period Filter
        if (statementPeriod !== 'all') {
            const pDateStr = (originalProj as any)?.created_at || (originalProj as any)?.date || (r as any).created_at || '';
            if (pDateStr) {
                const pDate = new Date(pDateStr);
                if (!isNaN(pDate.getTime())) {
                    const now = Date.now();
                    if (statementPeriod === 'last_month' && pDate.getTime() < now - (30 * 24 * 60 * 60 * 1000)) return false;
                    if (statementPeriod === 'last_3_months' && pDate.getTime() < now - (90 * 24 * 60 * 60 * 1000)) return false;
                    if (statementPeriod === 'last_6_months' && pDate.getTime() < now - (180 * 24 * 60 * 60 * 1000)) return false;
                    if (statementPeriod === 'by_year' && pDate.getFullYear() !== selectedYear) return false;
                    if (statementPeriod === 'custom') {
                        if (customStartDate && pDate < new Date(customStartDate)) return false;
                        if (customEndDate && pDate > new Date(customEndDate + 'T23:59:59')) return false;
                    }
                }
            }
        }

        // Filter by Staff
        if (staffFilter !== 'all') {
            if ((r.staff_name || '').toLowerCase() !== staffFilter.toLowerCase()) return false;
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
                border: '1.5px solid #ffe8c2'
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
                                backgroundColor: category === cat.id 
                                    ? (cat.id === 'completed' ? '#22c55e' : '#0c1527') 
                                    : (cat.id === 'completed' ? '#f0fdf4' : '#ffffff'),
                                color: category === cat.id 
                                    ? '#ffffff' 
                                    : (cat.id === 'completed' ? '#15803d' : '#0c1527'),
                                border: category === cat.id 
                                    ? `1.5px solid ${cat.id === 'completed' ? '#22c55e' : '#0c1527'}` 
                                    : `1.5px solid ${cat.id === 'completed' ? '#bbf7d0' : '#cbd5e1'}`,
                                borderRadius: '10px',
                                cursor: 'pointer',
                                fontWeight: 800,
                                fontSize: '0.88rem',
                                boxShadow: category === cat.id 
                                    ? `0 4px 12px ${cat.id === 'completed' ? '#22c55e' : '#0c1527'}40` 
                                    : 'none',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            <cat.icon size={18} color={category === cat.id 
                                ? (cat.id === 'completed' ? '#ffffff' : '#fca412') 
                                : (cat.id === 'completed' ? '#166534' : cat.color)} 
                            />
                            {cat.label}
                        </button>
                    ))}
                </div>

                {/* Search & Filter Controls Bar */}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end' }}>
                    <div style={{ position: 'relative', width: '220px' }}>
                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search project code, name..."
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

                    {/* Statement Period Filter */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>Statement Period:</label>
                        <select
                            value={statementPeriod}
                            onChange={(e) => setStatementPeriod(e.target.value)}
                            style={{ padding: '9px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', fontWeight: 700, fontSize: '0.85rem', color: '#0f172a', outline: 'none', cursor: 'pointer' }}
                        >
                            <option value="all">All Time</option>
                            <option value="last_month">Last Month</option>
                            <option value="last_3_months">Last 3 Months</option>
                            <option value="last_6_months">Last 6 Months</option>
                            <option value="by_year">By Year</option>
                            <option value="custom">Custom Range</option>
                        </select>
                    </div>

                    {/* Year Selector if By Year */}
                    {statementPeriod === 'by_year' && (
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(Number(e.target.value))}
                            style={{ padding: '9px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', fontWeight: 700, fontSize: '0.85rem', color: '#0f172a', outline: 'none', cursor: 'pointer' }}
                        >
                            {Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - i).map(yr => (
                                <option key={yr} value={yr}>{yr}</option>
                            ))}
                        </select>
                    )}

                    {/* Custom Date Range if Custom */}
                    {statementPeriod === 'custom' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input
                                type="date"
                                value={customStartDate}
                                onChange={(e) => setCustomStartDate(e.target.value)}
                                style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                            />
                            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>to</span>
                            <input
                                type="date"
                                value={customEndDate}
                                onChange={(e) => setCustomEndDate(e.target.value)}
                                style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                            />
                        </div>
                    )}

                    {/* Project Type Filter */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>Project Type:</label>
                        <select
                            value={projectTypeFilter}
                            onChange={(e) => setProjectTypeFilter(e.target.value)}
                            style={{ padding: '9px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', fontWeight: 700, fontSize: '0.85rem', color: '#0f172a', outline: 'none', cursor: 'pointer' }}
                        >
                            <option value="all">All</option>
                            <option value="furniture">Furniture Projects</option>
                            <option value="interior">Interior Projects</option>
                            <option value="commercial">Commercial Projects</option>
                        </select>
                    </div>

                    {/* Permanent Reset Filters Button */}
                    <button
                        onClick={handleResetFilters}
                        style={{
                            padding: '9px 14px',
                            borderRadius: '10px',
                            border: '1px solid #cbd5e1',
                            backgroundColor: '#f8fafc',
                            color: '#0f172a',
                            fontWeight: 800,
                            fontSize: '0.82rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                        }}
                    >
                        <RotateCcw size={14} color="#ea580c" /> Reset Filters
                    </button>
                </div>
            </div>

            {/* View Mode Switcher for Execution Projects & Completed Projects */}
            {(category === 'site' || category === 'completed') && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: '#fff9f0',
                    border: '1.5px solid #fed7aa',
                    borderRadius: '14px',
                    padding: '10px 16px',
                    marginBottom: '20px',
                    flexWrap: 'wrap',
                    gap: '12px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#9a3412' }}>Timeline Scope:</span>
                        <div style={{ display: 'flex', backgroundColor: '#f1f5f9', borderRadius: '10px', padding: '4px', gap: '4px' }}>
                            <button
                                onClick={() => setExecutionViewMode('combined')}
                                style={{
                                    padding: '7px 16px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    fontWeight: 800,
                                    fontSize: '0.82rem',
                                    cursor: 'pointer',
                                    backgroundColor: executionViewMode === 'combined' ? '#0f172a' : 'transparent',
                                    color: executionViewMode === 'combined' ? '#ffffff' : '#64748b',
                                    boxShadow: executionViewMode === 'combined' ? '0 2px 8px rgba(15,23,42,0.2)' : 'none',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                ⚡ Combined (Designer + Project Manager)
                            </button>
                            <button
                                onClick={() => setExecutionViewMode('execution')}
                                style={{
                                    padding: '7px 16px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    fontWeight: 800,
                                    fontSize: '0.82rem',
                                    cursor: 'pointer',
                                    backgroundColor: executionViewMode === 'execution' ? '#0f172a' : 'transparent',
                                    color: executionViewMode === 'execution' ? '#ffffff' : '#64748b',
                                    boxShadow: executionViewMode === 'execution' ? '0 2px 8px rgba(15,23,42,0.2)' : 'none',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                🏗️ Project Manager Timeline (11 Stages)
                            </button>
                            <button
                                onClick={() => setExecutionViewMode('designer')}
                                style={{
                                    padding: '7px 16px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    fontWeight: 800,
                                    fontSize: '0.82rem',
                                    cursor: 'pointer',
                                    backgroundColor: executionViewMode === 'designer' ? '#0f172a' : 'transparent',
                                    color: executionViewMode === 'designer' ? '#ffffff' : '#64748b',
                                    boxShadow: executionViewMode === 'designer' ? '0 2px 8px rgba(15,23,42,0.2)' : 'none',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                🎨 Designer Timeline (10 Stages)
                            </button>
                        </div>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#78350f', fontWeight: 700 }}>
                        {executionViewMode === 'combined' 
                            ? '✨ Full Lifecycle View: 10 Designer Stages + 11 Project Manager Stages' 
                            : (executionViewMode === 'execution' ? '🏗️ Tracking 11 Project Manager Milestones' : '🎨 Tracking 10 Design Office Approval Stages')}
                    </div>
                </div>
            )}

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
                <button onClick={() => handleSave()} disabled={saving} title="Save Changes"
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
                    backgroundColor: '#fff9f0',
                    padding: '14px 20px',
                    borderRadius: '12px',
                    border: '1.5px solid #ffe8c2'
                }}>
                    <h1 style={{
                        margin: 0,
                        fontSize: '1.25rem',
                        fontWeight: 900,
                        color: '#fca412',
                        letterSpacing: '0.5px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px'
                    }}>
                        {CATEGORIES.find(c => c.id === category)?.label}
                    </h1>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '100px' }}>
                        <Loader2 size={44} className="animate-spin" color="#fca412" />
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {displayedRows.map((row, idx) => {
                            const originalProj = projects.find(p => String(p.project_id) === String(row.project_id));
                            const pTypeLower = originalProj ? (originalProj.project_type || '').toLowerCase() : '';
                            const isFurniture = originalProj 
                                ? (pTypeLower.includes('furniture') || pTypeLower.includes('architectural'))
                                : category === 'architectural';
                            const isCommercial = originalProj
                                ? pTypeLower.includes('commercial')
                                : category === 'commercial';
                            
                            const isExecutionTab = category === 'site' || category === 'completed';
                            const projDesignerCols = row.designer_columns && row.designer_columns.length > 0 ? row.designer_columns : ARCHITECTURAL_COLUMNS;
                            const projPmCols = row.pm_columns && row.pm_columns.length > 0 ? row.pm_columns : PM_COLUMNS;
                            const projCombinedCols = [...projDesignerCols, ...projPmCols];
                            const rowColumns = isExecutionTab
                                ? (executionViewMode === 'combined' ? projCombinedCols : (executionViewMode === 'designer' ? projDesignerCols : projPmCols))
                                : projDesignerCols;
                            const isCombinedMode = isExecutionTab && executionViewMode === 'combined';
                            const hasSubCols = rowColumns.some(col => (row.stage_tasks?.[col]?.length || 0) > 1);
                            
                            const rowThemeColor = '#ffffff';
                            const rowThemeBg = '#fca412';
                            
                            const projStatus = calculateProjectStatus(row.column_data, rowColumns);
                            const originalIndex = rows.indexOf(row);
                            const targetIndex = originalIndex >= 0 ? originalIndex : idx;

                            const metaRowSpan = isCombinedMode ? (hasSubCols ? 3 : 2) : (hasSubCols ? 2 : 1);

                            return (
                                <div key={idx} style={{
                                    overflowX: 'auto',
                                    border: '1.5px solid #ffe8c2',
                                    borderRadius: '14px',
                                    padding: '14px',
                                    backgroundColor: '#ffffff',
                                    boxShadow: '0 4px 14px rgba(252, 164, 18, 0.06)'
                                }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 'max-content' }}>
                                        <thead>
                                            {/* Tier 1 Header: Group Categories for Combined View */}
                                            {isCombinedMode && (
                                                <tr style={{ backgroundColor: '#fff9f0' }}>
                                                    <th rowSpan={metaRowSpan} style={{ width: '45px', padding: '10px 8px', border: '1px solid #ffe8c2', fontSize: '0.75rem', fontWeight: 800, color: '#0c1527', backgroundColor: '#fff9f0', textAlign: 'center', verticalAlign: 'middle' }}>Sno</th>
                                                    <th rowSpan={metaRowSpan} style={{ width: '220px', padding: '10px 12px', border: '1px solid #ffe8c2', fontSize: '0.75rem', fontWeight: 800, color: '#0c1527', backgroundColor: '#fff9f0', textAlign: 'left', verticalAlign: 'middle' }}>Project Name</th>
                                                    <th rowSpan={metaRowSpan} style={{ width: '140px', padding: '10px 12px', border: '1px solid #ffe8c2', fontSize: '0.75rem', fontWeight: 800, color: '#0c1527', backgroundColor: '#fff9f0', textAlign: 'left', verticalAlign: 'middle' }}>
                                                        {isFurniture ? 'Project Architect' : (isCommercial ? 'Commercial Lead / Staff' : (category === 'site' ? 'Project Manager / Staff' : 'Staff'))}
                                                    </th>
                                                    <th colSpan={projDesignerCols.length} style={{
                                                        padding: '7px',
                                                        border: '1.5px solid #fed7aa',
                                                        backgroundColor: '#fef3c7',
                                                        color: '#9a3412',
                                                        fontSize: '0.82rem',
                                                        fontWeight: 900,
                                                        textAlign: 'center',
                                                        letterSpacing: '0.5px'
                                                    }}>
                                                        🎨 DESIGNER TIMELINE ({projDesignerCols.length} Stages)
                                                    </th>
                                                    <th colSpan={projPmCols.length} style={{
                                                        padding: '7px',
                                                        border: '1.5px solid #bbf7d0',
                                                        backgroundColor: '#dcfce7',
                                                        color: '#166534',
                                                        fontSize: '0.82rem',
                                                        fontWeight: 900,
                                                        textAlign: 'center',
                                                        letterSpacing: '0.5px'
                                                    }}>
                                                        🏗️ PROJECT MANAGER TIMELINE ({projPmCols.length} Stages)
                                                    </th>
                                                    <th rowSpan={metaRowSpan} style={{ width: '130px', padding: '10px 8px', border: '1px solid #ffe8c2', fontSize: '0.75rem', fontWeight: 800, color: '#0c1527', backgroundColor: '#fff9f0', textAlign: 'center', verticalAlign: 'middle' }}>
                                                        Overall Status
                                                    </th>
                                                    <th rowSpan={metaRowSpan} className="no-print" style={{ width: '40px', border: '1px solid #ffe8c2', backgroundColor: '#fff9f0', verticalAlign: 'middle' }}></th>
                                                </tr>
                                            )}

                                            <tr style={{ backgroundColor: '#fff9f0' }}>
                                                {!isCombinedMode && (
                                                    <>
                                                        <th rowSpan={hasSubCols ? 2 : 1} style={{ width: '45px', padding: '10px 8px', border: '1px solid #ffe8c2', fontSize: '0.75rem', fontWeight: 800, color: '#0c1527', backgroundColor: '#fff9f0', textAlign: 'center', verticalAlign: 'middle' }}>Sno</th>
                                                        <th rowSpan={hasSubCols ? 2 : 1} style={{ width: '220px', padding: '10px 12px', border: '1px solid #ffe8c2', fontSize: '0.75rem', fontWeight: 800, color: '#0c1527', backgroundColor: '#fff9f0', textAlign: 'left', verticalAlign: 'middle' }}>Project Name</th>
                                                        <th rowSpan={hasSubCols ? 2 : 1} style={{ width: '140px', padding: '10px 12px', border: '1px solid #ffe8c2', fontSize: '0.75rem', fontWeight: 800, color: '#0c1527', backgroundColor: '#fff9f0', textAlign: 'left', verticalAlign: 'middle' }}>
                                                            {isFurniture ? 'Project Architect' : (isCommercial ? 'Commercial Lead / Staff' : (category === 'site' ? 'Site PM / Staff' : 'Staff'))}
                                                        </th>
                                                    </>
                                                )}

                                                {/* The Dynamic Pipeline Stage Main Headers */}
                                                {rowColumns.map((col, cIdx) => {
                                                    const subTasks = row.stage_tasks?.[col] || [];
                                                    const count = Math.max(1, subTasks.length);
                                                    const isDesignerCol = projDesignerCols.includes(col);

                                                    return (
                                                        <th
                                                            key={`col-${cIdx}`}
                                                            colSpan={count}
                                                            rowSpan={hasSubCols && count === 1 ? 2 : 1}
                                                            style={{
                                                                padding: '8px 6px',
                                                                border: '1px solid #ffe8c2',
                                                                fontSize: '0.78rem',
                                                                fontWeight: 800,
                                                                color: isCombinedMode ? (isDesignerCol ? '#9a3412' : '#166534') : '#0c1527',
                                                                backgroundColor: isCombinedMode ? (isDesignerCol ? '#fffbeb' : '#f0fdf4') : '#fff9f0',
                                                                textAlign: 'center',
                                                                verticalAlign: 'middle',
                                                                minWidth: `${100 * count}px`
                                                            }}
                                                        >
                                                            {col}
                                                        </th>
                                                    );
                                                })}

                                                {/* Real-Time Project Status Column (if not combined, since combined has it on Tier 1) */}
                                                {!isCombinedMode && (
                                                    <>
                                                        <th rowSpan={hasSubCols ? 2 : 1} style={{ width: '130px', padding: '10px 8px', border: '1px solid #ffe8c2', fontSize: '0.75rem', fontWeight: 800, color: '#0c1527', backgroundColor: '#fff9f0', textAlign: 'center', verticalAlign: 'middle' }}>
                                                            Overall Status
                                                        </th>
                                                        <th rowSpan={hasSubCols ? 2 : 1} className="no-print" style={{ width: '40px', border: '1px solid #ffe8c2', backgroundColor: '#fff9f0', verticalAlign: 'middle' }}></th>
                                                    </>
                                                )}
                                            </tr>

                                            {/* Sub-Header Row for divided working items */}
                                            {hasSubCols && (
                                                <tr style={{ backgroundColor: '#ffffff' }}>
                                                    {rowColumns.map(col => {
                                                        const subTasks = row.stage_tasks?.[col] || [];
                                                        if (subTasks.length <= 1) return null;
                                                        return subTasks.map((st, stIdx) => (
                                                            <th
                                                                key={`subcol-${st.id}-${stIdx}`}
                                                                style={{
                                                                    padding: '6px 4px',
                                                                    border: '1px solid #ffe8c2',
                                                                    fontSize: '0.68rem',
                                                                    fontWeight: 700,
                                                                    color: '#475569',
                                                                    backgroundColor: '#ffffff',
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
                                                <td 
                                                    onClick={() => {
                                                        if (row.project_id) {
                                                            navigateToProjectOverview(row.project_id);
                                                        }
                                                    }}
                                                    style={{ 
                                                        padding: '8px 12px', 
                                                        border: '1px solid #cbd5e1', 
                                                        cursor: row.project_id ? 'pointer' : 'default',
                                                        backgroundColor: '#ffffff',
                                                        transition: 'background 0.15s'
                                                    }}
                                                    onMouseEnter={e => { if (row.project_id) e.currentTarget.style.backgroundColor = '#fff9f0'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#ffffff'; }}
                                                    title={row.project_id ? "Click to view Project Overview" : ""}
                                                >
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            {row.project_code && (
                                                                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#0c1527', letterSpacing: '0.5px' }}>
                                                                    {row.project_code}
                                                                </span>
                                                            )}
                                                            <span style={{ 
                                                                fontSize: '0.65rem', 
                                                                fontWeight: 800, 
                                                                color: '#fca412', 
                                                                backgroundColor: '#fff9f0', 
                                                                border: '1px solid #ffe8c2',
                                                                padding: '2px 6px', 
                                                                borderRadius: '4px',
                                                                textTransform: 'uppercase'
                                                            }}>
                                                                {isFurniture ? 'Furniture' : (isCommercial ? 'Commercial' : 'Interior')}
                                                            </span>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0c1527', textDecoration: 'underline', textDecorationColor: '#fca412' }}>
                                                                {row.project_name || 'Unnamed Project'}
                                                            </span>
                                                            {row.project_id && (
                                                                <ExternalLink size={13} color="#fca412" />
                                                            )}
                                                        </div>
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
                                                                    title={`${st.name} (${st.status.toUpperCase()}) - Click to view Project Overview`}
                                                                    onClick={() => {
                                                                        if (row.project_id) {
                                                                            navigateToProjectOverview(row.project_id);
                                                                        }
                                                                    }}
                                                                    style={{
                                                                        padding: 0,
                                                                        border: '1px solid #cbd5e1',
                                                                        backgroundColor: stBg,
                                                                        cursor: row.project_id ? 'pointer' : 'default',
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
                                                                onClick={() => {
                                                                    if (row.project_id) {
                                                                        navigateToProjectOverview(row.project_id);
                                                                    }
                                                                }}
                                                                title={`${col} - Click to view Project Overview`}
                                                                style={{
                                                                    padding: 0,
                                                                    border: '1px solid #cbd5e1',
                                                                    backgroundColor: cellBg,
                                                                    cursor: row.project_id ? 'pointer' : 'default',
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
                                                <td 
                                                    onClick={() => {
                                                        if (row.project_id) {
                                                            navigateToProjectOverview(row.project_id);
                                                        }
                                                    }}
                                                    style={{ padding: '6px', border: '1px solid #cbd5e1', textAlign: 'center', cursor: row.project_id ? 'pointer' : 'default' }}
                                                    title="Click to view Project Overview"
                                                >
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
                                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
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
                                                fontSize: '0.88rem',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={() => handleAdminRejectStage(approvalModal.rowIdx!, approvalModal.colName!)}
                                            style={{
                                                flex: 1.2,
                                                padding: '12px',
                                                backgroundColor: '#fee2e2',
                                                color: '#dc2626',
                                                border: '1.5px solid #fca5a5',
                                                borderRadius: '10px',
                                                fontWeight: 700,
                                                fontSize: '0.88rem',
                                                cursor: 'pointer'
                                            }}
                                            title="Reject stage and return to In Progress (Ongoing) for rework"
                                        >
                                            ✕ Reject (Rework)
                                        </button>
                                        <button
                                            onClick={() => handleAdminAcceptStage(approvalModal.rowIdx!, approvalModal.colName!)}
                                            style={{
                                                flex: 1.5,
                                                padding: '12px',
                                                backgroundColor: '#16a34a',
                                                color: '#ffffff',
                                                border: 'none',
                                                borderRadius: '10px',
                                                fontWeight: 700,
                                                fontSize: '0.88rem',
                                                cursor: 'pointer',
                                                boxShadow: '0 4px 6px -1px rgba(22, 163, 74, 0.2)'
                                            }}
                                        >
                                            ✓ Accept &amp; Turn Green
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
