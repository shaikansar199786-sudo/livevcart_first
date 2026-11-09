import React, { useState, useEffect, useRef } from 'react';
import { 
    Receipt, Upload, CheckCircle, XCircle, Clock, AlertCircle, Plus, X, 
    ImageIcon, Calendar, CalendarDays, Search, Eye, Tag, FileText, User,
    Navigation, Phone, MapPin, Car, ArrowRight, Download, FileSpreadsheet
} from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useAuth } from '../hooks/useAuth';

const CATEGORIES = ['Food', 'Travel', 'Material', 'Recharge', 'Other'];
const TRAVEL_TYPES = ['Cab', 'Bike', 'Car', 'Public Transport'];
const FOOD_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];

const CATEGORY_COLORS: Record<string, string> = {
    Food: '#f59e0b', Travel: '#253b50', Material: '#10b981', Recharge: '#8b5cf6', Other: '#64748b',
};

const statusBadge = (status: string) => {
    const map: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
        pending:  { color: '#f59e0b', icon: <Clock size={13} />, label: 'Pending' },
        approved: { color: '#10b981', icon: <CheckCircle size={13} />, label: 'Approved' },
        rejected: { color: '#ef4444', icon: <XCircle size={13} />, label: 'Rejected' },
    };
    const s = map[status] ?? map['pending'];
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 12px', borderRadius: 20, backgroundColor: s.color + '18', color: s.color, fontWeight: 700, fontSize: '0.75rem', border: `1px solid ${s.color}40` }}>
            {s.icon} {s.label}
        </span>
    );
};

interface ReimbursementsProps {
    defaultProjectId?: string | number;
    embedded?: boolean;
}

