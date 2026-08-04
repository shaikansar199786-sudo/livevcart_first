import React, { useState, useEffect } from 'react';
import {
  Calendar, Clock, MapPin, Phone, CheckCircle, Clock3, User, Briefcase,
  Loader2, Play, CheckCircle2, FileText, Upload, FolderPlus, Trash2,
  Eye, Download, Plus, MessageSquare, Folder, ArrowLeft, X, DollarSign, Tag, Info, CheckSquare, Users
} from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

interface Lead {
  lead_id: string;
  client_name: string;
  contact_number: string;
  email: string;
  location: string;
  client_address?: string;
  project_type: string;
  estimated_budget?: string;
  lead_source?: string;
  manual_client_id?: string;
  status: string;
  d1_assigned_to?: number;
  d1_booking_time?: string;
  d1_notes?: string;
  project_scope?: string;
}

export const D1Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [myTargets, setMyTargets] = useState<any[]>([]);

  const [team, setTeam] = useState<any[]>([]);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [convertData, setConvertData] = useState({
    project_name: '',
    project_head_id: '',
    site_engineer_id: '',
    start_date: new Date().toISOString().split('T')[0],
    expected_end_date: new Date(new Date().setMonth(new Date().getMonth() + 4)).toISOString().split('T')[0],
    total_budget: '0',
    advance_paid: '0',
    created_by: user?.user_id || ''
  });

  // Modal State for Lead Notes & D1 Documents
  const [viewingLeadModal, setViewingLeadModal] = useState<Lead | null>(null);
  const [modalTab, setModalTab] = useState<'notes' | 'files'>('notes');
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState('');
  const [filesData, setFilesData] = useState<{ folders: any[]; files: any[] }>({ folders: [], files: [] });
  const [currentFolder, setCurrentFolder] = useState('');
  const [uploading, setUploading] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  useEffect(() => {
    if (user) {
      fetchAssignedLeads();
      fetchTeam();
      fetchMyTargets();
    }
  }, [user]);

  const handleStatusChange = async (leadId: string, status: string) => {
    if (!user) return;
    if (status === 'won') {
      const targetLead = leads.find(l => String(l.lead_id) === String(leadId));
      if (targetLead) {
        setSelectedLead(targetLead);
        setConvertData(prev => ({
          ...prev,
          project_name: targetLead.client_name + ' Project',
          created_by: user?.user_id || ''
        }));
        setShowConvertModal(true);
        return;
      }
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/leads/update-status`, {
        lead_id: leadId,
        status: status
      });
      if (response.data.success) {
        fetchAssignedLeads();
      } else {
        alert(response.data.message || 'Failed to update status');
      }
    } catch (err) {
      alert('Error updating status');
    }
  };

  const fetchTeam = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/users`);
      if (response.data.success) {
        setTeam(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch team');
    }
  };

  const fetchMyTargets = async () => {
    try {
      const now = new Date();
      const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const res = await axios.get(`${API_BASE_URL}/team-targets?month=${monthStr}`);
      if (res.data?.success && res.data.data) {
        const matched = res.data.data.filter((row: any) => 
          row.team_member?.trim().toLowerCase() === user?.name?.trim().toLowerCase() ||
          row.team_member?.trim().toLowerCase() === user?.username?.trim().toLowerCase()
        );
        setMyTargets(matched);
      }
    } catch (err) {
      console.error('Error fetching my targets', err);
    }
  };

  const fetchAssignedLeads = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/leads`);
      if (response.data.success) {
        const myLeads = response.data.data.filter(
          (lead: Lead) => lead.d1_assigned_to && String(lead.d1_assigned_to) === String(user?.user_id)
        );
        setLeads(myLeads);
      }
    } catch (error) {
      console.error('Failed to fetch leads:', error);
      alert('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // Open Notes & Documents Modal
  const openLeadModal = (lead: Lead) => {
    setViewingLeadModal(lead);
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
      console.error('Failed to upload file', err);
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
      const response = await axios.post(`${API_BASE_URL}/leads/create-folder`, {
        lead_id: viewingLeadModal.lead_id,
        folder_name: newFolderName.trim(),
        parent_folder: currentFolder
      });
      if (response.data.success) {
        setNewFolderName('');
        fetchFiles(viewingLeadModal.lead_id, currentFolder);
      } else {
        alert(response.data.message);
      }
    } catch (err) {
      console.error('Failed to create folder', err);
    }
  };

  const handleDeleteFile = async (filename: string) => {
    if (!viewingLeadModal || !window.confirm('Are you sure you want to delete this file/folder?')) return;
    try {
      const response = await axios.delete(`${API_BASE_URL}/leads/files?lead_id=${viewingLeadModal.lead_id}&filename=${filename}&folder=${currentFolder}`);
      if (response.data.success) {
        fetchFiles(viewingLeadModal.lead_id, currentFolder);
      }
    } catch (err) {
      console.error('Failed to delete file', err);
    }
  };

  const getFileUrl = (rawUrl?: string) => {
    if (!rawUrl) return '#';
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) return rawUrl;
    const origin = window.location.origin;
    const cleanPath = rawUrl.startsWith('/') ? rawUrl : '/' + rawUrl;
    return origin + cleanPath;
  };

  // Metrics Calculations for D1 Dashboard
  const totalLeads = leads.length;
  const pendingCount = leads.filter(l => l.status === 'enquiry' || l.status === 'in_meeting' || l.status === 'pending').length;
  const proposalSentCount = leads.filter(l => l.status === 'proposal_sent').length;
  const convertedCount = leads.filter(l => l.status === 'won' || l.status === 'converted').length;
  const deadCount = leads.filter(l => l.status === 'lost' || l.status === 'dead' || l.status === 'dropped').length;
  const conversionRate = totalLeads ? ((convertedCount / totalLeads) * 100).toFixed(2) : '0.00';

  const upcomingAppointments = leads.filter(lead => {
    if (!lead.d1_booking_time) return false;
    const bookingDate = new Date(lead.d1_booking_time);
    return bookingDate >= new Date();
  }).sort((a, b) => new Date(a.d1_booking_time!).getTime() - new Date(b.d1_booking_time!).getTime());

  const pastAppointments = leads.filter(lead => {
    if (!lead.d1_booking_time) return false;
    const bookingDate = new Date(lead.d1_booking_time);
    return bookingDate < new Date();
  }).sort((a, b) => new Date(b.d1_booking_time!).getTime() - new Date(a.d1_booking_time!).getTime());

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

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#ff6b00', animation: 'pulse 2s infinite' }}>
          <Clock size={48} style={{ marginBottom: '20px' }} />
          <p style={{ color: '#4a5568', fontWeight: 600, fontFamily: "'Inter', sans-serif", fontSize: '1.2rem', letterSpacing: '1px' }}>SYNCING DASHBOARD...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'sans-serif', backgroundColor: '#f9fafb', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', marginBottom: '24px', border: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ padding: '12px', backgroundColor: '#f3f4f6', borderRadius: '12px' }}>
              <User size={24} color="#111827" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827', margin: 0 }}>Designer Dashboard</h2>
              <p style={{ color: '#6b7280', margin: '4px 0 0 0', fontSize: '0.9rem' }}>Welcome back, {user?.username}. Track your assigned consultations and conversion pipeline.</p>
            </div>
          </div>

          <div style={{ padding: '12px 20px', borderRadius: '8px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#f9fafb' }}>
            <Calendar size={18} color="#6b7280" />
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#374151' }}>{upcomingAppointments.length} Upcoming Appointments</span>
          </div>
        </div>

        {/* D1 Dashboard Summary Metric Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '14px' }}>
          <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ backgroundColor: '#e0e7ff', padding: '10px', borderRadius: '10px', color: '#4f46e5' }}><Users size={18} /></div>
            <div>
              <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: 0 }}>Total Assigned</p>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#111827', margin: '2px 0' }}>{totalLeads}</h3>
              <p style={{ color: '#9ca3af', fontSize: '0.72rem', margin: 0 }}>All D1 Consultations</p>
            </div>
          </div>

          <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ backgroundColor: '#fef3c7', padding: '10px', borderRadius: '10px', color: '#d97706' }}><Clock size={18} /></div>
            <div>
              <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: 0 }}>Pending Leads</p>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#111827', margin: '2px 0' }}>{pendingCount}</h3>
              <p style={{ color: '#9ca3af', fontSize: '0.72rem', margin: 0 }}>{totalLeads ? ((pendingCount / totalLeads) * 100).toFixed(1) : 0}% of Assigned</p>
            </div>
          </div>

          <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ backgroundColor: '#ede9fe', padding: '10px', borderRadius: '10px', color: '#7c3aed' }}><CheckSquare size={18} /></div>
            <div>
              <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: 0 }}>Proposal Sent</p>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#111827', margin: '2px 0' }}>{proposalSentCount}</h3>
              <p style={{ color: '#9ca3af', fontSize: '0.72rem', margin: 0 }}>{totalLeads ? ((proposalSentCount / totalLeads) * 100).toFixed(1) : 0}% of Assigned</p>
            </div>
          </div>

          <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ backgroundColor: '#dcfce7', padding: '10px', borderRadius: '10px', color: '#16a34a' }}><CheckCircle2 size={18} /></div>
            <div>
              <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: 0 }}>Converted</p>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#111827', margin: '2px 0' }}>{convertedCount}</h3>
              <p style={{ color: '#9ca3af', fontSize: '0.72rem', margin: 0 }}>{totalLeads ? ((convertedCount / totalLeads) * 100).toFixed(1) : 0}% of Assigned</p>
            </div>
          </div>

          <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ backgroundColor: '#fee2e2', padding: '10px', borderRadius: '10px', color: '#dc2626' }}><X size={18} /></div>
            <div>
              <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: 0 }}>Dead Leads</p>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#111827', margin: '2px 0' }}>{deadCount}</h3>
              <p style={{ color: '#9ca3af', fontSize: '0.72rem', margin: 0 }}>{totalLeads ? ((deadCount / totalLeads) * 100).toFixed(1) : 0}% of Assigned</p>
            </div>
          </div>

          <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ backgroundColor: '#e0f2fe', padding: '10px', borderRadius: '10px', color: '#0284c7' }}><DollarSign size={18} /></div>
            <div>
              <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: 0 }}>Conversion Rate</p>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#111827', margin: '2px 0' }}>{conversionRate}%</h3>
              <p style={{ color: '#9ca3af', fontSize: '0.72rem', margin: 0 }}>Overall Rate</p>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', alignItems: 'start' }}>

        {/* Main Content Area */}
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
                {upcomingAppointments.map((lead) => (
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

                    {lead.d1_notes && (
                      <div style={{ backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: '8px', borderLeft: '3px solid #3b82f6', fontSize: '0.85rem', color: '#334155' }}>
                        <strong style={{ color: '#1e293b' }}>D1 Booking Note: </strong> {lead.d1_notes}
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', borderTop: '1px solid #f3f4f6', paddingTop: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>

                        {/* Status Dropdown Selector */}
                        <select
                          value={lead.status}
                          onChange={(e) => handleStatusChange(lead.lead_id, e.target.value)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontWeight: 600,
                            fontSize: '0.82rem',
                            outline: 'none',
                            cursor: 'pointer',
                            backgroundColor: lead.status === 'in_meeting' ? '#fef3c7' : lead.status === 'proposal_sent' ? '#ede9fe' : lead.status === 'won' ? '#dcfce7' : lead.status === 'lost' ? '#fee2e2' : '#dbeafe',
                            color: lead.status === 'in_meeting' ? '#d97706' : lead.status === 'proposal_sent' ? '#7c3aed' : lead.status === 'won' ? '#15803d' : lead.status === 'lost' ? '#b91c1c' : '#1d4ed8',
                            border: '1px solid #d1d5db'
                          }}
                        >
                          <option value="enquiry">🕒 Scheduled</option>
                          <option value="in_meeting">⏳ In Meeting (Pending)</option>
                          <option value="meeting_completed">✅ Meeting Completed</option>
                          <option value="proposal_sent">📄 Drop to Proposal Sent</option>
                          <option value="won">🏆 Converted (Start Project)</option>
                          <option value="lost">❌ Dead Lead (Lost)</option>
                        </select>

                        <button
                          onClick={() => openLeadModal(lead)}
                          style={{
                            backgroundColor: '#eff6ff',
                            color: '#2563eb',
                            border: '1px solid #bfdbfe',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontWeight: 600,
                            fontSize: '0.82rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            cursor: 'pointer'
                          }}
                        >
                          <FileText size={14} /> View Sales Notes & D1 Docs
                        </button>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        {lead.status !== 'in_meeting' && lead.status !== 'meeting_completed' && lead.status !== 'won' && lead.status !== 'converted' && (
                          <button
                            onClick={() => handleStatusChange(lead.lead_id, 'in_meeting')}
                            style={{
                              backgroundColor: '#2563eb',
                              color: '#ffffff',
                              padding: '8px 14px',
                              borderRadius: '8px',
                              fontWeight: 600,
                              fontSize: '0.85rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              border: 'none',
                              cursor: 'pointer'
                            }}
                          >
                            <Play size={14} /> Start Meeting
                          </button>
                        )}

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

                        {lead.status === 'in_meeting' && (
                          <button
                            onClick={() => handleStatusChange(lead.lead_id, 'meeting_completed')}
                            style={{
                              backgroundColor: '#16a34a',
                              color: '#ffffff',
                              padding: '8px 14px',
                              borderRadius: '8px',
                              fontWeight: 600,
                              fontSize: '0.85rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              border: 'none',
                              cursor: 'pointer'
                            }}
                          >
                            <CheckCircle size={14} /> End Meeting
                          </button>
                        )}

                        {lead.status === 'meeting_completed' && (
                          <button
                            onClick={() => {
                              setSelectedLead(lead);
                              setConvertData(prev => ({
                                ...prev,
                                project_name: lead.client_name + ' Project',
                                created_by: user?.user_id || ''
                              }));
                              setShowConvertModal(true);
                            }}
                            style={{
                              backgroundColor: '#111827',
                              color: '#ffffff',
                              padding: '8px 14px',
                              borderRadius: '8px',
                              fontWeight: 600,
                              fontSize: '0.85rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              border: 'none',
                              cursor: 'pointer'
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

        {/* Sidebar / Past Appointments */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle size={18} color="#6b7280" /> Past Consultations
              </h3>
            </div>

            {pastAppointments.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: '#6b7280', fontSize: '0.9rem' }}>
                No past consultations yet
              </div>
            ) : (
              <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                {pastAppointments.map((lead, idx) => (
                  <div key={lead.lead_id} style={{
                    padding: '16px 20px',
                    borderBottom: idx === pastAppointments.length - 1 ? 'none' : '1px solid #f3f4f6'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <h4 style={{ fontWeight: 600, color: '#111827', margin: 0, fontSize: '0.95rem' }}>{lead.client_name}</h4>
                      <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#4b5563', backgroundColor: '#f3f4f6', padding: '2px 6px', borderRadius: '4px' }}>
                        {new Date(lead.d1_booking_time!).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
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

      {/* LEAD NOTES & D1 DOCUMENTS MODAL */}
      {viewingLeadModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(17, 24, 39, 0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '850px',
            maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden'
          }}>

            {/* Modal Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#253b50', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>{viewingLeadModal.client_name} — Lead & D1 Documents</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
                  Phone: {viewingLeadModal.contact_number} | Email: {viewingLeadModal.email || 'N/A'} | Location: {viewingLeadModal.location}
                </p>
              </div>
              <button onClick={() => setViewingLeadModal(null)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>

            {/* Sub-header Navigation Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f8fafc', padding: '0 24px' }}>
              <button
                onClick={() => setModalTab('notes')}
                style={{
                  padding: '14px 20px',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  borderBottom: modalTab === 'notes' ? '3px solid #253b50' : '3px solid transparent',
                  color: modalTab === 'notes' ? '#253b50' : '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <MessageSquare size={16} /> Sales & Team Notes ({notes.length})
              </button>
              <button
                onClick={() => setModalTab('files')}
                style={{
                  padding: '14px 20px',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  borderBottom: modalTab === 'files' ? '3px solid #253b50' : '3px solid transparent',
                  color: modalTab === 'files' ? '#253b50' : '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Folder size={16} /> D1 & Lead Documents ({filesData.files.length + filesData.folders.length})
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>

              {/* TAB 1: NOTES & SALES REQUIREMENTS */}
              {modalTab === 'notes' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                  {/* Sales Information Card */}
                  <div style={{ backgroundColor: '#f0f9ff', padding: '16px', borderRadius: '12px', border: '1px solid #bae6fd', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <h4 style={{ margin: 0, color: '#0369a1', fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Info size={16} /> Sales Representative Requirements & Scope
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', fontSize: '0.85rem' }}>
                      <div>
                        <strong style={{ color: '#0369a1' }}>Lead Source:</strong> {viewingLeadModal.lead_source || 'Walk-in'}
                      </div>
                      <div>
                        <strong style={{ color: '#0369a1' }}>Est. Budget:</strong> ₹{viewingLeadModal.estimated_budget ? Number(viewingLeadModal.estimated_budget).toLocaleString('en-IN') : 'N/A'}
                      </div>
                      <div>
                        <strong style={{ color: '#0369a1' }}>Manual Client ID:</strong> {viewingLeadModal.manual_client_id || 'N/A'}
                      </div>
                    </div>
                    {viewingLeadModal.project_scope && (
                      <div style={{ fontSize: '0.85rem', color: '#0c4a6e', paddingTop: '6px', borderTop: '1px solid #e0f2fe' }}>
                        <strong>Project Scope & Details:</strong> {viewingLeadModal.project_scope}
                      </div>
                    )}
                    {viewingLeadModal.d1_notes && (
                      <div style={{ fontSize: '0.85rem', color: '#0c4a6e' }}>
                        <strong>D1 Booking Note:</strong> {viewingLeadModal.d1_notes}
                      </div>
                    )}
                  </div>

                  {/* Add New Note */}
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <textarea
                      rows={2}
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Add a new note for D1 meeting or site details..."
                      style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.9rem', resize: 'vertical' }}
                    />
                    <button
                      onClick={handleAddNote}
                      disabled={!newNote.trim()}
                      style={{
                        backgroundColor: '#253b50', color: 'white', padding: '0 20px', borderRadius: '8px', border: 'none',
                        fontWeight: 600, cursor: newNote.trim() ? 'pointer' : 'not-allowed', opacity: newNote.trim() ? 1 : 0.6,
                        display: 'flex', alignItems: 'center', gap: '6px'
                      }}
                    >
                      <Plus size={16} /> Add Note
                    </button>
                  </div>

                  {/* Notes Timeline */}
                  {notes.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', border: '2px dashed #e2e8f0', borderRadius: '12px' }}>
                      <MessageSquare size={32} style={{ margin: '0 auto 8px auto' }} />
                      <p style={{ margin: 0, fontWeight: 500 }}>No additional team notes recorded yet.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {notes.map((note) => (
                        <div key={note.id} style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <span style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.88rem' }}>{note.user_name || 'Sales Representative / Team'}</span>
                            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>{new Date(note.created_at).toLocaleString('en-IN')}</span>
                          </div>
                          <p style={{ margin: 0, color: '#334155', fontSize: '0.9rem', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{note.note_text}</p>
                        </div>
                      ))}
                    </div>
                  )}

                </div>
              )}

              {/* TAB 2: FILES & DOCUMENTS */}
              {modalTab === 'files' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                  {/* Folder Breadcrumb & Upload Toolbar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', backgroundColor: '#f1f5f9', padding: '12px 16px', borderRadius: '10px' }}>

                    {/* Path Breadcrumbs */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>
                      {currentFolder && (
                        <button
                          onClick={() => {
                            const parts = currentFolder.split('/');
                            parts.pop();
                            const newFolder = parts.join('/');
                            setCurrentFolder(newFolder);
                            fetchFiles(viewingLeadModal.lead_id, newFolder);
                          }}
                          style={{ border: 'none', background: 'white', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}
                        >
                          <ArrowLeft size={14} /> Back
                        </button>
                      )}
                      <span>Root</span>
                      {currentFolder.split('/').map((part, i) => part && (
                        <React.Fragment key={i}>
                          <span>/</span>
                          <span style={{ color: '#253b50' }}>{part}</span>
                        </React.Fragment>
                      ))}
                    </div>

                    {/* Controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>

                      {/* Create Folder */}
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <input
                          type="text"
                          placeholder="New Folder"
                          value={newFolderName}
                          onChange={(e) => setNewFolderName(e.target.value)}
                          style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                        />
                        <button
                          onClick={handleCreateFolder}
                          disabled={creatingFolder || !newFolderName.trim()}
                          style={{ backgroundColor: '#253b50', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}
                        >
                          <FolderPlus size={14} />
                        </button>
                      </div>

                      {/* Upload File */}
                      <label style={{
                        backgroundColor: '#2563eb', color: 'white', padding: '6px 14px', borderRadius: '6px',
                        cursor: uploading ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.85rem',
                        display: 'flex', alignItems: 'center', gap: '6px'
                      }}>
                        {uploading ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
                        Upload D1 Document
                        <input type="file" onChange={handleFileUpload} disabled={uploading} style={{ display: 'none' }} />
                      </label>
                    </div>
                  </div>

                  {/* Folders & Files Grid */}
                  {filesData.folders.length === 0 && filesData.files.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', border: '2px dashed #e2e8f0', borderRadius: '12px' }}>
                      <Folder size={36} style={{ margin: '0 auto 8px auto' }} />
                      <p style={{ margin: 0, fontWeight: 500 }}>No site photos or D1 documents uploaded yet.</p>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem' }}>Upload floor plans, site photos, or drawings above.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>

                      {/* Render Folders */}
                      {filesData.folders.map((folder: any) => (
                        <div
                          key={folder.name}
                          onClick={() => {
                            const newPath = currentFolder ? `${currentFolder}/${folder.name}` : folder.name;
                            setCurrentFolder(newPath);
                            fetchFiles(viewingLeadModal.lead_id, newPath);
                          }}
                          style={{
                            padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                            <Folder size={24} color="#3b82f6" />
                            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{folder.name}</span>
                          </div>
                        </div>
                      ))}

                      {/* Render Files */}
                      {filesData.files.map((file: any) => (
                        <div
                          key={file.name}
                          style={{
                            padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: 'white',
                            display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                            <FileText size={24} color="#64748b" style={{ flexShrink: 0 }} />
                            <div style={{ overflow: 'hidden' }}>
                              <p style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {file.name.replace(/^\d+_/, '')}
                              </p>
                              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                {(file.size / 1024).toFixed(1)} KB
                              </span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                            <a
                              href={getFileUrl(file.url)}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: '#2563eb', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                            >
                              <Eye size={12} /> View / Open
                            </a>
                          </div>
                        </div>
                      ))}

                    </div>
                  )}

                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setViewingLeadModal(null)}
                style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: 'white', fontWeight: 600, color: '#334155', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* START PROJECT CONVERT MODAL */}
      {showConvertModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '16px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h3 style={{ marginBottom: '24px', fontSize: '1.25rem', color: '#111827', fontWeight: 600 }}>Start Project</h3>
            <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '20px' }}>
              You are about to start the design phase for <strong>{selectedLead?.client_name}</strong>.
            </p>
            <form onSubmit={handleConversionSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500, color: '#374151' }}>Project Name</label>
                <input type="text" required value={convertData.project_name} onChange={(e) => setConvertData({ ...convertData, project_name: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', outline: 'none' }} />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500, color: '#374151' }}>Start Date</label>
                <input type="date" required value={convertData.start_date} onChange={(e) => setConvertData({ ...convertData, start_date: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', outline: 'none' }} />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowConvertModal(false)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: 'white', fontWeight: 500, color: '#374151' }}>Cancel</button>
                <button type="submit" disabled={submitting} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', backgroundColor: '#111827', color: 'white', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  {submitting && <Loader2 className="animate-spin" size={16} />}
                  Start Now
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
