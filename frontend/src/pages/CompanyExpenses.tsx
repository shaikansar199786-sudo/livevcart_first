import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useAuth } from '../hooks/useAuth';
import {
    TrendingDown,
    Plus,
    Loader2,
    Calendar,
    DollarSign,
    Users,
    Building2,
    Lightbulb,
    Search,
    CreditCard,
    ArrowDownLeft,
    Receipt
} from 'lucide-react';

interface Transaction {
    transaction_id: string;
    project_id?: string;
    project_name?: string;
    type: 'credit' | 'debit';
    amount: string;
    category: string;
    description: string;
    transaction_date: string;
    recorded_by: string;
    payment_mode?: string;
    person_name?: string;
}

interface TeamMember {
    user_id: string;
    name: string;
    role: string;
    username?: string;
    status?: string;
}

const ROLE_LABELS: Record<string, string> = {
    admin: 'Admin',
    project_head: 'Project Head',
    site_engineer: 'Site Engineer',
    accountant: 'Accountant',
    sales: 'Sales',
    d1: 'D1 Designer',
    d2: 'D2 Designer',
    mmt: 'Material Management',
    site_inspection: 'Site Inspection',
    project_manager: 'Project Manager'
};

const PASTEL_AVATARS = [
    { bg: '#fee2e2', text: '#dc2626' }, // Rose
    { bg: '#fef3c7', text: '#d97706' }, // Amber
    { bg: '#dcfce7', text: '#16a34a' }, // Emerald
    { bg: '#e0f2fe', text: '#0284c7' }, // Sky
    { bg: '#f3e8ff', text: '#9333ea' }, // Purple
    { bg: '#fce7f3', text: '#db2777' }, // Pink
    { bg: '#ffedd5', text: '#ea580c' }, // Orange
    { bg: '#ccfbf1', text: '#0d9488' }, // Teal
];

