import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import {
  Users, Clock, CheckSquare, CheckCircle2, X, DollarSign, Search, Filter,
  FileText, Folder, ArrowLeft, Loader2, Save, Play, CheckCircle, Plus, Info, MessageSquare, Upload, FolderPlus, Eye, MoreVertical, Calendar, Pencil, Paperclip
} from 'lucide-react';

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
  created_at?: string;
  site_manager_assigned_to?: string;
  site_manager_booking_time?: string;
  site_manager_notes?: string;
}

export const D1Leads: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingLeadId, setSavingLeadId] = useState<string | null>(null);

  // Selected Status mapping per lead (lead_id -> status)
  const [selectedStatuses, setSelectedStatuses] = useState<{ [leadId: string]: string }>({});

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Convert Modal State
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
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [showBookSiteModal, setShowBookSiteModal] = useState(false);
  const [selectedBookLead, setSelectedBookLead] = useState<Lead | null>(null);
  const [bookDate, setBookDate] = useState('');
  const [bookTime, setBookTime] = useState('10:00');
  const [siteNotes, setSiteNotes] = useState('');
  const [selectedSiteUser, setSelectedSiteUser] = useState('');
  const [team, setTeam] = useState<any[]>([]);
  const FIXED_SLOTS = [
    { id: 1, label: '10:00 AM - 12:00 PM', value: '10:00' },
    { id: 2, label: '12:00 PM - 02:00 PM', value: '12:00' },
    { id: 3, label: '02:00 PM - 04:00 PM', value: '14:00' },
    { id: 4, label: '04:00 PM - 06:00 PM', value: '16:00' },
    { id: 5, label: '06:00 PM - 08:00 PM', value: '18:00' }
  ];

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

    }
  }, [user]);

  
  const fetchTeam = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/users`);
      if (response.data.success) setTeam(response.data.data);
    } catch (error) { console.error('Error fetching team:', error); }
  };

  const fetchAssignedLeads = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/leads`);
      if (response.data.success) {
        const allLeads: Lead[] = response.data.data;
        const myLeads = user?.role === 'admin' 
          ? allLeads 
          : allLeads.filter(lead => lead.d1_assigned_to && String(lead.d1_assigned_to) === String(user?.user_id));
        
        setLeads(myLeads);

        // Initialize status selector mapping
        const statusMap: { [id: string]: string } = {};
        myLeads.forEach(l => {
          statusMap[l.lead_id] = l.status || 'enquiry';
        });
        setSelectedStatuses(statusMap);
      }
    } catch (error) {
      console.error('Failed to fetch D1 leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusSelectChange = (leadId: string, newStatus: string) => {
    setSelectedStatuses(prev => ({
      ...prev,
      [leadId]: newStatus
    }));
  };

  
  const isSlotBooked = (timeVal: string) => { return false; }; // Simplified for now

  const handleBookSiteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBookLead || !selectedSiteUser || !bookDate || !bookTime) return;
    setSubmitting(true);
    try {
      const bookingDateTime = `${bookDate} ${bookTime}:00`;
      const payload = {
        lead_id: selectedBookLead.lead_id,
        site_manager_id: selectedSiteUser,
        booking_time: bookingDateTime,
        notes: siteNotes,
        assigned_by_name: user?.name || 'Designer'
      };
      
      const response = await axios.post(`${API_BASE_URL}/leads/book-site-manager`, payload);
      if (response.data.success) {
        setShowBookSiteModal(false);
        setBookDate('');
        setSiteNotes('');
        setSelectedSiteUser('');
        fetchAssignedLeads();
      } else {
        alert(response.data.message || 'Failed to book slot');
      }
    } catch (error) {
      console.error(error);
      alert('An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveStatus = async (lead: Lead) => {
    const newStatus = selectedStatuses[lead.lead_id] || lead.status;
    
    if (newStatus === 'won') {
      setSelectedLead(lead);
      setConvertData(prev => ({
        ...prev,
        project_name: lead.client_name + ' Project',
        created_by: user?.user_id || ''
      }));
      setShowConvertModal(true);
      return;
    }

    setSavingLeadId(lead.lead_id);
    try {
      const response = await axios.post(`${API_BASE_URL}/leads/update-status`, {
        lead_id: lead.lead_id,
        status: newStatus
      });
      if (response.data.success) {
        alert(`Status updated to "${getStatusLabel(newStatus)}"! Reflected in Sales Leads.`);
        fetchAssignedLeads();
      } else {
        alert(response.data.message || 'Failed to update status');
      }
    } catch (err) {
      alert('Error saving status');
    } finally {
      setSavingLeadId(null);
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'proposal_sent': return 'Proposal Sent';
      case 'won':
      case 'converted': return 'Converted';
      case 'lost':
      case 'dead': return 'Dead Lead';
      case 'in_meeting': return 'In Meeting (Pending)';
      case 'meeting_completed': return 'Meeting Completed';
      default: return 'Scheduled';
    }
  };

  const handleCreateProjectFromLead = async (lead: Lead) => {
    if (!window.confirm(`Create a new project for "${lead.client_name}" and transfer quote/agreement details?`)) {
      return;
    }
    try {
      const payload = {
        project_name: `${lead.client_name} - ${lead.project_scope || 'Interior Project'}`,
        client_name: lead.client_name,
        project_type: lead.project_type || 'Furniture projects',
        site_address: lead.location || '',
        start_date: new Date().toISOString().split('T')[0],
        total_budget: lead.estimated_budget || 0,
        lead_id: lead.lead_id,
        created_by: user?.user_id || 1,
        status: 'On Going'
      };

      const res = await axios.post(`${API_BASE_URL}/projects`, payload);
      if (res.data && (res.data.success || res.data.project_id)) {
        try {
          await axios.post(`${API_BASE_URL}/leads/update-status`, { lead_id: lead.lead_id, status: 'converted' });
        } catch (e) {}

        const newProjId = res.data.project_id;
        if (newProjId) {
          navigate(`/projects/${newProjId}`);
        } else {
          navigate('/projects');
        }
      } else {
        alert(res.data?.message || 'Failed to create project from lead');
      }
    } catch (error: any) {
      console.error('Create project error:', error);
      alert(error?.response?.data?.message || 'An error occurred while creating project');
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
    } finally {
      setCreatingFolder(false);
    }
  };

  const getFileUrl = (rawUrl?: string) => {
    if (!rawUrl) return '#';
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) return rawUrl;
    const origin = window.location.origin;
    const cleanPath = rawUrl.startsWith('/') ? rawUrl : '/' + rawUrl;
    return origin + cleanPath;
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
        alert('Failed to start project');
      }
    } catch (error) {
      alert('Error starting project');
    } finally {
      setSubmitting(false);
    }
  };

  // Metrics Calculations for D1 Leads
  const totalLeads = leads.length;
  const pendingCount = leads.filter(l => l.status === 'enquiry' || l.status === 'in_meeting' || l.status === 'pending').length;
  const proposalSentCount = leads.filter(l => l.status === 'proposal_sent').length;
  const convertedCount = leads.filter(l => l.status === 'won' || l.status === 'converted').length;
  const deadCount = leads.filter(l => l.status === 'lost' || l.status === 'dead' || l.status === 'dropped').length;
  const conversionRate = totalLeads ? ((convertedCount / totalLeads) * 100).toFixed(2) : '0.00';

  const filteredLeads = leads.filter(lead => {
    let matchesSearch = true;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      matchesSearch = (lead.client_name?.toLowerCase().includes(q)) || 
                      (lead.contact_number?.includes(q)) ||
                      (lead.location?.toLowerCase().includes(q));
    }

    let matchesStatus = true;
    if (statusFilter !== 'all') {
      if (statusFilter === 'pending') {
        matchesStatus = lead.status === 'enquiry' || lead.status === 'in_meeting' || lead.status === 'pending';
      } else if (statusFilter === 'dead') {
        matchesStatus = lead.status === 'lost' || lead.status === 'dead' || lead.status === 'dropped';
      } else {
        matchesStatus = lead.status === statusFilter;
      }
    }

    return matchesSearch && matchesStatus;
  });

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'sans-serif', backgroundColor: '#f9fafb', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', marginBottom: '24px', border: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ padding: '12px', backgroundColor: '#253b50', borderRadius: '12px', color: 'white' }}>
              <Users size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827', margin: 0 }}>D1 Assigned Leads & Status Updates</h2>
              <p style={{ color: '#6b7280', margin: '4px 0 0 0', fontSize: '0.9rem' }}>Update lead statuses (Proposal Sent, Converted, Dead Lead) for your assigned consultations.</p>
            </div>
          </div>
        </div>

        {/* Metric Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '14px' }}>
          <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ backgroundColor: '#e0e7ff', padding: '10px', borderRadius: '10px', color: '#4f46e5' }}><Users size={18} /></div>
            <div>
              <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: 0 }}>Total Assigned</p>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#111827', margin: '2px 0' }}>{totalLeads}</h3>
              <p style={{ color: '#9ca3af', fontSize: '0.72rem', margin: 0 }}>All Consultations</p>
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

      {/* Filter & Search Toolbar */}
      <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e5e7eb', padding: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          
          <div style={{ position: 'relative', flex: 1, minWidth: '300px' }}>
            <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
            <input
              type="text"
              placeholder="Search by client name, contact or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '12px 16px 12px 48px', borderRadius: '12px', border: '1px solid #e5e7eb', outline: 'none', fontSize: '0.95rem' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#4b5563' }}>Status Filter:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: '10px 16px', borderRadius: '10px', border: '1px solid #d1d5db', outline: 'none', fontSize: '0.9rem', fontWeight: 500, backgroundColor: '#f9fafb' }}
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending Leads (In Meeting)</option>
              <option value="proposal_sent">Proposal Sent</option>
              <option value="won">Converted</option>
              <option value="dead">Dead Lead</option>
            </select>
          </div>

        </div>
      </div>

      {/* Assigned Leads Table */}
      <div style={{ marginTop: '24px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
            <Loader2 className="animate-spin" size={32} color="#253b50" />
          </div>
        ) : filteredLeads.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6b7280' }}>
            <Users size={48} style={{ margin: '0 auto 16px auto', color: '#cbd5e1' }} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#334155', margin: 0 }}>No Assigned Leads Found</h3>
            <p style={{ margin: '6px 0 0 0', fontSize: '0.9rem' }}>No leads matching your search criteria were found.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
                  <th style={{ padding: '10px 8px 10px 16px', color: '#6b7280', fontWeight: 500, fontSize: '0.9rem', width: '110px' }}>Client ID</th>
                  <th style={{ padding: '10px 12px', color: '#6b7280', fontWeight: 500, fontSize: '0.9rem' }}>Client Info</th>
                  <th style={{ padding: '10px 16px', color: '#6b7280', fontWeight: 500, fontSize: '0.9rem' }}>Project / Scope</th>
                  <th style={{ padding: '10px 16px', color: '#6b7280', fontWeight: 500, fontSize: '0.9rem' }}>Created On</th>
                  <th style={{ padding: '10px 16px', color: '#6b7280', fontWeight: 500, fontSize: '0.9rem' }}>D1 Consultation & Meeting Status</th>
                  <th style={{ padding: '10px 16px', color: '#6b7280', fontWeight: 500, fontSize: '0.9rem', textAlign: 'center' }}>Notes</th>
                  <th style={{ padding: '10px 16px', color: '#6b7280', fontWeight: 500, fontSize: '0.9rem', width: '80px', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead) => {
                  const currentSelected = selectedStatuses[lead.lead_id] || lead.status;
                  const isModified = currentSelected !== lead.status;
                  const isSaving = savingLeadId === lead.lead_id;

                  return (
                    <tr key={lead.lead_id} style={{ borderBottom: '1px solid #f3f4f6', transition: 'background-color 0.2s' }}>
                      <td style={{ padding: '16px 8px 16px 16px', width: '110px' }}>
                        <span style={{ color: '#4b5563', backgroundColor: '#f3f4f6', padding: '4px 10px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 500, display: 'inline-block' }}>
                          {lead.lead_id || '-'}
                        </span>
                      </td>
                      <td style={{ padding: '16px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#e0e7ff', color: '#4338ca', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '0.9rem' }}>
                            {lead.client_name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: '#111827', fontSize: '0.95rem' }}>{lead.client_name}</div>
                            <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '2px' }}>{lead.contact_number}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '16px 16px' }}>
                        <div>
                          <div style={{ fontWeight: 500, color: '#111827', fontSize: '0.9rem' }}>{lead.location || 'No Location'}</div>
                          <div style={{ color: '#9ca3af', fontSize: '0.85rem', marginTop: '2px' }}>{lead.project_scope} {lead.project_type?.replace('_', ' ')}</div>
                        </div>
                      </td>
                      <td style={{ padding: '16px 16px' }}>
                        <div style={{ color: '#6b7280', fontSize: '0.85rem' }}>
                          {lead.created_at ? new Date(lead.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                        </div>
                      </td>
                      <td style={{ padding: '16px 16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            
                            {/* Current Status Badge */}
                            <span style={{
                              padding: '4px 10px', borderRadius: '16px', fontSize: '0.8rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px',
                              backgroundColor: lead.status === 'proposal_sent' ? '#ede9fe' : (lead.status === 'won' || lead.status === 'converted') ? '#dcfce7' : (lead.status === 'lost' || lead.status === 'dead') ? '#fee2e2' : lead.status === 'in_meeting' ? '#fef3c7' : '#e0f2fe',
                              color: lead.status === 'proposal_sent' ? '#7c3aed' : (lead.status === 'won' || lead.status === 'converted') ? '#15803d' : (lead.status === 'lost' || lead.status === 'dead') ? '#b91c1c' : lead.status === 'in_meeting' ? '#d97706' : '#0369a1'
                            }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'currentColor' }}></span>
                              {getStatusLabel(lead.status)}
                            </span>
    
                            {/* Booking Date Time */}
                            {lead.d1_booking_time && (
                              <span style={{ color: '#6b7280', fontSize: '0.8rem', fontWeight: 500 }}>
                                {new Date(lead.d1_booking_time).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>

                          {/* Site Manager Assignment Info */}
                          {lead.site_manager_assigned_to && (
                            <div style={{ fontSize: '0.8rem', color: '#4b5563', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                              <span style={{ fontWeight: 600 }}>Site Manager(s):</span>
                              <span style={{ color: '#111827' }}>
                                {String(lead.site_manager_assigned_to).split(',').map(id => team.find(t => String(t.user_id) === String(id.trim()))?.name).filter(Boolean).join(', ') || `IDs: ${lead.site_manager_assigned_to}`}
                              </span>
                            </div>
                          )}
    
                          <div style={{ fontSize: '0.8rem', color: '#4b5563', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: 600 }}>Update Status:</span>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <select
                                value={currentSelected}
                                onChange={(e) => handleStatusSelectChange(lead.lead_id, e.target.value)}
                                style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.8rem', outline: 'none' }}
                              >
                                <option value="enquiry">🕒 Scheduled</option>
                                <option value="in_meeting">⏳ In Meeting (Pending)</option>
                                <option value="meeting_completed">✅ Meeting Completed</option>
                                <option value="proposal_sent">📄 Proposal Sent</option>
                                <option value="won">🏆 Converted</option>
                                <option value="lost">❌ Dead Lead</option>
                              </select>
                              {isModified && (
                                <button onClick={() => handleSaveStatus(lead)} disabled={isSaving} style={{ backgroundColor: '#111827', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                  {isSaving ? <Loader2 size={12} className="animate-spin" /> : 'Save'}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '16px 16px', textAlign: 'center' }}>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); openLeadModal(lead); }}
                          style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', color: '#4b5563', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', margin: '0 auto', transition: 'background-color 0.2s' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <MessageSquare size={14} /> Notes
                        </button>
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'center', position: 'relative' }}>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === lead.lead_id ? null : lead.lead_id); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '4px' }}
                        >
                          <MoreVertical size={18} />
                        </button>
                        {activeDropdown === lead.lead_id && (
                          <div style={{ position: 'absolute', right: '32px', top: '24px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', border: '1px solid #e5e7eb', zIndex: 50, minWidth: '160px', overflow: 'hidden' }}>
                            <button 
                              onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); openLeadModal(lead); }}
                              style={{ width: '100%', padding: '10px 12px', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', fontSize: '0.85rem', color: '#374151', display: 'flex', alignItems: 'center', gap: '8px' }}
                            >
                              <FileText size={14} /> D1 Docs
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); handleCreateProjectFromLead(lead); }}
                              style={{ width: '100%', padding: '10px 12px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', color: '#15803d', display: 'flex', alignItems: 'center', gap: '8px' }}
                            >
                              <FolderPlus size={14} /> Create Project
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); setSelectedBookLead(lead); setShowBookSiteModal(true); }}
                              style={{ width: '100%', padding: '10px 12px', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', fontSize: '0.85rem', color: '#ea580c', display: 'flex', alignItems: 'center', gap: '8px' }}
                            >
                              <Calendar size={14} /> Book Site Manager
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>{viewingLeadModal.client_name} — Sales Notes & D1 Documents</h3>
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
                  padding: '14px 20px', fontWeight: 600, fontSize: '0.9rem', border: 'none', background: 'none', cursor: 'pointer',
                  borderBottom: modalTab === 'notes' ? '3px solid #253b50' : '3px solid transparent',
                  color: modalTab === 'notes' ? '#253b50' : '#64748b', display: 'flex', alignItems: 'center', gap: '8px'
                }}
              >
                <MessageSquare size={16} /> Sales & Team Notes ({notes.length})
              </button>
              <button
                onClick={() => setModalTab('files')}
                style={{
                  padding: '14px 20px', fontWeight: 600, fontSize: '0.9rem', border: 'none', background: 'none', cursor: 'pointer',
                  borderBottom: modalTab === 'files' ? '3px solid #253b50' : '3px solid transparent',
                  color: modalTab === 'files' ? '#253b50' : '#64748b', display: 'flex', alignItems: 'center', gap: '8px'
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
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
          <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '16px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h3 style={{ marginBottom: '24px', fontSize: '1.25rem', color: '#111827', fontWeight: 600 }}>Start Project</h3>
            <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '20px' }}>
              You are about to start the project for <strong>{selectedLead?.client_name}</strong>.
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

      {/* Book Site Manager Modal */}
      {showBookSiteModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300 }}>
          <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '16px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#111827', marginBottom: '20px' }}>
              Book Site Manager / MMT Slot
            </h2>
            <form onSubmit={handleBookSiteSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#374151', marginBottom: '6px' }}>Select Site Manager / Inspector <span style={{ color: '#ef4444' }}>*</span></label>
                <div style={{
                  maxHeight: '180px',
                  overflowY: 'auto',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  backgroundColor: '#f8fafc'
                }}>
                  {team.filter(u => {
                    const role = String(u.role).toLowerCase();
                    return role.includes('site') || role === 'mmt' || role === 'manager';
                  }).map(u => {
                    const isChecked = (selectedSiteUser ? selectedSiteUser.split(',') : []).includes(String(u.user_id));
                    return (
                      <label key={u.user_id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        cursor: 'pointer',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        backgroundColor: isChecked ? '#eff6ff' : 'transparent',
                        border: isChecked ? '1px solid #3b82f6' : '1px solid transparent',
                        transition: 'all 0.2s ease',
                        fontSize: '0.85rem',
                        fontWeight: isChecked ? 600 : 500,
                        color: isChecked ? '#1d4ed8' : '#374151'
                      }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            const currentIds = selectedSiteUser ? selectedSiteUser.split(',') : [];
                            const uidStr = String(u.user_id);
                            let newIds;
                            if (currentIds.includes(uidStr)) {
                              newIds = currentIds.filter(id => id !== uidStr);
                            } else {
                              newIds = [...currentIds, uidStr];
                            }
                            setSelectedSiteUser(newIds.join(','));
                          }}
                          style={{
                            width: '16px',
                            height: '16px',
                            cursor: 'pointer'
                          }}
                        />
                        <span>{u.name} ({u.role})</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#374151', marginBottom: '6px' }}>Booking Date <span style={{ color: '#ef4444' }}>*</span></label>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }}>
                    <Calendar size={16} />
                  </div>
                  <input
                    type="date"
                    value={bookDate}
                    onChange={(e) => setBookDate(e.target.value)}
                    style={{ width: '100%', padding: '10px 10px 10px 36px', borderRadius: '8px', border: '1px solid #d1d5db', outline: 'none', color: '#374151', fontSize: '0.9rem' }}
                    required
                  />
                </div>
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#374151', marginBottom: '8px', fontWeight: 600 }}>Select Time Slot <span style={{ color: '#ef4444' }}>*</span></label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {FIXED_SLOTS.map((slot) => {
                    const booked = isSlotBooked(slot.value);
                    const selected = bookTime === slot.value;
                    return (
                      <button
                        key={slot.id}
                        type="button"
                        disabled={booked}
                        onClick={() => setBookTime(slot.value)}
                        style={{
                          padding: '10px 8px',
                          borderRadius: '8px',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          cursor: booked ? 'not-allowed' : 'pointer',
                          border: selected ? '2px solid #f97316' : '1px solid #e5e7eb',
                          backgroundColor: booked ? '#f3f4f6' : selected ? '#fff7ed' : 'white',
                          color: booked ? '#9ca3af' : selected ? '#ea580c' : '#374151',
                          textDecoration: booked ? 'line-through' : 'none',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '2px',
                          transition: 'all 0.2s'
                        }}
                      >
                        <span>{slot.label}</span>
                        {booked && <span style={{ fontSize: '0.7rem', color: '#ef4444', textDecoration: 'none', fontWeight: 500 }}>Already Booked</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#374151', marginBottom: '6px', fontWeight: 500 }}>Note / Instructions</label>
                <textarea
                  rows={3}
                  value={siteNotes}
                  onChange={(e) => setSiteNotes(e.target.value)}
                  placeholder="Add any specific instructions for the site manager..."
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', outline: 'none', fontSize: '0.85rem', fontFamily: 'inherit' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" onClick={() => setShowBookSiteModal(false)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #e5e7eb', backgroundColor: 'white', color: '#374151', fontWeight: 500 }}>Cancel</button>
                <button type="submit" disabled={submitting} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', backgroundColor: '#f97316', color: 'white', fontWeight: 500 }}>
                  {submitting ? <Loader2 className="animate-spin" size={20} /> : 'Confirm Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default D1Leads;
