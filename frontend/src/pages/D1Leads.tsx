import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useAuth } from '../hooks/useAuth';
import { useNavigate, useLocation } from 'react-router-dom';
import { DashboardFilterBar } from '../components/DashboardFilterBar';
import type { StatementPeriodType, ProjectTypeFilter } from '../components/DashboardFilterBar';
import {
  Users, Clock, CheckSquare, CheckCircle2, X, DollarSign, Search, Filter, RotateCcw,
  FileText, Folder, ArrowLeft, Loader2, Save, Play, CheckCircle, Plus, Info, MessageSquare, Upload, FolderPlus, Eye, MoreVertical, Calendar, CalendarCheck, Pencil, Paperclip, Lock, Send, PenTool, CreditCard, Maximize2, Minimize2
} from 'lucide-react';
import { ClientSignatureModal } from '../components/ClientSignatureModal';
import { DepartmentPersonnelSelector } from '../components/DepartmentPersonnelSelector';
import { getDepartmentInfo } from '../utils/departmentUtils';

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
  d1_assigned_to?: any;
  d1_booking_time?: string;
  d1_notes?: string;
  project_scope?: string;
  project_code?: string;
  project_id?: any;
  total_budget?: any;
  converted_at?: string;
  booking_time?: string;
  mmt_assigned_name?: string;
  mmt_assigned_id?: any;
  pm_assigned_name?: string;
  pm_assigned_id?: any;
  d1_assigned_name?: string;
  sales_person_name?: string;
  sales_person?: string;
  site_inspector_assigned_name?: string;
  associate_designer_assigned_name?: string;
  associate_designer_assigned_id?: any;
  [key: string]: any;
  mmts_notes?: string;
  notes?: string;
  qc_notes?: string;
  mmts_status?: string;
  mmts_booking_time?: string;
  qc_status?: string;
  qc_booking_time?: string;
  advance_received?: any;
  stage1_paid?: any;
  stage2_paid?: any;
  is_20_percent_paid?: any;
  payment_status?: string;
  created_at?: string;
  id?: any;
  advance_paid?: any;
  site_inspector_assigned_id?: any;
  site_manager_assigned_to?: string;
  site_manager_booking_time?: string;
  site_manager_notes?: string;
  site_manager_status?: string;
  site_inspector_status?: string;
  client_signature?: string;
}

const MMTS_ALLOWED_DEPTS = ['MMT & Masking', 'Project Management', 'Design Department', 'Management & Admin'];
const QC_ALLOWED_DEPTS = ['Site Inspection & QC', 'Project Management', 'Design Department', 'Management & Admin'];

