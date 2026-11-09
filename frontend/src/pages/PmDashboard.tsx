import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Briefcase, Clock, Users, Receipt, TrendingUp,
    SlidersHorizontal, X, Search, ArrowRight, CheckCircle2, AlertTriangle, Plus, Trash2,
    Check, XCircle, Eye, ShieldCheck
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { API_BASE_URL } from '../config';
import { DashboardFilterBar } from '../components/DashboardFilterBar';
import type { StatementPeriodType, ProjectTypeFilter } from '../components/DashboardFilterBar';

export const PmDashboard: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [stats, setStats] = useState<any>(null);
    const [projects, setProjects] = useState<any[]>([]);
    const [timelineApprovals, setTimelineApprovals] = useState<any[]>([]);
    const [qcApprovals, setQcApprovals] = useState<any[]>([]);
    const [tasks, setTasks] = useState<any[]>([]);
    const [reimbursements, setReimbursements] = useState<any[]>([]);
    const [vendors, setVendors] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [taskForm, setTaskForm] = useState({
        task_title: '',
        description: '',
        project_type: 'interior',
        project_name: '',
        start_date: new Date().toISOString().split('T')[0],
        start_time: '09:00',
        end_date: new Date().toISOString().split('T')[0],
        end_time: '18:00',
        sub_tasks: [{ title: '', start_date: new Date().toISOString().split('T')[0], start_time: '09:00', end_time: '18:00' }]
    });

    const handleAddSubTask = () => {
        setTaskForm(prev => ({
            ...prev,
            sub_tasks: [...prev.sub_tasks, { title: '', start_date: new Date().toISOString().split('T')[0], start_time: '09:00', end_time: '18:00' }]
        }));
    };

    const handleRemoveSubTask = (idx: number) => {
        setTaskForm(prev => ({
            ...prev,
            sub_tasks: prev.sub_tasks.filter((_, i) => i !== idx)
        }));
    };

    const handleSubTaskChange = (idx: number, field: string, value: any) => {
        setTaskForm(prev => {
            const updated = [...prev.sub_tasks];
            updated[idx] = { ...updated[idx], [field]: value };
            return { ...prev, sub_tasks: updated };
        });
    };

    const handleSubmitTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!taskForm.task_title.trim()) return alert('Please enter a task title');
        setSubmitting(true);
        try {
            const payload = {
                user_id: user?.user_id,
                employee_name: user?.name,
                role: user?.role,
                task_title: taskForm.task_title.trim(),
                description: taskForm.description.trim(),
                project_type: taskForm.project_type,
                project_name: taskForm.project_name.trim(),
                start_date: taskForm.start_date,
                end_date: taskForm.end_date,
                sub_tasks: taskForm.sub_tasks.filter(st => st.title.trim() !== '')
            };
            const res = await axios.post(`${API_BASE_URL}/mb-tasks`, payload);
            if (res.data?.success) {
                alert('Task goal proposed successfully!');
                setShowAddModal(false);
                setTaskForm({
                    task_title: '',
                    description: '',
                    project_type: 'interior',
                    project_name: '',
                    start_date: new Date().toISOString().split('T')[0],
                    start_time: '09:00',
                    end_date: new Date().toISOString().split('T')[0],
                    end_time: '18:00',
                    sub_tasks: [{ title: '', start_date: new Date().toISOString().split('T')[0], start_time: '09:00', end_time: '18:00' }]
                });
                fetchAll();
            } else {
                alert(res.data?.message || 'Failed to propose task');
            }
        } catch (err) {
            console.error('Propose task error', err);
            alert('Failed to propose task');
        } finally {
            setSubmitting(false);
        }
    };
    const [showFilters, setShowFilters] = useState(false);
    const [statementPeriod, setStatementPeriod] = useState<StatementPeriodType>('all');
    const [projectType, setProjectType] = useState<ProjectTypeFilter>('all');
    const [customDates, setCustomDates] = useState({ startDate: '', endDate: '' });

    const buildParams = () => {
        let p = `period=${statementPeriod}&project_type=${projectType}`;
        if (statementPeriod === 'custom' && customDates.startDate && customDates.endDate)
            p += `&start_date=${customDates.startDate}&end_date=${customDates.endDate}`;
        return p;
    };

    const matchesPeriod = (dateStr: string) => {
        if (statementPeriod === 'all') return true;
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

    useEffect(() => {
        fetchAll();
    }, [statementPeriod, projectType, customDates, searchQuery]);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [dashRes, projRes, timeRes, taskRes, reimRes, vendRes, qcRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/dashboard?${buildParams()}`),
                axios.get(`${API_BASE_URL}/projects?${buildParams()}`),
                axios.get(`${API_BASE_URL}/controllers/timeline/pending-approvals.php`),
                axios.get(`${API_BASE_URL}/mb-tasks?${buildParams()}`),
                axios.get(`${API_BASE_URL}/reimbursements`, {
                    headers: { 'X-User-Id': user?.user_id, 'X-User-Role': user?.role }
                }),
                axios.get(`${API_BASE_URL}/vendors/global`),
                axios.get(`${API_BASE_URL}/qc/pending-pm-approvals`).catch(() => ({ data: { success: false, data: [] } }))
            ]);
            if (dashRes.data?.success) setStats(dashRes.data.data);
            if (projRes.data?.success) {
                let p = projRes.data.data || [];
                p = p.filter((x: any) => matchesPeriod(x.created_at || ''));
                if (searchQuery) p = p.filter((x: any) => (x.project_name || '').toLowerCase().includes(searchQuery.toLowerCase()));
                setProjects(p.slice(0, 8));
            }
            if (timeRes.data?.success) {
                let a = timeRes.data.data || [];
                if (searchQuery) a = a.filter((x: any) => (x.project_name || '').toLowerCase().includes(searchQuery.toLowerCase()) || (x.task_name || '').toLowerCase().includes(searchQuery.toLowerCase()));
                setTimelineApprovals(a);
            }
            if (qcRes.data?.success) {
                let q = qcRes.data.data || [];
                if (searchQuery) q = q.filter((x: any) => (x.project_name || '').toLowerCase().includes(searchQuery.toLowerCase()) || (x.name || '').toLowerCase().includes(searchQuery.toLowerCase()));
                setQcApprovals(q);
            }
            if (taskRes.data?.success) {
                let t = taskRes.data.data || [];
                t = t.filter((x: any) =>
                    (String(x.user_id) === String(user?.user_id) || (x.employee_name || '').toLowerCase() === (user?.name || '').toLowerCase()) &&
                    matchesPeriod(x.created_at || x.start_date || '')
                );
                if (searchQuery) t = t.filter((x: any) => (x.task_title || '').toLowerCase().includes(searchQuery.toLowerCase()));
                setTasks(t.slice(0, 6));
            }
            if (reimRes.data?.success) {
                let r = reimRes.data.data || [];
                r = r.filter((x: any) =>
                    (String(x.user_id) === String(user?.user_id) || (x.employee_name || '').toLowerCase() === (user?.name || '').toLowerCase()) &&
                    matchesPeriod(x.created_at || '')
                );
                setReimbursements(r.slice(0, 5));
            }
            if (vendRes.data?.success) {
                let v = vendRes.data.data || [];
                if (searchQuery) v = v.filter((x: any) => (x.name || x.vendor_name || '').toLowerCase().includes(searchQuery.toLowerCase()));
                setVendors(v.slice(0, 5));
            }
        } catch (err) {
            console.error('PM Dashboard error', err);
        } finally {
            setLoading(false);
        }
    };

    const handleApproveQC = async (folder: any) => {
        if (!window.confirm(`Confirm Final Approval for ${folder.name || 'this version'} (${folder.project_name})?`)) return;
        try {
            const res = await axios.post(`${API_BASE_URL}/qc/pm-approve`, {
                folder_id: folder.folder_id,
                user_name: user?.name || 'Project Manager'
            });
            if (res.data?.success) {
                alert(res.data.message || 'Version approved successfully by PM!');
                fetchAll();
            } else {
                alert(res.data?.message || 'Failed to approve QC version');
            }
        } catch (err: any) {
            alert(err?.response?.data?.message || 'Error approving QC version');
        }
    };

    const handleRejectQC = async (folder: any) => {
        const reason = window.prompt(`Reject ${folder.name || 'this version'} for ${folder.project_name}?\n\nPlease enter rejection notes for the QC inspector:`, '');
        if (reason === null) return;
        try {
            const res = await axios.post(`${API_BASE_URL}/qc/pm-reject`, {
                folder_id: folder.folder_id,
                user_name: user?.name || 'Project Manager',
                notes: reason.trim()
            });
            if (res.data?.success) {
                alert(res.data.message || 'Version returned back to QC');
                fetchAll();
            } else {
                alert(res.data?.message || 'Failed to reject QC version');
            }
        } catch (err: any) {
            alert(err?.response?.data?.message || 'Error rejecting QC version');
        }
    };

    const handleAcceptTimelineApproval = async (item: any) => {
        try {
            const res = await axios.post(`${API_BASE_URL}/controllers/timeline/pending-approvals.php`, {
                ...item,
                action: 'approve'
            });
            if (res.data?.success) {
                setTimelineApprovals(prev => prev.filter(p => p.id !== item.id));
                fetchAll();
                alert(`✓ Task "${item.task_name}" approved successfully and turned Green!`);
            } else {
                alert(res.data?.message || 'Failed to accept approval');
            }
        } catch (err) {
            alert('Failed to accept timeline approval');
        }
    };

    const handleRejectTimelineApproval = async (item: any) => {
        const reason = window.prompt(
            `Reject Task: "${item.task_name}" for "${item.project_name}"?\n\nThe status will return to In Progress (Ongoing) for the team to make revisions.\n\nOptional note/reason for rejection:`,
            ''
        );
        if (reason === null) return;

        try {
            const res = await axios.post(`${API_BASE_URL}/controllers/timeline/pending-approvals.php`, {
                ...item,
                action: 'reject',
                reason: reason.trim()
            });
            if (res.data?.success) {
                setTimelineApprovals(prev => prev.filter(p => p.id !== item.id));
                fetchAll();
                alert(`✕ Task "${item.task_name}" rejected and returned to In Progress (Ongoing).`);
            } else {
                alert(res.data?.message || 'Failed to reject approval');
            }
        } catch (err) {
            alert('Failed to reject timeline approval');
        }
    };

    const hasActiveFilters = statementPeriod !== 'all' || projectType !== 'all' || searchQuery !== '';

    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', fontSize: '1rem', color: '#64748b' }}>Loading Dashboard...</div>;

    const kpis = [
        { label: 'Active Projects', value: stats?.active_projects ?? projects.length, color: '#fca412', icon: <Briefcase size={22} /> },
        { label: 'QC Approvals', value: qcApprovals.length, color: '#ea580c', icon: <ShieldCheck size={22} /> },
        { label: 'Timeline Approvals', value: timelineApprovals.length, color: '#0c1527', icon: <Clock size={22} /> },
        { label: 'Pending Tasks', value: tasks.filter(t => t.status === 'pending_admin_review').length, color: '#fca412', icon: <AlertTriangle size={22} /> },
        { label: 'My Reimbursements', value: reimbursements.length, color: '#0c1527', icon: <Receipt size={22} /> },
    ];

    return (
        <div className="dashboard-content">
            {/* Header */}
            <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0c1527' }}>Welcome back, {user?.name}</h2>
                    <p style={{ color: '#64748b', margin: 0 }}>Project Manager Dashboard — your projects, approvals, and team tasks.</p>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    {/* Propose Task Goal Button */}
                    <button
                        onClick={() => setShowAddModal(true)}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '9px 16px',
                            borderRadius: 10,
                            backgroundColor: '#fca412',
                            color: '#ffffff',
                            border: 'none',
                            fontSize: '0.85rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(252, 164, 18, 0.3)'
                        }}
                    >
                        <Plus size={16} /> Propose Task Goal
                    </button>

                    {/* Search */}
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: 12, pointerEvents: 'none' }} />
                        <input
                            type="text"
                            placeholder="Search projects, tasks..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            onFocus={e => (e.target.style.borderColor = '#fca412')}
                            onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
                            style={{ paddingLeft: 36, paddingRight: searchQuery ? 36 : 14, paddingTop: 9, paddingBottom: 9, borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.85rem', color: '#0c1527', background: '#f8fafc', outline: 'none', width: 240 }}
                        />
                        {searchQuery && <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: 10, background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex' }}><X size={14} /></button>}
                    </div>
                    {/* Filter toggle */}
                    <button onClick={() => setShowFilters(p => !p)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 10, backgroundColor: showFilters ? '#fca412' : '#0c1527', color: showFilters ? '#fff' : '#fca412', border: '1.5px solid', borderColor: showFilters ? '#fca412' : '#0c1527', fontSize: '0.88rem', fontWeight: 800, cursor: 'pointer', position: 'relative' }}>
                        {showFilters ? <X size={15} /> : <SlidersHorizontal size={15} />}
                        {showFilters ? 'Close' : 'Filters'}
                        {hasActiveFilters && !showFilters && <span style={{ position: 'absolute', top: -5, right: -5, width: 10, height: 10, borderRadius: '50%', backgroundColor: '#fca412', border: '2px solid #fff' }} />}
                    </button>
                </div>
            </div>

            {showFilters && (
                <DashboardFilterBar
                    statementPeriod={statementPeriod}
                    onStatementPeriodChange={(period, custom) => { setStatementPeriod(period); if (custom) setCustomDates(custom); }}
                    projectType={projectType}
                    onProjectTypeChange={setProjectType}
                />
            )}

            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, marginBottom: 30 }}>
                {kpis.map(k => (
                    <div key={k.label} className="premium-card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ padding: 12, borderRadius: 12, backgroundColor: `${k.color}18`, color: k.color }}>{k.icon}</div>
                        <div>
                            <p style={{ fontSize: '0.82rem', color: '#6b7280', margin: 0 }}>{k.label}</p>
                            <h4 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0c1527', margin: 0 }}>{k.value}</h4>
                        </div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
                {/* Projects */}
                <div className="premium-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h3 style={{ fontWeight: 800, fontSize: '1rem', color: '#0c1527', margin: 0 }}>Active Projects</h3>
                        <button onClick={() => navigate('/projects')} style={{ background: 'none', border: 'none', color: '#fca412', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 4 }}>View All <ArrowRight size={14} /></button>
                    </div>
                    {projects.length === 0 ? <p style={{ color: '#94a3b8', fontSize: '0.88rem' }}>No projects found.</p> : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {projects.map((p: any) => (
                                <div key={p.project_id} onClick={() => navigate(`/projects/${p.project_id}`)} style={{ padding: '10px 14px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <p style={{ margin: 0, fontWeight: 700, fontSize: '0.88rem', color: '#0c1527' }}>{p.project_name}</p>
                                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>{p.project_type || 'General'}</p>
                                    </div>
                                    <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: 12, backgroundColor: p.status === 'active' ? '#dcfce7' : '#f1f5f9', color: p.status === 'active' ? '#15803d' : '#64748b', textTransform: 'uppercase' }}>{p.status}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Vendor Related List */}
                <div className="premium-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h3 style={{ fontWeight: 800, fontSize: '1rem', color: '#0c1527', margin: 0 }}>Vendor Related List</h3>
                        <button onClick={() => navigate('/global-vendors')} style={{ background: 'none', border: 'none', color: '#fca412', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 4 }}>View All <ArrowRight size={14} /></button>
                    </div>
                    {vendors.length === 0 ? <p style={{ color: '#94a3b8', fontSize: '0.88rem' }}>No vendors found.</p> : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {vendors.map((v: any) => (
                                <div key={v.vendor_id || v.id} style={{ padding: '10px 14px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <p style={{ margin: 0, fontWeight: 700, fontSize: '0.88rem', color: '#0c1527' }}>{v.name || v.vendor_name}</p>
                                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>{v.category || v.phone || 'Supplier'}</p>
                                    </div>
                                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b' }}>{v.city || 'Vendor'}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* QC Approvals Section */}
            <div className="premium-card" style={{ marginBottom: 24, border: '1.5px solid #fed7aa', backgroundColor: '#ffffff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ShieldCheck size={20} color="#ea580c" />
                        <h3 style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0c1527', margin: 0 }}>
                            🛡️ QC Review Approvals (Pending PM Sign-off)
                        </h3>
                        {qcApprovals.length > 0 && (
                            <span style={{ background: '#ea580c', color: '#ffffff', fontSize: '0.74rem', fontWeight: 800, padding: '2px 8px', borderRadius: 12 }}>
                                {qcApprovals.length} Pending
                            </span>
                        )}
                    </div>
                </div>
                {qcApprovals.length === 0 ? (
                    <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0, textAlign: 'center', padding: '24px 0', backgroundColor: '#fff9f0', borderRadius: '10px', border: '1px dashed #fed7aa' }}>
                        🎉 No QC review versions waiting for PM approval right now.
                    </p>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
                        {qcApprovals.map((q: any) => (
                            <div key={q.folder_id} style={{ padding: '14px 16px', borderRadius: 12, background: '#fff7ed', border: '1.5px solid #fed7aa', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <p 
                                            onClick={() => navigate(`/projects/${q.db_project_id || q.project_id}?tab=quality_check`)}
                                            style={{ margin: 0, fontWeight: 800, fontSize: '0.95rem', color: '#0c1527', cursor: 'pointer', textDecoration: 'underline' }}
                                            title="Click to view Project QC"
                                        >
                                            {q.project_name}
                                        </p>
                                        <p style={{ margin: '3px 0 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                                            Code: <strong>{q.project_code || ('PRJ-' + q.project_id)}</strong>
                                        </p>
                                    </div>
                                    <span style={{ backgroundColor: '#ffedd5', color: '#c2410c', border: '1px solid #fed7aa', padding: '3px 8px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: 800 }}>
                                        {q.name || `Version ${q.version_number}`}
                                    </span>
                                </div>

                                <div style={{ fontSize: '0.76rem', color: '#475569', display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <span>📁 {q.total_files || 1} file(s) approved by QC</span>
                                    {q.created_at && <span>📅 {new Date(q.created_at).toLocaleDateString()}</span>}
                                </div>

                                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                                    <button
                                        onClick={() => navigate(`/projects/${q.db_project_id || q.project_id}?tab=quality_check`)}
                                        style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#334155', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                                    >
                                        <Eye size={13} /> View QC
                                    </button>
                                    <button
                                        onClick={() => handleApproveQC(q)}
                                        style={{ flex: 1.2, padding: '7px 10px', borderRadius: 8, border: 'none', backgroundColor: '#16a34a', color: '#ffffff', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                                    >
                                        <Check size={13} /> PM Approve
                                    </button>
                                    <button
                                        onClick={() => handleRejectQC(q)}
                                        style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: 'none', backgroundColor: '#dc2626', color: '#ffffff', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                                    >
                                        <XCircle size={13} /> Reject
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24 }}>
                {/* Timeline Approvals */}
                <div className="premium-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <h3 style={{ fontWeight: 800, fontSize: '1rem', color: '#0c1527', margin: 0 }}>⏰ Timeline Approvals</h3>
                            {timelineApprovals.length > 0 && (
                                <span style={{ background: '#fca412', color: '#ffffff', fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: 12 }}>
                                    {timelineApprovals.length}
                                </span>
                            )}
                        </div>
                        <button onClick={() => navigate('/project-timelines')} style={{ background: 'none', border: 'none', color: '#fca412', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 4 }}>View All <ArrowRight size={14} /></button>
                    </div>
                    {timelineApprovals.length === 0 ? (
                        <p style={{ color: '#94a3b8', fontSize: '0.88rem', textAlign: 'center', padding: '20px 0' }}>🎉 No pending approvals!</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {timelineApprovals.slice(0, 5).map((a: any, i: number) => (
                                <div 
                                    key={a.id || i} 
                                    style={{ padding: '12px 14px', borderRadius: 10, background: '#fff9f0', border: '1px solid #ffe8c2', display: 'flex', flexDirection: 'column', gap: 8 }}
                                >
                                    <div>
                                        <p 
                                            onClick={() => {
                                                if (a.project_id) {
                                                    const tab = a.type === 'pm' ? 'pm_timeline' : 'timeline';
                                                    try { localStorage.setItem(`active_project_tab_${a.project_id}`, tab); } catch (e) {}
                                                    navigate(`/projects/${a.project_id}?tab=${tab}`);
                                                }
                                            }}
                                            style={{ margin: 0, fontWeight: 800, fontSize: '0.88rem', color: '#0c1527', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: '#cbd5e1' }}
                                            title="Click to view project timeline"
                                        >
                                            {a.project_name}
                                        </p>
                                        <p style={{ margin: '3px 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                                            Task: <strong style={{ color: '#0c1527' }}>{a.task_name}</strong> {a.date ? `· ${a.date}` : ''}
                                        </p>
                                    </div>
                                    
                                    {/* Action Buttons: View, Approve, Reject */}
                                    <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                                        <button
                                            onClick={() => {
                                                if (a.project_id) {
                                                    const tab = a.type === 'pm' ? 'pm_timeline' : 'timeline';
                                                    try { localStorage.setItem(`active_project_tab_${a.project_id}`, tab); } catch (e) {}
                                                    navigate(`/projects/${a.project_id}?tab=${tab}`);
                                                } else {
                                                    navigate('/project-timelines');
                                                }
                                            }}
                                            style={{
                                                flex: 1,
                                                padding: '6px 10px',
                                                borderRadius: 6,
                                                border: '1px solid #cbd5e1',
                                                backgroundColor: '#ffffff',
                                                color: '#334155',
                                                fontSize: '0.75rem',
                                                fontWeight: 700,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: 4
                                            }}
                                            title="View task in timeline"
                                        >
                                            <Eye size={12} /> View
                                        </button>
                                        <button
                                            onClick={() => handleAcceptTimelineApproval(a)}
                                            style={{
                                                flex: 1.2,
                                                padding: '6px 10px',
                                                borderRadius: 6,
                                                border: 'none',
                                                backgroundColor: '#16a34a',
                                                color: '#ffffff',
                                                fontSize: '0.75rem',
                                                fontWeight: 800,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: 4,
                                                boxShadow: '0 1px 3px rgba(22, 163, 74, 0.2)'
                                            }}
                                            title="Approve and mark completed"
                                        >
                                            <Check size={12} /> Approve
                                        </button>
                                        <button
                                            onClick={() => handleRejectTimelineApproval(a)}
                                            style={{
                                                flex: 1.1,
                                                padding: '6px 10px',
                                                borderRadius: 6,
                                                border: '1px solid #fca5a5',
                                                backgroundColor: '#fee2e2',
                                                color: '#dc2626',
                                                fontSize: '0.75rem',
                                                fontWeight: 800,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: 4
                                            }}
                                            title="Reject and send back for rework"
                                        >
                                            <XCircle size={12} /> Reject
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Tasks */}
                <div className="premium-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h3 style={{ fontWeight: 800, fontSize: '1rem', color: '#0c1527', margin: 0 }}>Task List</h3>
                        <button onClick={() => navigate('/mb-tasks')} style={{ background: 'none', border: 'none', color: '#fca412', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 4 }}>View All <ArrowRight size={14} /></button>
                    </div>
                    {tasks.length === 0 ? <p style={{ color: '#94a3b8', fontSize: '0.88rem' }}>No tasks found.</p> : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {tasks.map((t: any) => (
                                <div key={t.id} style={{ padding: '10px 14px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <p style={{ margin: 0, fontWeight: 700, fontSize: '0.85rem', color: '#0c1527' }}>{t.task_title}</p>
                                        <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b' }}>{t.employee_name}</p>
                                    </div>
                                    <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 12, backgroundColor: t.status === 'accepted' ? '#dcfce7' : '#fef3c7', color: t.status === 'accepted' ? '#15803d' : '#92400e' }}>{t.status?.replace(/_/g, ' ')}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Reimbursements */}
                <div className="premium-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h3 style={{ fontWeight: 800, fontSize: '1rem', color: '#0c1527', margin: 0 }}>Reimbursements</h3>
                        <button onClick={() => navigate('/reimbursements')} style={{ background: 'none', border: 'none', color: '#fca412', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 4 }}>View All <ArrowRight size={14} /></button>
                    </div>
                    {reimbursements.length === 0 ? <p style={{ color: '#94a3b8', fontSize: '0.88rem', textAlign: 'center', padding: '20px 0' }}>🎉 No reimbursements!</p> : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {reimbursements.map((r: any) => (
                                <div key={r.id} style={{ padding: '10px 14px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <p style={{ margin: 0, fontWeight: 700, fontSize: '0.85rem', color: '#0c1527' }}>{r.category}</p>
                                        <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b' }}>{r.reason}</p>
                                    </div>
                                    <span style={{ fontWeight: 800, color: '#fca412' }}>₹{parseFloat(r.amount).toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* PROPOSE TARGET GOAL MODAL */}
            {showAddModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
                    <div className="modal-box" style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '600px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid #f1f5f9', backgroundColor: '#ffffff', borderRadius: '16px 16px 0 0' }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Plus style={{ color: '#ea580c' }} /> Propose Target Goal
                            </h2>
                            <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="modal-body" style={{ padding: '24px' }}>
                        <form onSubmit={handleSubmitTask}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                <div style={{ gridColumn: 'span 2' }}>
                                    <label style={{ display: 'block', fontSize: '0.80rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Task / Target Title *</label>
                                    <input
                                        type="text"
                                        value={taskForm.task_title}
                                        onChange={(e) => setTaskForm({ ...taskForm, task_title: e.target.value })}
                                        placeholder="e.g. Host Site Marketing Campaign"
                                        required
                                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.88rem' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.80rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Start Date *</label>
                                    <input
                                        type="date"
                                        value={taskForm.start_date}
                                        onChange={(e) => setTaskForm({ ...taskForm, start_date: e.target.value })}
                                        required
                                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.88rem' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.80rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Start Time</label>
                                    <input
                                        type="time"
                                        value={taskForm.start_time}
                                        onChange={(e) => setTaskForm({ ...taskForm, start_time: e.target.value })}
                                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.88rem' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.80rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>End Date *</label>
                                    <input
                                        type="date"
                                        value={taskForm.end_date}
                                        onChange={(e) => setTaskForm({ ...taskForm, end_date: e.target.value })}
                                        required
                                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.88rem' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.80rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>End Time</label>
                                    <input
                                        type="time"
                                        value={taskForm.end_time}
                                        onChange={(e) => setTaskForm({ ...taskForm, end_time: e.target.value })}
                                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.88rem' }}
                                    />
                                </div>

                                <div style={{ gridColumn: 'span 2' }}>
                                    <label style={{ display: 'block', fontSize: '0.80rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Description / Execution Steps</label>
                                    <textarea
                                        value={taskForm.description}
                                        onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                                        placeholder="Describe deliverables and goals..."
                                        rows={3}
                                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.88rem', resize: 'vertical' }}
                                    />
                                </div>

                                {/* Subtasks builder */}
                                <div style={{ gridColumn: 'span 2', backgroundColor: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                        <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#1e293b' }}>Subtasks</span>
                                        <button
                                            type="button"
                                            onClick={handleAddSubTask}
                                            style={{ backgroundColor: '#ea580c', color: '#ffffff', border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                        >
                                            <Plus size={14} /> Add Subtask
                                        </button>
                                    </div>

                                    {taskForm.sub_tasks.map((st: any, idx: number) => (
                                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 1fr 40px', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                                            <input
                                                type="text"
                                                placeholder={`Subtask Name #${idx + 1}`}
                                                value={st.title}
                                                onChange={(e) => handleSubTaskChange(idx, 'title', e.target.value)}
                                                style={{ padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.80rem' }}
                                            />
                                            <input
                                                type="date"
                                                value={st.start_date}
                                                onChange={(e) => handleSubTaskChange(idx, 'start_date', e.target.value)}
                                                style={{ padding: '7px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.80rem' }}
                                            />
                                            <input
                                                type="time"
                                                value={st.start_time || '09:00'}
                                                onChange={(e) => handleSubTaskChange(idx, 'start_time', e.target.value)}
                                                style={{ padding: '7px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.80rem' }}
                                            />
                                            <input
                                                type="time"
                                                value={st.end_time || '18:00'}
                                                onChange={(e) => handleSubTaskChange(idx, 'end_time', e.target.value)}
                                                style={{ padding: '7px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.80rem' }}
                                            />
                                            {taskForm.sub_tasks.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveSubTask(idx)}
                                                    style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#475569', fontWeight: 700, cursor: 'pointer' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#ea580c', color: '#ffffff', fontWeight: 800, cursor: 'pointer', boxShadow: '0 2px 8px rgba(234,88,12,0.3)' }}
                                >
                                    {submitting ? 'Submitting...' : 'Submit Target Goal'}
                                </button>
                            </div>
                        </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
