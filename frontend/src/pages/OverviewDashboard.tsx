import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Briefcase,
    UserPlus,
    TrendingUp,
    ArrowUpRight,
    Clock,
    Package,
    Wallet
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { API_BASE_URL } from '../config';

export const OverviewDashboard: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState<any>(null);
    const [pendingClaims, setPendingClaims] = useState<any[]>([]);
    const [mbPendingTasks, setMbPendingTasks] = useState<any[]>([]);
    const [mbPendingCompletions, setMbPendingCompletions] = useState<any[]>([]);
    const [mbStats, setMbStats] = useState<any>(null);
    const [mbActiveTab, setMbActiveTab] = useState<'proposals' | 'completions'>('proposals');
    const [myTargets, setMyTargets] = useState<any[]>([]);
    const [allProjects, setAllProjects] = useState<any[]>([]);
    const [interiorTrackers, setInteriorTrackers] = useState<any[]>([]);
    const [architecturalTrackers, setArchitecturalTrackers] = useState<any[]>([]);
    const [timelineApprovals, setTimelineApprovals] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboardData();
        fetchProjectsAndTrackers();
        fetchTimelineApprovals();
    }, []);

    useEffect(() => {
        if (user) {
            if (user.role === 'admin') {
                fetchPendingClaims();
                fetchMBTasksAndStats();
            }
            fetchMyTargets();
        }
    }, [user]);

    const fetchMBTasksAndStats = async () => {
        try {
            const [tasksRes, statsRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/mb-tasks`),
                axios.get(`${API_BASE_URL}/mb-tasks/summary`)
            ]);
            if (tasksRes.data?.success) {
                const allTasks = tasksRes.data.data || [];
                setMbPendingTasks(allTasks.filter((t: any) => t.status === 'pending_admin_review'));
                setMbPendingCompletions(allTasks.filter((t: any) => t.status === 'pending_completion_review'));
            }
            if (statsRes.data?.success) {
                setMbStats(statsRes.data.data);
            }
        } catch (err) {
            console.error('Error loading M&B tasks in overview', err);
        }
    };

    const handleAcceptMBTask = async (id: number, notes: string = '') => {
        try {
            const res = await axios.post(`${API_BASE_URL}/mb-tasks/review`, {
                id,
                action: 'accept',
                notes
            });
            if (res.data?.success) {
                alert('Task approved successfully!');
                fetchMBTasksAndStats();
            } else {
                alert(res.data?.message || 'Failed to approve task');
            }
        } catch (err) {
            alert('Failed to approve task.');
        }
    };

    const promptAcceptMBTask = (id: number) => {
        const notes = prompt("Enter approval notes / comments (optional):");
        if (notes === null) return;
        handleAcceptMBTask(id, notes.trim());
    };

    const handleRejectMBTask = async (id: number, reason: string) => {
        try {
            const res = await axios.post(`${API_BASE_URL}/mb-tasks/review`, {
                id,
                action: 'reject',
                notes: reason
            });
            if (res.data?.success) {
                alert('Task rejected successfully!');
                fetchMBTasksAndStats();
            } else {
                alert(res.data?.message || 'Failed to reject task');
            }
        } catch (err) {
            alert('Failed to reject task.');
        }
    };

    const promptRejectMBTask = (id: number) => {
        const reason = prompt("Enter reason for rejection (required):");
        if (!reason || !reason.trim()) return;
        handleRejectMBTask(id, reason.trim());
    };

    const fetchDashboardData = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/dashboard`);
            setStats(response.data.data);
        } catch (err) {
            console.error('Error fetching dashboard stats');
        } finally {
            setLoading(false);
        }
    };

    const fetchPendingClaims = async () => {
        try {
            const headers = { 'X-User-Id': user?.user_id, 'X-User-Role': user?.role };
            const res = await axios.get(`${API_BASE_URL}/reimbursements`, { headers });
            if (res.data?.success) {
                const pending = res.data.data.filter((r: any) => r.status === 'pending');
                setPendingClaims(pending);
            }
        } catch (err) {
            console.error('Error fetching pending claims', err);
        }
    };

    const fetchMyTargets = async () => {
        try {
            const now = new Date();
            const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            const res = await axios.get(`${API_BASE_URL}/team-targets?month=${monthStr}`);
            if (res.data?.success && res.data.data) {
                const matched = res.data.data.filter((row: any) =>
                    row.team_member?.trim().toLowerCase() === user?.name?.trim().toLowerCase() ||
                    row.team_member?.trim().toLowerCase() === user?.username?.trim().toLowerCase()
                );
                setMyTargets(matched);
            }
        } catch (err) {
            console.error('Error fetching my targets', err);
        }
    };

    const fetchProjectsAndTrackers = async () => {
        try {
            const [projRes, intRes, archRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/projects`),
                axios.get(`${API_BASE_URL}/project-trackers?category=interior`),
                axios.get(`${API_BASE_URL}/project-trackers?category=architectural`)
            ]);
            if (projRes.data?.success) setAllProjects(projRes.data.data || []);
            if (intRes.data?.success) setInteriorTrackers(intRes.data.data || []);
            if (archRes.data?.success) setArchitecturalTrackers(archRes.data.data || []);
        } catch (err) {
            console.error('Error loading projects/trackers status in overview', err);
        }
    };

    const fetchTimelineApprovals = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/controllers/timeline/pending-approvals.php`);
            if (res.data?.success) {
                setTimelineApprovals(res.data.data || []);
            }
        } catch (err) {
            console.error('Error fetching pending timeline approvals', err);
        }
    };

    const handleAcceptTimelineApproval = async (item: any) => {
        try {
            const res = await axios.post(`${API_BASE_URL}/controllers/timeline/pending-approvals.php`, item);
            if (res.data?.success) {
                setTimelineApprovals(prev => prev.filter(p => p.id !== item.id));
                fetchTimelineApprovals();
                fetchProjectsAndTrackers();
            } else {
                alert(res.data?.message || 'Failed to accept approval');
            }
        } catch (err) {
            alert('Failed to accept timeline approval');
        }
    };

    const getProjectTrackerStatus = (project: any) => {
        const pId = String(project.project_id);
        const pName = (project.project_name || '').toLowerCase().trim();

        const inInterior = interiorTrackers.find(t =>
            (t.project_id && String(t.project_id) === pId) ||
            (t.project_name && t.project_name.toLowerCase().trim() === pName)
        );

        if (inInterior) {
            return {
                categoryLabel: 'Interior Projects',
                categoryKey: 'interior',
                statusText: 'Active',
                color: '#8b5cf6',
                bg: '#f3e8ff'
            };
        }

        const inArchitectural = architecturalTrackers.find(t =>
            (t.project_id && String(t.project_id) === pId) ||
            (t.project_name && t.project_name.toLowerCase().trim() === pName)
        );

        if (inArchitectural) {
            return {
                categoryLabel: 'Furniture Projects',
                categoryKey: 'architectural',
                statusText: 'Active',
                color: '#3b82f6',
                bg: '#dbeafe'
            };
        }

        return {
            categoryLabel: 'Not Assigned',
            categoryKey: null,
            statusText: 'Need to Start',
            color: '#dc2626',
            bg: '#fee2e2'
        };
    };

    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>Loading Dashboard...</div>;
    if (!stats) return <div style={{ textAlign: 'center', padding: '50px' }}>Unable to load dashboard data. Please try again.</div>;

    return (
        <div className="dashboard-content">
            <div style={{ marginBottom: '30px' }}>
                <h2 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#253b50' }}>Welcome back, {user?.name}</h2>
                <p style={{ color: '#6b7280' }}>Here's what's happening across Livincart Architects projects today.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '30px' }}>
                <div onClick={() => navigate('/projects')} style={{ cursor: 'pointer' }}>
                    <StatCard icon={<Briefcase size={24} />} label="Active Projects" value={stats.active_projects} color="#253b50" />
                </div>
                <div onClick={() => navigate('/leads')} style={{ cursor: 'pointer' }}>
                    <StatCard icon={<UserPlus size={24} />} label="Pending Leads" value={stats.pending_leads} color="#3b82f6" />
                </div>
                <div onClick={() => navigate('/finance')} style={{ cursor: 'pointer' }}>
                    <StatCard icon={<TrendingUp size={24} />} label="Total Income" value={`₹${parseFloat(stats.total_income).toLocaleString()}`} color="#10b981" />
                </div>
                <div onClick={() => navigate('/finance')} style={{ cursor: 'pointer' }}>
                    <StatCard icon={<Wallet size={24} />} label="Site Expenses" value={`₹${parseFloat(stats.total_expense).toLocaleString()}`} color="#ef4444" />
                </div>
            </div>

            {/* Pending Reimbursements Approval Request Section */}
            {user?.role === 'admin' && (
                <div style={{ marginBottom: '30px' }} className="premium-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#253b50', margin: 0 }}>Pending Reimbursement Approvals</h3>
                            {pendingClaims.length > 0 && (
                                <span style={{ background: '#ef4444', color: '#fff', fontSize: '0.78rem', fontWeight: 700, padding: '2px 8px', borderRadius: '12px' }}>
                                    {pendingClaims.length} New
                                </span>
                            )}
                        </div>
                        <button
                            onClick={() => navigate('/staff-reimbursements')}
                            style={{ color: '#253b50', fontSize: '0.9rem', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                        >
                            Manage All Requests
                        </button>
                    </div>

                    {pendingClaims.length === 0 ? (
                        <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0, textAlign: 'center', padding: '20px 0' }}>
                            🎉 All reimbursement requests have been reviewed!
                        </p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {pendingClaims.slice(0, 5).map((claim) => (
                                <div key={claim.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontWeight: 600, color: '#1e293b' }}>{claim.employee_name}</span>
                                            <span style={{ background: '#e2e8f0', color: '#475569', fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: '12px' }}>
                                                {claim.category}
                                            </span>
                                        </div>
                                        <p style={{ color: '#64748b', fontSize: '0.82rem', margin: '4px 0 0 0' }}>
                                            Reason: {claim.reason} • {new Date(claim.created_at).toLocaleDateString('en-IN')}
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#253b50' }}>
                                            ₹{parseFloat(claim.amount).toFixed(2)}
                                        </span>
                                        <button
                                            onClick={() => navigate('/staff-reimbursements')}
                                            style={{ background: '#253b50', color: '#fff', border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                                        >
                                            Review
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {pendingClaims.length > 5 && (
                                <p style={{ fontSize: '0.85rem', color: '#64748b', textAlign: 'center', margin: '8px 0 0 0' }}>
                                    And {pendingClaims.length - 5} more requests waiting.
                                </p>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Marketing & Business Associate Task Approvals Section */}
            {user?.role === 'admin' && (
                <div style={{ marginBottom: '30px' }} className="premium-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#253b50', margin: 0 }}>
                                Marketing & Business Task Approvals
                            </h3>
                            {/* Inner Tab Selector */}
                            <div style={{ display: 'flex', gap: '4px', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <button 
                                    onClick={() => setMbActiveTab('proposals')}
                                    style={{
                                        border: 'none',
                                        backgroundColor: mbActiveTab === 'proposals' ? '#ffffff' : 'transparent',
                                        color: mbActiveTab === 'proposals' ? '#253b50' : '#64748b',
                                        padding: '6px 14px',
                                        borderRadius: '6px',
                                        fontSize: '0.8rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        boxShadow: mbActiveTab === 'proposals' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    Proposals ({mbPendingTasks.length})
                                </button>
                                <button 
                                    onClick={() => setMbActiveTab('completions')}
                                    style={{
                                        border: 'none',
                                        backgroundColor: mbActiveTab === 'completions' ? '#ffffff' : 'transparent',
                                        color: mbActiveTab === 'completions' ? '#253b50' : '#64748b',
                                        padding: '6px 14px',
                                        borderRadius: '6px',
                                        fontSize: '0.8rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        boxShadow: mbActiveTab === 'completions' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    Completions ({mbPendingCompletions.length})
                                </button>
                            </div>
                        </div>
                        {mbStats && (
                            <div style={{ display: 'flex', gap: '12px', fontSize: '0.78rem', fontWeight: 600 }}>
                                <span style={{ color: '#16a34a' }}>Accepted: {mbStats.accepted}</span>
                                <span style={{ color: '#dc2626' }}>Delayed: {mbStats.delayed}</span>
                                <span style={{ color: '#64748b' }}>Completed: {mbStats.completed}</span>
                            </div>
                        )}
                    </div>

                    {mbActiveTab === 'proposals' ? (
                        mbPendingTasks.length === 0 ? (
                            <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0, textAlign: 'center', padding: '30px 0' }}>
                                🎉 No task proposals awaiting review.
                            </p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {mbPendingTasks.map((task) => (
                                    <div key={task.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '12px' }}>
                                        <div style={{ flex: 1, minWidth: '240px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                <span style={{ fontWeight: 700, color: '#1e293b' }}>{task.employee_name}</span>
                                                <span style={{ background: '#253b50', color: '#fff', fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', textTransform: 'capitalize' }}>
                                                    {task.role?.replace('_', ' ')}
                                                </span>
                                            </div>
                                            <h4 style={{ margin: '6px 0 2px 0', fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>
                                                {task.task_title}
                                            </h4>
                                            {task.description && (
                                                <p style={{ color: '#64748b', fontSize: '0.82rem', margin: '0 0 6px 0' }}>
                                                    {task.description}
                                                </p>
                                            )}
                                            {task.sub_tasks && task.sub_tasks.length > 0 && (
                                                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px dashed #e2e8f0', paddingTop: '8px', marginBottom: '6px' }}>
                                                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#4b5563', textTransform: 'uppercase' }}>Subtasks ({task.sub_tasks.length}):</span>
                                                    {task.sub_tasks.map((st: any) => (
                                                        <div key={st.id} style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                                            • {st.title} {st.start_date && `(${new Date(st.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, ${st.duration_days} d)`}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            <p style={{ color: '#475569', fontSize: '0.78rem', margin: 0, fontWeight: 600 }}>
                                                Planned: {new Date(task.start_date).toLocaleDateString('en-IN')} to {new Date(task.end_date).toLocaleDateString('en-IN')} ({task.duration_days} Day{task.duration_days > 1 ? 's' : ''})
                                            </p>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <button
                                                onClick={() => promptAcceptMBTask(task.id)}
                                                style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                                            >
                                                Accept
                                            </button>
                                            <button
                                                onClick={() => promptRejectMBTask(task.id)}
                                                style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                                            >
                                                Reject
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    ) : (
                        mbPendingCompletions.length === 0 ? (
                            <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0, textAlign: 'center', padding: '30px 0' }}>
                                🎉 No completion approvals awaiting review.
                            </p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {mbPendingCompletions.map((task) => (
                                    <div key={task.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'top', padding: '16px', background: '#fcfcfd', borderRadius: '10px', border: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '12px' }}>
                                        <div style={{ flex: 1, minWidth: '240px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                <span style={{ fontWeight: 700, color: '#1e293b' }}>{task.employee_name}</span>
                                                <span style={{ background: '#f59e0b', color: '#fff', fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', textTransform: 'capitalize' }}>
                                                    {task.role?.replace('_', ' ')}
                                                </span>
                                            </div>
                                            <h4 style={{ margin: '6px 0 2px 0', fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>
                                                {task.task_title}
                                            </h4>
                                            {task.description && (
                                                <p style={{ color: '#64748b', fontSize: '0.82rem', margin: '0 0 6px 0' }}>
                                                    {task.description}
                                                </p>
                                            )}
                                            {task.sub_tasks && task.sub_tasks.length > 0 && (
                                                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px dashed #e2e8f0', paddingTop: '8px', marginBottom: '6px' }}>
                                                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#4b5563', textTransform: 'uppercase' }}>Subtasks Checklist ({task.sub_tasks.filter((st: any) => st.status === 'completed').length}/{task.sub_tasks.length}):</span>
                                                    {task.sub_tasks.map((st: any) => (
                                                        <div key={st.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#6b7280' }}>
                                                            <input type="checkbox" checked={st.status === 'completed'} disabled style={{ width: '11px', height: '11px' }} />
                                                            <span style={{ textDecoration: st.status === 'completed' ? 'line-through' : 'none' }}>{st.title}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            <p style={{ color: '#475569', fontSize: '0.78rem', margin: 0, fontWeight: 600 }}>
                                                Dates: {new Date(task.start_date).toLocaleDateString('en-IN')} to {new Date(task.end_date).toLocaleDateString('en-IN')}
                                            </p>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <button
                                                onClick={() => promptApproveMBCompletion(task.id)}
                                                style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                                            >
                                                Approve
                                            </button>
                                            <button
                                                onClick={() => promptRejectMBCompletion(task.id)}
                                                style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                                            >
                                                Reject
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    )}
                </div>
            )}

            {/* My Monthly Targets Section */}
            {user && (
                <div style={{ marginBottom: '30px' }} className="premium-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#253b50', margin: 0 }}>My Monthly Targets</h3>
                            <span style={{ background: '#fca311', color: '#fff', fontSize: '0.78rem', fontWeight: 700, padding: '2px 8px', borderRadius: '12px' }}>
                                {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
                            </span>
                        </div>
                        {user.role === 'admin' && (
                            <button
                                onClick={() => navigate('/team-targets')}
                                style={{ color: '#253b50', fontSize: '0.9rem', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                            >
                                Manage Targets
                            </button>
                        )}
                    </div>

                    {myTargets.length === 0 ? (
                        <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0, textAlign: 'center', padding: '20px 0' }}>
                            No monthly targets have been assigned to you for this month.
                        </p>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                            {myTargets.map((row: any, idx: number) => {
                                let tasks = row.dynamic_tasks || [];
                                if (tasks.length === 0 && (row.task1 || row.task2)) {
                                    tasks = [
                                        { value: row.task1 || '', status: row.task1_status || 'pending' },
                                        { value: row.task2 || '', status: row.task2_status || 'pending' }
                                    ];
                                }
                                tasks = tasks.filter((t: any) => t.value);

                                return (
                                    <div key={row.id || idx} style={{ background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px' }}>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#253b50', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '12px' }}>
                                            🎯 {row.project_name || 'General Targets'}
                                        </div>
                                        {tasks.length === 0 ? (
                                            <p style={{ color: '#64748b', fontSize: '0.82rem', margin: 0 }}>No specific tasks listed.</p>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {tasks.map((task: any, tIdx: number) => {
                                                    const statusStyles: Record<string, { color: string; bg: string }> = {
                                                        done: { color: '#16a34a', bg: '#dcfce7' },
                                                        in_progress: { color: '#d97706', bg: '#fef9c3' },
                                                        pending: { color: '#dc2626', bg: '#fee2e2' }
                                                    };
                                                    const s = statusStyles[task.status] || statusStyles['pending'];
                                                    return (
                                                        <div key={tIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                                                            <span style={{ color: '#334155', fontWeight: 500 }}>{task.value}</span>
                                                            <span style={{
                                                                fontSize: '0.72rem',
                                                                fontWeight: 700,
                                                                padding: '2px 8px',
                                                                borderRadius: '12px',
                                                                color: s.color,
                                                                backgroundColor: s.bg,
                                                                textTransform: 'uppercase'
                                                            }}>
                                                                {task.status?.replace('_', ' ')}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                        {row.deadline && (
                                            <div style={{ fontSize: '0.78rem', color: '#dc2626', marginTop: '12px', fontWeight: 600 }}>
                                                ⏰ Deadline: {row.deadline}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Timeline Pending Approvals Section */}
            <div style={{ marginBottom: '30px' }} className="premium-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#fef9c3', color: '#ca8a04', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                            ⏰
                        </div>
                        <div>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#253b50', margin: 0 }}>
                                Timeline Pending Approvals
                            </h3>
                            <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                                Designer Timeline tasks & stages waiting for Admin review & acceptance
                            </p>
                        </div>
                    </div>
                    {timelineApprovals.length > 0 && (
                        <span style={{ background: '#eab308', color: '#1e293b', fontSize: '0.78rem', fontWeight: 800, padding: '4px 12px', borderRadius: '20px' }}>
                            {timelineApprovals.length} Pending Approval{timelineApprovals.length > 1 ? 's' : ''}
                        </span>
                    )}
                </div>

                {timelineApprovals.length === 0 ? (
                    <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0, textAlign: 'center', padding: '24px 0', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                        🎉 No pending timeline approvals right now. All tasks are up to date!
                    </p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {timelineApprovals.map((item, idx) => (
                            <div key={item.id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: '#fffbe6', borderRadius: '12px', border: '1.5px solid #fef08a' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                    <div style={{ width: '14px', height: '14px', borderRadius: '4px', backgroundColor: '#eab308', flexShrink: 0 }} />
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>{item.project_name}</span>
                                            <span style={{ background: '#eab308', color: '#000', fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: '12px', textTransform: 'uppercase' }}>
                                                Pending Approval
                                            </span>
                                        </div>
                                        <p style={{ color: '#475569', fontSize: '0.83rem', margin: '4px 0 0 0', fontWeight: 600 }}>
                                            Task / Stage: <strong style={{ color: '#0f172a' }}>{item.task_name}</strong> {item.date ? `• Date: ${item.date}` : ''}
                                        </p>
                                    </div>
                                </div>
                                {['admin', 'project_head', 'project_manager', 'manager'].includes(String(user?.role || '').toLowerCase()) || String(user?.role || '').toLowerCase().includes('admin') ? (
                                    <button
                                        onClick={() => handleAcceptTimelineApproval(item)}
                                        style={{
                                            backgroundColor: '#16a34a',
                                            color: '#ffffff',
                                            border: 'none',
                                            padding: '9px 18px',
                                            borderRadius: '8px',
                                            fontSize: '0.85rem',
                                            fontWeight: 800,
                                            cursor: 'pointer',
                                            boxShadow: '0 2px 6px rgba(22, 163, 74, 0.25)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            transition: 'all 0.15s'
                                        }}
                                    >
                                        ✓ Accept & Turn Green
                                    </button>
                                ) : (
                                    <span style={{ fontSize: '0.8rem', color: '#ca8a04', fontWeight: 700 }}>
                                        Awaiting Admin Review
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Project Timelines & Category Status */}
            <div style={{ marginBottom: '30px' }} className="premium-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#253b50', margin: 0 }}>
                        Project Timelines & Category Trackers
                    </h3>
                    <button
                        onClick={() => navigate('/project-timelines')}
                        style={{
                            backgroundColor: '#253b50',
                            color: '#ffffff',
                            border: 'none',
                            padding: '6px 14px',
                            borderRadius: '8px',
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'background-color 0.2s'
                        }}
                    >
                        Go to Project Timelines ➜
                    </button>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid #f1f5f9', textAlign: 'left' }}>
                                <th style={{ padding: '12px 8px', color: '#64748b', fontWeight: 600 }}>Project Name</th>
                                <th style={{ padding: '12px 8px', color: '#64748b', fontWeight: 600 }}>Project Type</th>
                                <th style={{ padding: '12px 8px', color: '#64748b', fontWeight: 600 }}>Timeline Category</th>
                                <th style={{ padding: '12px 8px', color: '#64748b', fontWeight: 600 }}>Assignment Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {allProjects.length === 0 ? (
                                <tr>
                                    <td colSpan={4} style={{ padding: '20px 8px', textAlign: 'center', color: '#64748b' }}>
                                        No active projects registered.
                                    </td>
                                </tr>
                            ) : (
                                allProjects.map((project) => {
                                    const tStat = getProjectTrackerStatus(project);
                                    return (
                                        <tr key={project.project_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                            <td style={{ padding: '12px 8px', fontWeight: 700, color: '#1e293b' }}>
                                                {project.project_name}
                                            </td>
                                            <td style={{ padding: '12px 8px', color: '#475569' }}>
                                                {project.project_type || 'General'}
                                            </td>
                                            <td style={{ padding: '12px 8px', fontWeight: 600, color: tStat.color }}>
                                                {tStat.categoryLabel}
                                            </td>
                                            <td style={{ padding: '12px 8px' }}>
                                                <span style={{
                                                    fontSize: '0.72rem',
                                                    fontWeight: 700,
                                                    padding: '4px 10px',
                                                    borderRadius: '12px',
                                                    color: tStat.color,
                                                    backgroundColor: tStat.bg,
                                                    textTransform: 'uppercase'
                                                }}>
                                                    {tStat.statusText}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div style={{ marginTop: '20px' }} className="premium-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Recent Activities</h3>
                    <button style={{ color: '#3b82f6', fontSize: '0.9rem', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>View All</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <ActivityItem icon={<Package size={16} />} title="New Material Request" time="2 hours ago" desc="Request for 50 Bags of Cement at Project Oasis" />
                    <ActivityItem icon={<ArrowUpRight size={16} />} title="Payment Received" time="5 hours ago" desc="₹50,000 received for Project Skyline Milestone 1" />
                    <ActivityItem icon={<Clock size={16} />} title="Project Milestone" time="Yesterday" desc="Civil work completed for Green Villa Project" />
                </div>
            </div>
        </div>
    );
};

const StatCard = ({ icon, label, value, color }: any) => (
    <div className="premium-card" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: `${color}15`, color: color }}>
            {icon}
        </div>
        <div>
            <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '2px' }}>{label}</p>
            <h4 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1f2937' }}>{value}</h4>
        </div>
    </div>
);

const ActivityItem = ({ icon, title, time, desc }: any) => (
    <div style={{ display: 'flex', gap: '15px', padding: '12px 0', borderBottom: '1px solid #f3f4f6' }}>
        <div style={{ marginTop: '2px', color: '#6b7280' }}>{icon}</div>
        <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{title}</span>
                <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{time}</span>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '2px' }}>{desc}</p>
        </div>
    </div>
);
