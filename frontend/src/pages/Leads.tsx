import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useAuth } from '../hooks/useAuth';
import { DashboardFilterBar } from '../components/DashboardFilterBar';
import type { StatementPeriodType, ProjectTypeFilter } from '../components/DashboardFilterBar';
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
  RotateCcw,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Calendar,
  CalendarCheck,
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
  Share2,
  Play,
  CheckCircle,
  PenTool
} from 'lucide-react';
import { AnalogTimePicker } from '../components/AnalogTimePicker';
import { ClientSignatureModal } from '../components/ClientSignatureModal';

interface Lead {
  lead_id: string;
  client_name: string;
  contact_number: string;
  email: string;
  location: string;
  project_type: string;
  estimated_budget: string;
  status: string;
  d1_status?: string;
  lead_source: string;
  manual_client_id?: string;
  project_scope?: string;
  custom_scope?: string;
  client_address?: string;
  created_at?: string;
  d1_assigned_to?: any;
  d1_booking_time?: string;
  d1_notes?: string;
  project_id?: any;
  is_converted?: boolean;
  has_project?: boolean;
  converted_at?: string;
  booking_time?: string;
  project_code?: string;
  advance_paid?: any;
  advance_received?: any;
  total_budget?: any;
  client_signature?: string;
  project_name?: string;
  meeting_completed_at?: string;
  is_meeting_completed?: any;
  [key: string]: any;
}

const getFileUrl = (rawUrl?: string) => {
  if (!rawUrl) return '#';
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) return rawUrl;
  const backendRoot = API_BASE_URL.replace(/\/api\/?$/, '');
  let cleanPath = rawUrl;
  if (cleanPath.startsWith('/demoark/')) {
    cleanPath = cleanPath.replace('/demoark/', '/');
  }
  if (!cleanPath.startsWith('/')) {
    cleanPath = '/' + cleanPath;
  }
  return backendRoot + cleanPath;
};

