import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
    Briefcase,
    UserPlus,
    TrendingUp,
    ArrowUpRight,
    Clock,
    Package,
    Wallet,
    SlidersHorizontal,
    X,
    Search,
    Eye,
    Check,
    XCircle,
    CheckCircle2,
    RotateCw,
    AlertCircle,
    ShieldCheck,
    Truck,
    HardHat,
    FileText,
    Download,
    Receipt
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { API_BASE_URL } from '../config';
import { DashboardFilterBar } from '../components/DashboardFilterBar';
import type { StatementPeriodType, ProjectTypeFilter } from '../components/DashboardFilterBar';

export const OverviewDashboard: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const isApproverRole = ['admin', 'owner', 'superadmin', 'accountant'].includes(String(user?.role || '').toLowerCase());
    const isDiscountApproverRole = ['admin', 'owner', 'superadmin', 'accountant', 'design_manager', 'business_manager', 'manager', 'project_manager'].includes(String(user?.role || '').toLowerCase()) ||
        String(user?.role || '').toLowerCase().includes('design manager') ||
        String(user?.role || '').toLowerCase().includes('business manager') ||
        user?.is_admin === true || user?.is_admin === 1;
    const [stats, setStats] = useState<any>(null);
    const [pendingClaims, setPendingClaims] = useState<any[]>([]);
    const [mbPendingTasks, setMbPendingTasks] = useState<any[]>([]);
    const [mbPendingCompletions, setMbPendingCompletions] = useState<any[]>([]);
    const [mbStats, setMbStats] = useState<any>(null);
    const [mbActiveTab, setMbActiveTab] = useState<'proposals' | 'completions'>('proposals');
    const [myTargets, setMyTargets] = useState<any[]>([]);
    const [allProjects, setAllProjects] = useState<any[]>([]);
    const [interiorTrackers, setInteriorTrackers] = useState<any[]>([]);
    const [architecturalTrackers, setArchitecturalTrackers] = useState<any[]>([]);
    const [timelineApprovals, setTimelineApprovals] = useState<any[]>([]);
    const [approvedTasks, setApprovedTasks] = useState<any[]>([]);
    const [rejectedTasks, setRejectedTasks] = useState<any[]>([]);
    const [taskCounts, setTaskCounts] = useState<{ pending: number; approved: number; rejected: number }>({
        pending: 0,
        approved: 0,
        rejected: 0
    });
    const [approvalTab, setApprovalTab] = useState<'pending' | 'approved' | 'rejected' | 'vendor_quota' | 'qc_approvals' | 'discount_approvals' | 'transport_approvals' | 'labor_approvals' | 'misc_approvals' | 'reimbursements_approvals'>('pending');
    const [pendingVendorApprovals, setPendingVendorApprovals] = useState<any[]>([]);
    const [pendingQCApprovals, setPendingQCApprovals] = useState<any[]>([]);
    const [pendingDiscountApprovals, setPendingDiscountApprovals] = useState<any[]>([]);
    const [adminMaxDiscount, setAdminMaxDiscount] = useState<number>(10);
    const [isUpdatingMaxDiscount, setIsUpdatingMaxDiscount] = useState<boolean>(false);
    const [newMaxDiscountInput, setNewMaxDiscountInput] = useState<string>('10');
    const [discountApprovalLoadingId, setDiscountApprovalLoadingId] = useState<number | null>(null);
    const [financeTransactions, setFinanceTransactions] = useState<any[]>([]);
    const [expenseFilterStatus, setExpenseFilterStatus] = useState<Record<string, 'pending' | 'approved' | 'rejected' | 'unpaid' | 'all'>>({
        Transport: 'pending',
        Labor: 'pending',
        Miscellaneous: 'pending',
        Reimbursements: 'pending'
    });
    const [viewReceiptModalUrl, setViewReceiptModalUrl] = useState<string | null>(null);
    const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
    const [approvingVendorId, setApprovingVendorId] = useState<number | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [statementPeriod, setStatementPeriod] = useState<StatementPeriodType>('all');
    const [projectType, setProjectType] = useState<ProjectTypeFilter>('all');
    const [customDates, setCustomDates] = useState<{ startDate: string; endDate: string }>({ startDate: '', endDate: '' });
    const [showFilters, setShowFilters] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const hasActiveFilters = statementPeriod !== 'all' || projectType !== 'all' || searchQuery.trim() !== '';

    // Build shared date query string
    const buildDateParams = () => {
        let params = `period=${statementPeriod}&project_type=${projectType}`;
        if (statementPeriod === 'custom' && customDates.startDate && customDates.endDate) {
            params += `&start_date=${customDates.startDate}&end_date=${customDates.endDate}`;
        }
        if (searchQuery.trim()) {
            params += `&search=${encodeURIComponent(searchQuery.trim())}`;
        }
        return params;
    };

    // Helper: client-side date check for a given date string vs current statementPeriod
    const matchesPeriod = (dateStr: string): boolean => {
        if (statementPeriod === 'all') return true;
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return true; // keep if date is unparseable
        const now = new Date();
        if (statementPeriod === 'last_month') return d >= new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        if (statementPeriod === 'last_3_months') return d >= new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        if (statementPeriod === 'last_6_months') return d >= new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
        if (statementPeriod === 'this_year') return d.getFullYear() === now.getFullYear();
        if (statementPeriod.startsWith('year_')) {
            const yr = parseInt(statementPeriod.replace('year_', ''));
            return d.getFullYear() === yr;
        }
        if (statementPeriod === 'custom' && customDates.startDate && customDates.endDate) {
            return d >= new Date(customDates.startDate) && d <= new Date(customDates.endDate + 'T23:59:59');
        }
        return true;
    };

    useEffect(() => {
        fetchDashboardData();
        fetchProjectsAndTrackers();
        fetchTimelineApprovals();
        const isApproverRole = ['admin', 'owner', 'superadmin', 'accountant'].includes(String(user?.role || '').toLowerCase());
    const isDiscountApproverRole = ['admin', 'owner', 'superadmin', 'accountant', 'design_manager', 'business_manager', 'manager', 'project_manager'].includes(String(user?.role || '').toLowerCase()) ||
        String(user?.role || '').toLowerCase().includes('design manager') ||
        String(user?.role || '').toLowerCase().includes('business manager') ||
        user?.is_admin === true || user?.is_admin === 1;
        if (isApproverRole) {
            fetchPendingClaims();
            fetchMBTasksAndStats();
            fetchPendingVendorApprovals();
            fetchPendingQCApprovals();
            fetchFinanceTransactions();
        }
        if (isApproverRole || isDiscountApproverRole) {
            fetchDiscountApprovals();
            fetchMaxDiscountSetting();
        }
    }, [statementPeriod, projectType, customDates, searchQuery]);

    // Live background polling & window focus sync (Updates automatically whenever anything changes)
    useEffect(() => {
        const pollInterval = setInterval(() => {
            fetchTimelineApprovals(true);
            fetchDashboardData(true);
            if (['admin', 'owner', 'superadmin', 'accountant'].includes(String(user?.role || '').toLowerCase())) {
                fetchPendingVendorApprovals();
                fetchPendingQCApprovals();
                fetchFinanceTransactions(true);
            }
            if (isApproverRole || isDiscountApproverRole) {
                fetchDiscountApprovals();
            }
        }, 8000);

        const handleFocus = () => {
            fetchTimelineApprovals(true);
            fetchDashboardData(true);
            if (['admin', 'owner', 'superadmin', 'accountant'].includes(String(user?.role || '').toLowerCase())) {
                fetchPendingVendorApprovals();
                fetchPendingQCApprovals();
                fetchFinanceTransactions(true);
            }
            if (isApproverRole || isDiscountApproverRole) {
                fetchDiscountApprovals();
            }
        };
        window.addEventListener('focus', handleFocus);

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                handleFocus();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        const handleTimelineSync = () => {
            fetchTimelineApprovals(true);
            fetchProjectsAndTrackers();
            fetchDashboardData(true);
        };
        window.addEventListener('livrcart-timeline-updated', handleTimelineSync);
        window.addEventListener('storage', handleTimelineSync);

        return () => {
            clearInterval(pollInterval);
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('livrcart-timeline-updated', handleTimelineSync);
            window.removeEventListener('storage', handleTimelineSync);
        };
    }, [statementPeriod, projectType, customDates, searchQuery]);

    const fetchDashboardData = async (silent: boolean = false) => {
        try {
            const response = await axios.get(`${API_BASE_URL}/dashboard?${buildDateParams()}&t=${Date.now()}`);
            setStats(response.data.data);
        } catch (err) {
            console.error('Error fetching dashboard stats');
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            if (user.role === 'admin') {
                fetchPendingClaims();
                fetchMBTasksAndStats();
                fetchPendingVendorApprovals();
                fetchPendingQCApprovals();
            }
            fetchMyTargets();
        }
    }, [user]);

    const fetchPendingVendorApprovals = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/vendor-quotas/pending-approvals`);
            if (res.data?.success) {
                setPendingVendorApprovals(res.data.data || []);
            }
        } catch (err) {
            console.error('Error fetching pending vendor approvals:', err);
        }
    };

    const handleApproveVendorQuota = async (item: any) => {
        if (!window.confirm(`Approve and Lock Vendor Quotation for "${item.vendor_name}" on Project "${item.project_name || item.project_id}"?`)) return;
        setApprovingVendorId(item.id);
        try {
            const res = await axios.post(`${API_BASE_URL}/vendor-quotas/send-approval`, {
                vendor_name: item.vendor_name,
                project_id: item.project_id,
                approval_status: 'Approved',
                user_role: user?.role || '',
                user_id: user?.user_id || ''
            }, {
                headers: {
                    'X-User-Id': user?.user_id || '',
                    'X-User-Role': user?.role || ''
                }
            });
            if (res.data?.success) {
                alert(res.data.message || 'Vendor Quota approved by Admin! Quotation is locked for execution.');
                fetchPendingVendorApprovals();
            } else {
                alert(res.data?.error || 'Failed to approve vendor quotation');
            }
        } catch (err: any) {
            alert(err?.response?.data?.error || 'Error approving vendor quotation');
        } finally {
            setApprovingVendorId(null);
        }
    };

    const fetchPendingQCApprovals = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/qc/pending-pm-approvals`);
            if (res.data?.success) {
                setPendingQCApprovals(res.data.data || []);
            }
        } catch (err) {
            console.error('Error fetching pending QC approvals:', err);
        }
    };

    const handleApproveQC = async (folder: any) => {
        if (!window.confirm(`Confirm Final Approval for ${folder.name || 'this version'} (${folder.project_name})?`)) return;
        try {
            const res = await axios.post(`${API_BASE_URL}/qc/pm-approve`, {
                folder_id: folder.folder_id,
                user_name: user?.name || 'Admin'
            });
            if (res.data?.success) {
                alert(res.data.message || 'Version approved successfully by Admin!');
                fetchPendingQCApprovals();
            } else {
                alert(res.data?.message || 'Failed to approve QC version');
            }
        } catch (err: any) {
            alert(err?.response?.data?.message || 'Error approving QC version');
        }
    };

    const handleRejectQC = async (folder: any) => {
        const reason = window.prompt(`Reject ${folder.name || 'this version'} for ${folder.project_name}?\n\nPlease enter rejection notes for the QC inspector:`, '');
        if (reason === null) return;
        try {
            const res = await axios.post(`${API_BASE_URL}/qc/pm-reject`, {
                folder_id: folder.folder_id,
                user_name: user?.name || 'Admin',
                notes: reason.trim()
            });
            if (res.data?.success) {
                alert(res.data.message || 'Version returned back to QC');
                fetchPendingQCApprovals();
            } else {
                alert(res.data?.message || 'Failed to reject QC version');
            }
        } catch (err: any) {
            alert(err?.response?.data?.message || 'Error rejecting QC version');
        }
    };

    const fetchDiscountApprovals = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/category-discounts/requests?status=all`);
            if (res.data?.success) {
                setPendingDiscountApprovals(res.data.data || []);
            }
        } catch (err) {
            console.error('Error fetching discount approvals:', err);
        }
    };

    const fetchMaxDiscountSetting = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/category-discounts/settings`);
            if (res.data?.success && res.data?.max_discount !== undefined) {
                setAdminMaxDiscount(Number(res.data.max_discount));
                setNewMaxDiscountInput(String(res.data.max_discount));
            }
        } catch (err) {
            console.error('Error fetching max discount setting:', err);
        }
    };

    const handleSaveMaxDiscountLimit = async () => {
        const val = parseFloat(newMaxDiscountInput);
        if (isNaN(val) || val < 0 || val > 100) {
            alert('Please enter a valid max discount percentage between 0% and 100%.');
            return;
        }
        setIsUpdatingMaxDiscount(true);
        try {
            const res = await axios.post(`${API_BASE_URL}/category-discounts/settings`, { max_discount: val });
            if (res.data?.success) {
                setAdminMaxDiscount(val);
                alert(`✅ Global Category Max Discount ceiling updated to ${val}% successfully! All employee quotations will enforce this limit.`);
            } else {
                alert(res.data?.message || 'Failed to update max discount limit');
            }
        } catch (err: any) {
            alert(err?.response?.data?.message || 'Error updating max discount limit');
        } finally {
            setIsUpdatingMaxDiscount(false);
        }
    };

    const handleApproveDiscountRequest = async (item: any) => {
        const clientDesc = item.client_name ? ` for "${item.client_name}"` : '';
        const projectDesc = item.project_name ? ` on project "${item.project_name}"` : '';
        if (!window.confirm(`Approve extra category discount request #${item.id}${clientDesc}${projectDesc}?`)) return;

        setDiscountApprovalLoadingId(item.id);
        try {
            const res = await axios.post(`${API_BASE_URL}/category-discounts/review-request`, {
                request_id: item.id,
                action: 'approved',
                reviewed_by_name: user?.name || 'Admin',
                reviewed_by_id: user?.user_id || user?.id || 'admin'
            });
            if (res.data?.success) {
                alert(res.data.message || 'Category discount request approved successfully!');
                fetchDiscountApprovals();
            } else {
                alert(res.data?.message || 'Failed to approve discount request');
            }
        } catch (err: any) {
            alert(err?.response?.data?.message || 'Error approving discount request');
        } finally {
            setDiscountApprovalLoadingId(null);
        }
    };

    const handleRejectDiscountRequest = async (item: any) => {
        const reason = window.prompt(`Reject extra category discount request #${item.id}?\n\nPlease enter rejection notes for the employee/designer:`, 'Exceeds maximum allowable category discount margin');
        if (reason === null) return;

        setDiscountApprovalLoadingId(item.id);
        try {
            const res = await axios.post(`${API_BASE_URL}/category-discounts/review-request`, {
                request_id: item.id,
                action: 'rejected',
                reviewed_by_name: user?.name || 'Admin',
                reviewed_by_id: user?.user_id || user?.id || 'admin',
                rejection_reason: reason.trim()
            });
            if (res.data?.success) {
                alert(res.data.message || 'Category discount request rejected.');
                fetchDiscountApprovals();
            } else {
                alert(res.data?.message || 'Failed to reject discount request');
            }
        } catch (err: any) {
            alert(err?.response?.data?.message || 'Error rejecting discount request');
        } finally {
            setDiscountApprovalLoadingId(null);
        }
    };

    const fetchFinanceTransactions = async (silent: boolean = false) => {
        try {
            const res = await axios.get(`${API_BASE_URL}/finance`);
            if (res.data?.success) {
                setFinanceTransactions(res.data.data || []);
            }
        } catch (err) {
            if (!silent) console.error('Error fetching finance transactions:', err);
        }
    };

    const isPendingExpense = (t: any) => {
        const s = String(t.approval_status || '').toLowerCase();
        return s === 'pending' || s === 'pending_approval';
    };
    const isUnpaidExpense = (t: any) => String(t.payment_status || '').toLowerCase() === 'unpaid' || String(t.payment_mode || '').toLowerCase() === 'unpaid';

    const getCategoryTransactions = (cat: 'Transport' | 'Labor' | 'Miscellaneous' | 'Reimbursements' | string) => {
        return (financeTransactions || []).filter((t: any) => {
            if (t.type && t.type !== 'debit') return false;
            const itemCat = String(t.category || '').toLowerCase();
            if (cat.toLowerCase() === 'reimbursements') {
                if (itemCat !== 'reimbursements' && itemCat !== 'reimbursement' && itemCat !== 'other' && itemCat !== 'staff expense') {
                    return false;
                }
            } else if (itemCat !== cat.toLowerCase()) {
                return false;
            }
            const isPending = isPendingExpense(t);
            // Pending expenses awaiting action must ALWAYS be visible regardless of date filters
            if (!isPending && !matchesPeriod(t.transaction_date || t.created_at || '')) return false;
            if (projectType !== 'all') {
                const pt = String(t.project_type || '').toLowerCase();
                if (projectType === 'interior' && !pt.includes('interior')) return false;
                if (projectType === 'furniture' && !pt.includes('furniture') && !pt.includes('architect')) return false;
                if (projectType === 'commercial' && !pt.includes('commercial')) return false;
            }
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const pName = String(t.project_name || '').toLowerCase();
                const pCode = String(t.project_code || t.project_id || '').toLowerCase();
                const person = String(t.person_name || '').toLowerCase();
                const desc = String(t.description || '').toLowerCase();
                const rem = String(t.remarks || '').toLowerCase();
                if (!pName.includes(q) && !pCode.includes(q) && !person.includes(q) && !desc.includes(q) && !rem.includes(q)) {
                    return false;
                }
            }
            return true;
        });
    };

    const transportList = useMemo(() => getCategoryTransactions('Transport'), [financeTransactions, statementPeriod, customDates, projectType, searchQuery]);
    const laborList = useMemo(() => getCategoryTransactions('Labor'), [financeTransactions, statementPeriod, customDates, projectType, searchQuery]);
    const miscList = useMemo(() => getCategoryTransactions('Miscellaneous'), [financeTransactions, statementPeriod, customDates, projectType, searchQuery]);
    const reimbursementsList = useMemo(() => getCategoryTransactions('Reimbursements'), [financeTransactions, statementPeriod, customDates, projectType, searchQuery]);

    const transportPendingCount = useMemo(() => transportList.filter(isPendingExpense).length, [transportList]);
    const laborPendingCount = useMemo(() => laborList.filter(isPendingExpense).length, [laborList]);
    const miscPendingCount = useMemo(() => miscList.filter(isPendingExpense).length, [miscList]);
    const reimbursementsPendingCount = useMemo(() => reimbursementsList.filter(isPendingExpense).length, [reimbursementsList]);

    const handleApproveFinanceExpense = async (tx: any) => {
        if (!window.confirm(`Approve ₹${parseFloat(tx.amount || 0).toLocaleString('en-IN')} ${tx.category} expense for "${tx.project_name || ('Project ' + tx.project_id)}"?`)) return;
        setActionLoadingId(tx.transaction_id);
        try {
            const res = await axios.post(`${API_BASE_URL}/finance/approve`, {
                transaction_id: tx.transaction_id,
                approved_by: user?.name || user?.username || 'Admin'
            });
            if (res.data?.success) {
                alert(res.data.message || `✓ ${tx.category} expense approved!`);
                fetchFinanceTransactions(true);
                fetchDashboardData(true);
            } else {
                alert(res.data?.message || 'Failed to approve expense');
            }
        } catch (err: any) {
            alert(err?.response?.data?.message || 'Error approving expense');
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleRejectFinanceExpense = async (tx: any) => {
        const reason = window.prompt(`Reject ${tx.category} expense of ₹${parseFloat(tx.amount || 0).toLocaleString('en-IN')} for "${tx.project_name || ('Project ' + tx.project_id)}"?\n\nOptional note/reason for rejection:`, '');
        if (reason === null) return;
        setActionLoadingId(tx.transaction_id);
        try {
            const res = await axios.post(`${API_BASE_URL}/finance/reject`, {
                transaction_id: tx.transaction_id,
                approved_by: user?.name || user?.username || 'Admin'
            });
            if (res.data?.success) {
                alert(res.data.message || `✕ ${tx.category} expense rejected`);
                fetchFinanceTransactions(true);
                fetchDashboardData(true);
            } else {
                alert(res.data?.message || 'Failed to reject expense');
            }
        } catch (err: any) {
            alert(err?.response?.data?.message || 'Error rejecting expense');
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleMarkFinanceExpensePaid = async (tx: any) => {
        if (!window.confirm(`Mark this ₹${parseFloat(tx.amount || 0).toLocaleString('en-IN')} ${tx.category} expense as Paid?`)) return;
        setActionLoadingId(tx.transaction_id);
        try {
            const res = await axios.post(`${API_BASE_URL}/finance/update`, {
                transaction_id: tx.transaction_id,
                payment_status: 'paid',
                payment_mode: String(tx.payment_mode || '').toLowerCase() === 'unpaid' ? 'Cash' : (tx.payment_mode || 'Cash'),
                date: new Date().toISOString().split('T')[0]
            });
            if (res.data?.success) {
                alert('✓ Payment status updated to Paid');
                fetchFinanceTransactions(true);
                fetchDashboardData(true);
            } else {
                alert(res.data?.message || 'Failed to update payment status');
            }
        } catch (err: any) {
            alert(err?.response?.data?.message || 'Error updating payment status');
        } finally {
            setActionLoadingId(null);
        }
    };

    const renderExpenseCategoryApprovalView = (
        categoryName: 'Transport' | 'Labor' | 'Miscellaneous' | 'Reimbursements' | string,
        categoryIcon: React.ReactNode,
        themeColor: string,
        themeBg: string,
        items: any[]
    ) => {
        const catKey = categoryName.toLowerCase();
        const subFilter = expenseFilterStatus[categoryName] || 'pending';

        const pendingList = items.filter(isPendingExpense);
        const approvedList = items.filter((t: any) => String(t.approval_status || 'approved').toLowerCase() === 'approved');
        const rejectedList = items.filter((t: any) => String(t.approval_status || '').toLowerCase() === 'rejected');
        const unpaidList = items.filter(isUnpaidExpense);

        const displayedList = subFilter === 'pending'
            ? pendingList
            : subFilter === 'approved'
            ? approvedList
            : subFilter === 'rejected'
            ? rejectedList
            : subFilter === 'unpaid'
            ? unpaidList
            : items;

        const totalPendingAmount = pendingList.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
        const totalApprovedAmount = approvedList.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
        const totalUnpaidAmount = unpaidList.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
        const totalAllAmount = items.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Header & Sub-filter Switcher */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px',
                    padding: '14px 18px',
                    borderRadius: '12px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            padding: '10px',
                            borderRadius: '10px',
                            backgroundColor: themeBg,
                            color: themeColor,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            {categoryIcon}
                        </div>
                        <div>
                            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0c1527', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>{categoryName} Approvals &amp; Ledger</span>
                                <span style={{
                                    fontSize: '0.74rem',
                                    fontWeight: 700,
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    backgroundColor: themeBg,
                                    color: themeColor
                                }}>
                                    {pendingList.length} Pending Approval
                                </span>
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                                Review and approve {categoryName.toLowerCase()} bills across all active projects before balance sheet entry
                            </div>
                        </div>
                    </div>

                    {/* Sub-filter Tabs */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', backgroundColor: '#ffffff', padding: '4px', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
                        {(['pending', 'approved', 'rejected', 'unpaid', 'all'] as const).map((st) => {
                            const isCurrent = subFilter === st;
                            const count = st === 'pending' ? pendingList.length
                                : st === 'approved' ? approvedList.length
                                : st === 'rejected' ? rejectedList.length
                                : st === 'unpaid' ? unpaidList.length
                                : items.length;
                            const label = st === 'pending' ? 'Pending Approval'
                                : st === 'approved' ? 'Approved'
                                : st === 'rejected' ? 'Rejected'
                                : st === 'unpaid' ? 'Unpaid'
                                : 'All Records';
                            return (
                                <button
                                    key={st}
                                    onClick={() => setExpenseFilterStatus(prev => ({ ...prev, [categoryName]: st }))}
                                    style={{
                                        border: 'none',
                                        backgroundColor: isCurrent ? themeColor : 'transparent',
                                        color: isCurrent ? '#ffffff' : '#475569',
                                        padding: '6px 13px',
                                        borderRadius: '7px',
                                        fontSize: '0.78rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        transition: 'all 0.15s'
                                    }}
                                >
                                    {label} ({count})
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Summary Metric Pills */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px' }}>
                    <div style={{ padding: '12px 16px', borderRadius: '10px', backgroundColor: '#fff7ed', border: '1px solid #fed7aa' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#c2410c', textTransform: 'uppercase' }}>⏳ Pending Approvals</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#9a3412', marginTop: '3px' }}>
                            ₹{totalPendingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#c2410c', marginTop: '2px' }}>{pendingList.length} expenses waiting for Admin approval</div>
                    </div>
                    <div style={{ padding: '12px 16px', borderRadius: '10px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>✓ Approved Amount</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#15803d', marginTop: '3px' }}>
                            ₹{totalApprovedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#166534', marginTop: '2px' }}>{approvedList.length} expenses approved &amp; balanced</div>
                    </div>
                    <div style={{ padding: '12px 16px', borderRadius: '10px', backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#991b1b', textTransform: 'uppercase' }}>✕ Unpaid Balance Due</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#dc2626', marginTop: '3px' }}>
                            ₹{totalUnpaidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#991b1b', marginTop: '2px' }}>{unpaidList.length} bills pending payment</div>
                    </div>
                    <div style={{ padding: '12px 16px', borderRadius: '10px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>📊 Total {categoryName} Spend</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0c1527', marginTop: '3px' }}>
                            ₹{totalAllAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>Across {items.length} logged records</div>
                    </div>
                </div>

                {/* Items List */}
                {displayedList.length === 0 ? (
                    <div style={{
                        padding: '40px 20px',
                        textAlign: 'center',
                        backgroundColor: '#f8fafc',
                        borderRadius: '12px',
                        border: '1.5px dashed #cbd5e1',
                        color: '#64748b'
                    }}>
                        <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🎉</div>
                        <div style={{ fontWeight: 700, color: '#0c1527', fontSize: '1rem' }}>
                            No {subFilter.replace('_', ' ')} {categoryName.toLowerCase()} records
                        </div>
                        <div style={{ fontSize: '0.84rem', marginTop: '4px' }}>
                            All {categoryName.toLowerCase()} entries in this status have been reviewed!
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {displayedList.map((item: any, idx: number) => {
                            const isPending = isPendingExpense(item);
                            const isRejected = item.approval_status === 'rejected';
                            const isApproved = item.approval_status === 'approved';
                            const isUnpaid = isUnpaidExpense(item);
                            const dateStr = item.transaction_date ? String(item.transaction_date).split(' ')[0] : (item.created_at ? String(item.created_at).split(' ')[0] : '-');
                            const isLoading = actionLoadingId === item.transaction_id;

                            return (
                                <div
                                    key={item.transaction_id || idx}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '12px',
                                        padding: '16px 20px',
                                        backgroundColor: '#ffffff',
                                        borderRadius: '12px',
                                        border: isPending ? '1.5px solid #fed7aa' : '1px solid #e2e8f0',
                                        boxShadow: isPending ? '0 3px 10px rgba(234, 88, 12, 0.05)' : '0 1px 3px rgba(0,0,0,0.03)'
                                    }}
                                >
                                    {/* Top Row: Project & Badges & Amount */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                <span
                                                    onClick={() => navigate(`/projects/${item.project_id}?tab=${catKey}`)}
                                                    style={{
                                                        fontSize: '1rem',
                                                        fontWeight: 800,
                                                        color: '#0c1527',
                                                        cursor: 'pointer',
                                                        textDecoration: 'underline',
                                                        textDecorationColor: '#cbd5e1'
                                                    }}
                                                    title={`Open Project ${catKey} tab`}
                                                >
                                                    {item.project_name || ('Project #' + item.project_id)}
                                                </span>
                                                <span style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 700, backgroundColor: '#f1f5f9', padding: '2px 8px', borderRadius: '6px' }}>
                                                    Code: {item.project_code || ('PRJ-' + item.project_id)}
                                                </span>
                                                <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
                                                    📅 {dateStr}
                                                </span>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                                                {/* Approval Status Badge */}
                                                <span style={{
                                                    fontSize: '0.72rem',
                                                    fontWeight: 800,
                                                    padding: '2px 8px',
                                                    borderRadius: '12px',
                                                    textTransform: 'uppercase',
                                                    backgroundColor: isPending ? '#fff7ed' : isApproved ? '#f0fdf4' : '#fef2f2',
                                                    color: isPending ? '#c2410c' : isApproved ? '#166534' : '#dc2626',
                                                    border: `1px solid ${isPending ? '#fed7aa' : isApproved ? '#bbf7d0' : '#fecaca'}`
                                                }}>
                                                    {isPending ? '⏳ Pending Approval' : isApproved ? '✓ Approved' : '✕ Rejected'}
                                                </span>

                                                {/* Payment Status Badge */}
                                                <span style={{
                                                    fontSize: '0.72rem',
                                                    fontWeight: 800,
                                                    padding: '2px 8px',
                                                    borderRadius: '12px',
                                                    textTransform: 'uppercase',
                                                    backgroundColor: isUnpaid ? '#fee2e2' : '#dcfce7',
                                                    color: isUnpaid ? '#991b1b' : '#15803d'
                                                }}>
                                                    {isUnpaid ? '✕ Unpaid' : '✓ Paid'}
                                                </span>

                                                {/* Mode badge */}
                                                <span style={{
                                                    fontSize: '0.72rem',
                                                    fontWeight: 600,
                                                    padding: '2px 8px',
                                                    borderRadius: '12px',
                                                    backgroundColor: '#f1f5f9',
                                                    color: '#475569'
                                                }}>
                                                    💳 {item.payment_mode || 'Cash'}
                                                </span>
                                            </div>
                                        </div>

                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#0c1527' }}>
                                                ₹{parseFloat(item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Middle Row: Payee, Description, Remarks */}
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                                        gap: '8px',
                                        padding: '10px 14px',
                                        backgroundColor: '#f8fafc',
                                        borderRadius: '8px',
                                        fontSize: '0.84rem'
                                    }}>
                                        <div>
                                            <span style={{ color: '#64748b', fontWeight: 600 }}>Payee / Vendor: </span>
                                            <strong style={{ color: '#0c1527' }}>{item.person_name || 'Not specified'}</strong>
                                        </div>
                                        <div>
                                            <span style={{ color: '#64748b', fontWeight: 600 }}>Description: </span>
                                            <span style={{ color: '#334155' }}>{item.description || '-'}</span>
                                        </div>
                                        {item.remarks && (
                                            <div>
                                                <span style={{ color: '#64748b', fontWeight: 600 }}>Remarks: </span>
                                                <span style={{ color: '#334155' }}>{item.remarks}</span>
                                            </div>
                                        )}
                                        {isApproved && item.approved_by && (
                                            <div>
                                                <span style={{ color: '#166534', fontWeight: 600 }}>Approved by: </span>
                                                <span style={{ color: '#166534' }}>
                                                    {item.approved_by}{item.approved_at ? ` (${new Date(item.approved_at).toLocaleDateString('en-IN')})` : ''}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Bottom Row: Receipt preview & Actions */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                                        <div>
                                            {item.receipt_image ? (
                                                <button
                                                    onClick={() => setViewReceiptModalUrl(item.receipt_image)}
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        padding: '5px 12px',
                                                        borderRadius: '6px',
                                                        backgroundColor: '#eff6ff',
                                                        border: '1px solid #bfdbfe',
                                                        color: '#1d4ed8',
                                                        fontSize: '0.78rem',
                                                        fontWeight: 700,
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    <FileText size={14} /> View Receipt / Bill Proof
                                                </button>
                                            ) : (
                                                <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>
                                                    No receipt attached
                                                </span>
                                            )}
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                            {/* Open in Project Button */}
                                            <button
                                                onClick={() => navigate(`/projects/${item.project_id}?tab=${catKey}`)}
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '5px',
                                                    padding: '7px 13px',
                                                    borderRadius: '8px',
                                                    backgroundColor: '#ffffff',
                                                    border: '1px solid #cbd5e1',
                                                    color: '#334155',
                                                    fontSize: '0.80rem',
                                                    fontWeight: 700,
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <Eye size={13} color="#64748b" /> Open in Project
                                            </button>

                                            {/* Mark Paid Button (if unpaid) */}
                                            {isUnpaid && (
                                                <button
                                                    disabled={isLoading}
                                                    onClick={() => handleMarkFinanceExpensePaid(item)}
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '5px',
                                                        padding: '7px 13px',
                                                        borderRadius: '8px',
                                                        backgroundColor: '#0284c7',
                                                        border: 'none',
                                                        color: '#ffffff',
                                                        fontSize: '0.80rem',
                                                        fontWeight: 700,
                                                        cursor: isLoading ? 'not-allowed' : 'pointer',
                                                        boxShadow: '0 1px 4px rgba(2, 132, 199, 0.25)'
                                                    }}
                                                >
                                                    Mark as Paid
                                                </button>
                                            )}

                                            {/* Approve Button */}
                                            {(!isApproved) && (
                                                <button
                                                    disabled={isLoading}
                                                    onClick={() => handleApproveFinanceExpense(item)}
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '5px',
                                                        padding: '7px 15px',
                                                        borderRadius: '8px',
                                                        backgroundColor: '#16a34a',
                                                        border: 'none',
                                                        color: '#ffffff',
                                                        fontSize: '0.80rem',
                                                        fontWeight: 800,
                                                        cursor: isLoading ? 'not-allowed' : 'pointer',
                                                        boxShadow: '0 2px 6px rgba(22, 163, 74, 0.25)'
                                                    }}
                                                    title="Approve this expense"
                                                >
                                                    <Check size={14} /> Approve
                                                </button>
                                            )}

                                            {/* Reject Button */}
                                            {(!isRejected) && (
                                                <button
                                                    disabled={isLoading}
                                                    onClick={() => handleRejectFinanceExpense(item)}
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '5px',
                                                        padding: '7px 15px',
                                                        borderRadius: '8px',
                                                        backgroundColor: '#dc2626',
                                                        border: 'none',
                                                        color: '#ffffff',
                                                        fontSize: '0.80rem',
                                                        fontWeight: 800,
                                                        cursor: isLoading ? 'not-allowed' : 'pointer',
                                                        boxShadow: '0 2px 6px rgba(220, 38, 38, 0.25)'
                                                    }}
                                                    title="Reject this expense"
                                                >
                                                    <XCircle size={14} /> Reject
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    const fetchMBTasksAndStats = async () => {
        try {
            const [tasksRes, statsRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/mb-tasks?${buildDateParams()}`),
                axios.get(`${API_BASE_URL}/mb-tasks/summary?${buildDateParams()}`)
            ]);
            if (tasksRes.data?.success) {
                const allTasks = tasksRes.data.data || [];
                setMbPendingTasks(allTasks.filter((t: any) => t.status === 'pending_admin_review'));
                setMbPendingCompletions(allTasks.filter((t: any) => t.status === 'pending_completion_review'));
            }
            if (statsRes.data?.success) {
                setMbStats(statsRes.data.data);
            }
        } catch (err) {
            console.error('Error loading M&B tasks in overview', err);
        }
    };

    const handleAcceptMBTask = async (id: number, notes: string = '') => {
        try {
            const res = await axios.post(`${API_BASE_URL}/mb-tasks/review`, {
                id,
                action: 'accept',
                notes
            });
            if (res.data?.success) {
                alert('Task approved successfully!');
                fetchMBTasksAndStats();
            } else {
                alert(res.data?.message || 'Failed to approve task');
            }
        } catch (err) {
            alert('Failed to approve task.');
        }
    };

    const promptAcceptMBTask = (id: number) => {
        const notes = prompt("Enter approval notes / comments (optional):");
        if (notes === null) return;
        handleAcceptMBTask(id, notes.trim());
    };

    const handleRejectMBTask = async (id: number, reason: string) => {
        try {
            const res = await axios.post(`${API_BASE_URL}/mb-tasks/review`, {
                id,
                action: 'reject',
                notes: reason
            });
            if (res.data?.success) {
                alert('Task rejected successfully!');
                fetchMBTasksAndStats();
            } else {
                alert(res.data?.message || 'Failed to reject task');
            }
        } catch (err) {
            alert('Failed to reject task.');
        }
    };

    const promptRejectMBTask = (id: number) => {
        const reason = prompt("Enter reason for rejection (required):");
        if (!reason || !reason.trim()) return;
        handleRejectMBTask(id, reason.trim());
    };



    const fetchPendingClaims = async () => {
        try {
            const headers = { 'X-User-Id': user?.user_id, 'X-User-Role': user?.role };
            const res = await axios.get(`${API_BASE_URL}/reimbursements?${buildDateParams()}`, { headers });
            if (res.data?.success) {
                let claims = (res.data.data || []).filter((r: any) => r.status === 'pending');
                // Client-side date filter
                claims = claims.filter((r: any) => matchesPeriod(r.created_at));
                // Search filter
                if (searchQuery.trim()) {
                    const q = searchQuery.toLowerCase();
                    claims = claims.filter((r: any) =>
                        (r.employee_name || '').toLowerCase().includes(q) ||
                        (r.category || '').toLowerCase().includes(q) ||
                        (r.reason || '').toLowerCase().includes(q)
                    );
                }
                setPendingClaims(claims);
            }
        } catch (err) {
            console.error('Error fetching pending claims', err);
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

    const fetchProjectsAndTrackers = async () => {
        try {
            const [projRes, intRes, archRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/projects?${buildDateParams()}`),
                axios.get(`${API_BASE_URL}/project-trackers?category=interior`),
                axios.get(`${API_BASE_URL}/project-trackers?category=architectural`)
            ]);
            if (projRes.data?.success) {
                let projects = projRes.data.data || [];
                // Project type filter
                if (projectType === 'furniture') {
                    projects = projects.filter((p: any) =>
                        (p.project_type || '').toLowerCase().includes('furniture') ||
                        (p.project_type || '').toLowerCase().includes('architectural')
                    );
                } else if (projectType === 'interior') {
                    projects = projects.filter((p: any) =>
                        (p.project_type || '').toLowerCase().includes('interior')
                    );
                }
                // Date filter using shared helper
                projects = projects.filter((p: any) => matchesPeriod(p.created_at || p.start_date || ''));
                // Search filter
                if (searchQuery.trim()) {
                    const q = searchQuery.toLowerCase();
                    projects = projects.filter((p: any) =>
                        (p.project_name || '').toLowerCase().includes(q) ||
                        (p.project_type || '').toLowerCase().includes(q) ||
                        (p.client_name || '').toLowerCase().includes(q)
                    );
                }
                setAllProjects(projects);
            }
            if (intRes.data?.success) setInteriorTrackers(intRes.data.data || []);
            if (archRes.data?.success) setArchitecturalTrackers(archRes.data.data || []);
        } catch (err) {
            console.error('Error loading projects/trackers status in overview', err);
        }
    };

    const fetchTimelineApprovals = async (silent: boolean = false) => {
        if (!silent) setIsRefreshing(true);
        try {
            const response = await axios.get(`${API_BASE_URL}/controllers/timeline/pending-approvals.php?t=${Date.now()}`);
            if (response.data?.success) {
                let pending = response.data.data || [];
                let approved = response.data.approved_tasks || [];
                let rejected = response.data.rejected_tasks || [];

                if (response.data.counts) {
                    setTaskCounts(response.data.counts);
                } else {
                    setTaskCounts({
                        pending: pending.length,
                        approved: approved.length,
                        rejected: rejected.length
                    });
                }

                // Search filter (if query typed)
                if (searchQuery.trim()) {
                    const q = searchQuery.toLowerCase();
                    const filterFn = (a: any) =>
                        (a.project_name || '').toLowerCase().includes(q) ||
                        (a.task_name || '').toLowerCase().includes(q) ||
                        (a.client_name || '').toLowerCase().includes(q);
                    pending = pending.filter(filterFn);
                    approved = approved.filter(filterFn);
                    rejected = rejected.filter(filterFn);
                }
                setTimelineApprovals(pending);
                setApprovedTasks(approved);
                setRejectedTasks(rejected);
            }
        } catch (error) {
            console.error('Error fetching timeline approvals:', error);
        } finally {
            if (!silent) setIsRefreshing(false);
        }
    };

    const promptApproveMBCompletion = async (taskId: string) => {
        try {
            const response = await axios.post(`${API_BASE_URL}/mb-completions/approve`, { task_id: taskId });
            if (response.data.success) {
                alert('Completion approved successfully');
                fetchMBTasksAndStats();
            }
        } catch (error) {
            console.error('Error approving completion:', error);
            alert('Failed to approve completion');
        }
    };

    const promptRejectMBCompletion = async (taskId: string) => {
        try {
            const response = await axios.post(`${API_BASE_URL}/mb-completions/reject`, { task_id: taskId });
            if (response.data.success) {
                alert('Completion rejected successfully');
                fetchMBTasksAndStats();
            }
        } catch (error) {
            console.error('Error rejecting completion:', error);
            alert('Failed to reject completion');
        }
    };

    const handleAcceptTimelineApproval = async (item: any) => {
        try {
            // Optimistic update for zero-latency UI
            setTimelineApprovals(prev => prev.filter(p => p.id !== item.id));
            setApprovedTasks(prev => [{ ...item, status: 'done' }, ...prev]);
            setTaskCounts(prev => ({
                ...prev,
                pending: Math.max(0, prev.pending - 1),
                approved: prev.approved + 1
            }));

            const res = await axios.post(`${API_BASE_URL}/controllers/timeline/pending-approvals.php`, {
                ...item,
                action: 'approve'
            });
            if (res.data?.success) {
                fetchTimelineApprovals(true);
                fetchProjectsAndTrackers();
                fetchDashboardData(true);
                window.dispatchEvent(new CustomEvent('livrcart-timeline-updated'));
                alert(`✓ Task "${item.task_name}" approved successfully and turned Green!`);
            } else {
                alert(res.data?.message || 'Failed to accept approval');
                fetchTimelineApprovals(true);
            }
        } catch (err) {
            alert('Failed to accept timeline approval');
            fetchTimelineApprovals(true);
        }
    };

    const handleRejectTimelineApproval = async (item: any) => {
        const reason = window.prompt(
            `Reject Task: "${item.task_name}" for "${item.project_name}"?\n\nThe status will return to In Progress (Ongoing) for the team to make revisions.\n\nOptional note/reason for rejection:`,
            ''
        );
        if (reason === null) return; // User clicked Cancel

        try {
            // Optimistic update for zero-latency UI
            setTimelineApprovals(prev => prev.filter(p => p.id !== item.id));
            setRejectedTasks(prev => [{ ...item, status: 'rejected' }, ...prev]);
            setTaskCounts(prev => ({
                ...prev,
                pending: Math.max(0, prev.pending - 1),
                rejected: prev.rejected + 1
            }));

            const res = await axios.post(`${API_BASE_URL}/controllers/timeline/pending-approvals.php`, {
                ...item,
                action: 'reject',
                reason: reason.trim()
            });
            if (res.data?.success) {
                fetchTimelineApprovals(true);
                fetchProjectsAndTrackers();
                fetchDashboardData(true);
                window.dispatchEvent(new CustomEvent('livrcart-timeline-updated'));
                alert(`✕ Task "${item.task_name}" rejected and returned for revision.`);
            } else {
                alert(res.data?.message || 'Failed to reject approval');
                fetchTimelineApprovals(true);
            }
        } catch (err) {
            alert('Failed to reject timeline approval');
            fetchTimelineApprovals(true);
        }
    };

    const handleReApproveTimelineTask = async (item: any) => {
        try {
            setRejectedTasks(prev => prev.filter(p => p.id !== item.id));
            setApprovedTasks(prev => [{ ...item, status: 'done' }, ...prev]);
            setTaskCounts(prev => ({
                ...prev,
                rejected: Math.max(0, prev.rejected - 1),
                approved: prev.approved + 1
            }));

            const res = await axios.post(`${API_BASE_URL}/controllers/timeline/pending-approvals.php`, {
                ...item,
                action: 'approve'
            });
            if (res.data?.success) {
                fetchTimelineApprovals(true);
                fetchProjectsAndTrackers();
                fetchDashboardData(true);
                window.dispatchEvent(new CustomEvent('livrcart-timeline-updated'));
                alert(`✓ Task "${item.task_name}" approved successfully!`);
            } else {
                alert(res.data?.message || 'Failed to approve task');
                fetchTimelineApprovals(true);
            }
        } catch (err) {
            alert('Failed to re-approve task');
            fetchTimelineApprovals(true);
        }
    };

    const scrollToApprovals = (tab: 'pending' | 'approved' | 'rejected') => {
        setApprovalTab(tab);
        const el = document.getElementById('timeline-approvals-section');
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const handleViewTimelineTask = (item: any) => {
        if (item.project_id) {
            const tab = item.type === 'pm' ? 'pm_timeline' : 'timeline';
            try {
                localStorage.setItem(`active_project_tab_${item.project_id}`, tab);
            } catch (e) { }
            navigate(`/projects/${item.project_id}?tab=${tab}`);
        } else if (item.source === 'tracker') {
            navigate(`/project-timelines?category=${item.category || 'interior'}&search=${encodeURIComponent(item.project_name || '')}`);
        } else {
            navigate('/project-timelines');
        }
    };

    const getProjectTrackerStatus = (project: any) => {
        const pId = String(project.project_id);
        const pName = (project.project_name || '').toLowerCase().trim();

        const inInterior = interiorTrackers.find(t =>
            (t.project_id && String(t.project_id) === pId) ||
            (t.project_name && t.project_name.toLowerCase().trim() === pName)
        );

        if (inInterior) {
            return {
                categoryLabel: 'Interior Projects',
                categoryKey: 'interior',
                statusText: 'Active',
                color: '#fca412',
                bg: '#fff9f0',
                border: '#ffe8c2'
            };
        }

        const inArchitectural = architecturalTrackers.find(t =>
            (t.project_id && String(t.project_id) === pId) ||
            (t.project_name && t.project_name.toLowerCase().trim() === pName)
        );

        if (inArchitectural) {
            return {
                categoryLabel: 'Furniture Projects',
                categoryKey: 'architectural',
                statusText: 'Active',
                color: '#0c1527',
                bg: '#f1f5f9',
                border: '#cbd5e1'
            };
        }

        return {
            categoryLabel: 'Not Assigned',
            categoryKey: null,
            statusText: 'Need to Start',
            color: '#64748b',
            bg: '#f8fafc',
            border: '#e2e8f0'
        };
    };

    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>Loading Dashboard...</div>;
    if (!stats) return <div style={{ textAlign: 'center', padding: '50px' }}>Unable to load dashboard data. Please try again.</div>;

    return (
        <div className="dashboard-content">
            <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0c1527' }}>Welcome back, {user?.name}</h2>
                    <p style={{ color: '#64748b' }}>Here's what's happening across Livincart Architects projects today.</p>
                </div>

                {/* Search Bar + Filter Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    {/* Search Bar */}
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <Search
                            size={16}
                            color="#94a3b8"
                            style={{ position: 'absolute', left: 12, pointerEvents: 'none' }}
                        />
                        <input
                            type="text"
                            placeholder="Search projects, clients, tasks..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                paddingLeft: 36,
                                paddingRight: searchQuery ? 36 : 14,
                                paddingTop: 9,
                                paddingBottom: 9,
                                borderRadius: 10,
                                border: '1.5px solid #e2e8f0',
                                fontSize: '0.85rem',
                                color: '#0c1527',
                                background: '#f8fafc',
                                outline: 'none',
                                width: 260,
                                transition: 'border 0.15s'
                            }}
                            onFocus={e => (e.target.style.borderColor = '#fca412')}
                            onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                style={{
                                    position: 'absolute', right: 10,
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: '#94a3b8', display: 'flex', alignItems: 'center'
                                }}
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    {/* Filter Toggle Button */}
                    <button
                        onClick={() => setShowFilters(prev => !prev)}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '9px 18px',
                            borderRadius: 10,
                            backgroundColor: showFilters ? '#fca412' : '#0c1527',
                            color: showFilters ? '#ffffff' : '#fca412',
                            border: '1.5px solid',
                            borderColor: showFilters ? '#fca412' : '#0c1527',
                            fontSize: '0.88rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            boxShadow: showFilters ? '0 4px 14px rgba(252,164,18,0.3)' : '0 2px 8px rgba(12,21,39,0.15)',
                            transition: 'all 0.2s ease',
                            position: 'relative'
                        }}
                    >
                        {showFilters ? <X size={15} /> : <SlidersHorizontal size={15} />}
                        {showFilters ? 'Close Filters' : 'Filters'}
                        {hasActiveFilters && !showFilters && (
                            <span style={{
                                position: 'absolute',
                                top: -5,
                                right: -5,
                                width: 10,
                                height: 10,
                                borderRadius: '50%',
                                backgroundColor: '#fca412',
                                border: '2px solid #ffffff'
                            }} />
                        )}
                    </button>
                </div>
            </div>

            {/* UNIFIED STATEMENT PERIOD & PROJECT TYPE FILTER BAR — Collapsible */}
            {showFilters && (
                <DashboardFilterBar
                    statementPeriod={statementPeriod}
                    onStatementPeriodChange={(period, custom) => {
                        setStatementPeriod(period);
                        if (custom) {
                            setCustomDates(custom);
                        }
                    }}
                    projectType={projectType}
                    onProjectTypeChange={(type) => setProjectType(type)}
                />
            )}

            {/* Business Performance Overview Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                <div onClick={() => navigate('/projects')} style={{ cursor: 'pointer' }} className="stat-card-clickable" title="View all active projects">
                    <StatCard icon={<Briefcase size={22} />} label="Active Projects" value={stats.active_projects} color="#fca412" subtext="In execution & design" />
                </div>
                <div onClick={() => navigate('/leads')} style={{ cursor: 'pointer' }} className="stat-card-clickable" title="View pending leads">
                    <StatCard icon={<UserPlus size={22} />} label="Pending Leads" value={stats.pending_leads} color="#0c1527" subtext="Awaiting conversion" />
                </div>
                <div onClick={() => navigate('/finance')} style={{ cursor: 'pointer' }} className="stat-card-clickable" title="View financial revenue">
                    <StatCard icon={<TrendingUp size={22} />} label="Total Income" value={`₹${parseFloat(stats.total_income).toLocaleString()}`} color="#16a34a" subtext="Revenue received" />
                </div>
                <div onClick={() => navigate('/finance')} style={{ cursor: 'pointer' }} className="stat-card-clickable" title="View site expenses">
                    <StatCard icon={<Wallet size={22} />} label="Site Expenses" value={`₹${parseFloat(stats.total_expense).toLocaleString()}`} color="#0c1527" subtext="Operational outflow" />
                </div>
            </div>

            {/* Task Approvals Overview Cards: Pending, Approved, Rejected */}
            <div style={{ marginBottom: '30px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0c1527', margin: 0, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                            Timeline Task Approvals
                        </h4>
                        <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            color: '#16a34a',
                            backgroundColor: '#dcfce7',
                            border: '1px solid #bbf7d0',
                            padding: '3px 10px',
                            borderRadius: '14px'
                        }}>
                            <span style={{
                                width: '7px',
                                height: '7px',
                                borderRadius: '50%',
                                backgroundColor: '#16a34a',
                                display: 'inline-block',
                                animation: 'livePulse 2s infinite ease-in-out'
                            }} />
                            Live Auto-Sync
                        </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                            Click any card to inspect &amp; manage tasks below
                        </span>
                        <button
                            onClick={() => {
                                fetchTimelineApprovals();
                                fetchDashboardData();
                            }}
                            disabled={isRefreshing}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: '#f1f5f9',
                                border: '1px solid #cbd5e1',
                                padding: '5px 12px',
                                borderRadius: '8px',
                                color: '#334155',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                cursor: 'pointer'
                            }}
                            title="Sync live status now"
                        >
                            <RotateCw size={12} style={{ animation: isRefreshing ? 'spin 0.8s linear infinite' : 'none' }} />
                            {isRefreshing ? 'Syncing...' : 'Sync'}
                        </button>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                    {/* Pending Tasks Card */}
                    <div onClick={() => scrollToApprovals('pending')} style={{ cursor: 'pointer' }} className="stat-card-clickable" title="Click to view & approve pending tasks">
                        <StatCard
                            icon={<Clock size={24} />}
                            label="Pending Tasks"
                            value={taskCounts.pending}
                            color="#f59e0b"
                            badge={taskCounts.pending > 0 ? `${taskCounts.pending} Awaiting` : 'All Clear'}
                            badgeColor={taskCounts.pending > 0 ? '#f59e0b' : '#16a34a'}
                            subtext="Awaiting Admin Review"
                        />
                    </div>

                    {/* Approved Tasks Card */}
                    <div onClick={() => scrollToApprovals('approved')} style={{ cursor: 'pointer' }} className="stat-card-clickable" title="Click to view approved tasks">
                        <StatCard
                            icon={<CheckCircle2 size={24} />}
                            label="Approved Tasks"
                            value={taskCounts.approved}
                            color="#16a34a"
                            badge="Completed"
                            badgeColor="#16a34a"
                            subtext="Verified & Turned Green"
                        />
                    </div>

                    {/* Rejected Tasks Card */}
                    <div onClick={() => scrollToApprovals('rejected')} style={{ cursor: 'pointer' }} className="stat-card-clickable" title="Click to view rejected tasks awaiting rework">
                        <StatCard
                            icon={<XCircle size={24} />}
                            label="Rejected Tasks"
                            value={taskCounts.rejected}
                            color="#dc2626"
                            badge={taskCounts.rejected > 0 ? `${taskCounts.rejected} Rework` : 'No Issues'}
                            badgeColor={taskCounts.rejected > 0 ? '#dc2626' : '#64748b'}
                            subtext="Sent back for revision"
                        />
                    </div>
                </div>
            </div>

            {/* Pending Reimbursements Approval Request Section */}
            {user?.role === 'admin' && (
                <div style={{ marginBottom: '30px' }} className="premium-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#253b50', margin: 0 }}>Pending Reimbursement Approvals</h3>
                            {pendingClaims.length > 0 && (
                                <span style={{ background: '#ef4444', color: '#fff', fontSize: '0.78rem', fontWeight: 700, padding: '2px 8px', borderRadius: '12px' }}>
                                    {pendingClaims.length} New
                                </span>
                            )}
                        </div>
                        <button
                            onClick={() => navigate('/staff-reimbursements')}
                            style={{ color: '#253b50', fontSize: '0.9rem', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                        >
                            Manage All Requests
                        </button>
                    </div>

                    {pendingClaims.length === 0 ? (
                        <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0, textAlign: 'center', padding: '20px 0' }}>
                            🎉 All reimbursement requests have been reviewed!
                        </p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {pendingClaims.slice(0, 5).map((claim) => (
                                <div key={claim.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontWeight: 600, color: '#1e293b' }}>{claim.employee_name}</span>
                                            <span style={{ background: '#e2e8f0', color: '#475569', fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: '12px' }}>
                                                {claim.category}
                                            </span>
                                        </div>
                                        <p style={{ color: '#64748b', fontSize: '0.82rem', margin: '4px 0 0 0' }}>
                                            Reason: {claim.reason} • {new Date(claim.created_at).toLocaleDateString('en-IN')}
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#253b50' }}>
                                            ₹{parseFloat(claim.amount).toFixed(2)}
                                        </span>
                                        <button
                                            onClick={() => navigate('/staff-reimbursements')}
                                            style={{ background: '#253b50', color: '#fff', border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                                        >
                                            Review
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {pendingClaims.length > 5 && (
                                <p style={{ fontSize: '0.85rem', color: '#64748b', textAlign: 'center', margin: '8px 0 0 0' }}>
                                    And {pendingClaims.length - 5} more requests waiting.
                                </p>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Marketing & Business Associate Task Approvals Section */}
            {user?.role === 'admin' && (
                <div style={{ marginBottom: '30px' }} className="premium-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#253b50', margin: 0 }}>
                                Marketing & Business Task Approvals
                            </h3>
                            {/* Inner Tab Selector */}
                            <div style={{ display: 'flex', gap: '4px', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <button
                                    onClick={() => setMbActiveTab('proposals')}
                                    style={{
                                        border: 'none',
                                        backgroundColor: mbActiveTab === 'proposals' ? '#ffffff' : 'transparent',
                                        color: mbActiveTab === 'proposals' ? '#253b50' : '#64748b',
                                        padding: '6px 14px',
                                        borderRadius: '6px',
                                        fontSize: '0.8rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        boxShadow: mbActiveTab === 'proposals' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    Proposals ({mbPendingTasks.length})
                                </button>
                                <button
                                    onClick={() => setMbActiveTab('completions')}
                                    style={{
                                        border: 'none',
                                        backgroundColor: mbActiveTab === 'completions' ? '#ffffff' : 'transparent',
                                        color: mbActiveTab === 'completions' ? '#253b50' : '#64748b',
                                        padding: '6px 14px',
                                        borderRadius: '6px',
                                        fontSize: '0.8rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        boxShadow: mbActiveTab === 'completions' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    Completions ({mbPendingCompletions.length})
                                </button>
                            </div>
                        </div>
                        {mbStats && (
                            <div style={{ display: 'flex', gap: '12px', fontSize: '0.78rem', fontWeight: 600 }}>
                                <span style={{ color: '#16a34a' }}>Accepted: {mbStats.accepted}</span>
                                <span style={{ color: '#dc2626' }}>Delayed: {mbStats.delayed}</span>
                                <span style={{ color: '#64748b' }}>Completed: {mbStats.completed}</span>
                            </div>
                        )}
                    </div>

                    {mbActiveTab === 'proposals' ? (
                        mbPendingTasks.length === 0 ? (
                            <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0, textAlign: 'center', padding: '30px 0' }}>
                                🎉 No task proposals awaiting review.
                            </p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {mbPendingTasks.map((task) => (
                                    <div key={task.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '12px' }}>
                                        <div style={{ flex: 1, minWidth: '240px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                <span style={{ fontWeight: 700, color: '#1e293b' }}>{task.employee_name}</span>
                                                <span style={{ background: '#253b50', color: '#fff', fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', textTransform: 'capitalize' }}>
                                                    {task.role?.replace('_', ' ')}
                                                </span>
                                            </div>
                                            <h4 style={{ margin: '6px 0 2px 0', fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>
                                                {task.task_title}
                                            </h4>
                                            {task.description && (
                                                <p style={{ color: '#64748b', fontSize: '0.82rem', margin: '0 0 6px 0' }}>
                                                    {task.description}
                                                </p>
                                            )}
                                            {task.sub_tasks && task.sub_tasks.length > 0 && (
                                                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px dashed #e2e8f0', paddingTop: '8px', marginBottom: '6px' }}>
                                                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#4b5563', textTransform: 'uppercase' }}>Subtasks ({task.sub_tasks.length}):</span>
                                                    {task.sub_tasks.map((st: any) => (
                                                        <div key={st.id} style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                                            • {st.title} {st.start_date && `(${new Date(st.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, ${st.duration_days} d)`}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            <p style={{ color: '#475569', fontSize: '0.78rem', margin: 0, fontWeight: 600 }}>
                                                Planned: {new Date(task.start_date).toLocaleDateString('en-IN')} to {new Date(task.end_date).toLocaleDateString('en-IN')} ({task.duration_days} Day{task.duration_days > 1 ? 's' : ''})
                                            </p>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <button
                                                onClick={() => promptAcceptMBTask(task.id)}
                                                style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                                            >
                                                Accept
                                            </button>
                                            <button
                                                onClick={() => promptRejectMBTask(task.id)}
                                                style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                                            >
                                                Reject
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    ) : (
                        mbPendingCompletions.length === 0 ? (
                            <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0, textAlign: 'center', padding: '30px 0' }}>
                                🎉 No completion approvals awaiting review.
                            </p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {mbPendingCompletions.map((task) => (
                                    <div key={task.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'top', padding: '16px', background: '#fcfcfd', borderRadius: '10px', border: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '12px' }}>
                                        <div style={{ flex: 1, minWidth: '240px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                <span style={{ fontWeight: 700, color: '#1e293b' }}>{task.employee_name}</span>
                                                <span style={{ background: '#f59e0b', color: '#fff', fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', textTransform: 'capitalize' }}>
                                                    {task.role?.replace('_', ' ')}
                                                </span>
                                            </div>
                                            <h4 style={{ margin: '6px 0 2px 0', fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>
                                                {task.task_title}
                                            </h4>
                                            {task.description && (
                                                <p style={{ color: '#64748b', fontSize: '0.82rem', margin: '0 0 6px 0' }}>
                                                    {task.description}
                                                </p>
                                            )}
                                            {task.sub_tasks && task.sub_tasks.length > 0 && (
                                                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px dashed #e2e8f0', paddingTop: '8px', marginBottom: '6px' }}>
                                                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#4b5563', textTransform: 'uppercase' }}>Subtasks Checklist ({task.sub_tasks.filter((st: any) => st.status === 'completed').length}/{task.sub_tasks.length}):</span>
                                                    {task.sub_tasks.map((st: any) => (
                                                        <div key={st.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#6b7280' }}>
                                                            <input type="checkbox" checked={st.status === 'completed'} disabled style={{ width: '11px', height: '11px' }} />
                                                            <span style={{ textDecoration: st.status === 'completed' ? 'line-through' : 'none' }}>{st.title}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            <p style={{ color: '#475569', fontSize: '0.78rem', margin: 0, fontWeight: 600 }}>
                                                Dates: {new Date(task.start_date).toLocaleDateString('en-IN')} to {new Date(task.end_date).toLocaleDateString('en-IN')}
                                            </p>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <button
                                                onClick={() => promptApproveMBCompletion(task.id)}
                                                style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                                            >
                                                Approve
                                            </button>
                                            <button
                                                onClick={() => promptRejectMBCompletion(task.id)}
                                                style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                                            >
                                                Reject
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    )}
                </div>
            )}

            {/* My Monthly Targets Section (only displayed if targets exist) */}
            {user && myTargets.length > 0 && (
                <div style={{ marginBottom: '30px' }} className="premium-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#253b50', margin: 0 }}>My Monthly Targets</h3>
                            <span style={{ background: '#fca311', color: '#fff', fontSize: '0.78rem', fontWeight: 700, padding: '2px 8px', borderRadius: '12px' }}>
                                {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
                            </span>
                        </div>
                    </div>

                    {myTargets.length === 0 ? (
                        <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0, textAlign: 'center', padding: '20px 0' }}>
                            No monthly targets have been assigned to you for this month.
                        </p>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                            {myTargets.map((row: any, idx: number) => {
                                let tasks = row.dynamic_tasks || [];
                                if (tasks.length === 0 && (row.task1 || row.task2)) {
                                    tasks = [
                                        { value: row.task1 || '', status: row.task1_status || 'pending' },
                                        { value: row.task2 || '', status: row.task2_status || 'pending' }
                                    ];
                                }
                                tasks = tasks.filter((t: any) => t.value);

                                return (
                                    <div key={row.id || idx} style={{ background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px' }}>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#253b50', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '12px' }}>
                                            🎯 {row.project_name || 'General Targets'}
                                        </div>
                                        {tasks.length === 0 ? (
                                            <p style={{ color: '#64748b', fontSize: '0.82rem', margin: 0 }}>No specific tasks listed.</p>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {tasks.map((task: any, tIdx: number) => {
                                                    const statusStyles: Record<string, { color: string; bg: string }> = {
                                                        done: { color: '#16a34a', bg: '#dcfce7' },
                                                        in_progress: { color: '#d97706', bg: '#fef9c3' },
                                                        pending: { color: '#dc2626', bg: '#fee2e2' }
                                                    };
                                                    const s = statusStyles[task.status] || statusStyles['pending'];
                                                    return (
                                                        <div key={tIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                                                            <span style={{ color: '#334155', fontWeight: 500 }}>{task.value}</span>
                                                            <span style={{
                                                                fontSize: '0.72rem',
                                                                fontWeight: 700,
                                                                padding: '2px 8px',
                                                                borderRadius: '12px',
                                                                color: s.color,
                                                                backgroundColor: s.bg,
                                                                textTransform: 'uppercase'
                                                            }}>
                                                                {task.status?.replace('_', ' ')}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                        {row.deadline && (
                                            <div style={{ fontSize: '0.78rem', color: '#dc2626', marginTop: '12px', fontWeight: 600 }}>
                                                ⏰ Deadline: {row.deadline}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Timeline Task Approvals Section */}
            <div id="timeline-approvals-section" style={{ marginBottom: '30px' }} className="premium-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#fff9f0', border: '1.5px solid #ffe8c2', color: '#fca412', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.2rem' }}>
                            ⏰
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0c1527', margin: 0, letterSpacing: '-0.2px' }}>
                                    Approvals &amp; Deliverables Hub
                                </h3>
                                <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    color: '#16a34a',
                                    backgroundColor: '#dcfce7',
                                    border: '1px solid #bbf7d0',
                                    padding: '2px 8px',
                                    borderRadius: '12px'
                                }}>
                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#16a34a', display: 'inline-block' }} />
                                    Live
                                </span>
                            </div>
                            <p style={{ margin: '3px 0 0 0', fontSize: '0.86rem', color: '#64748b' }}>
                                Review submitted designer deliverables, PM timelines, and vendor quotation approval requests
                            </p>
                        </div>
                    </div>

                    {/* Filter Tabs for Pending, Approved, Rejected, and Vendor Quotation Approval Requests */}
                    <div style={{ display: 'flex', gap: '6px', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '10px', border: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
                        <button
                            onClick={() => setApprovalTab('pending')}
                            style={{
                                border: 'none',
                                backgroundColor: approvalTab === 'pending' ? '#f59e0b' : 'transparent',
                                color: approvalTab === 'pending' ? '#ffffff' : '#475569',
                                padding: '6px 14px',
                                borderRadius: '7px',
                                fontSize: '0.82rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                boxShadow: approvalTab === 'pending' ? '0 2px 6px rgba(245, 158, 11, 0.3)' : 'none',
                                transition: 'all 0.15s'
                            }}
                        >
                            Pending Approvals ({taskCounts.pending})
                        </button>
                        <button
                            onClick={() => setApprovalTab('approved')}
                            style={{
                                border: 'none',
                                backgroundColor: approvalTab === 'approved' ? '#16a34a' : 'transparent',
                                color: approvalTab === 'approved' ? '#ffffff' : '#475569',
                                padding: '6px 14px',
                                borderRadius: '7px',
                                fontSize: '0.82rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                boxShadow: approvalTab === 'approved' ? '0 2px 6px rgba(22, 163, 74, 0.3)' : 'none',
                                transition: 'all 0.15s'
                            }}
                        >
                            Approved Tasks ({taskCounts.approved})
                        </button>
                        <button
                            onClick={() => setApprovalTab('rejected')}
                            style={{
                                border: 'none',
                                backgroundColor: approvalTab === 'rejected' ? '#dc2626' : 'transparent',
                                color: approvalTab === 'rejected' ? '#ffffff' : '#475569',
                                padding: '6px 14px',
                                borderRadius: '7px',
                                fontSize: '0.82rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                boxShadow: approvalTab === 'rejected' ? '0 2px 6px rgba(220, 38, 38, 0.3)' : 'none',
                                transition: 'all 0.15s'
                            }}
                        >
                            Rejected / Rework ({taskCounts.rejected})
                        </button>
                        {user?.role === 'admin' && (
                            <button
                                onClick={() => setApprovalTab('vendor_quota')}
                                style={{
                                    border: 'none',
                                    backgroundColor: approvalTab === 'vendor_quota' ? '#ea580c' : 'transparent',
                                    color: approvalTab === 'vendor_quota' ? '#ffffff' : (pendingVendorApprovals.length > 0 ? '#ea580c' : '#475569'),
                                    padding: '6px 14px',
                                    borderRadius: '7px',
                                    fontSize: '0.82rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    boxShadow: approvalTab === 'vendor_quota' ? '0 2px 6px rgba(234, 88, 12, 0.3)' : 'none',
                                    transition: 'all 0.15s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                            >
                                <span>Vendor Quotation Approval Requests ({pendingVendorApprovals.length})</span>
                                {pendingVendorApprovals.length > 0 && approvalTab !== 'vendor_quota' && (
                                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#ea580c', display: 'inline-block' }} />
                                )}
                            </button>
                        )}
                        {user?.role === 'admin' && (
                            <button
                                onClick={() => setApprovalTab('qc_approvals')}
                                style={{
                                    border: 'none',
                                    backgroundColor: approvalTab === 'qc_approvals' ? '#ea580c' : 'transparent',
                                    color: approvalTab === 'qc_approvals' ? '#ffffff' : (pendingQCApprovals.length > 0 ? '#ea580c' : '#475569'),
                                    padding: '6px 14px',
                                    borderRadius: '7px',
                                    fontSize: '0.82rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    boxShadow: approvalTab === 'qc_approvals' ? '0 2px 6px rgba(234, 88, 12, 0.3)' : 'none',
                                    transition: 'all 0.15s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                            >
                                <span>🛡️ QC Review Approvals ({pendingQCApprovals.length})</span>
                                {pendingQCApprovals.length > 0 && approvalTab !== 'qc_approvals' && (
                                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#ea580c', display: 'inline-block' }} />
                                )}
                            </button>
                        )}
                        {(user?.role === 'admin' || isApproverRole || isDiscountApproverRole) && (
                            <button
                                onClick={() => setApprovalTab('discount_approvals')}
                                style={{
                                    border: 'none',
                                    backgroundColor: approvalTab === 'discount_approvals' ? '#ea580c' : 'transparent',
                                    color: approvalTab === 'discount_approvals' ? '#ffffff' : (pendingDiscountApprovals.filter(d => d.status === 'pending').length > 0 ? '#ea580c' : '#475569'),
                                    padding: '6px 14px',
                                    borderRadius: '7px',
                                    fontSize: '0.82rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    boxShadow: approvalTab === 'discount_approvals' ? '0 2px 6px rgba(234, 88, 12, 0.3)' : 'none',
                                    transition: 'all 0.15s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                            >
                                <span>🏷️ Category Discount Approvals ({pendingDiscountApprovals.filter(d => d.status === 'pending').length})</span>
                                {pendingDiscountApprovals.filter(d => d.status === 'pending').length > 0 && approvalTab !== 'discount_approvals' && (
                                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#ea580c', display: 'inline-block' }} />
                                )}
                            </button>
                        )}
                        {isApproverRole && (
                            <button
                                onClick={() => setApprovalTab('transport_approvals')}
                                style={{
                                    border: 'none',
                                    backgroundColor: approvalTab === 'transport_approvals' ? '#0284c7' : 'transparent',
                                    color: approvalTab === 'transport_approvals' ? '#ffffff' : (transportPendingCount > 0 ? '#0284c7' : '#475569'),
                                    padding: '6px 14px',
                                    borderRadius: '7px',
                                    fontSize: '0.82rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    boxShadow: approvalTab === 'transport_approvals' ? '0 2px 6px rgba(2, 132, 199, 0.3)' : 'none',
                                    transition: 'all 0.15s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                            >
                                <Truck size={14} />
                                <span>Transport ({transportPendingCount})</span>
                                {transportPendingCount > 0 && approvalTab !== 'transport_approvals' && (
                                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#0284c7', display: 'inline-block' }} />
                                )}
                            </button>
                        )}
                        {isApproverRole && (
                            <button
                                onClick={() => setApprovalTab('labor_approvals')}
                                style={{
                                    border: 'none',
                                    backgroundColor: approvalTab === 'labor_approvals' ? '#d97706' : 'transparent',
                                    color: approvalTab === 'labor_approvals' ? '#ffffff' : (laborPendingCount > 0 ? '#d97706' : '#475569'),
                                    padding: '6px 14px',
                                    borderRadius: '7px',
                                    fontSize: '0.82rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    boxShadow: approvalTab === 'labor_approvals' ? '0 2px 6px rgba(217, 119, 6, 0.3)' : 'none',
                                    transition: 'all 0.15s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                            >
                                <HardHat size={14} />
                                <span>Labor ({laborPendingCount})</span>
                                {laborPendingCount > 0 && approvalTab !== 'labor_approvals' && (
                                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#d97706', display: 'inline-block' }} />
                                )}
                            </button>
                        )}
                        {isApproverRole && (
                            <button
                                onClick={() => setApprovalTab('misc_approvals')}
                                style={{
                                    border: 'none',
                                    backgroundColor: approvalTab === 'misc_approvals' ? '#7c3aed' : 'transparent',
                                    color: approvalTab === 'misc_approvals' ? '#ffffff' : (miscPendingCount > 0 ? '#7c3aed' : '#475569'),
                                    padding: '6px 14px',
                                    borderRadius: '7px',
                                    fontSize: '0.82rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    boxShadow: approvalTab === 'misc_approvals' ? '0 2px 6px rgba(124, 58, 237, 0.3)' : 'none',
                                    transition: 'all 0.15s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                            >
                                <Package size={14} />
                                <span>Miscellaneous ({miscPendingCount})</span>
                                {miscPendingCount > 0 && approvalTab !== 'misc_approvals' && (
                                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#7c3aed', display: 'inline-block' }} />
                                )}
                            </button>
                        )}
                        {isApproverRole && (
                            <button
                                onClick={() => setApprovalTab('reimbursements_approvals')}
                                style={{
                                    border: 'none',
                                    backgroundColor: approvalTab === 'reimbursements_approvals' ? '#059669' : 'transparent',
                                    color: approvalTab === 'reimbursements_approvals' ? '#ffffff' : (reimbursementsPendingCount > 0 ? '#059669' : '#475569'),
                                    padding: '6px 14px',
                                    borderRadius: '7px',
                                    fontSize: '0.82rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    boxShadow: approvalTab === 'reimbursements_approvals' ? '0 2px 6px rgba(5, 150, 105, 0.3)' : 'none',
                                    transition: 'all 0.15s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                            >
                                <Receipt size={14} />
                                <span>Reimbursements ({reimbursementsPendingCount})</span>
                                {reimbursementsPendingCount > 0 && approvalTab !== 'reimbursements_approvals' && (
                                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#059669', display: 'inline-block' }} />
                                )}
                            </button>
                        )}
                    </div>
                </div>

                {/* Tab Body: Pending Approvals */}
                {approvalTab === 'pending' && (
                    timelineApprovals.length === 0 ? (
                        <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0, textAlign: 'center', padding: '28px 0', backgroundColor: '#fff9f0', borderRadius: '12px', border: '1px dashed #ffe8c2' }}>
                            🎉 No pending timeline approvals right now. All tasks are up to date!
                        </p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {timelineApprovals.map((item, idx) => (
                                <div key={item.id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: '#fff9f0', borderRadius: '12px', border: '1.5px solid #ffe8c2', flexWrap: 'wrap', gap: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: '280px' }}>
                                        <div style={{ width: '12px', height: '12px', borderRadius: '4px', backgroundColor: '#fca412', flexShrink: 0 }} />
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                <span
                                                    onClick={() => handleViewTimelineTask(item)}
                                                    style={{ fontWeight: 800, color: '#0c1527', fontSize: '0.95rem', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: '#cbd5e1' }}
                                                    title="Click to view project details"
                                                >
                                                    {item.project_name}
                                                </span>
                                                {item.client_name && (
                                                    <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
                                                        ({item.client_name})
                                                    </span>
                                                )}
                                                <span style={{ background: '#fca412', color: '#ffffff', fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: '12px', textTransform: 'uppercase' }}>
                                                    Pending Approval
                                                </span>
                                                <span style={{ background: '#e2e8f0', color: '#334155', fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '12px' }}>
                                                    {item.type === 'pm' ? 'PM Timeline' : (item.type === 'execution' ? 'Execution Timeline' : (item.source === 'tracker' ? 'Stage Tracker' : 'Designer Timeline'))}
                                                </span>
                                            </div>
                                            <p style={{ color: '#475569', fontSize: '0.83rem', margin: '4px 0 0 0', fontWeight: 600 }}>
                                                Task / Stage: <strong style={{ color: '#0c1527' }}>{item.task_name}</strong> {item.date ? `• Date: ${item.date}` : ''}
                                            </p>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {/* 👁️ View Task Button */}
                                        <button
                                            onClick={() => handleViewTimelineTask(item)}
                                            style={{
                                                backgroundColor: '#ffffff',
                                                color: '#0f172a',
                                                border: '1.5px solid #cbd5e1',
                                                padding: '8px 14px',
                                                borderRadius: '8px',
                                                fontSize: '0.82rem',
                                                fontWeight: 700,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '5px',
                                                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                                                transition: 'all 0.15s'
                                            }}
                                            title="View this task and deliverables in Project Timeline"
                                        >
                                            <Eye size={14} color="#64748b" /> View Task
                                        </button>

                                        {/* ✓ Accept & Approve Button */}
                                        <button
                                            onClick={() => handleAcceptTimelineApproval(item)}
                                            style={{
                                                backgroundColor: '#16a34a',
                                                color: '#ffffff',
                                                border: 'none',
                                                padding: '8px 16px',
                                                borderRadius: '8px',
                                                fontSize: '0.82rem',
                                                fontWeight: 800,
                                                cursor: 'pointer',
                                                boxShadow: '0 2px 6px rgba(22, 163, 74, 0.25)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '5px',
                                                transition: 'all 0.15s'
                                            }}
                                            title="Accept and mark completed (Turns Green)"
                                        >
                                            <Check size={14} /> Accept &amp; Approve
                                        </button>

                                        {/* ✕ Reject Button */}
                                        <button
                                            onClick={() => handleRejectTimelineApproval(item)}
                                            style={{
                                                backgroundColor: '#fee2e2',
                                                color: '#dc2626',
                                                border: '1.5px solid #fca5a5',
                                                padding: '8px 14px',
                                                borderRadius: '8px',
                                                fontSize: '0.82rem',
                                                fontWeight: 800,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '5px',
                                                transition: 'all 0.15s'
                                            }}
                                            title="Reject task and return for rework"
                                        >
                                            <XCircle size={14} /> Reject
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                )}

                {/* Tab Body: Approved Tasks */}
                {approvalTab === 'approved' && (
                    approvedTasks.length === 0 ? (
                        <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0, textAlign: 'center', padding: '28px 0', backgroundColor: '#f0fdf4', borderRadius: '12px', border: '1px dashed #bbf7d0' }}>
                            No tasks have been approved yet.
                        </p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {approvedTasks.map((item, idx) => (
                                <div key={item.id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: '#f0fdf4', borderRadius: '12px', border: '1.5px solid #bbf7d0', flexWrap: 'wrap', gap: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: '280px' }}>
                                        <div style={{ width: '12px', height: '12px', borderRadius: '4px', backgroundColor: '#16a34a', flexShrink: 0 }} />
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                <span
                                                    onClick={() => handleViewTimelineTask(item)}
                                                    style={{ fontWeight: 800, color: '#0c1527', fontSize: '0.95rem', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: '#cbd5e1' }}
                                                    title="Click to view project details"
                                                >
                                                    {item.project_name}
                                                </span>
                                                {item.client_name && (
                                                    <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
                                                        ({item.client_name})
                                                    </span>
                                                )}
                                                <span style={{ background: '#16a34a', color: '#ffffff', fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: '12px', textTransform: 'uppercase' }}>
                                                    ✓ Approved (Done)
                                                </span>
                                                <span style={{ background: '#e2e8f0', color: '#334155', fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '12px' }}>
                                                    {item.type === 'pm' ? 'PM Timeline' : (item.type === 'execution' ? 'Execution Timeline' : (item.source === 'tracker' ? 'Stage Tracker' : 'Designer Timeline'))}
                                                </span>
                                            </div>
                                            <p style={{ color: '#475569', fontSize: '0.83rem', margin: '4px 0 0 0', fontWeight: 600 }}>
                                                Task / Stage: <strong style={{ color: '#0c1527' }}>{item.task_name}</strong> {item.date ? `• Date: ${item.date}` : ''}
                                            </p>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <button
                                            onClick={() => handleViewTimelineTask(item)}
                                            style={{
                                                backgroundColor: '#ffffff',
                                                color: '#0f172a',
                                                border: '1.5px solid #cbd5e1',
                                                padding: '8px 14px',
                                                borderRadius: '8px',
                                                fontSize: '0.82rem',
                                                fontWeight: 700,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '5px',
                                                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                                                transition: 'all 0.15s'
                                            }}
                                            title="View this task in Project Timeline"
                                        >
                                            <Eye size={14} color="#64748b" /> View Task
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                )}

                {/* Tab Body: Rejected Tasks */}
                {approvalTab === 'rejected' && (
                    rejectedTasks.length === 0 ? (
                        <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0, textAlign: 'center', padding: '28px 0', backgroundColor: '#fef2f2', borderRadius: '12px', border: '1px dashed #fecaca' }}>
                            🎉 No rejected tasks. Everything is running smoothly without rework!
                        </p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {rejectedTasks.map((item, idx) => (
                                <div key={item.id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: '#fef2f2', borderRadius: '12px', border: '1.5px solid #fecaca', flexWrap: 'wrap', gap: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: '280px' }}>
                                        <div style={{ width: '12px', height: '12px', borderRadius: '4px', backgroundColor: '#dc2626', flexShrink: 0 }} />
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                <span
                                                    onClick={() => handleViewTimelineTask(item)}
                                                    style={{ fontWeight: 800, color: '#0c1527', fontSize: '0.95rem', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: '#cbd5e1' }}
                                                    title="Click to view project details"
                                                >
                                                    {item.project_name}
                                                </span>
                                                {item.client_name && (
                                                    <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
                                                        ({item.client_name})
                                                    </span>
                                                )}
                                                <span style={{ background: '#dc2626', color: '#ffffff', fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: '12px', textTransform: 'uppercase' }}>
                                                    ✕ Rejected (Rework Required)
                                                </span>
                                                <span style={{ background: '#e2e8f0', color: '#334155', fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '12px' }}>
                                                    {item.type === 'pm' ? 'PM Timeline' : (item.type === 'execution' ? 'Execution Timeline' : (item.source === 'tracker' ? 'Stage Tracker' : 'Designer Timeline'))}
                                                </span>
                                            </div>
                                            <p style={{ color: '#475569', fontSize: '0.83rem', margin: '4px 0 0 0', fontWeight: 600 }}>
                                                Task / Stage: <strong style={{ color: '#0c1527' }}>{item.task_name}</strong> {item.date ? `• Date: ${item.date}` : ''}
                                            </p>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <button
                                            onClick={() => handleViewTimelineTask(item)}
                                            style={{
                                                backgroundColor: '#ffffff',
                                                color: '#0f172a',
                                                border: '1.5px solid #cbd5e1',
                                                padding: '8px 14px',
                                                borderRadius: '8px',
                                                fontSize: '0.82rem',
                                                fontWeight: 700,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '5px',
                                                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                                                transition: 'all 0.15s'
                                            }}
                                            title="View this task in Project Timeline"
                                        >
                                            <Eye size={14} color="#64748b" /> View Task
                                        </button>

                                        {/* Re-Approve Button */}
                                        <button
                                            onClick={() => handleReApproveTimelineTask(item)}
                                            style={{
                                                backgroundColor: '#16a34a',
                                                color: '#ffffff',
                                                border: 'none',
                                                padding: '8px 16px',
                                                borderRadius: '8px',
                                                fontSize: '0.82rem',
                                                fontWeight: 800,
                                                cursor: 'pointer',
                                                boxShadow: '0 2px 6px rgba(22, 163, 74, 0.25)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '5px',
                                                transition: 'all 0.15s'
                                            }}
                                            title="Re-approve task once revised"
                                        >
                                            <Check size={14} /> Re-Approve (Turn Green)
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                )}

                {/* Tab Body: Vendor Quotation Approval Requests */}
                {approvalTab === 'vendor_quota' && (
                    pendingVendorApprovals.length === 0 ? (
                        <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0, textAlign: 'center', padding: '28px 0', backgroundColor: '#f0fdf4', borderRadius: '12px', border: '1px dashed #bbf7d0' }}>
                            🎉 No pending vendor quotation approvals right now. All vendor quotations are up to date!
                        </p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' }}>
                                <button
                                    onClick={() => navigate('/vendor-quota')}
                                    style={{
                                        backgroundColor: '#0c1527',
                                        color: '#fca412',
                                        border: '1px solid #fca412',
                                        padding: '6px 14px',
                                        borderRadius: '8px',
                                        fontSize: '0.80rem',
                                        fontWeight: 800,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}
                                >
                                    Open Full Vendor Quota Hub →
                                </button>
                            </div>
                            {pendingVendorApprovals.map((item, idx) => (
                                <div key={item.id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: '#fffcf5', borderRadius: '12px', border: '1.5px solid #fed7aa', flexWrap: 'wrap', gap: '12px', boxShadow: '0 2px 6px rgba(234, 88, 12, 0.04)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: '280px' }}>
                                        <div style={{ width: '12px', height: '12px', borderRadius: '4px', backgroundColor: '#ea580c', flexShrink: 0 }} />
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                <span
                                                    onClick={() => navigate('/vendor-quota')}
                                                    style={{ fontWeight: 800, color: '#0c1527', fontSize: '0.98rem', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: '#cbd5e1' }}
                                                    title="Click to view in Vendor Quota Builder"
                                                >
                                                    {item.vendor_name}
                                                </span>
                                                <span style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 700, backgroundColor: '#f1f5f9', padding: '2px 8px', borderRadius: '6px' }}>
                                                    Site: {item.project_name} ({item.project_id})
                                                </span>
                                                {item.client_name && (
                                                    <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
                                                        Client: {item.client_name}
                                                    </span>
                                                )}
                                                <span style={{ background: '#fff7ed', color: '#c2410c', fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: '12px', border: '1px solid #fed7aa', textTransform: 'uppercase' }}>
                                                    ⏳ Pending Approval
                                                </span>
                                                <span style={{ background: '#eff6ff', color: '#2563eb', fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '12px' }}>
                                                    Version {item.version || 'V1.0'}
                                                </span>
                                            </div>
                                            <p style={{ color: '#475569', fontSize: '0.83rem', margin: '4px 0 0 0', fontWeight: 600 }}>
                                                Total Work Order Value: <strong style={{ color: '#0c1527', fontSize: '0.92rem' }}>₹{Number(item.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                                                {item.created_at ? ` • Submitted: ${new Date(item.created_at).toLocaleDateString('en-IN')}` : ''}
                                                {item.contact_person ? ` • Contact: ${item.contact_person}` : ''}
                                            </p>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {/* 👁️ Review in Builder Button */}
                                        <button
                                            onClick={() => navigate('/vendor-quota')}
                                            style={{
                                                backgroundColor: '#ffffff',
                                                color: '#0f172a',
                                                border: '1.5px solid #cbd5e1',
                                                padding: '8px 14px',
                                                borderRadius: '8px',
                                                fontSize: '0.82rem',
                                                fontWeight: 700,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '5px',
                                                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                                                transition: 'all 0.15s'
                                            }}
                                            title="Open Vendor Quota Builder to view BOQ items & particulars"
                                        >
                                            <Eye size={14} color="#64748b" /> Review Quota
                                        </button>

                                        {/* ✓ Approve & Lock Button */}
                                        <button
                                            disabled={approvingVendorId === item.id}
                                            onClick={() => handleApproveVendorQuota(item)}
                                            style={{
                                                backgroundColor: '#16a34a',
                                                color: '#ffffff',
                                                border: 'none',
                                                padding: '8px 16px',
                                                borderRadius: '8px',
                                                fontSize: '0.82rem',
                                                fontWeight: 800,
                                                cursor: approvingVendorId === item.id ? 'not-allowed' : 'pointer',
                                                boxShadow: '0 2px 6px rgba(22, 163, 74, 0.25)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '5px',
                                                transition: 'all 0.15s'
                                            }}
                                            title="Approve and mark officially locked for site execution"
                                        >
                                            <Check size={14} /> {approvingVendorId === item.id ? 'Approving...' : 'Approve & Lock'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                )}

                {/* Tab Body: QC Review Approval Requests */}
                {approvalTab === 'qc_approvals' && (
                    pendingQCApprovals.length === 0 ? (
                        <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0, textAlign: 'center', padding: '28px 0', backgroundColor: '#f0fdf4', borderRadius: '12px', border: '1px dashed #bbf7d0' }}>
                            🎉 No pending QC review approvals right now. All versions are up to date!
                        </p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {pendingQCApprovals.map((item, idx) => (
                                <div key={item.folder_id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: '#fffcf5', borderRadius: '12px', border: '1.5px solid #fed7aa', flexWrap: 'wrap', gap: '12px', boxShadow: '0 2px 6px rgba(234, 88, 12, 0.04)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: '280px' }}>
                                        <div style={{ width: '12px', height: '12px', borderRadius: '4px', backgroundColor: '#ea580c', flexShrink: 0 }} />
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                <span
                                                    onClick={() => navigate(`/projects/${item.db_project_id || item.project_id}?tab=quality_check`)}
                                                    style={{ fontWeight: 800, color: '#0c1527', fontSize: '0.98rem', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: '#cbd5e1' }}
                                                    title="Click to view in Project QC"
                                                >
                                                    {item.project_name}
                                                </span>
                                                <span style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 700, backgroundColor: '#f1f5f9', padding: '2px 8px', borderRadius: '6px' }}>
                                                    Code: {item.project_code || ('PRJ-' + item.project_id)}
                                                </span>
                                                <span style={{ background: '#fff7ed', color: '#c2410c', fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: '12px', border: '1px solid #fed7aa', textTransform: 'uppercase' }}>
                                                    {item.name || `Version ${item.version_number}`}
                                                </span>
                                                <span style={{ background: '#f0fdf4', color: '#16a34a', fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                                                    📁 {item.total_files || 1} file(s) QC Approved
                                                </span>
                                            </div>
                                            <p style={{ color: '#475569', fontSize: '0.83rem', margin: '4px 0 0 0', fontWeight: 600 }}>
                                                Quality Check inspector completed verification. Waiting for Admin / PM final sign-off.
                                                {item.created_at ? ` • Submitted: ${new Date(item.created_at).toLocaleDateString('en-IN')}` : ''}
                                            </p>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {/* 👁️ View QC Folder Button */}
                                        <button
                                            onClick={() => navigate(`/projects/${item.db_project_id || item.project_id}?tab=quality_check`)}
                                            style={{
                                                backgroundColor: '#ffffff',
                                                color: '#0f172a',
                                                border: '1.5px solid #cbd5e1',
                                                padding: '8px 14px',
                                                borderRadius: '8px',
                                                fontSize: '0.82rem',
                                                fontWeight: 700,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '5px',
                                                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                                                transition: 'all 0.15s'
                                            }}
                                            title="Open Quality Check Tab for this project"
                                        >
                                            <Eye size={14} color="#64748b" /> View QC Folder
                                        </button>

                                        {/* ✓ Final Approve Button */}
                                        <button
                                            onClick={() => handleApproveQC(item)}
                                            style={{
                                                backgroundColor: '#16a34a',
                                                color: '#ffffff',
                                                border: 'none',
                                                padding: '8px 16px',
                                                borderRadius: '8px',
                                                fontSize: '0.82rem',
                                                fontWeight: 800,
                                                cursor: 'pointer',
                                                boxShadow: '0 2px 6px rgba(22, 163, 74, 0.25)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '5px',
                                                transition: 'all 0.15s'
                                            }}
                                            title="Final Admin Approval"
                                        >
                                            <Check size={14} /> Approve Version
                                        </button>

                                        {/* ✕ Reject Button */}
                                        <button
                                            onClick={() => handleRejectQC(item)}
                                            style={{
                                                backgroundColor: '#dc2626',
                                                color: '#ffffff',
                                                border: 'none',
                                                padding: '8px 16px',
                                                borderRadius: '8px',
                                                fontSize: '0.82rem',
                                                fontWeight: 800,
                                                cursor: 'pointer',
                                                boxShadow: '0 2px 6px rgba(220, 38, 38, 0.25)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '5px',
                                                transition: 'all 0.15s'
                                            }}
                                            title="Return back to QC"
                                        >
                                            <XCircle size={14} /> Reject Version
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                )}

                {/* Tab Body: Category-Wise Discount Approval Requests */}
                {approvalTab === 'discount_approvals' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* Admin Max Allowed Discount Governance Card */}
                        <div style={{
                            padding: '16px 20px',
                            background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
                            borderRadius: '12px',
                            border: '1.5px solid #fed7aa',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '14px',
                            boxShadow: '0 2px 6px rgba(234, 88, 12, 0.06)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '320px' }}>
                                <div style={{
                                    width: '42px',
                                    height: '42px',
                                    borderRadius: '10px',
                                    backgroundColor: '#ea580c',
                                    color: '#ffffff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '1.3rem',
                                    boxShadow: '0 2px 6px rgba(234, 88, 12, 0.3)'
                                }}>
                                    🛡️
                                </div>
                                <div>
                                    <div style={{ fontWeight: 800, color: '#9a3412', fontSize: '0.98rem' }}>
                                        Default Category Max Discount Ceiling: <span style={{ color: '#ea580c', fontSize: '1.1rem' }}>{adminMaxDiscount}%</span>
                                    </div>
                                    <div style={{ fontSize: '0.78rem', color: '#7c2d12', marginTop: '2px' }}>
                                        Designers can give discounts up to this limit without approval. Any discount above this threshold requires Admin Approval below.
                                    </div>
                                </div>
                            </div>

                            {/* Admin Quick Adjust Input */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#9a3412' }}>Adjust Limit:</span>
                                <div style={{ display: 'inline-flex', alignItems: 'center', backgroundColor: '#ffffff', border: '1.5px solid #ea580c', borderRadius: '7px', overflow: 'hidden' }}>
                                    <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        value={newMaxDiscountInput}
                                        onChange={(e) => setNewMaxDiscountInput(e.target.value)}
                                        style={{
                                            width: '60px',
                                            padding: '6px 8px',
                                            border: 'none',
                                            textAlign: 'center',
                                            fontWeight: 800,
                                            fontSize: '0.92rem',
                                            color: '#ea580c',
                                            outline: 'none'
                                        }}
                                    />
                                    <span style={{ padding: '6px 10px 6px 2px', fontSize: '0.86rem', fontWeight: 800, color: '#ea580c', backgroundColor: '#fff' }}>%</span>
                                </div>
                                <button
                                    onClick={handleSaveMaxDiscountLimit}
                                    disabled={isUpdatingMaxDiscount}
                                    style={{
                                        backgroundColor: '#ea580c',
                                        color: '#ffffff',
                                        border: 'none',
                                        padding: '7px 16px',
                                        borderRadius: '7px',
                                        fontSize: '0.82rem',
                                        fontWeight: 800,
                                        cursor: isUpdatingMaxDiscount ? 'not-allowed' : 'pointer',
                                        boxShadow: '0 2px 4px rgba(234, 88, 12, 0.25)',
                                        opacity: isUpdatingMaxDiscount ? 0.7 : 1
                                    }}
                                >
                                    {isUpdatingMaxDiscount ? 'Saving...' : 'Update Max Limit'}
                                </button>
                            </div>
                        </div>

                        {/* Requests List */}
                        {pendingDiscountApprovals.length === 0 ? (
                            <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0, textAlign: 'center', padding: '36px 0', backgroundColor: '#f0fdf4', borderRadius: '12px', border: '1px dashed #bbf7d0' }}>
                                🎉 No category discount approval requests found. All quotations are within allowed limits!
                            </p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                {pendingDiscountApprovals.map((item) => {
                                    const isPending = item.status === 'pending';
                                    const isApproved = item.status === 'approved';
                                    const isRejected = item.status === 'rejected';

                                    const catDiscounts = item.category_discounts_parsed || {};
                                    const exceedingList = item.exceeding_details_parsed || [];
                                    const catKeys = Object.keys(catDiscounts);

                                    return (
                                        <div
                                            key={item.id}
                                            style={{
                                                background: '#ffffff',
                                                borderRadius: '14px',
                                                border: isPending ? '1.5px solid #fed7aa' : (isApproved ? '1.5px solid #bbf7d0' : '1.5px solid #fecaca'),
                                                padding: '18px 22px',
                                                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '12px'
                                            }}
                                        >
                                            {/* Header */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                        <span
                                                            onClick={() => item.project_id && navigate(`/projects/${item.project_id}?tab=quotation`)}
                                                            style={{
                                                                fontWeight: 800,
                                                                color: '#0f172a',
                                                                fontSize: '1.05rem',
                                                                cursor: item.project_id ? 'pointer' : 'default',
                                                                textDecoration: item.project_id ? 'underline' : 'none',
                                                                textDecorationColor: '#cbd5e1'
                                                            }}
                                                            title={item.project_id ? "Click to view project quotations" : undefined}
                                                        >
                                                            {item.project_name || `Project #${item.project_id || 'N/A'}`}
                                                        </span>
                                                        {item.client_name && (
                                                            <span style={{ fontSize: '0.80rem', color: '#475569', fontWeight: 700, backgroundColor: '#f1f5f9', padding: '2px 8px', borderRadius: '6px' }}>
                                                                Client: {item.client_name}
                                                            </span>
                                                        )}
                                                        {item.quote_id && (
                                                            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
                                                                Quote #{item.quote_id}
                                                            </span>
                                                        )}
                                                        {/* Status Badge */}
                                                        {isPending && (
                                                            <span style={{ background: '#fff7ed', color: '#c2410c', fontSize: '0.74rem', fontWeight: 800, padding: '3px 10px', borderRadius: '12px', border: '1px solid #fed7aa', textTransform: 'uppercase' }}>
                                                                ⏳ Pending Approval
                                                            </span>
                                                        )}
                                                        {isApproved && (
                                                            <span style={{ background: '#f0fdf4', color: '#15803d', fontSize: '0.74rem', fontWeight: 800, padding: '3px 10px', borderRadius: '12px', border: '1px solid #bbf7d0', textTransform: 'uppercase' }}>
                                                                ✅ Approved
                                                            </span>
                                                        )}
                                                        {isRejected && (
                                                            <span style={{ background: '#fef2f2', color: '#b91c1c', fontSize: '0.74rem', fontWeight: 800, padding: '3px 10px', borderRadius: '12px', border: '1px solid #fecaca', textTransform: 'uppercase' }}>
                                                                ❌ Rejected
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div style={{ color: '#64748b', fontSize: '0.80rem', marginTop: '4px', fontWeight: 600 }}>
                                                        Requested by: <strong style={{ color: '#334155' }}>{item.requested_by_name || 'Designer'}</strong>
                                                        {item.created_at ? ` • Submitted on ${new Date(item.created_at).toLocaleString('en-IN')}` : ''}
                                                    </div>
                                                </div>

                                                {/* Action Buttons for Pending */}
                                                {isPending && (
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        <button
                                                            onClick={() => handleApproveDiscountRequest(item)}
                                                            disabled={discountApprovalLoadingId === item.id}
                                                            style={{
                                                                backgroundColor: '#16a34a',
                                                                color: '#ffffff',
                                                                border: 'none',
                                                                padding: '7px 16px',
                                                                borderRadius: '7px',
                                                                fontSize: '0.82rem',
                                                                fontWeight: 800,
                                                                cursor: 'pointer',
                                                                boxShadow: '0 2px 4px rgba(22, 163, 74, 0.25)',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '5px'
                                                            }}
                                                        >
                                                            <Check size={14} /> Approve Request
                                                        </button>
                                                        <button
                                                            onClick={() => handleRejectDiscountRequest(item)}
                                                            disabled={discountApprovalLoadingId === item.id}
                                                            style={{
                                                                backgroundColor: '#ffffff',
                                                                color: '#dc2626',
                                                                border: '1.5px solid #fca5a5',
                                                                padding: '7px 14px',
                                                                borderRadius: '7px',
                                                                fontSize: '0.82rem',
                                                                fontWeight: 800,
                                                                cursor: 'pointer',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '5px'
                                                            }}
                                                        >
                                                            <XCircle size={14} /> Reject
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Reviewed info */}
                                                {!isPending && (
                                                    <div style={{ fontSize: '0.78rem', color: '#64748b', textAlign: 'right' }}>
                                                        <div>Reviewed by: <strong style={{ color: '#334155' }}>{item.reviewed_by_name || 'Admin'}</strong></div>
                                                        {item.reviewed_at && <div>{new Date(item.reviewed_at).toLocaleString('en-IN')}</div>}
                                                        {item.rejection_reason && (
                                                            <div style={{ color: '#dc2626', fontWeight: 700, marginTop: '2px' }}>
                                                                Reason: {item.rejection_reason}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Notes / Reason */}
                                            {item.notes && (
                                                <div style={{ backgroundColor: '#f8fafc', padding: '8px 12px', borderRadius: '6px', fontSize: '0.80rem', color: '#334155', border: '1px solid #e2e8f0' }}>
                                                    💬 <strong>Designer Justification:</strong> {item.notes}
                                                </div>
                                            )}

                                            {/* Categories Breakdown Table */}
                                            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                                    <thead>
                                                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                                                            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 800 }}>Category Name</th>
                                                            <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 800 }}>Discount Type</th>
                                                            <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 800 }}>Requested Discount</th>
                                                            <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 800 }}>Max Allowed Limit</th>
                                                            <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 800, color: '#ea580c' }}>Extra % Over Limit</th>
                                                            <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 800 }}>Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {catKeys.length === 0 ? (
                                                            <tr>
                                                                <td colSpan={6} style={{ textAlign: 'center', padding: '16px', color: '#94a3b8' }}>
                                                                    No specific category list attached
                                                                </td>
                                                            </tr>
                                                        ) : (
                                                            catKeys.map((catName) => {
                                                                const catData = catDiscounts[catName];
                                                                const val = typeof catData === 'object' ? (catData.value ?? 0) : Number(catData || 0);
                                                                const type = typeof catData === 'object' ? (catData.type || 'percent') : 'percent';
                                                                const maxLim = typeof catData === 'object' && catData.maxDiscount !== undefined ? catData.maxDiscount : adminMaxDiscount;
                                                                const isExceeding = val > maxLim;

                                                                return (
                                                                    <tr key={catName} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: isExceeding ? '#fff7ed' : '#ffffff' }}>
                                                                        <td style={{ padding: '8px 12px', fontWeight: 800, color: '#0f172a' }}>
                                                                            🏷️ {catName}
                                                                        </td>
                                                                        <td style={{ padding: '8px 12px', textAlign: 'center', color: '#475569', textTransform: 'capitalize' }}>
                                                                            {type === 'percent' ? '% Percentage' : '₹ Flat Off'}
                                                                        </td>
                                                                        <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 800, color: isExceeding ? '#ea580c' : '#0f172a' }}>
                                                                            {val}{type === 'percent' ? '%' : '₹'}
                                                                        </td>
                                                                        <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700, color: '#64748b' }}>
                                                                            {maxLim}%
                                                                        </td>
                                                                        <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 800, color: isExceeding ? '#dc2626' : '#16a34a' }}>
                                                                            {isExceeding ? `+${(val - maxLim).toFixed(1)}%` : '0% (Within limit)'}
                                                                        </td>
                                                                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                                                            {isApproved ? (
                                                                                <span style={{ color: '#15803d', fontWeight: 800, fontSize: '0.72rem' }}>✓ Approved</span>
                                                                            ) : isRejected ? (
                                                                                <span style={{ color: '#b91c1c', fontWeight: 800, fontSize: '0.72rem' }}>✕ Rejected</span>
                                                                            ) : isExceeding ? (
                                                                                <span style={{ color: '#ea580c', fontWeight: 800, fontSize: '0.72rem' }}>🔒 Needs Sign-off</span>
                                                                            ) : (
                                                                                <span style={{ color: '#16a34a', fontWeight: 800, fontSize: '0.72rem' }}>✓ Allowed</span>
                                                                            )}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>

                                            {/* Subtotal & Discount summary line if available */}
                                            {(Number(item.total_subtotal) > 0 || Number(item.total_discount_amount) > 0) && (
                                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '20px', fontSize: '0.82rem', fontWeight: 700, color: '#475569', paddingTop: '4px' }}>
                                                    {Number(item.total_subtotal) > 0 && (
                                                        <span>Subtotal: <strong style={{ color: '#0f172a' }}>₹{Number(item.total_subtotal).toLocaleString('en-IN')}</strong></span>
                                                    )}
                                                    {Number(item.total_discount_amount) > 0 && (
                                                        <span>Total Requested Discount: <strong style={{ color: '#dc2626' }}>₹{Number(item.total_discount_amount).toLocaleString('en-IN')}</strong></span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Tab Body: Transport Expense Approvals */}
                {approvalTab === 'transport_approvals' && (
                    renderExpenseCategoryApprovalView('Transport', <Truck size={20} />, '#0284c7', '#e0f2fe', transportList)
                )}

                {/* Tab Body: Labor Expense Approvals */}
                {approvalTab === 'labor_approvals' && (
                    renderExpenseCategoryApprovalView('Labor', <HardHat size={20} />, '#d97706', '#fef3c7', laborList)
                )}

                {/* Tab Body: Miscellaneous Expense Approvals */}
                {approvalTab === 'misc_approvals' && (
                    renderExpenseCategoryApprovalView('Miscellaneous', <Package size={20} />, '#7c3aed', '#ede9fe', miscList)
                )}

                {/* Tab Body: Reimbursements Expense Approvals */}
                {approvalTab === 'reimbursements_approvals' && (
                    renderExpenseCategoryApprovalView('Reimbursements', <Receipt size={20} />, '#059669', '#dcfce7', reimbursementsList)
                )}
            </div>

            {/* Project Timelines & Category Status */}
            <div style={{ marginBottom: '30px' }} className="premium-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0c1527', margin: 0, letterSpacing: '-0.2px' }}>
                            Project Timelines &amp; Category Trackers
                        </h3>
                        <p style={{ margin: '3px 0 0 0', fontSize: '0.88rem', color: '#64748b' }}>
                            Track active project categories and real-time execution status
                        </p>
                    </div>
                    <button
                        onClick={() => navigate('/project-timelines')}
                        style={{
                            backgroundColor: '#fca412',
                            color: '#ffffff',
                            border: 'none',
                            padding: '8px 18px',
                            borderRadius: '8px',
                            fontSize: '0.85rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(252, 164, 18, 0.3)',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        Go to Project Timelines ➜
                    </button>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid #f1f5f9', textAlign: 'left' }}>
                                <th style={{ padding: '12px 8px', color: '#64748b', fontWeight: 600 }}>Project Name</th>
                                <th style={{ padding: '12px 8px', color: '#64748b', fontWeight: 600 }}>Project Type</th>
                                <th style={{ padding: '12px 8px', color: '#64748b', fontWeight: 600 }}>Timeline Category</th>
                                <th style={{ padding: '12px 8px', color: '#64748b', fontWeight: 600 }}>Assignment Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {allProjects.length === 0 ? (
                                <tr>
                                    <td colSpan={4} style={{ padding: '20px 8px', textAlign: 'center', color: '#64748b' }}>
                                        No active projects registered.
                                    </td>
                                </tr>
                            ) : (
                                allProjects.map((project) => {
                                    const tStat = getProjectTrackerStatus(project);
                                    return (
                                        <tr key={project.project_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                            <td style={{ padding: '12px 8px', fontWeight: 700, color: '#1e293b' }}>
                                                {project.project_name}
                                            </td>
                                            <td style={{ padding: '12px 8px', color: '#475569' }}>
                                                {project.project_type || 'General'}
                                            </td>
                                            <td style={{ padding: '12px 8px', fontWeight: 600, color: tStat.color }}>
                                                {tStat.categoryLabel}
                                            </td>
                                            <td style={{ padding: '12px 8px' }}>
                                                <span style={{
                                                    fontSize: '0.72rem',
                                                    fontWeight: 700,
                                                    padding: '4px 10px',
                                                    borderRadius: '12px',
                                                    color: tStat.color,
                                                    backgroundColor: tStat.bg,
                                                    textTransform: 'uppercase'
                                                }}>
                                                    {tStat.statusText}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div style={{ marginTop: '20px' }} className="premium-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0c1527', margin: 0, letterSpacing: '-0.2px' }}>Recent Activities</h3>
                        <p style={{ margin: '3px 0 0 0', fontSize: '0.88rem', color: '#64748b' }}>Latest updates and milestone notifications across active projects</p>
                    </div>
                    <button style={{ color: '#fca412', fontSize: '0.88rem', fontWeight: 800, background: 'none', border: 'none', cursor: 'pointer' }}>View All ➜</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <ActivityItem icon={<Package size={16} />} title="New Material Request" time="2 hours ago" desc="Request for 50 Bags of Cement at Project Oasis" />
                    <ActivityItem icon={<ArrowUpRight size={16} />} title="Payment Received" time="5 hours ago" desc="₹50,000 received for Project Skyline Milestone 1" />
                    <ActivityItem icon={<Clock size={16} />} title="Project Milestone" time="Yesterday" desc="Civil work completed for Green Villa Project" />
                </div>
            </div>

            {/* 🖼️ Receipt Image Zoom Modal */}
            {viewReceiptModalUrl && (
                <div
                    onClick={() => setViewReceiptModalUrl(null)}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.75)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 99999,
                        padding: '20px'
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            backgroundColor: '#ffffff',
                            borderRadius: '12px',
                            maxWidth: '90vw',
                            maxHeight: '90vh',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                            boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
                        }}
                    >
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '12px 18px',
                            borderBottom: '1px solid #e2e8f0',
                            backgroundColor: '#f8fafc'
                        }}>
                            <span style={{ fontWeight: 700, color: '#0c1527', fontSize: '0.95rem' }}>Receipt / Bill Preview</span>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <a
                                    href={viewReceiptModalUrl}
                                    download="expense_receipt.jpg"
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        padding: '5px 12px',
                                        borderRadius: '6px',
                                        backgroundColor: '#0c1527',
                                        color: '#ffffff',
                                        fontSize: '0.78rem',
                                        fontWeight: 700,
                                        textDecoration: 'none'
                                    }}
                                >
                                    <Download size={13} /> Download
                                </a>
                                <button
                                    onClick={() => setViewReceiptModalUrl(null)}
                                    style={{
                                        border: 'none',
                                        background: 'none',
                                        cursor: 'pointer',
                                        color: '#64748b',
                                        display: 'flex',
                                        alignItems: 'center'
                                    }}
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>
                        <div style={{ padding: '16px', overflow: 'auto', textAlign: 'center', maxHeight: 'calc(90vh - 60px)' }}>
                            <img
                                src={viewReceiptModalUrl}
                                alt="Receipt proof"
                                style={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain', borderRadius: '6px' }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const StatCard = ({ icon, label, value, color, badge, badgeColor, subtext }: any) => (
    <div className="premium-card" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        padding: '18px 20px',
        position: 'relative'
    }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
                padding: '12px',
                borderRadius: '12px',
                backgroundColor: `${color}18`,
                color: color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
            }}>
                {icon}
            </div>
            <div>
                <p style={{ fontSize: '0.84rem', color: '#64748b', fontWeight: 600, marginBottom: '2px' }}>{label}</p>
                <h4 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0c1527', margin: 0, lineHeight: 1.2 }}>{value}</h4>
                {subtext && (
                    <p style={{ fontSize: '0.74rem', color: '#94a3b8', margin: '3px 0 0 0', fontWeight: 500 }}>{subtext}</p>
                )}
            </div>
        </div>
        {badge && (
            <span style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '3px 9px',
                borderRadius: '12px',
                color: badgeColor || color,
                backgroundColor: `${badgeColor || color}15`,
                border: `1px solid ${badgeColor || color}30`,
                whiteSpace: 'nowrap',
                alignSelf: 'flex-start'
            }}>
                {badge}
            </span>
        )}
    </div>
);

const ActivityItem = ({ icon, title, time, desc }: any) => (
    <div style={{ display: 'flex', gap: '15px', padding: '12px 0', borderBottom: '1px solid #f3f4f6' }}>
        <div style={{ marginTop: '2px', color: '#fca412' }}>{icon}</div>
        <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{title}</span>
                <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{time}</span>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '2px' }}>{desc}</p>
        </div>
    </div>
);
