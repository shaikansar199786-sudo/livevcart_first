import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    CheckSquare, Receipt, FileText, SlidersHorizontal, X, Search, 
    ArrowRight, Clock, Clock3, Calendar, MapPin, Phone, ExternalLink, UserCheck, Sparkles,
    CheckCircle, CheckCircle2, Play, Loader2, Info, MessageSquare, Plus, Upload, Folder, FolderPlus,
    ArrowLeft, Trash2, Briefcase
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { API_BASE_URL } from '../config';
import { DashboardFilterBar } from '../components/DashboardFilterBar';
import type { StatementPeriodType, ProjectTypeFilter } from '../components/DashboardFilterBar';
import { BookedSlotsPersonnelTab } from '../components/BookedSlotsPersonnelTab';

export const DesignerDashboard: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const uRole = String(user?.role || '').toLowerCase();
    const isAdminOrPM = ['admin', 'administrator', 'superadmin', 'management', 'owner', 'project_manager', 'pm', 'project_head'].includes(uRole) || uRole.includes('admin') || Boolean(user?.is_admin);

    const [tasks, setTasks] = useState<any[]>([]);
    const [quotes, setQuotes] = useState<any[]>([]);
    const [reimbursements, setReimbursements] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [assignedSlots, setAssignedSlots] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [statementPeriod, setStatementPeriod] = useState<StatementPeriodType>('all');
    const [projectType, setProjectType] = useState<ProjectTypeFilter>('all');
    const [customDates, setCustomDates] = useState({ startDate: '', endDate: '' });
    const [slotViewTab, setSlotViewTab] = useState<'my_slots' | 'all_slots'>('my_slots');

    // Notes & Files Modal State
    const [viewingLeadModal, setViewingLeadModal] = useState<any | null>(null);
    const [modalTab, setModalTab] = useState<'notes' | 'files'>('notes');
    const [notes, setNotes] = useState<any[]>([]);
    const [newNote, setNewNote] = useState('');
    const [filesData, setFilesData] = useState<{ folders: any[]; files: any[] }>({ folders: [], files: [] });
    const [currentFolder, setCurrentFolder] = useState('');
    const [uploading, setUploading] = useState(false);
    const [creatingFolder, setCreatingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');

    // Agreements & Quotes cache
    const [existingAgreements, setExistingAgreements] = useState<any[]>([]);
    const [existingQuotes, setExistingQuotes] = useState<any[]>([]);

    // Meeting status & timers
    const [nowTick, setNowTick] = useState(Date.now());
    const [loadingMeetingIds, setLoadingMeetingIds] = useState<{ [id: string]: boolean }>({});
    const [leadNoticeMsgs, setLeadNoticeMsgs] = useState<{ [leadId: string]: string }>({});

    // Convert to Project Modal State
    const [showConvertModal, setShowConvertModal] = useState(false);
    const [selectedLead, setSelectedLead] = useState<any | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [convertData, setConvertData] = useState({
        project_code: '',
        project_name: '',
        project_type: 'Interior',
        total_budget: '',
        client_address: '',
        start_date: new Date().toISOString().split('T')[0],
        expected_completion_date: '',
        project_head_id: '',
        created_by: ''
    });

    useEffect(() => {
        const timer = setInterval(() => setNowTick(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    const matchesPeriod = (dateStr?: string) => {
        if (!dateStr || statementPeriod === 'all') return true;
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return true;
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        if (statementPeriod === 'today') {
            return d >= startOfToday && d <= endOfToday;
        }
        if (statementPeriod === 'this_month') {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            return d >= startOfMonth && d <= endOfToday;
        }
        if (statementPeriod === 'last_month') {
            const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
            return d >= startOfLastMonth && d <= endOfLastMonth;
        }
        if (statementPeriod === 'last_3_months') {
            const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
            return d >= threeMonthsAgo && d <= endOfToday;
        }
        if (statementPeriod === 'last_6_months') {
            const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
            return d >= sixMonthsAgo && d <= endOfToday;
        }
        if (statementPeriod === 'this_year') {
            const startOfYear = new Date(now.getFullYear(), 0, 1);
            return d >= startOfYear && d <= endOfToday;
        }
        if (statementPeriod.startsWith('year_')) {
            const yr = parseInt(statementPeriod.replace('year_', ''), 10);
            return !isNaN(yr) && d.getFullYear() === yr;
        }
        if (statementPeriod === 'custom' && customDates.startDate && customDates.endDate) {
            const s = new Date(customDates.startDate + 'T00:00:00');
            const e = new Date(customDates.endDate + 'T23:59:59');
            return d >= s && d <= e;
        }
        return true;
    };

    const matchesProjectType = (typeStr?: string) => {
        if (!projectType || projectType === 'all') return true;
        const lower = String(typeStr || '').toLowerCase();
        if (projectType === 'furniture') return lower.includes('furniture');
        if (projectType === 'interior') return lower.includes('interior');
        if (projectType === 'commercial') return lower.includes('commercial');
        return true;
    };

    const buildParams = () => {
        let p = `period=${statementPeriod}&project_type=${projectType}`;
        if (statementPeriod === 'custom' && customDates.startDate && customDates.endDate)
            p += `&start_date=${customDates.startDate}&end_date=${customDates.endDate}`;
        return p;
    };

    useEffect(() => { 
        fetchAll(); 
        fetchExistingAgreements();
    }, [statementPeriod, projectType, customDates, searchQuery]);

    const fetchExistingAgreements = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/agreements`);
            if (res.data && (res.data.success || Array.isArray(res.data.data) || Array.isArray(res.data))) {
                const list = Array.isArray(res.data.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
                setExistingAgreements(list);
            }
        } catch (e) {}
    };

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [taskRes, quotesRes, reimRes, projRes, leadsRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/mb-tasks?${buildParams()}`).catch(() => ({ data: { success: false, data: [] } })),
                axios.get(`${API_BASE_URL}/quotes`).catch(() => ({ data: { success: false, data: [] } })),
                axios.get(`${API_BASE_URL}/reimbursements`, { headers: { 'X-User-Id': user?.user_id, 'X-User-Role': user?.role } }).catch(() => ({ data: { success: false, data: [] } })),
                axios.get(`${API_BASE_URL}/projects?${buildParams()}`).catch(() => ({ data: { success: false, data: [] } })),
                axios.get(`${API_BASE_URL}/leads`).catch(() => ({ data: { success: false, data: [] } }))
            ]);

            if (taskRes.data?.success) {
                let t = (taskRes.data.data || []).filter((x: any) =>
                    ((x.employee_name || '').toLowerCase() === (user?.name || '').toLowerCase() || String(x.user_id) === String(user?.user_id)) && 
                    matchesPeriod(x.created_at || x.target_date || '') &&
                    matchesProjectType(x.project_name || x.project_type || '')
                );
                if (searchQuery) t = t.filter((x: any) => (x.task_title || '').toLowerCase().includes(searchQuery.toLowerCase()));
                setTasks(t.slice(0, 8));
            }
            if (quotesRes.data?.success) {
                const qList = (quotesRes.data.data || []).filter((x: any) => {
                    const qid = String(x.quote_id || '');
                    return qid && !qid.startsWith('lead-') && !qid.startsWith('p-') && !x.is_placeholder && !x.is_synthetic;
                });
                setExistingQuotes(qList);
                let q = qList.filter((x: any) => 
                    matchesPeriod(x.created_at || '') &&
                    matchesProjectType(x.project_type || '')
                );
                if (searchQuery) q = q.filter((x: any) => (x.client_name || '').toLowerCase().includes(searchQuery.toLowerCase()));
                setQuotes(q.slice(0, 5));
            }
            if (reimRes.data?.success) {
                let r = (reimRes.data.data || []).filter((x: any) => matchesPeriod(x.created_at || x.date || ''));
                setReimbursements(r.slice(0, 5));
            }
            if (projRes.data?.success) {
                let p = (projRes.data.data || []).filter((x: any) => 
                    matchesPeriod(x.created_at || x.start_date || '') &&
                    matchesProjectType(x.project_type || '')
                );
                setProjects(p.slice(0, 5));
            }
            if (leadsRes.data?.success) {
                const allLeads: any[] = leadsRes.data.data || [];
                const uId = String(user?.user_id || '').trim();
                const uName = String(user?.name || '').trim().toLowerCase();

                let my = allLeads.filter((l: any) => {
                    const hasBooking = Boolean(l.d1_booking_time || l.associate_designer_assigned_name || l.associate_designer_assigned_id);
                    if (!hasBooking) return false;

                    const adIdList = String(l.associate_designer_assigned_id || '').split(',').map((id: string) => id.trim());
                    const isAdId = uId !== '' && adIdList.includes(uId);

                    const adName = String(l.associate_designer_assigned_name || '').trim().toLowerCase();
                    const isAdName = Boolean(uName && adName && (adName === uName || adName.includes(uName) || uName.includes(adName)));

                    // Strictly show only this Associate Designer's assigned bookings (do not show other designers)
                    return (isAdId || isAdName) && 
                           matchesPeriod(l.d1_booking_time || l.created_at || '') &&
                           matchesProjectType(l.project_type || '');
                });

                if (searchQuery) {
                    const qLower = searchQuery.toLowerCase();
                    my = my.filter((l: any) => 
                        String(l.client_name || '').toLowerCase().includes(qLower) ||
                        String(l.lead_id || '').includes(qLower) ||
                        String(l.location || '').toLowerCase().includes(qLower) ||
                        String(l.contact_number || '').includes(qLower)
                    );
                }

                setAssignedSlots(my);
            }
        } catch (err) {
            console.error('Designer Dashboard error', err);
        } finally {
            setLoading(false);
        }
    };

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

    const hasQuotationCreated = (lead: any) => {
        if (!lead) return false;
        const lId = String(lead.lead_id || '').trim();
        const mcId = String(lead.manual_client_id || '').trim().toLowerCase();
        const pCode = String(lead.project_code || '').trim().toLowerCase();
        const pId = String(lead.project_id || '').trim().toLowerCase();
        const cName = String(lead.client_name || '').trim().toLowerCase();
        const cleanNum = lId.replace(/[^0-9]/g, '');

        const matchingQuote = existingQuotes.find(q => {
            const qPid = String(q.project_id || '').trim().toLowerCase();
            const qCode = String(q.project_code || '').trim().toLowerCase();
            const qClient = String(q.client_name || q.subtitle || '').trim().toLowerCase();

            if (lId && (qPid === lId.toLowerCase() || qCode === lId.toLowerCase())) return true;
            if (mcId && (qPid === mcId || qCode === mcId)) return true;
            if (pCode && (qPid === pCode || qCode === pCode)) return true;
            if (pId && (qPid === pId || qCode === pId)) return true;
            if (cleanNum && cleanNum !== '0') {
                const qClean = qPid.replace(/[^0-9]/g, '');
                if (qClean === cleanNum) return true;
            }
            if (cName && qClient && (qClient === cName || qClient.includes(cName) || cName.includes(qClient))) return true;
            return false;
        });

        if (!matchingQuote) return false;
        return true;
    };

    const hasAgreementSigned = (lead: any) => {
        if (!lead) return { exists: false, isSigned: false };
        const lId = String(lead.lead_id || '').trim().toLowerCase();
        const mcId = String(lead.manual_client_id || '').trim().toLowerCase();
        const pCode = String(lead.project_code || '').trim().toLowerCase();
        const pId = String(lead.project_id || '').trim().toLowerCase();
        const cName = String(lead.client_name || '').trim().toLowerCase();
        const cleanNum = lId.replace(/[^0-9]/g, '');

        const ag = existingAgreements.find(a => {
            const aPid = String(a.project_id || a.lead_id || '').trim().toLowerCase();
            const aCode = String(a.ref_id || a.project_code || '').trim().toLowerCase();
            const aClient = String(a.client_name || '').trim().toLowerCase();

            if (lId && (aPid === lId || aCode === lId)) return true;
            if (mcId && (aPid === mcId || aCode === mcId)) return true;
            if (pCode && (aPid === pCode || aCode === pCode)) return true;
            if (pId && (aPid === pId || aCode === pId)) return true;
            if (cleanNum && cleanNum !== '0') {
                const aClean = aPid.replace(/[^0-9]/g, '');
                if (aClean === cleanNum) return true;
            }
            if (cName && aClient && (aClient === cName || aClient.includes(cName) || cName.includes(aClient))) return true;
            return false;
        });

        if (!ag) return { exists: false, isSigned: false };
        const st = String(ag.status || '').toLowerCase();
        const isSigned = st === 'signed' || st === 'sign' || st === 'completed';
        return { exists: true, isSigned };
    };

    const handleStatusChange = async (leadId: string | number, status: string) => {
        setAssignedSlots(prev => prev.map(l => String(l.lead_id) === String(leadId) ? { ...l, d1_status: status, status: status } : l));
        try {
            const response = await axios.post(`${API_BASE_URL}/leads/update-status`, {
                lead_id: leadId,
                status: status
            });
            if (response.data.success) {
                axios.post(`${API_BASE_URL}/leads/book-d1`, {
                    lead_id: leadId,
                    status: status
                }).catch(() => {});
            } else {
                alert(response.data.message || 'Failed to update status');
                fetchAll();
            }
        } catch (err) {
            alert('Error updating status');
            fetchAll();
        }
    };

    // Notes and Files Modal Handlers
    const openLeadModal = (lead: any) => {
        setViewingLeadModal(lead);
        setModalTab('notes');
        setCurrentFolder('');
        fetchNotes(lead.lead_id);
        fetchFiles(lead.lead_id, '');
    };

    const fetchNotes = async (lead_id: string | number) => {
        try {
            const res = await axios.get(`${API_BASE_URL}/leads/notes?lead_id=${lead_id}`);
            if (res.data.success) setNotes(res.data.data || []);
        } catch (err) {
            console.error('Failed to fetch notes', err);
        }
    };

    const handleAddNote = async () => {
        if (!viewingLeadModal || !newNote.trim()) return;
        try {
            const res = await axios.post(`${API_BASE_URL}/leads/notes`, {
                lead_id: viewingLeadModal.lead_id,
                user_id: user?.user_id,
                note_text: newNote.trim()
            });
            if (res.data.success) {
                setNewNote('');
                fetchNotes(viewingLeadModal.lead_id);
            }
        } catch (err) {
            console.error('Failed to add note', err);
        }
    };

    const fetchFiles = async (lead_id: string | number, folder: string = '') => {
        try {
            const res = await axios.get(`${API_BASE_URL}/leads/files?lead_id=${lead_id}&folder=${folder}`);
            if (res.data.success && Array.isArray(res.data.data)) {
                setFilesData({
                    folders: res.data.data.filter((f: any) => f.type === 'folder'),
                    files: res.data.data.filter((f: any) => f.type === 'file')
                });
            }
        } catch (err) {
            console.error('Failed to fetch files', err);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files[0] || !viewingLeadModal) return;
        const file = e.target.files[0];
        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('lead_id', String(viewingLeadModal.lead_id));
        formData.append('folder', currentFolder);

        try {
            const res = await axios.post(`${API_BASE_URL}/leads/upload`, formData);
            if (res.data.success) {
                fetchFiles(viewingLeadModal.lead_id, currentFolder);
            } else {
                alert(res.data.message || 'Failed to upload file');
            }
        } catch (err: any) {
            alert('Upload error: ' + (err.response?.data?.message || err.message));
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const handleCreateFolder = async () => {
        if (!viewingLeadModal || !newFolderName.trim()) return;
        setCreatingFolder(true);
        try {
            const res = await axios.post(`${API_BASE_URL}/leads/create-folder`, {
                lead_id: viewingLeadModal.lead_id,
                folder_name: newFolderName.trim(),
                parent_folder: currentFolder
            });
            if (res.data.success) {
                setNewFolderName('');
                fetchFiles(viewingLeadModal.lead_id, currentFolder);
            } else {
                alert(res.data.message);
            }
        } catch (err) {
            console.error('Failed to create folder', err);
        } finally {
            setCreatingFolder(false);
        }
    };

    const handleDeleteFile = async (filename: string) => {
        if (!viewingLeadModal || !window.confirm('Are you sure you want to delete this file/folder?')) return;
        try {
            const res = await axios.delete(`${API_BASE_URL}/leads/files?lead_id=${viewingLeadModal.lead_id}&filename=${filename}&folder=${currentFolder}`);
            if (res.data.success) {
                fetchFiles(viewingLeadModal.lead_id, currentFolder);
            }
        } catch (err) {
            console.error('Failed to delete file', err);
        }
    };

    const getFileUrl = (rawUrl?: string) => {
        if (!rawUrl) return '#';
        if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) return rawUrl;
        const backendRoot = API_BASE_URL.replace(/\/api\/?$/, '');
        const cleanPath = rawUrl.startsWith('/') ? rawUrl : '/' + rawUrl;
        return backendRoot + cleanPath;
    };

    const handleConversionSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedLead) return;
        setSubmitting(true);
        try {
            const response = await axios.post(`${API_BASE_URL}/leads/update-status`, {
                lead_id: selectedLead.lead_id,
                status: 'won',
                data: convertData
            });
            if (response.data.success) {
                alert('Project started successfully!');
                setShowConvertModal(false);
                navigate('/projects');
            } else {
                alert('Failed to start project: ' + (response.data.message || 'Unknown error'));
            }
        } catch (error: any) {
            alert('Error starting project: ' + (error.response?.data?.message || error.message));
        } finally {
            setSubmitting(false);
        }
    };

    // Helper to determine if a consultation has already been completed, won, or converted
    const isLeadMeetingCompleted = (lead: any) => {
        const s = String(lead.status || '').toLowerCase();
        const d1s = String(lead.d1_status || '').toLowerCase();
        const finishedList = ['meeting_completed', 'completed', 'won', 'converted', 'proposal_sent', 'lost', 'dead', 'cancelled', 'dropped'];
        return finishedList.includes(s) || finishedList.includes(d1s) || Boolean(lead.meeting_ended_at) || Boolean(lead.d1_meeting_ended_at);
    };

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // Upcoming: consultations scheduled for today or future dates that are NOT yet completed or converted
    const upcomingAppointments = assignedSlots.filter(lead => {
        const bTime = lead.d1_booking_time || lead.booking_time;
        if (!bTime) return false;
        const bookingDate = new Date(bTime);
        if (isNaN(bookingDate.getTime())) return false;

        // If already completed, won, or converted -> belongs to Past Consultations
        if (isLeadMeetingCompleted(lead)) return false;

        const s = String(lead.status || '').toLowerCase();
        const d1s = String(lead.d1_status || '').toLowerCase();
        // If actively in meeting right now -> Upcoming/Active
        if (s === 'in_meeting' || d1s === 'in_meeting') return true;

        // All appointments scheduled for today (regardless of hour) or in the future
        return bookingDate >= startOfToday;
    }).sort((a, b) => new Date(a.d1_booking_time || a.booking_time || 0).getTime() - new Date(b.d1_booking_time || b.booking_time || 0).getTime());

    // Past: consultations already completed/converted, or scheduled before today
    const pastAppointments = assignedSlots.filter(lead => {
        const bTime = lead.d1_booking_time || lead.booking_time;
        if (!bTime) return false;
        const bookingDate = new Date(bTime);
        if (isNaN(bookingDate.getTime())) return false;

        if (isLeadMeetingCompleted(lead)) return true;
        return bookingDate < startOfToday;
    }).sort((a, b) => new Date(b.d1_booking_time || b.booking_time || 0).getTime() - new Date(a.d1_booking_time || a.booking_time || 0).getTime());

    const hasActiveFilters = statementPeriod !== 'all' || projectType !== 'all' || searchQuery !== '';
    const pendingTasks = tasks.filter(t => ['pending', 'pending_admin_review'].includes(t.status)).length;

    if (loading) return (
        <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#ff6b00', animation: 'pulse 2s infinite' }}>
                <Clock size={48} style={{ marginBottom: '20px' }} />
                <p style={{ color: '#4a5568', fontWeight: 600, fontFamily: "'Inter', sans-serif", fontSize: '1.2rem', letterSpacing: '1px' }}>SYNCING DASHBOARD...</p>
            </div>
        </div>
    );

    const kpis = [
        { label: 'Assigned Slots', value: assignedSlots.length, color: '#ea580c', icon: <Calendar size={22} /> },
        { label: 'My Tasks', value: tasks.length, color: '#fca412', icon: <CheckSquare size={22} /> },
        { label: 'Pending Tasks', value: pendingTasks, color: '#0c1527', icon: <Clock size={22} /> },
        { label: 'My Quotes', value: quotes.length, color: '#fca412', icon: <FileText size={22} /> },
        { label: 'Reimbursements', value: reimbursements.length, color: '#0c1527', icon: <Receipt size={22} /> },
    ];

    return (
        <div className="dashboard-content" style={{ width: '100%', padding: '20px 24px', paddingBottom: '40px', boxSizing: 'border-box' }}>
            {/* Header */}
            <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0c1527', margin: '0 0 4px 0' }}>Welcome back, {user?.name}</h2>
                    <p style={{ color: '#64748b', margin: 0 }}>Associate Designer Dashboard — your booked consultations, tasks, quotes, and reimbursements.</p>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: 12, pointerEvents: 'none' }} />
                        <input 
                            type="text" 
                            placeholder="Search slots, tasks, quotes..." 
                            value={searchQuery} 
                            onChange={e => setSearchQuery(e.target.value)} 
                            onFocus={e => (e.target.style.borderColor = '#ea580c')} 
                            onBlur={e => (e.target.style.borderColor = '#e2e8f0')} 
                            style={{ paddingLeft: 36, paddingRight: searchQuery ? 36 : 14, paddingTop: 9, paddingBottom: 9, borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.85rem', color: '#0c1527', background: '#f8fafc', outline: 'none', width: 260 }} 
                        />
                        {searchQuery && <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: 10, background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex' }}><X size={14} /></button>}
                    </div>
                    <button onClick={() => setShowFilters(p => !p)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 10, backgroundColor: showFilters ? '#ea580c' : '#0c1527', color: showFilters ? '#fff' : '#ea580c', border: '1.5px solid', borderColor: showFilters ? '#ea580c' : '#0c1527', fontSize: '0.88rem', fontWeight: 800, cursor: 'pointer', position: 'relative' }}>
                        {showFilters ? <X size={15} /> : <SlidersHorizontal size={15} />}
                        {showFilters ? 'Close' : 'Filters'}
                        {hasActiveFilters && !showFilters && <span style={{ position: 'absolute', top: -5, right: -5, width: 10, height: 10, borderRadius: '50%', backgroundColor: '#ea580c', border: '2px solid #fff' }} />}
                    </button>
                </div>
            </div>

            {showFilters && <DashboardFilterBar statementPeriod={statementPeriod} onStatementPeriodChange={(period, custom) => { setStatementPeriod(period); if (custom) setCustomDates(custom); }} projectType={projectType} onProjectTypeChange={setProjectType} />}

            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
                {kpis.map(k => (
                    <div key={k.label} className="premium-card" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', borderRadius: '14px', background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                        <div style={{ padding: 12, borderRadius: 12, backgroundColor: `${k.color}15`, color: k.color }}>{k.icon}</div>
                        <div>
                            <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0, fontWeight: 600 }}>{k.label}</p>
                            <h4 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0c1527', margin: 0 }}>{k.value}</h4>
                        </div>
                    </div>
                ))}
            </div>

            {/* Navigation Tabs Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                        onClick={() => setSlotViewTab('my_slots')}
                        style={{
                            padding: '9px 18px',
                            borderRadius: '10px',
                            border: '1.5px solid',
                            borderColor: slotViewTab === 'my_slots' ? '#ea580c' : '#e2e8f0',
                            backgroundColor: slotViewTab === 'my_slots' ? '#fff7ed' : '#ffffff',
                            color: slotViewTab === 'my_slots' ? '#c2410c' : '#64748b',
                            fontWeight: 800,
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.15s'
                        }}
                    >
                        <Clock3 size={16} /> Consultations View ({upcomingAppointments.length} Upcoming)
                    </button>
                    <button
                        onClick={() => setSlotViewTab('all_slots')}
                        style={{
                            padding: '9px 18px',
                            borderRadius: '10px',
                            border: '1.5px solid',
                            borderColor: slotViewTab === 'all_slots' ? '#ea580c' : '#e2e8f0',
                            backgroundColor: slotViewTab === 'all_slots' ? '#fff7ed' : '#ffffff',
                            color: slotViewTab === 'all_slots' ? '#c2410c' : '#64748b',
                            fontWeight: 800,
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.15s'
                        }}
                    >
                        <Calendar size={16} /> Multi-Role Personnel Tab
                    </button>
                </div>

                <button 
                    onClick={() => navigate('/d1-leads')} 
                    style={{ 
                        padding: '9px 18px', 
                        borderRadius: '10px', 
                        border: 'none', 
                        backgroundColor: '#0c1527', 
                        color: '#ffffff', 
                        fontWeight: 700, 
                        fontSize: '0.84rem', 
                        cursor: 'pointer', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 6 
                    }}
                >
                    D1 / AD Leads <ArrowRight size={14} />
                </button>
            </div>

            {/* TAB VIEW 1: Multi-Role Personnel Tab */}
            {slotViewTab === 'all_slots' ? (
                <div style={{ marginBottom: '28px' }}>
                    <BookedSlotsPersonnelTab initialTab="associate_designer" />
                </div>
            ) : (
                /* TAB VIEW 2: Upcoming & Past Consultations (Exact D1 Dashboard Layout) */
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', alignItems: 'start', marginBottom: '32px' }}>

                    {/* Main Left Area: Upcoming Consultations */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', border: '1px solid #e5e7eb' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Clock3 size={18} color="#6b7280" />
                                    Upcoming Consultations
                                </h3>
                            </div>

                            {upcomingAppointments.length === 0 ? (
                                <div style={{ border: '2px dashed #e5e7eb', borderRadius: '12px', padding: '40px', textAlign: 'center' }}>
                                    <Calendar size={40} color="#9ca3af" style={{ margin: '0 auto 12px auto' }} />
                                    <p style={{ fontWeight: 500, color: '#374151', margin: 0 }}>No upcoming appointments</p>
                                    <p style={{ color: '#6b7280', marginTop: '4px', fontSize: '0.85rem' }}>You're all caught up for now.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {upcomingAppointments.map((lead: any) => (
                                        <div
                                            key={lead.lead_id}
                                            style={{
                                                backgroundColor: '#ffffff',
                                                padding: '20px',
                                                borderRadius: '12px',
                                                border: '1px solid #e5e7eb',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '16px'
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <div>
                                                    <h4 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#111827', margin: '0 0 4px 0' }}>{lead.client_name}</h4>
                                                    <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#4b5563', backgroundColor: '#f3f4f6', padding: '4px 8px', borderRadius: '4px', display: 'inline-block' }}>
                                                        {lead.project_type || 'General Design'}
                                                    </span>
                                                </div>

                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                                                        <Clock size={16} color="#6b7280" />
                                                        {formatTime(lead.d1_booking_time)}
                                                    </div>
                                                    <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '4px' }}>
                                                        {formatDate(lead.d1_booking_time)}
                                                    </div>
                                                </div>
                                            </div>

                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', paddingTop: '16px', borderTop: '1px solid #f3f4f6' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4b5563' }}>
                                                    <Phone size={14} />
                                                    <span style={{ fontSize: '0.9rem' }}>{lead.contact_number}</span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4b5563' }}>
                                                    <MapPin size={14} />
                                                    <span style={{ fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lead.location}</span>
                                                </div>
                                            </div>

                                            {((lead as any).associate_designer_assigned_name || lead.d1_notes) && (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    {(lead as any).associate_designer_assigned_name && (
                                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#eef2ff', color: '#4338ca', padding: '5px 12px', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 600, border: '1px solid #c7d2fe', width: 'fit-content' }}>
                                                            <UserCheck size={14} color="#6366f1" />
                                                            <span>Associate Designer (AD): <strong>{(lead as any).associate_designer_assigned_name}</strong></span>
                                                        </div>
                                                    )}
                                                    {lead.d1_notes && (
                                                        <div style={{ backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: '8px', borderLeft: '3px solid #3b82f6', fontSize: '0.85rem', color: '#334155' }}>
                                                            <strong style={{ color: '#1e293b' }}>D1 Booking Note: </strong> {lead.d1_notes}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: '4px', borderTop: '1px solid #f3f4f6', paddingTop: '12px' }}>
                                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                    {(() => {
                                                        const isMeetingFinishedOrPassed = ['meeting_completed', 'completed', 'proposal_sent', 'proposal_accepted', 'converted', 'won', 'lost', 'dead', 'cancelled', 'dropped'].includes((lead.status || '').toLowerCase()) || 
                                                            ['meeting_completed', 'completed', 'proposal_sent', 'proposal_accepted', 'converted', 'won'].includes((lead.d1_status || '').toLowerCase()) || 
                                                            Boolean((lead as any).meeting_ended_at) || Boolean((lead as any).d1_meeting_ended_at) ||
                                                            Boolean((lead as any).project_id) || Boolean((lead as any).is_converted);
                                                        const isMeetingActive = lead.status === 'in_meeting' || lead.d1_status === 'in_meeting';

                                                        if (isMeetingFinishedOrPassed) return null;

                                                        if (loadingMeetingIds[lead.lead_id]) {
                                                            return (
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
                                                                    <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Processing...
                                                                </button>
                                                            );
                                                        }

                                                        if (isMeetingActive) {
                                                            return (
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
                                                                        onClick={() => {
                                                                            setLoadingMeetingIds(prev => ({ ...prev, [lead.lead_id]: true }));
                                                                            handleStatusChange(lead.lead_id, 'meeting_completed').finally(() => {
                                                                                setLoadingMeetingIds(prev => ({ ...prev, [lead.lead_id]: false }));
                                                                            });
                                                                        }}
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
                                                            );
                                                        }

                                                        return (
                                                            <button
                                                                onClick={() => {
                                                                    setLoadingMeetingIds(prev => ({ ...prev, [lead.lead_id]: true }));
                                                                    handleStatusChange(lead.lead_id, 'in_meeting').finally(() => {
                                                                        setLoadingMeetingIds(prev => ({ ...prev, [lead.lead_id]: false }));
                                                                    });
                                                                }}
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
                                                                <Play size={14} fill="white" /> Start Meeting
                                                            </button>
                                                        );
                                                    })()}

                                                    {(lead.status === 'won' || lead.status === 'converted') && (
                                                        <span style={{
                                                            backgroundColor: '#dcfce7',
                                                            color: '#15803d',
                                                            padding: '8px 14px',
                                                            borderRadius: '8px',
                                                            fontWeight: 600,
                                                            fontSize: '0.85rem',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '6px',
                                                            border: '1px solid #bbf7d0'
                                                        }}>
                                                            <CheckCircle2 size={14} /> Ongoing Project
                                                        </span>
                                                    )}

                                                    {(lead.status === 'converted' || lead.status === 'won' || lead.d1_status === 'converted' || lead.d1_status === 'won') && isAdminOrPM && (
                                                        <button
                                                            onClick={async () => {
                                                                setSelectedLead(lead);
                                                                setConvertData(prev => ({
                                                                    ...prev,
                                                                    project_name: lead.client_name + ' Project',
                                                                    created_by: user?.user_id || ''
                                                                }));
                                                                setShowConvertModal(true);
                                                            }}
                                                            style={{
                                                                backgroundColor: '#16a34a',
                                                                color: '#ffffff',
                                                                padding: '8px 14px',
                                                                borderRadius: '8px',
                                                                fontWeight: 700,
                                                                fontSize: '0.85rem',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '6px',
                                                                border: 'none',
                                                                cursor: 'pointer',
                                                                boxShadow: '0 2px 6px rgba(22, 163, 74, 0.25)'
                                                            }}
                                                        >
                                                            <CheckCircle size={14} /> Start Project
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Area: Past Consultations */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                            <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb' }}>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <CheckCircle size={18} color="#6b7280" /> Past Consultations {pastAppointments.length > 4 && <span style={{ fontSize: '0.8rem', color: '#9ca3af', fontWeight: 500 }}>(Last 4)</span>}
                                </h3>
                            </div>

                            {pastAppointments.length === 0 ? (
                                <div style={{ padding: '32px', textAlign: 'center', color: '#6b7280', fontSize: '0.9rem' }}>
                                    No past consultations yet
                                </div>
                            ) : (
                                <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                                    {pastAppointments.slice(0, 4).map((lead: any, idx: number) => (
                                        <div key={lead.lead_id} style={{
                                            padding: '16px 20px',
                                            borderBottom: idx === Math.min(pastAppointments.length, 4) - 1 ? 'none' : '1px solid #f3f4f6'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                                <h4 style={{ fontWeight: 600, color: '#111827', margin: 0, fontSize: '0.95rem' }}>{lead.client_name}</h4>
                                                <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#4b5563', backgroundColor: '#f3f4f6', padding: '2px 6px', borderRadius: '4px' }}>
                                                    {new Date(lead.d1_booking_time || lead.booking_time || '').toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                                                <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <Briefcase size={12} />
                                                    {lead.project_scope || lead.project_type || 'Design Consultation'}
                                                </p>
                                                <button
                                                    onClick={() => openLeadModal(lead)}
                                                    style={{
                                                        backgroundColor: 'transparent',
                                                        color: '#2563eb',
                                                        border: 'none',
                                                        fontSize: '0.8rem',
                                                        fontWeight: 600,
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }}
                                                >
                                                    <FileText size={12} /> Notes & Files
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Existing Sub-grids: Tasks & Quotes */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
                {/* My Tasks */}
                <div className="premium-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h3 style={{ fontWeight: 800, fontSize: '1rem', color: '#0c1527', margin: 0 }}>My Tasks ({tasks.length})</h3>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <button onClick={() => navigate('/mb-tasks')} style={{ padding: '5px 10px', borderRadius: 8, border: 'none', backgroundColor: '#ea580c', color: 'white', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Plus size={12} /> Propose Task</button>
                            <button onClick={() => navigate('/mb-tasks')} style={{ background: 'none', border: 'none', color: '#ea580c', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 4 }}>View All <ArrowRight size={14} /></button>
                        </div>
                    </div>
                    {tasks.length === 0 ? <p style={{ color: '#94a3b8', fontSize: '0.88rem', textAlign: 'center', padding: '20px 0' }}>No tasks assigned.</p> : tasks.map((t: any) => (
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
                        <button onClick={() => navigate('/quotes')} style={{ background: 'none', border: 'none', color: '#ea580c', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 4 }}>View All <ArrowRight size={14} /></button>
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
                    <h3 style={{ fontWeight: 800, fontSize: '1rem', color: '#0c1527', margin: 0 }}>My Reimbursements ({reimbursements.length})</h3>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button onClick={() => navigate('/reimbursements')} style={{ padding: '5px 10px', borderRadius: 8, border: 'none', backgroundColor: '#0c1527', color: 'white', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Plus size={12} /> Request Claim</button>
                        <button onClick={() => navigate('/reimbursements')} style={{ background: 'none', border: 'none', color: '#ea580c', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 4 }}>View All <ArrowRight size={14} /></button>
                    </div>
                </div>
                {reimbursements.length === 0 ? <p style={{ color: '#94a3b8', fontSize: '0.88rem', textAlign: 'center', padding: '10px 0' }}>No reimbursements yet.</p> : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                        {reimbursements.map((r: any) => (
                            <div key={r.id} style={{ padding: '10px 14px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div><p style={{ margin: 0, fontWeight: 700, fontSize: '0.85rem', color: '#0c1527' }}>{r.category}</p><p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b' }}>{r.reason}</p></div>
                                <div style={{ textAlign: 'right' }}>
                                    <p style={{ margin: 0, fontWeight: 800, color: '#ea580c' }}>₹{parseFloat(r.amount).toLocaleString()}</p>
                                    <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '1px 8px', borderRadius: 12, backgroundColor: r.status === 'approved' ? '#dcfce7' : r.status === 'rejected' ? '#fee2e2' : '#fef3c7', color: r.status === 'approved' ? '#15803d' : r.status === 'rejected' ? '#991b1b' : '#92400e' }}>{r.status}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Notes & Files Modal */}
            {viewingLeadModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
                    <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827', margin: 0 }}>{viewingLeadModal.client_name} - Consultation Documents</h3>
                                <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: '4px 0 0 0' }}>View sales notes and manage client files.</p>
                            </div>
                            <button onClick={() => setViewingLeadModal(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#9ca3af' }}><X size={20} /></button>
                        </div>

                        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', padding: '0 24px', backgroundColor: '#f9fafb' }}>
                            <button onClick={() => setModalTab('notes')} style={{ padding: '12px 16px', border: 'none', borderBottom: modalTab === 'notes' ? '2px solid #ea580c' : 'none', background: 'transparent', color: modalTab === 'notes' ? '#ea580c' : '#6b7280', fontWeight: 600, cursor: 'pointer' }}>Notes & Scope</button>
                            <button onClick={() => setModalTab('files')} style={{ padding: '12px 16px', border: 'none', borderBottom: modalTab === 'files' ? '2px solid #ea580c' : 'none', background: 'transparent', color: modalTab === 'files' ? '#ea580c' : '#6b7280', fontWeight: 600, cursor: 'pointer' }}>Files & Photos</button>
                        </div>

                        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
                            {modalTab === 'notes' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <textarea rows={2} value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Add note..." style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                                        <button onClick={handleAddNote} disabled={!newNote.trim()} style={{ backgroundColor: '#0c1527', color: 'white', padding: '0 16px', borderRadius: '8px', border: 'none', fontWeight: 600, cursor: newNote.trim() ? 'pointer' : 'not-allowed' }}>Add Note</button>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {notes.length === 0 ? <p style={{ color: '#94a3b8', textAlign: 'center' }}>No notes recorded yet.</p> : notes.map(n => (
                                            <div key={n.id} style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                    <strong style={{ fontSize: '0.85rem' }}>{n.user_name || 'Team Member'}</strong>
                                                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{new Date(n.created_at).toLocaleString('en-IN')}</span>
                                                </div>
                                                <p style={{ margin: 0, fontSize: '0.88rem', color: '#334155' }}>{n.note_text}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {modalTab === 'files' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <label style={{ backgroundColor: '#2563eb', color: 'white', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            {uploading ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
                                            Upload Document
                                            <input type="file" onChange={handleFileUpload} disabled={uploading} style={{ display: 'none' }} />
                                        </label>
                                    </div>

                                    {filesData.files.length === 0 ? <p style={{ color: '#94a3b8', textAlign: 'center', padding: '20px 0' }}>No files uploaded yet.</p> : (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
                                            {filesData.files.map(f => (
                                                <div key={f.name} style={{ padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <a href={getFileUrl(f.url)} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.78rem', color: '#2563eb', fontWeight: 700 }}>Download</a>
                                                        <button onClick={() => handleDeleteFile(f.name)} style={{ border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer' }}><Trash2 size={13} /></button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Convert / Start Project Modal */}
            {showConvertModal && selectedLead && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
                    <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '520px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0c1527', margin: 0 }}>Start Project: {selectedLead.client_name}</h3>
                            <button onClick={() => setShowConvertModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleConversionSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div>
                                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Project Name</label>
                                <input type="text" required value={convertData.project_name} onChange={e => setConvertData({ ...convertData, project_name: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                                <button type="button" onClick={() => setShowConvertModal(false)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>Cancel</button>
                                <button type="submit" disabled={submitting} style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', backgroundColor: '#16a34a', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>{submitting ? 'Starting...' : 'Confirm & Start'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
