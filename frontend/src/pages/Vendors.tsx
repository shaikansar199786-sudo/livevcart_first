import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Loader2 } from 'lucide-react';

export const Vendors: React.FC = () => {
    const [activeTab, setActiveTab] = useState('labor');
    const [laborers, setLaborers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (activeTab === 'labor') {
            fetchLaborers();
        }
    }, [activeTab]);

    const fetchLaborers = async () => {
        setLoading(true);
        try {
            const response = await axios.get('http://localhost/ARK/api/vendors/labor');
            if (response.data.success) {
                setLaborers(response.data.data);
            }
        } catch (error) {
            console.error('Failed to fetch laborers:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="vendors-container" style={{ padding: '20px', width: '100%' }}>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#253b50', marginBottom: '20px' }}>List of Contractors</h1>
            
            <div style={{ display: 'flex', gap: '10px', marginBottom: '30px', borderBottom: '2px solid #e2e8f0' }}>
                <button
                    onClick={() => setActiveTab('labor')}
                    style={{
                        padding: '12px 24px',
                        border: 'none',
                        background: 'none',
                        fontSize: '1rem',
                        fontWeight: activeTab === 'labor' ? 700 : 500,
                        color: activeTab === 'labor' ? '#253b50' : '#64748b',
                        borderBottom: activeTab === 'labor' ? '3px solid #253b50' : '3px solid transparent',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                >
                    Labor
                </button>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
                    <Loader2 className="animate-spin" size={48} color="#253b50" />
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '30px', alignItems: 'start' }}>
                    {laborers.length > 0 ? (
                        laborers.map((laborer, index) => (
                            <div key={index} className="premium-card" style={{ backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 15px rgba(0, 0, 0, 0.05)', border: '1px solid #e2e8f0', padding: 0 }}>
                                <div style={{ backgroundColor: '#f8fafc', padding: '16px', textAlign: 'center', fontWeight: 800, fontSize: '1.1rem', color: '#1e293b', borderBottom: '1px solid #e2e8f0' }}>
                                    {laborer.person_name}
                                </div>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#f1f5f9' }}>
                                            <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0', fontWeight: 700, color: '#475569' }}>Site</th>
                                            <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0', fontWeight: 700, color: '#475569', textAlign: 'center' }}>Payment date</th>
                                            <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Payment Amount</th>
                                            <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0', fontWeight: 700, color: '#475569' }}>Remarks</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {laborer.transactions.map((t: any, idx: number) => (
                                            <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#f8fafc', transition: 'background-color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = idx % 2 === 0 ? 'white' : '#f8fafc'}>
                                                <td style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0', color: '#1e293b', fontWeight: 500 }}>{t.site}</td>
                                                <td style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'center' }}>
                                                    {t.payment_date ? new Date(t.payment_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).replace(/ /g, '-') : '-'}
                                                </td>
                                                <td style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 600, color: '#059669' }}>
                                                    ₹{parseFloat(t.payment_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>{t.remarks || '-'}</td>
                                            </tr>
                                        ))}
                                        <tr style={{ backgroundColor: '#e2e8f0' }}>
                                            <td colSpan={2} style={{ padding: '14px 12px', textAlign: 'right', fontWeight: 800, color: '#1e293b' }}>Total =</td>
                                            <td style={{ padding: '14px 12px', textAlign: 'right', fontWeight: 800, color: '#059669', fontSize: '1.05rem' }}>
                                                ₹{laborer.total_payment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                            <td style={{ padding: '14px 12px' }}></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        ))
                    ) : (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', fontSize: '1.1rem', gridColumn: '1 / -1' }}>
                            No labor records found.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
