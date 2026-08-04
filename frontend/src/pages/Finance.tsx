import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useAuth } from '../hooks/useAuth';
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    Plus,
    Loader2,
    ArrowUpRight,
    ArrowDownLeft,
    Calendar,
    Briefcase,
    FileText,
    Percent
} from 'lucide-react';

interface Transaction {
    transaction_id: string;
    project_name: string;
    type: 'credit' | 'debit';
    amount: string;
    category: string;
    description: string;
    transaction_date: string;
    recorded_by: string;
}

interface Project {
    project_id: string;
    project_name: string;
    total_budget: string;
}

export const Finance: React.FC = () => {
    const { user } = useAuth();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [historyTab, setHistoryTab] = useState<'received' | 'spent'>('received');
    const [selectedMonth, setSelectedMonth] = useState<string>(() => {
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    });
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    const [formData, setFormData] = useState({
        project_id: '',
        type: 'debit',
        category: 'Transport',
        amount: '',
        description: '',
        payment_mode: 'Cash',
        date: new Date().toISOString().split('T')[0],
        recorded_by: user?.user_id || ''
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [transRes, projRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/finance`),
                axios.get(`${API_BASE_URL}/projects`)
            ]);
            setTransactions(transRes.data.data || []);
            setProjects(projRes.data.data || []);
        } catch (err) {
            console.error('Failed to fetch finance data:', err);
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
                    project_id: '',
                    type: 'debit',
                    category: 'Transport',
                    amount: '',
                    description: '',
                    payment_mode: 'Cash',
                    date: new Date().toISOString().split('T')[0],
                    recorded_by: user?.user_id || ''
                });
                fetchData();
            }
        } catch (err) {
            alert('Error recording transaction');
        } finally {
            setSubmitting(false);
        }
    };

    const getMonthOptions = () => {
        const options = [];
        const today = new Date();
        // Generate last 24 months statically so each and every month is selectable
        for (let i = 0; i < 24; i++) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            options.push(`${yyyy}-${mm}`);
        }
        return options;
    };

    const filteredTransactions = transactions.filter(t => {
        if (selectedMonth === 'all') return true;
        return t.transaction_date && t.transaction_date.startsWith(selectedMonth);
    });

    const totalCredit = filteredTransactions
        .filter(t => t.type === 'credit')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const totalDebit = filteredTransactions
        .filter(t => t.type === 'debit')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    // Calculate per-project cash in/out
    const projectFinancials = projects.map((project: any) => {
        const projectTransactions = filteredTransactions.filter(t => t.project_name === project.project_name);
        const cashIn = projectTransactions.filter(t => t.type === 'credit').reduce((sum, t) => sum + parseFloat(t.amount), 0);
        const cashOut = projectTransactions.filter(t => t.type === 'debit').reduce((sum, t) => sum + parseFloat(t.amount), 0);
        const remaining = cashIn - cashOut;
        return {
            project_name: project.project_name,
            cashIn,
            cashOut,
            remaining
        };
    }).filter(p => p.cashIn > 0 || p.cashOut > 0);

    const activeMonthLabel = () => {
        if (selectedMonth === 'all') return 'All Time Summary';
        const [year, month] = selectedMonth.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1);
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    };

    return (
        <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
            {/* Styles for premium animations & aesthetics */}
            <style>{`
                .finance-card {
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 16px;
                    padding: 24px;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.02);
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                }
                .finance-card:hover {
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
                    background-color: #253b50;
                    color: white;
                    padding: 12px 24px;
                    border-radius: 12px;
                    border: none;
                    font-weight: 700;
                    font-size: 0.95rem;
                    cursor: pointer;
                    box-shadow: 0 4px 10px rgba(37, 59, 80, 0.2);
                    transition: all 0.2s ease;
                }
                .action-btn:hover {
                    background-color: #1e3041;
                    box-shadow: 0 6px 14px rgba(37, 59, 80, 0.3);
                    transform: translateY(-1px);
                }
                .table-row {
                    border-bottom: 1px solid #f1f5f9;
                    transition: background-color 0.2s ease;
                }
                .table-row:hover {
                    background-color: #f8fafc;
                }
            `}</style>

            {/* Header Block */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#253b50', margin: 0 }}>Finance & Accounts</h2>
                    <p style={{ color: '#6b7280', marginTop: '4px' }}>Analyze statements, record advance payments, and log site expenses monthly.</p>
                </div>
                <button className="action-btn" onClick={() => setShowModal(true)}>
                    <Plus size={20} />
                    Record Transaction
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
                    Statement Scope: <span style={{ color: '#253b50', fontWeight: 700 }}>{activeMonthLabel()}</span>
                </div>
            </div>

            {/* Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px', marginBottom: '35px' }}>
                {/* Cash In */}
                <div className="finance-card" style={{ borderTop: '4px solid #10b981' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <p style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase' }}>Cash In (Advances)</p>
                            <h4 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#059669' }}>₹{totalCredit.toLocaleString('en-IN')}</h4>
                        </div>
                        <div style={{ backgroundColor: '#ecfdf5', color: '#10b981', padding: '12px', borderRadius: '12px' }}>
                            <TrendingUp size={24} />
                        </div>
                    </div>
                    <div style={{ marginTop: '14px', fontSize: '0.75rem', color: '#64748b' }}>
                        Total client bookings & advances for this period.
                    </div>
                </div>

                {/* Cash Out */}
                <div className="finance-card" style={{ borderTop: '4px solid #f43f5e' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <p style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase' }}>Cash Out (Expenses)</p>
                            <h4 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#e11d48' }}>₹{totalDebit.toLocaleString('en-IN')}</h4>
                        </div>
                        <div style={{ backgroundColor: '#fff1f2', color: '#f43f5e', padding: '12px', borderRadius: '12px' }}>
                            <TrendingDown size={24} />
                        </div>
                    </div>
                    <div style={{ marginTop: '14px', fontSize: '0.75rem', color: '#64748b' }}>
                        Total site materials, logistics, & labor costs.
                    </div>
                </div>
            </div>

            {/* Main Tabs and Table Section */}
            <div className="premium-card" style={{ border: '1px solid #e2e8f0', padding: '0px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', gap: '8px', backgroundColor: '#e2e8f0', padding: '4px', borderRadius: '10px' }}>
                        <button
                            className="tab-btn"
                            onClick={() => setHistoryTab('received')}
                            style={{
                                backgroundColor: historyTab === 'received' ? 'white' : 'transparent',
                                color: historyTab === 'received' ? '#059669' : '#475569',
                                boxShadow: historyTab === 'received' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                            }}
                        >
                            Total Received payments
                        </button>
                        <button
                            className="tab-btn"
                            onClick={() => setHistoryTab('spent')}
                            style={{
                                backgroundColor: historyTab === 'spent' ? 'white' : 'transparent',
                                color: historyTab === 'spent' ? '#e11d48' : '#475569',
                                boxShadow: historyTab === 'spent' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                            }}
                        >
                            Total Spend in Project
                        </button>
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                                <th style={{ padding: '16px 24px', color: '#475569', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase' }}>Transaction Description</th>
                                <th style={{ padding: '16px 24px', color: '#475569', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase' }}>Project</th>
                                <th style={{ padding: '16px 24px', color: '#475569', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase' }}>Transaction Date</th>
                                <th style={{ padding: '16px 24px', color: '#475569', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase' }}>Category</th>
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
                            ) : filteredTransactions.filter(t => historyTab === 'received' ? t.type === 'credit' : t.type === 'debit').length === 0 ? (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', padding: '50px', color: '#64748b' }}>
                                        No statement transactions found for this month.
                                    </td>
                                </tr>
                            ) : filteredTransactions.filter(t => historyTab === 'received' ? t.type === 'credit' : t.type === 'debit').map((t, idx) => (
                                <tr key={`${t.transaction_id}-${idx}`} className="table-row">
                                    <td style={{ padding: '16px 24px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{
                                                backgroundColor: t.type === 'credit' ? '#d1fae5' : '#fee2e2',
                                                color: t.type === 'credit' ? '#065f46' : '#991b1b',
                                                padding: '8px',
                                                borderRadius: '8px'
                                            }}>
                                                {t.type === 'credit' ? <ArrowUpRight size={18} /> : <ArrowDownLeft size={18} />}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.95rem' }}>{t.description || (t.type === 'credit' ? 'Client Payment' : 'Site Expense')}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>ID: TXN-{t.transaction_id}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '16px 24px', fontWeight: 500, color: '#334155' }}>{t.project_name || 'General Company Income'}</td>
                                    <td style={{ padding: '16px 24px', fontSize: '0.9rem', color: '#64748b' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Calendar size={14} />
                                            {new Date(t.transaction_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </div>
                                    </td>
                                    <td style={{ padding: '16px 24px' }}>
                                        <span style={{ fontSize: '0.8rem', fontWeight: 600, padding: '4px 10px', borderRadius: '20px', backgroundColor: '#f1f5f9', color: '#475569', textTransform: 'capitalize' }}>
                                            {t.category.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td style={{ padding: '16px 24px', fontWeight: 700, textAlign: 'right', color: t.type === 'credit' ? '#059669' : '#e11d48', fontSize: '1rem' }}>
                                        {t.type === 'credit' ? '+' : '-'} ₹{parseFloat(t.amount).toLocaleString('en-IN')}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Per-Project Financial Breakdown */}
            <div className="premium-card" style={{ marginTop: '40px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>Project-wise Cash Flow</h3>
                <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '20px' }}>Summary of incoming and outgoing cash flows for individual active projects.</p>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid #cbd5e1', backgroundColor: '#f8fafc' }}>
                                <th style={{ padding: '16px 24px', color: '#475569', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase' }}>Project Name</th>
                                <th style={{ padding: '16px 24px', color: '#475569', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', textAlign: 'right' }}>Cash In (Credit)</th>
                                <th style={{ padding: '16px 24px', color: '#475569', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', textAlign: 'right' }}>Cash Out (Debit)</th>
                                <th style={{ padding: '16px 24px', color: '#475569', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', textAlign: 'right' }}>Net Margin</th>
                            </tr>
                        </thead>
                        <tbody>
                            {projectFinancials.length === 0 ? (
                                <tr>
                                    <td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                                        No active project cash flows recorded for this statement period.
                                    </td>
                                </tr>
                            ) : projectFinancials.map((p, idx) => (
                                <tr key={idx} className="table-row">
                                    <td style={{ padding: '16px 24px', fontWeight: 600, color: '#0f172a' }}>{p.project_name}</td>
                                    <td style={{ padding: '16px 24px', fontWeight: 700, textAlign: 'right', color: '#059669' }}>+₹{p.cashIn.toLocaleString('en-IN')}</td>
                                    <td style={{ padding: '16px 24px', fontWeight: 700, textAlign: 'right', color: '#e11d48' }}>-₹{p.cashOut.toLocaleString('en-IN')}</td>
                                    <td style={{ padding: '16px 24px', fontWeight: 800, textAlign: 'right', color: p.remaining >= 0 ? '#0f172a' : '#e11d48' }}>
                                        ₹{p.remaining.toLocaleString('en-IN')}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="premium-card" style={{ width: '100%', maxWidth: '550px', padding: '0', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
                        <div style={{ padding: '24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Record Transaction</h3>
                            <button onClick={() => setShowModal(false)} style={{ color: '#64748b', cursor: 'pointer', border: 'none', background: 'none', fontSize: '1.8rem', fontWeight: 400, padding: '0 8px', lineHeight: 1 }}>&times;</button>
                        </div>

                        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', padding: '4px', backgroundColor: '#f1f5f9', borderRadius: '12px' }}>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, type: 'credit', category: 'advance' })}
                                    style={{
                                        flex: 1,
                                        padding: '12px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        fontSize: '0.9rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        backgroundColor: formData.type === 'credit' ? '#059669' : 'transparent',
                                        color: formData.type === 'credit' ? 'white' : '#475569',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    Payment Received (Income)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, type: 'debit', category: 'Labor' })}
                                    style={{
                                        flex: 1,
                                        padding: '12px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        fontSize: '0.9rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        backgroundColor: formData.type === 'debit' ? '#e11d48' : 'transparent',
                                        color: formData.type === 'debit' ? 'white' : '#475569',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    Site Expense (Outcome)
                                </button>
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Project Scope</label>
                                <select required value={formData.project_id} onChange={(e) => setFormData({ ...formData, project_id: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.95rem', fontWeight: 500, color: '#0f172a' }}>
                                    <option value="">Specific Project (Optional)</option>
                                    {projects.map(p => <option key={p.project_id} value={p.project_id}>{p.project_name}</option>)}
                                </select>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Amount (₹)</label>
                                    <input type="number" required value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} className="input-field" placeholder="e.g. 50000" />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Category</label>
                                    <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.95rem', fontWeight: 500, color: '#0f172a' }}>
                                        {formData.type === 'credit' ? (
                                            <>
                                                <option value="advance">Advance Payment</option>
                                                <option value="mid_payment">Mid Payment</option>
                                                <option value="final_payment">Final Payment</option>
                                                <option value="additional_works">Additional Works</option>
                                            </>
                                        ) : (
                                            <>
                                                <option value="Labor">Labor Payment</option>
                                                <option value="Material">Material Purchase</option>
                                                <option value="Transport">Transportation</option>
                                                <option value="Site Costs">Site Maintenance</option>
                                                <option value="Equipment">Equipment Rental</option>
                                                <option value="Other">Other Expense</option>
                                            </>
                                        )}
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Transaction Date</label>
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
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Notes & References</label>
                                <textarea rows={2} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="input-field" placeholder="Enter cheque number, bank ref or custom notes..." />
                            </div>

                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                <button type="button" onClick={() => setShowModal(false)} style={{ padding: '12px 24px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: 'white', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>Cancel</button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        backgroundColor: formData.type === 'credit' ? '#059669' : '#e11d48',
                                        border: 'none',
                                        color: 'white',
                                        padding: '12px 24px',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontWeight: 700
                                    }}
                                >
                                    {submitting && <Loader2 className="animate-spin" size={16} />}
                                    Save {formData.type === 'credit' ? 'Income' : 'Expense'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
