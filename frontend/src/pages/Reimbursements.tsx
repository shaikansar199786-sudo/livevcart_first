import React, { useState, useEffect, useRef } from 'react';
import { 
    Receipt, Upload, CheckCircle, XCircle, Clock, AlertCircle, Plus, X, 
    ImageIcon, Calendar, CalendarDays, Search, Eye, Tag, FileText, User,
    Navigation, Phone, MapPin, Car, ArrowRight
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

export default function Reimbursements() {
    const { user } = useAuth();
    const getReceiptUrl = (path: string) => path.startsWith('http') ? path : `${API_BASE_URL.replace('/api', '')}/${path}`;
    const fileRef = useRef<HTMLInputElement>(null);

    const [list, setList] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Form state
    const [form, setForm] = useState({ 
        category: 'Food', 
        reason: '', 
        amount: '',
        // Food fields
        foodType: 'Lunch',
        foodFromLocation: 'Office',
        foodToLocation: 'Office',
        // Travel fields
        travelType: 'Cab',
        distance: '',
        fromLocation: 'Office',
        toLocation: 'Office',
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

    const [selectedClaim, setSelectedClaim] = useState<any | null>(null);
    const [imageModal, setImageModal] = useState<string | null>(null);

    const headers = { 'X-User-Id': user?.user_id, 'X-User-Role': user?.role };

    const fetchList = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/reimbursements`, { headers });
            if (res.data.success) setList(res.data.data);
        } catch { /* ignore */ } finally { setLoading(false); }
    };

    const fetchProjects = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/projects`, { headers });
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
    }, []);

    const locationOptions = Array.from(
        new Set([
            'Office', 
            ...projects.map(p => p.project_name || p.name || p.project_code).filter(Boolean)
        ])
    );

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

        let finalReason = form.reason.trim();

        if (form.category === 'Food') {
            if (!form.foodFromLocation || !form.foodToLocation) {
                return setMsg({ type: 'error', text: 'Please select From and To locations.' });
            }
            if (form.foodFromLocation !== 'Office' && form.foodFromLocation === form.foodToLocation) {
                return setMsg({ type: 'error', text: 'From and To project cannot be the same. Please select a different project or Office.' });
            }
            const foodMeta = `[Food: ${form.foodType} | From: ${form.foodFromLocation} -> To: ${form.foodToLocation}]`;
            finalReason = finalReason ? `${foodMeta}\n${finalReason}` : foodMeta;
        } else if (form.category === 'Travel') {
            if (!form.distance) {
                return setMsg({ type: 'error', text: 'Please enter distance traveled (in km).' });
            }
            if (!form.fromLocation || !form.toLocation) {
                return setMsg({ type: 'error', text: 'Please select From and To locations.' });
            }
            if (form.fromLocation !== 'Office' && form.fromLocation === form.toLocation) {
                return setMsg({ type: 'error', text: 'From and To project cannot be the same. Please select a different project or Office.' });
            }
            const travelMeta = `[Travel: ${form.travelType} | ${form.distance} km | From: ${form.fromLocation} -> To: ${form.toLocation}]`;
            finalReason = finalReason ? `${travelMeta}\n${finalReason}` : travelMeta;
        } else if (form.category === 'Recharge') {
            if (!form.phoneNumber.trim()) {
                return setMsg({ type: 'error', text: 'Please enter phone number for recharge.' });
            }
            if (!form.rechargeStartDate || !form.rechargeEndDate) {
                return setMsg({ type: 'error', text: 'Please select recharge start date and end date.' });
            }
            if (form.fromLocation !== 'Office' && form.fromLocation === form.toLocation) {
                return setMsg({ type: 'error', text: 'From and To project cannot be the same. Please select a different project or Office.' });
            }
            const locMeta = `[From: ${form.fromLocation} -> To: ${form.toLocation}]`;
            const rechargeMeta = `[Recharge: Phone ${form.phoneNumber} | Period: ${form.rechargeStartDate} to ${form.rechargeEndDate}] ${locMeta}`;
            finalReason = finalReason ? `${rechargeMeta}\n${finalReason}` : rechargeMeta;
        } else if (form.category === 'Other') {
            if (!customCategory.trim()) {
                return setMsg({ type: 'error', text: 'Please specify custom category name.' });
            }
            if (form.fromLocation !== 'Office' && form.fromLocation === form.toLocation) {
                return setMsg({ type: 'error', text: 'From and To project cannot be the same. Please select a different project or Office.' });
            }
            const locMeta = `[From: ${form.fromLocation} -> To: ${form.toLocation}]`;
            finalReason = finalReason ? `${locMeta}\n${finalReason}` : locMeta;
        } else {
            if (form.fromLocation !== 'Office' && form.fromLocation === form.toLocation) {
                return setMsg({ type: 'error', text: 'From and To project cannot be the same. Please select a different project or Office.' });
            }
            const locMeta = `[From: ${form.fromLocation} -> To: ${form.toLocation}]`;
            finalReason = finalReason ? `${locMeta}\n${finalReason}` : locMeta;
        }
        
        setSubmitting(true);
        setMsg(null);
        try {
            const categoryToSend = form.category === 'Other' ? customCategory.trim() : form.category;
            const fd = new FormData();
            fd.append('user_id', user?.user_id ?? '');
            fd.append('employee_name', user?.name ?? user?.username ?? '');
            fd.append('role', user?.role ?? '');
            fd.append('category', categoryToSend);
            fd.append('reason', finalReason);
            fd.append('amount', form.amount);
            if (imageFile) fd.append('image', imageFile);

            const res = await axios.post(`${API_BASE_URL}/reimbursements`, fd, {
                headers: { ...headers, 'Content-Type': 'multipart/form-data' }
            });
            if (res.data.success) {
                setMsg({ type: 'success', text: res.data.message });
                setForm({ 
                    category: 'Food', 
                    reason: '', 
                    amount: '',
                    foodType: 'Lunch',
                    foodFromLocation: 'Office',
                    foodToLocation: 'Office',
                    travelType: 'Cab',
                    distance: '',
                    fromLocation: 'Office',
                    toLocation: 'Office',
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

    const filteredList = list.filter(r => {
        const matchStatus = statusFilter === 'all' || r.status === statusFilter;
        const matchSearch = !search || 
            r.category?.toLowerCase().includes(search.toLowerCase()) || 
            r.reason?.toLowerCase().includes(search.toLowerCase());
        
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

    const hasActiveFilters = search || statusFilter !== 'all' || selectedMonth || startDate || endDate;

    return (
        <div style={{ padding: '28px 32px', maxWidth: '100%', margin: '0 auto', fontFamily: "'Outfit', sans-serif" }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
                <div style={{ width: 46, height: 46, borderRadius: 12, background: 'linear-gradient(135deg,#253b50,#3b5066)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Receipt size={24} color="#fff" />
                </div>
                <div>
                    <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>Reimbursements</h1>
                    <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0 }}>Submit expense claims for approval</p>
                </div>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
                {[
                    { label: 'Filtered Requests', value: filteredList.length, color: '#253b50', bg: '#f1f5f9', border: '#cbd5e1' },
                    { label: 'Approved Amount', value: `₹${totalApproved.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
                    { label: 'Pending Amount', value: `₹${totalPending.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
                ].map((c, i) => (
                    <div key={i} style={{ background: c.bg, borderRadius: 14, padding: '18px 22px', border: `1.5px solid ${c.border}` }}>
                        <div style={{ fontSize: '0.78rem', color: c.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{c.label}</div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: c.color }}>{c.value}</div>
                    </div>
                ))}
            </div>

            {/* Submission Form */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #e2e8f0', padding: '28px', marginBottom: 28, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1e293b', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Plus size={18} color="#253b50" /> Submit New Request
                </h2>
                <form onSubmit={handleSubmit}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
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
                        <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', padding: '20px', borderRadius: 14, marginBottom: 16 }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#b45309', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                                🍔 Food Expense Claim Details
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                                {/* Food Type */}
                                <div>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>Meal Type *</label>
                                    <select
                                        value={form.foodType}
                                        onChange={e => setForm(f => ({ ...f, foodType: e.target.value }))}
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #fcd34d', fontSize: '0.88rem', outline: 'none', background: '#fff' }}
                                    >
                                        {FOOD_TYPES.map(t => <option key={t}>{t}</option>)}
                                    </select>
                                </div>

                                {/* From Location / Project */}
                                <div>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>From (Location / Project) *</label>
                                    <select
                                        value={form.foodFromLocation}
                                        onChange={e => setForm(f => ({ ...f, foodFromLocation: e.target.value }))}
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #fcd34d', fontSize: '0.88rem', outline: 'none', background: '#fff' }}
                                    >
                                        {locationOptions.map(loc => <option key={`food_from_${loc}`} value={loc}>{loc}</option>)}
                                    </select>
                                </div>

                                {/* To Location / Project */}
                                <div>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>To (Location / Project) *</label>
                                    <select
                                        value={form.foodToLocation}
                                        onChange={e => setForm(f => ({ ...f, foodToLocation: e.target.value }))}
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #fcd34d', fontSize: '0.88rem', outline: 'none', background: '#fff' }}
                                    >
                                        {locationOptions.map(loc => <option key={`food_to_${loc}`} value={loc}>{loc}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Travel Category Dynamic Fields */}
                    {form.category === 'Travel' && (
                        <div style={{ background: '#f0f4f8', border: '1.5px solid #cbd5e1', padding: '20px', borderRadius: 14, marginBottom: 16 }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#253b50', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Car size={16} /> Travel Claim Details
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 14 }}>
                                {/* Travel Type */}
                                <div>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>Travel Type *</label>
                                    <select
                                        value={form.travelType}
                                        onChange={e => setForm(f => ({ ...f, travelType: e.target.value }))}
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #cbd5e1', fontSize: '0.88rem', outline: 'none', background: '#fff' }}
                                    >
                                        {TRAVEL_TYPES.map(t => <option key={t}>{t}</option>)}
                                    </select>
                                </div>

                                {/* Distance */}
                                <div>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>Distance (in km) *</label>
                                    <input
                                        type="number"
                                        min="0.1"
                                        step="0.1"
                                        placeholder="e.g. 15.5"
                                        value={form.distance}
                                        onChange={e => setForm(f => ({ ...f, distance: e.target.value }))}
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #cbd5e1', fontSize: '0.88rem', outline: 'none', background: '#fff' }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                {/* From Location */}
                                <div>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>From (Location / Project) *</label>
                                    <select
                                        value={form.fromLocation}
                                        onChange={e => setForm(f => ({ ...f, fromLocation: e.target.value }))}
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #cbd5e1', fontSize: '0.88rem', outline: 'none', background: '#fff' }}
                                    >
                                        {locationOptions.map(loc => <option key={`from_${loc}`} value={loc}>{loc}</option>)}
                                    </select>
                                </div>

                                {/* To Location */}
                                <div>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>To (Location / Project) *</label>
                                    <select
                                        value={form.toLocation}
                                        onChange={e => setForm(f => ({ ...f, toLocation: e.target.value }))}
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #cbd5e1', fontSize: '0.88rem', outline: 'none', background: '#fff' }}
                                    >
                                        {locationOptions.map(loc => <option key={`to_${loc}`} value={loc}>{loc}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Recharge Category Dynamic Fields */}
                    {form.category === 'Recharge' && (
                        <div style={{ background: '#f5f3ff', border: '1.5px solid #ddd6fe', padding: '20px', borderRadius: 14, marginBottom: 16 }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#6d28d9', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Phone size={16} /> Recharge Claim Details
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                                {/* Phone Number */}
                                <div>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>Phone Number *</label>
                                    <input
                                        type="tel"
                                        placeholder="e.g. 9876543210"
                                        value={form.phoneNumber}
                                        onChange={e => setForm(f => ({ ...f, phoneNumber: e.target.value }))}
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #c4b5fd', fontSize: '0.88rem', outline: 'none', background: '#fff' }}
                                    />
                                </div>

                                {/* Date From */}
                                <div>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>Date From *</label>
                                    <input
                                        type="date"
                                        value={form.rechargeStartDate}
                                        onChange={e => setForm(f => ({ ...f, rechargeStartDate: e.target.value }))}
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #c4b5fd', fontSize: '0.88rem', outline: 'none', background: '#fff' }}
                                    />
                                </div>

                                {/* Date End */}
                                <div>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>Date End *</label>
                                    <input
                                        type="date"
                                        value={form.rechargeEndDate}
                                        onChange={e => setForm(f => ({ ...f, rechargeEndDate: e.target.value }))}
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #c4b5fd', fontSize: '0.88rem', outline: 'none', background: '#fff' }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Generic Category Location/Project Selection */}
                    {form.category !== 'Food' && form.category !== 'Travel' && (
                        <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', padding: '16px 20px', borderRadius: 14, marginBottom: 16 }}>
                            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: 12 }}>
                                📍 Project / Location Tagging
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                {/* From Location / Project */}
                                <div>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>From (Location / Project) *</label>
                                    <select
                                        value={form.fromLocation}
                                        onChange={e => setForm(f => ({ ...f, fromLocation: e.target.value }))}
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #cbd5e1', fontSize: '0.88rem', outline: 'none', background: '#fff' }}
                                    >
                                        {locationOptions.map(loc => <option key={`gen_from_${loc}`} value={loc}>{loc}</option>)}
                                    </select>
                                </div>

                                {/* To Location / Project */}
                                <div>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>To (Location / Project) *</label>
                                    <select
                                        value={form.toLocation}
                                        onChange={e => setForm(f => ({ ...f, toLocation: e.target.value }))}
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #cbd5e1', fontSize: '0.88rem', outline: 'none', background: '#fff' }}
                                    >
                                        {locationOptions.map(loc => <option key={`gen_to_${loc}`} value={loc}>{loc}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Reason */}
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
                            Reason / Notes (optional)
                        </label>
                        <textarea
                            rows={2}
                            placeholder="Add extra notes or comments..."
                            value={form.reason}
                            onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                            style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', outline: 'none', resize: 'vertical', background: '#f8fafc', fontFamily: 'inherit' }}
                        />
                    </div>

                    {/* Image Upload */}
                    <div style={{ marginBottom: 20 }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>Receipt Image (optional)</label>
                        <div
                            onClick={() => fileRef.current?.click()}
                            style={{ border: '2px dashed #cbd5e1', borderRadius: 12, padding: '18px', textAlign: 'center', cursor: 'pointer', background: '#f8fafc', transition: 'all 0.2s' }}
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
                                    <Upload size={24} color="#64748b" style={{ marginBottom: 6 }} />
                                    <p style={{ color: '#253b50', fontWeight: 600, fontSize: '0.88rem', margin: 0 }}>Click to upload receipt</p>
                                    <p style={{ color: '#94a3b8', fontSize: '0.75rem', margin: '4px 0 0' }}>JPEG, PNG supported</p>
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
                        style={{ background: 'linear-gradient(135deg,#253b50,#3b5066)', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 28px', fontWeight: 700, fontSize: '0.9rem', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Receipt size={16} /> {submitting ? 'Submitting...' : 'Submit Request'}
                    </button>
                </form>
            </div>

            {/* My Requests Table */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid #e2e8f0', padding: '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
                    <div>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>My Requests History</h2>
                        <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '2px 0 0' }}>💡 Click any row to view full claim details in popup</p>
                    </div>
                    {hasActiveFilters && (
                        <button onClick={clearFilters} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 8, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
                            <X size={13} /> Reset Filters
                        </button>
                    )}
                </div>

                {/* Filter Toolbar */}
                <div style={{ background: '#f8fafc', padding: 14, borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 20, display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                    {/* Search */}
                    <div style={{ position: 'relative', minWidth: 200, flex: 1 }}>
                        <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input 
                            placeholder="Filter by category or reason..." 
                            value={search} 
                            onChange={e => setSearch(e.target.value)}
                            style={{ width: '100%', padding: '7px 10px 7px 32px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.84rem', outline: 'none', background: '#fff' }} 
                        />
                    </div>

                    {/* Status filter buttons */}
                    <div style={{ display: 'flex', gap: 4, background: '#e2e8f0', padding: 3, borderRadius: 8 }}>
                        {(['all', 'pending', 'approved', 'rejected'] as const).map(s => (
                            <button 
                                key={s} 
                                onClick={() => setStatusFilter(s)}
                                style={{ padding: '5px 12px', borderRadius: 6, border: 'none', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize',
                                    background: statusFilter === s ? '#253b50' : 'transparent',
                                    color: statusFilter === s ? '#fff' : '#64748b' }}
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
                    <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                        <Receipt size={40} style={{ opacity: 0.3, marginBottom: 8 }} /><br />No requests found matching your filters
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                    {['Date', 'Category', 'Reason / Details', 'Amount', 'Status', 'Admin Note', 'Receipt', 'Action'].map(h => (
                                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredList.map((r, i) => (
                                    <tr 
                                        key={r.id} 
                                        onClick={() => setSelectedClaim(r)}
                                        style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa', cursor: 'pointer', transition: 'background 0.15s' }}
                                        onMouseEnter={e => (e.currentTarget.style.background = '#f0f4f8')}
                                        onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#fafafa')}
                                    >
                                        <td style={{ padding: '12px 14px', fontSize: '0.82rem', color: '#475569', whiteSpace: 'nowrap' }}>
                                            {r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                        </td>
                                        <td style={{ padding: '12px 14px' }}>
                                            <span style={{ background: (CATEGORY_COLORS[r.category] ?? '#253b50') + '20', color: CATEGORY_COLORS[r.category] ?? '#253b50', padding: '3px 10px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 700 }}>{r.category}</span>
                                        </td>
                                        <td style={{ padding: '12px 14px', fontSize: '0.85rem', color: '#334155', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {r.reason ? (r.reason.replace(/\[.*?\]/g, '').trim() || '—') : '—'}
                                        </td>
                                        <td style={{ padding: '12px 14px', fontSize: '0.9rem', fontWeight: 800, color: '#1e293b' }}>
                                            ₹{parseFloat(r.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td style={{ padding: '12px 14px' }}>{statusBadge(r.status)}</td>
                                        <td style={{ padding: '12px 14px', fontSize: '0.82rem', color: '#64748b' }}>{r.admin_note || '—'}</td>
                                        <td style={{ padding: '12px 14px' }}>
                                            {r.image_path ? (
                                                <button onClick={(e) => { e.stopPropagation(); setImageModal(getReceiptUrl(r.image_path)); }}
                                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
                                                    <ImageIcon size={13} /> View
                                                </button>
                                            ) : '—'}
                                        </td>
                                        <td style={{ padding: '12px 14px' }}>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setSelectedClaim(r); }}
                                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 600 }}
                                            >
                                                <Eye size={13} /> Details
                                            </button>
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

                            {/* Main Info Cards */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
                                <div style={{ background: '#fafafa', padding: '12px 14px', borderRadius: 12, border: '1px solid #f1f5f9' }}>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginBottom: 2 }}>Category</div>
                                    <div style={{ fontWeight: 800, color: CATEGORY_COLORS[selectedClaim.category] ?? '#253b50', fontSize: '0.92rem' }}>{selectedClaim.category}</div>
                                </div>
                                <div style={{ background: '#fafafa', padding: '12px 14px', borderRadius: 12, border: '1px solid #f1f5f9' }}>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginBottom: 2 }}>Applicant</div>
                                    <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '0.92rem' }}>{selectedClaim.employee_name || user?.name || 'Staff Member'}</div>
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
                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 6 }}>Notes & Description</div>
                                <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 12, border: '1px solid #e2e8f0', color: '#334155', fontSize: '0.86rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                                    {cleanNotes}
                                </div>
                            </div>

                            {/* Admin Note */}
                            {selectedClaim.admin_note && (
                                <div style={{ marginBottom: 18 }}>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 6 }}>Admin Review Note</div>
                                    <div style={{ background: '#eff6ff', padding: '12px 14px', borderRadius: 10, border: '1px solid #bfdbfe', color: '#1e40af', fontSize: '0.85rem' }}>
                                        {selectedClaim.admin_note}
                                    </div>
                                </div>
                            )}

                            {/* Attached Receipt Image */}
                            <div style={{ marginBottom: 22 }}>
                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 6 }}>Receipt Attachment</div>
                                {selectedClaim.image_path ? (
                                    <div onClick={() => setImageModal(selectedClaim.image_path ? (selectedClaim.image_path.startsWith('http') ? selectedClaim.image_path : `${API_BASE_URL}/${selectedClaim.image_path.replace(/^\//, '')}`) : '')}
                                        style={{ border: '1.5px solid #e2e8f0', borderRadius: 12, padding: 10, background: '#f8fafc', textAlign: 'center', cursor: 'pointer' }}>
                                        <img src={selectedClaim.image_path.startsWith('http') ? selectedClaim.image_path : `${API_BASE_URL}/${selectedClaim.image_path.replace(/^\//, '')}`} alt="Receipt" style={{ maxHeight: 170, maxWidth: '100%', borderRadius: 8, objectFit: 'contain' }} />
                                        <div style={{ fontSize: '0.75rem', color: '#0284c7', fontWeight: 600, marginTop: 4 }}>Click to view full receipt image</div>
                                    </div>
                                ) : (
                                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: 10, border: '1px solid #e2e8f0', color: '#94a3b8', fontSize: '0.82rem', textAlign: 'center' }}>
                                        No receipt image attached.
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button onClick={() => setSelectedClaim(null)} style={{ padding: '9px 22px', borderRadius: 10, background: '#253b50', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>
                                    Close Details
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Image Modal */}
            {imageModal && (
                <div onClick={() => setImageModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, cursor: 'pointer', padding: 20 }}>
                    <img src={imageModal} alt="Receipt" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 12, boxShadow: '0 24px 64px rgba(0,0,0,0.5)', objectFit: 'contain' }} />
                </div>
            )}
        </div>
    );
}