export default function Reimbursements({ defaultProjectId, embedded = false }: ReimbursementsProps = {}) {
    const { user } = useAuth();
    const getReceiptUrl = (path: string) => {
        if (!path) return '';
        if (path.startsWith('http://') || path.startsWith('https://')) return path;
        const cleanPath = path.replace(/^\//, '');
        if (cleanPath.startsWith('api/')) {
            return `${API_BASE_URL.replace(/\/api$/, '')}/${cleanPath}`;
        }
        return `${API_BASE_URL}/${cleanPath}`;
    };
    const fileRef = useRef<HTMLInputElement>(null);

    const [list, setList] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Form state
    const [form, setForm] = useState({ 
        projectId: defaultProjectId ? String(defaultProjectId) : '',
        category: 'Food', 
        reason: '', 
        amount: '',
        // Food fields
        foodType: 'Lunch',
        foodFromLocation: 'Office',
        foodFromAddress: '',
        foodToLocation: 'Office',
        foodToAddress: '',
        // Travel fields
        travelType: 'Cab',
        distance: '',
        fromLocation: 'Office',
        fromAddress: '',
        toLocation: 'Office',
        toAddress: '',
        // Recharge fields
        phoneNumber: '',
        rechargeStartDate: '',
        rechargeEndDate: ''
    });
    const [customCategory, setCustomCategory] = useState('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    
    // Filters & Modals
    const [search, setSearch] = useState('');
    const [selectedMonth, setSelectedMonth] = useState<string>(''); // YYYY-MM
    const [startDate, setStartDate] = useState<string>(''); // YYYY-MM-DD
    const [endDate, setEndDate] = useState<string>(''); // YYYY-MM-DD
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
    const [projectFilter, setProjectFilter] = useState<string>('all');

    const [selectedClaim, setSelectedClaim] = useState<any | null>(null);
    const [imageModal, setImageModal] = useState<string | null>(null);
    const [rejectModal, setRejectModal] = useState<{ id: number; name: string } | null>(null);
    const [actionNote, setActionNote] = useState('');
    const [processing, setProcessing] = useState(false);

    // Auth and Role Detection
    const getAuthInfo = () => {
        let uid = user?.user_id;
        let urole = user?.role;
        let uname = user?.name || user?.username;
        if (!uid || !urole || !uname) {
            const savedUser = localStorage.getItem('Livincart_user') || localStorage.getItem('user');
            if (savedUser) {
                try {
                    const parsed = JSON.parse(savedUser);
                    uid = uid || parsed.user_id;
                    urole = urole || parsed.role;
                    uname = uname || parsed.name || parsed.username;
                } catch {}
            }
        }
        return {
            headers: { 'X-User-Id': uid ? String(uid) : '', 'X-User-Role': urole ? String(urole) : '' },
            userId: uid ? String(uid) : '',
            role: urole ? String(urole) : '',
            name: uname ? String(uname) : ''
        };
    };

    const authInfo = getAuthInfo();
    const activeRole = String(user?.role || authInfo.role || '').toLowerCase().trim();
    const activeUserId = String(user?.user_id || authInfo.userId || '').trim();
    const activeName = String(user?.name || authInfo.name || '').toLowerCase().trim();
    const isPM = ['pm', 'project_manager'].includes(activeRole);
    const isAdminOrManager = ['admin', 'super_admin', 'manager', 'accountant', 'management'].includes(activeRole) || Boolean(user?.is_admin);

    // Active Tab in Requests History: 'my' (My Requests History) vs 'all' (All Staff Requests) for Admin/Manager
    const [viewTab, setViewTab] = useState<'my' | 'all'>('my');

    const fetchList = async () => {
        setLoading(true);
        try {
            const auth = getAuthInfo();
            const qp = new URLSearchParams();
            if (auth.userId) qp.append('user_id', String(auth.userId));
            if (auth.role) qp.append('role', String(auth.role));
            if (isAdminOrManager) qp.append('all', '1');

            const res = await axios.get(`${API_BASE_URL}/reimbursements?${qp.toString()}`, { 
                headers: auth.headers 
            });
            if (res.data?.success) setList(res.data.data || []);
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

    const handleApprove = async (id: number, noteOverride?: string) => {
        setProcessing(true);
        const noteToUse = noteOverride !== undefined ? noteOverride : actionNote;
        const auth = getAuthInfo();
        const approverName = user?.name || user?.username || auth.name || 'Manager/Admin';
        try {
            const res = await axios.post(`${API_BASE_URL}/reimbursements/approve`, { id, admin_note: noteToUse, approved_by: approverName }, { headers: auth.headers });
            if (res.data.success) { 
                setMsg({ type: 'success', text: res.data.message || 'Reimbursement approved.' }); 
                fetchList(); 
                if (selectedClaim?.id === id) {
                    setSelectedClaim((prev: any) => prev ? { ...prev, status: 'approved', admin_note: noteToUse } : null);
                }
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
        const noteToUse = noteOverride !== undefined ? noteOverride : actionNote;
        const auth = getAuthInfo();
        try {
            const res = await axios.post(`${API_BASE_URL}/reimbursements/reject`, { id: targetId, admin_note: noteToUse }, { headers: auth.headers });
            if (res.data.success) { 
                setMsg({ type: 'success', text: res.data.message || 'Reimbursement rejected.' }); 
                fetchList(); 
                if (selectedClaim?.id === targetId) {
                    setSelectedClaim((prev: any) => prev ? { ...prev, status: 'rejected', admin_note: noteToUse } : null);
                }
            } else {
                setMsg({ type: 'error', text: res.data.message || 'Rejection failed.' }); 
            }
        } catch { setMsg({ type: 'error', text: 'Action failed.' }); }
        finally { setProcessing(false); setRejectModal(null); setActionNote(''); }
    };

    useEffect(() => { 
        fetchList(); 
        fetchProjects();
    }, [user?.user_id, user?.role]);

    const locationOptions = Array.from(
        new Set([
            'Office', 
            ...projects.map(p => p.project_name || p.name || p.project_code).filter(Boolean),
            'Other'
        ])
    );

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

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!form.amount || parseFloat(form.amount) <= 0) {
            return setMsg({ type: 'error', text: 'Please enter a valid amount.' });
        }

        if (!form.reason.trim()) {
            return setMsg({ type: 'error', text: 'Please enter Reason / Notes for this claim.' });
        }

        if (!imageFile) {
            return setMsg({ type: 'error', text: 'Please upload a Receipt Image. Receipt image is required.' });
        }

        let finalReason = form.reason.trim();

        const isOfficeOrOther = !form.projectId || form.projectId === '0' || form.projectId === 'Office / Other';

        if (form.category === 'Food') {
            if (!isOfficeOrOther && (!form.foodFromLocation || !form.foodToLocation)) {
                return setMsg({ type: 'error', text: 'Please select From and To locations.' });
            }
            if (!isOfficeOrOther && form.foodFromLocation === 'Other' && !form.foodFromAddress.trim()) {
                return setMsg({ type: 'error', text: 'Please enter custom address for From location.' });
            }
            if (!isOfficeOrOther && form.foodToLocation === 'Other' && !form.foodToAddress.trim()) {
                return setMsg({ type: 'error', text: 'Please enter custom address for To location.' });
            }
            if (!isOfficeOrOther && form.foodFromLocation !== 'Office' && form.foodFromLocation !== 'Other' && form.foodFromLocation === form.foodToLocation) {
                return setMsg({ type: 'error', text: 'From and To project cannot be the same. Please select a different project or Office.' });
            }
            const fromLocStr = form.foodFromLocation === 'Other' ? `Other (${form.foodFromAddress.trim()})` : form.foodFromLocation;
            const toLocStr = form.foodToLocation === 'Other' ? `Other (${form.foodToAddress.trim()})` : form.foodToLocation;
            const hasLocTags = (fromLocStr && fromLocStr !== 'Office') || (toLocStr && toLocStr !== 'Office');
            const foodMeta = hasLocTags ? `[Food: ${form.foodType} | From: ${fromLocStr} -> To: ${toLocStr}]` : `[Food: ${form.foodType}]`;
            finalReason = finalReason ? `${foodMeta}\n${finalReason}` : foodMeta;
        } else if (form.category === 'Travel') {
            if (!isOfficeOrOther && !form.distance) {
                return setMsg({ type: 'error', text: 'Please enter distance traveled (in km).' });
            }
            if (!isOfficeOrOther && (!form.fromLocation || !form.toLocation)) {
                return setMsg({ type: 'error', text: 'Please select From and To locations.' });
            }
            if (!isOfficeOrOther && form.fromLocation === 'Other' && !form.fromAddress.trim()) {
                return setMsg({ type: 'error', text: 'Please enter custom address for From location.' });
            }
            if (!isOfficeOrOther && form.toLocation === 'Other' && !form.toAddress.trim()) {
                return setMsg({ type: 'error', text: 'Please enter custom address for To location.' });
            }
            if (!isOfficeOrOther && form.fromLocation !== 'Office' && form.fromLocation !== 'Other' && form.fromLocation === form.toLocation) {
                return setMsg({ type: 'error', text: 'From and To project cannot be the same. Please select a different project or Office.' });
            }
            const fromLocStr = form.fromLocation === 'Other' ? `Other (${form.fromAddress.trim()})` : form.fromLocation;
            const toLocStr = form.toLocation === 'Other' ? `Other (${form.toAddress.trim()})` : form.toLocation;
            const hasLocTags = (fromLocStr && fromLocStr !== 'Office') || (toLocStr && toLocStr !== 'Office');
            const travelMeta = form.distance
                ? (hasLocTags ? `[Travel: ${form.travelType} | ${form.distance} km | From: ${fromLocStr} -> To: ${toLocStr}]` : `[Travel: ${form.travelType} | ${form.distance} km]`)
                : (hasLocTags ? `[Travel: ${form.travelType} | From: ${fromLocStr} -> To: ${toLocStr}]` : `[Travel: ${form.travelType}]`);
            finalReason = finalReason ? `${travelMeta}\n${finalReason}` : travelMeta;
        } else if (form.category === 'Recharge') {
            if (!form.phoneNumber.trim()) {
                return setMsg({ type: 'error', text: 'Please enter phone number for recharge.' });
            }
            if (!form.rechargeStartDate || !form.rechargeEndDate) {
                return setMsg({ type: 'error', text: 'Please select recharge start date and end date.' });
            }
            const rechargeMeta = `[Recharge: Phone ${form.phoneNumber} | Period: ${form.rechargeStartDate} to ${form.rechargeEndDate}]`;
            finalReason = finalReason ? `${rechargeMeta}\n${finalReason}` : rechargeMeta;
        } else if (form.category === 'Other') {
            if (!customCategory.trim()) {
                return setMsg({ type: 'error', text: 'Please specify custom category name.' });
            }
            if (form.fromLocation === 'Other' && !form.fromAddress.trim()) {
                return setMsg({ type: 'error', text: 'Please enter custom address for From location.' });
            }
            if (form.toLocation === 'Other' && !form.toAddress.trim()) {
                return setMsg({ type: 'error', text: 'Please enter custom address for To location.' });
            }
            if (!isOfficeOrOther && form.fromLocation !== 'Office' && form.fromLocation !== 'Other' && form.fromLocation === form.toLocation) {
                return setMsg({ type: 'error', text: 'From and To project cannot be the same. Please select a different project or Office.' });
            }
            const fromLocStr = form.fromLocation === 'Other' ? `Other (${form.fromAddress.trim()})` : form.fromLocation;
            const toLocStr = form.toLocation === 'Other' ? `Other (${form.toAddress.trim()})` : form.toLocation;
            const hasLocTags = (fromLocStr && fromLocStr !== 'Office') || (toLocStr && toLocStr !== 'Office');
            if (hasLocTags) {
                const locMeta = `[From: ${fromLocStr} -> To: ${toLocStr}]`;
                finalReason = finalReason ? `${locMeta}\n${finalReason}` : locMeta;
            }
        } else {
            if (form.fromLocation === 'Other' && !form.fromAddress.trim()) {
                return setMsg({ type: 'error', text: 'Please enter custom address for From location.' });
            }
            if (form.toLocation === 'Other' && !form.toAddress.trim()) {
                return setMsg({ type: 'error', text: 'Please enter custom address for To location.' });
            }
            if (form.fromLocation !== 'Office' && form.fromLocation !== 'Other' && form.fromLocation === form.toLocation) {
                return setMsg({ type: 'error', text: 'From and To project cannot be the same. Please select a different project or Office.' });
            }
            const fromLocStr = form.fromLocation === 'Other' ? `Other (${form.fromAddress.trim()})` : form.fromLocation;
            const toLocStr = form.toLocation === 'Other' ? `Other (${form.toAddress.trim()})` : form.toLocation;
            const locMeta = `[From: ${fromLocStr} -> To: ${toLocStr}]`;
            finalReason = finalReason ? `${locMeta}\n${finalReason}` : locMeta;
        }
        
        setSubmitting(true);
        setMsg(null);
        try {
            const auth = getAuthInfo();
            const categoryToSend = form.category === 'Other' ? customCategory.trim() : form.category;
            const fd = new FormData();
            fd.append('user_id', auth.userId || String(user?.user_id || ''));
            // Auto resolve project_id from location selections if form.projectId is empty
            let targetProjectId = form.projectId;
            if (form.category !== 'Recharge' && !targetProjectId) {
                const locCandidates = [form.foodFromLocation, form.foodToLocation, form.fromLocation, form.toLocation];
                for (const loc of locCandidates) {
                    if (loc && loc !== 'Office' && loc !== 'Other') {
                        const found = projects.find(p => 
                            (p.project_name && p.project_name.toLowerCase() === loc.toLowerCase()) ||
                            (p.name && p.name.toLowerCase() === loc.toLowerCase()) ||
                            (p.project_code && p.project_code.toLowerCase() === loc.toLowerCase())
                        );
                        if (found) {
                            targetProjectId = found.project_id || found.project_code;
                            break;
                        }
                    }
                }
            }
            if (form.category !== 'Recharge' && targetProjectId) {
                fd.append('project_id', targetProjectId);
            }
            fd.append('employee_name', user?.name || user?.username || auth.name || 'Employee');
            fd.append('role', user?.role || auth.role || 'admin');
            fd.append('category', categoryToSend);
            fd.append('reason', finalReason);
            fd.append('amount', form.amount);
            if (imageFile) fd.append('image', imageFile);

            const res = await axios.post(`${API_BASE_URL}/reimbursements`, fd, {
                headers: { ...auth.headers, 'Content-Type': 'multipart/form-data' }
            });
            if (res.data.success) {
                setMsg({ type: 'success', text: res.data.message });
                setForm({ 
                    projectId: '',
                    category: 'Food', 
                    reason: '', 
                    amount: '',
                    foodType: 'Lunch',
                    foodFromLocation: 'Office',
                    foodFromAddress: '',
                    foodToLocation: 'Office',
                    foodToAddress: '',
                    travelType: 'Cab',
                    distance: '',
                    fromLocation: 'Office',
                    fromAddress: '',
                    toLocation: 'Office',
                    toAddress: '',
                    phoneNumber: '',
                    rechargeStartDate: '',
                    rechargeEndDate: ''
                });
                setCustomCategory('');
                setImageFile(null);
                setImagePreview(null);
                if (fileRef.current) fileRef.current.value = '';
                fetchList();
            } else {
                setMsg({ type: 'error', text: res.data.message });
            }
        } catch (err: any) {
            setMsg({ type: 'error', text: 'Submission failed. Please try again.' });
        } finally { setSubmitting(false); }
    };

    const clearFilters = () => {
        setSearch('');
        setSelectedMonth('');
        setStartDate('');
        setEndDate('');
        setStatusFilter('all');
    };

    const parseClaimDetails = (r: any) => {
        const rawReason = r?.reason || '';
        let fromLoc = '';
        let toLoc = '';
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

        const cleanNotes = rawReason.replace(/\[.*?\]/g, '').trim();

        return {
            fromLoc,
            toLoc,
            mealType,
            travelType,
            distance,
            phone,
            period,
            cleanNotes
        };
    };

    // Personal claims of the logged-in user
    const myClaims = list.filter(r => {
        if (!activeUserId && !activeName) return true;
        const matchId = activeUserId && String(r.user_id).trim() === activeUserId;
        const matchName = activeName && (r.employee_name || '').toLowerCase().trim() === activeName;
        return matchId || matchName;
    });

    const isShowingMyOnly = !isAdminOrManager || viewTab === 'my';
    const baseList = isShowingMyOnly ? myClaims : list;

    const filteredList = baseList.filter(r => {
        if (embedded && defaultProjectId) {
            const isMatch = String(r.project_id) === String(defaultProjectId) || String(r.project_code) === String(defaultProjectId);
            if (!isMatch) return false;
        }

        const rStatus = String(r.status || '').toLowerCase().trim();
        const matchStatus = statusFilter === 'all' || rStatus === statusFilter.toLowerCase();
        const q = search.toLowerCase().trim();
        const matchSearch = !q || 
            (r.employee_name && r.employee_name.toLowerCase().includes(q)) ||
            (r.category && r.category.toLowerCase().includes(q)) || 
            (r.reason && r.reason.toLowerCase().includes(q)) ||
            (r.role && String(r.role).toLowerCase().includes(q)) ||
            (r.project_code && String(r.project_code).toLowerCase().includes(q));
        
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

    const totalApproved = filteredList.filter(r => r.status === 'approved').reduce((s, r) => s + parseFloat(r.amount), 0);
    const totalPending  = filteredList.filter(r => r.status === 'pending').reduce((s, r) => s + parseFloat(r.amount), 0);
    const totalRejected = filteredList.filter(r => r.status === 'rejected').reduce((s, r) => s + parseFloat(r.amount), 0);

    const hasActiveFilters = search || statusFilter !== 'all' || selectedMonth || startDate || endDate;

    const escapeCsv = (val: any) => {
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
    };

    const exportToCSV = () => {
        if (!filteredList || filteredList.length === 0) {
            alert('No reimbursement records to export.');
            return;
        }

        const headers = [
            'Claim ID',
            'Applicant',
            'Role',
            'Project ID / Code',
            'Category',
            'Amount (INR)',
            'Status',
            'Date',
            'Reason / Notes',
            'Admin Note',
            'Route / Locations',
            'Details',
            'Receipt Image URL'
        ];

        const rows = filteredList.map(r => {
            const receiptUrl = r.image_path ? getReceiptUrl(r.image_path) : 'No Receipt';
            let route = '';
            if (r.from_location || r.to_location) route = `${r.from_location || ''} -> ${r.to_location || ''}`;
            else if (r.food_from_location || r.food_to_location) route = `${r.food_from_location || ''} -> ${r.food_to_location || ''}`;

            let details = '';
            if (r.travel_type) details = `${r.travel_type} (${r.distance || 0} km)`;
            else if (r.food_type) details = `${r.food_type}`;
            else if (r.phone_number) details = `Phone: ${r.phone_number}`;

            return [
                `LC-REIM-${r.id}`,
                r.employee_name || 'Staff',
                r.role || '',
                r.project_code || r.project_id || 'General / Office',
                r.category || '',
                Number(r.amount || 0).toFixed(2),
                (r.status || 'pending').toUpperCase(),
                r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN') : '',
                r.reason || '',
                r.admin_note || '',
                route,
                details,
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
        link.setAttribute('download', `Reimbursements_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const exportToExcel = () => {
        if (!filteredList || filteredList.length === 0) {
            alert('No reimbursement records to export.');
            return;
        }

        const headers = [
            'Claim ID',
            'Applicant',
            'Role',
            'Project',
            'Category',
            'Amount (₹)',
            'Status',
            'Date',
            'Reason / Notes',
            'Admin Note',
            'Route / Locations',
            'Details',
            'Receipt URL'
        ];

        const rows = filteredList.map(r => {
            const receiptUrl = r.image_path ? getReceiptUrl(r.image_path) : '';
            let route = '';
            if (r.from_location || r.to_location) route = `${r.from_location || ''} -> ${r.to_location || ''}`;
            else if (r.food_from_location || r.food_to_location) route = `${r.food_from_location || ''} -> ${r.food_to_location || ''}`;

            let details = '';
            if (r.travel_type) details = `${r.travel_type} (${r.distance || 0} km)`;
            else if (r.food_type) details = `${r.food_type}`;
            else if (r.phone_number) details = `Phone: ${r.phone_number}`;

            return `<tr>
                <td style="border:1px solid #cbd5e1;padding:8px;">LC-REIM-${r.id}</td>
                <td style="border:1px solid #cbd5e1;padding:8px;">${r.employee_name || 'Staff'}</td>
                <td style="border:1px solid #cbd5e1;padding:8px;">${r.role || ''}</td>
                <td style="border:1px solid #cbd5e1;padding:8px;">${r.project_code || r.project_id || 'General / Office'}</td>
                <td style="border:1px solid #cbd5e1;padding:8px;">${r.category || ''}</td>
                <td style="border:1px solid #cbd5e1;padding:8px;text-align:right;">${Number(r.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                <td style="border:1px solid #cbd5e1;padding:8px;font-weight:bold;color:${r.status === 'approved' ? '#16a34a' : r.status === 'rejected' ? '#dc2626' : '#d97706'};">${(r.status || 'pending').toUpperCase()}</td>
                <td style="border:1px solid #cbd5e1;padding:8px;">${r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN') : ''}</td>
                <td style="border:1px solid #cbd5e1;padding:8px;">${r.reason || ''}</td>
                <td style="border:1px solid #cbd5e1;padding:8px;">${r.admin_note || ''}</td>
                <td style="border:1px solid #cbd5e1;padding:8px;">${route}</td>
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
                <h2>Reimbursements Claim Report</h2>
                <p>Generated: ${new Date().toLocaleString('en-IN')} | Total Claims: ${filteredList.length}</p>
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
        link.setAttribute('download', `Reimbursements_${new Date().toISOString().split('T')[0]}.xls`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <div style={{ padding: '28px 32px', maxWidth: '100%', margin: '0 auto', fontFamily: "'Outfit', sans-serif" }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
                <div style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: '#0c1527', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(12,21,39,0.15)' }}>
                    <Receipt size={24} color="#fca412" />
                </div>
                <div>
                    <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0c1527', margin: 0 }}>Reimbursements</h1>
                    <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0 }}>Submit expense claims for approval</p>
                </div>
            </div>

            {/* Submission Form */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #e2e8f0', padding: '28px', marginBottom: 28, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1e293b', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Plus size={18} color="#253b50" /> Submit New Request
                </h2>
                <form onSubmit={handleSubmit}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
                        {/* Category */}
                        <div>
                            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>Category *</label>
                            <select
                                value={form.category}
                                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', outline: 'none', background: '#f8fafc', fontWeight: 600 }}
                            >
                                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                            </select>

                            {form.category === 'Other' && (
                                <div style={{ marginTop: 12 }}>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>Custom Category Name *</label>
                                    <input
                                        type="text"
                                        placeholder="Specify custom category (e.g. Hotel, Stationery)"
                                        value={customCategory}
                                        onChange={e => setCustomCategory(e.target.value)}
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', outline: 'none', background: '#f8fafc' }}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Project ID (Hidden for Recharge) */}
                        {form.category !== 'Recharge' && (
                            <div>
                                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>Project ID / Name</label>
                                {embedded && defaultProjectId ? (
                                    <select
                                        disabled
                                        value={form.projectId || String(defaultProjectId)}
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', background: '#e2e8f0', color: '#0c1527', fontWeight: 800, cursor: 'not-allowed' }}
                                    >
                                        {(() => {
                                            const currentProj = projects.find(p => String(p.project_id) === String(defaultProjectId) || String(p.id) === String(defaultProjectId));
                                            const code = currentProj?.manual_client_id || currentProj?.project_code || `PR_${defaultProjectId}`;
                                            const name = currentProj?.project_name || currentProj?.name || '';
                                            return (
                                                <option value={defaultProjectId}>
                                                    [{code}] {name}
                                                </option>
                                            );
                                        })()}
                                    </select>
                                ) : (
                                    <select
                                        value={form.projectId}
                                        onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))}
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', outline: 'none', background: '#f8fafc' }}
                                    >
                                        <option value="Office / Other">Office / Other</option>
                                        <option value="0">General Site</option>
                                        {projects.map(p => {
                                            const code = p.manual_client_id || p.project_code || `PR_${p.project_id}`;
                                            return (
                                                <option key={p.project_id} value={p.project_id}>
                                                    [{code}] {p.project_name || p.name || 'Project'}
                                                </option>
                                            );
                                        })}
                                    </select>
                                )}
                            </div>
                        )}

                        {/* Amount */}
                        <div>
                            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>Amount (₹) *</label>
                            <input
                                type="number"
                                min="1"
                                step="0.01"
                                placeholder="Enter amount"
                                value={form.amount}
                                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', outline: 'none', background: '#f8fafc' }}
                            />
                        </div>
                    </div>

                    {/* Food Category Dynamic Fields */}
                    {form.category === 'Food' && (
                        <div style={{ background: '#fff9f0', border: '1.5px solid #ffe8c2', padding: '20px', borderRadius: 14, marginBottom: 16 }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0c1527', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                                🍔 Food Expense Claim Details
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                                {/* Food Type */}
                                <div>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0c1527', display: 'block', marginBottom: 6 }}>Meal Type *</label>
                                    <select
                                        value={form.foodType}
                                        onChange={e => setForm(f => ({ ...f, foodType: e.target.value }))}
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #ffe8c2', fontSize: '0.88rem', outline: 'none', background: '#fff', color: '#0c1527', fontWeight: 600 }}
                                    >
                                        {FOOD_TYPES.map(t => <option key={t}>{t}</option>)}
                                    </select>
                                </div>

                                {/* From Location / Project */}
                                <div>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0c1527', display: 'block', marginBottom: 6 }}>
                                        From (Location / Project) {(!form.projectId || form.projectId === '0' || form.projectId === 'Office / Other') ? '(Optional)' : '*'}
                                    </label>
                                    <select
                                        value={form.foodFromLocation}
                                        onChange={e => setForm(f => ({ ...f, foodFromLocation: e.target.value }))}
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #ffe8c2', fontSize: '0.88rem', outline: 'none', background: '#fff', color: '#0c1527', fontWeight: 600 }}
                                    >
                                        {locationOptions.map(loc => <option key={`food_from_${loc}`} value={loc}>{loc}</option>)}
                                    </select>
                                    {form.foodFromLocation === 'Other' && (
                                        <input
                                            type="text"
                                            required={!(!form.projectId || form.projectId === '0' || form.projectId === 'Office / Other')}
                                            placeholder="Enter From Address"
                                            value={form.foodFromAddress}
                                            onChange={e => setForm(f => ({ ...f, foodFromAddress: e.target.value }))}
                                            style={{ width: '100%', marginTop: 8, padding: '8px 12px', borderRadius: 8, border: '1.5px solid #ffe8c2', fontSize: '0.85rem', outline: 'none', background: '#fff', color: '#0c1527' }}
                                        />
                                    )}
                                </div>

                                {/* To Location / Project */}
                                <div>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0c1527', display: 'block', marginBottom: 6 }}>
                                        To (Location / Project) {(!form.projectId || form.projectId === '0' || form.projectId === 'Office / Other') ? '(Optional)' : '*'}
                                    </label>
                                    <select
                                        value={form.foodToLocation}
                                        onChange={e => setForm(f => ({ ...f, foodToLocation: e.target.value }))}
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #ffe8c2', fontSize: '0.88rem', outline: 'none', background: '#fff', color: '#0c1527', fontWeight: 600 }}
                                    >
                                        {locationOptions.map(loc => <option key={`food_to_${loc}`} value={loc}>{loc}</option>)}
                                    </select>
                                    {form.foodToLocation === 'Other' && (
                                        <input
                                            type="text"
                                            required={!(!form.projectId || form.projectId === '0' || form.projectId === 'Office / Other')}
                                            placeholder="Enter To Address"
                                            value={form.foodToAddress}
                                            onChange={e => setForm(f => ({ ...f, foodToAddress: e.target.value }))}
                                            style={{ width: '100%', marginTop: 8, padding: '8px 12px', borderRadius: 8, border: '1.5px solid #ffe8c2', fontSize: '0.85rem', outline: 'none', background: '#fff', color: '#0c1527' }}
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Travel Category Dynamic Fields */}
                    {form.category === 'Travel' && (
                        <div style={{ background: '#fff9f0', border: '1.5px solid #ffe8c2', padding: '20px', borderRadius: 14, marginBottom: 16 }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0c1527', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Car size={16} color="#fca412" /> Travel Claim Details
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 14 }}>
                                {/* Travel Type */}
                                <div>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0c1527', display: 'block', marginBottom: 6 }}>Travel Type</label>
                                    <select
                                        value={form.travelType}
                                        onChange={e => setForm(f => ({ ...f, travelType: e.target.value }))}
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #ffe8c2', fontSize: '0.88rem', outline: 'none', background: '#fff', color: '#0c1527', fontWeight: 600 }}
                                    >
                                        {TRAVEL_TYPES.map(t => <option key={t}>{t}</option>)}
                                    </select>
                                </div>

                                {/* Distance */}
                                <div>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0c1527', display: 'block', marginBottom: 6 }}>
                                        Distance (in km) {(!form.projectId || form.projectId === '0' || form.projectId === 'Office / Other') ? '(Optional)' : '*'}
                                    </label>
                                    <input
                                        type="number"
                                        min="0.1"
                                        step="0.1"
                                        placeholder="e.g. 15.5"
                                        value={form.distance}
                                        onChange={e => setForm(f => ({ ...f, distance: e.target.value }))}
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #ffe8c2', fontSize: '0.88rem', outline: 'none', background: '#fff', color: '#0c1527', fontWeight: 600 }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                {/* From Location */}
                                <div>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0c1527', display: 'block', marginBottom: 6 }}>
                                        From (Location / Project) {(!form.projectId || form.projectId === '0' || form.projectId === 'Office / Other') ? '(Optional)' : '*'}
                                    </label>
                                    <select
                                        value={form.fromLocation}
                                        onChange={e => setForm(f => ({ ...f, fromLocation: e.target.value }))}
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #ffe8c2', fontSize: '0.88rem', outline: 'none', background: '#fff', color: '#0c1527', fontWeight: 600 }}
                                    >
                                        {locationOptions.map(loc => <option key={`from_${loc}`} value={loc}>{loc}</option>)}
                                    </select>
                                    {form.fromLocation === 'Other' && (
                                        <input
                                            type="text"
                                            required={!(!form.projectId || form.projectId === '0' || form.projectId === 'Office / Other')}
                                            placeholder="Enter From Address"
                                            value={form.fromAddress}
                                            onChange={e => setForm(f => ({ ...f, fromAddress: e.target.value }))}
                                            style={{ width: '100%', marginTop: 8, padding: '8px 12px', borderRadius: 8, border: '1.5px solid #ffe8c2', fontSize: '0.85rem', outline: 'none', background: '#fff', color: '#0c1527' }}
                                        />
                                    )}
                                </div>

                                {/* To Location */}
                                <div>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0c1527', display: 'block', marginBottom: 6 }}>
                                        To (Location / Project) {(!form.projectId || form.projectId === '0' || form.projectId === 'Office / Other') ? '(Optional)' : '*'}
                                    </label>
                                    <select
                                        value={form.toLocation}
                                        onChange={e => setForm(f => ({ ...f, toLocation: e.target.value }))}
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #ffe8c2', fontSize: '0.88rem', outline: 'none', background: '#fff', color: '#0c1527', fontWeight: 600 }}
                                    >
                                        {locationOptions.map(loc => <option key={`to_${loc}`} value={loc}>{loc}</option>)}
                                    </select>
                                    {form.toLocation === 'Other' && (
                                        <input
                                            type="text"
                                            required={!(!form.projectId || form.projectId === '0' || form.projectId === 'Office / Other')}
                                            placeholder="Enter To Address"
                                            value={form.toAddress}
                                            onChange={e => setForm(f => ({ ...f, toAddress: e.target.value }))}
                                            style={{ width: '100%', marginTop: 8, padding: '8px 12px', borderRadius: 8, border: '1.5px solid #ffe8c2', fontSize: '0.85rem', outline: 'none', background: '#fff', color: '#0c1527' }}
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Recharge Category Dynamic Fields */}
                    {form.category === 'Recharge' && (
                        <div style={{ background: '#fff9f0', border: '1.5px solid #ffe8c2', padding: '20px', borderRadius: 14, marginBottom: 16 }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0c1527', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Phone size={16} color="#fca412" /> Recharge Claim Details
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                                {/* Phone Number */}
                                <div>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0c1527', display: 'block', marginBottom: 6 }}>Phone Number *</label>
                                    <input
                                        type="tel"
                                        placeholder="e.g. 9876543210"
                                        value={form.phoneNumber}
                                        onChange={e => setForm(f => ({ ...f, phoneNumber: e.target.value }))}
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #ffe8c2', fontSize: '0.88rem', outline: 'none', background: '#fff', color: '#0c1527', fontWeight: 600 }}
                                    />
                                </div>

                                {/* Date From */}
                                <div>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0c1527', display: 'block', marginBottom: 6 }}>Date From *</label>
                                    <input
                                        type="date"
                                        value={form.rechargeStartDate}
                                        onChange={e => setForm(f => ({ ...f, rechargeStartDate: e.target.value }))}
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #ffe8c2', fontSize: '0.88rem', outline: 'none', background: '#fff', color: '#0c1527', fontWeight: 600 }}
                                    />
                                </div>

                                {/* Date End */}
                                <div>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0c1527', display: 'block', marginBottom: 6 }}>Date End *</label>
                                    <input
                                        type="date"
                                        value={form.rechargeEndDate}
                                        onChange={e => setForm(f => ({ ...f, rechargeEndDate: e.target.value }))}
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #ffe8c2', fontSize: '0.88rem', outline: 'none', background: '#fff', color: '#0c1527', fontWeight: 600 }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Generic Category Location/Project Selection */}
                    {form.category !== 'Food' && form.category !== 'Travel' && form.category !== 'Recharge' && (
                        <div style={{ background: '#fff9f0', border: '1.5px solid #ffe8c2', padding: '16px 20px', borderRadius: 14, marginBottom: 16 }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0c1527', marginBottom: 12 }}>
                                📍 Project / Location Tagging
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                {/* From Location / Project */}
                                <div>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0c1527', display: 'block', marginBottom: 6 }}>From (Location / Project) *</label>
                                    <select
                                        value={form.fromLocation}
                                        onChange={e => setForm(f => ({ ...f, fromLocation: e.target.value }))}
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #ffe8c2', fontSize: '0.88rem', outline: 'none', background: '#fff', color: '#0c1527', fontWeight: 600 }}
                                    >
                                        {locationOptions.map(loc => <option key={`gen_from_${loc}`} value={loc}>{loc}</option>)}
                                    </select>
                                    {form.fromLocation === 'Other' && (
                                        <input
                                            type="text"
                                            required
                                            placeholder="Enter From Address *"
                                            value={form.fromAddress}
                                            onChange={e => setForm(f => ({ ...f, fromAddress: e.target.value }))}
                                            style={{ width: '100%', marginTop: 8, padding: '8px 12px', borderRadius: 8, border: '1.5px solid #ffe8c2', fontSize: '0.85rem', outline: 'none', background: '#fff', color: '#0c1527' }}
                                        />
                                    )}
                                </div>

                                {/* To Location / Project */}
                                <div>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0c1527', display: 'block', marginBottom: 6 }}>To (Location / Project) *</label>
                                    <select
                                        value={form.toLocation}
                                        onChange={e => setForm(f => ({ ...f, toLocation: e.target.value }))}
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #ffe8c2', fontSize: '0.88rem', outline: 'none', background: '#fff', color: '#0c1527', fontWeight: 600 }}
                                    >
                                        {locationOptions.map(loc => <option key={`gen_to_${loc}`} value={loc}>{loc}</option>)}
                                    </select>
                                    {form.toLocation === 'Other' && (
                                        <input
                                            type="text"
                                            required
                                            placeholder="Enter To Address *"
                                            value={form.toAddress}
                                            onChange={e => setForm(f => ({ ...f, toAddress: e.target.value }))}
                                            style={{ width: '100%', marginTop: 8, padding: '8px 12px', borderRadius: 8, border: '1.5px solid #ffe8c2', fontSize: '0.85rem', outline: 'none', background: '#fff', color: '#0c1527' }}
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Reason */}
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
                            Reason / Notes <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <textarea
                            required
                            rows={2}
                            placeholder="Add reason or notes for this reimbursement request..."
                            value={form.reason}
                            onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                            style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', outline: 'none', resize: 'vertical', background: '#f8fafc', fontFamily: 'inherit' }}
                        />
                    </div>

                    {/* Image Upload */}
                    <div style={{ marginBottom: 20 }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
                            Receipt Image <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <div
                            onClick={() => fileRef.current?.click()}
                            style={{ 
                                border: imagePreview ? '2px solid #10b981' : '2px dashed #cbd5e1', 
                                borderRadius: 12, 
                                padding: '18px', 
                                textAlign: 'center', 
                                cursor: 'pointer', 
                                background: imagePreview ? '#f0fdf4' : '#f8fafc', 
                                transition: 'all 0.2s' 
                            }}
                        >
                            {imagePreview ? (
                                <div style={{ position: 'relative', display: 'inline-block' }}>
                                    <img src={imagePreview} alt="preview" style={{ maxHeight: 120, maxWidth: '100%', borderRadius: 8, objectFit: 'cover' }} />
                                    <button type="button" onClick={e => { e.stopPropagation(); setImageFile(null); setImagePreview(null); if (fileRef.current) fileRef.current.value = ''; }}
                                        style={{ position: 'absolute', top: -8, right: -8, background: '#ef4444', border: 'none', borderRadius: '50%', color: '#fff', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                        <X size={12} />
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <Upload size={24} color="#fca412" style={{ marginBottom: 6 }} />
                                    <p style={{ color: '#253b50', fontWeight: 700, fontSize: '0.88rem', margin: 0 }}>Click to upload receipt *</p>
                                    <p style={{ color: '#94a3b8', fontSize: '0.75rem', margin: '4px 0 0' }}>JPEG, PNG required (bill / receipt image)</p>
                                </>
                            )}
                        </div>
                        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageChange} />
                    </div>

                    {msg && (
                        <div style={{ padding: '10px 16px', borderRadius: 10, marginBottom: 16, background: msg.type === 'success' ? '#ecfdf5' : '#fef2f2', color: msg.type === 'success' ? '#059669' : '#dc2626', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                            {msg.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                            {msg.text}
                        </div>
                    )}

                    <button type="submit" disabled={submitting}
                        style={{ backgroundColor: '#fca412', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 28px', fontWeight: 800, fontSize: '0.9rem', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 14px rgba(252,164,18,0.3)', transition: 'all 0.2s' }}>
                        <Receipt size={16} /> {submitting ? 'Submitting...' : 'Submit Request'}
                    </button>
                </form>
            </div>

            {/* My Requests Table */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #ffe8c2', padding: '24px', boxShadow: '0 4px 14px rgba(252,164,18,0.05)' }}>
                {/* Header & View Switcher */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 14 }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0c1527', margin: 0 }}>
                                {isAdminOrManager ? (viewTab === 'my' ? 'My Requests History' : 'All Staff Requests History') : 'My Requests History'}
                            </h2>
                            <span style={{ background: '#fff7ed', color: '#ea580c', border: '1px solid #ffedd5', padding: '2px 10px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 700 }}>
                                {filteredList.length} {filteredList.length === 1 ? 'Record' : 'Records'}
                            </span>
                        </div>
                        <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '4px 0 0' }}>💡 Click any row to view complete claim details, locations, and receipt attachments</p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        {/* Tab Switcher for Admin / Manager */}
                        {isAdminOrManager && (
                            <div style={{ display: 'flex', gap: 6, background: '#f8fafc', padding: 4, borderRadius: 12, border: '1.5px solid #e2e8f0' }}>
                                <button
                                    type="button"
                                    onClick={() => setViewTab('my')}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        padding: '7px 16px',
                                        borderRadius: 9,
                                        border: 'none',
                                        background: viewTab === 'my' ? '#0c1527' : 'transparent',
                                        color: viewTab === 'my' ? '#fca412' : '#64748b',
                                        fontWeight: 800,
                                        fontSize: '0.82rem',
                                        cursor: 'pointer',
                                        boxShadow: viewTab === 'my' ? '0 2px 8px rgba(12,21,39,0.25)' : 'none',
                                        transition: 'all 0.15s'
                                    }}
                                >
                                    <User size={14} /> My Requests ({myClaims.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setViewTab('all')}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        padding: '7px 16px',
                                        borderRadius: 9,
                                        border: 'none',
                                        background: viewTab === 'all' ? '#0c1527' : 'transparent',
                                        color: viewTab === 'all' ? '#fca412' : '#64748b',
                                        fontWeight: 800,
                                        fontSize: '0.82rem',
                                        cursor: 'pointer',
                                        boxShadow: viewTab === 'all' ? '0 2px 8px rgba(12,21,39,0.25)' : 'none',
                                        transition: 'all 0.15s'
                                    }}
                                >
                                    <Receipt size={14} /> All Staff Requests ({list.length})
                                </button>
                            </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                onClick={exportToExcel}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '7px 12px',
                                    borderRadius: 10,
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
                                    padding: '7px 12px',
                                    borderRadius: 10,
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
                            {hasActiveFilters && (
                                <button onClick={clearFilters} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '7px 14px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 10, fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer' }}>
                                    <X size={13} /> Reset Filters
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* KPI Overview Metric Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, marginBottom: 20 }}>
                    <div style={{ background: '#ffffff', borderRadius: 14, padding: '16px 20px', border: '1.5px solid #ffe8c2', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>Total In View</div>
                        <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0c1527' }}>{filteredList.length}</div>
                        <div style={{ fontSize: '0.76rem', color: '#94a3b8', marginTop: 2 }}>{isShowingMyOnly ? 'My submitted requests' : 'All staff claims'}</div>
                    </div>
                    <div style={{ background: '#fffbeb', borderRadius: 14, padding: '16px 20px', border: '1.5px solid #fde68a', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                        <div style={{ fontSize: '0.72rem', color: '#b45309', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>Pending Review</div>
                        <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#b45309' }}>₹{totalPending.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        <div style={{ fontSize: '0.76rem', color: '#d97706', marginTop: 2 }}>{filteredList.filter(r => r.status === 'pending').length} claims awaiting approval</div>
                    </div>
                    <div style={{ background: '#ecfdf5', borderRadius: 14, padding: '16px 20px', border: '1.5px solid #a7f3d0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                        <div style={{ fontSize: '0.72rem', color: '#047857', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>Approved Amount</div>
                        <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#047857' }}>₹{totalApproved.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        <div style={{ fontSize: '0.76rem', color: '#059669', marginTop: 2 }}>{filteredList.filter(r => r.status === 'approved').length} claims approved</div>
                    </div>
                    <div style={{ background: '#fef2f2', borderRadius: 14, padding: '16px 20px', border: '1.5px solid #fecaca', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                        <div style={{ fontSize: '0.72rem', color: '#b91c1c', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>Rejected Amount</div>
                        <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#b91c1c' }}>₹{totalRejected.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        <div style={{ fontSize: '0.76rem', color: '#dc2626', marginTop: 2 }}>{filteredList.filter(r => r.status === 'rejected').length} claims rejected</div>
                    </div>
                </div>

                {/* Filter Toolbar */}
                <div style={{ background: '#fff9f0', padding: 14, borderRadius: 12, border: '1.5px solid #ffe8c2', marginBottom: 20, display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                    {/* Search */}
                    <div style={{ position: 'relative', minWidth: 220, flex: 1 }}>
                        <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input 
                            placeholder="Filter by employee, category, project or notes..." 
                            value={search} 
                            onChange={e => setSearch(e.target.value)}
                            style={{ width: '100%', padding: '7px 10px 7px 32px', borderRadius: 8, border: '1.5px solid #ffe8c2', fontSize: '0.84rem', outline: 'none', background: '#fff', color: '#0c1527', fontWeight: 600 }} 
                        />
                    </div>

                    {/* Status filter buttons */}
                    <div style={{ display: 'flex', gap: 4, background: '#ffffff', padding: 4, borderRadius: 10, border: '1.5px solid #ffe8c2' }}>
                        {(['all', 'pending', 'approved', 'rejected'] as const).map(s => (
                            <button 
                                key={s} 
                                onClick={() => setStatusFilter(s)}
                                style={{ padding: '6px 14px', borderRadius: 8, border: 'none', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', textTransform: 'capitalize',
                                    background: statusFilter === s ? '#fca412' : 'transparent',
                                    color: statusFilter === s ? '#ffffff' : '#0c1527',
                                    boxShadow: statusFilter === s ? '0 2px 8px rgba(252,164,18,0.3)' : 'none' }}
                            >
                                {s}
                            </button>
                        ))}
                    </div>

                    {/* Month Picker */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <CalendarDays size={15} color="#253b50" />
                        <input 
                            type="month"
                            value={selectedMonth}
                            onChange={e => setSelectedMonth(e.target.value)}
                            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.82rem', background: '#fff', outline: 'none' }}
                        />
                    </div>

                    {/* Date Range */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Calendar size={15} color="#253b50" />
                        <input 
                            type="date"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.82rem', background: '#fff' }}
                        />
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>to</span>
                        <input 
                            type="date"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.82rem', background: '#fff' }}
                        />
                    </div>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Loading requests...</div>
                ) : filteredList.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '48px 20px', color: '#94a3b8' }}>
                        <Receipt size={44} style={{ opacity: 0.3, marginBottom: 10 }} />
                        <div style={{ fontWeight: 800, fontSize: '1rem', color: '#475569', marginBottom: 4 }}>
                            {isShowingMyOnly ? 'No personal reimbursement requests found' : 'No staff reimbursement requests found'}
                        </div>
                        <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: 0 }}>
                            {hasActiveFilters ? 'Try clearing your filters or selecting a different month.' : 'Submit a new request above to see it appear in history.'}
                        </p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                    {[
                                        'Claim ID',
                                        ...((isAdminOrManager || viewTab === 'all') ? ['Applicant'] : []),
                                        'Date', 
                                        'Project ID', 
                                        'Category & Details', 
                                        'Route / Locations',
                                        'Reason / Notes', 
                                        'Amount', 
                                        'Status', 
                                        'Admin Note', 
                                        'Receipt', 
                                        ...(isAdminOrManager ? ['Actions'] : [])
                                    ].map(h => (
                                        <th key={h} style={{ padding: '11px 14px', textAlign: h === 'Actions' ? 'center' : 'left', fontSize: '0.74rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredList.map((r, i) => {
                                    const meta = parseClaimDetails(r);
                                    const claimCode = formatReimbursementId(r.id, r.created_at, r.reimbursement_code);
                                    const projInfo = getTaggedProjectInfo(r, projects);

                                    return (
                                        <tr 
                                            key={r.id} 
                                            onClick={() => setSelectedClaim(r)}
                                            style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa', cursor: 'pointer', transition: 'background 0.15s' }}
                                            onMouseEnter={e => (e.currentTarget.style.background = '#f0f4f8')}
                                            onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#fafafa')}
                                        >
                                            {/* Claim ID */}
                                            <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                                                <span style={{ fontWeight: 800, color: '#0c1527', fontFamily: 'monospace', fontSize: '0.8rem', background: '#f1f5f9', padding: '3px 8px', borderRadius: 6, border: '1px solid #e2e8f0', letterSpacing: '0.3px' }}>
                                                    {claimCode}
                                                </span>
                                            </td>

                                            {/* Applicant Column (when Admin/Manager or All Staff tab) */}
                                            {(isAdminOrManager || viewTab === 'all') && (
                                                <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#0c1527', color: '#fca412', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.72rem' }}>
                                                            {(r.employee_name || 'U').charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight: 800, color: '#0c1527', fontSize: '0.82rem' }}>{r.employee_name || 'Staff Member'}</div>
                                                            {r.role && <span style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'capitalize' }}>{r.role.replace('_', ' ')}</span>}
                                                        </div>
                                                    </div>
                                                </td>
                                            )}

                                            {/* Date */}
                                            <td style={{ padding: '12px 14px', fontSize: '0.82rem', color: '#475569', whiteSpace: 'nowrap' }}>
                                                {r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                            </td>

                                            {/* Project ID */}
                                            <td style={{ padding: '12px 14px', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                                                {projInfo.isOffice ? (
                                                    <span style={{ color: '#94a3b8', fontSize: '0.78rem', fontWeight: 600 }}>Office / Other</span>
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

                                            {/* Category & Details */}
                                            <td style={{ padding: '12px 14px' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                    <span style={{ background: (CATEGORY_COLORS[r.category] ?? '#253b50') + '20', color: CATEGORY_COLORS[r.category] ?? '#253b50', padding: '3px 10px', borderRadius: 20, fontSize: '0.76rem', fontWeight: 800, width: 'fit-content' }}>
                                                        {r.category}
                                                    </span>
                                                    {(meta.travelType || meta.distance) && (
                                                        <span style={{ fontSize: '0.74rem', color: '#0284c7', fontWeight: 700 }}>
                                                            {meta.travelType || 'Travel'} {meta.distance ? `· ${meta.distance}` : ''}
                                                        </span>
                                                    )}
                                                    {meta.mealType && (
                                                        <span style={{ fontSize: '0.74rem', color: '#b45309', fontWeight: 700 }}>
                                                            {meta.mealType}
                                                        </span>
                                                    )}
                                                    {meta.phone && (
                                                        <span style={{ fontSize: '0.74rem', color: '#6d28d9', fontWeight: 700 }}>
                                                            📱 {meta.phone}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Route / Locations */}
                                            <td style={{ padding: '12px 14px', fontSize: '0.82rem', color: '#334155', whiteSpace: 'nowrap' }}>
                                                {(meta.fromLoc && meta.toLoc) ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', fontWeight: 600, color: '#334155' }}>
                                                        <MapPin size={12} color="#ea580c" />
                                                        <span>{meta.fromLoc}</span>
                                                        <ArrowRight size={11} color="#94a3b8" />
                                                        <span>{meta.toLoc}</span>
                                                    </div>
                                                ) : (
                                                    <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>—</span>
                                                )}
                                            </td>

                                            {/* Reason / Notes */}
                                            <td style={{ padding: '12px 14px', fontSize: '0.84rem', color: '#334155', maxWidth: 260 }}>
                                                {meta.cleanNotes ? (
                                                    <span style={{ fontSize: '0.82rem', color: '#334155', fontWeight: 500, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                        {meta.cleanNotes}
                                                    </span>
                                                ) : (
                                                    <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>—</span>
                                                )}
                                            </td>

                                            {/* Amount */}
                                            <td style={{ padding: '12px 14px', fontSize: '0.9rem', fontWeight: 800, color: '#1e293b', whiteSpace: 'nowrap' }}>
                                                ₹{parseFloat(r.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>

                                            {/* Status */}
                                            <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>{statusBadge(r.status)}</td>

                                            {/* Admin Note */}
                                            <td style={{ padding: '12px 14px', fontSize: '0.82rem', color: '#64748b', maxWidth: 180 }}>
                                                {r.admin_note ? (
                                                    <span style={{ fontSize: '0.8rem', color: '#1e40af', background: '#eff6ff', padding: '2px 8px', borderRadius: 6, border: '1px solid #bfdbfe' }}>
                                                        {r.admin_note}
                                                    </span>
                                                ) : '—'}
                                            </td>

                                            {/* Receipt Attachment */}
                                            <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                                                {r.image_path ? (
                                                    <button onClick={(e) => { e.stopPropagation(); setImageModal(getReceiptUrl(r.image_path)); }}
                                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fca412', color: '#ffffff', border: 'none', borderRadius: 8, padding: '5px 11px', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 800, boxShadow: '0 2px 6px rgba(252,164,18,0.3)' }}>
                                                        <ImageIcon size={13} /> View
                                                    </button>
                                                ) : <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>—</span>}
                                            </td>

                                            {/* Actions (for Admin/Manager) */}
                                            {isAdminOrManager && (
                                                <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                                                    {String(r.status).toLowerCase() === 'pending' ? (
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); handleApprove(r.id); }}
                                                                disabled={processing}
                                                                title="Approve this claim"
                                                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 7, backgroundColor: '#10b981', color: '#ffffff', border: 'none', fontSize: '0.76rem', fontWeight: 800, cursor: processing ? 'not-allowed' : 'pointer', boxShadow: '0 2px 6px rgba(16,185,129,0.3)' }}
                                                            >
                                                                <CheckCircle size={12} /> Approve
                                                            </button>
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); setRejectModal({ id: r.id, name: r.employee_name || 'Staff' }); }}
                                                                disabled={processing}
                                                                title="Reject this claim"
                                                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 7, backgroundColor: '#ef4444', color: '#ffffff', border: 'none', fontSize: '0.76rem', fontWeight: 800, cursor: processing ? 'not-allowed' : 'pointer', boxShadow: '0 2px 6px rgba(239,68,68,0.3)' }}
                                                            >
                                                                <XCircle size={12} /> Reject
                                                            </button>
                                                        </div>
                                                    ) : String(r.status).toLowerCase() === 'approved' ? (
                                                        <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                            <CheckCircle size={12} /> Approved
                                                        </span>
                                                    ) : (
                                                        <span style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                            <XCircle size={12} /> Rejected
                                                        </span>
                                                    )}
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Claim Details Popup Modal */}
            {selectedClaim && (() => {
                const meta = parseClaimDetails(selectedClaim);
                const projInfo = getTaggedProjectInfo(selectedClaim, projects);
                const claimCode = formatReimbursementId(selectedClaim.id, selectedClaim.created_at, selectedClaim.reimbursement_code);

                return (
                    <div onClick={() => setSelectedClaim(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
                        <div onClick={e => e.stopPropagation()} className="modal-box" style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 640, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                            {/* Sticky Modal Header */}
                            <div className="modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1.5px solid #f1f5f9', padding: '18px 24px', backgroundColor: '#fff', flexShrink: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#0c1527,#253b50)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(12,21,39,0.15)' }}>
                                        <Receipt size={22} color="#fca412" />
                                    </div>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>Claim Details</h3>
                                            <span style={{ background: '#0c1527', color: '#fca412', border: '1px solid #1e293b', padding: '2px 9px', borderRadius: 6, fontSize: '0.8rem', fontWeight: 800, fontFamily: 'monospace', letterSpacing: '0.5px' }}>
                                                {claimCode}
                                            </span>
                                        </div>
                                        <p style={{ color: '#64748b', fontSize: '0.8rem', margin: '3px 0 0' }}>Submitted on {new Date(selectedClaim.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedClaim(null)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}>
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Scrollable Body */}
                            <div className="modal-body" style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>

                                {/* Status & Amount Banner */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', padding: '14px 18px', borderRadius: 14, marginBottom: 18, border: '1.5px solid #e2e8f0' }}>
                                    <div>
                                        <span style={{ fontSize: '0.73rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 800, display: 'block', marginBottom: 2 }}>Status</span>
                                        {statusBadge(selectedClaim.status)}
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <span style={{ fontSize: '0.73rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 800, display: 'block', marginBottom: 2 }}>Claim Amount</span>
                                        <span style={{ fontSize: '1.45rem', fontWeight: 800, color: '#253b50' }}>₹{parseFloat(selectedClaim.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                </div>

                                {/* Main Info Cards */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr 1fr', gap: 12, marginBottom: 18 }}>
                                    <div style={{ background: '#fafafa', padding: '12px 14px', borderRadius: 12, border: '1px solid #f1f5f9' }}>
                                        <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, marginBottom: 2 }}>Category</div>
                                        <div style={{ fontWeight: 800, color: CATEGORY_COLORS[selectedClaim.category] ?? '#253b50', fontSize: '0.92rem' }}>{selectedClaim.category}</div>
                                    </div>

                                    {/* Tagged Project Card */}
                                    <div style={{ background: '#e0e7ff', padding: '12px 14px', borderRadius: 12, border: '1.5px solid #c7d2fe' }}>
                                        <div style={{ fontSize: '0.72rem', color: '#3730a3', fontWeight: 800, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                                            Tagged Project
                                        </div>
                                        {projInfo.isOffice ? (
                                            <div style={{ fontWeight: 800, color: '#475569', fontSize: '0.92rem' }}>Office / Other</div>
                                        ) : (
                                            <div>
                                                <div style={{ fontWeight: 800, color: '#1e1b4b', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                                    {projInfo.code && (
                                                        <span style={{ background: '#312e81', color: '#fff', padding: '1px 7px', borderRadius: 5, fontSize: '0.8rem', fontWeight: 800 }}>
                                                            {projInfo.code}
                                                        </span>
                                                    )}
                                                    <span>{projInfo.name || 'Project'}</span>
                                                </div>
                                                {projInfo.id && projInfo.id !== 'Office / Other' && projInfo.id !== '0' && (
                                                    <div style={{ fontSize: '0.74rem', color: '#4338ca', fontWeight: 700, marginTop: 4 }}>
                                                        Project Tagged ID: {projInfo.id.startsWith('PR') ? projInfo.id : `PR_${projInfo.id}`}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ background: '#fafafa', padding: '12px 14px', borderRadius: 12, border: '1px solid #f1f5f9' }}>
                                        <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, marginBottom: 2 }}>Applicant</div>
                                        <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '0.92rem' }}>{selectedClaim.employee_name || 'Staff Member'}</div>
                                        {selectedClaim.role && <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'capitalize' }}>{selectedClaim.role.replace('_', ' ')}</div>}
                                    </div>
                                </div>

                                {/* Dynamic Details Box (if attributes exist) */}
                                {(meta.fromLoc || meta.toLoc || meta.mealType || meta.travelType || meta.distance || meta.phone || meta.period) && (
                                    <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 14, padding: 16, marginBottom: 18 }}>
                                        <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#253b50', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                            📋 Claim Specifics &amp; Route
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                            {/* From Location */}
                                            {meta.fromLoc && (
                                                <div style={{ background: '#fff', padding: '10px 12px', borderRadius: 10, border: '1px solid #cbd5e1' }}>
                                                    <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700, display: 'block', textTransform: 'uppercase' }}>📍 From Location</span>
                                                    <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#0f172a' }}>{meta.fromLoc}</span>
                                                </div>
                                            )}

                                            {/* To Location */}
                                            {meta.toLoc && (
                                                <div style={{ background: '#fff', padding: '10px 12px', borderRadius: 10, border: '1px solid #cbd5e1' }}>
                                                    <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700, display: 'block', textTransform: 'uppercase' }}>🏁 To Location</span>
                                                    <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#0f172a' }}>{meta.toLoc}</span>
                                                </div>
                                            )}

                                            {/* Meal Type */}
                                            {meta.mealType && (
                                                <div style={{ background: '#fff', padding: '10px 12px', borderRadius: 10, border: '1px solid #cbd5e1' }}>
                                                    <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700, display: 'block', textTransform: 'uppercase' }}>🍔 Meal Type</span>
                                                    <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#b45309' }}>{meta.mealType}</span>
                                                </div>
                                            )}

                                            {/* Travel Mode */}
                                            {meta.travelType && (
                                                <div style={{ background: '#fff', padding: '10px 12px', borderRadius: 10, border: '1px solid #cbd5e1' }}>
                                                    <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700, display: 'block', textTransform: 'uppercase' }}>🚕 Travel Mode</span>
                                                    <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#0284c7' }}>{meta.travelType}</span>
                                                </div>
                                            )}

                                            {/* Distance */}
                                            {meta.distance && (
                                                <div style={{ background: '#fff', padding: '10px 12px', borderRadius: 10, border: '1px solid #cbd5e1' }}>
                                                    <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700, display: 'block', textTransform: 'uppercase' }}>📏 Distance</span>
                                                    <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#0f172a' }}>{meta.distance}</span>
                                                </div>
                                            )}

                                            {/* Recharge Phone */}
                                            {meta.phone && (
                                                <div style={{ background: '#fff', padding: '10px 12px', borderRadius: 10, border: '1px solid #cbd5e1' }}>
                                                    <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700, display: 'block', textTransform: 'uppercase' }}>📱 Phone Number</span>
                                                    <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#6d28d9' }}>{meta.phone}</span>
                                                </div>
                                            )}

                                            {/* Recharge Period */}
                                            {meta.period && (
                                                <div style={{ background: '#fff', padding: '10px 12px', borderRadius: 10, border: '1px solid #cbd5e1', gridColumn: 'span 2' }}>
                                                    <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700, display: 'block', textTransform: 'uppercase' }}>📅 Recharge Period</span>
                                                    <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#6d28d9' }}>{meta.period}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Description / Custom Notes */}
                                <div style={{ marginBottom: 18 }}>
                                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#475569', marginBottom: 6 }}>Notes &amp; Description</div>
                                    <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 12, border: '1px solid #e2e8f0', color: '#334155', fontSize: '0.86rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                                        {meta.cleanNotes || 'No additional notes provided.'}
                                    </div>
                                </div>

                                {/* Admin Review Note */}
                                {selectedClaim.admin_note && (
                                    <div style={{ marginBottom: 18 }}>
                                        <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#475569', marginBottom: 6 }}>Admin Review Note</div>
                                        <div style={{ background: '#eff6ff', padding: '12px 14px', borderRadius: 10, border: '1px solid #bfdbfe', color: '#1e40af', fontSize: '0.85rem' }}>
                                            {selectedClaim.admin_note}
                                        </div>
                                    </div>
                                )}

                                {/* Attached Receipt Image */}
                                <div style={{ marginBottom: 22 }}>
                                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#475569', marginBottom: 6 }}>Receipt Attachment</div>
                                    {selectedClaim.image_path ? (
                                        <div onClick={() => setImageModal(getReceiptUrl(selectedClaim.image_path))}
                                            style={{ border: '1.5px solid #e2e8f0', borderRadius: 12, padding: 12, background: '#f8fafc', textAlign: 'center', cursor: 'pointer' }}>
                                            <img
                                                src={getReceiptUrl(selectedClaim.image_path)}
                                                alt="Receipt"
                                                onError={(e) => {
                                                    const target = e.currentTarget;
                                                    if (target.dataset.fallbackApplied) return;
                                                    target.dataset.fallbackApplied = 'true';
                                                    if (target.src.includes('/api/uploads/')) {
                                                        target.src = target.src.replace('/api/uploads/', '/uploads/');
                                                    } else if (target.src.includes('/uploads/')) {
                                                        target.src = target.src.replace('/uploads/', '/api/uploads/');
                                                    }
                                                }}
                                                style={{ maxHeight: 180, maxWidth: '100%', borderRadius: 8, objectFit: 'contain' }}
                                            />
                                            <div style={{ fontSize: '0.76rem', color: '#0284c7', fontWeight: 700, marginTop: 6 }}>🔍 Click to zoom full receipt image</div>
                                        </div>
                                    ) : (
                                        <div style={{ background: '#f8fafc', padding: '12px', borderRadius: 10, border: '1px solid #e2e8f0', color: '#94a3b8', fontSize: '0.82rem', textAlign: 'center' }}>
                                            No receipt image attached.
                                        </div>
                                    )}
                                </div>

                                {/* Admin Review / Action Section (if Admin/Manager and pending) */}
                                {isAdminOrManager && String(selectedClaim.status).toLowerCase() === 'pending' && (
                                    <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', padding: 16, borderRadius: 12, marginBottom: 18 }}>
                                        <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#b45309', marginBottom: 8 }}>Admin Review Note (Optional)</div>
                                        <textarea 
                                            rows={2}
                                            placeholder="Add approval/rejection note..."
                                            value={actionNote}
                                            onChange={e => setActionNote(e.target.value)}
                                            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #fcd34d', fontSize: '0.85rem', outline: 'none', background: '#fff', fontFamily: 'inherit', resize: 'vertical', marginBottom: 12 }}
                                        />
                                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                                            <button 
                                                onClick={() => handleReject(selectedClaim.id, actionNote)} 
                                                disabled={processing}
                                                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 8, background: '#ef4444', color: '#fff', border: 'none', fontWeight: 800, cursor: 'pointer', fontSize: '0.84rem' }}
                                            >
                                                <XCircle size={14} /> Reject Claim
                                            </button>
                                            <button 
                                                onClick={() => handleApprove(selectedClaim.id, actionNote)} 
                                                disabled={processing}
                                                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 8, background: '#10b981', color: '#fff', border: 'none', fontWeight: 800, cursor: 'pointer', fontSize: '0.84rem' }}
                                            >
                                                <CheckCircle size={14} /> Approve Claim
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <button onClick={() => setSelectedClaim(null)} style={{ padding: '9px 24px', borderRadius: 10, background: '#0c1527', color: '#fff', border: 'none', fontWeight: 800, cursor: 'pointer', fontSize: '0.85rem' }}>
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
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050 }}>
                    <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: 420, boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>Reject Claim</h3>
                        <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: 16 }}>Rejecting claim from <strong>{rejectModal.name}</strong>. Provide an optional reason:</p>
                        <textarea rows={3} placeholder="Reason for rejection (optional)..." value={actionNote} onChange={e => setActionNote(e.target.value)}
                            style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: '0.88rem', marginBottom: 16, outline: 'none', fontFamily: 'inherit', resize: 'vertical' }} />
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                            <button onClick={() => { setRejectModal(null); setActionNote(''); }}
                                style={{ padding: '8px 18px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                            <button onClick={() => handleReject(rejectModal.id, actionNote)} disabled={processing}
                                style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>
                                {processing ? 'Processing...' : 'Reject'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Image Modal */}
            {imageModal && (
                <div onClick={() => setImageModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, cursor: 'pointer', padding: 20 }}>
                    <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
                        <img
                            src={imageModal}
                            alt="Receipt"
                            onError={(e) => {
                                const target = e.currentTarget;
                                if (target.dataset.fallbackApplied) return;
                                target.dataset.fallbackApplied = 'true';
                                if (target.src.includes('/api/uploads/')) {
                                    target.src = target.src.replace('/api/uploads/', '/uploads/');
                                } else if (target.src.includes('/uploads/')) {
                                    target.src = target.src.replace('/uploads/', '/api/uploads/');
                                }
                            }}
                            style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 12, boxShadow: '0 24px 64px rgba(0,0,0,0.5)', objectFit: 'contain' }}
                        />
                        <button
                            type="button"
                            onClick={() => setImageModal(null)}
                            style={{
                                position: 'absolute',
                                top: -14,
                                right: -14,
                                background: '#ef4444',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '50%',
                                width: 32,
                                height: 32,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                                fontSize: '1rem',
                                fontWeight: 800
                            }}
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}


