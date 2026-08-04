import React, { useState, useEffect } from 'react';
import { 
    Receipt, CheckCircle, XCircle, Clock, Search, Filter, ImageIcon, 
    AlertCircle, X, Calendar, Eye, User, Tag, FileText, RefreshCw, CalendarDays
} from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useAuth } from '../hooks/useAuth';

const CATEGORY_COLORS: Record<string, string> = {
    Food: '#f59e0b', Travel: '#253b50', Fuel: '#253b50', Material: '#10b981', Recharge: '#8b5cf6', Other: '#64748b',
};

const statusBadge = (status: string) => {
    const map: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
        pending:  { color: '#f59e0b', label: 'Pending', icon: <Clock size={12} /> },
        approved: { color: '#10b981', label: 'Approved', icon: <CheckCircle size={12} /> },
        rejected: { color: '#ef4444', label: 'Rejected', icon: <XCircle size={12} /> },
    };
    const s = map[status] ?? map['pending'];
    return (
        <span style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: 4, 
            padding: '4px 12px', 
            borderRadius: 20, 
            backgroundColor: s.color + '18', 
            color: s.color, 
            fontWeight: 700, 
            fontSize: '0.75rem',
            border: `1px solid ${s.color}40`
        }}>
            {s.icon} {s.label}
        </span>
    );
};

