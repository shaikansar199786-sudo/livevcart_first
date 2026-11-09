import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { DashboardFilterBar } from '../components/DashboardFilterBar';
import type { StatementPeriodType, ProjectTypeFilter } from '../components/DashboardFilterBar';
import {
  Users, Clock, Search, Calendar, MapPin, Phone, Loader2, ArrowRight, ShieldCheck, SlidersHorizontal, X, FileText, Play, CheckCircle2, CheckCircle, Folder, Eye, RotateCcw, RefreshCw, MessageSquare
} from 'lucide-react';

interface Lead {
  lead_id: string;
  client_name: string;
  contact_number: string;
  email: string;
  location: string;
  client_address?: string;
  project_type: string;
  project_scope?: string;
  custom_scope?: string;
  manual_client_id?: string;
  project_code?: string;
  estimated_budget?: string;
  status: string;
  qc_status?: string;
  site_inspector_status?: string;
  site_manager_status?: string;
  qc_notes?: string;
  site_manager_notes?: string;
  site_manager_booking_time?: string;
  site_inspector_booking_time?: string;
  qc_booking_time?: string;
  site_inspector_assigned_id?: any;
  site_inspector_assigned_name?: string;
  site_inspector_meeting_ended_at?: string;
  qc_meeting_ended_at?: string;
  d1_assigned_to?: number;
  d1_booking_time?: string;
  d1_notes?: string;
  is_qc_completed?: number;
  is_qc_done?: number;
  created_at?: string;
}

