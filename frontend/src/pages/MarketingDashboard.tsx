import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { CheckSquare, Receipt, FileText, TrendingUp, SlidersHorizontal, X, Search, ArrowRight, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { API_BASE_URL } from '../config';
import { DashboardFilterBar } from '../components/DashboardFilterBar';
import type { StatementPeriodType, ProjectTypeFilter } from '../components/DashboardFilterBar';

export const MarketingDashboard: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [tasks, setTasks] = useState<any[]>([]);
    const [quotes, setQuotes] = useState<any[]>([]);
    const [reimbursements, setReimbursements] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [statementPeriod, setStatementPeriod] = useState<StatementPeriodType>('all');
    const [projectType, setProjectType] = useState<ProjectTypeFilter>('all');
    const [customDates, setCustomDates] = useState({ startDate: '', endDate: '' });

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

    const buildParams = () => {
        let p = `period=${statementPeriod}&project_type=${projectType}`;
        if (statementPeriod === 'custom' && customDates.startDate && customDates.endDate)
            p += `&start_date=${customDates.startDate}&end_date=${customDates.endDate}`;
        return p;
    };

    useEffect(() => { fetchAll(); }, [statementPeriod, projectType, customDates, searchQuery]);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [taskRes, quotesRes, reimRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/mb-tasks?${buildParams()}`),
                axios.get(`${API_BASE_URL}/quotes`),
                axios.get(`${API_BASE_URL}/reimbursements`, { headers: { 'X-User-Id': user?.user_id, 'X-User-Role': user?.role } })
            ]);
            if (taskRes.data?.success) {
                let t = (taskRes.data.data || []).filter((x: any) =>
                    (x.employee_name || '').toLowerCase() === (user?.name || '').toLowerCase() && matchesPeriod(x.created_at || '')
                );
                if (searchQuery) t = t.filter((x: any) => (x.task_title || '').toLowerCase().includes(searchQuery.toLowerCase()));
                setTasks(t);
            }
            if (quotesRes.data?.success) {
                let q = (quotesRes.data.data || []).filter((x: any) => matchesPeriod(x.created_at || ''));
                if (searchQuery) q = q.filter((x: any) => (x.client_name || '').toLowerCase().includes(searchQuery.toLowerCase()));
                setQuotes(q.slice(0, 6));
            }
            if (reimRes.data?.success) {
                let r = (reimRes.data.data || []).filter((x: any) => matchesPeriod(x.created_at || ''));
                setReimbursements(r.slice(0, 5));
            }
        } catch (err) {
            console.error('Marketing Dashboard error', err);
        } finally {
            setLoading(false);
        }
    };

    const hasActiveFilters = statementPeriod !== 'all' || projectType !== 'all' || searchQuery !== '';
    const pending = tasks.filter(t => ['pending', 'pending_admin_review'].includes(t.status)).length;
    const completed = tasks.filter(t => t.status === 'completed').length;

    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: '#64748b' }}>Loading Dashboard...</div>;

    const kpis = [
        { label: 'My Tasks', value: tasks.length, color: '#fca412', icon: <CheckSquare size={22} /> },
        { label: 'Pending', value: pending, color: '#0c1527', icon: <Clock size={22} /> },
        { label: 'Completed', value: completed, color: '#16a34a', icon: <TrendingUp size={22} /> },
        { label: 'Reimbursements', value: reimbursements.length, color: '#fca412', icon: <Receipt size={22} /> },
    ];

    return (
        <div className="dashboard-content">
            <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0c1527' }}>Welcome back, {user?.name}</h2>
                    <p style={{ color: '#64748b', margin: 0 }}>Marketing Dashboard — tasks, quotes, and reimbursements.</p>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: 12, pointerEvents: 'none' }} />
                        <input type="text" placeholder="Search tasks, quotes..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onFocus={e => (e.target.style.borderColor = '#fca412')} onBlur={e => (e.target.style.borderColor = '#e2e8f0')} style={{ paddingLeft: 36, paddingRight: searchQuery ? 36 : 14, paddingTop: 9, paddingBottom: 9, borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.85rem', color: '#0c1527', background: '#f8fafc', outline: 'none', width: 240 }} />
                        {searchQuery && <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: 10, background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex' }}><X size={14} /></button>}
                    </div>
                    <button onClick={() => setShowFilters(p => !p)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 10, backgroundColor: showFilters ? '#fca412' : '#0c1527', color: showFilters ? '#fff' : '#fca412', border: '1.5px solid', borderColor: showFilters ? '#fca412' : '#0c1527', fontSize: '0.88rem', fontWeight: 800, cursor: 'pointer', position: 'relative' }}>
                        {showFilters ? <X size={15} /> : <SlidersHorizontal size={15} />}
                        {showFilters ? 'Close' : 'Filters'}
                        {hasActiveFilters && !showFilters && <span style={{ position: 'absolute', top: -5, right: -5, width: 10, height: 10, borderRadius: '50%', backgroundColor: '#fca412', border: '2px solid #fff' }} />}
                    </button>
                </div>
            </div>

            {showFilters && <DashboardFilterBar statementPeriod={statementPeriod} onStatementPeriodChange={(period, custom) => { setStatementPeriod(period); if (custom) setCustomDates(custom); }} projectType={projectType} onProjectTypeChange={setProjectType} />}

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
                {/* Tasks */}
                <div className="premium-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h3 style={{ fontWeight: 800, fontSize: '1rem', color: '#0c1527', margin: 0 }}>My Tasks</h3>
                        <button onClick={() => navigate('/mb-tasks')} style={{ background: 'none', border: 'none', color: '#fca412', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 4 }}>View All <ArrowRight size={14} /></button>
                    </div>
                    {tasks.length === 0 ? <p style={{ color: '#94a3b8', fontSize: '0.88rem', textAlign: 'center', padding: '20px 0' }}>No tasks assigned.</p> : tasks.slice(0, 7).map((t: any) => (
                        <div key={t.id} style={{ padding: '9px 12px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div><p style={{ margin: 0, fontWeight: 700, fontSize: '0.85rem', color: '#0c1527' }}>{t.task_title}</p><p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b' }}>{t.target_date ? new Date(t.target_date).toLocaleDateString('en-IN') : '—'}</p></div>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 12, backgroundColor: t.status === 'completed' ? '#dcfce7' : '#fef3c7', color: t.status === 'completed' ? '#15803d' : '#92400e' }}>{t.status?.replace(/_/g, ' ')}</span>
                        </div>
                    ))}
                </div>

                {/* Quotes */}
                <div className="premium-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h3 style={{ fontWeight: 800, fontSize: '1rem', color: '#0c1527', margin: 0 }}>Quotes / Estimations</h3>
                        <button onClick={() => navigate('/quotes')} style={{ background: 'none', border: 'none', color: '#fca412', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 4 }}>View All <ArrowRight size={14} /></button>
                    </div>
                    {quotes.length === 0 ? <p style={{ color: '#94a3b8', fontSize: '0.88rem' }}>No quotes found.</p> : quotes.map((q: any) => (
                        <div key={q.quote_id || q.id} style={{ padding: '9px 12px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div><p style={{ margin: 0, fontWeight: 700, fontSize: '0.85rem', color: '#0c1527' }}>{q.client_name}</p><p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b' }}>{q.project_type || 'Quote'}</p></div>
                            <span style={{ fontWeight: 700, color: '#0c1527', fontSize: '0.88rem' }}>₹{parseFloat(q.grand_total || q.total_amount || 0).toLocaleString()}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Reimbursements */}
            <div className="premium-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ fontWeight: 800, fontSize: '1rem', color: '#0c1527', margin: 0 }}>My Reimbursements</h3>
                    <button onClick={() => navigate('/reimbursements')} style={{ background: 'none', border: 'none', color: '#fca412', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 4 }}>View All <ArrowRight size={14} /></button>
                </div>
                {reimbursements.length === 0 ? <p style={{ color: '#94a3b8', fontSize: '0.88rem', textAlign: 'center', padding: '10px 0' }}>No reimbursements yet.</p> : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                        {reimbursements.map((r: any) => (
                            <div key={r.id} style={{ padding: '10px 14px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div><p style={{ margin: 0, fontWeight: 700, fontSize: '0.85rem', color: '#0c1527' }}>{r.category}</p><p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b' }}>{r.reason}</p></div>
                                <div style={{ textAlign: 'right' }}>
                                    <p style={{ margin: 0, fontWeight: 800, color: '#fca412' }}>₹{parseFloat(r.amount).toLocaleString()}</p>
                                    <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '1px 8px', borderRadius: 12, backgroundColor: r.status === 'approved' ? '#dcfce7' : r.status === 'rejected' ? '#fee2e2' : '#fef3c7', color: r.status === 'approved' ? '#15803d' : r.status === 'rejected' ? '#991b1b' : '#92400e' }}>{r.status}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
