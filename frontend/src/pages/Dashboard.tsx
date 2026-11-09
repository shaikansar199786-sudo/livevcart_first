import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
    Calendar,
    CheckSquare,
    Receipt,
    Target,
    Clock3,
    Search,
    X,
    UserPlus,
    Plus,
    ExternalLink
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { API_BASE_URL } from '../config';
import { DashboardFilterBar } from '../components/DashboardFilterBar';
import type { StatementPeriodType, ProjectTypeFilter } from '../components/DashboardFilterBar';

export const Dashboard: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const loggedUid = String(user?.user_id || (user as any)?.id || '').trim();
    const loggedName = String(user?.name || '').toLowerCase().trim();
    const userRole = String(user?.role || '').toLowerCase().trim();
    const isAdmin = ['admin', 'super_admin', 'administrator', 'superadmin', 'management', 'owner'].includes(userRole) || userRole.includes('admin') || Boolean(user?.is_admin);

    const isSales = userRole === 'sales' || userRole.includes('sales');
    const isDesigner = ['d1', 'd2', 'associate_designer'].includes(userRole) || userRole.includes('designer');
    const isSite = ['site_engineer', 'site_inspector', 'site_inspection'].includes(userRole) || userRole.includes('site');
    const isMmt = userRole === 'mmt' || userRole.includes('mmt');

    // Filter states
    const [statementPeriod, setStatementPeriod] = useState<StatementPeriodType>('all');
    const [projectType, setProjectType] = useState<ProjectTypeFilter>('all');
    const [customDates, setCustomDates] = useState({ startDate: '', endDate: '' });
    const [searchQuery, setSearchQuery] = useState('');

    // Quick Add Lead Modal
    const [showAddLeadModal, setShowAddLeadModal] = useState(false);
    const [savingLead, setSavingLead] = useState(false);
    const [newLeadForm, setNewLeadForm] = useState({
        client_name: '',
        contact_number: '',
        email: '',
        location: '',
        client_address: '',
        project_type: 'Interior Projects',
        project_scope: '2 BHK',
        estimated_budget: ''
    });

    // Quick Propose Task Modal
    const [showAddTaskModal, setShowAddTaskModal] = useState(false);
    const [savingTask, setSavingTask] = useState(false);
    const [newTaskForm, setNewTaskForm] = useState({
        task_title: '',
        description: '',
        project_name: '',
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date().toISOString().split('T')[0]
    });

    // Data states
    const [loading, setLoading] = useState(true);
    const [allLeads, setAllLeads] = useState<any[]>([]);
    const [allTasks, setAllTasks] = useState<any[]>([]);
    const [allReimbursements, setAllReimbursements] = useState<any[]>([]);

    // Period matching helper
    const matchesPeriod = (dateStr?: string) => {
        if (!dateStr || statementPeriod === 'all') return true;
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return true;
        const now = new Date();
        if (statementPeriod === 'last_month') return d >= new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        if (statementPeriod === 'last_3_months') return d >= new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        if (statementPeriod === 'last_6_months') return d >= new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
        if (statementPeriod === 'this_year') return d.getFullYear() === now.getFullYear();
        if (statementPeriod.startsWith('year_')) return d.getFullYear() === parseInt(statementPeriod.replace('year_', ''));
        if (statementPeriod === 'custom' && customDates.startDate && customDates.endDate)
            return d >= new Date(customDates.startDate) && d <= new Date(customDates.endDate + 'T23:59:59');
        return true;
    };

    const buildParams = () => {
        let p = `period=${statementPeriod}&project_type=${projectType}`;
        if (statementPeriod === 'custom' && customDates.startDate && customDates.endDate)
            p += `&start_date=${customDates.startDate}&end_date=${customDates.endDate}`;
        return p;
    };

    const fetchAllData = async () => {
        setLoading(true);
        try {
            const headers = { 'X-User-Id': loggedUid, 'X-User-Role': userRole };

            const [leadsRes, tasksRes, reimbRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/leads?${buildParams()}`).catch(() => ({ data: { success: false, data: [] } })),
                axios.get(`${API_BASE_URL}/mb-tasks?${buildParams()}`).catch(() => ({ data: { success: false, data: [] } })),
                axios.get(`${API_BASE_URL}/reimbursements`, { headers }).catch(() => ({ data: { success: false, data: [] } }))
            ]);

            if (leadsRes.data?.success && Array.isArray(leadsRes.data.data)) {
                setAllLeads(leadsRes.data.data);
            }
            if (tasksRes.data?.success && Array.isArray(tasksRes.data.data)) {
                setAllTasks(tasksRes.data.data);
            }
            if (reimbRes.data?.success && Array.isArray(reimbRes.data.data)) {
                setAllReimbursements(reimbRes.data.data);
            }
        } catch (err) {
            console.error('Error fetching dashboard employee data', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllData();
    }, [statementPeriod, projectType, customDates]);

    // Handle Quick Add Lead
    const handleSaveNewLead = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newLeadForm.client_name.trim()) return alert('Please enter client name');
        if (!newLeadForm.contact_number.trim()) return alert('Please enter contact phone');

        setSavingLead(true);
        try {
            const payload = {
                ...newLeadForm,
                client_name: newLeadForm.client_name.trim(),
                contact_number: newLeadForm.contact_number.trim(),
                email: newLeadForm.email.trim(),
                location: newLeadForm.location.trim(),
                client_address: newLeadForm.client_address.trim(),
                estimated_budget: newLeadForm.estimated_budget || '0',
                created_by: loggedUid,
                assigned_to: loggedUid
            };

            const res = await axios.post(`${API_BASE_URL}/leads`, payload);
            if (res.data?.success) {
                alert('Lead created successfully!');
                setShowAddLeadModal(false);
                setNewLeadForm({
                    client_name: '',
                    contact_number: '',
                    email: '',
                    location: '',
                    client_address: '',
                    project_type: 'Interior Projects',
                    project_scope: '2 BHK',
                    estimated_budget: ''
                });
                fetchAllData();
            } else {
                alert(res.data?.message || 'Failed to create lead');
            }
        } catch (err) {
            console.error(err);
            alert('Error adding lead');
        } finally {
            setSavingLead(false);
        }
    };

    // Handle Quick Task Submission
    const handleSaveNewTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTaskForm.task_title.trim()) return alert('Please enter task title');
        setSavingTask(true);
        try {
            const payload = {
                user_id: loggedUid,
                employee_name: user?.name,
                role: userRole,
                task_title: newTaskForm.task_title.trim(),
                description: newTaskForm.description.trim(),
                project_name: newTaskForm.project_name.trim(),
                start_date: newTaskForm.start_date,
                end_date: newTaskForm.end_date,
                sub_tasks: []
            };
            const res = await axios.post(`${API_BASE_URL}/mb-tasks`, payload);
            if (res.data?.success) {
                alert('Task goal proposed successfully!');
                setShowAddTaskModal(false);
                setNewTaskForm({
                    task_title: '',
                    description: '',
                    project_name: '',
                    start_date: new Date().toISOString().split('T')[0],
                    end_date: new Date().toISOString().split('T')[0]
                });
                fetchAllData();
            } else {
                alert(res.data?.message || 'Failed to propose task');
            }
        } catch (err) {
            console.error(err);
            alert('Error proposing task');
        } finally {
            setSavingTask(false);
        }
    };

    // 1. LEADS
    const myLeadsList = useMemo(() => {
        return allLeads.filter((l: any) => {
            if (!matchesPeriod(l.created_at)) return false;
            if (isAdmin) return true;
            const createdMatch = l.created_by && String(l.created_by) === loggedUid;
            const assignedMatch = l.assigned_to && String(l.assigned_to) === loggedUid;
            return createdMatch || assignedMatch;
        }).map((l: any) => {
            const s = String(l.status || '').toLowerCase();
            const isCompleted = ['won', 'converted'].includes(s);
            const isPresentlyDoing = !isCompleted && !['lost', 'cancelled'].includes(s);
            return { ...l, isPresentlyDoing, isCompleted };
        });
    }, [allLeads, loggedUid, isAdmin, statementPeriod, customDates]);

    const activeLeadsCount = myLeadsList.filter(l => l.isPresentlyDoing).length;
    const wonLeadsCount = myLeadsList.filter(l => l.isCompleted).length;

    // 2. MEETINGS
    const myMeetings = useMemo(() => {
        return allLeads.filter((l: any) => {
            if (!matchesPeriod(l.d1_booking_time || l.mmts_booking_time || l.qc_booking_time || l.created_at)) return false;
            if (isAdmin) return true;

            const d1IdMatch = l.d1_assigned_to && String(l.d1_assigned_to) === loggedUid;
            const d1NameMatch = loggedName && (l.d1_assigned_name || '').toLowerCase().includes(loggedName);

            const adIdMatch = l.associate_designer_assigned_id && String(l.associate_designer_assigned_id) === loggedUid;
            const adNameMatch = loggedName && (l.associate_designer_assigned_name || '').toLowerCase().includes(loggedName);

            const mmtIds = String(l.mmt_assigned_id || '').split(',').map((s: string) => s.trim());
            const mmtNames = String(l.mmt_assigned_name || '').toLowerCase().split(',').map((s: string) => s.trim());
            const mmtMatch = (loggedUid && mmtIds.includes(loggedUid)) || (loggedName && mmtNames.some(n => n.includes(loggedName) || loggedName.includes(n)));

            const qcIds = String(l.site_inspector_assigned_id || '').split(',').map((s: string) => s.trim());
            const qcNames = String(l.site_inspector_assigned_name || '').toLowerCase().split(',').map((s: string) => s.trim());
            const qcMatch = (loggedUid && qcIds.includes(loggedUid)) || (loggedName && qcNames.some(n => n.includes(loggedName) || loggedName.includes(n)));

            const salesMatch = (l.assigned_to && String(l.assigned_to) === loggedUid) || (l.created_by && String(l.created_by) === loggedUid);

            return d1IdMatch || d1NameMatch || adIdMatch || adNameMatch || mmtMatch || qcMatch || salesMatch;
        }).map((l: any) => {
            let type = 'Client Meeting';
            let status = l.status || 'scheduled';
            let meetingTime = l.d1_booking_time || l.booking_time;

            if (isSales) {
                type = 'Sales Consultation';
                status = l.status || 'scheduled';
                meetingTime = l.booking_time || l.d1_booking_time || l.created_at;
            } else if (userRole === 'mmt' || (l.mmts_status && l.mmts_status !== 'unassigned')) {
                type = 'MMTS Measurement';
                status = l.mmts_status || 'booked';
                meetingTime = l.mmts_booking_time || meetingTime;
            } else if (userRole.includes('site') || (l.qc_status && l.qc_status !== 'unassigned')) {
                type = 'Site QC Inspection';
                status = l.qc_status || l.site_inspector_status || 'scheduled';
                meetingTime = l.qc_booking_time || meetingTime;
            } else if (isDesigner) {
                type = 'D1 Consultation';
                status = l.d1_status || l.status || 'scheduled';
                meetingTime = l.d1_booking_time || meetingTime;
            }

            const s = String(status || '').toLowerCase();
            const isCompleted = ['meeting_completed', 'completed', 'won', 'approved', 'converted'].includes(s);
            const isPresentlyDoing = ['in_meeting', 'started', 'scheduled', 'booked', 'in_progress', 'rescheduled'].includes(s) && !isCompleted;

            return { ...l, meetingType: type, effectiveStatus: status, meetingTime, isPresentlyDoing, isCompleted };
        });
    }, [allLeads, loggedUid, loggedName, userRole, isSales, isDesigner, isAdmin, statementPeriod, customDates]);

    const activeMeetingsCount = myMeetings.filter(m => m.isPresentlyDoing).length;
    const completedMeetingsCount = myMeetings.filter(m => m.isCompleted).length;

    // 3. TASKS
    const myTasksList = useMemo(() => {
        return allTasks.filter((t: any) => {
            if (!matchesPeriod(t.start_date || t.created_at)) return false;
            if (isAdmin) return true;
            const uidMatch = loggedUid && String(t.user_id) === loggedUid;
            const nameMatch = loggedName && (t.employee_name || '').toLowerCase().includes(loggedName);
            return uidMatch || nameMatch;
        }).map((t: any) => {
            const s = String(t.status || '').toLowerCase();
            const isCompleted = ['approved', 'completed', 'done'].includes(s);
            const isPresentlyDoing = !isCompleted && !['rejected', 'cancelled'].includes(s);
            return { ...t, isPresentlyDoing, isCompleted };
        });
    }, [allTasks, loggedUid, loggedName, isAdmin, statementPeriod, customDates]);

    const activeTasksCount = myTasksList.filter(t => t.isPresentlyDoing).length;
    const completedTasksCount = myTasksList.filter(t => t.isCompleted).length;

    // 4. REIMBURSEMENTS
    const myReimbursementsList = useMemo(() => {
        return allReimbursements.filter((r: any) => {
            if (!matchesPeriod(r.created_at || r.expense_date)) return false;
            if (isAdmin) return true;
            const uidMatch = loggedUid && (String(r.user_id) === loggedUid || String(r.employee_id) === loggedUid);
            const nameMatch = loggedName && (r.employee_name || '').toLowerCase().includes(loggedName);
            return uidMatch || nameMatch;
        }).map((r: any) => {
            const s = String(r.status || '').toLowerCase();
            const isCompleted = ['approved', 'paid', 'reimbursed'].includes(s);
            const isPresentlyDoing = s === 'pending';
            return { ...r, isPresentlyDoing, isCompleted };
        });
    }, [allReimbursements, loggedUid, loggedName, isAdmin, statementPeriod, customDates]);

    const pendingReimbursementsCount = myReimbursementsList.filter(r => r.isPresentlyDoing).length;
    const approvedReimbursementsCount = myReimbursementsList.filter(r => r.isCompleted).length;
    const pendingReimbursementsAmount = myReimbursementsList.filter(r => r.isPresentlyDoing).reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
    const approvedReimbursementsAmount = myReimbursementsList.filter(r => r.isCompleted).reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);

    // Search filter
    const filteredLeads = useMemo(() => {
        if (!searchQuery.trim()) return myLeadsList;
        return myLeadsList.filter(l => (l.client_name || l.contact_number || l.location || '').toLowerCase().includes(searchQuery.toLowerCase()));
    }, [myLeadsList, searchQuery]);

    const filteredMeetings = useMemo(() => {
        if (!searchQuery.trim()) return myMeetings;
        return myMeetings.filter(m => (m.client_name || m.name || m.meetingType || '').toLowerCase().includes(searchQuery.toLowerCase()));
    }, [myMeetings, searchQuery]);

    const filteredTasks = useMemo(() => {
        if (!searchQuery.trim()) return myTasksList;
        return myTasksList.filter(t => (t.task_title || t.description || t.project_name || '').toLowerCase().includes(searchQuery.toLowerCase()));
    }, [myTasksList, searchQuery]);

    const filteredReimbursements = useMemo(() => {
        if (!searchQuery.trim()) return myReimbursementsList;
        return myReimbursementsList.filter(r => (r.category || r.reason || r.employee_name || '').toLowerCase().includes(searchQuery.toLowerCase()));
    }, [myReimbursementsList, searchQuery]);

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '70vh', color: '#64748b' }}>
                <Clock3 className="animate-spin" size={28} style={{ marginRight: 10, color: '#fca412' }} />
                <span>Loading dashboard...</span>
            </div>
        );
    }

    return (
        <div className="dashboard-content" style={{ paddingBottom: 40 }}>
            {/* Header Greeting */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0c1527', margin: 0 }}>
                            Welcome back, {user?.name}
                        </h2>
                        <span style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '3px 10px',
                            borderRadius: 12,
                            backgroundColor: isSales ? '#ffedd5' : '#fef3c7',
                            color: isSales ? '#c2410c' : '#b45309',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                        }}>
                            {isSales ? 'Sales' : (user?.role?.replace('_', ' ') || 'Staff Member')}
                        </span>
                    </div>
                    <p style={{ color: '#64748b', margin: '4px 0 0 0', fontSize: '0.92rem' }}>
                        Your simple overview — track active leads, completed meetings, tasks, and reimbursements.
                    </p>
                </div>

                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: 12, pointerEvents: 'none' }} />
                        <input
                            type="text"
                            placeholder="Search leads, meetings, tasks..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{
                                paddingLeft: 36,
                                paddingRight: searchQuery ? 36 : 14,
                                paddingTop: 8,
                                paddingBottom: 8,
                                borderRadius: 10,
                                border: '1.5px solid #e2e8f0',
                                fontSize: '0.85rem',
                                color: '#0c1527',
                                background: '#f8fafc',
                                outline: 'none',
                                width: 230
                            }}
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: 10, background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex' }}>
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    {(isSales || isAdmin) && (
                        <button
                            onClick={() => setShowAddLeadModal(true)}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '8px 16px',
                                borderRadius: 10,
                                backgroundColor: '#ea580c',
                                color: '#ffffff',
                                border: 'none',
                                fontSize: '0.85rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                boxShadow: '0 2px 8px rgba(234, 88, 12, 0.25)'
                            }}
                        >
                            <UserPlus size={16} /> Add New Lead
                        </button>
                    )}

                    <button
                        onClick={() => setShowAddTaskModal(true)}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '8px 14px',
                            borderRadius: 10,
                            backgroundColor: '#0c1527',
                            color: '#ffffff',
                            border: 'none',
                            fontSize: '0.85rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                        }}
                    >
                        <Plus size={15} /> Propose Task
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <DashboardFilterBar
                statementPeriod={statementPeriod}
                onStatementPeriodChange={setStatementPeriod}
                projectType={projectType}
                onProjectTypeChange={setProjectType}
            />

            {/* SIMPLE OVERVIEW KPI CARDS: LEADS, MEETINGS, TASKS, REIMBURSEMENTS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 28 }}>
                {/* 1. LEADS CARD */}
                <div
                    onClick={() => navigate('/leads')}
                    className="premium-card"
                    style={{
                        padding: 18,
                        borderRadius: 14,
                        border: '1px solid #e2e8f0',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        background: '#ffffff'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ padding: 10, borderRadius: 12, backgroundColor: '#ffedd5', color: '#ea580c' }}>
                                <Target size={20} />
                            </div>
                            <div>
                                <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0c1527', display: 'block' }}>New Leads</span>
                                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{myLeadsList.length} Total Leads</span>
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
                        <div>
                            <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>🟡 Active / Follow-up</span>
                            <span style={{ fontSize: '1.35rem', fontWeight: 800, color: '#ea580c' }}>{activeLeadsCount}</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>🟢 Won / Converted</span>
                            <span style={{ fontSize: '1.35rem', fontWeight: 800, color: '#16a34a' }}>{wonLeadsCount}</span>
                        </div>
                    </div>
                </div>

                {/* 2. MEETINGS CARD */}
                <div
                    onClick={() => navigate('/leads')}
                    className="premium-card"
                    style={{
                        padding: 18,
                        borderRadius: 14,
                        border: '1px solid #e2e8f0',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        background: '#ffffff'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ padding: 10, borderRadius: 12, backgroundColor: '#fef3c7', color: '#d97706' }}>
                                <Calendar size={20} />
                            </div>
                            <div>
                                <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0c1527', display: 'block' }}>Meetings</span>
                                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{myMeetings.length} Total</span>
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
                        <div>
                            <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>🟡 Scheduled / In-Meeting</span>
                            <span style={{ fontSize: '1.35rem', fontWeight: 800, color: '#d97706' }}>{activeMeetingsCount}</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>🟢 Meetings Completed</span>
                            <span style={{ fontSize: '1.35rem', fontWeight: 800, color: '#16a34a' }}>{completedMeetingsCount}</span>
                        </div>
                    </div>
                </div>

                {/* 3. TASKS CARD */}
                <div
                    onClick={() => navigate('/mb-tasks')}
                    className="premium-card"
                    style={{
                        padding: 18,
                        borderRadius: 14,
                        border: '1px solid #e2e8f0',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        background: '#ffffff'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ padding: 10, borderRadius: 12, backgroundColor: '#dbeafe', color: '#2563eb' }}>
                                <CheckSquare size={20} />
                            </div>
                            <div>
                                <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0c1527', display: 'block' }}>Tasks</span>
                                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{myTasksList.length} Total</span>
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
                        <div>
                            <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>🟡 In Progress</span>
                            <span style={{ fontSize: '1.35rem', fontWeight: 800, color: '#2563eb' }}>{activeTasksCount}</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>🟢 Approved / Done</span>
                            <span style={{ fontSize: '1.35rem', fontWeight: 800, color: '#16a34a' }}>{completedTasksCount}</span>
                        </div>
                    </div>
                </div>

                {/* 4. REIMBURSEMENTS CARD */}
                <div
                    onClick={() => navigate('/reimbursements')}
                    className="premium-card"
                    style={{
                        padding: 18,
                        borderRadius: 14,
                        border: '1px solid #e2e8f0',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        background: '#ffffff'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ padding: 10, borderRadius: 12, backgroundColor: '#dcfce7', color: '#16a34a' }}>
                                <Receipt size={20} />
                            </div>
                            <div>
                                <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0c1527', display: 'block' }}>Reimbursements</span>
                                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{myReimbursementsList.length} Claims</span>
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
                        <div>
                            <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>🟡 Pending ({pendingReimbursementsCount})</span>
                            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ea580c' }}>₹{pendingReimbursementsAmount.toLocaleString()}</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>🟢 Approved ({approvedReimbursementsCount})</span>
                            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#16a34a' }}>₹{approvedReimbursementsAmount.toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* DIRECT OVERVIEW PANELS (CLEAN & STRAIGHTFORWARD - NO TAB BAR BUTTONS) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {/* Row 1: Active Leads & Meetings */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
                    {/* Active Leads Panel */}
                    <div className="premium-card" style={{ padding: 20, borderRadius: 14, background: '#fff', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Target size={18} color="#ea580c" />
                                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0c1527', margin: 0 }}>Active Client Leads</h3>
                            </div>
                            <button onClick={() => navigate('/leads')} style={{ background: 'none', border: 'none', color: '#ea580c', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
                                View All &rarr;
                            </button>
                        </div>
                        {filteredLeads.filter(l => l.isPresentlyDoing).length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '24px 0' }}>
                                <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: 0 }}>No active leads currently.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {filteredLeads.filter(l => l.isPresentlyDoing).slice(0, 5).map((l: any, i: number) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0c1527' }}>{l.client_name}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                                📞 {l.contact_number || 'N/A'} • 📍 {l.location || 'Location'} • {l.project_type || 'Interior'}
                                            </div>
                                        </div>
                                        <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 8px', borderRadius: 10, background: '#ffedd5', color: '#c2410c' }}>
                                            {l.status || 'Active'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Upcoming & Completed Meetings Panel */}
                    <div className="premium-card" style={{ padding: 20, borderRadius: 14, background: '#fff', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Calendar size={18} color="#d97706" />
                                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0c1527', margin: 0 }}>Recent & Scheduled Meetings</h3>
                            </div>
                            <button onClick={() => navigate('/leads')} style={{ background: 'none', border: 'none', color: '#d97706', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
                                View All &rarr;
                            </button>
                        </div>
                        {filteredMeetings.length === 0 ? (
                            <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '24px 0', textAlign: 'center' }}>No meetings found for this period.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {filteredMeetings.slice(0, 5).map((m: any, i: number) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0c1527' }}>{m.client_name}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{m.meetingType} • {m.meetingTime || 'Booked Slot'}</div>
                                        </div>
                                        <span style={{
                                            fontSize: '0.72rem',
                                            fontWeight: 700,
                                            padding: '3px 8px',
                                            borderRadius: 10,
                                            background: m.isCompleted ? '#dcfce7' : '#fef3c7',
                                            color: m.isCompleted ? '#15803d' : '#b45309'
                                        }}>
                                            {m.effectiveStatus}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Row 2: Tasks & Reimbursements */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
                    {/* Tasks Panel */}
                    <div className="premium-card" style={{ padding: 20, borderRadius: 14, background: '#fff', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <CheckSquare size={18} color="#2563eb" />
                                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0c1527', margin: 0 }}>My Active Tasks</h3>
                            </div>
                            <button onClick={() => navigate('/mb-tasks')} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
                                Manage Tasks &rarr;
                            </button>
                        </div>
                        {filteredTasks.length === 0 ? (
                            <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '24px 0', textAlign: 'center' }}>No tasks assigned.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {filteredTasks.slice(0, 5).map((t: any, i: number) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0c1527' }}>{t.task_title}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{t.project_name || 'General'} • Due: {t.end_date || 'N/A'}</div>
                                        </div>
                                        <span style={{
                                            fontSize: '0.72rem',
                                            fontWeight: 700,
                                            padding: '3px 8px',
                                            borderRadius: 10,
                                            background: t.isCompleted ? '#dcfce7' : '#dbeafe',
                                            color: t.isCompleted ? '#15803d' : '#1e40af'
                                        }}>
                                            {t.status?.replace('_', ' ')}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Reimbursements Panel */}
                    <div className="premium-card" style={{ padding: 20, borderRadius: 14, background: '#fff', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Receipt size={18} color="#16a34a" />
                                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0c1527', margin: 0 }}>Recent Reimbursement Claims</h3>
                            </div>
                            <button onClick={() => navigate('/reimbursements')} style={{ background: 'none', border: 'none', color: '#16a34a', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
                                View All &rarr;
                            </button>
                        </div>
                        {filteredReimbursements.length === 0 ? (
                            <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '24px 0', textAlign: 'center' }}>No reimbursement claims submitted yet.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {filteredReimbursements.slice(0, 5).map((r: any, i: number) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0c1527' }}>{r.category || 'Expense'} — ₹{parseFloat(r.amount || 0).toFixed(2)}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Reason: {r.reason || 'N/A'}</div>
                                        </div>
                                        <span style={{
                                            fontSize: '0.72rem',
                                            fontWeight: 700,
                                            padding: '3px 8px',
                                            borderRadius: 10,
                                            background: r.isCompleted ? '#dcfce7' : '#fef3c7',
                                            color: r.isCompleted ? '#15803d' : '#b45309'
                                        }}>
                                            {r.status || 'Pending'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* QUICK ADD LEAD MODAL */}
            {showAddLeadModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                    <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <UserPlus size={20} color="#ea580c" />
                                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0c1527', margin: 0 }}>Add New Client Lead</h3>
                            </div>
                            <button onClick={() => setShowAddLeadModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSaveNewLead} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div>
                                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>Client Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={newLeadForm.client_name}
                                    onChange={e => setNewLeadForm({ ...newLeadForm, client_name: e.target.value })}
                                    placeholder="e.g. Ramesh Kumar"
                                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.88rem' }}
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div>
                                    <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>Phone / Contact *</label>
                                    <input
                                        type="text"
                                        required
                                        value={newLeadForm.contact_number}
                                        onChange={e => setNewLeadForm({ ...newLeadForm, contact_number: e.target.value })}
                                        placeholder="9876543210"
                                        style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.88rem' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>Email</label>
                                    <input
                                        type="email"
                                        value={newLeadForm.email}
                                        onChange={e => setNewLeadForm({ ...newLeadForm, email: e.target.value })}
                                        placeholder="client@gmail.com"
                                        style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.88rem' }}
                                    />
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div>
                                    <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>Project Type</label>
                                    <select
                                        value={newLeadForm.project_type}
                                        onChange={e => setNewLeadForm({ ...newLeadForm, project_type: e.target.value })}
                                        style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.88rem', background: '#fff' }}
                                    >
                                        <option value="Interior Projects">Interior Projects</option>
                                        <option value="Architectural Design">Architectural Design</option>
                                        <option value="Commercial project">Commercial project</option>
                                        <option value="Renovation">Renovation</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>Scope of Work</label>
                                    <select
                                        value={newLeadForm.project_scope}
                                        onChange={e => setNewLeadForm({ ...newLeadForm, project_scope: e.target.value })}
                                        style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.88rem', background: '#fff' }}
                                    >
                                        <option value="1 BHK">1 BHK</option>
                                        <option value="2 BHK">2 BHK</option>
                                        <option value="3 BHK">3 BHK</option>
                                        <option value="Duplex">Duplex</option>
                                        <option value="Villa">Villa</option>
                                        <option value="Commercial Space">Commercial Space</option>
                                        <option value="Full Scope">Full Scope</option>
                                    </select>
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div>
                                    <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>City / Location</label>
                                    <input
                                        type="text"
                                        value={newLeadForm.location}
                                        onChange={e => setNewLeadForm({ ...newLeadForm, location: e.target.value })}
                                        placeholder="e.g. Visakhapatnam"
                                        style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.88rem' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>Estimated Budget (₹)</label>
                                    <input
                                        type="number"
                                        value={newLeadForm.estimated_budget}
                                        onChange={e => setNewLeadForm({ ...newLeadForm, estimated_budget: e.target.value })}
                                        placeholder="e.g. 500000"
                                        style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.88rem' }}
                                    />
                                </div>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>Site Address / Notes</label>
                                <textarea
                                    rows={2}
                                    value={newLeadForm.client_address}
                                    onChange={e => setNewLeadForm({ ...newLeadForm, client_address: e.target.value })}
                                    placeholder="Specific flat number or requirements..."
                                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.88rem' }}
                                />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                                <button
                                    type="button"
                                    onClick={() => setShowAddLeadModal(false)}
                                    style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingLead}
                                    style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: '#ea580c', color: '#fff', fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer' }}
                                >
                                    {savingLead ? 'Saving...' : 'Save Lead'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* QUICK PROPOSE TASK MODAL */}
            {showAddTaskModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                    <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480, padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <CheckSquare size={20} color="#2563eb" />
                                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0c1527', margin: 0 }}>Propose Task Goal</h3>
                            </div>
                            <button onClick={() => setShowAddTaskModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSaveNewTask} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div>
                                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>Task Title *</label>
                                <input
                                    type="text"
                                    required
                                    value={newTaskForm.task_title}
                                    onChange={e => setNewTaskForm({ ...newTaskForm, task_title: e.target.value })}
                                    placeholder="e.g. Complete client floorplan review"
                                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.88rem' }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>Project Name (Optional)</label>
                                <input
                                    type="text"
                                    value={newTaskForm.project_name}
                                    onChange={e => setNewTaskForm({ ...newTaskForm, project_name: e.target.value })}
                                    placeholder="e.g. Skyline Residency"
                                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.88rem' }}
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div>
                                    <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>Start Date</label>
                                    <input
                                        type="date"
                                        value={newTaskForm.start_date}
                                        onChange={e => setNewTaskForm({ ...newTaskForm, start_date: e.target.value })}
                                        style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.88rem' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>End Date</label>
                                    <input
                                        type="date"
                                        value={newTaskForm.end_date}
                                        onChange={e => setNewTaskForm({ ...newTaskForm, end_date: e.target.value })}
                                        style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.88rem' }}
                                    />
                                </div>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>Description</label>
                                <textarea
                                    rows={2}
                                    value={newTaskForm.description}
                                    onChange={e => setNewTaskForm({ ...newTaskForm, description: e.target.value })}
                                    placeholder="Brief details about what needs to be accomplished..."
                                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.88rem' }}
                                />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                                <button
                                    type="button"
                                    onClick={() => setShowAddTaskModal(false)}
                                    style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingTask}
                                    style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: '#0c1527', color: '#fff', fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer' }}
                                >
                                    {savingTask ? 'Submitting...' : 'Submit Task'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
