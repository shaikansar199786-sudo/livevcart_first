


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
        site_engineer_id: ''
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
            const response = await axios.get(`http://localhost/ARK/api/quotes/latest?project_id=${id}&is_used=false`);
            if (response.data.success && response.data.data) {
                setQuoteTotal(parseFloat(response.data.data.total_amount));
            }
        } catch (err) {
            console.error('Failed to fetch quote total');
        }
    };

    const fetchInventoryTotal = async () => {
        try {
            const res = await fetch(`http://localhost/ARK/api/controllers/Inventoryproject.php?project_id=${id}`);
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
            const response = await axios.get('http://localhost/ARK/api/users');
            if (response.data.success) {
                setAllUsers(response.data.data);
            }
        } catch (err) { }
    };

    const fetchProjectDetails = async () => {
        try {
            const response = await axios.get(`http://localhost/ARK/api/projects/${id}`);
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
            const response = await axios.get(`http://localhost/ARK/api/finance/${id}`);
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
            const response = await axios.post('http://localhost/ARK/api/projects/update-budget', {
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
            const response = await axios.post('http://localhost/ARK/api/finance', {
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
            site_engineer_id: project?.team?.find(t => t.assignment_role === 'site_engineer')?.user_id || ''
        });
        setShowEditModal(true);
    };

    const handleUpdateProject = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const response = await axios.put('http://localhost/ARK/api/projects', {
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

    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}><Loader2 className="animate-spin" size={48} color="#253b50" /></div>;
    if (!project) return <div style={{ padding: '40px', textAlign: 'center' }}>Project not found</div>;

    const isAccountant = user?.role === 'accountant' || user?.role === 'admin' || user?.role === 'principal_architect';

    const renderTabs = () => {
        const tabs = ['overview', 'timeline', 'quote', 'used_quote', 'vendor_quta', 'transport', 'labor', 'miscellaneous', 'balance_sheet'].filter(tab => {
            // Admin, Principal Architect, and Accountant see all tabs
            if (user?.role === 'admin' || user?.role === 'principal_architect' || user?.role === 'accountant') {
                return true;
            }

            // Project Head sees these tabs
            if (user?.role === 'project_head') {
                return ['timeline', 'quote', 'used_quote', 'vendor_quta', 'transport', 'labor', 'miscellaneous'].includes(tab);
            }

            // Site Engineer ONLY sees timeline and used_quote
            if (user?.role === 'site_engineer') {
                return ['timeline', 'used_quote'].includes(tab);
            }

            // Default visibility
            return tab === 'overview';
        });

        return (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid #e5e7eb', paddingBottom: '1px' }}>
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
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
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
                {(user?.role === 'admin' || user?.role === 'principal_architect') && (
                    <button onClick={openEditModal} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: 'white', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        Edit Project Settings
                    </button>
                )}
            </div>

            <div className="no-print">
                {renderTabs()}
            </div>

            {activeTab === 'overview' && <OverviewTab project={project} quoteTotal={quoteTotal} isAccountant={isAccountant} />}
            {activeTab === 'timeline' && <TimelineTab project={project} user={user} />}
            {activeTab === 'quote' && <QuoteTab project={project} setQuoteTotal={setQuoteTotal} isReadOnly={user?.role === 'project_head' || user?.role === 'site_engineer'} user={user} isUsedQuote={false} />}
            {activeTab === 'used_quote' && <QuoteTab project={project} setQuoteTotal={setQuoteTotal} isReadOnly={user?.role === 'project_head' || user?.role === 'site_engineer'} user={user} isUsedQuote={true} />}
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


const QuoteTab = ({ project, setQuoteTotal, isReadOnly, user, isUsedQuote }: any) => {
    const [sections, setSections] = useState<QuoteSection[]>([
        {
            id: '1',
            name: 'A. FALSE CEILING',
            items: [
                { id: '1-1', particulars: 'GYPSUM', brand: '', unit: 'sft', quantity: 1799, rate: 70, amount: 125930 },
                { id: '1-2', particulars: 'PVC CEILING (IN BALCONY)', brand: '', unit: 'sft', quantity: 68, rate: 420, amount: 28560 },
                { id: '1-3', particulars: 'WOODEN CEILING (IN HALL)', brand: '', unit: 'sft', quantity: 45, rate: 1500, amount: 67500 }
            ]
        },
        {
            id: '2',
            name: 'B. ELECTRICAL',
            items: [
                { id: '2-1', particulars: '15W Lights', brand: '', unit: 'no', quantity: 30, rate: 700, amount: 21000 },
                { id: '2-2', particulars: '6W Lights', brand: '', unit: 'no', quantity: 3, rate: 700, amount: 2100 },
                { id: '2-3', particulars: '3W Lights', brand: '', unit: 'no', quantity: 6, rate: 700, amount: 4200 },
                { id: '2-4', particulars: 'ROPE LIGHTS', brand: '', unit: 'rft', quantity: 75, rate: 220, amount: 16500 },
                { id: '2-5', particulars: 'PROFILE LIGHTS', brand: '', unit: 'rft', quantity: 44, rate: 400, amount: 17600 },
                { id: '2-6', particulars: 'FANS', brand: '', unit: 'no', quantity: 7, rate: 7500, amount: 52500 },
                { id: '2-7', particulars: 'EXHAUST FANS IN WASH ROOMS', brand: '', unit: 'no', quantity: 3, rate: 2000, amount: 6000 },
                { id: '2-8', particulars: 'ELECTRICIAN CHARGES', brand: '', unit: 'lumpsum', quantity: 1, rate: 50000, amount: 50000 },
                { id: '2-9', particulars: 'WIRING AND OTHER MATERIAL', brand: '', unit: 'lumpsum', quantity: 1, rate: 50000, amount: 50000 }
            ]
        },
        {
            id: '3',
            name: 'C. FLOOR GUARD',
            items: [
                { id: '3-1', particulars: 'FLOOR GUARD COVERING', brand: '', unit: 'sft', quantity: 1200, rate: 9, amount: 10800 }
            ]
        },
        {
            id: '17',
            name: 'D. ANTI PEST',
            items: [
                { id: '17-1', particulars: 'ANTI PEST TREATMENT', brand: '', unit: 'sft', quantity: 1200, rate: 6, amount: 7200 }
            ]
        },
        {
            id: '4',
            name: 'E. WOOD WORK',
            items: [
                { id: '4-h1', particulars: '1. DRAWING ROOM', brand: 'HEADER', unit: '', quantity: 0, rate: 0, amount: 0 },
                { id: '4-1', particulars: 'Sofa backpanelling', brand: '', unit: 'sft', quantity: 100, rate: 1500, amount: 150000 },
                { id: '4-2', particulars: 'Duco paint', brand: '', unit: 'sft', quantity: 36, rate: 800, amount: 28800 },
                { id: '4-3', particulars: 'Mirror', brand: '', unit: 'sft', quantity: 18, rate: 500, amount: 9000 },
                { id: '4-4', particulars: 'Rafters', brand: '', unit: 'sft', quantity: 18, rate: 500, amount: 9000 },
                { id: '4-5', particulars: 'Panelling (towards Handwash)', brand: '', unit: 'sft', quantity: 55, rate: 1500, amount: 82500 },
                { id: '4-6', particulars: 'mirrors', brand: '', unit: 'sft', quantity: 15, rate: 500, amount: 7500 },
                { id: '4-7', particulars: 'Wash area Storage', brand: '', unit: 'sft', quantity: 27, rate: 2000, amount: 54000 },
                { id: '4-8', particulars: 'Profile shutters', brand: '', unit: 'sft', quantity: 20, rate: 1250, amount: 25000 },
                { id: '5-1', particulars: 'Puja Storage', brand: '', unit: 'sft', quantity: 12.5, rate: 2000, amount: 25000 },
                { id: '5-2', particulars: 'Corian work', brand: '', unit: 'lumpsum', quantity: 1, rate: 120000, amount: 120000 },
                { id: '5-3', particulars: 'Console beside puja', brand: '', unit: 'lumpsum', quantity: 1, rate: 50000, amount: 50000 },
                { id: '4-h2', particulars: '2. LIVING ROOM', brand: 'HEADER', unit: '', quantity: 0, rate: 0, amount: 0 },
                { id: '5-4', particulars: 'TV UNIT Panelling', brand: '', unit: 'sft', quantity: 65, rate: 1500, amount: 97500 },
                { id: '5-5', particulars: 'TV UNIT Mirrors', brand: '', unit: 'sft', quantity: 8, rate: 500, amount: 4000 },
                { id: '5-6', particulars: 'TV UNIT Rafters', brand: '', unit: 'sft', quantity: 10, rate: 500, amount: 5000 },
                { id: '5-7', particulars: 'TV UNIT Storage', brand: '', unit: 'sft', quantity: 15, rate: 2000, amount: 30000 },
                { id: '5-8', particulars: 'Texture paint', brand: '', unit: 'sft', quantity: 100, rate: 500, amount: 50000 },
                { id: '5-9', particulars: 'Panelling above flush doors', brand: '', unit: 'sft', quantity: 8, rate: 1500, amount: 12000 },
                { id: '4-h3', particulars: '3. KITCHEN', brand: 'HEADER', unit: '', quantity: 0, rate: 0, amount: 0 },
                { id: '6-1', particulars: 'Box work', brand: '', unit: 'sft', quantity: 234, rate: 2000, amount: 468000 },
                { id: '6-2', particulars: 'Tandem drawers', brand: '', unit: 'no.s', quantity: 5, rate: 5750, amount: 28750 },
                { id: '6-3', particulars: 'Corner unit', brand: '', unit: 'no.s', quantity: 1, rate: 22000, amount: 22000 },
                { id: '6-4', particulars: 'Bottle pull out', brand: '', unit: 'no.s', quantity: 1, rate: 9200, amount: 9200 },
                { id: '6-5', particulars: 'Drawer accessories', brand: '', unit: 'no.s', quantity: 2, rate: 3500, amount: 7000 },
                { id: '6-6', particulars: 'Vegetable baskets', brand: '', unit: 'sft', quantity: 2, rate: 5750, amount: 11500 },
                { id: '6-7', particulars: 'Profile shutters', brand: '', unit: 'sft', quantity: 18, rate: 1250, amount: 22500 },
                { id: '4-h4', particulars: '4. UTILITY', brand: 'HEADER', unit: '', quantity: 0, rate: 0, amount: 0 },
                { id: '7-1', particulars: 'Storage above counter', brand: '', unit: 'sft', quantity: 30, rate: 2000, amount: 60000 },
                { id: '7-2', particulars: 'Storage below counter', brand: '', unit: 'sft', quantity: 15, rate: 2000, amount: 30000 },
                { id: '4-h5', particulars: '5. MASTER BEDROOM', brand: 'HEADER', unit: '', quantity: 0, rate: 0, amount: 0 },
                { id: '8-1', particulars: 'Wardrobe', brand: '', unit: 'sft', quantity: 76, rate: 2000, amount: 152000 },
                { id: '8-2', particulars: 'King size bed with side tables', brand: '', unit: 'no', quantity: 1, rate: 60000, amount: 60000 },
                { id: '8-3', particulars: 'TV Backpanel', brand: '', unit: 'sft', quantity: 110, rate: 110, amount: 12100 },
                { id: '8-4', particulars: 'TV Rafters', brand: '', unit: 'sft', quantity: 56, rate: 500, amount: 28000 },
                { id: '8-5', particulars: 'TV Drawers', brand: '', unit: 'sft', quantity: 4, rate: 2000, amount: 8000 },
                { id: '8-6', particulars: 'Dresser', brand: '', unit: 'sft', quantity: 10, rate: 1500, amount: 15000 },
                { id: '8-7', particulars: 'Mirror', brand: '', unit: 'sft', quantity: 10, rate: 800, amount: 8000 },
                { id: '4-h6', particulars: '6. SON\'S BEDROOM', brand: 'HEADER', unit: '', quantity: 0, rate: 0, amount: 0 },
                { id: '9-1', particulars: 'Wardrobe-1', brand: '', unit: 'sft', quantity: 48, rate: 2000, amount: 96000 },
                { id: '9-2', particulars: 'Profile shutters', brand: '', unit: 'sft', quantity: 31, rate: 1250, amount: 38750 },
                { id: '9-3', particulars: 'Bed back texture paint', brand: '', unit: 'sft', quantity: 108, rate: 500, amount: 54000 },
                { id: '9-4', particulars: 'King size bed with side tables', brand: '', unit: 'no', quantity: 1, rate: 60000, amount: 60000 },
                { id: '9-5', particulars: 'Study table storage', brand: '', unit: 'sft', quantity: 2, rate: 2000, amount: 4000 },
                { id: '9-6', particulars: 'Study table shelves', brand: '', unit: 'sft', quantity: 4, rate: 2000, amount: 8000 },
                { id: '9-7', particulars: 'Metal supports', brand: '', unit: 'lumpsum', quantity: 1, rate: 10000, amount: 10000 },
                { id: '9-8', particulars: 'Mirror beside bed', brand: '', unit: 'no', quantity: 1, rate: 10000, amount: 10000 },
                { id: '9-9', particulars: 'Dresser wardrobe-2', brand: '', unit: 'sft', quantity: 34, rate: 2000, amount: 68000 },
                { id: '9-10', particulars: 'Dresser Profile shutters', brand: '', unit: 'sft', quantity: 12, rate: 1250, amount: 15000 },
                { id: '9-11', particulars: 'Mirror (sensor)', brand: '', unit: 'sft', quantity: 21, rate: 800, amount: 16800 },
                { id: '4-h7', particulars: '7. DAUGHTER\'S BEDROOM', brand: 'HEADER', unit: '', quantity: 0, rate: 0, amount: 0 },
                { id: '10-1', particulars: 'Wardrobe', brand: '', unit: 'sft', quantity: 76, rate: 2000, amount: 152000 },
                { id: '10-2', particulars: 'Profile shutter', brand: '', unit: 'sft', quantity: 12, rate: 1250, amount: 15000 },
                { id: '10-3', particulars: 'Storage beside study', brand: '', unit: 'sft', quantity: 21, rate: 2000, amount: 42000 },
                { id: '10-4', particulars: 'Bed backpanel Wallpaper', brand: '', unit: 'no', quantity: 1, rate: 6500, amount: 6500 },
                { id: '10-5', particulars: 'King size bed with side tables', brand: '', unit: 'no', quantity: 1, rate: 60000, amount: 60000 },
                { id: '10-6', particulars: 'Dresser', brand: '', unit: 'sft', quantity: 14, rate: 2000, amount: 28000 },
                { id: '4-h9', particulars: '9. BALCONY', brand: 'HEADER', unit: '', quantity: 0, rate: 0, amount: 0 },
                { id: '11-1', particulars: 'Mirror (sensor)', brand: '', unit: 'sft', quantity: 1, rate: 10000, amount: 10000 },
                { id: '11-2', particulars: 'Study cum sewing table', brand: '', unit: 'sft', quantity: 22, rate: 850, amount: 18700 },
                { id: '11-3', particulars: 'Shelves', brand: '', unit: 'sft', quantity: 8, rate: 850, amount: 6800 },
                { id: '11-4', particulars: 'Shelves with metal edge', brand: '', unit: 'sft', quantity: 8, rate: 1000, amount: 8000 },
                { id: '11-5', particulars: 'Rafters', brand: '', unit: 'sft', quantity: 54, rate: 800, amount: 43200 },
                { id: '11-6', particulars: 'BAR UNIT', brand: '', unit: 'sft', quantity: 26, rate: 2000, amount: 52000 },
                { id: '11-7', particulars: 'Profile shutters', brand: '', unit: 'sft', quantity: 20, rate: 1250, amount: 25000 },
                { id: '11-8', particulars: 'Backsplash Panelling', brand: '', unit: 'sft', quantity: 6, rate: 850, amount: 5100 }
            ]
        },
        {
            id: '12',
            name: 'F. GRANITE AND TILES WORK',
            items: [
                { id: '12-1', particulars: 'Kitchen quartz counter top', brand: '', unit: 'sft', quantity: 40, rate: 2400, amount: 96000 },
                { id: '12-2', particulars: 'Kitchen Backsplash tiles', brand: '', unit: 'sft', quantity: 120, rate: 250, amount: 30000 },
                { id: '12-3', particulars: 'Wash area quartz counter top', brand: '', unit: 'sft', quantity: 5, rate: 2400, amount: 12000 },
                { id: '12-4', particulars: 'Backsplash (base)', brand: '', unit: 'sft', quantity: 12, rate: 250, amount: 3000 },
                { id: '12-5', particulars: 'Puja counter top', brand: '', unit: 'sft', quantity: 12, rate: 2400, amount: 28800 },
                { id: '12-6', particulars: 'Corian work', brand: '', unit: 'lumpsum', quantity: 1, rate: 150000, amount: 150000 },
                { id: '12-7', particulars: 'Backsplash & tiles', brand: '', unit: 'sft', quantity: 35, rate: 400, amount: 14000 },
                { id: '12-8', particulars: 'Toilet Vanities Counter top', brand: '', unit: 'sft', quantity: 12, rate: 2000, amount: 24000 },
                { id: '12-9', particulars: 'Utility Granite top & supports', brand: '', unit: 'sft', quantity: 56, rate: 1200, amount: 67200 }
            ]
        },
        {
            id: '13',
            name: 'G. MISC.',
            items: [
                { id: '13-1', particulars: 'Cushion work in MBR', brand: '', unit: 'sft', quantity: 18, rate: 650, amount: 11700 },
                { id: '13-2', particulars: 'Cushion work in KBR', brand: '', unit: 'sft', quantity: 18, rate: 650, amount: 11700 },
                { id: '13-3', particulars: 'Cushion work in GBR', brand: '', unit: 'sft', quantity: 18, rate: 650, amount: 11700 },
                { id: '13-4', particulars: 'Vanities in bathrooms (woodwork)', brand: '', unit: 'sft', quantity: 12, rate: 2000, amount: 24000 }
            ]
        },
        {
            id: '14',
            name: 'H. PAINTING',
            items: [
                { id: '14-1', particulars: 'Royale shyne (putty+primer+2 coats)', brand: '', unit: 'sft', quantity: 4000, rate: 30, amount: 120000 },
                { id: '14-2', particulars: 'Flush Door polishing', brand: '', unit: 'lumpsum', quantity: 1, rate: 120000, amount: 120000 }
            ]
        },
        {
            id: '15',
            name: 'I. APPLIANCES',
            items: [
                { id: '15-1', particulars: 'Home appliances', brand: '', unit: 'no', quantity: 1, rate: 20000, amount: 20000 },
                { id: '15-2', particulars: 'HOB', brand: '', unit: 'no', quantity: 1, rate: 25000, amount: 25000 },
                { id: '15-3', particulars: 'Chimney', brand: '', unit: 'no', quantity: 1, rate: 45000, amount: 45000 },
                { id: '15-4', particulars: 'In-built microwave oven', brand: '', unit: 'no', quantity: 1, rate: 80000, amount: 80000 },
                { id: '15-5', particulars: 'Washing machine', brand: '', unit: 'no', quantity: 1, rate: 80000, amount: 80000 },
                { id: '15-6', particulars: 'Acs', brand: 'no', unit: 'no', quantity: 6, rate: 65000, amount: 390000 },
                { id: '15-7', particulars: 'Fridge', brand: 'no', unit: 'no', quantity: 1, rate: 70000, amount: 70000 }
            ]
        },
        {
            id: '16',
            name: 'J. MISCELLANEOUS (LOOSE FURNITURE & DECOR)',
            items: [
                { id: '16-h1', particulars: '1. LOOSE FURNITURE', brand: 'HEADER', unit: '', quantity: 0, rate: 0, amount: 0 },
                { id: '16-1', particulars: 'L shape sofa', brand: 'Customised', unit: 'no', quantity: 1, rate: 150000, amount: 150000 },
                { id: '16-2', particulars: '3 seater sofa', brand: 'Customised', unit: 'no', quantity: 1, rate: 80000, amount: 80000 },
                { id: '16-3', particulars: 'Accent chair', brand: 'Customised', unit: 'no', quantity: 1, rate: 25000, amount: 25000 },
                { id: '16-4', particulars: 'Centre table', brand: 'Customised', unit: 'no', quantity: 1, rate: 25000, amount: 25000 },
                { id: '16-5', particulars: 'Dining table', brand: 'Customised', unit: 'no', quantity: 1, rate: 50000, amount: 50000 },
                { id: '16-6', particulars: 'Son\'s room Study Chair', brand: 'Customised', unit: 'no', quantity: 1, rate: 10000, amount: 10000 },
                { id: '16-7', particulars: 'Study Chair in MBR', brand: 'NA', unit: 'no', quantity: 1, rate: 60000, amount: 60000 },
                { id: '16-8', particulars: 'Pouffes (Family Hall)', brand: 'no', unit: 'no', quantity: 1, rate: 6000, amount: 6000 },
                { id: '16-9', particulars: 'Window bench (Son Room)', brand: 'no', unit: 'no', quantity: 2, rate: 4500, amount: 9000 },
                { id: '16-10', particulars: 'Pouffes (Daughter Room)', brand: 'no', unit: 'no', quantity: 1, rate: 6000, amount: 6000 },
                { id: '16-11', particulars: 'Study Chair (Daughter Room)', brand: 'no', unit: 'no', quantity: 1, rate: 4500, amount: 4500 },

                { id: '16-h2', particulars: '2. BED ACCESSORIES', brand: 'HEADER', unit: '', quantity: 0, rate: 0, amount: 0 },
                { id: '16-12', particulars: 'Mattresses & pillows', brand: 'no', unit: 'no', quantity: 1, rate: 8000, amount: 8000 },
                { id: '16-13', particulars: 'Bedcovers & duvets', brand: 'no', unit: 'no', quantity: 3, rate: 15000, amount: 45000 },

                { id: '16-h3', particulars: '3. SINKS & TAPS', brand: 'HEADER', unit: '', quantity: 0, rate: 0, amount: 0 },
                { id: '16-14', particulars: 'Sinks (Kitchen/Utility/Wash)', brand: 'no', unit: 'no', quantity: 3, rate: 5500, amount: 16500 },
                { id: '16-15', particulars: 'Kitchen Tap', brand: 'no', unit: 'no', quantity: 1, rate: 15000, amount: 15000 },
                { id: '16-16', particulars: 'Utility Tap', brand: 'no', unit: 'no', quantity: 1, rate: 10000, amount: 10000 },
                { id: '16-17', particulars: 'Wash area Tap', brand: 'no', unit: 'no', quantity: 1, rate: 10000, amount: 10000 },
                { id: '16-h4', particulars: '4. LIGHTS & DECOR', brand: 'HEADER', unit: '', quantity: 0, rate: 0, amount: 0 },
                { id: '16-18', particulars: 'Chandelier in hall', brand: 'no', unit: 'no', quantity: 1, rate: 30000, amount: 30000 },
                { id: '16-19', particulars: 'Hanging lights (Daughter Room)', brand: 'no', unit: 'no', quantity: 1, rate: 15000, amount: 15000 },
                { id: '16-20', particulars: 'Curtains (Complete Home)', brand: 'lumpsum', unit: 'no', quantity: 1, rate: 200000, amount: 200000 },
                { id: '16-21', particulars: 'Carpet (Living Room)', brand: 'no', unit: 'no', quantity: 1, rate: 35000, amount: 35000 },
                { id: '16-22', particulars: 'Carpet (Son Room)', brand: 'no', unit: 'no', quantity: 1, rate: 35000, amount: 35000 },
                { id: '16-23', particulars: 'Carpet (Daughter Room)', brand: 'no', unit: 'no', quantity: 1, rate: 35000, amount: 35000 },
                { id: '16-24', particulars: 'Artwork', brand: 'no', unit: 'no', quantity: 1, rate: 40000, amount: 40000 },
                { id: '16-25', particulars: 'Side tables', brand: 'nos', unit: 'no', quantity: 4, rate: 18000, amount: 72000 },
                { id: '16-26', particulars: 'Wallpapers', brand: 'no.s', unit: 'no', quantity: 6, rate: 6000, amount: 36000 },

                { id: '16-h5', particulars: '5. BATHROOMS & MISC', brand: 'HEADER', unit: '', quantity: 0, rate: 0, amount: 0 },
                { id: '16-27', particulars: 'Glass partitions', brand: 'no.s', unit: 'no', quantity: 1, rate: 25000, amount: 25000 },
                { id: '16-28', particulars: 'Bathroom accessories', brand: 'no.s', unit: 'no', quantity: 3, rate: 3000, amount: 9000 },
                { id: '16-29', particulars: 'Balcony clothes hangers', brand: 'no.s', unit: 'no', quantity: 2, rate: 6000, amount: 12000 },
                { id: '16-30', particulars: 'Step dustbins', brand: 'no.s', unit: 'no', quantity: 5, rate: 4000, amount: 20000 },
                { id: '16-31', particulars: 'Doormats', brand: 'no.s', unit: 'no', quantity: 8, rate: 600, amount: 4800 }
            ]
        }
    ]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchQuote();
    }, [project.project_id, isUsedQuote]);

    const fetchQuote = async () => {
        setLoading(true);
        try {
            const response = await axios.get(`http://localhost/ARK/api/quotes/latest?project_id=${project.project_id}&is_used=${isUsedQuote}`);
            if (response.data.success && response.data.data) {
                // Map DB structure to frontend structure
                const mappedSections = response.data.data.sections.map((s: any) => ({
                    id: s.section_id,
                    name: s.section_name,
                    items: s.items.map((i: any) => ({
                        id: i.item_id,
                        particulars: i.particulars,
                        brand: i.brand,
                        unit: i.unit,
                        quantity: parseFloat(i.quantity),
                        used_quantity: parseFloat(i.used_quantity),
                        rate: parseFloat(i.rate),
                        amount: parseFloat(i.amount)
                    }))
                }));
                setSections(mappedSections);
            }
        } catch (err) {
            console.error('Failed to fetch quote');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveQuote = async () => {
        setSaving(true);
        try {
            const total = getGrandTotal();
            const response = await axios.post('http://localhost/ARK/api/quotes/save', {
                project_id: project.project_id,
                is_used_quote: isUsedQuote,
                total_amount: total,
                sections: sections,
                created_by: user.user_id
            });
            if (response.data.success) {
                alert('Quote saved successfully');
                setQuoteTotal(total);
            } else {
                alert('Failed to save: ' + (response.data.message || 'Unknown error'));
            }
        } catch (err: any) {
            alert('Failed to save quote: ' + (err.response?.data?.message || err.message));
        } finally {
            setSaving(false);
        }
    };

    useEffect(() => {
        const total = getGrandTotal();
        setQuoteTotal(total);
    }, [sections]);

    const calculateItemAmount = (qty: number, rate: number) => qty * rate;

    const updateItem = (sectionId: string, itemId: string, field: string, value: any) => {
        setSections(sections.map(s => {
            if (s.id === sectionId) {
                return {
                    ...s,
                    items: s.items.map(i => {
                        if (i.id === itemId) {
                            const updated = { ...i, [field]: value };
                            if (field === 'quantity' || field === 'rate') {
                                updated.amount = calculateItemAmount(updated.quantity, updated.rate);
                            }
                            return updated;
                        }
                        return i;
                    })
                };
            }
            return s;
        }));
    };

    const addSection = () => {
        const newId = (sections.length + 1).toString();
        setSections([...sections, { id: newId, name: 'NEW SECTION', items: [] }]);
    };

    const addItem = (sectionId: string) => {
        setSections(sections.map(s => {
            if (s.id === sectionId) {
                const newId = `${s.id}-${s.items.length + 1}`;
                return {
                    ...s,
                    items: [...s.items, { id: newId, particulars: '', brand: '', unit: '', quantity: 0, rate: 0, amount: 0 }]
                };
            }
            return s;
        }));
    };

    const getGroupATotal = () => sections
        .filter(s => {
            const name = s.name.toUpperCase();
            return name.startsWith('A.') || name.startsWith('B.') || name.startsWith('C.') ||
                name.startsWith('D.') || name.startsWith('E.') || name.startsWith('F.') ||
                name.startsWith('G.') || name.startsWith('H.');
        })
        .reduce((total, s) => total + s.items.reduce((st, i) => st + (i.amount || 0), 0), 0);

    const getGroupBTotal = () => sections
        .filter(s => s.name.toUpperCase().includes('APPLIANCES'))
        .reduce((total, s) => total + s.items.reduce((st, i) => st + (i.amount || 0), 0), 0);

    const getGroupCTotal = () => sections
        .filter(s => s.name.toUpperCase().includes('LOOSE FURNITURE') || s.name.toUpperCase().includes('DECOR'))
        .reduce((total, s) => total + s.items.reduce((st, i) => st + (i.amount || 0), 0), 0);

    const getGrandTotal = () => getGroupATotal() + getGroupBTotal() + getGroupCTotal();

    const romanize = (num: number) => {
        if (num <= 0) return '';
        const lookup: any = { m: 1000, cm: 900, d: 500, cd: 400, c: 100, xc: 90, l: 50, xl: 40, x: 10, ix: 9, v: 5, iv: 4, i: 1 };
        let roman = '';
        let n = num;
        for (let i in lookup) {
            while (n >= lookup[i]) {
                roman += i;
                n -= lookup[i];
            }
        }
        return roman.toUpperCase();
    };

    if (loading) {
        return <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}><Loader2 className="animate-spin" size={48} color="#253b50" /></div>;
    }

    return (
        <div className="quote-container" style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <div className="premium-card" style={{ padding: '40px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)' }}>
                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#253b50', marginBottom: '4px' }}>{project.project_name}</h1>
                    <p style={{ fontWeight: 700, fontSize: '1rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px' }}>{isUsedQuote ? 'ESTIMATE FOR INTERIORS (USAGE)' : 'ESTIMATE FOR INTERIORS'}</p>
                </div>

                <table className="quote-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#253b50', color: 'white' }}>
                            <th style={{ padding: '12px', border: '1px solid #334155', textAlign: 'left', width: '50%' }}>PARTICULARS</th>
                            <th style={{ padding: '12px', border: '1px solid #334155', textAlign: 'left', width: '45px' }}>UNIT</th>
                            {!isUsedQuote ? (
                                <th style={{ padding: '12px', border: '1px solid #334155', textAlign: 'left', width: '45px' }}>QTY</th>
                            ) : (
                                <>
                                    <th style={{ padding: '12px', border: '1px solid #334155', textAlign: 'left', width: '45px', fontSize: '0.8rem' }}>ASSIGNED<br />QTY</th>
                                    <th style={{ padding: '12px', border: '1px solid #334155', textAlign: 'left', width: '45px', fontSize: '0.8rem', color: '#fef08a' }}>USED<br />QTY</th>
                                    <th style={{ padding: '12px', border: '1px solid #334155', textAlign: 'left', width: '45px', fontSize: '0.8rem', color: '#63b3ed' }}>BALANCE<br />QTY</th>
                                </>
                            )}
                            <th style={{ padding: '12px', border: '1px solid #334155', textAlign: 'left', width: '65px' }}>RATE</th>
                            <th style={{ padding: '12px', border: '1px solid #334155', textAlign: 'left', width: '85px' }}>AMOUNT</th>
                            <th className="no-print" style={{ padding: '12px', border: '1px solid #334155', width: '50px' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {sections.map(section => {
                            let subItemCounter = 0;
                            return (
                                <React.Fragment key={section.id}>
                                    <tr className="quote-section-header" style={{ backgroundColor: '#cbd5e1', fontWeight: 800 }}>
                                        <td colSpan={!isUsedQuote ? 6 : 8} style={{ padding: '10px 12px', border: '1px solid #94a3b8' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                {isReadOnly ? (
                                                    <span style={{ fontWeight: 800, color: '#1e293b' }}>{section.name}</span>
                                                ) : (
                                                    <input
                                                        value={section.name}
                                                        onChange={(e) => setSections(sections.map(s => s.id === section.id ? { ...s, name: e.target.value } : s))}
                                                        style={{ fontWeight: 800, border: 'none', background: 'none', width: '80%', color: '#1e293b' }}
                                                    />
                                                )}
                                                {!isReadOnly && <Plus size={16} style={{ cursor: 'pointer' }} onClick={() => addItem(section.id)} className="no-print" />}
                                            </div>
                                        </td>
                                    </tr>
                                    {section.items.map((item) => {
                                        const isSubHeader = item.brand === 'HEADER';
                                        if (isSubHeader) subItemCounter = 0;
                                        else subItemCounter++;

                                        const assignedQty = item.quantity || 0;
                                        const usedQty = (item as any).used_quantity || 0;
                                        let rowStyle: any = isSubHeader ? { backgroundColor: '#f8fafc' } : {};

                                        if (isUsedQuote && !isSubHeader && assignedQty > 0) {
                                            const usageRatio = usedQty / assignedQty;
                                            if (usageRatio >= 0.9 && usageRatio < 1) {
                                                rowStyle = { backgroundColor: '#fef08a' }; // Yellow warning
                                            } else if (usageRatio >= 1) {
                                                rowStyle = { backgroundColor: '#fca5a5' }; // Red danger
                                            }
                                        }

                                        return (
                                            <tr key={item.id} style={rowStyle}>
                                                <td style={{ border: '1px solid #e2e8f0', padding: '0' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                                        {!isSubHeader && <span style={{ paddingLeft: '8px', color: '#6b7280', fontSize: '0.75rem', width: '22px', flexShrink: 0 }}>{romanize(subItemCounter)}.</span>}
                                                        {isReadOnly ? (
                                                            <span style={{ flex: 1, padding: '8px 10px', fontWeight: isSubHeader ? 700 : 400 }}>{item.particulars}</span>
                                                        ) : (
                                                            <input
                                                                value={item.particulars}
                                                                onChange={(e) => updateItem(section.id, item.id, 'particulars', e.target.value)}
                                                                style={{
                                                                    flex: 1,
                                                                    padding: '8px 10px',
                                                                    border: 'none',
                                                                    fontWeight: isSubHeader ? 700 : 400,
                                                                    backgroundColor: 'transparent',
                                                                    width: '100%'
                                                                }}
                                                                placeholder="Description"
                                                            />
                                                        )}
                                                    </div>
                                                </td>
                                                <td style={{ border: '1px solid #e2e8f0', padding: '0' }}>
                                                    {!isSubHeader && (isReadOnly ? <span style={{ padding: '10px', display: 'block' }}>{item.unit}</span> : <input value={item.unit} onChange={(e) => updateItem(section.id, item.id, 'unit', e.target.value)} style={{ width: '100%', padding: '10px', border: 'none', backgroundColor: 'transparent' }} placeholder="sft/no" />)}
                                                </td>
                                                {!isUsedQuote ? (
                                                    <td style={{ border: '1px solid #e2e8f0', padding: '0' }}>
                                                        {!isSubHeader && (isReadOnly ? <span style={{ padding: '10px', display: 'block' }}>{item.quantity}</span> : <input type="number" value={item.quantity} onChange={(e) => updateItem(section.id, item.id, 'quantity', parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '10px', border: 'none', backgroundColor: 'transparent' }} />)}
                                                    </td>
                                                ) : (
                                                    <>
                                                        <td style={{ border: '1px solid #e2e8f0', padding: '0' }}>
                                                            {!isSubHeader && (isReadOnly ? <span style={{ padding: '10px', display: 'block' }}>{item.quantity}</span> : <input type="number" value={item.quantity} onChange={(e) => updateItem(section.id, item.id, 'quantity', parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '10px', border: 'none', backgroundColor: 'transparent' }} />)}
                                                        </td>
                                                        <td style={{ border: '1px solid #e2e8f0', padding: '0' }}>
                                                            {!isSubHeader && ((isReadOnly && user?.role !== 'accountant') ?
                                                                <span style={{ padding: '10px', display: 'block' }}>{usedQty}</span> :
                                                                <input type="number" value={usedQty} onChange={(e) => updateItem(section.id, item.id, 'used_quantity', parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '10px', border: 'none', backgroundColor: 'transparent', fontWeight: 600, color: '#000' }} />
                                                            )}
                                                        </td>
                                                        <td style={{ border: '1px solid #e2e8f0', padding: '10px', fontWeight: 700, textAlign: 'center', color: (assignedQty - usedQty) < 0 ? '#ef4444' : '#1e293b' }}>
                                                            {!isSubHeader && (assignedQty - usedQty)}
                                                        </td>
                                                    </>
                                                )}
                                                <td style={{ border: '1px solid #e2e8f0', padding: '0' }}>
                                                    {!isSubHeader && (isReadOnly ? <span style={{ padding: '10px', display: 'block' }}>{item.rate}</span> : <input type="number" value={item.rate} onChange={(e) => updateItem(section.id, item.id, 'rate', parseFloat(e.target.value) || 0)} style={{ width: '100%', padding: '10px', border: 'none', backgroundColor: 'transparent' }} />)}
                                                </td>
                                                <td style={{ border: '1px solid #e2e8f0', padding: '10px', fontWeight: 600 }}>
                                                    {!isSubHeader && item.amount.toLocaleString()}
                                                </td>
                                                <td className="no-print" style={{ border: '1px solid #e2e8f0', textAlign: 'center' }}>
                                                    {!isReadOnly && <Trash2 size={16} color="#ef4444" style={{ cursor: 'pointer' }} onClick={() => {
                                                        setSections(sections.map(s => s.id === section.id ? { ...s, items: s.items.filter(i => i.id !== item.id) } : s));
                                                    }} />}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </React.Fragment>
                            );
                        })}
                        <tr style={{ backgroundColor: '#f1f5f9', fontWeight: 700 }}>
                            <td colSpan={!isUsedQuote ? 4 : 6} style={{ padding: '12px', border: '1px solid #cbd5e1', textAlign: 'right' }}>TOTAL (A) INTERIOR WORKS</td>
                            <td colSpan={2} style={{ padding: '12px', border: '1px solid #cbd5e1' }}>₹{getGroupATotal().toLocaleString()}</td>
                        </tr>
                        <tr style={{ backgroundColor: '#f1f5f9', fontWeight: 700 }}>
                            <td colSpan={!isUsedQuote ? 4 : 6} style={{ padding: '12px', border: '1px solid #cbd5e1', textAlign: 'right' }}>TOTAL (B) APPLIANCES & HOB</td>
                            <td colSpan={2} style={{ padding: '12px', border: '1px solid #cbd5e1' }}>₹{getGroupBTotal().toLocaleString()}</td>
                        </tr>
                        <tr style={{ backgroundColor: '#f1f5f9', fontWeight: 700 }}>
                            <td colSpan={!isUsedQuote ? 4 : 6} style={{ padding: '12px', border: '1px solid #cbd5e1', textAlign: 'right' }}>TOTAL (C) LOOSE FURNITURE & DECOR</td>
                            <td colSpan={2} style={{ padding: '12px', border: '1px solid #cbd5e1' }}>₹{getGroupCTotal().toLocaleString()}</td>
                        </tr>
                        <tr style={{ backgroundColor: '#253b50', color: 'white', fontWeight: 800, fontSize: '1.1rem' }}>
                            <td colSpan={!isUsedQuote ? 4 : 6} style={{ padding: '16px', border: '1px solid #334155', textAlign: 'right' }}>GRAND TOTAL (A + B + C)</td>
                            <td colSpan={2} style={{ padding: '16px', border: '1px solid #334155' }}>₹{getGrandTotal().toLocaleString()}</td>
                        </tr>
                    </tbody>
                </table>

                <div className="no-print" style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
                    {!isReadOnly && <button onClick={addSection} className="btn-primary" style={{ backgroundColor: '#64748b' }}>Add Section</button>}
                    {!isReadOnly && (
                        <button onClick={handleSaveQuote} disabled={saving} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                            {saving ? 'Saving...' : 'Save Estimate'}
                        </button>
                    )}
                </div>

                <div style={{ marginTop: '100px', display: 'flex', justifyContent: 'flex-end' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ width: '200px', borderBottom: '1px solid #000', marginBottom: '8px' }}></div>
                        <p style={{ fontWeight: 700, fontSize: '0.8rem' }}>ARK ARCHITECTS AND INTERIOR DESIGNERS</p>
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
    const navigate = useNavigate();


    // ✅ ADDED (for print)
    const printRef = useRef<HTMLDivElement>(null);

    const [items, setItems] = useState<any[]>([
        {
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

        fetch(`http://localhost/ARK/api/controllers/Inventoryproject.php?project_id=${project.project_id}`)
            .then(res => res.json())
            .then(data => {
                if (data.status === "success" && data.data.length > 0) {

                    const formatted = data.data.map((item: any) => ({
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
        
        fetch('http://localhost/ARK/api/vendors')
            .then(res => res.json())
            .then(data => {
                if (data.status === "success") {
                    console.log("Global Vendors Loaded:", data.data);
                    setVendorList(data.data);
                }
            })
            .catch(err => console.error("Error fetching vendors:", err));
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
        const updated = [...items];

        updated[index][field] = value;

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
    
                <h2>Vendor Quta Report</h2>
    
                <table>
                    <thead>
                        <tr>
                            <th>Vendor</th>
                            <th>Item</th>
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
            const res = await fetch(`http://localhost/ARK/api/controllers/Inventoryproject.php`, {
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
                Vendor Quta
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
                            <th style={th}>Vendor</th>
                            <th style={th}>Item</th>
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
                                                        fetch("http://localhost/ARK/api/vendors", {
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
                                    <input
                                        style={inputStyle}
                                        value={item.name}
                                        onChange={(e) => updateItem(i, 'name', e.target.value)}
                                    />
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

            const response = await axios.post('http://localhost/ARK/api/finance', payload);
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
            <div style={{
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
            <div style={{
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
                    <p style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase' }}>Vendor Quta</p>
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
                `http://localhost/ARK/api/controllers/timeline/state.php?project_id=${pid}`
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

    const saveTimeline = async (updatedTasks, updatedCompletions) => {

        const payload = {
            project_id: project.project_id,
            tasks: updatedTasks,
            completions: updatedCompletions
        };

        console.log("SENDING DATA 👉", payload);

        try {
            const res = await fetch('http://localhost/ARK/api/controllers/timeline/save-state.php', {
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
                <div style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px' }} className="no-print">
                    <h3 style={{ marginBottom: '15px', fontSize: '1rem', fontWeight: 700 }}>Assign Work Schedule</h3>
                    <form onSubmit={handleAddTask} style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', alignItems: 'end' }}>
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
            `}</style>
        </div>
    );
};
