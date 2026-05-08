


import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useRef } from "react";
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
    Clock,
    Calendar,
    AlertCircle
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import QuoteTab from '../components/QuoteTab';

interface ProjectDetailsData {
    project_id: string;
    project_code: string;
    project_name: string;
    client_name: string;
    client_phone: string;
    client_address: string;
    site_address: string;
    project_type: string;
    start_date: string;
    expected_end_date: string;
    total_budget: string;
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

    // Set initial tab based on role, fallback to overview
    const [activeTab, setActiveTab] = useState(
        (user?.role === 'site_engineer' || user?.role === 'project_head') ? 'timeline' : 'overview'
    );

    // Update tab if role loads later and they are on a restricted tab
    useEffect(() => {
        if ((user?.role === 'site_engineer' || user?.role === 'project_head') && activeTab === 'overview') {
            setActiveTab('timeline');
        }
    }, [user?.role, activeTab]);

    const [project, setProject] = useState<ProjectDetailsData | null>(null);
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
        if (user?.role === 'admin' || user?.role === 'principal_architect') {
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
        setEditForm({
            project_name: project?.project_name || '',
            site_address: project?.site_address || '',
            start_date: project?.start_date || '',
            expected_end_date: project?.expected_end_date || '',
            project_head_id: project?.team?.find(t => t.assignment_role === 'project_head')?.user_id || '',
            site_engineer_id: project?.team?.find(t => t.assignment_role === 'site_engineer')?.user_id || '',
            status: project?.status || 'Pending',
            project_type: project?.project_type || 'interior'
        });
        setShowEditModal(true);
    };