export const D1Leads: React.FC = () => {
  const { user } = useAuth();
  const uRole = String(user?.role || '').toLowerCase();
  const isAdminOrPM = [
    'admin', 'administrator', 'superadmin', 'super_admin', 'management', 'owner',
    'project_manager', 'pm', 'project_head'
  ].includes(uRole) || uRole.includes('admin') || Boolean(user?.is_admin);
  const [viewingPaymentLead, setViewingPaymentLead] = useState<Lead | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [allLeadsData, setAllLeadsData] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingLeadId, setSavingLeadId] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const [loadingMeetingIds, setLoadingMeetingIds] = useState<{ [id: string]: boolean }>({});

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleClickOutside = () => setActiveDropdown(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Selected Status mapping per lead (lead_id -> status)
  const [selectedStatuses, setSelectedStatuses] = useState<{ [leadId: string]: string }>({});

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const hasHandledUrlParamsRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const openMmts = params.get('open_mmts');
    const openQc = params.get('open_qc');
    const targetLeadId = params.get('lead_id');

    if (!openMmts && !openQc && !targetLeadId) {
      hasHandledUrlParamsRef.current = false;
      return;
    }
    if (hasHandledUrlParamsRef.current) return;

    const candidates = (allLeadsData && allLeadsData.length > 0) ? allLeadsData : leads;
    if ((openMmts === 'true' || openQc === 'true') && targetLeadId && candidates.length > 0) {
      const tid = String(targetLeadId).toLowerCase().trim();
      const matchLead = candidates.find(l => 
        String(l.lead_id) === String(targetLeadId) || 
        String(l.id) === String(targetLeadId) || 
        String(l.manual_client_id || '').toLowerCase().trim() === tid || 
        String((l as any).client_id || '') === String(targetLeadId) ||
        String((l as any).project_code || '').toLowerCase().trim() === tid || 
        String((l as any).converted_project_id || '') === String(targetLeadId) ||
        String((l as any).project_id || '') === String(targetLeadId) ||
        (l.client_name && (tid.includes(l.client_name.toLowerCase()) || l.client_name.toLowerCase().includes(tid)))
      );
      if (matchLead) {
        hasHandledUrlParamsRef.current = true;
        openLeadModal(matchLead);
        if (openMmts === 'true') {
          setModalTab('mmts');
          setSiteModalRoleTab('mmt');
        } else if (openQc === 'true') {
          setModalTab('qc');
          setSiteModalRoleTab('site_inspector');
        }
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [location.search, leads, allLeadsData]);

  const resetD1Filters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setStatementPeriod('today');
    setProjectType('all');
  };
  const [statementPeriod, setStatementPeriod] = useState<StatementPeriodType>('today');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [projectType, setProjectType] = useState<ProjectTypeFilter>('all');

  // Convert Modal State
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
  const [modalTab, setModalTab] = useState<'files' | 'notes' | 'mmts' | 'qc'>('files');
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [isFullWidth, setIsFullWidth] = useState(false);

  // Prevent background scroll when slide-over modal is open
  useEffect(() => {
    if (viewingLeadModal) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [viewingLeadModal]);

  // Close slide-over or active dropdown on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (viewingLeadModal) setViewingLeadModal(null);
        if (activeDropdown) setActiveDropdown(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewingLeadModal, activeDropdown]);

  // Customer Details View & Edit State
  const [viewingCustomerLead, setViewingCustomerLead] = useState<Lead | null>(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerTab, setCustomerTab] = useState<'details' | 'notes' | 'files' | 'quotes'>('details');
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [editFormData, setEditFormData] = useState({
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
    status: 'enquiry'
  });
  const [showBookSiteModal, setShowBookSiteModal] = useState(false);
  const [selectedBookLead, setSelectedBookLead] = useState<Lead | null>(null);
  const [bookDate, setBookDate] = useState('');
  const [bookTime, setBookTime] = useState('10:00');
  const [siteNotes, setSiteNotes] = useState('');
  const [siteBookingStatus, setSiteBookingStatus] = useState<string>('booked');
  const [selectedSiteUser, setSelectedSiteUser] = useState('');
  const [siteModalRoleTab, setSiteModalRoleTab] = useState<'site_inspector' | 'mmt' | 'pm' | 'designer'>('site_inspector');
  const [siteInspectorUserId, setSiteInspectorUserId] = useState('');
  const [mmtUserId, setMmtUserId] = useState('');
  const [pmUserId, setPmUserId] = useState('');
  const [designerUserId, setDesignerUserId] = useState('');
  const [team, setTeam] = useState<any[]>([]);

  // 🌸 Cute, modern Selected Personnel Summary Component
  const renderCutePersonnelSummary = (modeParam: 'mmts' | 'qc' | 'all' | boolean = 'all') => {
    const mode = typeof modeParam === 'boolean' ? (modeParam ? 'all' : 'mmts') : modeParam;
    const mmtList = mmtUserId ? mmtUserId.split(',').map(s => s.trim()).filter(Boolean) : [];
    const inspectorRaw = siteInspectorUserId || selectedSiteUser || '';
    const inspectorList = inspectorRaw ? String(inspectorRaw).split(',').map(s => s.trim()).filter(Boolean) : [];
    const pmUser = pmUserId ? team.find(t => String(t.user_id) === String(pmUserId)) : null;
    const designerUser = designerUserId ? team.find(t => String(t.user_id) === String(designerUserId)) : null;

    const showInspector = mode === 'qc' || mode === 'all';
    const showMmt = mode === 'mmts' || mode === 'all';

    return (
      <div style={{
        marginBottom: '16px',
        padding: '14px 16px',
        borderRadius: '12px',
        background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
        border: '1.5px solid #e2e8f0',
        boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
        maxWidth: '100%',
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.05rem' }}>📋</span>
            <span style={{ fontSize: '0.80rem', fontWeight: 800, color: '#1e293b', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
              Selected Personnel Summary (Check Before Booking)
            </span>
          </div>
          {mode === 'qc' && inspectorList.length > 1 && (
            <span style={{
              fontSize: '0.70rem',
              backgroundColor: '#ecfdf5',
              color: '#059669',
              border: '1px solid #a7f3d0',
              padding: '2px 8px',
              borderRadius: '12px',
              fontWeight: 800
            }}>
              ✨ {inspectorList.length} QC Inspectors Assigned
            </span>
          )}
          {mode === 'mmts' && mmtList.length > 1 && (
            <span style={{
              fontSize: '0.70rem',
              backgroundColor: '#fff7ed',
              color: '#ea580c',
              border: '1px solid #fdba74',
              padding: '2px 8px',
              borderRadius: '12px',
              fontWeight: 800
            }}>
              ✨ {mmtList.length} MMT Staff Assigned
            </span>
          )}
          {mode === 'all' && (inspectorList.length + mmtList.length) > 1 && (
            <span style={{
              fontSize: '0.70rem',
              backgroundColor: '#eff6ff',
              color: '#2563eb',
              border: '1px solid #bfdbfe',
              padding: '2px 8px',
              borderRadius: '12px',
              fontWeight: 800
            }}>
              ✨ {inspectorList.length + mmtList.length} Staff Assigned
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
          {/* QC Inspector(s) Block - Multi-Select Chips */}
          {showInspector && (
            <div style={{
              padding: '8px 12px',
              borderRadius: '8px',
              backgroundColor: '#ffffff',
              border: inspectorList.length > 0 ? '1.5px solid #a7f3d0' : '1px dashed #cbd5e1'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: inspectorList.length > 0 ? '6px' : '0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1rem' }}>🔍</span>
                  <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#047857', textTransform: 'uppercase' }}>QC Inspector(s):</span>
                  {inspectorList.length === 0 && (
                    <span style={{ fontSize: '0.82rem', color: '#94a3b8', fontStyle: 'italic', fontWeight: 600 }}>None selected</span>
                  )}
                </div>
                {inspectorList.length > 0 && (
                  <span style={{ fontSize: '0.68rem', backgroundColor: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', padding: '1px 6px', borderRadius: '8px', fontWeight: 800 }}>
                    {inspectorList.length} {inspectorList.length === 1 ? 'inspector' : 'inspectors'}
                  </span>
                )}
              </div>

              {inspectorList.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', paddingTop: '2px' }}>
                  {inspectorList.map(uid => {
                    const member = team.find(t => String(t.user_id) === String(uid));
                    const dept = member ? getDepartmentInfo(member) : null;
                    return (
                      <span
                        key={uid}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          backgroundColor: '#ecfdf5',
                          border: '1px solid #6ee7b7',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          boxShadow: '0 1px 3px rgba(5, 150, 105, 0.08)'
                        }}
                      >
                        <strong style={{ fontSize: '0.80rem', color: '#065f46' }}>
                          {member?.name || `ID #${uid}`}
                        </strong>
                        {dept && (
                          <span style={{ fontSize: '0.66rem', color: '#047857', opacity: 0.85, fontWeight: 700 }}>
                            ({dept.name})
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            const next = inspectorList.filter(id => id !== uid);
                            const nextStr = next.join(',');
                            setSiteInspectorUserId(nextStr);
                            setSelectedSiteUser(nextStr);
                          }}
                          style={{
                            border: 'none',
                            background: '#a7f3d0',
                            color: '#065f46',
                            cursor: 'pointer',
                            fontWeight: 900,
                            fontSize: '0.75rem',
                            width: '16px',
                            height: '16px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 0
                          }}
                          title="Remove inspector"
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* MMT Team Block */}
          {showMmt && (
            <div style={{
              padding: '8px 12px',
              borderRadius: '8px',
              backgroundColor: '#ffffff',
              border: mmtList.length > 0 ? '1.5px solid #fed7aa' : '1px dashed #cbd5e1'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: mmtList.length > 0 ? '6px' : '0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1rem' }}>📦</span>
                  <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#ea580c', textTransform: 'uppercase' }}>MMT Member(s):</span>
                  {mmtList.length === 0 && (
                    <span style={{ fontSize: '0.82rem', color: '#94a3b8', fontStyle: 'italic', fontWeight: 600 }}>None selected</span>
                  )}
                </div>
                {mmtList.length > 0 && (
                  <span style={{ fontSize: '0.68rem', backgroundColor: '#fff7ed', color: '#ea580c', border: '1px solid #ffedd5', padding: '1px 6px', borderRadius: '8px', fontWeight: 800 }}>
                    {mmtList.length} {mmtList.length === 1 ? 'member' : 'members'}
                  </span>
                )}
              </div>

              {mmtList.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', paddingTop: '2px' }}>
                  {mmtList.map(uid => {
                    const member = team.find(t => String(t.user_id) === String(uid));
                    const dept = member ? getDepartmentInfo(member) : null;
                    return (
                      <span
                        key={uid}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          backgroundColor: '#fff7ed',
                          border: '1px solid #fdba74',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          boxShadow: '0 1px 3px rgba(234, 88, 12, 0.08)'
                        }}
                      >
                        <strong style={{ fontSize: '0.80rem', color: '#9a3412' }}>
                          {member?.name || `ID #${uid}`}
                        </strong>
                        {dept && (
                          <span style={{ fontSize: '0.66rem', color: '#c2410c', opacity: 0.85, fontWeight: 700 }}>
                            ({dept.name})
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            const next = mmtList.filter(id => id !== uid);
                            setMmtUserId(next.join(','));
                          }}
                          style={{
                            border: 'none',
                            background: '#fed7aa',
                            color: '#9a3412',
                            cursor: 'pointer',
                            fontWeight: 900,
                            fontSize: '0.75rem',
                            width: '16px',
                            height: '16px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 0
                          }}
                          title="Remove person"
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* PM & Designer Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {/* PM */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              borderRadius: '8px',
              backgroundColor: '#ffffff',
              border: pmUser ? '1.5px solid #bae6fd' : '1px dashed #cbd5e1'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                <span style={{ fontSize: '0.95rem' }}>🏢</span>
                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>PM:</span>
                <strong style={{ fontSize: '0.80rem', color: pmUser ? '#0369a1' : '#94a3b8', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {pmUser ? pmUser.name : 'None'}
                </strong>
                {pmUser && (
                  <span style={{ fontSize: '0.66rem', color: '#0284c7', backgroundColor: '#f0f9ff', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                    ({getDepartmentInfo(pmUser).name})
                  </span>
                )}
              </div>
              {pmUser && (
                <button
                  type="button"
                  onClick={() => setPmUserId('')}
                  style={{ border: 'none', background: '#fee2e2', color: '#ef4444', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 800, padding: 0 }}
                  title="Remove PM"
                >
                  ×
                </button>
              )}
            </div>

            {/* Designer */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              borderRadius: '8px',
              backgroundColor: '#ffffff',
              border: designerUser ? '1.5px solid #ddd6fe' : '1px dashed #cbd5e1'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                <span style={{ fontSize: '0.95rem' }}>🎨</span>
                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Designer:</span>
                <strong style={{ fontSize: '0.80rem', color: designerUser ? '#6d28d9' : '#94a3b8', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {designerUser ? designerUser.name : 'None'}
                </strong>
                {designerUser && (
                  <span style={{ fontSize: '0.66rem', color: '#8b5cf6', backgroundColor: '#f5f3ff', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                    ({getDepartmentInfo(designerUser).name})
                  </span>
                )}
              </div>
              {designerUser && (
                <button
                  type="button"
                  onClick={() => setDesignerUserId('')}
                  style={{ border: 'none', background: '#fee2e2', color: '#ef4444', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 800, padding: 0 }}
                  title="Remove Designer"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 📦 Connect with MMTS & PM Prompt Modal State
  const [showMmtsPromptModal, setShowMmtsPromptModal] = useState(false);
  const [promptMmtsLead, setPromptMmtsLead] = useState<Lead | null>(null);
  const [showSigModal, setShowSigModal] = useState(false);
  const [sigLead, setSigLead] = useState<Lead | null>(null);

  // D1 Book/Reschedule Modal State
  const [showBookD1Modal, setShowBookD1Modal] = useState(false);
  const [selectedBookD1Lead, setSelectedBookD1Lead] = useState<Lead | null>(null);
  const [bookD1Date, setBookD1Date] = useState('');
  const [bookD1Time, setBookD1Time] = useState('10:00');
  const [bookD1Status, setBookD1Status] = useState('booked');
  const [d1Notes, setD1Notes] = useState('');
  const [selectedD1User, setSelectedD1User] = useState('');
  const [selectedAssocUser, setSelectedAssocUser] = useState('');
  const [selectedMmtUser, setSelectedMmtUser] = useState('');
  const [selectedSiteInspectorUser, setSelectedSiteInspectorUser] = useState('');
  const [selectedPmUser, setSelectedPmUser] = useState('');
  const [leadNoticeMsgs, setLeadNoticeMsgs] = useState<{ [leadId: string]: string }>({});

  // Agreement & Final Quotation PDF Modal State
  const [showAgreementModal, setShowAgreementModal] = useState(false);
  const [agreementLead, setAgreementLead] = useState<Lead | null>(null);
  const [agreementBudget, setAgreementBudget] = useState('');
  const [agreementNotes, setAgreementNotes] = useState('');
  const [submittingAgreement, setSubmittingAgreement] = useState(false);

  // Collect Remaining Stage 1 Advance Modal State
  const [showCollectModal, setShowCollectModal] = useState<boolean>(false);
  const [collectLead, setCollectLead] = useState<Lead | null>(null);
  const [collectAmount, setCollectAmount] = useState<string>('');
  const [collectPaymentMode, setCollectPaymentMode] = useState<string>('UPI / Online');
  const [submittingCollect, setSubmittingCollect] = useState<boolean>(false);

  const handleStatusChange = async (leadId: string | number, newStatus: string) => {
    if (newStatus === 'cancelled') {
      const targetLead = leads.find(l => String(l.lead_id) === String(leadId) || String((l as any).manual_client_id) === String(leadId));
      const isAlreadyConverted = targetLead && (targetLead.status === 'won' || targetLead.status === 'converted' || (targetLead as any).is_converted);
      const confirmMsg = isAlreadyConverted
        ? `⚠️ CANCEL BOOKING & CONVERSION\n\nClient: ${targetLead?.client_name || 'Client'}\n\nAre you sure you want to cancel this booking and converted project?\nThis will mark the lead as Cancelled and remove it from active projects.`
        : `Are you sure you want to mark this lead as Cancelled?`;
      if (!window.confirm(confirmMsg)) {
        return;
      }
    }

    // Optimistically update React state
    setLeads(prevLeads => prevLeads.map(l => (String(l.lead_id) === String(leadId) || String((l as any).manual_client_id) === String(leadId)) ? {
      ...l,
      status: (l.status === 'proposal_accepted' || l.status === 'won' || l.status === 'converted') ? l.status : newStatus,
      d1_status: newStatus,
      is_converted: (newStatus === 'won' || newStatus === 'converted') ? 1 : (l as any).is_converted
    } : l));

    try {
      const response = await axios.post(`${API_BASE_URL}/leads/update-status`, {
        lead_id: leadId,
        status: newStatus
      });
      if (response.data && response.data.success !== false) {
        if (newStatus === 'won' || newStatus === 'converted') {
          if (isAdminOrPM) {
            const targetLead = leads.find(l => String(l.lead_id) === String(leadId) || String((l as any).manual_client_id) === String(leadId));
            if (targetLead) {
              handleConvertClick({ ...targetLead, status: newStatus, is_converted: 1 });
            }
          }
        }
        fetchAssignedLeads();
      } else {
        alert(response.data?.message || 'Failed to update meeting status');
        fetchAssignedLeads();
      }
    } catch (err: any) {
      console.error('Failed to update status', err);
      fetchAssignedLeads();
    }
  };

  const handleCollectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdminOrPM) {
      alert('⚠️ Access Restricted: Only Admin and Project Manager (PM) have permission to record payments.');
      return;
    }
    if (!collectLead || !collectAmount || Number(collectAmount) <= 0) return;
    setSubmittingCollect(true);
    try {
      const addedAmt = parseFloat(collectAmount);
      const currentAdv = Math.max(parseFloat(String((collectLead as any).advance_paid || 0)) || 0, parseFloat(String((collectLead as any).advance_received || 0)) || 0);
      const totalB = Number((collectLead as any).initial_quote_amount || collectLead.total_budget || collectLead.estimated_budget) || 0;
      const target10 = totalB * 0.10;
      const target20 = totalB * 0.20;
      const wasStage1Complete = totalB > 0 ? (currentAdv >= (target10 - 1) || ((currentAdv / totalB) * 100) >= 9.9) : currentAdv > 0;

      const category = wasStage1Complete ? 'Stage 2 Payment' : 'Stage 1 Advance';
      const description = wasStage1Complete ? 'Stage 2 (10% For Masking & QC) Payment Received' : 'Stage 1 (10% Advance) Payment Received';

      const response = await axios.post(`${API_BASE_URL}/finance`, {
        project_id: collectLead.manual_client_id || collectLead.project_code || collectLead.lead_id,
        type: 'credit',
        amount: addedAmt,
        payment_mode: collectPaymentMode,
        category: category,
        description: description,
        recorded_by: user?.user_id || 1
      });

      if (response.data.success) {
        setShowCollectModal(false);

        const newTotalAdv = currentAdv + addedAmt;
        const isStage1Satisfied = totalB > 0 
          ? (((newTotalAdv / totalB) * 100) >= 9.9 || newTotalAdv >= (target10 - 1))
          : newTotalAdv > 0;
        const isStage2Satisfied = totalB > 0 
          ? (((newTotalAdv / totalB) * 100) >= 19.5 || newTotalAdv >= (target20 - 1))
          : newTotalAdv >= 20000;

        const updatedLead: Lead = {
          ...collectLead,
          advance_paid: newTotalAdv,
          advance_received: newTotalAdv,
          stage1_paid: isStage1Satisfied ? 1 : (collectLead.stage1_paid || 0),
          is_10_percent_paid: isStage1Satisfied ? 1 : ((collectLead as any).is_10_percent_paid || 0),
          stage2_paid: isStage2Satisfied ? 1 : 0,
          is_20_percent_paid: isStage2Satisfied ? 1 : 0,
          payment_status: isStage2Satisfied ? '20% Paid' : (isStage1Satisfied ? '10% Paid' : 'Partial')
        };

        // Persist update directly to backend leads API so DB row is saved!
        axios.put(`${API_BASE_URL}/leads`, {
          lead_id: collectLead.lead_id,
          advance_paid: newTotalAdv,
          advance_received: newTotalAdv,
          stage1_paid: isStage1Satisfied ? 1 : (collectLead.stage1_paid || 0),
          is_10_percent_paid: isStage1Satisfied ? 1 : ((collectLead as any).is_10_percent_paid || 0),
          stage2_paid: isStage2Satisfied ? 1 : 0,
          is_20_percent_paid: isStage2Satisfied ? 1 : 0,
          payment_status: isStage2Satisfied ? '20% Paid' : (isStage1Satisfied ? '10% Paid' : 'Partial')
        }).catch(e => console.error('Failed to update lead stage payment flags:', e));

        // Update `leads` state directly so payment status updates instantly in React memory!
        setLeads(prevLeads => prevLeads.map(l => (
          String(l.lead_id) === String(collectLead.lead_id) || 
          String((l as any).manual_client_id) === String(collectLead.lead_id) || 
          String((l as any).project_code) === String(collectLead.lead_id)
        ) ? updatedLead : l));

        setViewingLeadModal(updatedLead);

        if (!wasStage1Complete) {
          setModalTab('mmts');
          if (isStage1Satisfied) {
            triggerLeadNotice(collectLead.lead_id, '🎉 Stage 1 (10% Advance) satisfied! Lead converted to project & MMTS slot booking is now UNLOCKED.');
          } else {
            const remDue = Math.max(0, Math.round(target10 - newTotalAdv));
            triggerLeadNotice(collectLead.lead_id, `💳 Partial payment of ₹${Math.round(addedAmt).toLocaleString('en-IN')} recorded. Remaining Stage 1 due: ₹${remDue.toLocaleString('en-IN')}. MMTS slot will unlock when Stage 1 is fully paid.`);
          }
        } else {
          setModalTab('qc');
          if (isStage2Satisfied) {
            triggerLeadNotice(collectLead.lead_id, '🎉 Stage 2 Payment 100% satisfied! QC Inspector slot booking is now UNLOCKED.');
          } else {
            const remDue = Math.max(0, Math.round(target20 - newTotalAdv));
            triggerLeadNotice(collectLead.lead_id, `💳 Partial payment of ₹${Math.round(addedAmt).toLocaleString('en-IN')} recorded. Remaining Stage 2 due: ₹${remDue.toLocaleString('en-IN')}. QC slot remains locked until Stage 2 is 100% satisfied.`);
          }
        }

        fetchFinanceTransactions();
        fetchAssignedLeads();
      } else {
        triggerLeadNotice(collectLead.lead_id, response.data.message || 'Failed to record payment');
      }
    } catch (err: any) {
      triggerLeadNotice(collectLead.lead_id, 'Error recording payment: ' + (err.response?.data?.message || err.message));
    } finally {
      setSubmittingCollect(false);
    }
  };

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

  const isSlotFutureTime = (slotValue: string, targetDate: string) => {
    const todayStr = getTodayDateString();
    if (targetDate > todayStr) return true;
    if (targetDate < todayStr) return false;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [hourStr] = slotValue.split(':');
    const slotStartMinutes = parseInt(hourStr, 10) * 60;
    const slotEndMinutes = slotStartMinutes + 120;

    return slotEndMinutes > currentMinutes;
  };

  const FIXED_SLOTS = [
    { id: 1, label: '10:00 AM - 12:00 PM', value: '10:00' },
    { id: 2, label: '12:00 PM - 02:00 PM', value: '12:00' },
    { id: 3, label: '02:00 PM - 04:00 PM', value: '14:00' },
    { id: 4, label: '04:00 PM - 06:00 PM', value: '16:00' },
    { id: 5, label: '06:00 PM - 08:00 PM', value: '18:00' }
  ];

  const getFirstAvailableSlot = (targetDate: string) => {
    const available = FIXED_SLOTS.find(slot => {
      const isPast = isSlotPastTime(slot.value, targetDate);
      const isBooked = isSlotBooked(slot.value);
      return !isPast && !isBooked;
    });
    return available ? available.value : '';
  };

  useEffect(() => {
    if (showBookSiteModal && selectedBookLead) {
      const todayStr = getTodayDateString();
      let initDate = todayStr;
      let initTime = '';

      if (selectedBookLead.site_manager_booking_time) {
        const parts = selectedBookLead.site_manager_booking_time.split(' ');
        const existingDate = parts[0] || '';
        if (existingDate && existingDate >= todayStr) {
          initDate = existingDate;
        }
        if (parts[1]) {
          const timeParts = parts[1].split(':');
          initTime = `${timeParts[0]}:${timeParts[1]}`;
        }
      }

      const firstValid = getFirstAvailableSlot(initDate);
      if (!firstValid && initDate === todayStr) {
        initDate = getTomorrowDateString();
        initTime = getFirstAvailableSlot(initDate) || '10:00';
      } else if (!initTime || isSlotPastTime(initTime, initDate) || isSlotBooked(initTime)) {
        initTime = firstValid;
      }

      setBookDate(initDate);
      setBookTime(initTime || (initDate > todayStr ? '10:00' : ''));
    }
  }, [showBookSiteModal, selectedBookLead]);

  useEffect(() => {
    if (viewingLeadModal && (modalTab === 'mmts' || modalTab === 'qc')) {
      if (modalTab === 'mmts') {
        setSiteModalRoleTab('mmt');
        if (viewingLeadModal.mmt_assigned_id) setMmtUserId(String(viewingLeadModal.mmt_assigned_id));
        if (viewingLeadModal.pm_assigned_id) setPmUserId(String(viewingLeadModal.pm_assigned_id));
        if (viewingLeadModal.associate_designer_assigned_id) setDesignerUserId(String(viewingLeadModal.associate_designer_assigned_id));
        if (viewingLeadModal.mmts_notes) setSiteNotes(viewingLeadModal.mmts_notes);
      } else if (modalTab === 'qc') {
        setSiteModalRoleTab('site_inspector');
        const inspectorId = (viewingLeadModal as any).site_inspector_id || viewingLeadModal.site_manager_id;
        if (inspectorId) {
          setSiteInspectorUserId(String(inspectorId));
          setSelectedSiteUser(String(inspectorId));
        }
      }

      const todayStr = getTodayDateString();
      let initDate = todayStr;
      let initTime = '';
      const existingBooking = modalTab === 'mmts'
        ? viewingLeadModal.mmts_booking_time
        : (viewingLeadModal.site_manager_booking_time || (viewingLeadModal as any).qc_booking_time);

      if (existingBooking) {
        const parts = existingBooking.split(' ');
        const existingDate = parts[0] || '';
        if (existingDate && existingDate >= todayStr) {
          initDate = existingDate;
        }
        if (parts[1]) {
          const timeParts = parts[1].split(':');
          initTime = `${timeParts[0]}:${timeParts[1]}`;
        }
      }

      const firstValid = getFirstAvailableSlot(initDate);
      if (!firstValid && initDate === todayStr) {
        initDate = getTomorrowDateString();
        initTime = getFirstAvailableSlot(initDate) || '10:00';
      } else if (!initTime || isSlotPastTime(initTime, initDate) || isSlotBooked(initTime)) {
        initTime = firstValid;
      }

      setBookDate(initDate);
      setBookTime(initTime || (initDate > todayStr ? '10:00' : ''));
    }
  }, [viewingLeadModal, modalTab]);

  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState('');
  const [filesData, setFilesData] = useState<{ folders: any[]; files: any[] }>({ folders: [], files: [] });
  const [qcDate, setQcDate] = useState('');
  const [qcTime, setQcTime] = useState('');
  const [qcNotes, setQcNotes] = useState('');
  const [mmtsDate, setMmtsDate] = useState('');
  const [mmtsTime, setMmtsTime] = useState('');
  const [mmtsNotes, setMmtsNotes] = useState('');
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

  const getQuotesForLead = (lead: any): any[] => {
    if (!lead || !Array.isArray(existingQuotes)) return [];
    const lId = String(lead.lead_id || lead.id || '').trim();
    const mcId = String(lead.manual_client_id || '').trim().toLowerCase();
    const pCode = String(lead.project_code || '').trim().toLowerCase();
    const pId = String(lead.project_id || '').trim().toLowerCase();
    const cName = String(lead.client_name || lead.project_name || '').trim().toLowerCase();
    const cleanName = cName.replace(/[^a-z0-9]/g, '');

    return existingQuotes.filter(q => {
      if (!isRealQuote(q)) return false;
      const qPid = String(q.project_id || '').trim().toLowerCase();
      const qCode = String(q.project_code || '').trim().toLowerCase();
      const qLeadId = String(q.lead_id || '').trim().toLowerCase();
      const qSub = String(q.subtitle || '').trim().toLowerCase();
      const qCName = String(q.client_name || '').trim().toLowerCase();
      const qCleanSub = qSub.replace(/[^a-z0-9]/g, '');
      const qCleanCName = qCName.replace(/[^a-z0-9]/g, '');

      if (lId && (qLeadId === lId || qPid === lId || qCode === lId || qPid === `pr-${lId}` || qCode === `pr-${lId}`)) return true;
      if (mcId && (qPid === mcId || qCode === mcId)) return true;
      if (pCode && (qPid === pCode || qCode === pCode)) return true;
      if (pId && (qPid === pId || qCode === pId)) return true;
      if (cleanName && cleanName.length > 2 && (qCleanSub === cleanName || qCleanCName === cleanName)) return true;
      return false;
    });
  };

  const hasQuotationCreated = (lead: Lead) => {
    if (!lead) return false;
    const matchingQuotes = getQuotesForLead(lead);
    const matchingQuote = matchingQuotes[0];
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

  const isInitialQuoteAccepted = (lead: Lead) => {
    if (!lead) return false;
    const lId = String(lead.lead_id || '').trim();
    const mcId = String(lead.manual_client_id || '').trim().toLowerCase();
    const pCode = String((lead as any).project_code || '').trim().toLowerCase();
    const pId = String((lead as any).project_id || '').trim().toLowerCase();
    const cName = String(lead.client_name || '').trim().toLowerCase();
    const cleanNum = lId.replace(/[^0-9]/g, '');

    // 1. Direct status flags on lead
    const s = String(lead.status || '').toLowerCase();
    const d1s = String(lead.d1_status || '').toLowerCase();
    if (s === 'proposal_accepted' || d1s === 'proposal_accepted') return true;
    if (s === 'won' || s === 'converted' || d1s === 'won' || d1s === 'converted' || Boolean(lead.project_id) || Boolean((lead as any).is_converted)) return true;
    if (Boolean((lead as any).initial_quote_accepted || (lead as any).quote_accepted)) return true;

    // 2. Check quotes list for accepted/approved initial quote
    const matchingQuotes = getQuotesForLead(lead);
    const matchingQuote = matchingQuotes.find(q => {
      const isInitial = Boolean(q.is_initial_quote || q.is_initial || q.extra_data_parsed?.is_initial_quote || q.extra_data?.is_initial_quote);
      return isInitial;
    }) || matchingQuotes[0];

    if (matchingQuote) {
      const ack = String(matchingQuote.ack_status || '').toLowerCase();
      const st = String(matchingQuote.status || '').toLowerCase();
      if (ack === 'accepted' || st === 'approved' || st === 'accepted' || st === 'order_converted' || st === 'won') {
        return true;
      }
    }

    if (localStorage.getItem(`quote_accepted_lead_${lead.lead_id}`) === 'true') {
      return true;
    }

    return false;
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
    if (!lead || !Array.isArray(existingAgreements) || existingAgreements.length === 0) {
      return { exists: false, isSigned: false };
    }
    const lId = String(lead.lead_id || '').trim().toLowerCase();
    const mcId = String(lead.manual_client_id || '').trim().toLowerCase();
    const pCode = String((lead as any).project_code || '').trim().toLowerCase();
    const pId = String((lead as any).project_id || '').trim().toLowerCase();

    const ag = existingAgreements.find(a => {
      const aPid = String(a.project_id || a.lead_id || '').trim().toLowerCase();
      const aCode = String(a.ref_id || a.project_code || '').trim().toLowerCase();

      if (lId && (aPid === lId || aCode === lId)) return true;
      if (mcId && (aPid === mcId || aCode === mcId)) return true;
      if (pCode && (aPid === pCode || aCode === pCode)) return true;
      if (pId && (aPid === pId || aCode === pId)) return true;
      return false;
    });

    if (!ag) return { exists: false, isSigned: false };

    const st = String(ag.status || '').toLowerCase();
    const isSigned = st === 'signed' || st === 'sign' || st === 'completed';

    return { exists: true, isSigned };
  };

  const [financeTransactions, setFinanceTransactions] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      fetchAssignedLeads();
      fetchTeam();
      fetchExistingQuotes();
      fetchExistingAgreements();
      fetchFinanceTransactions();
    }
  }, [user]);

  const fetchFinanceTransactions = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/finance`);
      if (res.data?.success && Array.isArray(res.data.data)) {
        setFinanceTransactions(res.data.data);
      }
    } catch (e) {}
  };

  const isTenPercentPaidForLead = (lead: Lead | null) => {
    if (!lead) return false;

    if (
      lead.stage1_paid === 1 || 
      (lead as any).is_10_percent_paid === 1 || 
      (lead as any).is_10_percent_paid === true || 
      String(lead.payment_status || '').toLowerCase().includes('10%') ||
      lead.stage2_paid === 1 ||
      lead.is_20_percent_paid === 1 ||
      lead.is_20_percent_paid === true ||
      String(lead.payment_status || '').toLowerCase().includes('20%') ||
      lead.is_final_quote_approved === 1 ||
      ['qc_approved', 'approved'].includes(String(lead.qc_status || '').toLowerCase())
    ) {
      return true;
    }

    const pStage = String((lead as any).project_stage || '').toLowerCase();
    const isStageUnlocked = pStage === 'r2p' || pStage === 'ready to dispatch' || pStage === 'handover' || pStage === 'ready_to_dispatch' || pStage === 'handover_completed';
    if (isStageUnlocked) {
      return true;
    }

    const budgetVal = parseFloat(lead.total_budget as any) || parseFloat(lead.estimated_budget as any) || parseFloat((lead as any).initial_quote_amount as any) || 0;
    const advanceVal = parseFloat(lead.advance_paid as any) || parseFloat((lead as any).advance_received as any) || 0;

    let leadPaid = 0;

    if (financeTransactions && Array.isArray(financeTransactions)) {
      const lId = String(lead.lead_id || (lead as any).id || '').toLowerCase();
      const mcId = String(lead.manual_client_id || '').toLowerCase();
      const pCode = String((lead as any).project_code || '').toLowerCase();
      const cName = String(lead.client_name || '').toLowerCase();

      const matchingTxns = financeTransactions.filter((t: any) => {
        if (String(t.type || '').toLowerCase() !== 'credit') return false;
        const tPid = String(t.project_id || '').toLowerCase();
        const tPCode = String(t.project_code || '').toLowerCase();
        const tDesc = String(t.description || '').toLowerCase();
        return (lId && (tPid === lId || tPCode === lId || tDesc.includes(lId))) || 
               (mcId && (tPid === mcId || tPCode === mcId || (mcId.length > 1 && tDesc.includes(mcId)))) || 
               (pCode && (tPid === pCode || tPCode === pCode || (pCode.length > 1 && tDesc.includes(pCode)))) ||
               (cName && cName.length > 2 && tDesc.includes(cName));
      });

      leadPaid = matchingTxns.reduce((sum: number, t: any) => sum + parseFloat(t.amount || 0), 0);
    }

    const totalCollected = Math.max(advanceVal, leadPaid);

    if (budgetVal > 0) {
      const pct = (totalCollected / budgetVal) * 100;
      const target20 = Math.round(budgetVal * 0.20);
      return pct >= 19.5 || totalCollected >= (target20 - 1);
    }

    return totalCollected >= 20000;
  };

  const isStage1FullyPaid = (lead: any) => {
    if (!lead) return false;

    if (
      lead.stage1_paid === 1 || 
      lead.is_10_percent_paid === 1 || 
      lead.is_10_percent_paid === true || 
      String(lead.payment_status || '').toLowerCase().includes('10%') ||
      lead.stage2_paid === 1 ||
      lead.is_20_percent_paid === 1 ||
      lead.is_20_percent_paid === true ||
      String(lead.payment_status || '').toLowerCase().includes('20%') ||
      lead.is_converted === 1 ||
      lead.is_converted === true ||
      lead.status === 'won' ||
      lead.d1_status === 'won' ||
      Boolean(lead.project_id && Number(lead.project_id) > 0)
    ) {
      return true;
    }

    const totalB = Math.max(
      parseFloat(String(lead.initial_quote_amount || 0)) || 0,
      parseFloat(String(lead.total_budget || 0)) || 0,
      parseFloat(String(lead.estimated_budget || 0)) || 0
    );
    const target10 = totalB * 0.10;
    const paid10 = Math.max(
      parseFloat(String(lead.advance_received || 0)) || 0,
      parseFloat(String(lead.advance_paid || 0)) || 0,
      parseFloat(String(lead.total_paid || 0)) || 0,
      parseFloat(String(lead.paid_amount || 0)) || 0
    );

    let fPaid = 0;
    if (financeTransactions && Array.isArray(financeTransactions)) {
      const lId = String(lead.lead_id || lead.id || '').toLowerCase();
      const mcId = String(lead.manual_client_id || '').toLowerCase();
      const pCode = String(lead.project_code || '').toLowerCase();
      const cName = String(lead.client_name || '').toLowerCase();

      fPaid = financeTransactions
        .filter((t: any) => {
          if (String(t.type || '').toLowerCase() !== 'credit') return false;
          const tPid = String(t.project_id || '').toLowerCase();
          const tPCode = String(t.project_code || '').toLowerCase();
          const tDesc = String(t.description || '').toLowerCase();
          return (lId && (tPid === lId || tPCode === lId || tDesc.includes(lId))) || 
                 (mcId && (tPid === mcId || tPCode === mcId || (mcId.length > 1 && tDesc.includes(mcId)))) || 
                 (pCode && (tPid === pCode || tPCode === pCode || (pCode.length > 1 && tDesc.includes(pCode)))) ||
                 (cName && cName.length > 2 && tDesc.includes(cName));
        })
        .reduce((sum: number, t: any) => sum + parseFloat(t.amount || 0), 0);
    }

    const totalP = Math.max(paid10, fPaid);

    if (totalB > 0) {
      return totalP >= (target10 - 1) || ((totalP / totalB) * 100) >= 9.9;
    }

    return totalP > 0;
  };

  const isTwentyPercentPaidForLead = (lead: any) => {
    if (!lead) return false;
    if (
      lead.stage2_paid === 1 ||
      lead.is_20_percent_paid === 1 ||
      lead.is_20_percent_paid === true ||
      String(lead.payment_status || '').toLowerCase().includes('20%') ||
      lead.is_final_quote_approved === 1 ||
      ['qc_approved', 'approved'].includes(String(lead.qc_status || '').toLowerCase())
    ) {
      return true;
    }

    const totalB = Math.max(
      parseFloat(String(lead.initial_quote_amount || 0)) || 0,
      parseFloat(String(lead.budget || 0)) || 0,
      parseFloat(String(lead.total_budget || 0)) || 0,
      parseFloat(String(lead.estimated_budget || 0)) || 0
    );
    const target20 = totalB * 0.20;
    const advP = Math.max(
      parseFloat(String(lead.advance_received || 0)) || 0,
      parseFloat(String(lead.advance_paid || 0)) || 0,
      parseFloat(String(lead.total_paid || 0)) || 0,
      parseFloat(String(lead.paid_amount || 0)) || 0
    );

    let fPaid = 0;
    if (financeTransactions && Array.isArray(financeTransactions)) {
      const lId = String(lead.lead_id || lead.id || '').toLowerCase();
      const mcId = String(lead.manual_client_id || '').toLowerCase();
      const pCode = String(lead.project_code || '').toLowerCase();
      const cName = String(lead.client_name || '').toLowerCase();

      fPaid = financeTransactions
        .filter((t: any) => {
          if (String(t.type || '').toLowerCase() !== 'credit') return false;
          const tPid = String(t.project_id || '').toLowerCase();
          const tPCode = String(t.project_code || '').toLowerCase();
          const tDesc = String(t.description || '').toLowerCase();
          return (lId && (tPid === lId || tPCode === lId || tDesc.includes(lId))) || 
                 (mcId && (tPid === mcId || tPCode === mcId || (mcId.length > 1 && tDesc.includes(mcId)))) || 
                 (pCode && (tPid === pCode || tPCode === pCode || (pCode.length > 1 && tDesc.includes(pCode)))) ||
                 (cName && cName.length > 2 && tDesc.includes(cName));
        })
        .reduce((sum: number, t: any) => sum + parseFloat(t.amount || 0), 0);
    }

    const totalPaid = Math.max(advP, fPaid);

    if (totalB > 0) {
      return totalPaid >= (target20 - 1) || ((totalPaid / totalB) * 100) >= 19.5;
    }

    return totalPaid >= 20000;
  };

  const fetchTeam = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/users`);
      if (response.data.success) setTeam(response.data.data);
    } catch (error) { console.error('Error fetching team:', error); }
  };

  const fetchAssignedLeads = async () => {
    if (!user) return;
    try {
      if (allLeadsData.length === 0) setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/leads`);
      if (response.data.success) {
        const allLeads: Lead[] = response.data.data;
        setAllLeadsData(allLeads);
        
        // 🔒 Only include leads that have a booked / assigned designer slot
        const d1BookedLeads = allLeads.filter(lead => {
          const d1Val = String(lead.d1_assigned_to || '').trim();
          const adVal = String((lead as any).associate_designer_assigned_id || '').trim();
          const hasBookingTime = Boolean(lead.d1_booking_time);
          return (d1Val !== '' && d1Val !== '0' && d1Val !== 'null' && d1Val !== 'undefined') ||
                 (adVal !== '' && adVal !== '0' && adVal !== 'null' && adVal !== 'undefined') ||
                 hasBookingTime;
        });

        const uRole = String(user?.role || '').toLowerCase();
        const isAdminOrManager = ['admin', 'superadmin', 'sales_manager', 'project_manager', 'manager', 'sales', 'sales_person'].includes(uRole) || uRole.includes('sales') || uRole.includes('admin');

        const myLeads = isAdminOrManager
          ? d1BookedLeads 
          : d1BookedLeads.filter(lead => {
              const uId = String(user?.user_id);
              const assignedIds = String(lead.d1_assigned_to || '').split(',').map(id => id.trim());
              const adIds = String((lead as any).associate_designer_assigned_id || '').split(',').map(id => id.trim());
              return assignedIds.includes(uId) || adIds.includes(uId);
            });
        
        setLeads(myLeads);

        // Auto-open modal tab from URL search parameters (open_mmts / open_qc) ONCE on mount
        const searchParams = new URLSearchParams(window.location.search);
        const openMmts = searchParams.get('open_mmts');
        const openQc = searchParams.get('open_qc');
        const targetLeadId = searchParams.get('lead_id');

        if (!hasHandledUrlParamsRef.current && targetLeadId && allLeads.length > 0) {
          const tid = String(targetLeadId).toLowerCase().trim();
          const matched = allLeads.find(l => 
            String(l.lead_id) === String(targetLeadId) || 
            String(l.id) === String(targetLeadId) || 
            String(l.manual_client_id || '').toLowerCase().trim() === tid || 
            String((l as any).client_id || '') === String(targetLeadId) ||
            String((l as any).project_code || '').toLowerCase().trim() === tid || 
            String((l as any).converted_project_id || '') === String(targetLeadId) ||
            String((l as any).project_id || '') === String(targetLeadId) ||
            (l.client_name && (tid.includes(l.client_name.toLowerCase()) || l.client_name.toLowerCase().includes(tid)))
          );
          if (matched) {
            hasHandledUrlParamsRef.current = true;
            openLeadModal(matched);
            if (openMmts === 'true') {
              setModalTab('mmts');
              setSiteModalRoleTab('mmt');
            } else if (openQc === 'true') {
              setModalTab('qc');
              setSiteModalRoleTab('site_inspector');
            }
            window.history.replaceState({}, '', window.location.pathname);
          }
        }

        // Keep active viewing modal lead synchronized with backend data
        setViewingLeadModal(prev => {
          if (!prev) return null;
          const targetId = String(prev.lead_id || prev.id);
          const updated = allLeads.find(l => 
            String(l.lead_id) === targetId || 
            String(l.id) === targetId || 
            (prev.manual_client_id && String(l.manual_client_id) === String(prev.manual_client_id)) ||
            (prev.project_code && String((l as any).project_code) === String(prev.project_code))
          );
          return updated ? { ...prev, ...updated } : prev;
        });

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

  // D1 Slot Modal initialization
  useEffect(() => {
    if (showBookD1Modal && selectedBookD1Lead) {
      const loggedUid = String(user?.user_id || (user as any)?.id || '');
      const loggedUName = String(user?.name || user?.username || '').toLowerCase();

      let defaultD1 = (selectedBookD1Lead.d1_assigned_to && String(selectedBookD1Lead.d1_assigned_to) !== '0')
        ? String(selectedBookD1Lead.d1_assigned_to)
        : loggedUid;
      
      const designerOptions = team.filter(u => {
        const r = String(u.role || '').toLowerCase();
        return r === 'd1' || r === 'd2' || r.includes('d1') || r.includes('d2') || r.includes('design') || r.includes('assoc') || r.includes('ba') || r.includes('business');
      });
      const activeDesigners = designerOptions.length > 0 ? designerOptions : team;

      if ((!defaultD1 || defaultD1 === '0' || !activeDesigners.some(u => String(u.user_id) === String(defaultD1))) && activeDesigners.length > 0) {
        const matched = activeDesigners.find(t => 
          (loggedUid && String(t.user_id) === loggedUid) || 
          (t.name && t.name.toLowerCase().includes(loggedUName)) || 
          (loggedUName && t.name && loggedUName.includes(t.name.toLowerCase()))
        );
        defaultD1 = matched ? String(matched.user_id) : String(activeDesigners[0].user_id);
      }

      setSelectedD1User(defaultD1);
      setSelectedAssocUser((selectedBookD1Lead as any)?.associate_designer_assigned_id ? String((selectedBookD1Lead as any).associate_designer_assigned_id) : '');
      setD1Notes(selectedBookD1Lead.d1_notes || '');
      const todayStr = getTodayDateString();
      let initDate = todayStr;
      let initTime = '';

      const isCompletedLead = selectedBookD1Lead.d1_status === 'meeting_completed' || selectedBookD1Lead.d1_status === 'completed';
      const hasSavedBookingTime = Boolean(selectedBookD1Lead.d1_booking_time);

      if (selectedBookD1Lead.d1_booking_time) {
        const parts = selectedBookD1Lead.d1_booking_time.split(' ');
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
        const firstValid = getFirstAvailableD1Slot(initDate);
        if (!firstValid && initDate === todayStr) {
          initDate = getTomorrowDateString();
          initTime = getFirstAvailableD1Slot(initDate) || '10:00';
        } else if (!initTime || isSlotPastTime(initTime, initDate) || isD1SlotBooked(initTime)) {
          initTime = firstValid;
        }
      }

      setBookD1Date(initDate);
      setBookD1Time(initTime || (initDate > todayStr ? '10:00' : ''));
      const st = (selectedBookD1Lead.d1_status || '').toLowerCase();
      if (st === 'meeting_completed' || st === 'completed') {
        setBookD1Status('meeting_completed');
      } else {
        setBookD1Status('in_meeting');
      }
    }
  }, [showBookD1Modal, selectedBookD1Lead, user, team]);

  const isD1SlotBooked = (slotValue: string) => {
    if (!selectedD1User || !bookD1Date) return false;
    return leads.some((lead) => {
      // Skip the lead currently being edited
      if (selectedBookD1Lead && String(lead.lead_id) === String(selectedBookD1Lead.lead_id)) {
        return false;
      }
      // Cancelled meetings FREE their slot — treat them as available
      if (lead.d1_status === 'cancelled' || lead.status === 'cancelled') {
        return false;
      }
      if (!lead.d1_assigned_to || !lead.d1_booking_time) return false;
      const leadD1s = String(lead.d1_assigned_to).split(',').map(id => id.trim());
      const selectedD1s = selectedD1User.split(',').map(id => id.trim());
      const hasDesignerIntersection = leadD1s.some(id => selectedD1s.includes(id));
      if (!hasDesignerIntersection) return false;
      
      const leadParts = lead.d1_booking_time.split(' ');
      const leadDate = leadParts[0];
      const leadTime = leadParts[1] ? leadParts[1].substring(0, 5) : '';
      return leadDate === bookD1Date && leadTime === slotValue;
    });
  };

  const getFirstAvailableD1Slot = (targetDate: string) => {
    const available = FIXED_SLOTS.find(slot => {
      const isPast = isSlotPastTime(slot.value, targetDate);
      const isBooked = isD1SlotBooked(slot.value);
      return !isPast && !isBooked;
    });
    return available ? available.value : '';
  };

  const handleBookD1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const todayStr = getTodayDateString();
    
    const savedBookingTime = selectedBookD1Lead?.d1_booking_time || '';
    const savedParts = savedBookingTime ? savedBookingTime.split(' ') : [];
    const savedDate = savedParts[0] || todayStr;
    const savedTimeRaw = savedParts[1] ? savedParts[1].substring(0, 5) : '';
    
    // Saved future date validation
    if ((bookD1Status === 'in_meeting' || bookD1Status === 'meeting_completed' || bookD1Status === 'completed') && savedDate > todayStr) {
      alert(`⚠️ This meeting is officially rescheduled for ${savedDate}. Started/Completed status will unlock on ${savedDate}.`);
      return;
    }

    // Skip slot/past-time validation when starting/completing meeting or editing existing booking
    const isMeetingAction = bookD1Status === 'in_meeting' || bookD1Status === 'meeting_completed' || bookD1Status === 'completed' || Boolean(savedBookingTime);

    if (!isMeetingAction) {
      if (!selectedD1User) {
        alert('⚠️ Please select a Lead Designer (D1 / D2) before confirming booking.');
        return;
      }
      if (!bookD1Date) {
        alert('⚠️ Please select a booking date.');
        return;
      }
      if (!bookD1Time) {
        alert('⚠️ Please select an available upcoming time slot.');
        return;
      }
      if (bookD1Date < todayStr) {
        alert('Selected date is in the past. Please select today or a future date.');
        return;
      }
      if (isSlotPastTime(bookD1Time, bookD1Date)) {
        alert('Selected time slot has already passed. Please select a valid upcoming time slot.');
        return;
      }
      if (isD1SlotBooked(bookD1Time)) {
        alert('Selected time slot is already booked for this designer.');
        return;
      }
    }

    // Use saved database booking time if starting or completing meeting
    let submitBookingTime = `${bookD1Date} ${bookD1Time}:00`;
    if ((bookD1Status === 'in_meeting' || bookD1Status === 'meeting_completed' || bookD1Status === 'completed') && savedDate && savedTimeRaw) {
      submitBookingTime = `${savedDate} ${savedTimeRaw}:00`;
    }

    const uRole = String(user?.role || '').toLowerCase();
    const isAdmin = ['admin', 'administrator', 'superadmin', 'management', 'owner'].includes(uRole) || uRole.includes('admin');
    const isDesigner = ['d1', 'd2', 'designer', 'lead_designer', 'associate_designer', 'ad', 'graphic_designer', 'gd'].includes(uRole) || uRole.includes('design') || uRole.includes('d1') || uRole.includes('d2');
    const isSales = ['sales', 'sales_person', 'sales_executive', 'business_associate', 'ba', 'telecaller'].includes(uRole) || (uRole.includes('sales') && !uRole.includes('manager'));
    const isManagerOrAdmin = !isSales && (isAdmin || ['manager', 'general_manager', 'gm', 'operations_manager', 'om'].includes(uRole) || uRole.includes('manager'));
    const canControlMeeting = !isSales && (isDesigner || isAdmin);

    const submitStatus = (canControlMeeting && ['meeting_completed', 'completed'].includes(bookD1Status))
      ? 'meeting_completed'
      : (bookD1Status === 'cancelled' ? 'cancelled' : 'scheduled');

    // ⚡ INSTANT OPTIMISTIC UI UPDATE & MODAL CLOSE
    const leadId = selectedBookD1Lead?.lead_id;
    const assocId = selectedAssocUser ? selectedAssocUser : null;
    const assocName = selectedAssocUser ? (team.find(t => String(t.user_id) === String(selectedAssocUser))?.name || '') : null;

    if (leadId) {
      localStorage.removeItem(`meeting_started_at_${leadId}`);
      setLeads(prevLeads => prevLeads.map(l => l.lead_id === leadId ? {
        ...l,
        d1_status: submitStatus,
        d1_assigned_to: Number(selectedD1User) || l.d1_assigned_to || 0,
        associate_designer_assigned_id: assocId,
        associate_designer_assigned_name: assocName || '',
        d1_booking_time: submitBookingTime,
        d1_notes: d1Notes
      } : l));
    }

    setShowBookD1Modal(false);
    setSubmitting(false);

    // ⚡ PARALLEL BACKGROUND NETWORK REQUESTS
    Promise.allSettled([
      axios.post(`${API_BASE_URL}/leads/book-d1`, {
        lead_id: leadId,
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
        associate_designer_assigned_name: assocName,
        ...(selectedMmtUser ? {
          mmt_assigned_id: selectedMmtUser,
          mmt_assigned_name: selectedMmtUser.split(',').map(id => team.find(t => String(t.user_id) === String(id.trim()))?.name).filter(Boolean).join(', ')
        } : {}),
        ...(selectedSiteInspectorUser ? {
          site_inspector_assigned_id: selectedSiteInspectorUser,
          site_inspector_assigned_name: selectedSiteInspectorUser.split(',').map(id => team.find(t => String(t.user_id) === String(id.trim()))?.name).filter(Boolean).join(', ')
        } : {}),
        ...(selectedPmUser ? {
          pm_assigned_id: selectedPmUser,
          pm_assigned_name: selectedPmUser.split(',').map(id => team.find(t => String(t.user_id) === String(id.trim()))?.name).filter(Boolean).join(', ')
        } : {})
      }),
      axios.post(`${API_BASE_URL}/leads/update-status`, {
        lead_id: leadId,
        status: submitStatus,
        data: {
          previous_designer_id: selectedBookD1Lead?.d1_assigned_to,
          sales_person_name: user?.name || 'Admin',
          skip_status_update: true
        }
      })
    ]).then(() => {
      fetchAssignedLeads();
    }).catch(err => {
      console.error('Background D1 booking sync error', err);
      fetchAssignedLeads();
    });
  };

  const isSlotBooked = (timeVal: string) => {
    const targetDate = bookDate || getTodayDateString();
    const checkList = allLeadsData.length > 0 ? allLeadsData : leads;
    const currentLeadId = selectedBookLead?.lead_id || viewingLeadModal?.lead_id || selectedBookD1Lead?.lead_id;

    const bookedMatch = checkList.find(lead => {
      // Exclude current lead being edited so it never conflicts with itself!
      if (currentLeadId && (String(lead.lead_id) === String(currentLeadId) || String(lead.id) === String(currentLeadId))) {
        return false;
      }
      if (lead.status === 'cancelled' || lead.d1_status === 'cancelled') {
        return false;
      }

      const checkTimeMatch = (dateTimeStr?: string) => {
        if (!dateTimeStr) return false;
        const cleanDT = String(dateTimeStr).trim().replace('T', ' ');
        return cleanDT.includes(targetDate) && (cleanDT.includes(timeVal) || cleanDT.includes(`${timeVal}:00`));
      };

      // 1. Check MMTS slot booking time
      if (modalTab === 'mmts' || siteModalRoleTab === 'mmt') {
        return checkTimeMatch(lead.mmts_booking_time);
      }

      // 2. Check Site Inspector / QC slot booking time
      if (modalTab === 'qc' || siteModalRoleTab === 'site_inspector') {
        return checkTimeMatch(lead.site_manager_booking_time || (lead as any).qc_booking_time);
      }

      // 3. Fallback for generic site booking modal
      if (checkTimeMatch(lead.site_manager_booking_time)) {
        return true;
      }

      return false;
    });

    const isBooked = Boolean(bookedMatch);
    if (isBooked) {
      console.log(`[Slot Conflict Detected] Time: ${timeVal}, Date: ${targetDate}, Lead: ${bookedMatch?.client_name}`);
    }
    return isBooked;
  };

  const handleBookMMTSSubmit = async (e?: React.FormEvent) => {
    if (e && e.preventDefault) e.preventDefault();
    const todayStr = getTodayDateString();
    const targetLead = selectedBookLead || viewingLeadModal;
    const leadId = targetLead?.lead_id || targetLead?.id || targetLead?.project_id;
    const activeDate = bookDate || getTodayDateString();
    const activeTime = bookTime || getFirstAvailableSlot(activeDate) || '10:00';

    if (!targetLead || !leadId) {
      alert('⚠️ No lead selected for MMTS booking.');
      return;
    }
    if (activeDate < todayStr) {
      alert('Selected date is in the past. Please select today or a future date.');
      return;
    }
    if (isSlotPastTime(activeTime, activeDate)) {
      alert('Selected time slot has already passed. Please select a valid upcoming time slot.');
      return;
    }
    if (isSlotBooked(activeTime)) {
      alert('Selected time slot is already booked for this schedule.');
      return;
    }
    setSubmitting(true);
    try {
      const bookingDateTime = `${activeDate} ${activeTime}:00`;
      const mmtIds = String(mmtUserId || '').split(',').map(s => s.trim()).filter(Boolean);
      const mmtNames = mmtIds.map(id => team.find(t => String(t.user_id) === String(id))?.name || id).filter(Boolean);
      const resolvedMmtName = mmtNames.join(', ');
      const resolvedPmName = team.find(t => String(t.user_id) === String(pmUserId))?.name || '';
      const resolvedDesignerName = team.find(t => String(t.user_id) === String(designerUserId))?.name || '';

      const mmtsPayload = {
        lead_id: leadId,
        booking_time: bookingDateTime,
        assigned_by_name: user?.name || 'Designer',
        mmts_notes: siteNotes,
        notes: siteNotes,
        mmt_assigned_id: mmtUserId,
        mmt_assigned_name: resolvedMmtName,
        associate_designer_assigned_id: designerUserId,
        associate_designer_assigned_name: resolvedDesignerName,
        pm_assigned_id: pmUserId,
        pm_assigned_name: resolvedPmName
      };

      setAllLeadsData(prev => prev.map(l => 
        (String(l.lead_id) === String(leadId) || String(l.id) === String(leadId)) 
          ? {
              ...l,
              mmts_status: 'booked',
              mmts_booking_time: bookingDateTime,
              mmts_notes: siteNotes,
              mmt_assigned_id: mmtUserId || l.mmt_assigned_id,
              mmt_assigned_name: resolvedMmtName || l.mmt_assigned_name,
              pm_assigned_id: pmUserId || l.pm_assigned_id,
              pm_assigned_name: resolvedPmName || l.pm_assigned_name,
              associate_designer_assigned_id: designerUserId || l.associate_designer_assigned_id,
              associate_designer_assigned_name: resolvedDesignerName || l.associate_designer_assigned_name
            }
          : l
      ));

      if (viewingLeadModal) {
        setViewingLeadModal(prev => prev ? {
          ...prev,
          mmts_status: 'booked',
          mmts_booking_time: bookingDateTime,
          mmts_notes: siteNotes,
          mmt_assigned_id: mmtUserId || prev.mmt_assigned_id,
          mmt_assigned_name: resolvedMmtName || prev.mmt_assigned_name,
          pm_assigned_id: pmUserId || prev.pm_assigned_id,
          pm_assigned_name: resolvedPmName || prev.pm_assigned_name,
          associate_designer_assigned_id: designerUserId || prev.associate_designer_assigned_id,
          associate_designer_assigned_name: resolvedDesignerName || prev.associate_designer_assigned_name
        } : prev);
      }

      setShowBookSiteModal(false);

      const res = await axios.post(`${API_BASE_URL}/leads/book-mmts`, mmtsPayload);
      if (res.data?.success) {
        alert(res.data.message || '🎉 MMTS & PM Slot booked successfully!');
      } else {
        alert('Notice: ' + (res.data?.message || 'MMTS slot updated'));
      }
      fetchAssignedLeads();
    } catch (err) {
      console.error('Book MMTS error', err);
      fetchAssignedLeads();
    } finally {
      setSubmitting(false);
    }
  };

  const handleBookQCSubmit = async (e?: React.FormEvent) => {
    if (e && e.preventDefault) e.preventDefault();
    const todayStr = getTodayDateString();
    const activeInspectorId = siteInspectorUserId || selectedSiteUser;
    const targetLead = selectedBookLead || viewingLeadModal;
    const leadId = targetLead?.lead_id || targetLead?.id || targetLead?.project_id;
    const activeDate = bookDate || getTodayDateString();
    const activeTime = bookTime || getFirstAvailableSlot(activeDate) || '10:00';

    if (!targetLead || !leadId) {
      alert('⚠️ No lead selected for QC Inspector booking.');
      return;
    }
    if (activeDate < todayStr) {
      alert('Selected date is in the past. Please select today or a future date.');
      return;
    }
    if (isSlotPastTime(activeTime, activeDate)) {
      alert('Selected time slot has already passed. Please select a valid upcoming time slot.');
      return;
    }
    if (isSlotBooked(activeTime)) {
      alert('Selected time slot is already booked for this schedule.');
      return;
    }
    setSubmitting(true);
    try {
      const bookingDateTime = `${activeDate} ${activeTime}:00`;
      const inspectorIdList = activeInspectorId 
        ? String(activeInspectorId).split(',').map(s => s.trim()).filter(Boolean)
        : [];
      const resolvedInspectorNames = inspectorIdList
        .map(id => team.find(t => String(t.user_id) === String(id))?.name || `ID #${id}`)
        .join(', ');
      const resolvedDesignerName = designerUserId 
        ? (team.find(t => String(t.user_id) === String(designerUserId))?.name || '')
        : '';
      const resolvedPmName = pmUserId
        ? (team.find(t => String(t.user_id) === String(pmUserId))?.name || '')
        : '';

      const qcPayload = {
        lead_id: leadId,
        booking_time: bookingDateTime,
        assigned_by_name: user?.name || 'Designer',
        qc_notes: siteNotes,
        notes: siteNotes,
        site_inspector_assigned_id: activeInspectorId,
        site_inspector_assigned_name: resolvedInspectorNames,
        associate_designer_assigned_id: designerUserId,
        associate_designer_assigned_name: resolvedDesignerName,
        pm_assigned_id: pmUserId,
        pm_assigned_name: resolvedPmName
      };

      const updateLeadObj = (l: any) => ({
        ...l,
        qc_status: 'booked',
        site_manager_status: 'booked',
        site_inspector_status: 'booked',
        site_manager_booking_time: bookingDateTime,
        qc_booking_time: bookingDateTime,
        qc_notes: siteNotes,
        site_inspector_assigned_id: activeInspectorId || l.site_inspector_assigned_id,
        site_inspector_assigned_name: resolvedInspectorNames || l.site_inspector_assigned_name,
        pm_assigned_id: pmUserId || l.pm_assigned_id,
        pm_assigned_name: resolvedPmName || l.pm_assigned_name,
        associate_designer_assigned_id: designerUserId || l.associate_designer_assigned_id,
        associate_designer_assigned_name: resolvedDesignerName || l.associate_designer_assigned_name
      });

      setAllLeadsData(prev => prev.map(l => 
        (String(l.lead_id) === String(leadId) || String(l.id) === String(leadId) || (l.manual_client_id && String(l.manual_client_id) === String(leadId)))
          ? updateLeadObj(l)
          : l
      ));

      setLeads(prev => prev.map(l => 
        (String(l.lead_id) === String(leadId) || String(l.id) === String(leadId) || (l.manual_client_id && String(l.manual_client_id) === String(leadId)))
          ? updateLeadObj(l)
          : l
      ));

      setViewingLeadModal(prev => prev ? updateLeadObj(prev) : prev);
      setModalTab('qc');
      setSiteModalRoleTab('site_inspector');

      setShowBookSiteModal(false);
      setBookDate('');
      setSiteNotes('');
      setSelectedSiteUser('');
      setSiteInspectorUserId('');
      setPmUserId('');
      setDesignerUserId('');

      const res = await axios.post(`${API_BASE_URL}/leads/book-qc`, qcPayload);
      if (res.data?.success) {
        if (leadId) {
          localStorage.setItem(`qc_booked_${leadId}`, 'true');
        }
        if (targetLead?.manual_client_id) {
          localStorage.setItem(`qc_booked_${targetLead.manual_client_id}`, 'true');
        }
        try {
          window.dispatchEvent(new Event('qc_status_changed'));
          window.dispatchEvent(new Event('qc_slot_booked'));
        } catch (e) {}
        alert(res.data.message || '🎉 QC slot booked successfully!');
        if (viewingLeadModal) {
          setLeadNoticeMsgs(prev => ({ ...prev, [viewingLeadModal.lead_id]: res.data.message || '🎉 QC Inspector & PM Slot booked successfully!' }));
        }
      } else {
        const is20Paid = viewingLeadModal ? isTwentyPercentPaidForLead(viewingLeadModal) : false;
        if (!is20Paid && (res.data?.is_10_percent_required || res.data?.is_stage2_required)) {
          setCollectLead(viewingLeadModal);
          const bVal = parseFloat(viewingLeadModal?.total_budget as any) || parseFloat(viewingLeadModal?.estimated_budget as any) || 0;
          const req10 = Math.round(bVal * 0.10) || 5000;
          setCollectAmount(String(req10));
          setShowCollectModal(true);
        }
        if (viewingLeadModal) {
          setLeadNoticeMsgs(prev => ({ ...prev, [viewingLeadModal.lead_id]: res.data?.message || 'Payment Required before booking QC slot' }));
        }
      }
      setModalTab('qc');
      setSiteModalRoleTab('site_inspector');
      fetchAssignedLeads();
    } catch (err) {
      console.error('Book QC error', err);
      setModalTab('qc');
      setSiteModalRoleTab('site_inspector');
      fetchAssignedLeads();
    } finally {
      setSubmitting(false);
    }
  };

  const handleBookSiteSubmit = async (e: React.FormEvent) => {
    return handleBookMMTSSubmit(e);
  };

  const handleSaveStatus = async (lead: Lead) => {
    const newStatus = selectedStatuses[lead.lead_id] || lead.status;
    
    if (newStatus === 'won' || newStatus === 'converted') {
      const isRescheduled = lead.d1_status === 'rescheduled' || lead.status === 'rescheduled';
      if (isRescheduled) {
        alert('⚠️ Cannot convert to project! The consultation meeting is currently rescheduled. Please complete the meeting first.');
        setSelectedStatuses(prev => ({ ...prev, [lead.lead_id]: lead.status }));
        return;
      }
      if (!isAdminOrPM) {
        alert('⚠️ Restricted Action: Only Admin or Project Manager (PM) can initiate project start and record stage payments.');
        setSelectedStatuses(prev => ({ ...prev, [lead.lead_id]: lead.status }));
        return;
      }
      handleConvertClick(lead);
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

  const getStatusText = (status: string) => {
    switch (status) {
      case 'proposal_accepted': return 'Quote Accepted';
      case 'proposal_sent': return 'Proposal Sent';
      case 'won':
      case 'converted': return 'Converted';
      case 'lost':
      case 'dead':
      case 'dropped':
      case 'cancelled': return 'Lost';
      case 'pending':
      case 'in_meeting':
      case 'booked':
      case 'transferred':
      case 'rescheduled':
      case 'meeting_completed': return 'Pending';
      default: return 'New Lead';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'proposal_accepted': return 'Quote Accepted';
      case 'proposal_sent': return 'Proposal Sent';
      case 'won':
      case 'converted': return 'Converted';
      case 'lost':
      case 'dead':
      case 'dropped':
      case 'cancelled': return 'Lost';
      case 'pending':
      case 'in_meeting':
      case 'booked':
      case 'transferred':
      case 'rescheduled':
      case 'meeting_completed': return 'Pending';
      default: return 'New Lead';
    }
  };

  const handleConvertClick = async (lead: Lead) => {
    if (!isAdminOrPM) {
      setViewingPaymentLead(lead);
      return;
    }
    const isRescheduled = lead.d1_status === 'rescheduled' || lead.status === 'rescheduled';
    if (isRescheduled) {
      alert('⚠️ Cannot convert to project! The consultation meeting is currently rescheduled. Please complete the meeting first.');
      return;
    }

    const assignedId = lead.manual_client_id || (lead as any).project_code || `PR-${lead.lead_id}`;
    setSelectedLead(lead);
    
    let quotationBudget = '';
    const leadIdStr = String(lead.lead_id || '');
    const mcIdStr = String(lead.manual_client_id || '');

    const localAmt = localStorage.getItem(`initial_quote_amount_${leadIdStr}`) || 
                     (mcIdStr ? localStorage.getItem(`initial_quote_amount_${mcIdStr}`) : null);
    if (localAmt && Number(localAmt) > 0) {
      quotationBudget = String(localAmt);
    }

    if (!quotationBudget && (lead as any).initial_quote_amount && Number((lead as any).initial_quote_amount) > 0) {
      quotationBudget = String((lead as any).initial_quote_amount);
    }

    if (!quotationBudget) {
      try {
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
          const initQ = [...historyQuotes].sort((a, b) => (a.version || 0) - (b.version || 0)).find((q: any) => q.is_initial_quote || q.is_initial || q.extra_data_parsed?.is_initial_quote || q.extra_data?.is_initial_quote) || historyQuotes[0];
          if (initQ) {
            const qAmt = initQ.total_amount || initQ.final_amount || initQ.net_amount || initQ.grand_total;
            if (qAmt && Number(qAmt) > 0) {
              quotationBudget = String(qAmt);
            }
          }
        }
      } catch (e) {}
    }

    const totBudget = Math.round(Number(quotationBudget || lead.total_budget || (lead as any).estimated_budget) || 0);
    const prevPaid = Math.round(Number((lead as any).advance_paid || (lead as any).advance_received) || 0);
    const target10 = Math.round(totBudget * 0.10);
    const remAmt = totBudget > 0 ? Math.max(0, target10 - prevPaid) : 0;

    setConvertData({
      project_code: assignedId,
      project_name: lead.client_name + ' Project',
      project_head_id: '',
      site_engineer_id: '',
      total_budget: totBudget > 0 ? String(totBudget) : String(lead.total_budget || ''),
      advance_paid: remAmt > 0 ? String(remAmt) : (prevPaid > 0 ? String(prevPaid) : ''),
      start_date: getTodayDateString(),
      expected_end_date: '',
      created_by: String(user?.user_id || 1)
    });
    setShowConvertModal(true);
  };

  const handleCreateProjectFromLead = (lead: Lead) => {
    handleConvertClick(lead);
  };

  const handleEditClick = (lead: Lead) => {
    setEditingLead(lead);
    const standardScopes = ['2 BHK', '3 BHK', 'Villa', 'Duplex'];
    const isStandardScope = standardScopes.includes(lead.project_scope || '');
    setEditFormData({
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
      status: lead.status || 'enquiry'
    });
    setShowEditModal(true);
  };

  const handleUpdateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingEdit(true);
    const editingId = editingLead?.lead_id;
    const finalScope = editFormData.project_scope === 'Other' ? (editFormData.custom_scope?.trim() || 'Other') : editFormData.project_scope;

    setShowEditModal(false);
    setEditingLead(null);

    // Optimistic UI update
    if (editingId) {
      setLeads(prevLeads => prevLeads.map(l => String(l.lead_id) === String(editingId) ? {
        ...l,
        ...editFormData,
        project_scope: finalScope
      } : l));
      setAllLeadsData(prev => prev.map(l => String(l.lead_id) === String(editingId) ? {
        ...l,
        ...editFormData,
        project_scope: finalScope
      } : l));
      if (viewingCustomerLead && String(viewingCustomerLead.lead_id) === String(editingId)) {
        setViewingCustomerLead(prev => prev ? { ...prev, ...editFormData, project_scope: finalScope } : null);
      }
      if (viewingLeadModal && String(viewingLeadModal.lead_id) === String(editingId)) {
        setViewingLeadModal(prev => prev ? { ...prev, ...editFormData, project_scope: finalScope } : null);
      }
    }

    try {
      const response = await axios.put(`${API_BASE_URL}/leads`, {
        ...editFormData,
        project_scope: finalScope,
        lead_id: editingId
      });
      if (response.data && response.data.success) {
        fetchAssignedLeads();
      } else {
        alert(response.data?.message || 'Failed to update lead');
        fetchAssignedLeads();
      }
    } catch (err) {
      console.error('Failed to update lead', err);
      alert('Error updating lead');
      fetchAssignedLeads();
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Open Notes & Documents Modal
  const openLeadModal = (lead: Lead) => {
    setViewingLeadModal(lead);
    setCurrentFolder('');
    fetchNotes(lead.lead_id);
    fetchFiles(lead.lead_id, '');
    // Initialize personnel and role selection
    setSiteModalRoleTab('mmt');
    setMmtUserId(lead.mmt_assigned_id ? String(lead.mmt_assigned_id) : '');
    setPmUserId(lead.pm_assigned_id ? String(lead.pm_assigned_id) : '');
    setDesignerUserId(lead.associate_designer_assigned_id ? String(lead.associate_designer_assigned_id) : '');
    const inspectorId = (lead as any).site_inspector_id || lead.site_manager_id;
    if (inspectorId) {
      setSiteInspectorUserId(String(inspectorId));
      setSelectedSiteUser(String(inspectorId));
    }
    setSiteNotes(lead.mmts_notes || '');

    // STRICT TAB SAFETY: Ensure disabled tabs are never active when opening a lead
    const isStage1Paid = isStage1FullyPaid(lead);
    const isStage2Paid = isTwentyPercentPaidForLead(lead);

    setModalTab(prevTab => {
      if (prevTab === 'mmts' && !isStage1Paid) return 'files';
      if (prevTab === 'qc' && !isStage2Paid) return 'files';
      return prevTab;
    });
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
        alert(res.data.message || '🎉 QC slot booked successfully!');
        setQcDate(''); setQcTime(''); setQcNotes('');
        const updateObj = {
          qc_status: 'booked',
          site_manager_status: 'booked',
          site_inspector_status: 'booked',
          qc_booking_time: dt,
          site_manager_booking_time: dt,
          qc_notes: qcNotes
        };
        setViewingLeadModal(prev => prev ? { ...prev, ...updateObj } : prev);
        setLeads(prev => prev.map(l => String(l.lead_id) === String(viewingLeadModal.lead_id) ? { ...l, ...updateObj } : l));
        setAllLeadsData(prev => prev.map(l => String(l.lead_id) === String(viewingLeadModal.lead_id) ? { ...l, ...updateObj } : l));
        fetchAssignedLeads();
      } else { alert("Failed: " + res.data.message); }
    } catch (error) { console.error("QC booking error", error); }
  };

  const handleUpdateQCStatus = async (status: string) => {
    if (!viewingLeadModal) return;
    const targetLeadId = viewingLeadModal.lead_id;
    const targetManualId = viewingLeadModal.manual_client_id || (viewingLeadModal as any).project_code;

    // Persistent localStorage fallback so refresh NEVER loses completed status
    const isDone = status === 'meeting_completed' || status === 'completed' || status === 'approved' || status === 'qc_approved';
    if (isDone) {
      localStorage.setItem(`qc_completed_${targetLeadId}`, 'true');
      if (targetManualId) localStorage.setItem(`qc_completed_${targetManualId}`, 'true');
    } else {
      localStorage.removeItem(`qc_completed_${targetLeadId}`);
      if (targetManualId) localStorage.removeItem(`qc_completed_${targetManualId}`);
    }

    // Keep on QC tab
    setModalTab('qc');
    setSiteModalRoleTab('site_inspector');

    // Optimistic state updates across all status field aliases & leads array
    setViewingLeadModal(prev => prev ? { ...prev, qc_status: status, site_manager_status: status, site_inspector_status: status, is_qc_completed: isDone ? 1 : 0, is_qc_done: isDone ? 1 : 0 } : null);
    setLeads(prevLeads => prevLeads.map(l => (
      String(l.lead_id) === String(targetLeadId) || 
      (targetManualId && (String(l.manual_client_id) === String(targetManualId) || String((l as any).project_code) === String(targetManualId)))
    ) ? { ...l, qc_status: status, site_manager_status: status, site_inspector_status: status, is_qc_completed: isDone ? 1 : 0, is_qc_done: isDone ? 1 : 0 } : l));
    window.dispatchEvent(new CustomEvent('qc_meeting_status_changed', { detail: { status, lead_id: targetLeadId } }));
    window.dispatchEvent(new CustomEvent('qc_status_changed', { detail: { status, lead_id: targetLeadId } }));

    try {
      const res = await axios.post(`${API_BASE_URL}/leads/update-qc-status`, {
        lead_id: targetLeadId,
        manual_client_id: targetManualId,
        status: status,
        assigned_by_name: user?.name
      });
      setModalTab('qc');
      setSiteModalRoleTab('site_inspector');
      if (res.data.success) {
        fetchAssignedLeads();
      }
    } catch (e) { console.error("Update QC status error", e); }
  };

  const handleSendAgreementPDF = async () => {
    if (!agreementLead) return;
    setSubmittingAgreement(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/leads/send-agreement-pdf`, {
        lead_id: agreementLead.lead_id,
        final_budget: agreementBudget ? Number(agreementBudget) : null,
        notes: agreementNotes,
        assigned_by_name: user?.name
      });
      if (res.data.success) {
        alert(res.data.message);
        setShowAgreementModal(false);
        setAgreementLead(null);
        fetchAssignedLeads();
      } else {
        alert("Failed: " + res.data.message);
      }
    } catch (e) {
      console.error("Agreement PDF error", e);
      alert("Agreement PDF recorded successfully!");
      setShowAgreementModal(false);
      fetchAssignedLeads();
    } finally {
      setSubmittingAgreement(false);
    }
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

  const handleAddCustomerModalNote = async () => {
    const targetLead = viewingCustomerLead || viewingLeadModal;
    if (!newNote.trim() || !targetLead) return;
    try {
      const response = await axios.post(`${API_BASE_URL}/leads/notes`, {
        lead_id: targetLead.lead_id,
        note_text: newNote
      });
      if (response.data.success) {
        setNewNote('');
        fetchNotes(targetLead.lead_id);
      }
    } catch (err) {
      console.error('Failed to add note', err);
    }
  };

  const handleCustomerFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetLead = viewingCustomerLead || viewingLeadModal;
    if (!e.target.files || !e.target.files[0] || !targetLead) return;
    const file = e.target.files[0];
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('lead_id', String(targetLead.lead_id));
    formData.append('folder', currentFolder);

    try {
      const response = await axios.post(`${API_BASE_URL}/leads/upload`, formData);
      if (response.data.success) {
        fetchFiles(targetLead.lead_id, currentFolder);
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

  const handleCreateCustomerFolder = async () => {
    const targetLead = viewingCustomerLead || viewingLeadModal;
    if (!targetLead || !newFolderName.trim()) return;
    setCreatingFolder(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/leads/create-folder`, {
        lead_id: targetLead.lead_id,
        folder_name: newFolderName.trim(),
        parent_folder: currentFolder
      });
      if (response.data.success) {
        setNewFolderName('');
        fetchFiles(targetLead.lead_id, currentFolder);
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
    const backendRoot = API_BASE_URL.replace(/\/api\/?$/, '');
    const cleanPath = rawUrl.startsWith('/') ? rawUrl : '/' + rawUrl;
    return backendRoot + cleanPath;
  };

  const handleConversionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdminOrPM) {
      alert('⚠️ Access Restricted: Only Admin and Project Manager (PM) have permission to start projects and record stage payments.');
      return;
    }
    if (!selectedLead) return;

    const totalB = Number(convertData.total_budget) || 0;
    const target10 = totalB * 0.10;
    const nowInput = Number(convertData.advance_paid) || 0;
    const prevPaid = Number((selectedLead as any)?.advance_paid || (selectedLead as any)?.advance_received) || 0;
    const totalAccumulatedPaid = prevPaid + nowInput;

    // 🔒 Full 10% Stage 1 Token Advance required to convert project
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
          status: selectedLead.status || 'meeting_completed',
          data: { advance_paid: totalAccumulatedPaid, total_budget: totalB }
        });

        // 🚀 Optimistically update leads list in React state
        setLeads(prevLeads => prevLeads.map(l => 
          String(l.lead_id) === String(selectedLead.lead_id)
            ? { ...l, advance_paid: totalAccumulatedPaid, advance_received: totalAccumulatedPaid, total_budget: totalB }
            : l
        ));

        alert(`⚠️ Partial Stage 1 Advance recorded (₹${Math.round(nowInput).toLocaleString('en-IN')}).\n\nTotal Paid: ₹${Math.round(totalAccumulatedPaid).toLocaleString('en-IN')} (${paidP}%).\nFull 10% Target (₹${Math.round(target10).toLocaleString('en-IN')}) is strictly required before project can be opened or rendered on the Projects page. Remaining balance: ₹${Math.round(remAmt).toLocaleString('en-IN')}.`);
        setShowConvertModal(false);
        fetchAssignedLeads();
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
        lead_id: selectedLead.lead_id,
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
        navigate(`/projects/${pId}?open_mmts=true`);
      } else {
        alert(response.data.message || 'Failed to start project');
      }
    } catch (error: any) {
      console.error(error);
      alert('Error starting project: ' + (error?.response?.data?.message || error?.message || 'Unknown error'));
    } finally {
      setSubmitting(false);
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

  const checkPeriodDate = (dateValStr?: string | null): boolean => {
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
    // 🔒 Must have a booked designer slot to appear in Designer Leads page
    const d1Val = String(lead.d1_assigned_to || '').trim();
    const hasD1Assigned = (d1Val !== '' && d1Val !== '0' && d1Val !== 'null' && d1Val !== 'undefined') || Boolean(lead.d1_booking_time);
    if (!hasD1Assigned) return false;

    let matchesSearch = true;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      matchesSearch = (lead.client_name?.toLowerCase().includes(q)) || 
                      (lead.contact_number?.includes(q)) ||
                      (lead.location?.toLowerCase().includes(q)) ||
                      (lead.lead_id?.toLowerCase().includes(q)) ||
                      (lead.manual_client_id?.toLowerCase().includes(q));
    }

    let matchesStatus = true;
    if (statusFilter !== 'all') {
      if (statusFilter === 'pending') {
        matchesStatus = lead.status === 'enquiry' || lead.status === 'in_meeting' || lead.status === 'pending' || lead.status === 'booked';
      } else if (statusFilter === 'dead') {
        matchesStatus = lead.status === 'lost' || lead.status === 'dead' || lead.status === 'dropped' || lead.status === 'cancelled';
      } else if (statusFilter === 'meeting_completed' || statusFilter === 'completed') {
        matchesStatus = isCompletedMeetingLead(lead);
      } else if (statusFilter === 'won' || statusFilter === 'converted') {
        matchesStatus = lead.status === 'won' || lead.status === 'converted' || (lead as any).is_converted === 1 || (lead as any).is_converted === '1';
      } else if (statusFilter === 'proposal_accepted') {
        matchesStatus = lead.status === 'proposal_accepted' || lead.d1_status === 'proposal_accepted';
      } else {
        matchesStatus = lead.status === statusFilter;
      }
    }

    let matchesType = true;
    if (projectType !== 'all') {
      const pType = (lead.project_type || '').toLowerCase();
      if (projectType === 'furniture') {
        matchesType = pType.includes('furniture') || pType.includes('architectural');
      } else if (projectType === 'interior') {
        matchesType = pType.includes('interior');
      }
    }

    let matchesDate = true;
    if (statementPeriod !== 'all') {
      if (statusFilter === 'meeting_completed' || statusFilter === 'completed') {
        matchesDate = checkPeriodDate(lead.meeting_completed_at) || (!lead.meeting_completed_at && (checkPeriodDate(lead.d1_booking_time) || checkPeriodDate(lead.created_at)));
      } else {
        matchesDate = checkPeriodDate(lead.meeting_completed_at) || checkPeriodDate(lead.d1_booking_time) || checkPeriodDate(lead.created_at);
      }
    }

    return matchesSearch && matchesStatus && matchesType && matchesDate;
  });

  // Dynamic Metrics Calculations for D1 Leads based on active filters
  const totalLeads = filteredLeads.length;
  const pendingCount = filteredLeads.filter(l => l.status === 'enquiry' || l.status === 'in_meeting' || l.status === 'pending' || l.status === 'booked').length;
  const meetingCompletedCount = filteredLeads.filter(l => {
    if (!isCompletedMeetingLead(l)) return false;
    if (statementPeriod !== 'all') {
      return checkPeriodDate(l.meeting_completed_at) || (!l.meeting_completed_at && (checkPeriodDate(l.d1_booking_time) || checkPeriodDate(l.created_at)));
    }
    return true;
  }).length;
  const proposalSentCount = filteredLeads.filter(l => l.status === 'proposal_sent' || l.status === 'proposal_accepted').length;
  const convertedCount = filteredLeads.filter(l => l.status === 'won' || l.status === 'converted' || (l as any).is_converted === 1 || (l as any).is_converted === '1').length;
  const deadCount = filteredLeads.filter(l => l.status === 'lost' || l.status === 'dead' || l.status === 'dropped' || l.status === 'cancelled').length;
  const conversionRate = totalLeads ? ((convertedCount / totalLeads) * 100).toFixed(2) : '0.00';
  return (
    <div style={{ width: '100%', padding: '0 0 24px 0', fontFamily: 'sans-serif', backgroundColor: '#f9fafb', minHeight: '100vh' }}>

      {/* Global Filter Bar */}
      <div style={{ marginBottom: '20px' }}>
        <DashboardFilterBar
          statementPeriod={statementPeriod}
          onStatementPeriodChange={setStatementPeriod}
          initialStartDate={startDate}
          initialEndDate={endDate}
          projectType={projectType}
          onProjectTypeChange={setProjectType}
        />
      </div>

      {/* Header */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '24px', marginBottom: '24px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ padding: '12px', backgroundColor: '#0c1527', borderRadius: '12px', color: '#fca412' }}>
              <Users size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0c1527', margin: 0 }}>D1 Assigned Leads &amp; Consultations</h2>
              <p style={{ color: '#64748b', margin: '4px 0 0 0', fontSize: '0.88rem' }}>Manage lead consultations and track status updates in real-time.</p>
            </div>
          </div>
        </div>

        {/* Metric Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
          <div style={{ padding: '14px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ backgroundColor: '#fff9f0', border: '1px solid #ffe8c2', padding: '10px', borderRadius: '10px', color: '#fca412' }}><Users size={18} /></div>
            <div>
              <p style={{ color: '#64748b', fontSize: '0.78rem', fontWeight: 600, margin: 0 }}>Total Assigned</p>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0c1527', margin: '2px 0' }}>{totalLeads}</h3>
            </div>
          </div>

          <div style={{ padding: '14px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ backgroundColor: '#fff9f0', border: '1px solid #ffe8c2', padding: '10px', borderRadius: '10px', color: '#fca412' }}><Clock size={18} /></div>
            <div>
              <p style={{ color: '#64748b', fontSize: '0.78rem', fontWeight: 600, margin: 0 }}>Pending Leads</p>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0c1527', margin: '2px 0' }}>{pendingCount}</h3>
            </div>
          </div>

          <div
            onClick={() => setStatusFilter(prev => prev === 'meeting_completed' ? 'all' : 'meeting_completed')}
            style={{
              padding: '14px 16px',
              borderRadius: '12px',
              border: statusFilter === 'meeting_completed' ? '2px solid #0d9488' : '1px solid #e2e8f0',
              backgroundColor: statusFilter === 'meeting_completed' ? '#f0fdfa' : '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: statusFilter === 'meeting_completed' ? '0 2px 8px rgba(13, 148, 136, 0.18)' : 'none'
            }}
            title="Click to filter by Meeting Completed"
          >
            <div style={{ backgroundColor: '#ccfbf1', border: '1px solid #99f6e4', padding: '10px', borderRadius: '10px', color: '#0d9488' }}><CalendarCheck size={18} /></div>
            <div>
              <p style={{ color: '#64748b', fontSize: '0.78rem', fontWeight: 600, margin: 0 }}>Meeting Completed</p>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0c1527', margin: '2px 0' }}>{meetingCompletedCount}</h3>
            </div>
          </div>

          <div style={{ padding: '14px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ backgroundColor: '#ede9fe', padding: '10px', borderRadius: '10px', color: '#7c3aed' }}><CheckSquare size={18} /></div>
            <div>
              <p style={{ color: '#64748b', fontSize: '0.78rem', fontWeight: 600, margin: 0 }}>Proposal Sent</p>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0c1527', margin: '2px 0' }}>{proposalSentCount}</h3>
            </div>
          </div>

          <div style={{ padding: '14px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ backgroundColor: '#dcfce7', padding: '10px', borderRadius: '10px', color: '#16a34a' }}><CheckCircle2 size={18} /></div>
            <div>
              <p style={{ color: '#64748b', fontSize: '0.78rem', fontWeight: 600, margin: 0 }}>Converted</p>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0c1527', margin: '2px 0' }}>{convertedCount}</h3>
            </div>
          </div>

          <div style={{ padding: '14px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ backgroundColor: '#fee2e2', padding: '10px', borderRadius: '10px', color: '#dc2626' }}><X size={18} /></div>
            <div>
              <p style={{ color: '#64748b', fontSize: '0.78rem', fontWeight: 600, margin: 0 }}>Dead Leads</p>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0c1527', margin: '2px 0' }}>{deadCount}</h3>
            </div>
          </div>

          <div style={{ padding: '14px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ backgroundColor: '#fff9f0', border: '1px solid #ffe8c2', padding: '10px', borderRadius: '10px', color: '#fca412' }}><DollarSign size={18} /></div>
            <div>
              <p style={{ color: '#64748b', fontSize: '0.78rem', fontWeight: 600, margin: 0 }}>Conversion Rate</p>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0c1527', margin: '2px 0' }}>{conversionRate}%</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '18px 24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          
          <div style={{ position: 'relative', flex: 1, minWidth: '280px' }}>
            <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search client name, phone or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '10px 14px 10px 42px', borderRadius: '10px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.9rem' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0c1527' }}>Status Filter:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: '9px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.88rem', fontWeight: 700, backgroundColor: '#ffffff', color: '#0c1527' }}
            >
              <option value="all">All Statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="in_meeting">Started</option>
              <option value="meeting_completed">Meeting Done</option>
              <option value="proposal_accepted">Quote Accepted</option>
              <option value="won">Converted</option>
              <option value="transferred">Transfer</option>
            </select>
            <button
              onClick={resetD1Filters}
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
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 6px rgba(239, 68, 68, 0.12)'
              }}
              title="Reset all search queries and status filters"
            >
              <RotateCcw size={14} /> Reset Filters
            </button>
          </div>

        </div>
      </div>

      {/* Assigned Leads Table */}
      <div style={{ marginTop: '20px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
            <Loader2 className="animate-spin" size={32} color="#fca412" />
          </div>
        ) : filteredLeads.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b', backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
            <Users size={44} style={{ margin: '0 auto 12px auto', color: '#cbd5e1' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0c1527', margin: 0 }}>No Assigned Leads Found</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.88rem' }}>No leads matching your current filters were found.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', minHeight: activeDropdown ? '380px' : 'auto', paddingBottom: activeDropdown ? '120px' : '0px', backgroundColor: '#ffffff', borderRadius: '16px', border: '1.5px solid #ffe8c2', boxShadow: '0 4px 14px rgba(252, 164, 18, 0.05)', position: 'relative' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#fff9f0', borderBottom: '1.5px solid #ffe8c2', textAlign: 'left' }}>
                  <th style={{ padding: '14px 12px 14px 16px', color: '#0c1527', fontWeight: 800, fontSize: '0.88rem', width: '120px', backgroundColor: '#fff9f0' }}>Client ID</th>
                  <th style={{ padding: '14px 16px', color: '#0c1527', fontWeight: 800, fontSize: '0.88rem', backgroundColor: '#fff9f0' }}>Client Info</th>
                  <th style={{ padding: '14px 16px', color: '#0c1527', fontWeight: 800, fontSize: '0.88rem', backgroundColor: '#fff9f0' }}>Project / Scope</th>
                  <th style={{ padding: '14px 16px', color: '#0c1527', fontWeight: 800, fontSize: '0.88rem', backgroundColor: '#fff9f0' }}>Created On</th>
                  <th style={{ padding: '14px 16px', color: '#0c1527', fontWeight: 800, fontSize: '0.88rem', backgroundColor: '#fff9f0' }}>D1 Consultation &amp; Meeting Status</th>
                  <th style={{ padding: '14px 16px', color: '#0c1527', fontWeight: 800, fontSize: '0.88rem', textAlign: 'center', backgroundColor: '#fff9f0' }}>Notes</th>
                  <th style={{ padding: '14px 16px', color: '#0c1527', fontWeight: 800, fontSize: '0.88rem', width: '80px', textAlign: 'center', backgroundColor: '#fff9f0' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead, leadIdx) => {
                  const currentSelected = selectedStatuses[lead.lead_id] || lead.status;
                  const isModified = currentSelected !== lead.status;
                  const isSaving = savingLeadId === lead.lead_id;

                  return (
                    <tr key={lead.lead_id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.15s ease', position: 'relative', zIndex: activeDropdown === lead.lead_id ? 999 : 1 }}>
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                        <div style={{ color: '#0c1527', fontSize: '0.88rem', fontWeight: 600 }}>
                          {lead.manual_client_id || lead.project_code || (lead.lead_id ? `PR-${lead.lead_id}` : '-')}
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                        <div>
                          <div style={{ fontWeight: 600, color: '#0c1527', fontSize: '0.9rem', lineHeight: '1.2' }}>{lead.client_name || lead.project_name || `Client #${lead.lead_id}`}</div>
                          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '3px', fontWeight: 500 }}>{lead.contact_number || '-'}</div>
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                        <div>
                          <div style={{ fontWeight: 600, color: '#0c1527', fontSize: '0.88rem', lineHeight: '1.2' }}>{lead.location || lead.client_address || 'N/A'}</div>
                          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '3px', fontWeight: 500 }}>
                            {lead.project_scope || 'Full Scope'} {lead.project_type?.replace('_', ' ') || 'Interior Projects'}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                        <div style={{ color: '#0c1527', fontSize: '0.84rem', fontWeight: 600 }}>
                          {lead.created_at ? new Date(lead.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                        </div>
                      </td>
                      <td style={{ padding: '16px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            {/* D1 Consultation Status Badge */}
                            {(() => {
                              let activeStatus = (lead.status || lead.d1_status || 'scheduled').toLowerCase();
                              if ((activeStatus === 'booked' || activeStatus === 'enquiry' || activeStatus === 'scheduled') && lead.d1_status) {
                                const d1Lower = lead.d1_status.toLowerCase();
                                if (['in_meeting', 'started', 'meeting_completed', 'completed', 'transferred', 'cancelled'].includes(d1Lower)) {
                                  activeStatus = d1Lower;
                                }
                              }
                              const lMatchedQuotes = getQuotesForLead(lead);
                              const hasSentProposal = lMatchedQuotes.some(q => q.status === 'proposal' || q.status === 'proposal_sent' || q.ack_email_sent_at) || activeStatus === 'proposal_sent';
                              const hasAcceptedProposal = lMatchedQuotes.some(q => q.status === 'accepted' || q.ack_status === 'accepted') || activeStatus === 'proposal_accepted';
                              if (hasAcceptedProposal && !['won', 'converted', 'cancelled', 'lost'].includes(activeStatus)) {
                                activeStatus = 'proposal_accepted';
                              } else if (hasSentProposal && !['won', 'converted', 'proposal_accepted', 'cancelled', 'lost'].includes(activeStatus)) {
                                activeStatus = 'proposal_sent';
                              }
                              let bg = '#f1f5f9';
                              let text = '#475569';
                              let border = '#cbd5e1';
                              let label = 'Scheduled';

                              if (activeStatus === 'won' || activeStatus === 'converted') {
                                bg = '#dcfce7'; text = '#15803d'; border = '#bbf7d0'; label = 'Converted';
                              } else if (activeStatus === 'proposal_accepted') {
                                bg = '#ecfdf5'; text = '#059669'; border = '#a7f3d0'; label = 'Quote Accepted';
                              } else if (activeStatus === 'proposal_sent') {
                                bg = '#f3e8ff'; text = '#7e22ce'; border = '#d8b4fe'; label = 'Proposal Sent';
                              } else if (activeStatus === 'meeting_completed' || activeStatus === 'completed') {
                                bg = '#dcfce7'; text = '#15803d'; border = '#bbf7d0'; label = 'Meeting Done';
                              } else if (activeStatus === 'in_meeting' || activeStatus === 'started') {
                                bg = '#eff6ff'; text = '#1d4ed8'; border = '#bfdbfe'; label = 'Started';
                              } else if (activeStatus === 'pending') {
                                bg = '#fef3c7'; text = '#d97706'; border = '#fde68a'; label = 'Pending';
                              } else if (activeStatus === 'transferred' || activeStatus === 'transfer') {
                                bg = '#f3e8ff'; text = '#7e22ce'; border = '#d8b4fe'; label = 'Transfer';
                              } else if (activeStatus === 'cancelled') {
                                bg = '#fee2e2'; text = '#dc2626'; border = '#fecaca'; label = 'Cancelled';
                              } else if (activeStatus === 'lost' || activeStatus === 'dead') {
                                bg = '#fee2e2'; text = '#b91c1c'; border = '#fecaca'; label = 'Lost';
                              } else if (activeStatus === 'booked' || activeStatus === 'scheduled') {
                                const cleanBookingStr = lead.d1_booking_time ? lead.d1_booking_time.replace(' ', 'T') : '';
                                const isTimePassed = Boolean(cleanBookingStr && new Date(cleanBookingStr).getTime() < Date.now());
                                if (isTimePassed) {
                                  bg = '#fff7ed'; text = '#ea580c'; border = '#fed7aa'; label = 'Pending';
                                } else {
                                  bg = '#eff6ff'; text = '#1d4ed8'; border = '#bfdbfe'; label = 'Meeting Scheduled';
                                }
                              } else if (activeStatus === 'enquiry' || activeStatus === 'new') {
                                bg = '#f8fafc'; text = '#475569'; border = '#cbd5e1'; label = 'New Lead';
                              } else {
                                label = lead.d1_status || lead.status || 'Scheduled';
                              }

                              return (
                                <span style={{
                                  padding: '4px 10px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px',
                                  backgroundColor: bg,
                                  color: text,
                                  border: `1px solid ${border}`
                                }}>
                                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: text }}></span>
                                  {label}
                                </span>
                              );
                            })()}

                            {/* Booking Date Time */}
                            {lead.d1_booking_time && (
                              <span style={{ backgroundColor: '#fff9f0', color: '#fca412', border: '1px solid #ffe8c2', fontSize: '0.78rem', fontWeight: 700, padding: '3px 8px', borderRadius: '12px' }}>
                                ⏰ {new Date(lead.d1_booking_time).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}

                            {/* QC Slot Booked Badge in Green */}
                            {Boolean(
                              ((lead as any).qc_booking_time && String((lead as any).qc_booking_time).trim() !== '' && (lead as any).qc_booking_time !== '0000-00-00 00:00:00') ||
                              ((lead as any).site_manager_booking_time && String((lead as any).site_manager_booking_time).trim() !== '' && (lead as any).site_manager_booking_time !== '0000-00-00 00:00:00') ||
                              (lead as any).qc_status === 'booked'
                            ) && (
                              <span style={{ backgroundColor: '#dcfce7', color: '#15803d', border: '1px solid #86efac', fontSize: '0.78rem', fontWeight: 800, padding: '3px 8px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <CheckCircle size={12} color="#15803d" /> ✅ QC Slot Booked {((lead as any).qc_booking_time || (lead as any).site_manager_booking_time) ? `(${new Date((lead as any).qc_booking_time || (lead as any).site_manager_booking_time).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })})` : ''}
                              </span>
                            )}

                            {leadNoticeMsgs[lead.lead_id] && (
                              <div style={{ fontSize: '0.75rem', color: '#ea580c', backgroundColor: '#fff7ed', border: '1px solid #ffedd5', padding: '4px 8px', borderRadius: '6px', marginTop: '4px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <Clock size={12} color="#ea580c" /> {leadNoticeMsgs[lead.lead_id]}
                              </div>
                            )}
                          </div>

                          {/* D1 Consultation Status Row */}
                          {(() => {
                            const s = (lead.status || '').toLowerCase();
                            const d1s = (lead.d1_status || '').toLowerCase();
                            const isConverted = s === 'converted' || s === 'won' || d1s === 'converted' || d1s === 'won' || (lead as any).is_converted === 1 || (lead as any).is_converted === '1';
                            const isLost = s === 'lost' || s === 'dead' || s === 'cancelled' || s === 'dropped' || d1s === 'cancelled' || d1s === 'lost';
                            const isMeetingDone = isCompletedMeetingLead(lead);
                            
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
                            const uRole = String(user?.role || '').toLowerCase();
                            const isAdmin = ['admin', 'administrator', 'superadmin', 'management', 'owner'].includes(uRole) || uRole.includes('admin');
                            const isDesigner = ['d1', 'd2', 'designer', 'lead_designer', 'associate_designer', 'ad', 'graphic_designer', 'gd'].includes(uRole) || uRole.includes('design') || uRole.includes('d1') || uRole.includes('d2');
                            const isSales = ['sales', 'sales_person', 'sales_executive', 'business_associate', 'ba', 'telecaller'].includes(uRole) || (uRole.includes('sales') && !uRole.includes('manager'));
                            const isManagerOrAdmin = !isSales && (isAdmin || ['manager', 'general_manager', 'gm', 'operations_manager', 'om'].includes(uRole) || uRole.includes('manager'));
                            const canControlMeeting = !isSales && (isDesigner || isAdmin);
                            const isSalesOrAdmin = !isDesigner && (isAdmin || ['sales', 'sales_manager', 'sales_person', 'manager', 'business_associate', 'ba'].includes(uRole) || uRole.includes('sales'));

                            if (isMeetingDone) {
                              return (
                                <div style={{ fontSize: '0.8rem', color: '#4b5563', display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                    <span style={{ fontWeight: 600 }}>D1 Designer:</span>
                                    <span style={{ color: '#111827', fontWeight: 600 }}>
                                      {d1Name || (adName ? 'None' : 'Assigned')}
                                    </span>
                                    <span style={{ fontSize: '0.78rem', color: '#15803d', fontWeight: 800, backgroundColor: '#dcfce7', padding: '3px 8px', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                                      ✅ Meeting Completed
                                    </span>
                                    {isConverted && (
                                      <span style={{ fontSize: '0.78rem', color: '#1d4ed8', fontWeight: 800, backgroundColor: '#dbeafe', padding: '3px 8px', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
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
                                <div style={{ fontSize: '0.8rem', color: '#1d4ed8', fontWeight: 700, marginTop: '4px' }}>
                                  <span style={{ backgroundColor: '#dbeafe', color: '#1d4ed8', padding: '3px 8px', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                                    🎉 Converted
                                  </span>
                                </div>
                              );
                            }

                            if (isLost) {
                              const isCancelled = s === 'cancelled' || d1s === 'cancelled';
                              return (
                                <div style={{ fontSize: '0.8rem', color: isCancelled ? '#dc2626' : '#b91c1c', fontWeight: 600, marginTop: '4px' }}>
                                  <span style={{ backgroundColor: '#fee2e2', color: isCancelled ? '#dc2626' : '#b91c1c', padding: '3px 8px', borderRadius: '6px', border: '1px solid #fecaca' }}>
                                    {isCancelled ? '🚫 Booking / Project Cancelled' : '🔴 Lead Closed'}
                                  </span>
                                </div>
                              );
                            }

                            if (!hasDesigner) {
                              return (
                                <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                  <span style={{ fontWeight: 600 }}>D1 Designer:</span> <span style={{ color: '#94a3b8' }}>None</span>
                                  {isSalesOrAdmin && (
                                    <button
                                      style={{ padding: '4px 10px', backgroundColor: '#111827', color: 'white', borderRadius: '6px', border: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', cursor: 'pointer', marginLeft: '6px', fontWeight: 700 }}
                                      onClick={() => { setSelectedBookD1Lead(lead); setShowBookD1Modal(true); }}
                                    >
                                      <Calendar size={12} /> Book Designer
                                    </button>
                                  )}
                                </div>
                              );
                            }

                            const isInMeeting = d1s === 'in_meeting' || s === 'in_meeting';

                            return (
                              <div style={{ fontSize: '0.8rem', color: '#4b5563', display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                  <span style={{ fontWeight: 600 }}>D1 Designer:</span>
                                  <span style={{ color: '#111827', fontWeight: 700 }}>{d1Name || (adName ? 'None' : 'Assigned')}</span>
                                </div>

                                {adName && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                    <span style={{ fontWeight: 600, color: '#4338ca' }}>Associate Designer (AD):</span>
                                    <span style={{ color: '#3730a3', fontWeight: 700 }}>{adName}</span>
                                  </div>
                                )}

                                {(() => {
                                  const startKey = `meeting_started_at_${lead.lead_id}`;
                                  let startTs = localStorage.getItem(startKey);
                                  if (isInMeeting && !startTs) {
                                    startTs = String(Date.now());
                                    localStorage.setItem(startKey, startTs);
                                  }
                                  const elapsedSec = startTs ? Math.floor((nowTick - Number(startTs)) / 1000) : 999;
                                  const isInitialMinute = isInMeeting && elapsedSec < 60;

                                  if (loadingMeetingIds[lead.lead_id]) {
                                    return (
                                      <button
                                        disabled
                                        style={{ padding: '5px 12px', backgroundColor: '#f97316', color: 'white', borderRadius: '6px', border: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 800, cursor: 'wait' }}
                                      >
                                        <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Starting Meeting...
                                      </button>
                                    );
                                  }

                                  if (isInMeeting) {
                                    return (
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
                                              handleStatusChange(lead.lead_id, 'meeting_completed').finally(() => {
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
                                    );
                                  }

                                  return canControlMeeting ? (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setLoadingMeetingIds(prev => ({ ...prev, [lead.lead_id]: true }));
                                        localStorage.setItem(startKey, String(Date.now()));
                                        handleStatusChange(lead.lead_id, 'in_meeting').finally(() => {
                                          setLoadingMeetingIds(prev => ({ ...prev, [lead.lead_id]: false }));
                                        });
                                      }}
                                      style={{ padding: '5px 12px', backgroundColor: '#ea580c', color: 'white', borderRadius: '6px', border: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', width: 'fit-content', boxShadow: '0 2px 4px rgba(234, 88, 12, 0.2)' }}
                                    >
                                      <Play size={14} fill="white" /> Start Meeting
                                    </button>
                                  ) : (
                                    <span
                                      style={{
                                        padding: '5px 12px',
                                        backgroundColor: '#eff6ff',
                                        color: '#2563eb',
                                        border: '1px solid #bfdbfe',
                                        borderRadius: '6px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        fontSize: '0.78rem',
                                        fontWeight: 700
                                      }}
                                    >
                                      📅 Meeting Scheduled
                                    </span>
                                  );
                                })()}
                              </div>
                            );
                          })()}
                        </div>
                      </td>
                      <td style={{ padding: '16px', textAlign: 'center', verticalAlign: 'middle' }}>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); openLeadModal(lead); }}
                          style={{ background: '#fff9f0', border: '1px solid #ffe8c2', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', color: '#fca412', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 800, transition: 'all 0.15s ease' }}
                        >
                          <MessageSquare size={14} color="#fca412" /> View Notes
                        </button>
                      </td>
                      <td style={{ padding: '16px', textAlign: 'center', position: 'relative', verticalAlign: 'middle', zIndex: activeDropdown === lead.lead_id ? 999 : 'auto' }}>
                        {(() => {
                          const isLost = lead.status === 'lost' || lead.status === 'dead' || lead.status === 'dropped' || lead.status === 'cancelled' || lead.d1_status === 'cancelled' || lead.d1_status === 'lost';
                          
                          // 1. Consultation Meeting States
                          const isMeetingInProgress = lead.d1_status === 'in_meeting' || lead.d1_status === 'started' || lead.status === 'in_meeting';
                          const isMeetingEnded = !isMeetingInProgress && (
                            lead.d1_status === 'meeting_completed' || 
                            lead.d1_status === 'completed' || 
                            lead.status === 'meeting_completed' || 
                            lead.status === 'completed' || 
                            lead.status === 'proposal_sent' || 
                            lead.status === 'proposal_accepted' || 
                            lead.d1_status === 'won' || 
                            lead.d1_status === 'converted' || 
                            lead.status === 'won' || 
                            lead.status === 'converted'
                          );
                          const isMeetingStartedOrDone = isMeetingInProgress || isMeetingEnded;

                          // 2. Lead Converted & 10% Advance State
                          const isLeadConverted = lead.status === 'converted' || lead.status === 'won' || lead.d1_status === 'converted' || lead.d1_status === 'won' || Boolean(lead.project_id) || Boolean((lead as any).is_converted) || Boolean((lead as any).converted_at);
                          const isProjectStarted = isLeadConverted && (Boolean(lead.project_id) || Boolean(lead.converted_at));
                          const isQuoteAccepted = isInitialQuoteAccepted(lead);
                          const lIdStr = String(lead.lead_id || '').trim();
                          const mcIdStr = String(lead.manual_client_id || '').trim().toLowerCase();
                          const cNameStr = String(lead.client_name || '').trim().toLowerCase();
                          const existingQuoteForLead = existingQuotes.find(q => {
                            if (!isRealQuote(q)) return false;
                            const qPid = String(q.project_id || '').trim().toLowerCase();
                            const qCode = String(q.project_code || '').trim().toLowerCase();
                            const qLeadId = String(q.lead_id || '').trim().toLowerCase();

                            if (lIdStr && (qLeadId === lIdStr.toLowerCase() || qPid === lIdStr.toLowerCase() || qCode === lIdStr.toLowerCase() || qPid === `pr-${lIdStr.toLowerCase()}` || qCode === `pr-${lIdStr.toLowerCase()}`)) return true;
                            if (mcIdStr && (qPid === mcIdStr || qCode === mcIdStr)) return true;
                            return false;
                          });
                          const hasInitialInQuotes = Boolean(existingQuoteForLead);

                          let totalB = Number((lead as any).initial_quote_amount || lead.total_budget) || 0;
                          if (totalB === 0) {
                            const matchingQ = existingQuotes.find(q => {
                              if (!isRealQuote(q)) return false;
                              const qPid = String(q.project_id || '').trim().toLowerCase();
                              const qCode = String(q.project_code || '').trim().toLowerCase();
                              return (lIdStr && (qPid === lIdStr.toLowerCase() || qCode === lIdStr.toLowerCase())) ||
                                     (mcIdStr && (qPid === mcIdStr.toLowerCase() || qCode === mcIdStr.toLowerCase()));
                            });
                            if (matchingQ) {
                              totalB = Number(matchingQ.total_amount || matchingQ.final_amount || 0);
                            }
                          }
                          const target10 = totalB * 0.10;
                          const paid10 = Math.max(parseFloat(String((lead as any).advance_received || 0)) || 0, parseFloat(String((lead as any).advance_paid || 0)) || 0);
                          const is10PercentPaid = isStage1FullyPaid(lead);

                          // 3. MMTS Booking State
                          const mmtsStatus = ((lead as any).mmts_status || '').toLowerCase();
                          const hasMmtPersonnel = Boolean(
                            (lead.mmt_assigned_name && lead.mmt_assigned_name.trim() !== '' && lead.mmt_assigned_name !== 'MMTS Member') ||
                            (lead.mmt_assigned_id && String(lead.mmt_assigned_id) !== '0' && String(lead.mmt_assigned_id) !== 'null')
                          );
                          const isMmtBooked = Boolean((mmtsStatus === 'booked' || mmtsStatus === 'in_meeting') && hasMmtPersonnel);
                          const isMmtCompleted = mmtsStatus === 'meeting_completed' || mmtsStatus === 'completed';

                          // 4. QC / Site Inspector Booking State
                          const qcStatus = String((lead as any).qc_status || (lead as any).site_inspector_status || (lead as any).site_manager_status || (lead as any).status || '').toLowerCase();
                          const isQcCompletedLocally = localStorage.getItem(`qc_completed_${lead.lead_id}`) === 'true' || (lead.manual_client_id && localStorage.getItem(`qc_completed_${lead.manual_client_id}`) === 'true');
                          const isQcCompleted = isQcCompletedLocally || qcStatus === 'meeting_completed' || qcStatus === 'completed' || qcStatus === 'approved' || qcStatus === 'qc_approved' || (lead as any).is_qc_completed === 1 || (lead as any).is_qc_done === 1 || (lead as any).qc_approved === 1;
                          const hasQcPersonnel = Boolean(
                            (lead.site_inspector_assigned_name && lead.site_inspector_assigned_name.trim() !== '' && lead.site_inspector_assigned_name !== 'Pending Assignment' && lead.site_inspector_assigned_name !== 'QC Team / Inspector') ||
                            (lead.site_inspector_assigned_id && String(lead.site_inspector_assigned_id) !== '0' && String(lead.site_inspector_assigned_id) !== 'null') ||
                            (lead.site_manager_assigned_to && String(lead.site_manager_assigned_to) !== '0')
                          );
                          const hasQcBookingTime = Boolean(
                            ((lead as any).qc_booking_time && String((lead as any).qc_booking_time).trim() !== '' && (lead as any).qc_booking_time !== '0000-00-00 00:00:00') ||
                            ((lead as any).site_manager_booking_time && String((lead as any).site_manager_booking_time).trim() !== '' && (lead as any).site_manager_booking_time !== '0000-00-00 00:00:00') ||
                            (lead as any).qc_status === 'booked'
                          );
                          const isQcBooked = !isQcCompleted && hasQcBookingTime;

                          const openUpward = filteredLeads.length >= 5 && leadIdx >= filteredLeads.length - 2;
                          const isOpen = activeDropdown === lead.lead_id;

                          return (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                              <button 
                                onClick={(e) => { e.stopPropagation(); setActiveDropdown(isOpen ? null : lead.lead_id); }}
                                style={{ 
                                  background: isOpen ? '#eff6ff' : '#f8fafc', 
                                  border: isOpen ? '1.5px solid #2563eb' : '1px solid #cbd5e1', 
                                  borderRadius: '6px', 
                                  cursor: 'pointer', 
                                  color: isOpen ? '#2563eb' : '#475569', 
                                  padding: '6px 10px', 
                                  display: 'inline-flex', 
                                  alignItems: 'center', 
                                  gap: '4px',
                                  boxShadow: isOpen ? '0 0 0 3px rgba(37, 99, 235, 0.15)' : 'none',
                                  transition: 'all 0.15s ease'
                                }}
                                title="More Actions"
                              >
                                <MoreVertical size={18} color={isOpen ? '#2563eb' : '#475569'} />
                              </button>

                              {isOpen && (
                                <>
                                  {/* Transparent backdrop so clicking anywhere outside immediately closes dropdown */}
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
                                    style={{ position: 'absolute', right: 0, ...(openUpward ? { bottom: 'calc(100% + 4px)' } : { top: 'calc(100% + 4px)' }), backgroundColor: 'white', borderRadius: '10px', boxShadow: '0 15px 30px -5px rgba(0, 0, 0, 0.25)', border: '1.5px solid #cbd5e1', zIndex: 99999, minWidth: '240px', overflow: 'hidden', padding: '6px' }}
                                  >
                                  
                                  {/* Step 0A. View Details */}
                                  <button 
                                    onClick={(e) => { 
                                      e.stopPropagation(); 
                                      setActiveDropdown(null); 
                                      setViewingLeadModal(null);
                                      setViewingCustomerLead(lead); 
                                      setCustomerTab('details');
                                      setCurrentFolder('');
                                      fetchNotes(lead.lead_id);
                                      fetchFiles(lead.lead_id, '');
                                      setShowCustomerModal(true); 
                                    }}
                                    style={{ width: '100%', padding: '10px 12px', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', fontSize: '0.85rem', color: '#1e293b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}
                                  >
                                    <Eye size={14} color="#2563eb" /> View Details
                                  </button>

                                  {/* Step 1. D1 Docs (Always Visible) */}
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); openLeadModal(lead); }}
                                    style={{ width: '100%', padding: '10px 12px', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', fontSize: '0.85rem', color: '#374151', display: 'flex', alignItems: 'center', gap: '8px' }}
                                  >
                                    <FileText size={14} /> D1 Docs
                                  </button>

                                  {/* Step 2. Create Initial / Final Quotation (Available before, during, and after meeting) */}
                                  {(() => {
                                    const lIdStr = String(lead.lead_id || '').trim();
                                    const existingQuoteForLead = existingQuotes.find(q => {
                                      if (!isRealQuote(q)) return false;
                                      const qPid = String(q.project_id || '').trim().toLowerCase();
                                      const qCode = String(q.project_code || '').trim().toLowerCase();
                                      const qLeadId = String(q.lead_id || '').trim().toLowerCase();

                                      if (lIdStr && (qLeadId === lIdStr.toLowerCase() || qPid === lIdStr.toLowerCase() || qCode === lIdStr.toLowerCase() || qPid === `pr-${lIdStr.toLowerCase()}` || qCode === `pr-${lIdStr.toLowerCase()}`)) return true;
                                      if (mcIdStr && (qPid === mcIdStr || qCode === mcIdStr)) return true;
                                      return false;
                                    });

                                    const hasInitial = Boolean(existingQuoteForLead);
                                    const hasFinal = hasQuotationCreated(lead);

                                    // After MMTS Meeting Completed -> Show Final Quotation option
                                    if (isMmtCompleted) {
                                      return (
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveDropdown(null);
                                            if (existingQuoteForLead) {
                                              navigate('/quotes', { 
                                                state: { 
                                                  project: {
                                                    ...lead,
                                                    project_id: existingQuoteForLead.project_id || lead.lead_id,
                                                    project_code: existingQuoteForLead.project_code || (lead as any).project_code,
                                                    client_name: existingQuoteForLead.client_name || existingQuoteForLead.subtitle || lead.client_name,
                                                    quote_id: existingQuoteForLead.quote_id
                                                  },
                                                  targetQuote: existingQuoteForLead,
                                                  isFinalMode: true
                                                } 
                                              });
                                            } else {
                                              navigate('/quotes');
                                            }
                                          }}
                                          style={{ 
                                            width: '100%', 
                                            padding: '10px 12px', 
                                            textAlign: 'left', 
                                            background: hasFinal ? '#f0fdf4' : '#fff7ed', 
                                            border: 'none', 
                                            borderBottom: hasFinal ? '1px solid #dcfce7' : '1px solid #ffedd5', 
                                            cursor: 'pointer', 
                                            fontSize: '0.85rem', 
                                            color: hasFinal ? '#15803d' : '#ea580c', 
                                            fontWeight: 800, 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: '8px' 
                                          }}
                                        >
                                          {hasFinal ? (
                                            <>
                                              <CheckCircle2 size={14} color="#15803d" /> Final Quotation Created ✓
                                            </>
                                          ) : (
                                            <>
                                              <FileText size={14} color="#ea580c" /> Create Final Quotation
                                            </>
                                          )}
                                        </button>
                                      );
                                    }

                                    // Before MMTS Meeting Completed -> Show Initial Quotation option
                                    return (
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActiveDropdown(null);
                                          if (existingQuoteForLead) {
                                            // Quote already exists! Open existing quotation workspace (DO NOT create new!)
                                            navigate('/quotes', { 
                                              state: { 
                                                project: {
                                                  ...lead,
                                                  project_id: existingQuoteForLead.project_id || lead.lead_id,
                                                  project_code: existingQuoteForLead.project_code || (lead as any).project_code,
                                                  client_name: existingQuoteForLead.client_name || existingQuoteForLead.subtitle || lead.client_name,
                                                  quote_id: existingQuoteForLead.quote_id,
                                                  is_initial_quote: true,
                                                  is_lead_converted: false,
                                                  is_converted: 0,
                                                  has_project_started: false
                                                },
                                                targetQuote: {
                                                  ...existingQuoteForLead,
                                                  is_initial_quote: true,
                                                  is_lead_converted: false,
                                                  is_converted: 0,
                                                  has_project_started: false
                                                },
                                                isInitialQuote: true
                                              } 
                                            });
                                          } else {
                                            // First time -> navigate to create quotation workspace
                                            navigate(`/quotes?create=true&lead_id=${lead.lead_id}&initial=true`, { 
                                              state: { 
                                                project: { ...lead, is_initial_quote: true, is_lead_converted: false, is_converted: 0, has_project_started: false }, 
                                                createForLead: { ...lead, is_initial_quote: true, is_lead_converted: false, is_converted: 0, has_project_started: false },
                                                isInitialQuote: true
                                              } 
                                            });
                                          }
                                        }}
                                        style={{ 
                                          width: '100%', 
                                          padding: '10px 12px', 
                                          textAlign: 'left', 
                                          background: hasInitial ? '#f0fdf4' : '#fff7ed', 
                                          border: 'none', 
                                          borderBottom: hasInitial ? '1px solid #dcfce7' : '1px solid #ffedd5', 
                                          cursor: 'pointer', 
                                          fontSize: '0.85rem', 
                                          color: hasInitial ? '#15803d' : '#ea580c', 
                                          fontWeight: 800, 
                                          display: 'flex', 
                                          alignItems: 'center', 
                                          gap: '8px' 
                                        }}
                                      >
                                        {hasInitial ? (
                                          <>
                                            <CheckCircle2 size={14} color="#15803d" /> Open Initial Quotation ✓
                                          </>
                                        ) : (
                                          <>
                                            <FileText size={14} color="#ea580c" /> Create Initial Quotation
                                          </>
                                        )}
                                      </button>
                                    );
                                  })()}

                                  {/* If Lead is Lost */}
                                  {isLost ? (
                                    <div style={{ padding: '10px 12px', fontSize: '0.78rem', color: '#dc2626', fontWeight: 600, backgroundColor: '#fee2e2' }}>
                                      ❌ Lead Marked as Lost
                                    </div>
                                  ) : (
                                    <>
                                      {/* Step 3. Convert Lead -> Start Project (Stage 1 Advance) */}
                                      {/* Appears when quotation is accepted by client OR already converted */}
                                      {(isQuoteAccepted || isLeadConverted) && (() => {
                                        const remAmt = Math.max(0, Math.round(target10 - paid10));

                                        if (!isLeadConverted || !is10PercentPaid) {
                                          if (isAdminOrPM) {
                                            return (
                                              <button 
                                                onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); handleCreateProjectFromLead(lead); }}
                                                style={{ width: '100%', padding: '10px 12px', textAlign: 'left', background: '#fff7ed', border: 'none', borderBottom: '1px solid #ffedd5', cursor: 'pointer', fontSize: '0.85rem', color: '#ea580c', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}
                                              >
                                                <DollarSign size={14} color="#ea580c" /> {paid10 > 0 ? `Collect Remaining Stage 1 (₹${Math.round(remAmt).toLocaleString('en-IN')})` : 'Start Project (Stage 1 Advance)'}
                                              </button>
                                            );
                                          } else {
                                            // Employee: Start Project option hidden, View Action displayed showing amount client needs to pay
                                            return (
                                              <button 
                                                onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); setViewingPaymentLead(lead); }}
                                                style={{ width: '100%', padding: '10px 12px', textAlign: 'left', background: '#f8fafc', border: 'none', borderBottom: '1px solid #e2e8f0', cursor: 'pointer', fontSize: '0.82rem', color: '#0369a1', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}
                                                title="View client payment details"
                                              >
                                                <Eye size={14} color="#0284c7" /> 
                                                <span>Client Needs to Pay: <strong style={{ color: '#ea580c' }}>₹{Math.round(remAmt).toLocaleString('en-IN')}</strong></span>
                                              </button>
                                            );
                                          }
                                        }

                                        return null;
                                      })()}

                                      {/* Step 4. MMTS Slot Booking option in Action Menu */}
                                      {(() => {
                                        if (!isLeadConverted) {
                                          return null;
                                        }

                                        const isMmtsPaid = isStage1FullyPaid(lead);

                                        if (!isMmtsPaid) {
                                          if (isAdminOrPM) {
                                            return (
                                              <button 
                                                onClick={(e) => { 
                                                  e.stopPropagation(); 
                                                  setActiveDropdown(null); 
                                                  openLeadModal(lead); 
                                                  setModalTab('files'); 
                                                  setCollectLead(lead);
                                                  const totalB = Math.max(parseFloat(String(lead.initial_quote_amount || 0)) || 0, parseFloat(String(lead.total_budget || 0)) || 0, parseFloat(String(lead.estimated_budget || 0)) || 0);
                                                  const req10 = Math.round(totalB * 0.10) || 5000;
                                                  const paid10 = Math.max(parseFloat(String(lead.advance_received || 0)) || 0, parseFloat(String(lead.advance_paid || 0)) || 0, parseFloat(String(lead.total_paid || 0)) || 0);
                                                  const dueAmt = Math.max(0, req10 - paid10) || req10;
                                                  setCollectAmount(String(dueAmt));
                                                  setShowCollectModal(true);
                                                }}
                                                style={{ width: '100%', padding: '10px 12px', textAlign: 'left', background: '#fff1f2', border: 'none', borderBottom: '1px solid #fee2e2', cursor: 'pointer', fontSize: '0.82rem', color: '#dc2626', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}
                                              >
                                                🔒 📦 Connect MMTS (10% Req.)
                                              </button>
                                            );
                                          } else {
                                            return (
                                              <button 
                                                onClick={(e) => { 
                                                  e.stopPropagation(); 
                                                  setActiveDropdown(null); 
                                                  setViewingPaymentLead(lead);
                                                }}
                                                style={{ width: '100%', padding: '10px 12px', textAlign: 'left', background: '#fff1f2', border: 'none', borderBottom: '1px solid #fee2e2', cursor: 'pointer', fontSize: '0.82rem', color: '#dc2626', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}
                                                title="View payment requirement"
                                              >
                                                <Lock size={14} color="#dc2626" /> 📦 MMTS Locked (Stage 1 Required)
                                              </button>
                                            );
                                          }
                                        }

                                        if (isMmtCompleted) {
                                          return (
                                            <div style={{ padding: '8px 10px', backgroundColor: '#dcfce7', borderRadius: '6px', fontSize: '0.78rem', color: '#15803d', fontWeight: 800, border: '1px solid #bbf7d0', marginBottom: '4px' }}>
                                              ✅ MMTS Meeting Completed
                                            </div>
                                          );
                                        }

                                        if (isMmtBooked) {
                                          return (
                                            <button 
                                              onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); openLeadModal(lead); setModalTab('mmts'); }}
                                              style={{ width: '100%', padding: '10px 12px', textAlign: 'left', background: '#fff7ed', border: 'none', borderBottom: '1px solid #ffedd5', cursor: 'pointer', fontSize: '0.82rem', color: '#c2410c', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}
                                            >
                                              <Calendar size={14} color="#c2410c" /> 📦 MMTS Slot Booked
                                            </button>
                                          );
                                        }

                                        return (
                                          <button 
                                            onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); openLeadModal(lead); setModalTab('mmts'); setSiteModalRoleTab('mmt'); }}
                                            style={{ width: '100%', padding: '10px 12px', textAlign: 'left', background: '#ffffff', border: 'none', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', fontSize: '0.85rem', color: '#ea580c', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}
                                          >
                                            <Calendar size={14} color="#ea580c" /> 📦 Connect MMTS &amp; PM Slot →
                                          </button>
                                        );
                                      })()}

                                      {/* Step 5. Book Slot for QC Option in Action Menu */}
                                      {(() => {
                                        if (!isLeadConverted || (!isMmtBooked && !isMmtCompleted)) {
                                          return null;
                                        }

                                        if (isQcCompleted) {
                                          return (
                                            <div style={{ padding: '8px 10px', backgroundColor: '#dcfce7', borderRadius: '6px', fontSize: '0.78rem', color: '#15803d', fontWeight: 800, border: '1px solid #bbf7d0', marginBottom: '4px' }}>
                                              ✅ QC Meeting Completed
                                            </div>
                                          );
                                        }

                                        if (isQcBooked) {
                                          return (
                                            <button 
                                              onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); openLeadModal(lead); setModalTab('qc'); }}
                                              style={{ width: '100%', padding: '10px 12px', textAlign: 'left', background: '#dcfce7', border: 'none', borderBottom: '1px solid #bbf7d0', cursor: 'pointer', fontSize: '0.82rem', color: '#15803d', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}
                                            >
                                              <CheckCircle size={14} color="#15803d" /> ✅ QC Slot Booked
                                            </button>
                                          );
                                        }

                                        const isStage2Paid = isTwentyPercentPaidForLead(lead);

                                        if (!isStage2Paid) {
                                          if (isAdminOrPM) {
                                            return (
                                              <button 
                                                onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); openLeadModal(lead); setModalTab('files'); setCollectLead(lead); const totalB = Math.max(parseFloat(String(lead.initial_quote_amount || 0)) || 0, parseFloat(String(lead.total_budget || 0)) || 0, parseFloat(String(lead.estimated_budget || 0)) || 0); const req20 = Math.round(totalB * 0.20) || 10000; const paidAdv = Math.max(parseFloat(String(lead.advance_received || 0)) || 0, parseFloat(String(lead.advance_paid || 0)) || 0, parseFloat(String(lead.total_paid || 0)) || 0); const dueAmt = Math.max(0, req20 - paidAdv) || req20; setCollectAmount(String(dueAmt)); setShowCollectModal(true); }}
                                                style={{ 
                                                  width: '100%', 
                                                  padding: '10px 12px', 
                                                  textAlign: 'left', 
                                                  background: '#fff7ed', 
                                                  border: 'none', 
                                                  borderBottom: '1px solid #ffedd5', 
                                                  cursor: 'pointer', 
                                                  fontSize: '0.82rem', 
                                                  color: '#c2410c', 
                                                  fontWeight: 800, 
                                                  display: 'flex', 
                                                  alignItems: 'center', 
                                                  gap: '8px' 
                                                }}
                                              >
                                                <Lock size={14} color="#c2410c" /> 🔍 Book Slot for QC (Stage 2 Req.)
                                              </button>
                                            );
                                          } else {
                                            return (
                                              <button 
                                                onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); setViewingPaymentLead(lead); }}
                                                style={{ 
                                                  width: '100%', 
                                                  padding: '10px 12px', 
                                                  textAlign: 'left', 
                                                  background: '#fff7ed', 
                                                  border: 'none', 
                                                  borderBottom: '1px solid #ffedd5', 
                                                  cursor: 'pointer', 
                                                  fontSize: '0.82rem', 
                                                  color: '#c2410c', 
                                                  fontWeight: 800, 
                                                  display: 'flex', 
                                                  alignItems: 'center', 
                                                  gap: '8px' 
                                                }}
                                                title="View payment requirement"
                                              >
                                                <Lock size={14} color="#c2410c" /> 🔍 QC Locked (Stage 2 Required)
                                              </button>
                                            );
                                          }
                                        }

                                        return (
                                          <button 
                                            onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); openLeadModal(lead); setModalTab('qc'); setSiteModalRoleTab('site_inspector'); }}
                                            style={{ 
                                              width: '100%', 
                                              padding: '10px 12px', 
                                              textAlign: 'left', 
                                              background: '#eff6ff', 
                                              border: 'none', 
                                              borderBottom: '1px solid #dbeafe', 
                                              cursor: 'pointer', 
                                              fontSize: '0.82rem', 
                                              color: '#2563eb', 
                                              fontWeight: 800, 
                                              display: 'flex', 
                                              alignItems: 'center', 
                                              gap: '8px' 
                                            }}
                                          >
                                            <Calendar size={14} color="#2563eb" /> 🔍 Book Slot for QC
                                          </button>
                                        );
                                      })()}

                                      {/* Step 6. Create Agreement & 40% R2P Payment Flow (STRICTLY REQUIRES isQcCompleted === true) */}
                                      {isQcCompleted && (() => {
                                        const agInfo = hasAgreementSigned(lead);
                                        const totalBudgetVal = Number((lead as any).total_budget || (lead as any).estimated_budget || (lead as any).initial_quote_amount || 0);
                                        const totalPaidVal = Number((lead as any).advance_paid || (lead as any).total_paid || 0);
                                        const paidPercent = totalBudgetVal > 0 ? ((totalPaidVal / totalBudgetVal) * 100) : 0;
                                        const is40PercentPaid = paidPercent >= 59.5 || Boolean((lead as any).is_40_percent_paid);

                                        return (
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                                            <button 
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setActiveDropdown(null);
                                                if (agInfo.isSigned) {
                                                  // Agreement already signed -> View Agreement
                                                  navigate(`/agreements?project_id=${lead.lead_id}`);
                                                } else if (agInfo.exists) {
                                                  // Agreement created -> View/Sign Agreement
                                                  navigate(`/agreements?project_id=${lead.lead_id}`);
                                                } else if (!is40PercentPaid) {
                                                  // 40% payment not recorded yet -> Redirect to project page first for Continue vs Withdraw & 40% payment modal
                                                  navigate(`/projects/${lead.lead_id}`);
                                                } else {
                                                  // 40% payment IS paid -> Redirect to create agreement
                                                  navigate(`/agreements?project_id=${lead.lead_id}&create=true`);
                                                }
                                              }}
                                              style={{ 
                                                width: '100%', 
                                                padding: '9px 12px', 
                                                textAlign: 'left', 
                                                background: agInfo.isSigned ? '#f0fdf4' : agInfo.exists ? '#dcfce7' : '#eff6ff', 
                                                border: agInfo.isSigned ? '1px solid #bbf7d0' : agInfo.exists ? '1px solid #86efac' : '1px solid #bfdbfe', 
                                                borderRadius: '6px', 
                                                cursor: 'pointer', 
                                                fontSize: '0.82rem', 
                                                color: (agInfo.isSigned || agInfo.exists) ? '#15803d' : '#1d4ed8', 
                                                fontWeight: 800, 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                gap: '6px',
                                                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                                              }}
                                            >
                                              {agInfo.isSigned ? (
                                                <>
                                                  <CheckCircle2 size={14} color="#15803d" /> Agreement Signed ✓
                                                </>
                                              ) : agInfo.exists ? (
                                                <>
                                                  <CheckCircle2 size={14} color="#15803d" /> Agreement Created ✓
                                                </>
                                              ) : (
                                                <>
                                                  <FileText size={14} color="#1d4ed8" /> Create Agreement
                                                </>
                                              )}
                                            </button>
                                          </div>
                                        );
                                      })()}
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* LEAD NOTES & D1 DOCUMENTS MODAL — FULL SCREEN SIMILAR TO FILTER */}
      {viewingLeadModal && (
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setViewingLeadModal(null);
            }
          }}
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 99999,
            display: 'flex',
            justifyContent: 'flex-end',
            pointerEvents: 'auto',
            margin: 0,
            padding: 0
          }}
        >
          <div 
            style={{
              width: isFullWidth ? '100%' : '40%',
              minWidth: isFullWidth ? '100%' : 'min(520px, 100%)',
              height: '100%',
              backgroundColor: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '-15px 0 45px rgba(0, 0, 0, 0.3)',
              animation: 'slideIn 0.28s ease-out',
              borderRadius: 0,
              border: 'none',
              borderLeft: isFullWidth ? 'none' : '1.5px solid #cbd5e1',
              margin: 0,
              padding: 0,
              overflow: 'hidden',
              position: 'relative'
            }}
          >
            
            {/* Modal Header */}
            <div style={{
              padding: '18px 24px',
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
              color: 'white',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexShrink: 0,
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 0
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: '#ffffff', letterSpacing: '-0.01em' }}>
                    {viewingLeadModal.client_name}
                  </h3>
                  <span style={{
                    backgroundColor: 'rgba(245, 158, 11, 0.18)',
                    border: '1px solid rgba(245, 158, 11, 0.45)',
                    color: '#fbbf24',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    padding: '3px 10px',
                    borderRadius: '20px',
                    letterSpacing: '0.4px',
                    display: 'inline-flex',
                    alignItems: 'center'
                  }}>
                    Project ID: {viewingLeadModal.manual_client_id || viewingLeadModal.lead_id}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <button 
                  type="button"
                  onClick={() => setIsFullWidth(prev => !prev)} 
                  title={isFullWidth ? "Restore 40% side drawer" : "Expand to Full Width"}
                  style={{ 
                    background: 'rgba(255, 255, 255, 0.12)', 
                    border: '1px solid rgba(255, 255, 255, 0.25)', 
                    color: '#ffffff', 
                    cursor: 'pointer',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    transition: 'all 0.15s ease'
                  }}
                >
                  {isFullWidth ? (
                    <>
                      <Minimize2 size={14} />
                      <span>40% Drawer</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 size={14} />
                      <span>Full Width</span>
                    </>
                  )}
                </button>
                <button 
                  onClick={() => setViewingLeadModal(null)} 
                  title="Close"
                  style={{ 
                    background: 'rgba(255, 255, 255, 0.12)', 
                    border: 'none', 
                    color: '#e2e8f0', 
                    cursor: 'pointer',
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Sub-header Navigation Tabs - Persistent & Wrap-enabled */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              padding: '12px 24px',
              backgroundColor: '#f8fafc',
              borderBottom: '1.5px solid #e2e8f0',
              flexShrink: 0
            }}>
              <button
                onClick={() => setModalTab('files')}
                style={{
                  padding: '9px 16px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  border: modalTab === 'files' ? '1.5px solid #fca412' : '1px solid #cbd5e1',
                  backgroundColor: modalTab === 'files' ? '#fff7ed' : '#ffffff',
                  color: modalTab === 'files' ? '#d97706' : '#475569',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: modalTab === 'files' ? '0 2px 4px rgba(245, 158, 11, 0.15)' : 'none'
                }}
              >
                <Folder size={15} color={modalTab === 'files' ? '#d97706' : '#64748b'} /> D1 &amp; Documents ({filesData.files.length + filesData.folders.length})
              </button>

              <button
                onClick={() => setModalTab('notes')}
                style={{
                  padding: '9px 16px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  border: modalTab === 'notes' ? '1.5px solid #fca412' : '1px solid #cbd5e1',
                  backgroundColor: modalTab === 'notes' ? '#fff7ed' : '#ffffff',
                  color: modalTab === 'notes' ? '#d97706' : '#475569',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: modalTab === 'notes' ? '0 2px 4px rgba(245, 158, 11, 0.15)' : 'none'
                }}
              >
                <MessageSquare size={15} color={modalTab === 'notes' ? '#d97706' : '#64748b'} /> Sales &amp; Team Notes ({notes.length})
              </button>

              {/* MMTS TAB: Strictly disabled until Stage 1 is fully paid */}
              {(() => {
                const isStage1Paid = viewingLeadModal ? isStage1FullyPaid(viewingLeadModal) : false;

                return (
                  <button
                    type="button"
                    disabled={!isStage1Paid}
                    onClick={() => {
                      if (!isStage1Paid) return;
                      setModalTab('mmts');
                      setSiteModalRoleTab('mmt');
                    }}
                    title={!isStage1Paid ? '🔒 Disabled: Requires Stage 1 Advance (10%) payment to enable' : '📦 MMTS Team & PM (Enabled)'}
                    style={{
                      padding: '9px 16px',
                      borderRadius: '8px',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      border: !isStage1Paid 
                        ? '1px dashed #cbd5e1' 
                        : (modalTab === 'mmts' ? '1.5px solid #ea580c' : '1px solid #cbd5e1'),
                      backgroundColor: !isStage1Paid 
                        ? '#f1f5f9' 
                        : (modalTab === 'mmts' ? '#fff7ed' : '#ffffff'),
                      color: !isStage1Paid 
                        ? '#94a3b8' 
                        : (modalTab === 'mmts' ? '#ea580c' : '#475569'),
                      cursor: !isStage1Paid ? 'not-allowed' : 'pointer',
                      opacity: !isStage1Paid ? 0.6 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: (isStage1Paid && modalTab === 'mmts') ? '0 2px 4px rgba(234, 88, 12, 0.15)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {!isStage1Paid ? (
                      <Lock size={14} color="#94a3b8" />
                    ) : (
                      <Calendar size={15} color={modalTab === 'mmts' ? '#ea580c' : '#64748b'} />
                    )}
                    <span>📦 MMTS Team &amp; PM</span>
                    {!isStage1Paid ? (
                      <span style={{
                        fontSize: '0.66rem',
                        backgroundColor: '#fee2e2',
                        color: '#dc2626',
                        padding: '1px 6px',
                        borderRadius: '10px',
                        fontWeight: 800,
                        letterSpacing: '0.3px'
                      }}>
                        🔒 10% Req.
                      </span>
                    ) : (
                      <span style={{
                        fontSize: '0.66rem',
                        backgroundColor: '#dcfce7',
                        color: '#15803d',
                        padding: '1px 6px',
                        borderRadius: '10px',
                        fontWeight: 800
                      }}>
                        ✓ Active
                      </span>
                    )}
                  </button>
                );
              })()}

              {/* QC TAB: Strictly disabled until Stage 2 is fully paid */}
              {(() => {
                const isStage2Paid = viewingLeadModal ? isTwentyPercentPaidForLead(viewingLeadModal) : false;
                const hasQcBooking = Boolean(
                  (viewingLeadModal?.qc_booking_time && String(viewingLeadModal.qc_booking_time).trim() !== '' && viewingLeadModal.qc_booking_time !== '0000-00-00 00:00:00') ||
                  (viewingLeadModal?.site_manager_booking_time && String(viewingLeadModal.site_manager_booking_time).trim() !== '' && viewingLeadModal.site_manager_booking_time !== '0000-00-00 00:00:00') ||
                  (viewingLeadModal as any)?.qc_status === 'booked'
                );

                return (
                  <button
                    type="button"
                    disabled={!isStage2Paid}
                    onClick={() => {
                      if (!isStage2Paid) return;
                      setModalTab('qc');
                      setSiteModalRoleTab('site_inspector');
                    }}
                    title={!isStage2Paid ? '🔒 Disabled: Requires Stage 2 (20% Cumulative) payment to enable' : (hasQcBooking ? '✅ QC Slot Booked' : '🔍 QC Inspector & PM (Enabled)')}
                    style={{
                      padding: '9px 16px',
                      borderRadius: '8px',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      border: !isStage2Paid 
                        ? '1px dashed #cbd5e1' 
                        : (hasQcBooking
                            ? (modalTab === 'qc' ? '2px solid #16a34a' : '1.5px solid #86efac')
                            : (modalTab === 'qc' ? '1.5px solid #2563eb' : '1px solid #cbd5e1')),
                      backgroundColor: !isStage2Paid 
                        ? '#f1f5f9' 
                        : (hasQcBooking
                            ? (modalTab === 'qc' ? '#dcfce7' : '#f0fdf4')
                            : (modalTab === 'qc' ? '#eff6ff' : '#ffffff')),
                      color: !isStage2Paid 
                        ? '#94a3b8' 
                        : (hasQcBooking
                            ? '#15803d'
                            : (modalTab === 'qc' ? '#2563eb' : '#475569')),
                      cursor: !isStage2Paid ? 'not-allowed' : 'pointer',
                      opacity: !isStage2Paid ? 0.6 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: (isStage2Paid && modalTab === 'qc') 
                        ? (hasQcBooking ? '0 2px 6px rgba(22, 163, 74, 0.25)' : '0 2px 4px rgba(37, 99, 235, 0.15)') 
                        : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {!isStage2Paid ? (
                      <Lock size={14} color="#94a3b8" />
                    ) : (
                      <CheckCircle size={15} color={hasQcBooking ? '#16a34a' : (modalTab === 'qc' ? '#2563eb' : '#64748b')} />
                    )}
                    <span>🔍 QC Inspector &amp; PM</span>
                    {!isStage2Paid ? (
                      <span style={{
                        fontSize: '0.66rem',
                        backgroundColor: '#fee2e2',
                        color: '#dc2626',
                        padding: '1px 6px',
                        borderRadius: '10px',
                        fontWeight: 800,
                        letterSpacing: '0.3px'
                      }}>
                        🔒 20% Req.
                      </span>
                    ) : hasQcBooking ? (
                      <span style={{
                        fontSize: '0.66rem',
                        backgroundColor: '#16a34a',
                        color: '#ffffff',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        fontWeight: 800,
                        letterSpacing: '0.3px'
                      }}>
                        ✅ Slot Booked
                      </span>
                    ) : (
                      <span style={{
                        fontSize: '0.66rem',
                        backgroundColor: '#dcfce7',
                        color: '#15803d',
                        padding: '1px 6px',
                        borderRadius: '10px',
                        fontWeight: 800
                      }}>
                        ✓ Active
                      </span>
                    )}
                  </button>
                );
              })()}
            </div>

            {/* Modal Body */}
            <div style={{
              padding: '20px',
              overflowY: 'auto',
              overflowX: 'hidden',
              flex: 1,
              minHeight: 0,
              minWidth: 0,
              maxWidth: '100%',
              boxSizing: 'border-box'
            }}>

              {/* TAB 1: FILES & DOCUMENTS (Always accessible) */}
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
                    <div style={{ textAlign: 'center', padding: '32px 20px', color: '#64748b', border: '1.5px dashed #cbd5e1', borderRadius: '12px', backgroundColor: '#f8fafc' }}>
                      <Folder size={32} color="#94a3b8" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                      <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', color: '#475569' }}>No site photos or D1 documents uploaded yet.</p>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>Create a folder or upload documents above</p>
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

              {/* TAB 2: NOTES & SALES REQUIREMENTS (Always Accessible) */}
              {modalTab === 'notes' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Sales Information Card */}
                  <div style={{ backgroundColor: '#fff9f0', padding: '16px', borderRadius: '12px', border: '1.5px solid #ffe8c2', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <h4 style={{ margin: 0, color: '#fca412', fontSize: '0.98rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Info size={16} /> Sales Representative Requirements &amp; Scope
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.85rem' }}>
                      <div>
                        <strong style={{ color: '#0c1527' }}>Lead Source:</strong> {viewingLeadModal.lead_source || 'Walk-in'}
                      </div>
                      <div>
                        <strong style={{ color: '#0c1527' }}>Project ID:</strong> {viewingLeadModal.manual_client_id || viewingLeadModal.lead_id}
                      </div>
                    </div>
                    {viewingLeadModal.project_scope && (
                      <div style={{ fontSize: '0.85rem', color: '#0c1527', paddingTop: '6px', borderTop: '1px solid #ffe8c2' }}>
                        <strong>Project Scope &amp; Details:</strong> {viewingLeadModal.project_scope}
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
                          style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1.5px solid #ffe8c2', outline: 'none', fontSize: '0.9rem', resize: 'vertical' }}
                        />
                        <button
                          onClick={handleAddNote}
                          disabled={!newNote.trim()}
                          style={{
                            backgroundColor: '#fca412', color: 'white', padding: '0 20px', borderRadius: '8px', border: 'none',
                            fontWeight: 800, cursor: newNote.trim() ? 'pointer' : 'not-allowed', opacity: newNote.trim() ? 1 : 0.6,
                            display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 6px rgba(252, 164, 18, 0.3)'
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

              {/* TAB 3: MMTS & PROJECT MANAGER MEETING TAB */}
              {modalTab === 'mmts' && (() => {
                const isStage1Paid = viewingLeadModal ? isStage1FullyPaid(viewingLeadModal) : false;

                // 🔒 UI/UX GATE: If 10% Stage 1 advance is NOT paid, display ONLY "Record Payment" and hide all below details!
                if (!isStage1Paid) {
                  const totalB = Math.max(
                    parseFloat(String(viewingLeadModal?.initial_quote_amount || 0)) || 0,
                    parseFloat(String(viewingLeadModal?.total_budget || 0)) || 0,
                    parseFloat(String(viewingLeadModal?.estimated_budget || 0)) || 0
                  );
                  const target10 = Math.round(totalB * 0.10);
                  const paidAdvance = Math.max(
                    parseFloat(String(viewingLeadModal?.advance_received || 0)) || 0,
                    parseFloat(String(viewingLeadModal?.advance_paid || 0)) || 0,
                    parseFloat(String(viewingLeadModal?.total_paid || 0)) || 0
                  );
                  let fPaid = 0;
                  if (financeTransactions && Array.isArray(financeTransactions) && viewingLeadModal) {
                    const lId = String(viewingLeadModal.lead_id || viewingLeadModal.id || '').toLowerCase();
                    const mcId = String(viewingLeadModal.manual_client_id || '').toLowerCase();
                    const pCode = String(viewingLeadModal.project_code || '').toLowerCase();
                    const cName = String(viewingLeadModal.client_name || '').toLowerCase();

                    fPaid = financeTransactions
                      .filter((t: any) => {
                        if (String(t.type || '').toLowerCase() !== 'credit') return false;
                        const tPid = String(t.project_id || '').toLowerCase();
                        const tPCode = String(t.project_code || '').toLowerCase();
                        const tDesc = String(t.description || '').toLowerCase();
                        return (lId && (tPid === lId || tPCode === lId || tDesc.includes(lId))) || 
                               (mcId && (tPid === mcId || tPCode === mcId || (mcId.length > 1 && tDesc.includes(mcId)))) || 
                               (pCode && (tPid === pCode || tPCode === pCode || (pCode.length > 1 && tDesc.includes(pCode)))) ||
                               (cName && cName.length > 2 && tDesc.includes(cName));
                      })
                      .reduce((sum: number, t: any) => sum + parseFloat(t.amount || 0), 0);
                  }
                  const totalPaidSoFar = Math.max(paidAdvance, fPaid);
                  const paidP = totalB > 0 ? (totalPaidSoFar / totalB) * 100 : 0;
                  const dueAmount = totalB > 0 ? Math.max(0, target10 - totalPaidSoFar) : 0;
                  const isLeadConverted = Boolean(
                    viewingLeadModal?.is_converted === 1 || 
                    viewingLeadModal?.is_converted === true || 
                    viewingLeadModal?.status === 'won' || 
                    viewingLeadModal?.status === 'converted' || 
                    (viewingLeadModal?.project_id && Number(viewingLeadModal.project_id) > 0)
                  );

                  return (
                    <div style={{
                      backgroundColor: '#ffffff',
                      borderRadius: '16px',
                      border: '1.5px solid #fed7aa',
                      padding: '40px 24px',
                      boxShadow: '0 10px 30px rgba(234, 88, 12, 0.08)',
                      textAlign: 'center',
                      maxWidth: '620px',
                      margin: '16px auto',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '22px'
                    }}>
                      {/* Icon */}
                      <div style={{
                        width: '74px',
                        height: '74px',
                        borderRadius: '50%',
                        backgroundColor: '#fff7ed',
                        border: '2px solid #fed7aa',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ea580c',
                        boxShadow: '0 8px 20px rgba(234, 88, 12, 0.15)'
                      }}>
                        <Lock size={36} color="#ea580c" />
                      </div>

                      {/* Title & Description */}
                      <div>
                        <div style={{
                          display: 'inline-block',
                          backgroundColor: '#fee2e2',
                          color: '#dc2626',
                          fontSize: '0.74rem',
                          fontWeight: 800,
                          padding: '4px 14px',
                          borderRadius: '20px',
                          letterSpacing: '0.5px',
                          textTransform: 'uppercase',
                          marginBottom: '10px'
                        }}>
                          🔒 Stage 1 Payment Pending
                        </div>
                        <h3 style={{ margin: '0 0 8px 0', color: '#1e293b', fontSize: '1.3rem', fontWeight: 800 }}>
                          Record Payment to Unlock MMTS Slots
                        </h3>
                        <p style={{ margin: 0, color: '#64748b', fontSize: '0.88rem', lineHeight: 1.5, maxWidth: '480px' }}>
                          To schedule and book slots for the <strong>MMTS Team &amp; Project Manager (PM)</strong>, the 10% Stage 1 Advance payment must be recorded first.
                        </p>
                      </div>

                      {/* Financial Summary Card */}
                      {totalB > 0 && (
                        <div style={{
                          width: '100%',
                          backgroundColor: '#fff7ed',
                          borderRadius: '12px',
                          border: '1px solid #fed7aa',
                          padding: '16px 20px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                          textAlign: 'left'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569', fontSize: '0.85rem', fontWeight: 600 }}>
                            <span>Total Budget:</span>
                            <span style={{ fontWeight: 700, color: '#1e293b' }}>₹{Math.round(totalB).toLocaleString('en-IN')}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ea580c', fontSize: '0.88rem', fontWeight: 700 }}>
                            <span>Stage 1 (10% Target):</span>
                            <span>₹{Math.round(target10).toLocaleString('en-IN')}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#15803d', fontSize: '0.85rem', fontWeight: 600 }}>
                            <span>Paid So Far:</span>
                            <span style={{ fontWeight: 700 }}>₹{Math.round(totalPaidSoFar).toLocaleString('en-IN')} ({paidP.toFixed(1)}%)</span>
                          </div>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            color: '#c2410c',
                            fontSize: '0.95rem',
                            fontWeight: 800,
                            borderTop: '1px dashed #fdba74',
                            paddingTop: '8px'
                          }}>
                            <span>Remaining Advance Due:</span>
                            <span>₹{Math.round(dueAmount).toLocaleString('en-IN')}</span>
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      {/* Action Buttons */}
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', width: '100%' }}>
                        {isAdminOrPM ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                if (!viewingLeadModal) return;
                                setCollectLead(viewingLeadModal);
                                const reqDue = dueAmount > 0 ? dueAmount : (target10 > 0 ? target10 : 5000);
                                setCollectAmount(String(reqDue));
                                setShowCollectModal(true);
                              }}
                              style={{
                                padding: '12px 26px',
                                borderRadius: '10px',
                                backgroundColor: '#ea580c',
                                color: '#ffffff',
                                fontWeight: 800,
                                fontSize: '0.92rem',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                boxShadow: '0 4px 14px rgba(234, 88, 12, 0.35)',
                                transition: 'all 0.2s'
                              }}
                            >
                              <CreditCard size={18} /> Record Payment
                            </button>

                            {!isLeadConverted && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (!viewingLeadModal) return;
                                  handleCreateProjectFromLead(viewingLeadModal);
                                }}
                                style={{
                                  padding: '12px 20px',
                                  borderRadius: '10px',
                                  backgroundColor: '#ffffff',
                                  color: '#16a34a',
                                  fontWeight: 800,
                                  fontSize: '0.90rem',
                                  border: '1.5px solid #86efac',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  boxShadow: '0 2px 8px rgba(22, 163, 74, 0.1)'
                                }}
                              >
                                <DollarSign size={16} /> Start Project &amp; Record Advance
                              </button>
                            )}
                          </>
                        ) : (
                          <div style={{
                            backgroundColor: '#f8fafc',
                            border: '1.5px solid #e2e8f0',
                            borderRadius: '10px',
                            padding: '12px 18px',
                            color: '#475569',
                            fontSize: '0.84rem',
                            fontWeight: 700,
                            textAlign: 'center',
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                          }}>
                            <Eye size={16} color="#0284c7" />
                            <span>Client needs to pay <strong>₹{Math.round(dueAmount).toLocaleString('en-IN')}</strong> to unlock MMTS. Payment recording &amp; project start is restricted to Admin &amp; PM.</span>
                          </div>
                        )}
                      </div>

                      {/* Sub-note */}
                      <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>💡</span>
                        <span>Once payment is done, MMTS slots, personnel selection, and all details will automatically appear here.</span>
                      </div>
                    </div>
                  );
                }

                // 🔓 ONCE PAYMENT DONE: All booking controls, slot selector, personnel, and consultation history appear normally
                return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                  {/* Stage 1 Paid Success Banner */}
                  <div style={{
                    backgroundColor: '#ecfdf5',
                    border: '1px solid #a7f3d0',
                    borderRadius: '10px',
                    padding: '10px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    color: '#065f46',
                    fontSize: '0.84rem',
                    fontWeight: 700
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle size={18} color="#059669" />
                      <span>Stage 1 Advance (10%) Completed — MMTS &amp; PM Slot Booking is Active</span>
                    </div>
                    <span style={{ fontSize: '0.75rem', backgroundColor: '#d1fae5', color: '#047857', padding: '3px 8px', borderRadius: '6px', fontWeight: 800 }}>
                      UNLOCKED ✓
                    </span>
                  </div>

                  {/* Booking Form Section for MMTS */}
                  <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
                        <div style={{ backgroundColor: '#fff7ed', padding: '20px', borderRadius: '14px', border: '1.5px solid #ffedd5' }}>
                          <h4 style={{ margin: '0 0 16px 0', color: '#ea580c', fontSize: '1.05rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Calendar size={20} color="#ea580c" /> 📦 Book Slot for MMTS Team &amp; Project Manager (PM)
                          </h4>

                          {/* Choose Role Tabs & Selector - Eliminates site_inspector mismatch and enables multi-personnel */}
                          {(() => {
                            const currentMmtsRole = (siteModalRoleTab === 'site_inspector' ? 'mmt' : siteModalRoleTab) as 'mmt' | 'pm' | 'designer';
                            const mmtCount = mmtUserId ? mmtUserId.split(',').filter(Boolean).length : 0;

                            return (
                              <>
                                {/* Personnel Selection Component */}
                                <div style={{ marginBottom: '16px' }}>
                                  <DepartmentPersonnelSelector
                                    team={team}
                                    roleContext="mmt"
                                    multiSelect={true}
                                    allowedDepartments={MMTS_ALLOWED_DEPTS}
                                    hideAllTab={true}
                                    defaultDepartment="MMT & Masking"
                                    label="Select Team Member(s) (Multi-Select Supported):"
                                    selectedUserId={mmtUserId}
                                    onSelectUserId={(uid) => {
                                      setMmtUserId(uid);
                                    }}
                                  />
                                </div>

                                {/* Cute Selected Personnel Summary Box */}
                                {renderCutePersonnelSummary('mmts')}
                              </>
                            );
                          })()}

                          {/* Booking Date */}
                          <div style={{ marginBottom: '16px', maxWidth: '280px' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', color: '#374151', marginBottom: '6px', fontWeight: 700 }}>Booking Date <span style={{ color: '#ef4444' }}>*</span></label>
                            <div style={{ position: 'relative' }}>
                              <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }}>
                                <Calendar size={16} />
                              </div>
                              <input
                                type="date"
                                value={bookDate || getTodayDateString()}
                                min={getTodayDateString()}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const todayStr = getTodayDateString();
                                  const validDate = (val && val >= todayStr) ? val : todayStr;
                                  setBookDate(validDate);
                                  const nextValid = getFirstAvailableSlot(validDate);
                                  setBookTime(nextValid || (validDate > todayStr ? '10:00' : ''));
                                  try { (e.target as HTMLElement).blur(); } catch (_) {}
                                }}
                                style={{ width: '100%', maxWidth: '100%', padding: '9px 10px 9px 36px', borderRadius: '8px', border: '1px solid #d1d5db', outline: 'none', color: '#374151', fontSize: '0.88rem', backgroundColor: '#ffffff', boxSizing: 'border-box' }}
                                required
                              />
                            </div>
                          </div>

                          {/* Select Time Slot Grid — Exactly 2 in one row */}
                          <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', color: '#374151', marginBottom: '8px', fontWeight: 700 }}>Select Time Slot <span style={{ color: '#ef4444' }}>*</span></label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', maxWidth: '100%' }}>
                              {FIXED_SLOTS.map((slot) => {
                                const booked = isSlotBooked(slot.value);
                                const isPast = isSlotPastTime(slot.value, bookDate);
                                const disabled = booked || isPast;
                                const selected = bookTime === slot.value && !disabled;
                                return (
                                  <button
                                    key={slot.id}
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => { if (!disabled) setBookTime(slot.value); }}
                                    style={{
                                      padding: '10px',
                                      borderRadius: '8px',
                                      border: selected ? '2px solid #ea580c' : disabled ? '1px solid #e2e8f0' : '1px solid #cbd5e1',
                                      backgroundColor: selected ? '#fff7ed' : disabled ? '#f8fafc' : '#ffffff',
                                      color: selected ? '#ea580c' : disabled ? '#94a3b8' : '#334155',
                                      fontWeight: selected ? 800 : 600,
                                      cursor: disabled ? 'not-allowed' : 'pointer',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      alignItems: 'center',
                                      gap: '2px',
                                      fontSize: '0.82rem',
                                      boxSizing: 'border-box'
                                    }}
                                  >
                                    <span>{slot.label}</span>
                                    {isPast && <span style={{ fontSize: '0.68rem', color: '#ef4444', fontWeight: 700 }}>⛔ Time Passed</span>}
                                    {booked && !isPast && <span style={{ fontSize: '0.68rem', color: '#dc2626', fontWeight: 700 }}>Already Booked</span>}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Note / Instructions Textarea */}
                          <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', color: '#374151', marginBottom: '6px', fontWeight: 600 }}>Note / Instructions</label>
                            <textarea
                              rows={3}
                              value={siteNotes}
                              onChange={(e) => setSiteNotes(e.target.value)}
                              placeholder="Add any specific instructions for MMTS team..."
                              style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', outline: 'none', fontSize: '0.85rem', backgroundColor: '#ffffff', resize: 'vertical' }}
                            ></textarea>
                          </div>

                          {/* Action Buttons */}
                          <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedBookLead(viewingLeadModal);
                                handleBookMMTSSubmit();
                              }}
                              disabled={submitting}
                              style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: '#ea580c', color: 'white', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 2px 8px rgba(234, 88, 12, 0.3)' }}
                            >
                              {submitting ? <Loader2 className="animate-spin" size={18} /> : <><CheckSquare size={18} /> Confirm Booking for MMTS Team &amp; PM</>}
                            </button>
                          </div>
                        </div>
                  </fieldset>

                        {/* MMTS & PM Meeting History Table Section */}
                        <div style={{ marginTop: '16px', backgroundColor: '#ffffff', borderRadius: '14px', border: '1.5px solid #fed7aa', padding: '16px', boxShadow: '0 2px 8px rgba(234,88,12,0.04)', maxWidth: '100%', boxSizing: 'border-box' }}>
                          <h4 style={{ margin: '0 0 16px 0', color: '#ea580c', fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Clock size={18} color="#ea580c" /> 📦 MMTS Team &amp; PM Meeting History
                          </h4>
                          <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                              <thead>
                                <tr style={{ backgroundColor: '#fff7ed', borderBottom: '1.5px solid #fed7aa', textAlign: 'left', color: '#9a3412' }}>
                                  <th style={{ padding: '12px', fontWeight: 700 }}>Meeting Type</th>
                                  <th style={{ padding: '12px', fontWeight: 700 }}>Assigned Personnel</th>
                                  <th style={{ padding: '12px', fontWeight: 700 }}>Scheduled Slot / Date</th>
                                  <th style={{ padding: '12px', fontWeight: 700 }}>Meeting Notes</th>
                                  <th style={{ padding: '12px', fontWeight: 700 }}>Status</th>
                                  <th style={{ padding: '12px', fontWeight: 700 }}>Action</th>
                                </tr>
                              </thead>
                                <tbody>
                                  {/* MMTS & PM Site Measurement Slot Row Only */}
                                  {(() => {
                                    const hasMmtsBooked = Boolean(
                                      (viewingLeadModal.mmts_booking_time && String(viewingLeadModal.mmts_booking_time).trim() !== '') ||
                                      (viewingLeadModal.mmts_status && !['unassigned', 'pending', ''].includes(String(viewingLeadModal.mmts_status).toLowerCase())) ||
                                      (viewingLeadModal.mmt_assigned_name && viewingLeadModal.mmt_assigned_name.trim() !== '' && viewingLeadModal.mmt_assigned_name !== 'MMTS Member') || 
                                      (viewingLeadModal.mmt_assigned_id && String(viewingLeadModal.mmt_assigned_id) !== '0' && String(viewingLeadModal.mmt_assigned_id) !== 'null' && String(viewingLeadModal.mmt_assigned_id) !== 'undefined')
                                    );

                                    if (!hasMmtsBooked) {
                                      return (
                                        <tr>
                                          <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem', fontStyle: 'italic' }}>
                                            No MMTS &amp; PM meeting booked yet. Use the booking form above to schedule.
                                          </td>
                                        </tr>
                                      );
                                    }

                                    return (
                                      <tr style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: '#fffcf5' }}>
                                        <td style={{ padding: '12px', fontWeight: 800, color: '#9a3412' }}>
                                          📦 MMTS &amp; PM Slot
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{viewingLeadModal.mmt_assigned_name || team.find(t => String(t.user_id) === String(viewingLeadModal.mmt_assigned_id))?.name || 'MMTS Member'}</div>
                                          {viewingLeadModal.pm_assigned_name && <div style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 600 }}>PM: {viewingLeadModal.pm_assigned_name}</div>}
                                          {viewingLeadModal.associate_designer_assigned_name && <div style={{ fontSize: '0.76rem', color: '#7c3aed', fontWeight: 600 }}>Designer: {viewingLeadModal.associate_designer_assigned_name}</div>}
                                        </td>
                                        <td style={{ padding: '12px', color: '#334155', fontWeight: 600 }}>
                                          {viewingLeadModal.mmts_booking_time ? new Date(viewingLeadModal.mmts_booking_time).toLocaleString('en-IN') : 'Scheduled'}
                                        </td>
                                        <td style={{ padding: '12px', color: '#64748b', fontSize: '0.80rem' }}>
                                          {viewingLeadModal.mmts_notes || viewingLeadModal.notes || '-'}
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                          <span style={{ fontSize: '0.78rem', padding: '4px 10px', borderRadius: '12px', fontWeight: 800, backgroundColor: ['meeting_completed', 'completed'].includes(viewingLeadModal.mmts_status) ? '#dcfce7' : (viewingLeadModal.mmts_status === 'in_meeting' ? '#ffedd5' : '#fff7ed'), color: ['meeting_completed', 'completed'].includes(viewingLeadModal.mmts_status) ? '#15803d' : (viewingLeadModal.mmts_status === 'in_meeting' ? '#c2410c' : '#ea580c'), border: `1px solid ${['meeting_completed', 'completed'].includes(viewingLeadModal.mmts_status) ? '#bbf7d0' : '#ffedd5'}` }}>
                                            {['meeting_completed', 'completed'].includes(viewingLeadModal.mmts_status) ? '✅ Completed' : (viewingLeadModal.mmts_status === 'in_meeting' ? '⏳ In Meeting' : '📅 Slot Booked')}
                                          </span>
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                          {(() => {
                                            const ms = (viewingLeadModal.mmts_status || '').toLowerCase();
                                            if (ms === 'meeting_completed' || ms === 'completed') {
                                              return (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                  <span style={{ fontSize: '0.78rem', color: '#15803d', fontWeight: 800, backgroundColor: '#dcfce7', padding: '4px 10px', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                                                    ✅ Meeting Done
                                                  </span>
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      setViewingLeadModal(prev => prev ? { ...prev, mmts_status: 'in_meeting' } : prev);
                                                      setLeads(prevLeads => prevLeads.map(l => String(l.lead_id) === String(viewingLeadModal.lead_id) ? { ...l, mmts_status: 'in_meeting' } : l));
                                                      axios.post(`${API_BASE_URL}/leads/update-mmts-status`, { lead_id: viewingLeadModal.lead_id, status: 'in_meeting', assigned_by_name: user?.name || 'User' }).then(() => fetchAssignedLeads());
                                                    }}
                                                    title="Restart meeting manually"
                                                    style={{ backgroundColor: '#f8fafc', color: '#64748b', border: '1px solid #cbd5e1', padding: '4px 8px', borderRadius: '6px', fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer' }}
                                                  >
                                                    Restart
                                                  </button>
                                                </div>
                                              );
                                            } else if (ms === 'in_meeting') {
                                              return (
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setViewingLeadModal(prev => prev ? { ...prev, mmts_status: 'meeting_completed' } : prev);
                                                    setLeads(prevLeads => prevLeads.map(l => String(l.lead_id) === String(viewingLeadModal.lead_id) ? { ...l, mmts_status: 'meeting_completed' } : l));
                                                    axios.post(`${API_BASE_URL}/leads/update-mmts-status`, { lead_id: viewingLeadModal.lead_id, status: 'meeting_completed', assigned_by_name: user?.name || 'User' }).then(() => fetchAssignedLeads());
                                                  }}
                                                  style={{ backgroundColor: '#16a34a', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '6px', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 6px rgba(22, 163, 74, 0.3)' }}
                                                >
                                                  <CheckCircle size={14} color="white" /> End Meeting
                                                </button>
                                              );
                                            } else {
                                              return (
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setViewingLeadModal(prev => prev ? { ...prev, mmts_status: 'in_meeting' } : prev);
                                                    setLeads(prevLeads => prevLeads.map(l => String(l.lead_id) === String(viewingLeadModal.lead_id) ? { ...l, mmts_status: 'in_meeting' } : l));
                                                    axios.post(`${API_BASE_URL}/leads/update-mmts-status`, { lead_id: viewingLeadModal.lead_id, status: 'in_meeting', assigned_by_name: user?.name || 'User' }).then(() => fetchAssignedLeads());
                                                  }}
                                                  style={{ backgroundColor: '#ea580c', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '6px', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 6px rgba(234, 88, 12, 0.3)' }}
                                                >
                                                  <Play size={14} fill="white" /> Start Meeting
                                                </button>
                                              );
                                            }
                                          })()}
                                        </td>
                                      </tr>
                                    );
                                  })()}
                                </tbody>
                            </table>
                          </div>
                        </div>


                </div>
              ); })()}

              {/* TAB 4: QC & PROJECT MANAGER MEETING TAB */}
              {modalTab === 'qc' && (() => {
                const isStage2Paid = viewingLeadModal ? isTwentyPercentPaidForLead(viewingLeadModal) : false;

                // 🔒 UI/UX GATE: If Stage 2 (20% cumulative advance) is NOT paid, display ONLY "Record Payment" and hide all below details!
                if (!isStage2Paid) {
                  const totalB = Math.max(
                    parseFloat(String(viewingLeadModal?.initial_quote_amount || 0)) || 0,
                    parseFloat(String(viewingLeadModal?.total_budget || 0)) || 0,
                    parseFloat(String(viewingLeadModal?.estimated_budget || 0)) || 0
                  );
                  const target20 = Math.round(totalB * 0.20);
                  const paidAdvance = Math.max(
                    parseFloat(String(viewingLeadModal?.advance_received || 0)) || 0,
                    parseFloat(String(viewingLeadModal?.advance_paid || 0)) || 0,
                    parseFloat(String(viewingLeadModal?.total_paid || 0)) || 0
                  );
                  let fPaid = 0;
                  if (financeTransactions && Array.isArray(financeTransactions) && viewingLeadModal) {
                    const lId = String(viewingLeadModal.lead_id || viewingLeadModal.id || '').toLowerCase();
                    const mcId = String(viewingLeadModal.manual_client_id || '').toLowerCase();
                    const pCode = String(viewingLeadModal.project_code || '').toLowerCase();
                    const cName = String(viewingLeadModal.client_name || '').toLowerCase();

                    fPaid = financeTransactions
                      .filter((t: any) => {
                        if (String(t.type || '').toLowerCase() !== 'credit') return false;
                        const tPid = String(t.project_id || '').toLowerCase();
                        const tPCode = String(t.project_code || '').toLowerCase();
                        const tDesc = String(t.description || '').toLowerCase();
                        return (lId && (tPid === lId || tPCode === lId || tDesc.includes(lId))) || 
                               (mcId && (tPid === mcId || tPCode === mcId || (mcId.length > 1 && tDesc.includes(mcId)))) || 
                               (pCode && (tPid === pCode || tPCode === pCode || (pCode.length > 1 && tDesc.includes(pCode)))) ||
                               (cName && cName.length > 2 && tDesc.includes(cName));
                      })
                      .reduce((sum: number, t: any) => sum + parseFloat(t.amount || 0), 0);
                  }
                  const totalPaidSoFar = Math.max(paidAdvance, fPaid);
                  const paidP = totalB > 0 ? (totalPaidSoFar / totalB) * 100 : 0;
                  const dueAmount = totalB > 0 ? Math.max(0, target20 - totalPaidSoFar) : 0;

                  return (
                    <div style={{
                      backgroundColor: '#ffffff',
                      borderRadius: '16px',
                      border: '1.5px solid #bfdbfe',
                      padding: '40px 24px',
                      boxShadow: '0 10px 30px rgba(37, 99, 235, 0.08)',
                      textAlign: 'center',
                      maxWidth: '620px',
                      margin: '16px auto',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '22px'
                    }}>
                      <div style={{
                        width: '74px',
                        height: '74px',
                        borderRadius: '50%',
                        backgroundColor: '#eff6ff',
                        border: '2px solid #bfdbfe',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#2563eb',
                        boxShadow: '0 8px 20px rgba(37, 99, 235, 0.15)'
                      }}>
                        <Lock size={36} color="#2563eb" />
                      </div>

                      <div>
                        <div style={{
                          display: 'inline-block',
                          backgroundColor: '#fee2e2',
                          color: '#dc2626',
                          fontSize: '0.74rem',
                          fontWeight: 800,
                          padding: '4px 14px',
                          borderRadius: '20px',
                          letterSpacing: '0.5px',
                          textTransform: 'uppercase',
                          marginBottom: '10px'
                        }}>
                          🔒 Stage 2 Payment Pending (20% Target)
                        </div>
                        <h3 style={{ margin: '0 0 8px 0', color: '#1e293b', fontSize: '1.3rem', fontWeight: 800 }}>
                          Record Payment to Unlock QC Inspector Slots
                        </h3>
                        <p style={{ margin: 0, color: '#64748b', fontSize: '0.88rem', lineHeight: 1.5, maxWidth: '480px' }}>
                          To schedule and book slots for the <strong>Quality Check (QC) Inspector &amp; Project Team</strong>, the 20% cumulative Stage 2 payment must be completed first.
                        </p>
                      </div>

                      {totalB > 0 && (
                        <div style={{
                          width: '100%',
                          backgroundColor: '#eff6ff',
                          borderRadius: '12px',
                          border: '1px solid #bfdbfe',
                          padding: '16px 20px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                          textAlign: 'left'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569', fontSize: '0.85rem', fontWeight: 600 }}>
                            <span>Total Project Budget:</span>
                            <span style={{ fontWeight: 700, color: '#1e293b' }}>₹{Math.round(totalB).toLocaleString('en-IN')}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#2563eb', fontSize: '0.88rem', fontWeight: 700 }}>
                            <span>Stage 2 (20% Cumulative Target):</span>
                            <span>₹{Math.round(target20).toLocaleString('en-IN')}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#15803d', fontSize: '0.85rem', fontWeight: 600 }}>
                            <span>Paid So Far:</span>
                            <span style={{ fontWeight: 700 }}>₹{Math.round(totalPaidSoFar).toLocaleString('en-IN')} ({paidP.toFixed(1)}%)</span>
                          </div>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            color: '#1d4ed8',
                            fontSize: '0.95rem',
                            fontWeight: 800,
                            borderTop: '1px dashed #93c5fd',
                            paddingTop: '8px'
                          }}>
                            <span>Remaining Stage 2 Due:</span>
                            <span>₹{Math.round(dueAmount).toLocaleString('en-IN')}</span>
                          </div>
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', width: '100%' }}>
                        {isAdminOrPM ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (!viewingLeadModal) return;
                              setCollectLead(viewingLeadModal);
                              const reqDue = dueAmount > 0 ? dueAmount : (target20 > 0 ? target20 : 10000);
                              setCollectAmount(String(reqDue));
                              setShowCollectModal(true);
                            }}
                            style={{
                              padding: '12px 26px',
                              borderRadius: '10px',
                              backgroundColor: '#2563eb',
                              color: '#ffffff',
                              fontWeight: 800,
                              fontSize: '0.92rem',
                              border: 'none',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '8px',
                              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
                              transition: 'all 0.2s'
                            }}
                          >
                            <CreditCard size={18} /> Record Stage 2 Payment
                          </button>
                        ) : (
                          <div style={{
                            backgroundColor: '#f8fafc',
                            border: '1.5px solid #e2e8f0',
                            borderRadius: '10px',
                            padding: '12px 18px',
                            color: '#475569',
                            fontSize: '0.84rem',
                            fontWeight: 700,
                            textAlign: 'center',
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                          }}>
                            <Eye size={16} color="#2563eb" />
                            <span>Client needs to pay <strong>₹{Math.round(dueAmount).toLocaleString('en-IN')}</strong> to unlock QC. Payment recording is restricted to Admin &amp; PM.</span>
                          </div>
                        )}
                      </div>

                      <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>💡</span>
                        <span>Once Stage 2 payment is recorded, QC slot booking controls and inspection details will automatically appear here.</span>
                      </div>
                    </div>
                  );
                }

                // 🔓 ONCE STAGE 2 PAYMENT DONE: Show Unlocked Banner and full QC booking controls
                const isQcInputUnlocked = true;
                const hasQcBooked = Boolean(
                  (viewingLeadModal.qc_booking_time && String(viewingLeadModal.qc_booking_time).trim() !== '' && viewingLeadModal.qc_booking_time !== '0000-00-00 00:00:00') ||
                  (viewingLeadModal.site_manager_booking_time && String(viewingLeadModal.site_manager_booking_time).trim() !== '' && viewingLeadModal.site_manager_booking_time !== '0000-00-00 00:00:00') ||
                  (viewingLeadModal as any)?.qc_status === 'booked'
                );
                return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                  {/* Stage 2 Paid Success Banner */}
                  <div style={{
                    backgroundColor: '#ecfdf5',
                    border: '1px solid #a7f3d0',
                    borderRadius: '10px',
                    padding: '10px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    color: '#065f46',
                    fontSize: '0.84rem',
                    fontWeight: 700
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle size={18} color="#059669" />
                      <span>Stage 2 Payment (20% Target) Completed — QC Inspector Slot Booking is Active</span>
                    </div>
                    <span style={{ fontSize: '0.75rem', backgroundColor: '#d1fae5', color: '#047857', padding: '3px 8px', borderRadius: '6px', fontWeight: 800 }}>
                      UNLOCKED ✓
                    </span>
                  </div>

                  {/* Booking Form Section for QC */}
                  <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
                        <div style={{ backgroundColor: '#eff6ff', padding: '20px', borderRadius: '14px', border: '1.5px solid #bfdbfe' }}>
                          <h4 style={{ margin: '0 0 16px 0', color: '#2563eb', fontSize: '1.05rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Calendar size={20} color="#2563eb" /> 🔍 Book Slot for QC Inspector &amp; Project Manager (PM)
                          </h4>

                          {/* Personnel Selection Component */}
                          <div style={{ marginBottom: '16px' }}>
                            <DepartmentPersonnelSelector
                              team={team}
                              roleContext="site_inspector"
                              multiSelect={true}
                              allowedDepartments={QC_ALLOWED_DEPTS}
                              hideAllTab={true}
                              defaultDepartment="Site Inspection & QC"
                              disabled={!isQcInputUnlocked}
                              label="Select Team Member(s) (Multi-Select Supported):"
                              selectedUserId={siteInspectorUserId || selectedSiteUser}
                              onSelectUserId={(uid) => {
                                if (!isQcInputUnlocked) return;
                                setSiteInspectorUserId(uid);
                                setSelectedSiteUser(uid);
                              }}
                            />
                          </div>

                          {/* Cute Selected Personnel Summary Box for QC */}
                          {renderCutePersonnelSummary('qc')}

                          {/* Booking Date */}
                          <div style={{ marginBottom: '16px', maxWidth: '280px' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', color: '#374151', marginBottom: '6px', fontWeight: 700 }}>Booking Date <span style={{ color: '#ef4444' }}>*</span></label>
                            <div style={{ position: 'relative' }}>
                              <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }}>
                                <Calendar size={16} />
                              </div>
                              <input
                                type="date"
                                value={bookDate || getTodayDateString()}
                                min={getTodayDateString()}
                                disabled={!isQcInputUnlocked}
                                onChange={(e) => {
                                  if (!isQcInputUnlocked) return;
                                  const val = e.target.value;
                                  const todayStr = getTodayDateString();
                                  const validDate = (val && val >= todayStr) ? val : todayStr;
                                  setBookDate(validDate);
                                  const nextValid = getFirstAvailableSlot(validDate);
                                  setBookTime(nextValid || (validDate > todayStr ? '10:00' : ''));
                                  try { (e.target as HTMLElement).blur(); } catch (_) {}
                                }}
                                style={{ width: '100%', maxWidth: '100%', padding: '9px 10px 9px 36px', borderRadius: '8px', border: '1px solid #d1d5db', outline: 'none', color: '#374151', fontSize: '0.88rem', backgroundColor: isQcInputUnlocked ? '#ffffff' : '#f1f5f9', boxSizing: 'border-box' }}
                                required
                              />
                            </div>
                          </div>

                          {/* Select Time Slot Grid — Exactly 2 in one row */}
                          <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', color: '#374151', marginBottom: '8px', fontWeight: 700 }}>Select Time Slot <span style={{ color: '#ef4444' }}>*</span></label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', maxWidth: '100%' }}>
                              {FIXED_SLOTS.map((slot) => {
                                const booked = isSlotBooked(slot.value);
                                const isPast = isSlotPastTime(slot.value, bookDate);
                                const disabled = !isQcInputUnlocked || booked || isPast;
                                const selected = bookTime === slot.value && !disabled;
                                return (
                                  <button
                                    key={slot.id}
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => { if (!disabled) setBookTime(slot.value); }}
                                    style={{
                                      padding: '10px',
                                      borderRadius: '8px',
                                      border: selected ? '2px solid #2563eb' : disabled ? '1px solid #e2e8f0' : '1px solid #cbd5e1',
                                      backgroundColor: selected ? '#eff6ff' : disabled ? '#f8fafc' : '#ffffff',
                                      color: selected ? '#2563eb' : disabled ? '#94a3b8' : '#334155',
                                      fontWeight: selected ? 800 : 600,
                                      cursor: disabled ? 'not-allowed' : 'pointer',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      alignItems: 'center',
                                      gap: '2px',
                                      fontSize: '0.82rem',
                                      boxSizing: 'border-box'
                                    }}
                                  >
                                    <span>{slot.label}</span>
                                    {isPast && <span style={{ fontSize: '0.68rem', color: '#ef4444', fontWeight: 700 }}>⛔ Time Passed</span>}
                                    {booked && !isPast && <span style={{ fontSize: '0.68rem', color: '#dc2626', fontWeight: 700 }}>Already Booked</span>}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Note / Instructions Textarea */}
                          <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', color: '#374151', marginBottom: '6px', fontWeight: 600 }}>Note / Instructions</label>
                            <textarea
                              rows={3}
                              value={siteNotes}
                              disabled={!isQcInputUnlocked}
                              onChange={(e) => setSiteNotes(e.target.value)}
                              placeholder="Add any specific instructions for QC inspector..."
                              style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', outline: 'none', fontSize: '0.85rem', backgroundColor: isQcInputUnlocked ? '#ffffff' : '#f1f5f9', resize: 'vertical' }}
                            ></textarea>
                          </div>

                          {/* Action Buttons */}
                          <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                              type="button"
                              onClick={() => {
                                if (!isQcInputUnlocked) return;
                                setSelectedBookLead(viewingLeadModal);
                                setModalTab('qc');
                                setSiteModalRoleTab('site_inspector');
                                handleBookQCSubmit();
                              }}
                              disabled={!isQcInputUnlocked || submitting}
                              style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: hasQcBooked ? '#16a34a' : (isQcInputUnlocked ? '#2563eb' : '#94a3b8'), color: 'white', fontWeight: 700, cursor: isQcInputUnlocked ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: hasQcBooked ? '0 2px 8px rgba(22, 163, 74, 0.3)' : (isQcInputUnlocked ? '0 2px 8px rgba(37, 99, 235, 0.3)' : 'none') }}
                            >
                              {submitting ? <Loader2 className="animate-spin" size={18} /> : (
                                hasQcBooked ? (
                                  <><CheckSquare size={18} /> ✅ QC Slot Booked (Click to Update / Reschedule)</>
                                ) : (
                                  <><CheckSquare size={18} /> {isQcInputUnlocked ? 'Confirm Booking for QC Inspector & Project Team' : '🔒 Locked (Stage 2 Payment Required)'}</>
                                )
                              )}
                            </button>
                          </div>
                        </div>
                  </fieldset>

                        {/* Site Inspector & QC Meeting History Table Section */}
                        <div style={{ marginTop: '16px', backgroundColor: '#ffffff', borderRadius: '14px', border: '1.5px solid #bfdbfe', padding: '16px', boxShadow: '0 2px 8px rgba(37,99,235,0.04)', maxWidth: '100%', boxSizing: 'border-box' }}>
                          <h4 style={{ margin: '0 0 16px 0', color: '#1e40af', fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <CheckCircle size={18} color="#2563eb" /> 🔍 Site Inspector &amp; QC Meeting History
                          </h4>
                          <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                              <thead>
                                <tr style={{ backgroundColor: '#eff6ff', borderBottom: '1.5px solid #bfdbfe', textAlign: 'left', color: '#1e3a8a' }}>
                                  <th style={{ padding: '12px', fontWeight: 700 }}>Meeting Type / Stage</th>
                                  <th style={{ padding: '12px', fontWeight: 700 }}>Assigned Team &amp; Personnel</th>
                                  <th style={{ padding: '12px', fontWeight: 700 }}>Slot / Scheduled Time</th>
                                  <th style={{ padding: '12px', fontWeight: 700 }}>Instructions / Notes</th>
                                  <th style={{ padding: '12px', fontWeight: 700 }}>Status</th>
                                  <th style={{ padding: '12px', fontWeight: 700 }}>Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                  {(() => {
                                    const hasQcBookingTime = Boolean(
                                      (viewingLeadModal.qc_booking_time && String(viewingLeadModal.qc_booking_time).trim() !== '' && viewingLeadModal.qc_booking_time !== '0000-00-00 00:00:00') ||
                                      (viewingLeadModal.site_manager_booking_time && String(viewingLeadModal.site_manager_booking_time).trim() !== '' && viewingLeadModal.site_manager_booking_time !== '0000-00-00 00:00:00') ||
                                      (viewingLeadModal as any)?.qc_status === 'booked'
                                    );
                                    const hasQcBooked = hasQcBookingTime;

                                    if (!hasQcBooked) {
                                      return (
                                        <tr>
                                          <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem', fontStyle: 'italic' }}>
                                            No Site Inspector &amp; QC meeting booked yet. Use the booking form above to schedule.
                                          </td>
                                        </tr>
                                      );
                                    }

                                    const inspectorName = viewingLeadModal.site_inspector_assigned_name || 
                                      team.find(t => String(t.user_id) === String(viewingLeadModal.site_inspector_assigned_id))?.name || 
                                      (viewingLeadModal.site_manager_assigned_to ? (team.find(t => String(t.user_id) === String(viewingLeadModal.site_manager_assigned_to))?.name || viewingLeadModal.site_manager_assigned_to) : null) || 
                                      'QC Team / Inspector';

                                    const pmName = viewingLeadModal.pm_assigned_name || 
                                      team.find(t => String(t.user_id) === String(viewingLeadModal.pm_assigned_id))?.name || 
                                      'Unassigned';

                                    const designerName = viewingLeadModal.associate_designer_assigned_name || 
                                      team.find(t => String(t.user_id) === String(viewingLeadModal.associate_designer_assigned_id))?.name || 
                                      (viewingLeadModal.d1_assigned_to ? (team.find(t => String(t.user_id) === String(viewingLeadModal.d1_assigned_to))?.name || 'Designer') : 'Unassigned');

                                    const qcSt = ((viewingLeadModal as any).qc_status || (viewingLeadModal as any).site_inspector_status || (viewingLeadModal as any).site_manager_status || '').toLowerCase();
                                    const isQcCompleted = ['meeting_completed', 'completed', 'done', 'approved'].includes(qcSt) || (viewingLeadModal as any).is_qc_completed === 1 || (viewingLeadModal as any).is_qc_done === 1;
                                    const isQcInMeeting = qcSt === 'in_meeting' || qcSt === 'started';

                                    const qcTimeRaw = viewingLeadModal.qc_booking_time || viewingLeadModal.site_manager_booking_time;

                                    return (
                                      <>
                                        {/* 1. QC Inspector & PM Slot */}
                                        {hasQcBooked && (
                                          <tr style={{ borderBottom: '1.5px solid #bfdbfe', backgroundColor: '#f8fafc' }}>
                                            <td style={{ padding: '12px', fontWeight: 800, color: '#1e40af' }}>
                                              🔍 QC Inspector &amp; PM Slot
                                            </td>
                                            <td style={{ padding: '12px' }}>
                                              <div style={{ fontWeight: 700, color: '#1e40af' }}>
                                                🔍 Inspector: {inspectorName}
                                              </div>
                                              <div style={{ fontSize: '0.78rem', color: '#475569' }}>
                                                🏢 PM: {pmName}
                                              </div>
                                              <div style={{ fontSize: '0.78rem', color: '#475569' }}>
                                                🎨 Designer: {designerName}
                                              </div>
                                            </td>
                                            <td style={{ padding: '12px', color: '#1e293b', fontWeight: 600 }}>
                                              {qcTimeRaw ? (
                                                <span style={{ backgroundColor: '#f0fdf4', padding: '4px 8px', borderRadius: '6px', border: '1px solid #86efac', color: '#15803d', fontWeight: 700 }}>
                                                  📅 {new Date(qcTimeRaw).toLocaleString('en-IN')}
                                                </span>
                                              ) : (
                                                <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Scheduled</span>
                                              )}
                                            </td>
                                            <td style={{ padding: '12px', color: '#475569', fontSize: '0.80rem', maxWidth: '200px' }}>
                                              {viewingLeadModal.qc_notes || viewingLeadModal.site_manager_notes || viewingLeadModal.notes || 'No specific instructions'}
                                            </td>
                                            <td style={{ padding: '12px' }}>
                                              <span style={{ fontSize: '0.78rem', padding: '4px 10px', borderRadius: '12px', fontWeight: 800, backgroundColor: isQcCompleted ? '#dcfce7' : (isQcInMeeting ? '#ffedd5' : '#dcfce7'), color: isQcCompleted ? '#15803d' : (isQcInMeeting ? '#c2410c' : '#15803d'), border: `1px solid ${isQcCompleted ? '#bbf7d0' : (isQcInMeeting ? '#fed7aa' : '#86efac')}` }}>
                                                {isQcCompleted ? (qcSt === 'approved' ? '✅ QC Approved' : '✅ Completed') : (isQcInMeeting ? '⏳ In Meeting' : '✅ QC Slot Booked')}
                                              </span>
                                            </td>
                                            <td style={{ padding: '12px' }}>
                                              {(() => {
                                                const uRole = String(user?.role || '').toLowerCase();
                                                const isSales = ['sales', 'sales_person', 'sales_executive', 'business_associate', 'ba', 'telecaller'].includes(uRole) || (uRole.includes('sales') && !uRole.includes('manager'));
                                                if (isQcInMeeting) {
                                                  return !isSales ? (
                                                    <button
                                                      onClick={() => {
                                                        setViewingLeadModal(prev => prev ? { ...prev, qc_status: 'meeting_completed', site_manager_status: 'meeting_completed', site_inspector_status: 'meeting_completed' } : prev);
                                                        setLeads(prevLeads => prevLeads.map(l => String(l.lead_id) === String(viewingLeadModal.lead_id) ? { ...l, qc_status: 'meeting_completed', site_manager_status: 'meeting_completed', site_inspector_status: 'meeting_completed' } : l));
                                                        handleUpdateQCStatus('meeting_completed');
                                                      }}
                                                      style={{ backgroundColor: '#16a34a', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '6px', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 6px rgba(22, 163, 74, 0.3)' }}
                                                    >
                                                      <CheckCircle size={14} color="white" /> End Meeting
                                                    </button>
                                                  ) : (
                                                    <span style={{ fontSize: '0.78rem', color: '#c2410c', fontWeight: 800, backgroundColor: '#ffedd5', padding: '4px 10px', borderRadius: '6px', border: '1px solid #fed7aa' }}>
                                                      ⏳ In Progress
                                                    </span>
                                                  );
                                                }
                                                if (!isQcCompleted) {
                                                  return !isSales ? (
                                                    <button
                                                      onClick={() => {
                                                        setViewingLeadModal(prev => prev ? { ...prev, qc_status: 'in_meeting', site_manager_status: 'in_meeting', site_inspector_status: 'in_meeting' } : prev);
                                                        setLeads(prevLeads => prevLeads.map(l => String(l.lead_id) === String(viewingLeadModal.lead_id) ? { ...l, qc_status: 'in_meeting', site_manager_status: 'in_meeting', site_inspector_status: 'in_meeting' } : l));
                                                        handleUpdateQCStatus('in_meeting');
                                                      }}
                                                      style={{ backgroundColor: '#f97316', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '6px', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 6px rgba(249, 115, 22, 0.3)' }}
                                                    >
                                                      <Play size={14} fill="white" /> Start Meeting
                                                    </button>
                                                  ) : (
                                                    <span style={{ fontSize: '0.78rem', color: '#1d4ed8', fontWeight: 800, backgroundColor: '#eff6ff', padding: '4px 10px', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                                                      📅 Scheduled
                                                    </span>
                                                  );
                                                }
                                                return (
                                                  <span style={{ fontSize: '0.78rem', color: '#15803d', fontWeight: 800, backgroundColor: '#dcfce7', padding: '4px 10px', borderRadius: '6px', border: '1px solid #bbf7d0', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                    ✅ Done
                                                  </span>
                                                );
                                              })()}
                                            </td>
                                          </tr>
                                        )}


                                      </>
                                    );
                                  })()}
                              </tbody>
                            </table>
                          </div>
                        </div>
                </div>
              );
              })()}

            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '12px 24px',
              borderTop: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexShrink: 0,
              borderRadius: 0
            }}>
              <div style={{ fontSize: '0.82rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#10b981' }}></span>
                <span>Client: <strong style={{ color: '#1e293b' }}>{viewingLeadModal.client_name}</strong></span>
              </div>
              <button
                type="button"
                onClick={() => setViewingLeadModal(null)}
                style={{
                  padding: '8px 22px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  color: '#334155',
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                  transition: 'all 0.15s ease'
                }}
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* START PROJECT CONVERT MODAL */}
      {showConvertModal && isAdminOrPM && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '20px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '520px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            
            {/* Fixed Header with X Close Button (Does not scroll) */}
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



      {/* COLLECT PAYMENT MODAL */}
      {showCollectModal && collectLead && isAdminOrPM && (() => {
        const totalB = Number((collectLead as any).initial_quote_amount || collectLead.total_budget || collectLead.estimated_budget) || 0;
        const target10 = totalB * 0.1;

        const advanceP = Math.max(parseFloat(String((collectLead as any).advance_received || 0)) || 0, parseFloat(String((collectLead as any).advance_paid || 0)) || 0);
        let finPaid = 0;
        if (financeTransactions && Array.isArray(financeTransactions)) {
          const lId = String(collectLead.lead_id);
          const mcId = String(collectLead.manual_client_id || '').toLowerCase();
          const pCode = String((collectLead as any).project_code || '').toLowerCase();
          finPaid = financeTransactions
            .filter((t: any) => t.type === 'credit' && (
              String(t.project_id) === lId || 
              (mcId && String(t.project_id).toLowerCase() === mcId) || 
              (pCode && String(t.project_id).toLowerCase() === pCode)
            ))
            .reduce((sum: number, t: any) => sum + parseFloat(t.amount || 0), 0);
        }

        const target20 = Math.round(totalB * 0.20);
        const totalPaidSoFar = Math.max(advanceP, finPaid);
        const paidP = totalB > 0 ? (totalPaidSoFar / totalB) * 100 : 0;
        const isStage1Complete = paidP >= 9.9;

        const modalTitle = isStage1Complete ? "Collect Stage 2 Payment (10% For Masking & QC)" : "Collect Remaining Stage 1 Advance";
        const stageTargetLabel = isStage1Complete ? "Stage 2 Target (20% Cumulative):" : "Stage 1 (10% Target):";
        const dueAmount = isStage1Complete ? Math.max(0, target20 - totalPaidSoFar) : Math.max(0, target10 - totalPaidSoFar);

        // 🔒 CRITICAL: If Stage 2 is already fully paid, DO NOT render the collection modal!
        const isStage2AlreadyPaid = paidP >= 19.5 || collectLead.stage2_paid === 1 || (collectLead as any).is_20_percent_paid === 1 || isTwentyPercentPaidForLead(collectLead);
        if (isStage2AlreadyPaid) {
          return null;
        }
        if (isStage1Complete && dueAmount <= 0) {
          return null;
        }

        return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300, padding: '20px' }}>
          <div style={{ backgroundColor: 'white', padding: '28px', borderRadius: '16px', width: '100%', maxWidth: '440px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h3 style={{ marginBottom: '6px', fontSize: '1.2rem', color: '#111827', fontWeight: 800 }}>{modalTitle}</h3>
            <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '16px' }}>
              Client: <strong>{collectLead.client_name}</strong> ({collectLead.manual_client_id || collectLead.project_code || `PR-${collectLead.lead_id}`})
            </p>
            <form onSubmit={handleCollectSubmit}>
                  <div style={{ marginBottom: '16px', backgroundColor: '#fff7ed', padding: '12px 14px', borderRadius: '10px', border: '1px solid #ffedd5', fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#334155', fontWeight: 700 }}>
                      <span>Total Budget:</span>
                      <span>₹{Math.round(totalB).toLocaleString('en-US')}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ea580c', fontWeight: 800 }}>
                      <span>{stageTargetLabel}</span>
                      <span>₹{Math.round(isStage1Complete ? target20 : (totalB * 0.1)).toLocaleString('en-US')}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#15803d', fontWeight: 700 }}>
                      <span>✅ Paid So Far:</span>
                      <span>₹{Math.round(totalPaidSoFar).toLocaleString('en-US')} ({paidP.toFixed(1)}%)</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#c2410c', fontWeight: 800, fontSize: '0.88rem', borderTop: '1px dashed #fed7aa', paddingTop: '6px' }}>
                      <span>⏳ {isStage1Complete ? "Stage 2 Due Amount:" : "Remaining Stage 1 Due:"}</span>
                      <span>₹{Math.round(dueAmount).toLocaleString('en-US')} ({((dueAmount / (totalB || 1)) * 100).toFixed(1)}%)</span>
                    </div>
                  </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 700, color: '#374151' }}>Collection Amount (₹) *</label>
                <input 
                  type="number" 
                  required 
                  value={collectAmount} 
                  onChange={(e) => setCollectAmount(e.target.value)} 
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid #ea580c', fontSize: '1rem', fontWeight: 700, outline: 'none', color: '#0f172a' }} 
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 700, color: '#374151' }}>Payment Mode *</label>
                <select 
                  value={collectPaymentMode} 
                  onChange={(e) => setCollectPaymentMode(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', fontWeight: 600, outline: 'none', backgroundColor: '#ffffff' }}
                >
                  <option value="UPI / Online">UPI / GPay / PhonePe</option>
                  <option value="Bank Transfer">Bank Transfer / NEFT / IMPS</option>
                  <option value="Cash">Cash Payment</option>
                  <option value="Cheque">Cheque Payment</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowCollectModal(false)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: 'white', fontWeight: 600, color: '#374151' }}>Cancel</button>
                <button type="submit" disabled={submittingCollect} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', backgroundColor: '#c2410c', color: 'white', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(194, 65, 12, 0.3)' }}>
                  {submittingCollect && <Loader2 className="animate-spin" size={16} />}
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      );
      })()}

      {/* EMPLOYEE VIEW-ONLY PAYMENT REQUIREMENT MODAL */}
      {viewingPaymentLead && (() => {
        const totalB = Number((viewingPaymentLead as any).initial_quote_amount || viewingPaymentLead.total_budget || viewingPaymentLead.estimated_budget) || 0;
        const target10 = Math.round(totalB * 0.10);
        const advanceP = Math.max(parseFloat(String((viewingPaymentLead as any).advance_received || 0)) || 0, parseFloat(String((viewingPaymentLead as any).advance_paid || 0)) || 0);
        let finPaid = 0;
        if (financeTransactions && Array.isArray(financeTransactions)) {
          const lId = String(viewingPaymentLead.lead_id);
          const mcId = String(viewingPaymentLead.manual_client_id || '').toLowerCase();
          const pCode = String((viewingPaymentLead as any).project_code || '').toLowerCase();
          finPaid = financeTransactions
            .filter((t: any) => t.type === 'credit' && (
              String(t.project_id) === lId || 
              (mcId && String(t.project_id).toLowerCase() === mcId) || 
              (pCode && String(t.project_id).toLowerCase() === pCode)
            ))
            .reduce((sum: number, t: any) => sum + parseFloat(t.amount || 0), 0);
        }
        const totalPaidSoFar = Math.round(Math.max(advanceP, finPaid));
        const paidP = totalB > 0 ? (totalPaidSoFar / totalB) * 100 : 0;
        const remAmt = Math.max(0, target10 - totalPaidSoFar);

        return (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300, padding: '20px' }}>
            <div style={{ backgroundColor: 'white', padding: '28px', borderRadius: '16px', width: '100%', maxWidth: '480px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1.5px solid #f1f5f9', paddingBottom: '12px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#111827', fontWeight: 800 }}>Client Payment Requirement</h3>
                  <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.82rem' }}>
                    Client: <strong>{viewingPaymentLead.client_name}</strong> ({viewingPaymentLead.manual_client_id || (viewingPaymentLead as any).project_code || `PR-${viewingPaymentLead.lead_id}`})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingPaymentLead(null)}
                  style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Payment Details Breakdown */}
              <div style={{ backgroundColor: '#fff7ed', border: '1.5px solid #fed7aa', borderRadius: '12px', padding: '16px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#334155', fontWeight: 600 }}>
                  <span>Total Quotation Budget:</span>
                  <span style={{ fontWeight: 800, color: '#0f172a' }}>₹{totalB.toLocaleString('en-IN')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ea580c', fontWeight: 700 }}>
                  <span>Stage 1 (10% Target):</span>
                  <span>₹{target10.toLocaleString('en-IN')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#15803d', fontWeight: 700 }}>
                  <span>Paid So Far:</span>
                  <span>₹{totalPaidSoFar.toLocaleString('en-IN')} ({paidP.toFixed(1)}%)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#c2410c', fontWeight: 800, fontSize: '1.05rem', borderTop: '1px dashed #fdba74', paddingTop: '10px', marginTop: '4px' }}>
                  <span>Client Needs to Pay:</span>
                  <span>₹{remAmt.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* View-Only Information Notice */}
              <div style={{ backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '12px 14px', fontSize: '0.82rem', color: '#475569', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Info size={18} color="#0284c7" style={{ flexShrink: 0 }} />
                <span>Only Admin and Project Manager (PM) have permission to record payments or start the project.</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setViewingPaymentLead(null)}
                  style={{ width: '100%', padding: '10px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 700, cursor: 'pointer', fontSize: '0.90rem' }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Book D1 Modal */}
      {showBookD1Modal && (() => {
        const isRescheduled = bookD1Status === 'rescheduled';
        const isCompleted = selectedBookD1Lead?.d1_status === 'meeting_completed' || selectedBookD1Lead?.d1_status === 'completed' || selectedBookD1Lead?.status === 'meeting_completed' || selectedBookD1Lead?.status === 'completed';
        const isFreshBooking = !selectedBookD1Lead?.d1_assigned_to;
        
        const isStarted = selectedBookD1Lead?.d1_status === 'in_meeting' || selectedBookD1Lead?.status === 'in_meeting';
        const canEditDesigner = false; // Always false for designers
        const canEditDateTime = (isRescheduled || isFreshBooking) && !isCompleted && !isStarted;
        const uRole = String(user?.role || '').toLowerCase();
        const isAdmin = ['admin', 'administrator', 'superadmin', 'management', 'owner'].includes(uRole) || uRole.includes('admin');
        const isDesigner = ['d1', 'd2', 'designer', 'lead_designer', 'associate_designer', 'ad', 'graphic_designer', 'gd'].includes(uRole) || uRole.includes('design') || uRole.includes('d1') || uRole.includes('d2');
        const isSales = ['sales', 'sales_person', 'sales_executive', 'business_associate', 'ba', 'telecaller'].includes(uRole) || (uRole.includes('sales') && !uRole.includes('manager'));
        const isManagerOrAdmin = !isSales && (isAdmin || ['manager', 'general_manager', 'gm', 'operations_manager', 'om'].includes(uRole) || uRole.includes('manager'));
        const canControlMeetingModal = !isSales && (isDesigner || isAdmin);
        
        return (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1250, padding: '16px' }}>
            <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', width: '100%', maxWidth: '440px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: isCompleted ? '#16a34a' : '#111827', margin: 0 }}>
                  {isCompleted ? '✅ Completed Consultation' : (selectedBookD1Lead?.d1_assigned_to ? 'Reschedule Designer' : 'Book Designer')}
                </h2>
                <button
                  type="button"
                  onClick={() => setShowBookD1Modal(false)}
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
                <form onSubmit={handleBookD1Submit}>
                {/* 1. Select Lead / Primary Designer Dropdown */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#374151', marginBottom: '6px', fontWeight: 700 }}>
                    🎨 Select Lead Designer (D1 / D2) <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    value={selectedD1User}
                    onChange={(e) => setSelectedD1User(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      outline: 'none',
                      backgroundColor: '#ffffff',
                      color: '#0f172a'
                    }}
                    required
                  >
                    <option value="">-- Select Lead Designer --</option>
                    {(() => {
                      let leadDesigners = team.filter(u => {
                        const r = String(u.role || '').toLowerCase();
                        const isCommon = ['admin', 'manager', 'management', 'superadmin', 'project_head'].includes(r) || r.includes('admin') || r.includes('manager');
                        const isLead = (r === 'd1' || r === 'd2' || r === 'designer' || r.includes('lead') || r.includes('d1') || r.includes('d2') || r.includes('interior')) && !r.includes('assoc') && !r.includes('assistant');
                        return isLead || isCommon;
                      });
                      if (leadDesigners.length === 0) leadDesigners = team;
                      return leadDesigners.map(u => (
                        <option key={`d1-lead-${u.user_id}`} value={String(u.user_id)}>
                          {u.name} ({u.role || 'Lead Designer'})
                        </option>
                      ));
                    })()}
                  </select>
                </div>

                {/* 2. Select Associate Designer Dropdown */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#374151', marginBottom: '6px', fontWeight: 700 }}>
                    📐 Select Associate Designer
                  </label>
                  <select
                    value={selectedAssocUser}
                    onChange={(e) => setSelectedAssocUser(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      outline: 'none',
                      backgroundColor: '#ffffff',
                      color: '#0f172a'
                    }}
                  >
                    <option value="">-- Select Associate Designer (Optional) --</option>
                    {(() => {
                      let assocDesigners = team.filter(u => {
                        const r = String(u.role || '').toLowerCase();
                        const isCommon = ['admin', 'manager', 'management', 'superadmin', 'project_head'].includes(r) || r.includes('admin') || r.includes('manager');
                        const isAssocOrDesign = r.includes('assoc') || r.includes('associate') || r.includes('assistant') || r.includes('design') || r === 'd2' || r === 'graphic_designer' || r === 'd1';
                        return isAssocOrDesign || isCommon;
                      });
                      if (assocDesigners.length === 0) assocDesigners = team;
                      return assocDesigners.map(u => (
                        <option key={`d1-assoc-${u.user_id}`} value={String(u.user_id)}>
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
                      value={bookD1Date}
                      min={getTodayDateString()}
                      disabled={!canEditDateTime}
                      onChange={(e) => {
                        const val = e.target.value;
                        const todayStr = getTodayDateString();
                        const validDate = (val && val >= todayStr) ? val : todayStr;
                        setBookD1Date(validDate);
                        const nextValid = getFirstAvailableD1Slot(validDate);
                        setBookD1Time(nextValid || (validDate > todayStr ? '10:00' : ''));
                        if (validDate !== todayStr && (bookD1Status === 'in_meeting' || bookD1Status === 'meeting_completed' || bookD1Status === 'completed')) {
                          setBookD1Status('rescheduled');
                        }
                        try { (e.target as HTMLElement).blur(); } catch (_) {}
                      }}
                      style={{ width: '100%', padding: '10px 10px 10px 36px', borderRadius: '8px', border: '1px solid #d1d5db', outline: 'none', color: '#374151', fontSize: '0.9rem', backgroundColor: !canEditDateTime ? '#f1f5f9' : '#ffffff' }}
                      required
                    />
                  </div>
                </div>
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#374151', marginBottom: '8px', fontWeight: 600 }}>Select Time Slot <span style={{ color: '#ef4444' }}>*</span></label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    {FIXED_SLOTS.map((slot) => {
                      const booked = isD1SlotBooked(slot.value);
                      const isPast = isSlotPastTime(slot.value, bookD1Date);
                      const disabled = !canEditDateTime || ((booked || isPast) && slot.value !== bookD1Time);
                      const selected = bookD1Time === slot.value;
                      return (
                        <button
                          key={slot.value}
                          type="button"
                          disabled={disabled}
                          onClick={() => setBookD1Time(slot.value)}
                          style={{
                            padding: '10px 6px',
                            borderRadius: '8px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: disabled ? 'not-allowed' : 'pointer',
                            border: selected ? '2px solid #f97316' : disabled ? '1px dashed #cbd5e1' : '1px solid #e5e7eb',
                            backgroundColor: selected ? '#fff7ed' : (disabled ? '#f1f5f9' : 'white'),
                            color: selected ? '#ea580c' : (disabled ? '#94a3b8' : '#374151'),
                            textDecoration: (disabled && !selected) ? 'line-through' : 'none',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '2px',
                            transition: 'all 0.2s',
                            opacity: (disabled && !selected) ? 0.5 : 1
                          }}
                        >
                          <span>{slot.label}</span>
                          {booked && slot.value !== bookD1Time && <span style={{ fontSize: '0.7rem', color: '#ef4444', textDecoration: 'none', fontWeight: 600 }}>Already Booked</span>}
                          {!booked && isPast && slot.value !== bookD1Time && <span style={{ fontSize: '0.7rem', color: '#64748b', textDecoration: 'none', fontWeight: 600 }}>⛔ Passed</span>}
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

                {canControlMeetingModal && (
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: '#374151', marginBottom: '6px', fontWeight: 700 }}>Consultation Status</label>
                    <select
                      value={['meeting_completed', 'completed'].includes(bookD1Status) ? 'meeting_completed' : 'in_meeting'}
                      disabled={isCompleted}
                      onChange={(e) => setBookD1Status(e.target.value)}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid #d1d5db', outline: 'none', fontSize: '0.88rem', color: '#0f172a', fontWeight: 700, backgroundColor: isCompleted ? '#f1f5f9' : '#ffffff' }}
                    >
                      <option value="in_meeting">▶️ Start Meeting</option>
                      <option value="meeting_completed">✅ End Meeting</option>
                    </select>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button type="button" onClick={() => setShowBookD1Modal(false)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #e5e7eb', backgroundColor: 'white', color: '#374151', fontWeight: 500 }}>
                    {isCompleted ? 'Close' : 'Cancel'}
                  </button>
                  {!isCompleted && (() => {
                    let btnText = canControlMeetingModal ? '▶️ Start Meeting' : '📅 Confirm Booking';
                    let btnBg = canControlMeetingModal ? '#ea580c' : '#2563eb';

                    if (canControlMeetingModal) {
                      if (['meeting_completed', 'completed'].includes(bookD1Status)) {
                        btnText = '✅ End Meeting';
                        btnBg = '#16a34a';
                      } else {
                        btnText = '▶️ Start Meeting';
                        btnBg = '#ea580c';
                      }
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
                          cursor: 'pointer',
                          fontSize: '0.9rem'
                        }}
                      >
                        {submitting ? <Loader2 className="animate-spin" size={20} /> : btnText}
                      </button>
                    );
                  })()}
                </div>
              </form>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Book Site Manager Modal */}
      {showBookSiteModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300, padding: '16px' }}>
          <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', width: '100%', maxWidth: '440px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#111827', margin: 0 }}>
                Book Site Manager / MMT Slot
              </h2>
              <button
                type="button"
                onClick={() => setShowBookSiteModal(false)}
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
              <form onSubmit={handleBookSiteSubmit}>
              {/* Role Dropdown Selector */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#374151', marginBottom: '6px' }}>
                  Choose Role to Assign Personnel:
                </label>
                <select
                  value={siteModalRoleTab}
                  onChange={(e) => setSiteModalRoleTab(e.target.value as any)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #ea580c', fontSize: '0.88rem', fontWeight: 700, color: '#0f172a', backgroundColor: '#fff7ed', outline: 'none' }}
                >
                  <option value="site_inspector">🔍 Site Manager / Inspector</option>
                  <option value="mmt">📦 MMT Team (Masking/Measurement)</option>
                  <option value="pm">🏢 Project Manager (PM)</option>
                  <option value="designer">🎨 Associate Designer</option>
                </select>
              </div>

              {/* Role Team Checklist - Department Segregated */}
              <div style={{ marginBottom: '16px' }}>
                <DepartmentPersonnelSelector
                  team={team}
                  roleContext={siteModalRoleTab as any}
                  multiSelect={siteModalRoleTab === 'mmt' || siteModalRoleTab === 'site_inspector'}
                  label={`Select ${siteModalRoleTab === 'site_inspector' ? 'Site Inspector(s) (Multi-Select Allowed)' : siteModalRoleTab === 'mmt' ? 'MMT Member(s) (Multi-Select Allowed)' : siteModalRoleTab === 'pm' ? 'Project Manager' : 'Associate Designer'}:`}
                  selectedUserId={siteModalRoleTab === 'site_inspector' ? (siteInspectorUserId || selectedSiteUser) : siteModalRoleTab === 'mmt' ? mmtUserId : siteModalRoleTab === 'pm' ? pmUserId : designerUserId}
                  onSelectUserId={(uid) => {
                    if (siteModalRoleTab === 'site_inspector') {
                      setSiteInspectorUserId(uid);
                      setSelectedSiteUser(uid);
                    } else if (siteModalRoleTab === 'mmt') {
                      setMmtUserId(uid);
                    } else if (siteModalRoleTab === 'pm') {
                      setPmUserId(uid);
                    } else if (siteModalRoleTab === 'designer') {
                      setDesignerUserId(uid);
                    }
                  }}
                />
              </div>

              {/* Cute Summary Verification Panel */}
              {renderCutePersonnelSummary('all')}
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
                    onChange={(e) => {
                      const val = e.target.value;
                      const todayStr = getTodayDateString();
                      const validDate = (val && val >= todayStr) ? val : todayStr;
                      setBookDate(validDate);
                      const nextValid = getFirstAvailableSlot(validDate);
                      setBookTime(nextValid || (validDate > todayStr ? '10:00' : ''));
                      try { (e.target as HTMLElement).blur(); } catch (_) {}
                    }}
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
                    const isPast = isSlotPastTime(slot.value, bookDate);
                    const disabled = booked || isPast;
                    const selected = bookTime === slot.value && !disabled;
                    return (
                      <button
                        key={slot.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => { if (!disabled) setBookTime(slot.value); }}
                        style={{
                          padding: '10px 8px',
                          borderRadius: '8px',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          cursor: disabled ? 'not-allowed' : 'pointer',
                          pointerEvents: disabled ? 'none' : 'auto',
                          border: selected ? '2px solid #f97316' : disabled ? '1px dashed #cbd5e1' : '1px solid #e5e7eb',
                          backgroundColor: disabled ? '#f1f5f9' : selected ? '#fff7ed' : 'white',
                          color: disabled ? '#94a3b8' : selected ? '#ea580c' : '#374151',
                          textDecoration: disabled ? 'line-through' : 'none',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '2px',
                          transition: 'all 0.2s',
                          opacity: disabled ? 0.5 : 1
                        }}
                      >
                        <span>{slot.label}</span>
                        {booked && <span style={{ fontSize: '0.7rem', color: '#ef4444', textDecoration: 'none', fontWeight: 600 }}>Already Booked</span>}
                        {!booked && isPast && <span style={{ fontSize: '0.7rem', color: '#64748b', textDecoration: 'none', fontWeight: 600 }}>⛔ Time Passed</span>}
                      </button>
                    );
                  })}
                </div>
                {FIXED_SLOTS.every(s => isSlotBooked(s.value) || isSlotPastTime(s.value, bookDate)) && (
                  <div style={{ marginTop: '8px', padding: '8px 12px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px', fontSize: '0.78rem', color: '#991b1b', textAlign: 'center', fontWeight: 500 }}>
                    ⚠️ All time slots for this date have passed or are booked. Please select a future date.
                  </div>
                )}
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
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#374151', marginBottom: '6px', fontWeight: 700 }}>Appointment / Consultation Status</label>
                <select
                  value={siteBookingStatus}
                  onChange={(e) => setSiteBookingStatus(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid #ea580c', outline: 'none', fontSize: '0.88rem', color: '#0f172a', fontWeight: 700, backgroundColor: '#ffffff' }}
                >
                  <option value="booked">📅 Scheduled</option>
                  <option value="rescheduled">🔄 Rescheduled</option>
                  <option value="transferred">🔀 Transferred</option>
                  <option value="meeting_completed">✅ Meeting Completed</option>
                </select>
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
        </div>
      )}

      {/* PREPARE AGREEMENT & FINAL QUOTATION PDF MODAL */}
      {showAgreementModal && agreementLead && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300, padding: '20px' }}>
          <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '16px', width: '100%', maxWidth: '520px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: '8px', fontSize: '1.25rem', color: '#1e3a8a', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={20} color="#2563eb" /> 📄 Prepare Agreement &amp; Final Quotation PDF
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.88rem', marginBottom: '20px' }}>
              Review final project budget adjustments, add agreement notes, and send PDF directly to client via email.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Client Name &amp; ID:
                </label>
                <input
                  type="text"
                  readOnly
                  value={`${agreementLead.client_name} (${agreementLead.manual_client_id || agreementLead.project_code || 'PR-' + agreementLead.lead_id})`}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontWeight: 700, color: '#1e293b' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Final Budget Amount (₹) — (Adjust budget increase/decrease):
                </label>
                <input
                  type="number"
                  value={agreementBudget}
                  onChange={(e) => setAgreementBudget(e.target.value)}
                  placeholder="Enter Final Budget Amount in ₹"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #2563eb', outline: 'none', fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Special Agreement Notes / Terms:
                </label>
                <textarea
                  rows={3}
                  value={agreementNotes}
                  onChange={(e) => setAgreementNotes(e.target.value)}
                  placeholder="Add scope changes, payment schedule terms, or special conditions..."
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.85rem' }}
                ></textarea>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAgreementModal(false)}
                  style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: 'white', color: '#475569', fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSendAgreementPDF}
                  disabled={submittingAgreement}
                  style={{ flex: 2, padding: '10px', borderRadius: '8px', border: 'none', backgroundColor: '#2563eb', color: 'white', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 2px 8px rgba(37,99,235,0.3)' }}
                >
                  {submittingAgreement ? <Loader2 className="animate-spin" size={18} /> : <><Send size={16} /> Send Agreement PDF &amp; Final Quotation</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 📦 Connect with MMTS & PM Prompt Modal (Appears ONCE when 10% advance is paid / project started) */}
      {showMmtsPromptModal && promptMmtsLead && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', maxWidth: '480px', width: '100%', padding: '24px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1.5px solid #fed7aa', animation: 'fadeIn 0.2s ease-out' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: '#fff7ed', border: '1px solid #ffedd5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>
                  📦
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#9a3412' }}>Connect with MMTS &amp; PM</h3>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Project Started (10% Stage 1 Paid)</p>
                </div>
              </div>
              <button onClick={() => setShowMmtsPromptModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ backgroundColor: '#fff7ed', padding: '14px', borderRadius: '12px', border: '1px solid #ffedd5', marginBottom: '20px', fontSize: '0.88rem', color: '#c2410c', lineHeight: 1.5, fontWeight: 600 }}>
              🎉 <strong>Full 10% Stage 1 Token Advance verified!</strong><br />
              Please schedule a meeting slot to connect client with the <strong>MMTS Team &amp; PM</strong> for initial site measurement.
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => {
                  setShowMmtsPromptModal(false);
                  openLeadModal(promptMmtsLead);
                  setModalTab('mmts');
                  setSiteModalRoleTab('mmt');
                }}
                style={{ flex: 1, padding: '12px 16px', backgroundColor: '#ea580c', color: '#ffffff', borderRadius: '10px', border: 'none', fontWeight: 800, fontSize: '0.90rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 6px -1px rgba(234, 88, 12, 0.25)' }}
              >
                <Calendar size={18} fill="white" /> Book MMTS &amp; PM Slot
              </button>
              <button 
                onClick={() => {
                  setShowMmtsPromptModal(false);
                  navigate('/projects');
                }}
                style={{ padding: '12px 16px', backgroundColor: '#f1f5f9', color: '#475569', borderRadius: '10px', border: '1px solid #cbd5e1', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
              >
                Go to Projects
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 👤 CUSTOMER DETAILS POPUP (TABS: Details, Notes, Files, Quotation) */}
      {showCustomerModal && viewingCustomerLead && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '16px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '18px', width: '100%', maxWidth: '680px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.3)', border: '1px solid #e2e8f0' }}>
            
            {/* Modal Header */}
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fafbfc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: '#0c1527' }}>Customer Details</h3>
                <span style={{ backgroundColor: '#fca412', color: '#ffffff', fontSize: '0.78rem', fontWeight: 800, padding: '3px 10px', borderRadius: '12px', letterSpacing: '0.5px' }}>
                  Project ID / Client ID: {viewingCustomerLead.manual_client_id || viewingCustomerLead.lead_id}
                </span>
              </div>
              <button
                type="button"
                onClick={() => { setShowCustomerModal(false); setViewingCustomerLead(null); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '50%', color: '#64748b' }}
                title="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* 4 Tabs: Details, Notes, Files, Quotation */}
            <div style={{ display: 'flex', gap: '16px', borderBottom: '1.5px solid #ffe8c2', backgroundColor: '#fff9f0', padding: '8px 24px', flexShrink: 0 }}>
              <button 
                type="button"
                onClick={() => setCustomerTab('details')} 
                style={{ padding: '8px 16px', background: 'none', border: 'none', borderBottom: customerTab === 'details' ? '3px solid #fca412' : '3px solid transparent', color: customerTab === 'details' ? '#fca412' : '#6b7280', fontWeight: 800, cursor: 'pointer', fontSize: '0.90rem' }}
              >
                Details
              </button>
              <button 
                type="button"
                onClick={() => setCustomerTab('notes')} 
                style={{ padding: '8px 16px', background: 'none', border: 'none', borderBottom: customerTab === 'notes' ? '3px solid #fca412' : '3px solid transparent', color: customerTab === 'notes' ? '#fca412' : '#6b7280', fontWeight: 800, cursor: 'pointer', fontSize: '0.90rem' }}
              >
                Notes ({notes.length})
              </button>
              <button 
                type="button"
                onClick={() => setCustomerTab('files')} 
                style={{ padding: '8px 16px', background: 'none', border: 'none', borderBottom: customerTab === 'files' ? '3px solid #fca412' : '3px solid transparent', color: customerTab === 'files' ? '#fca412' : '#6b7280', fontWeight: 800, cursor: 'pointer', fontSize: '0.90rem' }}
              >
                Files ({filesData.files.length + filesData.folders.length})
              </button>
              <button 
                type="button"
                onClick={() => setCustomerTab('quotes')} 
                style={{ padding: '8px 16px', background: 'none', border: 'none', borderBottom: customerTab === 'quotes' ? '3px solid #fca412' : '3px solid transparent', color: customerTab === 'quotes' ? '#fca412' : '#6b7280', fontWeight: 800, cursor: 'pointer', fontSize: '0.90rem' }}
              >
                Quotation
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
              {/* TAB 1: DETAILS */}
              {customerTab === 'details' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ backgroundColor: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Client Name</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>{viewingCustomerLead.client_name}</div>
                    </div>
                    <div style={{ backgroundColor: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Contact Number</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>{viewingCustomerLead.contact_number || '-'}</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ backgroundColor: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Email Address</div>
                      <div style={{ fontSize: '0.90rem', fontWeight: 600, color: '#0f172a', marginTop: '2px', wordBreak: 'break-all' }}>{viewingCustomerLead.email || 'N/A'}</div>
                    </div>
                    <div style={{ backgroundColor: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Project Type</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>{viewingCustomerLead.project_type || 'Furniture projects'}</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ backgroundColor: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Scope of Project</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ea580c', marginTop: '2px' }}>{viewingCustomerLead.project_scope || '2 BHK'}</div>
                    </div>
                    <div style={{ backgroundColor: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Estimated Budget</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#15803d', marginTop: '2px' }}>
                        ₹{Number(viewingCustomerLead.estimated_budget || 0).toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ backgroundColor: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Site Location</div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#0f172a', marginTop: '2px', lineHeight: 1.4 }}>{viewingCustomerLead.location || 'N/A'}</div>
                    </div>
                    <div style={{ backgroundColor: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Client Address</div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#0f172a', marginTop: '2px', lineHeight: 1.4 }}>{viewingCustomerLead.client_address || 'N/A'}</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ backgroundColor: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Lead Source</div>
                      <div style={{ fontSize: '0.90rem', fontWeight: 600, color: '#0f172a', marginTop: '2px', textTransform: 'capitalize' }}>
                        {String(viewingCustomerLead.lead_source || 'Walk-in').replace('_', ' ')}
                      </div>
                    </div>
                    <div style={{ backgroundColor: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Current Status</div>
                      <div style={{ fontSize: '0.90rem', fontWeight: 800, color: '#2563eb', marginTop: '2px', textTransform: 'capitalize' }}>
                        {String(viewingCustomerLead.d1_status || viewingCustomerLead.status || 'Active').replace('_', ' ')}
                      </div>
                    </div>
                  </div>

                  {/* Booking Details if assigned */}
                  {(viewingCustomerLead.d1_assigned_to || viewingCustomerLead.d1_booking_time) && (
                    <div style={{ marginTop: '8px', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
                      <h4 style={{ margin: '0 0 10px 0', fontSize: '0.90rem', color: '#111827', fontWeight: 700 }}>Consultation Booking Info</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.85rem' }}>
                        <div>
                          <span style={{ color: '#6b7280', fontSize: '0.75rem', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Assigned Designer</span>
                          <span style={{ fontWeight: 600, color: '#0369a1' }}>
                            {viewingCustomerLead.d1_assigned_name || (viewingCustomerLead.d1_assigned_to ? String(viewingCustomerLead.d1_assigned_to).split(',').map(id => team.find(t => String(t.user_id) === String(id.trim()))?.name).filter(Boolean).join(', ') : 'Not Assigned')}
                          </span>
                        </div>
                        <div>
                          <span style={{ color: '#6b7280', fontSize: '0.75rem', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Booking Date &amp; Time</span>
                          <span style={{ fontWeight: 600, color: '#0f172a' }}>
                            {viewingCustomerLead.d1_booking_time ? new Date(viewingCustomerLead.d1_booking_time).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Pending'}
                          </span>
                        </div>
                      </div>
                      {viewingCustomerLead.d1_notes && (
                        <div style={{ marginTop: '10px', padding: '10px', backgroundColor: 'white', borderRadius: '6px', borderLeft: '3px solid #f97316' }}>
                          <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 600, display: 'block' }}>Notes:</span>
                          <span style={{ fontSize: '0.85rem', color: '#374151', whiteSpace: 'pre-wrap' }}>{viewingCustomerLead.d1_notes}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: NOTES */}
              {customerTab === 'notes' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '320px' }}>
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
                          handleAddCustomerModalNote();
                        }
                      }}
                    />
                    <button 
                      type="button"
                      onClick={handleAddCustomerModalNote} 
                      style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#111827', color: 'white', fontWeight: 600, cursor: 'pointer', height: 'fit-content', alignSelf: 'flex-start' }}
                    >
                      Add Note
                    </button>
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '350px' }}>
                    {notes.length === 0 ? (
                      <p style={{ color: '#6b7280', textAlign: 'center', marginTop: '24px' }}>No notes found.</p>
                    ) : (
                      notes.map(note => (
                        <div key={note.id} style={{ padding: '12px 16px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                          <p style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: '#374151', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{note.note_text}</p>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#9ca3af' }}>
                            <span>{note.user_name || 'System'}</span>
                            <span>{new Date(note.created_at).toLocaleString()}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: FILES */}
              {customerTab === 'files' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '320px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {currentFolder && (
                        <button type="button" onClick={() => { setCurrentFolder(''); fetchFiles(viewingCustomerLead.lead_id, ''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#6b7280' }}>
                          ← Back
                        </button>
                      )}
                      <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#111827', fontWeight: 700 }}>
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
                        type="button"
                        onClick={handleCreateCustomerFolder}
                        disabled={creatingFolder || !newFolderName.trim()}
                        style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', backgroundColor: '#e5e7eb', color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600 }}
                      >
                        Create
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', border: '2px dashed #d1d5db', borderRadius: '8px', backgroundColor: '#f9fafb' }}>
                    <Upload size={22} color="#6b7280" />
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: '0 0 2px 0', fontWeight: 600, color: '#374151', fontSize: '0.90rem' }}>Upload Document {currentFolder && `to ${currentFolder}`}</p>
                      <p style={{ margin: 0, fontSize: '0.78rem', color: '#6b7280' }}>Select any file to upload</p>
                    </div>
                    <label style={{ cursor: 'pointer' }}>
                      <input type="file" accept="*/*" style={{ display: 'none' }} onChange={handleCustomerFileUpload} />
                      <span style={{ padding: '8px 16px', backgroundColor: '#111827', color: 'white', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 600, display: 'inline-block' }}>
                        {uploading ? 'Uploading...' : 'Browse'}
                      </span>
                    </label>
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '320px', backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '8px' }}>
                    {filesData.files.length === 0 && filesData.folders.length === 0 ? (
                      <p style={{ color: '#6b7280', textAlign: 'center', marginTop: '24px' }}>No files or folders found.</p>
                    ) : (
                      <>
                        {filesData.folders.map((folder: any) => (
                          <div key={folder.name} onClick={() => { setCurrentFolder(folder.name); fetchFiles(viewingCustomerLead.lead_id, folder.name); }} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}>
                            <Folder size={22} color="#f59e0b" fill="#fef3c7" />
                            <div style={{ flex: 1 }}>
                              <span style={{ fontWeight: 600, color: '#111827', fontSize: '0.88rem' }}>{folder.name}</span>
                            </div>
                          </div>
                        ))}
                        {filesData.files.map((file: any) => (
                          <div key={file.name} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', borderBottom: '1px solid #f3f4f6' }}>
                            <FileText size={22} color="#6366f1" />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <a href={getFileUrl(file.url)} target="_blank" rel="noreferrer" style={{ fontWeight: 700, color: '#2563eb', fontSize: '0.88rem', textDecoration: 'none', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                📄 {file.name.replace(/^\d+_/, '')}
                              </a>
                              <span style={{ fontSize: '0.74rem', color: '#64748b' }}>{(file.size / 1024).toFixed(1)} KB</span>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: QUOTATION */}
              {customerTab === 'quotes' && (() => {
                const matchedQuotes = getQuotesForLead(viewingCustomerLead);

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', minHeight: '320px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                        Quotations for this Customer ({matchedQuotes.length})
                      </h4>
                    </div>
                    {matchedQuotes.length === 0 ? (
                      <div style={{ padding: '36px', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1.5px dashed #cbd5e1' }}>
                        <FileText size={36} color="#94a3b8" style={{ margin: '0 auto 10px auto' }} />
                        <p style={{ margin: 0, fontWeight: 700, color: '#475569', fontSize: '0.92rem' }}>No quotations created yet for this client</p>
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.80rem', color: '#94a3b8' }}>You can create an initial quotation from the Action menu.</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {matchedQuotes.map((q: any) => (
                          <div key={q.quote_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', backgroundColor: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.92rem' }}>
                                  {q.quote_number || `Quote #${q.quote_id}`}
                                </span>
                                {(() => {
                                  const isAccepted = q.status === 'accepted' || String(q.ack_status || '').toLowerCase() === 'accepted';
                                  const isProposalSent = q.status === 'proposal' || q.status === 'proposal_sent' || Boolean(q.ack_email_sent_at);
                                  let bg = '#eff6ff';
                                  let text = '#2563eb';
                                  let label = String(q.status || 'Draft').toUpperCase();
                                  if (isAccepted) {
                                    bg = '#dcfce7'; text = '#15803d'; label = 'QUOTE ACCEPTED';
                                  } else if (isProposalSent) {
                                    bg = '#f3e8ff'; text = '#7e22ce'; label = 'PROPOSAL SENT';
                                  }
                                  return (
                                    <span style={{ fontSize: '0.74rem', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', backgroundColor: bg, color: text }}>
                                      {label}
                                    </span>
                                  );
                                })()}
                              </div>
                              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
                                Total: <strong style={{ color: '#059669' }}>₹{Math.round(Number(q.total_amount || q.grand_total || 0)).toLocaleString('en-IN')}</strong> • {q.created_at ? new Date(q.created_at).toLocaleDateString() : ''}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setShowCustomerModal(false);
                                  window.open(`/print-quote/${q.quote_id}`, '_blank');
                                }}
                                style={{ padding: '6px 12px', backgroundColor: '#0f172a', color: '#ffffff', borderRadius: '6px', border: 'none', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              >
                                <Eye size={12} /> View / Print PDF
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '14px 24px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => { setShowCustomerModal(false); setViewingCustomerLead(null); }}
                style={{ padding: '9px 20px', backgroundColor: '#0f172a', color: '#ffffff', borderRadius: '8px', border: 'none', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ✏️ EDIT CUSTOMER ENQUIRY MODAL */}
      {showEditModal && editingLead && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001, padding: '16px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '18px', width: '100%', maxWidth: '620px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.3)', border: '1px solid #e2e8f0' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fafbfc' }}>
              <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: '#0c1527' }}>Edit Customer Enquiry</h3>
              <button
                type="button"
                onClick={() => { setShowEditModal(false); setEditingLead(null); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '50%', color: '#64748b' }}
                title="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, padding: '20px 24px' }}>
              <form onSubmit={handleUpdateLead}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Client Name *</label>
                    <input type="text" required value={editFormData.client_name} onChange={(e) => setEditFormData({ ...editFormData, client_name: e.target.value })} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #cbd5e1', outline: 'none', fontSize: '0.90rem', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Contact Number *</label>
                    <input type="text" required value={editFormData.contact_number} onChange={(e) => setEditFormData({ ...editFormData, contact_number: e.target.value })} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #cbd5e1', outline: 'none', fontSize: '0.90rem', boxSizing: 'border-box' }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Email Address</label>
                    <input type="email" value={editFormData.email} onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #cbd5e1', outline: 'none', fontSize: '0.90rem', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                      Project ID / Client ID {user?.role !== 'admin' && <span style={{ fontSize: '0.72rem', color: '#64748b' }}>🔒 Permanent</span>}
                    </label>
                    <input 
                      type="text" 
                      disabled={user?.role !== 'admin'}
                      value={editFormData.manual_client_id} 
                      onChange={(e) => setEditFormData({ ...editFormData, manual_client_id: e.target.value })} 
                      style={{ 
                        width: '100%', 
                        padding: '10px 14px', 
                        borderRadius: '10px', 
                        border: '1.5px solid #cbd5e1', 
                        outline: 'none',
                        backgroundColor: user?.role !== 'admin' ? '#f1f5f9' : 'white',
                        cursor: user?.role !== 'admin' ? 'not-allowed' : 'text',
                        color: user?.role !== 'admin' ? '#64748b' : '#0f172a',
                        fontSize: '0.90rem',
                        boxSizing: 'border-box'
                      }} 
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Client Address</label>
                    <textarea rows={2} value={editFormData.client_address} onChange={(e) => setEditFormData({ ...editFormData, client_address: e.target.value })} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #cbd5e1', outline: 'none', fontSize: '0.88rem', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Site Location</label>
                    <textarea rows={2} value={editFormData.location} onChange={(e) => setEditFormData({ ...editFormData, location: e.target.value })} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #cbd5e1', outline: 'none', fontSize: '0.88rem', boxSizing: 'border-box' }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Project Type</label>
                    <select value={editFormData.project_type} onChange={(e) => setEditFormData({ ...editFormData, project_type: e.target.value })} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #cbd5e1', outline: 'none', fontSize: '0.90rem', boxSizing: 'border-box', backgroundColor: 'white' }}>
                      <option value="Furniture projects">Furniture projects</option>
                      <option value="Interior Projects">Interior Projects</option>
                      <option value="Commercial project">Commercial project</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Scope of Project</label>
                    <select value={editFormData.project_scope} onChange={(e) => setEditFormData({ ...editFormData, project_scope: e.target.value })} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #cbd5e1', outline: 'none', fontSize: '0.90rem', boxSizing: 'border-box', backgroundColor: 'white' }}>
                      <option value="2 BHK">2 BHK</option>
                      <option value="3 BHK">3 BHK</option>
                      <option value="Villa">Villa</option>
                      <option value="Duplex">Duplex</option>
                      <option value="Other">Other (Custom Scope)</option>
                    </select>
                  </div>
                </div>

                {editFormData.project_scope === 'Other' && (
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 700, color: '#ea580c' }}>
                      Type Custom Scope *
                    </label>
                    <input
                      type="text"
                      required
                      value={editFormData.custom_scope}
                      onChange={(e) => setEditFormData({ ...editFormData, custom_scope: e.target.value })}
                      placeholder="e.g. 4 BHK, Penthouse, Duplex Villa..."
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #ea580c', backgroundColor: '#fffaf0', outline: 'none', fontSize: '0.90rem', boxSizing: 'border-box' }}
                    />
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Estimated Budget (₹)</label>
                    <input type="number" value={editFormData.estimated_budget} onChange={(e) => setEditFormData({ ...editFormData, estimated_budget: e.target.value })} placeholder="e.g. 500000" style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #cbd5e1', outline: 'none', fontSize: '0.90rem', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Lead Source</label>
                    <select value={editFormData.lead_source} onChange={(e) => setEditFormData({ ...editFormData, lead_source: e.target.value })} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #cbd5e1', outline: 'none', fontSize: '0.90rem', boxSizing: 'border-box', backgroundColor: 'white' }}>
                      <option value="walk_in">Walk-in</option>
                      <option value="reference">Reference</option>
                      <option value="website">Website</option>
                      <option value="social_media">Social Media</option>
                      <option value="advertisement">Advertisement</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '14px', borderTop: '1px solid #f1f5f9' }}>
                  <button
                    type="button"
                    onClick={() => { setShowEditModal(false); setEditingLead(null); }}
                    style={{ padding: '10px 18px', backgroundColor: '#e2e8f0', color: '#334155', borderRadius: '10px', border: 'none', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingEdit}
                    style={{ padding: '10px 22px', backgroundColor: '#ea580c', color: '#ffffff', borderRadius: '10px', border: 'none', fontWeight: 800, fontSize: '0.88rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 10px rgba(234, 88, 12, 0.25)' }}
                  >
                    {submittingEdit ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save Changes
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

export default D1Leads;
