import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useAuth } from '../hooks/useAuth';
import { Loader2, DollarSign, Wallet, TrendingUp, ArrowDownRight, ArrowUpRight, Search, Calendar, ChevronDown, Building2, Calculator, Receipt, PieChart, CheckCircle2, Minus, Equal, RotateCcw, X, IndianRupee, Clock } from 'lucide-react';

interface ProjectFinance {
    project_id: string;
    client_id?: string;
    project_name: string;
    total_budget: number;
    advance_paid: number;
    total_spent: number;
    profit: number;
    created_at?: string;
    start_date?: string;
    expected_end_date?: string;
    project_type?: string;
    status?: string;
}

export const FinancialOverview: React.FC = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<ProjectFinance[]>([]);
    const [overheads, setOverheads] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState<'all' | 'last_month' | 'last_3_months' | 'last_6_months' | 'this_year' | 'custom'>('all');
    const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [projectTypeFilter, setProjectTypeFilter] = useState<string>('all');
    const [showPortfolioModal, setShowPortfolioModal] = useState(false);
    const [showAdvanceModal, setShowAdvanceModal] = useState(false);

    const resetFilters = () => {
        setSearchTerm('');
        setDateFilter('all');
        setSelectedYear(new Date().getFullYear());
        setCustomStartDate('');
        setCustomEndDate('');
        setProjectTypeFilter('all');
    };

    useEffect(() => {
        fetchFinancialOverview();
    }, []);

    const fetchFinancialOverview = async () => {
        try {
            setLoading(true);
            const [projRes, finRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/projects/financial-overview`),
                axios.get(`${API_BASE_URL}/finance`)
            ]);
            if (projRes.data.success) {
                setData(projRes.data.data);
            }
            setOverheads(finRes.data.data || []);
        } catch (error) {
            console.error('Failed to fetch financial overview:', error);
        } finally {
            setLoading(false);
        }
    };

    const getDateRange = () => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        switch (dateFilter) {
            case 'last_month':
                const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
                return { start: lastMonthStart, end: lastMonthEnd };
            case 'last_3_months':
                const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
                return { start: threeMonthsAgo, end: today };
            case 'last_6_months':
                const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
                return { start: sixMonthsAgo, end: today };
            case 'this_year':
                const yearStart = new Date(selectedYear, 0, 1);
                const yearEnd = new Date(selectedYear, 11, 31, 23, 59, 59);
                return { start: yearStart, end: yearEnd };
            case 'custom':
                if (customStartDate && customEndDate) {
                    return { start: new Date(customStartDate), end: new Date(customEndDate) };
                }
                return null;
            default:
                return null;
        }
    };

    const filteredData = data.filter(p => {
        const statusStr = (p.status || '').toLowerCase().trim();
        const isExcludedStatus = ['quotation', 'draft quotation', 'draft', 'lost', 'withdrawn', 'dropped', 'cancelled'].includes(statusStr);
        if (isExcludedStatus) return false;

        const matchesSearch = (p.project_name || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesProjectType = projectTypeFilter === 'all' || (p.project_type || '').toLowerCase() === projectTypeFilter.toLowerCase();
        
        if (dateFilter === 'all') return matchesSearch && matchesProjectType;
        
        const dateRange = getDateRange();
        if (!dateRange) return matchesSearch && matchesProjectType;
        
        // Try multiple date fields that might be available
        const projectDate = p.created_at ? new Date(p.created_at) : 
                           p.start_date ? new Date(p.start_date) :
                           p.expected_end_date ? new Date(p.expected_end_date) : null;
        
        if (projectDate && !isNaN(projectDate.getTime())) {
            return matchesSearch && matchesProjectType && projectDate >= dateRange.start && projectDate <= dateRange.end;
        }
        
        return matchesSearch && matchesProjectType;
    });

    // Overheads filtering
    const overheadCategories = ['Salary', 'Rent', 'Utilities', 'Office Supplies', 'General Overhead', 'Staff Expense', 'Staff Reimbursement', 'Reimbursement', 'Food', 'Travel', 'Recharge'];
    const filteredOverheads = overheads.filter(t => {
        const isOverhead = t.type === 'debit' && (!t.project_id || overheadCategories.includes(t.category));
        if (!isOverhead) return false;
        
        if (dateFilter === 'all') return true;
        
        const dateRange = getDateRange();
        if (!dateRange) return true;
        
        const txDate = t.transaction_date ? new Date(t.transaction_date) : null;
        if (txDate && !isNaN(txDate.getTime())) {
            return txDate >= dateRange.start && txDate <= dateRange.end;
        }
        return true;
    });

    // Totals calculations
    const totalBudget = filteredData.reduce((sum, p) => sum + p.total_budget, 0);
    const totalAdvance = filteredData.reduce((sum, p) => sum + p.advance_paid, 0);
    const totalPending = totalBudget - totalAdvance;
    const totalSpent = filteredData.reduce((sum, p) => sum + p.total_spent, 0);
    const totalProfit = filteredData.reduce((sum, p) => sum + p.profit, 0);

    // Corporate Overheads Total
    const totalOverheads = filteredOverheads.reduce((sum, t) => sum + parseFloat(t.amount || '0') + (t.category === 'Salary' && t.incentive ? parseFloat(t.incentive) : 0), 0);

    // Total Net Operating Profit = Net Profit - Total Overheads
    const finalNetProfit = totalProfit - totalOverheads;

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
                <Loader2 className="animate-spin" size={48} color="#253b50" />
            </div>
        );
    }

    return (
        <div style={{ width: '100%', padding: '0 0 24px 0' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0c1527', margin: 0, letterSpacing: '-0.02em' }}>Financial Overview &amp; Company Profits</h2>
                    <p style={{ color: '#64748b', marginTop: '4px', fontSize: '0.9rem' }}>Analyze project profits, corporate overhead expenses, and company net operating profit.</p>
                </div>
            </div>

            {/* Quick Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <div 
                    onClick={() => setShowPortfolioModal(true)} 
                    className="premium-card" 
                    style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '18px', borderRadius: '14px', border: '1.5px solid #e2e8f0', backgroundColor: '#ffffff', cursor: 'pointer', transition: 'all 0.2s' }}
                    title="Click to view detailed itemized breakdown"
                >
                    <div style={{ padding: '10px', borderRadius: '10px', backgroundColor: '#e0f2fe', color: '#0284c7' }}>
                        <IndianRupee size={22} />
                    </div>
                    <div>
                        <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '2px', fontWeight: 700, textTransform: 'uppercase' }}>Total Revenue</p>
                        <h4 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>₹{totalBudget.toLocaleString('en-IN')}</h4>
                    </div>
                </div>

                <div 
                    onClick={() => setShowAdvanceModal(true)} 
                    className="premium-card" 
                    style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '18px', borderRadius: '14px', border: '1.5px solid #e2e8f0', backgroundColor: '#ffffff', cursor: 'pointer', transition: 'all 0.2s' }}
                    title="Click to view detailed itemized breakdown"
                >
                    <div style={{ padding: '10px', borderRadius: '10px', backgroundColor: '#dcfce7', color: '#16a34a' }}>
                        <ArrowUpRight size={22} />
                    </div>
                    <div>
                        <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '2px', fontWeight: 700, textTransform: 'uppercase' }}>Amount Received</p>
                        <h4 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>₹{totalAdvance.toLocaleString('en-IN')}</h4>
                    </div>
                </div>

                {/* Total Pending Amount Card */}
                <div className="premium-card" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '18px', borderRadius: '14px', border: '1.5px solid #e2e8f0', backgroundColor: '#ffffff' }}>
                    <div style={{ padding: '10px', borderRadius: '10px', backgroundColor: '#fff7ed', color: '#ea580c' }}>
                        <Clock size={22} />
                    </div>
                    <div>
                        <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '2px', fontWeight: 700, textTransform: 'uppercase' }}>Total Pending Amount</p>
                        <h4 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ea580c', margin: 0 }}>₹{totalPending.toLocaleString('en-IN')}</h4>
                    </div>
                </div>

                <div className="premium-card" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '18px', borderRadius: '14px', border: '1.5px solid #e2e8f0', backgroundColor: '#ffffff' }}>
                    <div style={{ padding: '10px', borderRadius: '10px', backgroundColor: '#fee2e2', color: '#dc2626' }}>
                        <ArrowDownRight size={22} />
                    </div>
                    <div>
                        <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '2px', fontWeight: 700, textTransform: 'uppercase' }}>Project Spent</p>
                        <h4 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>₹{totalSpent.toLocaleString('en-IN')}</h4>
                    </div>
                </div>

                <div className="premium-card" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '18px', borderRadius: '14px', border: '1.5px solid #e2e8f0', backgroundColor: '#ffffff' }}>
                    <div style={{ padding: '10px', borderRadius: '10px', backgroundColor: totalProfit >= 0 ? '#ecfdf5' : '#fff1f2', color: totalProfit >= 0 ? '#059669' : '#e11d48' }}>
                        <TrendingUp size={22} />
                    </div>
                    <div>
                        <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '2px', fontWeight: 700, textTransform: 'uppercase' }}>Total Project Profit</p>
                        <h4 style={{ fontSize: '1.25rem', fontWeight: 800, color: totalProfit >= 0 ? '#059669' : '#e11d48', margin: 0 }}>₹{totalProfit.toLocaleString('en-IN')}</h4>
                    </div>
                </div>

                {/* Total Overhead Card */}
                <div className="premium-card" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '18px', borderRadius: '14px', border: '1.5px solid #e2e8f0', backgroundColor: '#ffffff' }}>
                    <div style={{ padding: '10px', borderRadius: '10px', backgroundColor: '#fee2e2', color: '#e11d48' }}>
                        <Building2 size={22} />
                    </div>
                    <div>
                        <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '2px', fontWeight: 700, textTransform: 'uppercase' }}>Total Overhead</p>
                        <h4 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#be123c', margin: 0 }}>₹{totalOverheads.toLocaleString('en-IN')}</h4>
                    </div>
                </div>

                {/* Total Profit (Net Profit - Total Overheads) Card */}
                <div className="premium-card" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '18px', borderRadius: '14px', border: '1.5px solid #ffe8c2', backgroundColor: '#fff9f0', boxShadow: '0 4px 14px rgba(252,164,18,0.15)' }}>
                    <div style={{ padding: '10px', borderRadius: '10px', backgroundColor: '#0c1527', color: '#fca412' }}>
                        <Calculator size={22} />
                    </div>
                    <div>
                        <p style={{ fontSize: '0.75rem', color: '#0c1527', marginBottom: '2px', fontWeight: 800, textTransform: 'uppercase' }}>Total Net Profit</p>
                        <h4 style={{ fontSize: '1.25rem', fontWeight: 900, color: finalNetProfit >= 0 ? '#059669' : '#e11d48', margin: 0 }}>₹{finalNetProfit.toLocaleString('en-IN')}</h4>
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: '16px 24px', borderRadius: '16px', border: '1.5px solid #ffe8c2', boxShadow: '0 4px 14px rgba(252,164,18,0.05)', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '12px', flex: '1', flexWrap: 'wrap', alignItems: 'center' }}>
                    {/* Statement Period Header */}
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0c1527', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Statement Period:</span>
                    
                    {/* Date Filter Buttons */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                        {[
                            { key: 'all', label: 'All Time' },
                            { key: 'last_month', label: 'Last Month' },
                            { key: 'last_3_months', label: 'Last 3 Months' },
                            { key: 'last_6_months', label: 'Last 6 Months' }
                        ].map(item => {
                            const isSelected = dateFilter === item.key;
                            return (
                                <button
                                    key={item.key}
                                    onClick={() => setDateFilter(item.key as any)}
                                    style={{
                                        padding: '8px 16px',
                                        borderRadius: '8px',
                                        border: '1.5px solid',
                                        borderColor: isSelected ? '#fca412' : '#ffe8c2',
                                        backgroundColor: isSelected ? '#fca412' : '#ffffff',
                                        color: isSelected ? '#ffffff' : '#0c1527',
                                        fontWeight: isSelected ? 800 : 600,
                                        fontSize: '0.85rem',
                                        outline: 'none',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        boxShadow: isSelected ? '0 4px 12px rgba(252,164,18,0.35)' : 'none'
                                    }}
                                >
                                    {item.label}
                                </button>
                            );
                        })}

                        {/* Year Selector Dropdown */}
                        <select
                            value={dateFilter === 'this_year' ? selectedYear : 'placeholder'}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val !== 'placeholder') {
                                    setSelectedYear(parseInt(val));
                                    setDateFilter('this_year');
                                }
                            }}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '8px',
                                border: '1.5px solid',
                                borderColor: dateFilter === 'this_year' ? '#fca412' : '#ffe8c2',
                                backgroundColor: dateFilter === 'this_year' ? '#fca412' : '#ffffff',
                                color: dateFilter === 'this_year' ? '#ffffff' : '#0c1527',
                                fontWeight: 800,
                                fontSize: '0.85rem',
                                outline: 'none',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                boxShadow: dateFilter === 'this_year' ? '0 4px 12px rgba(252,164,18,0.35)' : 'none'
                            }}
                        >
                            <option value="placeholder" disabled hidden={dateFilter === 'this_year'}>Select Year</option>
                            <option value={new Date().getFullYear()}>This Year ({new Date().getFullYear()})</option>
                            <option value={new Date().getFullYear() - 1}>Previous Year ({new Date().getFullYear() - 1})</option>
                            <option value={new Date().getFullYear() - 2}>{new Date().getFullYear() - 2}</option>
                            <option value={new Date().getFullYear() - 3}>{new Date().getFullYear() - 3}</option>
                        </select>

                        {/* Custom Date selector button */}
                        <button
                            onClick={() => setDateFilter('custom')}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '8px',
                                border: '1.5px solid',
                                borderColor: dateFilter === 'custom' ? '#fca412' : '#ffe8c2',
                                backgroundColor: dateFilter === 'custom' ? '#fca412' : '#ffffff',
                                color: dateFilter === 'custom' ? '#ffffff' : '#0c1527',
                                fontWeight: dateFilter === 'custom' ? 800 : 600,
                                fontSize: '0.85rem',
                                outline: 'none',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                boxShadow: dateFilter === 'custom' ? '0 4px 12px rgba(252,164,18,0.35)' : 'none'
                            }}
                        >
                            Custom Date
                        </button>

                        {/* Custom Date Inputs (Visible only when dateFilter is 'custom') */}
                        {dateFilter === 'custom' && (
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: '8px' }}>
                                <input
                                    type="date"
                                    value={customStartDate}
                                    onChange={(e) => setCustomStartDate(e.target.value)}
                                    style={{ padding: '7px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.82rem', outline: 'none' }}
                                />
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b' }}>to</span>
                                <input
                                    type="date"
                                    value={customEndDate}
                                    onChange={(e) => setCustomEndDate(e.target.value)}
                                    style={{ padding: '7px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.82rem', outline: 'none' }}
                                />
                            </div>
                        )}
                    </div>

                    {/* Project Type Filter Buttons */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: '8px', paddingLeft: '12px', borderLeft: '1.5px solid #ffe8c2' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0c1527', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Project Type:</span>
                        {[
                            { key: 'all', label: 'All' },
                            { key: 'Furniture projects', label: 'Furniture projects' },
                            { key: 'Interior Projects', label: 'Interior Projects' }
                        ].map(typeItem => {
                            const isTypeSelected = projectTypeFilter === typeItem.key;
                            return (
                                <button
                                    key={typeItem.key}
                                    onClick={() => setProjectTypeFilter(typeItem.key)}
                                    style={{
                                        padding: '7px 14px',
                                        borderRadius: '8px',
                                        border: '1.5px solid',
                                        borderColor: isTypeSelected ? '#fca412' : '#ffe8c2',
                                        backgroundColor: isTypeSelected ? '#fca412' : '#ffffff',
                                        color: isTypeSelected ? '#ffffff' : '#0c1527',
                                        fontWeight: isTypeSelected ? 800 : 600,
                                        fontSize: '0.82rem',
                                        outline: 'none',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        boxShadow: isTypeSelected ? '0 4px 12px rgba(252,164,18,0.35)' : 'none'
                                    }}
                                >
                                    {typeItem.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Search Input & Reset Button */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ position: 'relative', width: '240px' }}>
                        <Search size={18} color="#9ca3af" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search project by name..."
                            style={{ width: '100%', padding: '9px 12px 9px 38px', borderRadius: '8px', border: '1.5px solid #ffe8c2', outline: 'none', fontSize: '0.88rem', color: '#0c1527', fontWeight: 600 }}
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    {(dateFilter !== 'all' || projectTypeFilter !== 'all' || searchTerm !== '' || customStartDate !== '' || customEndDate !== '') && (
                        <button
                            onClick={resetFilters}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', border: '1.5px solid #ef4444', backgroundColor: '#fef2f2', color: '#ef4444', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer', boxShadow: '0 2px 6px rgba(239, 68, 68, 0.15)', whiteSpace: 'nowrap' }}
                        >
                            <RotateCcw size={14} /> Reset Filters
                        </button>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="premium-card" style={{ padding: '0px', overflowX: 'auto', border: '1px solid #e5e7eb' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '900px' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                            <th style={{ padding: '16px 20px', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: '#475569', width: '60px' }}>No.</th>
                            <th style={{ padding: '16px 20px', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: '#475569' }}>Project ID</th>
                            <th style={{ padding: '16px 20px', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: '#475569' }}>Project Name</th>
                            <th style={{ padding: '16px 20px', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: '#475569' }}>Project Type</th>
                            <th style={{ padding: '16px 20px', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: '#475569', textAlign: 'right' }}>Total Budget</th>
                            <th style={{ padding: '16px 20px', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: '#475569', textAlign: 'right' }}>Amount Received</th>
                            <th style={{ padding: '16px 20px', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: '#475569', textAlign: 'right' }}>Total Spent</th>
                            <th style={{ padding: '16px 20px', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: '#475569', textAlign: 'right' }}>Profit / Loss</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredData.length === 0 ? (
                            <tr>
                                <td colSpan={8} style={{ padding: '30px', textAlign: 'center', color: '#6b7280' }}>No projects found.</td>
                            </tr>
                        ) : (
                            filteredData.map((project, idx) => (
                                <tr key={project.project_id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.2s' }} className="hover:bg-slate-50">
                                    <td style={{ padding: '16px 20px', fontSize: '0.9rem', color: '#64748b' }}>{idx + 1}</td>
                                    <td style={{ padding: '16px 20px', fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>{project.client_id || '-'}</td>
                                    <td style={{ padding: '16px 20px', fontSize: '0.95rem', fontWeight: 600, color: '#0f172a' }}>{project.project_name}</td>
                                    <td style={{ padding: '16px 20px', fontSize: '0.85rem', fontWeight: 500, color: '#64748b' }}>{project.project_type || '-'}</td>
                                    <td style={{ padding: '16px 20px', fontSize: '0.95rem', color: '#0f172a', textAlign: 'right', fontWeight: 500 }}>₹{project.total_budget.toLocaleString('en-IN')}</td>
                                    <td style={{ padding: '16px 20px', fontSize: '0.95rem', color: '#16a34a', textAlign: 'right', fontWeight: 500 }}>₹{project.advance_paid.toLocaleString('en-IN')}</td>
                                    <td style={{ padding: '16px 20px', fontSize: '0.95rem', color: '#dc2626', textAlign: 'right', fontWeight: 500 }}>₹{project.total_spent.toLocaleString('en-IN')}</td>
                                    <td style={{
                                        padding: '16px 20px',
                                        fontSize: '0.95rem',
                                        color: project.profit >= 0 ? '#059669' : '#e11d48',
                                        textAlign: 'right',
                                        fontWeight: 700
                                    }}>
                                        ₹{project.profit.toLocaleString('en-IN')}
                                    </td>
                                </tr>
                            ))
                        )}
                        {/* Totals Row */}
                        {filteredData.length > 0 && (
                            <tr style={{ backgroundColor: '#f8fafc', borderTop: '2px solid #cbd5e1', fontWeight: 700 }}>
                                <td style={{ padding: '16px 20px' }}></td>
                                <td style={{ padding: '16px 20px', fontSize: '0.95rem', color: '#1e293b' }}>Total Revenue</td>
                                <td style={{ padding: '16px 20px', fontSize: '0.95rem', color: '#1e293b', textAlign: 'right' }}>₹{totalBudget.toLocaleString('en-IN')}</td>
                                <td style={{ padding: '16px 20px', fontSize: '0.95rem', color: '#16a34a', textAlign: 'right' }}>₹{totalAdvance.toLocaleString('en-IN')}</td>
                                <td style={{ padding: '16px 20px', fontSize: '0.95rem', color: '#dc2626', textAlign: 'right' }}>₹{totalSpent.toLocaleString('en-IN')}</td>
                                <td style={{
                                    padding: '16px 20px',
                                    fontSize: '1rem',
                                    color: totalProfit >= 0 ? '#059669' : '#e11d48',
                                    textAlign: 'right'
                                }}>
                                    ₹{totalProfit.toLocaleString('en-IN')}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* TOTAL REVENUE ITEMISED BREAKDOWN POPUP MODAL */}
            {showPortfolioModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px', backdropFilter: 'blur(4px)' }}>
                    <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '850px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1.5px solid #fed7aa', boxShadow: '0 20px 40px -15px rgba(234, 88, 12, 0.25)' }}>
                        {/* Modal Header with Vibrant Brand Orange / Gold Theme */}
                        <div style={{ padding: '20px 24px', background: 'linear-gradient(135deg, #fca412 0%, #ea580c 100%)', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 12px rgba(234, 88, 12, 0.2)' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '-0.01em' }}>
                                    <IndianRupee size={22} color="#ffffff" /> Total Revenue Breakdown
                                </h3>
                                <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#ffedd5', fontWeight: 600 }}>
                                    Accurate revenue sum of ₹{totalBudget.toLocaleString('en-IN')} across {filteredData.length} projects
                                </p>
                            </div>
                            <button onClick={() => setShowPortfolioModal(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#ffffff', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}>
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Content Table */}
                        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#fff7ed', color: '#9a3412', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 800, borderBottom: '2px solid #fed7aa' }}>
                                        <th style={{ padding: '12px 14px', textAlign: 'left' }}>Project Code</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'left' }}>Client / Project Name</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'right' }}>Total Revenue (₹)</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'right' }}>Advance Paid (₹)</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'right' }}>Balance (₹)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredData.map((p, idx) => (
                                        <tr key={p.project_id || idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                                            <td style={{ padding: '12px 14px', fontWeight: 800 }}>
                                                <span style={{ backgroundColor: '#fff7ed', color: '#c2410c', border: '1px solid #ffedd5', padding: '4px 10px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 800 }}>
                                                    {p.client_id || p.project_id}
                                                </span>
                                            </td>
                                            <td style={{ padding: '12px 14px', fontWeight: 700, color: '#1e293b' }}>
                                                {p.project_name}
                                            </td>
                                            <td style={{ padding: '12px 14px', fontWeight: 800, color: '#ea580c', textAlign: 'right' }}>
                                                ₹{p.total_budget.toLocaleString('en-IN')}
                                            </td>
                                            <td style={{ padding: '12px 14px', fontWeight: 700, color: '#16a34a', textAlign: 'right' }}>
                                                ₹{p.advance_paid.toLocaleString('en-IN')}
                                            </td>
                                            <td style={{ padding: '12px 14px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>
                                                ₹{Math.max(0, p.total_budget - p.advance_paid).toLocaleString('en-IN')}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr style={{ backgroundColor: '#fff7ed', borderTop: '2.5px solid #ea580c', fontWeight: 800 }}>
                                        <td colSpan={2} style={{ padding: '14px', color: '#9a3412', fontSize: '0.95rem', fontWeight: 800 }}>Total Revenue Sum:</td>
                                        <td style={{ padding: '14px', color: '#ea580c', textAlign: 'right', fontSize: '1.05rem', fontWeight: 900 }}>₹{totalBudget.toLocaleString('en-IN')}</td>
                                        <td style={{ padding: '14px', color: '#16a34a', textAlign: 'right', fontSize: '0.95rem' }}>₹{totalAdvance.toLocaleString('en-IN')}</td>
                                        <td style={{ padding: '14px', color: '#475569', textAlign: 'right', fontSize: '0.95rem' }}>₹{Math.max(0, totalBudget - totalAdvance).toLocaleString('en-IN')}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* Footer */}
                        <div style={{ padding: '14px 24px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
                            <button onClick={() => setShowPortfolioModal(false)} style={{ padding: '9px 24px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #fca412 0%, #ea580c 100%)', color: '#ffffff', fontWeight: 800, cursor: 'pointer', boxShadow: '0 2px 8px rgba(234, 88, 12, 0.25)' }}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* AMOUNT RECEIVED ITEMISED BREAKDOWN POPUP MODAL */}
            {showAdvanceModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px', backdropFilter: 'blur(4px)' }}>
                    <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '850px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1.5px solid #bbf7d0', boxShadow: '0 20px 40px -15px rgba(22, 163, 74, 0.25)' }}>
                        {/* Modal Header with Green / Gold Theme */}
                        <div style={{ padding: '20px 24px', background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 12px rgba(22, 163, 74, 0.2)' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '-0.01em' }}>
                                    <ArrowUpRight size={22} color="#ffffff" /> Amount Received Breakdown
                                </h3>
                                <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#dcfce7', fontWeight: 600 }}>
                                    Accurate received payments sum of ₹{totalAdvance.toLocaleString('en-IN')} across active projects
                                </p>
                            </div>
                            <button onClick={() => setShowAdvanceModal(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#ffffff', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}>
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Content Table */}
                        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#f0fdf4', color: '#166534', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 800, borderBottom: '2px solid #bbf7d0' }}>
                                        <th style={{ padding: '12px 14px', textAlign: 'left' }}>Project Code</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'left' }}>Client / Project Name</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'right' }}>Total Budget (₹)</th>
                                        <th style={{ padding: '12px 14px', textAlign: 'right' }}>Amount Received (₹)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredData.filter(p => p.advance_paid > 0).map((p, idx) => (
                                        <tr key={p.project_id || idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                                            <td style={{ padding: '12px 14px', fontWeight: 800 }}>
                                                <span style={{ backgroundColor: '#f0fdf4', color: '#166534', border: '1px solid #dcfce7', padding: '4px 10px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 800 }}>
                                                    {p.client_id || p.project_id}
                                                </span>
                                            </td>
                                            <td style={{ padding: '12px 14px', fontWeight: 700, color: '#1e293b' }}>
                                                {p.project_name}
                                            </td>
                                            <td style={{ padding: '12px 14px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>
                                                ₹{p.total_budget.toLocaleString('en-IN')}
                                            </td>
                                            <td style={{ padding: '12px 14px', fontWeight: 800, color: '#16a34a', textAlign: 'right' }}>
                                                ₹{p.advance_paid.toLocaleString('en-IN')}
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredData.filter(p => p.advance_paid > 0).length === 0 && (
                                        <tr>
                                            <td colSpan={4} style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>
                                                No payments recorded yet.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                                <tfoot>
                                    <tr style={{ backgroundColor: '#f0fdf4', borderTop: '2.5px solid #16a34a', fontWeight: 800 }}>
                                        <td colSpan={3} style={{ padding: '14px', color: '#166534', fontSize: '0.95rem', fontWeight: 800 }}>Total Amount Received Sum:</td>
                                        <td style={{ padding: '14px', color: '#15803d', textAlign: 'right', fontSize: '1.05rem', fontWeight: 900 }}>₹{totalAdvance.toLocaleString('en-IN')}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* Footer */}
                        <div style={{ padding: '14px 24px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
                            <button onClick={() => setShowAdvanceModal(false)} style={{ padding: '9px 24px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', color: '#ffffff', fontWeight: 800, cursor: 'pointer', boxShadow: '0 2px 8px rgba(22, 163, 74, 0.25)' }}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