export const CompanyExpenses: React.FC = () => {
    const { user } = useAuth();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState<string>(() => {
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    });

    const [activeTab, setActiveTab] = useState<'all_overheads' | 'salary_roll'>('all_overheads');
    const [searchTerm, setSearchTerm] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    const [formData, setFormData] = useState({
        type: 'debit',
        category: 'Salary',
        person_name: '',
        amount: '',
        description: '',
        payment_mode: 'Bank Transfer',
        date: new Date().toISOString().split('T')[0],
        recorded_by: user?.user_id || ''
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [transRes, usersRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/finance`),
                axios.get(`${API_BASE_URL}/users`)
            ]);
            setTransactions(transRes.data.data || []);
            setTeamMembers(usersRes.data.data || []);
        } catch (err) {
            console.error('Failed to fetch company expenses:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const response = await axios.post(`${API_BASE_URL}/finance`, formData);
            if (response.data.success) {
                setShowModal(false);
                setFormData({
                    type: 'debit',
                    category: 'Salary',
                    person_name: '',
                    amount: '',
                    description: '',
                    payment_mode: 'Bank Transfer',
                    date: new Date().toISOString().split('T')[0],
                    recorded_by: user?.user_id || ''
                });
                fetchData();
            }
        } catch (err) {
            alert('Error recording corporate expense');
        } finally {
            setSubmitting(false);
        }
    };

    const getMonthOptions = () => {
        const options = [];
        const today = new Date();
        for (let i = 0; i < 24; i++) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            options.push(`${yyyy}-${mm}`);
        }
        return options;
    };

    // Filter to overheads only (where type is debit AND category is salary/rent/utilities/office OR project_id is empty/null)
    const overheadCategories = ['Salary', 'Rent', 'Utilities', 'Office Supplies', 'General Overhead', 'Staff Expense', 'Staff Reimbursement', 'Reimbursement', 'Food', 'Travel', 'Recharge'];
    const filteredOverheads = transactions.filter(t => {
        const isOverhead = t.type === 'debit' && (!t.project_id || overheadCategories.includes(t.category));
        if (!isOverhead) return false;
        
        if (selectedMonth === 'all') return true;
        return t.transaction_date && t.transaction_date.startsWith(selectedMonth);
    });

    // Calculations
    const salaryTotal = filteredOverheads
        .filter(t => t.category === 'Salary')
        .reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0);

    const rentTotal = filteredOverheads
        .filter(t => t.category === 'Rent')
        .reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0);

    const utilitiesTotal = filteredOverheads
        .filter(t => ['Utilities', 'Utilities & Rent'].includes(t.category))
        .reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0);

    const staffExpensesTotal = filteredOverheads
        .filter(t => ['Staff Expense', 'Staff Reimbursement', 'Reimbursement', 'Food', 'Travel', 'Recharge'].includes(t.category) || t.payment_mode === 'Reimbursement')
        .reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0);

    const otherTotal = filteredOverheads
        .filter(t => !['Salary', 'Rent', 'Utilities', 'Utilities & Rent', 'Staff Expense', 'Staff Reimbursement', 'Reimbursement', 'Food', 'Travel', 'Recharge'].includes(t.category) && t.payment_mode !== 'Reimbursement')
        .reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0);

    const grandTotal = filteredOverheads.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0);

    const activeMonthLabel = () => {
        if (selectedMonth === 'all') return 'All Time Summary';
        const [year, month] = selectedMonth.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1);
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    };

    const getAvatarColors = (name: string) => {
        const charCode = name.charCodeAt(0) || 0;
        return PASTEL_AVATARS[charCode % PASTEL_AVATARS.length];
    };

    // Helper to calculate salary paid to a specific team member this month
    const getMemberSalaryPaid = (memberName: string) => {
        return filteredOverheads
            .filter(t => t.category === 'Salary' && t.person_name === memberName)
            .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    };

    const openQuickSalaryModal = (memberName: string) => {
        setFormData({
            ...formData,
            category: 'Salary',
            person_name: memberName,
            description: `Salary payment to ${memberName}`
        });
        setShowModal(true);
    };

    return (
        <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
            <style>{`
                .overhead-card {
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 16px;
                    padding: 24px;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.02);
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                }
                .overhead-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.04);
                }
                .input-field {
                    width: 100%;
                    padding: 12px;
                    border-radius: 8px;
                    border: 1px solid #cbd5e1;
                    outline: none;
                    font-size: 0.95rem;
                    transition: border-color 0.2s ease, box-shadow 0.2s ease;
                }
                .input-field:focus {
                    border-color: #253b50;
                    box-shadow: 0 0 0 3px rgba(37, 59, 80, 0.15);
                }
                .tab-btn {
                    padding: 10px 20px;
                    border: none;
                    background: none;
                    font-size: 0.95rem;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    border-radius: 8px;
                }
                .action-btn {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background-color: #e11d48;
                    color: white;
                    padding: 12px 24px;
                    border-radius: 12px;
                    border: none;
                    font-weight: 700;
                    font-size: 0.95rem;
                    cursor: pointer;
                    box-shadow: 0 4px 10px rgba(225, 29, 72, 0.2);
                    transition: all 0.2s ease;
                }
                .action-btn:hover {
                    background-color: #be123c;
                    box-shadow: 0 6px 14px rgba(225, 29, 72, 0.3);
                    transform: translateY(-1px);
                }
                .table-row {
                    border-bottom: 1px solid #f1f5f9;
                    transition: background-color 0.2s ease;
                }
                .table-row:hover {
                    background-color: #f8fafc;
                }
                .btn-pay {
                    background-color: #ecfdf5;
                    color: #059669;
                    border: 1px solid #a7f3d0;
                    padding: 6px 12px;
                    border-radius: 6px;
                    font-weight: 700;
                    font-size: 0.8rem;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .btn-pay:hover {
                    background-color: #059669;
                    color: white;
                }
            `}</style>

            {/* Header Block */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#253b50', margin: 0 }}>Company Expenses & Overheads</h2>
                    <p style={{ color: '#6b7280', marginTop: '4px' }}>Track salaries, office rents, electricity, utilities, and general corporate overhead expenses.</p>
                </div>
                <button className="action-btn" onClick={() => setShowModal(true)}>
                    <Plus size={20} />
                    Record Company Expense
                </button>
            </div>

            {/* Filter & Controller Bar */}
            <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: '16px 24px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Statement Period:</span>
                    <div style={{ position: 'relative' }}>
                        <button 
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            style={{ 
                                padding: '10px 18px', 
                                borderRadius: '10px', 
                                border: '1px solid #cbd5e1', 
                                outline: 'none', 
                                fontSize: '0.95rem', 
                                fontWeight: 700, 
                                color: '#0f172a', 
                                cursor: 'pointer', 
                                backgroundColor: 'white', 
                                minWidth: '220px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: '8px',
                                textAlign: 'left',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                            }}
                        >
                            <span>{selectedMonth === 'all' ? 'All Time Summary' : activeMonthLabel()}</span>
                            <span style={{ 
                                fontSize: '0.7rem', 
                                color: '#64748b', 
                                transition: 'transform 0.2s', 
                                transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' 
                            }}>▼</span>
                        </button>

                        {isDropdownOpen && (
                            <>
                                <div 
                                    onClick={() => setIsDropdownOpen(false)}
                                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99, background: 'transparent' }}
                                />
                                <div style={{ 
                                    position: 'absolute', 
                                    top: '100%', 
                                    left: 0, 
                                    right: 0, 
                                    marginTop: '6px', 
                                    backgroundColor: 'white', 
                                    border: '1px solid #cbd5e1', 
                                    borderRadius: '10px', 
                                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)', 
                                    zIndex: 100, 
                                    maxHeight: '250px', 
                                    overflowY: 'auto' 
                                }}>
                                    <div 
                                        onClick={() => { setSelectedMonth('all'); setIsDropdownOpen(false); }}
                                        style={{ 
                                            padding: '10px 16px', 
                                            cursor: 'pointer', 
                                            fontSize: '0.9rem',
                                            fontWeight: selectedMonth === 'all' ? 700 : 500,
                                            color: selectedMonth === 'all' ? '#253b50' : '#334155',
                                            backgroundColor: selectedMonth === 'all' ? '#f1f5f9' : 'transparent',
                                            transition: 'background-color 0.15s ease'
                                        }}
                                        onMouseEnter={(e) => {
                                            if (selectedMonth !== 'all') e.currentTarget.style.backgroundColor = '#f8fafc';
                                        }}
                                        onMouseLeave={(e) => {
                                            if (selectedMonth !== 'all') e.currentTarget.style.backgroundColor = 'transparent';
                                        }}
                                    >
                                        All Time Summary
                                    </div>
                                    {getMonthOptions().map(m => {
                                        const [year, month] = m.split('-');
                                        const date = new Date(parseInt(year), parseInt(month) - 1);
                                        const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                                        const isSelected = selectedMonth === m;
                                        return (
                                            <div 
                                                key={m}
                                                onClick={() => { setSelectedMonth(m); setIsDropdownOpen(false); }}
                                                style={{ 
                                                    padding: '10px 16px', 
                                                    cursor: 'pointer', 
                                                    fontSize: '0.9rem',
                                                    fontWeight: isSelected ? 700 : 500,
                                                    color: isSelected ? '#253b50' : '#334155',
                                                    backgroundColor: isSelected ? '#f1f5f9' : 'transparent',
                                                    transition: 'background-color 0.15s ease'
                                                }}
                                                onMouseEnter={(e) => {
                                                    if (!isSelected) e.currentTarget.style.backgroundColor = '#f8fafc';
                                                }}
                                                onMouseLeave={(e) => {
                                                    if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                                                }}
                                            >
                                                {label}
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>
                    Statement Scope: <span style={{ color: '#e11d48', fontWeight: 700 }}>{activeMonthLabel()}</span>
                </div>
            </div>

            {/* Stat Grid (5 Columns - All In One Single Row) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '14px', marginBottom: '28px' }}>
                {/* Salaries Card */}
                <div className="overhead-card" style={{ borderTop: '4px solid #4f46e5', padding: '16px 18px', borderRadius: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <p style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Salaries Paid</p>
                            <h4 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#4f46e5', margin: 0 }}>₹{salaryTotal.toLocaleString('en-IN')}</h4>
                        </div>
                        <div style={{ backgroundColor: '#e0e7ff', color: '#4f46e5', padding: '8px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Users size={18} />
                        </div>
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '0.72rem', color: '#64748b' }}>
                        Staff monthly payroll.
                    </div>
                </div>

                {/* Rent Card */}
                <div className="overhead-card" style={{ borderTop: '4px solid #f59e0b', padding: '16px 18px', borderRadius: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <p style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Office Rent</p>
                            <h4 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#d97706', margin: 0 }}>₹{rentTotal.toLocaleString('en-IN')}</h4>
                        </div>
                        <div style={{ backgroundColor: '#fef3c7', color: '#d97706', padding: '8px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Building2 size={18} />
                        </div>
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '0.72rem', color: '#64748b' }}>
                        Office lease cost.
                    </div>
                </div>

                {/* Utilities Card */}
                <div className="overhead-card" style={{ borderTop: '4px solid #06b6d4', padding: '16px 18px', borderRadius: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <p style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Utilities & Bills</p>
                            <h4 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0891b2', margin: 0 }}>₹{utilitiesTotal.toLocaleString('en-IN')}</h4>
                        </div>
                        <div style={{ backgroundColor: '#ecfeff', color: '#0891b2', padding: '8px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Lightbulb size={18} />
                        </div>
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '0.72rem', color: '#64748b' }}>
                        Power, net & bills.
                    </div>
                </div>

                {/* Staff Expenses Card */}
                <div className="overhead-card" style={{ borderTop: '4px solid #8b5cf6', padding: '16px 18px', borderRadius: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <p style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Staff Expenses</p>
                            <h4 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#7c3aed', margin: 0 }}>₹{staffExpensesTotal.toLocaleString('en-IN')}</h4>
                        </div>
                        <div style={{ backgroundColor: '#f3e8ff', color: '#7c3aed', padding: '8px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Receipt size={18} />
                        </div>
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '0.72rem', color: '#64748b' }}>
                        Office claims & reimb.
                    </div>
                </div>

                {/* Total Overheads Card */}
                <div className="overhead-card" style={{ borderTop: '4px solid #e11d48', backgroundColor: '#fff1f2', padding: '16px 18px', borderRadius: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <p style={{ color: '#be123c', fontSize: '0.75rem', fontWeight: 700, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Total Overheads</p>
                            <h4 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#be123c', margin: 0 }}>₹{grandTotal.toLocaleString('en-IN')}</h4>
                        </div>
                        <div style={{ backgroundColor: '#ffe4e6', color: '#be123c', padding: '8px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <TrendingDown size={18} />
                        </div>
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '0.72rem', color: '#be123c', fontWeight: 600 }}>
                        Total company expenses.
                    </div>
                </div>
            </div>

            {/* Detailed Tables & Tabs */}
            <div className="premium-card" style={{ border: '1px solid #e2e8f0', padding: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', gap: '8px', backgroundColor: '#e2e8f0', padding: '4px', borderRadius: '10px' }}>
                        <button
                            className="tab-btn"
                            onClick={() => setActiveTab('all_overheads')}
                            style={{
                                backgroundColor: activeTab === 'all_overheads' ? 'white' : 'transparent',
                                color: activeTab === 'all_overheads' ? '#0f172a' : '#475569',
                                boxShadow: activeTab === 'all_overheads' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                            }}
                        >
                            All Overhead Expenses
                        </button>
                        <button
                            className="tab-btn"
                            onClick={() => setActiveTab('salary_roll')}
                            style={{
                                backgroundColor: activeTab === 'salary_roll' ? 'white' : 'transparent',
                                color: activeTab === 'salary_roll' ? '#0f172a' : '#475569',
                                boxShadow: activeTab === 'salary_roll' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                            }}
                        >
                            Team Salaries Roll
                        </button>
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    {activeTab === 'all_overheads' ? (
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #cbd5e1', backgroundColor: '#f8fafc' }}>
                                    <th style={{ padding: '16px 24px', color: '#475569', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase' }}>Expense Details</th>
                                    <th style={{ padding: '16px 24px', color: '#475569', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase' }}>Category</th>
                                    <th style={{ padding: '16px 24px', color: '#475569', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase' }}>Date</th>
                                    <th style={{ padding: '16px 24px', color: '#475569', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase' }}>Payment Mode</th>
                                    <th style={{ padding: '16px 24px', color: '#475569', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', textAlign: 'right' }}>Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} style={{ textAlign: 'center', padding: '40px' }}>
                                            <Loader2 className="animate-spin" style={{ margin: '0 auto' }} size={32} color="#253b50" />
                                        </td>
                                    </tr>
                                ) : filteredOverheads.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} style={{ textAlign: 'center', padding: '50px', color: '#64748b' }}>
                                            No corporate overhead transactions logged for this statement month.
                                        </td>
                                    </tr>
                                ) : filteredOverheads.map((o, idx) => (
                                    <tr key={`${o.transaction_id}-${idx}`} className="table-row">
                                        <td style={{ padding: '16px 24px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{
                                                    backgroundColor: '#fee2e2',
                                                    color: '#991b1b',
                                                    padding: '8px',
                                                    borderRadius: '8px'
                                                }}>
                                                    <ArrowDownLeft size={18} />
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>
                                                        {o.category === 'Salary' ? `Salary to ${o.person_name || 'Staff Member'}` : o.description || 'Company Expense'}
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>Transaction ID: TXN-{o.transaction_id}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px 24px' }}>
                                            <span style={{ fontSize: '0.8rem', fontWeight: 700, padding: '4px 10px', borderRadius: '20px', backgroundColor: '#f1f5f9', color: '#475569' }}>
                                                {o.category}
                                            </span>
                                        </td>
                                        <td style={{ padding: '16px 24px', fontSize: '0.9rem', color: '#64748b' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Calendar size={14} />
                                                {new Date(o.transaction_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px 24px', fontWeight: 600, color: '#475569' }}>
                                            {o.payment_mode}
                                        </td>
                                        <td style={{ padding: '16px 24px', fontWeight: 800, textAlign: 'right', color: '#e11d48', fontSize: '1rem' }}>
                                            -₹{parseFloat(o.amount).toLocaleString('en-IN')}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #cbd5e1', backgroundColor: '#f8fafc' }}>
                                    <th style={{ padding: '16px 24px', color: '#475569', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase' }}>Team Member Name</th>
                                    <th style={{ padding: '16px 24px', color: '#475569', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase' }}>Department Role</th>
                                    <th style={{ padding: '16px 24px', color: '#475569', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', textAlign: 'right' }}>Salary Paid This Month</th>
                                    <th style={{ padding: '16px 24px', color: '#475569', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={4} style={{ textAlign: 'center', padding: '40px' }}>
                                            <Loader2 className="animate-spin" style={{ margin: '0 auto' }} size={32} color="#253b50" />
                                        </td>
                                    </tr>
                                ) : teamMembers.filter(t => t.status === 'active').map((m, idx) => {
                                    const colors = getAvatarColors(m.name);
                                    const paidAmount = getMemberSalaryPaid(m.name);
                                    return (
                                        <tr key={m.user_id} className="table-row">
                                            <td style={{ padding: '16px 24px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div style={{ 
                                                        width: '36px', 
                                                        height: '36px', 
                                                        borderRadius: '10px', 
                                                        backgroundColor: colors.bg, 
                                                        color: colors.text, 
                                                        display: 'flex', 
                                                        alignItems: 'center', 
                                                        justifyContent: 'center', 
                                                        fontWeight: 800,
                                                        fontSize: '0.9rem'
                                                    }}>
                                                        {m.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{m.name}</div>
                                                </div>
                                            </td>
                                            <td style={{ padding: '16px 24px', fontWeight: 500, color: '#475569' }}>
                                                {ROLE_LABELS[m.role] || m.role}
                                            </td>
                                            <td style={{ padding: '16px 24px', fontWeight: 800, textAlign: 'right', color: paidAmount > 0 ? '#059669' : '#94a3b8', fontSize: '0.95rem' }}>
                                                {paidAmount > 0 ? `₹${paidAmount.toLocaleString('en-IN')}` : '₹0'}
                                            </td>
                                            <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                                                <button 
                                                    className="btn-pay" 
                                                    onClick={() => openQuickSalaryModal(m.name)}
                                                >
                                                    {paidAmount > 0 ? 'Pay Bonus / Additional' : 'Record Salary'}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="premium-card" style={{ width: '100%', maxWidth: '550px', padding: '0', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', backgroundColor: 'white' }}>
                        <div style={{ padding: '24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Record Corporate Expense</h3>
                            <button onClick={() => setShowModal(false)} style={{ color: '#64748b', cursor: 'pointer', border: 'none', background: 'none', fontSize: '1.8rem', fontWeight: 400, padding: '0 8px', lineHeight: 1 }}>&times;</button>
                        </div>

                        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Expense Category</label>
                                    <select 
                                        value={formData.category} 
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value, person_name: '' })} 
                                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.95rem', fontWeight: 500, color: '#0f172a' }}
                                    >
                                        <option value="Salary">Staff Salary</option>
                                        <option value="Rent">Office Rent</option>
                                        <option value="Utilities">Utilities & Bills</option>
                                        <option value="Office Supplies">Office Supplies</option>
                                        <option value="General Overhead">General Overhead</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Amount (₹)</label>
                                    <input type="number" required value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} className="input-field" placeholder="e.g. 25000" />
                                </div>
                            </div>

                            {formData.category === 'Salary' && (
                                <div style={{ marginBottom: '16px' }}>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Staff Member Payee</label>
                                    <select 
                                        required 
                                        value={formData.person_name} 
                                        onChange={(e) => {
                                            const name = e.target.value;
                                            setFormData({ 
                                                ...formData, 
                                                person_name: name,
                                                description: name ? `Salary payment to ${name}` : '' 
                                            });
                                        }} 
                                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.95rem', fontWeight: 500, color: '#0f172a' }}
                                    >
                                        <option value="">-- Select Member --</option>
                                        {teamMembers.filter(t => t.status === 'active').map(m => (
                                            <option key={m.user_id} value={m.name}>
                                                {m.name} ({ROLE_LABELS[m.role] || m.role})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Payment Date</label>
                                    <input type="date" required value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="input-field" />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Payment Mode</label>
                                    <select value={formData.payment_mode} onChange={(e) => setFormData({ ...formData, payment_mode: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.95rem', fontWeight: 500, color: '#0f172a' }}>
                                        <option value="UPI">UPI</option>
                                        <option value="Cash">Cash</option>
                                        <option value="Bank Transfer">Bank Transfer</option>
                                        <option value="Cheque">Cheque</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Expense Notes / Description</label>
                                <textarea rows={2} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="input-field" placeholder="Enter bills ref, comments, or transaction notes..." />
                            </div>

                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', padding: '16px 24px 0 24px', margin: '0 -24px' }}>
                                <button type="button" onClick={() => setShowModal(false)} style={{ padding: '12px 24px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: 'white', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>Cancel</button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        backgroundColor: '#e11d48',
                                        border: 'none',
                                        color: 'white',
                                        padding: '12px 24px',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontWeight: 700
                                    }}
                                >
                                    {submitting && <Loader2 className="animate-spin" size={16} />}
                                    Save Company Expense
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
