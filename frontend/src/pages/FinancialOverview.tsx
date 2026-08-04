import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useAuth } from '../hooks/useAuth';
import { Loader2, DollarSign, Wallet, TrendingUp, ArrowDownRight, ArrowUpRight, Search } from 'lucide-react';

interface ProjectFinance {
    project_id: string;
    project_name: string;
    total_budget: number;
    advance_paid: number;
    total_spent: number;
    profit: number;
}

export const FinancialOverview: React.FC = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<ProjectFinance[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchFinancialOverview();
    }, []);

    const fetchFinancialOverview = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${API_BASE_URL}/projects/financial-overview`);
            if (response.data.success) {
                setData(response.data.data);
            }
        } catch (error) {
            console.error('Failed to fetch financial overview:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredData = data.filter(p =>
        (p.project_name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Totals calculations
    const totalBudget = filteredData.reduce((sum, p) => sum + p.total_budget, 0);
    const totalAdvance = filteredData.reduce((sum, p) => sum + p.advance_paid, 0);
    const totalSpent = filteredData.reduce((sum, p) => sum + p.total_spent, 0);
    const totalProfit = filteredData.reduce((sum, p) => sum + p.profit, 0);

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
                <Loader2 className="animate-spin" size={48} color="#253b50" />
            </div>
        );
    }

    return (
        <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#253b50', margin: 0 }}>Financial Overview</h2>
                    <p style={{ color: '#6b7280', marginTop: '4px' }}>Analyze budgets, advance payments, expenses, and profits across all projects.</p>
                </div>
            </div>

            {/* Quick Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '30px' }}>
                <div className="premium-card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px' }}>
                    <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: '#e0f2fe', color: '#0284c7' }}>
                        <DollarSign size={24} />
                    </div>
                    <div>
                        <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '2px', fontWeight: 600 }}>Total Portfolio Budget</p>
                        <h4 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a' }}>₹{totalBudget.toLocaleString('en-IN')}</h4>
                    </div>
                </div>
                <div className="premium-card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px' }}>
                    <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: '#dcfce7', color: '#16a34a' }}>
                        <ArrowUpRight size={24} />
                    </div>
                    <div>
                        <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '2px', fontWeight: 600 }}>Total Advance Received</p>
                        <h4 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a' }}>₹{totalAdvance.toLocaleString('en-IN')}</h4>
                    </div>
                </div>
                <div className="premium-card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px' }}>
                    <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: '#fee2e2', color: '#dc2626' }}>
                        <ArrowDownRight size={24} />
                    </div>
                    <div>
                        <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '2px', fontWeight: 600 }}>Total Spent</p>
                        <h4 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a' }}>₹{totalSpent.toLocaleString('en-IN')}</h4>
                    </div>
                </div>
                <div className="premium-card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px' }}>
                    <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: totalProfit >= 0 ? '#ecfdf5' : '#fff1f2', color: totalProfit >= 0 ? '#059669' : '#e11d48' }}>
                        <TrendingUp size={24} />
                    </div>
                    <div>
                        <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '2px', fontWeight: 600 }}>Net Portfolio Profit</p>
                        <h4 style={{ fontSize: '1.3rem', fontWeight: 800, color: totalProfit >= 0 ? '#059669' : '#e11d48' }}>₹{totalProfit.toLocaleString('en-IN')}</h4>
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '16px' }}>
                <div style={{ position: 'relative', flex: '1', maxWidth: '400px' }}>
                    <Search size={18} color="#9ca3af" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search project by name..."
                        style={{ width: '100%', padding: '10px 12px 10px 40px', borderRadius: '8px', border: '1px solid #e5e7eb', outline: 'none', fontSize: '0.9rem' }}
                    />
                </div>
            </div>

            {/* Table */}
            <div className="premium-card" style={{ padding: '0px', overflowX: 'auto', border: '1px solid #e5e7eb' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '900px' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                            <th style={{ padding: '16px 20px', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: '#475569', width: '60px' }}>No.</th>
                            <th style={{ padding: '16px 20px', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: '#475569' }}>Project Name</th>
                            <th style={{ padding: '16px 20px', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: '#475569', textAlign: 'right' }}>Total Budget</th>
                            <th style={{ padding: '16px 20px', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: '#475569', textAlign: 'right' }}>Advance Received</th>
                            <th style={{ padding: '16px 20px', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: '#475569', textAlign: 'right' }}>Total Spent</th>
                            <th style={{ padding: '16px 20px', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: '#475569', textAlign: 'right' }}>Profit / Loss</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredData.length === 0 ? (
                            <tr>
                                <td colSpan={6} style={{ padding: '30px', textAlign: 'center', color: '#6b7280' }}>No projects found.</td>
                            </tr>
                        ) : (
                            filteredData.map((project, idx) => (
                                <tr key={project.project_id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.2s' }} className="hover:bg-slate-50">
                                    <td style={{ padding: '16px 20px', fontSize: '0.9rem', color: '#64748b' }}>{idx + 1}</td>
                                    <td style={{ padding: '16px 20px', fontSize: '0.95rem', fontWeight: 600, color: '#0f172a' }}>{project.project_name}</td>
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
                                <td style={{ padding: '16px 20px', fontSize: '0.95rem', color: '#1e293b' }}>Total Portfolio</td>
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
        </div>
    );
};
