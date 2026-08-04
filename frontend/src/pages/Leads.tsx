import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useAuth } from '../hooks/useAuth';
import QuoteTab from '../components/QuoteTab';
// @ts-ignore
import html2pdf from 'html2pdf.js';
import {
  UserPlus,
  Search,
  CheckCircle2,
  MoreVertical,
  ArrowRightCircle,
  Loader2,
  Phone,
  MapPin,
  Pencil,
  Users,
  CheckSquare,
  Clock,
  DollarSign,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Calendar,
  X,
  MessageSquare,
  Paperclip,
  Upload,
  UploadCloud,
  FileText,
  Trash2,
  Folder,
  FolderPlus,
  PlusCircle,
  Share2
} from 'lucide-react';
import { AnalogTimePicker } from '../components/AnalogTimePicker';

interface Lead {
  lead_id: string;
  client_name: string;
  contact_number: string;
  email: string;
  location: string;
  project_type: string;
  estimated_budget: string;
  status: string;
  lead_source: string;
  manual_client_id?: string;
  project_scope?: string;
  custom_scope?: string;
  client_address?: string;
  created_at?: string;
  d1_assigned_to?: number;
  d1_booking_time?: string;
  d1_notes?: string;
}


const CustomerQuotesTab: React.FC<{ viewingLead: any; user: any }> = ({ viewingLead, user }) => {
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showEditor, setShowEditor] = useState(false);

    const getBaseId = (val?: string | number) => {
        if (val === undefined || val === null) return '';
        return String(val).replace(/^(lead_|p-|l-|q-|ql-)/, '').trim().toLowerCase();
    };

    const rawLeadId = String(viewingLead.id || viewingLead.lead_id || viewingLead.manual_client_id || '');
    const baseLeadId = getBaseId(rawLeadId);
    const leadProjectId = baseLeadId ? `lead_${baseLeadId}` : (viewingLead.client_name ? `lead_${viewingLead.client_name}` : 'lead_1');

    useEffect(() => {
        fetchQuoteHistory();
    }, [viewingLead]);

    const fetchQuoteHistory = async () => {
        setLoading(true);
        try {
            const rawLeadId = String(viewingLead.id || viewingLead.lead_id || viewingLead.manual_client_id || '');
            const baseLeadId = getBaseId(rawLeadId);
            const leadProjectId = `lead_${baseLeadId}`;
            const clientName = String(viewingLead.client_name || viewingLead.name || viewingLead.title || '').trim().toLowerCase();

            const [res1, res2, res3] = await Promise.all([
                axios.get(`${API_BASE_URL}/quotes/history?project_id=${leadProjectId}`).catch(() => ({ data: { data: [] } })),
                axios.get(`${API_BASE_URL}/quotes/history?project_id=${baseLeadId}`).catch(() => ({ data: { data: [] } })),
                axios.get(`${API_BASE_URL}/quotes`).catch(() => ({ data: { data: [] } }))
            ]);

            const list1 = res1.data?.data || (Array.isArray(res1.data) ? res1.data : []);
            const list2 = res2.data?.data || (Array.isArray(res2.data) ? res2.data : []);
            const allQuotes = res3.data?.data || (Array.isArray(res3.data) ? res3.data : []);

            const matchedFromAll = allQuotes.filter((q: any) => {
                const qBaseId = getBaseId(q.project_id);
                const qClient = String(q.client_name || '').trim().toLowerCase();
                const qSub = String(q.subtitle || q.project_name || '').trim().toLowerCase();
                return (
                    (baseLeadId && qBaseId === baseLeadId) ||
                    (baseLeadId && String(q.project_id) === baseLeadId) ||
                    String(q.project_id) === leadProjectId ||
                    (clientName && qClient && (qClient.includes(clientName) || clientName.includes(qClient))) ||
                    (clientName && qSub && (qSub.includes(clientName) || clientName.includes(qSub)))
                );
            });

            const combined = [...list1, ...list2, ...matchedFromAll];

            const unique = Array.from(new Map(combined.map(item => [item.quote_id, item])).values());
            setHistory(unique);
        } catch (err) {
            console.error('Failed to fetch lead quotes history', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadPdf = (h?: any) => {
        setShowEditor(true);
        setTimeout(() => {
            const element = document.getElementById('printable-quote-area') || document.querySelector('.quote-sheet-wrapper') || document.querySelector('.quote-container') || document.body;
            if (element && typeof html2pdf === 'function') {
                const opt: any = {
                    margin:       0.2,
                    filename:     `Quotation_v${h?.version || 1}_${(viewingLead?.client_name || 'Customer').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
                    image:        { type: 'jpeg', quality: 0.98 },
                    html2canvas:  { scale: 2, useCORS: true },
                    jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' },
                    pagebreak:    { mode: ['css', 'legacy'] }
                };
                html2pdf().set(opt).from(element).save().then(() => {
                    setShowEditor(false);
                }).catch(() => {
                    window.print();
                });
            } else {
                window.print();
            }
        }, 600);
    };

    if (showEditor) {
        return (
            <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <button
                        onClick={() => { setShowEditor(false); fetchQuoteHistory(); }}
                        style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#f8fafc', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}
                    >
                        ← Back to PDF List
                    </button>
                </div>
                <QuoteTab
                    key={`qtab-lead-${leadProjectId}-${viewingLead?.client_name}`}
                    project={{
                        project_id: leadProjectId,
                        project_name: viewingLead.client_name || 'Customer Quotation',
                        client_name: viewingLead.client_name || 'Client'
                    }}
                    user={user}
                    isReadOnly={false}
                    isUsedQuote={false}
                    onSaveSuccess={() => { setShowEditor(false); fetchQuoteHistory(); }}
                />
            </div>
        );
    }

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px auto' }} />
                <p style={{ margin: 0, fontSize: '0.85rem' }}>Loading quotation PDF files...</p>
            </div>
        );
    }

    if (history.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '40px 20px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                <FileText size={44} color="#94a3b8" style={{ marginBottom: '12px' }} />
                <h4 style={{ margin: '0 0 6px 0', color: '#1e293b', fontWeight: 700, fontSize: '1rem' }}>No Quotation PDF Created Yet</h4>
                <p style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: '#64748b' }}>This customer folder does not have any saved quotation PDFs yet.</p>
                <button
                    onClick={() => setShowEditor(true)}
                    style={{ padding: '10px 18px', backgroundColor: '#111827', color: '#ffffff', borderRadius: '8px', border: 'none', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
                >
                    + Prepare First Quotation
                </button>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                        Quotation PDF Documents ({history.length})
                    </h4>
                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Saved PDF versions for {viewingLead.client_name}</span>
                </div>
                <button
                    onClick={() => setShowEditor(true)}
                    style={{ padding: '8px 14px', backgroundColor: '#111827', color: '#ffffff', borderRadius: '6px', border: 'none', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}
                >
                    + Prepare New Version
                </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '350px', overflowY: 'auto' }}>
                {history.map((h: any) => (
                    <div
                        key={h.quote_id}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '14px 16px',
                            backgroundColor: '#ffffff',
                            borderRadius: '10px',
                            border: '1px solid #e2e8f0',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                                width: '42px',
                                height: '42px',
                                borderRadius: '8px',
                                backgroundColor: '#fee2e2',
                                color: '#dc2626',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 800,
                                fontSize: '0.75rem',
                                boxShadow: '0 2px 4px rgba(220,38,38,0.15)'
                            }}>
                                PDF
                            </div>
                            <div>
                                <h5 style={{ margin: '0 0 2px 0', fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}>
                                    Quotation_v{h.version || 1}.pdf
                                </h5>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#64748b' }}>
                                    <span>{h.quote_number || `#${h.quote_id}`}</span>
                                    <span>•</span>
                                    <span style={{ fontWeight: 700, color: '#059669' }}>₹{Number(h.total_amount || 0).toLocaleString()}</span>
                                    <span>•</span>
                                    <span>{new Date(h.created_at).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => handleDownloadPdf(h)}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: '#059669',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '0.82rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                boxShadow: '0 2px 4px rgba(5,150,105,0.2)'
                            }}
                        >
                            <Download size={15} /> Download PDF
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export const Leads: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [viewingLead, setViewingLead] = useState<Lead | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterDateQuick, setFilterDateQuick] = useState('custom');
  const [statusFilter, setStatusFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [filterAssignedTo, setFilterAssignedTo] = useState('');
  const [filterServices, setFilterServices] = useState<string[]>([]);
  const [filterScope, setFilterScope] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [notes, setNotes] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [currentFolder, setCurrentFolder] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showBookModal, setShowBookModal] = useState(false);
  const [selectedBookLead, setSelectedBookLead] = useState<Lead | null>(null);
  const [bookDate, setBookDate] = useState('');
  const [bookTime, setBookTime] = useState('10:00');
  const [d1Notes, setD1Notes] = useState('');
  const [selectedD1User, setSelectedD1User] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [team, setTeam] = useState<any[]>([]);

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
  const [formData, setFormData] = useState({
    client_name: '',
    contact_number: '',
    email: '',
    location: '',
    client_address: '',
    project_type: 'Furniture projects',
    estimated_budget: '',
    lead_source: 'walk_in',
    manual_client_id: '',
    project_scope: '2 BHK',
    custom_scope: '',
    created_by: user?.user_id || ''
  });
  const [convertData, setConvertData] = useState({
    project_name: '',
    project_head_id: '',
    site_engineer_id: '',
    total_budget: '',
    start_date: new Date().toISOString().split('T')[0],
    expected_end_date: new Date(new Date().setMonth(new Date().getMonth() + 4)).toISOString().split('T')[0]
  });
  const [activeDropdown, setActiveDropdown] = useState<string | number | null>(null);
  useEffect(() => {
    const handleClickOutside = () => setActiveDropdown(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    fetchLeads();
    fetchTeam();
    const interval = setInterval(() => {
      fetchLeads(true);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (showViewModal && viewingLead) {
      fetchNotes(viewingLead.lead_id);
      fetchFiles(viewingLead.lead_id, currentFolder);
    }
  }, [showViewModal, viewingLead, currentFolder, activeTab]);

  useEffect(() => {
    if (showBookModal && selectedBookLead) {
      setSelectedD1User(selectedBookLead.d1_assigned_to ? String(selectedBookLead.d1_assigned_to) : '');
      setD1Notes(selectedBookLead.d1_notes || '');
      if (selectedBookLead.d1_booking_time) {
        const parts = selectedBookLead.d1_booking_time.split(' ');
        setBookDate(parts[0] || '');
        if (parts[1]) {
          const timeParts = parts[1].split(':');
          setBookTime(`${timeParts[0]}:${timeParts[1]}`);
        } else {
          setBookTime('10:00');
        }
      } else {
        setBookDate('');
        setBookTime('10:00');
      }
    }
  }, [showBookModal, selectedBookLead]);

  const FIXED_SLOTS = [
    { id: '10:00', label: '10:00 AM - 12:00 PM', value: '10:00' },
    { id: '14:00', label: '02:00 PM - 04:00 PM', value: '14:00' },
    { id: '16:00', label: '04:00 PM - 06:00 PM', value: '16:00' },
    { id: '18:00', label: '06:00 PM - 08:00 PM', value: '18:00' }
  ];

  const isSlotBooked = (slotValue: string) => {
    if (!selectedD1User || !bookDate) return false;
    return leads.some((lead) => {
      if (selectedBookLead && String(lead.lead_id) === String(selectedBookLead.lead_id)) {
        return false;
      }
      if (String(lead.d1_assigned_to) === String(selectedD1User) && lead.d1_booking_time) {
        const bookingStr = lead.d1_booking_time;
        let datePart = '';
        let timePart = '';
        if (bookingStr.includes('T')) {
          const d = new Date(bookingStr);
          datePart = d.toISOString().split('T')[0];
          timePart = d.toTimeString().substring(0, 5);
        } else {
          const parts = bookingStr.split(' ');
          datePart = parts[0];
          if (parts[1]) {
            timePart = parts[1].substring(0, 5);
          }
        }
        return datePart === bookDate && timePart === slotValue;
      }
      return false;
    });
  };

  const fetchLeads = async (silent: boolean = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/leads`);
      if (response.data && response.data.success) {
        setLeads(Array.isArray(response.data.data) ? response.data.data : []);
      } else if (Array.isArray(response.data)) {
        setLeads(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch leads', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchNotes = async (lead_id: string) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/leads/notes?lead_id=${lead_id}`);
      if (response.data.success) {
        setNotes(response.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch notes', err);
    }
  };

  const fetchFiles = async (lead_id: string, folder: string = '') => {
    try {
      const response = await axios.get(`${API_BASE_URL}/leads/files?lead_id=${lead_id}&folder=${folder}`);
      if (response.data.success) {
        setFiles(response.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch files', err);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !viewingLead) return;
    try {
      const response = await axios.post(`${API_BASE_URL}/leads/notes`, {
        lead_id: viewingLead.lead_id,
        note_text: newNote
      });
      if (response.data.success) {
        setNewNote('');
        fetchNotes(viewingLead.lead_id);
      }
    } catch (err) {
      console.error('Failed to add note', err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !viewingLead) return;
    const file = e.target.files[0];
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('lead_id', String(viewingLead.lead_id));
    formData.append('folder', currentFolder);
    
    try {
      const response = await axios.post(`${API_BASE_URL}/leads/upload`, formData);
      if (response.data.success) {
        fetchFiles(viewingLead.lead_id, currentFolder);
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
    if (!viewingLead || !newFolderName.trim()) return;
    setCreatingFolder(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/leads/create-folder`, {
        lead_id: viewingLead.lead_id,
        folder_name: newFolderName.trim(),
        parent_folder: currentFolder
      });
      if (response.data.success) {
        setNewFolderName('');
        fetchFiles(viewingLead.lead_id, currentFolder);
      } else {
        alert(response.data.message);
      }
    } catch (err) {
      console.error('Failed to create folder', err);
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleDeleteFile = async (filename: string) => {
    if (!viewingLead || !window.confirm('Are you sure you want to delete this file/folder?')) return;
    try {
      const response = await axios.delete(`${API_BASE_URL}/leads/files?lead_id=${viewingLead.lead_id}&filename=${filename}&folder=${currentFolder}`);
      if (response.data.success) {
        fetchFiles(viewingLead.lead_id, currentFolder);
      }
    } catch (err) {
      console.error('Failed to delete file', err);
    }
  };

  const fetchTeam = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/users`);
      if (response.data.success) {
        setTeam(response.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch team');
    }
  };

  const handleStatusUpdate = async (lead_id: string, newStatus: string) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/leads/update-status`, {
        lead_id,
        status: newStatus
      });
      if (response.data.success) {
        fetchLeads();
      }
    } catch (err) {
      alert('Error updating status');
    }
  };

  const handleConvertClick = (lead: Lead) => {
    setSelectedLead(lead);
    setConvertData({
      ...convertData,
      project_name: lead.client_name + ' Project'
    });
    setShowConvertModal(true);
  };

  const handleConversionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/leads/update-status`, {
        lead_id: selectedLead?.lead_id,
        status: 'won',
        data: {
          ...convertData,
          total_budget: 0,
          advance_paid: 0, // Accountant will record this in Finance
          created_by: user?.user_id
        }
      });
      if (response.data.success) {
        setShowConvertModal(false);
        fetchLeads();
        navigate(`/projects/${response.data.project_id}`);
      } else {
        alert(response.data.message);
      }
    } catch (err) {
      alert('Conversion failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditClick = (lead: Lead) => {
    setEditingLead(lead);
    setFormData({
      client_name: lead.client_name,
      contact_number: lead.contact_number,
      email: lead.email || '',
      location: lead.location,
      client_address: lead.client_address || '',
      project_type: lead.project_type,
      estimated_budget: lead.estimated_budget,
      lead_source: lead.lead_source,
      manual_client_id: lead.manual_client_id || '',
      project_scope: ['2 BHK', '3 BHK', 'Duplex'].includes(lead.project_scope || '') ? (lead.project_scope || '2 BHK') : 'Other',
      custom_scope: !['2 BHK', '3 BHK', 'Duplex'].includes(lead.project_scope || '') ? (lead.project_scope || '') : '',
      created_by: user?.user_id || ''
    });
    setShowEditModal(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const finalScope = formData.project_scope === 'Other' ? formData.custom_scope : formData.project_scope;
      const response = await axios.put(`${API_BASE_URL}/leads`, {
        ...formData,
        project_scope: finalScope,
        lead_id: editingLead?.lead_id
      });
      if (response.data.success) {
        setShowEditModal(false);
        setEditingLead(null);
        fetchLeads();
      }
    } catch (err) {
      alert('Error updating lead');
    } finally {
      setSubmitting(false);
    }
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const finalScope = formData.project_scope === 'Other' ? formData.custom_scope : formData.project_scope;
      const response = await axios.post(`${API_BASE_URL}/leads`, {
        ...formData,
        project_scope: finalScope,
        created_by: user?.user_id
      });
      if (response.data.success) {
        setShowAddModal(false);
        setFormData({
          ...formData,
          client_name: '',
          contact_number: '',
          email: '',
          location: '',
          client_address: '',
          estimated_budget: '',
          manual_client_id: '',
          project_scope: '2 BHK',
          custom_scope: ''
        });
        fetchLeads();
      }
    } catch (err) {
      alert('Error adding lead');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteLead = async (lead_id: string | number) => {
    if (window.confirm('Are you sure you want to delete this lead?')) {
      try {
        const response = await axios.delete(`${API_BASE_URL}/leads?id=${lead_id}`);
        if (response.data.success) {
          fetchLeads();
        } else {
          alert(response.data.message);
        }
      } catch (error) {
        alert('Error deleting lead');
      }
    }
  };

  const handleBookD1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedD1User || !bookDate || !bookTime) {
      alert('Please fill all booking details');
      return;
    }
    setSubmitting(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/leads/book-d1`, {
        lead_id: selectedBookLead?.lead_id,
        d1_user_id: selectedD1User,
        booking_time: `${bookDate} ${bookTime}:00`,
        assigned_by_name: user?.name || 'Admin',
        d1_notes: d1Notes
      });
      if (response.data.success) {
        setShowBookModal(false);
        setD1Notes('');
        fetchLeads();
      } else {
        alert(response.data.message);
      }
    } catch (err) {
      alert('Error booking slot');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'won':
      case 'converted': return { bg: '#d1fae5', text: '#059669' };
      case 'proposal_sent': return { bg: '#ede9fe', text: '#7c3aed' };
      case 'lost': return { bg: '#fee2e2', text: '#dc2626' };
      case 'enquiry': return { bg: '#fef3c7', text: '#d97706' };
      case 'in_meeting': return { bg: '#fef08a', text: '#a16207' };
      case 'on_going': return { bg: '#bfdbfe', text: '#1d4ed8' };
      default: return { bg: '#f3f4f6', text: '#4b5563' };
    }
  };

  const getSourceColor = (source: string) => {
    switch (source?.toLowerCase()) {
      case 'website': return { bg: '#e0e7ff', text: '#4f46e5' };
      case 'referral':
      case 'reference': return { bg: '#dcfce7', text: '#16a34a' };
      case 'social_media': return { bg: '#fae8ff', text: '#c026d3' };
      default: return { bg: '#f3f4f6', text: '#4b5563' };
    }
  };

  const totalLeads = leads.length;
  const meetingsCount = leads.filter(l => !!l.d1_assigned_to || !!l.d1_booking_time).length;
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
                      (lead.manual_client_id?.toLowerCase().includes(q));
    }
    
    let matchesStatus = true;
    if (statusFilter) {
      if (statusFilter === 'booked') {
        matchesStatus = !!lead.d1_assigned_to;
      } else {
        matchesStatus = lead.status === statusFilter;
      }
    }
    
    let matchesDate = true;
    if (dateFrom || dateTo) {
      const leadDateStr = lead.created_at?.split(' ')[0] || lead.created_at?.split('T')[0];
      if (leadDateStr) {
        const lDate = new Date(leadDateStr);
        lDate.setHours(0, 0, 0, 0);
        
        if (dateFrom) {
          const fromDate = new Date(dateFrom);
          fromDate.setHours(0, 0, 0, 0);
          if (lDate < fromDate) matchesDate = false;
        }
        if (dateTo) {
          const toDate = new Date(dateTo);
          toDate.setHours(0, 0, 0, 0);
          if (lDate > toDate) matchesDate = false;
        }
      }
    }
    
    let matchesLocation = true;
    if (locationFilter) {
      if (lead.location !== locationFilter) matchesLocation = false;
    }
    
    let matchesAssignedTo = true;
    if (filterAssignedTo) {
      if (String(lead.d1_assigned_to) !== filterAssignedTo) matchesAssignedTo = false;
    }
    
    let matchesServices = true;
    if (filterServices.length > 0) {
      if (!filterServices.includes(lead.project_type)) {
        matchesServices = false;
      }
    }
    
    let matchesScope = true;
    if (filterScope.length > 0) {
      if (!filterScope.includes(lead.project_scope)) {
        matchesScope = false;
      }
    }
    
    return matchesSearch && matchesStatus && matchesDate && matchesLocation && matchesAssignedTo && matchesServices && matchesScope;
  });

  return (
    <div className="leads-page">
      <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', marginBottom: '24px', border: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '30px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ padding: '12px', backgroundColor: '#f3f4f6', borderRadius: '12px' }}>
              <Users size={24} color="#111827" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827', margin: 0 }}>Lead Management</h2>
              <p style={{ color: '#6b7280', margin: '4px 0 0 0', fontSize: '0.9rem' }}>Track enquiries and customer conversions</p>
            </div>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', backgroundColor: '#111827', color: 'white', borderRadius: '8px', fontWeight: 600, border: 'none' }}
          >
            <UserPlus size={18} />
            New Enquiry
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '14px' }}>
          <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ backgroundColor: '#e0e7ff', padding: '10px', borderRadius: '10px', color: '#4f46e5' }}><Users size={18} /></div>
            <div>
              <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: 0 }}>Total Leads</p>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#111827', margin: '2px 0' }}>{totalLeads}</h3>
              <p style={{ color: '#9ca3af', fontSize: '0.72rem', margin: 0 }}>All Enquiries</p>
            </div>
          </div>
          <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ backgroundColor: '#fef3c7', padding: '10px', borderRadius: '10px', color: '#d97706' }}><Clock size={18} /></div>
            <div>
              <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: 0 }}>Pending Leads</p>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#111827', margin: '2px 0' }}>{pendingCount}</h3>
              <p style={{ color: '#9ca3af', fontSize: '0.72rem', margin: 0 }}>{totalLeads ? ((pendingCount / totalLeads) * 100).toFixed(1) : 0}% of Total</p>
            </div>
          </div>
          <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ backgroundColor: '#ede9fe', padding: '10px', borderRadius: '10px', color: '#7c3aed' }}><CheckSquare size={18} /></div>
            <div>
              <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: 0 }}>Proposal Sent</p>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#111827', margin: '2px 0' }}>{proposalSentCount}</h3>
              <p style={{ color: '#9ca3af', fontSize: '0.72rem', margin: 0 }}>{totalLeads ? ((proposalSentCount / totalLeads) * 100).toFixed(1) : 0}% of Total</p>
            </div>
          </div>
          <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ backgroundColor: '#dcfce7', padding: '10px', borderRadius: '10px', color: '#16a34a' }}><CheckCircle2 size={18} /></div>
            <div>
              <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: 0 }}>Converted</p>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#111827', margin: '2px 0' }}>{convertedCount}</h3>
              <p style={{ color: '#9ca3af', fontSize: '0.72rem', margin: 0 }}>{totalLeads ? ((convertedCount / totalLeads) * 100).toFixed(1) : 0}% of Total</p>
            </div>
          </div>
          <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ backgroundColor: '#fee2e2', padding: '10px', borderRadius: '10px', color: '#dc2626' }}><X size={18} /></div>
            <div>
              <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: 0 }}>Dead Leads</p>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#111827', margin: '2px 0' }}>{deadCount}</h3>
              <p style={{ color: '#9ca3af', fontSize: '0.72rem', margin: 0 }}>{totalLeads ? ((deadCount / totalLeads) * 100).toFixed(1) : 0}% of Total</p>
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

      <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e5e7eb', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
            <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
            <input
              type="text"
              placeholder="Search by client name or contact..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '12px 16px 12px 48px', borderRadius: '12px', border: '1px solid #e5e7eb', outline: 'none', fontSize: '0.95rem' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <button 
                onClick={() => setShowFilters(!showFilters)}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: showFilters ? '#f3f4f6' : 'white', border: '1px solid #e5e7eb', borderRadius: '8px', color: '#374151', fontWeight: 500, cursor: 'pointer' }}
              >
                <Filter size={16} /> Filters {(dateFrom || dateTo || statusFilter || locationFilter || filterAssignedTo || filterServices.length > 0 || filterScope.length > 0) && <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }}></span>}
              </button>
              
              {showFilters && (
                <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', justifyContent: 'flex-end', pointerEvents: 'auto' }}>
                  <div style={{ width: '400px', backgroundColor: 'white', height: '100%', display: 'flex', flexDirection: 'column', boxShadow: '-10px 0 25px rgba(0,0,0,0.1)', animation: 'slideIn 0.3s ease-out' }}>
                    <div style={{ padding: '24px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#111827', fontWeight: 600 }}>Filters</h3>
                      <button onClick={() => setShowFilters(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={20} /></button>
                    </div>
                    
                    <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
                      <div style={{ marginBottom: '32px' }}>
                        <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: '#374151', fontWeight: 600 }}>Status</h4>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {[
                            { value: '', label: 'All' },
                            { value: 'new', label: 'New' },
                            { value: 'enquiry', label: 'Enquiry' },
                            { value: 'booked', label: 'Booked' },
                            { value: 'in_meeting', label: 'In Meeting' },
                            { value: 'meeting_completed', label: 'Completed' },
                            { value: 'converted', label: 'Converted' },
                            { value: 'lost', label: 'Lost' }
                          ].map(s => (
                            <button
                              key={s.value}
                              onClick={() => setStatusFilter(s.value)}
                              style={{ 
                                padding: '8px 16px', 
                                borderRadius: '20px', 
                                border: statusFilter === s.value ? 'none' : '1px solid #d1d5db', 
                                backgroundColor: statusFilter === s.value ? '#111827' : 'white', 
                                color: statusFilter === s.value ? 'white' : '#4b5563', 
                                fontSize: '0.85rem', 
                                fontWeight: 500,
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div style={{ marginBottom: '32px' }}>
                        <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: '#374151', fontWeight: 600 }}>Location</h4>
                        <div style={{ position: 'relative' }}>
                          <select value={locationFilter} onChange={e => setLocationFilter(e.target.value)} style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.95rem', backgroundColor: '#f9fafb', appearance: 'none', outline: 'none', color: '#111827' }}>
                            <option value="">All Locations</option>
                            {Array.from(new Set(leads.map(l => l.location).filter(Boolean))).map(loc => (
                              <option key={loc} value={loc}>{loc}</option>
                            ))}
                          </select>
                          <ChevronDown size={18} style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280', pointerEvents: 'none' }} />
                        </div>
                      </div>

                      <div style={{ marginBottom: '32px' }}>
                        <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: '#374151', fontWeight: 600 }}>Assigned To</h4>
                        <div style={{ position: 'relative' }}>
                          <select value={filterAssignedTo} onChange={e => setFilterAssignedTo(e.target.value)} style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.95rem', backgroundColor: '#f9fafb', appearance: 'none', outline: 'none', color: '#111827' }}>
                            <option value="">Select team member</option>
                            {team.filter(t => String(t.role).toLowerCase() === 'd1').map(t => (
                              <option key={t.user_id} value={String(t.user_id)}>{t.name}</option>
                            ))}
                          </select>
                          <ChevronDown size={18} style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280', pointerEvents: 'none' }} />
                        </div>
                      </div>

                      <div style={{ marginBottom: '32px' }}>
                        <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: '#374151', fontWeight: 600 }}>Services</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {Array.from(new Set(leads.map(l => l.project_type).filter(Boolean))).map(service => (
                            <label key={service} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', color: '#4b5563' }}>
                              <input 
                                type="checkbox" 
                                checked={filterServices.includes(service)}
                                onChange={e => {
                                  if (e.target.checked) setFilterServices([...filterServices, service]);
                                  else setFilterServices(filterServices.filter(s => s !== service));
                                }}
                                style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#111827' }} 
                              />
                              {service}
                            </label>
                          ))}
                        </div>
                      </div>

                      <div style={{ marginBottom: '32px' }}>
                        <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: '#374151', fontWeight: 600 }}>Scope</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {Array.from(new Set(leads.map(l => l.project_scope).filter(Boolean))).map(scope => (
                            <label key={scope} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', color: '#4b5563' }}>
                              <input 
                                type="checkbox" 
                                checked={filterScope.includes(scope)}
                                onChange={e => {
                                  if (e.target.checked) setFilterScope([...filterScope, scope]);
                                  else setFilterScope(filterScope.filter(s => s !== scope));
                                }}
                                style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#111827' }} 
                              />
                              {scope}
                            </label>
                          ))}
                        </div>
                      </div>
                      
                      <div style={{ marginBottom: '32px' }}>
                        <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: '#374151', fontWeight: 600 }}>Date Range</h4>
                        
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                          {[
                            { id: 'all', label: 'All Time' },
                            { id: 'today', label: 'Today' },
                            { id: 'last7', label: 'Last 7 Days' },
                            { id: 'thisMonth', label: 'This Month' },
                            { id: 'custom', label: 'Custom' }
                          ].map(d => (
                            <button
                              key={d.id}
                              onClick={() => {
                                setFilterDateQuick(d.id);
                                const today = new Date();
                                const todayStr = today.toISOString().split('T')[0];
                                
                                if (d.id === 'today') {
                                  setDateFrom(todayStr); setDateTo(todayStr);
                                } else if (d.id === 'last7') {
                                  const last7 = new Date(today); last7.setDate(today.getDate() - 7);
                                  setDateFrom(last7.toISOString().split('T')[0]); setDateTo(todayStr);
                                } else if (d.id === 'thisMonth') {
                                  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
                                  setDateFrom(firstDay.toISOString().split('T')[0]); setDateTo(todayStr);
                                } else if (d.id === 'all') {
                                  setDateFrom(''); setDateTo('');
                                }
                              }}
                              style={{ 
                                padding: '6px 12px', 
                                borderRadius: '16px', 
                                border: filterDateQuick === d.id ? 'none' : '1px solid #d1d5db', 
                                backgroundColor: filterDateQuick === d.id ? '#111827' : 'white', 
                                color: filterDateQuick === d.id ? 'white' : '#4b5563', 
                                fontSize: '0.8rem', 
                                fontWeight: 500,
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                            >
                              {d.label}
                            </button>
                          ))}
                        </div>
                        
                        <div style={{ display: 'flex', gap: '12px' }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: '#6b7280', marginBottom: '4px' }}>Start Date</label>
                            <input 
                              type="date" 
                              value={dateFrom} 
                              onChange={e => { setDateFrom(e.target.value); setFilterDateQuick('custom'); }} 
                              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.9rem', backgroundColor: '#f9fafb', outline: 'none' }} 
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: '#6b7280', marginBottom: '4px' }}>End Date</label>
                            <input 
                              type="date" 
                              value={dateTo} 
                              onChange={e => { setDateTo(e.target.value); setFilterDateQuick('custom'); }} 
                              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.9rem', backgroundColor: '#f9fafb', outline: 'none' }} 
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div style={{ padding: '24px', borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <button 
                        onClick={() => { setDateFrom(''); setDateTo(''); setStatusFilter(''); setLocationFilter(''); setFilterDateQuick('all'); setFilterAssignedTo(''); setFilterServices([]); setFilterScope([]); }} 
                        style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '0.95rem', cursor: 'pointer', fontWeight: 500, padding: 0 }}
                      >
                        Clear All
                      </button>
                      <button 
                        onClick={() => setShowFilters(false)} 
                        style={{ padding: '12px 24px', borderRadius: '8px', border: 'none', backgroundColor: '#111827', color: 'white', fontSize: '0.95rem', cursor: 'pointer', fontWeight: 600, width: '200px' }}
                      >
                        Apply Filters
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <button style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', color: '#374151', fontWeight: 500 }}>
              <Download size={16} /> Export
            </button>
          </div>
        </div>

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
              {loading ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px' }}><Loader2 className="animate-spin" style={{ margin: '0 auto' }} /></td></tr>
              ) : filteredLeads.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>No leads match your filters.</td></tr>
              ) : filteredLeads.map((lead) => (
                <tr key={lead.lead_id} style={{ borderBottom: '1px solid #f3f4f6', transition: 'background-color 0.2s' }}>
                  <td style={{ padding: '16px 8px 16px 16px', width: '110px' }}>
                    <span style={{ color: '#4b5563', backgroundColor: '#f3f4f6', padding: '4px 10px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 500, display: 'inline-block' }}>
                      {lead.manual_client_id || '-'}
                    </span>
                  </td>
                  <td style={{ padding: '16px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#e0e7ff', color: '#4338ca', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '0.9rem' }}>
                        {lead.client_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
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
                          {lead.status === 'proposal_sent' ? 'Proposal Sent' : (lead.status === 'won' || lead.status === 'converted') ? 'Converted' : (lead.status === 'lost' || lead.status === 'dead') ? 'Dead Lead' : lead.status === 'in_meeting' ? 'In Meeting (Pending)' : lead.status === 'meeting_completed' ? 'Meeting Completed' : 'Scheduled'}
                        </span>

                        {/* Booking Date Time */}
                        {lead.d1_booking_time && (
                          <span style={{ color: '#6b7280', fontSize: '0.8rem', fontWeight: 500 }}>
                            {new Date(lead.d1_booking_time).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>

                      {/* D1 Designer Assignment Info */}
                      {lead.d1_assigned_to ? (
                        <div style={{ fontSize: '0.8rem', color: '#4b5563', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 600 }}>D1 Designer:</span>
                          <span style={{ color: '#111827' }}>
                            {lead.d1_assigned_to ? String(lead.d1_assigned_to).split(',').map(id => team.find(t => String(t.user_id) === String(id.trim()))?.name).filter(Boolean).join(', ') || `IDs: ${lead.d1_assigned_to}` : 'None'}
                           </span>
                          <button 
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#f97316', display: 'flex', alignItems: 'center', marginLeft: '4px' }}
                            onClick={() => { setSelectedBookLead(lead); setShowBookModal(true); }}
                            title="Reschedule or Edit Notes"
                          >
                            <Pencil size={12} />
                          </button>
                        </div>
                      ) : (
                        <button 
                          style={{ padding: '6px 12px', backgroundColor: '#111827', color: 'white', borderRadius: '6px', border: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', cursor: 'pointer', marginTop: '4px', width: 'fit-content' }}
                          onClick={() => { setSelectedBookLead(lead); setShowBookModal(true); }}
                        >
                          <Calendar size={14} /> Book D1 Slot
                        </button>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '16px 16px', textAlign: 'center' }}>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); setActiveTab('notes'); setViewingLead(lead); setShowViewModal(true); }}
                      style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', color: '#4b5563', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', margin: '0 auto', transition: 'background-color 0.2s' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <MessageSquare size={14} /> Notes
                    </button>
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'center', position: 'relative' }}>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveDropdown(activeDropdown === lead.lead_id ? null : lead.lead_id);
                      }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '4px' }}
                    >
                      <MoreVertical size={18} />
                    </button>
                    {activeDropdown === lead.lead_id && (
                      <div style={{ position: 'absolute', right: '30px', top: '10px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)', zIndex: 10, width: '150px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); handleCreateProjectFromLead(lead); }}
                          style={{ width: '100%', padding: '10px 12px', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', fontSize: '0.85rem', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}
                        >
                          <FolderPlus size={14} /> Create Project
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); setActiveTab('details'); setViewingLead(lead); setShowViewModal(true); }}
                          style={{ width: '100%', padding: '10px 12px', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', fontSize: '0.85rem', color: '#374151', display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg> View Details
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); setActiveTab('notes'); setViewingLead(lead); setShowViewModal(true); }}
                          style={{ width: '100%', padding: '10px 12px', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', fontSize: '0.85rem', color: '#374151', display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                          <MessageSquare size={14} /> Add Note
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); setActiveTab('files'); setViewingLead(lead); setShowViewModal(true); }}
                          style={{ width: '100%', padding: '10px 12px', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', fontSize: '0.85rem', color: '#374151', display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                          <Paperclip size={14} /> Manage Files
                        </button>
                        {lead.status === 'booked' && (
                          <button 
                            onClick={async (e) => { 
                              e.stopPropagation(); 
                              setActiveDropdown(null);
                              try {
                                const response = await axios.post(`${API_BASE_URL}/leads/update-status`, { lead_id: lead.lead_id, status: 'in_meeting' });
                                if (response.data.success) fetchLeads();
                              } catch (e) { console.error(e); }
                            }}
                            style={{ width: '100%', padding: '10px 12px', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', fontSize: '0.85rem', color: '#059669', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500 }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Start Meeting
                          </button>
                        )}
                        <button 
                          onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); setEditingLead(lead); setShowEditModal(true); }}
                          style={{ width: '100%', padding: '10px 12px', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', fontSize: '0.85rem', color: '#374151', display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                          <Pencil size={14} /> Edit
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); handleDeleteLead(lead.lead_id); }}
                          style={{ width: '100%', padding: '10px 12px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg> Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0 0 0', borderTop: '1px solid #e5e7eb', marginTop: '16px' }}>
            <div style={{ color: '#6b7280', fontSize: '0.85rem' }}>
              Showing 1 to {Math.min(5, leads.length)} of {leads.length} entries
            </div>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <button style={{ padding: '6px', border: '1px solid #e5e7eb', borderRadius: '6px', backgroundColor: 'white', color: '#374151' }}><ChevronLeft size={16} /></button>
              <button style={{ padding: '6px 12px', border: 'none', borderRadius: '6px', backgroundColor: '#111827', color: 'white', fontWeight: 600 }}>1</button>
              <button style={{ padding: '6px 12px', border: 'none', borderRadius: '6px', backgroundColor: 'transparent', color: '#374151' }}>2</button>
              <span style={{ color: '#9ca3af' }}>...</span>
              <button style={{ padding: '6px 12px', border: 'none', borderRadius: '6px', backgroundColor: 'transparent', color: '#374151' }}>26</button>
              <button style={{ padding: '6px', border: '1px solid #e5e7eb', borderRadius: '6px', backgroundColor: 'white', color: '#374151' }}><ChevronRight size={16} /></button>
            </div>
          </div>
        </div>
      </div>

      {showConvertModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="premium-card" style={{ width: '100%', maxWidth: '650px' }}>
            <h3 style={{ marginBottom: '24px', fontSize: '1.4rem', color: '#253b50' }}>Launch Project: {selectedLead?.client_name}</h3>
            <p style={{ marginBottom: '20px', color: '#6b7280', fontSize: '0.9rem' }}>Assign the core execution team. (Budget & Advance will be managed by Accountant later)</p>
            <form onSubmit={handleConversionSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Project Name</label>
                <input type="text" required value={convertData.project_name} onChange={(e) => setConvertData({ ...convertData, project_name: e.target.value })} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #cbd5e1', outline: 'none' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Project Head</label>
                  <select required value={convertData.project_head_id} onChange={(e) => setConvertData({ ...convertData, project_head_id: e.target.value })} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #cbd5e1', outline: 'none' }}>
                    <option value="">Select Head</option>
                    {team.filter(t => ['admin', 'project_head', 'admin'].includes(t.role)).map(t => (
                      <option key={t.user_id} value={t.user_id}>{t.name} ({t.role.replace('_', ' ')})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Site Engineer</label>
                  <select required value={convertData.site_engineer_id} onChange={(e) => setConvertData({ ...convertData, site_engineer_id: e.target.value })} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #cbd5e1', outline: 'none' }}>
                    <option value="">Select Engineer</option>
                    {team.filter(t => t.role === 'site_engineer').map(t => <option key={t.user_id} value={t.user_id}>{t.name}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Start Date</label>
                  <input type="date" required value={convertData.start_date} onChange={(e) => setConvertData({ ...convertData, start_date: e.target.value })} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #cbd5e1', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>End Date</label>
                  <input type="date" required value={convertData.expected_end_date} onChange={(e) => setConvertData({ ...convertData, expected_end_date: e.target.value })} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #cbd5e1', outline: 'none' }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowConvertModal(false)} style={{ padding: '10px 20px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: 'white' }}>Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting ? 'Assigning...' : 'Assign & Launch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="premium-card" style={{ width: '100%', maxWidth: '600px' }}>
            <h3 style={{ marginBottom: '24px', fontSize: '1.4rem' }}>New Customer Enquiry</h3>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Client Name</label>
                  <input type="text" required value={formData.client_name} onChange={(e) => setFormData({ ...formData, client_name: e.target.value })} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #cbd5e1', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Contact Number</label>
                  <input type="text" required value={formData.contact_number} onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #cbd5e1', outline: 'none' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Email Address</label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #cbd5e1', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Client ID (Manual)</label>
                  <input type="text" value={formData.manual_client_id} onChange={(e) => setFormData({ ...formData, manual_client_id: e.target.value })} placeholder="e.g. CL-001" style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #cbd5e1', outline: 'none' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Client Address</label>
                  <textarea rows={2} required value={formData.client_address} onChange={(e) => setFormData({ ...formData, client_address: e.target.value })} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #cbd5e1', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Site Location</label>
                  <textarea rows={2} required value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #cbd5e1', outline: 'none' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Project Type</label>
                  <select value={formData.project_type} onChange={(e) => setFormData({ ...formData, project_type: e.target.value })} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #cbd5e1', outline: 'none' }}>
                    <option value="Furniture projects">Furniture projects</option>
                    <option value="Interior Projects">Interior Projects</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Scope of Project</label>
                  <select value={formData.project_scope} onChange={(e) => setFormData({ ...formData, project_scope: e.target.value })} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #cbd5e1', outline: 'none' }}>
                    <option value="2 BHK">2 BHK</option>
                    <option value="3 BHK">3 BHK</option>
                    <option value="Duplex">Duplex</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {formData.project_scope === 'Other' && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Specify Other Scope</label>
                  <input type="text" required value={formData.custom_scope} onChange={(e) => setFormData({ ...formData, custom_scope: e.target.value })} placeholder="e.g. 4 BHK, Villa, Commercial..." style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #cbd5e1', outline: 'none' }} />
                </div>
              )}



              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowAddModal(false)} style={{ padding: '10px 20px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: 'white' }}>Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {submitting && <Loader2 className="animate-spin" size={16} />}
                  Save Enquiry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="premium-card" style={{ width: '100%', maxWidth: '600px' }}>
            <h3 style={{ marginBottom: '24px', fontSize: '1.4rem' }}>Edit Customer Enquiry</h3>
            <form onSubmit={handleUpdate}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Client Name</label>
                  <input type="text" required value={formData.client_name} onChange={(e) => setFormData({ ...formData, client_name: e.target.value })} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #cbd5e1', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Contact Number</label>
                  <input type="text" required value={formData.contact_number} onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #cbd5e1', outline: 'none' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Email Address</label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #cbd5e1', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Client ID (Manual)</label>
                  <input type="text" value={formData.manual_client_id} onChange={(e) => setFormData({ ...formData, manual_client_id: e.target.value })} placeholder="e.g. CL-001" style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #cbd5e1', outline: 'none' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Client Address</label>
                  <textarea rows={2} required value={formData.client_address} onChange={(e) => setFormData({ ...formData, client_address: e.target.value })} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #cbd5e1', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Site Location</label>
                  <textarea rows={2} required value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #cbd5e1', outline: 'none' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Project Type</label>
                  <select value={formData.project_type} onChange={(e) => setFormData({ ...formData, project_type: e.target.value })} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #cbd5e1', outline: 'none' }}>
                    <option value="Furniture projects">Furniture projects</option>
                    <option value="Interior Projects">Interior Projects</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Scope of Project</label>
                  <select value={formData.project_scope} onChange={(e) => setFormData({ ...formData, project_scope: e.target.value })} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #cbd5e1', outline: 'none' }}>
                    <option value="2 BHK">2 BHK</option>
                    <option value="3 BHK">3 BHK</option>
                    <option value="Duplex">Duplex</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {formData.project_scope === 'Other' && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Specify Other Scope</label>
                  <input type="text" required value={formData.custom_scope} onChange={(e) => setFormData({ ...formData, custom_scope: e.target.value })} placeholder="e.g. 4 BHK, Villa, Commercial..." style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #cbd5e1', outline: 'none' }} />
                </div>
              )}

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Lead Source</label>
                  <select value={formData.lead_source} onChange={(e) => setFormData({ ...formData, lead_source: e.target.value })} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #cbd5e1', outline: 'none' }}>
                    <option value="walk_in">Walk-in</option>
                    <option value="reference">Reference</option>
                    <option value="website">Website</option>
                    <option value="social_media">Social Media</option>
                    <option value="advertisement">Advertisement</option>
                  </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => { setShowEditModal(false); setEditingLead(null); }} style={{ padding: '10px 20px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: 'white' }}>Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {submitting && <Loader2 className="animate-spin" size={16} />}
                  Update Enquiry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Book D1 Modal */}
      {showBookModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '16px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#111827', marginBottom: '20px' }}>
              {selectedBookLead?.d1_assigned_to ? 'Reschedule D1 Slot' : 'Book D1 Slot'}
            </h2>
            <form onSubmit={handleBookD1Submit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#374151', marginBottom: '6px' }}>Select Designer (D1/D2) <span style={{ color: '#ef4444' }}>*</span></label>
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
                      return role === 'd1' || role === 'd2';
                  }).map(u => {
                    const isChecked = (selectedD1User ? selectedD1User.split(',') : []).includes(String(u.user_id));
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
                            const currentIds = selectedD1User ? selectedD1User.split(',') : [];
                            const uidStr = String(u.user_id);
                            let newIds;
                            if (currentIds.includes(uidStr)) {
                              newIds = currentIds.filter(id => id !== uidStr);
                            } else {
                              newIds = [...currentIds, uidStr];
                            }
                            setSelectedD1User(newIds.join(','));
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
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#374151', marginBottom: '6px', fontWeight: 500 }}>Note / Instructions for D1</label>
                <textarea
                  rows={3}
                  value={d1Notes}
                  onChange={(e) => setD1Notes(e.target.value)}
                  placeholder="Add any specific client preferences or meeting notes..."
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', outline: 'none', fontSize: '0.85rem', fontFamily: 'inherit' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" onClick={() => setShowBookModal(false)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #e5e7eb', backgroundColor: 'white', color: '#374151', fontWeight: 500 }}>Cancel</button>
                <button type="submit" disabled={submitting} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', backgroundColor: '#f97316', color: 'white', fontWeight: 500 }}>
                  {submitting ? <Loader2 className="animate-spin" size={20} /> : 'Confirm Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showViewModal && viewingLead && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="premium-card" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '1.4rem', margin: 0 }}>Customer Details</h3>
              <button onClick={() => setShowViewModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '1.5rem', lineHeight: 1 }}>&times;</button>
            </div>
            
            <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid #e5e7eb', marginBottom: '24px' }}>
              <button onClick={() => setActiveTab('details')} style={{ padding: '8px 16px', background: 'none', border: 'none', borderBottom: activeTab === 'details' ? '2px solid #111827' : '2px solid transparent', color: activeTab === 'details' ? '#111827' : '#6b7280', fontWeight: 600, cursor: 'pointer' }}>Details</button>
              <button onClick={() => setActiveTab('notes')} style={{ padding: '8px 16px', background: 'none', border: 'none', borderBottom: activeTab === 'notes' ? '2px solid #111827' : '2px solid transparent', color: activeTab === 'notes' ? '#111827' : '#6b7280', fontWeight: 600, cursor: 'pointer' }}>Notes</button>
              <button onClick={() => setActiveTab('files')} style={{ padding: '8px 16px', background: 'none', border: 'none', borderBottom: activeTab === 'files' ? '2px solid #111827' : '2px solid transparent', color: activeTab === 'files' ? '#111827' : '#6b7280', fontWeight: 600, cursor: 'pointer' }}>Files</button>
              <button onClick={() => setActiveTab('quotes')} style={{ padding: '8px 16px', background: 'none', border: 'none', borderBottom: activeTab === 'quotes' ? '2px solid #111827' : '2px solid transparent', color: activeTab === 'quotes' ? '#111827' : '#6b7280', fontWeight: 600, cursor: 'pointer' }}>Quotes</button>
            </div>
            
            {activeTab === 'details' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div>
                  <p style={{ margin: '0 0 4px 0', fontSize: '0.85rem', color: '#6b7280' }}>Client Name</p>
                  <p style={{ margin: 0, fontWeight: 500 }}>{viewingLead.client_name}</p>
                </div>
                <div>
                  <p style={{ margin: '0 0 4px 0', fontSize: '0.85rem', color: '#6b7280' }}>Contact Number</p>
                  <p style={{ margin: 0, fontWeight: 500 }}>{viewingLead.contact_number}</p>
                </div>
                <div>
                  <p style={{ margin: '0 0 4px 0', fontSize: '0.85rem', color: '#6b7280' }}>Email Address</p>
                  <p style={{ margin: 0, fontWeight: 500 }}>{viewingLead.email || 'N/A'}</p>
                </div>
                <div>
                  <p style={{ margin: '0 0 4px 0', fontSize: '0.85rem', color: '#6b7280' }}>Client ID</p>
                  <p style={{ margin: 0, fontWeight: 500 }}>{viewingLead.manual_client_id || 'N/A'}</p>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <p style={{ margin: '0 0 4px 0', fontSize: '0.85rem', color: '#6b7280' }}>Client Address</p>
                  <p style={{ margin: 0, fontWeight: 500 }}>{viewingLead.client_address}</p>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <p style={{ margin: '0 0 4px 0', fontSize: '0.85rem', color: '#6b7280' }}>Site Location</p>
                  <p style={{ margin: 0, fontWeight: 500 }}>{viewingLead.location}</p>
                </div>
                <div>
                  <p style={{ margin: '0 0 4px 0', fontSize: '0.85rem', color: '#6b7280' }}>Project Scope</p>
                  <p style={{ margin: 0, fontWeight: 500 }}>{viewingLead.project_scope} {viewingLead.project_scope === 'Custom' ? `- ${viewingLead.custom_scope}` : ''}</p>
                </div>
                {viewingLead.estimated_budget && (
                  <div>
                    <p style={{ margin: '0 0 4px 0', fontSize: '0.85rem', color: '#6b7280' }}>Estimated Budget</p>
                    <p style={{ margin: 0, fontWeight: 500 }}>₹ {viewingLead.estimated_budget}</p>
                  </div>
                )}
                {viewingLead.d1_assigned_to && (
                  <div style={{ gridColumn: 'span 2', marginTop: '8px', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: '#111827' }}>Booking Details</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <p style={{ margin: '0 0 4px 0', fontSize: '0.85rem', color: '#6b7280' }}>Assigned D1(s)</p>
                        <p style={{ margin: 0, fontWeight: 500, color: '#0369a1' }}>
                          {viewingLead.d1_assigned_to ? String(viewingLead.d1_assigned_to).split(',').map(id => team.find(t => String(t.user_id) === String(id.trim()))?.name).filter(Boolean).join(', ') : 'None'}
                        </p>
                      </div>
                      <div>
                        <p style={{ margin: '0 0 4px 0', fontSize: '0.85rem', color: '#6b7280' }}>Date & Time</p>
                        <p style={{ margin: 0, fontWeight: 500 }}>{viewingLead.d1_booking_time ? new Date(viewingLead.d1_booking_time).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Pending'}</p>
                      </div>
                      {viewingLead.d1_notes && (
                        <div style={{ gridColumn: 'span 2', marginTop: '8px', padding: '12px', backgroundColor: 'white', borderRadius: '6px', borderLeft: '3px solid #f97316' }}>
                          <p style={{ margin: '0 0 4px 0', fontSize: '0.8rem', color: '#6b7280' }}>Note / Instructions</p>
                          <p style={{ margin: 0, fontSize: '0.9rem', color: '#374151' }}>{viewingLead.d1_notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'notes' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '300px' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <input type="text" value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Add a note..." style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', outline: 'none' }} onKeyDown={e => { if (e.key === 'Enter') handleAddNote(); }} />
                  <button onClick={handleAddNote} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#111827', color: 'white', fontWeight: 500, cursor: 'pointer' }}>Add</button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {notes.length === 0 ? <p style={{ color: '#6b7280', textAlign: 'center', marginTop: '24px' }}>No notes found.</p> : notes.map(note => (
                    <div key={note.id} style={{ padding: '12px 16px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                      <p style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: '#374151' }}>{note.note_text}</p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#9ca3af' }}>
                        <span>{note.user_name || 'System'}</span>
                        <span>{new Date(note.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'files' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '350px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {currentFolder && (
                      <button onClick={() => setCurrentFolder('')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#6b7280' }}>
                        <ChevronLeft size={18} /> Back
                      </button>
                    )}
                    <h4 style={{ margin: 0, fontSize: '1rem', color: '#111827' }}>
                      {currentFolder ? currentFolder : 'Root Directory'}
                    </h4>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input 
                      type="text" 
                      placeholder="New folder name" 
                      value={newFolderName}
                      onChange={e => setNewFolderName(e.target.value)}
                      style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.85rem' }}
                    />
                    <button 
                      onClick={handleCreateFolder}
                      disabled={creatingFolder || !newFolderName.trim()}
                      style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', backgroundColor: '#e5e7eb', color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
                    >
                      <PlusCircle size={14} /> Create
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', border: '2px dashed #d1d5db', borderRadius: '8px', backgroundColor: '#f9fafb' }}>
                  <UploadCloud color="#6b7280" />
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: '0 0 4px 0', fontWeight: 500, color: '#374151', fontSize: '0.95rem' }}>Upload Document {currentFolder && `to ${currentFolder}`}</p>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#6b7280' }}>Select any file to upload</p>
                  </div>
                  <label style={{ cursor: 'pointer' }}>
                    <input type="file" accept="*/*" style={{ display: 'none' }} onChange={handleFileUpload} />
                    <span style={{ padding: '8px 16px', backgroundColor: '#111827', color: 'white', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 500, display: 'inline-block' }}>
                      {uploading ? 'Uploading...' : 'Browse'}
                    </span>
                  </label>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px' }}>
                  {files.length === 0 ? <p style={{ color: '#6b7280', textAlign: 'center', marginTop: '24px' }}>No files or folders yet.</p> : files.map(file => (
                    <div key={file.name} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderBottom: '1px solid #f3f4f6', cursor: file.type === 'folder' ? 'pointer' : 'default', transition: 'background-color 0.2s' }} onClick={() => { if (file.type === 'folder') setCurrentFolder(file.name); }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                      {file.type === 'folder' ? <Folder size={24} color="#f59e0b" fill="#fef3c7" /> : <FileText size={24} color="#6366f1" />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {file.type === 'folder' ? (
                          <span style={{ display: 'block', margin: '0 0 2px 0', fontWeight: 500, color: '#111827', fontSize: '0.9rem' }}>{file.name}</span>
                        ) : (
                          <a href={file.url} target="_blank" rel="noreferrer" style={{ display: 'block', margin: '0 0 2px 0', fontWeight: 500, color: '#111827', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: 'none' }}>{file.name}</a>
                        )}
                        {file.type === 'file' && <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>{(file.size / 1024).toFixed(2)} KB • {new Date(file.date).toLocaleDateString()}</p>}
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteFile(file.name); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', color: '#ef4444', borderRadius: '4px' }}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'quotes' && (
              <CustomerQuotesTab viewingLead={viewingLead} user={user} />
            )}
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
              <button onClick={() => setShowViewModal(false)} className="btn-primary">Close</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
