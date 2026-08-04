import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Loader2, Trash2 } from 'lucide-react';
import { API_BASE_URL } from '../config';

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

    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
    const [editingState, setEditingState] = useState<Record<string, { field: string; value: any }>>({});

    const toggleGroup = (key: string) => {
        setExpandedGroups(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    const startEditing = (itemId: string, field: string, currentValue: any) => {
        setEditingState(prev => ({
            ...prev,
            [itemId]: { field, value: currentValue }
        }));
    };

    const cancelEditing = (itemId: string) => {
        setEditingState(prev => {
            const newState = { ...prev };
            delete newState[itemId];
            return newState;
        });
    };

    const updateEditingValue = (itemId: string, value: any) => {
        setEditingState(prev => ({
            ...prev,
            [itemId]: { ...prev[itemId], value }
        }));
    };

    const handleSave = async (itemId: string) => {
        const editing = editingState[itemId];
        if (!editing) return;

        try {
            const updateData: any = { id: itemId };
            if (editing.field === 'payment_date') updateData.payment_date = editing.value;
            if (editing.field === 'payment_amount') updateData.payment_amount = editing.value;
            if (editing.field === 'remLivincart') updateData.remLivincart = editing.value;
            if (editing.field === 'payment_mode') updateData.payment_mode = editing.value;

            await axios.put(`${API_BASE_URL}/vendors/update-payment`, updateData);
            cancelEditing(itemId);
            fetchGlobalData();
        } catch (error) {
            console.error('Failed to update:', error);
        }
    };

    const handleDelete = async (itemId: string) => {
        if (!confirm('Are you sure you want to delete this item?')) return;

        try {
            await axios.delete(`${API_BASE_URL}/vendors/delete-item`, { data: { id: itemId } });
            fetchGlobalData();
        } catch (error) {
            console.error('Failed to delete:', error);
            alert('Failed to delete item');
        }
    };

    useEffect(() => {
        fetchGlobalData();
    }, []);

    const fetchGlobalData = async () => {
        setLoading(true);
        try {
            const response = await axios.get(`${API_BASE_URL}/vendors/global`);
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

            <div className="tabs-container" style={{ display: 'flex', gap: '10px', marginBottom: '30px', borderBottom: '2px solid #e2e8f0' }}>
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
                                <div key={index} className="premium-card vendor-card" style={{ backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 15px rgba(0, 0, 0, 0.05)', border: '1px solid #e2e8f0', padding: 0 }}>
                                    <div style={{ backgroundColor: '#f8fafc', padding: '16px', textAlign: 'center', fontWeight: 800, fontSize: '1.2rem', color: '#1e293b', borderBottom: '1px solid #e2e8f0' }}>
                                        {vendor.vendor_name}
                                    </div>
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                                            <thead>
                                                <tr style={{ backgroundColor: '#f1f5f9' }}>
                                                    <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0', fontWeight: 700, color: '#475569', textAlign: 'center', width: '50px' }}>S.No</th>
                                                    <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0', fontWeight: 700, color: '#475569' }}>Project / Site</th>
                                                    <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0', fontWeight: 700, color: '#475569' }}>Bill Date</th>
                                                    <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Payment Amount</th>
                                                    <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Bill Amount (Invoice Total)</th>
                                                    <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0', fontWeight: 700, color: '#475569' }}>Mode</th>
                                                    <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0', fontWeight: 700, color: '#475569' }}>RemLivincart</th>
                                                    <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0', fontWeight: 700, color: '#475569', textAlign: 'center', width: '60px' }}>Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(() => {
                                                    // Group items by Bill Date and Invoice Total
                                                    const grouped = vendor.items.reduce((acc: any, item: any) => {
                                                        const billDate = item.invoice_date || '';
                                                        const invoiceTotal = parseFloat(item.invoice_total || item.total || 0);
                                                        const site = item.site || '-';
                                                        const key = `${billDate}-${invoiceTotal}-${site}`;

                                                        if (!acc[key]) {
                                                            acc[key] = {
                                                                site: site,
                                                                billDate: billDate,
                                                                invoiceTotal: invoiceTotal,
                                                                items: [],
                                                                paymentAmount: 0,
                                                                paymentMode: item.payment_mode || 'Cash',
                                                                remLivincart: item.remLivincart || '-',
                                                                paymentDate: item.payment_date || '-',
                                                                ids: []
                                                            };
                                                        }

                                                        acc[key].items.push(item);
                                                        acc[key].paymentAmount += parseFloat(item.paid || 0);
                                                        acc[key].ids.push(item.id);

                                                        return acc;
                                                    }, {});

                                                    const groupedItems = Object.values(grouped);

                                                    return groupedItems.map((group: any, idx: number) => {
                                                        const editingId = group.ids[0];
                                                        const editing = editingState[editingId];
                                                        const isEditingPaymentAmount = editing?.field === 'payment_amount';
                                                        const isEditingPaymentMode = editing?.field === 'payment_mode';
                                                        const isEditingRemLivincart = editing?.field === 'remLivincart';

                                                        return (
                                                            <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#f8fafc', transition: 'background-color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = idx % 2 === 0 ? 'white' : '#f8fafc'}>
                                                                <td style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0', color: '#1e293b', fontWeight: 600, textAlign: 'center' }}>{idx + 1}</td>
                                                                <td style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0', color: '#1e293b', fontWeight: 600 }}>{group.site}</td>
                                                                <td style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                                                                    {group.billDate ? new Date(group.billDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                                                                </td>
                                                                <td style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'right', fontWeight: 600 }}>
                                                                    {isEditingPaymentAmount ? (
                                                                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                                                                            <input
                                                                                type="number"
                                                                                value={editing?.value || 0}
                                                                                onChange={(e) => updateEditingValue(editingId, parseFloat(e.target.value))}
                                                                                style={{ padding: '4px', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '0.85rem', width: '100px', textAlign: 'right' }}
                                                                            />
                                                                            <button
                                                                                onClick={() => handleSave(editingId)}
                                                                                style={{ padding: '4px 8px', background: '#059669', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                                                                            >✓</button>
                                                                            <button
                                                                                onClick={() => cancelEditing(editingId)}
                                                                                style={{ padding: '4px 8px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                                                                            >✗</button>
                                                                        </div>
                                                                    ) : (
                                                                        <span
                                                                            onClick={() => startEditing(editingId, 'payment_amount', group.paymentAmount || 0)}
                                                                            style={{ cursor: 'pointer', textDecoration: 'underline' }}
                                                                        >
                                                                            ₹{group.paymentAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'right', fontWeight: 600 }}>₹{group.invoiceTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                                <td style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                                                                    {isEditingPaymentMode ? (
                                                                        <div style={{ display: 'flex', gap: '4px' }}>
                                                                            <select
                                                                                value={editing?.value || 'Cash'}
                                                                                onChange={(e) => updateEditingValue(editingId, e.target.value)}
                                                                                style={{ padding: '4px', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '0.85rem', width: '100px' }}
                                                                            >
                                                                                <option value="Cash">Cash</option>
                                                                                <option value="Bank Transfer">Bank Transfer</option>
                                                                                <option value="UPI">UPI</option>
                                                                                <option value="Cheque">Cheque</option>
                                                                            </select>
                                                                            <button
                                                                                onClick={() => handleSave(editingId)}
                                                                                style={{ padding: '4px 8px', background: '#059669', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                                                                            >✓</button>
                                                                            <button
                                                                                onClick={() => cancelEditing(editingId)}
                                                                                style={{ padding: '4px 8px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                                                                            >✗</button>
                                                                        </div>
                                                                    ) : (
                                                                        <span
                                                                            onClick={() => startEditing(editingId, 'payment_mode', group.paymentMode || 'Cash')}
                                                                            style={{ cursor: 'pointer', textDecoration: 'underline' }}
                                                                        >
                                                                            {group.paymentMode || '-'}
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                                                                    {isEditingRemLivincart ? (
                                                                        <div style={{ display: 'flex', gap: '4px' }}>
                                                                            <input
                                                                                type="text"
                                                                                value={editing?.value || ''}
                                                                                onChange={(e) => updateEditingValue(editingId, e.target.value)}
                                                                                style={{ padding: '4px', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '0.85rem', width: '150px' }}
                                                                            />
                                                                            <button
                                                                                onClick={() => handleSave(editingId)}
                                                                                style={{ padding: '4px 8px', background: '#059669', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                                                                            >✓</button>
                                                                            <button
                                                                                onClick={() => cancelEditing(editingId)}
                                                                                style={{ padding: '4px 8px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                                                                            >✗</button>
                                                                        </div>
                                                                    ) : (
                                                                        <span
                                                                            onClick={() => startEditing(editingId, 'remLivincart', group.remLivincart || '')}
                                                                            style={{ cursor: 'pointer', textDecoration: 'underline' }}
                                                                        >
                                                                            {group.remLivincart || '-'}
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'center' }}>
                                                                    <button
                                                                        onClick={() => {
                                                                            if (confirm(`Are you sure you want to delete this group of ${group.items.length} items?`)) {
                                                                                group.ids.forEach((id: string) => handleDelete(id));
                                                                            }
                                                                        }}
                                                                        style={{ padding: '6px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                                                                        title="Delete item"
                                                                    >
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    });
                                                })()}
                                                {(() => {
                                                    // Calculate total bill amount by summing all item totals
                                                    const totalBillAmount = vendor.items.reduce((sum: number, item: any) => sum + parseFloat(item.total || 0), 0);
                                                    const totalPaymentAmount = vendor.items.reduce((sum: number, item: any) => sum + parseFloat(item.paid || 0), 0);
                                                    const totalUnpaid = totalBillAmount - totalPaymentAmount;
                                                    return (
                                                        <>
                                                            <tr style={{ backgroundColor: '#f0fdf4' }}>
                                                                <td colSpan={6} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#166534' }}>Total Bill Amount =</td>
                                                                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#166534' }}>
                                                                    ₹{totalBillAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                </td>
                                                                <td colSpan={3}></td>
                                                            </tr>
                                                            <tr style={{ backgroundColor: '#fef2f2' }}>
                                                                <td colSpan={5} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#991b1b' }}>Total Payment Amount =</td>
                                                                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#991b1b' }}>
                                                                    ₹{totalPaymentAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                </td>
                                                                <td colSpan={4}></td>
                                                            </tr>
                                                            <tr style={{ backgroundColor: '#e2e8f0' }}>
                                                                <td colSpan={5} style={{ padding: '14px 12px', textAlign: 'right', fontWeight: 800, color: '#1e293b' }}>Total Outstanding =</td>
                                                                <td style={{ padding: '14px 12px', textAlign: 'right', fontWeight: 800, color: '#059669', fontSize: '1.05rem' }}>
                                                                    ₹{totalUnpaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                </td>
                                                                <td colSpan={4}></td>
                                                            </tr>
                                                        </>
                                                    );
                                                })()}
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
                            <div className="vendors-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '30px' }}>
                                {globalData[activeTab].map((person: any, index: number) => {
                                    const grouped = person.transactions.reduce((acc: any, t: any) => {
                                        const site = t.site || 'General';
                                        if (!acc[site]) {
                                            acc[site] = { site, total: 0, latest_date: t.transaction_date, items: [] };
                                        }
                                        acc[site].total += parseFloat(t.amount);
                                        acc[site].items.push(t);
                                        if (new Date(t.transaction_date) > new Date(acc[site].latest_date)) {
                                            acc[site].latest_date = t.transaction_date;
                                        }
                                        return acc;
                                    }, {});

                                    const siteGroups = Object.values(grouped);

                                    return (
                                        <div key={index} className="premium-card vendor-card" style={{ backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 15px rgba(0, 0, 0, 0.05)', border: '1px solid #e2e8f0', padding: 0 }}>
                                            <div style={{ backgroundColor: '#f8fafc', padding: '16px', textAlign: 'center', fontWeight: 800, fontSize: '1.1rem', color: '#1e293b', borderBottom: '1px solid #e2e8f0' }}>
                                                {person.person_name}
                                            </div>
                                            <div style={{ padding: '0' }}>
                                                {siteGroups.map((group: any, gIdx: number) => {
                                                    const groupKey = `${person.person_name}-${group.site}-${index}`;
                                                    const isExpanded = !!expandedGroups[groupKey];
                                                    return (
                                                        <div key={gIdx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                            <div
                                                                onClick={() => toggleGroup(groupKey)}
                                                                style={{
                                                                    display: 'grid',
                                                                    gridTemplateColumns: '1fr 120px 140px',
                                                                    padding: '12px 16px',
                                                                    cursor: 'pointer',
                                                                    backgroundColor: isExpanded ? '#f1f5f9' : 'transparent',
                                                                    transition: 'background-color 0.2s',
                                                                    alignItems: 'center'
                                                                }}
                                                            >
                                                                <div style={{ fontWeight: 600, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                                    <span style={{
                                                                        transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                                                        transition: 'transform 0.2s',
                                                                        fontSize: '0.8rem',
                                                                        display: 'inline-block'
                                                                    }}>▶</span>
                                                                    {group.site}
                                                                </div>
                                                                <div style={{ textAlign: 'center', fontSize: '0.85rem', color: '#64748b' }}>
                                                                    {group.latest_date ? new Date(group.latest_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).replace(/ /g, '-') : '-'}
                                                                </div>
                                                                <div style={{ textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                                                                    ₹{group.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                </div>
                                                            </div>

                                                            {isExpanded && (
                                                                <div style={{ backgroundColor: '#f8fafc', padding: '8px 16px 12px 40px', fontSize: '0.85rem' }}>
                                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', color: '#64748b', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', marginBottom: '8px', fontWeight: 600 }}>
                                                                        <div>Description</div>
                                                                        <div style={{ textAlign: 'right' }}>Amount</div>
                                                                    </div>
                                                                    {group.items.map((item: any, iIdx: number) => (
                                                                        <div key={iIdx} style={{ display: 'grid', gridTemplateColumns: '1fr 140px', padding: '4px 0', borderBottom: iIdx === group.items.length - 1 ? 'none' : '1px dashed #e2e8f0' }}>
                                                                            <div style={{ color: '#475569' }}>
                                                                                {item.description || '-'}
                                                                                <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginLeft: '8px' }}>
                                                                                    ({new Date(item.transaction_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })})
                                                                                </span>
                                                                            </div>
                                                                            <div style={{ textAlign: 'right', fontWeight: 500 }}>
                                                                                ₹{parseFloat(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                                <div style={{ backgroundColor: '#e2e8f0', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div style={{ fontWeight: 800, color: '#1e293b' }}>Total {activeTab.toUpperCase()} =</div>
                                                    <div style={{ fontWeight: 800, color: '#059669', fontSize: '1.05rem' }}>
                                                        ₹{person.total_payment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
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
            <style>{`
                @media (max-width: 768px) {
                    .tabs-container {
                        overflow-x: auto !important;
                        white-space: nowrap !important;
                        -webkit-overflow-scrolling: touch;
                        scrollbar-width: none;
                        -ms-overflow-style: none;
                    }
                    .tabs-container::-webkit-scrollbar {
                        display: none;
                    }
                    .tabs-container button {
                        flex-shrink: 0 !important;
                    }
                    .vendors-grid {
                        grid-template-columns: repeat(1, 1fr) !important;
                        gap: 20px !important;
                    }
                    .vendor-card {
                        overflow-x: auto !important;
                        -webkit-overflow-scrolling: touch;
                    }
                    .vendor-card table {
                        min-width: 700px;
                    }
                }
            `}</style>
        </div>
    );
};
