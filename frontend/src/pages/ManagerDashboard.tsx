import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Briefcase, Users, Receipt, CheckSquare, SlidersHorizontal, X, Search, ArrowRight, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { API_BASE_URL } from '../config';
import { DashboardFilterBar } from '../components/DashboardFilterBar';
import type { StatementPeriodType, ProjectTypeFilter } from '../components/DashboardFilterBar';

export const ManagerDashboard: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [stats, setStats] = useState<any>(null);
    const [projects, setProjects] = useState<any[]>([]);
    const [clients, setClients] = useState<any[]>([]);
    const [tasks, setTasks] = useState<any[]>([]);
    const [pendingReimbs, setPendingReimbs] = useState<any[]>([]);
    const [teamCount, setTeamCount] = useState(0);
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
            const [dashRes, projRes, clientRes, taskRes, reimRes, teamRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/dashboard?${buildParams()}`),
                axios.get(`${API_BASE_URL}/projects?${buildParams()}`),
                axios.get(`${API_BASE_URL}/clients?${buildParams()}`),
                axios.get(`${API_BASE_URL}/mb-tasks?${buildParams()}`),
                axios.get(`${API_BASE_URL}/reimbursements`, { headers: { 'X-User-Id': user?.user_id, 'X-User-Role': user?.role } }),
                axios.get(`${API_BASE_URL}/users`)
            ]);
            if (dashRes.data?.success) setStats(dashRes.data.data);
            if (projRes.data?.success) {
                let p = (projRes.data.data || []).filter((x: any) => matchesPeriod(x.created_at || ''));
                if (searchQuery) p = p.filter((x: any) => (x.project_name || '').toLowerCase().includes(searchQuery.toLowerCase()));
                setProjects(p.slice(0, 6));
            }
            if (clientRes.data?.success) {
                let c = (clientRes.data.data || []).filter((x: any) => matchesPeriod(x.created_at || ''));
                if (searchQuery) c = c.filter((x: any) => (x.name || x.client_name || '').toLowerCase().includes(searchQuery.toLowerCase()));
                setClients(c.slice(0, 5));
            }
            if (taskRes.data?.success) {
                let t = (taskRes.data.data || []).filter((x: any) =>
                    (String(x.user_id) === String(user?.user_id) || (x.employee_name || '').toLowerCase() === (user?.name || '').toLowerCase()) &&
                    matchesPeriod(x.created_at || '')
                );
                setTasks(t.slice(0, 5));
            }
            if (reimRes.data?.success) {
                const userReimbs = (reimRes.data.data || []).filter((r: any) =>
                    (String(r.user_id) === String(user?.user_id) || (r.employee_name || '').toLowerCase() === (user?.name || '').toLowerCase()) &&
                    matchesPeriod(r.created_at || '')
                );
                setPendingReimbs(userReimbs.slice(0, 5));
            }
            if (teamRes.data?.success) setTeamCount(teamRes.data.data?.length || 0);
        } catch (err) {
            console.error('Manager Dashboard error', err);
        } finally {
            setLoading(false);
        }
    };

    const hasActiveFilters = statementPeriod !== 'all' || projectType !== 'all' || searchQuery !== '';

    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: '#64748b' }}>Loading Dashboard...</div>;

    const kpis = [
        { label: 'Active Projects', value: stats?.active_projects ?? projects.length, color: '#fca412', icon: <Briefcase size={22} /> },
        { label: 'Total Clients', value: stats?.total_clients ?? clients.length, color: '#0c1527', icon: <Users size={22} /> },
        { label: 'Team Members', value: teamCount, color: '#fca412', icon: <Users size={22} /> },
        { label: 'Pending Tasks', value: tasks.filter((t: any) => t.status === 'pending_admin_review').length, color: '#0c1527', icon: <AlertTriangle size={22} /> },
    ];

    return (
        <div className="dashboard-content">
            <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0c1527' }}>Welcome back, {user?.name}</h2>
                    <p style={{ color: '#64748b', margin: 0 }}>Manager Dashboard — complete project overview (excluding financial balance sheet), clients, team, and staff tasks.</p>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: 12, pointerEvents: 'none' }} />
                        <input type="text" placeholder="Search projects, clients..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onFocus={e => (e.target.style.borderColor = '#fca412')} onBlur={e => (e.target.style.borderColor = '#e2e8f0')} style={{ paddingLeft: 36, paddingRight: searchQuery ? 36 : 14, paddingTop: 9, paddingBottom: 9, borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.85rem', color: '#0c1527', background: '#f8fafc', outline: 'none', width: 240 }} />
                        {searchQuery && <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: 10, background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex' }}><X size={14} /></button>}
                    </div>
                    <button onClick={() => setShowFilters(p => !p)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 10, backgroundColor: showFilters ? '#fca412' : '#0c1527', color: showFilters ? '#fff' : '#fca412', border: '1.5px solid', borderColor: showFilters ? '#fca412' : '#0c1527', fontSize: '0.88rem', fontWeight: 800, cursor: 'pointer', position: 'relative' }}>
                        {showFilters ? <X size={15} /> : <SlidersHorizontal size={15} />}
                        {showFilters ? 'Close' : 'Filters'}
                        {hasActiveFilters && !showFilters && <span style={{ position: 'absolute', top: -5, right: -5, width: 10, height: 10, borderRadius: '50%', backgroundColor: '#fca412', border: '2px solid #fff' }} />}
                    </button>
                </div>
            </div>

            {showFilters && (
                <DashboardFilterBar statementPeriod={statementPeriod} onStatementPeriodChange={(period, custom) => { setStatementPeriod(period); if (custom) setCustomDates(custom); }} projectType={projectType} onProjectTypeChange={setProjectType} />
            )}

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
                        <h3 style={{ fontWeight: 800, fontSize: '1rem', color: '#0c1527', margin: 0 }}>Projects Overview</h3>
                        <button onClick={() => navigate('/projects')} style={{ background: 'none', border: 'none', color: '#fca412', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 4 }}>View All <ArrowRight size={14} /></button>
                    </div>
                    {projects.length === 0 ? <p style={{ color: '#94a3b8', fontSize: '0.88rem' }}>No projects found.</p> : projects.map((p: any) => (
                        <div key={p.project_id} onClick={() => navigate(`/projects/${p.project_id}`)} style={{ padding: '9px 12px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0', cursor: 'pointer', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div><p style={{ margin: 0, fontWeight: 700, fontSize: '0.85rem', color: '#0c1527' }}>{p.project_name}</p><p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b' }}>{p.project_type || 'General'}</p></div>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 12, backgroundColor: '#dcfce7', color: '#15803d' }}>{p.status}</span>
                        </div>
                    ))}
                </div>

                {/* Clients */}
                <div className="premium-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h3 style={{ fontWeight: 800, fontSize: '1rem', color: '#0c1527', margin: 0 }}>Recent Clients</h3>
                        <button onClick={() => navigate('/clients')} style={{ background: 'none', border: 'none', color: '#fca412', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 4 }}>View All <ArrowRight size={14} /></button>
                    </div>
                    {clients.length === 0 ? <p style={{ color: '#94a3b8', fontSize: '0.88rem' }}>No clients found.</p> : clients.map((c: any) => (
                        <div key={c.client_id} style={{ padding: '9px 12px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div><p style={{ margin: 0, fontWeight: 700, fontSize: '0.85rem', color: '#0c1527' }}>{c.name || c.client_name}</p><p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b' }}>{c.phone || c.contact_number || '—'}</p></div>
                            <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{c.project_type || 'General'}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                {/* Tasks */}
                <div className="premium-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h3 style={{ fontWeight: 800, fontSize: '1rem', color: '#0c1527', margin: 0 }}>Staff Tasks</h3>
                        <button onClick={() => navigate('/mb-tasks')} style={{ background: 'none', border: 'none', color: '#fca412', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 4 }}>View All <ArrowRight size={14} /></button>
                    </div>
                    {tasks.length === 0 ? <p style={{ color: '#94a3b8', fontSize: '0.88rem' }}>No tasks found.</p> : tasks.map((t: any) => (
                        <div key={t.id} style={{ padding: '9px 12px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div><p style={{ margin: 0, fontWeight: 700, fontSize: '0.85rem', color: '#0c1527' }}>{t.task_title}</p><p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b' }}>{t.employee_name}</p></div>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 12, backgroundColor: '#fef3c7', color: '#92400e' }}>{t.status?.replace(/_/g, ' ')}</span>
                        </div>
                    ))}
                </div>

                {/* My Reimbursements */}
                <div className="premium-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h3 style={{ fontWeight: 800, fontSize: '1rem', color: '#0c1527', margin: 0 }}>My Reimbursements</h3>
                        <button onClick={() => navigate('/reimbursements')} style={{ background: 'none', border: 'none', color: '#fca412', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 4 }}>View All <ArrowRight size={14} /></button>
                    </div>
                    {pendingReimbs.length === 0 ? <p style={{ color: '#94a3b8', fontSize: '0.88rem', textAlign: 'center', padding: '20px 0' }}>No reimbursements found.</p> : pendingReimbs.map((r: any) => (
                        <div key={r.id} style={{ padding: '9px 12px', borderRadius: 10, background: '#fff9f0', border: '1px solid #ffe8c2', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div><p style={{ margin: 0, fontWeight: 700, fontSize: '0.85rem', color: '#0c1527' }}>{r.category}</p><p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b' }}>{r.reason}</p></div>
                            <span style={{ fontWeight: 800, color: '#fca412', fontSize: '0.9rem' }}>₹{parseFloat(r.amount).toLocaleString()}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
