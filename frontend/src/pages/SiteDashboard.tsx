import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    Briefcase, CheckSquare, Receipt, SlidersHorizontal, X, Search, ArrowRight, 
    FileCheck, Calendar, Clock, Clock3, MapPin, Phone, UserCheck, CheckCircle, 
    Play, Loader2, FileText, User 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { API_BASE_URL } from '../config';
import { DashboardFilterBar } from '../components/DashboardFilterBar';
import type { StatementPeriodType, ProjectTypeFilter } from '../components/DashboardFilterBar';

export const SiteDashboard: React.FC = () => {
    const { user } = useAuth();
    const userRole = String(user?.role || '').toLowerCase();
    const isAdmin = ['admin', 'super_admin', 'administrator', 'superadmin', 'management', 'owner'].includes(userRole) || userRole.includes('admin');
    const isInspector = userRole === 'site_inspector' || userRole === 'site_inspection' || userRole.includes('inspector');
    const navigate = useNavigate();

    const [projects, setProjects] = useState<any[]>([]);
    const [tasks, setTasks] = useState<any[]>([]);
    const [reimbursements, setReimbursements] = useState<any[]>([]);
    const [assignedQcSlots, setAssignedQcSlots] = useState<any[]>([]);
    const [loadingMeetingIds, setLoadingMeetingIds] = useState<Record<string | number, boolean>>({});
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [statementPeriod, setStatementPeriod] = useState<StatementPeriodType>('all');
    const [projectType, setProjectType] = useState<ProjectTypeFilter>('all');
    const [customDates, setCustomDates] = useState({ startDate: '', endDate: '' });

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
        return lead.site_inspector_booking_time || lead.site_manager_booking_time || lead.qc_booking_time || lead.booking_time || '';
    };

    const isLeadMeetingCompleted = (lead: any) => {
        const statuses = [
            String(lead.site_inspector_status || '').toLowerCase().trim(),
            String(lead.qc_status || '').toLowerCase().trim(),
            String(lead.site_manager_status || '').toLowerCase().trim()
        ];
        // If actively booked, scheduled, or in meeting, it is strictly NOT completed
        if (statuses.some(st => ['booked', 'scheduled', 'rescheduled', 'in_meeting', 'started', 'in_progress'].includes(st))) {
            return false;
        }
        const finishedList = ['meeting_completed', 'completed', 'qc_approved', 'approved'];
        return statuses.some(st => finishedList.includes(st)) || Boolean(lead.site_inspector_meeting_ended_at) || Boolean(lead.qc_meeting_ended_at);
    };

    const isMeetingActive = (lead: any) => {
        const statuses = [
            String(lead.site_inspector_status || '').toLowerCase().trim(),
            String(lead.qc_status || '').toLowerCase().trim(),
            String(lead.site_manager_status || '').toLowerCase().trim()
        ];
        return statuses.some(st => st === 'in_meeting' || st === 'started' || st === 'in_progress');
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
            const [projRes, taskRes, reimRes, leadRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/projects?${buildParams()}`),
                axios.get(`${API_BASE_URL}/mb-tasks?${buildParams()}`),
                axios.get(`${API_BASE_URL}/reimbursements`, { headers: { 'X-User-Id': user?.user_id, 'X-User-Role': user?.role } }),
                axios.get(`${API_BASE_URL}/leads?${buildParams()}`).catch(() => ({ data: { success: false, data: [] } }))
            ]);
            if (projRes.data?.success) {
                let p = (projRes.data.data || []).filter((x: any) => matchesPeriod(x.created_at || ''));
                if (searchQuery) p = p.filter((x: any) => (x.project_name || '').toLowerCase().includes(searchQuery.toLowerCase()));
                setProjects(p.slice(0, 8));
            }
            if (taskRes.data?.success) {
                let t = (taskRes.data.data || []).filter((x: any) =>
                    (x.employee_name || '').toLowerCase() === (user?.name || '').toLowerCase() && matchesPeriod(x.created_at || '')
                );
                if (searchQuery) t = t.filter((x: any) => (x.task_title || '').toLowerCase().includes(searchQuery.toLowerCase()));
                setTasks(t.slice(0, 6));
            }
            if (reimRes.data?.success) {
                let r = (reimRes.data.data || []).filter((x: any) => matchesPeriod(x.created_at || ''));
                setReimbursements(r.slice(0, 5));
            }
            if (leadRes?.data?.success) {
                const allL = Array.isArray(leadRes.data.data) ? leadRes.data.data : [];
                const loggedUid = String(user?.user_id || (user as any)?.id || '').trim();
                const loggedName = String(user?.name || '').toLowerCase().trim();

                // Filter strictly Site Inspector / QC bookings (exclude D1 designer & MMT)
                const qcBookings = allL.filter((x: any) => {
                    const hasTime = Boolean(
                        (x.site_inspector_booking_time && String(x.site_inspector_booking_time).trim() !== '' && x.site_inspector_booking_time !== '0000-00-00 00:00:00') ||
                        (x.qc_booking_time && String(x.qc_booking_time).trim() !== '' && x.qc_booking_time !== '0000-00-00 00:00:00') ||
                        (x.site_manager_booking_time && String(x.site_manager_booking_time).trim() !== '' && x.site_manager_booking_time !== '0000-00-00 00:00:00')
                    );
                    const hasInspectorName = Boolean(
                        x.site_inspector_assigned_name &&
                        x.site_inspector_assigned_name.trim() !== '' &&
                        x.site_inspector_assigned_name !== 'Not assigned' &&
                        x.site_inspector_assigned_name !== 'Pending Assignment'
                    );
                    const hasInspectorId = Boolean(
                        x.site_inspector_assigned_id &&
                        String(x.site_inspector_assigned_id) !== '0' &&
                        String(x.site_inspector_assigned_id) !== 'null'
                    );
                    const hasQcStatus = Boolean(
                        (x.site_inspector_status && !['enquiry', 'pending', 'draft', 'unassigned'].includes(String(x.site_inspector_status).toLowerCase())) ||
                        (x.qc_status && !['enquiry', 'pending', 'draft', 'unassigned'].includes(String(x.qc_status).toLowerCase()))
                    );
                    return hasTime || hasInspectorName || hasInspectorId || hasQcStatus;
                });

                // User assigned slots for Site Inspector (strictly for logged in user)
                const userQcSlots = qcBookings.filter((x: any) => {
                    const assignedIds = String(x.site_inspector_assigned_id || x.site_manager_assigned_to || '')
                        .split(',')
                        .map((s: string) => s.trim())
                        .filter(Boolean);
                    if (loggedUid && assignedIds.includes(loggedUid)) return true;

                    const assignedNames = String(x.site_inspector_assigned_name || '')
                        .split(',')
                        .map((s: string) => s.trim().toLowerCase())
                        .filter(Boolean);
                    if (loggedName && assignedNames.some(n => n === loggedName || n.includes(loggedName) || loggedName.includes(n))) return true;

                    return false;
                });

                const effectiveQcSlots = !isAdmin ? userQcSlots : qcBookings;
                let filteredQc = effectiveQcSlots.filter((x: any) => matchesPeriod(getLeadBookingTime(x) || x.created_at || ''));
                if (searchQuery) {
                    filteredQc = filteredQc.filter((x: any) => (x.client_name || x.name || '').toLowerCase().includes(searchQuery.toLowerCase()));
                }
                setAssignedQcSlots(filteredQc);
            }
        } catch (err) {
            console.error('Site Dashboard error', err);
        } finally {
            setLoading(false);
        }
    };

    const handleStartMeeting = async (lead: any) => {
        setLoadingMeetingIds(prev => ({ ...prev, [lead.lead_id]: true }));
        window.dispatchEvent(new CustomEvent('qc_meeting_status_changed', { detail: { status: 'in_meeting', lead_id: lead.lead_id } }));
        window.dispatchEvent(new CustomEvent('qc_status_changed', { detail: { status: 'in_meeting', lead_id: lead.lead_id } }));

        // Optimistic UI update (strictly Site Inspector / QC fields, never corrupt CRM sales status)
        setAssignedQcSlots(prev => prev.map(l => (String(l.lead_id) === String(lead.lead_id)) ? {
            ...l,
            qc_status: 'in_meeting',
            site_inspector_status: 'in_meeting',
            site_manager_status: 'in_meeting'
        } : l));

        try {
            await axios.post(`${API_BASE_URL}/leads/update-qc-status`, {
                lead_id: lead.lead_id,
                status: 'in_meeting',
                assigned_by_name: user?.name || 'Site Inspector'
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
        window.dispatchEvent(new CustomEvent('qc_meeting_status_changed', { detail: { status: 'meeting_completed', lead_id: lead.lead_id } }));
        window.dispatchEvent(new CustomEvent('qc_status_changed', { detail: { status: 'meeting_completed', lead_id: lead.lead_id } }));

        // Optimistic UI update (strictly Site Inspector / QC fields, never corrupt CRM sales status)
        setAssignedQcSlots(prev => prev.map(l => (String(l.lead_id) === String(lead.lead_id)) ? {
            ...l,
            qc_status: 'meeting_completed',
            site_inspector_status: 'meeting_completed',
            site_manager_status: 'meeting_completed'
        } : l));

        try {
            await axios.post(`${API_BASE_URL}/leads/update-qc-status`, {
                lead_id: lead.lead_id,
                status: 'meeting_completed',
                assigned_by_name: user?.name || 'Site Inspector'
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
    const upcomingAppointments = assignedQcSlots.filter(lead => {
        const bTime = getLeadBookingTime(lead);
        if (!bTime) return false;
        const bookingDate = new Date(bTime);
        if (isNaN(bookingDate.getTime())) return false;

        if (isLeadMeetingCompleted(lead)) return false;
        if (isMeetingActive(lead)) return true;

        const statuses = [
            String(lead.site_inspector_status || '').toLowerCase().trim(),
            String(lead.qc_status || '').toLowerCase().trim(),
            String(lead.site_manager_status || '').toLowerCase().trim()
        ];
        if (statuses.some(st => ['booked', 'scheduled', 'rescheduled'].includes(st))) return true;

        return bookingDate >= startOfToday;
    }).sort((a, b) => new Date(getLeadBookingTime(a) || 0).getTime() - new Date(getLeadBookingTime(b) || 0).getTime());

    // Past Consultations: completed or scheduled before today (and not actively booked/in meeting)
    const pastAppointments = assignedQcSlots.filter(lead => {
        const bTime = getLeadBookingTime(lead);
        if (!bTime) return false;
        const bookingDate = new Date(bTime);
        if (isNaN(bookingDate.getTime())) return false;

        if (isLeadMeetingCompleted(lead)) return true;
        if (isMeetingActive(lead)) return false;

        const statuses = [
            String(lead.site_inspector_status || '').toLowerCase().trim(),
            String(lead.qc_status || '').toLowerCase().trim(),
            String(lead.site_manager_status || '').toLowerCase().trim()
        ];
        if (statuses.some(st => ['booked', 'scheduled', 'rescheduled'].includes(st))) return false;

        return bookingDate < startOfToday;
    }).sort((a, b) => new Date(getLeadBookingTime(b) || 0).getTime() - new Date(getLeadBookingTime(a) || 0).getTime());

    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: '#64748b' }}>Loading Dashboard...</div>;

    const kpis = [
        { label: 'Upcoming Consultations', value: upcomingAppointments.length, color: '#2563eb', icon: <Calendar size={22} /> },
        { label: 'Assigned Projects', value: projects.length, color: '#fca412', icon: <Briefcase size={22} /> },
        { label: 'My Tasks', value: tasks.length, color: '#0c1527', icon: <CheckSquare size={22} /> },
        { label: 'Past Consultations', value: pastAppointments.length, color: '#16a34a', icon: <CheckCircle size={22} /> },
        { label: 'QC & Doc Uploads', value: projects.filter(p => p.status === 'active').length, color: '#16a34a', icon: <FileCheck size={22} /> },
        { label: 'Reimbursements', value: reimbursements.length, color: '#0c1527', icon: <Receipt size={22} /> },
    ];

    return (
        <div className="dashboard-content">
            {/* Header Toolbar */}
            <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0c1527', margin: 0 }}>Welcome back, {user?.name}</h2>
                    <p style={{ color: '#64748b', margin: '4px 0 0 0' }}>
                        {isInspector ? 'Site Inspector' : 'Site Engineer'} Dashboard — site consultations, QC inspections, and tasks.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: 12, pointerEvents: 'none' }} />
                        <input type="text" placeholder="Search projects, tasks..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onFocus={e => (e.target.style.borderColor = '#fca412')} onBlur={e => (e.target.style.borderColor = '#e2e8f0')} style={{ paddingLeft: 36, paddingRight: searchQuery ? 36 : 14, paddingTop: 9, paddingBottom: 9, borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.85rem', color: '#0c1527', background: '#f8fafc', outline: 'none', width: 240 }} />
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
                    <div key={k.label} className="premium-card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ padding: 12, borderRadius: 12, backgroundColor: `${k.color}18`, color: k.color }}>{k.icon}</div>
                        <div>
                            <p style={{ fontSize: '0.82rem', color: '#6b7280', margin: 0 }}>{k.label}</p>
                            <h4 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0c1527', margin: 0 }}>{k.value}</h4>
                        </div>
                    </div>
                ))}
            </div>

            {/* UPCOMING & PAST CONSULTATIONS (Design & Function identical to Designer Dashboard) */}
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
                                onClick={() => navigate('/site-leads')}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#2563eb',
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
                                                border: inMeeting ? '1.5px solid #2563eb' : '1px solid #e5e7eb',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '14px',
                                                boxShadow: inMeeting ? '0 4px 12px rgba(37, 99, 235, 0.1)' : '0 1px 3px rgba(0,0,0,0.02)',
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
                                                            {lead.project_scope || lead.project_type || 'Site QC Inspection'}
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

                                            {(lead.site_inspector_assigned_name || lead.qc_notes || lead.site_manager_notes) && (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    {lead.site_inspector_assigned_name && (
                                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#eff6ff', color: '#1d4ed8', padding: '4px 10px', borderRadius: '6px', fontSize: '0.80rem', fontWeight: 600, border: '1px solid #bfdbfe', width: 'fit-content' }}>
                                                            <UserCheck size={14} color="#2563eb" />
                                                            <span>Site Inspector: <strong>{lead.site_inspector_assigned_name}</strong></span>
                                                        </div>
                                                    )}
                                                    {(lead.qc_notes || lead.site_manager_notes) && (
                                                        <div style={{ backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: '8px', borderLeft: '3px solid #2563eb', fontSize: '0.84rem', color: '#334155' }}>
                                                            <strong style={{ color: '#1e293b' }}>QC Booking Note: </strong> {lead.qc_notes || lead.site_manager_notes}
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
                                                {lead.project_scope || lead.project_type || 'Site Inspection'}
                                            </p>
                                            <button
                                                onClick={() => navigate('/site-leads')}
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

            {/* Assigned Projects & Site Tasks Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
                {/* Projects (Doc Upload & QC focus) */}
                <div className="premium-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h3 style={{ fontWeight: 800, fontSize: '1rem', color: '#0c1527', margin: 0 }}>Assigned Projects (QC & Documents)</h3>
                        <button onClick={() => navigate('/projects')} style={{ background: 'none', border: 'none', color: '#fca412', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 4 }}>View All <ArrowRight size={14} /></button>
                    </div>
                    {projects.length === 0 ? <p style={{ color: '#94a3b8', fontSize: '0.88rem' }}>No projects assigned.</p> : projects.map((p: any) => (
                        <div key={p.project_id} onClick={() => navigate(`/projects/${p.project_id}`)} style={{ padding: '10px 12px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0', cursor: 'pointer', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <p style={{ margin: 0, fontWeight: 700, fontSize: '0.85rem', color: '#0c1527' }}>{p.project_name}</p>
                                <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b' }}>Upload Documents & QC Approvals</p>
                            </div>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 12, backgroundColor: '#dcfce7', color: '#15803d' }}>{p.status}</span>
                        </div>
                    ))}
                </div>

                {/* My Tasks */}
                <div className="premium-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h3 style={{ fontWeight: 800, fontSize: '1rem', color: '#0c1527', margin: 0 }}>Site Tasks</h3>
                        <button onClick={() => navigate('/mb-tasks')} style={{ background: 'none', border: 'none', color: '#fca412', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 4 }}>View All <ArrowRight size={14} /></button>
                    </div>
                    {tasks.length === 0 ? <p style={{ color: '#94a3b8', fontSize: '0.88rem', textAlign: 'center', padding: '20px 0' }}>No tasks assigned.</p> : tasks.map((t: any) => (
                        <div key={t.id} style={{ padding: '9px 12px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div><p style={{ margin: 0, fontWeight: 700, fontSize: '0.85rem', color: '#0c1527' }}>{t.task_title}</p><p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b' }}>{t.target_date ? new Date(t.target_date).toLocaleDateString('en-IN') : '—'}</p></div>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 12, backgroundColor: t.status === 'completed' ? '#dcfce7' : '#fef3c7', color: t.status === 'completed' ? '#15803d' : '#92400e' }}>{t.status?.replace(/_/g, ' ')}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Reimbursements */}
            <div className="premium-card" style={{ marginBottom: 24 }}>
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