    const handleUpdateProject = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const response = await axios.put(`${API_BASE_URL}/projects`, {
                project_id: id,
                ...editForm
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

    const isAccountant = user?.role === 'accountant' || user?.role === 'admin' || user?.role === 'principal_architect';

    const renderTabs = () => {
        const tabs = ['overview', 'timeline', 'quote', 'stock_category', 'vendor_quta', 'transport', 'labor', 'miscellaneous', 'balance_sheet'].filter(tab => {

            // Admin, Principal Architect, and Accountant see all tabs
            if (user?.role === 'admin' || user?.role === 'principal_architect' || user?.role === 'accountant') {
                return true;
            }

            // Project Head sees these tabs
            if (user?.role === 'project_head') {
                return ['timeline', 'quote', 'stock_category', 'vendor_quta', 'transport', 'labor', 'miscellaneous'].includes(tab);
            }


            // Site Engineer ONLY sees timeline and used_quote
            if (user?.role === 'site_engineer') {
                return ['timeline', 'stock_category'].includes(tab);
            }


            // Default visibility
            return tab === 'overview';
        });

        return (
            <div className="tabs-container" style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid #e5e7eb', paddingBottom: '1px' }}>
                {tabs.map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                            padding: '12px 24px',
                            fontSize: '0.95rem',
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
                        {tab === 'vendor_quta' ? 'Vendor Quta' : tab.replace('_', ' ')}
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
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Project Status</label>
                        <select 
                            value={project.status} 
                            onChange={(e) => handleQuickStatusUpdate(e.target.value)}
                            style={{ 
                                padding: '8px 12px', 
                                borderRadius: '6px', 
                                border: '1px solid #d1d5db', 
                                backgroundColor: project.status === 'Completed' ? '#d1fae5' : project.status === 'On Going' ? '#dbeafe' : '#fef3c7',
                                color: project.status === 'Completed' ? '#065f46' : project.status === 'On Going' ? '#1e40af' : '#92400e',
                                fontWeight: 700,
                                fontSize: '0.85rem',
                                outline: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            <option value="Pending">Pending</option>
                            <option value="On Going">On Going</option>
                            <option value="Completed">Completed</option>
                            <option value="Cancelled">Cancelled</option>
                        </select>
                    </div>
                    {(user?.role === 'admin' || user?.role === 'principal_architect') && (
                        <button onClick={openEditModal} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: 'white', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            Edit Project Settings
                        </button>
                    )}
                </div>
            </div>

            <div className="no-print">
                {renderTabs()}
            </div>

            {activeTab === 'overview' && <OverviewTab project={project} quoteTotal={quoteTotal} isAccountant={isAccountant} />}
            {activeTab === 'timeline' && <TimelineTab project={project} user={user} />}
            {activeTab === 'quote' && <QuoteTab project={project} setQuoteTotal={setQuoteTotal} isReadOnly={user?.role === 'project_head' || user?.role === 'site_engineer'} user={user} isUsedQuote={false} />}
            {activeTab === 'stock_category' && <StockCategoryTab project={project} user={user} />}

            {activeTab === 'vendor_quta' && <InventoryTab key={project?.project_id} project={project} setInventoryTotal={setInventoryTotal} user={user} />}
            {activeTab === 'transport' && <ExpenseCategoryTab project={project} category="Transport" transactions={transactions} fetchTransactions={fetchTransactions} user={user} />}
            {activeTab === 'labor' && <ExpenseCategoryTab project={project} category="Labor" transactions={transactions} fetchTransactions={fetchTransactions} user={user} />}
            {activeTab === 'miscellaneous' && <ExpenseCategoryTab project={project} category="Miscellaneous" transactions={transactions} fetchTransactions={fetchTransactions} user={user} />}
            {activeTab === 'balance_sheet' && <BalanceSheetTab project={project} transactions={transactions}
                quoteTotal={quoteTotal}
                inventoryTotal={inventoryTotal} />}



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
                                        {allUsers.filter(t => ['principal_architect', 'project_head', 'admin'].includes(t.role)).map(t => (
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
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Project Status</label>
                                    <select required value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}>
                                        <option value="Pending">Pending</option>
                                        <option value="On Going">On Going</option>
                                        <option value="Completed">Completed</option>
                                        <option value="Cancelled">Cancelled</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Project Type</label>
                                    <select required value={editForm.project_type} onChange={(e) => setEditForm({ ...editForm, project_type: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}>
                                        <option value="interior">Interior Design Consultant</option>
                                        <option value="architecture">Architectural Design</option>
                                        <option value="both">Arc + Interior</option>
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
                        writing-mode: vertical-rl;
                        display: block !important;
                        padding: 10mm !important;
                        margin: 0 auto !important;
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

const OverviewTab = ({ project, quoteTotal, isAccountant }: any) => {
    const progress = Math.round((project.total_paid / (quoteTotal || 1)) * 100);
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
                                        {project.project_type === 'both' ? 'Arc + Interior' : project.project_type === 'architecture' ? 'Architectural' : 'Interior'}
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', marginBottom: '8px' }}>
                                <Briefcase size={16} /> <span style={{ fontSize: '0.85rem' }}>Project Quote (Budget)</span>
                            </div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#253b50' }}>₹{quoteTotal.toLocaleString()}</div>
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
                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#c2410c' }}>₹{(quoteTotal - project.total_paid).toLocaleString()}</div>
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


    // ✅ ADDED (for print)
    const printRef = useRef<HTMLDivElement>(null);

    const [items, setItems] = useState<any[]>([
        {
            invoice_no: '',
            invoice_date: new Date().toISOString().split('T')[0],
            vendor: '',
            name: '',
            rate: 0,
            qty: 1,
            amount: 0,
            gst: 0,
            total: 0
        }
    ]);

    useEffect(() => {
        setInventoryTotal(grandTotal);
    }, [items]);

    // ✅ LOAD DATA FROM DB
    useEffect(() => {
        if (!project?.project_id) return;

        fetch(`${API_BASE_URL}/controllers/Inventoryproject.php?project_id=${project.project_id}`)
            .then(res => res.json())
            .then(data => {
                if (data.status === "success" && data.data.length > 0) {

                    const formatted = data.data.map((item: any) => ({
                        invoice_no: item.invoice_no || '',
                        invoice_date: item.invoice_date || new Date().toISOString().split('T')[0],
                        vendor: item.vendor,
                        name: item.item_name,
                        rate: Number(item.rate),
                        qty: Number(item.quantity),
                        discount: Number(item.discount || 0),
                        amount: Number(item.amount),
                        gst: Number(item.gst),
                        total: Number(item.total)
                    }));

                    setItems(formatted);
                }
            })
            .catch(err => console.error(err));

    }, [project?.project_id]);

    console.log("PROJECT ID:", project?.project_id);

    useEffect(() => {
        if (!project?.project_id) return;

        fetch(`${API_BASE_URL}/vendors`)
            .then(res => res.json())
            .then(data => {
                if (data.status === "success") {
                    console.log("Global Vendors Loaded:", data.data);
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

    // 🔥 UPDATE ROW
    const updateItem = (index: number, field: string, value: any) => {
        if (field === 'name' && value === 'ADD_NEW_CATEGORY') {
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
                            const updated = [...items];
                            updated[index][field] = newCat.trim();
                            updateRowTotals(updated, index);
                        } else {
                            alert('Failed to add category');
                        }
                    })
                    .catch(err => alert('Failed to add category'));
            }
            return;
        }

        const updated = [...items];
        updated[index][field] = value;
        updateRowTotals(updated, index);
    };

    const updateRowTotals = (updated: any[], index: number) => {
        const qty = Number(updated[index].qty || 0);
        const rate = Number(updated[index].rate || 0);
        const discount = Number(updated[index].discount || 0);

        const subtotal = qty * rate;
        const discountAmt = subtotal * (discount / 100);
        const amount = subtotal - discountAmt;
        const gst = amount * 0.18;
        const total = amount + gst;

        updated[index].amount = amount;
        updated[index].gst = gst;
        updated[index].total = total;

        setItems(updated);
    };

    // 🖨️ PRINT FUNCTION (updated CSS only)
    const handlePrint = () => {
        const rows = items.map((item, index) => `
            <tr>
                <td>${item.invoice_no || ''}</td>
                <td>${item.invoice_date || ''}</td>
                <td>${item.vendor}</td>
                <td>${item.name}</td>
                <td>${item.rate}</td>
                <td>${item.qty}</td>
                <td>${item.discount}%</td>
                <td>₹${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td>₹${item.gst.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td>₹${item.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
        `).join("");

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
                            <th>Category</th>
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

    // ➕ ADD ROW
    const addRow = () => {
        setItems([
            ...items,
            {
                vendor: '',
                name: '',
                rate: 0,
                qty: 1,
                discount: 0,
                amount: 0,
                gst: 0,
                total: 0
            }
        ]);
    };

    // ❌ REMOVE ROW
    const removeRow = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    // 💰 GRAND TOTAL
    const grandTotal = items.reduce((sum, i) => sum + (i.total || 0), 0);

    // 💾 SAVE TO DB
    const saveInventory = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/controllers/Inventoryproject.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    project_id: project.project_id,
                    items
                })
            });

            const text = await res.text();
            console.log("API RESPONSE:", text);

            const data = JSON.parse(text);

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

    return (
        <div className="premium-card" ref={printRef}>

            <h3 style={{ fontSize: '1.4rem', fontWeight: 700 }}>
                Vendor Bill
            </h3>

            {/* TABLE */}
            <div style={{ overflowX: 'auto', marginTop: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    backgroundColor: '#ffffff'
                }}>
                    <thead style={{ background: '#f8fafc', color: '#475569', borderBottom: '2px solid #e2e8f0' }}>
                        <tr>
                            <th style={th}>Invoice No</th>
                            <th style={th}>Date</th>
                            <th style={th}>Vendor</th>
                            <th style={th}>Category</th>
                            <th style={th}>Rate</th>
                            <th style={th}>Qty</th>
                            <th style={th}>Disc (%)</th>
                            <th style={th}>Without GST</th>
                            <th style={th}>GST (18%)</th>
                            <th style={th}>With GST</th>
                            <th style={th}></th>
                        </tr>
                    </thead>

                    <tbody>
                        {items.map((item, i) => (
                            <tr key={i} style={{
                                background: i % 2 === 0 ? '#f9fafb' : '#fff'
                            }}>

                                <td style={td}>
                                    <input
                                        style={inputStyle}
                                        type="text"
                                        value={item.invoice_no || ''}
                                        onChange={(e) => updateItem(i, 'invoice_no', e.target.value)}
                                        placeholder="Inv #"
                                    />
                                </td>
                                <td style={td}>
                                    <input
                                        style={inputStyle}
                                        type="date"
                                        value={item.invoice_date || ''}
                                        onChange={(e) => updateItem(i, 'invoice_date', e.target.value)}
                                    />
                                </td>
                                <td style={{ ...td, position: 'relative' }}>
                                    <input
                                        style={inputStyle}
                                        value={item.vendor}
                                        placeholder="Type vendor / customer..."
                                        onFocus={(e) => {
                                            const value = e.target.value.trim().toLowerCase();
                                            const tableVendors = items.map(it => it.vendor).filter(v => v && v.trim() !== '');
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
                                            updateItem(i, 'vendor', value);
                                            const searchTerm = value.trim().toLowerCase();

                                            // Combine global list with what's currently typed in the table
                                            const tableVendors = items.map(it => it.vendor).filter(v => v && v.trim() !== '');
                                            const combinedList = Array.from(new Set([...vendorList, ...tableVendors]));

                                            const filtered = combinedList.filter(v =>
                                                v.toLowerCase().includes(searchTerm)
                                            );
                                            setFilteredVendors(filtered);
                                            setActiveIndex(i);
                                        }}
                                    />

                                    {/* 🔽 DROPDOWN */}
                                    {activeIndex === i && (filteredVendors.length > 0 || (item.vendor.trim() && !vendorList.some(v => v.toLowerCase() === item.vendor.trim().toLowerCase()))) && (
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
                                                        updateItem(i, 'vendor', v);
                                                        setFilteredVendors([]);
                                                        setActiveIndex(null);
                                                    }}
                                                >
                                                    <span style={{ opacity: 0.7 }}>👤</span> {v}
                                                </div>
                                            ))}

                                            {/* ➕ ADD NEW OPTION */}
                                            {item.vendor.trim() && !vendorList.some(v => v.toLowerCase() === item.vendor.trim().toLowerCase()) && (
                                                <div
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const newVendor = item.vendor.trim();
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
                                                    ✨ Add to Global List: "{item.vendor.trim()}"
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </td>
                                <td style={td}>
                                    <select
                                        style={{ ...inputStyle, padding: '8px', cursor: 'pointer' }}
                                        value={item.name}
                                        onChange={(e) => updateItem(i, 'name', e.target.value)}
                                    >
                                        <option value="">Select Category...</option>
                                        {categories.map((cat: any) => (
                                            <option key={cat.id} value={cat.category_name}>{cat.category_name}</option>
                                        ))}
                                        <option value="ADD_NEW_CATEGORY" style={{ fontWeight: 'bold', color: '#2563eb' }}>+ Add New Category</option>
                                    </select>
                                </td>

                                <td style={td}>
                                    <input
                                        type="number"
                                        style={inputStyle}
                                        value={item.rate}
                                        onChange={(e) => updateItem(i, 'rate', e.target.value)}
                                    />
                                </td>

                                <td style={td}>
                                    <input
                                        type="number"
                                        style={inputStyle}
                                        value={item.qty}
                                        onChange={(e) => updateItem(i, 'qty', e.target.value)}
                                    />
                                </td>

                                <td style={td}>
                                    <input
                                        type="number"
                                        style={inputStyle}
                                        value={item.discount || 0}
                                        onChange={(e) => updateItem(i, 'discount', e.target.value)}
                                    />
                                </td>

                                <td style={{ ...td, color: '#475569', fontWeight: 600 }}>
                                    ₹{(item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>

                                <td style={{ ...td, color: '#64748b', fontSize: '0.85rem' }}>
                                    ₹{(item.gst || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>

                                <td style={{ ...td, fontWeight: 800, color: '#16a34a', fontSize: '1.05rem' }}>
                                    ₹{(item.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>

                                <td style={td}>
                                    <button onClick={() => removeRow(i)} style={deleteBtn}>
                                        ✕
                                    </button>
                                </td>
                            </tr>
                        ))}

                        <tr>
                            <td colSpan={9} style={{ textAlign: 'center', padding: '16px', backgroundColor: '#f8fafc' }}>
                                <button onClick={addRow} style={addBtn}>
                                    + Add New Item
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
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

    const [submitting, setSubmitting] = useState(false);

    const filteredTransactions = transactions.filter((t: any) => t.type === 'debit' && t.category === category);

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

            if (category === 'Labor') {
                payload.amount = amount;
                payload.person_name = name;
                payload.date = paymentDate;
                payload.payment_mode = paymentMode;
                payload.description = `Labor Payment - Mode: ${paymentMode}`; // Fallback description
            } else {
                payload.amount = amount;
                payload.description = description;
            }

            const response = await axios.post(`${API_BASE_URL}/finance`, payload);
            if (response.data.success) {
                setAmount('');
                setDescription('');
                setName('');
                setPaymentDate(new Date().toISOString().split('T')[0]);
                setPaymentMode('Cash');
                fetchTransactions();
            }
        } catch (err) {
            alert('Failed to record expense');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="premium-card" style={{ padding: '30px' }}>
            <h3 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '20px' }}>{category} Expenses</h3>

            {category === 'Labor' ? (
                <form onSubmit={handleAddExpense} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: '15px', marginBottom: '30px', alignItems: 'end' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}>Name</label>
                        <input type="text" required value={name} onChange={(e) => setName(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} placeholder="Enter name" />
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
                    <button type="submit" disabled={submitting} className="btn-primary" style={{ padding: '10px 20px', height: '42px' }}>
                        {submitting ? 'Saving...' : 'Add'}
                    </button>
                </form>
            ) : (
                <form onSubmit={handleAddExpense} style={{ display: 'flex', gap: '15px', marginBottom: '30px', alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}>Amount (₹)</label>
                        <input type="number" required value={amount} onChange={(e) => setAmount(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} placeholder="0.00" />
                    </div>
                    <div style={{ flex: 2 }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}>Description</label>
                        <input type="text" required value={description} onChange={(e) => setDescription(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} placeholder="Enter details..." />
                    </div>
                    <button type="submit" disabled={submitting} className="btn-primary" style={{ padding: '10px 25px' }}>
                        {submitting ? 'Saving...' : 'Add Expense'}
                    </button>
                </form>
            )}

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                        <th style={{ padding: '12px', textAlign: 'left', color: '#475569', fontSize: '0.85rem', fontWeight: 700 }}>DATE</th>
                        {category === 'Labor' ? (
                            <>
                                <th style={{ padding: '12px', textAlign: 'left', color: '#475569', fontSize: '0.85rem', fontWeight: 700 }}>NAME</th>
                                <th style={{ padding: '12px', textAlign: 'left', color: '#475569', fontSize: '0.85rem', fontWeight: 700 }}>MODE</th>
                            </>
                        ) : (
                            <th style={{ padding: '12px', textAlign: 'left', color: '#475569', fontSize: '0.85rem', fontWeight: 700 }}>DESCRIPTION</th>
                        )}
                        <th style={{ padding: '12px', textAlign: 'right', color: '#475569', fontSize: '0.85rem', fontWeight: 700 }}>AMOUNT</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredTransactions.map((t: any, i: number) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '12px', color: '#64748b' }}>{new Date(t.transaction_date).toLocaleDateString()}</td>
                            {category === 'Labor' ? (
                                <>
                                    <td style={{ padding: '12px', fontWeight: 500 }}>{t.person_name || '-'}</td>
                                    <td style={{ padding: '12px', color: '#64748b' }}>{t.payment_mode || '-'}</td>
                                </>
                            ) : (
                                <td style={{ padding: '12px', fontWeight: 500 }}>{t.description}</td>
                            )}
                            <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600, color: '#ef4444' }}>
                                ₹{parseFloat(t.amount).toLocaleString()}
                            </td>
                        </tr>
                    ))}
                    {filteredTransactions.length === 0 && (
                        <tr>
                            <td colSpan={category === 'Labor' ? 4 : 3} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                                No expenses recorded yet.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};

const BalanceSheetTab = ({ project, transactions, quoteTotal = 0, inventoryTotal = 0 }: any) => {
    const transportTotal = transactions
        .filter((t: any) => t.type === 'debit' && t.category === 'Transport')
        .reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0);

    const laborTotal = transactions
        .filter((t: any) => t.type === 'debit' && t.category === 'Labor')
        .reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0);

    const miscTotal = transactions
        .filter((t: any) => t.type === 'debit' && t.category === 'Miscellaneous')
        .reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0);

    const totalSpent = inventoryTotal + transportTotal + laborTotal + miscTotal;
    const profitOrLoss = quoteTotal - totalSpent;
    const remainingBalance = quoteTotal - project.total_paid;

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

            {/* ROW 2: EXPENSE BREAKUP (6 COLUMNS) */}
            <div className="grid-6-col" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(6, 1fr)',
                gap: '12px',
                marginBottom: '40px'
            }}>
                {/* 1. PROJECT QUOTE */}
                <div className="premium-card" style={{ padding: '16px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                    <p style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase' }}>Project Quote</p>
                    <h4 style={{ fontWeight: 800, color: '#1e293b', fontSize: '1.1rem', margin: 0 }}>
                        ₹{quoteTotal.toLocaleString()}
                    </h4>
                </div>

                {/* 2. VENDOR QUTA */}
                <div className="premium-card" style={{ padding: '16px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                    <p style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase' }}>Vendor Bill</p>
                    <h4 style={{ fontWeight: 800, color: '#1e293b', fontSize: '1.1rem', margin: 0 }}>
                        ₹{inventoryTotal.toLocaleString()}
                    </h4>
                </div>

                {/* 3. TRANSPORT */}
                <div className="premium-card" style={{ padding: '16px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                    <p style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase' }}>Transport</p>
                    <h4 style={{ fontWeight: 800, color: '#1e293b', fontSize: '1.1rem', margin: 0 }}>
                        ₹{transportTotal.toLocaleString()}
                    </h4>
                </div>

                {/* 4. LABOR */}
                <div className="premium-card" style={{ padding: '16px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                    <p style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase' }}>Labor</p>
                    <h4 style={{ fontWeight: 800, color: '#1e293b', fontSize: '1.1rem', margin: 0 }}>
                        ₹{laborTotal.toLocaleString()}
                    </h4>
                </div>

                {/* 5. MISCELLANEOUS */}
                <div className="premium-card" style={{ padding: '16px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                    <p style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase' }}>Misc</p>
                    <h4 style={{ fontWeight: 800, color: '#1e293b', fontSize: '1.1rem', margin: 0 }}>
                        ₹{miscTotal.toLocaleString()}
                    </h4>
                </div>

                {/* 6. TOTAL SPENT */}
                <div className="premium-card" style={{ padding: '16px', textAlign: 'center', border: '1px solid #253b50', backgroundColor: '#f8fafc' }}>
                    <p style={{ color: '#253b50', fontSize: '0.7rem', fontWeight: 800, marginBottom: '6px', textTransform: 'uppercase' }}>Total Spent</p>
                    <h4 style={{ fontWeight: 800, color: '#253b50', fontSize: '1.1rem', margin: 0 }}>
                        ₹{totalSpent.toLocaleString()}
                    </h4>
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
                            <th style={{ ...th, color: '#475569', textAlign: 'right' }}>Amount</th>
                        </tr>
                    </thead>

                    <tbody>
                        {transactions.length > 0 ? (
                            transactions.map((tr: any) => (
                                <tr key={tr.transaction_id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }}>
                                    <td style={td}>{new Date(tr.transaction_date).toLocaleDateString()}</td>
                                    <td style={td}>{tr.description}</td>
                                    <td style={td}>
                                        <span style={{ padding: '4px 10px', backgroundColor: '#f1f5f9', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>
                                            {tr.category || 'Payment'}
                                        </span>
                                    </td>
                                    <td style={{
                                        ...td,
                                        fontWeight: 800,
                                        textAlign: 'right',
                                        color: tr.type === 'credit' ? '#10b981' : '#ef4444'
                                    }}>
                                        {tr.type === 'credit' ? '+' : '-'} ₹{parseFloat(tr.amount).toLocaleString()}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No transactions recorded yet.</td>
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

const StockCategoryTab = ({ project, user }: any) => {
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showFormModal, setShowFormModal] = useState(false);

    const fetchCategories = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/stock-categories?project_id=${project.project_id}`);
            if (res.data.success) setCategories(res.data.data);
        } catch { console.error('Failed to fetch categories'); }
        finally { setLoading(false); }
    };

    useEffect(() => {
        fetchCategories();
    }, [project.project_id]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Header with Add Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' }}>
                {['admin', 'principal_architect', 'accountant', 'project_head'].includes(user?.role) && (
                    <button onClick={() => setShowFormModal(true)} className="btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}>
                        <Plus size={18} /> Add Stock Item
                    </button>
                )}
            </div>

            {/* Modal for Add Stock Item */}
            {showFormModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: '20px' }}>
                    <div className="premium-card" style={{ width: '100%', maxWidth: '500px', padding: '0', overflow: 'hidden', position: 'relative' }}>
                        <button onClick={() => setShowFormModal(false)} style={{ position: 'absolute', right: '16px', top: '16px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                            <X size={24} />
                        </button>
                        <StockItemForm
                            project={project}
                            categories={categories}
                            onSuccess={() => { fetchCategories(); setShowFormModal(false); }}
                            onClose={() => setShowFormModal(false)}
                        />
                    </div>
                </div>
            )}

            {/* ── STOCK ITEMS TABLE ── */}
            <StockItemsTable project={project} categories={categories} user={user} />
        </div>
    );
};

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
                alert('Stock marked as Received!');
                fetchItems();
            }
        } catch (err) { alert('Failed to save usage'); }
    };

    const handleTransfer = async () => {
        const available = parseFloat(transferringItem.quantity) - parseFloat(transferringItem.quantity_used || 0);
        if (!transferData.target_project_id || transferData.qty <= 0 || transferData.qty > available) {
            alert("Please enter a valid quantity within available limits.");
            return;
        }
        try {
            const res = await axios.post(`${API_BASE_URL}/stock-items/transfer`, {
                item_id: transferringItem.id,
                target_project_id: transferData.target_project_id,
                transfer_qty: transferData.qty
            });
            if (res.data.success) {
                alert('Transfer successful!');
                setTransferringItem(null);
                setTransferData({ target_project_id: '', qty: 0 });
                fetchItems();
            } else {
                alert(res.data.message);
            }
        } catch (err) { alert('Transfer failed'); }
    };

    const isAdmin = ['admin', 'principal_architect', 'accountant'].includes(user?.role);
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
                                        {isEngineer && item.is_checked ? (
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
                                            backgroundColor: item.status === 'received' ? '#dcfce7' : '#fef2f2',
                                            color: item.status === 'received' ? '#15803d' : '#dc2626'
                                        }}>{item.status || 'pending'}</span>
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
                                                    {item.is_checked && (
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
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 600 }}>Transfer Qty (Max: {parseFloat(transferringItem.quantity) - parseFloat(transferringItem.quantity_used || 0)})</label>
                            <input type="number" value={transferData.qty} step="0.01" onChange={(e) => setTransferData({ ...transferData, qty: parseFloat(e.target.value) })}
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
                    </select>
                </div>
                <button type="submit" disabled={submitting} className="btn-primary" style={{ width: '100%' }}>
                    {submitting ? 'Recording...' : 'Save Payment'}
                </button>
            </form>
        </div>
    </div>
);
const TimelineTab = ({ project, user }: any) => {
    const isAdmin = user?.role === 'admin' || user?.role === 'principal_architect';
    const start = new Date(project.start_date);
    const end = new Date(project.expected_end_date || new Date(start).setMonth(start.getMonth() + 3));

    const MONTHS: any[] = [];
    let curr = new Date(start);
    while (curr <= end) {
        const mKey = curr.toLocaleString('en-US', { month: 'short' }).toLowerCase();
        const mLabel = curr.toLocaleString('en-US', { month: 'long' }).toUpperCase();
        const d = curr.getDate();
        const fullDate = new Date(curr).toISOString().split('T')[0];

        let existingMonth = MONTHS.find(m => m.key === mKey && m.year === curr.getFullYear());
        if (!existingMonth) {
            existingMonth = { key: mKey, label: mLabel, short: mKey.toUpperCase(), year: curr.getFullYear(), days: [] };
            MONTHS.push(existingMonth);
        }
        existingMonth.days.push({ day: d, date: fullDate });
        curr.setDate(curr.getDate() + 1);
    }
    const ALL_COLS = MONTHS.flatMap(m => m.days);
    const TOTAL_COLS = ALL_COLS.length;
    const todayStr = new Date().toISOString().split('T')[0];
    const CATEGORIES = [
        "1. INITIAL WORKS",
        "2. FALSE CEILING",
        "3. ELECTRICAL CHIPPING",
        "4. PLUMBING/SANITARY",
        "5. PAINTING",
        "6. CARPENTRY",
        "7. GRANITE & TILES",
        "8. GLASS/MIRROR",
        "9. SANITARY & BATH",
        "10. ELECTRICAL FITMENTS",
        "11. FURNITURE",
        "12. DEEP CLEANING",
        "13.CURTAIN RODS AND CURTAINS",
        "14. HANDOVER"
    ];

    const SUB_TASKS: any = {
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

    const [tasks, setTasks] = useState<any[]>([]);
    const [completions, setCompletions] = useState<any>({}); // { task_id: { date: 'done' | 'pending' } }
    const [loading, setLoading] = useState(true);

    // Form State
    const [newTask, setNewTask] = useState({
        category: '',
        name: '',
        startDate: '',
        endDate: ''
    });

    useEffect(() => {
        if (project?.project_id) {
            fetchTimeline();
        }
    }, [project?.project_id]);

    const fetchTimeline = async () => {
        try {
            const pid = Number(project?.project_id);

            if (!pid) {
                console.log("❌ Invalid project_id:", project?.project_id);
                return;
            }

            console.log("✅ FETCH PROJECT ID 👉", pid);

            const res = await axios.get(
                `${API_BASE_URL}/controllers/timeline/state.php?project_id=${pid}`
            );

            console.log("📦 API RESPONSE 👉", res.data);

            if (res.data.success) {
                setTasks(res.data.tasks || []);
                setCompletions(res.data.completions || {});
            }

        } catch (err) {
            console.error("❌ Failed to fetch timeline", err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTask.category || !newTask.name || !newTask.startDate || !newTask.endDate) return;

        const taskData = {
            id: Date.now(),
            ...newTask
        };

        const updatedTasks = [...tasks, taskData];
        setTasks(updatedTasks);
        setNewTask({ category: '', name: '', startDate: '', endDate: '' });

        saveTimeline(updatedTasks, completions);
    };

    const saveTimeline = async (updatedTasks: any[], updatedCompletions: any) => {

        const payload = {
            project_id: project.project_id,
            tasks: updatedTasks,
            completions: updatedCompletions
        };

        console.log("SENDING DATA 👉", payload);

        try {
            const res = await fetch(`${API_BASE_URL}/controllers/timeline/save-state.php`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    project_id: project.project_id,
                    tasks: updatedTasks,
                    completions: updatedCompletions,
                    created_by: user.user_id
                })
            });

            const text = await res.text();
            console.log("RESPONSE 👉", text);

        } catch (err) {
            console.error("ERROR 👉", err);
        }
    };
    const toggleStatus = (taskId: any, date: string) => {
        const currentStatus = completions[taskId]?.[date];
        const isDone = currentStatus === 'done';

        // Check if day pass for this specific date
        const isPast = date < todayStr;
        if (isDone && isPast) return; // Locked

        const updatedCompletions = { ...completions };
        if (!updatedCompletions[taskId]) updatedCompletions[taskId] = {};

        updatedCompletions[taskId][date] = isDone ? 'pending' : 'done';

        setCompletions(updatedCompletions);
        saveTimeline(tasks, updatedCompletions);
    };

    const getCellColor = (taskId: any, date: string, startDate: string, endDate: string) => {
        const status = completions[taskId]?.[date];
        if (status === 'done') return "#70AD47"; // GREEN

        const isPlanned = date >= startDate && date <= endDate;
        if (isPlanned) {
            if (date < todayStr) return "#FF0000"; // RED (Day passed, not green)
            return "#A6A6A6"; // GREY (Planned)
        }
        return "transparent";
    };

    const BORDER = "1px solid #000";

    if (loading) return <div style={{ textAlign: 'center', padding: '40px' }}><Loader2 className="animate-spin" style={{ margin: '0 auto' }} /></div>;
    const handlePrint = () => window.print();

    return (
        <div className="timeline-container" style={{ backgroundColor: "white", padding: "40px", width: "100%", border: "1px solid #000", boxShadow: "0 10px 25px rgba(0,0,0,0.1)", position: 'relative' }}>
            <button onClick={handlePrint} className="no-print" style={{ position: 'absolute', right: '40px', top: '10px', padding: '10px 20px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Printer size={18} /> Print Timeline
            </button>

            {/* TASK ASSIGNMENT FORM (ADMIN ONLY) */}
            {isAdmin && (
                <div style={{ marginBottom: '30px', marginTop: '20px', padding: '20px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px' }} className="no-print">
                    <h3 style={{ marginBottom: '15px', fontSize: '1rem', fontWeight: 700 }}>Assign Work Schedule</h3>
                    <form onSubmit={handleAddTask} className="work-schedule-form">
                        <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Category</label>
                            <select value={newTask.category} onChange={(e) => setNewTask({ ...newTask, category: e.target.value, name: '' })} style={{ width: '100%', padding: '8px', borderRadius: '6px' }}>
                                <option value="">Select Category</option>
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Work Name</label>
                            <select
                                value={newTask.name}
                                onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                                disabled={!newTask.category}
                                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: !newTask.category ? '#f3f4f6' : 'white' }}
                            >
                                <option value="">Select Work</option>
                                {newTask.category && SUB_TASKS[newTask.category]?.map((s: string) => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>From</label>
                            <input type="date" value={newTask.startDate} onChange={(e) => setNewTask({ ...newTask, startDate: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>To</label>
                            <input type="date" value={newTask.endDate} onChange={(e) => setNewTask({ ...newTask, endDate: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
                        </div>
                        <button type="submit" className="btn-primary" style={{ padding: '10px' }}>Assign Work</button>
                    </form>
                </div>
            )}

            {/* Document Header */}
            <div style={{ textAlign: "center", marginBottom: "30px", borderBottom: "3px solid #000", paddingBottom: "15px" }}>
                <h1 style={{ fontSize: "1.5rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "1.5px", margin: 0 }}>
                    TIMELINE FOR INTERIORS WORKS - {project.project_name.toUpperCase()}
                </h1>
            </div>

            <div className="timeline-table-wrapper" style={{ overflowX: "auto", paddingBottom: "15px" }}>
                <table style={{ borderCollapse: "collapse", width: Math.max(1000, 255 + TOTAL_COLS * 22) + "px", border: "2px solid #000", tableLayout: "fixed" }}>
                    <thead>
                        <tr style={{ backgroundColor: "#F2F2F2" }}>
                            <th style={{ width: "35px", border: BORDER, fontSize: "0.65rem", padding: "5px" }}>No.</th>
                            <th style={{ width: "220px", border: BORDER, fontSize: "0.65rem", padding: "5px", textAlign: "left" }}>Work description</th>
                            {MONTHS.map(m => (
                                <th key={m.key} colSpan={m.days.length} style={{ border: BORDER, fontSize: "0.7rem", padding: "5px", textTransform: "uppercase", backgroundColor: "#E2E8F0" }}>
                                    {m.label}
                                </th>
                            ))}
                        </tr>
                        <tr style={{ backgroundColor: "#FFF" }}>
                            <th style={{ border: BORDER }}></th>
                            <th style={{ border: BORDER, textAlign: "left", paddingLeft: "8px", fontSize: "0.6rem", color: "#666" }}>Dates →</th>
                            {ALL_COLS.map((c, i) => (
                                <th key={i} style={{ border: BORDER, padding: "2px", fontSize: "0.6rem", minWidth: "22px", fontWeight: 700, backgroundColor: c.date === todayStr ? '#fef3c7' : 'transparent' }}>
                                    {c.day}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {CATEGORIES.map((cat, catIdx) => {
                            const catTasks = tasks.filter(t => t.category === cat);
                            if (catTasks.length === 0 && !isAdmin) return null;

                            return (
                                <React.Fragment key={cat}>
                                    <tr style={{ backgroundColor: "#D9D9D9" }}>
                                        <td style={{ border: BORDER, textAlign: "center", fontWeight: 900, fontSize: "0.7rem" }}>{catIdx + 1}</td>
                                        <td colSpan={1 + TOTAL_COLS} style={{ border: BORDER, padding: "4px 8px", fontWeight: 900, fontSize: "0.75rem", textTransform: "uppercase" }}>
                                            {cat}
                                        </td>
                                    </tr>
                                    {catTasks.map((task, taskIdx) => (
                                        <tr key={task.id} style={{ height: "30px" }}>
                                            <td style={{ border: BORDER, textAlign: "center", fontSize: "0.65rem", color: "#666" }}>{catIdx + 1}.{taskIdx + 1}</td>
                                            <td style={{ border: BORDER, padding: "4px 8px", fontSize: "0.75rem", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                {task.name}
                                            </td>
                                            {ALL_COLS.map((col, i) => (
                                                <td
                                                    key={i}
                                                    onClick={() => toggleStatus(task.id, col.date)}
                                                    style={{
                                                        border: BORDER,
                                                        backgroundColor: getCellColor(task.id, col.date, task.startDate, task.endDate),
                                                        cursor: "pointer",
                                                        transition: "background 0.1s",
                                                    }}
                                                ></td>
                                            ))}
                                        </tr>
                                    ))}
                                </React.Fragment>
                            );
                        })}
                        <tr style={{ backgroundColor: "#F2F2F2", height: "35px" }}>
                            <td style={{ border: BORDER }}></td>
                            <td style={{ border: BORDER, padding: "4px 8px", fontSize: "0.75rem", fontWeight: 900, textTransform: "uppercase" }}>
                                Total project time
                            </td>
                            {ALL_COLS.map((_, i) => (
                                <td key={i} style={{ border: BORDER, backgroundColor: "#F2F2F2" }}></td>
                            ))}
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Legend Section */}
            <div style={{ marginTop: "30px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ display: "flex", gap: "25px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ width: 18, height: 18, backgroundColor: "#70AD47", border: BORDER }}></div>
                        <span style={{ fontSize: "0.75rem", fontWeight: 700 }}>COMPLETED (GREEN)</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ width: 18, height: 18, backgroundColor: "#FF0000", border: BORDER }}></div>
                        <span style={{ fontSize: "0.75rem", fontWeight: 700 }}>OVERDUE (RED)</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ width: 18, height: 18, backgroundColor: "#A6A6A6", border: BORDER }}></div>
                        <span style={{ fontSize: "0.75rem", fontWeight: 700 }}>PLANNED (GREY)</span>
                    </div>
                </div>

                {/* Branding & Signatures Removed for Print */}
            </div>

            <style>{`
                @media print {
                    .print-only { display: flex !important; }
                    .timeline-container { border: none !important; box-shadow: none !important; }
                }
                .work-schedule-form {
                    display: grid;
                    grid-template-columns: repeat(5, 1fr);
                    gap: 10px;
                    align-items: end;
                }
                @media (max-width: 768px) {
                    .work-schedule-form {
                        grid-template-columns: repeat(1, 1fr) !important;
                    }
                }
            `}</style>
        </div>
    );
};
