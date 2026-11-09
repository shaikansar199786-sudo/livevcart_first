import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { DashboardFilterBar } from '../components/DashboardFilterBar';
import type { StatementPeriodType, ProjectTypeFilter } from '../components/DashboardFilterBar';
import {
  Users, Clock, Search, Calendar, MapPin, Phone, Loader2, SlidersHorizontal, X, FileText, Play, CheckCircle2, Folder, Eye, RotateCcw, RefreshCw, MessageSquare
} from 'lucide-react';

interface Lead {
  lead_id: string;
  client_name: string;
  contact_number: string;
  email?: string;
  location: string;
  client_address?: string;
  project_type: string;
  project_scope?: string;
  custom_scope?: string;
  project_code?: string;
  manual_client_id?: string;
  estimated_budget?: string;
  status: string;
  mmts_status?: string;
  mmts_notes?: string;
  mmts_booking_time?: string;
  mmt_assigned_id?: any;
  mmt_assigned_name?: string;
  d1_assigned_to?: any;
  d1_booking_time?: string;
  d1_notes?: string;
  created_at?: string;
  [key: string]: any;
}

export const MmtLeadsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const userRole = String(user?.role || '').toLowerCase();
  const isAdmin = ['admin', 'super_admin', 'administrator', 'superadmin', 'management', 'owner'].includes(userRole) || userRole.includes('admin') || Boolean(user?.is_admin);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [statementPeriod, setStatementPeriod] = useState<StatementPeriodType>('all');
  const [projectType, setProjectType] = useState<ProjectTypeFilter>('all');
  const [customDates, setCustomDates] = useState({ startDate: '', endDate: '' });
  const [nowTick, setNowTick] = useState(Date.now());

  // Notes & Docs Drawer Modal State
  const [viewingLeadModal, setViewingLeadModal] = useState<Lead | null>(null);
  const [modalTab, setModalTab] = useState<'notes' | 'files'>('notes');
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState('');
  const [filesData, setFilesData] = useState<{ folders: any[]; files: any[] }>({ folders: [], files: [] });
  const [currentFolder, setCurrentFolder] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchBookedLeads();
  }, []);

  const resetFilters = () => {
    setSearchQuery('');
    setStatementPeriod('all');
    setProjectType('all');
    setCustomDates({ startDate: '', endDate: '' });
  };

  const fetchBookedLeads = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/leads`);
      if (response.data && response.data.success) {
        const allLeads = Array.isArray(response.data.data) ? response.data.data : [];

        // 1. Strictly MMT booked leads
        const mmtLeads = allLeads.filter((l: any) => {
          const hasTime = Boolean(l.mmts_booking_time && String(l.mmts_booking_time).trim() !== '' && l.mmts_booking_time !== '0000-00-00 00:00:00');
          const hasMmtName = Boolean(l.mmt_assigned_name && l.mmt_assigned_name.trim() !== '' && l.mmt_assigned_name !== 'Not assigned' && l.mmt_assigned_name !== 'Pending Assignment');
          const hasMmtId = Boolean(l.mmt_assigned_id && String(l.mmt_assigned_id) !== '0' && String(l.mmt_assigned_id) !== 'null');
          const hasMmtStatus = Boolean(l.mmts_status && !['enquiry', 'pending', 'draft', 'unassigned'].includes(String(l.mmts_status).toLowerCase()));

          return hasTime || hasMmtName || hasMmtId || hasMmtStatus;
        });

        // 2. Strict User Scoping: MMT user sees ONLY their own meetings (NOT other personnel's)
        if (!isAdmin) {
          const loggedUid = String(user?.user_id || (user as any)?.id || '').trim();
          const loggedName = String(user?.name || '').toLowerCase().trim();
          const myLeads = mmtLeads.filter((l: any) => {
            const assignedIds = String(l.mmt_assigned_id || '')
              .split(',')
              .map((s: string) => s.trim())
              .filter(Boolean);
            if (loggedUid && assignedIds.includes(loggedUid)) return true;

            const assignedNames = String(l.mmt_assigned_name || '')
              .split(',')
              .map((s: string) => s.trim().toLowerCase())
              .filter(Boolean);
            if (loggedName && assignedNames.some(n => n === loggedName || n.includes(loggedName) || loggedName.includes(n))) return true;

            return false;
          });
          // STRICT: Do NOT fallback to all leads. Only show this specific person's meetings!
          setLeads(myLeads);
        } else {
          setLeads(mmtLeads);
        }
      }
    } catch (err) {
      console.error('Failed to fetch MMT leads', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartMeeting = async (lead: Lead) => {
    window.dispatchEvent(new CustomEvent('mmts_meeting_status_changed', { detail: { status: 'in_meeting', lead_id: lead.lead_id } }));

    setLeads(prev => prev.map(l => (String(l.lead_id) === String(lead.lead_id) || String((l as any).manual_client_id) === String(lead.lead_id)) ? {
      ...l,
      mmts_status: 'in_meeting'
    } : l));

    try {
      await axios.post(`${API_BASE_URL}/leads/update-mmts-status`, { 
        lead_id: lead.lead_id, 
        status: 'in_meeting', 
        assigned_by_name: user?.name || 'MMT User' 
      });
      fetchBookedLeads();
    } catch (err) {
      console.error('Start meeting error', err);
    }
  };

  const handleEndMeeting = async (lead: Lead) => {
    window.dispatchEvent(new CustomEvent('mmts_meeting_status_changed', { detail: { status: 'meeting_completed', lead_id: lead.lead_id } }));

    setLeads(prev => prev.map(l => (String(l.lead_id) === String(lead.lead_id) || String((l as any).manual_client_id) === String(lead.lead_id)) ? {
      ...l,
      mmts_status: 'meeting_completed'
    } : l));

    try {
      await axios.post(`${API_BASE_URL}/leads/update-mmts-status`, { 
        lead_id: lead.lead_id, 
        status: 'meeting_completed', 
        assigned_by_name: user?.name || 'MMT User' 
      });
      fetchBookedLeads();
    } catch (err) {
      console.error('End meeting error', err);
    }
  };

  const openLeadModal = (lead: Lead, tab: 'notes' | 'files' = 'notes') => {
    setViewingLeadModal(lead);
    setModalTab(tab);
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
    const raw = lead.mmts_booking_time || lead.d1_booking_time;
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

    const bookingTime = l.mmts_booking_time || l.created_at || '';
    let matchesDate = matchesPeriod(bookingTime);

    return matchesSearch && matchesType && matchesDate;
  });

  return (
    <div className="dashboard-content" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Page Title & Scoping Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0c1527', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Users color="#ea580c" size={28} /> MMT Booked Leads
          </h2>
          <p style={{ color: '#64748b', margin: '4px 0 0 0', fontSize: '0.9rem' }}>
            {isAdmin 
              ? 'All MMTS material measurement slot bookings confirmed by designers across the company.' 
              : `MMTS material measurement appointments strictly assigned to ${user?.name || 'you'}.`}
          </p>
        </div>
      </div>

      {/* Filter & Search Toolbar (matching Site Inspector / D1 leads style) */}
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
                backgroundColor: showFilters ? '#ea580c' : '#0c1527',
                color: showFilters ? '#ffffff' : '#fca412',
                border: '1.5px solid',
                borderColor: showFilters ? '#ea580c' : '#0c1527',
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

      {/* Table Container EXACTLY identical to Site Inspector / D1 leads */}
      <div style={{ overflowX: 'auto', backgroundColor: '#ffffff', borderRadius: '16px', border: '1.5px solid #ffe8c2', boxShadow: '0 4px 14px rgba(252, 164, 18, 0.05)', position: 'relative' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#fff9f0', borderBottom: '1.5px solid #ffe8c2', textAlign: 'left' }}>
              <th style={{ padding: '14px 12px 14px 16px', color: '#0c1527', fontWeight: 800, fontSize: '0.88rem', width: '120px', backgroundColor: '#fff9f0' }}>Client ID</th>
              <th style={{ padding: '14px 16px', color: '#0c1527', fontWeight: 800, fontSize: '0.88rem', backgroundColor: '#fff9f0' }}>Client Info</th>
              <th style={{ padding: '14px 16px', color: '#0c1527', fontWeight: 800, fontSize: '0.88rem', backgroundColor: '#fff9f0' }}>Project / Scope</th>
              <th style={{ padding: '14px 16px', color: '#0c1527', fontWeight: 800, fontSize: '0.88rem', backgroundColor: '#fff9f0' }}>Scheduled Slot</th>
              <th style={{ padding: '14px 16px', color: '#0c1527', fontWeight: 800, fontSize: '0.88rem', backgroundColor: '#fff9f0' }}>MMTS Meeting Status</th>
              <th style={{ padding: '14px 16px', color: '#0c1527', fontWeight: 800, fontSize: '0.88rem', textAlign: 'center', backgroundColor: '#fff9f0' }}>Notes</th>
              <th style={{ padding: '14px 16px', color: '#0c1527', fontWeight: 800, fontSize: '0.88rem', width: '90px', textAlign: 'center', backgroundColor: '#fff9f0' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '50px 20px', color: '#64748b' }}>
                  <Loader2 className="animate-spin" size={32} color="#ea580c" style={{ margin: '0 auto 10px auto' }} />
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Loading MMTS Meetings...</div>
                </td>
              </tr>
            ) : filteredLeads.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '50px 20px', color: '#64748b' }}>
                  <Calendar size={36} color="#94a3b8" style={{ margin: '0 auto 10px auto' }} />
                  <div style={{ fontWeight: 700, color: '#0c1527', fontSize: '1rem' }}>No MMTS Meetings Found</div>
                  <div style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                    {isAdmin ? 'No MMTS appointments matching your current filters were found.' : 'You have no assigned MMTS appointments matching your filters.'}
                  </div>
                </td>
              </tr>
            ) : (
              filteredLeads.map((lead) => {
                const mmtsSt = String(lead.mmts_status || '').toLowerCase().trim();
                const isInMeeting = mmtsSt === 'in_meeting' || mmtsSt === 'started';
                const isDone = mmtsSt === 'meeting_completed' || mmtsSt === 'completed';

                const slotTime = formatSlotDateTime(lead);
                const pId = lead.manual_client_id || lead.project_code || (lead.lead_id ? `PR-${lead.lead_id}` : '-');

                let statusBadgeBg = '#eff6ff';
                let statusBadgeText = '#1d4ed8';
                let statusBadgeBorder = '#bfdbfe';
                let statusLabel = 'Scheduled';

                if (isInMeeting) {
                  statusBadgeBg = '#fef3c7';
                  statusBadgeText = '#d97706';
                  statusBadgeBorder = '#fde68a';
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
                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '3px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Phone size={12} color="#64748b" /> {lead.contact_number || '-'}
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

                    {/* 5. MMTS Meeting Status & Actions */}
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
                          {lead.mmt_assigned_name && (
                            <span style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 600 }}>
                              • {lead.mmt_assigned_name}
                            </span>
                          )}
                        </div>

                        {/* Meeting Control Buttons */}
                        <div>
                          {isInMeeting ? (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleEndMeeting(lead); }}
                              style={{
                                padding: '6px 14px',
                                backgroundColor: '#16a34a',
                                color: 'white',
                                borderRadius: '8px',
                                border: 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '0.80rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                width: 'fit-content',
                                boxShadow: '0 2px 6px rgba(22, 163, 74, 0.3)',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <CheckCircle2 size={15} color="white" /> End Meeting
                            </button>
                          ) : !isDone ? (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleStartMeeting(lead); }}
                              style={{
                                padding: '6px 14px',
                                backgroundColor: '#ea580c',
                                color: 'white',
                                borderRadius: '8px',
                                border: 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '0.80rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                width: 'fit-content',
                                boxShadow: '0 2px 6px rgba(234, 88, 12, 0.3)',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <Play size={14} fill="white" /> Start Meeting
                            </button>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleStartMeeting(lead); }}
                                title="Restart meeting manually"
                                style={{
                                  padding: '4px 8px',
                                  backgroundColor: '#f8fafc',
                                  color: '#64748b',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '6px',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px'
                                }}
                              >
                                <RotateCcw size={11} /> Restart
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* 6. Notes (View Notes button matching Site Inspector / D1 leads) */}
                    <td style={{ padding: '16px', textAlign: 'center', verticalAlign: 'middle' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); openLeadModal(lead, 'notes'); }}
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

                    {/* 7. Action (Files button matching Site Inspector / D1 leads) */}
                    <td style={{ padding: '16px', textAlign: 'center', verticalAlign: 'middle' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); openLeadModal(lead, 'files'); }}
                        title="Upload / View MMTS Files & Drawings"
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

      {/* Modal for MMTS Notes & Documents — SLIDE-OVER DRAWER FROM RIGHT */}
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
                  MMTS Measurement Docs &amp; Notes
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
                style={{ padding: '9px 16px', background: 'none', border: 'none', borderBottom: modalTab === 'files' ? '3px solid #ea580c' : '3px solid transparent', color: modalTab === 'files' ? '#ea580c' : '#64748b', fontWeight: 800, fontSize: '0.84rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Folder size={15} /> MMTS Documents &amp; Photos ({filesData.files.length})
              </button>
              <button
                onClick={() => setModalTab('notes')}
                style={{ padding: '9px 16px', background: 'none', border: 'none', borderBottom: modalTab === 'notes' ? '3px solid #ea580c' : '3px solid transparent', color: modalTab === 'notes' ? '#ea580c' : '#64748b', fontWeight: 800, fontSize: '0.84rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <FileText size={15} /> Notes Timeline ({notes.length})
              </button>
            </div>

            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
              {modalTab === 'files' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 18px', border: '2px dashed #fed7aa', borderRadius: '12px', backgroundColor: '#fff7ed' }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: '0 0 2px 0', fontWeight: 800, color: '#9a3412', fontSize: '0.88rem' }}>Upload MMTS File or Measurement Sheet</p>
                      <p style={{ margin: 0, fontSize: '0.78rem', color: '#c2410c' }}>Upload measurement sheets, site photos, or material specs</p>
                    </div>
                    <label style={{ cursor: 'pointer' }}>
                      <input type="file" accept="*/*" style={{ display: 'none' }} onChange={handleFileUpload} />
                      <span style={{ padding: '8px 16px', backgroundColor: '#ea580c', color: 'white', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 6px rgba(234, 88, 12, 0.25)' }}>
                        {uploading ? <Loader2 size={14} className="animate-spin" /> : <Folder size={14} />}
                        {uploading ? 'Uploading...' : 'Browse File'}
                      </span>
                    </label>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', maxHeight: '280px', overflowY: 'auto' }}>
                    {filesData.files.length === 0 ? (
                      <p style={{ color: '#94a3b8', textAlign: 'center', gridColumn: '1/-1', padding: '24px', margin: 0, fontSize: '0.85rem' }}>No MMTS documents uploaded yet.</p>
                    ) : filesData.files.map(file => (
                      <div key={file.name} style={{ padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '8px' }}>
                        <div style={{ overflow: 'hidden' }}>
                          <p style={{ margin: 0, fontWeight: 700, fontSize: '0.82rem', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.name.replace(/^\d+_/, '')}</p>
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{(file.size / 1024).toFixed(1)} KB</span>
                        </div>
                        <a href={getFileUrl(file.url)} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: '#ea580c', fontSize: '0.78rem', fontWeight: 800, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
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
                      placeholder="Add an MMTS measurement note or remark..."
                      style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #cbd5e1', outline: 'none', resize: 'vertical', fontFamily: 'inherit', fontSize: '0.88rem' }}
                    />
                    <button
                      type="button"
                      onClick={handleAddNote}
                      disabled={!newNote.trim()}
                      style={{ padding: '10px 18px', borderRadius: '8px', border: 'none', backgroundColor: '#ea580c', color: 'white', fontWeight: 800, fontSize: '0.82rem', cursor: newNote.trim() ? 'pointer' : 'not-allowed', opacity: newNote.trim() ? 1 : 0.6 }}
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
                          <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.82rem' }}>{note.user_name || 'MMT User'}</span>
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
