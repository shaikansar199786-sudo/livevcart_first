import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Loader2 } from 'lucide-react';

export const GlobalVendors: React.FC = () => {
    const [activeTab, setActiveTab] = useState('vendor_quta');
    const [globalData, setGlobalData] = useState<any>({
        vendor_quta: [],
        transport: [],
        labor: [],
        miscellaneous: [],
        balance_sheet: []
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchGlobalData();
    }, []);

    const fetchGlobalData = async () => {
        setLoading(true);
        try {
            const response = await axios.get('http://localhost/ARK/api/vendors/global');
            if (response.data.success) {
                setGlobalData(response.data.data);
            }
        } catch (error) {
            console.error('Failed to fetch global vendors:', error);
        } finally {
            setLoading(false);
        }
    };

    const tabs = [
        { id: 'vendor_quta', label: 'Vendor Quta' },
        { id: 'transport', label: 'Transport' },
        { id: 'labor', label: 'Labor' },
        { id: 'miscellaneous', label: 'Miscellaneous' },
        { id: 'balance_sheet', label: 'Balance Sheet' }
    ];

    return (
        <div className="vendors-container" style={{ padding: '20px', width: '100%' }}>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#253b50', marginBottom: '20px' }}>Global Vendors</h1>
            
            <div style={{ display: 'flex', gap: '10px', marginBottom: '30px', borderBottom: '2px solid #e2e8f0' }}>
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            padding: '12px 24px',
                            border: 'none',
                            background: 'none',
                            fontSize: '1rem',
                            fontWeight: activeTab === tab.id ? 700 : 500,
                            color: activeTab === tab.id ? '#253b50' : '#64748b',
                            borderBottom: activeTab === tab.id ? '3px solid #253b50' : '3px solid transparent',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
                    <Loader2 className="animate-spin" size={48} color="#253b50" />
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: '30px', alignItems: 'start' }}>
                    {activeTab === 'vendor_quta' && (
                        globalData.vendor_quta.length > 0 ? (
                            globalData.vendor_quta.map((vendor: any, index: number) => (
                                <div key={index} className="premium-card" style={{ backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 15px rgba(0, 0, 0, 0.05)', border: '1px solid #e2e8f0', padding: 0 }}>
                                    <div style={{ backgroundColor: '#f8fafc', padding: '16px', textAlign: 'center', fontWeight: 800, fontSize: '1.2rem', color: '#1e293b', borderBottom: '1px solid #e2e8f0' }}>
                                        {vendor.vendor_name}
                                    </div>
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                                            <thead>
                                                <tr style={{ backgroundColor: '#f1f5f9' }}>
                                                    <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0', fontWeight: 700, color: '#475569' }}>Project / Site</th>
                                                    <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0', fontWeight: 700, color: '#475569' }}>Item</th>
                                                    <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Rate</th>
                                                    <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Qty</th>
                                                    <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Disc (%)</th>
                                                    <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Without GST</th>
                                                    <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0', fontWeight: 700, color: '#475569', textAlign: 'right' }}>GST (18%)</th>
                                                    <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0', fontWeight: 700, color: '#475569', textAlign: 'right' }}>With GST</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {vendor.items.map((item: any, idx: number) => (
                                                    <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#f8fafc', transition: 'background-color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = idx % 2 === 0 ? 'white' : '#f8fafc'}>
                                                        <td style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0', color: '#1e293b', fontWeight: 600 }}>{item.site || '-'}</td>
                                                        <td style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>{item.item_name}</td>
                                                        <td style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'right' }}>₹{parseFloat(item.rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                        <td style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'right' }}>{item.quantity}</td>
                                                        <td style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'right' }}>{item.discount}%</td>
                                                        <td style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'right' }}>₹{parseFloat(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                        <td style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'right' }}>₹{parseFloat(item.gst).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                        <td style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 600, color: '#059669' }}>₹{parseFloat(item.total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                    </tr>
                                                ))}
                                                <tr style={{ backgroundColor: '#e2e8f0' }}>
                                                    <td colSpan={7} style={{ padding: '14px 12px', textAlign: 'right', fontWeight: 800, color: '#1e293b' }}>Total Value =</td>
                                                    <td style={{ padding: '14px 12px', textAlign: 'right', fontWeight: 800, color: '#059669', fontSize: '1.05rem' }}>
                                                        ₹{vendor.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', fontSize: '1.1rem' }}>
                                No vendor records found.
                            </div>
                        )
                    )}

                    {['transport', 'labor', 'miscellaneous'].includes(activeTab) && (
                        globalData[activeTab].length > 0 ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '30px' }}>
                                {globalData[activeTab].map((person: any, index: number) => (
                                    <div key={index} className="premium-card" style={{ backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 15px rgba(0, 0, 0, 0.05)', border: '1px solid #e2e8f0', padding: 0 }}>
                                        <div style={{ backgroundColor: '#f8fafc', padding: '16px', textAlign: 'center', fontWeight: 800, fontSize: '1.1rem', color: '#1e293b', borderBottom: '1px solid #e2e8f0' }}>
                                            {person.person_name}
                                        </div>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                                            <thead>
                                                <tr style={{ backgroundColor: '#f1f5f9' }}>
                                                    <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0', fontWeight: 700, color: '#475569' }}>Project / Site</th>
                                                    <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0', fontWeight: 700, color: '#475569', textAlign: 'center' }}>Date</th>
                                                    <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {person.transactions.map((t: any, idx: number) => (
                                                    <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#f8fafc', transition: 'background-color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = idx % 2 === 0 ? 'white' : '#f8fafc'}>
                                                        <td style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0', color: '#1e293b', fontWeight: 500 }}>{t.site || '-'}</td>
                                                        <td style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'center' }}>
                                                            {t.transaction_date ? new Date(t.transaction_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).replace(/ /g, '-') : '-'}
                                                        </td>
                                                        <td style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 600, color: '#059669' }}>
                                                            ₹{parseFloat(t.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </td>
                                                    </tr>
                                                ))}
                                                <tr style={{ backgroundColor: '#e2e8f0' }}>
                                                    <td colSpan={2} style={{ padding: '14px 12px', textAlign: 'right', fontWeight: 800, color: '#1e293b' }}>Total =</td>
                                                    <td style={{ padding: '14px 12px', textAlign: 'right', fontWeight: 800, color: '#059669', fontSize: '1.05rem' }}>
                                                        ₹{person.total_payment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', fontSize: '1.1rem' }}>
                                No {activeTab} records found.
                            </div>
                        )
                    )}

                    {activeTab === 'balance_sheet' && (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', fontSize: '1.1rem', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                            <p style={{ fontWeight: 600, marginBottom: '8px' }}>Balance Sheet feature coming soon.</p>
                            <p style={{ fontSize: '0.9rem' }}>This section will display overall vendor accounting balances.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
