import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Loader2, HardHat, Users, Search, RotateCcw, X, Filter, Calendar } from 'lucide-react';
import { API_BASE_URL } from '../config';
import liveLogo from '../assets/1.png';

// Timezone-safe date parser: treats YYYY-MM-DD as local midnight (not UTC)
function parseLocalDate(rawDate: string | null | undefined): Date | null {
    if (!rawDate) return null;
    const s = String(rawDate).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        const [y, m, d] = s.split('-').map(Number);
        return new Date(y, m - 1, d, 0, 0, 0, 0);
    }
    const dt = new Date(rawDate);
    return isNaN(dt.getTime()) ? null : dt;
}

export const Vendors: React.FC = () => {
    const [activeTab, setActiveTab] = useState('labor');
    const [laborers, setLaborers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Filter state
    const [searchQuery, setSearchQuery] = useState('');
    const [statementPeriod, setStatementPeriod] = useState('all_time');
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');

    useEffect(() => {
        if (activeTab === 'labor') {
            fetchLaborers();
        }
    }, [activeTab]);

    const fetchLaborers = async () => {
        setLoading(true);
        try {
            const response = await axios.get(`${API_BASE_URL}/vendors/labor`);
            if (response.data.success) {
                setLaborers(response.data.data);
            }
        } catch (error) {
            console.error('Failed to fetch laborers:', error);
        } finally {
            setLoading(false);
        }
    };

    const resetFilters = () => {
        setSearchQuery('');
        setStatementPeriod('all_time');
        setSelectedYear(new Date().getFullYear());
        setCustomStartDate('');
        setCustomEndDate('');
    };

    // Filter function for a single transaction's payment_date
    const isTransactionInPeriod = (t: any): boolean => {
        if (statementPeriod === 'all_time') return true;
        const tDate = parseLocalDate(t.payment_date);
        if (!tDate) return false;
        const now = new Date();
        if (statementPeriod === 'last_month') {
            const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
            return tDate >= start && tDate <= end;
        }
        if (statementPeriod === 'last_3_months') {
            const start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
            return tDate >= start;
        }
        if (statementPeriod === 'last_6_months') {
            const start = new Date(now.getFullYear(), now.getMonth() - 6, 1);
            return tDate >= start;
        }
        if (statementPeriod === 'this_year') {
            const start = new Date(now.getFullYear(), 0, 1);
            const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
            return tDate >= start && tDate <= end;
        }
        if (statementPeriod === 'by_year') {
            const yr = selectedYear || now.getFullYear();
            const start = new Date(yr, 0, 1);
            const end = new Date(yr, 11, 31, 23, 59, 59);
            return tDate >= start && tDate <= end;
        }
        if (statementPeriod === 'custom_range') {
            if (customStartDate) {
                const cStart = parseLocalDate(customStartDate);
                if (cStart && tDate < cStart) return false;
            }
            if (customEndDate) {
                const [ey, em, ed] = customEndDate.split('-').map(Number);
                const cEnd = new Date(ey, em - 1, ed, 23, 59, 59);
                if (tDate > cEnd) return false;
            }
            return true;
        }
        return true;
    };

    const filteredLaborers = useMemo(() => {
        return laborers
            .map((l: any) => {
                // Apply date filter to transactions
                const filteredTxns = (l.transactions || []).filter(isTransactionInPeriod);
                // Apply search filter
                const q = searchQuery.toLowerCase().trim();
                const nameMatch = !q || (l.person_name || '').toLowerCase().includes(q);
                const siteMatch = !q || filteredTxns.some((t: any) => (t.site || '').toLowerCase().includes(q));
                if (!nameMatch && !siteMatch) return null;
                // If searching by site, filter transactions to matching sites too
                const displayTxns = q && !nameMatch
                    ? filteredTxns.filter((t: any) => (t.site || '').toLowerCase().includes(q))
                    : filteredTxns;
                if (displayTxns.length === 0 && statementPeriod !== 'all_time') return null;
                const filteredTotal = displayTxns.reduce((sum: number, t: any) => sum + parseFloat(t.payment_amount || '0'), 0);
                return { ...l, transactions: displayTxns, filtered_total: filteredTotal };
            })
            .filter(Boolean);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [laborers, searchQuery, statementPeriod, selectedYear, customStartDate, customEndDate]);

    const yearOptions = Array.from({ length: 8 }, (_, i) => new Date().getFullYear() - i);

    return (
        <div className="vendors-container" style={{ width: '100%', padding: '0 0 24px 0' }}>
            {/* Header Title Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ padding: '10px', backgroundColor: '#0c1527', borderRadius: '10px', color: '#fca412', boxShadow: '0 4px 12px rgba(12,21,39,0.15)' }}>
                        <HardHat size={24} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0c1527', margin: 0, letterSpacing: '-0.02em' }}>
                            List of Contractors &amp; Labor
                        </h1>
                        <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '3px 0 0 0' }}>
                            Manage contractor accounts, site labor payments, and total project disbursements
                        </p>
                    </div>
                </div>
            </div>

            {/* Toolbar: Navigation Tabs */}
            <div style={{ display: 'flex', gap: '10px', backgroundColor: '#ffffff', padding: '6px', borderRadius: '12px', border: '1.5px solid #ffe8c2', width: 'fit-content', boxShadow: '0 2px 8px rgba(252,164,18,0.06)', marginBottom: '20px' }}>
                <button
                    onClick={() => setActiveTab('labor')}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '10px 22px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: activeTab === 'labor' ? '#0c1527' : 'transparent',
                        color: activeTab === 'labor' ? '#fca412' : '#64748b',
                        fontWeight: 800,
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                >
                    <Users size={16} /> Labor Contractors
                </button>
            </div>

            {/* FILTERS TOOLBAR PANEL */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '18px 20px', border: '1px solid #e2e8f0', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontWeight: 700, fontSize: '0.90rem' }}>
                        <Filter size={18} style={{ color: '#ea580c' }} />
                        Filter &amp; Search Statement Periods
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button
                            onClick={resetFilters}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                padding: '5px 12px', borderRadius: '8px',
                                border: '1.5px solid #ef4444', backgroundColor: '#fef2f2',
                                color: '#ef4444', fontWeight: 800, fontSize: '0.78rem',
                                cursor: 'pointer', transition: 'all 0.2s ease',
                                boxShadow: '0 2px 6px rgba(239,68,68,0.12)'
                            }}
                            title="Reset all filters"
                        >
                            <RotateCcw size={13} /> Reset Filters
                        </button>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#fff7ed', padding: '4px 10px', borderRadius: '20px', border: '1px solid #ffedd5' }}>
                            <img src={liveLogo} alt="Livincart Logo" style={{ height: '20px', objectFit: 'contain' }} />
                            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#c2410c' }}>Statement Filter</span>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', alignItems: 'end' }}>
                    {/* Search Bar */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Search Contractor / Site</label>
                        <div style={{ position: 'relative' }}>
                            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search keyword..."
                                style={{ width: '100%', padding: '8px 10px 8px 34px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.84rem', outline: 'none', boxSizing: 'border-box' }}
                            />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}>
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Statement Period Filter */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Statement Period</label>
                        <select
                            value={statementPeriod}
                            onChange={(e) => setStatementPeriod(e.target.value)}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.84rem', outline: 'none', backgroundColor: '#ffffff', fontWeight: 600 }}
                        >
                            <option value="all_time">All Time</option>
                            <option value="last_month">Last Month</option>
                            <option value="last_3_months">Last 3 Months</option>
                            <option value="last_6_months">Last 6 Months</option>
                            <option value="this_year">This Year</option>
                            <option value="by_year">By Year</option>
                            <option value="custom_range">Custom Range</option>
                        </select>
                    </div>

                    {/* By Year — Dynamic Year Picker */}
                    {statementPeriod === 'by_year' && (
                        <div>
                            <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Select Year</label>
                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(Number(e.target.value))}
                                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1.5px solid #2563eb', fontSize: '0.84rem', outline: 'none', backgroundColor: '#eff6ff', fontWeight: 800, color: '#1e40af', cursor: 'pointer' }}
                            >
                                {yearOptions.map(yr => (
                                    <option key={yr} value={yr}>{yr}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                {/* Custom Date Range Picker */}
                {statementPeriod === 'custom_range' && (
                    <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px dashed #e2e8f0', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                        <Calendar size={16} color="#2563eb" />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.80rem', fontWeight: 700, color: '#475569' }}>From Date:</span>
                            <input
                                type="date"
                                value={customStartDate}
                                onChange={(e) => setCustomStartDate(e.target.value)}
                                style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.84rem', outline: 'none' }}
                            />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.80rem', fontWeight: 700, color: '#475569' }}>To Date:</span>
                            <input
                                type="date"
                                value={customEndDate}
                                onChange={(e) => setCustomEndDate(e.target.value)}
                                style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.84rem', outline: 'none' }}
                            />
                        </div>
                    </div>
                )}

                {/* Active filter badge */}
                {statementPeriod !== 'all_time' && (
                    <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2563eb', backgroundColor: '#eff6ff', padding: '3px 10px', borderRadius: '20px', border: '1px solid #bfdbfe' }}>
                            🔍 Filtering by: {
                                statementPeriod === 'last_month' ? 'Last Month' :
                                statementPeriod === 'last_3_months' ? 'Last 3 Months' :
                                statementPeriod === 'last_6_months' ? 'Last 6 Months' :
                                statementPeriod === 'this_year' ? `This Year (${new Date().getFullYear()})` :
                                statementPeriod === 'by_year' ? `Year ${selectedYear}` :
                                statementPeriod === 'custom_range' ? `${customStartDate || '...'} → ${customEndDate || '...'}` : ''
                            }
                        </span>
                        <span style={{ fontSize: '0.74rem', color: '#64748b' }}>{filteredLaborers.length} contractor(s) matched</span>
                    </div>
                )}
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
                    <Loader2 className="animate-spin" size={44} color="#fca412" />
                </div>
            ) : (
                <div className="vendors-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px', alignItems: 'start' }}>
                    {filteredLaborers.length > 0 ? (
                        filteredLaborers.map((laborer: any, index: number) => (
                            <div key={index} className="vendor-card" style={{ backgroundColor: '#ffffff', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)', border: '1.5px solid #ffe8c2', padding: 0 }}>
                                <div style={{ backgroundColor: '#fff9f0', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1.5px solid #ffe8c2' }}>
                                    <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#0c1527', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span>👷</span> {laborer.person_name}
                                    </div>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 800, backgroundColor: '#0c1527', color: '#fca412', padding: '3px 10px', borderRadius: '6px' }}>
                                        {laborer.transactions.length} Payment(s)
                                    </span>
                                </div>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#ffffff', borderBottom: '2px solid #e2e8f0' }}>
                                            <th style={{ padding: '12px 14px', fontWeight: 800, color: '#0c1527', fontSize: '0.8rem', textTransform: 'uppercase' }}>Site</th>
                                            <th style={{ padding: '12px 14px', fontWeight: 800, color: '#0c1527', fontSize: '0.8rem', textTransform: 'uppercase', textAlign: 'center' }}>Payment Date</th>
                                            <th style={{ padding: '12px 14px', fontWeight: 800, color: '#0c1527', fontSize: '0.8rem', textTransform: 'uppercase', textAlign: 'right' }}>Payment Amount</th>
                                            <th style={{ padding: '12px 14px', fontWeight: 800, color: '#0c1527', fontSize: '0.8rem', textTransform: 'uppercase' }}>Remarks</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {laborer.transactions.map((t: any, idx: number) => (
                                            <tr key={idx} style={{ backgroundColor: '#ffffff', transition: 'background-color 0.2s' }}
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}>
                                                <td style={{ padding: '12px 14px', borderBottom: '1px solid #f1f5f9', color: '#0c1527', fontWeight: 700 }}>{t.site}</td>
                                                <td style={{ padding: '12px 14px', borderBottom: '1px solid #f1f5f9', color: '#64748b', textAlign: 'center', fontWeight: 600 }}>
                                                    {t.payment_date
                                                        ? (() => {
                                                            const d = parseLocalDate(t.payment_date);
                                                            return d ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).replace(/ /g, '-') : '-';
                                                        })()
                                                        : '-'}
                                                </td>
                                                <td style={{ padding: '12px 14px', borderBottom: '1px solid #f1f5f9', textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>
                                                    ₹{parseFloat(t.payment_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td style={{ padding: '12px 14px', borderBottom: '1px solid #f1f5f9', color: '#64748b' }}>{t.remLivincarts || '-'}</td>
                                            </tr>
                                        ))}
                                        <tr style={{ backgroundColor: '#fff9f0', borderTop: '2px solid #ffe8c2' }}>
                                            <td colSpan={2} style={{ padding: '14px', textAlign: 'right', fontWeight: 800, color: '#0c1527', fontSize: '0.95rem' }}>
                                                {statementPeriod !== 'all_time' ? 'Period Total =' : 'Total Paid ='}
                                            </td>
                                            <td style={{ padding: '14px', textAlign: 'right', fontWeight: 800, color: '#16a34a', fontSize: '1.05rem' }}>
                                                ₹{(laborer.filtered_total ?? laborer.total_payment).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                            <td style={{ padding: '14px' }}></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        ))
                    ) : (
                        <div style={{ textAlign: 'center', padding: '60px', backgroundColor: '#ffffff', borderRadius: '16px', border: '1.5px solid #ffe8c2', color: '#64748b', fontSize: '1.05rem', gridColumn: '1 / -1' }}>
                            {statementPeriod !== 'all_time' ? '📭 No payments found for the selected period.' : 'No labor records found.'}
                        </div>
                    )}
                </div>
            )}
            <style>{`
                @media (max-width: 768px) {
                    .vendors-grid {
                        grid-template-columns: repeat(1, 1fr) !important;
                        gap: 20px !important;
                    }
                    .vendor-card {
                        overflow-x: auto !important;
                    }
                    .vendor-card table {
                        min-width: 600px;
                    }
                }
            `}</style>
        </div>
    );
};
