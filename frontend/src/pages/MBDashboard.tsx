import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    LayoutDashboard,
    Clock,
    AlertTriangle,
    CheckCircle2,
    Calendar,
    ArrowRight,
    TrendingUp,
    ListTodo
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { API_BASE_URL } from '../config';

export const MBDashboard: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        pending: 0,
        accepted: 0,
        rejected: 0,
        completed: 0,
        delayed: 0
    });
    const [tasks, setTasks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const [statsRes, tasksRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/mb-tasks/summary`),
                axios.get(`${API_BASE_URL}/mb-tasks`)
            ]);

            if (statsRes.data.success) {
                setStats(statsRes.data.data);
            }
            if (tasksRes.data.success) {
                setTasks(tasksRes.data.data || []);
            }
        } catch (err) {
            console.error('Failed to fetch dashboard data', err);
        } finally {
            setLoading(false);
        }
    };

    // Filter out delayed/overdue tasks to show in a warning card
    const delayedTasks = tasks.filter(
        t => ['accepted', 'ongoing'].includes(t.status) && new Date(t.end_date) < new Date()
    );

    const ongoingTasks = tasks.filter(t => t.status === 'ongoing');

    return (
        <div style={{ color: '#1e293b' }}>
            <div style={{ marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#253b50', margin: 0 }}>
                        Welcome back, {user?.name}
                    </h2>
                    <p style={{ color: '#64748b', margin: '4px 0 0 0', fontSize: '0.9rem' }}>
                        Here is a summary of your marketing and business activities.
                    </p>
                </div>
                <button
                    onClick={() => navigate('/mb-tasks')}
                    style={{
                        backgroundColor: '#253b50',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '10px 20px',
                        fontWeight: 700,
                        fontSize: '0.88rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}
                >
                    <ListTodo size={18} /> Manage Task List <ArrowRight size={16} />
                </button>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', fontWeight: 600, color: '#475569' }}>
                    Loading Dashboard...
                </div>
            ) : (
                <div>
                    {/* Stats Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '30px' }}>
                        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: 'rgba(37, 99, 235, 0.1)', color: '#2563eb' }}>
                                <TrendingUp size={24} />
                            </div>
                            <div>
                                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 4px 0', fontWeight: 600 }}>Active / Accepted</p>
                                <h4 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>{stats.accepted}</h4>
                            </div>
                        </div>

                        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: 'rgba(217, 119, 6, 0.1)', color: '#d97706' }}>
                                <Clock size={24} />
                            </div>
                            <div>
                                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 4px 0', fontWeight: 600 }}>Pending Approval</p>
                                <h4 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>{stats.pending}</h4>
                            </div>
                        </div>

                        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: 'rgba(220, 38, 38, 0.1)', color: '#dc2626' }}>
                                <AlertTriangle size={24} />
                            </div>
                            <div>
                                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 4px 0', fontWeight: 600 }}>Rejected Requests</p>
                                <h4 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>{stats.rejected}</h4>
                            </div>
                        </div>

                        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: 'rgba(22, 163, 74, 0.1)', color: '#16a34a' }}>
                                <CheckCircle2 size={24} />
                            </div>
                            <div>
                                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 4px 0', fontWeight: 600 }}>Completed Tasks</p>
                                <h4 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>{stats.completed}</h4>
                            </div>
                        </div>
                    </div>

                    {/* Alerts for Overdue/Delayed Tasks */}
                    {stats.delayed > 0 && (
                        <div style={{ backgroundColor: '#fff5f5', border: '1.5px solid #fecaca', borderRadius: '12px', padding: '20px', marginBottom: '30px' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#991b1b', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <AlertTriangle size={20} /> Attention Required: {stats.delayed} Delayed Task{stats.delayed > 1 ? 's' : ''}
                            </h3>
                            <p style={{ fontSize: '0.88rem', color: '#7f1d1d', margin: '0 0 16px 0' }}>
                                The following tasks have passed their planned completion dates. Please update their progress or complete them.
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {delayedTasks.map((task) => (
                                    <div key={task.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: '12px 16px', borderRadius: '8px', border: '1px solid #fee2e2' }}>
                                        <div>
                                            <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.9rem' }}>{task.task_title}</span>
                                            <span style={{ marginLeft: '8px', fontSize: '0.72rem', color: '#dc2626', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', backgroundColor: '#fee2e2', textTransform: 'uppercase' }}>
                                                {task.status}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.8rem', color: '#dc2626', fontWeight: 600 }}>
                                            <Calendar size={14} /> Deadline was: {new Date(task.end_date).toLocaleDateString('en-IN')}
                                            <button
                                                onClick={() => navigate('/mb-tasks')}
                                                style={{ border: 'none', background: '#dc2626', color: 'white', cursor: 'pointer', padding: '6px 12px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700 }}
                                            >
                                                Update
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '30px', alignItems: 'start' }}>
                        {/* Ongoing Tasks Widget */}
                        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#253b50', margin: '0 0 16px 0', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                                Active Tasks in Progress ({ongoingTasks.length})
                            </h3>
                            {ongoingTasks.length === 0 ? (
                                <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0, textAlign: 'center', padding: '24px 0' }}>
                                    No tasks are currently ongoing. Go to your Task List to start accepted tasks!
                                </p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                    {ongoingTasks.map((task) => (
                                        <div key={task.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                            <div>
                                                <div style={{ fontWeight: 700, color: '#1e293b' }}>{task.task_title}</div>
                                                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                                                    Deadline: {new Date(task.end_date).toLocaleDateString('en-IN')} ({task.duration_days} days)
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => navigate('/mb-tasks')}
                                                style={{ border: '1px solid #253b50', color: '#253b50', background: 'white', padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                                            >
                                                Manage
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Quick Actions Panel */}
                        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#253b50', margin: '0 0 16px 0', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                                Quick Actions
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <button
                                    onClick={() => navigate('/mb-tasks')}
                                    style={{
                                        width: '100%',
                                        backgroundColor: '#253b50',
                                        color: 'white',
                                        border: 'none',
                                        padding: '12px',
                                        borderRadius: '8px',
                                        fontSize: '0.88rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        textAlign: 'center'
                                    }}
                                >
                                    + Propose New Task
                                </button>
                                <button
                                    onClick={() => navigate('/reimbursements')}
                                    style={{
                                        width: '100%',
                                        backgroundColor: '#f1f5f9',
                                        color: '#334155',
                                        border: '1px solid #cbd5e1',
                                        padding: '12px',
                                        borderRadius: '8px',
                                        fontSize: '0.88rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        textAlign: 'center'
                                    }}
                                >
                                    File Reimbursement / Expense
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
