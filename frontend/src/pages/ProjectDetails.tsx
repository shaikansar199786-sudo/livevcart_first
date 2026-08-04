import React, { useState, useEffect, useRef } from 'react';
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
    ChevronRight
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import QuoteTab from '../components/QuoteTab';
import { DocumentTab } from '../components/DocumentTab';

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
    const [inventoryTotal, setInventoryTotal] = useState(0);

    const [transactions, setTransactions] = useState<any[]>([]);

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

    useEffect(() => {
        fetchProjectDetails();
        fetchTransactions();
        fetchInventoryTotal();
        fetchQuoteTotal();
        if (user?.role === 'admin' || user?.role === 'accountant') {
            fetchUsers();
        }
    }, [id, user]);

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
                setProject(response.data.data);
                setBudget(response.data.data.total_budget);
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

    const renderTabs = () => {
        const tabs = ['overview', 'quote', 'documents', 'timeline', 'pm_timeline', 'stage_notes', 'stock_category', 'vendor_quta', 'transport', 'labor', 'miscellaneous', 'other_expenses', 'balance_sheet'].filter(tab => {

            // Admin and Accountant see all tabs
            if (user?.role === 'admin' || user?.role === 'accountant') {
                return true;
            }

            // Project Head sees these tabs
            if (user?.role === 'project_head') {
                return ['timeline', 'pm_timeline', 'stage_notes', 'stock_category', 'vendor_quta', 'transport', 'labor', 'miscellaneous', 'other_expenses'].includes(tab);
            }

            // Project Manager sees timeline tabs + stage notes
            if (user?.role === 'project_manager' || user?.role === 'manager') {
                return ['timeline', 'pm_timeline', 'stage_notes', 'stock_category', 'vendor_quta', 'transport', 'labor', 'miscellaneous', 'other_expenses'].includes(tab);
            }

            // Site Engineer sees timeline tabs
            if (user?.role === 'site_engineer') {
                return ['timeline', 'pm_timeline', 'stage_notes', 'stock_category'].includes(tab);
            }

            // Designer roles see overview, documents, timeline and stage notes
            if (['d1', 'd2', 'graphic_designer', 'gd'].includes(user?.role)) {
                return ['overview', 'documents', 'timeline', 'pm_timeline', 'stage_notes'].includes(tab);
            }

            // Default: overview only
            return tab === 'overview';
        });

        return (
            <div className="tabs-container" style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid #e5e7eb', paddingBottom: '1px', flexWrap: 'wrap' }}>
                {tabs.map((tab) => (
                    <button
                        key={tab}
                        onClick={() => handleTabChange(tab)}
                        style={{
                            padding: '12px 20px',
                            fontSize: '0.92rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            background: 'none',
                            border: 'none',
                            borderBottom: activeTab === tab ? '3px solid #253b50' : '3px solid transparent',
                            color: activeTab === tab ? '#253b50' : '#6b7280',
                            textTransform: 'capitalize',
                            transition: 'all 0.2s'
                        }}
                    >
                        {tab === 'vendor_quta' ? 'Vendor Bill' : tab === 'timeline' ? 'Designer Timeline' : tab === 'pm_timeline' ? 'Project Manager Timeline' : tab === 'stage_notes' ? '📋 Stage Notes' : tab === 'quote' ? 'Quote' : tab === 'other_expenses' ? 'Other Expenses' : tab.replace('_', ' ')}
                    </button>
                ))}
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

            <div className="no-print">
                {renderTabs()}
            </div>

            {activeTab === 'overview' && <OverviewTab project={project} budget={budget} quoteTotal={quoteTotal} isAccountant={isAccountant} setShowBudgetModal={setShowBudgetModal} />}
            {activeTab === 'documents' && <DocumentTab projectId={project.project_id} />}
            {activeTab === 'timeline' && <TimelineTab project={project} user={user} type="designer" fetchProjectDetails={fetchProjectDetails} totalPaid={transactions.filter((t: any) => t.type === 'credit').reduce((s: number, t: any) => s + parseFloat(t.amount || 0), 0)} />}
            {activeTab === 'pm_timeline' && <TimelineTab project={project} user={user} type="pm" fetchProjectDetails={fetchProjectDetails} totalPaid={transactions.filter((t: any) => t.type === 'credit').reduce((s: number, t: any) => s + parseFloat(t.amount || 0), 0)} />}
            {activeTab === 'stage_notes' && <StageNotesTab project={project} user={user} filterType="pm" />}
            {activeTab === 'quote' && <QuoteTab key={`qtab-${project?.project_id}-${project?.client_name}`} project={project} setQuoteTotal={(val: number) => { setQuoteTotal(val); setBudget(val.toString()); fetchProjectDetails(); }} isReadOnly={user?.role === 'site_engineer'} user={user} isUsedQuote={false} />}
            {activeTab === 'stock_category' && <StockCategoryTab project={project} user={user} />}

            {activeTab === 'vendor_quta' && <InventoryTab key={project?.project_id} project={project} setInventoryTotal={setInventoryTotal} user={user} />}
            {activeTab === 'transport' && <ExpenseCategoryTab project={project} category="Transport" transactions={transactions} fetchTransactions={fetchTransactions} user={user} />}
            {activeTab === 'labor' && <ExpenseCategoryTab project={project} category="Labor" transactions={transactions} fetchTransactions={fetchTransactions} user={user} />}
            {activeTab === 'miscellaneous' && <ExpenseCategoryTab project={project} category="Miscellaneous" transactions={transactions} fetchTransactions={fetchTransactions} user={user} />}
            {activeTab === 'other_expenses' && <ExpenseCategoryTab project={project} category="Other" transactions={transactions} fetchTransactions={fetchTransactions} user={user} />}
            {activeTab === 'balance_sheet' && <BalanceSheetTab project={project} transactions={transactions}
                quoteTotal={quoteTotal}
                inventoryTotal={inventoryTotal}
                fetchTransactions={fetchTransactions} />}



            {/* Modals */}
            {showBudgetModal && <BudgetModal budget={budget} setBudget={setBudget} submitting={submitting} handleUpdateBudget={handleUpdateBudget} setShowBudgetModal={setShowBudgetModal} />}
            {showPaymentModal && <PaymentModal payment={payment} setPayment={setPayment} submitting={submitting} handleRecordPayment={handleRecordPayment} setShowPaymentModal={setShowPaymentModal} />}

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
                                    <input type="date" required value={editForm.start_date} onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>End Date</label>
                                    <input type="date" required value={editForm.expected_end_date} onChange={(e) => setEditForm({ ...editForm, expected_end_date: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
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

const OverviewTab = ({ project, budget, quoteTotal, isAccountant, setShowBudgetModal }: any) => {
    // We use budget for Financial Overview instead of quoteTotal
    const displayBudget = Number(budget) || 0;
    const progress = Math.round((project.total_paid / (displayBudget || 1)) * 100);
    return (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div className="premium-card">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                        <div>
                            <h4 style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '8px' }}>Client Information</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600 }}>
                                    <User size={16} color="#253b50" /> {project.client_name}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#253b50' }}>
                                    <Phone size={16} /> <a href={`tel:${project.client_phone}`} style={{ color: 'inherit', textDecoration: 'none' }}>{project.client_phone}</a>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', color: '#6b7280', fontSize: '0.85rem' }}>
                                    <MapPin size={14} style={{ marginTop: '2px' }} />
                                    <span>{project.site_address}</span>
                                </div>
                                <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                                    <span style={{
                                        padding: '4px 12px',
                                        borderRadius: '20px',
                                        backgroundColor: '#253b50',
                                        color: 'white',
                                        fontSize: '0.7rem',
                                        fontWeight: 700,
                                        textTransform: 'uppercase'
                                    }}>
                                        {project.project_type}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div>
                            <h4 style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '8px' }}>Project Site Location</h4>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', color: '#253b50', fontWeight: 500 }}>
                                <MapPin size={16} style={{ marginTop: '4px' }} />
                                <span style={{ fontSize: '0.95rem' }}>{project.client_address}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="premium-card">
                    <h3 style={{ marginBottom: '20px', fontSize: '1.2rem', fontWeight: 700 }}>Financial Overview</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                        <div style={{ padding: '20px', borderRadius: '12px', backgroundColor: '#f8fafc', border: '1px solid #f1f5f9' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', marginBottom: '8px', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Briefcase size={16} /> <span style={{ fontSize: '0.85rem' }}>Project Budget</span>
                                </div>
                                {isAccountant && (
                                    <button onClick={() => setShowBudgetModal(true)} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                                        <Edit2 size={12} /> Edit
                                    </button>
                                )}
                            </div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#253b50' }}>₹{displayBudget.toLocaleString()}</div>
                        </div>
                        <div style={{ padding: '20px', borderRadius: '12px', backgroundColor: '#f0fdf4', border: '1px solid #dcfce7' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#166534', marginBottom: '8px' }}>
                                <CheckCircle2 size={16} /> <span style={{ fontSize: '0.85rem' }}>Paid Amount</span>
                            </div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#15803d' }}>₹{project.total_paid.toLocaleString()}</div>
                        </div>
                        <div style={{ padding: '20px', borderRadius: '12px', backgroundColor: '#fff7ed', border: '1px solid #ffedd5' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#9a3412', marginBottom: '8px' }}>
                                <CreditCard size={16} /> <span style={{ fontSize: '0.85rem' }}>Remaining</span>
                            </div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#c2410c' }}>₹{(displayBudget - project.total_paid).toLocaleString()}</div>
                        </div>
                    </div>
                    <div style={{ marginTop: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ fontSize: '0.9rem', color: '#6b7280' }}>Payment Progress</span>
                            <span style={{ fontWeight: 700, color: '#253b50' }}>{progress}% Received</span>
                        </div>
                        <div style={{ width: '100%', height: '8px', backgroundColor: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${progress}%`, height: '100%', backgroundColor: '#10b981', transition: 'width 0.5s ease' }}></div>
                        </div>
                    </div>

                    <div style={{ marginTop: '30px', borderTop: '1px solid #e2e8f0', paddingTop: '24px' }}>
                        <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#253b50', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            💳 Payment-Timeline Milestone Gates
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            {[
                                { name: 'Designer Timeline', req: 10, label: 'Timeline Start (10%)' },
                                { name: 'Masking Stage', req: 20, label: 'Masking Works (20%)' },
                                { name: 'R2P (Ready to Paint)', req: 60, label: 'Production / Paint (60%)' },
                                { name: 'Delivery Phases', req: 95, label: 'Distribution & Transit (95%)' },
                                { name: 'Project Handover', req: 100, label: 'Final Handover (100%)' }
                            ].map((gate) => {
                                const unlocked = progress >= gate.req;
                                return (
                                    <div key={gate.name} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '12px 16px',
                                        borderRadius: '10px',
                                        backgroundColor: unlocked ? '#f0fdf4' : '#fef2f2',
                                        border: unlocked ? '1px solid #bbf7d0' : '1px solid #fecaca',
                                        transition: 'all 0.3s ease'
                                    }}>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: unlocked ? '#166534' : '#991b1b' }}>{gate.name}</span>
                                            <span style={{ fontSize: '0.72rem', color: unlocked ? '#15803d' : '#b91c1c', opacity: 0.85 }}>{gate.label}</span>
                                        </div>
                                        <span style={{
                                            padding: '4px 8px',
                                            borderRadius: '6px',
                                            fontSize: '0.7rem',
                                            fontWeight: 800,
                                            backgroundColor: unlocked ? '#dcfce7' : '#fee2e2',
                                            color: unlocked ? '#15803d' : '#ef4444',
                                            textTransform: 'uppercase'
                                        }}>
                                            {unlocked ? '🔓 Unlocked' : '🔒 Locked'}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div className="premium-card">
                    <h3 style={{ marginBottom: '20px', fontSize: '1.2rem', fontWeight: 700 }}>Assigned Team</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {project.team.map((member: any, idx: number) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '8px', backgroundColor: '#f8fafc' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#253b50', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                                    {member.name.charAt(0)}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>{member.name}</p>
                                    <p style={{ fontSize: '0.8rem', color: '#6b7280', textTransform: 'capitalize' }}>{member.assignment_role.replace('_', ' ')}</p>
                                </div>
                            </div>
                        ))}
                    </div>
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
                                        style={inputStyle}
                                        type="date"
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
    // Standard fields
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');

    // Labor specific fields
    const [name, setName] = useState('');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [paymentMode, setPaymentMode] = useState('Cash');

    // Edit state fields
    const [editingTransaction, setEditingTransaction] = useState<any>(null);

    const [submitting, setSubmitting] = useState(false);

    const filteredTransactions = transactions.filter((t: any) => t.type === 'debit' && t.category === category);

    // Populate form when editing starts
    const startEdit = (t: any) => {
        setEditingTransaction(t);
        setAmount(t.amount.toString());
        setPaymentDate(t.transaction_date ? t.transaction_date.split(' ')[0] : new Date().toISOString().split('T')[0]);
        setName(t.person_name || '');
        setPaymentMode(t.payment_mode || 'Cash');
        setDescription(t.description || '');
    };

    // Cancel editing
    const cancelEdit = () => {
        setEditingTransaction(null);
        setAmount('');
        setDescription('');
        setName('');
        setPaymentDate(new Date().toISOString().split('T')[0]);
        setPaymentMode('Cash');
    };

    const handleAddExpense = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const payload: any = {
                project_id: project.project_id,
                type: 'debit',
                category: category,
                recorded_by: user?.user_id
            };

            payload.amount = amount;
            payload.person_name = name;
            payload.date = paymentDate;
            payload.payment_mode = paymentMode;
            payload.description = description;

            let response;
            if (editingTransaction) {
                payload.transaction_id = editingTransaction.transaction_id;
                payload.date = paymentDate;
                response = await axios.post(`${API_BASE_URL}/finance/update`, payload);
            } else {
                response = await axios.post(`${API_BASE_URL}/finance`, payload);
            }

            if (response.data.success) {
                cancelEdit();
                fetchTransactions();
            } else {
                alert(response.data.message || 'Failed to save transaction');
            }
        } catch (err) {
            alert('Failed to record expense');
        } finally {
            setSubmitting(false);
        }
    };

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

    return (
        <div className="premium-card" style={{ padding: '30px' }}>
            <h3 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '20px' }}>
                {editingTransaction ? 'Edit' : ''} {category} Expense{editingTransaction ? 's' : ''}
            </h3>

            <form onSubmit={handleAddExpense} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 2fr auto auto', gap: '15px', marginBottom: '30px', alignItems: 'end' }}>
                <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}>Name</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} placeholder="Enter name" />
                </div>
                <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}>Payment Date</label>
                    <input type="date" required value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
                </div>
                <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}>Payment Amount (₹)</label>
                    <input type="number" required value={amount} onChange={(e) => setAmount(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} placeholder="0.00" />
                </div>
                <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}>Payment Mode</label>
                    <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                        <option value="Cash">Cash</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="UPI">UPI</option>
                        <option value="Cheque">Cheque</option>
                    </select>
                </div>
                <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}>Description</label>
                    <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} placeholder="Enter details..." />
                </div>
                <button type="submit" disabled={submitting} className="btn-primary" style={{ padding: '10px 20px', height: '42px' }}>
                    {submitting ? 'Saving...' : (editingTransaction ? 'Save' : 'Add')}
                </button>
                {editingTransaction && (
                    <button type="button" onClick={cancelEdit} className="btn-secondary" style={{ padding: '10px 20px', height: '42px', backgroundColor: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
                        Cancel
                    </button>
                )}
            </form>

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                        <th style={{ padding: '12px', textAlign: 'left', color: '#475569', fontSize: '0.85rem', fontWeight: 700 }}>DATE</th>
                        <th style={{ padding: '12px', textAlign: 'left', color: '#475569', fontSize: '0.85rem', fontWeight: 700 }}>NAME</th>
                        <th style={{ padding: '12px', textAlign: 'left', color: '#475569', fontSize: '0.85rem', fontWeight: 700 }}>MODE</th>
                        <th style={{ padding: '12px', textAlign: 'left', color: '#475569', fontSize: '0.85rem', fontWeight: 700 }}>DESCRIPTION</th>
                        <th style={{ padding: '12px', textAlign: 'right', color: '#475569', fontSize: '0.85rem', fontWeight: 700 }}>AMOUNT</th>
                        <th style={{ padding: '12px', textAlign: 'center', color: '#475569', fontSize: '0.85rem', fontWeight: 700 }}>ACTION</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredTransactions.map((t: any, i: number) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '12px', color: '#64748b' }}>{new Date(t.transaction_date).toLocaleDateString()}</td>
                            <td style={{ padding: '12px', fontWeight: 500 }}>{t.person_name || '-'}</td>
                            <td style={{ padding: '12px', color: '#64748b' }}>{t.payment_mode || '-'}</td>
                            <td style={{ padding: '12px', fontWeight: 500 }}>{t.description || '-'}</td>
                            <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600, color: '#ef4444' }}>
                                ₹{parseFloat(t.amount).toLocaleString()}
                            </td>
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                    <button
                                        onClick={() => startEdit(t)}
                                        style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', padding: '4px', borderRadius: '4px' }}
                                        title="Edit"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteExpense(t.transaction_id)}
                                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px', borderRadius: '4px' }}
                                        title="Delete"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                    {filteredTransactions.length === 0 && (
                        <tr>
                            <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                                No expenses recorded yet.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};;

const BalanceSheetTab = ({ project, transactions, quoteTotal = 0, inventoryTotal = 0, fetchTransactions }: any) => {
    const [editingState, setEditingState] = useState<Record<string, { field: string; value: any }>>({});

    const transportTotal = transactions
        .filter((t: any) => t.type === 'debit' && t.category === 'Transport')
        .reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0);

    const laborTotal = transactions
        .filter((t: any) => t.type === 'debit' && t.category === 'Labor')
        .reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0);

    const miscTotal = transactions
        .filter((t: any) => t.type === 'debit' && t.category === 'Miscellaneous')
        .reduce((sum: number, t: any) => sum + parseFloat(t.amount || 0), 0);

    const otherExpTotal = transactions
        .filter((t: any) => t.type === 'debit' && !['Transport', 'Labor', 'Miscellaneous'].includes(t.category))
        .reduce((sum: number, t: any) => sum + parseFloat(t.amount || 0), 0);

    const totalSpent = inventoryTotal + transportTotal + laborTotal + miscTotal + otherExpTotal;
    const profitOrLoss = quoteTotal - totalSpent;
    const remainingBalance = quoteTotal - project.total_paid;

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
                    <p style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 700, marginBottom: '8px', textTransform: 'uppercase' }}>Total Project Budget</p>
                    <h3 style={{ fontWeight: 800, color: '#253b50', fontSize: '1.8rem' }}>
                        ₹{quoteTotal.toLocaleString()}
                    </h3>
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
                        ₹{quoteTotal.toLocaleString()}
                    </h4>
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
                        ₹{(quoteTotal - totalSpent).toLocaleString()}
                    </h3>
                </div>
            </div>
            {/* TRANSACTIONS LIST */}
            <div className="premium-card" style={{ padding: '30px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1e293b' }}>Payment & Expense Log</h3>
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
                        {transactions.length > 0 ? (
                            transactions.map((tr: any) => {
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
                                                        onChange={(e) => updateEditingValue(tr.transaction_id, e.target.value)}
                                                        style={{ padding: '4px', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '0.85rem' }}
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

const PaymentModal = ({ payment, setPayment, submitting, handleRecordPayment, setShowPaymentModal }: any) => (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
        <div className="premium-card" style={{ width: '100%', maxWidth: '400px', position: 'relative' }}>
            <button onClick={() => setShowPaymentModal(false)} style={{ position: 'absolute', right: '20px', top: '20px', background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            <h3 style={{ marginBottom: '20px' }}>Record Payment</h3>
            <form onSubmit={handleRecordPayment}>
                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>Amount Received (₹)</label>
                    <input type="number" required value={payment.amount} onChange={(e) => setPayment({ ...payment, amount: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db' }} />
                </div>
                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>Description</label>
                    <input type="text" required value={payment.description} onChange={(e) => setPayment({ ...payment, description: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db' }} />
                </div>
                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>Transaction Date</label>
                    <input type="date" required value={payment.date} onChange={(e) => setPayment({ ...payment, date: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db' }} />
                </div>
                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>Payment Mode</label>
                    <select value={payment.payment_mode} onChange={(e) => setPayment({ ...payment, payment_mode: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db' }}>
                        <option value="UPI">UPI</option>
                        <option value="Cash">Cash</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="Cheque">Cheque</option>
                        <option value="NEFT">NEFT</option>
                        <option value="RTGS">RTGS</option>
                        <option value="IMPS">IMPS</option>
                        <option value="Card">Card</option>
                    </select>
                </div>
                <button type="submit" disabled={submitting} className="btn-primary" style={{ width: '100%' }}>
                    {submitting ? 'Recording...' : 'Save Payment'}
                </button>
            </form>
        </div>
    </div>
);
export const StageNotesTab = ({ project, user, filterType = 'pm' }: any) => {
    const API_BASE_URL = (window as any).__API_BASE_URL__ || (import.meta as any).env?.VITE_API_BASE_URL || '';
    const isReadOnly = !['admin', 'project_head', 'project_manager', 'manager'].includes(String(user?.role || '').toLowerCase());

    const [designerTasks, setDesignerTasks] = useState<any[]>([]);
    const [pmTasks, setPmTasks] = useState<any[]>([]);
    const [stageNotes, setStageNotes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (project?.project_id) loadAll();
    }, [project?.project_id]);

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
            setDesignerTasks(dTasks);
            setPmTasks(pTasks);

            const savedNotes: any[] = notesRes.data?.data || [];

            // Build rows from PM categories
            const DESIGNER_ORDER = ['DD', '3D Approval', '2D', 'QC1', 'Masking', 'Signoff', 'Final 2D', 'QC2', 'Final Quote', 'R2P'];
            const PM_ORDER = ['Product Distribution', 'Ready to Dispatch', 'In Transit', 'Delivery', 'Kickoff_M', 'HDS', 'Material Segregation', 'QC', 'Installation', 'Final QC', 'Handover'];

            // Get unique categories in order
            const dCats = dRes.data?.categoryOrder?.length ? dRes.data.categoryOrder : DESIGNER_ORDER;
            const pCats = pmRes.data?.categoryOrder?.length ? pmRes.data.categoryOrder : PM_ORDER;

            // Filter categories based on filterType prop (defaults to 'pm')
            let allCats: string[];
            if (filterType === 'designer') {
                allCats = dCats;
            } else if (filterType === 'all') {
                allCats = [...dCats, ...pCats.filter((c: string) => !dCats.includes(c))];
            } else {
                allCats = pCats; // Default: Only PM categories
            }

            const rows = allCats.map((cat: string) => {
                // Find earliest start and latest end across tasks in this category
                const relevantTasks = filterType === 'pm' ? pTasks : (filterType === 'designer' ? dTasks : [...dTasks, ...pTasks]);
                const catTasks = relevantTasks.filter((t: any) => t.category === cat);
                let startDate = '';
                let endDate = '';
                if (catTasks.length > 0) {
                    const starts = catTasks.map((t: any) => t.startDate).filter(Boolean).sort();
                    const ends = catTasks.map((t: any) => t.endDate).filter(Boolean).sort();
                    startDate = starts[0] || '';
                    endDate = ends[ends.length - 1] || '';
                }

                // Merge with saved note if exists
                const saved = savedNotes.find((n: any) => n.category === cat);
                return {
                    category: cat,
                    startDate: saved?.startDate || startDate,
                    endDate: saved?.endDate || endDate,
                    note: saved?.note || '',
                    source: dCats.includes(cat) ? 'designer' : 'pm'
                };
            });

            setStageNotes(rows);
        } catch (e) {
            console.error('Failed to load stage notes', e);
        } finally {
            setLoading(false);
        }
    };

    const handleFieldChange = (idx: number, field: string, value: string) => {
        setStageNotes(prev => prev.map((row, i) => i === idx ? { ...row, [field]: value } : row));
        setSaved(false);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await axios.post(`${API_BASE_URL}/controllers/timeline/stage-notes.php`, {
                project_id: project.project_id,
                notes: stageNotes
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        } catch (e) {
            alert('Failed to save stage notes');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div style={{ textAlign: 'center', padding: '60px' }}>
            <Loader2 className="animate-spin" style={{ margin: '0 auto', color: '#253b50' }} size={36} />
        </div>
    );

    return (
        <div style={{ padding: '0', fontFamily: 'inherit' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                        📋 Stage Notes
                    </h2>
                    <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '4px 0 0 0' }}>
                        Work descriptions, scheduled dates & remarks for each project stage
                    </p>
                </div>
                {!isReadOnly && (
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '10px 22px',
                            backgroundColor: saved ? '#16a34a' : '#253b50',
                            color: '#ffffff',
                            border: 'none', borderRadius: '10px',
                            fontWeight: 700, fontSize: '0.9rem',
                            cursor: saving ? 'not-allowed' : 'pointer',
                            boxShadow: '0 2px 8px rgba(37,59,80,0.2)',
                            transition: 'all 0.2s'
                        }}
                    >
                        <Save size={16} />
                        {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Notes'}
                    </button>
                )}
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto', borderRadius: '14px', border: '1.5px solid #e2e8f0', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#253b50', color: '#ffffff' }}>
                            <th style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 700, width: '50px', borderRight: '1px solid rgba(255,255,255,0.15)' }}>#</th>
                            <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: 700, minWidth: '160px', borderRight: '1px solid rgba(255,255,255,0.15)' }}>Work Description</th>
                            <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: 700, width: '160px', borderRight: '1px solid rgba(255,255,255,0.15)' }}>Start Date</th>
                            <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: 700, width: '160px', borderRight: '1px solid rgba(255,255,255,0.15)' }}>End Date</th>
                            <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: 700 }}>Note / Remarks</th>
                        </tr>
                    </thead>
                    <tbody>
                        {stageNotes.map((row, idx) => (
                            <tr
                                key={row.category}
                                style={{
                                    backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                                    borderBottom: '1px solid #e2e8f0',
                                    transition: 'background 0.1s'
                                }}
                            >
                                {/* # */}
                                <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#94a3b8', borderRight: '1px solid #e2e8f0' }}>
                                    {idx + 1}
                                </td>

                                {/* Work Description */}
                                <td style={{ padding: '12px 16px', borderRight: '1px solid #e2e8f0' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{
                                            width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                                            backgroundColor: row.source === 'designer' ? '#3b82f6' : '#8b5cf6'
                                        }} />
                                        <span style={{ fontWeight: 700, color: '#0f172a' }}>{row.category}</span>
                                        {!filterType && (
                                            <span style={{
                                                fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px',
                                                borderRadius: '8px', textTransform: 'uppercase',
                                                backgroundColor: row.source === 'designer' ? '#dbeafe' : '#ede9fe',
                                                color: row.source === 'designer' ? '#1d4ed8' : '#6d28d9'
                                            }}>
                                                {row.source === 'designer' ? 'Designer' : 'PM'}
                                            </span>
                                        )}
                                    </div>
                                </td>

                                {/* Start Date */}
                                <td style={{ padding: '10px 16px', borderRight: '1px solid #e2e8f0' }}>
                                    <input
                                        type="date"
                                        value={row.startDate || ''}
                                        onChange={e => handleFieldChange(idx, 'startDate', e.target.value)}
                                        disabled={isReadOnly}
                                        style={{
                                            width: '100%', padding: '7px 10px',
                                            border: '1.5px solid #e2e8f0', borderRadius: '8px',
                                            fontSize: '0.85rem', color: '#0f172a',
                                            backgroundColor: isReadOnly ? '#f8fafc' : '#ffffff',
                                            cursor: isReadOnly ? 'default' : 'pointer',
                                            outline: 'none'
                                        }}
                                    />
                                </td>

                                {/* End Date */}
                                <td style={{ padding: '10px 16px', borderRight: '1px solid #e2e8f0' }}>
                                    <input
                                        type="date"
                                        value={row.endDate || ''}
                                        onChange={e => handleFieldChange(idx, 'endDate', e.target.value)}
                                        disabled={isReadOnly}
                                        style={{
                                            width: '100%', padding: '7px 10px',
                                            border: '1.5px solid #e2e8f0', borderRadius: '8px',
                                            fontSize: '0.85rem', color: '#0f172a',
                                            backgroundColor: isReadOnly ? '#f8fafc' : '#ffffff',
                                            cursor: isReadOnly ? 'default' : 'pointer',
                                            outline: 'none'
                                        }}
                                    />
                                </td>

                                {/* Note / Remarks */}
                                <td style={{ padding: '10px 16px' }}>
                                    <input
                                        type="text"
                                        placeholder={isReadOnly ? '—' : 'Enter remarks…'}
                                        value={row.note || ''}
                                        onChange={e => handleFieldChange(idx, 'note', e.target.value)}
                                        disabled={isReadOnly}
                                        style={{
                                            width: '100%', padding: '7px 10px',
                                            border: '1.5px solid #e2e8f0', borderRadius: '8px',
                                            fontSize: '0.85rem', color: '#0f172a',
                                            backgroundColor: isReadOnly ? '#f8fafc' : '#ffffff',
                                            outline: 'none',
                                            minWidth: '200px'
                                        }}
                                    />
                                </td>
                            </tr>
                        ))}

                        {stageNotes.length === 0 && (
                            <tr>
                                <td colSpan={5} style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>
                                    No timeline stages found. Add tasks to the Designer or PM Timeline first.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Legend */}
            {!filterType && (
                <div style={{ display: 'flex', gap: '16px', marginTop: '16px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#64748b' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#3b82f6', display: 'inline-block' }} />
                        Designer Timeline Stage
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#64748b' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#8b5cf6', display: 'inline-block' }} />
                        Project Manager Timeline Stage
                    </div>
                </div>
            )}
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

        if (newTask.category === 'OTHER' && !customCategories.includes(finalCategory)) {
            setCustomCategories(prev => [...prev, finalCategory]);
        }

        const updated = [...tasks, { id: Date.now(), category: finalCategory, name: resolvedName, startDate: newTask.startDate, endDate: newTask.endDate }];
        setTasks(updated);
        setNewTask({ category: '', customCategory: '', name: '', customName: '', startDate: '', endDate: '' });
        persistState(updated, completions);
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
        const isMasking    = catNorm.includes('masking')  || nameNorm.includes('masking');
        const isR2P        = catNorm.includes('r2p')      || nameNorm.includes('r2p') || catNorm.includes('readytopaint') || nameNorm.includes('readytopaint');
        const isDeliveryStage = ['productdistribution', 'readytodispatch', 'intransit', 'delivery', 'dispatch', 'transit'].some(k => catNorm.includes(k) || nameNorm.includes(k));
        const isHandover   = catNorm.includes('handover') || nameNorm.includes('handover');

        // ─── Payment Gate Rules (cumulative %) ───────────────────────────
        // 10% → Designer Timeline starts
        if (paidPercent < 10) {
            setPaymentModal({ open: true, requiredPercent: 10, stageName: 'Project Timeline' });
            return;
        }
        // 30% → Masking stage unlocks  (10% advance + next 20%)
        if (isMasking && paidPercent < 30) {
            setPaymentModal({ open: true, requiredPercent: 30, stageName: 'Masking Stage' });
            return;
        }
        // 60% → R2P stage unlocks  (next 30% after Masking)
        if (isR2P && paidPercent < 60) {
            setPaymentModal({ open: true, requiredPercent: 60, stageName: 'R2P (Ready to Paint) Stage' });
            return;
        }
        // 95% → Product Distribution / Delivery stages unlock  (next 35% after R2P)
        if (isDeliveryStage && paidPercent < 95) {
            setPaymentModal({ open: true, requiredPercent: 95, stageName: 'Product Distribution / Delivery Stage' });
            return;
        }
        // 100% → Handover unlocks  (final 5%)
        if (isHandover && paidPercent < 100) {
            setPaymentModal({ open: true, requiredPercent: 100, stageName: 'Handover Stage' });
            return;
        }

        // PM TIMELINE LOCK: Block all clicks until Designer starts Masking stage
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

    if (loading) return <div style={{ textAlign: 'center', padding: '40px' }}><Loader2 className="animate-spin" style={{ margin: '0 auto' }} /></div>;

    const totalBudget = project?.total_budget || 0;
    const paidPercent = totalBudget > 0 ? (totalPaid / totalBudget) * 100 : 0;

    return (
        <div className="timeline-container" style={{ backgroundColor: "white", padding: "40px", width: "100%", border: "1px solid #000", boxShadow: "0 10px 25px rgba(0,0,0,0.1)", position: 'relative' }}>

            {/* ── Payment Schedule Status Banners ─────────────────── */}

            {/* Fully locked: < 10% */}
            {paidPercent < 10 && (
                <div style={{ background: 'linear-gradient(135deg,#7f1d1d,#991b1b)', color:'#fff', borderRadius:'12px', padding:'18px 24px', marginBottom:'16px', display:'flex', alignItems:'center', gap:'16px', border:'1.5px solid #b91c1c', boxShadow:'0 4px 14px rgba(0,0,0,.2)' }}>
                    <span style={{ fontSize:'28px', flexShrink:0 }}>💳</span>
                    <div>
                        <div style={{ fontWeight:900, fontSize:'1rem', marginBottom:'4px', textTransform:'uppercase' }}>Timeline Locked — PAYMENT NOT PAID</div>
                        <div style={{ fontSize:'0.85rem', opacity:.85, lineHeight:1.5 }}>
                            At least <strong>10%</strong> of the project budget must be paid to start the timeline.
                            Paid: <strong>{paidPercent.toFixed(1)}%</strong> of ₹{totalBudget.toLocaleString()}
                        </div>
                    </div>
                </div>
            )}

            {/* Masking locked: 10–29% */}
            {paidPercent >= 10 && paidPercent < 30 && (
                <div style={{ background:'linear-gradient(135deg,#78350f,#92400e)', color:'#fff', borderRadius:'12px', padding:'14px 20px', marginBottom:'16px', display:'flex', alignItems:'center', gap:'14px', border:'1.5px solid #b45309', boxShadow:'0 4px 12px rgba(0,0,0,.15)' }}>
                    <span style={{ fontSize:'22px', flexShrink:0 }}>⚠️</span>
                    <div>
                        <div style={{ fontWeight:800, fontSize:'0.9rem', marginBottom:'2px' }}>MASKING STAGE LOCKED</div>
                        <div style={{ fontSize:'0.8rem', opacity:.9, lineHeight:1.4 }}>
                            <strong>30%</strong> total payment unlocks Masking (next installment: 20%). 
                            Paid: <strong>{paidPercent.toFixed(1)}%</strong> of ₹{totalBudget.toLocaleString()}
                        </div>
                    </div>
                </div>
            )}

            {/* R2P locked: 30–59% */}
            {paidPercent >= 30 && paidPercent < 60 && (
                <div style={{ background:'linear-gradient(135deg,#4c1d95,#5b21b6)', color:'#fff', borderRadius:'12px', padding:'14px 20px', marginBottom:'16px', display:'flex', alignItems:'center', gap:'14px', border:'1.5px solid #7c3aed', boxShadow:'0 4px 12px rgba(0,0,0,.15)' }}>
                    <span style={{ fontSize:'22px', flexShrink:0 }}>🎨</span>
                    <div>
                        <div style={{ fontWeight:800, fontSize:'0.9rem', marginBottom:'2px' }}>R2P STAGE LOCKED</div>
                        <div style={{ fontSize:'0.8rem', opacity:.9, lineHeight:1.4 }}>
                            <strong>60%</strong> total payment unlocks R2P (next installment: 30%). 
                            Paid: <strong>{paidPercent.toFixed(1)}%</strong> of ₹{totalBudget.toLocaleString()}
                        </div>
                    </div>
                </div>
            )}

            {/* Delivery stages locked: 60–94% */}
            {paidPercent >= 60 && paidPercent < 95 && (
                <div style={{ background:'linear-gradient(135deg,#065f46,#047857)', color:'#fff', borderRadius:'12px', padding:'14px 20px', marginBottom:'16px', display:'flex', alignItems:'center', gap:'14px', border:'1.5px solid #059669', boxShadow:'0 4px 12px rgba(0,0,0,.15)' }}>
                    <span style={{ fontSize:'22px', flexShrink:0 }}>🚚</span>
                    <div>
                        <div style={{ fontWeight:800, fontSize:'0.9rem', marginBottom:'2px' }}>DELIVERY STAGES LOCKED</div>
                        <div style={{ fontSize:'0.8rem', opacity:.9, lineHeight:1.4 }}>
                            <strong>95%</strong> total payment unlocks Product Distribution / Delivery (next installment: 35%). 
                            Paid: <strong>{paidPercent.toFixed(1)}%</strong> of ₹{totalBudget.toLocaleString()}
                        </div>
                    </div>
                </div>
            )}

            {/* Handover locked: 95–99% */}
            {paidPercent >= 95 && paidPercent < 100 && (
                <div style={{ background:'linear-gradient(135deg,#0c4a6e,#0369a1)', color:'#fff', borderRadius:'12px', padding:'14px 20px', marginBottom:'16px', display:'flex', alignItems:'center', gap:'14px', border:'1.5px solid #0284c7', boxShadow:'0 4px 12px rgba(0,0,0,.15)' }}>
                    <span style={{ fontSize:'22px', flexShrink:0 }}>🏠</span>
                    <div>
                        <div style={{ fontWeight:800, fontSize:'0.9rem', marginBottom:'2px' }}>HANDOVER STAGE LOCKED</div>
                        <div style={{ fontSize:'0.8rem', opacity:.9, lineHeight:1.4 }}>
                            <strong>100%</strong> (final 5%) payment required to unlock Handover. 
                            Paid: <strong>{paidPercent.toFixed(1)}%</strong> of ₹{totalBudget.toLocaleString()}
                        </div>
                    </div>
                </div>
            )}

            {/* PM Timeline Locked Banner (Masking not started by Designer yet) */}
            {type === 'pm' && !maskingUnlocked && (
                <div style={{ background:'linear-gradient(135deg,#1e3a5f,#253b50)', color:'#fff', borderRadius:'12px', padding:'18px 24px', marginBottom:'16px', display:'flex', alignItems:'center', gap:'16px', border:'1.5px solid #3b5a7a', boxShadow:'0 4px 14px rgba(0,0,0,.2)' }}>
                    <span style={{ fontSize:'28px', flexShrink:0 }}>🔒</span>
                    <div>
                        <div style={{ fontWeight:900, fontSize:'1rem', marginBottom:'4px' }}>PM Timeline is LOCKED</div>
                        <div style={{ fontSize:'0.85rem', opacity:.85, lineHeight:1.5 }}>
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
                                <input type="date" value={newTask.startDate} onChange={e => setNewTask({ ...newTask, startDate: e.target.value })} style={{ width: '100%', padding: '9px 10px', borderRadius: '6px', border: '1px solid #d1d5db', outline: 'none', fontWeight: 500, color: '#1e293b', accentColor: '#374151' }} />
                            </div>

                            <div>
                                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: '5px' }}>To Date</label>
                                <input type="date" value={newTask.endDate} onChange={e => setNewTask({ ...newTask, endDate: e.target.value })} style={{ width: '100%', padding: '9px 10px', borderRadius: '6px', border: '1px solid #d1d5db', outline: 'none', fontWeight: 500, color: '#1e293b', accentColor: '#374151' }} />
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
                                        <input type="date" value={projectStartDate} onChange={e => setProjectStartDate(e.target.value)} style={{ width: '100%', padding: '9px 12px', borderRadius: '7px', border: '1px solid #cbd5e1', color: '#1e293b', fontWeight: 700, outline: 'none', fontSize: '0.88rem' }} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '5px' }}>Expected End Date</label>
                                        <input type="date" value={projectEndDate} onChange={e => setProjectEndDate(e.target.value)} style={{ width: '100%', padding: '9px 12px', borderRadius: '7px', border: '1px solid #cbd5e1', color: '#1e293b', fontWeight: 700, outline: 'none', fontSize: '0.88rem' }} />
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

            {/* Stage Notes Table — below Gantt chart and legend for PM Timeline */}
            {type === 'pm' && (
                <div style={{ marginTop: '36px' }} className="no-print">
                    <hr style={{ border: 'none', borderTop: '2px solid #e2e8f0', marginBottom: '28px' }} />
                    <StageNotesTab project={project} user={user} filterType="pm" />
                </div>
            )}

            {/* Edit Task Modal */}
            {editingTask && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
                    <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '30px', width: '420px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
                        <h3 style={{ marginBottom: '20px', fontWeight: 700, fontSize: '1.1rem' }}>Edit Task Dates</h3>
                        <p style={{ fontWeight: 600, color: '#253b50', marginBottom: '16px' }}>{editingTask.name}</p>
                        <div style={{ marginBottom: '14px' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>From Date</label>
                            <input type="date" value={editingTask.startDate} onChange={e => setEditingTask({ ...editingTask, startDate: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
                        </div>
                        <div style={{ marginBottom: '24px' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>To Date</label>
                            <input type="date" value={editingTask.endDate} onChange={e => setEditingTask({ ...editingTask, endDate: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
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
