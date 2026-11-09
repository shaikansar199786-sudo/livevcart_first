import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    Briefcase, ShoppingCart, HardHat, CheckSquare, SlidersHorizontal, X, Search, 
    ArrowRight, Plus, Trash2, Target, Calendar, Clock, Clock3, MapPin, Phone, 
    UserCheck, CheckCircle, CheckCircle2, Play, Loader2, FileText, User 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { API_BASE_URL } from '../config';
import { DashboardFilterBar } from '../components/DashboardFilterBar';
import type { StatementPeriodType, ProjectTypeFilter } from '../components/DashboardFilterBar';

export const MmtDashboard: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const userRole = String(user?.role || '').toLowerCase();
    const isAdmin = ['admin', 'super_admin', 'administrator', 'superadmin', 'management', 'owner'].includes(userRole) || userRole.includes('admin') || Boolean(user?.is_admin);

    const [vendors, setVendors] = useState<any[]>([]);
    const [quotas, setQuotas] = useState<any[]>([]);
    const [tasks, setTasks] = useState<any[]>([]);
    const [mmtLeadsList, setMmtLeadsList] = useState<any[]>([]);
    const [loadingMeetingIds, setLoadingMeetingIds] = useState<Record<string | number, boolean>>({});

    const [totalVendorsCount, setTotalVendorsCount] = useState<number>(0);
    const [totalQuotasCount, setTotalQuotasCount] = useState<number>(0);
    const [totalTasksCount, setTotalTasksCount] = useState<number>(0);

    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [statementPeriod, setStatementPeriod] = useState<StatementPeriodType>('all');
    const [projectType, setProjectType] = useState<ProjectTypeFilter>('all');
    const [customDates, setCustomDates] = useState({ startDate: '', endDate: '' });

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

    const formatDate = (dateString?: string) => {
        if (!dateString) return 'Not Scheduled';
        return new Date(dateString).toLocaleDateString('en-IN', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
        });
    };

    const formatTime = (dateString?: string) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };

    const getLeadBookingTime = (lead: any) => {
        return lead.mmts_booking_time || lead.booking_time || '';
    };

    const isLeadMeetingCompleted = (lead: any) => {
        const mmtsSt = String(lead.mmts_status || '').toLowerCase().trim();
        // If actively booked, scheduled, or in meeting, it is strictly NOT completed
        if (['booked', 'scheduled', 'rescheduled', 'in_meeting', 'started', 'in_progress'].includes(mmtsSt)) {
            return false;
        }
        const finishedList = ['meeting_completed', 'completed'];
        return finishedList.includes(mmtsSt) || Boolean(lead.mmts_meeting_ended_at);
    };

    const isMeetingActive = (lead: any) => {
        const mmtsSt = String(lead.mmts_status || '').toLowerCase().trim();
        return mmtsSt === 'in_meeting' || mmtsSt === 'started' || mmtsSt === 'in_progress';
    };

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
                alert('Task proposed successfully');
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
                alert(res.data?.message || 'Failed to create task');
            }
        } catch (err) {
            console.error('Error creating task', err);
            alert('Error proposing task');
        } finally {
            setSubmitting(false);
        }
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
            const [vendorRes, quotaRes, taskRes, leadRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/main-vendors`),
                axios.get(`${API_BASE_URL}/vendor-quota/quotations`),
                axios.get(`${API_BASE_URL}/mb-tasks?${buildParams()}`),
                axios.get(`${API_BASE_URL}/leads?${buildParams()}`).catch(() => ({ data: { success: false, data: [] } }))
            ]);

            const loggedUid = user?.user_id ? String(user.user_id) : '';
            const loggedName = (user?.name || '').toLowerCase().trim();

            // 1. Vendors
            if (vendorRes.data?.success) {
                const allV = Array.isArray(vendorRes.data.data) ? vendorRes.data.data : [];
                setTotalVendorsCount(allV.length);
                let v = allV;
                if (searchQuery) v = v.filter((x: any) => (x.vendor_name || x.name || x.phone || '').toLowerCase().includes(searchQuery.toLowerCase()));
                setVendors(v.slice(0, 6));
            }

            // 2. Vendor Quotations
            if (quotaRes.data?.success) {
                const allQ = Array.isArray(quotaRes.data.data) ? quotaRes.data.data : [];
                setTotalQuotasCount(allQ.length);
                let q = allQ;
                if (searchQuery) q = q.filter((x: any) => (x.vendor_name || x.vendor_type || '').toLowerCase().includes(searchQuery.toLowerCase()));
                setQuotas(q.slice(0, 6));
            }

            // 3. Tasks
            if (taskRes.data?.success) {
                const allTasks = Array.isArray(taskRes.data.data) ? taskRes.data.data : [];
                let t = allTasks.filter((x: any) => {
                    if (!isAdmin) {
                        const matchesId = loggedUid && String(x.user_id) === loggedUid;
                        const matchesName = loggedName && (x.employee_name || '').toLowerCase().trim() === loggedName;
                        if (!matchesId && !matchesName) return false;
                    }
                    return matchesPeriod(x.created_at || '');
                });
                if (searchQuery) {
                    t = t.filter((x: any) => (x.task_title || x.description || '').toLowerCase().includes(searchQuery.toLowerCase()));
                }
                setTotalTasksCount(t.length);
                setTasks(t.slice(0, 6));
            }

            // 4. MMTS Booked Leads & Slots
            if (leadRes.data?.success) {
                const allL = Array.isArray(leadRes.data.data) ? leadRes.data.data : [];

                const mmtBookings = allL.filter((x: any) => {
                    const hasMmt = Boolean(
                        (x.mmts_booking_time && String(x.mmts_booking_time).trim() !== '' && x.mmts_booking_time !== '0000-00-00 00:00:00') ||
                        (x.mmt_assigned_id && String(x.mmt_assigned_id) !== '0' && String(x.mmt_assigned_id) !== 'null') ||
                        (x.mmt_assigned_name && x.mmt_assigned_name.trim() !== '' && x.mmt_assigned_name !== 'Not assigned' && x.mmt_assigned_name !== 'Pending Assignment') ||
                        (x.mmts_status && !['enquiry', 'pending', 'draft', 'unassigned'].includes(String(x.mmts_status).toLowerCase()))
                    );
                    return hasMmt;
                });

                const userSlots = isAdmin ? mmtBookings : mmtBookings.filter((x: any) => {
                    const assignedIds = String(x.mmt_assigned_id || '').split(',').map((s: string) => s.trim()).filter(Boolean);
                    if (loggedUid && assignedIds.includes(loggedUid)) return true;

                    const assignedNames = String(x.mmt_assigned_name || '').split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean);
                    if (loggedName && assignedNames.some(n => n === loggedName || n.includes(loggedName) || loggedName.includes(n))) return true;

                    return false;
                });

                let filteredMmt = userSlots.filter((x: any) => matchesPeriod(getLeadBookingTime(x) || x.created_at || ''));
                if (searchQuery) {
                    filteredMmt = filteredMmt.filter((x: any) => (x.client_name || x.name || '').toLowerCase().includes(searchQuery.toLowerCase()));
                }

                setMmtLeadsList(filteredMmt);
            }
        } catch (err) {
            console.error('MMT Dashboard error', err);
        } finally {
            setLoading(false);
        }
    };

    const handleStartMeeting = async (lead: any) => {
        setLoadingMeetingIds(prev => ({ ...prev, [lead.lead_id]: true }));
        window.dispatchEvent(new CustomEvent('mmts_meeting_status_changed', { detail: { status: 'in_meeting', lead_id: lead.lead_id } }));

        // Optimistic UI update (strictly MMT fields)
        setMmtLeadsList(prev => prev.map(l => (String(l.lead_id) === String(lead.lead_id)) ? {
            ...l,
            mmts_status: 'in_meeting'
        } : l));

        try {
            await axios.post(`${API_BASE_URL}/leads/update-mmts-status`, {
                lead_id: lead.lead_id,
                status: 'in_meeting',
                assigned_by_name: user?.name || 'MMT User'
            });
        } catch (err) {
            console.error('Start meeting error', err);
        } finally {
            setLoadingMeetingIds(prev => ({ ...prev, [lead.lead_id]: false }));
            fetchAll();
        }
    };

    const handleEndMeeting = async (lead: any) => {
        setLoadingMeetingIds(prev => ({ ...prev, [lead.lead_id]: true }));
        window.dispatchEvent(new CustomEvent('mmts_meeting_status_changed', { detail: { status: 'meeting_completed', lead_id: lead.lead_id } }));

        // Optimistic UI update (strictly MMT fields)
        setMmtLeadsList(prev => prev.map(l => (String(l.lead_id) === String(lead.lead_id)) ? {
            ...l,
            mmts_status: 'meeting_completed'
        } : l));

        try {
            await axios.post(`${API_BASE_URL}/leads/update-mmts-status`, {
                lead_id: lead.lead_id,
                status: 'meeting_completed',
                assigned_by_name: user?.name || 'MMT User'
            });
        } catch (err) {
            console.error('End meeting error', err);
        } finally {
            setLoadingMeetingIds(prev => ({ ...prev, [lead.lead_id]: false }));
            fetchAll();
        }
    };

    const hasActiveFilters = statementPeriod !== 'all' || projectType !== 'all' || searchQuery !== '';

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // Upcoming Consultations: scheduled for today or future dates, or in progress, or any actively booked slot
    const upcomingAppointments = mmtLeadsList.filter(lead => {
        const bTime = getLeadBookingTime(lead);
        if (!bTime) return false;
        const bookingDate = new Date(bTime);
        if (isNaN(bookingDate.getTime())) return false;

        if (isLeadMeetingCompleted(lead)) return false;
        if (isMeetingActive(lead)) return true;

        const mmtsSt = String(lead.mmts_status || '').toLowerCase().trim();
        if (['booked', 'scheduled', 'rescheduled'].includes(mmtsSt)) return true;

        return bookingDate >= startOfToday;
    }).sort((a, b) => new Date(getLeadBookingTime(a) || 0).getTime() - new Date(getLeadBookingTime(b) || 0).getTime());

    // Past Consultations: completed or scheduled before today (and not actively booked/in meeting)
    const pastAppointments = mmtLeadsList.filter(lead => {
        const bTime = getLeadBookingTime(lead);
        if (!bTime) return false;
        const bookingDate = new Date(bTime);
        if (isNaN(bookingDate.getTime())) return false;

        if (isLeadMeetingCompleted(lead)) return true;
        if (isMeetingActive(lead)) return false;

        const mmtsSt = String(lead.mmts_status || '').toLowerCase().trim();
        if (['booked', 'scheduled', 'rescheduled'].includes(mmtsSt)) return false;

        return bookingDate < startOfToday;
    }).sort((a, b) => new Date(getLeadBookingTime(b) || 0).getTime() - new Date(getLeadBookingTime(a) || 0).getTime());

    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: '#64748b' }}>Loading Dashboard...</div>;

    const kpis = [
        { label: 'Upcoming Consultations', value: upcomingAppointments.length, color: '#ea580c', icon: <Calendar size={22} />, path: '/mmt-leads' },
        { label: 'Total Vendors', value: totalVendorsCount, color: '#0c1527', icon: <ShoppingCart size={22} />, path: '/global-vendors' },
        { label: 'Vendor Quotations', value: totalQuotasCount, color: '#fca412', icon: <HardHat size={22} />, path: '/vendor-quotas' },
        { label: 'Past Consultations', value: pastAppointments.length, color: '#16a34a', icon: <CheckCircle2 size={22} />, path: '/mmt-leads' },
        { label: 'In Progress Meetings', value: upcomingAppointments.filter(l => isMeetingActive(l)).length, color: '#eab308', icon: <Clock size={22} />, path: '/mmt-leads' },
        { label: 'My Tasks', value: totalTasksCount, color: '#0c1527', icon: <CheckSquare size={22} />, path: '/mb-tasks' },
    ];

    return (
        <div className="dashboard-content">
            {/* Header Toolbar */}
            <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0c1527', margin: 0 }}>Welcome back, {user?.name}</h2>
                    <p style={{ color: '#64748b', margin: '4px 0 0 0' }}>Material Management (MMT) Dashboard — consultations, measurement tracking, and vendors.</p>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
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
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: 12, pointerEvents: 'none' }} />
                        <input type="text" placeholder="Search vendors, tasks..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onFocus={e => (e.target.style.borderColor = '#fca412')} onBlur={e => (e.target.style.borderColor = '#e2e8f0')} style={{ paddingLeft: 36, paddingRight: searchQuery ? 36 : 14, paddingTop: 9, paddingBottom: 9, borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.85rem', color: '#0c1527', background: '#f8fafc', outline: 'none', width: 240 }} />
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

            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 28 }}>
                {kpis.map(k => (
                    <div
                        key={k.label}
                        className="premium-card"
                        onClick={() => navigate(k.path)}
                        style={{ display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', transition: 'all 0.15s ease' }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.06)'; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                    >
                        <div style={{ padding: 12, borderRadius: 12, backgroundColor: `${k.color}18`, color: k.color }}>{k.icon}</div>
                        <div>
                            <p style={{ fontSize: '0.82rem', color: '#6b7280', margin: 0, fontWeight: 600 }}>{k.label}</p>
                            <h4 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0c1527', margin: '2px 0 0 0' }}>{k.value}</h4>
                        </div>
                    </div>
                ))}
            </div>

            {/* UPCOMING & PAST CONSULTATIONS (Design & Function matching Designer Dashboard) */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', alignItems: 'start', marginBottom: 28 }}>
                
                {/* Left: Upcoming Consultations */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '24px', border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Clock3 size={18} color="#6b7280" />
                                Upcoming Consultations ({upcomingAppointments.length})
                            </h3>
                            <button
                                onClick={() => navigate('/mmt-leads')}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#ea580c',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    fontSize: '0.82rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4
                                }}
                            >
                                View All Leads <ArrowRight size={14} />
                            </button>
                        </div>

                        {upcomingAppointments.length === 0 ? (
                            <div style={{ border: '2px dashed #e5e7eb', borderRadius: '12px', padding: '40px', textAlign: 'center' }}>
                                <Calendar size={40} color="#9ca3af" style={{ margin: '0 auto 12px auto' }} />
                                <p style={{ fontWeight: 600, color: '#374151', margin: 0 }}>No upcoming appointments</p>
                                <p style={{ color: '#6b7280', marginTop: '4px', fontSize: '0.85rem' }}>You're all caught up for now.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {upcomingAppointments.map((lead) => {
                                    const inMeeting = isMeetingActive(lead);
                                    const bTime = getLeadBookingTime(lead);

                                    return (
                                        <div
                                            key={lead.lead_id || lead.id}
                                            style={{
                                                backgroundColor: '#ffffff',
                                                padding: '20px',
                                                borderRadius: '12px',
                                                border: inMeeting ? '1.5px solid #ea580c' : '1px solid #e5e7eb',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '14px',
                                                boxShadow: inMeeting ? '0 4px 12px rgba(234, 88, 12, 0.1)' : '0 1px 3px rgba(0,0,0,0.02)',
                                                transition: 'all 0.15s ease'
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                                                <div>
                                                    <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#111827', margin: '0 0 4px 0' }}>
                                                        {lead.client_name || lead.name}
                                                    </h4>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#4b5563', backgroundColor: '#f3f4f6', padding: '3px 8px', borderRadius: '4px' }}>
                                                            {lead.project_scope || lead.project_type || 'MMT Consultation'}
                                                        </span>
                                                        <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748b' }}>
                                                            • ID: {lead.manual_client_id || lead.project_code || ('PR-' + lead.lead_id)}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                    <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                                                        <Clock size={15} color="#6b7280" />
                                                        {formatTime(bTime)}
                                                    </div>
                                                    <div style={{ fontSize: '0.82rem', color: '#6b7280', marginTop: '2px' }}>
                                                        {formatDate(bTime)}
                                                    </div>
                                                </div>
                                            </div>

                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', paddingTop: '12px', borderTop: '1px solid #f3f4f6' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4b5563' }}>
                                                    <Phone size={14} color="#6b7280" />
                                                    <span style={{ fontSize: '0.88rem' }}>{lead.contact_number || lead.phone || 'No phone'}</span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4b5563' }}>
                                                    <MapPin size={14} color="#6b7280" />
                                                    <span style={{ fontSize: '0.88rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {lead.location || lead.client_address || lead.city || 'Site Location'}
                                                    </span>
                                                </div>
                                            </div>

                                            {(lead.mmt_assigned_name || lead.mmts_notes || lead.notes) && (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    {lead.mmt_assigned_name && (
                                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#fff7ed', color: '#c2410c', padding: '4px 10px', borderRadius: '6px', fontSize: '0.80rem', fontWeight: 600, border: '1px solid #fed7aa', width: 'fit-content' }}>
                                                            <UserCheck size={14} color="#ea580c" />
                                                            <span>MMT Specialist: <strong>{lead.mmt_assigned_name}</strong></span>
                                                        </div>
                                                    )}
                                                    {(lead.mmts_notes || lead.notes) && (
                                                        <div style={{ backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: '8px', borderLeft: '3px solid #ea580c', fontSize: '0.84rem', color: '#334155' }}>
                                                            <strong style={{ color: '#1e293b' }}>MMT Booking Note: </strong> {lead.mmts_notes || lead.notes}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', borderTop: '1px solid #f3f4f6', paddingTop: '12px' }}>
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                    {loadingMeetingIds[lead.lead_id] ? (
                                                        <button
                                                            disabled
                                                            style={{
                                                                backgroundColor: '#94a3b8',
                                                                color: '#ffffff',
                                                                padding: '8px 18px',
                                                                borderRadius: '8px',
                                                                fontWeight: 700,
                                                                fontSize: '0.85rem',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '6px',
                                                                border: 'none',
                                                                cursor: 'wait'
                                                            }}
                                                        >
                                                            <Loader2 size={14} className="animate-spin" /> Processing...
                                                        </button>
                                                    ) : inMeeting ? (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <span style={{
                                                                padding: '6px 12px',
                                                                backgroundColor: '#fef3c7',
                                                                color: '#d97706',
                                                                border: '1px solid #fde68a',
                                                                borderRadius: '8px',
                                                                fontSize: '0.82rem',
                                                                fontWeight: 800,
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '6px'
                                                            }}>
                                                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#d97706' }}></span>
                                                                Meeting in Progress
                                                            </span>
                                                            <button
                                                                onClick={() => handleEndMeeting(lead)}
                                                                style={{
                                                                    backgroundColor: '#dc2626',
                                                                    color: '#ffffff',
                                                                    padding: '8px 16px',
                                                                    borderRadius: '8px',
                                                                    fontWeight: 700,
                                                                    fontSize: '0.85rem',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '6px',
                                                                    border: 'none',
                                                                    cursor: 'pointer',
                                                                    boxShadow: '0 2px 4px rgba(220, 38, 38, 0.2)'
                                                                }}
                                                            >
                                                                <CheckCircle size={14} /> End Meeting
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleStartMeeting(lead)}
                                                            style={{
                                                                backgroundColor: '#2563eb',
                                                                color: '#ffffff',
                                                                padding: '8px 18px',
                                                                borderRadius: '8px',
                                                                fontWeight: 700,
                                                                fontSize: '0.85rem',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '6px',
                                                                border: 'none',
                                                                cursor: 'pointer',
                                                                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)'
                                                            }}
                                                        >
                                                            <Play size={14} fill="#ffffff" /> Start Meeting
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Past Consultations (Last 4) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                        <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb' }}>
                            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <CheckCircle size={18} color="#6b7280" /> Past Consultations {pastAppointments.length > 4 && <span style={{ fontSize: '0.8rem', color: '#9ca3af', fontWeight: 500 }}>(Last 4)</span>}
                            </h3>
                        </div>

                        {pastAppointments.length === 0 ? (
                            <div style={{ padding: '32px', textAlign: 'center', color: '#6b7280', fontSize: '0.9rem' }}>
                                No past consultations yet
                            </div>
                        ) : (
                            <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                                {pastAppointments.slice(0, 4).map((lead, idx) => (
                                    <div key={lead.lead_id || lead.id} style={{
                                        padding: '16px 20px',
                                        borderBottom: idx === Math.min(pastAppointments.length, 4) - 1 ? 'none' : '1px solid #f3f4f6'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                            <h4 style={{ fontWeight: 700, color: '#111827', margin: 0, fontSize: '0.95rem' }}>{lead.client_name || lead.name}</h4>
                                            <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#4b5563', backgroundColor: '#f3f4f6', padding: '2px 6px', borderRadius: '4px' }}>
                                                {new Date(getLeadBookingTime(lead) || '').toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                                            <p style={{ fontSize: '0.82rem', color: '#6b7280', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Briefcase size={12} />
                                                {lead.project_scope || lead.project_type || 'MMT Consultation'}
                                            </p>
                                            <button
                                                onClick={() => navigate('/mmt-leads')}
                                                style={{
                                                    backgroundColor: 'transparent',
                                                    color: '#2563eb',
                                                    border: 'none',
                                                    fontSize: '0.8rem',
                                                    fontWeight: 700,
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                }}
                                            >
                                                <FileText size={12} /> View Details
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Vendors & Quotations Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 24, marginBottom: 24 }}>
                {/* Global Vendors */}
                <div className="premium-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <ShoppingCart size={18} color="#ea580c" />
                            <h3 style={{ fontWeight: 800, fontSize: '1rem', color: '#0c1527', margin: 0 }}>Global Registered Vendors</h3>
                            <span style={{ fontSize: '0.74rem', padding: '2px 8px', borderRadius: 12, backgroundColor: '#f1f5f9', color: '#475569', fontWeight: 700 }}>{totalVendorsCount}</span>
                        </div>
                        <button onClick={() => navigate('/global-vendors')} style={{ background: 'none', border: 'none', color: '#fca412', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 4 }}>View All <ArrowRight size={14} /></button>
                    </div>
                    {vendors.length === 0 ? <p style={{ color: '#94a3b8', fontSize: '0.88rem', margin: '16px 0' }}>No registered vendors found.</p> : vendors.map((v: any, idx: number) => (
                        <div key={v.vendor_id || idx} style={{ padding: '10px 14px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <p style={{ margin: 0, fontWeight: 700, fontSize: '0.86rem', color: '#0c1527' }}>{v.vendor_name || v.name}</p>
                                <p style={{ margin: 0, fontSize: '0.74rem', color: '#64748b' }}>{v.category || v.phone || 'General Vendor'}</p>
                            </div>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#ea580c', backgroundColor: '#fff7ed', padding: '2px 8px', borderRadius: 6, border: '1px solid #ffedd5' }}>
                                {v.vendor_code || v.city || 'Active'}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Vendor Quotations */}
                <div className="premium-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <HardHat size={18} color="#ea580c" />
                            <h3 style={{ fontWeight: 800, fontSize: '1rem', color: '#0c1527', margin: 0 }}>Vendor Quotations &amp; Rates</h3>
                            <span style={{ fontSize: '0.74rem', padding: '2px 8px', borderRadius: 12, backgroundColor: '#f1f5f9', color: '#475569', fontWeight: 700 }}>{totalQuotasCount}</span>
                        </div>
                        <button onClick={() => navigate('/vendor-quotas')} style={{ background: 'none', border: 'none', color: '#fca412', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 4 }}>View All <ArrowRight size={14} /></button>
                    </div>
                    {quotas.length === 0 ? <p style={{ color: '#94a3b8', fontSize: '0.88rem', margin: '16px 0' }}>No vendor quotations on file.</p> : quotas.map((q: any, idx: number) => (
                        <div key={idx} style={{ padding: '10px 14px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <p style={{ margin: 0, fontWeight: 700, fontSize: '0.86rem', color: '#0c1527' }}>{q.vendor_name}</p>
                                <p style={{ margin: 0, fontSize: '0.74rem', color: '#64748b' }}>{q.vendor_type || 'Material / Labor'}</p>
                            </div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#15803d', backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: 6, border: '1px solid #bbf7d0' }}>
                                {(q.projects || []).length} Project{(q.projects || []).length === 1 ? '' : 's'}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* My Tasks */}
            <div className="premium-card" style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <CheckSquare size={18} color="#ea580c" />
                        <h3 style={{ fontWeight: 800, fontSize: '1rem', color: '#0c1527', margin: 0 }}>My Tasks &amp; Tasks Management</h3>
                        <span style={{ fontSize: '0.74rem', padding: '2px 8px', borderRadius: 12, backgroundColor: '#f1f5f9', color: '#475569', fontWeight: 700 }}>{totalTasksCount}</span>
                    </div>
                    <button onClick={() => navigate('/mb-tasks')} style={{ background: 'none', border: 'none', color: '#fca412', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 4 }}>View All <ArrowRight size={14} /></button>
                </div>
                {tasks.length === 0 ? <p style={{ color: '#94a3b8', fontSize: '0.88rem', textAlign: 'center', padding: '14px 0' }}>No tasks assigned.</p> : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                        {tasks.map((t: any) => (
                            <div key={t.id} style={{ padding: '10px 14px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div><p style={{ margin: 0, fontWeight: 700, fontSize: '0.85rem', color: '#0c1527' }}>{t.task_title}</p><p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b' }}>{t.target_date ? new Date(t.target_date).toLocaleDateString('en-IN') : (t.start_date ? new Date(t.start_date).toLocaleDateString('en-IN') : '—')}</p></div>
                                <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 12, backgroundColor: t.status === 'completed' ? '#dcfce7' : '#fef3c7', color: t.status === 'completed' ? '#15803d' : '#92400e' }}>{t.status?.replace(/_/g, ' ')}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* PROPOSE TARGET GOAL MODAL */}
            {showAddModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
                    <div className="modal-box" style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '600px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid #f1f5f9', backgroundColor: '#ffffff', borderRadius: '16px 16px 0 0' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0c1527' }}>Propose New Task Goal</h3>
                            <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={18} /></button>
                        </div>
                        <form onSubmit={handleSubmitTask} style={{ padding: '20px 24px' }}>
                            <div style={{ marginBottom: 14 }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#374151', marginBottom: 4 }}>Task Goal Title *</label>
                                <input type="text" required placeholder="e.g. Factory Site Material Inspection" value={taskForm.task_title} onChange={e => setTaskForm({ ...taskForm, task_title: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.85rem' }} />
                            </div>
                            <div style={{ marginBottom: 14 }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#374151', marginBottom: 4 }}>Description</label>
                                <textarea rows={2} placeholder="Brief summary of procurement or vendor verification..." value={taskForm.description} onChange={e => setTaskForm({ ...taskForm, description: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.85rem' }} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#374151', marginBottom: 4 }}>Start Date</label>
                                    <input type="date" value={taskForm.start_date} onChange={e => setTaskForm({ ...taskForm, start_date: e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.85rem' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#374151', marginBottom: 4 }}>End Date</label>
                                    <input type="date" value={taskForm.end_date} onChange={e => setTaskForm({ ...taskForm, end_date: e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.85rem' }} />
                                </div>
                            </div>

                            {/* Sub Tasks */}
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151' }}>Action Steps / Milestones</label>
                                    <button type="button" onClick={handleAddSubTask} style={{ background: 'none', border: 'none', color: '#fca412', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>+ Add Step</button>
                                </div>
                                {taskForm.sub_tasks.map((st, i) => (
                                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                                        <input type="text" placeholder={`Step ${i + 1}`} value={st.title} onChange={e => handleSubTaskChange(i, 'title', e.target.value)} style={{ flex: 1, padding: '7px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: '0.82rem' }} />
                                        {taskForm.sub_tasks.length > 1 && (
                                            <button type="button" onClick={() => handleRemoveSubTask(i)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}><Trash2 size={14} /></button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                                <button type="button" onClick={() => setShowAddModal(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', fontSize: '0.84rem', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                                <button type="submit" disabled={submitting} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#fca412', color: '#fff', fontSize: '0.84rem', fontWeight: 700, cursor: submitting ? 'wait' : 'pointer' }}>
                                    {submitting ? 'Submitting...' : 'Submit Goal'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