export default function StaffReimbursements() {
    const { user } = useAuth();
    const [list, setList] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Filters
    const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
    const [search, setSearch] = useState('');
    const [selectedMonth, setSelectedMonth] = useState<string>(''); // YYYY-MM
    const [startDate, setStartDate] = useState<string>(''); // YYYY-MM-DD
    const [endDate, setEndDate] = useState<string>(''); // YYYY-MM-DD

    // Popup & Modals
    const [selectedClaim, setSelectedClaim] = useState<any | null>(null);
    const [rejectModal, setRejectModal] = useState<{ id: number; name: string } | null>(null);
    const [rejectNote, setRejectNote] = useState('');
    const [actionNote, setActionNote] = useState('');
    const [processing, setProcessing] = useState(false);
    const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [imageModal, setImageModal] = useState<string | null>(null);

    const headers = { 'X-User-Id': user?.user_id, 'X-User-Role': user?.role };

    const fetchList = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/reimbursements`, { headers });
            if (res.data.success) {
                setList(res.data.data);
                // Update selected claim if currently open
                if (selectedClaim) {
                    const updated = res.data.data.find((item: any) => item.id === selectedClaim.id);
                    if (updated) setSelectedClaim(updated);
                }
            }
        } catch { /* ignore */ } finally { setLoading(false); }
    };

    useEffect(() => { fetchList(); }, []);

    const handleApprove = async (id: number, noteOverride?: string) => {
        setProcessing(true);
        const noteToUse = noteOverride !== undefined ? noteOverride : actionNote;
        try {
            const res = await axios.post(`${API_BASE_URL}/reimbursements/approve`, { id, admin_note: noteToUse }, { headers });
            if (res.data.success) { 
                setMsg({ type: 'success', text: res.data.message }); 
                fetchList(); 
            } else {
                setMsg({ type: 'error', text: res.data.message }); 
            }
        } catch { setMsg({ type: 'error', text: 'Action failed.' }); }
        finally { setProcessing(false); setActionNote(''); }
    };

    const handleReject = async (idOverride?: number, noteOverride?: string) => {
        const targetId = idOverride ?? rejectModal?.id;
        if (!targetId) return;
        setProcessing(true);
        const noteToUse = noteOverride !== undefined ? noteOverride : rejectNote;
        try {
            const res = await axios.post(`${API_BASE_URL}/reimbursements/reject`, { id: targetId, admin_note: noteToUse }, { headers });
            if (res.data.success) { 
                setMsg({ type: 'success', text: res.data.message }); 
                fetchList(); 
            } else {
                setMsg({ type: 'error', text: res.data.message }); 
            }
        } catch { setMsg({ type: 'error', text: 'Action failed.' }); }
        finally { setProcessing(false); setRejectModal(null); setRejectNote(''); }
    };

    const clearFilters = () => {
        setSearch('');
        setFilterStatus('all');
        setSelectedMonth('');
        setStartDate('');
        setEndDate('');
    };

    const filtered = list.filter(r => {
        const matchStatus = filterStatus === 'all' || r.status === filterStatus;
        const matchSearch = !search || 
            r.employee_name?.toLowerCase().includes(search.toLowerCase()) || 
            r.category?.toLowerCase().includes(search.toLowerCase()) ||
            r.reason?.toLowerCase().includes(search.toLowerCase()) ||
            r.role?.toLowerCase().includes(search.toLowerCase());
        
        let matchMonth = true;
        if (selectedMonth && r.created_at) {
            matchMonth = r.created_at.slice(0, 7) === selectedMonth;
        }

        let matchDateRange = true;
        const claimDate = r.created_at ? r.created_at.slice(0, 10) : '';
        if (startDate && claimDate < startDate) matchDateRange = false;
        if (endDate && claimDate > endDate) matchDateRange = false;

        return matchStatus && matchSearch && matchMonth && matchDateRange;
    });

    const totalPending  = filtered.filter(r => r.status === 'pending').reduce((s, r) => s + parseFloat(r.amount), 0);
    const totalApproved = filtered.filter(r => r.status === 'approved').reduce((s, r) => s + parseFloat(r.amount), 0);

    const hasActiveFilters = search || filterStatus !== 'all' || selectedMonth || startDate || endDate;

    return (
        <div style={{ padding: '28px 32px', maxWidth: '100%', margin: '0 auto', fontFamily: "'Outfit', sans-serif" }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg,#253b50,#3b5066)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(37,59,80,0.25)' }}>
                        <Receipt size={26} color="#fff" />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#1e293b', margin: 0, letterSpacing: '-0.02em' }}>Staff Reimbursements</h1>
                        <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0 }}>Review and approve employee expense claims</p>
                    </div>
                </div>

                <button 
                    onClick={fetchList}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, background: '#fff', border: '1.5px solid #e2e8f0', color: '#475569', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
                </button>
            </div>

            {/* Summary KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
                {[
                    { label: 'Filtered Requests', value: filtered.length, color: '#253b50', bg: '#f8fafc', border: '#cbd5e1' },
                    { label: 'Pending Requests', value: filtered.filter(r => r.status === 'pending').length, color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
                    { label: 'Approved Amount', value: `₹${totalApproved.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
                    { label: 'Pending Amount', value: `₹${totalPending.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
                ].map((c, i) => (
                    <div key={i} style={{ background: c.bg, borderRadius: 16, padding: '18px 22px', border: `1.5px solid ${c.border}`, boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
                        <div style={{ fontSize: '0.75rem', color: c.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>{c.label}</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: c.color }}>{c.value}</div>
                    </div>
                ))}
            </div>

            {/* Global alert message */}
            {msg && (
                <div style={{ padding: '12px 18px', borderRadius: 12, marginBottom: 20, background: msg.type === 'success' ? '#ecfdf5' : '#fef2f2', border: `1px solid ${msg.type === 'success' ? '#a7f3d0' : '#fecaca'}`, color: msg.type === 'success' ? '#047857' : '#b91c1c', fontSize: '0.88rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                        {msg.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />} {msg.text}
                    </span>
                    <button onClick={() => setMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}><X size={16} /></button>
                </div>
            )}

            {/* Filter Bar */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #e2e8f0', padding: '20px', marginBottom: 24, boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
                {/* Row 1: Search & Status tabs */}
                <div style={{ display: 'flex', gap: 14, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
                        <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input 
                            placeholder="Search employee, category, role, or reason..." 
                            value={search} 
                            onChange={e => setSearch(e.target.value)}
                            style={{ width: '100%', padding: '10px 14px 10px 38px', borderRadius: 10, border: '1.5px solid #cbd5e1', fontSize: '0.88rem', outline: 'none', background: '#f8fafc' }} 
                        />
                        {search && (
                            <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: 6, background: '#f1f5f9', padding: 4, borderRadius: 12 }}>
                        {(['all', 'pending', 'approved', 'rejected'] as const).map(s => (
                            <button 
                                key={s} 
                                onClick={() => setFilterStatus(s)}
                                style={{ 
                                    padding: '7px 16px', 
                                    borderRadius: 9, 
                                    border: 'none', 
                                    fontSize: '0.82rem', 
                                    fontWeight: 700, 
                                    cursor: 'pointer', 
                                    textTransform: 'capitalize',
                                    transition: 'all 0.15s',
                                    background: filterStatus === s ? '#253b50' : 'transparent',
                                    color: filterStatus === s ? '#fff' : '#64748b',
                                    boxShadow: filterStatus === s ? '0 2px 6px rgba(37,59,80,0.2)' : 'none'
                                }}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Row 2: Month Filter & Date Range Filter */}
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', paddingTop: 14, borderTop: '1px dashed #e2e8f0' }}>
                    {/* Month Picker */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>
                            <CalendarDays size={15} color="#253b50" /> Month Filter:
                        </label>
                        <input 
                            type="month"
                            value={selectedMonth}
                            onChange={e => setSelectedMonth(e.target.value)}
                            style={{ padding: '7px 12px', borderRadius: 9, border: '1.5px solid #cbd5e1', fontSize: '0.85rem', color: '#1e293b', background: '#fff', outline: 'none', cursor: 'pointer' }}
                        />
                        {selectedMonth && (
                            <button onClick={() => setSelectedMonth('')} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}>
                                <X size={12} />
                            </button>
                        )}
                    </div>

                    <div style={{ width: 1, height: 26, background: '#cbd5e1' }} />

                    {/* Date Range Picker */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>
                            <Calendar size={15} color="#253b50" /> Date Range:
                        </label>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>From</span>
                            <input 
                                type="date"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                                style={{ padding: '7px 12px', borderRadius: 9, border: '1.5px solid #cbd5e1', fontSize: '0.85rem', color: '#1e293b', background: '#fff', outline: 'none' }}
                            />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>To</span>
                            <input 
                                type="date"
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                                style={{ padding: '7px 12px', borderRadius: 9, border: '1.5px solid #cbd5e1', fontSize: '0.85rem', color: '#1e293b', background: '#fff', outline: 'none' }}
                            />
                        </div>
                    </div>

                    {/* Reset button */}
                    {hasActiveFilters && (
                        <button 
                            onClick={clearFilters}
                            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 9, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                        >
                            <X size={14} /> Clear All Filters
                        </button>
                    )}
                </div>
            </div>

            {/* Requests / History Table */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
                <div style={{ padding: '14px 20px', background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#334155' }}>
                        Showing {filtered.length} reimbursement claim{filtered.length !== 1 ? 's' : ''}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>
                        💡 Click any row in the history table to view detailed claim popup
                    </span>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
                        <RefreshCw size={28} className="animate-spin" style={{ marginBottom: 12 }} />
                        <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>Loading reimbursement claims...</div>
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
                        <Receipt size={48} style={{ opacity: 0.25, marginBottom: 12 }} /><br />
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>No reimbursement claims found</div>
                        <div style={{ fontSize: '0.85rem' }}>Try adjusting your filters or date range</div>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #e2e8f0' }}>
                                    {['Employee', 'Role', 'Category', 'Reason', 'Amount', 'Date', 'Status', 'Receipt', 'Quick Actions'].map(h => (
                                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.73rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.6, whiteSpace: 'nowrap' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((r, i) => (
                                    <tr 
                                        key={r.id} 
                                        onClick={() => setSelectedClaim(r)}
                                        style={{ 
                                            borderBottom: '1px solid #f1f5f9', 
                                            background: i % 2 === 0 ? '#fff' : '#fafafa', 
                                            cursor: 'pointer',
                                            transition: 'background 0.15s, transform 0.1s'
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.background = '#f0f4f8')}
                                        onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#fafafa')}
                                    >
                                        {/* Employee */}
                                        <td style={{ padding: '14px 16px', fontWeight: 700, color: '#1e293b', fontSize: '0.88rem', whiteSpace: 'nowrap' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#253b5015', color: '#253b50', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.75rem' }}>
                                                    {r.employee_name ? r.employee_name.charAt(0).toUpperCase() : 'U'}
                                                </div>
                                                <span>{r.employee_name}</span>
                                            </div>
                                        </td>

                                        {/* Role */}
                                        <td style={{ padding: '14px 16px' }}>
                                            <span style={{ background: '#f1f5f9', color: '#475569', padding: '3px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700 }}>{r.role}</span>
                                        </td>

                                        {/* Category */}
                                        <td style={{ padding: '14px 16px' }}>
                                            <span style={{ background: (CATEGORY_COLORS[r.category] ?? '#253b50') + '20', color: CATEGORY_COLORS[r.category] ?? '#253b50', padding: '3px 10px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 700 }}>{r.category}</span>
                                        </td>

                                        {/* Reason / Notes */}
                                        <td style={{ padding: '14px 16px', fontSize: '0.84rem', color: '#475569', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {r.reason ? (r.reason.replace(/\[.*?\]/g, '').trim() || '—') : '—'}
                                        </td>

                                        {/* Amount */}
                                        <td style={{ padding: '14px 16px', fontWeight: 800, color: '#1e293b', fontSize: '0.95rem', whiteSpace: 'nowrap' }}>
                                            ₹{parseFloat(r.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>

                                        {/* Date */}
                                        <td style={{ padding: '14px 16px', fontSize: '0.8rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                                            {r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                        </td>

                                        {/* Status */}
                                        <td style={{ padding: '14px 16px' }}>{statusBadge(r.status)}</td>

                                        {/* Receipt */}
                                        <td style={{ padding: '14px 16px' }}>
                                            {r.image_path ? (
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); setImageModal(r.image_path.startsWith('http') ? r.image_path : `${API_BASE_URL}/${r.image_path.replace(/^\//, '')}`); }}
                                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 700 }}
                                                >
                                                    <ImageIcon size={13} /> View
                                                </button>
                                            ) : <span style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>—</span>}
                                        </td>

                                        {/* Actions */}
                                        <td style={{ padding: '14px 16px' }}>
                                            {r.status === 'pending' ? (
                                                <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                                                    <button 
                                                        onClick={() => handleApprove(r.id)} 
                                                        disabled={processing}
                                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}
                                                    >
                                                        <CheckCircle size={13} /> Approve
                                                    </button>
                                                    <button 
                                                        onClick={() => setRejectModal({ id: r.id, name: r.employee_name })} 
                                                        disabled={processing}
                                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}
                                                    >
                                                        <XCircle size={13} /> Reject
                                                    </button>
                                                </div>
                                            ) : (
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); setSelectedClaim(r); }}
                                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 600 }}
                                                >
                                                    <Eye size={13} /> Details
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Claim Details Popup Modal */}
            {selectedClaim && (() => {
                const rawReason = selectedClaim.reason || '';
                let fromLoc = 'Office';
                let toLoc = 'Office';
                let mealType = '';
                let travelType = '';
                let distance = '';
                let phone = '';
                let period = '';

                const fromToMatch = rawReason.match(/From:\s*([^\->\]|]+)\s*->\s*To:\s*([^\]|]+)/i);
                if (fromToMatch) {
                    fromLoc = fromToMatch[1].trim();
                    toLoc = fromToMatch[2].trim();
                }

                const foodMatch = rawReason.match(/Food:\s*([^|\]]+)/i);
                if (foodMatch) mealType = foodMatch[1].trim();

                const travelMatch = rawReason.match(/Travel:\s*([^|\]]+)(?:\s*\|\s*([^|\]]+))?/i);
                if (travelMatch) {
                    travelType = travelMatch[1].trim();
                    if (travelMatch[2] && travelMatch[2].includes('km')) distance = travelMatch[2].trim();
                }

                const distMatch = rawReason.match(/(\d+(?:\.\d+)?\s*km)/i);
                if (distMatch && !distance) distance = distMatch[1].trim();

                const phoneMatch = rawReason.match(/Phone\s*([0-9+\s\-]+)/i);
                if (phoneMatch) phone = phoneMatch[1].trim();

                const periodMatch = rawReason.match(/Period:\s*([^\]|]+)/i);
                if (periodMatch) period = periodMatch[1].trim();

                let cleanNotes = rawReason.replace(/\[.*?\]/g, '').trim();

                return (
                    <div onClick={() => setSelectedClaim(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
                        <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, padding: 30, width: '100%', maxWidth: 580, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', border: '1px solid #e2e8f0' }}>
                            {/* Modal Header */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, borderBottom: '1.5px solid #f1f5f9', paddingBottom: 14 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#253b50,#3b5066)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Receipt size={22} color="#fff" />
                                    </div>
                                    <div>
                                        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>Claim Details #{selectedClaim.id}</h3>
                                        <p style={{ color: '#64748b', fontSize: '0.8rem', margin: '2px 0 0' }}>Submitted on {new Date(selectedClaim.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedClaim(null)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}>
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Status & Amount Banner */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', padding: '14px 18px', borderRadius: 14, marginBottom: 18, border: '1.5px solid #e2e8f0' }}>
                                <div>
                                    <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, display: 'block', marginBottom: 2 }}>Status</span>
                                    {statusBadge(selectedClaim.status)}
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, display: 'block', marginBottom: 2 }}>Claim Amount</span>
                                    <span style={{ fontSize: '1.45rem', fontWeight: 800, color: '#253b50' }}>₹{parseFloat(selectedClaim.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                            </div>

                            {/* Metadata Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
                                <div style={{ background: '#fafafa', padding: '12px 14px', borderRadius: 12, border: '1px solid #f1f5f9' }}>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <User size={13} /> Employee
                                    </div>
                                    <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '0.92rem' }}>{selectedClaim.employee_name}</div>
                                    <div style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 500 }}>Role: {selectedClaim.role}</div>
                                </div>

                                <div style={{ background: '#fafafa', padding: '12px 14px', borderRadius: 12, border: '1px solid #f1f5f9' }}>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <Tag size={13} /> Expense Category
                                    </div>
                                    <div style={{ fontWeight: 800, color: CATEGORY_COLORS[selectedClaim.category] ?? '#253b50', fontSize: '0.92rem' }}>{selectedClaim.category}</div>
                                </div>
                            </div>

                            {/* Dynamic Details Box */}
                            <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 14, padding: 16, marginBottom: 18 }}>
                                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#253b50', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                    📋 Submitted Locations & Attributes
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                    {/* From */}
                                    <div style={{ background: '#fff', padding: '10px 12px', borderRadius: 10, border: '1px solid #cbd5e1' }}>
                                        <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, display: 'block', textTransform: 'uppercase' }}>📍 From Location / Project</span>
                                        <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}>{fromLoc}</span>
                                    </div>

                                    {/* To */}
                                    <div style={{ background: '#fff', padding: '10px 12px', borderRadius: 10, border: '1px solid #cbd5e1' }}>
                                        <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, display: 'block', textTransform: 'uppercase' }}>🏁 To Location / Project</span>
                                        <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}>{toLoc}</span>
                                    </div>

                                    {/* Meal Type */}
                                    {mealType && (
                                        <div style={{ background: '#fff', padding: '10px 12px', borderRadius: 10, border: '1px solid #cbd5e1' }}>
                                            <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, display: 'block', textTransform: 'uppercase' }}>🍔 Meal Type</span>
                                            <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#b45309' }}>{mealType}</span>
                                        </div>
                                    )}

                                    {/* Travel Mode */}
                                    {travelType && (
                                        <div style={{ background: '#fff', padding: '10px 12px', borderRadius: 10, border: '1px solid #cbd5e1' }}>
                                            <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, display: 'block', textTransform: 'uppercase' }}>🚕 Travel Mode</span>
                                            <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0284c7' }}>{travelType}</span>
                                        </div>
                                    )}

                                    {/* Distance */}
                                    {distance && (
                                        <div style={{ background: '#fff', padding: '10px 12px', borderRadius: 10, border: '1px solid #cbd5e1' }}>
                                            <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, display: 'block', textTransform: 'uppercase' }}>📏 Distance</span>
                                            <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}>{distance}</span>
                                        </div>
                                    )}

                                    {/* Recharge Phone */}
                                    {phone && (
                                        <div style={{ background: '#fff', padding: '10px 12px', borderRadius: 10, border: '1px solid #cbd5e1' }}>
                                            <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, display: 'block', textTransform: 'uppercase' }}>📱 Phone Number</span>
                                            <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#6d28d9' }}>{phone}</span>
                                        </div>
                                    )}

                                    {/* Recharge Period */}
                                    {period && (
                                        <div style={{ background: '#fff', padding: '10px 12px', borderRadius: 10, border: '1px solid #cbd5e1', gridColumn: 'span 2' }}>
                                            <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, display: 'block', textTransform: 'uppercase' }}>📅 Recharge Period</span>
                                            <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#6d28d9' }}>{period}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Description / Custom Notes */}
                            <div style={{ marginBottom: 18 }}>
                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <FileText size={14} /> Description / Notes
                                </div>
                                <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 12, border: '1px solid #e2e8f0', color: '#334155', fontSize: '0.86rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                                    {cleanNotes}
                                </div>
                            </div>

                            {/* Receipt Image */}
                            <div style={{ marginBottom: 22 }}>
                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <ImageIcon size={14} /> Attached Receipt
                                </div>
                                {selectedClaim.image_path ? (
                                    <div 
                                        onClick={() => setImageModal(selectedClaim.image_path ? (selectedClaim.image_path.startsWith('http') ? selectedClaim.image_path : `${API_BASE_URL}/${selectedClaim.image_path.replace(/^\//, '')}`) : '')}
                                        style={{ border: '1.5px solid #e2e8f0', borderRadius: 12, padding: 10, background: '#f8fafc', textAlign: 'center', cursor: 'pointer' }}
                                    >
                                        <img 
                                            src={selectedClaim.image_path.startsWith('http') ? selectedClaim.image_path : `${API_BASE_URL}/${selectedClaim.image_path.replace(/^\//, '')}`} 
                                            alt="Receipt Attachment" 
                                            style={{ maxHeight: 170, maxWidth: '100%', borderRadius: 8, objectFit: 'contain' }}
                                        />
                                        <div style={{ fontSize: '0.75rem', color: '#0284c7', fontWeight: 600, marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                                            <Eye size={12} /> Click to expand full receipt image
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: 10, border: '1px solid #e2e8f0', color: '#94a3b8', fontSize: '0.82rem', textAlign: 'center' }}>
                                        No receipt image attached with this claim.
                                    </div>
                                )}
                            </div>

                            {/* Admin Review / Action Section */}
                            {selectedClaim.status === 'pending' ? (
                                <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', padding: 18, borderRadius: 14, marginBottom: 20 }}>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#b45309', marginBottom: 8 }}>Admin Review Note (Optional)</div>
                                    <textarea 
                                        rows={2}
                                        placeholder="Add approval/rejection note or comments..."
                                        value={actionNote}
                                        onChange={e => setActionNote(e.target.value)}
                                        style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #fcd34d', fontSize: '0.85rem', outline: 'none', background: '#fff', fontFamily: 'inherit', resize: 'vertical', marginBottom: 14 }}
                                    />
                                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                                        <button 
                                            onClick={() => handleReject(selectedClaim.id, actionNote)} 
                                            disabled={processing}
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 20px', borderRadius: 10, background: '#ef4444', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}
                                        >
                                            <XCircle size={15} /> Reject Claim
                                        </button>
                                        <button 
                                            onClick={() => handleApprove(selectedClaim.id, actionNote)} 
                                            disabled={processing}
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 20px', borderRadius: 10, background: '#10b981', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}
                                        >
                                            <CheckCircle size={15} /> Approve Claim
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: 16, borderRadius: 12, marginBottom: 20 }}>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Admin Review Note:</div>
                                    <div style={{ fontSize: '0.85rem', color: selectedClaim.admin_note ? '#1e293b' : '#94a3b8', fontStyle: selectedClaim.admin_note ? 'normal' : 'italic' }}>
                                        {selectedClaim.admin_note || 'No review notes provided.'}
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button 
                                    onClick={() => setSelectedClaim(null)}
                                    style={{ padding: '9px 22px', borderRadius: 10, background: '#253b50', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}
                                >
                                    Close Details
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Quick Reject Modal */}
            {rejectModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: '#fff', borderRadius: 18, padding: 32, width: 440, boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>Reject Request</h3>
                        <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: 18 }}>Rejecting claim from <strong>{rejectModal.name}</strong>. Please provide a reason.</p>
                        <textarea rows={3} placeholder="Reason for rejection (optional)..." value={rejectNote} onChange={e => setRejectNote(e.target.value)}
                            style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.88rem', marginBottom: 18, outline: 'none', fontFamily: 'inherit', resize: 'vertical' }} />
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                            <button onClick={() => { setRejectModal(null); setRejectNote(''); }}
                                style={{ padding: '9px 20px', borderRadius: 10, border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                            <button onClick={() => handleReject()} disabled={processing}
                                style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>
                                {processing ? 'Processing...' : 'Reject'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Image Full-view Modal */}
            {imageModal && (
                <div onClick={() => setImageModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, cursor: 'pointer', padding: 20 }}>
                    <div style={{ position: 'relative' }}>
                        <img src={imageModal} alt="Receipt" style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: 12, boxShadow: '0 24px 64px rgba(0,0,0,0.5)', objectFit: 'contain' }} />
                        <button onClick={() => setImageModal(null)} style={{ position: 'absolute', top: -14, right: -14, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                            <X size={18} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

