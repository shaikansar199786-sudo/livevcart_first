import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    LayoutDashboard,
    CheckCircle2,
    Clock,
    AlertTriangle,
    Layers,
    PlusCircle,
    Calendar,
    ArrowRight,
    TrendingUp,
    FileText,
    Activity,
    XCircle,
    RefreshCw
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { API_BASE_URL } from '../config';
import { DashboardFilterBar } from '../components/DashboardFilterBar';
import type { StatementPeriodType, ProjectTypeFilter } from '../components/DashboardFilterBar';

export const GDDashboard: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [tasks, setTasks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterTimeframe, setFilterTimeframe] = useState<'today' | 'weekly' | 'monthly' | 'all'>('all');
    const [statementPeriod, setStatementPeriod] = useState<StatementPeriodType>('all');
    const [projectType, setProjectType] = useState<ProjectTypeFilter>('all');

    useEffect(() => {
        fetchTasks();
    }, []);

    const fetchTasks = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/gd-tasks`);
            if (res.data.success) {
                setTasks(res.data.data || []);
            }
        } catch (err) {
            console.error('Failed to load GD tasks', err);
        } finally {
            setLoading(false);
        }
    };

    // Filter by timeframe
    const filteredTasks = tasks.filter(t => {
        if (filterTimeframe === 'all') return true;
        const taskDate = new Date(t.created_at || t.target_date);
        const today = new Date();

        if (filterTimeframe === 'today') {
            return taskDate.toDateString() === today.toDateString();
        }
        if (filterTimeframe === 'weekly') {
            const sevenDaysAgo = new Date(today.setDate(today.getDate() - 7));
            return taskDate >= sevenDaysAgo;
        }
        if (filterTimeframe === 'monthly') {
            return taskDate.getMonth() === today.getMonth() && taskDate.getFullYear() === today.getFullYear();
        }
        return true;
    });

    const totalSubmitted = filteredTasks.length;
    const pendingReviewCount = filteredTasks.filter(t => t.status === 'pending_admin_review').length;
    const ongoingCount = filteredTasks.filter(t => t.status === 'accepted' || t.status === 'ongoing').length;
    const pendingCompletionCount = filteredTasks.filter(t => t.status === 'pending_completion_approval').length;
    const completedCount = filteredTasks.filter(t => t.status === 'completed').length;
    const rejectedCount = filteredTasks.filter(t => t.status === 'rejected').length;

    const completionRate = totalSubmitted > 0 ? Math.round((completedCount / totalSubmitted) * 100) : 0;

    return (
        <div style={{ padding: '24px', maxWidth: '1280px', margin: '0 auto', color: '#1e293b' }}>
            {/* Header Banner */}
            <div style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
                borderRadius: '16px',
                padding: '28px 32px',
                color: 'white',
                marginBottom: '28px',
                boxShadow: '0 10px 25px rgba(15, 23, 42, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '20px'
            }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                        <span style={{ backgroundColor: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', padding: '4px 12px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.5px' }}>
                            GRAPHIC DESIGN PORTAL
                        </span>
                        <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>Welcome back, {user?.name || 'Designer'}!</span>
                    </div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, letterSpacing: '-0.5px' }}>
                        Graphic Designer Performance & Task Hub
                    </h1>
                    <p style={{ color: '#cbd5e1', fontSize: '0.9rem', margin: '6px 0 0', maxWidth: '600px' }}>
                        Track daily, weekly, and monthly graphic targets, submit completed work to Admin, and monitor approval notifications.
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                        onClick={fetchTasks}
                        title="Refresh Data"
                        style={{
                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                            color: 'white',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            borderRadius: '10px',
                            padding: '12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* UNIFIED STATEMENT PERIOD & PROJECT TYPE FILTER BAR */}
            <DashboardFilterBar
                statementPeriod={statementPeriod}
                onStatementPeriodChange={(period) => setStatementPeriod(period)}
                projectType={projectType}
                onProjectTypeChange={(type) => setProjectType(type)}
            />

            {/* Timeframe Filter Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Calendar size={18} style={{ color: '#64748b' }} />
                    <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#475569' }}>Timeframe Filter:</span>
                </div>
                <div style={{ display: 'flex', backgroundColor: '#f1f5f9', borderRadius: '10px', padding: '4px', border: '1px solid #e2e8f0' }}>
                    {[
                        { key: 'all', label: 'All Time' },
                        { key: 'today', label: 'Today' },
                        { key: 'weekly', label: 'This Week' },
                        { key: 'monthly', label: 'This Month' }
                    ].map(tf => (
                        <button
                            key={tf.key}
                            onClick={() => setFilterTimeframe(tf.key as any)}
                            style={{
                                border: 'none',
                                padding: '6px 16px',
                                borderRadius: '8px',
                                fontSize: '0.82rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                backgroundColor: filterTimeframe === tf.key ? '#ffffff' : 'transparent',
                                color: filterTimeframe === tf.key ? '#0f172a' : '#64748b',
                                boxShadow: filterTimeframe === tf.key ? '0 2px 5px rgba(0,0,0,0.06)' : 'none'
                            }}
                        >
                            {tf.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* KPI Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '28px' }}>
                {/* Total Submissions */}
                <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Tasks</span>
                        <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#f1f5f9', color: '#0f172a' }}><Layers size={18} /></div>
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a' }}>{totalSubmitted}</div>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px', display: 'block' }}>Submitted work items</span>
                </div>

                {/* Pending Admin Review */}
                <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '20px', border: '1px solid #fef3c7', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#b45309', textTransform: 'uppercase' }}>Pending Review</span>
                        <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#fef3c7', color: '#d97706' }}><Clock size={18} /></div>
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#d97706' }}>{pendingReviewCount}</div>
                    <span style={{ fontSize: '0.75rem', color: '#d97706', marginTop: '4px', display: 'block' }}>Awaiting Admin Acceptance</span>
                </div>

                {/* Active / Ongoing */}
                <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '20px', border: '1px solid #e0f2fe', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase' }}>Active Tasks</span>
                        <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#e0f2fe', color: '#0284c7' }}><Activity size={18} /></div>
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0284c7' }}>{ongoingCount}</div>
                    <span style={{ fontSize: '0.75rem', color: '#0284c7', marginTop: '4px', display: 'block' }}>Accepted & In Progress</span>
                </div>

                {/* Pending Completion Approval */}
                <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '20px', border: '1px solid #fef3c7', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#b45309', textTransform: 'uppercase' }}>Done Approval</span>
                        <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#fef3c7', color: '#b45309' }}><CheckCircle2 size={18} /></div>
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#b45309' }}>{pendingCompletionCount}</div>
                    <span style={{ fontSize: '0.75rem', color: '#b45309', marginTop: '4px', display: 'block' }}>Awaiting Final Admin Signoff</span>
                </div>

                {/* Completed */}
                <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '20px', border: '1px solid #dcfce7', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#15803d', textTransform: 'uppercase' }}>Completed</span>
                        <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#dcfce7', color: '#16a34a' }}><CheckCircle2 size={18} /></div>
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#16a34a' }}>{completedCount}</div>
                    <span style={{ fontSize: '0.75rem', color: '#16a34a', marginTop: '4px', display: 'block' }}>{completionRate}% Completion Rate</span>
                </div>

                {/* Rejections needing revisions */}
                <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '20px', border: '1px solid #fee2e2', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#991b1b', textTransform: 'uppercase' }}>Rejections</span>
                        <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#fee2e2', color: '#dc2626' }}><XCircle size={18} /></div>
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#dc2626' }}>{rejectedCount}</div>
                    <span style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '4px', display: 'block' }}>Needs Revision & Resubmit</span>
                </div>
            </div>

            {/* Quick Actions & Recent Tasks */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                {/* Recent Task Status List */}
                <div style={{ backgroundColor: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <TrendingUp size={18} /> Recent Work Activity
                        </h3>
                        <button
                            onClick={() => navigate('/gd-tasks')}
                            style={{ border: 'none', background: 'none', color: '#2563eb', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                            View All <ArrowRight size={14} />
                        </button>
                    </div>

                    {loading ? (
                        <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>Loading latest tasks...</div>
                    ) : filteredTasks.length === 0 ? (
                        <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8', fontSize: '0.88rem' }}>
                            No target submissions yet. Click "Submit Target Work" to get started!
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {filteredTasks.slice(0, 5).map(task => {
                                const getStatusBadge = (s: string) => {
                                    switch (s) {
                                        case 'accepted':
                                        case 'ongoing':
                                            return <span style={{ backgroundColor: '#e0f2fe', color: '#0369a1', padding: '4px 10px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700 }}>Ongoing</span>;
                                        case 'pending_admin_review':
                                            return <span style={{ backgroundColor: '#fef3c7', color: '#b45309', padding: '4px 10px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700 }}>Pending Review</span>;
                                        case 'pending_completion_approval':
                                            return <span style={{ backgroundColor: '#fef3c7', color: '#d97706', padding: '4px 10px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700 }}>Completion Review</span>;
                                        case 'completed':
                                            return <span style={{ backgroundColor: '#dcfce7', color: '#15803d', padding: '4px 10px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700 }}>Completed</span>;
                                        case 'rejected':
                                            return <span style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '4px 10px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700 }}>Rejected (Needs Fix)</span>;
                                        default:
                                            return <span style={{ backgroundColor: '#f1f5f9', color: '#475569', padding: '4px 10px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700 }}>{s}</span>;
                                    }
                                };

                                return (
                                    <div key={task.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderRadius: '10px', backgroundColor: '#f8fafc', border: '1px solid #f1f5f9' }}>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a' }}>{task.task_title}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px', display: 'flex', gap: '10px' }}>
                                                <span style={{ textTransform: 'uppercase', fontWeight: 600 }}>{task.target_type} target</span>
                                                <span>• {task.target_date || 'No Date'}</span>
                                            </div>
                                        </div>
                                        <div>{getStatusBadge(task.status)}</div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Notifications & Admin Notes Card */}
                <div style={{ backgroundColor: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <AlertTriangle size={18} style={{ color: '#f59e0b' }} /> Admin Feedback & Action Items
                    </h3>

                    {filteredTasks.filter(t => t.status === 'rejected').length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {filteredTasks.filter(t => t.status === 'rejected').map(t => (
                                <div key={t.id} style={{ padding: '14px', borderRadius: '10px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5' }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#991b1b', marginBottom: '4px' }}>
                                        ⚠️ Rejection: {t.task_title}
                                    </div>
                                    <div style={{ fontSize: '0.82rem', color: '#7f1d1d', marginBottom: '8px' }}>
                                        <strong>Admin Note:</strong> {t.rejection_reason || t.admin_notes || 'Please revise your target or attachments and resubmit.'}
                                    </div>
                                    <button
                                        onClick={() => navigate('/gd-tasks')}
                                        style={{
                                            backgroundColor: '#dc2626',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            padding: '6px 12px',
                                            fontSize: '0.78rem',
                                            fontWeight: 700,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Edit & Resubmit Work
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ padding: '30px', textAlign: 'center', color: '#16a34a', backgroundColor: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                            <CheckCircle2 size={32} style={{ margin: '0 auto 8px', color: '#16a34a', display: 'block' }} />
                            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>All Clear! No Rejections</div>
                            <div style={{ fontSize: '0.78rem', color: '#15803d', marginTop: '2px' }}>
                                Your work submissions are cleanly approved by Admin.
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
