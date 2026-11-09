import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar, Clock, MapPin, Phone, CheckCircle, Clock3, User, Briefcase,
  Loader2, Play, CheckCircle2, FileText, Upload, FolderPlus, Trash2,
  Eye, Download, Plus, MessageSquare, Folder, ArrowLeft, X, DollarSign, Tag, Info, CheckSquare, Users, UserCheck,
  Receipt, ArrowRight
} from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import { useAuth } from '../hooks/useAuth';
import { DashboardFilterBar } from '../components/DashboardFilterBar';
import type { StatementPeriodType, ProjectTypeFilter } from '../components/DashboardFilterBar';

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
  d1_status?: string;
  d1_assigned_to?: number;
  d1_booking_time?: string;
  d1_notes?: string;
  associate_designer_assigned_id?: any;
  associate_designer_assigned_name?: string;
  d1_assigned_name?: string;
  project_scope?: string;
  mmts_status?: string;
  mmts_booking_time?: string;
  qc_status?: string;
  qc_booking_time?: string;
  booking_time?: string;
  created_at?: string;
}

export const D1Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const uRole = String(user?.role || '').toLowerCase();
  const isAdminOrPM = ['admin', 'administrator', 'superadmin', 'management', 'owner', 'project_manager', 'pm', 'project_head'].includes(uRole) || uRole.includes('admin') || Boolean(user?.is_admin);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [reimbursements, setReimbursements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [myTargets, setMyTargets] = useState<any[]>([]);
  const [statementPeriod, setStatementPeriod] = useState<StatementPeriodType>('all');
  const [projectType, setProjectType] = useState<ProjectTypeFilter>('all');
  const [customDates, setCustomDates] = useState<{ startDate: string; endDate: string }>({ startDate: '', endDate: '' });
  const [nowTick, setNowTick] = useState(Date.now());
  const [loadingMeetingIds, setLoadingMeetingIds] = useState<{ [id: string]: boolean }>({});

  // Quick Add Task Modal State
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [newTaskForm, setNewTaskForm] = useState({
    task_title: '',
    description: '',
    project_name: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const [team, setTeam] = useState<any[]>([]);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [convertData, setConvertData] = useState({
    project_code: '',
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
  const [modalTab, setModalTab] = useState<'notes' | 'files' | 'mmts' | 'qc'>('notes');
  const [notes, setNotes] = useState<any[]>([]);
  const [qcDate, setQcDate] = useState('');
  const [qcTime, setQcTime] = useState('');
  const [qcNotes, setQcNotes] = useState('');
  const [mmtsDate, setMmtsDate] = useState('');
  const [mmtsTime, setMmtsTime] = useState('');
  const [mmtsNotes, setMmtsNotes] = useState('');
  const [newNote, setNewNote] = useState('');
  const [filesData, setFilesData] = useState<{ folders: any[]; files: any[] }>({ folders: [], files: [] });
  const [currentFolder, setCurrentFolder] = useState('');
  const [uploading, setUploading] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [existingQuotes, setExistingQuotes] = useState<any[]>([]);

  const isRealQuote = (q: any) => {
    if (!q) return false;
    const qid = String(q.quote_id || '');
    if (!qid || qid.startsWith('lead-') || qid.startsWith('p-') || q.is_placeholder || q.is_synthetic) return false;
    const num = Number(qid);
    return !isNaN(num) && num > 0;
  };

  const fetchExistingQuotes = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/quotes?real_only=1`);
      if (res.data && res.data.success && Array.isArray(res.data.data)) {
        setExistingQuotes(res.data.data.filter(isRealQuote));
      }
    } catch (e) {}
  };

  const hasQuotationCreated = (lead: Lead) => {
    if (!lead) return false;
    const lId = String(lead.lead_id || '').trim();
    const mcId = String(lead.manual_client_id || '').trim().toLowerCase();
    const pCode = String((lead as any).project_code || '').trim().toLowerCase();
    const pId = String((lead as any).project_id || '').trim().toLowerCase();
    const cName = String(lead.client_name || '').trim().toLowerCase();
    const cleanNum = lId.replace(/[^0-9]/g, '');

    const matchingQuote = existingQuotes.find(q => {
      if (!isRealQuote(q)) return false;
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

    const st = String(matchingQuote.status || '').toLowerCase();
    const isQCApproved = Boolean(
      matchingQuote.is_final_version || 
      matchingQuote.is_final || 
      st === 'qc_approved' || 
      st === 'finalized' || 
      st === 'approved' ||
      localStorage.getItem(`qc_approved_lead_${lead.lead_id}`) === 'true'
    );

    return isQCApproved;
  };

  const [existingAgreements, setExistingAgreements] = useState<any[]>([]);

  const fetchExistingAgreements = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/agreements`);
      if (res.data && (res.data.success || Array.isArray(res.data.data) || Array.isArray(res.data))) {
        const list = Array.isArray(res.data.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
        setExistingAgreements(list);
      }
    } catch (e) {}
  };

  const hasAgreementSigned = (lead: Lead) => {
    if (!lead) return { exists: false, isSigned: false };
    const lId = String(lead.lead_id || '').trim().toLowerCase();
    const mcId = String(lead.manual_client_id || '').trim().toLowerCase();
    const pCode = String((lead as any).project_code || '').trim().toLowerCase();
    const pId = String((lead as any).project_id || '').trim().toLowerCase();
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

  useEffect(() => {
    if (user) {
      fetchAssignedLeads();
      fetchTeam();
      fetchMyTargets();
      fetchExistingQuotes();
      fetchExistingAgreements();
    }
  }, [user]);

  const [leadNoticeMsgs, setLeadNoticeMsgs] = useState<{ [leadId: string]: string }>({});

  const triggerLeadNotice = (leadId: string | number, msg: string) => {
    const key = String(leadId);
    setLeadNoticeMsgs(prev => ({ ...prev, [key]: msg }));
    setTimeout(() => {
      setLeadNoticeMsgs(prev => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
    }, 4000);
  };

  const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

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

  const isFutureMeeting = (lead: Lead) => {
    const savedBookingTime = lead?.d1_booking_time || lead?.booking_time || '';
    const savedParts = savedBookingTime ? savedBookingTime.split(' ') : [];
    const savedDate = savedParts[0] || '';
    return Boolean(savedDate && savedDate > getTodayDateString());
  };

  const handleStatusChange = async (leadId: string | number, status: string) => {
    if (!user) return;
    const targetLead = leads.find(l => String(l.lead_id) === String(leadId));

    // ⚡ INSTANT OPTIMISTIC UI UPDATE (0ms lag)
    setLeads(prev => prev.map(l => String(l.lead_id) === String(leadId) ? { ...l, d1_status: status, status: status } : l));

    try {
      const response = await axios.post(`${API_BASE_URL}/leads/update-status`, {
        lead_id: leadId,
        status: status
      });
      if (response.data.success) {
        axios.post(`${API_BASE_URL}/leads/book-d1`, {
          lead_id: leadId,
          status: status,
          d1_notes: targetLead?.d1_notes || ''
        }).catch(() => {});
      } else {
        alert(response.data.message || 'Failed to update status');
        fetchAssignedLeads();
      }
    } catch (err) {
      alert('Error updating status');
      fetchAssignedLeads();
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
      const uId = String(user?.user_id || '').trim();
      const uName = (user?.name || '').trim().toLowerCase();
      const uRole = String(user?.role || '').toLowerCase();

      const [leadsRes, tasksRes, reimbRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/leads`),
        axios.get(`${API_BASE_URL}/mb-tasks`).catch(() => ({ data: { success: false, data: [] } })),
        axios.get(`${API_BASE_URL}/reimbursements`, { headers: { 'X-User-Id': uId, 'X-User-Role': uRole } }).catch(() => ({ data: { success: false, data: [] } }))
      ]);

      if (leadsRes.data.success) {
        const myLeads = (leadsRes.data.data || []).filter((lead: Lead) => {
          const hasBooking = Boolean(lead.d1_booking_time || lead.d1_assigned_to || (lead as any).associate_designer_assigned_id);
          if (!hasBooking) return false;

          const d1Ids = String(lead.d1_assigned_to || '').split(',').map(s => s.trim());
          const isD1 = uId !== '' && d1Ids.includes(uId);

          const d1Name = String((lead as any).d1_assigned_name || '').trim().toLowerCase();
          const isD1Name = Boolean(uName && d1Name && (d1Name === uName || d1Name.includes(uName) || uName.includes(d1Name)));

          const adIds = String((lead as any).associate_designer_assigned_id || '').split(',').map(s => s.trim());
          const isAd = uId !== '' && adIds.includes(uId);

          const adName = String((lead as any).associate_designer_assigned_name || '').trim().toLowerCase();
          const isAdName = Boolean(uName && adName && (adName === uName || adName.includes(uName) || uName.includes(adName)));

          // Strictly match only the logged-in user's own assigned bookings
          return isD1 || isD1Name || isAd || isAdName;
        });
        setLeads(myLeads);
      }

      if (tasksRes.data?.success && Array.isArray(tasksRes.data.data)) {
        const myTasks = tasksRes.data.data.filter((t: any) =>
          (t.employee_name && t.employee_name.toLowerCase() === uName) ||
          (t.user_id && String(t.user_id) === uId)
        );
        setTasks(myTasks);
      }

      if (reimbRes.data?.success && Array.isArray(reimbRes.data.data)) {
        setReimbursements(reimbRes.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNewTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskForm.task_title.trim()) return alert('Please enter task title');
    setSavingTask(true);
    try {
      const payload = {
        user_id: user?.user_id,
        employee_name: user?.name,
        role: user?.role,
        task_title: newTaskForm.task_title.trim(),
        description: newTaskForm.description.trim(),
        project_name: newTaskForm.project_name.trim(),
        start_date: newTaskForm.start_date,
        end_date: newTaskForm.end_date,
        sub_tasks: []
      };
      const res = await axios.post(`${API_BASE_URL}/mb-tasks`, payload);
      if (res.data?.success) {
        alert('Task proposed successfully!');
        setShowAddTaskModal(false);
        setNewTaskForm({
          task_title: '',
          description: '',
          project_name: '',
          start_date: new Date().toISOString().split('T')[0],
          end_date: new Date().toISOString().split('T')[0]
        });
        fetchAssignedLeads();
      } else {
        alert(res.data?.message || 'Failed to propose task');
      }
    } catch (err) {
      console.error(err);
      alert('Error proposing task');
    } finally {
      setSavingTask(false);
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

  const handleBookMMTS = async () => {
    if (!mmtsDate || !mmtsTime || !viewingLeadModal) {
      alert("Please select a date and time for MMTS slot.");
      return;
    }
    const dt = `${mmtsDate} ${mmtsTime}:00`;
    try {
      const res = await axios.post(`${API_BASE_URL}/leads/book-mmts`, {
        lead_id: viewingLeadModal.lead_id,
        booking_time: dt,
        assigned_by_name: user?.name,
        mmts_notes: mmtsNotes
      });
      if (res.data.success) {
        alert(res.data.message);
        setMmtsDate(''); setMmtsTime(''); setMmtsNotes('');
        fetchAssignedLeads();
        setViewingLeadModal({...viewingLeadModal, mmts_status: 'booked', mmts_booking_time: dt});
      } else { alert("Failed: " + res.data.message); }
    } catch (error) { console.error("MMTS booking error", error); }
  };

  const handleUpdateMMTSStatus = async (status: string) => {
    if (!viewingLeadModal) return;
    try {
      const res = await axios.post(`${API_BASE_URL}/leads/update-mmts-status`, {
        lead_id: viewingLeadModal.lead_id,
        status: status,
        assigned_by_name: user?.name
      });
      if (res.data.success) {
        alert(res.data.message);
        fetchAssignedLeads();
        setViewingLeadModal({...viewingLeadModal, mmts_status: status});
      }
    } catch (e) { console.error("Update MMTS status error", e); }
  };

  const handleBookQC = async () => {
    if (!qcDate || !qcTime || !viewingLeadModal) {
      alert("Please select a date and time for QC slot.");
      return;
    }
    const dt = `${qcDate} ${qcTime}:00`;
    try {
      const res = await axios.post(`${API_BASE_URL}/leads/book-qc`, {
        lead_id: viewingLeadModal.lead_id,
        booking_time: dt,
        assigned_by_name: user?.name,
        qc_notes: qcNotes
      });
      if (res.data.success) {
        if (viewingLeadModal.lead_id) {
          localStorage.setItem(`qc_booked_${viewingLeadModal.lead_id}`, 'true');
        }
        if ((viewingLeadModal as any).manual_client_id) {
          localStorage.setItem(`qc_booked_${(viewingLeadModal as any).manual_client_id}`, 'true');
        }
        try {
          window.dispatchEvent(new Event('qc_status_changed'));
          window.dispatchEvent(new Event('qc_slot_booked'));
        } catch (e) {}
        alert(res.data.message);
        setQcDate(''); setQcTime(''); setQcNotes('');
        fetchAssignedLeads();
        setViewingLeadModal({...viewingLeadModal, qc_status: 'booked', qc_booking_time: dt});
      } else { alert("Failed: " + res.data.message); }
    } catch (error) { console.error("QC booking error", error); }
  };

  const handleUpdateQCStatus = async (status: string) => {
    if (!viewingLeadModal) return;
    try {
      const res = await axios.post(`${API_BASE_URL}/leads/update-qc-status`, {
        lead_id: viewingLeadModal.lead_id,
        status: status,
        assigned_by_name: user?.name
      });
      if (res.data.success) {
        alert(res.data.message);
        fetchAssignedLeads();
        setViewingLeadModal({...viewingLeadModal, qc_status: status});
      }
    } catch (e) { console.error("Update QC status error", e); }
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !viewingLeadModal) return;
    const uRole = String(user?.role || '').toLowerCase();
    const isSalesOrDesigner = [
      'admin', 'administrator', 'superadmin', 'management', 'owner',
      'designer', 'd1_designer', 'associate_designer', 'ad', 'interior_designer',
      'sales', 'sales_person', 'sales_executive', 'sales_manager', 'business_associate', 'ba', 'telecaller'
    ].includes(uRole) || uRole.includes('sales') || uRole.includes('design') || uRole.includes('admin');

    if (!isSalesOrDesigner) {
      alert('Access Restricted: Sales & Team Notes can only be added by the Sales Team and Designers.');
      return;
    }
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
    const backendRoot = API_BASE_URL.replace(/\/api\/?$/, '');
    const cleanPath = rawUrl.startsWith('/') ? rawUrl : '/' + rawUrl;
    return backendRoot + cleanPath;
  };

  const matchesPeriod = (dateStr?: string, period: StatementPeriodType = 'all', custom?: { startDate: string; endDate: string }) => {
    if (!dateStr || period === 'all') return true;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return true;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (period === 'today') {
      return d >= startOfToday && d <= endOfToday;
    }
    if (period === 'this_month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return d >= startOfMonth && d <= endOfToday;
    }
    if (period === 'last_month') {
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return d >= startOfLastMonth && d <= endOfLastMonth;
    }
    if (period === 'last_3_months') {
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      return d >= threeMonthsAgo && d <= endOfToday;
    }
    if (period === 'last_6_months') {
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
      return d >= sixMonthsAgo && d <= endOfToday;
    }
    if (period === 'this_year') {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      return d >= startOfYear && d <= endOfToday;
    }
    if (period.startsWith('year_')) {
      const yr = parseInt(period.replace('year_', ''), 10);
      return !isNaN(yr) && d.getFullYear() === yr;
    }
    if (period === 'custom' && custom?.startDate && custom?.endDate) {
      const s = new Date(custom.startDate + 'T00:00:00');
      const e = new Date(custom.endDate + 'T23:59:59');
      return d >= s && d <= e;
    }
    return true;
  };

  const matchesProjectType = (typeStr?: string, filterType: ProjectTypeFilter = 'all') => {
    if (!filterType || filterType === 'all') return true;
    const lower = String(typeStr || '').toLowerCase();
    if (filterType === 'furniture') return lower.includes('furniture');
    if (filterType === 'interior') return lower.includes('interior');
    if (filterType === 'commercial') return lower.includes('commercial');
    return true;
  };

  // Filtered Data based on Statement Period & Project Type
  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      const dt = l.d1_booking_time || (l as any).booking_time || (l as any).created_at;
      return matchesPeriod(dt, statementPeriod, customDates) && matchesProjectType(l.project_type, projectType);
    });
  }, [leads, statementPeriod, projectType, customDates]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      const dt = t.created_at || t.target_date || t.start_date;
      return matchesPeriod(dt, statementPeriod, customDates) && matchesProjectType(t.project_name || t.project_type, projectType);
    });
  }, [tasks, statementPeriod, projectType, customDates]);

  const filteredReimbursements = useMemo(() => {
    return reimbursements.filter(r => {
      const dt = r.created_at || r.date;
      return matchesPeriod(dt, statementPeriod, customDates);
    });
  }, [reimbursements, statementPeriod, customDates]);

  // Metrics Calculations for D1 Dashboard
  const totalLeads = filteredLeads.length;
  const pendingCount = filteredLeads.filter(l => l.status === 'enquiry' || l.status === 'in_meeting' || l.status === 'pending').length;
  const proposalSentCount = filteredLeads.filter(l => l.status === 'proposal_sent').length;
  const convertedCount = filteredLeads.filter(l => l.status === 'won' || l.status === 'converted').length;
  const deadCount = filteredLeads.filter(l => l.status === 'lost' || l.status === 'dead' || l.status === 'dropped').length;
  const conversionRate = totalLeads ? ((convertedCount / totalLeads) * 100).toFixed(2) : '0.00';
  const taskCount = filteredTasks.length;
  const reimbursementsCount = filteredReimbursements.length;

  // Helper to determine if a consultation has already been completed, won, or converted
  const isLeadMeetingCompleted = (lead: any) => {
    const s = String(lead.status || '').toLowerCase();
    const d1s = String(lead.d1_status || '').toLowerCase();
    const finishedList = ['meeting_completed', 'completed', 'won', 'converted', 'lost', 'dead', 'cancelled', 'dropped'];
    return finishedList.includes(s) || finishedList.includes(d1s) || Boolean(lead.meeting_ended_at) || Boolean(lead.d1_meeting_ended_at);
  };

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  // Upcoming: consultations scheduled for today or future dates that are NOT yet completed or converted
  const upcomingAppointments = filteredLeads.filter(lead => {
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
  const pastAppointments = filteredLeads.filter(lead => {
    const bTime = lead.d1_booking_time || lead.booking_time;
    if (!bTime) return false;
    const bookingDate = new Date(bTime);
    if (isNaN(bookingDate.getTime())) return false;

    if (isLeadMeetingCompleted(lead)) return true;
    return bookingDate < startOfToday;
  }).sort((a, b) => new Date(b.d1_booking_time || b.booking_time || 0).getTime() - new Date(a.d1_booking_time || a.booking_time || 0).getTime());

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
    <div className="dashboard-content" style={{ width: '100%', padding: '20px 24px', paddingBottom: '40px', fontFamily: 'sans-serif', backgroundColor: '#f9fafb', minHeight: '100vh', boxSizing: 'border-box' }}>

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
            <Calendar size={18} color="#ea580c" />
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#374151' }}>{upcomingAppointments.length} Upcoming Appointments</span>
          </div>
        </div>

        {/* UNIFIED STATEMENT PERIOD & PROJECT TYPE FILTER BAR */}
        <DashboardFilterBar
          statementPeriod={statementPeriod}
          onStatementPeriodChange={(period, custom) => {
            setStatementPeriod(period);
            if (custom) setCustomDates(custom);
          }}
          projectType={projectType}
          onProjectTypeChange={(type) => setProjectType(type)}
        />

        {/* D1 Dashboard Summary Metric Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
          <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#ffffff' }}>
            <div style={{ backgroundColor: '#e0e7ff', padding: '10px', borderRadius: '10px', color: '#4f46e5' }}><Users size={18} /></div>
            <div>
              <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: 0 }}>Total Assigned</p>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#111827', margin: '2px 0' }}>{totalLeads}</h3>
              <p style={{ color: '#9ca3af', fontSize: '0.72rem', margin: 0 }}>All Consultations</p>
            </div>
          </div>

          <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#ffffff' }}>
            <div style={{ backgroundColor: '#fef3c7', padding: '10px', borderRadius: '10px', color: '#d97706' }}><Clock size={18} /></div>
            <div>
              <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: 0 }}>Pending / Active</p>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#111827', margin: '2px 0' }}>{pendingCount}</h3>
              <p style={{ color: '#9ca3af', fontSize: '0.72rem', margin: 0 }}>{totalLeads ? ((pendingCount / totalLeads) * 100).toFixed(1) : 0}% of Assigned</p>
            </div>
          </div>

          <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#ffffff' }}>
            <div style={{ backgroundColor: '#dcfce7', padding: '10px', borderRadius: '10px', color: '#16a34a' }}><CheckCircle2 size={18} /></div>
            <div>
              <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: 0 }}>Converted</p>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#111827', margin: '2px 0' }}>{convertedCount}</h3>
              <p style={{ color: '#9ca3af', fontSize: '0.72rem', margin: 0 }}>{totalLeads ? ((convertedCount / totalLeads) * 100).toFixed(1) : 0}% Won</p>
            </div>
          </div>

          <div 
            onClick={() => navigate('/mb-tasks')}
            style={{ padding: '16px', borderRadius: '12px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#ffffff', cursor: 'pointer', transition: 'all 0.15s ease' }}
            title="Click to view My Tasks"
          >
            <div style={{ backgroundColor: '#ffedd5', padding: '10px', borderRadius: '10px', color: '#ea580c' }}><CheckSquare size={18} /></div>
            <div>
              <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: 0 }}>My Tasks</p>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#111827', margin: '2px 0' }}>{taskCount}</h3>
              <p style={{ color: '#ea580c', fontSize: '0.72rem', margin: 0, fontWeight: 600 }}>View Tasks →</p>
            </div>
          </div>

          <div 
            onClick={() => navigate('/reimbursements')}
            style={{ padding: '16px', borderRadius: '12px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#ffffff', cursor: 'pointer', transition: 'all 0.15s ease' }}
            title="Click to view Reimbursements"
          >
            <div style={{ backgroundColor: '#f1f5f9', padding: '10px', borderRadius: '10px', color: '#0f172a' }}><Receipt size={18} /></div>
            <div>
              <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: 0 }}>Reimbursements</p>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#111827', margin: '2px 0' }}>{reimbursementsCount}</h3>
              <p style={{ color: '#64748b', fontSize: '0.72rem', margin: 0, fontWeight: 600 }}>View Claims →</p>
            </div>
          </div>

          <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#ffffff' }}>
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
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {(() => {
                          const s = (lead.status || '').toLowerCase();
                          const d1s = (lead.d1_status || '').toLowerCase();
                          const isMeetingFinishedOrPassed = ['meeting_completed', 'completed'].includes(d1s) || 
                            ['meeting_completed', 'completed'].includes(s) || 
                            ['cancelled', 'lost', 'dead', 'dropped'].includes(s) || 
                            Boolean((lead as any).meeting_ended_at) || Boolean((lead as any).d1_meeting_ended_at);
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

                        {leadNoticeMsgs[lead.lead_id] && (
                          <div style={{ width: '100%', fontSize: '0.8rem', color: '#ea580c', backgroundColor: '#fff7ed', border: '1px solid #ffedd5', padding: '6px 12px', borderRadius: '8px', marginTop: '6px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Clock size={14} color="#ea580c" /> {leadNoticeMsgs[lead.lead_id]}
                          </div>
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

                        {(lead.status === 'converted' || lead.status === 'won' || lead.d1_status === 'converted' || lead.d1_status === 'won') && isAdminOrPM && (
                          <button
                            onClick={async () => {
                              setSelectedLead(lead);
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

                              setConvertData(prev => ({
                                ...prev,
                                project_name: lead.client_name + ' Project',
                                total_budget: quotationBudget,
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

        {/* Sidebar / Past Appointments */}
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
                {pastAppointments.slice(0, 4).map((lead, idx) => (
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

      {/* My Tasks & Reimbursements Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginTop: '24px', alignItems: 'start' }}>
        {/* Tasks Card */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e5e7eb', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ backgroundColor: '#ffedd5', color: '#ea580c', padding: '8px', borderRadius: '8px' }}>
                <CheckSquare size={18} />
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#111827', margin: 0 }}>My Tasks ({filteredTasks.length})</h3>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={() => setShowAddTaskModal(true)}
                style={{ padding: '6px 12px', borderRadius: '8px', border: 'none', backgroundColor: '#ea580c', color: 'white', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Plus size={14} /> Propose Task
              </button>
              <button
                onClick={() => navigate('/mb-tasks')}
                style={{ background: 'none', border: 'none', color: '#ea580c', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                View All <ArrowRight size={14} />
              </button>
            </div>
          </div>
          {filteredTasks.length === 0 ? (
            <div style={{ padding: '30px 20px', textAlign: 'center', color: '#94a3b8', fontSize: '0.88rem' }}>
              No tasks found for this period.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredTasks.slice(0, 5).map((t: any) => (
                <div key={t.id || t.task_id} style={{ padding: '10px 14px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '0.86rem', color: '#0f172a' }}>{t.task_title}</p>
                    <p style={{ margin: '2px 0 0 0', fontSize: '0.74rem', color: '#64748b' }}>{t.project_name || 'General Task'} • {t.target_date ? new Date(t.target_date).toLocaleDateString('en-IN') : 'No deadline'}</p>
                  </div>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: '12px', backgroundColor: t.status === 'completed' ? '#dcfce7' : t.status === 'in_progress' ? '#e0f2fe' : '#fef3c7', color: t.status === 'completed' ? '#15803d' : t.status === 'in_progress' ? '#0369a1' : '#92400e' }}>
                    {t.status?.replace(/_/g, ' ') || 'Pending'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reimbursements Card */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e5e7eb', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ backgroundColor: '#f1f5f9', color: '#0f172a', padding: '8px', borderRadius: '8px' }}>
                <Receipt size={18} />
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#111827', margin: 0 }}>My Reimbursements ({filteredReimbursements.length})</h3>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={() => navigate('/reimbursements')}
                style={{ padding: '6px 12px', borderRadius: '8px', border: 'none', backgroundColor: '#0f172a', color: 'white', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Plus size={14} /> Request Claim
              </button>
              <button
                onClick={() => navigate('/reimbursements')}
                style={{ background: 'none', border: 'none', color: '#ea580c', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                View All <ArrowRight size={14} />
              </button>
            </div>
          </div>
          {filteredReimbursements.length === 0 ? (
            <div style={{ padding: '30px 20px', textAlign: 'center', color: '#94a3b8', fontSize: '0.88rem' }}>
              No reimbursements found for this period.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredReimbursements.slice(0, 5).map((r: any) => (
                <div key={r.id || r.claim_id} style={{ padding: '10px 14px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '0.86rem', color: '#0f172a' }}>{r.category || 'General Claim'}</p>
                    <p style={{ margin: '2px 0 0 0', fontSize: '0.74rem', color: '#64748b' }}>{r.reason || 'Expense'} • {r.date ? new Date(r.date).toLocaleDateString('en-IN') : 'Recent'}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: 0, fontWeight: 800, color: '#ea580c', fontSize: '0.9rem' }}>₹{parseFloat(r.amount || 0).toLocaleString()}</p>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', backgroundColor: r.status === 'approved' ? '#dcfce7' : r.status === 'rejected' ? '#fee2e2' : '#fef3c7', color: r.status === 'approved' ? '#15803d' : r.status === 'rejected' ? '#991b1b' : '#92400e' }}>
                      {r.status || 'Pending'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
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
              <button
                onClick={() => setModalTab('mmts')}
                style={{
                  padding: '14px 20px',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  borderBottom: modalTab === 'mmts' ? '3px solid #253b50' : '3px solid transparent',
                  color: modalTab === 'mmts' ? '#253b50' : '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <CheckSquare size={16} /> MMTS Slot
              </button>
              {(() => {
                const isQcBooked = (viewingLeadModal as any)?.qc_status === 'booked' || Boolean(viewingLeadModal?.qc_booking_time && viewingLeadModal.qc_booking_time !== '0000-00-00 00:00:00');
                return (
                  <button
                    onClick={() => setModalTab('qc')}
                    style={{
                      padding: '14px 20px',
                      fontWeight: isQcBooked ? 800 : 600,
                      fontSize: '0.9rem',
                      border: 'none',
                      background: isQcBooked ? (modalTab === 'qc' ? '#dcfce7' : '#f0fdf4') : 'none',
                      borderRadius: isQcBooked ? '8px 8px 0 0' : undefined,
                      cursor: 'pointer',
                      borderBottom: modalTab === 'qc' ? (isQcBooked ? '3px solid #16a34a' : '3px solid #253b50') : '3px solid transparent',
                      color: isQcBooked ? '#15803d' : (modalTab === 'qc' ? '#253b50' : '#64748b'),
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <CheckCircle size={16} color={isQcBooked ? '#16a34a' : undefined} />
                    {isQcBooked ? '✅ QC Slot Booked' : 'Site Inspector (QC)'}
                  </button>
                );
              })()}
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
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.85rem' }}>
                      <div>
                        <strong style={{ color: '#0369a1' }}>Lead Source:</strong> {viewingLeadModal.lead_source || 'Walk-in'}
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

                  {/* Add New Note - Restricted to Sales Team & Designers */}
                  {(() => {
                    const uRole = String(user?.role || '').toLowerCase();
                    const isSalesOrDesigner = [
                      'admin', 'administrator', 'superadmin', 'management', 'owner',
                      'designer', 'd1_designer', 'associate_designer', 'ad', 'interior_designer',
                      'sales', 'sales_person', 'sales_executive', 'sales_manager', 'business_associate', 'ba', 'telecaller'
                    ].includes(uRole) || uRole.includes('sales') || uRole.includes('design') || uRole.includes('admin');

                    if (!isSalesOrDesigner) {
                      return (
                        <div style={{ padding: '12px 16px', backgroundColor: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '10px', color: '#64748b', fontSize: '0.82rem', fontStyle: 'italic' }}>
                          🔒 Note addition is restricted to the Sales Team and Designers.
                        </div>
                      );
                    }

                    return (
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
                    );
                  })()}

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
                              onClick={(e) => e.stopPropagation()}
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

              {/* TAB 3: MMTS SLOT */}
              {modalTab === 'mmts' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ backgroundColor: '#fff7ed', padding: '16px', borderRadius: '12px', border: '1px solid #ffedd5' }}>
                    <h4 style={{ margin: '0 0 16px 0', color: '#c2410c', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckSquare size={18} /> Schedule MMTS Slot
                    </h4>
                    
                    {(viewingLeadModal as any)?.mmts_status && (viewingLeadModal as any)?.mmts_status !== 'unassigned' && (
                      <div style={{ marginBottom: '16px', backgroundColor: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid #fdba74' }}>
                        <div style={{ fontSize: '0.85rem', color: '#9a3412', marginBottom: '8px' }}>
                          <strong>Current Status:</strong> <span style={{ textTransform: 'capitalize' }}>{(viewingLeadModal as any)?.mmts_status}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => handleUpdateMMTSStatus('rescheduled')} style={{ padding: '6px 12px', fontSize: '0.8rem', backgroundColor: '#f59e0b', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>Reschedule</button>
                          <button onClick={() => handleUpdateMMTSStatus('cancelled')} style={{ padding: '6px 12px', fontSize: '0.8rem', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                          <button onClick={() => handleUpdateMMTSStatus('completed')} style={{ padding: '6px 12px', fontSize: '0.8rem', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>Mark Completed</button>
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#9a3412', marginBottom: '6px' }}>Date</label>
                        <input type="date" value={mmtsDate} onChange={e => setMmtsDate(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #fdba74', outline: 'none' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#9a3412', marginBottom: '6px' }}>Time</label>
                        <input type="time" value={mmtsTime} onChange={e => setMmtsTime(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #fdba74', outline: 'none' }} />
                      </div>
                    </div>
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#9a3412', marginBottom: '6px' }}>Notes / Scope</label>
                      <textarea value={mmtsNotes} onChange={e => setMmtsNotes(e.target.value)} rows={3} placeholder="Add scope of work or address details..." style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #fdba74', resize: 'vertical', outline: 'none' }}></textarea>
                    </div>
                    <button onClick={handleBookMMTS} style={{ backgroundColor: '#ea580c', color: 'white', padding: '10px 16px', borderRadius: '8px', border: 'none', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Calendar size={16} /> Book MMTS
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 4: QC SLOT */}
              {modalTab === 'qc' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ backgroundColor: '#f0fdf4', padding: '16px', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                    <h4 style={{ margin: '0 0 16px 0', color: '#166534', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle size={18} /> Schedule Site Inspector (QC)
                    </h4>
                    
                    {(viewingLeadModal as any)?.qc_status && (viewingLeadModal as any)?.qc_status !== 'unassigned' && (
                      <div style={{ marginBottom: '16px', backgroundColor: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid #86efac' }}>
                        <div style={{ fontSize: '0.85rem', color: '#14532d', marginBottom: '8px' }}>
                          <strong>Current Status:</strong> <span style={{ textTransform: 'capitalize', color: '#15803d', fontWeight: 800 }}>{(viewingLeadModal as any)?.qc_status === 'booked' ? '✅ QC Slot Booked' : (viewingLeadModal as any)?.qc_status}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => handleUpdateQCStatus('rescheduled')} style={{ padding: '6px 12px', fontSize: '0.8rem', backgroundColor: '#f59e0b', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>Reschedule</button>
                          <button onClick={() => handleUpdateQCStatus('cancelled')} style={{ padding: '6px 12px', fontSize: '0.8rem', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#166534', marginBottom: '6px' }}>Date</label>
                        <input type="date" value={qcDate} onChange={e => setQcDate(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #86efac', outline: 'none' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#166534', marginBottom: '6px' }}>Time</label>
                        <input type="time" value={qcTime} onChange={e => setQcTime(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #86efac', outline: 'none' }} />
                      </div>
                    </div>
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#166534', marginBottom: '6px' }}>Notes / Revision Details</label>
                      <textarea value={qcNotes} onChange={e => setQcNotes(e.target.value)} rows={3} placeholder="Enter any specific details for the QC check..." style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #86efac', resize: 'vertical', outline: 'none' }}></textarea>
                    </div>
                    <button onClick={handleBookQC} style={{ backgroundColor: '#16a34a', color: 'white', padding: '10px 16px', borderRadius: '8px', border: 'none', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Calendar size={16} /> {((viewingLeadModal as any)?.qc_status === 'booked' || Boolean(viewingLeadModal?.qc_booking_time && viewingLeadModal.qc_booking_time !== '0000-00-00 00:00:00')) ? '✅ QC Slot Booked (Click to Update)' : 'Book QC Slot'}
                    </button>
                  </div>
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

      {/* QUICK PROPOSE TASK MODAL */}
      {showAddTaskModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480, padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckSquare size={20} color="#ea580c" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0c1527', margin: 0 }}>Propose Task Goal</h3>
              </div>
              <button onClick={() => setShowAddTaskModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveNewTask}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>Task Goal / Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Complete 3D Renderings for Client"
                  value={newTaskForm.task_title}
                  onChange={e => setNewTaskForm({ ...newTaskForm, task_title: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>Project Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Villa Project or General"
                  value={newTaskForm.project_name}
                  onChange={e => setNewTaskForm({ ...newTaskForm, project_name: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>Start Date</label>
                  <input
                    type="date"
                    value={newTaskForm.start_date}
                    onChange={e => setNewTaskForm({ ...newTaskForm, start_date: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>Target Date</label>
                  <input
                    type="date"
                    value={newTaskForm.end_date}
                    onChange={e => setNewTaskForm({ ...newTaskForm, end_date: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 4 }}>Description</label>
                <textarea
                  rows={3}
                  placeholder="Details of the task..."
                  value={newTaskForm.description}
                  onChange={e => setNewTaskForm({ ...newTaskForm, description: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.88rem', resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowAddTaskModal(false)}
                  style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingTask}
                  style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: '#ea580c', color: '#fff', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  {savingTask && <Loader2 size={16} className="animate-spin" />} Propose Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
