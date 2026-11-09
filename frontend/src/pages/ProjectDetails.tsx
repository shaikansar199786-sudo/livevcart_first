import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import {
    ArrowLeft,
    CreditCard,
    Package,
    User,
    MapPin,
    Phone,
    CheckCircle2,
    Loader2,
    Briefcase,
    Plus,
    X,
    Printer,
    Save,
    Trash2,
    Edit2,
    Clock,
    Calendar,
    AlertCircle,
    ArrowUp,
    ArrowDown,
    Layers,
    ArrowUpDown,
    ChevronDown,
    ChevronRight,
    Download,
    Eye,
    Upload
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import QuoteTab from '../components/QuoteTab';
import { DocumentTab } from '../components/DocumentTab';
import { QualityCheckTab } from '../components/QualityCheckTab';
import { ProjectStages } from '../components/ProjectStages';
import { computeProjectAutoStage, STAGE_COLORS } from './Projects';
import { ClientSignatureModal } from '../components/ClientSignatureModal';
import { PostQcDecisionModal } from '../components/PostQcDecisionModal';

interface ProjectDetailsDarunta {
    project_id: string;
    project_code: string;
    project_head_id?: string;
    project_name: string;
    client_name: string;
    client_phone: string;
    client_address: string;
    site_address: string;
    location: string;
    project_type: string;
    start_date: string;
    expected_end_date: string;
    total_budget: number;
    total_paid: number;
    total_spent: number;
    remaining_balance: number;
    status: string;
    project_head_name: string;
    qc_status?: string;
    qc_booking_time?: string;
    qc_approved?: number;
    mmts_status?: string;
    mmts_booking_time?: string;
    client_signature?: string;
    lead_info?: any;
    lead_id?: string | number;
    converted_from_lead_id?: string | number;
    manual_client_id?: string;
    project_stage?: string;
    advance_paid?: number;
    advance_received?: number;
    paid_amount?: number;
    budget?: number;
    initial_quote_amount?: number;
    approved_quote_amount?: number;
    latest_quote_amount?: number;
    has_pending_quote_revision?: boolean;
    is_10_percent_paid?: number;
    stage1_paid?: number;
    stage2_paid?: number;
    is_20_percent_paid?: number;
    stage3_paid?: number;
    stage4_paid?: number;
    payment_status?: string;
    is_final_quote_approved?: number;
    team: Array<{
        user_id: string;
        name: string;
        role: string;
        phone: string;
        assignment_role: string;
    }>;
}

interface QuoteItem {
    id: string;
    particulars: string;
    brand: string;
    unit: string;
    quantity: number;
    used_quantity?: number;
    rate: number;
    amount: number;
}

interface QuoteSection {
    id: string;
    name: string;
    items: QuoteItem[];
}

import { API_BASE_URL } from '../config';

export const ProjectDetails: React.FC = () => {

    const printRef = useRef<HTMLDivElement>(null);
    const { id } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const isAdmin = Boolean(
        user?.role === 'admin' ||
        user?.is_admin === 1 ||
        user?.is_admin === true ||
        String(user?.is_admin) === '1'
    );

    // Set initial tab based on query param, localStorage or fallback
    const [activeTab, setActiveTab] = useState(() => {
        const searchParams = new URLSearchParams(window.location.search);
        const tabParam = searchParams.get('tab');
        if (tabParam) return tabParam;
        const savedTab = localStorage.getItem(`active_project_tab_${id}`);
        return savedTab || 'overview';
    });

    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const tabParam = searchParams.get('tab');
        if (tabParam) {
            setActiveTab(tabParam);
            localStorage.setItem(`active_project_tab_${id}`, tabParam);
        }
    }, [location.search, id]);

    // Update tab if role loads later and they are on a restricted tab
    useEffect(() => {
        const savedTab = localStorage.getItem(`active_project_tab_${id}`);
        if (!savedTab && (user?.role === 'site_engineer' || user?.role === 'project_head') && activeTab === 'overview') {
            setActiveTab('timeline');
        }
    }, [user?.role, activeTab, id]);

    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
        localStorage.setItem(`active_project_tab_${id}`, tab);
    };

    // Dynamic Role Project Tab Permissions
    const [roleTabPermissions, setRoleTabPermissions] = useState<Record<string, string[]> | null>(() => {
        try {
            const cached = localStorage.getItem('livrcart_role_tab_permissions');
            return cached ? JSON.parse(cached) : null;
        } catch {
            return null;
        }
    });

    useEffect(() => {
        const fetchRoleTabs = async () => {
            try {
                const res = await axios.get(`${API_BASE_URL}/role-tab-permissions`);
                if (res.data?.success && res.data?.data) {
                    setRoleTabPermissions(res.data.data);
                    localStorage.setItem('livrcart_role_tab_permissions', JSON.stringify(res.data.data));
                }
            } catch {
                // Silently fall back to cached or default
            }
        };
        fetchRoleTabs();
    }, []);

    const allowedTabs = useMemo(() => {
        const allPossibleTabs = [
            'overview',
            'quote',
            'quality_check',
            'documents',
            'timeline',
            'pm_timeline',
            'stock_category',
            'vendor_quta',
            'transport',
            'labor',
            'miscellaneous',
            'reimbursements',
            'balance_sheet'
        ];

        return allPossibleTabs.filter(tab => {
            // Admin always has all tabs enabled
            if (user?.role === 'admin') {
                const adminCustom = roleTabPermissions?.['admin'];
                if (adminCustom && adminCustom.length > 0) {
                    return adminCustom.includes(tab);
                }
                return true;
            }

            // Check dynamic custom permissions configured by Admin
            const userRoleKey = String(user?.role || '').toLowerCase().trim();
            if (roleTabPermissions && roleTabPermissions[userRoleKey]) {
                return roleTabPermissions[userRoleKey].includes(tab);
            }

            // Default fallbacks if not customized
            if (['accountant', 'project_head', 'project_manager', 'manager'].includes(user?.role)) {
                return allPossibleTabs.includes(tab);
            }

            if (['site_engineer', 'site_inspector', 'inspector', 'qc'].includes(user?.role)) {
                return ['overview', 'quality_check', 'documents', 'timeline', 'pm_timeline', 'stock_category'].includes(tab);
            }

            if (['d1', 'd2', 'graphic_designer', 'gd', 'designer', 'associate_designer'].includes(user?.role)) {
                return ['overview', 'quote', 'quality_check', 'documents', 'timeline', 'pm_timeline'].includes(tab);
            }

            if (['sales', 'marketing_analyst', 'business_associate'].includes(user?.role)) {
                return ['overview', 'quote', 'documents', 'timeline'].includes(tab);
            }

            if (user?.role === 'mmt') {
                return ['overview', 'quote', 'quality_check', 'documents', 'timeline', 'stock_category', 'vendor_quta'].includes(tab);
            }

            return tab === 'overview';
        });
    }, [user?.role, roleTabPermissions]);

    // Automatically fall back if active tab is restricted
    useEffect(() => {
        if (allowedTabs.length > 0 && !allowedTabs.includes(activeTab)) {
            setActiveTab(allowedTabs[0]);
        }
    }, [allowedTabs, activeTab]);

    // const [project, setProject] = useState<ProjectDetailsData | null>(null);
    const [project, setProject] = useState<ProjectDetailsDarunta | null>(null);
    const [loading, setLoading] = useState(true);
    const [showBudgetModal, setShowBudgetModal] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [budget, setBudget] = useState('');
    const [payment, setPayment] = useState({
        amount: '',
        description: 'Advance Payment',
        payment_mode: 'UPI',
        date: new Date().toISOString().split('T')[0]
    });
    const [submitting, setSubmitting] = useState(false);
    const [quoteTotal, setQuoteTotal] = useState(0);
    const [approvedQuoteTotal, setApprovedQuoteTotal] = useState(0);
    const [inventoryTotal, setInventoryTotal] = useState(0);

    const [transactions, setTransactions] = useState<any[]>([]);

    // Status Badges & Modals State
    const [existingAgreement, setExistingAgreement] = useState<any | null>(null);
    const [showSigModal, setShowSigModal] = useState(false);
    const [showSlotModal, setShowSlotModal] = useState(false);
    const [showStageModal, setShowStageModal] = useState(false);
    const [showPostQcDecisionModal, setShowPostQcDecisionModal] = useState(false);
    const [updatingSlot, setUpdatingSlot] = useState(false);

    // Edit Settings State
    const [showEditModal, setShowEditModal] = useState(false);
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [editForm, setEditForm] = useState({
        project_name: '',
        site_address: '',
        start_date: '',
        expected_end_date: '',
        project_head_id: '',
        site_engineer_id: '',
        status: '',
        project_type: ''
    });

    // Fetch existing agreement for this project
    useEffect(() => {
        if (!project?.project_id && !project?.project_code && !id) return;
        const pid = project?.project_id || project?.project_code || id;
        axios.get(`${API_BASE_URL}/agreements?project_id=${encodeURIComponent(pid)}`)
            .then(res => {
                const list = res.data?.data || (Array.isArray(res.data) ? res.data : []);
                if (list.length > 0) {
                    setExistingAgreement(list[0]);
                }
            })
            .catch(() => { });
    }, [project?.project_id, project?.project_code, id]);

    const handleUpdateSlotStatus = async (newStatus: string) => {
        if (!project) return;
        setUpdatingSlot(true);
        try {
            const targetId = project.project_id || project.project_code || id;
            const res = await axios.post(`${API_BASE_URL}/leads/update-qc-status`, {
                lead_id: targetId,
                status: newStatus,
                assigned_by_name: user?.name || 'User'
            });
            if (res.data?.success) {
                setProject((prev: any) => prev ? { ...prev, qc_status: newStatus } : prev);
                fetchProjectDetails();
                alert(`✅ Slot status updated to: ${newStatus}`);
                setShowSlotModal(false);
            } else {
                alert(res.data?.message || 'Failed to update slot status');
            }
        } catch (err: any) {
            alert('Failed to update slot status: ' + (err?.response?.data?.message || err.message));
        } finally {
            setUpdatingSlot(false);
        }
    };

    useEffect(() => {
        fetchProjectDetails();
        fetchTransactions();
        fetchInventoryTotal();
        fetchQuoteTotal();
        fetchApprovedQuoteTotal();
        if (user?.role === 'admin' || user?.role === 'accountant') {
            fetchUsers();
        }
    }, [id, user]);

    // Listen for QC approvals so Balance Sheet updates when QC issues final approval
    useEffect(() => {
        const handleQCChange = () => {
            fetchProjectDetails();
            fetchApprovedQuoteTotal();
            fetchQuoteTotal();
        };
        window.addEventListener('qc_status_changed', handleQCChange);
        return () => window.removeEventListener('qc_status_changed', handleQCChange);
    }, [id]);

    // Check if Post-QC Client Decision modal should be displayed automatically
    useEffect(() => {
        if (!project || loading) return;
        const isQcApproved = Boolean(
            project.is_final_quote_approved === 1 ||
            project.qc_approved === 1 ||
            project.status === 'qc_approved' ||
            ['approved', 'qc_approved'].includes(String(project.qc_status || '').toLowerCase()) ||
            ['quality check done', 'r2p done', 'works contract done', 'production in progress', 'ready to dispatch', 'in transit', 'delivery done', 'installation stage', 'final qc', 'handover'].includes(String(project.project_stage || '').toLowerCase())
        );

        const pidStr = String(project.project_id || id || '').toLowerCase().trim();
        const pcodeStr = String(project.project_code || '').toLowerCase().trim();
        const isStage3Paid = Boolean(
            project.stage3_paid === 1 ||
            String(project.payment_status || '').toLowerCase().includes('60%') ||
            (pidStr && localStorage.getItem(`stage3_paid_${pidStr}`) === 'true') ||
            (pcodeStr && localStorage.getItem(`stage3_paid_${pcodeStr}`) === 'true') ||
            ['r2p done', 'works contract done', 'production in progress', 'ready to dispatch', 'in transit', 'delivery done', 'installation stage', 'final qc', 'handover'].includes(String(project.project_stage || '').toLowerCase())
        );

        const isProjectActive = !['lost', 'withdrawn', 'cancelled', 'completed'].includes(String(project.status || '').toLowerCase());
        
        // For employees: NEVER allow dismissing the post-qc decision modal; clear any previous session dismissal
        if (!isAdmin) {
            sessionStorage.removeItem(`dismissed_post_qc_${project.project_id || id}`);
        }
        const hasDismissed = isAdmin && sessionStorage.getItem(`dismissed_post_qc_${project.project_id || id}`) === 'true';

        if (isQcApproved && !isStage3Paid && isProjectActive && !hasDismissed) {
            setShowPostQcDecisionModal(true);
        }
    }, [project, loading, id, isAdmin, user?.role]);

    const fetchQuoteTotal = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/quotes/latest?project_id=${id}&is_used=false`);
            if (response.data.success && response.data.data) {
                setQuoteTotal(parseFloat(response.data.data.total_amount));
            }
        } catch (err) {
            console.error('Failed to fetch quote total');
        }
    };

    const fetchApprovedQuoteTotal = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/quotes/approved?project_id=${id}&is_used=false`);
            if (response.data.success && response.data.data && parseFloat(response.data.data.total_amount) > 0) {
                setApprovedQuoteTotal(parseFloat(response.data.data.total_amount));
            }
        } catch (err) {
            console.error('Failed to fetch approved quote total');
        }
    };

    const fetchInventoryTotal = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/controllers/Inventoryproject.php?project_id=${id}`);
            const data = await res.json();
            if (data.status === "success" && data.data.length > 0) {
                const total = data.data.reduce((sum: number, item: any) => sum + Number(item.total), 0);
                setInventoryTotal(total);
            }
        } catch (err) {
            console.error("Failed to fetch inventory total:", err);
        }
    };

    const fetchUsers = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/users`);
            if (response.data.success) {
                setAllUsers(response.data.data);
            }
        } catch (err) { }
    };

    const fetchProjectDetails = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/projects/${id}`);
            if (response.data.success) {
                const proj = response.data.data;
                setProject(proj);
                const isQcApproved = Boolean(proj.is_final_quote_approved === 1 || proj.is_final_quote_approved === true || proj.status === 'qc_approved');
                const officialBudget = isQcApproved
                    ? parseFloat(proj.total_budget || proj.approved_quote_amount || proj.initial_quote_amount || 0)
                    : parseFloat(proj.initial_quote_amount || proj.approved_quote_amount || proj.total_budget || 0);
                setBudget(officialBudget.toString());
                setApprovedQuoteTotal(officialBudget);
            }
        } catch (err) {
            console.error('Failed to fetch project details');
        } finally {
            setLoading(false);
        }
    };

    const fetchTransactions = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/finance/${id}`);
            if (response.data.success) {
                setTransactions(response.data.data);
            }
        } catch (err) {
            console.error('Failed to fetch transactions');
        }
    };

    const handleUpdateBudget = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const response = await axios.post(`${API_BASE_URL}/projects/update-budget`, {
                project_id: id,
                budget: budget
            });
            if (response.data.success) {
                setShowBudgetModal(false);
                fetchProjectDetails();
            }
        } catch (err) {
            alert('Failed to update budget');
        } finally {
            setSubmitting(false);
        }
    };

    const handleRecordPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isAdmin) {
            alert('Permission Denied: Only Admin can add or record customer payments.');
            return;
        }
        if (!payment.amount || parseFloat(payment.amount) <= 0) {
            alert('Please enter a valid amount.');
            return;
        }
        setSubmitting(true);
        try {
            // Save to finance_transactions table
            const response = await axios.post(`${API_BASE_URL}/finance`, {
                project_id: id,
                type: 'credit',
                amount: payment.amount,
                category: 'Payment',
                description: payment.description,
                payment_mode: payment.payment_mode,
                date: payment.date,
                recorded_by: user?.user_id
            });
            if (response.data.success) {
                // Also save to monthly_income table
                try {
                    const paymentDateObj = new Date(payment.date);
                    const paymentMonth = `${paymentDateObj.getFullYear()}-${String(paymentDateObj.getMonth() + 1).padStart(2, '0')}`;

                    // Determine category based on project type
                    const category = (project?.project_type === 'Interior Projects' || project?.project_type === 'Site Execution Tracker' || project?.project_type === 'Execution Projects')
                        ? 'elegance'
                        : 'Livincart';

                    // Fetch existing monthly income data for this month
                    const monthRes = await axios.get(`${API_BASE_URL}/monthly-income?month=${paymentMonth}`);
                    let existingRows = [];
                    if (monthRes.data?.data?.length > 0) {
                        existingRows = monthRes.data.data.map((row: any) => ({
                            ...row,
                            amount: row.amount ? Math.round(Number(row.amount)).toString() : '',
                            date: row.transaction_date || row.date || payment.date
                        }));
                    }

                    // Add new payment row
                    const newRow = {
                        category,
                        description: `${project?.project_name} - ${project?.project_code}`,
                        amount: payment.amount,
                        date: payment.date
                    };

                    const cleanRows = [...existingRows, newRow].filter((r: any) => r.description || r.amount);

                    // Save to monthly_income
                    await axios.post(`${API_BASE_URL}/monthly-income`, { month: paymentMonth, rows: cleanRows });
                } catch (monthlyError) {
                    console.error('Failed to save to monthly_income:', monthlyError);
                    // Don't fail the whole operation if monthly_income save fails
                }

                if (payment.description?.includes('Stage 3') || payment.description?.includes('40%')) {
                    if (id) localStorage.setItem(`stage3_paid_${id}`, 'true');
                    if (project?.project_id) localStorage.setItem(`stage3_paid_${project.project_id}`, 'true');
                    if (project?.project_code) localStorage.setItem(`stage3_paid_${project.project_code}`, 'true');
                }

                setShowPaymentModal(false);
                setPayment({
                    amount: '',
                    description: 'Advance Payment',
                    payment_mode: 'UPI',
                    date: new Date().toISOString().split('T')[0]
                });
                fetchProjectDetails();
                fetchTransactions();
            } else {
                alert('Failed to record payment: ' + (response.data.message || 'Unknown error'));
            }
        } catch (err: any) {
            alert('Failed to record payment: ' + (err?.response?.data?.message || err.message));
        } finally {
            setSubmitting(false);
        }
    };

    const openEditModal = () => {
        const headMember = project?.team?.find((t: any) => t.assignment_role === 'project_head');
        const engineerMember = project?.team?.find((t: any) => t.assignment_role === 'site_engineer');
        setEditForm({
            project_name: project?.project_name || '',
            site_address: project?.site_address || '',
            start_date: project?.start_date ? project.start_date.split('T')[0] : '',
            expected_end_date: project?.expected_end_date ? project.expected_end_date.split('T')[0] : '',
            project_head_id: headMember?.user_id || project?.project_head_id || '',
            site_engineer_id: engineerMember?.user_id || '',
            status: project?.status || 'Pending',
            project_type: project?.project_type || 'Furniture projects'
        });
        setShowEditModal(true);
    };

    const handleUpdateProject = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const response = await axios.put(`${API_BASE_URL}/projects`, {
                project_id: id,
                ...editForm,
                project_head_id: editForm.project_head_id || null,
                site_engineer_id: editForm.site_engineer_id || null
            });
            if (response.data.success) {
                setShowEditModal(false);
                fetchProjectDetails();
            } else {
                alert(response.data.message);
            }
        } catch (err) {
            alert('Failed to update project settings');
        } finally {
            setSubmitting(false);
        }
    };

    const handleQuickStatusUpdate = async (newStatus: string) => {
        try {
            const response = await axios.put(`${API_BASE_URL}/projects`, {
                project_id: id,
                project_name: project?.project_name,
                site_address: project?.site_address,
                start_date: project?.start_date,
                expected_end_date: project?.expected_end_date,
                project_head_id: project?.team?.find(t => t.assignment_role === 'project_head')?.user_id,
                site_engineer_id: project?.team?.find(t => t.assignment_role === 'site_engineer')?.user_id,
                status: newStatus,
                project_type: project?.project_type
            });
            if (response.data.success) {
                fetchProjectDetails();
            }
        } catch (err) {
            alert('Failed to update status');
        }
    };

    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}><Loader2 className="animate-spin" size={48} color="#253b50" /></div>;
    if (!project) return <div style={{ padding: '40px', textAlign: 'center' }}>Project not found</div>;

    const isAccountant = user?.role === 'accountant' || user?.role === 'admin';

    const transportCount = (transactions || []).filter((t: any) => t.type === 'debit' && String(t.category || '').toLowerCase() === 'transport').length;
    const laborCount = (transactions || []).filter((t: any) => t.type === 'debit' && String(t.category || '').toLowerCase() === 'labor').length;
    const miscCount = (transactions || []).filter((t: any) => t.type === 'debit' && String(t.category || '').toLowerCase() === 'miscellaneous').length;
    const reimbursementsCount = (transactions || []).filter((t: any) => t.type === 'debit' && (
        t.category === 'Reimbursements' || t.category === 'Reimbursement' || t.category === 'Other' || t.category === 'Staff Expense'
    )).length;

    const renderTabs = () => {
        const tabs = allowedTabs;

        const getTabLabel = (tab: string) => {
            switch (tab) {
                case 'overview': return 'Overview';
                case 'quote': return 'Quote';
                case 'quality_check': return 'Quality Check (QC)';
                case 'documents': return 'Documents';
                case 'timeline': return 'Designer Timeline';
                case 'pm_timeline': return 'Project Manager Timeline';
                case 'stock_category': return 'Stock Category';
                case 'vendor_quta': return 'Materials Bill';
                case 'transport': return `Transport (${transportCount})`;
                case 'labor': return `Labor (${laborCount})`;
                case 'miscellaneous': return `Miscellaneous (${miscCount})`;
                case 'reimbursements':
                case 'other_expenses': return `Reimbursements (${reimbursementsCount})`;
                case 'balance_sheet': return 'Balance Sheet';
                default: return tab.replace('_', ' ');
            }
        };

        return (
            <div
                className="tabs-container"
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: '8px 12px',
                    marginBottom: '24px',
                    padding: '4px 0'
                }}
            >
                {tabs.map((tab) => {
                    const isActive = activeTab === tab;
                    return (
                        <button
                            key={tab}
                            type="button"
                            onClick={() => handleTabChange(tab)}
                            style={{
                                padding: isActive ? '9px 20px' : '9px 14px',
                                fontSize: '0.94rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                backgroundColor: isActive ? '#0f172a' : 'transparent',
                                color: isActive ? '#ffffff' : '#1e293b',
                                border: 'none',
                                borderRadius: '8px',
                                transition: 'all 0.15s ease',
                                outline: 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                whiteSpace: 'nowrap'
                            }}
                            onMouseEnter={(e) => {
                                if (!isActive) {
                                    e.currentTarget.style.backgroundColor = '#f1f5f9';
                                    e.currentTarget.style.color = '#0f172a';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isActive) {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                    e.currentTarget.style.color = '#1e293b';
                                }
                            }}
                        >
                            {getTabLabel(tab)}
                        </button>
                    );
                })}
            </div>
        );
    };

    return (
        <div className={`project-details-page ${activeTab === 'timeline' ? 'timeline-print-mode' : ''}`}>
            <div className="no-print top-action-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <button
                    onClick={() => navigate('/projects')}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer' }}
                >
                    <ArrowLeft size={18} /> Back to Projects
                </button>
                <div style={{ display: 'flex', gap: '12px' }}>
                    {isAccountant && activeTab === 'overview' && (
                        <>
                            <button onClick={openEditModal} className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.9rem', backgroundColor: '#253b50', color: 'white' }}>
                                Edit Project
                            </button>
                            <button onClick={() => setShowPaymentModal(true)} className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.9rem' }}>
                                Add Payment
                            </button>
                        </>
                    )}
                    {activeTab === 'quote' && (
                        <button onClick={() => window.print()} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '0.9rem' }}>
                            <Printer size={18} /> Print Quote (A4)
                        </button>
                    )}
                </div>
            </div>

            <div className="no-print" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>{project.project_code}</span>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#253b50', marginTop: '4px', marginBottom: '4px' }}>{project.project_name}</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#6b7280', fontSize: '0.9rem' }}>
                        <MapPin size={14} /> {project.site_address}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {user?.role === 'admin' && (
                        <button onClick={openEditModal} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: 'white', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            Edit Project Settings
                        </button>
                    )}
                </div>
            </div>

            {/* 4 Status Badges Bar (Agreement | Dynamic Slot Lifecycle | Stage & Paid % | Sign) */}
            {(() => {
                const totalPaidCredit = (transactions || [])
                    .filter((t: any) => String(t.type || '').toLowerCase().trim() === 'credit')
                    .reduce((sum: number, t: any) => sum + parseFloat(t.amount || 0), 0);
                const totalBudgetVal = Number(project?.total_budget || 0);
                const calcPaidPct = totalBudgetVal > 0 ? (totalPaidCredit / totalBudgetVal) * 100 : 0;

                const pidStr = String(project?.project_id || id || '').toLowerCase().trim();
                const pcodeStr = String(project?.project_code || '').toLowerCase().trim();

                const isQcApproved = Boolean(
                    project?.is_final_quote_approved === 1 ||
                    project?.qc_approved === 1 ||
                    project?.status === 'qc_approved' ||
                    ['approved', 'qc_approved'].includes(String(project?.qc_status || '').toLowerCase()) ||
                    ['quality check done', 'r2p done', 'works contract done', 'production in progress', 'ready to dispatch', 'in transit', 'delivery done', 'installation stage', 'final qc', 'handover'].includes(String(project?.project_stage || '').toLowerCase())
                );

                const is20PercentPaid = calcPaidPct >= 19.9 ||
                    Boolean(project?.is_20_percent_paid) ||
                    Boolean(project?.stage2_paid) ||
                    isQcApproved ||
                    ['masking done', 'sow done', 'quality check done', 'r2p done', 'works contract done', 'production in progress', 'ready to dispatch', 'in transit', 'delivery done', 'installation stage', 'final qc', 'handover'].includes(String(project?.project_stage || '').toLowerCase()) ||
                    (pidStr && localStorage.getItem(`stage2_paid_${pidStr}`) === 'true') ||
                    (pcodeStr && localStorage.getItem(`stage2_paid_${pcodeStr}`) === 'true');

                const is10PercentPaid = is20PercentPaid || calcPaidPct >= 9.9 ||
                    Boolean(project?.is_10_percent_paid) ||
                    Boolean(project?.stage1_paid) ||
                    (pidStr && localStorage.getItem(`stage1_paid_${pidStr}`) === 'true') ||
                    (pcodeStr && localStorage.getItem(`stage1_paid_${pcodeStr}`) === 'true');

                const isStage3Paid = Boolean(
                    project?.stage3_paid === 1 ||
                    String(project?.payment_status || '').toLowerCase().includes('60%') ||
                    (pidStr && localStorage.getItem(`stage3_paid_${pidStr}`) === 'true') ||
                    (pcodeStr && localStorage.getItem(`stage3_paid_${pcodeStr}`) === 'true') ||
                    ['r2p done', 'works contract done', 'production in progress', 'ready to dispatch', 'in transit', 'delivery done', 'installation stage', 'final qc', 'handover'].includes(String(project?.project_stage || '').toLowerCase())
                );

                const mmtsSt = String(project?.mmts_status || project?.lead_info?.mmts_status || '').toLowerCase().trim();
                const hasMmtsTime = Boolean(
                    (project?.mmts_booking_time && String(project.mmts_booking_time).trim() !== '' && project.mmts_booking_time !== '0000-00-00 00:00:00') ||
                    (project?.lead_info?.mmts_booking_time && String(project.lead_info.mmts_booking_time).trim() !== '' && project.lead_info.mmts_booking_time !== '0000-00-00 00:00:00')
                );
                const isMmtsBooked = hasMmtsTime || ['booked', 'in_meeting', 'meeting_completed', 'completed', 'approved'].includes(mmtsSt);
                const isMmtsEnded = ['meeting_completed', 'completed', 'approved'].includes(mmtsSt);

                const qcSt = String(project?.qc_status || project?.lead_info?.qc_status || '').toLowerCase().trim();
                const hasQcTime = Boolean(
                    (project?.qc_booking_time && String(project.qc_booking_time).trim() !== '' && project.qc_booking_time !== '0000-00-00 00:00:00') ||
                    (project?.lead_info?.qc_booking_time && String(project.lead_info.qc_booking_time).trim() !== '' && project.lead_info.qc_booking_time !== '0000-00-00 00:00:00') ||
                    (project?.lead_info?.site_manager_booking_time && String(project.lead_info.site_manager_booking_time).trim() !== '' && project.lead_info.site_manager_booking_time !== '0000-00-00 00:00:00')
                );
                const isQcBooked = hasQcTime || ['booked', 'approved', 'qc_approved', 'in_meeting', 'completed', 'meeting_completed', 'site_manager_booked'].includes(qcSt);
                const isQcEnded = ['completed', 'approved', 'qc_approved', 'meeting_completed'].includes(qcSt) ||
                    project?.is_final_quote_approved === 1 ||
                    project?.qc_approved === 1;

                // Automatic Slot Lifecycle mapping:
                // 1. Stage 2 (20% Masking) Payment done / QC Phase:
                //    - QC inspection ended / completed / approved -> ✓ Slot Booked (green) -> redirects to QC
                //    - QC slot booked -> ✓ QC Slot Booked (green) -> redirects to QC
                //    - QC slot not booked yet -> 🔍 Book QC Slot (blue) -> redirects to QC
                // 2. Stage 1 (10% Token) Payment done / MMTS Phase:
                //    - MMTS ended & waiting for Stage 2 payment -> ✓ MMTS Done (Pay Stage 2) (sky blue) -> redirects to MMTS
                //    - MMTS slot booked -> ✓ MMTS Slot Booked (sky blue) -> redirects to MMTS
                //    - MMTS not booked yet -> 📦 Book MMTS Slot (orange) -> redirects to MMTS
                // 3. Before Stage 1 Payment (< 10% paid):
                //    - 📅 Slot Booking (amber/orange) -> redirects to MMTS
                let slotConfig = {
                    label: 'Slot Booking',
                    icon: '📅',
                    color: '#c2410c',
                    bg: '#fff7ed',
                    border: '#fed7aa',
                    target: 'mmts',
                    tooltip: 'Requires Stage 1 (10% Token) payment to book MMTS slot'
                };

                const isQcPhase = is20PercentPaid || isQcBooked || isQcEnded;

                if (isQcPhase) {
                    if (isQcEnded) {
                        slotConfig = {
                            label: 'Slot Booked',
                            icon: '✓',
                            color: '#15803d',
                            bg: '#f0fdf4',
                            border: '#22c55e',
                            target: 'qc',
                            tooltip: '✓ QC inspection completed! Click to view 🔍 QC Inspector & PM schedule history'
                        };
                    } else if (isQcBooked) {
                        slotConfig = {
                            label: 'QC Slot Booked',
                            icon: '✓',
                            color: '#16a34a',
                            bg: '#f0fdf4',
                            border: '#86efac',
                            target: 'qc',
                            tooltip: 'QC Slot Booked! Click to view 🔍 QC Inspector & PM inspection schedule'
                        };
                    } else {
                        slotConfig = {
                            label: 'Book QC Slot',
                            icon: '🔍',
                            color: '#2563eb',
                            bg: '#eff6ff',
                            border: '#93c5fd',
                            target: 'qc',
                            tooltip: 'Stage 2 Paid! Click to open schedule for 🔍 QC Inspector & PM'
                        };
                    }
                } else if (is10PercentPaid || isMmtsBooked || isMmtsEnded) {
                    if (isMmtsEnded) {
                        slotConfig = {
                            label: '✓ MMTS Done (Pay Stage 2)',
                            icon: '✓',
                            color: '#0284c7',
                            bg: '#f0f9ff',
                            border: '#7dd3fc',
                            target: 'mmts',
                            tooltip: 'MMTS meeting finished. Record Stage 2 (20%) payment to unlock QC Inspector Slot'
                        };
                    } else if (isMmtsBooked) {
                        slotConfig = {
                            label: 'MMTS Slot Booked',
                            icon: '✓',
                            color: '#0284c7',
                            bg: '#f0f9ff',
                            border: '#7dd3fc',
                            target: 'mmts',
                            tooltip: 'MMTS Slot Booked! Click to view 📦 MMTS Team & PM meeting schedule'
                        };
                    } else {
                        slotConfig = {
                            label: 'Book MMTS Slot',
                            icon: '📦',
                            color: '#ea580c',
                            bg: '#fff7ed',
                            border: '#fdba74',
                            target: 'mmts',
                            tooltip: 'Stage 1 Paid! Click to open schedule for 📦 MMTS Team & PM'
                        };
                    }
                } else {
                    slotConfig = {
                        label: 'Slot Booking',
                        icon: '📅',
                        color: '#c2410c',
                        bg: '#fff7ed',
                        border: '#fed7aa',
                        target: 'mmts',
                        tooltip: 'Requires Stage 1 (10% Token) payment to book MMTS slot'
                    };
                }

                const autoStageInfo = project ? computeProjectAutoStage(project, transactions) : null;
                const currentStage = autoStageInfo?.stage || project?.project_stage || 'Quality check done';
                const currentPaidPercent = autoStageInfo?.paidPercent ?? (project?.total_budget > 0 ? (project.total_paid / project.total_budget) * 100 : 0);
                const stageCfg = STAGE_COLORS[currentStage] || { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0' };
                const hasSignature = Boolean(project?.client_signature && String(project.client_signature).length > 20);

                return (
                    <div className="no-print" style={{
                        display: 'flex',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '12px',
                        marginBottom: '18px',
                        marginTop: '4px'
                    }}>
                        {/* 1. Agreement */}
                        <button
                            type="button"
                            onClick={() => {
                                const targetPid = project.project_id || project.project_code || id;
                                navigate(`/agreements?project_id=${encodeURIComponent(targetPid)}`);
                            }}
                            style={{
                                padding: '7px 18px',
                                borderRadius: '24px',
                                border: '1.5px solid #22c55e',
                                backgroundColor: '#f0fdf4',
                                color: '#15803d',
                                fontSize: '0.88rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                                transition: 'all 0.15s ease'
                            }}
                            title={existingAgreement ? `Agreement active (Ref: ${existingAgreement.ref_id || existingAgreement.id}) - Click to open` : "Click to view or create project agreement"}
                            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 3px 8px rgba(34,197,94,0.18)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.03)'; }}
                        >
                            <span>📜</span> Agreement
                        </button>

                        {/* 2. Slot Lifecycle Dynamic Pill (Direct Redirect to MMTS / QC schedule) */}
                        <button
                            type="button"
                            onClick={() => {
                                const targetPid = project?.lead_info?.lead_id ||
                                    project?.converted_from_lead_id ||
                                    project?.lead_id ||
                                    project?.project_code ||
                                    project?.project_id ||
                                    id;
                                if (slotConfig.target === 'qc') {
                                    navigate(`/d1-leads?lead_id=${encodeURIComponent(targetPid)}&open_qc=true`);
                                } else {
                                    navigate(`/d1-leads?lead_id=${encodeURIComponent(targetPid)}&open_mmts=true`);
                                }
                            }}
                            style={{
                                padding: '7px 18px',
                                borderRadius: '24px',
                                border: `1.5px solid ${slotConfig.border}`,
                                backgroundColor: slotConfig.bg,
                                color: slotConfig.color,
                                fontSize: '0.88rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                                transition: 'all 0.15s ease'
                            }}
                            title={slotConfig.tooltip}
                            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 3px 8px ${slotConfig.border}`; }}
                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.03)'; }}
                        >
                            <span>{slotConfig.icon}</span> {slotConfig.label}
                        </button>

                        {/* 3. Stage & Paid % */}
                        <button
                            type="button"
                            onClick={() => setShowStageModal(true)}
                            style={{
                                padding: '7px 18px',
                                borderRadius: '24px',
                                border: `1.5px solid ${stageCfg.border || '#a7f3d0'}`,
                                backgroundColor: stageCfg.bg || '#ecfdf5',
                                color: stageCfg.text || '#047857',
                                fontSize: '0.88rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                                transition: 'all 0.15s ease'
                            }}
                            title={`Stage: ${currentStage} (${currentPaidPercent.toFixed(1)}% Paid) - Click for stage breakdown`}
                            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 3px 8px rgba(4,120,87,0.18)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.03)'; }}
                        >
                            <span>💳</span> {currentStage} ({currentPaidPercent.toFixed(1)}% Paid)
                        </button>

                        {/* 4. Client Sign */}
                        <button
                            type="button"
                            onClick={() => setShowSigModal(true)}
                            style={{
                                padding: '7px 18px',
                                borderRadius: '24px',
                                border: '1.5px solid #0284c7',
                                backgroundColor: '#f0f9ff',
                                color: '#0284c7',
                                fontSize: '0.88rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                                transition: 'all 0.15s ease'
                            }}
                            title={hasSignature ? "Client signature captured - Click to view or re-sign" : "Click to capture client signature pad"}
                            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 3px 8px rgba(2,132,199,0.18)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.03)'; }}
                        >
                            <span>✒️</span> <span>✍️</span> Sign{hasSignature ? ' ✓' : ''}
                        </button>

                        {/* 5. Post-QC Client Decision Pill */}
                        {isQcApproved && !isStage3Paid && !['lost', 'withdrawn', 'cancelled'].includes(String(project?.status || '').toLowerCase()) && (
                            <button
                                type="button"
                                onClick={() => setShowPostQcDecisionModal(true)}
                                style={{
                                    padding: '7px 18px',
                                    borderRadius: '24px',
                                    border: '1.5px solid #f59e0b',
                                    backgroundColor: '#fffbeb',
                                    color: '#b45309',
                                    fontSize: '0.88rem',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                                    transition: 'all 0.15s ease'
                                }}
                                title="Quality Check verification complete! Click to view client decision (Continue or Withdraw)"
                                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 3px 8px rgba(245,158,11,0.25)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.03)'; }}
                            >
                                <span>📋</span> Client Decision (Post-QC)
                            </button>
                        )}
                    </div>
                );
            })()}

            <div className="no-print">
                {renderTabs()}
            </div>

            {activeTab === 'overview' && (
                <OverviewTab
                    project={project}
                    budget={budget}
                    quoteTotal={quoteTotal}
                    isAccountant={isAccountant}
                    setShowBudgetModal={setShowBudgetModal}
                    transactions={transactions}
                />
            )}
            {activeTab === 'quote' && (() => {
                const totalPaidCredit = (transactions || [])
                    .filter((t: any) => String(t.type || '').toLowerCase().trim() === 'credit')
                    .reduce((sum: number, t: any) => sum + parseFloat(t.amount || 0), 0);
                const totalBudgetVal = Number(project?.total_budget || 0);
                const calcPaidPct = totalBudgetVal > 0 ? (totalPaidCredit / totalBudgetVal) * 100 : 0;
                const pidStr = String(project?.project_id || id || '').toLowerCase().trim();
                const pcodeStr = String(project?.project_code || '').toLowerCase().trim();

                const isProj20Paid = calcPaidPct >= 19.9 ||
                    Boolean(project?.is_20_percent_paid) ||
                    Boolean(project?.stage2_paid) ||
                    (pidStr && (localStorage.getItem(`stage2_paid_${pidStr}`) === 'true' || localStorage.getItem(`stage2_paid_${pidStr}`) === '1')) ||
                    (pcodeStr && (localStorage.getItem(`stage2_paid_${pcodeStr}`) === 'true' || localStorage.getItem(`stage2_paid_${pcodeStr}`) === '1'));

                const projQcSt = String(project?.qc_status || project?.lead_info?.qc_status || (project as any)?.site_inspector_status || (project as any)?.site_manager_status || '').toLowerCase().trim();
                const hasProjQcTime = Boolean(
                    (project?.qc_booking_time && String(project.qc_booking_time).trim() !== '' && project.qc_booking_time !== '0000-00-00 00:00:00') ||
                    (project?.lead_info?.qc_booking_time && String(project.lead_info.qc_booking_time).trim() !== '' && project.lead_info.qc_booking_time !== '0000-00-00 00:00:00') ||
                    (project?.lead_info?.site_manager_booking_time && String(project.lead_info.site_manager_booking_time).trim() !== '' && project.lead_info.site_manager_booking_time !== '0000-00-00 00:00:00')
                );
                const isProjQcBooked = hasProjQcTime || ['booked', 'approved', 'qc_approved', 'in_meeting', 'completed', 'meeting_completed', 'site_manager_booked', 'under_review'].includes(projQcSt) ||
                    (pidStr && (localStorage.getItem(`qc_booked_${pidStr}`) === 'true' || localStorage.getItem(`qc_completed_${pidStr}`) === 'true')) ||
                    (pcodeStr && (localStorage.getItem(`qc_booked_${pcodeStr}`) === 'true' || localStorage.getItem(`qc_completed_${pcodeStr}`) === 'true'));

                return (
                    <QuoteTab
                        key={`qtab-${project?.project_id}-${project?.client_name}`}
                        project={project}
                        setQuoteTotal={(val: number) => {
                            // Draft total kept in local state; NEVER overwrite project budget or approved Balance Sheet total while editing
                            setQuoteTotal(val);
                        }}
                        isReadOnly={user?.role === 'site_engineer'}
                        user={user}
                        isUsedQuote={false}
                        isStage2Paid={isProj20Paid}
                        isQcBooked={isProjQcBooked}
                    />
                );
            })()}
            {(activeTab === 'quality_check' || activeTab === 'qc') && <QualityCheckTab projectId={project.project_id} project={project} />}
            {activeTab === 'documents' && <DocumentTab projectId={project.project_id} />}
            {activeTab === 'timeline' && <TimelineTab project={project} user={user} type="designer" fetchProjectDetails={fetchProjectDetails} totalPaid={transactions.filter((t: any) => t.type === 'credit').reduce((s: number, t: any) => s + parseFloat(t.amount || 0), 0)} />}
            {activeTab === 'pm_timeline' && <TimelineTab project={project} user={user} type="pm" fetchProjectDetails={fetchProjectDetails} totalPaid={transactions.filter((t: any) => t.type === 'credit').reduce((s: number, t: any) => s + parseFloat(t.amount || 0), 0)} />}
            {activeTab === 'stage_notes' && <StageNotesTab project={project} user={user} filterType="pm" />}
            {activeTab === 'stock_category' && <StockCategoryTab project={project} user={user} />}
            {activeTab === 'vendor_quta' && <InventoryTab key={project?.project_id} project={project} setInventoryTotal={setInventoryTotal} user={user} />}
            {activeTab === 'transport' && <ExpenseCategoryTab project={project} category="Transport" transactions={transactions} fetchTransactions={fetchTransactions} user={user} />}
            {activeTab === 'labor' && <ExpenseCategoryTab project={project} category="Labor" transactions={transactions} fetchTransactions={fetchTransactions} user={user} />}
            {activeTab === 'miscellaneous' && <ExpenseCategoryTab project={project} category="Miscellaneous" transactions={transactions} fetchTransactions={fetchTransactions} user={user} />}
            {(activeTab === 'reimbursements' || activeTab === 'other_expenses') && <ExpenseCategoryTab project={project} category="Reimbursements" transactions={transactions} fetchTransactions={fetchTransactions} user={user} />}
            {activeTab === 'balance_sheet' && (
                <BalanceSheetTab
                    project={project}
                    transactions={transactions}
                    quoteTotal={approvedQuoteTotal > 0 ? approvedQuoteTotal : (Number(project?.approved_quote_amount) || Number(project?.initial_quote_amount) || Number(project?.total_budget) || 0)}
                    approvedQuoteTotal={approvedQuoteTotal > 0 ? approvedQuoteTotal : (Number(project?.approved_quote_amount) || Number(project?.initial_quote_amount) || Number(project?.total_budget) || 0)}
                    latestQuoteTotal={quoteTotal}
                    inventoryTotal={inventoryTotal}
                    fetchTransactions={fetchTransactions}
                    user={user}
                />
            )}



            {/* Modals */}
            {/* Client Signature Modal */}
            {showSigModal && project && (
                <ClientSignatureModal
                    isOpen={showSigModal}
                    onClose={() => setShowSigModal(false)}
                    clientName={project.client_name || 'Client'}
                    projectId={project.project_id || project.project_code || id}
                    leadId={project.lead_info?.lead_id}
                    existingSignature={project.client_signature || ''}
                    onSignatureSaved={(sigDataUrl: string) => {
                        setProject((prev: any) => prev ? { ...prev, client_signature: sigDataUrl } : prev);
                        fetchProjectDetails();
                    }}
                />
            )}

            {/* QC / MMTS Slot Details Modal */}
            {showSlotModal && project && (() => {
                const isSlotBooked = Boolean(
                    (project?.qc_status && ['booked', 'approved', 'qc_approved', 'in_meeting', 'completed'].includes(String(project.qc_status).toLowerCase())) ||
                    (project?.mmts_status && ['booked', 'in_meeting', 'meeting_completed', 'completed'].includes(String(project.mmts_status).toLowerCase())) ||
                    (project?.mmts_booking_time && project.mmts_booking_time !== '0000-00-00 00:00:00') ||
                    (project?.lead_info?.qc_booking_time && project.lead_info.qc_booking_time !== '0000-00-00 00:00:00') ||
                    (project?.lead_info?.d1_booking_time && project.lead_info.d1_booking_time !== '0000-00-00 00:00:00') ||
                    (project?.lead_info?.site_manager_booking_time && project.lead_info.site_manager_booking_time !== '0000-00-00 00:00:00') ||
                    (project?.lead_info?.mmts_booking_time && project.lead_info.mmts_booking_time !== '0000-00-00 00:00:00')
                );

                return (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
                        <div className="premium-card" style={{ width: '100%', maxWidth: '460px', position: 'relative', padding: '28px', borderRadius: '16px', backgroundColor: '#ffffff', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
                            <button onClick={() => setShowSlotModal(false)} style={{ position: 'absolute', right: '18px', top: '18px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                                <X size={20} />
                            </button>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#f0f9ff', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.2rem' }}>
                                    ✓
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>QC / MMTS Slot Details</h3>
                                    <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>Inspection & verification schedule</p>
                                </div>
                            </div>

                            <div style={{ backgroundColor: '#f8fafc', borderRadius: '10px', padding: '16px', marginBottom: '20px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Booking Status:</span>
                                    <span style={{
                                        padding: '4px 12px',
                                        borderRadius: '16px',
                                        backgroundColor: isSlotBooked ? '#f0f9ff' : '#fff7ed',
                                        color: isSlotBooked ? '#0284c7' : '#c2410c',
                                        border: `1.5px solid ${isSlotBooked ? '#0284c7' : '#fed7aa'}`,
                                        fontWeight: 800,
                                        fontSize: '0.82rem'
                                    }}>
                                        {isSlotBooked ? '✓ Slot Booked' : '📅 Not Booked'}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>QC Status:</span>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', textTransform: 'capitalize' }}>
                                        {project.qc_status || 'Unassigned'}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Scheduled Time:</span>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
                                        {project.mmts_booking_time || project.lead_info?.qc_booking_time || project.lead_info?.mmts_booking_time || 'Not Scheduled'}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>QC Inspector:</span>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
                                        {project.lead_info?.site_inspector_assigned_name || 'QC Inspector'}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Project Manager:</span>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
                                        {project.lead_info?.pm_assigned_name || project.project_head_name || 'Project Manager'}
                                    </span>
                                </div>
                            </div>

                            <div style={{ marginBottom: '20px' }}>
                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '8px', textTransform: 'uppercase' }}>Update Slot Status:</div>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    <button
                                        disabled={updatingSlot}
                                        onClick={() => handleUpdateSlotStatus('booked')}
                                        style={{ flex: 1, minWidth: '90px', padding: '6px 10px', fontSize: '0.8rem', fontWeight: 700, borderRadius: '8px', border: '1px solid #0284c7', backgroundColor: '#f0f9ff', color: '#0284c7', cursor: 'pointer' }}
                                    >
                                        ✓ Booked
                                    </button>
                                    <button
                                        disabled={updatingSlot}
                                        onClick={() => handleUpdateSlotStatus('completed')}
                                        style={{ flex: 1, minWidth: '90px', padding: '6px 10px', fontSize: '0.8rem', fontWeight: 700, borderRadius: '8px', border: '1px solid #16a34a', backgroundColor: '#f0fdf4', color: '#16a34a', cursor: 'pointer' }}
                                    >
                                        ✓ Completed
                                    </button>
                                    <button
                                        disabled={updatingSlot}
                                        onClick={() => handleUpdateSlotStatus('rescheduled')}
                                        style={{ flex: 1, minWidth: '90px', padding: '6px 10px', fontSize: '0.8rem', fontWeight: 700, borderRadius: '8px', border: '1px solid #f59e0b', backgroundColor: '#fffbeb', color: '#f59e0b', cursor: 'pointer' }}
                                    >
                                        ⏳ Reschedule
                                    </button>
                                    <button
                                        disabled={updatingSlot}
                                        onClick={() => handleUpdateSlotStatus('cancelled')}
                                        style={{ flex: 1, minWidth: '90px', padding: '6px 10px', fontSize: '0.8rem', fontWeight: 700, borderRadius: '8px', border: '1px solid #ef4444', backgroundColor: '#fef2f2', color: '#ef4444', cursor: 'pointer' }}
                                    >
                                        ✕ Cancel
                                    </button>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={() => {
                                        handleTabChange('quality_check');
                                        setShowSlotModal(false);
                                    }}
                                    style={{ padding: '9px 18px', borderRadius: '8px', backgroundColor: '#0f172a', color: '#ffffff', border: 'none', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
                                >
                                    Go to Quality Check (QC) Tab →
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Project Stage & Payment Milestone Modal */}
            {showStageModal && project && (() => {
                const autoStageInfo = computeProjectAutoStage(project, transactions);
                const currentStage = autoStageInfo?.stage || project?.project_stage || 'Quality check done';
                const currentPaidPercent = autoStageInfo?.paidPercent ?? (project?.total_budget > 0 ? (project.total_paid / project.total_budget) * 100 : 0);
                const stageCfg = STAGE_COLORS[currentStage] || { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0' };

                return (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
                        <div className="premium-card" style={{ width: '100%', maxWidth: '520px', position: 'relative', padding: '28px', borderRadius: '16px', backgroundColor: '#ffffff', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
                            <button onClick={() => setShowStageModal(false)} style={{ position: 'absolute', right: '18px', top: '18px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                                <X size={20} />
                            </button>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: stageCfg.bg, color: stageCfg.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.2rem' }}>
                                    💳
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Project Stage & Payment Status</h3>
                                    <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>Milestone progress based on payments & approvals</p>
                                </div>
                            </div>

                            <div style={{ marginBottom: '18px' }}>
                                <span style={{
                                    padding: '6px 14px',
                                    borderRadius: '20px',
                                    border: `1.5px solid ${stageCfg.border || '#a7f3d0'}`,
                                    backgroundColor: stageCfg.bg || '#ecfdf5',
                                    color: stageCfg.text || '#047857',
                                    fontSize: '0.85rem',
                                    fontWeight: 800,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}>
                                    💳 {currentStage} ({currentPaidPercent.toFixed(1)}% Paid)
                                </span>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '18px' }}>
                                <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Budget</div>
                                    <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>₹{Math.round(project.total_budget || 0).toLocaleString('en-IN')}</div>
                                </div>
                                <div style={{ backgroundColor: '#f0fdf4', padding: '12px', borderRadius: '10px', border: '1px solid #bbf7d0', textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 700, textTransform: 'uppercase' }}>Paid</div>
                                    <div style={{ fontSize: '1rem', fontWeight: 800, color: '#15803d', marginTop: '2px' }}>₹{Math.round(project.total_paid || 0).toLocaleString('en-IN')}</div>
                                </div>
                                <div style={{ backgroundColor: '#fff7ed', padding: '12px', borderRadius: '10px', border: '1px solid #fed7aa', textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.72rem', color: '#c2410c', fontWeight: 700, textTransform: 'uppercase' }}>Balance</div>
                                    <div style={{ fontSize: '1rem', fontWeight: 800, color: '#c2410c', marginTop: '2px' }}>₹{Math.round(Math.max(0, (project.total_budget || 0) - (project.total_paid || 0))).toLocaleString('en-IN')}</div>
                                </div>
                            </div>

                            <div style={{ marginBottom: '20px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                                    <span>Payment Progress</span>
                                    <span>{currentPaidPercent.toFixed(1)}%</span>
                                </div>
                                <div style={{ width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{ width: `${Math.min(100, Math.max(0, currentPaidPercent))}%`, height: '100%', backgroundColor: '#10b981', borderRadius: '4px', transition: 'width 0.3s ease' }} />
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                {isAccountant && (
                                    <button
                                        onClick={() => {
                                            setShowStageModal(false);
                                            setShowPaymentModal(true);
                                        }}
                                        style={{ padding: '8px 16px', borderRadius: '8px', backgroundColor: '#10b981', color: '#ffffff', border: 'none', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
                                    >
                                        + Add Payment
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        handleTabChange('balance_sheet');
                                        setShowStageModal(false);
                                    }}
                                    style={{ padding: '8px 16px', borderRadius: '8px', backgroundColor: '#0f172a', color: '#ffffff', border: 'none', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
                                >
                                    View Balance Sheet →
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {showBudgetModal && <BudgetModal budget={budget} setBudget={setBudget} submitting={submitting} handleUpdateBudget={handleUpdateBudget} setShowBudgetModal={setShowBudgetModal} />}
            {showPaymentModal && (
                <PaymentModal
                    project={project}
                    transactions={transactions}
                    payment={payment}
                    setPayment={setPayment}
                    submitting={submitting}
                    handleRecordPayment={handleRecordPayment}
                    setShowPaymentModal={setShowPaymentModal}
                    isAdmin={isAdmin}
                />
            )}

            <PostQcDecisionModal
                isOpen={showPostQcDecisionModal}
                onClose={() => setShowPostQcDecisionModal(false)}
                projectId={project?.project_id || id}
                finalBudget={Number(project?.total_budget) || Number(budget) || 0}
                isAdmin={isAdmin}
                onContinue={() => {
                    setShowPostQcDecisionModal(false);
                    setShowPaymentModal(true);
                }}
            />

            {showEditModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="premium-card" style={{ width: '100%', maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <h3 style={{ marginBottom: '24px', fontSize: '1.4rem' }}>Edit Project Settings</h3>
                        <form onSubmit={handleUpdateProject}>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Project Name</label>
                                <input type="text" required value={editForm.project_name} onChange={(e) => setEditForm({ ...editForm, project_name: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
                            </div>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Site Address / Location</label>
                                <textarea rows={2} required value={editForm.site_address} onChange={(e) => setEditForm({ ...editForm, site_address: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Project Head</label>
                                    <select required value={editForm.project_head_id} onChange={(e) => setEditForm({ ...editForm, project_head_id: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}>
                                        <option value="">Select Head</option>
                                        {allUsers.filter(t => ['admin', 'project_head', 'admin'].includes(t.role)).map(t => (
                                            <option key={t.user_id} value={t.user_id}>{t.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Site Engineer</label>
                                    <select required value={editForm.site_engineer_id} onChange={(e) => setEditForm({ ...editForm, site_engineer_id: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}>
                                        <option value="">Select Engineer</option>
                                        {allUsers.filter(t => t.role === 'site_engineer').map(t => <option key={t.user_id} value={t.user_id}>{t.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Start Date</label>
                                    <input type="date" required value={editForm.start_date} onClick={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch (err) { } }} onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', cursor: 'pointer' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>End Date</label>
                                    <input type="date" required value={editForm.expected_end_date} onClick={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch (err) { } }} onChange={(e) => setEditForm({ ...editForm, expected_end_date: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', cursor: 'pointer' }} />
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginBottom: '24px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Project Type</label>
                                    <select required value={editForm.project_type} onChange={(e) => setEditForm({ ...editForm, project_type: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}>
                                        <option value="Furniture projects">Furniture projects</option>
                                        <option value="Interior Projects">Interior Projects</option>
                                    </select>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                <button type="button" onClick={() => setShowEditModal(false)} style={{ padding: '10px 20px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: 'white' }}>Cancel</button>
                                <button type="submit" disabled={submitting} className="btn-primary">
                                    {submitting ? 'Saving...' : 'Save Settings'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            <style>{`
                @media print {
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    @page {
                        size: A4 portrait;
                        margin: 15mm 10mm;
                    }
                    /* Force background colors */
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    /* Use visibility hack for maximum compatibility with React roots */
                    body * {
                        visibility: hidden;
                    }
                    .project-details-page, .project-details-page * {
                        visibility: visible;
                    }
                    /* Restore flow-based layout for pagination */
                    .layout-container, .main-content, .project-details-page {
                        display: block !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        position: static !important;
                        visibility: visible !important;
                        overflow: visible !important;
                    }
                    .no-print, .tabs-container {
                        display: none !important;
                    }
                    
                    .quote-container { 
                        padding: 15mm 5mm !important; 
                        width: 100% !important;
                        margin: 0 auto !important;
                        box-shadow: none !important;
                        border: none !important;
                        transform: scale(0.98);
                        transform-origin: top center;
                    }

                    .quote-table {
                        width: 95% !important;
                        margin: 10mm auto !important;
                        border-collapse: collapse !important;
                        table-layout: fixed;
                    }
                    .quote-table th, .quote-table td {
                        border: 0.5px solid #64748b !important;
                        padding: 2px 6px !important;
                        font-size: 8pt !important;
                        color: #000 !important;
                        line-height: 1.2 !important;
                    }
                    .quote-table input {
                        font-size: 8pt !important;
                        color: #000 !important;
                        height: auto !important;
                        padding:0px !important;
                        border: none !important;
                        background: transparent !important;
                    }
                    .quote-section-header {
                        background-color: #cbd5e1 !important;
                        -webkit-print-color-adjust: exact;
                    }
                    .quote-section-header td {
                        font-weight: 800 !important;
                        font-size: 8.5pt !important;
                        padding: 4px 6px !important;
                        color: #1e293b !important;
                    }
                    h1 { font-size: 14pt !important; margin-bottom: 5px !important; text-align: center; }
                    p { font-size: 9pt !important; margin-bottom: 15px !important; text-align: center; }
                    
                    tr { page-break-inside: avoid; }
                    .premium-card { page-break-inside: avoid; border: none !important; box-shadow: none !important; }

                    .timeline-container {
                        display: block !important;
                    }
                }
                
                @media (max-width: 768px) {
                    .tabs-container, .top-action-bar {
                        overflow-x: auto !important;
                        white-space: nowrap !important;
                        -webkit-overflow-scrolling: touch;
                        scrollbar-width: none; /* Firefox */
                        -ms-overflow-style: none; /* IE/Edge */
                    }
                    .tabs-container::-webkit-scrollbar, .top-action-bar::-webkit-scrollbar {
                        display: none; /* Chrome/Safari */
                    }
                    .tabs-container button, .top-action-bar button, .top-action-bar div {
                        flex-shrink: 0 !important;
                    }
                    .premium-card {
                        overflow-x: auto !important;
                        -webkit-overflow-scrolling: touch;
                    }
                    @media (max-width: 768px) {
                        .grid-3-col, .grid-6-col {
                            grid-template-columns: repeat(1, 1fr) !important;
                        }
                    }
                }
            `}</style>
        </div>
    );
};

const OverviewTab = ({ project, budget, quoteTotal, isAccountant, setShowBudgetModal, transactions = [] }: any) => {
    const displayBudget = Number(budget) || Number(project?.total_budget) || 0;
    const totalPaidCredit = (transactions || [])
        .filter((t: any) => String(t.type || '').toLowerCase().trim() === 'credit')
        .reduce((sum: number, t: any) => sum + parseFloat(t.amount || 0), 0);
    const totalPaidVal = Math.max(totalPaidCredit, Number(project?.total_paid) || 0);
    const progress = Math.round((totalPaidVal / (displayBudget || 1)) * 100);
    const remaining = Math.max(0, displayBudget - totalPaidVal);

    const isQcApproved = Boolean(
        project?.is_final_quote_approved === 1 ||
        project?.qc_approved === 1 ||
        project?.status === 'qc_approved' ||
        ['approved', 'qc_approved'].includes(String(project?.qc_status || '').toLowerCase()) ||
        ['quality check done', 'r2p done', 'works contract done', 'production in progress', 'ready to dispatch', 'in transit', 'delivery done', 'installation stage', 'final qc', 'handover'].includes(String(project?.project_stage || '').toLowerCase())
    );

    const pId = String(project?.project_id || '').toLowerCase().trim();
    const pCode = String(project?.project_code || '').toLowerCase().trim();

    const hasPassedStage2 = Boolean(
        isQcApproved ||
        project?.stage2_paid === 1 ||
        project?.stage2_paid === true ||
        project?.is_20_percent_paid === 1 ||
        project?.is_20_percent_paid === true ||
        ['masking done', 'sow done', 'quality check done', 'r2p done', 'works contract done', 'production in progress', 'ready to dispatch', 'in transit', 'delivery done', 'installation stage', 'final qc', 'handover'].includes(String(project?.project_stage || '').toLowerCase()) ||
        (pId && localStorage.getItem(`stage2_paid_${pId}`) === 'true') ||
        (pCode && localStorage.getItem(`stage2_paid_${pCode}`) === 'true') ||
        progress >= 20
    );

    const hasPassedStage1 = Boolean(
        hasPassedStage2 ||
        project?.stage1_paid === 1 ||
        project?.stage1_paid === true ||
        project?.is_10_percent_paid === 1 ||
        project?.is_10_percent_paid === true ||
        (pId && localStorage.getItem(`stage1_paid_${pId}`) === 'true') ||
        (pCode && localStorage.getItem(`stage1_paid_${pCode}`) === 'true') ||
        progress >= 10
    );

    const hasPassedStage3 = Boolean(
        project?.stage3_paid === 1 ||
        project?.stage3_paid === true ||
        String(project?.payment_status || '').toLowerCase().includes('60%') ||
        ['r2p done', 'works contract done', 'production in progress', 'ready to dispatch', 'in transit', 'delivery done', 'installation stage', 'final qc', 'handover'].includes(String(project?.project_stage || '').toLowerCase()) ||
        (pId && localStorage.getItem(`stage3_paid_${pId}`) === 'true') ||
        (pCode && localStorage.getItem(`stage3_paid_${pCode}`) === 'true') ||
        progress >= 60
    );

    const autoStageInfo = project ? computeProjectAutoStage(project, transactions) : null;
    const stageText = autoStageInfo?.stage || project?.project_stage || (isQcApproved ? 'Quality check done' : (hasPassedStage2 ? 'Masking done' : 'Order booked'));

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
            {/* LEFT COLUMN */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* 1. Client Information & Site Location Card (Row 1 from Image 1) */}
                <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                        <div>
                            <h4 style={{ color: '#64748b', fontSize: '0.78rem', fontWeight: 600, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Client Information</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700, color: '#0f172a', fontSize: '0.98rem' }}>
                                    <User size={16} color="#0f172a" /> {project.client_name || '—'}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#475569', fontSize: '0.88rem' }}>
                                    <Phone size={15} color="#64748b" /> <a href={`tel:${project.client_phone}`} style={{ color: 'inherit', textDecoration: 'none' }}>{project.client_phone || '—'}</a>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', color: '#64748b', fontSize: '0.85rem' }}>
                                    <MapPin size={15} style={{ marginTop: '2px', flexShrink: 0 }} />
                                    <span>{project.site_address || '—'}</span>
                                </div>
                                <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                    <span style={{
                                        padding: '4px 12px',
                                        borderRadius: '20px',
                                        backgroundColor: '#0f172a',
                                        color: '#ffffff',
                                        fontSize: '0.7rem',
                                        fontWeight: 800,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px'
                                    }}>
                                        {project.project_type || 'FURNITURE PROJECTS'}
                                    </span>
                                    <span style={{
                                        padding: '4px 12px',
                                        borderRadius: '20px',
                                        backgroundColor: '#f0fdf4',
                                        border: '1px solid #86efac',
                                        color: '#15803d',
                                        fontSize: '0.72rem',
                                        fontWeight: 700,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}>
                                        ✓ Stage: {stageText} ({progress.toFixed(1)}% Paid)
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h4 style={{ color: '#64748b', fontSize: '0.78rem', fontWeight: 600, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Project Site Location</h4>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', color: '#0f172a', fontWeight: 600 }}>
                                <MapPin size={16} color="#64748b" style={{ marginTop: '3px', flexShrink: 0 }} />
                                <span style={{ fontSize: '0.92rem', color: '#0f172a' }}>{project.client_address || project.site_address || '—'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Financial Overview Card (Row 2 from Image 1) */}
                <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <h3 style={{ marginBottom: '18px', fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>Financial Overview</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                        {/* Project Budget */}
                        <div style={{ padding: '18px 20px', borderRadius: '12px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', marginBottom: '8px', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Briefcase size={15} /> <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Project Budget</span>
                                </div>
                                {isAccountant && (
                                    <button onClick={() => setShowBudgetModal(true)} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                                        <Edit2 size={12} /> Edit
                                    </button>
                                )}
                            </div>
                            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a' }}>₹{displayBudget.toLocaleString('en-IN')}</div>
                        </div>

                        {/* Paid Amount */}
                        <div style={{ padding: '18px 20px', borderRadius: '12px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#166534', marginBottom: '8px' }}>
                                <CheckCircle2 size={15} /> <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Paid Amount</span>
                            </div>
                            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#15803d' }}>₹{project.total_paid.toLocaleString('en-IN')}</div>
                        </div>

                        {/* Remaining */}
                        <div style={{ padding: '18px 20px', borderRadius: '12px', backgroundColor: '#fff7ed', border: '1px solid #fed7aa' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#9a3412', marginBottom: '8px' }}>
                                <CreditCard size={15} /> <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Remaining</span>
                            </div>
                            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ea580c' }}>₹{remaining.toLocaleString('en-IN')}</div>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ marginTop: '22px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.82rem' }}>
                            <span style={{ color: '#64748b', fontWeight: 600 }}>Payment Progress</span>
                            <span style={{ fontWeight: 800, color: '#0f172a' }}>{progress}% Received</span>
                        </div>
                        <div style={{ width: '100%', height: '8px', backgroundColor: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(100, Math.max(0, progress))}%`, height: '100%', backgroundColor: '#10b981', transition: 'width 0.5s ease' }}></div>
                        </div>
                    </div>
                </div>

                {/* 3. Assigned Vendors, Labour & Contractors Card (Row 3 from Image 1) */}
                <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <div style={{ marginBottom: '16px' }}>
                        <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>Assigned Vendors, Labour &amp; Contractors</h3>
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                            Total Assigned: 0 (Labour: 0, Contractors: 0, Material Vendors: 0)
                        </p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
                        <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px 18px' }}>
                            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                                TOTAL AGREED CONTRACTS
                            </div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>₹0</div>
                        </div>

                        <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '14px 18px' }}>
                            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                                TOTAL PAYMENTS MADE
                            </div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#15803d' }}>₹0</div>
                        </div>

                        <div style={{ backgroundColor: '#fff1f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '14px 18px' }}>
                            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#9f1239', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                                TOTAL BALANCE DUE
                            </div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#dc2626' }}>₹0</div>
                        </div>
                    </div>

                    <div style={{ textAlign: 'center', padding: '24px 10px', color: '#94a3b8', fontSize: '0.84rem' }}>
                        No contracts or labour assigned yet for this project.
                    </div>
                </div>
            </div>

            {/* RIGHT COLUMN */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* 1. Assigned Team Card (Top Right from Image 1) */}
                <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <h3 style={{ marginBottom: '16px', fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>Assigned Team</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {(project.team || []).map((member: any, idx: number) => {
                            const rawRole = String(member.assignment_role || member.role || '');
                            let roleDisplay = rawRole.replace(/_/g, ' ');
                            if (/d1/i.test(rawRole)) roleDisplay = 'Lead Designer (D1)';
                            else if (/^pm$/i.test(rawRole) || /project_manager/i.test(rawRole)) roleDisplay = 'Project Manager (PM)';
                            else if (/mmt/i.test(rawRole) || /material/i.test(rawRole)) roleDisplay = 'Material Management (MMT)';
                            else if (/associate_designer/i.test(rawRole) || /designer/i.test(rawRole)) roleDisplay = 'Associate Designer';
                            else if (/sales/i.test(rawRole) || /admin/i.test(rawRole)) roleDisplay = 'Sales / Business Associate';

                            return (
                                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid #f1f5f9' }}>
                                    <div style={{ width: '38px', height: '38px', borderRadius: '50%', backgroundColor: '#0f172a', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem', flexShrink: 0 }}>
                                        {(member.name || 'U').charAt(0).toUpperCase()}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{member.name}</p>
                                        <p style={{ margin: '2px 0 0', fontSize: '0.74rem', color: '#64748b' }}>{roleDisplay}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* 2. Project Stages Card (Bottom Right from Image 1) */}
                <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <ProjectStages
                        paymentProgress={progress}
                        totalBudget={displayBudget}
                        initialBudget={Number(project?.initial_quote_amount) || displayBudget}
                        totalPaid={totalPaidVal}
                        currentStage={stageText}
                        isStage1Completed={hasPassedStage1}
                        isStage2Completed={hasPassedStage2}
                        isStage3Completed={hasPassedStage3}
                        isPmAcceptedInQc={true}
                        isQcApproved={isQcApproved}
                    />
                </div>
            </div>
        </div>
    );
};

const InventoryTab = ({ project, setInventoryTotal, user }: any) => {

    const [vendorList, setVendorList] = useState<string[]>([]);
    const [filteredVendors, setFilteredVendors] = useState<string[]>([]);
    const [activeIndex, setActiveIndex] = useState<number | null>(null);
    const [categories, setCategories] = useState<any[]>([]);
    const navigate = useNavigate();

    const printRef = useRef<HTMLDivElement>(null);

    const [invoices, setInvoices] = useState<any[]>([]);

    // 💰 GRAND TOTAL
    const grandTotal = invoices.reduce((sum, invoice) => {
        const invTotal = invoice.items.reduce((itemSum: number, it: any) => itemSum + (it.total || 0), 0);
        return sum + invTotal;
    }, 0);

    useEffect(() => {
        setInventoryTotal(grandTotal);
    }, [invoices]);

    // ✅ LOAD DATA FROM DB
    useEffect(() => {
        if (!project?.project_id) return;

        fetch(`${API_BASE_URL}/controllers/Inventoryproject.php?project_id=${project.project_id}`)
            .then(res => res.json())
            .then(data => {
                if (data.status === "success" && data.data && data.data.length > 0) {
                    const groups: Record<string, any> = {};

                    data.data.forEach((item: any) => {
                        const invNo = item.invoice_no || '';
                        const invDate = item.invoice_date || new Date().toISOString().split('T')[0];
                        const vendorName = item.vendor || '';
                        const categoryName = item.category || item.name || '';

                        // Group by invoice_no only - items with same invoice_no go together
                        // If no invoice_no, group by vendor+date combination
                        let groupKey;
                        if (invNo) {
                            groupKey = invNo;
                        } else {
                            // For items without invoice_no, group by vendor and date
                            groupKey = `${vendorName}-${invDate}`;
                        }

                        if (!groups[groupKey]) {
                            groups[groupKey] = {
                                invoice_no: invNo,
                                invoice_date: invDate,
                                vendor: vendorName,
                                category: categoryName,
                                items: []
                            };
                        }

                        groups[groupKey].items.push({
                            id: item.id,
                            category: categoryName,
                            item_name: item.item_name || '',
                            rate: Number(item.rate || 0),
                            qty: Number(item.quantity || 1),
                            discount: Number(item.discount || 0),
                            amount: Number(item.amount || 0),
                            gst: Number(item.gst || 0),
                            total: Number(item.total || 0),
                            payment_status: item.payment_status || 'Unpaid',
                            paid: Number(item.paid || 0),
                            unpaid: Number(item.unpaid || 0),
                            payment_mode: item.payment_mode || 'Cash',
                            payment_date: item.payment_date || ''
                        });
                    });

                    setInvoices(Object.values(groups));
                } else {
                    // No data found, initialize with empty invoice
                    setInvoices([{
                        invoice_no: '',
                        invoice_date: new Date().toISOString().split('T')[0],
                        vendor: '',
                        category: '',
                        items: [{
                            category: '',
                            item_name: '',
                            rate: 0,
                            qty: 1,
                            discount: 0,
                            amount: 0,
                            gst: 0,
                            total: 0,
                            payment_status: 'Unpaid',
                            paid: 0,
                            unpaid: 0,
                            payment_mode: 'Cash',
                            payment_date: ''
                        }]
                    }]);
                }
            })
            .catch(err => {
                console.error('Failed to load vendor bill data:', err);
                // On error, initialize with empty invoice
                setInvoices([{
                    invoice_no: '',
                    invoice_date: new Date().toISOString().split('T')[0],
                    vendor: '',
                    category: '',
                    items: [{
                        category: '',
                        item_name: '',
                        rate: 0,
                        qty: 1,
                        discount: 0,
                        amount: 0,
                        gst: 0,
                        total: 0,
                        payment_status: 'Unpaid',
                        paid: 0,
                        unpaid: 0,
                        payment_mode: 'Cash',
                        payment_date: ''
                    }]
                }]);
            });

    }, [project?.project_id]);

    useEffect(() => {
        if (!project?.project_id) return;

        fetch(`${API_BASE_URL}/vendors`)
            .then(res => res.json())
            .then(data => {
                if (data.status === "success") {
                    setVendorList(data.data);
                }
            })
            .catch(err => console.error("Error fetching vendors:", err));

        fetch(`${API_BASE_URL}/stock-categories?project_id=${project.project_id}`)
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setCategories(data.data);
                }
            })
            .catch(err => console.error("Error fetching categories:", err));
    }, [project?.project_id]);

    useEffect(() => {
        const handleClick = () => {
            setFilteredVendors([]);
            setActiveIndex(null);
        };

        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    // Invoice field updates
    const updateInvoiceField = (invoiceIndex: number, field: string, value: any) => {
        const updated = [...invoices];
        updated[invoiceIndex][field] = value;
        setInvoices(updated);
    };

    // Item field updates
    const updateItemField = (invoiceIndex: number, itemIndex: number, field: string, value: any) => {
        const updated = [...invoices];
        updated[invoiceIndex].items[itemIndex][field] = value;

        // recalculate row totals
        const item = updated[invoiceIndex].items[itemIndex];
        const qty = Number(item.qty || 0);
        const rate = Number(item.rate || 0);
        const discount = Number(item.discount || 0);

        const subtotal = qty * rate;
        const discountAmt = subtotal * (discount / 100);
        const amount = subtotal - discountAmt;
        const gst = amount * 0.18;
        const total = amount + gst;

        item.amount = amount;
        item.gst = gst;
        item.total = total;

        setInvoices(updated);
    };

    // ➕ ADD INVOICE
    const addInvoice = () => {
        setInvoices([
            ...invoices,
            {
                invoice_no: '',
                invoice_date: new Date().toISOString().split('T')[0],
                vendor: '',
                category: '',
                items: [
                    {
                        category: '',
                        item_name: '',
                        rate: 0,
                        qty: 1,
                        discount: 0,
                        amount: 0,
                        gst: 0,
                        total: 0,
                        payment_status: 'Unpaid',
                        paid: 0,
                        unpaid: 0,
                        payment_mode: 'Cash',
                        payment_date: ''
                    }
                ]
            }
        ]);
    };

    // ➕ ADD ITEM TO INVOICE
    const addItemToInvoice = (invoiceIndex: number) => {
        const updated = [...invoices];
        updated[invoiceIndex].items.push({
            category: '',
            item_name: '',
            rate: 0,
            qty: 1,
            discount: 0,
            amount: 0,
            gst: 0,
            total: 0,
            payment_status: 'Unpaid',
            paid: 0,
            unpaid: 0,
            payment_mode: 'Cash',
            payment_date: ''
        });
        setInvoices(updated);
    };

    // ❌ REMOVE ITEM FROM INVOICE
    const removeItemFromInvoice = (invoiceIndex: number, itemIndex: number) => {
        const updated = [...invoices];
        updated[invoiceIndex].items.splice(itemIndex, 1);
        if (updated[invoiceIndex].items.length === 0) {
            updated[invoiceIndex].items.push({
                category: '',
                item_name: '',
                rate: 0,
                qty: 1,
                discount: 0,
                amount: 0,
                gst: 0,
                total: 0,
                payment_status: 'Unpaid',
                paid: 0,
                unpaid: 0,
                payment_mode: 'Cash',
                payment_date: ''
            });
        }
        setInvoices(updated);
    };

    // ❌ REMOVE INVOICE
    const removeInvoice = (invoiceIndex: number) => {
        if (window.confirm("Are you sure you want to delete this entire Invoice and all its items?")) {
            setInvoices(invoices.filter((_, i) => i !== invoiceIndex));
        }
    };

    // 💾 SAVE TO DB
    const saveInventory = async () => {
        try {
            const flatItems = invoices.flatMap(invoice =>
                invoice.items.map((item: any) => ({
                    id: item.id,
                    invoice_no: invoice.invoice_no,
                    invoice_date: invoice.invoice_date,
                    vendor: invoice.vendor,
                    category: item.category,
                    name: item.item_name,
                    rate: item.rate,
                    qty: item.qty,
                    discount: item.discount,
                    amount: item.amount,
                    gst: item.gst,
                    total: item.total,
                    payment_status: item.payment_status,
                    paid: item.paid,
                    unpaid: item.unpaid,
                    payment_mode: item.payment_mode,
                    payment_date: item.payment_date
                }))
            );

            const res = await fetch(`${API_BASE_URL}/controllers/Inventoryproject.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    project_id: project.project_id,
                    items: flatItems
                })
            });

            const data = await res.json();

            if (data.status === "error") {
                alert(data.message);
                return;
            }

            alert('Saved Successfully 🚀');

        } catch (err) {
            console.error(err);
            alert('Error saving inventory');
        }
    };

    // 🖨️ PRINT FUNCTION
    const handlePrint = () => {
        const rows = invoices.flatMap(invoice =>
            invoice.items.map((item: any) => `
                <tr>
                    <td>${invoice.invoice_no || ''}</td>
                    <td>${invoice.invoice_date || ''}</td>
                    <td>${invoice.vendor}</td>
                    <td style="color: ${item.payment_status === 'Paid' ? '#16a34a' : '#dc2626'}; font-weight: bold;">${item.payment_status || 'Unpaid'}</td>
                    <td>${item.category || ''}</td>
                    <td>${item.item_name}</td>
                    <td>₹${Number(item.rate).toLocaleString()}</td>
                    <td>${item.qty}</td>
                    <td>${item.discount}%</td>
                    <td>₹${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td>₹${item.gst.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td>₹${item.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
            `)
        ).join("");

        const html = `
            <html>
            <head>
                <title>Inventory Report</title>
                <style>
                    body {
                        font-family: Arial;
                        padding: 30px;
                        background: #f9fafb;
                    }

                    @page {
                        size: landscape;
                        margin: 10mm;
                    }
    
                    h2 {
                        text-align: center;
                        margin-bottom: 20px;
                        color: #1e293b;
                    }
    
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        background: white;
                        border-radius: 10px;
                        overflow: hidden;
                        box-shadow: 0 4px 10px rgba(0,0,0,0.1);
                    }
    
                    th {
                        background: #1e293b;
                        color: white;
                        padding: 12px;
                        text-align: left;
                        font-size: 14px;
                    }
    
                    td {
                        padding: 10px;
                        border-bottom: 1px solid #e5e7eb;
                        font-size: 13px;
                    }
    
                    tr:nth-child(even) {
                        background: #f9fafb;
                    }
    
                    .total-box {
                        margin-top: 20px;
                        padding: 15px;
                        background: #ecfdf5;
                        border: 1px solid #bbf7d0;
                        border-radius: 8px;
                        display: flex;
                        justify-content: space-between;
                        font-weight: bold;
                        font-size: 16px;
                        color: #166534;
                    }
                </style>
            </head>
            <body>
    
                <h2>Vendor Bill Report</h2>
    
                <table>
                    <thead>
                        <tr>
                            <th>Invoice No</th>
                            <th>Date</th>
                            <th>Vendor</th>
                            <th>Status</th>
                            <th>Category</th>
                            <th>Item Name</th>
                            <th>Rate</th>
                            <th>Qty</th>
                            <th>Disc (%)</th>
                            <th>Without GST</th>
                            <th>GST (18%)</th>
                            <th>With GST</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
    
                <div class="total-box">
                    <span>Grand Total</span>
                    <span>₹${grandTotal.toLocaleString()}</span>
                </div>
    
            </body>
            </html>
        `;

        const win = window.open('', '', 'width=900,height=700');
        if (!win) return;
        win.document.write(html);
        win.document.close();
        win.print();
    };

    return (
        <div className="premium-card" ref={printRef}>

            <h3 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '24px' }}>
                Vendor Bill
            </h3>

            {/* INVOICES CONTAINER */}
            <div>
                {invoices.map((invoice, i) => {
                    const invoiceTotal = invoice.items.reduce((sum: number, it: any) => sum + (it.total || 0), 0);
                    return (
                        <div key={i} className="premium-card" style={{ padding: '24px', marginBottom: '30px', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', backgroundColor: '#ffffff' }}>
                            {/* Invoice Header Row */}
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 3fr 1.5fr auto', gap: '15px', paddingBottom: '16px', borderBottom: '2px solid #f1f5f9', marginBottom: '20px', alignItems: 'end' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Invoice No</label>
                                    <input
                                        style={inputStyle}
                                        type="text"
                                        value={invoice.invoice_no || ''}
                                        onChange={(e) => updateInvoiceField(i, 'invoice_no', e.target.value)}
                                        placeholder="e.g. INV-1002"
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Date</label>
                                    <input
                                        style={{ ...inputStyle, cursor: 'pointer' }}
                                        type="date"
                                        onClick={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch (err) { } }}
                                        value={invoice.invoice_date || ''}
                                        onChange={(e) => updateInvoiceField(i, 'invoice_date', e.target.value)}
                                    />
                                </div>
                                <div style={{ position: 'relative' }}>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Vendor</label>
                                    <input
                                        style={inputStyle}
                                        value={invoice.vendor || ''}
                                        placeholder="Type vendor / customer..."
                                        onFocus={(e) => {
                                            const value = e.target.value.trim().toLowerCase();
                                            const tableVendors = invoices.map(it => it.vendor).filter(v => v && v.trim() !== '');
                                            const combinedList = Array.from(new Set([...vendorList, ...tableVendors]));
                                            const filtered = combinedList.filter(v =>
                                                v.toLowerCase().includes(value)
                                            );
                                            setFilteredVendors(filtered.length > 0 ? filtered : combinedList);
                                            setActiveIndex(i);
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            updateInvoiceField(i, 'vendor', value);
                                            const searchTerm = value.trim().toLowerCase();
                                            const tableVendors = invoices.map(it => it.vendor).filter(v => v && v.trim() !== '');
                                            const combinedList = Array.from(new Set([...vendorList, ...tableVendors]));
                                            const filtered = combinedList.filter(v =>
                                                v.toLowerCase().includes(searchTerm)
                                            );
                                            setFilteredVendors(filtered);
                                            setActiveIndex(i);
                                        }}
                                    />
                                    {activeIndex === i && (filteredVendors.length > 0 || (invoice.vendor.trim() && !vendorList.some(v => v.toLowerCase() === invoice.vendor.trim().toLowerCase()))) && (
                                        <div
                                            onClick={(e) => e.stopPropagation()}
                                            style={{
                                                position: 'absolute',
                                                top: '100%',
                                                left: 0,
                                                width: '100%',
                                                background: '#fff',
                                                borderRadius: '8px',
                                                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                                                border: '1px solid #cbd5e1',
                                                zIndex: 1000,
                                                marginTop: '4px',
                                                maxHeight: '250px',
                                                overflowY: 'auto'
                                            }}
                                        >
                                            {filteredVendors.map((v, idx) => (
                                                <div
                                                    key={idx}
                                                    style={{
                                                        padding: '12px 15px',
                                                        cursor: 'pointer',
                                                        fontSize: '0.95rem',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '8px',
                                                        borderBottom: '1px solid #f1f5f9',
                                                        transition: 'background 0.2s',
                                                        color: '#334155'
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                                    onClick={() => {
                                                        updateInvoiceField(i, 'vendor', v);
                                                        setFilteredVendors([]);
                                                        setActiveIndex(null);
                                                    }}
                                                >
                                                    <span style={{ opacity: 0.7 }}>👤</span> {v}
                                                </div>
                                            ))}
                                            {invoice.vendor.trim() && !vendorList.some(v => v.toLowerCase() === invoice.vendor.trim().toLowerCase()) && (
                                                <div
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const newVendor = invoice.vendor.trim();
                                                        fetch(`${API_BASE_URL}/vendors`, {
                                                            method: "POST",
                                                            headers: { "Content-Type": "application/json" },
                                                            body: JSON.stringify({
                                                                vendor: newVendor,
                                                                user_id: user?.user_id || 1
                                                            })
                                                        })
                                                            .then(res => res.json())
                                                            .then(data => {
                                                                if (data.status === "success") {
                                                                    setVendorList(prev => [...prev, newVendor]);
                                                                    alert(`"${newVendor}" saved globally!`);
                                                                }
                                                            })
                                                            .catch(err => console.error(err));

                                                        setFilteredVendors([]);
                                                        setActiveIndex(null);
                                                    }}
                                                    style={{
                                                        padding: '14px 15px',
                                                        cursor: 'pointer',
                                                        fontSize: '0.9rem',
                                                        background: '#f0fdf4',
                                                        color: '#166534',
                                                        fontWeight: 700,
                                                        borderTop: '2px solid #bbf7d0',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '8px'
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#dcfce7'}
                                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f0fdf4'}
                                                >
                                                    ✨ Add to Global: "{invoice.vendor.trim()}"
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Status</label>
                                    <select
                                        style={{ ...inputStyle, padding: '8px 12px', color: invoice.items[0]?.payment_status === 'Paid' ? '#16a34a' : '#dc2626', fontWeight: 600 }}
                                        value={invoice.items[0]?.payment_status || 'Unpaid'}
                                        onChange={(e) => {
                                            const updated = [...invoices];
                                            updated[i].items.forEach((item: any) => {
                                                item.payment_status = e.target.value;
                                            });
                                            setInvoices(updated);
                                        }}
                                    >
                                        <option value="Unpaid" style={{ color: '#dc2626', fontWeight: 600 }}>Unpaid</option>
                                        <option value="Paid" style={{ color: '#16a34a', fontWeight: 600 }}>Paid</option>
                                    </select>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                    <button onClick={() => removeInvoice(i)} style={{ ...deleteBtn, background: '#fee2e2', color: '#ef4444', width: '38px', height: '38px', borderRadius: '8px', border: '1px solid #fecaca' }} title="Delete entire Invoice">
                                        ✕
                                    </button>
                                </div>
                            </div>

                            {/* Items Table */}
                            <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#ffffff' }}>
                                    <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                        <tr>
                                            <th style={{ ...th, padding: '10px 8px', width: '130px' }}>Category</th>
                                            <th style={{ ...th, padding: '10px 8px', width: '130px' }}>Item Name</th>
                                            <th style={{ ...th, padding: '10px 8px', width: '100px' }}>Rate (₹)</th>
                                            <th style={{ ...th, padding: '10px 8px', width: '60px' }}>Qty</th>
                                            <th style={{ ...th, padding: '10px 8px', width: '60px' }}>Disc (%)</th>
                                            <th style={{ ...th, padding: '10px 8px', width: '110px' }}>Without GST</th>
                                            <th style={{ ...th, padding: '10px 8px', width: '110px' }}>GST (18%)</th>
                                            <th style={{ ...th, padding: '10px 8px', width: '110px' }}>With GST</th>
                                            <th style={{ ...th, padding: '10px 8px', width: '50px' }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {invoice.items.map((item: any, j: number) => (
                                            <tr key={j} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ ...td, padding: '8px' }}>
                                                    <select
                                                        style={{ ...inputStyle, padding: '6px', cursor: 'pointer' }}
                                                        value={item.category || ''}
                                                        onChange={(e) => {
                                                            if (e.target.value === 'ADD_NEW_CATEGORY') {
                                                                const newCat = window.prompt('Enter new category name:');
                                                                if (newCat && newCat.trim()) {
                                                                    fetch(`${API_BASE_URL}/stock-categories`, {
                                                                        method: 'POST',
                                                                        headers: { 'Content-Type': 'application/json' },
                                                                        body: JSON.stringify({ project_id: project.project_id, category_name: newCat.trim() })
                                                                    })
                                                                        .then(res => res.json())
                                                                        .then(data => {
                                                                            if (data.success) {
                                                                                setCategories(prev => [...prev, { id: Date.now(), category_name: newCat.trim() }]);
                                                                                updateItemField(i, j, 'category', newCat.trim());
                                                                            } else {
                                                                                alert('Failed to add category');
                                                                            }
                                                                        })
                                                                        .catch(err => alert('Failed to add category'));
                                                                }
                                                            } else {
                                                                updateItemField(i, j, 'category', e.target.value);
                                                            }
                                                        }}
                                                    >
                                                        <option value="">Select Category...</option>
                                                        {categories.map((cat: any) => (
                                                            <option key={cat.id} value={cat.category_name}>{cat.category_name}</option>
                                                        ))}
                                                        <option value="ADD_NEW_CATEGORY" style={{ fontWeight: 'bold', color: '#2563eb' }}>+ Add New Category</option>
                                                    </select>
                                                </td>
                                                <td style={{ ...td, padding: '8px' }}>
                                                    <input
                                                        style={inputStyle}
                                                        type="text"
                                                        value={item.item_name || ''}
                                                        onChange={(e) => updateItemField(i, j, 'item_name', e.target.value)}
                                                        placeholder="Enter item name..."
                                                    />
                                                </td>
                                                <td style={{ ...td, padding: '8px' }}>
                                                    <input
                                                        style={inputStyle}
                                                        type="number"
                                                        value={item.rate || 0}
                                                        onChange={(e) => updateItemField(i, j, 'rate', e.target.value)}
                                                    />
                                                </td>
                                                <td style={{ ...td, padding: '8px' }}>
                                                    <input
                                                        style={inputStyle}
                                                        type="number"
                                                        value={item.qty || 1}
                                                        onChange={(e) => updateItemField(i, j, 'qty', e.target.value)}
                                                    />
                                                </td>
                                                <td style={{ ...td, padding: '8px' }}>
                                                    <input
                                                        style={inputStyle}
                                                        type="number"
                                                        value={item.discount || 0}
                                                        onChange={(e) => updateItemField(i, j, 'discount', e.target.value)}
                                                    />
                                                </td>
                                                <td style={{ ...td, padding: '8px', color: '#475569', fontWeight: 600 }}>
                                                    ₹{(item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td style={{ ...td, padding: '8px', color: '#64748b', fontSize: '0.85rem' }}>
                                                    ₹{(item.gst || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td style={{ ...td, padding: '8px', fontWeight: 800, color: '#16a34a', fontSize: '1rem' }}>
                                                    ₹{(item.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td style={{ ...td, padding: '8px', textAlign: 'center' }}>
                                                    <button onClick={() => removeItemFromInvoice(i, j)} style={deleteBtn} title="Remove Item">
                                                        ✕
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Invoice Footer Actions & Total */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '15px' }}>
                                <button onClick={() => addItemToInvoice(i)} style={{ ...addBtn, backgroundColor: '#10b981' }}>
                                    + Add Item
                                </button>
                                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#475569' }}>
                                    Invoice Total: <span style={{ color: '#16a34a', fontWeight: 800 }}>₹{invoiceTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* BUTTON TO ADD NEW INVOICE */}
            <div style={{ textAlign: 'center', padding: '20px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '2px dashed #cbd5e1', marginBottom: '30px' }}>
                <button onClick={addInvoice} style={{ ...addBtn, padding: '12px 24px', fontSize: '1rem', backgroundColor: '#253b50' }}>
                    + Add New Invoice
                </button>
            </div>

            {/* GRAND TOTAL */}
            <div style={totalBox}>
                <span style={{ color: '#475569', fontSize: '1.2rem' }}>Grand Total</span>
                <span style={{ fontWeight: 800, color: '#16a34a', fontSize: '1.4rem' }}>
                    ₹{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
            </div>

            {/* SAVE */}
            <button onClick={saveInventory} style={saveBtn}>
                Save Vendor Quta
            </button>

            {/* PRINT */}
            <button onClick={handlePrint} style={printBtn}>
                🖨️ Print Vendor Quta
            </button>

        </div>
    );
};









// 🎨 STYLES
const th = {
    padding: '16px 12px',
    textAlign: 'left' as const,
    fontWeight: 700,
    fontSize: '0.85rem',
    letterSpacing: '0.02em',
    textTransform: 'uppercase' as const
};

const td = {
    padding: '12px',
    borderBottom: '1px solid #f1f5f9',
    verticalAlign: 'middle' as const
};

const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    fontSize: '0.9rem',
    color: '#334155',
    backgroundColor: '#f8fafc',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    outline: 'none'
};

const deleteBtn = {
    background: '#ef4444',
    color: '#fff',
    border: 'none',
    padding: '6px 10px',
    borderRadius: '6px',
    cursor: 'pointer'
};

const addBtn = {
    background: '#253b50',
    color: '#fff',
    padding: '8px 16px',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer'
};

const totalBox = {
    marginTop: '20px',
    padding: '18px',
    background: '#f0fdf4',
    borderRadius: '10px',
    display: 'flex',
    justifyContent: 'space-between',
    border: '1px solid #bbf7d0'
};

const saveBtn = {
    width: '100%',
    marginTop: '20px',
    padding: '12px',
    background: '#253b50',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 600,
    cursor: 'pointer'
};

const printBtn = {
    marginTop: '10px',
    padding: '12px',
    background: '#16a34a',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    width: '100%',
    fontWeight: 600
};

const ExpenseCategoryTab = ({ project, category, transactions, fetchTransactions, user }: any) => {
    const displayCategory = category === 'Reimbursements' ? 'Reimbursement' : category;

    // Form fields matching new design reference
    const [name, setName] = useState('');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [amount, setAmount] = useState('');
    const [paymentStatus, setPaymentStatus] = useState<'paid' | 'unpaid'>('paid');
    const [paymentMode, setPaymentMode] = useState('Cash');
    const [approvalStatus, setApprovalStatus] = useState<'pending' | 'approved'>('pending');
    const [description, setDescription] = useState('');
    const [remarks, setRemarks] = useState('');
    const [receiptImage, setReceiptImage] = useState<string | null>(null);

    // Edit and loading state
    const [editingTransaction, setEditingTransaction] = useState<any>(null);
    const [submitting, setSubmitting] = useState(false);
    const [uploadingTxnId, setUploadingTxnId] = useState<any>(null);

    // Filter pill state: 'all' | 'paid' | 'unpaid' | 'pending_approval'
    const [filter, setFilter] = useState<'all' | 'paid' | 'unpaid' | 'pending_approval'>('all');

    // Proof preview modal
    const [viewProofImage, setViewProofImage] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Helper: compress image or read file
    const compressOrReadFile = (file: File, callback: (base64: string) => void) => {
        const reader = new FileReader();
        if (file.type.startsWith('image/')) {
            reader.onload = (e) => {
                const img = new Image();
                img.src = e.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    const MAX_WIDTH = 1200;
                    const MAX_HEIGHT = 1200;
                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height = Math.round((height * MAX_WIDTH) / width);
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width = Math.round((width * MAX_HEIGHT) / height);
                            height = MAX_HEIGHT;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, width, height);
                        ctx.drawImage(img, 0, 0, width, height);
                        callback(canvas.toDataURL('image/jpeg', 0.7));
                    } else {
                        callback(reader.result as string);
                    }
                };
            };
            reader.readAsDataURL(file);
        } else {
            reader.onload = () => {
                callback(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    // Filter all transactions for this category
    const categoryTransactions = (transactions || []).filter((t: any) => {
        if (t.type !== 'debit') return false;
        if (category === 'Reimbursements') {
            return t.category === 'Reimbursements' || t.category === 'Reimbursement' || t.category === 'Other' || t.category === 'Staff Expense';
        }
        return String(t.category || '').toLowerCase() === String(category).toLowerCase();
    });

    const isPendingTx = (t: any) => {
        const s = String(t.approval_status || '').toLowerCase();
        return s === 'pending' || s === 'pending_approval';
    };

    // Counts & Totals for Summary Cards
    const paidRecords = categoryTransactions.filter((t: any) => (t.payment_status || 'paid').toLowerCase() === 'paid');
    const unpaidRecords = categoryTransactions.filter((t: any) => (t.payment_status || '').toLowerCase() === 'unpaid');
    const pendingApprovalRecords = categoryTransactions.filter(isPendingTx);

    const paidAmountTotal = paidRecords.reduce((sum: number, t: any) => sum + parseFloat(t.amount || 0), 0);
    const unpaidAmountTotal = unpaidRecords.reduce((sum: number, t: any) => sum + parseFloat(t.amount || 0), 0);
    const totalAmountSum = categoryTransactions.reduce((sum: number, t: any) => sum + parseFloat(t.amount || 0), 0);

    const paidCount = paidRecords.length;
    const unpaidCount = unpaidRecords.length;
    const totalCount = categoryTransactions.length;
    const pendingApprovalCount = pendingApprovalRecords.length;

    // Filtered list based on active filter pill
    const displayList = categoryTransactions.filter((t: any) => {
        if (filter === 'paid') return (t.payment_status || 'paid').toLowerCase() === 'paid';
        if (filter === 'unpaid') return (t.payment_status || '').toLowerCase() === 'unpaid';
        if (filter === 'pending_approval') return isPendingTx(t);
        return true;
    });

    // Inline approval handlers for admin
    const handleApproveExpenseInline = async (transactionId: any) => {
        try {
            const res = await axios.post(`${API_BASE_URL}/finance/approve`, {
                transaction_id: transactionId,
                approved_by: user?.name || user?.username || 'Admin'
            });
            if (res.data?.success) {
                fetchTransactions();
            } else {
                alert(res.data?.message || 'Failed to approve');
            }
        } catch (err: any) {
            alert(err?.response?.data?.message || 'Failed to approve expense');
        }
    };

    const handleRejectExpenseInline = async (transactionId: any) => {
        if (!window.confirm('Are you sure you want to reject this expense?')) return;
        try {
            const res = await axios.post(`${API_BASE_URL}/finance/reject`, {
                transaction_id: transactionId,
                approved_by: user?.name || user?.username || 'Admin'
            });
            if (res.data?.success) {
                fetchTransactions();
            } else {
                alert(res.data?.message || 'Failed to reject');
            }
        } catch (err: any) {
            alert(err?.response?.data?.message || 'Failed to reject expense');
        }
    };

    // Start edit
    const startEdit = (t: any) => {
        setEditingTransaction(t);
        setName(t.person_name || '');
        setPaymentDate(t.transaction_date ? t.transaction_date.split(' ')[0] : new Date().toISOString().split('T')[0]);
        setAmount(t.amount ? t.amount.toString() : '');
        setPaymentStatus(t.payment_status === 'unpaid' ? 'unpaid' : 'paid');
        setPaymentMode(t.payment_mode || 'Cash');
        setApprovalStatus(t.approval_status === 'approved' ? 'approved' : 'pending');
        setDescription(t.description || '');
        setRemarks(t.remarks || '');
        setReceiptImage(t.receipt_image || null);
    };

    // Cancel edit
    const cancelEdit = () => {
        setEditingTransaction(null);
        setName('');
        setPaymentDate(new Date().toISOString().split('T')[0]);
        setAmount('');
        setPaymentStatus('paid');
        setPaymentMode('Cash');
        setApprovalStatus('pending');
        setDescription('');
        setRemarks('');
        setReceiptImage(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Add or update expense
    const handleAddExpense = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!amount || parseFloat(amount) <= 0) {
            alert('Please enter a valid amount');
            return;
        }
        setSubmitting(true);
        try {
            const isPrivileged = ['admin', 'owner', 'superadmin'].includes(String(user?.role || '').toLowerCase());
            // Non-admin employees ALWAYS submit as pending. Privileged users can choose, defaulting to pending for approvals workflow.
            const chosenApprovalStatus = isPrivileged ? approvalStatus : 'pending';
            const initialApprovalStatus = editingTransaction
                ? (editingTransaction.approval_status || chosenApprovalStatus)
                : chosenApprovalStatus;

            const payload: any = {
                project_id: project.project_id,
                type: 'debit',
                category: category,
                person_name: name,
                date: paymentDate,
                amount: amount,
                payment_status: paymentStatus,
                payment_mode: paymentMode,
                description: description,
                remarks: remarks,
                receipt_image: receiptImage,
                approval_status: initialApprovalStatus,
                recorded_by: user?.user_id
            };

            let response;
            if (editingTransaction) {
                payload.transaction_id = editingTransaction.transaction_id;
                response = await axios.post(`${API_BASE_URL}/finance/update`, payload);
            } else {
                response = await axios.post(`${API_BASE_URL}/finance`, payload);
            }

            if (response.data.success) {
                cancelEdit();
                fetchTransactions();
                if (!isPrivileged && !editingTransaction) {
                    alert('Expense recorded successfully! It has been submitted for Admin approval and will appear in the Balance Sheet once approved.');
                }
            } else {
                alert(response.data.message || 'Failed to save transaction');
            }
        } catch (err: any) {
            alert('Failed to record expense: ' + (err?.response?.data?.message || err?.message));
        } finally {
            setSubmitting(false);
        }
    };

    // Delete expense
    const handleDeleteExpense = async (transactionId: any) => {
        if (!window.confirm('Are you sure you want to delete this expense?')) return;
        try {
            const response = await axios.delete(`${API_BASE_URL}/finance/${transactionId}`);
            if (response.data.success) {
                fetchTransactions();
            } else {
                alert(response.data.message || 'Failed to delete transaction');
            }
        } catch (err) {
            alert('Failed to delete expense');
        }
    };

    // Upload proof for existing row
    const handleUploadProofForRow = async (transactionId: any, file: File) => {
        setUploadingTxnId(transactionId);
        compressOrReadFile(file, async (base64) => {
            try {
                await axios.put(`${API_BASE_URL}/finance`, {
                    transaction_id: transactionId,
                    receipt_image: base64
                });
                fetchTransactions();
            } catch (err) {
                alert('Failed to upload proof document');
            } finally {
                setUploadingTxnId(null);
            }
        });
    };

    // CSV Export
    const handleExportCSV = () => {
        if (categoryTransactions.length === 0) {
            alert('No data to export');
            return;
        }
        const headers = ['Date', 'Name/Vendor', 'Status', 'Approval', 'Mode', 'Description', 'Remarks', 'Amount'];
        const rows = categoryTransactions.map((t: any) => [
            t.transaction_date ? t.transaction_date.split(' ')[0] : '',
            `"${(t.person_name || '').replace(/"/g, '""')}"`,
            t.payment_status || 'paid',
            t.approval_status || 'approved',
            t.payment_mode || 'Cash',
            `"${(t.description || '').replace(/"/g, '""')}"`,
            `"${(t.remarks || '').replace(/"/g, '""')}"`,
            t.amount || 0
        ]);
        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `${displayCategory}_Expenses_${project?.project_code || 'Project'}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Header Title */}
            <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: '0 0 18px 0' }}>
                {displayCategory} Expense
            </h3>

            {/* FORM CARD (Row 1 from Reference Image) */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px 24px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <form onSubmit={handleAddExpense}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '14px', alignItems: 'flex-start' }}>
                        {/* 1. Name / Vendor */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>
                                Name / Vendor
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Enter name or select..."
                                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                            />
                        </div>

                        {/* 2. Payment Date */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>
                                Payment Date
                            </label>
                            <input
                                type="date"
                                required
                                value={paymentDate}
                                onClick={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch (err) { } }}
                                onChange={(e) => setPaymentDate(e.target.value)}
                                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box', cursor: 'pointer' }}
                            />
                        </div>

                        {/* 3. Payment Amount (₹) */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>
                                Payment Amount (₹)
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                required
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0.00"
                                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                            />
                        </div>

                        {/* 4. Payment Status */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>
                                Payment Status
                            </label>
                            <select
                                value={paymentStatus}
                                onChange={(e: any) => setPaymentStatus(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '9px 12px',
                                    borderRadius: '8px',
                                    border: paymentStatus === 'paid' ? '1.5px solid #86efac' : '1.5px solid #fca5a5',
                                    backgroundColor: paymentStatus === 'paid' ? '#f0fdf4' : '#fff1f2',
                                    color: paymentStatus === 'paid' ? '#15803d' : '#b91c1c',
                                    fontWeight: 700,
                                    fontSize: '0.82rem',
                                    boxSizing: 'border-box',
                                    cursor: 'pointer'
                                }}
                            >
                                <option value="paid">✓ Paid</option>
                                <option value="unpaid">⌛ Unpaid</option>
                            </select>
                        </div>

                        {/* 5. Payment Mode */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>
                                Payment Mode
                            </label>
                            <select
                                value={paymentMode}
                                onChange={(e) => setPaymentMode(e.target.value)}
                                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                            >
                                <option value="Cash">Cash</option>
                                <option value="Bank Transfer">Bank Transfer</option>
                                <option value="UPI">UPI</option>
                                <option value="Cheque">Cheque</option>
                            </select>
                        </div>

                        {/* 5b. Approval Status (Visible to Admin to test/manage approvals) */}
                        {['admin', 'owner', 'superadmin'].includes(String(user?.role || '').toLowerCase()) && (
                            <div>
                                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>
                                    Approval Status
                                </label>
                                <select
                                    value={approvalStatus}
                                    onChange={(e: any) => setApprovalStatus(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '9px 12px',
                                        borderRadius: '8px',
                                        border: approvalStatus === 'approved' ? '1.5px solid #86efac' : '1.5px solid #93c5fd',
                                        backgroundColor: approvalStatus === 'approved' ? '#f0fdf4' : '#eff6ff',
                                        color: approvalStatus === 'approved' ? '#15803d' : '#1d4ed8',
                                        fontWeight: 700,
                                        fontSize: '0.82rem',
                                        boxSizing: 'border-box',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <option value="pending">⏳ Pending Admin Approval</option>
                                    <option value="approved">✓ Direct Approved</option>
                                </select>
                            </div>
                        )}

                        {/* 6. Description */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>
                                Description
                            </label>
                            <textarea
                                rows={2}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                onInput={(e: any) => {
                                    e.target.style.height = 'auto';
                                    e.target.style.height = Math.max(38, e.target.scrollHeight) + 'px';
                                }}
                                placeholder="Enter details..."
                                style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    border: '1px solid #cbd5e1',
                                    fontSize: '0.82rem',
                                    boxSizing: 'border-box',
                                    fontFamily: 'inherit',
                                    resize: 'vertical',
                                    minHeight: '38px',
                                    lineHeight: '1.4'
                                }}
                            />
                        </div>

                        {/* 7. Remarks */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>
                                Remarks
                            </label>
                            <input
                                type="text"
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                                placeholder="Add remarks..."
                                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                            />
                        </div>

                        {/* 8. Receipt Proof Image */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>
                                Receipt Proof Image
                            </label>
                            <label
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    padding: '9px 12px',
                                    borderRadius: '8px',
                                    border: receiptImage ? '1.5px solid #86efac' : '1px dashed #cbd5e1',
                                    backgroundColor: receiptImage ? '#f0fdf4' : '#ffffff',
                                    color: receiptImage ? '#15803d' : '#64748b',
                                    fontSize: '0.8rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    boxSizing: 'border-box',
                                    height: '38px',
                                    whiteSpace: 'nowrap'
                                }}
                                title={receiptImage ? 'Proof file attached' : 'Click to attach proof document'}
                            >
                                <Upload size={14} />
                                {receiptImage ? '✓ Proof Attached' : 'Attach Proof'}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*,application/pdf"
                                    style={{ display: 'none' }}
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) compressOrReadFile(file, (b64) => setReceiptImage(b64));
                                    }}
                                />
                            </label>
                            {receiptImage && (
                                <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <button
                                        type="button"
                                        onClick={() => setViewProofImage(receiptImage)}
                                        style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                                    >
                                        View
                                    </button>
                                    <span style={{ color: '#cbd5e1' }}>•</span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setReceiptImage(null);
                                            if (fileInputRef.current) fileInputRef.current.value = '';
                                        }}
                                        style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                                    >
                                        Remove
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Action Button: [ Add ] */}
                    <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
                        <button
                            type="submit"
                            disabled={submitting}
                            style={{
                                backgroundColor: '#1e293b',
                                color: '#ffffff',
                                padding: '9px 30px',
                                borderRadius: '8px',
                                border: 'none',
                                fontWeight: 700,
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                            }}
                        >
                            {submitting ? 'Saving...' : (editingTransaction ? 'Update' : 'Add')}
                        </button>
                        {editingTransaction && (
                            <button
                                type="button"
                                onClick={cancelEdit}
                                style={{
                                    backgroundColor: '#f1f5f9',
                                    color: '#475569',
                                    padding: '9px 20px',
                                    borderRadius: '8px',
                                    border: '1px solid #cbd5e1',
                                    fontWeight: 600,
                                    fontSize: '0.85rem',
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                        )}
                    </div>
                </form>
            </div>

            {/* SUMMARY METRIC CARDS (Row 2 from Reference Image) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                {/* Card 1: TOTAL PAID HISTORY */}
                <div style={{ backgroundColor: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: '12px', padding: '16px 20px' }}>
                    <div style={{ color: '#166534', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                        TOTAL PAID HISTORY
                    </div>
                    <div style={{ color: '#15803d', fontSize: '1.8rem', fontWeight: 800, marginBottom: '4px' }}>
                        ₹{paidAmountTotal.toLocaleString('en-IN')}
                    </div>
                    <div style={{ color: '#166534', fontSize: '0.78rem', fontWeight: 600 }}>
                        {paidCount} Paid Records
                    </div>
                </div>

                {/* Card 2: TOTAL UNPAID HISTORY */}
                <div style={{ backgroundColor: '#fff1f2', border: '1.5px solid #fecaca', borderRadius: '12px', padding: '16px 20px' }}>
                    <div style={{ color: '#9f1239', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                        TOTAL UNPAID HISTORY
                    </div>
                    <div style={{ color: '#dc2626', fontSize: '1.8rem', fontWeight: 800, marginBottom: '4px' }}>
                        ₹{unpaidAmountTotal.toLocaleString('en-IN')}
                    </div>
                    <div style={{ color: '#9f1239', fontSize: '0.78rem', fontWeight: 600 }}>
                        {unpaidCount} Pending Records
                    </div>
                </div>

                {/* Card 3: TOTAL {CATEGORY} EXPENSES */}
                <div style={{ backgroundColor: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px' }}>
                    <div style={{ color: '#475569', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                        TOTAL {displayCategory.toUpperCase()} EXPENSES
                    </div>
                    <div style={{ color: '#0f172a', fontSize: '1.8rem', fontWeight: 800, marginBottom: '4px' }}>
                        ₹{totalAmountSum.toLocaleString('en-IN')}
                    </div>
                    <div style={{ color: '#64748b', fontSize: '0.78rem', fontWeight: 600 }}>
                        {totalCount} Total Records
                    </div>
                </div>
            </div>

            {/* ACTION & FILTER TOOLBAR (Row 3 from Reference Image) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                {/* Left Filter Pills */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                        type="button"
                        onClick={() => setFilter('all')}
                        style={{
                            padding: '6px 14px',
                            borderRadius: '8px',
                            border: filter === 'all' ? 'none' : '1px solid #e2e8f0',
                            backgroundColor: filter === 'all' ? '#0f172a' : '#ffffff',
                            color: filter === 'all' ? '#ffffff' : '#334155',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                        }}
                    >
                        All History ({totalCount})
                    </button>
                    <button
                        type="button"
                        onClick={() => setFilter('paid')}
                        style={{
                            padding: '6px 14px',
                            borderRadius: '8px',
                            border: filter === 'paid' ? 'none' : '1px solid #e2e8f0',
                            backgroundColor: filter === 'paid' ? '#0f172a' : '#ffffff',
                            color: filter === 'paid' ? '#ffffff' : '#166534',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                        }}
                    >
                        ✓ Paid History ({paidCount})
                    </button>
                    <button
                        type="button"
                        onClick={() => setFilter('unpaid')}
                        style={{
                            padding: '6px 14px',
                            borderRadius: '8px',
                            border: filter === 'unpaid' ? 'none' : '1px solid #e2e8f0',
                            backgroundColor: filter === 'unpaid' ? '#0f172a' : '#ffffff',
                            color: filter === 'unpaid' ? '#ffffff' : '#b45309',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                        }}
                    >
                        ⌛ Unpaid History ({unpaidCount})
                    </button>
                    <button
                        type="button"
                        onClick={() => setFilter('pending_approval')}
                        style={{
                            padding: '6px 14px',
                            borderRadius: '8px',
                            border: filter === 'pending_approval' ? 'none' : '1px solid #e2e8f0',
                            backgroundColor: filter === 'pending_approval' ? '#0f172a' : '#ffffff',
                            color: filter === 'pending_approval' ? '#ffffff' : '#2563eb',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                        }}
                    >
                        🛡️ Pending Approval ({pendingApprovalCount})
                    </button>
                </div>

                {/* Right Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                        type="button"
                        onClick={handleExportCSV}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '7px 14px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            backgroundColor: '#ffffff',
                            color: '#334155',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        <Download size={14} /> Export CSV
                    </button>
                    <button
                        type="button"
                        onClick={() => window.print()}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '7px 16px',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: '#0f172a',
                            color: '#ffffff',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                        }}
                    >
                        <Printer size={14} /> Print {displayCategory} Report
                    </button>
                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        Showing {displayList.length} total records
                    </span>
                </div>
            </div>

            {/* DATA TABLE (Row 4 from Reference Image) */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                            <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 800, color: '#475569', letterSpacing: '0.5px', textTransform: 'uppercase' }}>DATE</th>
                            <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 800, color: '#475569', letterSpacing: '0.5px', textTransform: 'uppercase' }}>NAME</th>
                            <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 800, color: '#475569', letterSpacing: '0.5px', textTransform: 'uppercase' }}>STATUS</th>
                            <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 800, color: '#475569', letterSpacing: '0.5px', textTransform: 'uppercase' }}>APPROVAL</th>
                            <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 800, color: '#475569', letterSpacing: '0.5px', textTransform: 'uppercase' }}>MODE</th>
                            <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 800, color: '#475569', letterSpacing: '0.5px', textTransform: 'uppercase' }}>DESCRIPTION</th>
                            <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 800, color: '#475569', letterSpacing: '0.5px', textTransform: 'uppercase' }}>REMARKS</th>
                            <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 800, color: '#475569', letterSpacing: '0.5px', textTransform: 'uppercase' }}>RECEIPT / PROOF</th>
                            <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 800, color: '#475569', letterSpacing: '0.5px', textTransform: 'uppercase', textAlign: 'right' }}>AMOUNT</th>
                            <th style={{ padding: '12px 14px', fontSize: '0.74rem', fontWeight: 800, color: '#475569', letterSpacing: '0.5px', textTransform: 'uppercase', textAlign: 'center' }}>ACTION</th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayList.length === 0 ? (
                            <tr>
                                <td colSpan={10} style={{ textAlign: 'center', padding: '48px 20px', color: '#94a3b8', fontSize: '0.9rem' }}>
                                    No expenses recorded yet.
                                </td>
                            </tr>
                        ) : (
                            displayList.map((t: any, i: number) => {
                                const isPaid = (t.payment_status || 'paid').toLowerCase() === 'paid';
                                const statusLower = String(t.approval_status || 'approved').toLowerCase();
                                const isApproved = statusLower === 'approved';
                                const isRejected = statusLower === 'rejected';
                                const isPending = statusLower === 'pending' || statusLower === 'pending_approval';
                                const isPrivileged = ['admin', 'owner', 'superadmin'].includes(String(user?.role || '').toLowerCase());
                                const hasProof = Boolean(t.receipt_image);

                                return (
                                    <tr key={t.transaction_id || i} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.15s' }}>
                                        {/* DATE */}
                                        <td style={{ padding: '14px', fontSize: '0.82rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                                            {t.transaction_date ? new Date(t.transaction_date).toLocaleDateString('en-GB') : '-'}
                                        </td>

                                        {/* NAME */}
                                        <td style={{ padding: '14px', fontSize: '0.84rem', fontWeight: 700, color: '#0f172a' }}>
                                            {t.person_name || t.name || '-'}
                                        </td>

                                        {/* STATUS */}
                                        <td style={{ padding: '14px', whiteSpace: 'nowrap' }}>
                                            {isPaid ? (
                                                <span style={{ backgroundColor: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', padding: '3px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 800 }}>
                                                    ✓ Paid
                                                </span>
                                            ) : (
                                                <span style={{ backgroundColor: '#fff1f2', color: '#dc2626', border: '1px solid #fecaca', padding: '3px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 800 }}>
                                                    ⌛ Unpaid
                                                </span>
                                            )}
                                        </td>

                                        {/* APPROVAL */}
                                        <td style={{ padding: '14px', whiteSpace: 'nowrap' }}>
                                            {isApproved ? (
                                                <div>
                                                    <span style={{ backgroundColor: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', padding: '3px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 800 }}>
                                                        ✓ Approved
                                                    </span>
                                                    {t.approved_by && (
                                                        <div style={{ fontSize: '0.68rem', color: '#166534', marginTop: '2px' }}>
                                                            by {t.approved_by}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : isRejected ? (
                                                <div>
                                                    <span style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '3px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 800 }}>
                                                        ✕ Rejected
                                                    </span>
                                                    {t.approved_by && (
                                                        <div style={{ fontSize: '0.68rem', color: '#991b1b', marginTop: '2px' }}>
                                                            by {t.approved_by}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div>
                                                    <span style={{ backgroundColor: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', padding: '3px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 800 }}>
                                                        ⏳ Pending Approval
                                                    </span>
                                                    {isPrivileged && (
                                                        <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleApproveExpenseInline(t.transaction_id)}
                                                                style={{
                                                                    backgroundColor: '#16a34a',
                                                                    color: '#ffffff',
                                                                    border: 'none',
                                                                    borderRadius: '4px',
                                                                    padding: '2px 7px',
                                                                    fontSize: '0.70rem',
                                                                    fontWeight: 700,
                                                                    cursor: 'pointer'
                                                                }}
                                                                title="Approve this expense"
                                                            >
                                                                ✓ Approve
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRejectExpenseInline(t.transaction_id)}
                                                                style={{
                                                                    backgroundColor: '#dc2626',
                                                                    color: '#ffffff',
                                                                    border: 'none',
                                                                    borderRadius: '4px',
                                                                    padding: '2px 7px',
                                                                    fontSize: '0.70rem',
                                                                    fontWeight: 700,
                                                                    cursor: 'pointer'
                                                                }}
                                                                title="Reject this expense"
                                                            >
                                                                ✕ Reject
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </td>

                                        {/* MODE */}
                                        <td style={{ padding: '14px', fontSize: '0.82rem', color: '#475569', whiteSpace: 'nowrap' }}>
                                            {t.payment_mode || 'Cash'}
                                        </td>

                                        {/* DESCRIPTION */}
                                        <td style={{ padding: '14px', fontSize: '0.82rem', color: '#334155', whiteSpace: 'pre-wrap' }}>
                                            {t.description || '-'}
                                        </td>

                                        {/* REMARKS */}
                                        <td style={{ padding: '14px', fontSize: '0.82rem', color: '#64748b' }}>
                                            {t.remarks || '-'}
                                        </td>

                                        {/* RECEIPT / PROOF */}
                                        <td style={{ padding: '14px', whiteSpace: 'nowrap' }}>
                                            {hasProof ? (
                                                <button
                                                    type="button"
                                                    onClick={() => setViewProofImage(t.receipt_image)}
                                                    style={{
                                                        backgroundColor: '#fff7ed',
                                                        color: '#ea580c',
                                                        border: '1.5px solid #fed7aa',
                                                        padding: '4px 10px',
                                                        borderRadius: '6px',
                                                        fontSize: '0.76rem',
                                                        fontWeight: 700,
                                                        cursor: 'pointer',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }}
                                                    title="View attached proof document"
                                                >
                                                    <Eye size={12} /> View Proof
                                                </button>
                                            ) : (
                                                <label
                                                    style={{
                                                        backgroundColor: '#f8fafc',
                                                        color: '#64748b',
                                                        border: '1px dashed #cbd5e1',
                                                        padding: '4px 10px',
                                                        borderRadius: '6px',
                                                        fontSize: '0.76rem',
                                                        fontWeight: 600,
                                                        cursor: 'pointer',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }}
                                                    title="Attach proof document for this row"
                                                >
                                                    {uploadingTxnId === t.transaction_id ? (
                                                        <Loader2 size={12} className="animate-spin" />
                                                    ) : (
                                                        <Upload size={12} />
                                                    )}
                                                    Attach Proof
                                                    <input
                                                        type="file"
                                                        accept="image/*,application/pdf"
                                                        style={{ display: 'none' }}
                                                        disabled={uploadingTxnId === t.transaction_id}
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (file) handleUploadProofForRow(t.transaction_id, file);
                                                        }}
                                                    />
                                                </label>
                                            )}
                                        </td>

                                        {/* AMOUNT */}
                                        <td style={{ padding: '14px', fontSize: '0.9rem', fontWeight: 800, color: '#0f172a', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                            ₹{parseFloat(t.amount || 0).toLocaleString('en-IN')}
                                        </td>

                                        {/* ACTION */}
                                        <td style={{ padding: '14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => startEdit(t)}
                                                    style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', padding: '4px', borderRadius: '4px' }}
                                                    title="Edit this record"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteExpense(t.transaction_id)}
                                                    style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: '4px', borderRadius: '4px' }}
                                                    title="Delete this record"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* PROOF PREVIEW MODAL */}
            {viewProofImage && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px' }}>
                    <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '20px', maxWidth: '800px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
                            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>Transaction Receipt / Proof</h4>
                            <button
                                onClick={() => setViewProofImage(null)}
                                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div style={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            {viewProofImage.startsWith('data:application/pdf') ? (
                                <iframe src={viewProofImage} style={{ width: '100%', height: '550px', border: 'none' }} title="Proof PDF" />
                            ) : (
                                <img src={viewProofImage} alt="Receipt Proof" style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }} />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const BalanceSheetTab = ({ project, transactions, quoteTotal = 0, approvedQuoteTotal = 0, latestQuoteTotal = 0, inventoryTotal = 0, fetchTransactions, user }: any) => {
    const [editingState, setEditingState] = useState<Record<string, { field: string; value: any }>>({});

    // The official quotation amount for the Balance Sheet is strictly the approved quote amount
    // (fixed to initial accepted amount, and ONLY changes when QC officially approves the final stage of a new version)
    const isQcApproved = Boolean(project?.is_final_quote_approved === 1 || project?.is_final_quote_approved === true || project?.status === 'qc_approved');
    const effectiveApprovedQuote = Number(
        isQcApproved && approvedQuoteTotal > 0
            ? approvedQuoteTotal
            : (Number(project?.initial_quote_amount) || (isQcApproved ? Number(project?.total_budget) : 0) || approvedQuoteTotal || Number(project?.total_budget) || 0)
    );

    // Filter to approved debit transactions only (Pending and Rejected are NEVER included in Balance Sheet totals)
    const isApprovedDebit = (t: any) => {
        if (String(t.type || '').toLowerCase().trim() !== 'debit') return false;
        const st = String(t.approval_status || '').toLowerCase().trim();
        return st === 'approved';
    };

    const transportTotal = (transactions || [])
        .filter((t: any) => isApprovedDebit(t) && String(t.category || '').toLowerCase() === 'transport')
        .reduce((sum: number, t: any) => sum + parseFloat(t.amount || 0), 0);

    const laborTotal = (transactions || [])
        .filter((t: any) => isApprovedDebit(t) && String(t.category || '').toLowerCase() === 'labor')
        .reduce((sum: number, t: any) => sum + parseFloat(t.amount || 0), 0);

    const miscTotal = (transactions || [])
        .filter((t: any) => isApprovedDebit(t) && String(t.category || '').toLowerCase() === 'miscellaneous')
        .reduce((sum: number, t: any) => sum + parseFloat(t.amount || 0), 0);

    const otherExpTotal = (transactions || [])
        .filter((t: any) => isApprovedDebit(t) && !['transport', 'labor', 'miscellaneous'].includes(String(t.category || '').toLowerCase()))
        .reduce((sum: number, t: any) => sum + parseFloat(t.amount || 0), 0);

    const totalSpent = inventoryTotal + transportTotal + laborTotal + miscTotal + otherExpTotal;
    const profitOrLoss = effectiveApprovedQuote - totalSpent;
    const remainingBalance = effectiveApprovedQuote - (project?.total_paid || 0);

    // Separate pending debits awaiting admin approval
    const pendingDebitTransactions = (transactions || []).filter((t: any) => {
        if (String(t.type || '').toLowerCase().trim() !== 'debit') return false;
        const st = String(t.approval_status || '').toLowerCase().trim();
        return st === 'pending' || st === 'pending_approval' || st === '';
    });
    const pendingDebitAmount = pendingDebitTransactions.reduce((sum: number, t: any) => sum + parseFloat(t.amount || 0), 0);

    // Only approved debits and all credit transactions appear in the balance sheet list
    const balanceSheetTransactions = (transactions || []).filter((t: any) => {
        if (String(t.type || '').toLowerCase().trim() === 'credit') return true;
        const st = String(t.approval_status || '').toLowerCase().trim();
        return st === 'approved';
    });

    const isArchitectural = project?.project_type === 'Furniture projects';

    const startEditing = (transactionId: string, field: string, currentValue: any) => {
        setEditingState(prev => ({
            ...prev,
            [transactionId]: { field, value: currentValue }
        }));
    };

    const cancelEditing = (transactionId: string) => {
        setEditingState(prev => {
            const newState = { ...prev };
            delete newState[transactionId];
            return newState;
        });
    };

    const updateEditingValue = (transactionId: string, value: any) => {
        setEditingState(prev => ({
            ...prev,
            [transactionId]: { ...prev[transactionId], value }
        }));
    };

    const handleSave = async (transactionId: string) => {
        const editing = editingState[transactionId];
        if (!editing) return;

        try {
            const updateData: any = { transaction_id: transactionId };
            if (editing.field === 'payment_mode') updateData.payment_mode = editing.value;
            if (editing.field === 'transaction_date') updateData.transaction_date = editing.value;
            if (editing.field === 'description') updateData.description = editing.value;
            if (editing.field === 'category') updateData.category = editing.value;
            if (editing.field === 'amount') updateData.amount = editing.value;

            const response = await axios.put(`${API_BASE_URL}/finance`, updateData);
            console.log('Update response:', response.data);

            if (response.data.success) {
                cancelEditing(transactionId);
                if (fetchTransactions) fetchTransactions();
            } else {
                alert('Failed to update transaction: ' + (response.data.message || 'Unknown error'));
            }
        } catch (error: any) {
            console.error('Failed to update:', error);
            alert('Failed to update transaction: ' + (error?.response?.data?.message || error.message || 'Unknown error'));
        }
    };

    const handleDelete = async (transactionId: string) => {
        if (!confirm('Are you sure you want to delete this transaction?')) return;

        try {
            const response = await axios.delete(`${API_BASE_URL}/finance/${transactionId}`);
            console.log('Delete response:', response.data);

            if (response.data.success) {
                if (fetchTransactions) fetchTransactions();
            } else {
                alert('Failed to delete transaction: ' + (response.data.message || 'Unknown error'));
            }
        } catch (error: any) {
            console.error('Failed to delete:', error);
            alert('Failed to delete transaction: ' + (error?.response?.data?.message || error.message || 'Unknown error'));
        }
    };

    return (
        <div className="balance-sheet">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#253b50' }}>Financial Statement</h2>
                    <button
                        onClick={() => {
                            window.location.reload();
                        }}
                        style={{ padding: '6px 12px', fontSize: '0.75rem', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', color: '#475569', fontWeight: 600 }}
                    >
                        🔄 Sync Financials
                    </button>
                </div>
                <div style={{ padding: '8px 16px', backgroundColor: profitOrLoss >= 0 ? '#f0fdf4' : '#fef2f2', borderRadius: '20px', color: profitOrLoss >= 0 ? '#166534' : '#991b1b', fontWeight: 700, fontSize: '0.9rem' }}>
                    Status: {profitOrLoss >= 0 ? 'Healthy' : 'Over Budget'}
                </div>
            </div>

            {/* ROW 1: BUDGET, PAID, REMAINING (3 COLUMNS) */}
            <div className="grid-3-col" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '20px',
                marginBottom: '30px'
            }}>
                <div className="premium-card" style={{ borderLeft: '5px solid #253b50', padding: '24px', backgroundColor: '#f8fafc' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '6px' }}>
                        <p style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase' }}>Total Project Budget</p>
                        <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '4px', backgroundColor: project?.is_final_quote_approved ? '#dcfce7' : '#f1f5f9', color: project?.is_final_quote_approved ? '#166534' : '#475569', fontWeight: 700 }}>
                            {project?.is_final_quote_approved ? '✓ QC Final Approved' : '🔒 Initial Approved Quote'}
                        </span>
                    </div>
                    <h3 style={{ fontWeight: 800, color: '#253b50', fontSize: '1.8rem', margin: '4px 0 0 0' }}>
                        ₹{effectiveApprovedQuote.toLocaleString()}
                    </h3>
                    {latestQuoteTotal > 0 && Math.abs(latestQuoteTotal - effectiveApprovedQuote) > 1 && (
                        <p style={{ margin: '8px 0 0 0', fontSize: '0.74rem', color: '#b45309', fontWeight: 600 }}>
                            ⏳ Revision in progress: ₹{latestQuoteTotal.toLocaleString()} (Pending QC Final Approval)
                        </p>
                    )}
                </div>

                <div className="premium-card" style={{ borderLeft: '5px solid #10b981', padding: '24px', backgroundColor: '#f0fdf4' }}>
                    <p style={{ color: '#059669', fontSize: '0.85rem', fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase' }}>Advance Paid</p>
                    <h3 style={{ fontWeight: 800, color: '#059669', fontSize: '1.8rem' }}>
                        ₹{project.total_paid.toLocaleString()}
                    </h3>
                </div>

                <div className="premium-card" style={{ borderLeft: '5px solid #ef4444', padding: '24px', backgroundColor: '#fef2f2' }}>
                    <p style={{ color: '#dc2626', fontSize: '0.85rem', fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase' }}>Remaining Amount</p>
                    <h3 style={{ fontWeight: 800, color: '#dc2626', fontSize: '1.8rem' }}>
                        ₹{remainingBalance.toLocaleString()}
                    </h3>
                </div>
            </div>
            <div className="grid-6-col" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '12px',
                marginBottom: '20px'
            }}>
                {/* 1. PROJECT QUOTE */}
                <div className="premium-card" style={{ padding: '16px', textAlign: 'center', border: '1px solid #cbd5e1', backgroundColor: '#ffffff' }}>
                    <p style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase' }}>Project Quote</p>
                    <h4 style={{ fontWeight: 800, color: '#1e293b', fontSize: '1.2rem', margin: 0 }}>
                        ₹{effectiveApprovedQuote.toLocaleString()}
                    </h4>
                    <span style={{ fontSize: '0.68rem', color: project?.is_final_quote_approved ? '#166534' : '#64748b', display: 'block', marginTop: '4px', fontWeight: 600 }}>
                        {project?.is_final_quote_approved ? 'QC Final Approved' : 'Fixed Initial Quote'}
                    </span>
                </div>

                {/* 2. VENDOR BILL */}
                <div className="premium-card" style={{ padding: '16px', textAlign: 'center', border: '1px solid #cbd5e1', backgroundColor: '#ffffff' }}>
                    <p style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase' }}>Vendor Bill</p>
                    <h4 style={{ fontWeight: 800, color: '#1e293b', fontSize: '1.2rem', margin: 0 }}>
                        ₹{inventoryTotal.toLocaleString()}
                    </h4>
                </div>

                {/* 3. TRANSPORT */}
                <div className="premium-card" style={{ padding: '16px', textAlign: 'center', border: '1px solid #cbd5e1', backgroundColor: '#ffffff' }}>
                    <p style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase' }}>Transport</p>
                    <h4 style={{ fontWeight: 800, color: '#1e293b', fontSize: '1.2rem', margin: 0 }}>
                        ₹{transportTotal.toLocaleString()}
                    </h4>
                </div>

                {/* 4. LABOR */}
                <div className="premium-card" style={{ padding: '16px', textAlign: 'center', border: '1px solid #cbd5e1', backgroundColor: '#ffffff' }}>
                    <p style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase' }}>Labor</p>
                    <h4 style={{ fontWeight: 800, color: '#1e293b', fontSize: '1.2rem', margin: 0 }}>
                        ₹{laborTotal.toLocaleString()}
                    </h4>
                </div>

                {/* 5. MISCELLANEOUS */}
                <div className="premium-card" style={{ padding: '16px', textAlign: 'center', border: '1px solid #cbd5e1', backgroundColor: '#ffffff' }}>
                    <p style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase' }}>Misc</p>
                    <h4 style={{ fontWeight: 800, color: '#1e293b', fontSize: '1.2rem', margin: 0 }}>
                        ₹{miscTotal.toLocaleString()}
                    </h4>
                </div>

                {/* 6. OTHER EXPENSES (REIMBURSEMENTS & CUSTOM) */}
                <div className="premium-card" style={{ padding: '16px', textAlign: 'center', border: '1px solid #cbd5e1', backgroundColor: '#ffffff' }}>
                    <p style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase' }}>Other Exp</p>
                    <h4 style={{ fontWeight: 800, color: '#1e293b', fontSize: '1.2rem', margin: 0 }}>
                        ₹{otherExpTotal.toLocaleString()}
                    </h4>
                </div>

                {/* 7. TOTAL SPENT */}
                <div className="premium-card" style={{ padding: '16px', textAlign: 'center', border: '2px solid #253b50', backgroundColor: '#f8fafc' }}>
                    <p style={{ color: '#253b50', fontSize: '0.75rem', fontWeight: 800, marginBottom: '6px', textTransform: 'uppercase' }}>Total Spent</p>
                    <h4 style={{ fontWeight: 800, color: '#253b50', fontSize: '1.2rem', margin: 0 }}>
                        ₹{totalSpent.toLocaleString()}
                    </h4>
                </div>
            </div>

            {/* ROW 3: PROFIT CARD */}
            <div style={{ marginBottom: '35px', display: 'flex', justifyContent: 'flex-start' }}>
                <div className="premium-card" style={{ padding: '20px 24px', textAlign: 'center', border: '2px solid #059669', backgroundColor: '#f0fdf4', minWidth: '280px' }}>
                    <p style={{ color: '#059669', fontSize: '0.85rem', fontWeight: 800, marginBottom: '8px', textTransform: 'uppercase' }}>Profit (Project Budget - Total Spent)</p>
                    <h3 style={{ fontWeight: 900, color: profitOrLoss >= 0 ? '#059669' : '#dc2626', fontSize: '2rem', margin: 0 }}>
                        ₹{profitOrLoss.toLocaleString()}
                    </h3>
                </div>
            </div>
            {/* PENDING APPROVAL NOTICE BANNER */}
            {pendingDebitTransactions.length > 0 && (
                <div style={{
                    backgroundColor: '#fffbeb',
                    border: '1.5px solid #fde68a',
                    borderRadius: '10px',
                    padding: '14px 18px',
                    marginBottom: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.3rem' }}>⏳</span>
                        <div>
                            <div style={{ fontWeight: 800, color: '#92400e', fontSize: '0.9rem' }}>
                                {pendingDebitTransactions.length} Expense(s) Pending Admin Approval (Total: ₹{pendingDebitAmount.toLocaleString('en-IN')})
                            </div>
                            <div style={{ color: '#b45309', fontSize: '0.80rem', marginTop: '2px' }}>
                                Awaiting Admin Approval. These are excluded from Balance Sheet and Total Spent until approved.
                            </div>
                        </div>
                    </div>
                    <span style={{
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        backgroundColor: '#fef3c7',
                        color: '#92400e',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        border: '1px solid #fde68a'
                    }}>
                        Pending Admin Approval
                    </span>
                </div>
            )}

            {/* TRANSACTIONS LIST */}
            <div className="premium-card" style={{ padding: '30px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1e293b' }}>Payment & Expense Log ({balanceSheetTransactions.length} Approved)</h3>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <span style={{ fontSize: '0.85rem', color: '#6b7280' }}><span style={{ color: '#10b981', fontWeight: 900 }}>●</span> Credit (Paid)</span>
                        <span style={{ fontSize: '0.85rem', color: '#6b7280' }}><span style={{ color: '#ef4444', fontWeight: 900 }}>●</span> Debit (Expense)</span>
                    </div>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                            <th style={{ ...th, color: '#475569' }}>Date</th>
                            <th style={{ ...th, color: '#475569' }}>Description</th>
                            <th style={{ ...th, color: '#475569' }}>Category</th>
                            <th style={{ ...th, color: '#475569' }}>Mode</th>
                            <th style={{ ...th, color: '#475569', textAlign: 'right' }}>Amount</th>
                            <th style={{ ...th, color: '#475569', textAlign: 'center' }}>Actions</th>
                        </tr>
                    </thead>

                    <tbody>
                        {balanceSheetTransactions.length > 0 ? (
                            balanceSheetTransactions.map((tr: any) => {
                                const editing = editingState[tr.transaction_id];
                                const isEditingDate = editing?.field === 'transaction_date';
                                const isEditingDescription = editing?.field === 'description';
                                const isEditingCategory = editing?.field === 'category';
                                const isEditingPaymentMode = editing?.field === 'payment_mode';
                                const isEditingAmount = editing?.field === 'amount';

                                return (
                                    <tr key={tr.transaction_id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }}>
                                        <td style={td}>
                                            {isEditingDate ? (
                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                    <input
                                                        type="date"
                                                        value={editing?.value || ''}
                                                        onClick={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch (err) { } }}
                                                        onChange={(e) => updateEditingValue(tr.transaction_id, e.target.value)}
                                                        style={{ padding: '4px', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '0.85rem', cursor: 'pointer' }}
                                                    />
                                                    <button
                                                        onClick={() => handleSave(tr.transaction_id)}
                                                        style={{ padding: '4px 8px', background: '#059669', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                                                    >✓</button>
                                                    <button
                                                        onClick={() => cancelEditing(tr.transaction_id)}
                                                        style={{ padding: '4px 8px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                                                    >✗</button>
                                                </div>
                                            ) : (
                                                <span
                                                    onClick={() => startEditing(tr.transaction_id, 'transaction_date', tr.transaction_date || '')}
                                                    style={{ cursor: 'pointer', textDecoration: 'underline' }}
                                                >
                                                    {new Date(tr.transaction_date).toLocaleDateString()}
                                                </span>
                                            )}
                                        </td>
                                        <td style={td}>
                                            {isEditingDescription ? (
                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                    <input
                                                        type="text"
                                                        value={editing?.value || ''}
                                                        onChange={(e) => updateEditingValue(tr.transaction_id, e.target.value)}
                                                        style={{ padding: '4px', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '0.85rem', width: '200px' }}
                                                    />
                                                    <button
                                                        onClick={() => handleSave(tr.transaction_id)}
                                                        style={{ padding: '4px 8px', background: '#059669', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                                                    >✓</button>
                                                    <button
                                                        onClick={() => cancelEditing(tr.transaction_id)}
                                                        style={{ padding: '4px 8px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                                                    >✗</button>
                                                </div>
                                            ) : (
                                                <span
                                                    onClick={() => startEditing(tr.transaction_id, 'description', tr.description || '')}
                                                    style={{ cursor: 'pointer', textDecoration: 'underline' }}
                                                >
                                                    {tr.description}
                                                </span>
                                            )}
                                        </td>
                                        <td style={td}>
                                            {isEditingCategory ? (
                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                    <input
                                                        type="text"
                                                        value={editing?.value || ''}
                                                        onChange={(e) => updateEditingValue(tr.transaction_id, e.target.value)}
                                                        style={{ padding: '4px', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '0.85rem', width: '120px' }}
                                                    />
                                                    <button
                                                        onClick={() => handleSave(tr.transaction_id)}
                                                        style={{ padding: '4px 8px', background: '#059669', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                                                    >✓</button>
                                                    <button
                                                        onClick={() => cancelEditing(tr.transaction_id)}
                                                        style={{ padding: '4px 8px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                                                    >✗</button>
                                                </div>
                                            ) : (
                                                <span
                                                    onClick={() => startEditing(tr.transaction_id, 'category', tr.category || 'Payment')}
                                                    style={{ cursor: 'pointer', textDecoration: 'underline', padding: '4px 10px', backgroundColor: '#f1f5f9', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}
                                                >
                                                    {tr.category || 'Payment'}
                                                </span>
                                            )}
                                        </td>
                                        <td style={td}>
                                            {isEditingPaymentMode ? (
                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                    <select
                                                        value={editing?.value || 'Cash'}
                                                        onChange={(e) => updateEditingValue(tr.transaction_id, e.target.value)}
                                                        style={{ padding: '4px', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '0.85rem', width: '120px' }}
                                                    >
                                                        <option value="Cash">Cash</option>
                                                        <option value="Bank Transfer">Bank Transfer</option>
                                                        <option value="UPI">UPI</option>
                                                        <option value="Cheque">Cheque</option>
                                                    </select>
                                                    <button
                                                        onClick={() => handleSave(tr.transaction_id)}
                                                        style={{ padding: '4px 8px', background: '#059669', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                                                    >✓</button>
                                                    <button
                                                        onClick={() => cancelEditing(tr.transaction_id)}
                                                        style={{ padding: '4px 8px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                                                    >✗</button>
                                                </div>
                                            ) : (
                                                <span
                                                    onClick={() => startEditing(tr.transaction_id, 'payment_mode', tr.payment_mode || 'Cash')}
                                                    style={{ cursor: 'pointer', textDecoration: 'underline', padding: '4px 10px', backgroundColor: '#f1f5f9', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}
                                                >
                                                    {tr.payment_mode || 'Cash'}
                                                </span>
                                            )}
                                        </td>
                                        <td style={{
                                            ...td,
                                            fontWeight: 800,
                                            textAlign: 'right',
                                            color: tr.type === 'credit' ? '#10b981' : '#ef4444'
                                        }}>
                                            {isEditingAmount ? (
                                                <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                                                    <input
                                                        type="number"
                                                        value={editing?.value || 0}
                                                        onChange={(e) => updateEditingValue(tr.transaction_id, parseFloat(e.target.value))}
                                                        style={{ padding: '4px', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '0.85rem', width: '120px', textAlign: 'right' }}
                                                    />
                                                    <button
                                                        onClick={() => handleSave(tr.transaction_id)}
                                                        style={{ padding: '4px 8px', background: '#059669', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                                                    >✓</button>
                                                    <button
                                                        onClick={() => cancelEditing(tr.transaction_id)}
                                                        style={{ padding: '4px 8px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                                                    >✗</button>
                                                </div>
                                            ) : (
                                                <span
                                                    onClick={() => startEditing(tr.transaction_id, 'amount', parseFloat(tr.amount || 0))}
                                                    style={{ cursor: 'pointer', textDecoration: 'underline' }}
                                                >
                                                    {tr.type === 'credit' ? '+' : '-'} ₹{parseFloat(tr.amount).toLocaleString()}
                                                </span>
                                            )}
                                        </td>
                                        <td style={{ ...td, textAlign: 'center' }}>
                                            <button
                                                onClick={() => handleDelete(tr.transaction_id)}
                                                style={{ padding: '6px 12px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', margin: '0 auto' }}
                                                title="Delete transaction"
                                            >
                                                <Trash2 size={14} /> Delete
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No transactions recorded yet.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

        </div>
    );
};

const UNIT_OPTIONS = [
    'Pieces (pcs)', 'Nos', 'Sets', 'Pairs',
    'Square Feet (sqft)', 'Running Feet (rft)', 'Square Meters (sqm)',
    'Meters (m)', 'Centimeters (cm)',
    'Kilograms (kg)', 'Grams (g)', 'Tons',
    'Liters (ltr)', 'Milliliters (ml)',
    'Bags', 'Boxes', 'Rolls', 'Sheets', 'Bundles',
];

/* ─── Stock Category Tab (data from Vendor Bill) ──────────────── */
const StockCategoryTab = ({ project, user }: any) => {
    const [allItems, setAllItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterVendor, setFilterVendor] = useState('');
    const [allProjects, setAllProjects] = useState<any[]>([]);
    const [transferringItem, setTransferringItem] = useState<any>(null);
    const [transferData, setTransferData] = useState({ target_project_id: '', qty: 0 });

    const fetchItems = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/controllers/Inventoryproject.php?project_id=${project.project_id}`);
            const data = await res.json();
            if (data.status === 'success' && data.data.length > 0) {
                const flat = data.data.map((item: any) => ({
                    id: item.id,
                    name: item.item_name || '',
                    vendor: item.vendor || '',
                    category: item.category || item.name || '',
                    rate: Number(item.rate || 0),
                    qty: Number(item.quantity || 1),
                    total: Number(item.total || 0),
                    status: item.stock_status || 'pending',
                    transfer_qty: Number(item.transfer_qty || 0),
                    invoice_no: item.invoice_no || '',
                    quantity_used: Number(item.quantity_used || 0),
                    is_checked: item.is_checked || false,
                }));
                setAllItems(flat);
            } else {
                setAllItems([]);
            }
        } catch (err) {
            console.error('Failed to fetch vendor bill items:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchAllProjects = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/projects`);
            if (res.data.success) {
                setAllProjects(res.data.data.filter((p: any) => String(p.project_id) !== String(project.project_id)));
            }
        } catch { console.error('Failed to fetch projects'); }
    };

    useEffect(() => {
        fetchItems();
        fetchAllProjects();
    }, [project.project_id]);

    const handleMLivincartReceived = async (item: any) => {
        try {
            const res = await fetch(`${API_BASE_URL}/inventory`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: item.id, stock_status: 'received', transfer_qty: 0 })
            });
            const data = await res.json();
            console.log('MLivincart received response:', data);
            if (data.status === 'success') { fetchItems(); }
            else { alert(data.message || 'Failed to update status'); }
        } catch (error) {
            console.error('MLivincart received error:', error);
            alert('Failed to mLivincart as received');
        }
    };

    const handleTransfer = async () => {
        const availableQty = transferringItem.qty - transferringItem.quantity_used;
        if (!transferData.target_project_id || transferData.qty <= 0 || transferData.qty > availableQty) {
            alert(`Please enter a valid quantity within available limits (Max: ${availableQty}).`);
            return;
        }
        try {
            const res = await fetch(`${API_BASE_URL}/controllers/Inventoryproject.php`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: transferringItem.id,
                    stock_status: 'transferred',
                    transfer_qty: transferData.qty,
                    target_project_id: transferData.target_project_id
                })
            });
            const data = await res.json();
            if (data.status === 'success') {
                alert('Transfer successful!');
                setTransferringItem(null);
                setTransferData({ target_project_id: '', qty: 0 });
                fetchItems();
            } else { alert(data.message || 'Transfer failed'); }
        } catch (err) {
            console.error('Transfer error:', err);
            alert('Transfer failed');
        }
    };

    const handleSaveUsage = async (item: any) => {
        try {
            console.log('Saving usage for item:', item);
            const res = await fetch(`${API_BASE_URL}/inventory`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: item.id,
                    quantity_used: item.quantity_used
                })
            });
            const data = await res.json();
            console.log('Save usage response:', data);
            if (data.status === 'success') {
                alert('Usage saved successfully!');
                fetchItems();
            } else {
                alert(data.message || 'Failed to save usage');
            }
        } catch (err) {
            console.error('Save usage error:', err);
            alert('Failed to save usage');
        }
    };

    const isAdmin = ['admin', 'admin', 'accountant'].includes(user?.role);
    const isEngineer = user?.role === 'site_engineer';
    const vendors = [...new Set(allItems.map(i => i.vendor).filter(Boolean))];
    const filtered = filterVendor ? allItems.filter(i => i.vendor === filterVendor) : allItems;
    const stockItems = filtered.filter(i => i.qty > 0 && i.status !== 'transferred');
    const transferItems = filtered.filter(i => i.transfer_qty > 0 || i.status === 'transferred');
    const stockTotal = stockItems.filter(i => i.status === 'received').reduce((s, i) => s + i.total, 0);
    const transferTotal = transferItems.reduce((s, i) => s + (i.transfer_qty * i.rate), 0);

    const thS: React.CSSProperties = { padding: '12px 14px', textAlign: 'left', color: '#475569', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', backgroundColor: '#f8fafc' };
    const tdS: React.CSSProperties = { padding: '13px 14px', fontSize: '0.85rem', color: '#374151' };

    const renderTable = (data: any[], title: string) => (
        <div className="premium-card" style={{ padding: '24px', marginBottom: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#253b50' }}>{title}</h3>
                    {title === 'Stock Items' && (
                        <p style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 600, marginTop: '2px' }}>
                            Balance Sheet: +₹{stockTotal.toLocaleString()} added to Vendor
                        </p>
                    )}
                    {title === 'Transferred Stock' && (
                        <p style={{ fontSize: '0.78rem', color: '#ef4444', fontWeight: 600, marginTop: '2px' }}>
                            Balance Sheet: −₹{transferTotal.toLocaleString()} reduced from Vendor
                        </p>
                    )}
                </div>
                {title === 'Stock Items' && vendors.length > 0 && (
                    <select value={filterVendor} onChange={(e) => setFilterVendor(e.target.value)}
                        style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}>
                        <option value="">All Vendors</option>
                        {vendors.map((v, i) => <option key={i} value={v}>{v}</option>)}
                    </select>
                )}
            </div>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                            <th style={thS}>#</th>
                            <th style={thS}>Item Name</th>
                            <th style={thS}>Vendor</th>
                            <th style={thS}>Category</th>
                            <th style={thS}>Rate (₹)</th>
                            <th style={thS}>Qty</th>
                            <th style={thS}>Total (₹)</th>
                            {title === 'Stock Items' && <th style={thS}>Used</th>}
                            {title === 'Stock Items' && <th style={thS}>Used (₹)</th>}
                            {title === 'Stock Items' && <th style={thS}>Rem.</th>}
                            {title === 'Stock Items' && <th style={thS}>Rem. (₹)</th>}
                            {title === 'Transferred Stock' && <th style={thS}>Transfer Qty</th>}
                            {title === 'Transferred Stock' && <th style={thS}>Transfer Amt (₹)</th>}
                            <th style={{ ...thS, textAlign: 'center' }}>Status</th>
                            <th style={{ ...thS, textAlign: 'center' }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={title === 'Stock Items' ? 14 : 10} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>Loading from Vendor Bill...</td></tr>
                        ) : data.length === 0 ? (
                            <tr><td colSpan={title === 'Stock Items' ? 14 : 10} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>No items found. Add items in the Vendor Bill tab first.</td></tr>
                        ) : data.map((item, idx) => {
                            const transferAmt = item.transfer_qty * item.rate;
                            const qty = parseFloat(item.qty || 0);
                            const used = parseFloat(item.quantity_used || 0);
                            const rem = qty - used;
                            const usedVal = used * item.rate;
                            const remVal = rem * item.rate;
                            return (
                                <tr key={`${item.id}-${idx}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ ...tdS, color: '#9ca3af' }}>{idx + 1}</td>
                                    <td style={{ ...tdS, fontWeight: 600 }}>{item.name}</td>
                                    <td style={tdS}>{item.vendor}</td>
                                    <td style={tdS}>{item.category}</td>
                                    <td style={tdS}>₹{item.rate.toLocaleString()}</td>
                                    <td style={tdS}>{item.qty}</td>
                                    <td style={{ ...tdS, fontWeight: 700 }}>₹{item.total.toLocaleString()}</td>
                                    {title === 'Stock Items' && (
                                        <td style={tdS}>
                                            {(isAdmin || isEngineer) && ((item.stock_status || item.status) === 'received' || item.is_checked) ? (
                                                <input type="number" value={item.quantity_used || 0} step="1"
                                                    onChange={(e) => {
                                                        const updated = [...allItems];
                                                        const i = updated.findIndex(it => it.id === item.id);
                                                        updated[i].quantity_used = e.target.value;
                                                        setAllItems(updated);
                                                    }}
                                                    style={{ width: '60px', padding: '4px', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
                                            ) : used}
                                        </td>
                                    )}
                                    {title === 'Stock Items' && (
                                        <td style={tdS}>₹{usedVal.toLocaleString()}</td>
                                    )}
                                    {title === 'Stock Items' && (
                                        <td style={{ ...tdS, fontWeight: 700, color: rem <= 0 ? '#ef4444' : '#15803d' }}>{rem}</td>
                                    )}
                                    {title === 'Stock Items' && (
                                        <td style={{ ...tdS, color: rem <= 0 ? '#ef4444' : '#15803d' }}>₹{remVal.toLocaleString()}</td>
                                    )}
                                    {title === 'Transferred Stock' && (
                                        <td style={{ ...tdS, color: '#2563eb', fontWeight: 600 }}>{item.transfer_qty}</td>
                                    )}
                                    {title === 'Transferred Stock' && (
                                        <td style={{ ...tdS, color: '#ef4444', fontWeight: 700 }}>−₹{transferAmt.toLocaleString()}</td>
                                    )}
                                    <td style={{ ...tdS, textAlign: 'center' }}>
                                        <span style={{
                                            padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700,
                                            backgroundColor: (item.stock_status || item.status) === 'received' ? '#dcfce7' : (item.stock_status || item.status) === 'transferred' ? '#dbeafe' : '#fef2f2',
                                            color: (item.stock_status || item.status) === 'received' ? '#15803d' : (item.stock_status || item.status) === 'transferred' ? '#1d4ed8' : '#dc2626'
                                        }}>{item.stock_status || item.status || 'pending'}</span>
                                    </td>
                                    <td style={{ ...tdS, textAlign: 'center' }}>
                                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
                                            {(item.stock_status || item.status) === 'pending' && (isAdmin || isEngineer) && (
                                                <button onClick={() => handleMLivincartReceived(item)}
                                                    style={{ backgroundColor: '#10b981', color: 'white', border: 'none', padding: '4px 10px', borderRadius: '4px', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600 }}>
                                                    Received
                                                </button>
                                            )}
                                            {(isAdmin || isEngineer) && ((item.stock_status || item.status) === 'received' || item.is_checked) && (
                                                <button onClick={() => handleSaveUsage(item)}
                                                    style={{ backgroundColor: '#10b981', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem', cursor: 'pointer' }}>
                                                    Save
                                                </button>
                                            )}
                                            {(item.stock_status || item.status) !== 'transferred' && (isAdmin || isEngineer) && (
                                                <button onClick={() => { setTransferringItem(item); setTransferData({ target_project_id: '', qty: 0 }); }}
                                                    style={{ background: '#f1f5f9', border: '1px solid #d1d5db', padding: '4px 8px', borderRadius: '4px', fontSize: '0.72rem', cursor: 'pointer' }}>
                                                    Transfer
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            {renderTable(stockItems, 'Stock Items')}
            {renderTable(transferItems, 'Transferred Stock')}

            {transferringItem && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }}>
                    <div className="premium-card" style={{ width: '100%', maxWidth: '420px', padding: '28px' }}>
                        <h3 style={{ marginBottom: '8px' }}>Transfer: {transferringItem.name}</h3>
                        <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '20px' }}>
                            Max qty: {transferringItem.qty || 0} | Rate: ₹{(transferringItem.rate || 0).toLocaleString()}/unit
                        </p>
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}>Select Target Project</label>
                            <select value={transferData.target_project_id}
                                onChange={(e) => setTransferData({ ...transferData, target_project_id: e.target.value })}
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}>
                                <option value="">Select Project</option>
                                {allProjects.map(p => <option key={p.project_id} value={p.project_id}>{p.project_name}</option>)}
                            </select>
                        </div>
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}>Transfer Quantity (Max: {transferringItem.qty || 0})</label>
                            <input type="number" min={1} max={transferringItem.qty || 0} value={transferData.qty || ''}
                                onChange={(e) => setTransferData({ ...transferData, qty: parseFloat(e.target.value) || 0 })}
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }} />
                            {transferData.qty > 0 && (
                                <p style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 600, marginTop: '6px' }}>
                                    Balance sheet reduction: −₹{((transferData.qty || 0) * (transferringItem.rate || 0)).toLocaleString()}
                                </p>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button onClick={() => setTransferringItem(null)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer' }}>Cancel</button>
                            <button onClick={handleTransfer} className="btn-primary" style={{ flex: 1 }}>Confirm Transfer</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


// Modals

/* ─── Add Stock Item Form (Modal Content) ─────────────────────── */
const StockItemForm = ({ project, categories, onSuccess, onClose }: any) => {
    const emptyForm = { name: '', category_name: '', unit: '', quantity: '', worth_in_rupees: '' };
    const [form, setForm] = useState<any>(emptyForm);
    const [newCatName, setNewCatName] = useState('');
    const [showNewCatInput, setShowNewCatInput] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        let finalCategory = form.category_name;
        if (showNewCatInput) {
            if (!newCatName.trim()) { alert('Please enter new category name'); return; }
            finalCategory = newCatName.trim();
        }

        if (!form.name.trim() || !finalCategory || !form.unit || !form.quantity || !form.worth_in_rupees) {
            alert('Please fill in all required fields.');
            return;
        }
        setSubmitting(true);
        try {
            // 1. If new category, create it first
            if (showNewCatInput) {
                await axios.post(`${API_BASE_URL}/stock-categories`, { project_id: project.project_id, category_name: finalCategory });
            }

            // 2. Add Item
            const res = await axios.post(`${API_BASE_URL}/stock-items`, {
                project_id: project.project_id,
                ...form,
                category_name: finalCategory,
                quantity: parseInt(form.quantity),
                worth_in_rupees: parseInt(form.worth_in_rupees),
            });
            if (res.data.success) {
                setForm(emptyForm);
                setSuccessMsg('Stock item added successfully!');
                setTimeout(() => {
                    setSuccessMsg('');
                    onSuccess();
                }, 1500);
                window.dispatchEvent(new CustomEvent('stockItemAdded', { detail: { project_id: project.project_id } }));
            } else {
                alert(res.data.message || 'Failed to add item');
            }
        } catch { alert('Error adding stock item'); }
        finally { setSubmitting(false); }
    };

    const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#374151' };
    const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' };

    return (
        <div style={{ padding: '30px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '20px', color: '#1e293b', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>Add Stock Item</h3>

            {successMsg && (
                <div style={{ padding: '12px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#15803d', fontWeight: 600, fontSize: '0.85rem', marginBottom: '20px' }}>
                    ✅ {successMsg}
                </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    {/* Name */}
                    <div style={{ gridColumn: 'span 2' }}>
                        <label style={labelStyle}>Item Name <span style={{ color: '#ef4444' }}>*</span></label>
                        <input type="text" required value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            style={inputStyle} placeholder="e.g. Cement, Tiles" />
                    </div>

                    {/* Stock Category */}
                    <div style={{ gridColumn: 'span 2' }}>
                        <label style={labelStyle}>Category <span style={{ color: '#ef4444' }}>*</span></label>
                        {!showNewCatInput ? (
                            <select required value={form.category_name}
                                onChange={(e) => {
                                    if (e.target.value === '__NEW__') {
                                        setShowNewCatInput(true);
                                    } else {
                                        setForm({ ...form, category_name: e.target.value });
                                    }
                                }}
                                style={inputStyle}>
                                <option value="">Select Category</option>
                                {categories.map((c: any) => (
                                    <option key={c.id} value={c.category_name}>{c.category_name}</option>
                                ))}
                                <option value="__NEW__" style={{ color: '#2563eb', fontWeight: 700 }}>+ Add New Category</option>
                            </select>
                        ) : (
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)}
                                    style={inputStyle} placeholder="Enter new category name" autoFocus />
                                <button type="button" onClick={() => setShowNewCatInput(false)}
                                    style={{ padding: '0 12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer' }}>✕</button>
                            </div>
                        )}
                    </div>

                    {/* Unit */}
                    <div>
                        <label style={labelStyle}>Unit <span style={{ color: '#ef4444' }}>*</span></label>
                        <select required value={form.unit}
                            onChange={(e) => setForm({ ...form, unit: e.target.value })}
                            style={inputStyle}>
                            <option value="">Select Unit</option>
                            {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
                        </select>
                    </div>

                    {/* Quantity */}
                    <div>
                        <label style={labelStyle}>Quantity <span style={{ color: '#ef4444' }}>*</span></label>
                        <input type="number" required min="1" step="1" value={form.quantity}
                            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                            style={inputStyle} placeholder="0" />
                    </div>

                    {/* Unit Rate */}
                    <div>
                        <label style={labelStyle}>Unit Rate (₹) <span style={{ color: '#ef4444' }}>*</span></label>
                        <input type="number" required min="0" step="1" value={form.worth_in_rupees}
                            onChange={(e) => setForm({ ...form, worth_in_rupees: e.target.value })}
                            style={inputStyle} placeholder="0" />
                    </div>

                    {/* Result Info */}
                    <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '10px' }}>
                        {form.quantity && form.worth_in_rupees && (
                            <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>
                                Total: ₹{(parseInt(form.quantity) * parseInt(form.worth_in_rupees)).toLocaleString()}
                            </span>
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                    <button type="button" onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                    <button type="submit" disabled={submitting} className="btn-primary" style={{ flex: 2, padding: '12px', fontWeight: 700 }}>
                        {submitting ? 'Saving...' : 'Add Stock Item'}
                    </button>
                </div>
            </form>
        </div>
    );
};

/* ─── Stock Items Table ───────────────────────────────────────── */
const StockItemsTable = ({ project, categories, user }: any) => {
    const [items, setItems] = useState<any[]>([]);
    const [loadingItems, setLoadingItems] = useState(true);
    const [filterCat, setFilterCat] = useState('');
    const [allProjects, setAllProjects] = useState<any[]>([]);
    const [transferringItem, setTransferringItem] = useState<any>(null);
    const [transferData, setTransferData] = useState({ target_project_id: '', qty: 0 });

    const fetchItems = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/stock-items?project_id=${project.project_id}`);
            if (res.data.success) setItems(res.data.data);
        } catch { console.error('Failed to fetch stock items'); }
        finally { setLoadingItems(false); }
    };

    const fetchAllProjects = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/projects`);
            if (res.data.success) {
                setAllProjects(res.data.data.filter((p: any) => p.project_id !== project.project_id));
            }
        } catch (err) { console.error("Failed to fetch projects"); }
    };

    useEffect(() => {
        fetchItems();
        fetchAllProjects();
        const handler = (e: any) => {
            if (String(e.detail?.project_id) === String(project.project_id)) fetchItems();
        };
        window.addEventListener('stockItemAdded', handler);
        return () => window.removeEventListener('stockItemAdded', handler);
    }, [project.project_id]);

    const handleDelete = async (id: number) => {
        if (!window.confirm('Delete this stock item?')) return;
        try {
            const res = await axios.delete(`${API_BASE_URL}/stock-items/${id}`);
            if (res.data.success) fetchItems();
        } catch { alert('Failed to delete item'); }
    };

    const handleSaveUsage = async (item: any) => {
        try {
            const res = await axios.put(`${API_BASE_URL}/stock-items/usage`, {
                id: item.id,
                quantity_used: item.quantity_used,
                is_checked: item.is_checked
            });
            if (res.data.success) {
                alert('Usage saved successfully!');
                fetchItems();
            }
        } catch (err) { alert('Failed to save usage'); }
    };

    const handleTransfer = async () => {
        const available = parseFloat(transferringItem.quantity || 0) - parseFloat(transferringItem.quantity_used || 0);
        console.log('Transfer data:', { transferringItem, transferData, available });
        if (!transferData.target_project_id || transferData.qty <= 0 || transferData.qty > available) {
            alert("Please enter a valid quantity within available limits.");
            return;
        }
        try {
            console.log('Sending transfer request to:', `${API_BASE_URL}/stock-items/transfer`);
            console.log('Request body:', {
                item_id: transferringItem.id,
                target_project_id: transferData.target_project_id,
                transfer_qty: transferData.qty
            });
            const res = await axios.post(`${API_BASE_URL}/stock-items/transfer`, {
                item_id: transferringItem.id,
                target_project_id: transferData.target_project_id,
                transfer_qty: transferData.qty
            });
            console.log('Transfer response:', res.data);
            if (res.data.success) {
                alert('Transfer successful!');
                setTransferringItem(null);
                setTransferData({ target_project_id: '', qty: 0 });
                fetchItems();
            } else {
                alert('Transfer failed: ' + (res.data.message || 'Unknown error'));
            }
        } catch (err: any) {
            console.error('Transfer error:', err);
            console.error('Error response:', err.response?.data);
            alert('Transfer failed: ' + (err.response?.data?.message || err.message || 'Unknown error'));
        }
    };

    const isAdmin = ['admin', 'admin', 'accountant'].includes(user?.role);
    const isEngineer = user?.role === 'site_engineer';

    const filtered = filterCat ? items.filter(i => i.category_name === filterCat) : items;
    const stockItems = filtered.filter(i => !i.is_transferred);
    const transferItems = filtered.filter(i => i.is_transferred);

    const thS: React.CSSProperties = { padding: '12px 14px', textAlign: 'left', color: '#475569', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', backgroundColor: '#f8fafc' };
    const tdS: React.CSSProperties = { padding: '13px 14px', fontSize: '0.85rem', color: '#374151' };

    const renderTable = (data: any[], title: string) => (
        <div className="premium-card" style={{ padding: '24px', marginBottom: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#253b50' }}>{title}</h3>
                {title === "Stock Items" && (
                    <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}
                        style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}>
                        <option value="">All Categories</option>
                        {categories.map((c: any) => <option key={c.id} value={c.category_name}>{c.category_name}</option>)}
                    </select>
                )}
            </div>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                            <th style={thS}>#</th>
                            <th style={thS}>Name</th>
                            {title === "Transferred Stock" ? (
                                <th style={thS}>Qty & Amount</th>
                            ) : (
                                <>
                                    <th style={thS}>Rate (₹)</th>
                                    <th style={thS}>Qty</th>
                                    <th style={thS}>Total (₹)</th>
                                </>
                            )}
                            <th style={thS}>Used</th>
                            <th style={thS}>Used (₹)</th>
                            <th style={thS}>Rem.</th>
                            <th style={thS}>Rem. (₹)</th>
                            <th style={{ ...thS, textAlign: 'center' }}>Status</th>
                            <th style={{ ...thS, textAlign: 'center' }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.length === 0 ? (
                            <tr><td colSpan={11} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>No items found.</td></tr>
                        ) : data.map((item, idx) => {
                            const rate = Math.floor(parseFloat(item.worth_in_rupees || 0));
                            const qty = Math.floor(parseFloat(item.quantity || 0));
                            const used = Math.floor(parseFloat(item.quantity_used || 0));
                            const rem = qty - used;
                            const totalVal = qty * rate;
                            const usedVal = used * rate;
                            const remVal = rem * rate;

                            return (
                                <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ ...tdS, color: '#9ca3af' }}>{idx + 1}</td>
                                    <td style={{ ...tdS, fontWeight: 600 }}>{item.name}</td>
                                    {title === "Transferred Stock" ? (
                                        <td style={{ ...tdS, color: '#2563eb', fontWeight: 600 }}>{qty} qty transfer ₹{totalVal.toLocaleString()}</td>
                                    ) : (
                                        <>
                                            <td style={tdS}>₹{rate.toLocaleString()}</td>
                                            <td style={tdS}>{qty}</td>
                                            <td style={{ ...tdS, fontWeight: 700 }}>₹{totalVal.toLocaleString()}</td>
                                        </>
                                    )}
                                    <td style={tdS}>
                                        {isEngineer && ((item.stock_status || item.status) === 'received' || item.is_checked) ? (
                                            <input type="number" value={item.quantity_used} step="1"
                                                onChange={(e) => {
                                                    const updated = [...items];
                                                    const i = updated.findIndex(it => it.id === item.id);
                                                    updated[i].quantity_used = e.target.value;
                                                    setItems(updated);
                                                }}
                                                style={{ width: '60px', padding: '4px', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
                                        ) : used}
                                    </td>
                                    <td style={tdS}>₹{usedVal.toLocaleString()}</td>
                                    <td style={{ ...tdS, fontWeight: 700, color: rem <= 0 ? '#ef4444' : '#15803d' }}>{rem}</td>
                                    <td style={{ ...tdS, color: rem <= 0 ? '#ef4444' : '#15803d' }}>₹{remVal.toLocaleString()}</td>
                                    <td style={{ ...tdS, textAlign: 'center' }}>
                                        <span style={{
                                            padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700,
                                            backgroundColor: (item.stock_status || item.status) === 'received' ? '#dcfce7' : '#fef2f2',
                                            color: (item.stock_status || item.status) === 'received' ? '#15803d' : '#dc2626'
                                        }}>{item.stock_status || item.status || 'pending'}</span>
                                    </td>
                                    <td style={{ ...tdS, textAlign: 'center' }}>
                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
                                            {isEngineer && (
                                                <>
                                                    <input type="checkbox" checked={!!item.is_checked}
                                                        onChange={(e) => {
                                                            const updated = [...items];
                                                            const i = updated.findIndex(it => it.id === item.id);
                                                            updated[i].is_checked = e.target.checked;
                                                            setItems(updated);
                                                        }} />
                                                    {(item.is_checked || (item.stock_status || item.status) === 'received') && (
                                                        <button onClick={() => handleSaveUsage(item)} style={{ backgroundColor: '#10b981', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem', cursor: 'pointer' }}>Save</button>
                                                    )}
                                                </>
                                            )}
                                            {(isAdmin || isEngineer) && (
                                                <button onClick={() => setTransferringItem(item)} style={{ background: '#f1f5f9', border: '1px solid #d1d5db', padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem', cursor: 'pointer' }}>Transfer</button>
                                            )}
                                            {isAdmin && (
                                                <button onClick={() => handleDelete(item.id)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={14} /></button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            {renderTable(stockItems, "Stock Items")}
            {renderTable(transferItems, "Transferred Stock")}

            {/* Transfer Modal */}
            {transferringItem && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }}>
                    <div className="premium-card" style={{ width: '100%', maxWidth: '400px', padding: '24px' }}>
                        <h3 style={{ marginBottom: '20px' }}>Transfer: {transferringItem.name}</h3>
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}>Select Project</label>
                            <select value={transferData.target_project_id} onChange={(e) => setTransferData({ ...transferData, target_project_id: e.target.value })}
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}>
                                <option value="">Select Project</option>
                                {allProjects.map(p => <option key={p.project_id} value={p.project_id}>{p.project_name}</option>)}
                            </select>
                        </div>
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}>Transfer Qty (Max: {parseFloat(transferringItem.quantity || 0) - parseFloat(transferringItem.quantity_used || 0)})</label>
                            <input type="number" value={transferData.qty || ''} step="0.01" onChange={(e) => setTransferData({ ...transferData, qty: parseFloat(e.target.value) || 0 })}
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }} />
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button onClick={() => setTransferringItem(null)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white' }}>Cancel</button>
                            <button onClick={handleTransfer} className="btn-primary" style={{ flex: 1 }}>Confirm</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


// Modals
const BudgetModal = ({ budget, setBudget, submitting, handleUpdateBudget, setShowBudgetModal }: any) => (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
        <div className="premium-card" style={{ width: '100%', maxWidth: '400px', position: 'relative' }}>
            <button onClick={() => setShowBudgetModal(false)} style={{ position: 'absolute', right: '20px', top: '20px', background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            <h3 style={{ marginBottom: '20px' }}>Setup Project Value</h3>
            <form onSubmit={handleUpdateBudget}>
                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>Total Project Budget (₹)</label>
                    <input type="number" required value={budget} onChange={(e) => setBudget(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db' }} placeholder="Enter total value" />
                </div>
                <button type="submit" disabled={submitting} className="btn-primary" style={{ width: '100%' }}>
                    {submitting ? 'Saving...' : 'Confirm Budget'}
                </button>
            </form>
        </div>
    </div>
);

const PaymentModal = ({
    project,
    transactions = [],
    payment,
    setPayment,
    submitting,
    handleRecordPayment,
    setShowPaymentModal,
    isAdmin = false
}: any) => {
    const totalBudget = Number(project?.total_budget) || 0;

    const pId = String(project?.project_id || '').toLowerCase().trim();
    const pCode = String(project?.project_code || '').toLowerCase().trim();
    const projCredits = (transactions || []).filter((t: any) => {
        if (String(t.type || '').toLowerCase() !== 'credit') return false;
        const tPid = String(t.project_id || '').toLowerCase().trim();
        const tPCode = String(t.project_code || '').toLowerCase().trim();
        const tDesc = String(t.description || '').toLowerCase();
        return (pId && tPid === pId) || (pCode && (tPid === pCode || tPCode === pCode || (pCode.length > 2 && tDesc.includes(pCode))));
    });

    const totalPaidFromTx = projCredits.reduce((s: number, t: any) => s + (parseFloat(t.amount) || 0), 0);
    const totalPaid = Math.max(totalPaidFromTx, Number(project?.total_paid) || 0);
    const remainingBalance = Math.max(0, totalBudget - totalPaid);
    const paidPercent = totalBudget > 0 ? (totalPaid / totalBudget) * 100 : 0;

    const isQcApproved = Boolean(
        project?.is_final_quote_approved === 1 ||
        project?.qc_approved === 1 ||
        project?.status === 'qc_approved' ||
        ['approved', 'qc_approved'].includes(String(project?.qc_status || '').toLowerCase()) ||
        ['quality check done', 'r2p done', 'works contract done', 'production in progress', 'ready to dispatch', 'in transit', 'delivery done', 'installation stage', 'final qc', 'handover'].includes(String(project?.project_stage || '').toLowerCase())
    );

    const hasPassedStage2 = Boolean(
        isQcApproved ||
        project?.stage2_paid === 1 ||
        project?.stage2_paid === true ||
        project?.is_20_percent_paid === 1 ||
        project?.is_20_percent_paid === true ||
        ['masking done', 'sow done', 'quality check done', 'r2p done', 'works contract done', 'production in progress', 'ready to dispatch', 'in transit', 'delivery done', 'installation stage', 'final qc', 'handover'].includes(String(project?.project_stage || '').toLowerCase()) ||
        (pId && localStorage.getItem(`stage2_paid_${pId}`) === 'true') ||
        (pCode && localStorage.getItem(`stage2_paid_${pCode}`) === 'true')
    );

    const hasPassedStage1 = Boolean(
        hasPassedStage2 ||
        project?.stage1_paid === 1 ||
        project?.stage1_paid === true ||
        project?.is_10_percent_paid === 1 ||
        project?.is_10_percent_paid === true ||
        (pId && localStorage.getItem(`stage1_paid_${pId}`) === 'true') ||
        (pCode && localStorage.getItem(`stage1_paid_${pCode}`) === 'true')
    );

    // Stage targets & need amounts:
    const target1 = Math.round(totalBudget * 0.10);
    const isPaid1 = hasPassedStage1 || totalPaid >= (target1 - 1) || paidPercent >= 9.9;
    const need1 = isPaid1 ? 0 : Math.max(0, target1 - totalPaid);

    const target2 = Math.round(totalBudget * 0.20);
    const isPaid2 = hasPassedStage2 || totalPaid >= (target2 - 1) || paidPercent >= 19.9;
    const need2 = isPaid2 ? 0 : Math.max(0, target2 - totalPaid);

    const stage3Amount = Math.round(totalBudget * 0.40); // 40% Stage Payment
    const target3 = Math.round(totalBudget * 0.60);
    const hasPassedStage3 = Boolean(
        project?.stage3_paid === 1 ||
        project?.stage3_paid === true ||
        String(project?.payment_status || '').toLowerCase().includes('60%') ||
        ['r2p done', 'works contract done', 'production in progress', 'ready to dispatch', 'in transit', 'delivery done', 'installation stage', 'final qc', 'handover'].includes(String(project?.project_stage || '').toLowerCase()) ||
        (pId && localStorage.getItem(`stage3_paid_${pId}`) === 'true') ||
        (pCode && localStorage.getItem(`stage3_paid_${pCode}`) === 'true')
    );
    const isPaid3 = hasPassedStage3 || totalPaid >= (target3 - 1) || paidPercent >= 59.9;
    const need3 = isPaid3 ? 0 : stage3Amount;

    const target4 = Math.round(totalBudget * 0.95);
    const stage4Amount = Math.round(totalBudget * 0.35); // 35% Stage Payment
    const hasPassedStage4 = Boolean(
        project?.stage4_paid === 1 ||
        project?.stage4_paid === true ||
        ['ready to dispatch', 'in transit', 'delivery done', 'installation stage', 'final qc', 'handover'].includes(String(project?.project_stage || '').toLowerCase()) ||
        (pId && localStorage.getItem(`stage4_paid_${pId}`) === 'true') ||
        (pCode && localStorage.getItem(`stage4_paid_${pCode}`) === 'true')
    );
    const isPaid4 = hasPassedStage4 || totalPaid >= (target4 - 1) || paidPercent >= 94.9;
    const need4 = isPaid4 ? 0 : (isPaid3 ? stage4Amount : Math.max(0, target4 - totalPaid));

    const target5 = Math.round(totalBudget * 1.00);
    const isPaid5 = totalPaid >= (target5 - 1) || paidPercent >= 99.9 || String(project?.project_stage || '').toLowerCase() === 'handover';
    const need5 = isPaid5 ? 0 : remainingBalance;

    const stages = [
        {
            num: '1️⃣',
            name: 'Stage 1 (Token)',
            pill: '10%',
            pillBg: '#dbeafe',
            pillColor: '#1d4ed8',
            target: target1,
            desc: `Target: ₹${target1.toLocaleString('en-IN')} • Initial Quote (10% Token) • Unlocks 3D Approval & 2D Drawings`,
            isPaid: isPaid1,
            need: need1,
            stageDesc: 'Stage 1 (Token) Payment'
        },
        {
            num: '2️⃣',
            name: 'Stage 2 (Masking)',
            pill: '20% (Cumulative)',
            pillBg: '#ede9fe',
            pillColor: '#6d28d9',
            target: target2,
            desc: `Target: ₹${target2.toLocaleString('en-IN')} • Initial Quote (20% Cumulative) • Unlocks Masking Files & QC Inspector Site Booking`,
            isPaid: isPaid2,
            need: need2,
            stageDesc: 'Stage 2 (Masking) Payment'
        },
        {
            num: '3️⃣',
            name: 'Stage 3 (Production / R2P & Distribution)',
            pill: '40% (Stage Payment)',
            pillBg: '#fef3c7',
            pillColor: '#b45309',
            target: target3,
            desc: `Stage Amount: ₹${stage3Amount.toLocaleString('en-IN')} (40% of Total Budget) • 60% Cumulative Target • Unlocks Factory Production & Product Distribution`,
            isPaid: isPaid3,
            need: need3,
            stageDesc: 'Stage 3 (40% Production / R2P) Payment'
        },
        {
            num: '4️⃣',
            name: 'Stage 4 (Ready to Dispatch)',
            pill: '35% (95% Cumulative)',
            pillBg: '#ffedd5',
            pillColor: '#ea580c',
            target: target4,
            desc: `Target: ₹${target4.toLocaleString('en-IN')} • Final Quote (95% Cumulative Target) • Unlocks Ready to Dispatch, In Transit, Delivery & Site Installation`,
            isPaid: isPaid4,
            need: need4,
            stageDesc: 'Stage 4 (Ready to Dispatch) Payment'
        },
        {
            num: '5️⃣',
            name: 'Stage 5 (Final Handover)',
            pill: '100% (Full Payment)',
            pillBg: '#dcfce7',
            pillColor: '#15803d',
            target: target5,
            desc: `Target: ₹${target5.toLocaleString('en-IN')} • Final Quote (100% Full Payment) • Final Handover Signoff & Project Completion`,
            isPaid: isPaid5,
            need: need5,
            stageDesc: 'Stage 5 (Final Handover) Payment'
        }
    ];

    const handleFillStage = (needAmt: number, stageDesc: string) => {
        setPayment((prev: any) => ({
            ...prev,
            amount: String(needAmt),
            description: stageDesc
        }));
    };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: '16px' }}>
            <div style={{
                width: '100%',
                maxWidth: '780px',
                maxHeight: '92vh',
                overflowY: 'auto',
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                padding: '28px',
                boxSizing: 'border-box',
                position: 'relative'
            }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                    <div>
                        <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>💳</span> Record Customer Payment
                        </h3>
                        <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '4px 0 0 0' }}>
                            Manage project payment stages, percentages & transactions
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowPaymentModal(false)}
                        style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            backgroundColor: '#f1f5f9',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: '#64748b'
                        }}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Summary Card with 3 Boxes + Progress Bar */}
                <div style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '14px',
                    border: '1px solid #e2e8f0',
                    padding: '18px',
                    marginBottom: '22px'
                }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '16px' }}>
                        {/* Total Budget */}
                        <div style={{
                            backgroundColor: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '12px',
                            padding: '14px 16px',
                            textAlign: 'center'
                        }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>Total Project Budget</div>
                            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0f172a', marginTop: '4px' }}>
                                ₹{Math.round(totalBudget).toLocaleString('en-IN')}
                            </div>
                        </div>

                        {/* Total Paid So Far */}
                        <div style={{
                            backgroundColor: '#f0fdf4',
                            border: '1px solid #bbf7d0',
                            borderRadius: '12px',
                            padding: '14px 16px',
                            textAlign: 'center'
                        }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#15803d' }}>
                                Total Paid So Far ({paidPercent.toFixed(1)}%)
                            </div>
                            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#16a34a', marginTop: '4px' }}>
                                ₹{Math.round(totalPaid).toLocaleString('en-IN')}
                            </div>
                        </div>

                        {/* Remaining Balance */}
                        <div style={{
                            backgroundColor: '#fff7ed',
                            border: '1px solid #fed7aa',
                            borderRadius: '12px',
                            padding: '14px 16px',
                            textAlign: 'center'
                        }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#c2410c' }}>Remaining Balance</div>
                            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#ea580c', marginTop: '4px' }}>
                                ₹{Math.round(remainingBalance).toLocaleString('en-IN')}
                            </div>
                        </div>
                    </div>

                    {/* Payment Progress Bar */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                            <span>Payment Progress</span>
                            <span>{paidPercent.toFixed(1)}% Collected</span>
                        </div>
                        <div style={{ width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(100, Math.max(0, paidPercent))}%`, height: '100%', backgroundColor: '#16a34a', borderRadius: '6px', transition: 'width 0.3s ease' }} />
                        </div>
                    </div>
                </div>

                {/* Payment Stages & Required Amounts */}
                <div style={{ marginBottom: '22px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>📊</span> Payment Stages &amp; Required Amounts:
                        </span>
                        <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>
                            {isAdmin ? 'Click any stage to quick-fill form' : 'Stage milestones & target requirements (View Only)'}
                        </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {stages.map((st, i) => (
                            <div
                                key={`stage-row-${i}`}
                                onClick={() => {
                                    if (isAdmin && !st.isPaid && st.need > 0) {
                                        handleFillStage(st.need, st.stageDesc);
                                    }
                                }}
                                style={{
                                    backgroundColor: st.isPaid ? '#f0fdf4' : '#eff6ff',
                                    border: `1.5px solid ${st.isPaid ? '#86efac' : '#bfdbfe'}`,
                                    borderRadius: '12px',
                                    padding: '12px 16px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    cursor: (isAdmin && !st.isPaid && st.need > 0) ? 'pointer' : 'default',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                        <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a' }}>
                                            {st.name}
                                        </span>
                                        <span style={{
                                            fontSize: '0.72rem',
                                            fontWeight: 800,
                                            padding: '2px 8px',
                                            borderRadius: '10px',
                                            backgroundColor: st.pillBg,
                                            color: st.pillColor
                                        }}>
                                            {st.pill}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                        {st.desc}
                                    </div>
                                </div>

                                <div>
                                    {st.isPaid ? (
                                        <span style={{ color: '#16a34a', fontWeight: 800, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            ✅ Fully Paid
                                        </span>
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1d4ed8' }}>
                                                Needs: ₹{st.need.toLocaleString('en-IN')}
                                            </span>
                                            {isAdmin ? (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleFillStage(st.need, st.stageDesc);
                                                    }}
                                                    style={{
                                                        padding: '6px 14px',
                                                        borderRadius: '8px',
                                                        backgroundColor: '#2563eb',
                                                        color: '#ffffff',
                                                        border: 'none',
                                                        fontWeight: 700,
                                                        fontSize: '0.82rem',
                                                        cursor: 'pointer',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }}
                                                >
                                                    ⚡ Fill ₹{st.need.toLocaleString('en-IN')}
                                                </button>
                                            ) : (
                                                <span style={{
                                                    padding: '5px 10px',
                                                    borderRadius: '6px',
                                                    backgroundColor: '#dbeafe',
                                                    color: '#1d4ed8',
                                                    fontWeight: 700,
                                                    fontSize: '0.78rem'
                                                }}>
                                                    Milestone
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Quick Presets / Milestones */}
                {isAdmin ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '22px' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569' }}>Quick Presets:</span>

                        {isPaid1 ? (
                            <span style={{ padding: '5px 12px', borderRadius: '8px', backgroundColor: '#f0fdf4', color: '#16a34a', border: '1px solid #86efac', fontWeight: 700, fontSize: '0.8rem' }}>
                                ✅ 10% Token Paid
                            </span>
                        ) : (
                            <button
                                type="button"
                                onClick={() => handleFillStage(need1, 'Stage 1 (Token) Payment')}
                                style={{ padding: '5px 12px', borderRadius: '8px', backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
                            >
                                ⚡ Stage 1 (Needs ₹{need1.toLocaleString('en-IN')})
                            </button>
                        )}

                        {isPaid2 ? (
                            <span style={{ padding: '5px 12px', borderRadius: '8px', backgroundColor: '#f0fdf4', color: '#16a34a', border: '1px solid #86efac', fontWeight: 700, fontSize: '0.8rem' }}>
                                ✅ Stage 2 (20%) Paid
                            </span>
                        ) : (
                            <button
                                type="button"
                                onClick={() => handleFillStage(need2, 'Stage 2 (Masking) Payment')}
                                style={{ padding: '5px 12px', borderRadius: '8px', backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
                            >
                                ⚡ Stage 2 (Needs ₹{need2.toLocaleString('en-IN')})
                            </button>
                        )}

                        {isPaid3 ? (
                            <span style={{ padding: '5px 12px', borderRadius: '8px', backgroundColor: '#f0fdf4', color: '#16a34a', border: '1px solid #86efac', fontWeight: 700, fontSize: '0.8rem' }}>
                                ✅ Stage 3 (40%) Paid
                            </span>
                        ) : (
                            <button
                                type="button"
                                onClick={() => handleFillStage(need3, 'Stage 3 (40% Production / R2P) Payment')}
                                style={{ padding: '5px 12px', borderRadius: '8px', backgroundColor: '#fffbeb', color: '#b45309', border: '1.5px solid #f59e0b', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer' }}
                            >
                                ⚡ Stage 3 (40% = ₹{need3.toLocaleString('en-IN')})
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={() => handleFillStage(need4, 'Stage 4 (Ready to Dispatch) Payment')}
                            style={{ padding: '5px 12px', borderRadius: '8px', backgroundColor: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
                        >
                            Stage 4 (+35% = 95%)
                        </button>

                        <button
                            type="button"
                            onClick={() => handleFillStage(remainingBalance, 'Full Remaining Balance Payment')}
                            style={{ padding: '5px 12px', borderRadius: '8px', backgroundColor: '#fff7ed', color: '#ea580c', border: '1.5px solid #ea580c', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer' }}
                        >
                            Full Remaining (₹{remainingBalance.toLocaleString('en-IN')})
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '22px' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569' }}>Milestone Stages:</span>
                        <span style={{ padding: '4px 10px', borderRadius: '8px', backgroundColor: isPaid1 ? '#f0fdf4' : '#eff6ff', color: isPaid1 ? '#16a34a' : '#1d4ed8', border: `1px solid ${isPaid1 ? '#86efac' : '#bfdbfe'}`, fontWeight: 700, fontSize: '0.78rem' }}>
                            {isPaid1 ? '✅' : '⏳'} Stage 1 (10% Token)
                        </span>
                        <span style={{ padding: '4px 10px', borderRadius: '8px', backgroundColor: isPaid2 ? '#f0fdf4' : '#eff6ff', color: isPaid2 ? '#16a34a' : '#1d4ed8', border: `1px solid ${isPaid2 ? '#86efac' : '#bfdbfe'}`, fontWeight: 700, fontSize: '0.78rem' }}>
                            {isPaid2 ? '✅' : '⏳'} Stage 2 (20% Masking)
                        </span>
                        <span style={{ padding: '4px 10px', borderRadius: '8px', backgroundColor: isPaid3 ? '#f0fdf4' : '#fffbeb', color: isPaid3 ? '#16a34a' : '#b45309', border: `1.5px solid ${isPaid3 ? '#86efac' : '#f59e0b'}`, fontWeight: 800, fontSize: '0.78rem' }}>
                            {isPaid3 ? '✅' : '⏳'} Stage 3 (40% Production / R2P)
                        </span>
                        <span style={{ padding: '4px 10px', borderRadius: '8px', backgroundColor: isPaid4 ? '#f0fdf4' : '#ffffff', color: isPaid4 ? '#16a34a' : '#475569', border: `1px solid ${isPaid4 ? '#86efac' : '#cbd5e1'}`, fontWeight: 700, fontSize: '0.78rem' }}>
                            {isPaid4 ? '✅' : '⏳'} Stage 4 (35% Dispatch)
                        </span>
                        <span style={{ padding: '4px 10px', borderRadius: '8px', backgroundColor: isPaid5 ? '#f0fdf4' : '#fff7ed', color: isPaid5 ? '#16a34a' : '#ea580c', border: `1px solid ${isPaid5 ? '#86efac' : '#fed7aa'}`, fontWeight: 700, fontSize: '0.78rem' }}>
                            {isPaid5 ? '✅' : '⏳'} Stage 5 (Handover)
                        </span>
                    </div>
                )}

                {/* Payment Entry Form (Admin Only) vs Employee View-Only Mode */}
                {isAdmin ? (
                    <form onSubmit={handleRecordPayment} style={{ marginBottom: '22px' }}>
                        <div style={{
                            backgroundColor: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '14px',
                            padding: '20px',
                            marginBottom: '16px'
                        }}>
                            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span>📝</span> Payment Entry Details (Admin)
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
                                        Amount Received (₹) *
                                    </label>
                                    <input
                                        type="number"
                                        required
                                        placeholder="e.g. 50000"
                                        value={payment.amount}
                                        onChange={(e) => setPayment({ ...payment, amount: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '11px 14px',
                                            borderRadius: '8px',
                                            border: '1px solid #cbd5e1',
                                            fontSize: '0.95rem',
                                            fontWeight: 700,
                                            outline: 'none',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
                                        Payment Mode *
                                    </label>
                                    <select
                                        value={payment.payment_mode}
                                        onChange={(e) => setPayment({ ...payment, payment_mode: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '11px 14px',
                                            borderRadius: '8px',
                                            border: '1px solid #cbd5e1',
                                            fontSize: '0.95rem',
                                            fontWeight: 600,
                                            outline: 'none',
                                            backgroundColor: '#ffffff',
                                            cursor: 'pointer',
                                            boxSizing: 'border-box'
                                        }}
                                    >
                                        <option value="UPI">UPI (Google Pay / PhonePe / Paytm)</option>
                                        <option value="Bank Transfer">Bank Transfer / NEFT / RTGS / IMPS</option>
                                        <option value="Cash">Cash</option>
                                        <option value="Cheque">Cheque</option>
                                        <option value="Card">Credit / Debit Card</option>
                                    </select>
                                </div>

                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
                                        Description / Stage Note *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={payment.description}
                                        onChange={(e) => setPayment({ ...payment, description: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '11px 14px',
                                            borderRadius: '8px',
                                            border: '1px solid #cbd5e1',
                                            fontSize: '0.95rem',
                                            outline: 'none',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
                                        Transaction Date *
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={payment.date}
                                        onClick={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch (err) { } }}
                                        onChange={(e) => setPayment({ ...payment, date: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '11px 14px',
                                            borderRadius: '8px',
                                            border: '1px solid #cbd5e1',
                                            fontSize: '0.95rem',
                                            outline: 'none',
                                            cursor: 'pointer',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={submitting}
                                style={{
                                    width: '100%',
                                    padding: '14px',
                                    backgroundColor: '#1e293b',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '10px',
                                    fontWeight: 800,
                                    fontSize: '1rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    transition: 'background-color 0.15s ease'
                                }}
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 className="animate-spin" size={18} /> Recording Payment...
                                    </>
                                ) : (
                                    <>
                                        <span>💳</span> Save &amp; Confirm Payment (₹{(parseFloat(payment.amount) || 0).toLocaleString('en-IN')})
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                ) : (
                    <div style={{
                        backgroundColor: '#f8fafc',
                        border: '1.5px dashed #cbd5e1',
                        borderRadius: '14px',
                        padding: '24px 20px',
                        marginBottom: '22px',
                        textAlign: 'center'
                    }}>
                        <div style={{ fontSize: '1.8rem', marginBottom: '8px' }}>🔒</div>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>
                            Employee View-Only Access
                        </div>
                        <p style={{ fontSize: '0.85rem', color: '#64748b', maxWidth: '520px', margin: '0 auto 12px auto', lineHeight: 1.5 }}>
                            You are viewing customer payment milestones and transactions. <strong>Only Admin has permission to add or record customer payments (including Stage 3 40% payment).</strong>
                        </p>
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            backgroundColor: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            padding: '6px 14px',
                            borderRadius: '20px',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            color: '#1d4ed8'
                        }}>
                            <span>ℹ️</span> To record received customer funds, please contact an Administrator.
                        </div>
                    </div>
                )}

                {/* Paid Transactions History */}
                <div style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '14px',
                    padding: '20px',
                    marginBottom: '20px'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>📄</span> Paid Transactions History ({projCredits.length}):
                        </span>
                        <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#16a34a' }}>
                            ₹{Math.round(totalPaid).toLocaleString('en-IN')} Total
                        </span>
                    </div>

                    {projCredits.length > 0 ? (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                                        <th style={{ padding: '8px 10px', fontWeight: 700 }}>Date</th>
                                        <th style={{ padding: '8px 10px', fontWeight: 700 }}>Mode</th>
                                        <th style={{ padding: '8px 10px', fontWeight: 700 }}>Description</th>
                                        <th style={{ padding: '8px 10px', fontWeight: 700, textAlign: 'right' }}>Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {projCredits.map((tr: any, idx: number) => {
                                        const trAmt = parseFloat(tr.amount || 0);
                                        const trPct = totalBudget > 0 ? ((trAmt / totalBudget) * 100).toFixed(1) : '0';
                                        return (
                                            <tr key={`tr-hist-${idx}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '10px', color: '#64748b', whiteSpace: 'nowrap' }}>
                                                    {tr.transaction_date || tr.created_at || '-'}
                                                </td>
                                                <td style={{ padding: '10px' }}>
                                                    <span style={{
                                                        padding: '3px 8px',
                                                        borderRadius: '6px',
                                                        backgroundColor: '#f1f5f9',
                                                        color: '#1e293b',
                                                        fontWeight: 700,
                                                        fontSize: '0.75rem'
                                                    }}>
                                                        {tr.payment_mode || 'UPI'}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '10px', color: '#0f172a', fontWeight: 600 }}>
                                                    {tr.description || 'Customer Payment'}
                                                </td>
                                                <td style={{ padding: '10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                    <div style={{ fontWeight: 800, color: '#16a34a' }}>
                                                        ₹{Math.round(trAmt).toLocaleString('en-IN')}
                                                    </div>
                                                    <div style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 600 }}>
                                                        ({trPct}%)
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '0.85rem' }}>
                            No paid transactions recorded yet.
                        </div>
                    )}
                </div>

                {/* Next Workflow Unlocked After Payment */}
                <div style={{
                    backgroundColor: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '12px',
                    padding: '14px 18px'
                }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#15803d', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>🚀</span> Next Workflow Unlocked After Payment:
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#166534', lineHeight: 1.5 }}>
                        {totalPaid < target1 ? (
                            '• Pay Stage 1 (10% Token Advance) to unlock 3D Approval & 2D Drawings.'
                        ) : totalPaid < target2 ? (
                            '• Pay Stage 2 (20% cumulative target of Initial Quote) to unlock Masking Files & QC Inspector Site Booking.'
                        ) : totalPaid < target3 ? (
                            '• Pay Stage 3 (60% cumulative target of Final Quote) to unlock Factory Production & Product Distribution.'
                        ) : totalPaid < target4 ? (
                            '• Pay Stage 4 (95% cumulative target of Final Quote) to unlock Ready to Dispatch, In Transit, Delivery & Site Installation.'
                        ) : totalPaid < target5 ? (
                            '• Pay Stage 5 (100% full payment) to unlock Final Handover Signoff & Project Completion.'
                        ) : (
                            '• All project payment stages completed! Project is ready for final handover & signoff.'
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export const StageNotesTab = ({ project, user, filterType = 'pm', timelineTasks, timelineCategories, onSyncDatesToTimeline }: any) => {
    const isReadOnly = !['admin', 'project_head', 'project_manager', 'manager', 'd1', 'd2', 'designer'].includes(String(user?.role || '').toLowerCase());

    const [stageNotes, setStageNotes] = useState<any[]>([]);
    const [activeNote, setActiveNote] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [editingIdx, setEditingIdx] = useState<number | null>(null);

    const activeNoteCategoryKey = filterType === 'pm' ? 'timeline_active_note_pm' : 'timeline_active_note_designer';

    useEffect(() => {
        if (project?.project_id) loadAll();
    }, [project?.project_id, filterType]);

    const loadAll = async () => {
        setLoading(true);
        try {
            const [dRes, pmRes, notesRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/controllers/timeline/state.php?project_id=${project.project_id}&type=designer`),
                axios.get(`${API_BASE_URL}/controllers/timeline/state.php?project_id=${project.project_id}&type=pm`),
                axios.get(`${API_BASE_URL}/controllers/timeline/stage-notes.php?project_id=${project.project_id}`)
            ]);

            const dTasks: any[] = dRes.data?.tasks || [];
            const pTasks: any[] = pmRes.data?.tasks || [];
            const savedNotes: any[] = notesRes.data?.data || [];

            // Extract active note if saved
            const foundActiveNote = savedNotes.find((n: any) => n.category === activeNoteCategoryKey);
            if (foundActiveNote) {
                setActiveNote(foundActiveNote.note || '');
            }

            // Standard order for Designer and PM matching Images 2, 3, 4, 5
            const DESIGNER_ORDER = ['DD', '3D Approval', '2D', 'QC1', 'Masking', 'Signoff', 'Final 2D', 'QC2', 'Final Quote', 'R2P'];
            const PM_ORDER = ['Product Distribution', 'Ready to Dispatch', 'In Transit', 'Delivery', 'Kickoff M', 'HOK', 'Material Segregation', 'QC', 'Installation', 'Final QC', 'Handover'];

            const baseOrder = filterType === 'designer' ? DESIGNER_ORDER : PM_ORDER;
            const relevantTasks: any[] = (timelineTasks && timelineTasks.length > 0)
                ? timelineTasks
                : (filterType === 'designer' ? dTasks : pTasks);

            const activeTimelineCats: string[] = (timelineCategories && timelineCategories.length > 0)
                ? timelineCategories
                : (filterType === 'designer' ? (dRes.data?.categoryOrder || []) : (pmRes.data?.categoryOrder || []));

            const clean = (s: any) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

            const extraFromTimelineCats = activeTimelineCats.filter(c =>
                c && !baseOrder.some(b => clean(b) === clean(c))
            );

            const taskCats = relevantTasks.map((t: any) => t.category).filter(Boolean);
            const extraFromTasks = taskCats.filter(c =>
                c &&
                !baseOrder.some(b => clean(b) === clean(c)) &&
                !extraFromTimelineCats.some(e => clean(e) === clean(c))
            );

            const extraFromSaved = savedNotes
                .filter((sn: any) => sn.category && !sn.category.startsWith('timeline_active_note_') && (sn.source === filterType || (!sn.source && filterType === 'designer')))
                .map((sn: any) => sn.category)
                .filter((c: string) =>
                    c &&
                    !baseOrder.some(b => clean(b) === clean(c)) &&
                    !extraFromTimelineCats.some(e => clean(e) === clean(c)) &&
                    !extraFromTasks.some(e => clean(e) === clean(c))
                );

            const allCategories = Array.from(new Set([...baseOrder, ...extraFromTimelineCats, ...extraFromTasks, ...extraFromSaved]));

            const rows = allCategories.map((cat: string) => {
                const catTasks = relevantTasks.filter((t: any) => {
                    const tCat = clean(t.category);
                    const tName = clean(t.name);
                    const cClean = clean(cat);
                    return tCat === cClean || tName === cClean || tCat.includes(cClean) || cClean.includes(tCat);
                });

                let tStart = '';
                let tEnd = '';
                if (catTasks.length > 0) {
                    const starts = catTasks.map((t: any) => t.startDate).filter(Boolean).sort();
                    const ends = catTasks.map((t: any) => t.endDate).filter(Boolean).sort();
                    tStart = starts[0] || '';
                    tEnd = ends[ends.length - 1] || '';
                }

                const saved = savedNotes.find((n: any) => clean(n.category) === clean(cat));
                return {
                    category: cat,
                    startDate: tStart || saved?.startDate || '',
                    endDate: tEnd || saved?.endDate || '',
                    note: saved?.note || '',
                    source: filterType
                };
            });

            setStageNotes(rows);
        } catch (e) {
            console.error('Failed to load stage notes', e);
        } finally {
            setLoading(false);
        }
    };

    // Live auto-sync whenever timelineTasks or timelineCategories update
    useEffect(() => {
        if (!timelineTasks && !timelineCategories) return;
        setStageNotes(prev => {
            const currentTasks = timelineTasks || [];
            const currentCats = timelineCategories || [];
            const clean = (s: any) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

            const DESIGNER_ORDER = ['DD', '3D Approval', '2D', 'QC1', 'Masking', 'Signoff', 'Final 2D', 'QC2', 'Final Quote', 'R2P'];
            const PM_ORDER = ['Product Distribution', 'Ready to Dispatch', 'In Transit', 'Delivery', 'Kickoff M', 'HOK', 'Material Segregation', 'QC', 'Installation', 'Final QC', 'Handover'];
            const baseOrder = filterType === 'designer' ? DESIGNER_ORDER : PM_ORDER;

            const extraCats = currentCats.filter((c: string) => c && !baseOrder.some(b => clean(b) === clean(c)));
            const taskCats = currentTasks.map((t: any) => t.category).filter(Boolean);
            const extraFromTasks = taskCats.filter((c: string) =>
                c &&
                !baseOrder.some(b => clean(b) === clean(c)) &&
                !extraCats.some((e: string) => clean(e) === clean(c))
            );
            const prevCats = prev.map(p => p.category);

            const allCategories = Array.from(new Set([...baseOrder, ...extraCats, ...extraFromTasks, ...prevCats]));

            return allCategories.map(cat => {
                const existing = prev.find(p => clean(p.category) === clean(cat));
                const catTasks = currentTasks.filter((t: any) => {
                    const tCat = clean(t.category);
                    const tName = clean(t.name);
                    const cClean = clean(cat);
                    return tCat === cClean || tName === cClean || tCat.includes(cClean) || cClean.includes(tCat);
                });

                let tStart = '';
                let tEnd = '';
                if (catTasks.length > 0) {
                    const starts = catTasks.map((t: any) => t.startDate).filter(Boolean).sort();
                    const ends = catTasks.map((t: any) => t.endDate).filter(Boolean).sort();
                    tStart = starts[0] || '';
                    tEnd = ends[ends.length - 1] || '';
                }

                return {
                    category: cat,
                    startDate: tStart || existing?.startDate || '',
                    endDate: tEnd || existing?.endDate || '',
                    note: existing?.note || '',
                    source: filterType
                };
            });
        });
    }, [timelineTasks, timelineCategories, filterType]);

    const handleFieldChange = (idx: number, field: string, value: string) => {
        setStageNotes(prev => {
            const updated = prev.map((row, i) => i === idx ? { ...row, [field]: value } : row);
            const targetRow = updated[idx];
            if (targetRow && (field === 'startDate' || field === 'endDate')) {
                onSyncDatesToTimeline?.(targetRow.category, targetRow.startDate, targetRow.endDate);
            }
            return updated;
        });
        setSaved(false);
    };

    const handleAddCustomStageNote = () => {
        const stageName = window.prompt('Enter new stage / note title:');
        if (!stageName || !stageName.trim()) return;
        const newRow = {
            category: stageName.trim(),
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date().toISOString().split('T')[0],
            note: '',
            source: filterType
        };
        setStageNotes(prev => [...prev, newRow]);
        setSaved(false);
    };

    const handleDeleteStageRow = (idx: number) => {
        if (!window.confirm('Are you sure you want to delete this stage note?')) return;
        setStageNotes(prev => prev.filter((_, i) => i !== idx));
        setSaved(false);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Keep other source notes intact when saving
            const existingRes = await axios.get(`${API_BASE_URL}/controllers/timeline/stage-notes.php?project_id=${project.project_id}`);
            const existing: any[] = existingRes.data?.data || [];

            // Filter out existing notes from current filterType & current activeNoteKey
            const otherNotes = existing.filter((n: any) => {
                if (n.category === activeNoteCategoryKey) return false;
                if (n.source === filterType) return false;
                return true;
            });

            const merged = [
                ...otherNotes,
                ...stageNotes,
                { category: activeNoteCategoryKey, note: activeNote, source: filterType }
            ];

            await axios.post(`${API_BASE_URL}/controllers/timeline/stage-notes.php`, {
                project_id: project.project_id,
                notes: merged
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        } catch (e) {
            alert('Failed to save stage notes');
        } finally {
            setSaving(false);
        }
    };

    const handleDownloadMomPdf = async () => {
        try {
            const res = await axios.post(`${API_BASE_URL}/pdf/generate-mom`, {
                project_id: project.project_id,
                type: filterType
            });
            if (res.data?.pdf_base64) {
                const byteCharacters = atob(res.data.pdf_base64);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: 'application/pdf' });
                const blobUrl = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = `MOM_${project.project_code || project.project_id}_${filterType}.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
            } else if (res.data?.pdf_url) {
                window.open(res.data.pdf_url, '_blank');
            } else {
                window.open(`/print-mom/${project.project_id}?type=${filterType}`, '_blank');
            }
        } catch (e) {
            window.open(`/print-mom/${project.project_id}?type=${filterType}`, '_blank');
        }
    };

    const handlePrintMomPdf = () => {
        window.open(`/print-mom/${project.project_id}?type=${filterType}`, '_blank');
    };

    const insertFormatTag = (tag: string) => {
        if (tag === 'list') {
            setActiveNote(prev => prev + '\n• ');
        } else if (tag === 'link') {
            const url = window.prompt('Enter URL:');
            if (url) setActiveNote(prev => prev + ' ' + url + ' ');
        } else {
            setActiveNote(prev => prev + ` <${tag}>text</${tag}> `);
        }
    };

    if (loading) return (
        <div style={{ textAlign: 'center', padding: '60px' }}>
            <Loader2 className="animate-spin" style={{ margin: '0 auto', color: '#253b50' }} size={36} />
        </div>
    );

    return (
        <div style={{ padding: '0', fontFamily: 'inherit' }}>
            {/* STAGE NOTES / MOM CARD (Images 2, 3, 4, 5) */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '14px', border: '1px solid #fed7aa', padding: '24px', marginBottom: '28px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '1.2rem' }}>📋</span>
                            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                                Stage Notes / MOM
                            </h2>
                        </div>
                        <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '4px 0 0 0' }}>
                            Add, edit and delete stage records or generate client-ready MOM PDFs.
                        </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '8px 20px',
                                backgroundColor: saved ? '#16a34a' : '#1e293b',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '8px',
                                fontWeight: 700,
                                fontSize: '0.82rem',
                                cursor: saving ? 'not-allowed' : 'pointer',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                            }}
                        >
                            <Save size={14} />
                            {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Changes'}
                        </button>
                        <button
                            type="button"
                            onClick={handleAddCustomStageNote}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '8px 18px',
                                backgroundColor: '#ea580c',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '8px',
                                fontWeight: 700,
                                fontSize: '0.82rem',
                                cursor: 'pointer',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                            }}
                        >
                            <Plus size={14} /> Add Stage Note
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid #fed7aa' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#fffbeb', borderBottom: '1.5px solid #fed7aa', color: '#0f172a' }}>
                                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 800, width: '160px' }}>Stage</th>
                                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 800, width: '160px' }}>Start Date</th>
                                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 800, width: '160px' }}>End Date</th>
                                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 800 }}>Description</th>
                                <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 800, width: '130px' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stageNotes.map((row, idx) => (
                                <tr
                                    key={row.category || idx}
                                    style={{
                                        backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafaf9',
                                        borderBottom: '1px solid #f3f4f6'
                                    }}
                                >
                                    {/* Stage Badge */}
                                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                                        <span style={{
                                            display: 'inline-block',
                                            padding: '4px 10px',
                                            borderRadius: '6px',
                                            fontSize: '0.78rem',
                                            fontWeight: 700,
                                            backgroundColor: '#eff6ff',
                                            color: '#1e40af',
                                            border: '1px solid #bfdbfe'
                                        }}>
                                            {row.category}
                                        </span>
                                    </td>

                                    {/* Start Date */}
                                    <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                                        <input
                                            type="date"
                                            value={row.startDate ? row.startDate.split(' ')[0] : ''}
                                            onClick={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch (err) { } }}
                                            onChange={e => handleFieldChange(idx, 'startDate', e.target.value)}
                                            style={{
                                                padding: '6px 10px',
                                                borderRadius: '6px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '0.8rem',
                                                color: '#1e293b',
                                                outline: 'none',
                                                width: '135px',
                                                cursor: 'pointer'
                                            }}
                                        />
                                    </td>

                                    {/* End Date */}
                                    <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                                        <input
                                            type="date"
                                            min={row.startDate ? row.startDate.split(' ')[0] : undefined}
                                            value={row.endDate ? row.endDate.split(' ')[0] : ''}
                                            onClick={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch (err) { } }}
                                            onChange={e => handleFieldChange(idx, 'endDate', e.target.value)}
                                            style={{
                                                padding: '6px 10px',
                                                borderRadius: '6px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '0.8rem',
                                                color: '#1e293b',
                                                outline: 'none',
                                                width: '135px',
                                                cursor: 'pointer'
                                            }}
                                        />
                                    </td>

                                    {/* Description (Multi-line) */}
                                    <td style={{ padding: '10px 16px' }}>
                                        <textarea
                                            rows={2}
                                            placeholder="Enter stage description / remarks directly..."
                                            value={row.note || ''}
                                            onChange={e => handleFieldChange(idx, 'note', e.target.value)}
                                            onInput={(e: any) => {
                                                e.target.style.height = 'auto';
                                                e.target.style.height = Math.max(44, e.target.scrollHeight) + 'px';
                                            }}
                                            style={{
                                                width: '100%',
                                                padding: '8px 12px',
                                                borderRadius: '6px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '0.82rem',
                                                color: '#0f172a',
                                                outline: 'none',
                                                boxSizing: 'border-box',
                                                resize: 'vertical',
                                                minHeight: '44px',
                                                fontFamily: 'inherit',
                                                lineHeight: 1.4
                                            }}
                                        />
                                    </td>

                                    {/* Actions */}
                                    <td style={{ padding: '10px 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                            <button
                                                type="button"
                                                onClick={() => setEditingIdx(editingIdx === idx ? null : idx)}
                                                style={{ background: 'none', border: 'none', color: '#ea580c', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                                                title="Edit Stage"
                                            >
                                                <Edit2 size={13} /> Edit
                                            </button>
                                            <span style={{ color: '#cbd5e1' }}>|</span>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteStageRow(idx)}
                                                style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                                                title="Delete Stage"
                                            >
                                                <Trash2 size={13} /> Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* TIMELINE ACTIVE NOTES CARD (Images 3 & 5) */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '14px', border: '1px solid #fed7aa', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                    <span style={{ fontSize: '1.2rem' }}>📝</span>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                        {filterType === 'pm' ? 'Project Manager' : 'Designer'} Timeline Active Notes
                    </h3>
                </div>

                {/* Toolbar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <button
                        type="button"
                        onClick={() => insertFormatTag('b')}
                        style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer' }}
                        title="Bold"
                    >
                        B
                    </button>
                    <button
                        type="button"
                        onClick={() => insertFormatTag('i')}
                        style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontStyle: 'italic', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}
                        title="Italic"
                    >
                        I
                    </button>
                    <button
                        type="button"
                        onClick={() => insertFormatTag('list')}
                        style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}
                        title="Bullet List"
                    >
                        • List
                    </button>
                    <button
                        type="button"
                        onClick={() => insertFormatTag('link')}
                        style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}
                        title="Insert Link"
                    >
                        🔗 Link
                    </button>
                </div>

                {/* Textarea */}
                <textarea
                    rows={5}
                    value={activeNote}
                    onChange={e => { setActiveNote(e.target.value); setSaved(false); }}
                    placeholder="Type meeting notes, client agreements, discussion summary, or MOM minutes directly..."
                    style={{
                        width: '100%',
                        padding: '14px',
                        borderRadius: '10px',
                        border: '1.5px solid #fef08a',
                        backgroundColor: '#ffffff',
                        fontSize: '0.85rem',
                        lineHeight: 1.6,
                        color: '#0f172a',
                        outline: 'none',
                        boxSizing: 'border-box',
                        minHeight: '120px',
                        marginBottom: '16px'
                    }}
                />

                {/* Bottom Action Bar */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                    <button
                        type="button"
                        onClick={handleDownloadMomPdf}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '9px 20px',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: '#1e293b',
                            color: '#ffffff',
                            fontWeight: 700,
                            fontSize: '0.82rem',
                            cursor: 'pointer',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                        }}
                    >
                        <Download size={14} /> Download MOM PDF
                    </button>
                    <button
                        type="button"
                        onClick={handlePrintMomPdf}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '9px 20px',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: '#1e293b',
                            color: '#ffffff',
                            fontWeight: 700,
                            fontSize: '0.82rem',
                            cursor: 'pointer',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                        }}
                    >
                        <Printer size={14} /> Print MOM (Save as PDF)
                    </button>
                </div>
            </div>
        </div>
    );
};

export const TimelineTab = ({ project, user, type = 'designer', fetchProjectDetails, totalPaid = 0 }: any) => {

    const isAdmin = ['admin', 'd1', 'd2', 'graphic_designer', 'gd', 'project_head', 'project_manager', 'site_engineer'].includes(user?.role);
    const todayStr = new Date().toISOString().split('T')[0];
    const BORDER = "1.5px solid #000";

    const [tasks, setTasks] = useState<any[]>([]);
    const [completions, setCompletions] = useState<any>({});
    const [loading, setLoading] = useState(true);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
    const [editingTask, setEditingTask] = useState<any>(null);

    // Project date range states
    const [projectStartDate, setProjectStartDate] = useState(project?.start_date ? project.start_date.split('T')[0] : '');
    const [projectEndDate, setProjectEndDate] = useState(project?.expected_end_date ? project.expected_end_date.split('T')[0] : '');
    const [updatingDates, setUpdatingDates] = useState(false);
    const [newTask, setNewTask] = useState({ category: '', customCategory: '', name: '', customName: '', startDate: '', endDate: '' });

    const [showAddCatInput, setShowAddCatInput] = useState(false);
    const [newCatInput, setNewCatInput] = useState('');
    const [showReorderPanel, setShowReorderPanel] = useState(false);
    const [collapsedCategories, setCollapsedCategories] = useState<{ [cat: string]: boolean }>({});
    const [showTimelineRange, setShowTimelineRange] = useState(true);
    const [approvalModal, setApprovalModal] = useState<{ open: boolean; mode: 'warning' | 'admin_action'; taskId?: any; date?: string; taskName?: string }>({ open: false, mode: 'warning' });
    // PM Timeline lock: stays locked until Designer sets Masking to ONGOING or beyond
    const [maskingUnlocked, setMaskingUnlocked] = useState(type !== 'pm'); // designer/execution always unlocked
    const [pmLockedModal, setPmLockedModal] = useState(false);
    const [paymentModal, setPaymentModal] = useState<{ open: boolean; requiredPercent: number; stageName: string } | null>(null);

    const toggleCategoryCollapse = (cat: string) => {
        setCollapsedCategories(prev => ({
            ...prev,
            [cat]: !prev[cat]
        }));
    };

    const toggleExpandAll = () => {
        const allCollapsed = categoryOrder.length > 0 && categoryOrder.every(c => collapsedCategories[c]);
        if (allCollapsed) {
            setCollapsedCategories({});
        } else {
            const next: { [cat: string]: boolean } = {};
            categoryOrder.forEach(c => { next[c] = true; });
            setCollapsedCategories(next);
        }
    };

    const handleAddNewCategoryInline = () => {
        if (!newCatInput.trim()) return;
        let catName = newCatInput.trim();
        if (!/^\d+\./.test(catName)) {
            catName = `${categoryOrder.length + 1}. ${catName.toUpperCase()}`;
        }
        if (!categoryOrder.includes(catName)) {
            const newOrder = [...categoryOrder, catName];
            const newCustom = [...customCategories, catName];
            setCategoryOrder(newOrder);
            setCustomCategories(newCustom);
            // Auto-persist so it survives refresh
            persistState(tasks, completions, newOrder, newCustom);
        }
        // Just close — no need to fill the Assign form
        setNewCatInput('');
        setShowAddCatInput(false);
    };

    // ── Build 3-day-interval columns ──────────────────────────────────────
    let projStart = new Date(project.start_date);
    let projEnd = new Date(project.expected_end_date || new Date(projStart).setMonth(projStart.getMonth() + 3));

    tasks.forEach(t => {
        if (t.startDate) {
            const sd = new Date(t.startDate);
            if (sd < projStart) projStart = sd;
        }
        if (t.endDate) {
            const ed = new Date(t.endDate);
            if (ed > projEnd) projEnd = ed;
        }
    });

    const baseColDates = new Set<string>();

    // Generate base 3-day intervals from 1st of month
    const cur = new Date(projStart.getFullYear(), projStart.getMonth(), 1);
    while (cur <= projEnd) {
        const d = new Date(cur.getTime() - cur.getTimezoneOffset() * 60000).toISOString().split('T')[0];
        baseColDates.add(d);

        const currentMonth = cur.getMonth();
        cur.setDate(cur.getDate() + 3);
        if (cur.getMonth() !== currentMonth) {
            cur.setDate(1); // Reset to 1st of the new month
        }
    }

    // Inject any exact task dates that are missing from the base timeline
    tasks.forEach(t => {
        if (t.startDate) baseColDates.add(t.startDate);
        if (t.endDate) baseColDates.add(t.endDate);
    });

    // Sort chronologically and format for rendering
    const ALL_COLS = Array.from(baseColDates)
        .sort()
        .map(dateStr => {
            const d = new Date(dateStr);
            return { day: d.getDate(), date: dateStr };
        });

    // Month header groups
    const monthGroups: { label: string; count: number }[] = [];
    ALL_COLS.forEach(col => {
        const d = new Date(col.date);
        const lbl = d.toLocaleString('en-US', { month: 'long' }).toUpperCase();
        const last = monthGroups[monthGroups.length - 1];
        if (last && last.label === lbl) last.count++;
        else monthGroups.push({ label: lbl, count: 1 });
    });

    const EXECUTION_CATEGORIES = [
        "1. INITIAL WORKS", "2. FALSE CEILING", "3. ELECTRICAL CHIPPING",
        "4. PLUMBING/SANITARY", "5. PAINTING", "6. CARPENTRY",
        "7. GRANITE & TILES", "8. GLASS/MIRROR", "9. SANITARY & BATH",
        "10. ELECTRICAL FITMENTS", "11. FURNITURE", "12. DEEP CLEANING",
        "13.CURTAIN RODS AND CURTAINS", "14. HANDOVER"
    ];
    const EXECUTION_SUB_TASKS: any = {
        "1. INITIAL WORKS": ["Spreading floor mats", "Demolition", "Cleaning", "New civil works", "Flooring repair works"],
        "2. FALSE CEILING": ["Channelling", "AC piping, Ceiling Wiring", "Sheeting", "light cutting, light fixing"],
        "3. ELECTRICAL CHIPPING": ["Electrical chipping"],
        "4. PLUMBING/SANITARY": ["Plumbing/Sanitary"],
        "5. PAINTING": ["Painting on ceiling", "Painting on walls"],
        "6. CARPENTRY": ["Carpentry works"],
        "7. GRANITE & TILES": ["Granite works", "Tiles dado works"],
        "8. GLASS/MIRROR": ["Glass/mirror works"],
        "9. SANITARY & BATH": ["Sanitary & Bath fitments"],
        "10. ELECTRICAL FITMENTS": ["Lights/Fan fitment", "Ac Fitment"],
        "11. FURNITURE": ["Loose furniture/artefacts fixing"],
        "12. DEEP CLEANING": ["Deep cleaning"],
        "13.CURTAIN RODS AND CURTAINS": ["Curtain rods and curtains"],
        "14. HANDOVER": ["Handover"]
    };

    const DESIGNER_CATEGORIES = [
        "DD", "3D Approval", "2D", "QC1", "Masking",
        "Signoff", "Final 2D", "QC2", "Final Quote", "R2P"
    ];
    const DESIGNER_SUB_TASKS: any = {
        "DD": ["DD Design Phase"],
        "3D Approval": ["Get 3D Approval"],
        "2D": ["2D Drafting"],
        "QC1": ["Quality Control 1"],
        "Masking": ["Masking works"],
        "Signoff": ["Client Signoff"],
        "Final 2D": ["Final 2D Delivery"],
        "QC2": ["Quality Control 2"],
        "Final Quote": ["Prepare Final Quote"],
        "R2P": ["Ready to Production (R2P)"]
    };

    const PM_CATEGORIES = [
        "Product Distribution", "Ready to Dispatch", "In Transit", "Delivery",
        "Kickoff_M", "HDS", "Material Segregation", "QC", "Installation", "Final QC", "Handover"
    ];
    const PM_SUB_TASKS: any = {
        "Product Distribution": ["Product Distribution"],
        "Ready to Dispatch": ["Ready to Dispatch"],
        "In Transit": ["In Transit"],
        "Delivery": ["Delivery"],
        "Kickoff_M": ["Kickoff_M"],
        "HDS": ["HDS"],
        "Material Segregation": ["Material Segregation"],
        "QC": ["QC"],
        "Installation": ["Installation"],
        "Final QC": ["Final QC"],
        "Handover": ["Handover"]
    };

    const defaultCategories = type === 'pm' ? PM_CATEGORIES : (type === 'execution' ? EXECUTION_CATEGORIES : DESIGNER_CATEGORIES);
    const SUB_TASKS = type === 'pm' ? PM_SUB_TASKS : DESIGNER_SUB_TASKS;

    const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
    const [originalCategoryOrder, setOriginalCategoryOrder] = useState<string[]>([]);
    const [customCategories, setCustomCategories] = useState<string[]>([]);
    // Flag: true once fetchTimeline has restored server-saved category order
    const serverCategoryLoaded = useRef(false);

    useEffect(() => {
        // If server already restored the category order, don't overwrite it
        if (serverCategoryLoaded.current) return;
        const taskCats = tasks.map(t => t.category).filter(Boolean);
        const combined = Array.from(new Set([...defaultCategories, ...taskCats, ...customCategories]));
        setCategoryOrder(prev => {
            if (prev.length === 0) {
                setOriginalCategoryOrder(combined);
                return combined;
            }
            const newlyAdded = combined.filter(c => !prev.includes(c));
            const updated = [...prev, ...newlyAdded];
            setOriginalCategoryOrder(updated);
            return updated;
        });
    }, [tasks, type, customCategories]);

    const moveCategoryUp = (index: number) => {
        if (index <= 0) return;
        const newOrder = [...categoryOrder];
        const temp = newOrder[index];
        newOrder[index] = newOrder[index - 1];
        newOrder[index - 1] = temp;
        setCategoryOrder(newOrder);
    };

    const moveCategoryDown = (index: number) => {
        if (index >= categoryOrder.length - 1) return;
        const newOrder = [...categoryOrder];
        const temp = newOrder[index];
        newOrder[index] = newOrder[index + 1];
        newOrder[index + 1] = temp;
        setCategoryOrder(newOrder);
    };

    const handleRemoveCategory = (catToRemove: string) => {
        if (!window.confirm(`Are you sure you want to remove category "${catToRemove}"?`)) return;
        const updatedOrder = categoryOrder.filter(c => c !== catToRemove);
        const updatedCustom = customCategories.filter(c => c !== catToRemove);
        const updatedTasks = tasks.filter(t => t.category !== catToRemove);

        setCategoryOrder(updatedOrder);
        setCustomCategories(updatedCustom);
        setTasks(updatedTasks);

        persistState(updatedTasks, completions, updatedOrder, updatedCustom);
    };

    useEffect(() => { if (project?.project_id) fetchTimeline(); }, [project?.project_id]);
    // For PM timeline: check if designer has started Masking
    useEffect(() => {
        if (type === 'pm' && project?.project_id) {
            checkDesignerMaskingStatus();
        }
    }, [project?.project_id, type]);

    const checkDesignerMaskingStatus = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/controllers/timeline/state.php?project_id=${project.project_id}&type=designer`);
            if (res.data?.success) {
                const dTasks: any[] = res.data.tasks || [];
                const dCompletions: any = res.data.completions || {};
                const UNLOCKED_STATUSES = ['ongoing', 'pending_approval', 'done'];
                const maskingTasks = dTasks.filter((t: any) => t.category === 'Masking');
                let unlocked = false;
                if (maskingTasks.length === 0) {
                    // No masking tasks defined yet — check if any completion has masking-related ongoing
                    unlocked = false;
                } else {
                    unlocked = maskingTasks.some((t: any) => {
                        const dateMap = dCompletions[t.id] || {};
                        return Object.values(dateMap).some((s: any) => UNLOCKED_STATUSES.includes(s));
                    });
                }
                setMaskingUnlocked(unlocked);
            }
        } catch (e) {
            console.error('Failed to check designer masking status', e);
        }
    };

    const fetchTimeline = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/controllers/timeline/state.php?project_id=${project.project_id}&type=${type}`);
            if (res.data.success) {
                setTasks(res.data.tasks || []);
                setCompletions(res.data.completions || {});
                // Restore saved category order and custom categories
                if (res.data.categoryOrder && res.data.categoryOrder.length > 0) {
                    serverCategoryLoaded.current = true;  // prevent useEffect from overwriting
                    setCategoryOrder(res.data.categoryOrder);
                    setOriginalCategoryOrder(res.data.categoryOrder);
                }
                if (res.data.customCategories && res.data.customCategories.length > 0) {
                    setCustomCategories(res.data.customCategories);
                }
            }
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const persistState = async (t: any[], c: any, catOrder?: string[], customCats?: string[]) => {
        setSaveStatus('saving');
        try {
            await fetch(`${API_BASE_URL}/controllers/timeline/save-state.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    project_id: project.project_id,
                    tasks: t,
                    completions: c,
                    created_by: user.user_id,
                    type,
                    categoryOrder: catOrder ?? categoryOrder,
                    customCategories: customCats ?? customCategories
                })
            });
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2000);
        } catch (e) { setSaveStatus('idle'); }
    };

    const handleUpdateProjectDates = async () => {
        const minDate = projectStartDate || todayStr;
        if (projectEndDate && minDate && projectEndDate < minDate) {
            alert('Expected End Date cannot be earlier than Start Date (' + minDate + ')');
            return;
        }
        setUpdatingDates(true);
        try {
            const headMember = project?.team?.find((t: any) => t.assignment_role === 'project_head');
            const engineerMember = project?.team?.find((t: any) => t.assignment_role === 'site_engineer');
            const response = await axios.put(`${API_BASE_URL}/projects`, {
                project_id: project.project_id,
                project_name: project?.project_name || '',
                site_address: project?.site_address || '',
                start_date: projectStartDate,
                expected_end_date: projectEndDate,
                project_head_id: headMember?.user_id || project?.project_head_id || null,
                site_engineer_id: engineerMember?.user_id || null,
                status: project?.status || 'Pending',
                project_type: project?.project_type || 'Furniture projects'
            });
            if (response.data.success) {
                if (fetchProjectDetails) fetchProjectDetails();
                alert('Project timeline range updated successfully!');
            } else {
                alert(response.data.message);
            }
        } catch (err) {
            alert('Failed to update project dates');
        } finally {
            setUpdatingDates(false);
        }
    };

    const handleAddTask = (e: React.FormEvent) => {
        e.preventDefault();
        const rawCat = newTask.category === 'OTHER' ? newTask.customCategory.trim() : newTask.category;
        const finalName = newTask.name === 'OTHER' ? newTask.customName.trim() : newTask.name;

        if (!rawCat) return;

        // Auto-number custom categories if not numbered
        let finalCategory = rawCat;
        if (newTask.category === 'OTHER' && !/^\d+\./.test(rawCat)) {
            finalCategory = `${categoryOrder.length + 1}. ${rawCat.toUpperCase()}`;
        }

        const resolvedName = finalName || finalCategory;

        if (!finalCategory || !resolvedName || !newTask.startDate || !newTask.endDate) return;

        let newCustom = customCategories;
        let newOrder = categoryOrder;
        if (newTask.category === 'OTHER') {
            if (!customCategories.includes(finalCategory)) {
                newCustom = [...customCategories, finalCategory];
                setCustomCategories(newCustom);
            }
            if (!categoryOrder.includes(finalCategory)) {
                newOrder = [...categoryOrder, finalCategory];
                setCategoryOrder(newOrder);
            }
        }

        const updated = [...tasks, { id: Date.now(), category: finalCategory, name: resolvedName, startDate: newTask.startDate, endDate: newTask.endDate }];
        setTasks(updated);
        setNewTask({ category: '', customCategory: '', name: '', customName: '', startDate: '', endDate: '' });
        persistState(updated, completions, newOrder, newCustom);
    };

    const handleSaveEdit = () => {
        if (!editingTask) return;
        const updated = tasks.map(t => t.id === editingTask.id ? editingTask : t);
        setTasks(updated);
        setEditingTask(null);
        persistState(updated, completions);
    };

    const handleDeleteTask = (taskId: any) => {
        const updated = tasks.filter(t => t.id !== taskId);
        setTasks(updated);
        const newC = { ...completions };
        delete newC[taskId];
        setCompletions(newC);
        persistState(updated, newC);
    };

    const toggleStatus = (taskId: any, date: string, taskObj?: any) => {
        const targetTask = taskObj || tasks.find(t => String(t.id) === String(taskId));
        const taskName = targetTask?.name || 'Timeline Task';
        const isRealAdmin = ['admin', 'project_head', 'project_manager', 'manager'].includes(String(user?.role || '').toLowerCase());

        const totalBudget = project?.total_budget || 0;
        const paidPercent = totalBudget > 0 ? (totalPaid / totalBudget) * 100 : 0;

        const catNorm = String(targetTask?.category || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const nameNorm = String(targetTask?.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const isMasking = catNorm.includes('masking') || nameNorm.includes('masking');
        const isR2P = catNorm.includes('r2p') || nameNorm.includes('r2p') || catNorm.includes('readytopaint') || nameNorm.includes('readytopaint');
        const isDeliveryStage = ['productdistribution', 'readytodispatch', 'intransit', 'delivery', 'dispatch', 'transit'].some(k => catNorm.includes(k) || nameNorm.includes(k));
        const isHandover = catNorm.includes('handover') || nameNorm.includes('handover');

        // ─── Payment Gate Rules (cumulative %) ───────────────────────────
        // Designer Timeline has NO payment restriction (user requirement)
        if (type !== 'designer') {
            if (paidPercent < 10) {
                setPaymentModal({ open: true, requiredPercent: 10, stageName: 'Project Timeline' });
                return;
            }
            if (isMasking && paidPercent < 30) {
                setPaymentModal({ open: true, requiredPercent: 30, stageName: 'Masking Stage' });
                return;
            }
            if (isR2P && paidPercent < 60) {
                setPaymentModal({ open: true, requiredPercent: 60, stageName: 'R2P (Ready to Paint) Stage' });
                return;
            }
            if (isDeliveryStage && paidPercent < 95) {
                setPaymentModal({ open: true, requiredPercent: 95, stageName: 'Product Distribution / Delivery Stage' });
                return;
            }
            if (isHandover && paidPercent < 100) {
                setPaymentModal({ open: true, requiredPercent: 100, stageName: 'Handover Stage' });
                return;
            }
        }

        if (type === 'pm' && !maskingUnlocked) {
            setPmLockedModal(true);
            return;
        }

        // Determine current overall block status for this task
        const taskCompletions = completions[taskId] || {};
        const statuses = Object.values(taskCompletions) as string[];
        let cur = taskCompletions[date] || 'pending';
        if (statuses.includes('done')) cur = 'done';
        else if (statuses.includes('pending_approval')) cur = 'pending_approval';
        else if (statuses.includes('ongoing')) cur = 'ongoing';

        // IF TASK IS IN PENDING APPROVAL (Yellow):
        if (cur === 'pending_approval') {
            setApprovalModal({
                open: true,
                mode: 'warning',
                taskName
            });
            return;
        }

        // IF TASK IS DONE (Green) and user is not admin
        if (cur === 'done' && !isRealAdmin) {
            setApprovalModal({
                open: true,
                mode: 'warning',
                taskName
            });
            return;
        }

        let nextStatus = cur;
        if (cur === 'pending') {
            nextStatus = 'ongoing';
        } else if (cur === 'ongoing') {
            nextStatus = 'pending_approval';
        } else if (cur === 'done') {
            nextStatus = 'pending';
        }

        if (nextStatus === cur) return;

        const updatedTaskCompletions = { ...taskCompletions };

        // Single Block Update: Apply nextStatus across all dates in this task's date range
        if (targetTask && targetTask.startDate && targetTask.endDate) {
            const tStart = new Date(targetTask.startDate).getTime();
            const tEnd = new Date(targetTask.endDate).getTime();
            ALL_COLS.forEach(c => {
                const cTime = new Date(c.date).getTime();
                if (cTime >= tStart && cTime <= tEnd) {
                    updatedTaskCompletions[c.date] = nextStatus;
                }
            });
        }
        updatedTaskCompletions[date] = nextStatus;

        const newC = { ...completions, [taskId]: updatedTaskCompletions };
        setCompletions(newC);

        // AUTO-SAVE IMMEDIATELY to server so backend and Dashboard receive update
        persistState(tasks, newC);

        // If status transitioned to pending_approval, notify Admin and show popup modal
        if (nextStatus === 'pending_approval') {
            axios.post(`${API_BASE_URL}/notifications/notify-admin`, {
                title: 'Designer Timeline Task Approval Request',
                message: `Task '${taskName}' in project '${project?.project_name || 'Project'}' was submitted for approval.`
            }).catch(e => console.error(e));

            setApprovalModal({
                open: true,
                mode: 'warning',
                taskName
            });
        }
    };

    const handleAdminAcceptTask = (taskId: any, date: string) => {
        const targetTask = tasks.find(t => String(t.id) === String(taskId));
        const updatedTaskCompletions = { ...(completions[taskId] || {}) };

        if (targetTask && targetTask.startDate && targetTask.endDate) {
            const tStart = new Date(targetTask.startDate).getTime();
            const tEnd = new Date(targetTask.endDate).getTime();
            ALL_COLS.forEach(c => {
                const cTime = new Date(c.date).getTime();
                if (cTime >= tStart && cTime <= tEnd) {
                    updatedTaskCompletions[c.date] = 'done';
                }
            });
        }
        updatedTaskCompletions[date] = 'done';

        const newC = { ...completions, [taskId]: updatedTaskCompletions };
        setCompletions(newC);
        setApprovalModal({ open: false, mode: 'warning' });
        persistState(tasks, newC);
    };

    const getCellColor = (taskId: any, colDate: string, nextColDate: string | null, startDate: string, endDate: string) => {
        const cStart = new Date(colDate).getTime();
        const cEnd = nextColDate
            ? new Date(new Date(nextColDate).getTime() - 86400000).getTime()
            : new Date(new Date(colDate).getTime() + 2 * 86400000).getTime();

        const tStart = new Date(startDate).getTime();
        const tEnd = new Date(endDate).getTime();

        const overlaps = cStart <= tEnd && cEnd >= tStart;
        if (!overlaps) return "transparent";

        const taskCompletions = completions[taskId] || {};
        const cellStatus = taskCompletions[colDate];
        const statuses = Object.values(taskCompletions) as string[];

        if (cellStatus === 'done' || statuses.includes('done')) return "#70AD47"; // Green
        if (cellStatus === 'pending_approval' || statuses.includes('pending_approval')) return "#EAB308"; // Yellow
        if (cellStatus === 'ongoing' || statuses.includes('ongoing')) return "#F97316"; // Orange

        return colDate < todayStr ? "#EF4444" : "#A6A6A6";
    };

    const handleSyncDatesFromStageNotes = (category: string, startDate: string, endDate: string) => {
        const catClean = String(category || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        let changed = false;
        const updatedTasks = tasks.map(t => {
            const tCat = String(t.category || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const tName = String(t.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            if (tCat === catClean || tName === catClean || tCat.includes(catClean) || catClean.includes(tCat)) {
                changed = true;
                return {
                    ...t,
                    startDate: startDate || t.startDate,
                    endDate: endDate || t.endDate
                };
            }
            return t;
        });
        if (changed) {
            setTasks(updatedTasks);
            persistState(updatedTasks, completions);
        }
    };

    if (loading) return <div style={{ textAlign: 'center', padding: '40px' }}><Loader2 className="animate-spin" style={{ margin: '0 auto' }} /></div>;

    const totalBudget = project?.total_budget || 0;
    const paidPercent = totalBudget > 0 ? (totalPaid / totalBudget) * 100 : 0;

    return (
        <div className="timeline-container" style={{ backgroundColor: "white", padding: "40px", width: "100%", border: "1px solid #000", boxShadow: "0 10px 25px rgba(0,0,0,0.1)", position: 'relative' }}>

            {/* PM Timeline Banners (Image 4 from Reference) */}
            {type === 'pm' && paidPercent < 60 && (
                <div style={{
                    backgroundColor: '#fff7ed',
                    border: '1.5px solid #fed7aa',
                    borderRadius: '12px',
                    padding: '16px 20px',
                    marginBottom: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <span style={{ fontSize: '24px' }}>🔒</span>
                        <div>
                            <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#9a3412', marginBottom: '3px' }}>
                                Production (60%) &amp; Product Distribution — STAGE LOCKED
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#c2410c', marginBottom: '4px' }}>
                                QC Approved + 60% Stage Payment Required to Unlock Product Distribution &amp; R2P
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#7c2d12', fontWeight: 600 }}>
                                Stage Amount (40%): ₹{(totalBudget * 0.40).toLocaleString('en-IN', { maximumFractionDigits: 0 })} &nbsp;|&nbsp; Cumulative Target (60%): ₹{(totalBudget * 0.60).toLocaleString('en-IN', { maximumFractionDigits: 0 })} &nbsp;|&nbsp; Paid so far: {paidPercent.toFixed(1)}% (₹{totalPaid.toLocaleString('en-IN')})
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setPaymentModal({ open: true, requiredPercent: 60, stageName: 'Production & Product Distribution' })}
                        style={{
                            backgroundColor: '#ea580c',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '10px 18px',
                            fontWeight: 700,
                            fontSize: '0.82rem',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                    >
                        💳 Pay 40% Stage Payment (₹{(totalBudget * 0.40).toLocaleString('en-IN', { maximumFractionDigits: 0 })})
                    </button>
                </div>
            )}

            {type === 'pm' && !maskingUnlocked && (
                <div style={{
                    backgroundColor: '#fefce8',
                    border: '1.5px solid #fef08a',
                    borderRadius: '12px',
                    padding: '14px 20px',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px'
                }}>
                    <span style={{ fontSize: '22px' }}>🔒</span>
                    <div>
                        <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#854d0e', marginBottom: '3px' }}>
                            PM Timeline is LOCKED
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#a16207' }}>
                            Unlocks automatically once the <strong>Designer</strong> starts the <strong>Masking</strong> stage (<strong>ONGOING</strong>).
                        </div>
                    </div>
                </div>
            )}

            {/* Payment Gate Modal Popup */}
            {paymentModal?.open && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 9999
                }}>
                    <div style={{
                        background: '#fff',
                        borderRadius: '16px',
                        padding: '36px 40px',
                        maxWidth: '440px',
                        width: '90%',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                        textAlign: 'center'
                    }}>
                        <div style={{ fontSize: '48px', marginBottom: '12px' }}>💳</div>
                        <h2 style={{ margin: '0 0 8px', fontSize: '1.3rem', fontWeight: 900, color: '#991b1b' }}>
                            PAYMENT NOT PAID
                        </h2>
                        <p style={{ margin: '0 0 6px', color: '#64748b', fontSize: '0.9rem' }}>
                            <strong>{paymentModal.stageName}</strong> requires at least
                        </p>
                        <div style={{
                            background: '#fef2f2',
                            border: '2px solid #fca5a5',
                            borderRadius: '10px',
                            padding: '16px',
                            margin: '16px 0'
                        }}>
                            <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#dc2626', lineHeight: 1 }}>
                                {paymentModal.requiredPercent}%
                            </div>
                            <div style={{ fontSize: '0.82rem', color: '#b91c1c', marginTop: '4px' }}>
                                of total project budget to be paid
                            </div>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '20px', lineHeight: 1.6 }}>
                            Current payment: <strong style={{ color: '#dc2626' }}>{paidPercent.toFixed(1)}%</strong> ({' '}
                            ₹{totalPaid.toLocaleString()} of ₹{(totalBudget || 0).toLocaleString()}).<br />
                            Please record the payment in the <strong>Balance Sheet</strong> tab first.
                        </div>
                        <button
                            onClick={() => setPaymentModal(null)}
                            style={{
                                padding: '12px 32px',
                                background: 'linear-gradient(135deg, #dc2626, #991b1b)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '8px',
                                fontWeight: 800,
                                fontSize: '0.95rem',
                                cursor: 'pointer',
                                width: '100%'
                            }}
                        >
                            OK, Got It
                        </button>
                    </div>
                </div>
            )}


            {/* Top action bar */}

            <div className="no-print" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginBottom: '20px' }}>
                <button
                    onClick={() => persistState(tasks, completions)}
                    disabled={saveStatus === 'saving'}
                    style={{
                        padding: '9px 20px',
                        background: saveStatus === 'saved' ? '#f1f5f9' : '#ffffff',
                        color: '#1e293b',
                        border: '1.5px solid #cbd5e1',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '7px',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                        transition: 'all 0.15s'
                    }}
                >
                    <Save size={16} />
                    {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? '✓ Saved' : 'Save Timeline'}
                </button>
                <button
                    onClick={() => window.print()}
                    style={{
                        padding: '9px 20px',
                        background: '#ffffff',
                        color: '#1e293b',
                        border: '1.5px solid #cbd5e1',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '7px',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
                    }}
                >
                    <Printer size={16} /> Print
                </button>
                <button
                    onClick={toggleExpandAll}
                    style={{
                        padding: '9px 20px',
                        background: '#ffffff',
                        color: '#1e293b',
                        border: '1.5px solid #cbd5e1',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '7px',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
                    }}
                >
                    {categoryOrder.length > 0 && categoryOrder.every(c => collapsedCategories[c])
                        ? <><ChevronDown size={16} /> Expand All</>
                        : <><ChevronRight size={16} /> Collapse All</>
                    }
                </button>
            </div>

            {/* Admin Controls */}
            {isAdmin && (
                <div style={{ display: 'flex', gap: '24px', marginBottom: '36px' }} className="no-print">

                    {/* Assign Work Form Card */}
                    <div style={{
                        flex: 1,
                        padding: '24px',
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '14px',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ padding: '8px', borderRadius: '8px', background: '#f1f5f9', color: '#0f172a' }}>
                                    <Layers size={20} />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>Assign Work Schedule</h3>
                                    <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#64748b' }}>Configure categories, works, and timeline dates</p>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '10px' }}>
                                {!showAddCatInput && (
                                    <button
                                        type="button"
                                        onClick={() => setShowAddCatInput(true)}
                                        style={{
                                            border: '1px solid #e2e8f0',
                                            background: '#f8fafc',
                                            color: '#374151',
                                            fontSize: '0.78rem',
                                            fontWeight: 600,
                                            borderRadius: '7px',
                                            cursor: 'pointer',
                                            padding: '6px 12px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '5px'
                                        }}
                                    >
                                        <Plus size={13} /> Add Category
                                    </button>
                                )}
                                {!showReorderPanel && (
                                    <button
                                        type="button"
                                        onClick={() => setShowReorderPanel(true)}
                                        style={{
                                            border: '1px solid #e2e8f0',
                                            background: '#f8fafc',
                                            color: '#374151',
                                            fontSize: '0.78rem',
                                            fontWeight: 600,
                                            borderRadius: '7px',
                                            cursor: 'pointer',
                                            padding: '6px 12px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '5px'
                                        }}
                                    >
                                        <ArrowUpDown size={13} /> Re-order
                                    </button>
                                )}
                            </div>
                        </div>

                        {showAddCatInput && (
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <input
                                    type="text"
                                    placeholder="Category Name (e.g. 11. EXTRA CARPENTRY)..."
                                    value={newCatInput}
                                    onChange={(e) => setNewCatInput(e.target.value)}
                                    style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.88rem', outline: 'none', accentColor: '#374151', color: '#1e293b' }}
                                />
                                <button
                                    type="button"
                                    onClick={handleAddNewCategoryInline}
                                    style={{ backgroundColor: '#374151', color: 'white', border: 'none', borderRadius: '6px', padding: '8px 16px', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}
                                >
                                    Save
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setShowAddCatInput(false); setNewCatInput(''); }}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontWeight: 700, fontSize: '1rem', padding: '0 4px' }}
                                >
                                    ✕
                                </button>
                            </div>
                        )}

                        {showReorderPanel && (
                            <div style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '16px', marginBottom: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                                <div style={{ fontSize: '0.85rem', fontWeight: 800, marginBottom: '10px', color: '#0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><ArrowUpDown size={16} /> Re-order Dropdown & Timeline Categories</span>
                                    <button type="button" onClick={() => setShowReorderPanel(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold', color: '#64748b' }}>✕</button>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto', paddingRight: '4px' }}>
                                    {categoryOrder.map((cat, idx) => (
                                        <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>{idx + 1}. {cat.replace(/^\d+\.\s*/, '')}</span>
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => moveCategoryUp(idx)}
                                                    disabled={idx === 0}
                                                    style={{ padding: '4px 10px', fontSize: '0.78rem', fontWeight: 700, borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#f1f5f9', color: '#0f172a', cursor: idx === 0 ? 'not-allowed' : 'pointer', opacity: idx === 0 ? 0.3 : 1, display: 'flex', alignItems: 'center', gap: '4px' }}
                                                >
                                                    <ArrowUp size={12} /> Move Up
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => moveCategoryDown(idx)}
                                                    disabled={idx === categoryOrder.length - 1}
                                                    style={{ padding: '4px 10px', fontSize: '0.78rem', fontWeight: 700, borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#f1f5f9', color: '#0f172a', cursor: idx === categoryOrder.length - 1 ? 'not-allowed' : 'pointer', opacity: idx === categoryOrder.length - 1 ? 0.3 : 1, display: 'flex', alignItems: 'center', gap: '4px' }}
                                                >
                                                    <ArrowDown size={12} /> Move Down
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveCategory(cat)}
                                                    title="Remove Category"
                                                    style={{ padding: '4px 8px', fontSize: '0.78rem', fontWeight: 700, borderRadius: '6px', border: '1px solid #fca5a5', backgroundColor: '#fef2f2', color: '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                >
                                                    <Trash2 size={12} /> Remove
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ display: 'flex', gap: '10px', marginTop: '14px', borderTop: '1px solid #e2e8f0', paddingTop: '12px', justifyContent: 'flex-end' }}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setCategoryOrder(originalCategoryOrder);
                                            alert('Category order reset to previous saved state.');
                                        }}
                                        style={{
                                            padding: '6px 12px',
                                            borderRadius: '6px',
                                            border: '1px solid #cbd5e1',
                                            backgroundColor: '#ffffff',
                                            color: '#475569',
                                            fontSize: '0.8rem',
                                            fontWeight: 600,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Reset Order
                                    </button>
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            await persistState(tasks, completions, categoryOrder, customCategories);
                                            setOriginalCategoryOrder(categoryOrder);
                                            alert('Category order saved successfully!');
                                        }}
                                        style={{
                                            padding: '6px 14px',
                                            borderRadius: '6px',
                                            border: 'none',
                                            backgroundColor: '#10b981',
                                            color: '#ffffff',
                                            fontSize: '0.8rem',
                                            fontWeight: 700,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Save Order
                                    </button>
                                </div>
                            </div>
                        )}

                        <form onSubmit={handleAddTask} className="work-schedule-form">
                            <div>
                                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: '5px' }}>Select Category</label>
                                <select
                                    value={newTask.category}
                                    onChange={e => setNewTask({ ...newTask, category: e.target.value, name: e.target.value === 'OTHER' ? 'OTHER' : '' })}
                                    style={{ width: '100%', padding: '9px 10px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: '#ffffff', fontWeight: 500, fontSize: '0.88rem', outline: 'none', color: '#1e293b', accentColor: '#374151' }}
                                >
                                    <option value="">-- Choose Category --</option>
                                    {categoryOrder.map(c => <option key={c} value={c}>{c}</option>)}
                                    <option value="OTHER">+ Other (Add Custom)</option>
                                </select>
                                {newTask.category === 'OTHER' && (
                                    <input
                                        type="text"
                                        value={newTask.customCategory}
                                        onChange={e => setNewTask({ ...newTask, customCategory: e.target.value })}
                                        placeholder="Enter custom category name..."
                                        style={{ width: '100%', marginTop: '6px', padding: '9px 10px', borderRadius: '6px', border: '1px solid #d1d5db', outline: 'none', fontSize: '0.88rem', color: '#1e293b' }}
                                    />
                                )}
                            </div>

                            {newTask.category !== 'OTHER' && (
                                <div>
                                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: '5px' }}>Work Name (Optional)</label>
                                    <select
                                        value={newTask.name}
                                        onChange={e => setNewTask({ ...newTask, name: e.target.value })}
                                        disabled={!newTask.category}
                                        style={{ width: '100%', padding: '9px 10px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: !newTask.category ? '#f9fafb' : '#ffffff', fontWeight: 500, fontSize: '0.88rem', outline: 'none', color: '#1e293b', accentColor: '#374151' }}
                                    >
                                        <option value="">-- Sub-Work (Optional) --</option>
                                        {newTask.category && newTask.category !== 'OTHER' && SUB_TASKS[newTask.category]?.map((s: string) => <option key={s} value={s}>{s}</option>)}
                                        {newTask.category && <option value="OTHER">+ Other (Custom)</option>}
                                    </select>
                                    {newTask.name === 'OTHER' && (
                                        <input
                                            type="text"
                                            value={newTask.customName}
                                            onChange={e => setNewTask({ ...newTask, customName: e.target.value })}
                                            placeholder="Enter custom work description..."
                                            style={{ width: '100%', marginTop: '6px', padding: '9px 10px', borderRadius: '6px', border: '1px solid #d1d5db', outline: 'none', fontSize: '0.88rem', color: '#1e293b' }}
                                        />
                                    )}
                                </div>
                            )}

                            <div>
                                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: '5px' }}>From Date</label>
                                <input
                                    type="date"
                                    value={newTask.startDate}
                                    onClick={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch (err) { } }}
                                    onChange={e => {
                                        const newStart = e.target.value;
                                        setNewTask(prev => ({
                                            ...prev,
                                            startDate: newStart,
                                            endDate: prev.endDate && newStart && prev.endDate < newStart ? newStart : prev.endDate
                                        }));
                                    }}
                                    style={{ width: '100%', padding: '9px 10px', borderRadius: '6px', border: '1px solid #d1d5db', outline: 'none', fontWeight: 500, color: '#1e293b', accentColor: '#374151', cursor: 'pointer' }}
                                />
                            </div>

                            <div>
                                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: '5px' }}>To Date</label>
                                <input
                                    type="date"
                                    min={newTask.startDate}
                                    value={newTask.endDate}
                                    onClick={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch (err) { } }}
                                    onChange={e => {
                                        const newEnd = e.target.value;
                                        if (newEnd && newTask.startDate && newEnd < newTask.startDate) {
                                            alert('To Date cannot be earlier than From Date (' + newTask.startDate + ')');
                                            return;
                                        }
                                        setNewTask(prev => ({ ...prev, endDate: newEnd }));
                                    }}
                                    style={{ width: '100%', padding: '9px 10px', borderRadius: '6px', border: '1px solid #d1d5db', outline: 'none', fontWeight: 500, color: '#1e293b', accentColor: '#374151', cursor: 'pointer' }}
                                />
                            </div>

                            <button
                                type="submit"
                                style={{
                                    padding: '9px 18px',
                                    background: '#1e293b',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '7px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    fontSize: '0.85rem'
                                }}
                            >
                                <Plus size={15} /> Assign Schedule
                            </button>
                        </form>
                    </div>

                    {/* Project Date Range Form Card - Accordion */}
                    <div style={{
                        width: '300px',
                        background: '#ffffff',
                        color: '#1e293b',
                        borderRadius: '12px',
                        border: '1.5px solid #e2e8f0',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.05)',
                        overflow: 'hidden'
                    }}>
                        {/* Clickable Header */}
                        <div
                            onClick={() => setShowTimelineRange(p => !p)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '16px 20px',
                                cursor: 'pointer',
                                userSelect: 'none',
                                borderBottom: showTimelineRange ? '1px solid #f1f5f9' : 'none',
                                background: '#f8fafc'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ padding: '7px', borderRadius: '7px', background: '#e2e8f0', color: '#475569' }}>
                                    <Calendar size={18} />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>Timeline Range</h3>
                                    {!showTimelineRange && projectStartDate ? (
                                        <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: '#64748b' }}>
                                            {projectStartDate} → {projectEndDate || '—'}
                                        </p>
                                    ) : (
                                        <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#64748b' }}>Project Duration</p>
                                    )}
                                </div>
                            </div>
                            <div style={{ color: '#94a3b8' }}>
                                {showTimelineRange ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                            </div>
                        </div>

                        {/* Collapsible Body */}
                        {showTimelineRange && (
                            <div style={{ padding: '16px 20px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div>
                                        <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '5px' }}>Start Date</label>
                                        <input
                                            type="date"
                                            value={projectStartDate}
                                            onClick={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch (err) { } }}
                                            onChange={e => {
                                                const newStart = e.target.value;
                                                setProjectStartDate(newStart);
                                                if (projectEndDate && newStart && projectEndDate < newStart) {
                                                    setProjectEndDate(newStart);
                                                }
                                            }}
                                            style={{ width: '100%', padding: '9px 12px', borderRadius: '7px', border: '1px solid #cbd5e1', color: '#1e293b', fontWeight: 700, outline: 'none', fontSize: '0.88rem', cursor: 'pointer' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '5px' }}>Expected End Date</label>
                                        <input
                                            type="date"
                                            min={projectStartDate || todayStr}
                                            value={projectEndDate}
                                            onClick={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch (err) { } }}
                                            onChange={e => {
                                                const newEnd = e.target.value;
                                                const minDate = projectStartDate || todayStr;
                                                if (newEnd && minDate && newEnd < minDate) {
                                                    alert('Expected End Date cannot be earlier than Start Date (' + minDate + ')');
                                                    return;
                                                }
                                                setProjectEndDate(newEnd);
                                            }}
                                            style={{ width: '100%', padding: '9px 12px', borderRadius: '7px', border: '1px solid #cbd5e1', color: '#1e293b', fontWeight: 700, outline: 'none', fontSize: '0.88rem', cursor: 'pointer' }}
                                        />
                                    </div>
                                </div>
                                <button
                                    onClick={handleUpdateProjectDates}
                                    disabled={updatingDates}
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        marginTop: '14px',
                                        backgroundColor: '#1e293b',
                                        color: '#ffffff',
                                        border: 'none',
                                        borderRadius: '7px',
                                        fontWeight: 700,
                                        fontSize: '0.85rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {updatingDates ? 'Updating...' : 'Update Project Dates'}
                                </button>
                            </div>
                        )}
                    </div>

                </div>
            )}

            {/* Document Header */}
            <div style={{ textAlign: "center", marginBottom: "30px", borderBottom: "3px solid #000", paddingBottom: "15px" }}>
                <h1 style={{ fontSize: "1.5rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "1.5px", margin: 0 }}>
                    TIMELINE — {project.project_name.toUpperCase()}
                </h1>
                <p style={{ fontSize: "0.7rem", color: "#666", marginTop: "5px" }}>Livincart ARCHITECTS AND INTERIOR DESIGNERS &nbsp;|&nbsp; Columns = 3-day intervals</p>
            </div>


            <div className="timeline-table-wrapper" style={{ overflowX: "auto", paddingBottom: "15px" }}>
                <table style={{ borderCollapse: "collapse", width: Math.max(1000, 255 + ALL_COLS.length * 28) + "px", border: "2px solid #000", tableLayout: "fixed" }}>
                    <thead>
                        <tr style={{ backgroundColor: "#F2F2F2" }}>
                            <th style={{ width: "35px", border: BORDER, fontSize: "0.65rem", padding: "5px" }}>No.</th>
                            <th style={{ width: "220px", border: BORDER, fontSize: "0.65rem", padding: "5px", textAlign: "left" }}>Work description</th>
                            {monthGroups.map((m, i) => (
                                <th key={i} colSpan={m.count} style={{ border: BORDER, fontSize: "0.7rem", padding: "5px", textTransform: "uppercase", backgroundColor: "#E2E8F0" }}>{m.label}</th>
                            ))}
                            {isAdmin && <th style={{ width: "60px", border: BORDER, fontSize: "0.6rem" }} className="no-print">Edit</th>}
                        </tr>
                        <tr style={{ backgroundColor: "#FFF" }}>
                            <th style={{ border: BORDER, borderBottom: "2px solid #000" }}></th>
                            <th style={{ border: BORDER, borderBottom: "2px solid #000", textAlign: "left", paddingLeft: "8px", fontSize: "0.6rem", color: "#666" }}>Dates →</th>
                            {ALL_COLS.map((c, i) => (
                                <th key={i} style={{ border: BORDER, borderRight: "1.5px solid #000", borderLeft: "1.5px solid #000", borderBottom: "2px solid #000", padding: "2px", fontSize: "0.6rem", minWidth: "28px", fontWeight: 700, backgroundColor: c.date === todayStr ? '#fef3c7' : 'transparent' }}>
                                    {c.day}
                                </th>
                            ))}
                            {isAdmin && <th style={{ border: BORDER, borderBottom: "2px solid #000" }} className="no-print"></th>}
                        </tr>
                    </thead>
                    <tbody>
                        {categoryOrder.map((cat, catIdx) => {
                            const catTasks = tasks.filter(t => t.category === cat);
                            const hasSubtasks = catTasks.some(t => t.name !== cat);
                            const isCollapsed = !!collapsedCategories[cat];

                            return (
                                <React.Fragment key={cat}>
                                    {(hasSubtasks || catTasks.length === 0) && (
                                        <tr style={{ backgroundColor: "#ffffff" }}>
                                            <td
                                                style={{ border: BORDER, borderBottom: "1.5px solid #000", textAlign: "center", fontWeight: 900, fontSize: "0.7rem", cursor: 'pointer', userSelect: 'none' }}
                                                onClick={() => toggleCategoryCollapse(cat)}
                                                title={isCollapsed ? 'Expand' : 'Collapse'}
                                            >
                                                {isCollapsed ? <ChevronRight size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> : <ChevronDown size={14} style={{ display: 'inline', verticalAlign: 'middle' }} />}
                                            </td>
                                            <td style={{ border: BORDER, borderRight: "1.5px solid #000", borderBottom: "1.5px solid #000", padding: "4px 8px", fontWeight: 900, fontSize: "0.75rem", textTransform: "uppercase", cursor: 'pointer' }} onClick={() => toggleCategoryCollapse(cat)}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                                                    {cat}
                                                    {isCollapsed && catTasks.length > 0 && (
                                                        <span style={{ fontSize: '0.65rem', fontWeight: 500, backgroundColor: '#94a3b8', color: '#fff', padding: '1px 7px', borderRadius: '20px', marginLeft: '6px' }}>
                                                            {catTasks.length} item{catTasks.length !== 1 ? 's' : ''} hidden
                                                        </span>
                                                    )}
                                                </span>
                                            </td>
                                            {ALL_COLS.map((_, i) => (
                                                <td key={i} style={{ border: BORDER, borderRight: "1.5px solid #000", borderLeft: "1.5px solid #000", borderBottom: "1.5px solid #000" }} />
                                            ))}
                                            {isAdmin && <td style={{ border: BORDER, borderBottom: "1.5px solid #000" }} className="no-print" />}
                                        </tr>
                                    )}
                                    {!isCollapsed && catTasks.map((task, ti) => {
                                        const isMainCatTask = task.name === cat && !hasSubtasks;
                                        return (
                                            <tr key={task.id} style={{ height: "30px", backgroundColor: "#ffffff" }}>
                                                <td style={{ border: BORDER, borderRight: "1.5px solid #000", borderBottom: "1.5px solid #000", textAlign: "center", fontSize: isMainCatTask ? "0.7rem" : "0.65rem", fontWeight: isMainCatTask ? 900 : "normal", color: isMainCatTask ? "#000" : "#666" }}>
                                                    {isMainCatTask ? `${catIdx + 1}` : `${catIdx + 1}.${ti + 1}`}
                                                </td>
                                                <td style={{ border: BORDER, borderRight: "1.5px solid #000", borderBottom: "1.5px solid #000", padding: "4px 8px", fontSize: "0.75rem", fontWeight: isMainCatTask ? 900 : 500, textTransform: isMainCatTask ? "uppercase" : "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                    {task.name}
                                                </td>
                                                {ALL_COLS.map((col, i) => {
                                                    const nextColDate = ALL_COLS[i + 1]?.date || null;
                                                    return (
                                                        <td key={i} onClick={() => toggleStatus(task.id, col.date, task)}
                                                            style={{ border: BORDER, borderRight: "1.5px solid #000", borderBottom: "1.5px solid #000", backgroundColor: getCellColor(task.id, col.date, nextColDate, task.startDate, task.endDate), cursor: "pointer", transition: "background 0.1s" }}
                                                        />
                                                    );
                                                })}
                                                {isAdmin && (
                                                    <td style={{ border: BORDER, borderBottom: "1.5px solid #000", textAlign: "center", padding: "2px" }} className="no-print">
                                                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                                            <button onClick={() => setEditingTask({ ...task })} title="Edit dates" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', padding: '2px' }}><Edit2 size={13} /></button>
                                                            <button onClick={() => handleDeleteTask(task.id)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '2px' }}><X size={13} /></button>
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </React.Fragment>
                            );
                        })}
                        <tr style={{ backgroundColor: "#F2F2F2", height: "35px" }}>
                            <td style={{ border: BORDER }}></td>
                            <td style={{ border: BORDER, padding: "4px 8px", fontSize: "0.75rem", fontWeight: 900, textTransform: "uppercase" }}>Total project time</td>
                            {ALL_COLS.map((_, i) => <td key={i} style={{ border: BORDER, backgroundColor: "#F2F2F2" }} />)}
                            {isAdmin && <td style={{ border: BORDER }} className="no-print" />}
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Legend */}
            <div style={{ marginTop: "30px", display: "flex", gap: "25px", flexWrap: "wrap" }}>
                {[
                    ["#70AD47", "COMPLETED"],
                    ["#F97316", "ONGOING"],
                    ["#EAB308", "PENDING APPROVAL"],
                    ["#EF4444", "OVERDUE"],
                    ["#A6A6A6", "PLANNED"]
                ].map(([color, label]) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ width: 18, height: 18, backgroundColor: color, border: BORDER }} />
                        <span style={{ fontSize: "0.75rem", fontWeight: 700 }}>{label}</span>
                    </div>
                ))}
            </div>

            {/* Stage Notes & Active Notes (Images 2, 3, 4, 5) — Rendered for both Designer and PM Timeline */}
            <div style={{ marginTop: '36px' }} className="no-print">
                <hr style={{ border: 'none', borderTop: '2px solid #e2e8f0', marginBottom: '28px' }} />
                <StageNotesTab
                    project={project}
                    user={user}
                    filterType={type === 'pm' ? 'pm' : 'designer'}
                    timelineTasks={tasks}
                    timelineCategories={categoryOrder}
                    onSyncDatesToTimeline={handleSyncDatesFromStageNotes}
                />
            </div>

            {/* Edit Task Modal */}
            {editingTask && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
                    <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '30px', width: '420px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
                        <h3 style={{ marginBottom: '20px', fontWeight: 700, fontSize: '1.1rem' }}>Edit Task Dates</h3>
                        <p style={{ fontWeight: 600, color: '#253b50', marginBottom: '16px' }}>{editingTask.name}</p>
                        <div style={{ marginBottom: '14px' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>From Date</label>
                            <input
                                type="date"
                                value={editingTask.startDate}
                                onClick={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch (err) { } }}
                                onChange={e => {
                                    const newStart = e.target.value;
                                    setEditingTask({
                                        ...editingTask,
                                        startDate: newStart,
                                        endDate: editingTask.endDate && newStart && editingTask.endDate < newStart ? newStart : editingTask.endDate
                                    });
                                }}
                                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', cursor: 'pointer' }}
                            />
                        </div>
                        <div style={{ marginBottom: '24px' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>To Date</label>
                            <input
                                type="date"
                                min={editingTask.startDate}
                                value={editingTask.endDate}
                                onClick={(e) => { try { (e.currentTarget as any).showPicker?.(); } catch (err) { } }}
                                onChange={e => {
                                    const newEnd = e.target.value;
                                    if (newEnd && editingTask.startDate && newEnd < editingTask.startDate) {
                                        alert('To Date cannot be earlier than From Date (' + editingTask.startDate + ')');
                                        return;
                                    }
                                    setEditingTask({ ...editingTask, endDate: newEnd });
                                }}
                                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', cursor: 'pointer' }}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setEditingTask(null)} style={{ padding: '10px 20px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: 'white', cursor: 'pointer' }}>Cancel</button>
                            <button onClick={handleSaveEdit} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Save size={16} /> Save Changes</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Pending Approval Modal Popup */}
            {approvalModal.open && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 99999,
                    padding: '20px'
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '16px',
                        maxWidth: '450px',
                        width: '100%',
                        padding: '28px',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                        border: '1px solid #e2e8f0',
                        textAlign: 'center'
                    }}>
                        {approvalModal.mode === 'warning' ? (
                            <>
                                <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#fef9c3', color: '#ca8a04', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
                                    <span style={{ fontSize: '28px' }}>⚠️</span>
                                </div>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: '0 0 10px 0' }}>
                                    Pending Admin Approval
                                </h3>
                                <p style={{ fontSize: '0.9rem', color: '#475569', lineHeight: 1.5, margin: '0 0 24px 0' }}>
                                    Task <strong>"{approvalModal.taskName}"</strong> is currently in <strong>PENDING APPROVAL</strong> status (Yellow color).
                                    <br /><br />
                                    It will remain in <strong>Pending Approval</strong> state until the Admin reviews and accepts it on the <strong>Dashboard</strong>.
                                    <br /><br />
                                    To approve and change the cell color to <strong>GREEN</strong>, go to <strong>Dashboard</strong> (<code>http://localhost:5174/overview</code>) &rarr; <strong>Timeline Approvals</strong> (after <i>My Monthly Targets</i>) and click <strong>Accept</strong>.
                                </p>
                                <button
                                    onClick={() => setApprovalModal({ open: false, mode: 'warning' })}
                                    style={{
                                        width: '100%',
                                        padding: '12px 20px',
                                        backgroundColor: '#253b50',
                                        color: '#ffffff',
                                        border: 'none',
                                        borderRadius: '10px',
                                        fontWeight: 700,
                                        fontSize: '0.95rem',
                                        cursor: 'pointer',
                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                    }}
                                >
                                    Understood
                                </button>
                            </>
                        ) : (
                            <>
                                <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
                                    <span style={{ fontSize: '28px' }}>📋</span>
                                </div>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: '0 0 10px 0' }}>
                                    Admin Approval Required
                                </h3>
                                <p style={{ fontSize: '0.9rem', color: '#475569', lineHeight: 1.5, margin: '0 0 24px 0' }}>
                                    Would you like to accept and approve task <strong>"{approvalModal.taskName}"</strong>?
                                    <br /><br />
                                    Accepting will change the status to <strong>COMPLETED</strong> and update the cell color to <strong>GREEN</strong>.
                                </p>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button
                                        onClick={() => setApprovalModal({ open: false, mode: 'warning' })}
                                        style={{
                                            flex: 1,
                                            padding: '12px',
                                            backgroundColor: '#f1f5f9',
                                            color: '#475569',
                                            border: '1px solid #cbd5e1',
                                            borderRadius: '10px',
                                            fontWeight: 700,
                                            fontSize: '0.9rem',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => handleAdminAcceptTask(approvalModal.taskId, approvalModal.date!)}
                                        style={{
                                            flex: 1,
                                            padding: '12px',
                                            backgroundColor: '#16a34a',
                                            color: '#ffffff',
                                            border: 'none',
                                            borderRadius: '10px',
                                            fontWeight: 700,
                                            fontSize: '0.9rem',
                                            cursor: 'pointer',
                                            boxShadow: '0 4px 6px -1px rgba(22, 163, 74, 0.2)'
                                        }}
                                    >
                                        ✓ Accept & Turn Green
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* PM Timeline Locked Popup Modal */}
            {pmLockedModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.65)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 99999, padding: '20px'
                }}>
                    <div style={{
                        backgroundColor: '#ffffff', borderRadius: '18px',
                        maxWidth: '440px', width: '100%', padding: '32px 28px',
                        boxShadow: '0 25px 40px rgba(0,0,0,0.25)',
                        border: '2px solid #93c5fd', textAlign: 'center'
                    }}>
                        <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px auto', fontSize: '32px' }}>
                            🔒
                        </div>
                        <h3 style={{ fontSize: '1.3rem', fontWeight: 900, color: '#1e3a5f', margin: '0 0 8px 0' }}>
                            PM Timeline — LOCKED
                        </h3>
                        <p style={{ fontSize: '0.88rem', color: '#475569', lineHeight: 1.7, margin: '0 0 12px 0' }}>
                            The <strong>Project Manager Timeline</strong> is currently <strong style={{ color: '#1e3a5f' }}>LOCKED</strong>.
                        </p>
                        <div style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: 1.6, padding: '12px 16px', backgroundColor: '#eff6ff', borderRadius: '10px', border: '1px solid #93c5fd', marginBottom: '24px', textAlign: 'left' }}>
                            <div>🎨 <strong>Designer</strong> must first set the <strong>Masking</strong> stage to <strong>ONGOING</strong> (Blue)</div>
                            <div style={{ marginTop: '6px' }}>🔓 Once Masking is <strong>ONGOING</strong>, this PM Timeline will <strong>automatically unlock</strong> and you can start working.</div>
                        </div>
                        <button
                            onClick={() => setPmLockedModal(false)}
                            style={{
                                width: '100%', padding: '13px 20px',
                                backgroundColor: '#1e3a5f', color: '#ffffff',
                                border: 'none', borderRadius: '10px',
                                fontWeight: 800, fontSize: '0.95rem',
                                cursor: 'pointer', boxShadow: '0 4px 10px rgba(30,58,95,0.3)'
                            }}
                        >
                            OK, Got It
                        </button>
                    </div>
                </div>
            )}

            <style>{`
                .work-schedule-form { display:grid; grid-template-columns:repeat(5,1fr); gap:10px; align-items:end; }
                @media (max-width:768px) { .work-schedule-form { grid-template-columns:1fr !important; } }
                .timeline-container input:focus,
                .timeline-container select:focus,
                .timeline-container textarea:focus {
                    outline: 1.5px solid #9ca3af !important;
                    box-shadow: none !important;
                    border-color: #9ca3af !important;
                }
                @media print {
                    @page { size: landscape; margin: 5mm; }
                    .print-only { display:flex !important; }
                    .timeline-container { border:none !important; box-shadow:none !important; padding: 0 !important; width: 100% !important; }
                    .timeline-table-wrapper { overflow: visible !important; width: 100% !important; }
                    .timeline-table-wrapper table { zoom: 0.65; }
                    .no-print { display:none !important; }
                }
            `}</style>
        </div>
    );
};
