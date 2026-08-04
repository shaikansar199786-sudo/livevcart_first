import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { Plus, Trash2, Save, Printer, ChevronLeft, ChevronRight, Loader2, TrendingUp, TrendingDown, DollarSign, Wallet } from 'lucide-react';

interface IncomeRow {
    id?: number;
    category: 'elegance' | 'Livincart' | 'new_projects' | 'major_expenditures';
    description: string;
    amount: string | number;
    date: string;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

const CATEGORIES = [
    { id: 'elegance', label: 'Elegance', color: '#63b3ed' },
    { id: 'Livincart', label: 'Livincart', color: '#68d391' },
    { id: 'new_projects', label: 'New Projects', color: '#a0aec0' },
    { id: 'major_expenditures', label: 'Major Expenditures', color: '#f6ad55' }
];

const FIXED_EXPENDITURE_CATEGORIES = [
    'Salaries',
    'Office rent',
    'Office expenses',
    'Project expenses',
    'Tax Payments',
    'Personal expenses'
];

export const MonthlyIncome: React.FC = () => {
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [monthIdx, setMonthIdx] = useState(now.getMonth());
    const [rows, setRows] = useState<IncomeRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [projects, setProjects] = useState<any[]>([]);
    const [selectedProject, setSelectedProject] = useState<any>(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);

    const month = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
    const displayMonth = `${MONTHS[monthIdx].substring(0, 3)}-${String(year).substring(2)}`;

    const fetchIncome = useCallback(async (specificMonth?: string) => {
        setLoading(true);
        try {
            const monthToFetch = specificMonth || month;
            const res = await axios.get(`${API_BASE_URL}/monthly-income?month=${monthToFetch}`);
            let fetchedRows: IncomeRow[] = [];
            if (res.data?.data?.length > 0) {
                fetchedRows = res.data.data.map((row: any) => ({
                    ...row,
                    amount: row.amount ? Math.round(Number(row.amount)).toString() : '',
                    date: row.transaction_date || row.date || new Date().toISOString().split('T')[0]
                }));
            }

            // Ensure fixed expenditure categories are always present
            const expenditureRows = fetchedRows.filter(r => r.category === 'major_expenditures');
            const fixedDescriptions = FIXED_EXPENDITURE_CATEGORIES;

            // Add missing fixed categories
            fixedDescriptions.forEach(desc => {
                const exists = expenditureRows.some(r => r.description === desc);
                if (!exists) {
                    fetchedRows.push({
                        category: 'major_expenditures',
                        description: desc,
                        amount: '',
                        date: new Date().toISOString().split('T')[0]
                    });
                }
            });

            // Remove any non-fixed expenditure rows (optional - keeping only fixed categories)
            // Uncomment the next line if you want ONLY fixed categories
            // fetchedRows = fetchedRows.filter(r => r.category !== 'major_expenditures' || fixedDescriptions.includes(r.description));

            setRows(fetchedRows);
        } catch {
            // On error, initialize with fixed categories
            const initialRows: IncomeRow[] = FIXED_EXPENDITURE_CATEGORIES.map(desc => ({
                category: 'major_expenditures',
                description: desc,
                amount: '',
                date: new Date().toISOString().split('T')[0]
            }));
            setRows(initialRows);
        } finally {
            setLoading(false);
        }
    }, [month]);

    useEffect(() => { fetchIncome(); }, [fetchIncome]);

    const fetchProjects = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/projects`);
            if (response.data.success) {
                setProjects(response.data.data);
            }
        } catch (error) {
            console.error('Failed to fetch projects:', error);
        }
    };

    const calculateInteriorProjectExpenses = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/projects`);
            if (response.data.success) {
                const interiorProjects = response.data.data.filter(
                    (p: any) => p.project_type === 'interior' || p.project_type === 'interior_execution'
                );

                let totalSpent = 0;
                for (const project of interiorProjects) {
                    try {
                        const financeResponse = await axios.get(`${API_BASE_URL}/finance/${project.project_id}`);
                        if (financeResponse.data.success) {
                            const transactions = financeResponse.data.data;
                            const projectSpent = transactions
                                .filter((t: any) => t.type === 'debit')
                                .reduce((sum: number, t: any) => sum + parseFloat(t.amount || 0), 0);
                            totalSpent += projectSpent;
                        }
                    } catch (error) {
                        console.error(`Failed to fetch finance for project ${project.project_id}:`, error);
                    }
                }

                // Update the Project expenses row in major_expenditures
                setRows(prev => {
                    const updated = [...prev];
                    const projectExpensesIdx = updated.findIndex(
                        r => r.category === 'major_expenditures' && r.description === 'Project expenses'
                    );
                    if (projectExpensesIdx >= 0) {
                        updated[projectExpensesIdx] = {
                            ...updated[projectExpensesIdx],
                            amount: Math.round(totalSpent).toString()
                        };
                    }
                    return updated;
                });
            }
        } catch (error) {
            console.error('Failed to calculate interior project expenses:', error);
        }
    };

    useEffect(() => { fetchProjects(); }, []);
    useEffect(() => { calculateInteriorProjectExpenses(); }, []);

    const addRow = (category: IncomeRow['category']) => {
        setRows(prev => [...prev, { category, description: '', amount: '', date: new Date().toISOString().split('T')[0] }]);
    };

    const updateRow = (idx: number, field: keyof IncomeRow, value: any) => {
        setRows(prev => {
            const next = [...prev];
            next[idx] = { ...next[idx], [field]: value };
            return next;
        });
        setSaved(false);
    };

    const deleteRow = (idx: number) => {
        const row = rows[idx];
        // Prevent deletion of fixed expenditure categories
        if (row.category === 'major_expenditures' && FIXED_EXPENDITURE_CATEGORIES.includes(row.description)) {
            return; // Don't delete fixed categories
        }
        setRows(prev => prev.filter((_, i) => i !== idx));
        setSaved(false);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const cleanRows = rows.filter(r => r.description || r.amount);
            const response = await axios.post(`${API_BASE_URL}/monthly-income`, { month, rows: cleanRows });
            if (response.data.success) {
                setSaved(true);
                setTimeout(() => setSaved(false), 3000);
            } else {
                alert('Failed to save: ' + (response.data.message || 'Unknown error'));
            }
        } catch (error: any) {
            console.error('Save error:', error);
            const errorMessage = error.response?.data?.message || error.message || 'Failed to save. Please try again.';
            alert('Failed to save: ' + errorMessage);
        } finally {
            setSaving(false);
        }
    };

    const handleRecordPayment = async () => {
        if (!selectedProject || !paymentAmount) {
            alert('Please select a project and enter a valid amount.');
            return;
        }

        // Remove commas from amount and parse
        const cleanAmount = paymentAmount.replace(/,/g, '');
        const numericAmount = parseFloat(cleanAmount);

        if (isNaN(numericAmount) || numericAmount <= 0) {
            alert('Please enter a valid amount.');
            return;
        }

        // Debug logging
        console.log('Project type:', selectedProject.project_type);
        console.log('Project name:', selectedProject.project_name);

        const category = (selectedProject.project_type === 'interior' || selectedProject.project_type === 'interior_execution')
            ? 'elegance'
            : 'Livincart';

        console.log('Selected category:', category);

        const newRow: IncomeRow = {
            category,
            description: `${selectedProject.project_name} - ${selectedProject.project_code}`,
            amount: numericAmount.toString(),
            date: paymentDate
        };

        console.log('New row:', newRow);

        // Derive month from payment date
        const paymentDateObj = new Date(paymentDate);
        const paymentMonth = `${paymentDateObj.getFullYear()}-${String(paymentDateObj.getMonth() + 1).padStart(2, '0')}`;

        console.log('Payment date:', paymentDate);
        console.log('Derived month from payment date:', paymentMonth);
        console.log('Current UI selected month:', month);

        // Alert if payment month differs from UI month
        if (paymentMonth !== month) {
            alert(`Payment date is in ${paymentMonth} but you're viewing ${month}. The payment will be saved to ${month}. Please navigate to ${paymentMonth} to view it.`);
        }

        // Save to the currently selected UI month
        const cleanRows = [...rows, newRow].filter(r => r.description || r.amount);

        console.log('Saving to month:', month);
        console.log('Rows being saved:', cleanRows);

        // Automatically save the payment to the backend
        setSaving(true);
        try {
            const response = await axios.post(`${API_BASE_URL}/monthly-income`, { month, rows: cleanRows });
            console.log('Save response:', response.data);
            if (response.data.success) {
                // Refresh data from backend
                await fetchIncome();
                setSaved(true);
                setTimeout(() => setSaved(false), 3000);
            } else {
                alert('Failed to save payment: ' + (response.data.message || 'Unknown error'));
            }
        } catch (error: any) {
            console.error('Save error:', error);
            const errorMessage = error.response?.data?.message || error.message || 'Failed to save payment. Please try again.';
            alert('Failed to save payment: ' + errorMessage);
        } finally {
            setSaving(false);
        }

        setShowPaymentModal(false);
        setSelectedProject(null);
        setPaymentAmount('');
        setPaymentDate(new Date().toISOString().split('T')[0]);
    };

    const prevMonth = () => {
        if (monthIdx === 0) { setMonthIdx(11); setYear(y => y - 1); }
        else setMonthIdx(m => m - 1);
    };

    const nextMonth = () => {
        if (monthIdx === 11) { setMonthIdx(0); setYear(y => y + 1); }
        else setMonthIdx(m => m + 1);
    };

    const getCategoryRows = (category: IncomeRow['category']) => rows.filter(r => r.category === category);
    const getCategoryTotal = (category: IncomeRow['category']) =>
        getCategoryRows(category).reduce((sum, r) => sum + (parseFloat(String(r.amount)) || 0), 0);

    const totalElegance = getCategoryTotal('elegance');
    const totalLivincart = getCategoryTotal('Livincart');
    const totalNewProjects = getCategoryTotal('new_projects');
    const totalExpenditures = getCategoryTotal('major_expenditures');

    const grandTotal = totalElegance + totalLivincart + totalNewProjects;
    const netBalance = grandTotal - totalExpenditures;

    return (
        <div className="monthly-income-page print-area" style={{ paddingBottom: '40px' }}>
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#253b50' }}>Monthly Income Section</h2>
                    <p style={{ color: '#6b7280' }}>Track income across departments and monitor expenditures.</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={() => setShowPaymentModal(true)} className="btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#fca311' }}>
                        <DollarSign size={18} /> Record Payment
                    </button>
                    <button onClick={handleSave} disabled={saving} className="btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: saved ? '#10b981' : '#253b50' }}>
                        {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                        {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
                    </button>
                    <button onClick={() => window.print()} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#f3f4f6', border: '1px solid #d1d5db' }}>
                        <Printer size={18} /> Print Report
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '30px', justifyContent: 'center' }} className="no-print">
                <button onClick={prevMonth} style={{ padding: '10px', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', cursor: 'pointer' }}>
                    <ChevronLeft size={24} />
                </button>
                <div style={{ backgroundColor: '#fff', padding: '10px 24px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <select value={monthIdx} onChange={e => setMonthIdx(Number(e.target.value))} style={{ border: 'none', fontWeight: 700, fontSize: '1.1rem', cursor: 'pointer', outline: 'none' }}>
                        {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                    </select>
                    <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ border: 'none', fontWeight: 700, fontSize: '1.1rem', cursor: 'pointer', outline: 'none' }}>
                        {Array.from({ length: 10 }, (_, i) => now.getFullYear() - 5 + i).map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
                <button onClick={nextMonth} style={{ padding: '10px', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', cursor: 'pointer' }}>
                    <ChevronRight size={24} />
                </button>
            </div>

            {/* Print Header */}
            <div className="print-only" style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '2px solid #253b50', paddingBottom: '10px' }}>
                <h1 style={{ fontSize: '24px', margin: 0 }}>Livincart ARCHITECTS & INTERIORS</h1>
                <h2 style={{ fontSize: '18px', margin: '5px 0', color: '#4b5563' }}>Monthly Financial Statement - {displayMonth}</h2>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }} className="no-print">
                <div className="premium-card" style={{ borderLeft: '6px solid #6366f1' }}>
                    <p style={{ color: '#6b7280', fontSize: '0.85rem' }}>Total Gross Income</p>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 800 }}>₹{grandTotal.toLocaleString()}</h3>
                    <TrendingUp size={20} style={{ color: '#10b981', marginTop: '5px' }} />
                </div>
                <div className="premium-card" style={{ borderLeft: '6px solid #ef4444' }}>
                    <p style={{ color: '#6b7280', fontSize: '0.85rem' }}>Total Expenditures</p>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 800 }}>₹{totalExpenditures.toLocaleString()}</h3>
                    <TrendingDown size={20} style={{ color: '#ef4444', marginTop: '5px' }} />
                </div>
                <div className="premium-card" style={{ borderLeft: '6px solid #10b981' }}>
                    <p style={{ color: '#6b7280', fontSize: '0.85rem' }}>Net Balance</p>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 800 }}>₹{netBalance.toLocaleString()}</h3>
                    <Wallet size={20} style={{ color: '#6366f1', marginTop: '5px' }} />
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="income-grid">
                {CATEGORIES.map(cat => (
                    <div key={cat.id} className="income-column-card" style={{
                        backgroundColor: 'white',
                        borderRadius: '16px',
                        border: '1px solid #e5e7eb',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            backgroundColor: cat.color,
                            color: 'white',
                            padding: '12px 20px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontWeight: 800,
                            letterSpacing: '0.5px'
                        }}>
                            <span>{cat.label.toUpperCase()}</span>
                            <span style={{ fontSize: '1.1rem' }}>₹{getCategoryTotal(cat.id as any).toLocaleString()}</span>
                        </div>

                        <div style={{ padding: '15px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <tbody>
                                    {getCategoryRows(cat.id as any).map((row) => {
                                        const globalIdx = rows.indexOf(row);
                                        const isFixedCategory = cat.id === 'major_expenditures' && FIXED_EXPENDITURE_CATEGORIES.includes(row.description);
                                        const isMajorExpenditures = cat.id === 'major_expenditures';
                                        const inputHeight = isMajorExpenditures ? '15px' : '20px';
                                        const fontSize = '0.9rem';
                                        return (
                                            <tr key={globalIdx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                                <td style={{ padding: '8px 0' }}>
                                                    <input
                                                        value={row.description}
                                                        onChange={e => updateRow(globalIdx, 'description', e.target.value)}
                                                        placeholder="Description..."
                                                        disabled={isFixedCategory}
                                                        style={{
                                                            width: '100%',
                                                            border: 'none',
                                                            outline: 'none',
                                                            fontSize: fontSize,
                                                            color: isFixedCategory ? '#6b7280' : '#1f2937',
                                                            backgroundColor: isFixedCategory ? '#f9fafb' : 'transparent',
                                                            fontWeight: isFixedCategory ? 600 : 400,
                                                            height: inputHeight,
                                                            padding: '0 10px',
                                                            cursor: isFixedCategory ? 'not-allowed' : 'text'
                                                        }}
                                                    />
                                                </td>
                                                <td style={{ padding: '8px 0', width: '150px' }}>
                                                    <input
                                                        type="date"
                                                        value={row.date}
                                                        onChange={e => updateRow(globalIdx, 'date', e.target.value)}
                                                        style={{ width: '100%', border: 'none', outline: 'none', fontSize: '0.85rem', color: '#1f2937', height: inputHeight, padding: '0 10px' }}
                                                    />
                                                </td>
                                                <td style={{ padding: '8px 0', width: '200px' }}>
                                                    <input
                                                        type="text"
                                                        step="1"
                                                        min="0"
                                                        value={row.amount ? Number(row.amount).toLocaleString() : ''}
                                                        onChange={e => {
                                                            const value = e.target.value.replace(/,/g, '');
                                                            // Allow only whole numbers (no decimals)
                                                            if (value === '' || /^\d+$/.test(value)) {
                                                                updateRow(globalIdx, 'amount', value);
                                                            }
                                                        }}
                                                        placeholder="0"
                                                        style={{ width: '100%', border: 'none', outline: 'none', fontSize: fontSize, color: '#1f2937', fontWeight: 700, textAlign: 'right', height: inputHeight, padding: '0 10px' }}
                                                    />
                                                </td>
                                                <td style={{ padding: '8px 0', width: '30px', textAlign: 'right' }} className="no-print">
                                                    {!isFixedCategory && (
                                                        <button onClick={() => deleteRow(globalIdx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', opacity: 0.6 }}>
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            <button
                                onClick={() => addRow(cat.id as any)}
                                className="no-print"
                                style={{
                                    width: '100%',
                                    marginTop: '15px',
                                    padding: '8px',
                                    border: '1px dashed #d1d5db',
                                    borderRadius: '8px',
                                    background: '#f9fafb',
                                    color: '#6b7280',
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px'
                                }}
                            >
                                <Plus size={14} /> Add Entry
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Print Footer Summary */}
            <div className="print-only" style={{ marginTop: '40px', borderTop: '2px solid #253b50', paddingTop: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '40px' }}>
                    <div style={{ textAlign: 'right' }}>
                        <p style={{ margin: '5px 0', color: '#6b7280' }}>Total Gross Income:</p>
                        <p style={{ margin: '5px 0', color: '#6b7280' }}>Total Expenditures:</p>
                        <h3 style={{ margin: '10px 0', fontSize: '20px' }}>Net Monthly Balance:</h3>
                    </div>
                    <div style={{ textAlign: 'right', minWidth: '150px' }}>
                        <p style={{ margin: '5px 0', fontWeight: 600 }}>₹{grandTotal.toLocaleString()}</p>
                        <p style={{ margin: '5px 0', fontWeight: 600 }}>₹{totalExpenditures.toLocaleString()}</p>
                        <h3 style={{ margin: '10px 0', fontSize: '20px', color: '#1e40af' }}>₹{netBalance.toLocaleString()}</h3>
                    </div>
                </div>
                <div style={{ marginTop: '60px', display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ borderTop: '1px solid #000', width: '200px', textAlign: 'center', paddingTop: '5px' }}>Accountant Signature</div>
                    <div style={{ borderTop: '1px solid #000', width: '200px', textAlign: 'center', paddingTop: '5px' }}>Principal Architect</div>
                </div>
            </div>

            {/* Payment Modal */}
            {
                showPaymentModal && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                        <div className="premium-card" style={{ width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', padding: '30px' }}>
                            <h3 style={{ marginBottom: '24px', fontSize: '1.4rem' }}>Record Project Payment</h3>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Select Project</label>
                                <select
                                    value={selectedProject?.project_id || ''}
                                    onChange={(e) => {
                                        const project = projects.find(p => p.project_id === e.target.value);
                                        setSelectedProject(project || null);
                                    }}
                                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                                >
                                    <option value="">Select a project</option>
                                    {projects.map(project => (
                                        <option key={project.project_id} value={project.project_id}>
                                            {project.project_name} ({project.project_code}) - {project.project_type}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Payment Date</label>
                                <input
                                    type="date"
                                    value={paymentDate}
                                    onChange={(e) => setPaymentDate(e.target.value)}
                                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                                />
                            </div>
                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Amount (₹)</label>
                                <input
                                    type="number"
                                    value={paymentAmount}
                                    onChange={(e) => setPaymentAmount(e.target.value)}
                                    placeholder="Enter amount"
                                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                                />
                            </div>
                            {selectedProject && (
                                <div style={{ marginBottom: '20px', padding: '12px', backgroundColor: '#f3f4f6', borderRadius: '6px', fontSize: '0.85rem' }}>
                                    <strong>Will be added to:</strong> {(selectedProject.project_type === 'interior' || selectedProject.project_type === 'interior_execution') ? 'ELEGANCE' : 'Livincart'}
                                </div>
                            )}
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowPaymentModal(false);
                                        setSelectedProject(null);
                                        setPaymentAmount('');
                                        setPaymentDate(new Date().toISOString().split('T')[0]);
                                    }}
                                    style={{ padding: '10px 20px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: 'white', cursor: 'pointer' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleRecordPayment}
                                    style={{ padding: '10px 20px', borderRadius: '6px', border: 'none', backgroundColor: '#6366f1', color: 'white', cursor: 'pointer', fontWeight: 600 }}
                                >
                                    Record Payment
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    .print-only { display: block !important; }
                    body { background: white !important; padding: 0 !important; }
                    .main-content { margin: 0 !important; padding: 0 !important; }
                    .income-column-card { box-shadow: none !important; border: 1px solid #eee !important; }
                }
                .print-only { display: none; }
                .income-column-card input::placeholder { color: #d1d5db; }
                .income-column-card input:focus { background-color: #f3f4f6; border-radius: 4px; }
                .income-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
                    gap: 24px;
                }
                @media (max-width: 768px) {
                    .income-grid {
                        grid-template-columns: 1fr;
                    }
                    .income-column-card input {
                        font-size: 1.2rem !important;
                        height: 60px !important;
                    }
                }
            `}</style>
        </div >
    );
};

export default MonthlyIncome;
