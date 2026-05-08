import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useAuth } from '../hooks/useAuth';
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    Plus,
    Filter,
    Loader2,
    ArrowUpRight,
    ArrowDownLeft,
    FileText
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
}

export const Finance: React.FC = () => {
    const { user } = useAuth();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);

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
            console.error('Failed to fetch data');
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
                setFormData({ ...formData, amount: '', description: '' });
                fetchData();
            }
        } catch (err) {
            alert('Error recording transaction');
        } finally {
            setSubmitting(false);
        }
    };

    const totalCredit = transactions
        .filter(t => t.type === 'credit')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const totalDebit = transactions
        .filter(t => t.type === 'debit')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const totalProjectValue = projects.reduce((sum, p: any) => sum + parseFloat(p.total_budget || 0), 0);

    return (
        <div className="finance-page">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#253b50' }}>Finance & Accounts</h2>
                    <p style={{ color: '#6b7280' }}>Manage project budgets, advances and site expenses</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    <Plus size={18} />
                    Record Transaction
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '30px' }}>
                <div className="premium-card" style={{ borderLeft: '6px solid #6366f1' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '4px' }}>Total Projects Value</p>
                            <h4 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#6366f1' }}>₹{totalProjectValue.toLocaleString()}</h4>
                        </div>
                        <div style={{ backgroundColor: '#e0e7ff', color: '#6366f1', padding: '10px', borderRadius: '12px' }}>
                            <FileText size={24} />
                        </div>
                    </div>
                </div>
                <div className="premium-card" style={{ borderLeft: '6px solid #10b981' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '4px' }}>Cash In (Advances)</p>
                            <h4 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#10b981' }}>₹{totalCredit.toLocaleString()}</h4>
                        </div>
                        <div style={{ backgroundColor: '#d1fae5', color: '#10b981', padding: '10px', borderRadius: '12px' }}>
                            <TrendingUp size={24} />
                        </div>
                    </div>
                </div>
                <div className="premium-card" style={{ borderLeft: '6px solid #ef4444' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '4px' }}>Cash Out (Expenses)</p>
                            <h4 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#ef4444' }}>₹{totalDebit.toLocaleString()}</h4>
                        </div>
                        <div style={{ backgroundColor: '#fee2e2', color: '#ef4444', padding: '10px', borderRadius: '12px' }}>
                            <TrendingDown size={24} />
                        </div>
                    </div>
                </div>
                <div className="premium-card" style={{ borderLeft: '6px solid #253b50' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '4px' }}>Net Balance</p>
                            <h4 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#1f2937' }}>₹{(totalCredit - totalDebit).toLocaleString()}</h4>
                        </div>
                        <div style={{ backgroundColor: '#f3f4f6', color: '#1f2937', padding: '10px', borderRadius: '12px' }}>
                            <DollarSign size={24} />
                        </div>
                    </div>
                </div>
            </div>

            <div className="premium-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '1.3rem' }}>Transaction History</h3>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '0.85rem' }}>
                            <Filter size={16} /> Filter
                        </button>
                        <button style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '0.85rem' }}>
                            <FileText size={16} /> Export
                        </button>
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
                                <th style={{ padding: '16px', color: '#6b7280', fontWeight: 500 }}>Transaction</th>
                                <th style={{ padding: '16px', color: '#6b7280', fontWeight: 500 }}>Project</th>
                                <th style={{ padding: '16px', color: '#6b7280', fontWeight: 500 }}>Date</th>
                                <th style={{ padding: '16px', color: '#6b7280', fontWeight: 500 }}>Category</th>
                                <th style={{ padding: '16px', color: '#6b7280', fontWeight: 500, textAlign: 'right' }}>Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px' }}><Loader2 className="animate-spin" style={{ margin: '0 auto' }} /></td></tr>
                            ) : transactions.map((t, idx) => (
                                <tr key={`${t.transaction_id}-${idx}`} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '16px' }}>
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
                                                <div style={{ fontWeight: 600 }}>{t.description || (t.type === 'credit' ? 'Client Payment' : 'Site Expense')}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>ID: TXN-{t.transaction_id}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '16px' }}>{t.project_name || 'General'}</td>
                                    <td style={{ padding: '16px', fontSize: '0.85rem' }}>{new Date(t.transaction_date).toLocaleDateString()}</td>
                                    <td style={{ padding: '16px', fontSize: '0.85rem', textTransform: 'capitalize' }}>{t.category.replace('_', ' ')}</td>
                                    <td style={{ padding: '16px', fontWeight: 700, textAlign: 'right', color: t.type === 'credit' ? '#10b981' : '#ef4444' }}>
                                        {t.type === 'credit' ? '+' : '-'} ₹{parseFloat(t.amount).toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {showModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="premium-card" style={{ width: '100%', maxWidth: '550px', padding: '0', overflow: 'hidden' }}>
                        <div style={{ padding: '24px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ fontSize: '1.3rem', fontWeight: 700 }}>Record Transaction</h3>
                            <button onClick={() => setShowModal(false)} style={{ color: '#6b7280', cursor: 'pointer', border: 'none', background: 'none', fontSize: '1.5rem' }}>&times;</button>
                        </div>
                        
                        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', padding: '4px', backgroundColor: '#f3f4f6', borderRadius: '10px' }}>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, type: 'credit', category: 'advance' })}
                                    style={{
                                        flex: 1,
                                        padding: '10px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        fontSize: '0.9rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        backgroundColor: formData.type === 'credit' ? '#10b981' : 'transparent',
                                        color: formData.type === 'credit' ? 'white' : '#4b5563',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    Client Payment (Income)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, type: 'debit', category: 'Labor' })}
                                    style={{
                                        flex: 1,
                                        padding: '10px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        fontSize: '0.9rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        backgroundColor: formData.type === 'debit' ? '#ef4444' : 'transparent',
                                        color: formData.type === 'debit' ? 'white' : '#4b5563',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    Site Expense (Outcome)
                                </button>
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Project</label>
                                <select required value={formData.project_id} onChange={(e) => setFormData({ ...formData, project_id: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db' }}>
                                    <option value="">Specific Project (Optional)</option>
                                    {projects.map(p => <option key={p.project_id} value={p.project_id}>{p.project_name}</option>)}
                                </select>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Amount (₹)</label>
                                    <input type="number" required value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db' }} placeholder="0.00" />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Category</label>
                                    <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db' }}>
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
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Transaction Date</label>
                                    <input type="date" required value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Payment Mode</label>
                                    <select value={formData.payment_mode} onChange={(e) => setFormData({ ...formData, payment_mode: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db' }}>
                                        <option value="UPI">UPI</option>
                                        <option value="Cash">Cash</option>
                                        <option value="Bank Transfer">Bank Transfer</option>
                                        <option value="Cheque">Cheque</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Description / Notes</label>
                                <textarea rows={2} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db' }} placeholder="Add any details here..." />
                            </div>

                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                <button type="button" onClick={() => setShowModal(false)} style={{ padding: '12px 24px', borderRadius: '8px', border: '1px solid #d1d5db', backgroundColor: 'white', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
                                <button 
                                    type="submit" 
                                    disabled={submitting} 
                                    className="btn-primary" 
                                    style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: '8px',
                                        backgroundColor: formData.type === 'credit' ? '#10b981' : '#ef4444',
                                        border: 'none',
                                        color: 'white',
                                        padding: '12px 24px',
                                        borderRadius: '8px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {submitting && <Loader2 className="animate-spin" size={16} />}
                                    Record {formData.type === 'credit' ? 'Income' : 'Expense'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
