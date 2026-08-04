import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    TrendingUp, 
    BarChart3, 
    PieChart, 
    Target, 
    Users, 
    Loader2, 
    Briefcase,
    Activity,
    Award,
    TrendingDown,
    Search,
    Sliders,
    Zap,
    Crown,
    CheckCircle2
} from 'lucide-react';
import { API_BASE_URL } from '../config';
import { useAuth } from '../hooks/useAuth';

interface Lead {
    lead_id: number;
    client_name: string;
    contact_number: string;
    email: string;
    location: string;
    estimated_budget: string | number | null;
    project_type: string;
    lead_source: string;
    status: 'enquiry' | 'proposal_sent' | 'won' | 'lost';
    created_by: number;
    assigned_to: number | null;
    created_at: string;
}

interface UserMember {
    user_id: string;
    name: string;
    role: string;
    status: string;
}

export const Reports: React.FC = () => {
    const { user: currentUser } = useAuth();
    const [leads, setLeads] = useState<Lead[]>([]);
    const [users, setUsers] = useState<UserMember[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Tabs state: 'overview' | 'leaderboard' | 'simulator'
    const [activeTab, setActiveTab] = useState<'overview' | 'leaderboard' | 'simulator'>('overview');
    
    // Filters
    const [selectedUserId, setSelectedUserId] = useState<string>('all');
    const [timeRange, setTimeRange] = useState<'all' | 'month' | 'quarter' | 'year'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    
    // Custom target in count (number of won leads milestone)
    const [monthlyWonTarget, setMonthlyWonTarget] = useState<number>(5);
    
    // Simulator inputs in counts
    const [simLeadsPerMonth, setSimLeadsPerMonth] = useState<number>(20);
    const [simConversionRate, setSimConversionRate] = useState<number>(25);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch Leads
                const leadsRes = await axios.get(`${API_BASE_URL}/leads`);
                const rawLeads = Array.isArray(leadsRes.data.data) ? leadsRes.data.data : (Array.isArray(leadsRes.data) ? leadsRes.data : []);
                setLeads(rawLeads);

                // Fetch Users
                const usersRes = await axios.get(`${API_BASE_URL}/users`);
                if (usersRes.data.success) {
                    setUsers(usersRes.data.data.filter((u: any) => u.status === 'active'));
                }
            } catch (err) {
                console.error('Failed to fetch reports data:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Filter leads based on selected user & time
    const filteredLeads = leads.filter(lead => {
        // User filter
        let matchesUser = true;
        if (selectedUserId !== 'all') {
            matchesUser = String(lead.created_by) === selectedUserId || String(lead.assigned_to) === selectedUserId;
        } else if (currentUser?.role !== 'admin' && currentUser?.role !== 'project_manager') {
            matchesUser = String(lead.created_by) === String(currentUser?.user_id) || String(lead.assigned_to) === String(currentUser?.user_id);
        }

        // Time range filter
        let matchesTime = true;
        if (timeRange !== 'all') {
            const leadDate = new Date(lead.created_at);
            const now = new Date();
            if (timeRange === 'month') {
                matchesTime = leadDate.getMonth() === now.getMonth() && leadDate.getFullYear() === now.getFullYear();
            } else if (timeRange === 'quarter') {
                const diffTime = Math.abs(now.getTime() - leadDate.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                matchesTime = diffDays <= 90;
            } else if (timeRange === 'year') {
                matchesTime = leadDate.getFullYear() === now.getFullYear();
            }
        }

        // Search filter
        let matchesSearch = true;
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            matchesSearch = 
                (lead.client_name || '').toLowerCase().includes(term) ||
                (lead.project_type || '').toLowerCase().includes(term) ||
                (lead.location || '').toLowerCase().includes(term);
        }

        return matchesUser && matchesTime && matchesSearch;
    });

    const getSelectedUserName = () => {
        if (selectedUserId === 'all') return 'All Representatives';
        const found = users.find(u => String(u.user_id) === selectedUserId);
        return found ? found.name : 'Representative';
    };

    // Lead Volume Metrics
    const totalLeads = filteredLeads.length;
    
    const wonCount = filteredLeads.filter(l => l.status === 'won').length;
    const proposalSentCount = filteredLeads.filter(l => l.status === 'proposal_sent').length;
    const enquiryCount = filteredLeads.filter(l => l.status === 'enquiry').length;
    const lostCount = filteredLeads.filter(l => l.status === 'lost').length;
    const pendingCount = enquiryCount + proposalSentCount;

    const conversionRate = totalLeads > 0 ? (wonCount / totalLeads) * 100 : 0;
    const targetAchievementRate = monthlyWonTarget > 0 ? (wonCount / monthlyWonTarget) * 100 : 0;

    // Leaderboard calculations (sales people ranked by won leads count)
    const getLeaderboard = () => {
        const board = users.map(u => {
            const uLeads = leads.filter(l => String(l.created_by) === String(u.user_id) || String(l.assigned_to) === String(u.user_id));
            const uWon = uLeads.filter(l => l.status === 'won');
            const uConvRate = uLeads.length > 0 ? (uWon.length / uLeads.length) * 100 : 0;
            return {
                user_id: u.user_id,
                name: u.name,
                role: u.role,
                totalLeads: uLeads.length,
                wonCount: uWon.length,
                conversionRate: uConvRate
            };
        }).filter(u => u.totalLeads > 0); // Only active users with leads
        
        // Rank strictly by won Count descending
        return board.sort((a, b) => b.wonCount - a.wonCount || b.totalLeads - a.totalLeads);
    };

    // Calculate dynamic 6-month historical trend based on lead counts
    const getMonthlyTrend = () => {
        const trend = [];
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const mLabel = d.toLocaleString('default', { month: 'short' });
            const mYear = d.getFullYear();
            
            const monthLeads = leads.filter(l => {
                const lDate = new Date(l.created_at);
                return lDate.getMonth() === d.getMonth() && lDate.getFullYear() === d.getFullYear();
            });
            const wonLeadsCount = monthLeads.filter(l => l.status === 'won').length;
            
            trend.push({
                label: `${mLabel}`,
                totalCount: monthLeads.length,
                wonCount: wonLeadsCount
            });
        }
        return trend;
    };

    const trendData = getMonthlyTrend();
    const maxLeadsVal = Math.max(...trendData.map(t => t.totalCount), 5); // Fallback max to prevent division by zero

    // Simulator outputs
    const simProjectedWonPerMonth = (simLeadsPerMonth * (simConversionRate / 100));

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
                <Loader2 className="animate-spin" size={40} color="#3b82f6" />
            </div>
        );
    }

    return (
        <div className="dashboard-content" style={{ padding: '30px', fontFamily: "'Outfit', sans-serif", color: '#1e293b', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
            
            {/* Top Glassmorphic Title */}
            <div style={{
                background: 'rgba(255, 255, 255, 0.75)',
                backdropFilter: 'blur(20px)',
                borderRadius: '24px',
                padding: '24px 30px',
                boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.5)',
                marginBottom: '30px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '20px'
            }}>
                <div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>Lead Flow Metrics</span>
                    <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.5px' }}>Reports & Lead Analytics</h2>
                </div>
                
                {/* Tabs */}
                <div style={{ display: 'flex', backgroundColor: '#f1f5f9', padding: '6px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                    <button 
                        onClick={() => setActiveTab('overview')}
                        style={{
                            padding: '10px 20px',
                            borderRadius: '12px',
                            border: 'none',
                            fontWeight: 700,
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            backgroundColor: activeTab === 'overview' ? 'white' : 'transparent',
                            color: activeTab === 'overview' ? '#3b82f6' : '#64748b',
                            boxShadow: activeTab === 'overview' ? '0 10px 20px -5px rgba(59, 130, 246, 0.15)' : 'none'
                        }}
                    >
                        Pipeline Overview
                    </button>
                    <button 
                        onClick={() => setActiveTab('leaderboard')}
                        style={{
                            padding: '10px 20px',
                            borderRadius: '12px',
                            border: 'none',
                            fontWeight: 700,
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            backgroundColor: activeTab === 'leaderboard' ? 'white' : 'transparent',
                            color: activeTab === 'leaderboard' ? '#3b82f6' : '#64748b',
                            boxShadow: activeTab === 'leaderboard' ? '0 10px 20px -5px rgba(59, 130, 246, 0.15)' : 'none'
                        }}
                    >
                        Representative Standings
                    </button>
                    <button 
                        onClick={() => setActiveTab('simulator')}
                        style={{
                            padding: '10px 20px',
                            borderRadius: '12px',
                            border: 'none',
                            fontWeight: 700,
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            backgroundColor: activeTab === 'simulator' ? 'white' : 'transparent',
                            color: activeTab === 'simulator' ? '#3b82f6' : '#64748b',
                            boxShadow: activeTab === 'simulator' ? '0 10px 20px -5px rgba(59, 130, 246, 0.15)' : 'none'
                        }}
                    >
                        Conversion Simulator
                    </button>
                </div>
            </div>

            {activeTab === 'overview' && (
                <>
                    {/* Filters */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '24px', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ fontSize: '0.95rem', color: '#64748b' }}>
                            Representative: <span style={{ fontWeight: 700, color: '#0f172a' }}>{getSelectedUserName()}</span>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            <select
                                value={timeRange}
                                onChange={(e) => setTimeRange(e.target.value as any)}
                                style={{
                                    padding: '10px 16px',
                                    borderRadius: '12px',
                                    border: '1.5px solid #cbd5e1',
                                    backgroundColor: 'white',
                                    fontWeight: 600,
                                    outline: 'none',
                                    cursor: 'pointer'
                                }}
                            >
                                <option value="all">All Time</option>
                                <option value="month">This Month</option>
                                <option value="quarter">Last 90 Days</option>
                                <option value="year">This Year</option>
                            </select>

                            {(currentUser?.role === 'admin' || currentUser?.role === 'project_manager') && (
                                <select
                                    value={selectedUserId}
                                    onChange={(e) => setSelectedUserId(e.target.value)}
                                    style={{
                                        padding: '10px 16px',
                                        borderRadius: '12px',
                                        border: '1.5px solid #cbd5e1',
                                        backgroundColor: 'white',
                                        fontWeight: 600,
                                        outline: 'none',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <option value="all">All Representatives</option>
                                    {users.map(u => (
                                        <option key={u.user_id} value={u.user_id}>{u.name} ({u.role.toUpperCase()})</option>
                                    ))}
                                </select>
                            )}
                        </div>
                    </div>

                    {/* Volume Metrics Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '24px', marginBottom: '30px' }}>
                        
                        {/* Total Leads */}
                        <div style={{ background: 'white', borderRadius: '20px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 10px rgba(0,0,0,0.01)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Leads</span>
                                <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#e0f2fe', color: '#0369a1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Briefcase size={18} />
                                </div>
                            </div>
                            <h3 style={{ fontSize: '2.2rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>{totalLeads}</h3>
                            <span style={{ fontSize: '0.78rem', color: '#64748b', display: 'block', marginTop: '6px' }}>Leads processed all-time</span>
                        </div>

                        {/* Won Leads */}
                        <div style={{ background: 'white', borderRadius: '20px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 10px rgba(0,0,0,0.01)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Won & Converted</span>
                                <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Award size={18} />
                                </div>
                            </div>
                            <h3 style={{ fontSize: '2.2rem', fontWeight: 800, color: '#10b981', margin: 0 }}>{wonCount}</h3>
                            <span style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 700, display: 'block', marginTop: '6px' }}>
                                {conversionRate.toFixed(1)}% Conversion Rate
                            </span>
                        </div>

                        {/* Open Pipeline */}
                        <div style={{ background: 'white', borderRadius: '20px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 10px rgba(0,0,0,0.01)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Open Pipeline</span>
                                <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#fff7ed', color: '#c2410c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Activity size={18} />
                                </div>
                            </div>
                            <h3 style={{ fontSize: '2.2rem', fontWeight: 800, color: '#f97316', margin: 0 }}>{pendingCount}</h3>
                            <span style={{ fontSize: '0.78rem', color: '#64748b', display: 'block', marginTop: '6px' }}>
                                Enquiry ({enquiryCount}) • Proposal ({proposalSentCount})
                            </span>
                        </div>

                        {/* Lost / Dead */}
                        <div style={{ background: 'white', borderRadius: '20px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 10px rgba(0,0,0,0.01)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Lost / Dead</span>
                                <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#fee2e2', color: '#991b1b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <TrendingDown size={18} />
                                </div>
                            </div>
                            <h3 style={{ fontSize: '2.2rem', fontWeight: 800, color: '#ef4444', margin: 0 }}>{lostCount}</h3>
                            <span style={{ fontSize: '0.78rem', color: '#64748b', display: 'block', marginTop: '6px' }}>Inactive or dropped leads</span>
                        </div>
                    </div>

                    {/* Chart & Status Breakdown */}
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '30px', alignItems: 'stretch' }}>
                        
                        {/* Dynamic Lead Volume Trend Chart */}
                        <div style={{
                            background: 'white',
                            borderRadius: '24px',
                            padding: '24px',
                            boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.02)',
                            border: '1px solid #e2e8f0',
                            display: 'flex',
                            flexDirection: 'column'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                <div>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Lead Creation Volume Trend</h3>
                                    <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '2px 0 0 0' }}>Number of leads added per month</p>
                                </div>
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#3b82f6', backgroundColor: '#eff6ff', padding: '4px 10px', borderRadius: '12px' }}>Last 6 Months</span>
                            </div>

                            {/* Custom Bar Chart */}
                            <div style={{ flex: 1, position: 'relative', minHeight: '220px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                                <div style={{ 
                                    display: 'flex', 
                                    alignItems: 'flex-end', 
                                    justifyContent: 'space-around', 
                                    height: '200px', 
                                    padding: '20px 10px 10px 10px',
                                    borderBottom: '1px solid #e2e8f0',
                                    marginBottom: '10px'
                                }}>
                                    {trendData.map((t, idx) => {
                                        const pct = maxLeadsVal > 0 ? (t.totalCount / maxLeadsVal) * 140 : 0;
                                        const isThisMonth = idx === 5;
                                        const isLastMonth = idx === 4;
                                        
                                        let barBg = 'linear-gradient(to top, #cbd5e1, #e2e8f0)'; // default zero leads
                                        if (t.totalCount > 0) {
                                            if (isThisMonth) {
                                                barBg = 'linear-gradient(to top, #2563eb, #60a5fa)';
                                            } else if (isLastMonth) {
                                                barBg = 'linear-gradient(to top, #4f46e5, #818cf8)';
                                            } else {
                                                barBg = 'linear-gradient(to top, #475569, #64748b)';
                                            }
                                        }

                                        return (
                                            <div key={idx} style={{ 
                                                display: 'flex', 
                                                flexDirection: 'column', 
                                                alignItems: 'center', 
                                                width: '14%',
                                                height: '100%',
                                                justifyContent: 'flex-end'
                                            }}>
                                                {/* Count tooltip on top */}
                                                <span style={{ 
                                                    fontSize: '0.8rem', 
                                                    fontWeight: 700, 
                                                    color: isThisMonth ? '#2563eb' : (isLastMonth ? '#4f46e5' : '#475569'),
                                                    marginBottom: '8px'
                                                }}>
                                                    {t.totalCount} {t.totalCount === 1 ? 'lead' : 'leads'}
                                                </span>
                                                
                                                {/* Bar pillar */}
                                                <div style={{
                                                    width: '36px',
                                                    height: `${Math.max(6, pct)}px`,
                                                    background: barBg,
                                                    borderRadius: '8px 8px 0 0',
                                                    boxShadow: t.totalCount > 0 ? '0 4px 10px rgba(0,0,0,0.05)' : 'none',
                                                    transition: 'all 0.2s ease',
                                                    cursor: 'pointer'
                                                }}
                                                title={`${t.label}: ${t.totalCount} Leads (Won: ${t.wonCount})`}
                                                />
                                                
                                                {/* Month Label */}
                                                <div style={{ 
                                                    marginTop: '10px', 
                                                    textAlign: 'center',
                                                    fontSize: '0.78rem',
                                                    fontWeight: isThisMonth || isLastMonth ? 700 : 500,
                                                    color: isThisMonth ? '#2563eb' : (isLastMonth ? '#4f46e5' : '#64748b')
                                                }}>
                                                    {t.label}
                                                    {isThisMonth && <span style={{ display: 'block', fontSize: '0.62rem', fontWeight: 600, color: '#3b82f6', marginTop: '1px' }}>(This Month)</span>}
                                                    {isLastMonth && <span style={{ display: 'block', fontSize: '0.62rem', fontWeight: 600, color: '#6366f1', marginTop: '1px' }}>(Last Month)</span>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Pipeline stage distribution */}
                        <div style={{
                            background: 'white',
                            borderRadius: '24px',
                            padding: '24px',
                            boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.02)',
                            border: '1px solid #e2e8f0',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between'
                        }}>
                            <div>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 4px 0' }}>Pipeline Status</h3>
                                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 20px 0' }}>Distribution of leads in pipeline</p>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {/* Won */}
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '5px', fontWeight: 600 }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10b981' }} /> Won & Launched
                                        </span>
                                        <span>{wonCount} ({totalLeads ? ((wonCount / totalLeads) * 100).toFixed(0) : 0}%)</span>
                                    </div>
                                    <div style={{ width: '100%', height: '8px', backgroundColor: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                                        <div style={{ width: `${totalLeads ? (wonCount / totalLeads) * 100 : 0}%`, height: '100%', backgroundColor: '#10b981', borderRadius: '4px' }} />
                                    </div>
                                </div>

                                {/* Proposal Sent */}
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '5px', fontWeight: 600 }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#fbbf24' }} /> Proposal Sent
                                        </span>
                                        <span>{proposalSentCount} ({totalLeads ? ((proposalSentCount / totalLeads) * 100).toFixed(0) : 0}%)</span>
                                    </div>
                                    <div style={{ width: '100%', height: '8px', backgroundColor: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                                        <div style={{ width: `${totalLeads ? (proposalSentCount / totalLeads) * 100 : 0}%`, height: '100%', backgroundColor: '#fbbf24', borderRadius: '4px' }} />
                                    </div>
                                </div>

                                {/* Enquiry */}
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '5px', fontWeight: 600 }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#60a5fa' }} /> Enquiry
                                        </span>
                                        <span>{enquiryCount} ({totalLeads ? ((enquiryCount / totalLeads) * 100).toFixed(0) : 0}%)</span>
                                    </div>
                                    <div style={{ width: '100%', height: '8px', backgroundColor: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                                        <div style={{ width: `${totalLeads ? (enquiryCount / totalLeads) * 100 : 0}%`, height: '100%', backgroundColor: '#60a5fa', borderRadius: '4px' }} />
                                    </div>
                                </div>

                                {/* Lost */}
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '5px', fontWeight: 600 }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#94a3b8' }} /> Lost / Dead
                                        </span>
                                        <span>{lostCount} ({totalLeads ? ((lostCount / totalLeads) * 100).toFixed(0) : 0}%)</span>
                                    </div>
                                    <div style={{ width: '100%', height: '8px', backgroundColor: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                                        <div style={{ width: `${totalLeads ? (lostCount / totalLeads) * 100 : 0}%`, height: '100%', backgroundColor: '#94a3b8', borderRadius: '4px' }} />
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>



                    {/* Lead Standing Table List */}
                    <div style={{
                        background: 'white',
                        borderRadius: '24px',
                        padding: '24px',
                        boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.02)',
                        border: '1px solid #e2e8f0'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Rep's Lead Registry</h3>
                            
                            <div style={{ position: 'relative', width: '240px' }}>
                                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                                <input 
                                    type="text"
                                    placeholder="Search leads by name, location..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px 10px 36px',
                                        borderRadius: '10px',
                                        border: '1.5px solid #e2e8f0',
                                        outline: 'none',
                                        fontSize: '0.85rem'
                                    }}
                                />
                            </div>
                        </div>

                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1.5px solid #f1f5f9', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 700 }}>
                                        <th style={{ padding: '12px 16px' }}>Lead Client</th>
                                        <th style={{ padding: '12px 16px' }}>Project Type</th>
                                        <th style={{ padding: '12px 16px' }}>Site Location</th>
                                        <th style={{ padding: '12px 16px' }}>Scope of Project</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'center' }}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredLeads.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>No leads match the filters.</td>
                                        </tr>
                                    ) : filteredLeads.map((lead) => {
                                        return (
                                            <tr key={lead.lead_id} style={{ borderBottom: '1px solid #f8fafc' }}>
                                                <td style={{ padding: '14px 16px', fontWeight: 600 }}>{lead.client_name}</td>
                                                <td style={{ padding: '14px 16px', color: '#64748b' }}>{lead.project_type || 'General'}</td>
                                                <td style={{ padding: '14px 16px', color: '#64748b' }}>{lead.location}</td>
                                                <td style={{ padding: '14px 16px', color: '#64748b' }}>{(lead as any).project_scope || '--'}</td>
                                                <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                                    <span style={{
                                                        padding: '4px 10px',
                                                        borderRadius: '20px',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 700,
                                                        backgroundColor: lead.status === 'won' ? '#dcfce7' : (lead.status === 'proposal_sent' ? '#fef3c7' : (lead.status === 'lost' ? '#fee2e2' : '#e2e8f0')),
                                                        color: lead.status === 'won' ? '#15803d' : (lead.status === 'proposal_sent' ? '#b45309' : (lead.status === 'lost' ? '#b91c1c' : '#475569')),
                                                    }}>
                                                        {lead.status.replace('_', ' ').toUpperCase()}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {activeTab === 'leaderboard' && (
                <div style={{
                    background: 'white',
                    borderRadius: '24px',
                    padding: '30px',
                    boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.02)',
                    border: '1px solid #e2e8f0'
                }}>
                    <div style={{ marginBottom: '24px' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Crown size={22} style={{ color: '#fbbf24' }} /> Sales Representatives Standings
                        </h3>
                        <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '4px 0 0 0' }}>Representative rankings sorted by the number of closed won leads</p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {getLeaderboard().length === 0 ? (
                            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                                No conversion records found in the database.
                            </div>
                        ) : getLeaderboard().map((rep, idx) => (
                            <div 
                                key={rep.user_id} 
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '20px',
                                    borderRadius: '16px',
                                    backgroundColor: idx === 0 ? '#fffbeb' : '#f8fafc',
                                    border: idx === 0 ? '1px solid #fde68a' : '1px solid #e2e8f0',
                                    boxShadow: idx === 0 ? '0 4px 12px rgba(251, 191, 36, 0.08)' : 'none',
                                    transition: 'transform 0.2s'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    {/* Rank badge */}
                                    <div style={{
                                        width: '36px',
                                        height: '36px',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: 800,
                                        fontSize: '1rem',
                                        backgroundColor: idx === 0 ? '#fbbf24' : (idx === 1 ? '#cbd5e1' : (idx === 2 ? '#d5c295' : '#e2e8f0')),
                                        color: idx === 0 ? 'white' : (idx === 1 ? '#475569' : (idx === 2 ? '#7c2d12' : '#64748b'))
                                    }}>
                                        {idx + 1}
                                    </div>
                                    
                                    <div>
                                        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
                                            {rep.name} {idx === 0 && <Crown size={14} style={{ color: '#fbbf24', marginLeft: '4px', display: 'inline' }} />}
                                        </h4>
                                        <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>{rep.role.toUpperCase()}</span>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '40px', alignItems: 'center' }}>
                                    <div style={{ textAlign: 'right' }}>
                                        <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Conversion Efficiency</span>
                                        <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#3b82f6' }}>{rep.conversionRate.toFixed(1)}%</span>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Total Leads Processed</span>
                                        <span style={{ fontSize: '1.05rem', fontWeight: 700 }}>{rep.totalLeads} Leads</span>
                                    </div>
                                    <div style={{ textAlign: 'right', minWidth: '120px' }}>
                                        <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Won Leads Count</span>
                                        <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#10b981' }}>{rep.wonCount} Won</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'simulator' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '30px', alignItems: 'stretch' }}>
                    
                    {/* Simulator Inputs Card */}
                    <div style={{
                        background: 'white',
                        borderRadius: '24px',
                        padding: '24px',
                        boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.02)',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between'
                    }}>
                        <div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Sliders size={22} style={{ color: '#3b82f6' }} /> Conversion Simulator
                            </h3>
                            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 24px 0' }}>Estimate closed won leads based on generated monthly volume</p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            {/* Sliders */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.88rem', fontWeight: 600 }}>
                                    <span>Leads Added / Month</span>
                                    <span style={{ color: '#3b82f6', fontWeight: 700 }}>{simLeadsPerMonth} Leads</span>
                                </div>
                                <input 
                                    type="range"
                                    min="5"
                                    max="100"
                                    step="5"
                                    value={simLeadsPerMonth}
                                    onChange={(e) => setSimLeadsPerMonth(parseInt(e.target.value))}
                                    style={{ width: '100%', cursor: 'pointer' }}
                                />
                            </div>

                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.88rem', fontWeight: 600 }}>
                                    <span>Conversion Efficiency Rate</span>
                                    <span style={{ color: '#3b82f6', fontWeight: 700 }}>{simConversionRate}%</span>
                                </div>
                                <input 
                                    type="range"
                                    min="5"
                                    max="100"
                                    step="5"
                                    value={simConversionRate}
                                    onChange={(e) => setSimConversionRate(parseInt(e.target.value))}
                                    style={{ width: '100%', cursor: 'pointer' }}
                                />
                            </div>
                        </div>

                        <div style={{ marginTop: '24px', fontSize: '0.8rem', color: '#64748b', display: 'flex', gap: '8px' }}>
                            <span>💡</span>
                            <span>Calculates conversion ratios directly from estimated lead inputs.</span>
                        </div>
                    </div>

                    {/* Simulator Output results */}
                    <div style={{
                        background: '#0f172a',
                        borderRadius: '24px',
                        padding: '30px',
                        color: 'white',
                        boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.05)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between'
                    }}>
                        <div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 6px 0', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Zap size={22} style={{ color: '#fbbf24' }} /> Simulated Conversion Output
                            </h3>
                            <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 24px 0' }}>Simulated volume projections of won leads and projects</p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div style={{ backgroundColor: '#1e293b', padding: '16px 20px', borderRadius: '16px' }}>
                                <span style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', textTransform: 'uppercase' }}>Monthly Generated Volume</span>
                                <h3 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'white', margin: '4px 0 0 0' }}>
                                    {simLeadsPerMonth} Leads / month
                                </h3>
                            </div>

                            <div style={{ backgroundColor: '#1e293b', padding: '16px 20px', borderRadius: '16px', borderLeft: '4px solid #34d399' }}>
                                <span style={{ fontSize: '0.8rem', color: '#34d399', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Projected Won Leads</span>
                                <h3 style={{ fontSize: '2.2rem', fontWeight: 800, color: '#34d399', margin: '4px 0 0 0' }}>
                                    {simProjectedWonPerMonth.toFixed(1)} Won Leads / month
                                </h3>
                            </div>

                            <div style={{ backgroundColor: '#1e293b', padding: '16px 20px', borderRadius: '16px' }}>
                                <span style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', textTransform: 'uppercase' }}>Projected Yearly Won Leads</span>
                                <h3 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#60a5fa', margin: '4px 0 0 0' }}>
                                    {(simProjectedWonPerMonth * 12).toFixed(0)} Won Leads / year
                                </h3>
                            </div>
                        </div>

                        <div style={{ marginTop: '24px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <div style={{ padding: '8px', borderRadius: '10px', backgroundColor: '#fbbf2420', color: '#fbbf24' }}>
                                <Zap size={20} />
                            </div>
                            <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                                If you increase your conversion rate by 10%, you could convert an extra **{(simLeadsPerMonth * 0.1).toFixed(1)}** leads per month!
                            </span>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};
