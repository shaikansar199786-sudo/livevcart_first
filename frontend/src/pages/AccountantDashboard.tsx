import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { TrendingUp, Wallet, FileText, Briefcase, SlidersHorizontal, X, Search, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { API_BASE_URL } from '../config';
import { DashboardFilterBar } from '../components/DashboardFilterBar';
import type { StatementPeriodType, ProjectTypeFilter } from '../components/DashboardFilterBar';

export const AccountantDashboard: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [stats, setStats] = useState<any>(null);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [quotes, setQuotes] = useState<any[]>([]);
    const [agreements, setAgreements] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
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

    useEffect(() => { fetchAll(); }, [statementPeriod, projectType, customDates, searchQuery]);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [dashRes, finRes, quotesRes, agreeRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/dashboard?${buildParams()}`),
                axios.get(`${API_BASE_URL}/finance?${buildParams()}`),
                axios.get(`${API_BASE_URL}/quotes`),
                axios.get(`${API_BASE_URL}/agreements`)
            ]);
            if (dashRes.data?.success) setStats(dashRes.data.data);
            if (finRes.data?.success || finRes.data?.data) {
                let t = finRes.data.data || [];
                t = t.filter((x: any) => matchesPeriod(x.transaction_date || x.created_at || ''));
                if (searchQuery) t = t.filter((x: any) => (x.description || x.category || '').toLowerCase().includes(searchQuery.toLowerCase()));
                setTransactions(t.slice(0, 8));
            }
            if (quotesRes.data?.success) {
                let q = quotesRes.data.data || [];
                if (searchQuery) q = q.filter((x: any) => (x.client_name || x.project_id || '').toLowerCase().includes(searchQuery.toLowerCase()));
                setQuotes(q.slice(0, 5));
            }
            if (agreeRes.data?.success) {
                setAgreements((agreeRes.data.data || []).slice(0, 5));
            }
        } catch (err) {
            console.error('Accountant Dashboard error', err);
        } finally {
            setLoading(false);
        }
    };

    const hasActiveFilters = statementPeriod !== 'all' || projectType !== 'all' || searchQuery !== '';
    const totalIncome = stats?.total_income ?? 0;
    const totalExpense = stats?.total_expense ?? 0;

    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: '#64748b' }}>Loading Dashboard...</div>;

    const kpis = [
        { label: 'Total Income', value: `₹${parseFloat(totalIncome).toLocaleString()}`, color: '#16a34a', icon: <TrendingUp size={22} /> },
        { label: 'Total Expenses', value: `₹${parseFloat(totalExpense).toLocaleString()}`, color: '#dc2626', icon: <Wallet size={22} /> },
        { label: 'Net Balance', value: `₹${(parseFloat(totalIncome) - parseFloat(totalExpense)).toLocaleString()}`, color: '#fca412', icon: <Wallet size={22} /> },
        { label: 'Active Projects', value: stats?.active_projects ?? 0, color: '#0c1527', icon: <Briefcase size={22} /> },
    ];

    return (
        <div className="dashboard-content">
            <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0c1527' }}>Welcome back, {user?.name}</h2>
                    <p style={{ color: '#64748b', margin: 0 }}>Accountant Dashboard — financials, quotes, and agreements.</p>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: 12, pointerEvents: 'none' }} />
                        <input type="text" placeholder="Search transactions..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onFocus={e => (e.target.style.borderColor = '#fca412')} onBlur={e => (e.target.style.borderColor = '#e2e8f0')} style={{ paddingLeft: 36, paddingRight: searchQuery ? 36 : 14, paddingTop: 9, paddingBottom: 9, borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.85rem', color: '#0c1527', background: '#f8fafc', outline: 'none', width: 240 }} />
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
                            <h4 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0c1527', margin: 0 }}>{k.value}</h4>
                        </div>
                    </div>
                ))}
            </div>

            {/* Income vs Expense Bar */}
            <div className="premium-card" style={{ marginBottom: 24 }}>
                <h3 style={{ fontWeight: 800, fontSize: '1rem', color: '#0c1527', margin: '0 0 16px 0' }}>Finance Summary</h3>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <span style={{ fontSize: '0.82rem', color: '#16a34a', fontWeight: 700 }}>Income</span>
                            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#16a34a' }}>₹{parseFloat(totalIncome).toLocaleString()}</span>
                        </div>
                        <div style={{ height: 8, borderRadius: 8, backgroundColor: '#f1f5f9', overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: 8, backgroundColor: '#16a34a', width: totalIncome > 0 ? '100%' : '0%' }} />
                        </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <span style={{ fontSize: '0.82rem', color: '#dc2626', fontWeight: 700 }}>Expenses</span>
                            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#dc2626' }}>₹{parseFloat(totalExpense).toLocaleString()}</span>
                        </div>
                        <div style={{ height: 8, borderRadius: 8, backgroundColor: '#f1f5f9', overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: 8, backgroundColor: '#dc2626', width: totalIncome > 0 ? `${Math.min((totalExpense / totalIncome) * 100, 100)}%` : '0%' }} />
                        </div>
                    </div>
                </div>
                <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={() => navigate('/finance')} style={{ background: 'none', border: 'none', color: '#fca412', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 4 }}>View Full Finance <ArrowRight size={14} /></button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                {/* Recent Transactions */}
                <div className="premium-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h3 style={{ fontWeight: 800, fontSize: '1rem', color: '#0c1527', margin: 0 }}>Recent Transactions</h3>
                        <button onClick={() => navigate('/finance')} style={{ background: 'none', border: 'none', color: '#fca412', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 4 }}>View All <ArrowRight size={14} /></button>
                    </div>
                    {transactions.length === 0 ? <p style={{ color: '#94a3b8', fontSize: '0.88rem' }}>No transactions found.</p> : transactions.map((t: any, i: number) => (
                        <div key={i} style={{ padding: '9px 12px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div><p style={{ margin: 0, fontWeight: 700, fontSize: '0.85rem', color: '#0c1527' }}>{t.description || t.category}</p><p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b' }}>{t.transaction_date ? new Date(t.transaction_date).toLocaleDateString('en-IN') : ''}</p></div>
                            <span style={{ fontWeight: 800, color: t.type === 'credit' ? '#16a34a' : '#dc2626', fontSize: '0.9rem' }}>{t.type === 'credit' ? '+' : '-'}₹{parseFloat(t.amount).toLocaleString()}</span>
                        </div>
                    ))}
                </div>

                {/* Quotes & Agreements */}
                <div className="premium-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <h3 style={{ fontWeight: 800, fontSize: '1rem', color: '#0c1527', margin: 0 }}>Recent Quotes</h3>
                        <button onClick={() => navigate('/quotes')} style={{ background: 'none', border: 'none', color: '#fca412', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 4 }}>View All <ArrowRight size={14} /></button>
                    </div>
                    {quotes.length === 0 ? <p style={{ color: '#94a3b8', fontSize: '0.88rem' }}>No quotes found.</p> : quotes.map((q: any) => (
                        <div key={q.quote_id || q.id} style={{ padding: '9px 12px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div><p style={{ margin: 0, fontWeight: 700, fontSize: '0.85rem', color: '#0c1527' }}>{q.client_name || q.project_id}</p><p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b' }}>{q.project_type || 'Quote'}</p></div>
                            <span style={{ fontWeight: 700, color: '#0c1527', fontSize: '0.88rem' }}>₹{parseFloat(q.grand_total || q.total_amount || 0).toLocaleString()}</span>
                        </div>
                    ))}
                    <div style={{ marginTop: 12, borderTop: '1px solid #f1f5f9', paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0c1527', margin: 0 }}>Agreements ({agreements.length})</h3>
                        <button onClick={() => navigate('/agreements')} style={{ background: 'none', border: 'none', color: '#fca412', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 4 }}>View All <ArrowRight size={14} /></button>
                    </div>
                </div>
            </div>
        </div>
    );
};