export const SiteLeadsPage: React.FC = () => {
  const { user } = useAuth();
  const userRole = String(user?.role || '').toLowerCase();
  const isAdmin = ['admin', 'super_admin', 'administrator', 'superadmin', 'management', 'owner'].includes(userRole) || userRole.includes('admin');
  const navigate = useNavigate();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [statementPeriod, setStatementPeriod] = useState<StatementPeriodType>('all');
  const [projectType, setProjectType] = useState<ProjectTypeFilter>('all');
  const [customDates, setCustomDates] = useState({ startDate: '', endDate: '' });
  const [nowTick, setNowTick] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const resetFilters = () => {
    setSearchQuery('');
    setStatementPeriod('all');
    setProjectType('all');
    setCustomDates({ startDate: '', endDate: '' });
  };

  // Notes & Docs Modal State
  const [viewingLeadModal, setViewingLeadModal] = useState<Lead | null>(null);
  const [modalTab, setModalTab] = useState<'notes' | 'files'>('notes');
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState('');
  const [filesData, setFilesData] = useState<{ folders: any[]; files: any[] }>({ folders: [], files: [] });
  const [currentFolder, setCurrentFolder] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchBookedLeads();
  }, []);

  const fetchBookedLeads = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/leads`);
      if (response.data && response.data.success) {
        const allLeads = Array.isArray(response.data.data) ? response.data.data : [];

        // 1. STRICTLY only Site Inspector / QC slots (no D1-only, no MMT-only)
        const siteInspectorLeads = allLeads.filter((l: any) => {
          const hasTime = Boolean(
            (l.site_inspector_booking_time && String(l.site_inspector_booking_time).trim() !== '' && l.site_inspector_booking_time !== '0000-00-00 00:00:00') ||
            (l.qc_booking_time && String(l.qc_booking_time).trim() !== '' && l.qc_booking_time !== '0000-00-00 00:00:00') ||
            (l.site_manager_booking_time && String(l.site_manager_booking_time).trim() !== '' && l.site_manager_booking_time !== '0000-00-00 00:00:00')
          );
          const hasInspectorName = Boolean(
            l.site_inspector_assigned_name &&
            l.site_inspector_assigned_name.trim() !== '' &&
            l.site_inspector_assigned_name !== 'Not assigned' &&
            l.site_inspector_assigned_name !== 'Pending Assignment'
          );
          const hasInspectorId = Boolean(
            l.site_inspector_assigned_id &&
            String(l.site_inspector_assigned_id) !== '0' &&
            String(l.site_inspector_assigned_id) !== 'null'
          );
          const hasQcStatus = Boolean(
            (l.site_inspector_status && !['enquiry', 'pending', 'draft', 'unassigned'].includes(String(l.site_inspector_status).toLowerCase())) ||
            (l.qc_status && !['enquiry', 'pending', 'draft', 'unassigned'].includes(String(l.qc_status).toLowerCase()))
          );

          return hasTime || hasInspectorName || hasInspectorId || hasQcStatus;
        });

        // 2. Strict User Scoping: Inspector X sees ONLY Inspector X's meetings
        if (!isAdmin) {
          const loggedUid = String(user?.user_id || (user as any)?.id || '').trim();
          const loggedName = String(user?.name || '').toLowerCase().trim();
          const myLeads = siteInspectorLeads.filter((l: any) => {
            const assignedIds = String(l.site_inspector_assigned_id || l.site_manager_assigned_to || '')
              .split(',')
              .map((s: string) => s.trim())
              .filter(Boolean);
            if (loggedUid && assignedIds.includes(loggedUid)) return true;

            const assignedNames = String(l.site_inspector_assigned_name || '')
              .split(',')
              .map((s: string) => s.trim().toLowerCase())
              .filter(Boolean);
            if (loggedName && assignedNames.some(n => n === loggedName || n.includes(loggedName) || loggedName.includes(n))) return true;

            return false;
          });
          // STRICT: Do NOT fallback to all site inspector leads. Only show this specific person's meetings!
          setLeads(myLeads);
        } else {
          setLeads(siteInspectorLeads);
        }
      }
    } catch (err) {
      console.error('Failed to fetch Site Inspector leads', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartMeeting = async (lead: Lead) => {
    const startKey = `meeting_started_at_${lead.lead_id}`;
    localStorage.setItem(startKey, String(Date.now()));
    window.dispatchEvent(new CustomEvent('qc_meeting_status_changed', { detail: { status: 'in_meeting', lead_id: lead.lead_id } }));
    window.dispatchEvent(new CustomEvent('qc_status_changed', { detail: { status: 'in_meeting', lead_id: lead.lead_id } }));

    setLeads(prev => prev.map(l => l.lead_id === lead.lead_id ? {
      ...l,
      qc_status: 'in_meeting',
      site_inspector_status: 'in_meeting',
      site_manager_status: 'in_meeting'
    } : l));

    try {
      await axios.post(`${API_BASE_URL}/leads/update-qc-status`, { lead_id: lead.lead_id, status: 'in_meeting', assigned_by_name: user?.name || 'Site Inspector' });
      fetchBookedLeads();
    } catch (err) {
      console.error('Start meeting error', err);
    }
  };

  const handleEndMeeting = async (lead: Lead) => {
    const startKey = `meeting_started_at_${lead.lead_id}`;
    localStorage.removeItem(startKey);
    window.dispatchEvent(new CustomEvent('qc_meeting_status_changed', { detail: { status: 'meeting_completed', lead_id: lead.lead_id } }));
    window.dispatchEvent(new CustomEvent('qc_status_changed', { detail: { status: 'meeting_completed', lead_id: lead.lead_id } }));

    setLeads(prev => prev.map(l => l.lead_id === lead.lead_id ? {
      ...l,
      qc_status: 'meeting_completed',
      site_inspector_status: 'meeting_completed',
      site_manager_status: 'meeting_completed',
      is_qc_completed: 1,
      is_qc_done: 1
    } : l));

    try {
      await axios.post(`${API_BASE_URL}/leads/update-qc-status`, { lead_id: lead.lead_id, status: 'meeting_completed', assigned_by_name: user?.name || 'Site Inspector' });
      fetchBookedLeads();
    } catch (err) {
      console.error('End meeting error', err);
    }
  };

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    setLeads(prev => prev.map(l => l.lead_id === leadId ? {
      ...l,
      qc_status: newStatus,
      site_inspector_status: newStatus,
      site_manager_status: newStatus
    } : l));
    try {
      await axios.post(`${API_BASE_URL}/leads/update-qc-status`, { lead_id: leadId, status: newStatus, assigned_by_name: user?.name || 'Site Inspector' });
      fetchBookedLeads();
    } catch (err) {
      alert('Error updating status');
      fetchBookedLeads();
    }
  };

  const openLeadModal = (lead: Lead) => {
    setViewingLeadModal(lead);
    setModalTab('notes');
    setCurrentFolder('');
    fetchNotes(lead.lead_id);
    fetchFiles(lead.lead_id, '');
  };

  const fetchNotes = async (lead_id: string) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/leads/notes?lead_id=${lead_id}`);
      if (response.data.success) {
        setNotes(response.data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch notes', err);
    }
  };

  const fetchFiles = async (lead_id: string, folder: string = '') => {
    try {
      const response = await axios.get(`${API_BASE_URL}/leads/files?lead_id=${lead_id}&folder=${folder}`);
      if (response.data.success && Array.isArray(response.data.data)) {
        setFilesData({
          folders: response.data.data.filter((f: any) => f.type === 'folder'),
          files: response.data.data.filter((f: any) => f.type === 'file')
        });
      }
    } catch (err) {
      console.error('Failed to fetch files', err);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !viewingLeadModal) return;
    try {
      const response = await axios.post(`${API_BASE_URL}/leads/notes`, {
        lead_id: viewingLeadModal.lead_id,
        note_text: newNote
      });
      if (response.data.success) {
        setNewNote('');
        fetchNotes(viewingLeadModal.lead_id);
      }
    } catch (err) {
      console.error('Failed to add note', err);
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
      const response = await axios.post(`${API_BASE_URL}/leads/upload`, formData);
      if (response.data.success) {
        fetchFiles(viewingLeadModal.lead_id, currentFolder);
      } else {
        alert(response.data.message || 'Failed to upload file');
      }
    } catch (err: any) {
      alert('Upload error: ' + (err.response?.data?.message || err.message));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const getFileUrl = (rawUrl?: string) => {
    if (!rawUrl) return '#';
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) return rawUrl;
    const backendRoot = API_BASE_URL.replace(/\/api\/?$/, '');
    let cleanPath = rawUrl.startsWith('/demoark/') ? rawUrl.replace('/demoark/', '/') : rawUrl;
    return backendRoot + (cleanPath.startsWith('/') ? cleanPath : '/' + cleanPath);
  };

  const formatSlotDateTime = (lead: Lead) => {
    const raw = lead.site_inspector_booking_time || lead.qc_booking_time || lead.site_manager_booking_time;
    if (!raw || raw === '0000-00-00 00:00:00') return { dateText: 'Not Scheduled', timeText: '', fullText: 'Not Scheduled' };
    try {
      const d = new Date(raw);
      if (isNaN(d.getTime())) return { dateText: raw, timeText: '', fullText: raw };
      return {
        dateText: d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }),
        timeText: d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
        fullText: d.toLocaleString('en-IN')
      };
    } catch {
      return { dateText: raw, timeText: '', fullText: raw };
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

  const filteredLeads = leads.filter(l => {
    let matchesSearch = true;
    if (searchQuery) {
      const q = searchQuery.toLowerCase().trim();
      const pId = String(l.manual_client_id || l.project_code || l.lead_id || '').toLowerCase();
      matchesSearch = (l.client_name?.toLowerCase().includes(q)) || 
                      (l.contact_number?.includes(q)) ||
                      (l.location?.toLowerCase().includes(q)) ||
                      (pId.includes(q));
    }

    let matchesType = true;
    if (projectType !== 'all') {
      const pType = (l.project_type || '').toLowerCase();
      if (projectType === 'furniture') {
        matchesType = pType.includes('furniture') || pType.includes('architectural');
      } else if (projectType === 'interior') {
        matchesType = pType.includes('interior');
      }
    }

    const bookingTime = l.site_inspector_booking_time || l.qc_booking_time || l.site_manager_booking_time || l.created_at || '';
    let matchesDate = matchesPeriod(bookingTime);

    return matchesSearch && matchesType && matchesDate;
  });

  const totalCount = filteredLeads.length;
  const inMeetingCount = filteredLeads.filter(l => {
    const statuses = [l.site_inspector_status, l.qc_status, l.site_manager_status].map(s => (s || '').toLowerCase().trim());
    return statuses.some(st => st === 'in_meeting' || st === 'started' || st === 'in_progress');
  }).length;
  const completedCount = filteredLeads.filter(l => {
    const statuses = [l.site_inspector_status, l.qc_status, l.site_manager_status].map(s => (s || '').toLowerCase().trim());
    const isIn = statuses.some(st => st === 'in_meeting' || st === 'started' || st === 'in_progress');
    const isBooked = statuses.some(st => ['booked', 'scheduled', 'rescheduled'].includes(st));
    if (isIn || isBooked) return false;
    return statuses.some(st => st === 'meeting_completed' || st === 'completed' || st === 'qc_approved') || Boolean(l.site_inspector_meeting_ended_at) || Boolean(l.qc_meeting_ended_at);
  }).length;
  const scheduledCount = Math.max(0, totalCount - inMeetingCount - completedCount);

  return (
    <div className="dashboard-content" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Filter & Search Toolbar (matching /d1-leads style) */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '18px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          
          <div style={{ position: 'relative', flex: 1, minWidth: '280px' }}>
            <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search client name, ID, phone or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '10px 14px 10px 42px', borderRadius: '10px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.9rem' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowFilters(p => !p)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 18px',
                borderRadius: '10px',
                backgroundColor: showFilters ? '#fca412' : '#0c1527',
                color: showFilters ? '#ffffff' : '#fca412',
                border: '1.5px solid',
                borderColor: showFilters ? '#fca412' : '#0c1527',
                fontSize: '0.88rem',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              {showFilters ? <X size={15} /> : <SlidersHorizontal size={15} />}
              {showFilters ? 'Close' : 'Filters'}
            </button>
            <button
              onClick={fetchBookedLeads}
              title="Refresh leads list"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 15px', borderRadius: '10px', backgroundColor: '#f8fafc', color: '#334155', border: '1.5px solid #cbd5e1', fontSize: '0.86rem', fontWeight: 700, cursor: 'pointer' }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
            {(searchQuery || statementPeriod !== 'all' || projectType !== 'all') && (
              <button
                onClick={resetFilters}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 16px',
                  borderRadius: '10px',
                  border: '1.5px solid #ef4444',
                  backgroundColor: '#fef2f2',
                  color: '#ef4444',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  cursor: 'pointer'
                }}
              >
                <RotateCcw size={14} /> Reset
              </button>
            )}
          </div>
        </div>

        {showFilters && (
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
            <DashboardFilterBar
              statementPeriod={statementPeriod}
              onStatementPeriodChange={(period, custom) => {
                setStatementPeriod(period);
                if (custom) setCustomDates(custom);
              }}
              projectType={projectType}
              onProjectTypeChange={setProjectType}
            />
          </div>
        )}
      </div>

      {/* Table Container EXACTLY identical to /d1-leads */}
      <div style={{ overflowX: 'auto', backgroundColor: '#ffffff', borderRadius: '16px', border: '1.5px solid #ffe8c2', boxShadow: '0 4px 14px rgba(252, 164, 18, 0.05)', position: 'relative' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#fff9f0', borderBottom: '1.5px solid #ffe8c2', textAlign: 'left' }}>
              <th style={{ padding: '14px 12px 14px 16px', color: '#0c1527', fontWeight: 800, fontSize: '0.88rem', width: '120px', backgroundColor: '#fff9f0' }}>Client ID</th>
              <th style={{ padding: '14px 16px', color: '#0c1527', fontWeight: 800, fontSize: '0.88rem', backgroundColor: '#fff9f0' }}>Client Info</th>
              <th style={{ padding: '14px 16px', color: '#0c1527', fontWeight: 800, fontSize: '0.88rem', backgroundColor: '#fff9f0' }}>Project / Scope</th>
              <th style={{ padding: '14px 16px', color: '#0c1527', fontWeight: 800, fontSize: '0.88rem', backgroundColor: '#fff9f0' }}>Scheduled Slot</th>
              <th style={{ padding: '14px 16px', color: '#0c1527', fontWeight: 800, fontSize: '0.88rem', backgroundColor: '#fff9f0' }}>Site Inspector Meeting Status</th>
              <th style={{ padding: '14px 16px', color: '#0c1527', fontWeight: 800, fontSize: '0.88rem', textAlign: 'center', backgroundColor: '#fff9f0' }}>Notes</th>
              <th style={{ padding: '14px 16px', color: '#0c1527', fontWeight: 800, fontSize: '0.88rem', width: '90px', textAlign: 'center', backgroundColor: '#fff9f0' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '50px 20px', color: '#64748b' }}>
                  <Loader2 className="animate-spin" size={32} color="#fca412" style={{ margin: '0 auto 10px auto' }} />
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Loading Site Inspector Meetings...</div>
                </td>
              </tr>
            ) : filteredLeads.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '50px 20px', color: '#64748b' }}>
                  <Calendar size={36} color="#94a3b8" style={{ margin: '0 auto 10px auto' }} />
                  <div style={{ fontWeight: 700, color: '#0c1527', fontSize: '1rem' }}>No Site Inspector Meetings Found</div>
                  <div style={{ fontSize: '0.85rem', marginTop: '4px' }}>No appointments matching your current filters were found.</div>
                </td>
              </tr>
            ) : (
              filteredLeads.map((lead) => {
                const statuses = [
                  lead.site_inspector_status,
                  lead.qc_status,
                  lead.site_manager_status
                ].map(st => (st || '').toLowerCase().trim());

                const isInMeeting = statuses.some(st => st === 'in_meeting' || st === 'started' || st === 'in_progress');
                const isBooked = statuses.some(st => ['booked', 'scheduled', 'rescheduled'].includes(st));
                const isDone = !isInMeeting && !isBooked && (statuses.some(st => st === 'meeting_completed' || st === 'completed' || st === 'qc_approved') || Boolean(lead.site_inspector_meeting_ended_at) || Boolean(lead.qc_meeting_ended_at));

                const startKey = `meeting_started_at_${lead.lead_id}`;
                let startTs = localStorage.getItem(startKey);
                if (isInMeeting && !startTs) {
                  startTs = String(Date.now());
                  localStorage.setItem(startKey, startTs);
                }
                const elapsedSec = startTs ? Math.floor((nowTick - Number(startTs)) / 1000) : 999;
                const isInitialMinute = isInMeeting && elapsedSec < 60;

                const slotTime = formatSlotDateTime(lead);
                const pId = lead.manual_client_id || lead.project_code || (lead.lead_id ? `PR-${lead.lead_id}` : '-');

                let statusBadgeBg = '#eff6ff';
                let statusBadgeText = '#1d4ed8';
                let statusBadgeBorder = '#bfdbfe';
                let statusLabel = 'Scheduled';

                if (isInMeeting) {
                  statusBadgeBg = '#eff6ff';
                  statusBadgeText = '#1d4ed8';
                  statusBadgeBorder = '#bfdbfe';
                  statusLabel = 'Started';
                } else if (isDone) {
                  statusBadgeBg = '#dcfce7';
                  statusBadgeText = '#15803d';
                  statusBadgeBorder = '#bbf7d0';
                  statusLabel = 'Meeting Done';
                }

                return (
                  <tr
                    key={lead.lead_id}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      backgroundColor: '#ffffff',
                      transition: 'background-color 0.15s ease'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#fafafa'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#ffffff'; }}
                  >
                    {/* 1. Client ID */}
                    <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                      <div style={{ color: '#0c1527', fontSize: '0.88rem', fontWeight: 600 }}>
                        {pId}
                      </div>
                    </td>

                    {/* 2. Client Info */}
                    <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                      <div>
                        <div style={{ fontWeight: 600, color: '#0c1527', fontSize: '0.9rem', lineHeight: '1.2' }}>
                          {lead.client_name || `Client #${lead.lead_id}`}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '3px', fontWeight: 500 }}>
                          {lead.contact_number || '-'}
                        </div>
                      </div>
                    </td>

                    {/* 3. Project / Scope */}
                    <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                      <div>
                        <div style={{ fontWeight: 600, color: '#0c1527', fontSize: '0.88rem', lineHeight: '1.2' }}>
                          {lead.location || lead.client_address || 'N/A'}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '3px', fontWeight: 500 }}>
                          {lead.project_scope || (lead as any).custom_scope || 'Full Scope'} {lead.project_type?.replace('_', ' ') || 'Interior Projects'}
                        </div>
                      </div>
                    </td>

                    {/* 4. Scheduled Slot */}
                    <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                      <div style={{ color: '#0c1527', fontSize: '0.84rem', fontWeight: 600 }}>
                        {slotTime.timeText ? (
                          <>
                            <div style={{ color: '#0c1527', fontWeight: 700 }}>{slotTime.timeText}</div>
                            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px', fontWeight: 500 }}>{slotTime.dateText}</div>
                          </>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>-</span>
                        )}
                      </div>
                    </td>

                    {/* 5. Site Inspector Meeting Status & Actions */}
                    <td style={{ padding: '16px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            backgroundColor: statusBadgeBg,
                            color: statusBadgeText,
                            border: `1px solid ${statusBadgeBorder}`
                          }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: statusBadgeText }}></span>
                            {statusLabel}
                          </span>
                          {lead.site_inspector_assigned_name && (
                            <span style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 600 }}>
                              • {lead.site_inspector_assigned_name}
                            </span>
                          )}
                        </div>

                        {/* Meeting Control Buttons */}
                        <div>
                          {isInMeeting ? (
                            isInitialMinute ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <span style={{
                                  padding: '5px 12px',
                                  backgroundColor: '#fef3c7',
                                  color: '#d97706',
                                  border: '1px solid #fde68a',
                                  borderRadius: '6px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  fontSize: '0.78rem',
                                  fontWeight: 800,
                                  boxShadow: '0 2px 4px rgba(217, 119, 6, 0.15)'
                                }}>
                                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#d97706' }}></span>
                                  🟡 Meeting Started
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleEndMeeting(lead); }}
                                  style={{ padding: '5px 10px', backgroundColor: '#dc2626', color: 'white', borderRadius: '6px', border: 'none', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                                >
                                  End Meeting
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleEndMeeting(lead); }}
                                style={{ padding: '5px 12px', backgroundColor: '#16a34a', color: 'white', borderRadius: '6px', border: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', width: 'fit-content', boxShadow: '0 2px 4px rgba(22, 163, 74, 0.2)' }}
                              >
                                <CheckCircle size={14} color="white" /> End Meeting
                              </button>
                            )
                          ) : !isDone ? (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleStartMeeting(lead); }}
                              style={{ padding: '5px 12px', backgroundColor: '#ea580c', color: 'white', borderRadius: '6px', border: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', width: 'fit-content', boxShadow: '0 2px 4px rgba(234, 88, 12, 0.2)' }}
                            >
                              <Play size={14} fill="white" /> Start Meeting
                            </button>
                          ) : (
                            <span style={{
                              padding: '4px 10px',
                              backgroundColor: '#dcfce7',
                              color: '#15803d',
                              border: '1px solid #bbf7d0',
                              borderRadius: '6px',
                              fontSize: '0.78rem',
                              fontWeight: 800,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              width: 'fit-content'
                            }}>
                              <CheckCircle2 size={13} color="#15803d" /> Done ✓
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* 6. Notes (View Notes button matching /d1-leads) */}
                    <td style={{ padding: '16px', textAlign: 'center', verticalAlign: 'middle' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); openLeadModal(lead); }}
                        style={{
                          background: '#fff9f0',
                          border: '1px solid #ffe8c2',
                          borderRadius: '8px',
                          padding: '6px 12px',
                          cursor: 'pointer',
                          color: '#fca412',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '0.8rem',
                          fontWeight: 800,
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <MessageSquare size={14} color="#fca412" /> View Notes
                      </button>
                    </td>

                    {/* 7. Action */}
                    <td style={{ padding: '16px', textAlign: 'center', verticalAlign: 'middle' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); openLeadModal(lead); setModalTab('files'); }}
                        title="Upload / View Inspection Files & Drawings"
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #cbd5e1',
                          borderRadius: '8px',
                          padding: '6px 12px',
                          cursor: 'pointer',
                          color: '#334155',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <Folder size={14} color="#64748b" /> Files
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal for Site Inspection Notes & Documents — SLIDE-OVER DRAWER FROM RIGHT */}
      {viewingLeadModal && (
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setViewingLeadModal(null);
            }
          }}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.60)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'flex-end', alignItems: 'stretch', zIndex: 99999, overflow: 'hidden', margin: 0, padding: 0 }}
        >
          <div 
            className="slide-over-right"
            style={{ backgroundColor: '#ffffff', borderRadius: 0, borderLeft: '1.5px solid #cbd5e1', width: '100%', maxWidth: '720px', height: '100vh', minHeight: '100vh', maxHeight: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '-20px 0 60px rgba(0, 0, 0, 0.35)', margin: 0, padding: 0 }}
          >
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fafbfc', borderRadius: 0 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0c1527' }}>
                  Site Inspection Docs &amp; Notes
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.80rem', color: '#64748b' }}>
                  {viewingLeadModal.client_name} • {viewingLeadModal.manual_client_id || viewingLeadModal.project_code || ('PR-' + viewingLeadModal.lead_id)}
                </p>
              </div>
              <button
                onClick={() => setViewingLeadModal(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px', borderRadius: '50%' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px', padding: '12px 24px 0 24px', borderBottom: '1.5px solid #e2e8f0', backgroundColor: '#ffffff' }}>
              <button
                onClick={() => setModalTab('files')}
                style={{ padding: '9px 16px', background: 'none', border: 'none', borderBottom: modalTab === 'files' ? '3px solid #2563eb' : '3px solid transparent', color: modalTab === 'files' ? '#2563eb' : '#64748b', fontWeight: 800, fontSize: '0.84rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Folder size={15} /> Site Documents &amp; Photos ({filesData.files.length})
              </button>
              <button
                onClick={() => setModalTab('notes')}
                style={{ padding: '9px 16px', background: 'none', border: 'none', borderBottom: modalTab === 'notes' ? '3px solid #2563eb' : '3px solid transparent', color: modalTab === 'notes' ? '#2563eb' : '#64748b', fontWeight: 800, fontSize: '0.84rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <FileText size={15} /> Notes Timeline ({notes.length})
              </button>
            </div>

            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
              {modalTab === 'files' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 18px', border: '2px dashed #bfdbfe', borderRadius: '12px', backgroundColor: '#eff6ff' }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: '0 0 2px 0', fontWeight: 800, color: '#1e40af', fontSize: '0.88rem' }}>Upload Site Inspection File or Photo</p>
                      <p style={{ margin: 0, fontSize: '0.78rem', color: '#3b82f6' }}>Upload site photos, floor plan sketches, or inspection reports</p>
                    </div>
                    <label style={{ cursor: 'pointer' }}>
                      <input type="file" accept="*/*" style={{ display: 'none' }} onChange={handleFileUpload} />
                      <span style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: 'white', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)' }}>
                        {uploading ? <Loader2 size={14} className="animate-spin" /> : <Folder size={14} />}
                        {uploading ? 'Uploading...' : 'Browse File'}
                      </span>
                    </label>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', maxHeight: '280px', overflowY: 'auto' }}>
                    {filesData.files.length === 0 ? (
                      <p style={{ color: '#94a3b8', textAlign: 'center', gridColumn: '1/-1', padding: '24px', margin: 0, fontSize: '0.85rem' }}>No site documents uploaded yet.</p>
                    ) : filesData.files.map(file => (
                      <div key={file.name} style={{ padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '8px' }}>
                        <div style={{ overflow: 'hidden' }}>
                          <p style={{ margin: 0, fontWeight: 700, fontSize: '0.82rem', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.name.replace(/^\d+_/, '')}</p>
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{(file.size / 1024).toFixed(1)} KB</span>
                        </div>
                        <a href={getFileUrl(file.url)} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: '#2563eb', fontSize: '0.78rem', fontWeight: 800, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Eye size={13} /> View File
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {modalTab === 'notes' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <textarea
                      rows={2}
                      value={newNote}
                      onChange={e => setNewNote(e.target.value)}
                      placeholder="Add an inspection note or remark..."
                      style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #cbd5e1', outline: 'none', resize: 'vertical', fontFamily: 'inherit', fontSize: '0.88rem' }}
                    />
                    <button
                      type="button"
                      onClick={handleAddNote}
                      disabled={!newNote.trim()}
                      style={{ padding: '10px 18px', borderRadius: '8px', border: 'none', backgroundColor: '#2563eb', color: 'white', fontWeight: 800, fontSize: '0.82rem', cursor: newNote.trim() ? 'pointer' : 'not-allowed', opacity: newNote.trim() ? 1 : 0.6 }}
                    >
                      Add Note
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto' }}>
                    {notes.length === 0 ? (
                      <p style={{ color: '#94a3b8', textAlign: 'center', padding: '24px 0', margin: 0, fontSize: '0.85rem' }}>No notes recorded yet.</p>
                    ) : notes.map(note => (
                      <div key={note.id} style={{ padding: '12px 14px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.82rem' }}>{note.user_name || 'Inspector'}</span>
                          <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>{new Date(note.created_at).toLocaleString('en-IN')}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.86rem', color: '#334155', whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>{note.note_text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ padding: '14px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', backgroundColor: '#fafbfc', borderRadius: '0 0 0 20px' }}>
              <button
                type="button"
                onClick={() => setViewingLeadModal(null)}
                style={{ padding: '8px 20px', backgroundColor: '#0c1527', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
