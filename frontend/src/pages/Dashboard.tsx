import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend
} from 'recharts';
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

const COLORS = ['#253b50', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

export const Dashboard: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState<any>(null);
    const [pendingClaims, setPendingClaims] = useState<any[]>([]);
    const [myTargets, setMyTargets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    useEffect(() => {
        if (user) {
            if (user.role === 'admin') {
                fetchPendingClaims();
            }
            fetchMyTargets();
        }
    }, [user]);

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
            if (res.data.success) {
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
                    row.team_member?.toLowerCase() === user?.name?.toLowerCase() ||
                    row.team_member?.toLowerCase() === user?.username?.toLowerCase()
                );
                setMyTargets(matched);
            }
        } catch (err) {
            console.error('Error fetching my targets', err);
        }
    };

    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>Loading Dashboard...</div>;
    if (!stats) return <div style={{ textAlign: 'center', padding: '50px' }}>Unable to load dashboard data. Please try again.</div>;

    return (
        <div className="dashboard-content">
            <div style={{ marginBottom: '30px' }}>
                <h2 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#253b50' }}>Livincart Project Timelines</h2>
                <p style={{ color: '#6b7280' }}>Welcome back, {user?.name}. Here is the overview of your project timelines.</p>
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

            {/* My Monthly Targets Section */}
            {user && myTargets.length > 0 && (
                <div style={{ marginBottom: '30px' }} className="premium-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#253b50', margin: 0 }}>My Monthly Targets</h3>
                            <span style={{ background: '#fca311', color: '#fff', fontSize: '0.78rem', fontWeight: 700, padding: '2px 8px', borderRadius: '12px' }}>
                                {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
                            </span>
                        </div>
                        <button 
                            onClick={() => navigate('/team-targets')} 
                            style={{ color: '#253b50', fontSize: '0.9rem', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                        >
                            View Team Targets Sheet
                        </button>
                    </div>

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
                </div>
            )}

            {/* Charts section removed */}

            <div style={{ marginTop: '20px' }} className="premium-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Livincart Project Timelines</h3>
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