const CustomerQuotesTab: React.FC<{ viewingLead: any; user: any }> = ({ viewingLead, user }) => {
  const [history, setHistory] = useState<any[]>([]);
  const [draftQuote, setDraftQuote] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const getBaseId = (val?: string | number) => {
    if (val === undefined || val === null) return '';
    return String(val).replace(/^(lead_|lead-|p-|l-|q-|ql-|PR-|PR_)/i, '').trim().toLowerCase();
  };

  const leadNumericId = String(viewingLead?.lead_id || viewingLead?.id || '').trim();
  const leadCode = String(viewingLead?.manual_client_id || viewingLead?.project_code || '').trim();
  const clientName = String(viewingLead?.client_name || viewingLead?.name || '').trim();
  const leadProjectId = leadNumericId ? `lead_${leadNumericId}` : (leadCode ? `lead_${leadCode}` : 'lead_1');

  useEffect(() => {
    fetchQuoteHistory();
  }, [viewingLead]);

  const fetchQuoteHistory = async () => {
    setLoading(true);
    try {
      const queryIds = Array.from(new Set([
        leadNumericId,
        leadCode,
        leadProjectId,
        leadCode ? `lead_${leadCode}` : '',
        leadNumericId ? `PR-${leadNumericId}` : ''
      ].filter(Boolean)));

      const [historyReqs, fileReqs] = [
        queryIds.map(qid =>
          axios.get(`${API_BASE_URL}/quotes/history?project_id=${encodeURIComponent(qid)}`).catch(() => ({ data: { data: [] } }))
        ),
        Array.from(new Set([leadNumericId, leadCode].filter(Boolean))).flatMap(fid => [
          axios.get(`${API_BASE_URL}/leads/files?lead_id=${encodeURIComponent(fid)}`).catch(() => ({ data: { data: [] } })),
          axios.get(`${API_BASE_URL}/leads/files?lead_id=${encodeURIComponent(fid)}&folder=Quotations`).catch(() => ({ data: { data: [] } }))
        ])
      ];

      const [historyResponses, fileResponses] = await Promise.all([
        Promise.all(historyReqs),
        Promise.all(fileReqs)
      ]);

      const allHistoryItems: any[] = [];
      historyResponses.forEach((res: any) => {
        const list = res.data?.data || (Array.isArray(res.data) ? res.data : []);
        if (Array.isArray(list)) allHistoryItems.push(...list);
      });

      const rawFiles: any[] = [];
      fileResponses.forEach((res: any) => {
        const list = res.data?.data || (Array.isArray(res.data) ? res.data : []);
        if (Array.isArray(list)) rawFiles.push(...list);
      });

      const uploadedQuotePdfs = rawFiles
        .filter((f: any) => {
          if (!f || f.type === 'folder') return false;
          const fileName = String(f.name || f.filename || '').toLowerCase();
          const folder = String(f.folder || '').toLowerCase();
          return fileName.endsWith('.pdf') || folder.includes('quote') || fileName.includes('quote');
        })
        .map((f: any) => ({
          quote_id: f.id || f.name || f.url || `file_${Math.random()}`,
          version: 'Uploaded PDF',
          quote_number: 'Uploaded Document',
          title: f.name ? f.name.replace(/^\d+_/, '') : 'Uploaded Quotation PDF',
          client_name: viewingLead?.client_name,
          created_at: f.date || f.created_at || new Date().toISOString(),
          file_path: f.url || f.path,
          url: f.url || f.path,
          total_amount: f.size ? `${(f.size / 1024).toFixed(1)} KB` : 'PDF',
          is_uploaded: true
        }));

      // Combine real quote versions and uploaded PDFs (exclude synthetic allQuotes mocks)
      const combined = [...allHistoryItems, ...uploadedQuotePdfs];

      // Deduplicate by quote_id or url
      const unique = Array.from(new Map(combined.map(item => [String(item.quote_id || item.url), item])).values());
      unique.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

      // Only official versioned quotes (v >= 1, save_type !== 'draft') and uploaded PDFs belong in Quotation PDF Documents
      const pdfDocs = unique.filter((item: any) => {
        const qid = String(item.quote_id || '');
        if (qid.startsWith('lead-') || qid.startsWith('p-') || item.is_placeholder || item.is_synthetic || item.is_real_quote === false) return false;
        if (item.is_uploaded) return true;
        const verNum = Number(item.version || 0);
        const isDraft = item.save_type === 'draft' || verNum === 0 || String(item.quote_number || '').startsWith('DRAFT');
        return !isDraft && verNum >= 1;
      });

      // Find any active unfinalized draft for this lead
      const draft = unique.find((item: any) => {
        if (item.is_uploaded) return false;
        const qid = String(item.quote_id || '');
        if (qid.startsWith('lead-') || qid.startsWith('p-') || item.is_placeholder || item.is_synthetic || item.is_real_quote === false) return false;
        const verNum = Number(item.version || 0);
        return item.save_type === 'draft' || verNum === 0 || String(item.quote_number || '').startsWith('DRAFT');
      }) || null;

      setHistory(pdfDocs);
      setDraftQuote(draft);
    } catch (err) {
      console.error('Failed to fetch lead quotes history', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = (h?: any) => {
    if (h?.url || h?.file_path) {
      const rawUrl = h.url || h.file_path;
      const targetUrl = getFileUrl(rawUrl);
      window.open(targetUrl, '_blank');
      return;
    }

    if (h?.quote_id && !String(h.quote_id).startsWith('file_')) {
      window.open(`/print-quote/${h.quote_id}`, '_blank');
      return;
    }

    alert('PDF document preview is not available for this record.');
  };

  const [uploadingQuoteFile, setUploadingQuoteFile] = useState(false);

  const handleUploadQuotePdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    setUploadingQuoteFile(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('lead_id', String(leadNumericId || leadCode || ''));
    formData.append('folder', 'Quotations');

    try {
      const response = await axios.post(`${API_BASE_URL}/leads/upload`, formData);
      if (response.data.success) {
        alert('Quotation PDF uploaded successfully!');
        fetchQuoteHistory();
      } else {
        alert(response.data.message || 'Failed to upload quotation PDF');
      }
    } catch (err: any) {
      alert('Upload error: ' + (err.response?.data?.message || err.message));
    } finally {
      setUploadingQuoteFile(false);
      e.target.value = '';
    }
  };

  const handleDeleteQuotePdf = async (h: any) => {
    if (!window.confirm(`Are you sure you want to delete "${h.title || h.quote_number || 'this Quotation'}"?`)) return;

    // 1. Instantly filter out from local state
    setHistory(prev => prev.filter(item => {
      const matchId = (item.quote_id && h.quote_id && String(item.quote_id) === String(h.quote_id));
      const matchUrl = (item.url && h.url && String(item.url) === String(h.url));
      const matchTitle = (item.title && h.title && String(item.title) === String(h.title));
      return !(matchId || matchUrl || matchTitle);
    }));

    // 2. Perform backend deletions
    try {
      const targetLeadId = leadNumericId || leadCode;
      const rawName = String(h.title || h.name || h.quote_id || '');
      const rawUrl = String(h.url || h.file_path || '');

      if (h.is_uploaded || rawUrl) {
        await axios.delete(`${API_BASE_URL}/leads/files?lead_id=${encodeURIComponent(targetLeadId)}&filename=${encodeURIComponent(rawName)}&folder=Quotations`).catch(() => {});
        await axios.delete(`${API_BASE_URL}/leads/files?lead_id=${encodeURIComponent(targetLeadId)}&filename=${encodeURIComponent(rawName)}`).catch(() => {});
        if (rawUrl) {
          const basename = rawUrl.split('/').pop() || '';
          if (basename && basename !== rawName) {
            await axios.delete(`${API_BASE_URL}/leads/files?lead_id=${encodeURIComponent(targetLeadId)}&filename=${encodeURIComponent(basename)}&folder=Quotations`).catch(() => {});
            await axios.delete(`${API_BASE_URL}/leads/files?lead_id=${encodeURIComponent(targetLeadId)}&filename=${encodeURIComponent(basename)}`).catch(() => {});
          }
        }
      }
      if (h.quote_id && !h.is_uploaded && !String(h.quote_id).startsWith('file_')) {
        await axios.delete(`${API_BASE_URL}/quotes/${h.quote_id}`).catch(() => {});
      }
      fetchQuoteHistory();
    } catch (err) {
      console.error('Failed to delete quotation PDF backend record', err);
    }
  };

  const handleDiscardDraft = async (draft: any) => {
    if (!window.confirm(`Are you sure you want to discard this unfinalized draft quotation?`)) return;
    setDraftQuote(null);
    try {
      if (draft?.quote_id && !String(draft.quote_id).startsWith('p-') && !String(draft.quote_id).startsWith('lead-')) {
        await axios.delete(`${API_BASE_URL}/quotes/${draft.quote_id}`).catch(() => {});
      }
      fetchQuoteHistory();
    } catch (err) {
      console.error('Failed to discard draft quote', err);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
        <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px auto' }} />
        <p style={{ margin: 0, fontSize: '0.85rem' }}>Loading quotation PDF files...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Top Bar with Upload File Option */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
            Quotation PDF Documents ({history.length})
          </h4>
          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
            Official versions and uploaded PDFs for {viewingLead.client_name || 'Customer'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* File Upload Option */}
          <label style={{ cursor: 'pointer', margin: 0 }}>
            <input
              type="file"
              accept="application/pdf,.pdf,image/*"
              style={{ display: 'none' }}
              onChange={handleUploadQuotePdf}
            />
            <span style={{
              padding: '8px 14px',
              backgroundColor: '#111827',
              color: '#ffffff',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
            }}>
              {uploadingQuoteFile ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={15} />}
              {uploadingQuoteFile ? 'Uploading PDF...' : 'Upload Quote PDF'}
            </span>
          </label>
        </div>
      </div>

      {/* Unfinalized Draft In Progress Banner (if any) */}
      {draftQuote && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          backgroundColor: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: '10px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              padding: '4px 8px',
              backgroundColor: '#fef3c7',
              color: '#b45309',
              borderRadius: '6px',
              fontWeight: 800,
              fontSize: '0.72rem',
              letterSpacing: '0.05em'
            }}>
              DRAFT
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.86rem', color: '#92400e' }}>
                Unfinalized Draft Quotation in Progress
              </div>
              <div style={{ fontSize: '0.76rem', color: '#b45309' }}>
                {draftQuote.subtitle || viewingLead.client_name || 'Draft Quote'} • ₹{Number(draftQuote.total_amount || 0).toLocaleString('en-IN')}
                {draftQuote.updated_at || draftQuote.created_at ? ` • ${new Date(draftQuote.updated_at || draftQuote.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => handleDiscardDraft(draftQuote)}
              style={{
                padding: '6px 12px',
                backgroundColor: '#ffffff',
                color: '#ef4444',
                border: '1px solid #fca5a5',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Discard Draft
            </button>
          </div>
        </div>
      )}

      {history.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '36px 20px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
          <FileText size={40} color="#94a3b8" style={{ marginBottom: '10px' }} />
          <h4 style={{ margin: '0 0 6px 0', color: '#1e293b', fontWeight: 700, fontSize: '0.95rem' }}>No Quotation PDF Uploaded Yet</h4>
          <p style={{ margin: '0 0 16px 0', fontSize: '0.82rem', color: '#64748b' }}>
            Upload a quotation PDF for this customer using the button below.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <label style={{ cursor: 'pointer', margin: 0 }}>
              <input
                type="file"
                accept="application/pdf,.pdf,image/*"
                style={{ display: 'none' }}
                onChange={handleUploadQuotePdf}
              />
              <span style={{
                padding: '8px 18px',
                backgroundColor: '#111827',
                color: '#ffffff',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
              }}>
                {uploadingQuoteFile ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={16} />}
                {uploadingQuoteFile ? 'Uploading PDF...' : 'Upload Quote PDF'}
              </span>
            </label>
          </div>
        </div>
      ) : (

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '350px', overflowY: 'auto' }}>
          {history.map((h: any) => {
            const badgeText = h.is_uploaded ? 'PDF' : `v${h.version || 1}`;
            const badgeBg = h.is_uploaded ? '#fee2e2' : '#dcfce7';
            const badgeColor = h.is_uploaded ? '#dc2626' : '#15803d';

            const itemTitle = h.is_uploaded
              ? (h.title || 'Uploaded Quotation PDF')
              : (h.label || `Quotation v${h.version || 1} - ${viewingLead.client_name || 'Customer'}`);

            return (
              <div
                key={String(h.quote_id || h.url)}
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
                    width: '44px',
                    height: '44px',
                    borderRadius: '8px',
                    backgroundColor: badgeBg,
                    color: badgeColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '0.75rem',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
                  }}>
                    {badgeText}
                  </div>
                  <div>
                    <h5 style={{ margin: '0 0 2px 0', fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}>
                      {itemTitle}
                    </h5>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#64748b' }}>
                      <span>{h.quote_number || (h.quote_id ? `#${h.quote_id}` : 'Quotation')}</span>
                      <span>•</span>
                      <span style={{ fontWeight: 700, color: '#059669' }}>
                        {typeof h.total_amount === 'string' && (h.total_amount.includes('KB') || h.total_amount === 'PDF')
                          ? h.total_amount
                          : `₹${Number(h.total_amount || 0).toLocaleString('en-IN')}`}
                      </span>
                      <span>•</span>
                      <span>{new Date(h.created_at || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={() => handleDownloadPdf(h)}
                    style={{
                      padding: '8px 14px',
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
                      boxShadow: '0 2px 6px rgba(5,150,105,0.2)'
                    }}
                    title="Open official Quotation PDF in a new window"
                  >
                    <Download size={14} /> View PDF
                  </button>

                  <button
                    onClick={() => handleDeleteQuotePdf(h)}
                    style={{
                      width: '32px',
                      height: '32px',
                      backgroundColor: '#fef2f2',
                      color: '#ef4444',
                      border: '1.5px solid #fecaca',
                      borderRadius: '6px',
                      fontSize: '1.1rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: 1,
                      transition: 'all 0.15s ease'
                    }}
                    title="Delete this quotation"
                  >
                    &times;
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const Leads: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const uRole = String(user?.role || '').toLowerCase();
  const isAdminOrPM = ['admin', 'administrator', 'superadmin', 'management', 'owner', 'project_manager', 'pm', 'project_head'].includes(uRole) || uRole.includes('admin') || Boolean(user?.is_admin);
  const isAdminRole = isAdminOrPM;
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [viewingLead, setViewingLead] = useState<Lead | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showSigModal, setShowSigModal] = useState(false);
  const [sigLead, setSigLead] = useState<Lead | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statementPeriod, setStatementPeriod] = useState<StatementPeriodType>('today');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [projectType, setProjectType] = useState<ProjectTypeFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterDateQuick, setFilterDateQuick] = useState('all');
  const [statusFilter, setStatusFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [filterAssignedTo, setFilterAssignedTo] = useState('');
  const [filterServices, setFilterServices] = useState<string[]>([]);
  const [filterScope, setFilterScope] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const formatLocalDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('');
    setLocationFilter('');
    setFilterAssignedTo('');
    setFilterServices([]);
    setFilterScope([]);
    setDateFrom('');
    setDateTo('');
    setFilterDateQuick('all');
    setStatementPeriod('today');
    setProjectType('all');
  };
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
  const [bookStatus, setBookStatus] = useState('enquiry');
  const [d1Notes, setD1Notes] = useState('');
  const [selectedD1User, setSelectedD1User] = useState('');
  const [selectedAssociateUser, setSelectedAssociateUser] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [team, setTeam] = useState<any[]>([]);

  const [customLeadSources, setCustomLeadSources] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('custom_lead_sources');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isAddingCustomSource, setIsAddingCustomSource] = useState(false);
  const [newCustomSourceName, setNewCustomSourceName] = useState('');
  const [isAddDropdownOpen, setIsAddDropdownOpen] = useState(false);
  const [isEditDropdownOpen, setIsEditDropdownOpen] = useState(false);
  const [deletedSources, setDeletedSources] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('deleted_lead_sources');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const formatMeetingNoticeText = (dateTimeStr: string, dateOnlyStr: string) => {
    if (!dateTimeStr) return { timeText: dateOnlyStr, dateText: dateOnlyStr };
    const parts = dateTimeStr.trim().split(' ');
    const dPart = parts[0] || dateOnlyStr;
    const tPart = parts[1] || '';

    let dText = dPart;
    const dObj = new Date(dPart + 'T00:00:00');
    if (!isNaN(dObj.getTime())) {
      dText = dObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    let tText = '';
    if (tPart) {
      const timeParts = tPart.split(':');
      const hours = parseInt(timeParts[0], 10);
      const minutes = timeParts[1] || '00';
      if (!isNaN(hours)) {
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const h12 = hours % 12 || 12;
        tText = `${String(h12).padStart(2, '0')}:${minutes} ${ampm}`;
      }
    }

    const fullTimeText = tText ? `${dText} at ${tText}` : dText;
    return { timeText: fullTimeText, dateText: dText };
  };

  const isMeetingTimeCrossed = (bookingTimeStr?: string) => {
    if (!bookingTimeStr) return false;
    const cleanStr = bookingTimeStr.replace(' ', 'T');
    const bookingDate = new Date(cleanStr);
    if (isNaN(bookingDate.getTime())) {
      const fallback = new Date(bookingTimeStr.replace(/-/g, '/'));
      if (isNaN(fallback.getTime())) return false;
      return fallback.getTime() < Date.now();
    }
    return bookingDate.getTime() < Date.now();
  };

  const getLeadLifecycleStage = (lead: Lead) => {
    const s = String(lead.status || '').toLowerCase().trim();
    const d1s = String(lead.d1_status || '').toLowerCase().trim();

    // 1. Manual Deal Lost or Cancelled
    if (s === 'lost' || s === 'dead' || s === 'dropped' || d1s === 'lost') {
      return { stage: 'lost', label: 'Deal Lost', bg: '#fef2f2', text: '#dc2626', border: '#fecaca' };
    }
    if (s === 'cancelled' || d1s === 'cancelled') {
      return { stage: 'cancelled', label: 'Cancelled', bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' };
    }

    // 2. Converted (Once 10% payment collected / Project created)
    const isConverted = s === 'won' || s === 'converted' || d1s === 'won' || d1s === 'converted' ||
      Boolean((lead as any).is_converted) || Boolean(lead.project_id);
    if (isConverted) {
      return { stage: 'converted', label: 'Converted', bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' };
    }

    // 3. Quote Accepted (Once quotes accepted)
    if (s === 'proposal_accepted' || d1s === 'proposal_accepted' || s === 'quotation_accepted' || s === 'quote_accepted') {
      return { stage: 'proposal_accepted', label: 'Quote Accepted', bg: '#ecfdf5', text: '#059669', border: '#a7f3d0' };
    }

    // 4. Proposal Sent (Once quote sent through mail)
    if (s === 'proposal_sent' || d1s === 'proposal_sent') {
      return { stage: 'proposal_sent', label: 'Proposal Sent', bg: '#f5f3ff', text: '#7c3aed', border: '#ddd6fe' };
    }

    // 5. Meeting Done (Once meeting ended)
    const isMeetingDone = s === 'meeting_completed' || d1s === 'meeting_completed' || s === 'completed' || d1s === 'completed';
    if (isMeetingDone) {
      return { stage: 'meeting_completed', label: 'Meeting Done', bg: '#ecfdf5', text: '#16a34a', border: '#bbf7d0' };
    }

    // 6. In Meeting (Meeting currently started/active)
    if (s === 'in_meeting' || d1s === 'in_meeting') {
      return { stage: 'in_meeting', label: 'In Meeting', bg: '#fef3c7', text: '#d97706', border: '#fde68a' };
    }

    // 7 & 8. Booked: Once booked -> Meeting Scheduled; Once scheduled time crossed -> Pending
    const hasBooking = Boolean(lead.d1_booking_time || (lead.d1_assigned_to && (s === 'scheduled' || d1s === 'booked' || d1s === 'scheduled')));
    if (hasBooking) {
      if (lead.d1_booking_time && isMeetingTimeCrossed(lead.d1_booking_time)) {
        return { stage: 'pending', label: 'Pending', bg: '#fff7ed', text: '#ea580c', border: '#fed7aa' };
      }
      return { stage: 'scheduled', label: 'Meeting Scheduled', bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' };
    }

    // Pending if explicitly marked pending
    if (s === 'pending' || d1s === 'pending') {
      return { stage: 'pending', label: 'Pending', bg: '#fff7ed', text: '#ea580c', border: '#fed7aa' };
    }

    // 9. Initial: New Lead
    return { stage: 'enquiry', label: 'New Lead', bg: '#f8fafc', text: '#475569', border: '#cbd5e1' };
  };

  const getStatusBadgeStyle = (status: string) => {
    const s = String(status || '').toLowerCase();
    if (s === 'proposal_sent') {
      return { bg: '#f5f3ff', text: '#7c3aed', border: '#ddd6fe' };
    }
    if (s === 'won' || s === 'converted') {
      return { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0' };
    }
    if (s === 'proposal_accepted' || s === 'quotation_accepted') {
      return { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0' };
    }
    if (s === 'lost' || s === 'dead' || s === 'dropped' || s === 'cancelled') {
      return { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' };
    }
    if (s === 'meeting_completed' || s === 'completed') {
      return { bg: '#ecfdf5', text: '#16a34a', border: '#bbf7d0' };
    }
    if (s === 'pending' || s === 'in_meeting' || s === 'booked' || s === 'transferred' || s === 'rescheduled') {
      return { bg: '#fff7ed', text: '#ea580c', border: '#fed7aa' };
    }
    if (s === 'scheduled') {
      return { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' };
    }
    return { bg: '#f8fafc', text: '#475569', border: '#cbd5e1' };
  };

  const formatLeadSourceLabel = (val: string) => {
    if (!val) return '';
    const defaults: { [key: string]: string } = {
      'walk_in': 'Walk-in',
      'reference': 'Reference',
      'website': 'Website',
      'social_media': 'Social Media',
      'advertisement': 'Advertisement'
    };
    if (defaults[val]) return defaults[val];
    return val
      .split(/[_-]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const handleSaveCustomSourceInline = () => {
    if (newCustomSourceName && newCustomSourceName.trim()) {
      const cleanVal = newCustomSourceName.trim();
      const formattedValue = cleanVal.toLowerCase().replace(/\s+/g, '_');

      const defaultVals = ['walk_in', 'reference', 'website', 'social_media', 'advertisement'];
      if (defaultVals.includes(formattedValue) || customLeadSources.includes(formattedValue)) {
        alert(`Lead source "${cleanVal}" already exists.`);
        setFormData(prev => ({ ...prev, lead_source: formattedValue }));
        setIsAddingCustomSource(false);
        setNewCustomSourceName('');
        return;
      }

      const updatedSources = [...customLeadSources, formattedValue];
      setCustomLeadSources(updatedSources);
      try {
        localStorage.setItem('custom_lead_sources', JSON.stringify(updatedSources));
      } catch (e) {
        console.error(e);
      }

      setFormData(prev => ({ ...prev, lead_source: formattedValue }));
      setIsAddingCustomSource(false);
      setNewCustomSourceName('');
    }
  };

  const handleRemoveSourceAny = (sourceToRemove: string) => {
    const updatedDeleted = [...deletedSources, sourceToRemove];
    setDeletedSources(updatedDeleted);
    try {
      localStorage.setItem('deleted_lead_sources', JSON.stringify(updatedDeleted));
    } catch (e) {
      console.error(e);
    }
    
    if (customLeadSources.includes(sourceToRemove)) {
      const updatedCustom = customLeadSources.filter(src => src !== sourceToRemove);
      setCustomLeadSources(updatedCustom);
      try {
        localStorage.setItem('custom_lead_sources', JSON.stringify(updatedCustom));
      } catch (e) {
        console.error(e);
      }
    }
    
    const defaults = ['walk_in', 'reference', 'website', 'social_media', 'advertisement'];
    const finalAvailable = [
      ...defaults.filter(d => !updatedDeleted.includes(d)),
      ...customLeadSources.filter(c => !updatedDeleted.includes(c))
    ];
    setFormData(prev => ({ ...prev, lead_source: finalAvailable[0] || '' }));
  };

  useEffect(() => {
    if (leads.length > 0) {
      const defaultVals = ['walk_in', 'reference', 'website', 'social_media', 'advertisement'];
      const extracted = leads
        .map(l => l.lead_source)
        .filter((src): src is string => typeof src === 'string' && src.trim() !== '' && !defaultVals.includes(src) && !deletedSources.includes(src));

      if (extracted.length > 0) {
        setCustomLeadSources(prev => {
          const merged = Array.from(new Set([...prev, ...extracted]));
          try {
            localStorage.setItem('custom_lead_sources', JSON.stringify(merged));
          } catch (e) {
            console.error(e);
          }
          return merged;
        });
      }
    }
  }, [leads, deletedSources]);

  const handleCreateProjectFromLead = (lead: Lead) => {
    handleConvertClick(lead);
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
    created_by: user?.user_id || '',
    status: 'enquiry'
  });
  const [convertData, setConvertData] = useState({
    project_code: '',
    project_name: '',
    project_head_id: '',
    site_engineer_id: '',
    total_budget: '',
    advance_paid: '',
    start_date: new Date().toISOString().split('T')[0],
    expected_end_date: new Date(new Date().setMonth(new Date().getMonth() + 4)).toISOString().split('T')[0]
  });
  const [activeDropdown, setActiveDropdown] = useState<string | number | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const [loadingMeetingIds, setLoadingMeetingIds] = useState<{ [id: string]: boolean }>({});

  useEffect(() => {
    const tickInterval = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(tickInterval);
  }, []);

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

  const getTodayDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getTomorrowDateString = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const isSlotPastTime = (slotValue: string, selectedDate: string) => {
    if (!selectedDate) return false;
    const todayStr = getTodayDateString();
    if (selectedDate < todayStr) return true;
    if (selectedDate > todayStr) return false;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [hourStr, minStr] = slotValue.split(':');
    const slotStartMinutes = parseInt(hourStr, 10) * 60 + (parseInt(minStr, 10) || 0);
    const slotEndMinutes = slotStartMinutes + 120; // Slot lasts 2 hours (120 mins)

    // Slot is only passed AFTER its end time has expired
    return slotEndMinutes <= currentMinutes;
  };

  const FIXED_SLOTS = [
    { id: '10:00', label: '10:00 AM - 12:00 PM', value: '10:00' },
    { id: '12:00', label: '12:00 PM - 02:00 PM', value: '12:00' },
    { id: '14:00', label: '02:00 PM - 04:00 PM', value: '14:00' },
    { id: '16:00', label: '04:00 PM - 06:00 PM', value: '16:00' },
    { id: '18:00', label: '06:00 PM - 08:00 PM', value: '18:00' }
  ];

  const getSlotBookingInfo = (slotValue: string, d1UserOverride?: string, dateOverride?: string) => {
    const activeD1 = d1UserOverride !== undefined ? d1UserOverride : selectedD1User;
    const activeDate = dateOverride !== undefined ? dateOverride : bookDate;
    if (!activeD1 || !activeDate) return { isBooked: false, isCurrentLeadBooking: false, bookedClientName: '' };

    for (const lead of leads) {
      if (lead.d1_status === 'cancelled' || lead.status === 'cancelled') continue;

      const leadD1Array = String(lead.d1_assigned_to || '').split(',').map(s => s.trim());
      const isDesignerMatch = leadD1Array.includes(String(activeD1));

      if (isDesignerMatch && lead.d1_booking_time) {
        const bookingStr = String(lead.d1_booking_time);
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
        if (datePart === activeDate && timePart === slotValue) {
          const isCurrent = Boolean(selectedBookLead && String(lead.lead_id) === String(selectedBookLead.lead_id));
          return {
            isBooked: true,
            isCurrentLeadBooking: isCurrent,
            bookedClientName: lead.client_name || (lead as any).name || 'Another Client'
          };
        }
      }
    }
    return { isBooked: false, isCurrentLeadBooking: false, bookedClientName: '' };
  };

  const isSlotBooked = (slotValue: string, d1UserOverride?: string, dateOverride?: string) => {
    const info = getSlotBookingInfo(slotValue, d1UserOverride, dateOverride);
    return info.isBooked && !info.isCurrentLeadBooking;
  };

  const getFirstAvailableSlot = (targetDate: string, d1UserOverride?: string) => {
    const available = FIXED_SLOTS.find(slot => {
      const isPast = isSlotPastTime(slot.value, targetDate);
      const isBooked = isSlotBooked(slot.value, d1UserOverride, targetDate);
      return !isPast && !isBooked;
    });
    return available ? available.value : '';
  };

  useEffect(() => {
    if (showBookModal && selectedBookLead) {
      const assignedD1 = selectedBookLead.d1_assigned_to ? String(selectedBookLead.d1_assigned_to) : '';
      setSelectedD1User(assignedD1);
      setSelectedAssociateUser((selectedBookLead as any).associate_designer_assigned_id ? String((selectedBookLead as any).associate_designer_assigned_id) : '');
      setD1Notes(selectedBookLead.d1_notes || '');
      const todayStr = getTodayDateString();
      let initDate = todayStr;
      let initTime = '';

      const isCompletedLead = selectedBookLead.status === 'meeting_completed';
      const hasSavedBookingTime = Boolean(selectedBookLead.d1_booking_time);

      if (selectedBookLead.d1_booking_time) {
        const parts = selectedBookLead.d1_booking_time.split(' ');
        const existingDate = parts[0] || '';
        if (existingDate && (existingDate >= todayStr || isCompletedLead)) {
          initDate = existingDate;
        }
        if (parts[1]) {
          const timeParts = parts[1].split(':');
          initTime = `${timeParts[0]}:${timeParts[1]}`;
        }
      }

      if (!hasSavedBookingTime && !isCompletedLead) {
        const firstValid = getFirstAvailableSlot(initDate, assignedD1);
        if (!firstValid && initDate === todayStr) {
          // Automatically switch to tomorrow if all today's slots passed
          initDate = getTomorrowDateString();
          initTime = getFirstAvailableSlot(initDate, assignedD1) || '10:00';
        } else if (!initTime || isSlotPastTime(initTime, initDate) || isSlotBooked(initTime, assignedD1, initDate)) {
          initTime = firstValid;
        }
      }

      setBookDate(initDate);
      setBookTime(initTime || (initDate > todayStr ? '10:00' : ''));
      setBookStatus(selectedBookLead.d1_status || selectedBookLead.status || 'booked');
    }
  }, [showBookModal, selectedBookLead]);

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

  const getFileUrl = (rawUrl?: string) => {
    if (!rawUrl) return '#';
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) return rawUrl;
    const backendRoot = API_BASE_URL.replace(/\/api\/?$/, '');
    let cleanPath = rawUrl;
    if (cleanPath.startsWith('/demoark/')) {
      cleanPath = cleanPath.replace('/demoark/', '/');
    }
    if (!cleanPath.startsWith('/')) {
      cleanPath = '/' + cleanPath;
    }
    return backendRoot + cleanPath;
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

  const leadPipelineOrder = ['enquiry', 'scheduled', 'pending', 'meeting_completed', 'proposal_sent', 'proposal_accepted', 'converted', 'cancelled', 'lost'];

  const handleStatusUpdate = async (lead_id: string, newStatus: string) => {
    const currentLead = leads.find(l => l.lead_id === lead_id);
    const isAdmin = ['admin', 'administrator', 'superadmin', 'management', 'owner'].includes(String(user?.role || '').toLowerCase()) || String(user?.role || '').toLowerCase().includes('admin');
    if (currentLead) {
      const currentIdx = leadPipelineOrder.indexOf(currentLead.status || 'enquiry');
      const newIdx = leadPipelineOrder.indexOf(newStatus);
      if (!isAdmin && currentIdx !== -1 && newIdx !== -1 && newIdx < currentIdx && currentLead.status !== 'lost' && currentLead.status !== 'cancelled') {
        return; // Disallow reverting to previous status for non-admins
      }
    }

    if (newStatus === 'cancelled') {
      const isAlreadyConverted = currentLead && (currentLead.status === 'won' || currentLead.status === 'converted' || (currentLead as any).is_converted);
      const confirmMsg = isAlreadyConverted
        ? `⚠️ CANCEL BOOKING & CONVERSION\n\nClient: ${currentLead?.client_name || 'Client'}\n\nAre you sure you want to cancel this booking and converted project?\nThis will mark the lead as Cancelled and remove it from active projects.`
        : `Are you sure you want to mark this lead as Cancelled?`;
      if (!window.confirm(confirmMsg)) {
        return;
      }
    }

    if (newStatus === 'won' || newStatus === 'converted') {
      alert('⚠️ Manual Lead Conversion is Disabled.\n\nLeads are automatically converted to active projects only after the client accepts the initial quotation and Stage 1 (10% Token Advance) payment is completed in the D1 / Designer workflow.');
      return;
    }

    // Optimistically update React state
    setLeads(prevLeads => prevLeads.map(l => l.lead_id === lead_id ? { 
      ...l, 
      status: newStatus, 
      d1_status: newStatus,
      is_converted: (newStatus === 'won' || newStatus === 'converted') ? true : !!l.is_converted
    } : l));

    try {
      const response = await axios.post(`${API_BASE_URL}/leads/update-status`, {
        lead_id,
        status: newStatus
      });
      if (response.data && response.data.success !== false) {
        axios.post(`${API_BASE_URL}/leads/book-d1`, {
          lead_id,
          status: newStatus,
          d1_notes: currentLead?.d1_notes || ''
        }).catch(() => {});
        fetchLeads(true);
      } else {
        alert(response.data?.message || 'Failed to update status');
        fetchLeads(true);
      }
    } catch (err: any) {
      alert('Error updating status: ' + (err.response?.data?.message || err.message));
      fetchLeads(true);
    }
  };

  const handleConvertClick = async (lead: Lead) => {
    if (!isAdminOrPM) {
      alert('⚠️ Access Restricted: Only Admin and Project Manager (PM) have permission to start projects and record stage payments.');
      return;
    }
    setSelectedLead(lead);
    const assignedId = lead.manual_client_id || `PR-${lead.lead_id}`;
    let quotationBudget = '';
    try {
      if ((lead as any).initial_quote_amount && Number((lead as any).initial_quote_amount) > 0) {
        quotationBudget = String((lead as any).initial_quote_amount);
      } else {
        let historyQuotes: any[] = [];
        const qRes1 = await axios.get(`${API_BASE_URL}/quotes/history?project_id=${lead.lead_id}`).catch(() => null);
        if (qRes1?.data?.success && Array.isArray(qRes1.data.data)) {
          historyQuotes = qRes1.data.data;
        }

        if (historyQuotes.length === 0 && lead.manual_client_id) {
          const qRes2 = await axios.get(`${API_BASE_URL}/quotes/history?project_id=${lead.manual_client_id}`).catch(() => null);
          if (qRes2?.data?.success && Array.isArray(qRes2.data.data)) {
            historyQuotes = qRes2.data.data;
          }
        }

        if (historyQuotes.length > 0) {
          const initQ = [...historyQuotes].sort((a, b) => (a.version || 0) - (b.version || 0)).find((q: any) => q.is_initial_quote || q.extra_data_parsed?.is_initial_quote || q.extra_data?.is_initial_quote);
          if (initQ) {
            const qAmt = initQ.total_amount || initQ.final_amount || initQ.net_amount;
            if (qAmt && Number(qAmt) > 0) {
              quotationBudget = String(qAmt);
            }
          }
        }
      }
    } catch (e) {}

    const totBudget = Math.round(Number(quotationBudget || lead.total_budget || (lead as any).estimated_budget) || 0);
    const prevPaid = Math.round(Number((lead as any).advance_paid || (lead as any).advance_received) || 0);
    const target10 = Math.round(totBudget * 0.10);
    const remAmt = totBudget > 0 ? Math.max(0, target10 - prevPaid) : 0;

    setConvertData({
      ...convertData,
      project_code: assignedId,
      project_name: lead.client_name + ' Project',
      total_budget: totBudget > 0 ? String(totBudget) : String(lead.estimated_budget || ''),
      advance_paid: remAmt > 0 ? String(remAmt) : (prevPaid > 0 ? String(prevPaid) : '')
    });
    setShowConvertModal(true);
  };

  const handleConversionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdminOrPM) {
      alert('⚠️ Access Restricted: Only Admin and Project Manager (PM) have permission to start projects and record stage payments.');
      return;
    }
    if (!selectedLead) return;

    const totalB = Number(convertData.total_budget) || Number((selectedLead as any).estimated_budget) || 0;
    const target10 = totalB * 0.10;
    const nowInput = Number(convertData.advance_paid) || 0;
    const prevPaid = Number((selectedLead as any)?.advance_paid || (selectedLead as any)?.advance_received) || 0;
    const totalAccumulatedPaid = prevPaid + nowInput;

    // 🔒 Full 10% Stage 1 Token Advance strictly required to convert project and display in Projects page
    if (totalB > 0 && totalAccumulatedPaid < (target10 - 1)) {
      const remAmt = Math.round(target10 - totalAccumulatedPaid);
      const paidP = ((totalAccumulatedPaid / totalB) * 100).toFixed(1);

      setSubmitting(true);
      try {
        if (nowInput > 0) {
          await axios.post(`${API_BASE_URL}/finance`, {
            project_id: selectedLead.manual_client_id || selectedLead.project_code || selectedLead.lead_id,
            type: 'credit',
            amount: nowInput,
            payment_mode: 'UPI / Online',
            category: 'Stage 1 Advance',
            description: `Partial Stage 1 Token Advance (${paidP}%)`,
            recorded_by: user?.user_id || 1
          });
        }

        await axios.post(`${API_BASE_URL}/leads/update-status`, {
          lead_id: selectedLead.lead_id,
          status: selectedLead.status || 'proposal_sent',
          data: { advance_paid: totalAccumulatedPaid, total_budget: totalB }
        });

        // Optimistically update leads list in React state
        setLeads(prevLeads => prevLeads.map(l =>
          String(l.lead_id) === String(selectedLead.lead_id)
            ? { ...l, advance_paid: totalAccumulatedPaid, advance_received: totalAccumulatedPaid, total_budget: totalB }
            : l
        ));

        alert(`⚠️ Partial Stage 1 Advance recorded (₹${nowInput.toLocaleString('en-IN')}).\n\nTotal Paid: ₹${totalAccumulatedPaid.toLocaleString('en-IN')} (${paidP}%).\nFull 10% Target (₹${Math.round(target10).toLocaleString('en-IN')}) is strictly required before project can be opened or rendered on the Projects page. Remaining balance: ₹${remAmt.toLocaleString('en-IN')}.`);
        setShowConvertModal(false);
        fetchLeads(true);
      } catch (err: any) {
        alert('Error recording partial advance: ' + (err.message || 'Failed'));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    setSubmitting(true);
    try {
      if (nowInput > 0) {
        await axios.post(`${API_BASE_URL}/finance`, {
          project_id: selectedLead.manual_client_id || selectedLead.project_code || selectedLead.lead_id,
          type: 'credit',
          amount: nowInput,
          payment_mode: 'UPI / Online',
          category: 'Stage 1 Advance',
          description: `Final Stage 1 Token Advance Top-Up (Total: 10%)`,
          recorded_by: user?.user_id || 1
        }).catch(() => null);
      }

      const response = await axios.post(`${API_BASE_URL}/leads/update-status`, {
        lead_id: selectedLead?.lead_id,
        status: 'won',
        data: {
          ...convertData,
          total_budget: totalB,
          advance_paid: totalAccumulatedPaid,
          created_by: user?.user_id || 1,
          start_date: convertData.start_date || getTodayDateString()
        }
      });
      if (response.data.success) {
        setShowConvertModal(false);
        const pId = response.data.project_id || response.data.data?.project_id || (response.data as any).id || selectedLead.manual_client_id || selectedLead.project_code || selectedLead.lead_id;
        alert('🎉 Full 10% Stage 1 Token Advance verified! Project started and opened successfully!');
        fetchLeads(true);
        navigate(`/projects/${pId}`);
      } else {
        alert(response.data.message || 'Failed to start project');
      }
    } catch (err: any) {
      alert('Conversion failed: ' + (err.message || 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditClick = (lead: Lead) => {
    setEditingLead(lead);
    setIsAddingCustomSource(false);
    setNewCustomSourceName('');
    setIsEditDropdownOpen(false);
    const standardScopes = ['2 BHK', '3 BHK', 'Villa', 'Duplex'];
    const isStandardScope = standardScopes.includes(lead.project_scope || '');
    setFormData({
      client_name: lead.client_name || '',
      contact_number: lead.contact_number || '',
      email: lead.email || '',
      location: lead.location || '',
      client_address: lead.client_address || '',
      project_type: lead.project_type || 'Furniture projects',
      estimated_budget: lead.estimated_budget || '',
      lead_source: lead.lead_source || 'walk_in',
      manual_client_id: lead.manual_client_id || '',
      project_scope: isStandardScope ? (lead.project_scope || '2 BHK') : 'Other',
      custom_scope: isStandardScope ? '' : (lead.custom_scope || lead.project_scope || ''),
      created_by: user?.user_id || '',
      status: lead.status || 'enquiry'
    });
    setShowEditModal(true);
  };

  const handleOpenAddModal = () => {
    setIsAddingCustomSource(false);
    setNewCustomSourceName('');
    setIsAddDropdownOpen(false);
    setFormData({
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
      created_by: user?.user_id || '',
      status: 'enquiry'
    });
    setShowAddModal(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const editingId = editingLead?.lead_id;
    const finalScope = formData.project_scope === 'Other' ? (formData.custom_scope?.trim() || 'Other') : formData.project_scope;

    // Instantly close modal for zero delay
    setShowEditModal(false);
    setEditingLead(null);

    if (editingId) {
      setLeads(prevLeads => prevLeads.map(l => l.lead_id === editingId ? { 
        ...l, 
        ...formData,
        project_scope: finalScope
      } : l));
    }

    try {
      const response = await axios.put(`${API_BASE_URL}/leads`, {
        ...formData,
        project_scope: finalScope,
        lead_id: editingId
      });
      if (response.data.success) {
        fetchLeads(true);
      } else {
        alert(response.data.message || 'Failed to update lead');
        fetchLeads(true);
      }
    } catch (err) {
      alert('Error updating lead');
      fetchLeads(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const finalScope = formData.project_scope === 'Other' ? (formData.custom_scope?.trim() || 'Other') : formData.project_scope;
    const payload = {
      ...formData,
      project_scope: finalScope,
      created_by: user?.user_id
    };

    try {
      const response = await axios.post(`${API_BASE_URL}/leads`, payload);
      if (response.data && response.data.success) {
        setShowAddModal(false);
        // Reset form fields
        setFormData({
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
          created_by: user?.user_id || '',
          status: 'enquiry'
        });
        await fetchLeads(true);
      } else {
        alert(response.data?.message || 'Error adding lead');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Error adding lead';
      alert(msg);
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
    const todayStr = getTodayDateString();

    const savedBookingTime = selectedBookLead?.d1_booking_time || '';
    const savedParts = savedBookingTime ? savedBookingTime.split(' ') : [];
    const savedDate = savedParts[0] || todayStr;
    const savedTimeRaw = savedParts[1] ? savedParts[1].substring(0, 5) : '';
    const uRole = String(user?.role || '').toLowerCase();
    const isDesigner = ['d1', 'd2', 'designer', 'lead_designer', 'associate_designer', 'ad', 'graphic_designer', 'gd'].includes(uRole) || uRole.includes('design') || uRole.includes('d1') || uRole.includes('d2');
    if (isDesigner && (bookStatus === 'rescheduled' || bookStatus === 'transferred' || (!selectedBookLead?.d1_assigned_to && bookStatus === 'booked'))) {
      alert('⚠️ Designers cannot book, reschedule, or transfer consultation slots. Please contact Sales or Admin.');
      return;
    }

    const isSales = ['sales', 'sales_person', 'sales_executive', 'business_associate', 'ba', 'telecaller'].includes(uRole) || (uRole.includes('sales') && !uRole.includes('manager'));
    if (isSales && (bookStatus === 'in_meeting' || bookStatus === 'meeting_completed' || bookStatus === 'completed')) {
      alert('⚠️ Only Designers can start and complete consultation meetings.');
      return;
    }

    // Skip slot/past-time validation when starting/completing meeting or editing existing booking
    const isMeetingAction = bookStatus === 'in_meeting' || bookStatus === 'meeting_completed' || bookStatus === 'completed' || Boolean(savedBookingTime);

    if (!isMeetingAction) {
      if (!selectedD1User) {
        alert('⚠️ Please select a Lead Designer (D1 / D2) before confirming booking.');
        return;
      }
      if (!bookDate) {
        alert('⚠️ Please select a booking date.');
        return;
      }
      if (!bookTime) {
        alert('⚠️ Please select an available upcoming time slot.');
        return;
      }
      if (bookDate < todayStr) {
        alert('Selected date is in the past. Please select today or a future date.');
        return;
      }
      if (isSlotPastTime(bookTime, bookDate)) {
        alert('Selected time slot has already passed. Please select a valid upcoming time slot.');
        return;
      }
      if (isSlotBooked(bookTime)) {
        alert('Selected time slot is already booked for this designer.');
        return;
      }
    }

    // Use saved database booking time if starting or completing meeting
    let submitBookingTime = `${bookDate} ${bookTime}:00`;
    if ((bookStatus === 'in_meeting' || bookStatus === 'meeting_completed' || bookStatus === 'completed') && savedDate && savedTimeRaw) {
      submitBookingTime = `${savedDate} ${savedTimeRaw}:00`;
    }

    const submitStatus = ['meeting_completed', 'completed'].includes(bookStatus)
      ? 'meeting_completed'
      : (bookStatus === 'in_meeting' ? 'in_meeting' : (bookStatus === 'cancelled' ? 'cancelled' : 'scheduled'));

    const assocId = selectedAssociateUser ? selectedAssociateUser : null;
    const assocName = selectedAssociateUser ? (team.find(t => String(t.user_id) === String(selectedAssociateUser))?.name || '') : null;

    // ⚡ INSTANT OPTIMISTIC UI UPDATE & MODAL CLOSE
    const leadId = selectedBookLead?.lead_id;
    if (!leadId || String(leadId).startsWith('temp-')) {
      alert('⚠️ Please select a valid permanent lead before booking.');
      return;
    }

    if (leadId) {
      setLeads(prevLeads => prevLeads.map(l => l.lead_id === leadId ? {
        ...l,
        d1_status: submitStatus,
        d1_assigned_to: Number(selectedD1User) || l.d1_assigned_to || 0,
        associate_designer_assigned_id: assocId,
        associate_designer_assigned_name: assocName,
        d1_booking_time: submitBookingTime,
        d1_notes: d1Notes
      } : l));
    }

    setShowBookModal(false);
    setSubmitting(false);

    // ⚡ PARALLEL BACKGROUND NETWORK REQUESTS
    Promise.allSettled([
      axios.post(`${API_BASE_URL}/leads/book-d1`, {
        lead_id: leadId,
        manual_client_id: selectedBookLead?.manual_client_id,
        d1_user_id: selectedD1User,
        booking_time: submitBookingTime,
        assigned_by_name: user?.name || 'Admin',
        d1_notes: d1Notes,
        status: submitStatus,
        associate_designer_assigned_id: assocId,
        associate_designer_assigned_name: assocName
      }),
      axios.post(`${API_BASE_URL}/leads/book-multi-role`, {
        lead_id: leadId,
        d1_user_id: selectedD1User,
        booking_time: submitBookingTime,
        assigned_by_name: user?.name || 'User',
        notes: d1Notes,
        associate_designer_assigned_id: assocId,
        associate_designer_assigned_name: assocName
      }),
      axios.post(`${API_BASE_URL}/leads/update-status`, {
        lead_id: leadId,
        status: bookStatus,
        data: {
          previous_designer_id: selectedBookLead?.d1_assigned_to,
          sales_person_name: user?.name || 'Admin',
          skip_status_update: true
        }
      })
    ]).then(() => {
      fetchLeads(true);
      const designerObj = team.find(t => String(t.user_id) === String(selectedD1User));
      const designerName = designerObj?.name || 'Designer';
      const slotObj = FIXED_SLOTS.find(s => s.value === bookTime);
      alert(`🎉 D1 Slot Successfully Booked!\n\n• Client: ${selectedBookLead?.client_name || 'Lead'}\n• Lead Designer: ${designerName}\n• Date: ${bookDate}\n• Time Slot: ${slotObj?.label || bookTime}\n• Status: Scheduled`);
    }).catch(err => {
      console.error('Background slot booking sync error', err);
      fetchLeads(true);
    });
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

  const isCompletedMeetingLead = (l: any): boolean => {
    if (!l) return false;
    const s = String(l.status || '').toLowerCase().trim();
    const d1s = String(l.d1_status || '').toLowerCase().trim();

    // Meeting must strictly only be marked completed when explicitly completed by designer/user
    if (d1s === 'meeting_completed' || d1s === 'completed' || s === 'meeting_completed' || s === 'completed') {
      return true;
    }

    // Quotation proposal stages (sent, accepted, approved) must NEVER auto-complete the consultation meeting
    const quoteLeadStatuses = ['proposal_sent', 'proposal_accepted', 'proposal_approved', 'quotation_accepted'];
    if (quoteLeadStatuses.includes(s) || quoteLeadStatuses.includes(d1s)) {
      return false;
    }

    // If meeting was saved as completed in database, but verify not actively in-meeting, scheduled, or booked
    if ((l.is_meeting_completed === 1 || l.is_meeting_completed === '1' || l.is_meeting_completed === true) &&
        d1s !== 'in_meeting' && d1s !== 'scheduled' && d1s !== 'booked' && !Boolean(l.d1_booking_time)) {
      return true;
    }

    return false;
  };

  const checkStatementPeriod = (dateValStr?: string | null): boolean => {
    if (!dateValStr) return false;
    const s = String(dateValStr).trim().replace(' ', 'T');
    const d = new Date(s);
    if (isNaN(d.getTime())) return false;
    const now = new Date();
    if (statementPeriod === 'today') {
      return d.getFullYear() === now.getFullYear() &&
             d.getMonth() === now.getMonth() &&
             d.getDate() === now.getDate();
    } else if (statementPeriod === 'this_month') {
      return d.getFullYear() === now.getFullYear() &&
             d.getMonth() === now.getMonth();
    } else if (statementPeriod === 'last_month') {
      const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return d >= firstDayLastMonth && d <= lastDayLastMonth;
    } else if (statementPeriod === 'last_3_months') {
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      return d >= threeMonthsAgo;
    } else if (statementPeriod === 'last_6_months') {
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
      return d >= sixMonthsAgo;
    } else if (statementPeriod === 'this_year') {
      return d.getFullYear() === now.getFullYear();
    } else if (statementPeriod.startsWith('year_')) {
      const targetYear = parseInt(statementPeriod.replace('year_', ''), 10);
      return d.getFullYear() === targetYear;
    } else if (statementPeriod === 'custom') {
      let ok = true;
      if (startDate) ok = ok && d >= new Date(startDate);
      if (endDate) ok = ok && d <= new Date(endDate + 'T23:59:59.999');
      return ok;
    }
    return true;
  };

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
      const lStage = getLeadLifecycleStage(lead).stage;
      if (statusFilter === 'booked' || statusFilter === 'scheduled') {
        matchesStatus = lStage === 'scheduled';
      } else if (statusFilter === 'meeting_completed' || statusFilter === 'completed') {
        matchesStatus = isCompletedMeetingLead(lead);
      } else if (statusFilter === 'won' || statusFilter === 'converted') {
        matchesStatus = lStage === 'converted';
      } else if (statusFilter === 'pending') {
        matchesStatus = lStage === 'pending' || lStage === 'in_meeting';
      } else if (statusFilter === 'lost') {
        matchesStatus = lStage === 'lost' || lStage === 'cancelled';
      } else {
        matchesStatus = lStage === statusFilter || lead.status === statusFilter;
      }
    }

    let matchesDate = true;
    if (dateFrom || dateTo) {
      const checkDateInDateRange = (dateStr?: string | null) => {
        if (!dateStr) return false;
        const dStr = dateStr.split(' ')[0] || dateStr.split('T')[0];
        if (!dStr) return false;
        const lDate = new Date(dStr);
        if (isNaN(lDate.getTime())) return false;
        lDate.setHours(0, 0, 0, 0);

        if (dateFrom) {
          const fromDate = new Date(dateFrom);
          fromDate.setHours(0, 0, 0, 0);
          if (lDate < fromDate) return false;
        }
        if (dateTo) {
          const toDate = new Date(dateTo);
          toDate.setHours(0, 0, 0, 0);
          if (lDate > toDate) return false;
        }
        return true;
      };

      if (statusFilter === 'meeting_completed' || statusFilter === 'completed') {
        matchesDate = checkDateInDateRange(lead.meeting_completed_at) || (!lead.meeting_completed_at && (checkDateInDateRange(lead.d1_booking_time) || checkDateInDateRange(lead.created_at)));
      } else {
        matchesDate = checkDateInDateRange(lead.meeting_completed_at) || checkDateInDateRange(lead.d1_booking_time) || checkDateInDateRange(lead.created_at);
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

    let matchesType = true;
    if (projectType !== 'all') {
      const pType = (lead.project_type || '').toLowerCase();
      if (projectType === 'furniture') {
        matchesType = pType.includes('furniture') || pType.includes('architectural');
      } else if (projectType === 'interior') {
        matchesType = pType.includes('interior');
      } else if (projectType === 'commercial') {
        matchesType = pType.includes('commercial');
      }
    }

    let matchesStatementDate = true;
    if (statementPeriod !== 'all') {
      if (statusFilter === 'meeting_completed' || statusFilter === 'completed') {
        matchesStatementDate = checkStatementPeriod(lead.meeting_completed_at) || (!lead.meeting_completed_at && (checkStatementPeriod(lead.d1_booking_time) || checkStatementPeriod(lead.created_at)));
      } else {
        matchesStatementDate = checkStatementPeriod(lead.meeting_completed_at) || checkStatementPeriod(lead.d1_booking_time) || checkStatementPeriod(lead.created_at);
      }
    }

    let matchesRoleBookedOnly = true;
    const uRole = String(user?.role || '').toLowerCase();
    if (uRole === 'mmt' || uRole.includes('site')) {
      matchesRoleBookedOnly = !!lead.d1_assigned_to || !!lead.d1_booking_time;
    }

    return matchesSearch && matchesStatus && matchesDate && matchesLocation && matchesAssignedTo && matchesServices && matchesScope && matchesType && matchesStatementDate && matchesRoleBookedOnly;
  });

  const totalLeads = filteredLeads.length;
  const newLeadsCount = filteredLeads.filter(l => getLeadLifecycleStage(l).stage === 'enquiry').length;
  const pendingCount = filteredLeads.filter(l => getLeadLifecycleStage(l).stage === 'pending' || getLeadLifecycleStage(l).stage === 'in_meeting').length;
  const meetingCompletedCount = filteredLeads.filter(l => {
    if (!isCompletedMeetingLead(l)) return false;
    if (statementPeriod !== 'all') {
      return checkStatementPeriod(l.meeting_completed_at) || (!l.meeting_completed_at && (checkStatementPeriod(l.d1_booking_time) || checkStatementPeriod(l.created_at)));
    }
    return true;
  }).length;
  const proposalSentCount = filteredLeads.filter(l => getLeadLifecycleStage(l).stage === 'proposal_sent' || getLeadLifecycleStage(l).stage === 'proposal_accepted').length;
  const convertedCount = filteredLeads.filter(l => getLeadLifecycleStage(l).stage === 'converted').length;
  const lostCount = filteredLeads.filter(l => getLeadLifecycleStage(l).stage === 'lost' || getLeadLifecycleStage(l).stage === 'cancelled').length;

  return (
    <div className="leads-page">
      <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', marginBottom: '24px', border: '1px solid #ffe8c2' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '30px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ padding: '12px', backgroundColor: '#0c1527', borderRadius: '12px' }}>
              <Users size={24} color="#fca412" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0c1527', margin: 0 }}>Lead Management</h2>
              <p style={{ color: '#64748b', margin: '4px 0 0 0', fontSize: '0.9rem' }}>Track enquiries and customer conversions</p>
            </div>
          </div>
          <button
            onClick={handleOpenAddModal}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', backgroundColor: '#111827', color: 'white', borderRadius: '8px', fontWeight: 600, border: 'none', cursor: 'pointer' }}
          >
            <UserPlus size={18} />
            New Enquiry
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '14px' }}>
          <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ backgroundColor: '#e0e7ff', padding: '10px', borderRadius: '10px', color: '#4f46e5' }}><Users size={18} /></div>
            <div>
              <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: 0 }}>Total Leads</p>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#111827', margin: '2px 0' }}>{totalLeads}</h3>
              <p style={{ color: '#9ca3af', fontSize: '0.72rem', margin: 0 }}>All Enquiries</p>
            </div>
          </div>
          <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ backgroundColor: '#e0f2fe', padding: '10px', borderRadius: '10px', color: '#0284c7' }}><PlusCircle size={18} /></div>
            <div>
              <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: 0 }}>New Lead</p>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#111827', margin: '2px 0' }}>{newLeadsCount}</h3>
              <p style={{ color: '#9ca3af', fontSize: '0.72rem', margin: 0 }}>{totalLeads ? ((newLeadsCount / totalLeads) * 100).toFixed(1) : 0}% of Total</p>
            </div>
          </div>
          <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ backgroundColor: '#fef3c7', padding: '10px', borderRadius: '10px', color: '#d97706' }}><Clock size={18} /></div>
            <div>
              <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: 0 }}>Pending</p>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#111827', margin: '2px 0' }}>{pendingCount}</h3>
              <p style={{ color: '#9ca3af', fontSize: '0.72rem', margin: 0 }}>{totalLeads ? ((pendingCount / totalLeads) * 100).toFixed(1) : 0}% of Total</p>
            </div>
          </div>
          <div
            onClick={() => setStatusFilter(prev => prev === 'meeting_completed' ? '' : 'meeting_completed')}
            style={{
              padding: '16px',
              borderRadius: '12px',
              border: statusFilter === 'meeting_completed' ? '2px solid #0d9488' : '1px solid #e5e7eb',
              backgroundColor: statusFilter === 'meeting_completed' ? '#f0fdfa' : 'white',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: statusFilter === 'meeting_completed' ? '0 2px 8px rgba(13, 148, 136, 0.18)' : 'none'
            }}
            title="Click to filter by Meeting Completed"
          >
            <div style={{ backgroundColor: '#ccfbf1', padding: '10px', borderRadius: '10px', color: '#0d9488' }}><CalendarCheck size={18} /></div>
            <div>
              <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: 0 }}>Meeting Completed</p>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#111827', margin: '2px 0' }}>{meetingCompletedCount}</h3>
              <p style={{ color: '#9ca3af', fontSize: '0.72rem', margin: 0 }}>{totalLeads ? ((meetingCompletedCount / totalLeads) * 100).toFixed(1) : 0}% of Total</p>
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
              <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: 0 }}>Lost</p>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#111827', margin: '2px 0' }}>{lostCount}</h3>
              <p style={{ color: '#9ca3af', fontSize: '0.72rem', margin: 0 }}>{totalLeads ? ((lostCount / totalLeads) * 100).toFixed(1) : 0}% of Total</p>
            </div>
          </div>
        </div>
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e5e7eb', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '240px', maxWidth: '380px' }}>
            <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
            <input
              type="text"
              placeholder="Search by client name or contact..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '12px 16px 12px 48px', borderRadius: '12px', border: '1px solid #e5e7eb', outline: 'none', fontSize: '0.95rem' }}
            />
          </div>

          {/* Quick Date Filter Tabs for Daily / Monthly / Yearly / All Time */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: 'All Time' },
              { id: 'today', label: 'Today (Daily)' },
              { id: 'thisMonth', label: 'This Month' },
              { id: 'thisYear', label: 'This Year' }
            ].map(tab => {
              const isActive = filterDateQuick === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setFilterDateQuick(tab.id);
                    const today = new Date();
                    if (tab.id === 'today') {
                      const tStr = formatLocalDate(today);
                      setDateFrom(tStr);
                      setDateTo(tStr);
                    } else if (tab.id === 'thisMonth') {
                      const first = new Date(today.getFullYear(), today.getMonth(), 1);
                      const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                      setDateFrom(formatLocalDate(first));
                      setDateTo(formatLocalDate(last));
                    } else if (tab.id === 'thisYear') {
                      const first = new Date(today.getFullYear(), 0, 1);
                      const last = new Date(today.getFullYear(), 11, 31);
                      setDateFrom(formatLocalDate(first));
                      setDateTo(formatLocalDate(last));
                    } else if (tab.id === 'all') {
                      setDateFrom('');
                      setDateTo('');
                    }
                  }}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '20px',
                    border: isActive ? '1.5px solid #fca412' : '1.5px solid #cbd5e1',
                    backgroundColor: isActive ? '#fca412' : '#ffffff',
                    color: isActive ? '#ffffff' : '#475569',
                    fontSize: '0.82rem',
                    fontWeight: isActive ? 800 : 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: isActive ? '0 2px 8px rgba(252, 164, 18, 0.35)' : 'none'
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowFilters(!showFilters)}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: showFilters ? '#f3f4f6' : 'white', border: '1px solid #e5e7eb', borderRadius: '8px', color: '#374151', fontWeight: 500, cursor: 'pointer' }}
              >
                <Filter size={16} /> Filters {(dateFrom || dateTo || statusFilter || locationFilter || filterAssignedTo || filterServices.length > 0 || filterScope.length > 0 || searchQuery) && <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }}></span>}
              </button>

              {(searchQuery || statusFilter || locationFilter || filterAssignedTo || filterServices.length > 0 || filterScope.length > 0 || dateFrom || dateTo || statementPeriod !== 'all' || projectType !== 'all') && (
                <button
                  onClick={resetFilters}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626', fontWeight: 600, cursor: 'pointer', fontSize: '0.88rem' }}
                >
                  <RotateCcw size={14} /> Reset
                </button>
              )}

              {showFilters && (
                <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', justifyContent: 'flex-end', pointerEvents: 'auto' }}>
                  <div style={{ width: '400px', backgroundColor: 'white', height: '100%', display: 'flex', flexDirection: 'column', boxShadow: '-10px 0 25px rgba(0,0,0,0.1)', animation: 'slideIn 0.3s ease-out' }}>
                    <div style={{ padding: '24px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#111827', fontWeight: 600 }}>Filters</h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button onClick={resetFilters} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#dc2626', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}><RotateCcw size={12} /> Reset All</button>
                        <button onClick={() => setShowFilters(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={20} /></button>
                      </div>
                    </div>

                    <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
                      <div style={{ marginBottom: '32px' }}>
                        <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: '#374151', fontWeight: 600 }}>Status</h4>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {[
                            { value: '', label: 'All' },
                            { value: 'enquiry', label: 'New Lead' },
                            { value: 'scheduled', label: 'Scheduled' },
                            { value: 'pending', label: 'Pending' },
                            { value: 'meeting_completed', label: 'Meeting Done' },
                            { value: 'proposal_sent', label: 'Proposal Sent' },
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
                            { id: 'thisYear', label: 'This Year' },
                            { id: 'custom', label: 'Custom' }
                          ].map(d => (
                            <button
                              key={d.id}
                              onClick={() => {
                                setFilterDateQuick(d.id);
                                const today = new Date();

                                if (d.id === 'today') {
                                  const tStr = formatLocalDate(today);
                                  setDateFrom(tStr); setDateTo(tStr);
                                } else if (d.id === 'last7') {
                                  const last7 = new Date(today); last7.setDate(today.getDate() - 7);
                                  setDateFrom(formatLocalDate(last7)); setDateTo(formatLocalDate(today));
                                } else if (d.id === 'thisMonth') {
                                  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
                                  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                                  setDateFrom(formatLocalDate(firstDay)); setDateTo(formatLocalDate(lastDay));
                                } else if (d.id === 'thisYear') {
                                  const firstDayYear = new Date(today.getFullYear(), 0, 1);
                                  const lastDayYear = new Date(today.getFullYear(), 11, 31);
                                  setDateFrom(formatLocalDate(firstDayYear)); setDateTo(formatLocalDate(lastDayYear));
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

        <div style={{ 
          overflowX: 'auto', 
          minHeight: activeDropdown ? '380px' : 'auto', 
          paddingBottom: activeDropdown ? '120px' : '0px', 
          backgroundColor: '#ffffff', 
          borderRadius: '16px', 
          border: '1.5px solid #ffe8c2', 
          boxShadow: '0 4px 14px rgba(252, 164, 18, 0.05)',
          position: 'relative'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#fff9f0', borderBottom: '1.5px solid #ffe8c2', textAlign: 'left' }}>
                <th style={{ padding: '14px 12px 14px 16px', color: '#0c1527', fontWeight: 800, fontSize: '0.88rem', width: '140px', backgroundColor: '#fff9f0' }}>Project ID / Client ID</th>
                <th style={{ padding: '14px 16px', color: '#0c1527', fontWeight: 800, fontSize: '0.88rem', backgroundColor: '#fff9f0' }}>Client Info</th>
                <th style={{ padding: '14px 16px', color: '#0c1527', fontWeight: 800, fontSize: '0.88rem', backgroundColor: '#fff9f0' }}>Project / Scope</th>
                <th style={{ padding: '14px 16px', color: '#0c1527', fontWeight: 800, fontSize: '0.88rem', backgroundColor: '#fff9f0' }}>Created On</th>
                <th style={{ padding: '14px 16px', color: '#0c1527', fontWeight: 800, fontSize: '0.88rem', backgroundColor: '#fff9f0' }}>D1 Consultation &amp; Meeting Status</th>
                <th style={{ padding: '14px 16px', color: '#0c1527', fontWeight: 800, fontSize: '0.88rem', textAlign: 'center', backgroundColor: '#fff9f0' }}>Notes</th>
                <th style={{ padding: '14px 16px', color: '#0c1527', fontWeight: 800, fontSize: '0.88rem', width: '80px', textAlign: 'center', backgroundColor: '#fff9f0' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px' }}><Loader2 className="animate-spin" style={{ margin: '0 auto' }} /></td></tr>
              ) : filteredLeads.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>No leads match your filters.</td></tr>
              ) : filteredLeads.map((lead, idx) => (
                <tr key={lead.lead_id} style={{ borderBottom: '1px solid #f3f4f6', transition: 'background-color 0.2s', position: 'relative', zIndex: activeDropdown === lead.lead_id ? 999 : 1 }}>
                  <td style={{ padding: '16px 8px 16px 16px', width: '110px' }}>
                    <span style={{ color: '#4b5563', backgroundColor: '#f3f4f6', padding: '4px 10px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 500, display: 'inline-block' }}>
                      {lead.manual_client_id || lead.project_code || (lead.lead_id ? `PR-${lead.lead_id}` : '-')}
                    </span>
                  </td>
                  <td style={{ padding: '16px 12px' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: '#0c1527', fontSize: '0.9rem', lineHeight: '1.2' }}>{lead.client_name || lead.project_name || `Client #${lead.lead_id}`}</div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '3px', fontWeight: 500 }}>{lead.contact_number || '-'}</div>
                    </div>
                  </td>
                  <td style={{ padding: '16px 16px' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: '#0c1527', fontSize: '0.88rem', lineHeight: '1.2' }}>{lead.location || lead.client_address || 'No Location'}</div>
                      <div style={{ color: '#64748b', fontSize: '0.78rem', marginTop: '3px', fontWeight: 500 }}>{lead.project_scope || 'Full Scope'} {lead.project_type?.replace('_', ' ') || 'Interior Projects'}</div>
                    </div>
                  </td>
                  <td style={{ padding: '16px 16px' }}>
                    <div style={{ color: '#0c1527', fontSize: '0.84rem', fontWeight: 600 }}>
                      {lead.created_at ? new Date(lead.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                    </div>
                  </td>
                  <td style={{ padding: '16px 16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>

                        {/* Pipeline Status & Admin Dropdown Control */}
                        {(() => {
                          const currentStage = getLeadLifecycleStage(lead);
                          const isAdmin = ['admin', 'administrator', 'superadmin', 'management', 'owner'].includes(String(user?.role || '').toLowerCase()) || String(user?.role || '').toLowerCase().includes('admin');

                          const sLower = String(lead.status || '').toLowerCase();
                          const d1Lower = String(lead.d1_status || '').toLowerCase();
                          const isMeetingDone = Boolean(
                            ['meeting_completed', 'completed', 'proposal_sent', 'proposal_accepted', 'won', 'converted'].includes(d1Lower) ||
                            ['meeting_completed', 'completed', 'proposal_sent', 'proposal_accepted', 'won', 'converted'].includes(sLower) ||
                            lead.project_id ||
                            (lead as any).is_converted
                          );

                          if (isAdmin) {
                            let selectVal = currentStage.stage;
                            if (selectVal === 'won') selectVal = 'converted';
                            if (selectVal === 'cancelled' || selectVal === 'dead' || selectVal === 'dropped') selectVal = 'lost';
                            if (selectVal === 'in_meeting') selectVal = 'scheduled';

                            return (
                              <select
                                value={selectVal}
                                onChange={(e) => {
                                  const targetVal = e.target.value;
                                  if (targetVal === 'converted') {
                                    alert('⚠️ Manual Lead Conversion is Disabled.\n\nLeads are automatically converted to active projects only after the client accepts the initial quotation and Stage 1 (10% Token Advance) payment is completed in the D1 / Designer workflow.');
                                    return;
                                  }
                                  if (targetVal === 'lost') {
                                    if (window.confirm(`Are you sure you want to mark lead "${lead.client_name || 'Client'}" as Lost?`)) {
                                      handleStatusUpdate(lead.lead_id, 'lost');
                                    }
                                  } else {
                                    handleStatusUpdate(lead.lead_id, targetVal);
                                  }
                                }}
                                style={{
                                  padding: '5px 12px',
                                  borderRadius: '6px',
                                  border: '1.5px solid #cbd5e1',
                                  fontSize: '0.84rem',
                                  outline: 'none',
                                  backgroundColor: '#ffffff',
                                  color: '#0f172a',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                  minWidth: '150px'
                                }}
                              >
                                <option value="enquiry">New Lead</option>
                                <option value="scheduled">Scheduled</option>
                                <option value="meeting_completed">Meeting Done</option>
                                <option 
                                  value="proposal_accepted" 
                                  disabled={!isMeetingDone} 
                                  style={{ color: !isMeetingDone ? '#94a3b8' : '#0f172a' }}
                                >
                                  Quote Accepted {!isMeetingDone ? '(Meeting Done Req.)' : ''}
                                </option>
                                <option 
                                  value="proposal_sent" 
                                  disabled={!isMeetingDone} 
                                  style={{ color: !isMeetingDone ? '#94a3b8' : '#0f172a' }}
                                >
                                  Proposal Sent
                                </option>
                                <option value="pending">Pending</option>
                                <option value="converted" disabled style={{ color: '#94a3b8' }}>Converted (Auto via Stage 1 Payment)</option>
                                <option value="lost">Lost</option>
                              </select>
                            );
                          }

                          // Non-admin view:
                          return (
                            <>
                              {/* Pipeline Status Badge */}
                              <span style={{
                                padding: '4px 10px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px',
                                backgroundColor: currentStage.bg,
                                color: currentStage.text,
                                border: `1px solid ${currentStage.border}`
                              }}>
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: currentStage.text }}></span>
                                {currentStage.label}
                              </span>
                            </>
                          );
                        })()}

                        {/* Booking Date Time */}
                        {lead.d1_booking_time && (
                          <span style={{ backgroundColor: '#fff9f0', color: '#fca412', border: '1px solid #ffe8c2', fontSize: '0.78rem', fontWeight: 700, padding: '3px 8px', borderRadius: '12px' }}>
                            ⏰ {new Date(lead.d1_booking_time).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}

                        {/* D1 Consultation Status Row & Book D1 Slot */}
                        {(() => {
                          const s = (lead.status || '').toLowerCase();
                          const d1s = (lead.d1_status || '').toLowerCase();
                          const isConverted = s === 'converted' || s === 'won' || d1s === 'converted' || d1s === 'won' || (lead as any).is_converted === 1 || (lead as any).is_converted === '1';
                          const isLost = s === 'lost' || s === 'dead' || s === 'cancelled' || s === 'dropped' || d1s === 'cancelled' || d1s === 'lost';
                          const isMeetingDone = isCompletedMeetingLead(lead);
                          const uRole = String(user?.role || '').toLowerCase();
                          const isAdmin = ['admin', 'administrator', 'superadmin', 'management', 'owner'].includes(uRole) || uRole.includes('admin');
                          const isDesigner = ['d1', 'd2', 'designer', 'lead_designer', 'associate_designer', 'ad', 'graphic_designer', 'gd'].includes(uRole) || uRole.includes('design') || uRole.includes('d1') || uRole.includes('d2');
                          const isSales = ['sales', 'sales_person', 'sales_executive', 'business_associate', 'ba', 'telecaller'].includes(uRole) || (uRole.includes('sales') && !uRole.includes('manager'));
                          const isManagerOrAdmin = !isSales && (isAdmin || ['manager', 'general_manager', 'gm', 'operations_manager', 'om'].includes(uRole) || uRole.includes('manager'));
                          const canControlMeeting = !isSales && (isDesigner || isAdmin);
                          const isSalesOrAdmin = !isDesigner && (isAdmin || ['sales', 'sales_manager', 'sales_person', 'manager', 'business_associate', 'ba'].includes(uRole) || uRole.includes('sales'));

                          // 1. Resolve Lead D1 Designer
                          const d1Ids = lead.d1_assigned_to ? String(lead.d1_assigned_to).split(',').map(id => id.trim()).filter(id => id && id !== '0' && id.toLowerCase() !== 'none') : [];
                          const d1Name = (lead as any).d1_assigned_name ||
                            (d1Ids.length > 0 ? d1Ids.map(id => team.find(t => String(t.user_id) === String(id))?.name).filter(Boolean).join(', ') : '') ||
                            (d1Ids.length > 0 ? (d1Ids.length === 1 ? `Designer #${d1Ids[0]}` : `Designers: ${d1Ids.join(', ')}`) : '');

                          // 2. Resolve Associate Designer (AD)
                          const rawAdName = ((lead as any).associate_designer_assigned_name || '').trim();
                          const rawAdId = (lead as any).associate_designer_assigned_id;
                          const adIds = rawAdId ? String(rawAdId).split(',').map(id => id.trim()).filter(id => id && id !== '0' && id.toLowerCase() !== 'none') : [];
                          const isAdDuplicateOfD1 = (adIds.length > 0 && d1Ids.length > 0 && adIds.join(',') === d1Ids.join(',')) ||
                            (rawAdName && d1Name && rawAdName.toLowerCase() === d1Name.toLowerCase());

                          let adName = '';
                          if (!isAdDuplicateOfD1) {
                            adName = rawAdName ||
                              (adIds.length > 0 ? adIds.map(id => team.find(t => String(t.user_id) === String(id))?.name).filter(Boolean).join(', ') : '') ||
                              (adIds.length > 0 ? (adIds.length === 1 ? `AD #${adIds[0]}` : `ADs: ${adIds.join(', ')}`) : '');
                          }

                          const hasDesigner = Boolean(d1Name || adName || d1Ids.length > 0 || adIds.length > 0 || lead.d1_booking_time);

                          if (isMeetingDone) {
                            return (
                              <div style={{ fontSize: '0.8rem', color: '#4b5563', display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                  <span style={{ fontWeight: 600 }}>D1 Designer:</span>
                                  <span style={{ color: '#111827', fontWeight: 600 }}>
                                    {d1Name || (adName ? 'None' : 'Assigned')}
                                  </span>
                                  <span style={{
                                    backgroundColor: '#dcfce7',
                                    color: '#15803d',
                                    border: '1px solid #bbf7d0',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    padding: '3px 8px',
                                    borderRadius: '12px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}>
                                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#15803d' }}></span>
                                    Meeting Done
                                  </span>
                                  {isConverted && (
                                    <span style={{
                                      backgroundColor: '#dbeafe',
                                      color: '#1e40af',
                                      border: '1px solid #bfdbfe',
                                      fontSize: '0.75rem',
                                      fontWeight: 700,
                                      padding: '3px 8px',
                                      borderRadius: '12px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px'
                                    }}>
                                      🎉 Converted
                                    </span>
                                  )}
                                </div>
                                {adName && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                    <span style={{ fontWeight: 600, color: '#4338ca' }}>Associate Designer (AD):</span>
                                    <span style={{ color: '#3730a3', fontWeight: 700 }}>{adName}</span>
                                  </div>
                                )}
                              </div>
                            );
                          }

                          if (isConverted) {
                            return (
                              <div style={{ fontSize: '0.78rem', color: '#1d4ed8', fontWeight: 700, marginTop: '4px' }}>
                                <span style={{ backgroundColor: '#dbeafe', color: '#1d4ed8', padding: '3px 8px', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                                  🎉 Converted
                                </span>
                              </div>
                            );
                          }

                          if (isLost) {
                            const isCancelled = s === 'cancelled' || d1s === 'cancelled';
                            return (
                              <div style={{ fontSize: '0.78rem', color: isCancelled ? '#dc2626' : '#b91c1c', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                <span>{isCancelled ? '🚫 Booking / Project Cancelled' : '🔴 Lead Closed'}</span>
                              </div>
                            );
                          }

                          if (hasDesigner) {
                            const isFuture = Boolean(lead.d1_booking_time && lead.d1_booking_time.split(' ')[0] > getTodayDateString());
                            const isInMeeting = d1s === 'in_meeting' || s === 'in_meeting';

                            const startKey = `meeting_started_at_${lead.lead_id}`;
                            let startTs = localStorage.getItem(startKey);
                            if (isInMeeting && !startTs) {
                              startTs = String(Date.now());
                              localStorage.setItem(startKey, startTs);
                            }
                            const elapsedSec = startTs ? Math.floor((nowTick - Number(startTs)) / 1000) : 999;
                            const isInitialMinute = isInMeeting && elapsedSec < 60;

                            return (
                              <div style={{ fontSize: '0.8rem', color: '#4b5563', display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                  <span style={{ fontWeight: 600 }}>D1 Designer:</span>
                                  <span style={{ color: '#111827', fontWeight: 700 }}>{d1Name || (adName ? 'None' : 'Assigned')}</span>
                                  {isSalesOrAdmin && (
                                    <button
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#f97316', display: 'flex', alignItems: 'center', marginLeft: '2px' }}
                                      onClick={() => { setSelectedBookLead(lead); setShowBookModal(true); }}
                                      title="Reschedule or Edit Slot"
                                    >
                                      <Pencil size={12} />
                                    </button>
                                  )}
                                </div>

                                {adName && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                    <span style={{ fontWeight: 600, color: '#4338ca' }}>Associate Designer (AD):</span>
                                    <span style={{ color: '#3730a3', fontWeight: 700 }}>{adName}</span>
                                  </div>
                                )}

                                {loadingMeetingIds[lead.lead_id] ? (
                                  <button
                                    disabled
                                    style={{ padding: '5px 12px', backgroundColor: '#f97316', color: 'white', borderRadius: '6px', border: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 800, cursor: 'wait' }}
                                  >
                                    <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Starting Meeting...
                                  </button>
                                ) : isInMeeting ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    <span
                                      style={{
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
                                      }}
                                    >
                                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#d97706' }}></span>
                                      🟡 Meeting Started
                                    </span>
                                    {canControlMeeting && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setLoadingMeetingIds(prev => ({ ...prev, [lead.lead_id]: true }));
                                          localStorage.removeItem(startKey);
                                          setLeads(prev => prev.map(l => l.lead_id === lead.lead_id ? { ...l, d1_status: 'meeting_completed', status: (l.status === 'proposal_accepted' || l.status === 'won' || l.status === 'converted') ? l.status : 'meeting_completed' } : l));
                                          axios.post(`${API_BASE_URL}/leads/update-status`, { lead_id: lead.lead_id, status: 'meeting_completed' }).finally(() => {
                                            setLoadingMeetingIds(prev => ({ ...prev, [lead.lead_id]: false }));
                                          });
                                        }}
                                        title="Click to complete consultation meeting"
                                        style={{ padding: '5px 12px', backgroundColor: '#16a34a', color: 'white', borderRadius: '6px', border: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', boxShadow: '0 2px 4px rgba(22, 163, 74, 0.2)' }}
                                      >
                                        <CheckCircle size={14} color="white" /> End Meeting
                                      </button>
                                    )}
                                  </div>
                                ) : canControlMeeting ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setLoadingMeetingIds(prev => ({ ...prev, [lead.lead_id]: true }));
                                      localStorage.setItem(startKey, String(Date.now()));
                                      setLeads(prev => prev.map(l => l.lead_id === lead.lead_id ? { ...l, d1_status: 'in_meeting', status: (l.status === 'proposal_accepted' || l.status === 'won' || l.status === 'converted') ? l.status : 'in_meeting' } : l));
                                      axios.post(`${API_BASE_URL}/leads/update-status`, { lead_id: lead.lead_id, status: 'in_meeting' }).finally(() => {
                                        setLoadingMeetingIds(prev => ({ ...prev, [lead.lead_id]: false }));
                                      });
                                    }}
                                    style={{ padding: '5px 12px', backgroundColor: '#ea580c', color: 'white', borderRadius: '6px', border: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', width: 'fit-content', boxShadow: '0 2px 4px rgba(234, 88, 12, 0.2)' }}
                                  >
                                    <Play size={14} fill="white" /> Start Meeting
                                  </button>
                                ) : null}
                              </div>
                            );
                          }

                          if (isSalesOrAdmin) {
                            return (
                              <button
                                style={{ padding: '6px 12px', backgroundColor: '#111827', color: 'white', borderRadius: '6px', border: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', cursor: 'pointer', marginTop: '4px', width: 'fit-content' }}
                                onClick={() => { setSelectedBookLead(lead); setShowBookModal(true); }}
                              >
                                <Calendar size={14} /> Book Designer
                              </button>
                            );
                          }

                          return (
                            <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontStyle: 'italic', marginTop: '4px' }}>
                              Not Scheduled
                            </div>
                          );
                        })()}
                      </div>
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
                  <td style={{ padding: '10px 16px', textAlign: 'center', position: 'relative', zIndex: activeDropdown === lead.lead_id ? 999 : 'auto' }}>
                    {(() => {
                      const isOpen = activeDropdown === lead.lead_id;
                      const s = (lead.status || '').toLowerCase();
                      const d1s = (lead.d1_status || '').toLowerCase();
                      const isLost = s === 'lost' || s === 'dead' || s === 'dropped' || s === 'cancelled' || d1s === 'cancelled' || d1s === 'lost';
                      const isConverted = s === 'converted' || s === 'won' || d1s === 'converted' || d1s === 'won' || (lead as any).is_converted === 1 || (lead as any).is_converted === '1' || Boolean(lead.project_id);
                      const uRole = String(user?.role || '').toLowerCase();
                      const isAdmin = ['admin', 'administrator', 'superadmin', 'management', 'owner'].includes(uRole) || uRole.includes('admin');
                      const isDesigner = ['d1', 'd2', 'designer', 'lead_designer', 'associate_designer', 'ad', 'graphic_designer', 'gd'].includes(uRole) || uRole.includes('design') || uRole.includes('d1') || uRole.includes('d2');
                      const isSales = ['sales', 'sales_person', 'sales_executive', 'business_associate', 'ba', 'telecaller'].includes(uRole) || (uRole.includes('sales') && !uRole.includes('manager'));
                      const isManagerOrAdmin = !isSales && (isAdmin || ['manager', 'general_manager', 'gm', 'operations_manager', 'om'].includes(uRole) || uRole.includes('manager'));
                      const canControlMeeting = !isSales && (isDesigner || isAdmin);
                      const isSalesOrAdmin = !isDesigner && (isAdmin || ['sales', 'sales_manager', 'sales_person', 'manager', 'business_associate', 'ba'].includes(uRole) || uRole.includes('sales'));
                      const canEditLead = !isDesigner && (isAdmin || isSales || isSalesOrAdmin || ['manager', 'general_manager', 'gm', 'operations_manager', 'om'].includes(uRole) || uRole.includes('manager'));
                      const openUpward = filteredLeads.length >= 5 && idx >= filteredLeads.length - 2;
                      return (
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveDropdown(isOpen ? null : lead.lead_id);
                            }}
                            style={{ 
                              background: isOpen ? '#eff6ff' : 'none', 
                              border: isOpen ? '1.5px solid #2563eb' : 'none', 
                              borderRadius: '6px', 
                              cursor: 'pointer', 
                              color: isOpen ? '#2563eb' : '#6b7280', 
                              padding: '4px',
                              boxShadow: isOpen ? '0 0 0 3px rgba(37, 99, 235, 0.15)' : 'none',
                              transition: 'all 0.15s ease'
                            }}
                            title="More Actions"
                          >
                            <MoreVertical size={18} color={isOpen ? '#2563eb' : '#6b7280'} />
                          </button>
                          {isOpen && (
                            <>
                              <div 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveDropdown(null);
                                }}
                                style={{
                                  position: 'fixed',
                                  top: 0,
                                  left: 0,
                                  right: 0,
                                  bottom: 0,
                                  zIndex: 99990,
                                  cursor: 'default'
                                }}
                              />
                              <div 
                                onClick={(e) => e.stopPropagation()}
                                style={{ 
                                  position: 'absolute', 
                                  right: 0, 
                                  ...(openUpward ? { bottom: 'calc(100% + 4px)' } : { top: 'calc(100% + 4px)' }), 
                                  backgroundColor: 'white', 
                                  borderRadius: '8px', 
                                  boxShadow: '0 15px 30px -5px rgba(0, 0, 0, 0.25)', 
                                  border: '1px solid #cbd5e1', 
                                  zIndex: 99999, 
                                  minWidth: '190px', 
                                  overflow: 'hidden' 
                                }}
                              >
                                {isLost ? (
                                  <>
                                    <div style={{ padding: '8px 12px', fontSize: '0.75rem', fontWeight: 700, color: '#dc2626', backgroundColor: '#fee2e2', borderBottom: '1px solid #fecaca' }}>
                                      ❌ Lead Marked as Lost
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveDropdown(null);
                                        if (window.confirm(`Reopen this lead back to active pipeline?`)) {
                                          handleStatusUpdate(lead.lead_id, lead.d1_booking_time ? 'scheduled' : 'enquiry');
                                        }
                                      }}
                                      style={{ width: '100%', padding: '10px 12px', textAlign: 'left', background: '#eff6ff', border: 'none', borderBottom: '1px solid #dbeafe', cursor: 'pointer', fontSize: '0.85rem', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}
                                    >
                                      <RotateCcw size={14} color="#2563eb" /> Reopen Lead
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
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); handleDeleteLead(lead.lead_id); }}
                                      style={{ width: '100%', padding: '10px 12px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg> Delete
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); setActiveTab('details'); setViewingLead(lead); setShowViewModal(true); }}
                                      style={{ width: '100%', padding: '10px 12px', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', fontSize: '0.85rem', color: '#374151', display: 'flex', alignItems: 'center', gap: '8px' }}
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg> View Details
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveDropdown(null);
                                        setSigLead(lead);
                                        setShowSigModal(true);
                                      }}
                                      style={{ width: '100%', padding: '10px 12px', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', fontSize: '0.85rem', color: '#0284c7', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}
                                    >
                                      <PenTool size={14} color="#0284c7" /> Client Signature {lead.client_signature ? '✓' : ''}
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
                                    {canControlMeeting && lead.status === 'booked' && (
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
                                    {canEditLead && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); handleEditClick(lead); }}
                                        style={{ width: '100%', padding: '10px 12px', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', fontSize: '0.85rem', color: '#374151', display: 'flex', alignItems: 'center', gap: '8px' }}
                                      >
                                        <Pencil size={14} /> Edit
                                      </button>
                                    )}
                                    {canEditLead && !isConverted && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActiveDropdown(null);
                                          if (window.confirm(`Are you sure you want to mark lead "${lead.client_name || 'Client'}" as Deal Lost?`)) {
                                            handleStatusUpdate(lead.lead_id, 'lost');
                                          }
                                        }}
                                        style={{ width: '100%', padding: '10px 12px', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', fontSize: '0.85rem', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}
                                      >
                                        <X size={14} color="#dc2626" /> Deal Lost
                                      </button>
                                    )}
                                    {isAdmin && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); handleStatusUpdate(lead.lead_id, 'cancelled'); }}
                                        style={{ width: '100%', padding: '10px 12px', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', fontSize: '0.85rem', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}
                                      >
                                        <X size={14} color="#dc2626" /> Cancel Booking / Project
                                      </button>
                                    )}
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); handleDeleteLead(lead.lead_id); }}
                                      style={{ width: '100%', padding: '10px 12px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg> Delete
                                    </button>
                                  </>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })()}
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



      {showAddModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div className="premium-card" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
              <h3 style={{ margin: 0, fontSize: '1.4rem' }}>New Customer Enquiry</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#64748b',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#0f172a'; }}
                onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#64748b'; }}
                title="Close"
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
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
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Project ID / Client ID *</label>
                  <input type="text" required value={formData.manual_client_id} onChange={(e) => setFormData({ ...formData, manual_client_id: e.target.value })} placeholder="e.g. PR-101" style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #cbd5e1', outline: 'none' }} />
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
                    <option value="Commercial project">Commercial project</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Scope of Project</label>
                  <select value={formData.project_scope} onChange={(e) => setFormData({ ...formData, project_scope: e.target.value })} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #cbd5e1', outline: 'none' }}>
                    <option value="2 BHK">2 BHK</option>
                    <option value="3 BHK">3 BHK</option>
                    <option value="Villa">Villa</option>
                    <option value="Duplex">Duplex</option>
                    <option value="Other">Other (Type custom scope)</option>
                  </select>
                </div>
              </div>

              {formData.project_scope === 'Other' && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 600, color: '#ea580c' }}>
                    Type Custom Scope of Project *
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={formData.custom_scope}
                    onChange={(e) => setFormData({ ...formData, custom_scope: e.target.value })}
                    placeholder="e.g. 4 BHK, Villa, Penthouse, Commercial Office..."
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: '12px',
                      border: '1.5px solid #ea580c',
                      backgroundColor: '#fffaf0',
                      outline: 'none',
                      fontSize: '0.95rem',
                      fontWeight: 500,
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              )}

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Lead Source *</label>
                {!isAddingCustomSource ? (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <button
                        type="button"
                        onClick={() => setIsAddDropdownOpen(!isAddDropdownOpen)}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 16px',
                          borderRadius: '12px',
                          border: '1.5px solid #cbd5e1',
                          backgroundColor: 'white',
                          outline: 'none',
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                      >
                        <span style={{ fontSize: '0.95rem' }}>{formatLeadSourceLabel(formData.lead_source)}</span>
                        <ChevronDown size={18} style={{ color: '#64748b' }} />
                      </button>

                      {isAddDropdownOpen && (
                        <div style={{
                          position: 'absolute',
                          bottom: 'calc(100% + 4px)',
                          left: 0,
                          right: 0,
                          backgroundColor: 'white',
                          borderRadius: '12px',
                          border: '1px solid #cbd5e1',
                          boxShadow: '0 -10px 25px -5px rgba(0,0,0,0.15)',
                          zIndex: 100,
                          maxHeight: '220px',
                          overflowY: 'auto',
                          padding: '6px'
                        }}>
                          {['walk_in', 'reference', 'website', 'social_media', 'advertisement']
                            .filter(val => !deletedSources.includes(val))
                            .map(val => (
                            <div
                              key={val}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '10px 12px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '0.95rem',
                                color: '#1e293b',
                                backgroundColor: formData.lead_source === val ? '#eff6ff' : 'transparent',
                                fontWeight: formData.lead_source === val ? 600 : 400
                              }}
                              onMouseOver={(e) => {
                                if (formData.lead_source !== val) e.currentTarget.style.backgroundColor = '#f1f5f9';
                              }}
                              onMouseOut={(e) => {
                                if (formData.lead_source !== val) e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                              onClick={() => {
                                setFormData(prev => ({ ...prev, lead_source: val }));
                                setIsAddDropdownOpen(false);
                              }}
                            >
                              <span>{formatLeadSourceLabel(val)}</span>
                              <span
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveSourceAny(val);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  padding: '4px',
                                  borderRadius: '6px',
                                  color: '#ef4444',
                                  cursor: 'pointer',
                                  transition: 'background-color 0.2s'
                                }}
                                onMouseOver={(e) => {
                                  e.currentTarget.style.backgroundColor = '#fee2e2';
                                }}
                                onMouseOut={(e) => {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                                title="Remove lead source"
                              >
                                <X size={14} />
                              </span>
                            </div>
                          ))}

                          {customLeadSources
                            .filter(val => !deletedSources.includes(val))
                            .map(val => (
                            <div
                              key={val}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '10px 12px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '0.95rem',
                                color: '#1e293b',
                                backgroundColor: formData.lead_source === val ? '#eff6ff' : 'transparent',
                                fontWeight: formData.lead_source === val ? 600 : 400
                              }}
                              onMouseOver={(e) => {
                                if (formData.lead_source !== val) e.currentTarget.style.backgroundColor = '#f1f5f9';
                              }}
                              onMouseOut={(e) => {
                                if (formData.lead_source !== val) e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                              onClick={() => {
                                setFormData(prev => ({ ...prev, lead_source: val }));
                                setIsAddDropdownOpen(false);
                              }}
                            >
                              <span>{formatLeadSourceLabel(val)}</span>
                              <span
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveSourceAny(val);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  padding: '4px',
                                  borderRadius: '6px',
                                  color: '#ef4444',
                                  cursor: 'pointer',
                                  transition: 'background-color 0.2s'
                                }}
                                onMouseOver={(e) => {
                                  e.currentTarget.style.backgroundColor = '#fee2e2';
                                }}
                                onMouseOut={(e) => {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                                title="Remove lead source"
                              >
                                <X size={14} />
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAddingCustomSource(true)}
                      title="Add Custom Lead Source"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '45px',
                        height: '45px',
                        borderRadius: '12px',
                        border: '1.5px solid #fca412',
                        backgroundColor: '#fff9f0',
                        color: '#fca412',
                        cursor: 'pointer',
                        fontSize: '1.25rem',
                        fontWeight: 'bold',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = '#fca412';
                        e.currentTarget.style.color = '#ffffff';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = '#fff9f0';
                        e.currentTarget.style.color = '#fca412';
                      }}
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="Type custom lead source name..."
                      value={newCustomSourceName}
                      onChange={(e) => setNewCustomSourceName(e.target.value)}
                      style={{ flex: 1, padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #fca412', outline: 'none' }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSaveCustomSourceInline();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleSaveCustomSourceInline}
                      style={{
                        padding: '12px 16px',
                        borderRadius: '12px',
                        backgroundColor: '#fca412',
                        color: 'white',
                        border: 'none',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingCustomSource(false);
                        setNewCustomSourceName('');
                      }}
                      style={{
                        padding: '12px 16px',
                        borderRadius: '12px',
                        backgroundColor: '#e2e8f0',
                        color: '#475569',
                        border: 'none',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>



              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button type="button" onClick={() => setShowAddModal(false)} style={{ padding: '10px 20px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: 'white' }}>Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {submitting && <Loader2 className="animate-spin" size={16} />}
                  Save Enquiry
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div className="premium-card" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
              <h3 style={{ margin: 0, fontSize: '1.4rem' }}>Edit Customer Enquiry</h3>
              <button
                type="button"
                onClick={() => { setShowEditModal(false); setEditingLead(null); }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#64748b',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#0f172a'; }}
                onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#64748b'; }}
                title="Close"
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
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
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>
                    Project ID / Client ID * {!isAdminRole && <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>🔒 Permanent (Only Admin can change)</span>}
                  </label>
                  <input 
                    type="text" 
                    required 
                    disabled={!isAdminRole}
                    value={formData.manual_client_id} 
                    onChange={(e) => setFormData({ ...formData, manual_client_id: e.target.value })} 
                    placeholder="e.g. PR-101" 
                    style={{ 
                      width: '100%', 
                      padding: '12px 16px', 
                      borderRadius: '12px', 
                      border: '1.5px solid #cbd5e1', 
                      outline: 'none',
                      backgroundColor: !isAdminRole ? '#f1f5f9' : 'white',
                      cursor: !isAdminRole ? 'not-allowed' : 'text',
                      color: !isAdminRole ? '#475569' : '#0f172a'
                    }} 
                  />
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
                    <option value="Commercial project">Commercial project</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Scope of Project</label>
                  <select value={formData.project_scope} onChange={(e) => setFormData({ ...formData, project_scope: e.target.value })} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #cbd5e1', outline: 'none' }}>
                    <option value="2 BHK">2 BHK</option>
                    <option value="3 BHK">3 BHK</option>
                    <option value="Villa">Villa</option>
                    <option value="Duplex">Duplex</option>
                    <option value="Other">Other (Type custom scope)</option>
                  </select>
                </div>
              </div>

              {formData.project_scope === 'Other' && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 600, color: '#ea580c' }}>
                    Type Custom Scope of Project *
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={formData.custom_scope}
                    onChange={(e) => setFormData({ ...formData, custom_scope: e.target.value })}
                    placeholder="e.g. 4 BHK, Villa, Penthouse, Commercial Office..."
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: '12px',
                      border: '1.5px solid #ea580c',
                      backgroundColor: '#fffaf0',
                      outline: 'none',
                      fontSize: '0.95rem',
                      fontWeight: 500,
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              )}

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Lead Source *</label>
                {!isAddingCustomSource ? (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <button
                        type="button"
                        onClick={() => setIsEditDropdownOpen(!isEditDropdownOpen)}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 16px',
                          borderRadius: '12px',
                          border: '1.5px solid #cbd5e1',
                          backgroundColor: 'white',
                          outline: 'none',
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                      >
                        <span style={{ fontSize: '0.95rem' }}>{formatLeadSourceLabel(formData.lead_source)}</span>
                        <ChevronDown size={18} style={{ color: '#64748b' }} />
                      </button>

                      {isEditDropdownOpen && (
                        <div style={{
                          position: 'absolute',
                          bottom: 'calc(100% + 4px)',
                          left: 0,
                          right: 0,
                          backgroundColor: 'white',
                          borderRadius: '12px',
                          border: '1px solid #cbd5e1',
                          boxShadow: '0 -10px 25px -5px rgba(0,0,0,0.15)',
                          zIndex: 100,
                          maxHeight: '220px',
                          overflowY: 'auto',
                          padding: '6px'
                        }}>
                          {['walk_in', 'reference', 'website', 'social_media', 'advertisement']
                            .filter(val => !deletedSources.includes(val))
                            .map(val => (
                            <div
                              key={val}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '10px 12px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '0.95rem',
                                color: '#1e293b',
                                backgroundColor: formData.lead_source === val ? '#eff6ff' : 'transparent',
                                fontWeight: formData.lead_source === val ? 600 : 400
                              }}
                              onMouseOver={(e) => {
                                if (formData.lead_source !== val) e.currentTarget.style.backgroundColor = '#f1f5f9';
                              }}
                              onMouseOut={(e) => {
                                if (formData.lead_source !== val) e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                              onClick={() => {
                                setFormData(prev => ({ ...prev, lead_source: val }));
                                setIsEditDropdownOpen(false);
                              }}
                            >
                              <span>{formatLeadSourceLabel(val)}</span>
                              <span
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveSourceAny(val);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  padding: '4px',
                                  borderRadius: '6px',
                                  color: '#ef4444',
                                  cursor: 'pointer',
                                  transition: 'background-color 0.2s'
                                }}
                                onMouseOver={(e) => {
                                  e.currentTarget.style.backgroundColor = '#fee2e2';
                                }}
                                onMouseOut={(e) => {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                                title="Remove lead source"
                              >
                                <X size={14} />
                              </span>
                            </div>
                          ))}

                          {customLeadSources
                            .filter(val => !deletedSources.includes(val))
                            .map(val => (
                            <div
                              key={val}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '10px 12px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '0.95rem',
                                color: '#1e293b',
                                backgroundColor: formData.lead_source === val ? '#eff6ff' : 'transparent',
                                fontWeight: formData.lead_source === val ? 600 : 400
                              }}
                              onMouseOver={(e) => {
                                if (formData.lead_source !== val) e.currentTarget.style.backgroundColor = '#f1f5f9';
                              }}
                              onMouseOut={(e) => {
                                if (formData.lead_source !== val) e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                              onClick={() => {
                                setFormData(prev => ({ ...prev, lead_source: val }));
                                setIsEditDropdownOpen(false);
                              }}
                            >
                              <span>{formatLeadSourceLabel(val)}</span>
                              <span
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveSourceAny(val);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  padding: '4px',
                                  borderRadius: '6px',
                                  color: '#ef4444',
                                  cursor: 'pointer',
                                  transition: 'background-color 0.2s'
                                }}
                                onMouseOver={(e) => {
                                  e.currentTarget.style.backgroundColor = '#fee2e2';
                                }}
                                onMouseOut={(e) => {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                                title="Remove lead source"
                              >
                                <X size={14} />
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAddingCustomSource(true)}
                      title="Add Custom Lead Source"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '45px',
                        height: '45px',
                        borderRadius: '12px',
                        border: '1.5px solid #fca412',
                        backgroundColor: '#fff9f0',
                        color: '#fca412',
                        cursor: 'pointer',
                        fontSize: '1.25rem',
                        fontWeight: 'bold',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = '#fca412';
                        e.currentTarget.style.color = '#ffffff';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = '#fff9f0';
                        e.currentTarget.style.color = '#fca412';
                      }}
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="Type custom lead source name..."
                      value={newCustomSourceName}
                      onChange={(e) => setNewCustomSourceName(e.target.value)}
                      style={{ flex: 1, padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #fca412', outline: 'none' }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSaveCustomSourceInline();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleSaveCustomSourceInline}
                      style={{
                        padding: '12px 16px',
                        borderRadius: '12px',
                        backgroundColor: '#fca412',
                        color: 'white',
                        border: 'none',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingCustomSource(false);
                        setNewCustomSourceName('');
                      }}
                      style={{
                        padding: '12px 16px',
                        borderRadius: '12px',
                        backgroundColor: '#e2e8f0',
                        color: '#475569',
                        border: 'none',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {/* Consultation Status: Hidden/Removed for Sales Team; ONLY visible to Admin */}
              {(() => {
                const isAdmin = ['admin', 'administrator', 'superadmin', 'management', 'owner'].includes(String(user?.role || '').toLowerCase()) || String(user?.role || '').toLowerCase().includes('admin');
                if (!isAdmin) return null;

                const currentVal = editingLead?.status || formData.status || 'enquiry';
                const currentIdx = leadPipelineOrder.indexOf(currentVal);

                return (
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Consultation Status (Admin Only)</label>
                    <select
                      value={formData.status || 'enquiry'}
                      onChange={(e) => {
                        const newIdx = leadPipelineOrder.indexOf(e.target.value);
                        if (isAdmin || newIdx >= currentIdx || currentIdx === -1) {
                          setFormData({ ...formData, status: e.target.value });
                        }
                      }}
                      style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #cbd5e1', outline: 'none', backgroundColor: '#ffffff', color: '#0c1527', fontWeight: 700 }}
                    >
                      <option value="enquiry">New Lead</option>
                      <option value="scheduled">Scheduled</option>
                      <option value="pending">Pending</option>
                      <option value="meeting_completed">Meeting Done</option>
                      <option value="proposal_sent">Proposal Sent</option>
                      <option value="proposal_accepted">Quote Accepted</option>
                      <option value="converted" disabled={!(formData as any).is_converted && currentVal !== 'converted'} style={{ color: '#94a3b8' }}>
                        Converted (Auto via Stage 1 Payment)
                      </option>
                      <option value="lost">
                        Lost
                      </option>
                    </select>
                  </div>
                );
              })()}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button type="button" onClick={() => { setShowEditModal(false); setEditingLead(null); }} style={{ padding: '10px 20px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: 'white' }}>Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {submitting && <Loader2 className="animate-spin" size={16} />}
                  Update Enquiry
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}
      {/* Book D1 Modal */}
      {showBookModal && (() => {
        const uRole = String(user?.role || '').toLowerCase();
        const isAdmin = ['admin', 'administrator', 'superadmin', 'management', 'owner'].includes(uRole) || uRole.includes('admin');
        const isDesigner = ['d1', 'd2', 'designer', 'lead_designer', 'associate_designer', 'ad', 'graphic_designer', 'gd'].includes(uRole) || uRole.includes('design') || uRole.includes('d1') || uRole.includes('d2');
        const isSales = ['sales', 'sales_person', 'sales_executive', 'business_associate', 'ba', 'telecaller'].includes(uRole) || (uRole.includes('sales') && !uRole.includes('manager'));
        const isManagerOrAdmin = !isSales && (isAdmin || ['manager', 'general_manager', 'gm', 'operations_manager', 'om'].includes(uRole) || uRole.includes('manager'));
        const canControlMeeting = !isSales && (isDesigner || isAdmin);
        const isSalesOrAdmin = !isDesigner && (isAdmin || ['sales', 'sales_manager', 'sales_person', 'manager', 'business_associate', 'ba'].includes(uRole) || uRole.includes('sales'));

        const isTransferred = bookStatus === 'transferred';
        const isRescheduled = bookStatus === 'rescheduled';
        // isCompleted = the lead was ALREADY completed when the popup was opened
        const isCompleted = selectedBookLead?.status === 'meeting_completed' || selectedBookLead?.status === 'completed';
        const isFreshBooking = !selectedBookLead?.d1_assigned_to;
        
        const canEditDesigner = !isDesigner && (isTransferred || isFreshBooking || isSalesOrAdmin);
        const canEditDateTime = !isDesigner && (isTransferred || isRescheduled || isFreshBooking || isSalesOrAdmin);
        
        return (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px', overflowY: 'auto' }}>
            <div style={{ backgroundColor: 'white', padding: '28px', borderRadius: '16px', width: '100%', maxWidth: '420px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: isCompleted ? '#16a34a' : '#111827', margin: 0 }}>
                  {isCompleted ? '✅ Completed Consultation' : (isDesigner ? '📅 Consultation Details' : (selectedBookLead?.d1_assigned_to ? 'Reschedule Designer' : 'Book Designer'))}
                </h2>
                <button
                  type="button"
                  onClick={() => setShowBookModal(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '6px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#64748b',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#0f172a'; }}
                  onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#64748b'; }}
                  title="Close"
                >
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleBookD1Submit}>
                {/* 1. Lead / Primary Designer Selector Dropdown */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#374151', marginBottom: '6px', fontWeight: 700 }}>
                    🎨 Select Lead Designer (D1 / D2) <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    value={selectedD1User}
                    disabled={!canEditDesigner}
                    onChange={(e) => setSelectedD1User(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      outline: 'none',
                      backgroundColor: !canEditDesigner ? '#f1f5f9' : '#ffffff',
                      color: '#0f172a'
                    }}
                    required
                  >
                    <option value="">-- Select Lead Designer --</option>
                    {(() => {
                      let leadDesigners = team.filter(u => {
                        const r = String(u.role || '').toLowerCase();
                        return (r === 'd1' || r === 'd2' || r === 'designer' || r.includes('lead') || r.includes('d1') || r.includes('d2')) && !r.includes('assoc') && !r.includes('assistant');
                      });
                      if (leadDesigners.length === 0) leadDesigners = team;
                      return leadDesigners.map(u => (
                        <option key={`lead-d-${u.user_id}`} value={String(u.user_id)}>
                          {u.name} ({u.role || 'Lead Designer'})
                        </option>
                      ));
                    })()}
                  </select>
                </div>

                {/* 2. Associate Designer Selector Dropdown */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#374151', marginBottom: '6px', fontWeight: 700 }}>
                    📐 Select Associate Designer
                  </label>
                  <select
                    value={selectedAssociateUser}
                    disabled={!canEditDesigner}
                    onChange={(e) => setSelectedAssociateUser(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      outline: 'none',
                      backgroundColor: !canEditDesigner ? '#f1f5f9' : '#ffffff',
                      color: '#0f172a'
                    }}
                  >
                    <option value="">-- Select Associate Designer (Optional) --</option>
                    {(() => {
                      let assocDesigners = team.filter(u => {
                        const r = String(u.role || '').toLowerCase();
                        return r.includes('assoc') || r.includes('associate') || r.includes('assistant');
                      });
                      if (assocDesigners.length === 0) {
                        assocDesigners = team.filter(u => {
                          const r = String(u.role || '').toLowerCase();
                          return !r.includes('lead') && (r.includes('design') || r === 'd2');
                        });
                      }
                      if (assocDesigners.length === 0) assocDesigners = team;
                      return assocDesigners.map(u => (
                        <option key={`assoc-d-${u.user_id}`} value={String(u.user_id)}>
                          {u.name} ({u.role || 'Associate Designer'})
                        </option>
                      ));
                    })()}
                  </select>
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
                      min={getTodayDateString()}
                      disabled={!canEditDateTime}
                      onChange={(e) => {
                        const val = e.target.value;
                        const todayStr = getTodayDateString();
                        const validDate = (val && val >= todayStr) ? val : todayStr;
                        setBookDate(validDate);
                        const nextValid = getFirstAvailableSlot(validDate);
                        setBookTime(nextValid || (validDate > todayStr ? '10:00' : ''));
                        try { (e.target as HTMLElement).blur(); } catch (_) {}
                      }}
                      style={{ width: '100%', padding: '10px 10px 10px 36px', borderRadius: '8px', border: '1px solid #d1d5db', outline: 'none', color: '#374151', fontSize: '0.9rem', backgroundColor: !canEditDateTime ? '#f1f5f9' : '#ffffff' }}
                      required
                    />
                  </div>
                </div>
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label style={{ fontSize: '0.85rem', color: '#374151', margin: 0, fontWeight: 700 }}>Select Time Slot <span style={{ color: '#ef4444' }}>*</span></label>
                    {!selectedD1User && (
                      <span style={{ fontSize: '0.74rem', color: '#ea580c', fontWeight: 600 }}>⚠️ Select Lead Designer above to check slots</span>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    {FIXED_SLOTS.map((slot) => {
                      const info = getSlotBookingInfo(slot.value);
                      const isCurrentBooking = info.isBooked && info.isCurrentLeadBooking;
                      const isBookedByOther = info.isBooked && !info.isCurrentLeadBooking;
                      const isPast = isSlotPastTime(slot.value, bookDate);
                      const disabled = !canEditDateTime || isBookedByOther || (isPast && !isCurrentBooking);
                      const selected = bookTime === slot.value;
                      return (
                        <button
                          key={slot.value}
                          type="button"
                          disabled={disabled}
                          onClick={() => setBookTime(slot.value)}
                          style={{
                            padding: '10px 6px',
                            borderRadius: '8px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: disabled ? 'not-allowed' : 'pointer',
                            border: isCurrentBooking ? '2px solid #16a34a' : (selected ? '2px solid #f97316' : disabled ? '1px dashed #cbd5e1' : '1px solid #e5e7eb'),
                            backgroundColor: isCurrentBooking ? '#f0fdf4' : (selected ? '#fff7ed' : (disabled ? '#f1f5f9' : 'white')),
                            color: isCurrentBooking ? '#166534' : (selected ? '#ea580c' : (disabled ? '#94a3b8' : '#374151')),
                            textDecoration: isBookedByOther ? 'line-through' : 'none',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '2px',
                            transition: 'all 0.2s',
                            opacity: (disabled && !isCurrentBooking) ? 0.6 : 1
                          }}
                        >
                          <span>{slot.label}</span>
                          {isCurrentBooking && (
                            <span style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 800 }}>✓ Current Booking</span>
                          )}
                          {isBookedByOther && (
                            <span style={{ fontSize: '0.7rem', color: '#ef4444', textDecoration: 'none', fontWeight: 700 }} title={`Booked for ${info.bookedClientName}`}>🔒 Already Booked</span>
                          )}
                          {!info.isBooked && isPast && (
                            <span style={{ fontSize: '0.7rem', color: '#64748b', textDecoration: 'none', fontWeight: 600 }}>⛔ Passed</span>
                          )}
                          {!info.isBooked && !isPast && (
                            <span style={{ fontSize: '0.7rem', color: '#16a34a', textDecoration: 'none', fontWeight: 600 }}>🟢 Available</span>
                          )}
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
                    disabled={isCompleted}
                    onChange={(e) => setD1Notes(e.target.value)}
                    placeholder="Add any specific client preferences or meeting notes..."
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', outline: 'none', fontSize: '0.85rem', fontFamily: 'inherit', backgroundColor: isCompleted ? '#f1f5f9' : '#ffffff' }}
                  />
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#374151', marginBottom: '6px', fontWeight: 500 }}>Consultation Status</label>
                  {(() => {
                    const d1StatusOrder = ['enquiry', 'booked', 'in_meeting', 'rescheduled', 'transferred', 'cancelled', 'meeting_completed'];
                    const currentVal = selectedBookLead?.d1_status || selectedBookLead?.status || bookStatus || 'enquiry';
                    const currentIdx = d1StatusOrder.indexOf(currentVal);
                    const savedBookingTime = selectedBookLead?.d1_booking_time || selectedBookLead?.booking_time || '';
                    const savedParts = savedBookingTime ? savedBookingTime.split(' ') : [];
                    const savedDate = savedParts[0] || getTodayDateString();
                    const isSavedFutureDate = savedDate > getTodayDateString();

                    const formatMeetingNoticeText = (dateTimeStr: string, dateOnlyStr: string) => {
                      if (!dateTimeStr) return { timeText: dateOnlyStr, dateText: dateOnlyStr };
                      const parts = dateTimeStr.trim().split(' ');
                      const dPart = parts[0] || dateOnlyStr;
                      const tPart = parts[1] || '';

                      let dText = dPart;
                      const dObj = new Date(dPart + 'T00:00:00');
                      if (!isNaN(dObj.getTime())) {
                        dText = dObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                      }

                      let tText = '';
                      if (tPart) {
                        const timeParts = tPart.split(':');
                        const hours = parseInt(timeParts[0], 10);
                        const minutes = timeParts[1] || '00';
                        if (!isNaN(hours)) {
                          const ampm = hours >= 12 ? 'PM' : 'AM';
                          const h12 = hours % 12 || 12;
                          tText = `${String(h12).padStart(2, '0')}:${minutes} ${ampm}`;
                        }
                      }

                      const fullTimeText = tText ? `${dText} at ${tText}` : dText;
                      return { timeText: fullTimeText, dateText: dText };
                    };

                    const { timeText: formattedTimeStr, dateText: formattedDateStr } = formatMeetingNoticeText(savedBookingTime, savedDate);
                    
                    const effectiveValue = ['meeting_completed', 'completed'].includes(bookStatus) ? 'meeting_completed' : 'in_meeting';
                    return (
                      <select
                        value={bookStatus}
                        disabled={isCompleted}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'in_meeting' || val === 'meeting_completed' || val === 'completed') {
                            if (!canControlMeeting) {
                              alert('⚠️ Only Designers can start and complete consultation meetings.');
                              return;
                            }
                            if (isSavedFutureDate) {
                              alert(`⚠️ Scheduled Consultation Notice:\n\nThis meeting is scheduled for ${formattedTimeStr}.\n"Start Meeting" and "End Meeting" actions will unlock on ${formattedDateStr}.`);
                              return;
                            }
                          }
                          setBookStatus(val);
                        }}
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid #cbd5e1', outline: 'none', fontSize: '0.85rem', color: '#374151', fontWeight: 700, backgroundColor: isCompleted ? '#f1f5f9' : '#ffffff' }}
                      >
                        <option value="booked">📅 Scheduled</option>
                        {canControlMeeting && <option value="in_meeting">▶️ Start Meeting</option>}
                        {!isDesigner && <option value="rescheduled">🔄 Rescheduled</option>}
                        {!isDesigner && <option value="transferred">🔀 Transferred</option>}
                        {!isDesigner && <option value="cancelled">❌ Cancelled</option>}
                        {canControlMeeting && <option value="meeting_completed">✅ Meeting Completed</option>}
                      </select>
                    );
                  })()}
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button type="button" onClick={() => setShowBookModal(false)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #e5e7eb', backgroundColor: 'white', color: '#374151', fontWeight: 500 }}>
                    {isCompleted ? 'Close' : 'Cancel'}
                  </button>
                  {!isCompleted && (() => {
                    let btnText = '📅 Confirm Booking';
                    let btnBg = '#2563eb';

                    if (bookStatus === 'booked' || isFreshBooking) {
                      btnText = '📅 Confirm Booking';
                      btnBg = '#2563eb';
                    } else if (bookStatus === 'in_meeting') {
                      btnText = canControlMeeting ? '▶️ Start Meeting' : '💾 Update Details';
                      btnBg = canControlMeeting ? '#ea580c' : '#2563eb';
                    } else if (['meeting_completed', 'completed'].includes(bookStatus)) {
                      btnText = canControlMeeting ? '✅ End Meeting' : '💾 Update Details';
                      btnBg = canControlMeeting ? '#16a34a' : '#2563eb';
                    } else if (bookStatus === 'rescheduled') {
                      btnText = '🔄 Confirm Reschedule';
                      btnBg = '#8b5cf6';
                    } else if (bookStatus === 'transferred') {
                      btnText = '🔀 Confirm Transfer';
                      btnBg = '#0284c7';
                    } else if (bookStatus === 'cancelled') {
                      btnText = '❌ Cancel Meeting';
                      btnBg = '#dc2626';
                    }

                    return (
                      <button 
                        type="submit" 
                        disabled={submitting} 
                        style={{ 
                          flex: 1, 
                          padding: '10px', 
                          borderRadius: '8px', 
                          border: 'none', 
                          backgroundColor: btnBg, 
                          color: 'white', 
                          fontWeight: 700, 
                          cursor: submitting ? 'wait' : 'pointer',
                          fontSize: '0.9rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px'
                        }}
                      >
                        {submitting ? <><Loader2 className="animate-spin" size={20} /> <span>Booking Slot...</span></> : btnText}
                      </button>
                    );
                  })()}
                </div>
              </form>
            </div>
          </div>
        );
      })()}
      {showViewModal && viewingLead && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div className="premium-card" style={{ width: '100%', maxWidth: '650px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: '#0c1527' }}>Customer Details</h3>
                <span style={{ backgroundColor: '#fca412', color: '#ffffff', fontSize: '0.78rem', fontWeight: 800, padding: '3px 10px', borderRadius: '12px', letterSpacing: '0.5px' }}>
                  Project ID / Client ID: {viewingLead.manual_client_id || viewingLead.lead_id}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowViewModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#64748b',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#0f172a'; }}
                onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#64748b'; }}
                title="Close"
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px' }}>

            <div style={{ display: 'flex', gap: '16px', borderBottom: '1.5px solid #ffe8c2', marginBottom: '24px', backgroundColor: '#fff9f0', padding: '6px 12px', borderRadius: '10px' }}>
              <button onClick={() => setActiveTab('details')} style={{ padding: '8px 16px', background: 'none', border: 'none', borderBottom: activeTab === 'details' ? '3px solid #fca412' : '3px solid transparent', color: activeTab === 'details' ? '#fca412' : '#6b7280', fontWeight: 800, cursor: 'pointer' }}>Details</button>
              <button onClick={() => setActiveTab('notes')} style={{ padding: '8px 16px', background: 'none', border: 'none', borderBottom: activeTab === 'notes' ? '3px solid #fca412' : '3px solid transparent', color: activeTab === 'notes' ? '#fca412' : '#6b7280', fontWeight: 800, cursor: 'pointer' }}>Notes</button>
              <button onClick={() => setActiveTab('files')} style={{ padding: '8px 16px', background: 'none', border: 'none', borderBottom: activeTab === 'files' ? '3px solid #fca412' : '3px solid transparent', color: activeTab === 'files' ? '#fca412' : '#6b7280', fontWeight: 800, cursor: 'pointer' }}>Files</button>
              <button onClick={() => setActiveTab('quotes')} style={{ padding: '8px 16px', background: 'none', border: 'none', borderBottom: activeTab === 'quotes' ? '3px solid #fca412' : '3px solid transparent', color: activeTab === 'quotes' ? '#fca412' : '#6b7280', fontWeight: 800, cursor: 'pointer' }}>Quotation</button>
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
                  <p style={{ margin: '0 0 4px 0', fontSize: '0.85rem', color: '#6b7280' }}>Project ID / Client ID</p>
                  <p style={{ margin: 0, fontWeight: 500 }}>{viewingLead.manual_client_id || 'N/A'}</p>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <p style={{ margin: '0 0 4px 0', fontSize: '0.85rem', color: '#6b7280' }}>Client Address</p>
                  <p style={{ margin: 0, fontWeight: 500, whiteSpace: 'pre-wrap' }}>{viewingLead.client_address}</p>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <p style={{ margin: '0 0 4px 0', fontSize: '0.85rem', color: '#6b7280' }}>Site Location</p>
                  <p style={{ margin: 0, fontWeight: 500, whiteSpace: 'pre-wrap' }}>{viewingLead.location}</p>
                </div>
                <div>
                  <p style={{ margin: '0 0 4px 0', fontSize: '0.85rem', color: '#6b7280' }}>Project Scope</p>
                  <p style={{ margin: 0, fontWeight: 500, whiteSpace: 'pre-wrap' }}>{viewingLead.project_scope} {viewingLead.project_scope === 'Custom' || viewingLead.project_scope === 'Other' ? `- ${viewingLead.custom_scope}` : ''}</p>
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
                          <p style={{ margin: 0, fontSize: '0.9rem', color: '#374151', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{viewingLead.d1_notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'notes' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '300px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <textarea
                    rows={3}
                    value={newNote}
                    onChange={e => setNewNote(e.target.value)}
                    placeholder="Add a multi-line note... (Press Ctrl+Enter to submit)"
                    style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', outline: 'none', resize: 'vertical', minHeight: '70px', fontFamily: 'inherit', fontSize: '0.9rem' }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        handleAddNote();
                      }
                    }}
                  />
                  <button onClick={handleAddNote} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#111827', color: 'white', fontWeight: 600, cursor: 'pointer', height: 'fit-content', alignSelf: 'flex-start' }}>Add Note</button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {notes.length === 0 ? <p style={{ color: '#6b7280', textAlign: 'center', marginTop: '24px' }}>No notes found.</p> : notes.map(note => (
                    <div key={note.id} style={{ padding: '12px 16px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                      <p style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: '#374151', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{note.note_text}</p>
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
                          <a
                            href={getFileUrl(file.url)}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            style={{ display: 'block', margin: '0 0 2px 0', fontWeight: 700, color: '#2563eb', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: 'none' }}
                          >
                            📄 {file.name.replace(/^\d+_/, '')} (Click to View PDF)
                          </a>
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
        </div>
      )}

      {/* START PROJECT CONVERT MODAL */}
      {showConvertModal && isAdminOrPM && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '20px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '520px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            
            {/* Fixed Header with X Close Button */}
            <div style={{ padding: '20px 24px', borderBottom: '1.5px solid #e2e8f0', backgroundColor: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#111827', fontWeight: 800 }}>Start Project — 5-Stage Payment Flow</h3>
                <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: '0.82rem' }}>
                  Starting project for <strong>{selectedLead?.client_name}</strong>
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => setShowConvertModal(false)}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', transition: 'all 0.15s ease' }}
                title="Close Modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
              <form onSubmit={handleConversionSubmit}>
                {/* Project ID Auto-Assigned Field */}
                <div style={{ marginBottom: '16px', backgroundColor: '#f0f4ff', padding: '12px', borderRadius: '10px', border: '1.5px solid #c7d2fe' }}>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 800, color: '#1e1b4b' }}>
                    <span>Project ID (Auto-Assigned)</span>
                    <span style={{ fontSize: '0.7rem', backgroundColor: '#4338ca', color: '#ffffff', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 }}>Auto</span>
                  </label>
                  <input 
                    type="text" 
                    readOnly 
                    value={convertData.project_code || selectedLead?.manual_client_id || `PR-${selectedLead?.lead_id}`} 
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid #a5b4fc', fontSize: '0.95rem', fontWeight: 700, outline: 'none', background: '#e0e7ff', color: '#1e1b4b', cursor: 'not-allowed' }} 
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 700, color: '#374151' }}>Project Name *</label>
                  <input type="text" required value={convertData.project_name} onChange={(e) => setConvertData({ ...convertData, project_name: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', outline: 'none' }} />
                </div>

                {/* Budgeted Amount (Initial Quotation Amount) Input Field */}
                <div style={{ marginBottom: '16px', backgroundColor: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1.5px solid #cbd5e1' }}>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 800, color: '#0f172a' }}>
                    <span>Budgeted / Initial Quotation Amount (₹) *</span>
                    {convertData.total_budget ? (
                      <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 700 }}>
                        ⭐ Initial Quotation Amount: ₹{Math.round(Number(convertData.total_budget) || 0).toLocaleString('en-IN')}
                      </span>
                    ) : null}
                  </label>
                  <input 
                    type="number" 
                    required 
                    placeholder="Enter Budgeted Initial Quotation Amount (e.g. 500000)" 
                    value={convertData.total_budget} 
                    onChange={(e) => setConvertData({ ...convertData, total_budget: e.target.value })} 
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid #94a3b8', fontSize: '0.95rem', fontWeight: 700, outline: 'none', background: '#ffffff', color: '#0f172a' }} 
                  />
                  {Boolean(convertData.total_budget) && (
                    <span style={{ fontSize: '0.75rem', color: '#0369a1', fontWeight: 700, marginTop: '4px', display: 'block' }}>
                      Formatted Amount: ₹{Math.round(Number(convertData.total_budget) || 0).toLocaleString('en-IN')}
                    </span>
                  )}
                </div>

                {/* Stage 1: Token Advance Payment Input */}
                <div style={{ marginBottom: '16px', backgroundColor: '#fff9f0', padding: '14px', borderRadius: '12px', border: '1.5px solid #ffe8c2' }}>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 800, color: '#9a3412' }}>
                    <span>Stage 1: Token Advance Paid (₹)</span>
                    {convertData.total_budget && (
                      <span style={{ fontSize: '0.72rem', color: '#ea580c', fontWeight: 700 }}>
                        10% Target: ₹{Math.round((Number(convertData.total_budget) || 0) * 0.1).toLocaleString('en-IN')}
                      </span>
                    )}
                  </label>
                  <input 
                    type="number" 
                    placeholder="Enter Token Advance Paid on Start Project (e.g. 50000)" 
                    value={convertData.advance_paid} 
                    onChange={(e) => setConvertData({ ...convertData, advance_paid: e.target.value })} 
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid #fca412', fontSize: '0.95rem', fontWeight: 700, outline: 'none', background: '#ffffff', color: '#0c1527' }} 
                  />
                  {Boolean(convertData.advance_paid) && (
                    <span style={{ fontSize: '0.75rem', color: '#c2410c', fontWeight: 700, marginTop: '4px', display: 'block' }}>
                      Formatted Advance: ₹{Math.round(Number(convertData.advance_paid) || 0).toLocaleString('en-IN')}
                    </span>
                  )}

                  {/* Live Stage 1 Advance vs Remaining Breakdown */}
                  {Boolean(convertData.total_budget) && (
                    <div style={{ marginTop: '10px', backgroundColor: '#ffffff', padding: '10px 12px', borderRadius: '8px', border: '1px solid #fed7aa', fontSize: '0.80rem' }}>
                      {(() => {
                        const totalB = Math.round(Number(convertData.total_budget) || 0);
                        const target10 = Math.round(totalB * 0.1);
                        const prevPaid = Math.round(Number((selectedLead as any)?.advance_paid || (selectedLead as any)?.advance_received) || 0);
                        const nowInput = Math.round(Number(convertData.advance_paid) || 0);
                        const accumPaid = Math.min(totalB > 0 ? totalB : Infinity, prevPaid + nowInput);
                        const accumP = totalB > 0 ? (accumPaid / totalB) * 100 : 0;
                        const remAmt = Math.max(0, target10 - accumPaid);
                        const remP = totalB > 0 ? (remAmt / totalB) * 100 : 0;

                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            {prevPaid > 0 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#0369a1', fontWeight: 700 }}>
                                <span>💳 Previously Paid Advance:</span>
                                <span>₹{prevPaid.toLocaleString('en-IN')}</span>
                              </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#15803d', fontWeight: 700 }}>
                              <span>✅ Total Stage 1 Paid ({accumP.toFixed(1)}%):</span>
                              <span>₹{accumPaid.toLocaleString('en-IN')}</span>
                            </div>
                            {remAmt > 0 ? (
                              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#c2410c', fontWeight: 700 }}>
                                <span>⏳ Remaining Stage 1 Balance ({remP.toFixed(1)}%):</span>
                                <span>₹{remAmt.toLocaleString('en-IN')}</span>
                              </div>
                            ) : (
                              <div style={{ color: '#166534', fontWeight: 700, fontSize: '0.80rem', marginTop: '2px', backgroundColor: '#dcfce7', padding: '6px 10px', borderRadius: '6px', textAlign: 'center' }}>
                                🎉 Stage 1 (10% Target) Will Be Fully Satisfied! Project Will Start.
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  <div style={{ fontSize: '0.75rem', color: '#ea580c', marginTop: '6px', fontWeight: 600 }}>
                    Initiates Client Registration, Design Team Allocation &amp; Kick-off
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 700, color: '#374151' }}>Start Date</label>
                  <input type="date" required value={convertData.start_date} onChange={(e) => setConvertData({ ...convertData, start_date: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', outline: 'none' }} />
                </div>

                {/* 5-Stage Payment Milestones Summary */}
                <div style={{ marginBottom: '24px', backgroundColor: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '0.78rem', color: '#334155' }}>
                  <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>5-Stage Payment Milestones:</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div>• <strong>01: 10% — Initial Booking:</strong> Submitted after finalizing requirements, proposal &amp; client approval.</div>
                    <div>• <strong>02: 10% — For Masking (20% Cumulative):</strong> After completion of 3D designs &amp; before masking day.</div>
                    <div>• <strong>03: 40% — Production Start (60% Cumulative):</strong> After designs &amp; material deck approved, Works contract time.</div>
                    <div>• <strong>04: 35% — Material Dispatch (95% Cumulative):</strong> Initiated after material readiness on factory confirmation. Ready to dispatch time.</div>
                    <div>• <strong>05: 5% — Handover Time (100% Cumulative):</strong> Post installation completion &amp; expert quality check, before handover.</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setShowConvertModal(false)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: 'white', fontWeight: 600, color: '#374151' }}>Cancel</button>
                  <button type="submit" disabled={submitting} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', backgroundColor: '#16a34a', color: 'white', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(22,163,74,0.3)' }}>
                    {submitting && <Loader2 className="animate-spin" size={16} />}
                    Start Project Now
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showSigModal && (
        <ClientSignatureModal
          isOpen={showSigModal}
          onClose={() => setShowSigModal(false)}
          clientName={sigLead?.client_name || 'Client'}
          leadId={sigLead?.lead_id}
          projectId={sigLead?.project_id || sigLead?.project_code || sigLead?.manual_client_id}
          existingSignature={(sigLead as any)?.client_signature || ''}
          onSignatureSaved={(sigDataUrl) => {
            if (sigLead) {
              setLeads(prev => prev.map(l => l.lead_id === sigLead.lead_id ? { ...l, client_signature: sigDataUrl } : l));
            }
          }}
        />
      )}

    </div>
  );
};
