import React, { useState, useEffect } from 'react';
import { 
    Receipt, CheckCircle, XCircle, Clock, Search, Filter, ImageIcon, 
    AlertCircle, X, Calendar, Eye, User, Tag, FileText, RefreshCw, CalendarDays, RotateCcw,
    Download, FileSpreadsheet
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
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Filters
    const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
    const [search, setSearch] = useState('');
    const [selectedMonth, setSelectedMonth] = useState<string>(''); // YYYY-MM
    const [startDate, setStartDate] = useState<string>(''); // YYYY-MM-DD
    const [endDate, setEndDate] = useState<string>(''); // YYYY-MM-DD

    // Year-wise, Project ID & Reason Filters
    const [statementPeriod, setStatementPeriod] = useState<string>('all_time');
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [filterProjectId, setFilterProjectId] = useState<string>('all');
    const [filterReason, setFilterReason] = useState<string>('');

    // Popup & Modals
    const [selectedClaim, setSelectedClaim] = useState<any | null>(null);
    const [rejectModal, setRejectModal] = useState<{ id: number; name: string } | null>(null);
    const [rejectNote, setRejectNote] = useState('');
    const [actionNote, setActionNote] = useState('');
    const [processing, setProcessing] = useState(false);
    const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [imageModal, setImageModal] = useState<string | null>(null);

    const getAuthInfo = () => {
        let uid = user?.user_id;
        let urole = user?.role;
        if (!uid || !urole) {
            const savedUser = localStorage.getItem('Livincart_user') || localStorage.getItem('user');
            if (savedUser) {
                try {
                    const parsed = JSON.parse(savedUser);
                    uid = uid || parsed.user_id;
                    urole = urole || parsed.role;
                } catch {}
            }
        }
        return {
            headers: { 'X-User-Id': uid, 'X-User-Role': urole },
            userId: uid,
            role: urole
        };
    };

    const fetchList = async () => {
        setLoading(true);
        try {
            const auth = getAuthInfo();
            const res = await axios.get(`${API_BASE_URL}/reimbursements?all=1&user_id=${auth.userId || ''}&role=${auth.role || ''}`, { 
                headers: auth.headers 
            });
            if (res.data.success) {
                setList(res.data.data || []);
                // Update selected claim if currently open
                if (selectedClaim) {
                    const updated = (res.data.data || []).find((item: any) => item.id === selectedClaim.id);
                    if (updated) setSelectedClaim(updated);
                }
            }
        } catch { /* ignore */ } finally { setLoading(false); }
    };

    const fetchProjects = async () => {
        try {
            const auth = getAuthInfo();
            const res = await axios.get(`${API_BASE_URL}/projects`, { headers: auth.headers });
            if (res.data?.success && Array.isArray(res.data.data)) {
                setProjects(res.data.data);
            } else if (Array.isArray(res.data?.data)) {
                setProjects(res.data.data);
            } else if (Array.isArray(res.data)) {
                setProjects(res.data);
            }
        } catch { /* ignore */ }
    };

    useEffect(() => { 
        fetchList(); 
        fetchProjects();
    }, [user?.user_id, user?.role]);

    const handleApprove = async (id: number, noteOverride?: string) => {
        setProcessing(true);
        const noteToUse = noteOverride !== undefined ? noteOverride : actionNote;
        const auth = getAuthInfo();
        try {
            const res = await axios.post(`${API_BASE_URL}/reimbursements/approve`, { id, admin_note: noteToUse }, { headers: auth.headers });
            if (res.data.success) { 
                setMsg({ type: 'success', text: res.data.message || 'Reimbursement approved successfully.' }); 
                fetchList(); 
            } else {
                setMsg({ type: 'error', text: res.data.message || 'Approval failed.' }); 
            }
        } catch { setMsg({ type: 'error', text: 'Action failed.' }); }
        finally { setProcessing(false); setActionNote(''); }
    };

    const handleReject = async (idOverride?: number, noteOverride?: string) => {
        const targetId = idOverride ?? rejectModal?.id;
        if (!targetId) return;
        setProcessing(true);
        const noteToUse = noteOverride !== undefined ? noteOverride : rejectNote;
        const auth = getAuthInfo();
        try {
            const res = await axios.post(`${API_BASE_URL}/reimbursements/reject`, { id: targetId, admin_note: noteToUse }, { headers: auth.headers });
            if (res.data.success) { 
                setMsg({ type: 'success', text: res.data.message || 'Reimbursement rejected successfully.' }); 
                fetchList(); 
            } else {
                setMsg({ type: 'error', text: res.data.message || 'Rejection failed.' }); 
            }
        } catch { setMsg({ type: 'error', text: 'Action failed.' }); }
        finally { setProcessing(false); setRejectModal(null); setRejectNote(''); }
    };

    const formatReimbursementId = (id: number | string, createdAt?: string, reimbursementCode?: string) => {
        if (reimbursementCode && String(reimbursementCode).trim() !== '') return String(reimbursementCode).trim();
        const year = createdAt ? new Date(createdAt).getFullYear() : new Date().getFullYear();
        const padded = String(id).padStart(4, '0');
        return `LC-REIM-${year}-${padded}`;
    };

    const getTaggedProjectInfo = (r: any, projectsList: any[] = []) => {
        let code = (r.project_code && r.project_code !== 'null' && r.project_code !== '0' && r.project_code !== 'Office / Other') ? String(r.project_code).trim() : '';
        let name = (r.project_name && r.project_name !== 'null') ? String(r.project_name).trim() : '';
        let id = (r.project_id && r.project_id !== 'null' && r.project_id !== '0' && r.project_id !== 'Office / Other') ? String(r.project_id).trim() : '';

        if (!code || !name) {
            if (id && projectsList.length > 0) {
                const found = projectsList.find(p => String(p.project_id) === id || p.project_code === id);
                if (found) {
                    if (!code) code = found.project_code || `PR_${found.project_id}`;
                    if (!name) name = found.project_name || found.name || '';
                }
            }
        }

        if (!code && !name) {
            const rawReason = r.reason || '';
            const fromToMatch = rawReason.match(/From:\s*([^\->\]|]+)\s*->\s*To:\s*([^\]|]+)/i);
            if (fromToMatch) {
                const fromLoc = fromToMatch[1].trim();
                const toLoc = fromToMatch[2].trim();

                const candidateLoc = (fromLoc !== 'Office' && !fromLoc.toLowerCase().startsWith('other')) 
                    ? fromLoc 
                    : ((toLoc !== 'Office' && !toLoc.toLowerCase().startsWith('other')) ? toLoc : null);

                if (candidateLoc) {
                    const matchedProj = projectsList.find(p => 
                        (p.project_name && p.project_name.toLowerCase() === candidateLoc.toLowerCase()) ||
                        (p.name && p.name.toLowerCase() === candidateLoc.toLowerCase()) ||
                        (p.project_code && p.project_code.toLowerCase() === candidateLoc.toLowerCase())
                    );
                    if (matchedProj) {
                        code = matchedProj.project_code || `PR_${matchedProj.project_id}`;
                        name = matchedProj.project_name || matchedProj.name || candidateLoc;
                        id = String(matchedProj.project_id);
                    } else {
                        name = candidateLoc;
                    }
                }
            }
        }

        const isOffice = !id && !code && !name;
        const displayBadge = code || (id ? (id.startsWith('PR') ? id : `PR_${id}`) : (name || 'Office / Other'));

        return {
            code,
            name,
            id,
            isOffice,
            displayBadge
        };
    };

    const getDisplayProjectId = (r: any) => {
        const info = getTaggedProjectInfo(r, projects);
        return info.isOffice ? null : info.displayBadge;
    };

    const projectOptions = React.useMemo(() => {
        const set = new Set<string>();
        list.forEach(r => {
            const pid = getDisplayProjectId(r);
            if (pid) set.add(pid);
        });
        return Array.from(set).sort();
    }, [list]);

    const parseLocalDate = (rawDate: string | null | undefined): Date | null => {
        if (!rawDate) return null;
        const s = String(rawDate).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
            const [y, m, d] = s.split('-').map(Number);
            return new Date(y, m - 1, d, 0, 0, 0, 0);
        }
        const dt = new Date(rawDate);
        return isNaN(dt.getTime()) ? null : dt;
    };

    const clearFilters = () => {
        setSearch('');
        setFilterStatus('all');
        setSelectedMonth('');
        setStartDate('');
        setEndDate('');
        setStatementPeriod('all_time');
        setSelectedYear(new Date().getFullYear());
        setFilterProjectId('all');
        setFilterReason('');
    };

    const filtered = list.filter(r => {
        // 1. Status Filter (case-insensitive)
        const rStatus = String(r.status || '').toLowerCase().trim();
        const matchStatus = filterStatus === 'all' || rStatus === filterStatus.toLowerCase();

        // 2. Keyword Search
        const q = search.toLowerCase().trim();
        const matchSearch = !q || 
            (r.employee_name && r.employee_name.toLowerCase().includes(q)) || 
            (r.category && r.category.toLowerCase().includes(q)) ||
            (r.reason && r.reason.toLowerCase().includes(q)) ||
            (r.role && r.role.toLowerCase().includes(q)) ||
            (r.project_code && String(r.project_code).toLowerCase().includes(q)) ||
            (r.project_id && String(r.project_id).toLowerCase().includes(q)) ||
            (r.amount && String(r.amount).includes(q)) ||
            (r.id && String(r.id).includes(q));

        // 3. Project ID Filter
        let matchProject = true;
        if (filterProjectId !== 'all') {
            const displayPid = getDisplayProjectId(r);
            matchProject = displayPid ? displayPid.toLowerCase().includes(filterProjectId.toLowerCase()) : false;
        }

        // 4. Reason Filter
        let matchReason = true;
        if (filterReason.trim() !== '') {
            const qReason = filterReason.toLowerCase().trim();
            matchReason = (r.reason || '').toLowerCase().includes(qReason) || (r.description || '').toLowerCase().includes(qReason);
        }

        // 5. Month Filter
        let matchMonth = true;
        if (selectedMonth && r.created_at) {
            matchMonth = r.created_at.slice(0, 7) === selectedMonth;
        }

        // 6. Year-wise / Statement Period Filter
        let matchPeriod = true;
        const rawDate = r.created_at || r.date || r.claim_date;
        if (statementPeriod !== 'all_time') {
            if (!rawDate) {
                matchPeriod = false;
            } else {
                const dt = parseLocalDate(rawDate);
                if (!dt) {
                    matchPeriod = false;
                } else {
                    const now = new Date();
                    if (statementPeriod === 'last_month') {
                        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                        const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
                        matchPeriod = dt >= start && dt <= end;
                    } else if (statementPeriod === 'last_3_months') {
                        const start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
                        matchPeriod = dt >= start;
                    } else if (statementPeriod === 'last_6_months') {
                        const start = new Date(now.getFullYear(), now.getMonth() - 6, 1);
                        matchPeriod = dt >= start;
                    } else if (statementPeriod === 'this_year') {
                        const start = new Date(now.getFullYear(), 0, 1);
                        const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
                        matchPeriod = dt >= start && dt <= end;
                    } else if (statementPeriod === 'by_year') {
                        const yr = selectedYear || now.getFullYear();
                        const start = new Date(yr, 0, 1);
                        const end = new Date(yr, 11, 31, 23, 59, 59);
                        matchPeriod = dt >= start && dt <= end;
                    } else if (statementPeriod === 'custom') {
                        if (startDate) {
                            const startDt = parseLocalDate(startDate);
                            if (startDt && dt < startDt) matchPeriod = false;
                        }
                        if (endDate) {
                            const [ey, em, ed] = endDate.split('-').map(Number);
                            const endMs = new Date(ey, em - 1, ed, 23, 59, 59);
                            if (dt > endMs) matchPeriod = false;
                        }
                    }
                }
            }
        }

        // Custom Date Range fallback
        if (statementPeriod === 'all_time' && (startDate || endDate)) {
            const claimDate = r.created_at ? r.created_at.slice(0, 10) : '';
            if (startDate && claimDate < startDate) matchPeriod = false;
            if (endDate && claimDate > endDate) matchPeriod = false;
        }

        return matchStatus && matchSearch && matchProject && matchReason && matchMonth && matchPeriod;
    });

    const totalPending  = filtered.filter(r => r.status === 'pending').reduce((s, r) => s + parseFloat(r.amount), 0);
    const totalApproved = filtered.filter(r => r.status === 'approved').reduce((s, r) => s + parseFloat(r.amount), 0);
    const totalRejected = filtered.filter(r => r.status === 'rejected').reduce((s, r) => s + parseFloat(r.amount), 0);

    const hasActiveFilters = search || filterStatus !== 'all' || selectedMonth || startDate || endDate || statementPeriod !== 'all_time' || filterProjectId !== 'all' || filterReason !== '';

    const escapeCsv = (val: any) => {
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
    };

    const exportToCSV = () => {
        if (!filtered || filtered.length === 0) {
            alert('No reimbursement records to export.');
            return;
        }

        const headers = [
            'Claim ID',
            'Employee Name',
            'Role',
            'Project',
            'Category',
            'Amount (INR)',
            'Status',
            'Date',
            'Reason / Notes',
            'Admin Review Note',
            'Travel Details',
            'Food Details',
            'Phone Number',
            'Receipt Image URL'
        ];

        const rows = filtered.map(r => {
            const projInfo = getTaggedProjectInfo(r, projects);
            const projDisplay = projInfo.isOffice ? 'General / Office' : projInfo.displayBadge;
            const receiptUrl = r.image_path ? (r.image_path.startsWith('http') ? r.image_path : `${API_BASE_URL}/${r.image_path.replace(/^\//, '')}`) : 'No Receipt';
            
            return [
                `LC-REIM-${r.id}`,
                r.employee_name || 'Staff',
                r.role || '',
                projDisplay,
                r.category || '',
                Number(r.amount || 0).toFixed(2),
                (r.status || 'pending').toUpperCase(),
                r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN') : '',
                r.reason || '',
                r.admin_note || '',
                r.travel_type ? `${r.travel_type} (${r.distance || 0} km from ${r.from_location || ''} to ${r.to_location || ''})` : '',
                r.food_type ? `${r.food_type} (${r.food_from_location || ''} to ${r.food_to_location || ''})` : '',
                r.phone_number || '',
                receiptUrl
            ];
        });

        const csvContent = '\uFEFF' + [
            headers.map(escapeCsv).join(','),
            ...rows.map(row => row.map(escapeCsv).join(','))
        ].join('\r\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Staff_Reimbursements_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const exportToExcel = () => {
        if (!filtered || filtered.length === 0) {
            alert('No reimbursement records to export.');
            return;
        }

        const headers = [
            'Claim ID',
            'Employee Name',
            'Role',
            'Project',
            'Category',
            'Amount (₹)',
            'Status',
            'Date',
            'Reason / Notes',
            'Admin Review Note',
            'Additional Details',
            'Receipt URL'
        ];

        const rows = filtered.map(r => {
            const projInfo = getTaggedProjectInfo(r, projects);
            const projDisplay = projInfo.isOffice ? 'General / Office' : projInfo.displayBadge;
            let details = '';
            if (r.travel_type) details = `${r.travel_type} (${r.distance || 0} km from ${r.from_location || ''} to ${r.to_location || ''})`;
            else if (r.food_type) details = `${r.food_type} (${r.food_from_location || ''} to ${r.food_to_location || ''})`;
            else if (r.phone_number) details = `Phone: ${r.phone_number}`;

            const receiptUrl = r.image_path ? (r.image_path.startsWith('http') ? r.image_path : `${API_BASE_URL}/${r.image_path.replace(/^\//, '')}`) : '';

            return `<tr>
                <td style="border:1px solid #cbd5e1;padding:8px;">LC-REIM-${r.id}</td>
                <td style="border:1px solid #cbd5e1;padding:8px;">${r.employee_name || 'Staff'}</td>
                <td style="border:1px solid #cbd5e1;padding:8px;">${r.role || ''}</td>
                <td style="border:1px solid #cbd5e1;padding:8px;">${projDisplay}</td>
                <td style="border:1px solid #cbd5e1;padding:8px;">${r.category || ''}</td>
                <td style="border:1px solid #cbd5e1;padding:8px;text-align:right;">${Number(r.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                <td style="border:1px solid #cbd5e1;padding:8px;font-weight:bold;color:${r.status === 'approved' ? '#16a34a' : r.status === 'rejected' ? '#dc2626' : '#d97706'};">${(r.status || 'pending').toUpperCase()}</td>
                <td style="border:1px solid #cbd5e1;padding:8px;">${r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN') : ''}</td>
                <td style="border:1px solid #cbd5e1;padding:8px;">${r.reason || ''}</td>
                <td style="border:1px solid #cbd5e1;padding:8px;">${r.admin_note || ''}</td>
                <td style="border:1px solid #cbd5e1;padding:8px;">${details}</td>
                <td style="border:1px solid #cbd5e1;padding:8px;">${receiptUrl ? `<a href="${receiptUrl}">View Receipt</a>` : 'None'}</td>
            </tr>`;
        }).join('');

        const htmlContent = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
            <head>
                <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8"/>
                <style>
                    table { border-collapse: collapse; width: 100%; font-family: Calibri, sans-serif; font-size: 11pt; }
                    th { background-color: #0c1527; color: #ffffff; font-weight: bold; padding: 10px; border: 1px solid #000; text-align: left; }
                    tr:nth-child(even) { background-color: #f8fafc; }
                </style>
            </head>
            <body>
                <h2>Staff Reimbursements Report</h2>
                <p>Generated: ${new Date().toLocaleString('en-IN')} | Total Claims: ${filtered.length}</p>
                <table>
                    <thead>
                        <tr>
                            ${headers.map(h => `<th>${h}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </body>
            </html>
        `;

        const blob = new Blob(['\uFEFF' + htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Staff_Reimbursements_${new Date().toISOString().split('T')[0]}.xls`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <div style={{ padding: '28px 32px', maxWidth: '100%', margin: '0 auto', fontFamily: "'Outfit', sans-serif" }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: '#0c1527', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(12,21,39,0.15)' }}>
                        <Receipt size={26} color="#fca412" />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0c1527', margin: 0, letterSpacing: '-0.02em' }}>Staff Reimbursements</h1>
                        <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0 }}>Review and approve employee expense claims</p>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <button
                        type="button"
                        onClick={exportToExcel}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 15px', borderRadius: 10, backgroundColor: '#f0fdf4', border: '1.5px solid #16a34a', color: '#15803d', fontSize: '0.84rem', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 6px rgba(22,163,74,0.15)' }}
                        title="Export filtered records to formatted Excel spreadsheet (.xls)"
                    >
                        <FileSpreadsheet size={15} color="#16a34a" /> Export Excel
                    </button>
                    <button
                        type="button"
                        onClick={exportToCSV}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 15px', borderRadius: 10, backgroundColor: '#f0f9ff', border: '1.5px solid #0284c7', color: '#0369a1', fontSize: '0.84rem', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 6px rgba(2,132,199,0.15)' }}
                        title="Export filtered records to CSV (.csv)"
                    >
                        <Download size={15} color="#0284c7" /> Export CSV
                    </button>
                    <button 
                        onClick={fetchList}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 10, backgroundColor: '#0c1527', border: '1.5px solid #0c1527', color: '#fca412', fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(12,21,39,0.15)' }}
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
                    </button>
                </div>
            </div>

            {/* Summary KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 28 }}>
                {[
                    { label: 'Filtered Requests', value: filtered.length, color: '#0c1527', bg: '#ffffff', border: '#ffe8c2' },
                    { label: 'Pending Requests', value: filtered.filter(r => r.status === 'pending').length, color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
                    { label: 'Approved Amount', value: `₹${totalApproved.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, subValue: `${filtered.filter(r => r.status === 'approved').length} requests`, color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
                    { label: 'Pending Amount', value: `₹${totalPending.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, subValue: `${filtered.filter(r => r.status === 'pending').length} requests`, color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
                    { label: 'Rejected Amount', value: `₹${totalRejected.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, subValue: `${filtered.filter(r => r.status === 'rejected').length} requests`, color: '#ef4444', bg: '#fff5f5', border: '#fee2e2' },
                ].map((c, i) => (
                    <div key={i} style={{ background: c.bg, borderRadius: 16, padding: '18px 22px', border: `1.5px solid ${c.border}`, boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                        <div style={{ fontSize: '0.75rem', color: c.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>{c.label}</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: c.color }}>{c.value}</div>
                        {c.subValue && <div style={{ fontSize: '0.8rem', color: c.color, opacity: 0.8, marginTop: 2, fontWeight: 600 }}>{c.subValue}</div>}
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
            <div style={{ background: '#ffffff', borderRadius: 16, border: '1.5px solid #ffe8c2', padding: '20px', marginBottom: 24, boxShadow: '0 4px 14px rgba(252,164,18,0.05)' }}>
                {/* Header & Reset Button */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#475569', fontWeight: 700, fontSize: '0.90rem' }}>
                        <Filter size={18} style={{ color: '#ea580c' }} />
                        Filter &amp; Search Staff Reimbursements
                    </div>
                    {hasActiveFilters && (
                        <button 
                            onClick={clearFilters}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, background: '#fef2f2', border: '1.5px solid #ef4444', color: '#ef4444', fontSize: '0.80rem', fontWeight: 800, cursor: 'pointer', boxShadow: '0 2px 6px rgba(239, 68, 68, 0.12)' }}
                        >
                            <RotateCcw size={13} /> Reset Filters
                        </button>
                    )}
                </div>

                {/* Row 1: Search & Status tabs */}
                <div style={{ display: 'flex', gap: 14, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
                        <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input 
                            placeholder="Search employee, category, role, or reason..." 
                            value={search} 
                            onChange={e => setSearch(e.target.value)}
                            style={{ width: '100%', padding: '10px 14px 10px 38px', borderRadius: 10, border: '1.5px solid #ffe8c2', fontSize: '0.88rem', outline: 'none', background: '#fff', color: '#0c1527', fontWeight: 600, boxSizing: 'border-box' }} 
                        />
                        {search && (
                            <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: 6, background: '#fff9f0', padding: 4, borderRadius: 12, border: '1.5px solid #ffe8c2' }}>
                        {(['all', 'pending', 'approved', 'rejected'] as const).map(s => (
                            <button 
                                key={s} 
                                onClick={() => setFilterStatus(s)}
                                style={{ 
                                    padding: '7px 16px', 
                                    borderRadius: 9, 
                                    border: 'none', 
                                    fontSize: '0.82rem', 
                                    fontWeight: 800, 
                                    cursor: 'pointer', 
                                    textTransform: 'capitalize',
                                    transition: 'all 0.15s',
                                    background: filterStatus === s ? '#fca412' : 'transparent',
                                    color: filterStatus === s ? '#ffffff' : '#0c1527',
                                    boxShadow: filterStatus === s ? '0 2px 8px rgba(252,164,18,0.35)' : 'none'
                                }}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Row 2: Year-wise Filter, Project ID Filter, Reason Filter */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, alignItems: 'end', paddingTop: 14, borderTop: '1px dashed #e2e8f0' }}>
                    {/* Statement Period / Year-wise Filter */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Statement Period / Year</label>
                        <select
                            value={statementPeriod}
                            onChange={(e) => setStatementPeriod(e.target.value)}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.84rem', outline: 'none', backgroundColor: '#ffffff', fontWeight: 600 }}
                        >
                            <option value="all_time">All Time</option>
                            <option value="last_month">Last Month</option>
                            <option value="last_3_months">Last 3 Months</option>
                            <option value="last_6_months">Last 6 Months</option>
                            <option value="this_year">This Year</option>
                            <option value="by_year">By Year</option>
                            <option value="custom">Custom Range</option>
                        </select>
                    </div>

                    {/* Dynamic Year Picker for By Year */}
                    {statementPeriod === 'by_year' && (
                        <div>
                            <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Select Year</label>
                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(Number(e.target.value))}
                                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1.5px solid #2563eb', fontSize: '0.84rem', outline: 'none', backgroundColor: '#eff6ff', fontWeight: 800, color: '#1e40af', cursor: 'pointer' }}
                            >
                                {Array.from({ length: 8 }, (_, i) => new Date().getFullYear() - i).map(yr => (
                                    <option key={yr} value={yr}>{yr}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Project ID Filter */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Project ID Filter</label>
                        <select
                            value={filterProjectId}
                            onChange={(e) => setFilterProjectId(e.target.value)}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.84rem', outline: 'none', backgroundColor: '#ffffff', fontWeight: 600 }}
                        >
                            <option value="all">All Project IDs</option>
                            {projectOptions.map(pid => (
                                <option key={pid} value={pid}>{pid}</option>
                            ))}
                        </select>
                    </div>

                    {/* Reason / Description Filter */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Filter by Reason</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type="text"
                                value={filterReason}
                                onChange={(e) => setFilterReason(e.target.value)}
                                placeholder="Filter reason or note..."
                                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.84rem', outline: 'none', boxSizing: 'border-box' }}
                            />
                            {filterReason && (
                                <button onClick={() => setFilterReason('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}>
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Custom Date Pickers (visible when statementPeriod === 'custom') */}
                {(statementPeriod === 'custom' || selectedMonth) && (
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', paddingTop: 14, marginTop: 14, borderTop: '1px dashed #e2e8f0' }}>
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

                        {statementPeriod === 'custom' && (
                            <>
                                <div style={{ width: 1, height: 26, background: '#cbd5e1' }} />
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>
                                        <Calendar size={15} color="#253b50" /> Custom Date Range:
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
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Requests / History Table */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
                <div style={{ padding: '12px 20px', background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#334155' }}>
                            Showing {filtered.length} reimbursement claim{filtered.length !== 1 ? 's' : ''}
                        </span>
                        <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>
                            • Click any row to view full details
                        </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                            type="button"
                            onClick={exportToExcel}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '6px 12px',
                                borderRadius: 8,
                                border: '1.5px solid #16a34a',
                                background: '#f0fdf4',
                                color: '#15803d',
                                fontSize: '0.78rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                            }}
                            title="Export filtered records to formatted Excel spreadsheet (.xls)"
                        >
                            <FileSpreadsheet size={14} color="#16a34a" /> Export Excel
                        </button>
                        <button
                            type="button"
                            onClick={exportToCSV}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '6px 12px',
                                borderRadius: 8,
                                border: '1.5px solid #0284c7',
                                background: '#f0f9ff',
                                color: '#0369a1',
                                fontSize: '0.78rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                            }}
                            title="Export filtered records to CSV (.csv)"
                        >
                            <Download size={14} color="#0284c7" /> Export CSV
                        </button>
                    </div>
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
                                    {['Claim ID', 'Employee', 'Role', 'Project ID', 'Category', 'Reason', 'Amount', 'Date', 'Status', 'Receipt', 'Actions'].map(h => (
                                        <th key={h} style={{ padding: '12px 16px', textAlign: h === 'Actions' ? 'center' : 'left', fontSize: '0.73rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.6, whiteSpace: 'nowrap' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((r, i) => {
                                    const claimCode = formatReimbursementId(r.id, r.created_at, r.reimbursement_code);
                                    const projInfo = getTaggedProjectInfo(r, projects);

                                    return (
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
                                        {/* Claim ID */}
                                        <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                                            <span style={{ fontWeight: 800, color: '#0c1527', fontFamily: 'monospace', fontSize: '0.8rem', background: '#f8fafc', padding: '3px 8px', borderRadius: 6, border: '1px solid #e2e8f0', letterSpacing: '0.3px' }}>
                                                {claimCode}
                                            </span>
                                        </td>

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

                                        {/* Project ID */}
                                        <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                                            {projInfo.isOffice ? (
                                                <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>General</span>
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                    <span style={{ background: '#0c1527', color: '#fca412', padding: '3px 8px', borderRadius: 5, fontWeight: 800, fontSize: '0.76rem', letterSpacing: '0.3px', width: 'fit-content' }}>
                                                        {projInfo.code || (projInfo.id ? (projInfo.id.startsWith('PR') ? projInfo.id : `PR_${projInfo.id}`) : 'Project')}
                                                    </span>
                                                    {projInfo.name && (
                                                        <span style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 600, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={projInfo.name}>
                                                            {projInfo.name}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
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
                                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fca412', color: '#ffffff', border: 'none', borderRadius: 8, padding: '5px 11px', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 800, boxShadow: '0 2px 6px rgba(252,164,18,0.3)' }}
                                                >
                                                    <ImageIcon size={13} /> View
                                                </button>
                                            ) : <span style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>—</span>}
                                        </td>

                                        {/* Actions: Approve / Reject for pending claims */}
                                        <td style={{ padding: '14px 16px', whiteSpace: 'nowrap', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                                            {String(r.status).toLowerCase() === 'pending' ? (
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handleApprove(r.id); }}
                                                        disabled={processing}
                                                        title="Approve this claim"
                                                        style={{ 
                                                            display: 'inline-flex', 
                                                            alignItems: 'center', 
                                                            gap: 4, 
                                                            padding: '6px 12px', 
                                                            borderRadius: 8, 
                                                            backgroundColor: '#10b981', 
                                                            color: '#ffffff', 
                                                            border: 'none', 
                                                            fontSize: '0.78rem', 
                                                            fontWeight: 800, 
                                                            cursor: processing ? 'not-allowed' : 'pointer', 
                                                            boxShadow: '0 2px 6px rgba(16,185,129,0.3)', 
                                                            transition: 'all 0.15s' 
                                                        }}
                                                    >
                                                        <CheckCircle size={13} /> Approve
                                                    </button>

                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); setRejectModal({ id: r.id, name: r.employee_name || 'Staff' }); }}
                                                        disabled={processing}
                                                        title="Reject this claim"
                                                        style={{ 
                                                            display: 'inline-flex', 
                                                            alignItems: 'center', 
                                                            gap: 4, 
                                                            padding: '6px 12px', 
                                                            borderRadius: 8, 
                                                            backgroundColor: '#ef4444', 
                                                            color: '#ffffff', 
                                                            border: 'none', 
                                                            fontSize: '0.78rem', 
                                                            fontWeight: 800, 
                                                            cursor: processing ? 'not-allowed' : 'pointer', 
                                                            boxShadow: '0 2px 6px rgba(239,68,68,0.3)', 
                                                            transition: 'all 0.15s' 
                                                        }}
                                                    >
                                                        <XCircle size={13} /> Reject
                                                    </button>
                                                </div>
                                            ) : String(r.status).toLowerCase() === 'approved' ? (
                                                <span style={{ fontSize: '0.76rem', color: '#059669', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4, background: '#ecfdf5', padding: '4px 10px', borderRadius: 20, border: '1px solid #a7f3d0' }}>
                                                    <CheckCircle size={12} /> Approved
                                                </span>
                                            ) : (
                                                <span style={{ fontSize: '0.76rem', color: '#dc2626', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fef2f2', padding: '4px 10px', borderRadius: 20, border: '1px solid #fecaca' }}>
                                                    <XCircle size={12} /> Rejected
                                                </span>
                                            )}
                                        </td>

                                    </tr>
                                ); })}
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
                    <div onClick={e => e.stopPropagation()} className="modal-box" style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 580, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', border: '1px solid #e2e8f0' }}>
                            {/* Sticky Modal Header */}
                            <div className="modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1.5px solid #f1f5f9', padding: '18px 24px', backgroundColor: '#fff', borderRadius: '20px 20px 0 0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#0c1527,#253b50)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(12,21,39,0.15)' }}>
                                        <Receipt size={22} color="#fca412" />
                                    </div>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>Claim Details</h3>
                                            <span style={{ background: '#0c1527', color: '#fca412', border: '1px solid #1e293b', padding: '2px 9px', borderRadius: 6, fontSize: '0.8rem', fontWeight: 800, fontFamily: 'monospace', letterSpacing: '0.5px' }}>
                                                {formatReimbursementId(selectedClaim.id, selectedClaim.created_at, selectedClaim.reimbursement_code)}
                                            </span>
                                        </div>
                                        <p style={{ color: '#64748b', fontSize: '0.8rem', margin: '3px 0 0' }}>Submitted on {new Date(selectedClaim.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedClaim(null)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}>
                                    <X size={18} />
                                </button>
                            </div>{/* end modal-header */}

                            {/* Scrollable Body */}
                            <div className="modal-body" style={{ padding: '24px' }}>

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
                            {(() => {
                                const modalProjInfo = getTaggedProjectInfo(selectedClaim, projects);
                                return (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.3fr', gap: 12, marginBottom: 18 }}>
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

                                        {/* Tagged Project Card */}
                                        <div style={{ background: '#e0e7ff', padding: '12px 14px', borderRadius: 12, border: '1.5px solid #c7d2fe' }}>
                                            <div style={{ fontSize: '0.72rem', color: '#3730a3', fontWeight: 800, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                                                Tagged Project
                                            </div>
                                            {modalProjInfo.isOffice ? (
                                                <div style={{ fontWeight: 800, color: '#475569', fontSize: '0.92rem' }}>Office / Other</div>
                                            ) : (
                                                <div>
                                                    <div style={{ fontWeight: 800, color: '#1e1b4b', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                                        {modalProjInfo.code && (
                                                            <span style={{ background: '#312e81', color: '#fff', padding: '1px 7px', borderRadius: 5, fontSize: '0.8rem', fontWeight: 800 }}>
                                                                {modalProjInfo.code}
                                                            </span>
                                                        )}
                                                        <span>{modalProjInfo.name || 'Project'}</span>
                                                    </div>
                                                    {modalProjInfo.id && modalProjInfo.id !== 'Office / Other' && modalProjInfo.id !== '0' && (
                                                        <div style={{ fontSize: '0.74rem', color: '#4338ca', fontWeight: 700, marginTop: 4 }}>
                                                            Project Tagged ID: {modalProjInfo.id.startsWith('PR') ? modalProjInfo.id : `PR_${modalProjInfo.id}`}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}

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
                            {String(selectedClaim.status).toLowerCase() === 'pending' ? (
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

