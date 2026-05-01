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
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboardData();
    }, []);

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

    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>Loading Dashboard...</div>;
    if (!stats) return <div style={{ textAlign: 'center', padding: '50px' }}>Unable to load dashboard data. Please try again.</div>;

    return (
        <div className="dashboard-content">
            <div style={{ marginBottom: '30px' }}>
                <h2 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#253b50' }}>Welcome back, {user?.name}</h2>
                <p style={{ color: '#6b7280' }}>Here's what's happening across ARK Architects projects today.</p>
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

            {/* Charts section removed */}

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
