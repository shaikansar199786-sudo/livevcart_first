import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import axios from 'axios';
import { Loader2, Trash2, Store, Plus, Camera, Upload, X, Check, Image as ImageIcon, Phone, Mail, MapPin, User, FileText, Search, Filter, Package, Truck, Users, Layers, Building2, RotateCcw, Edit2, Download, Eye, Printer, FileSpreadsheet, Landmark, CreditCard } from 'lucide-react';
import { API_BASE_URL } from '../config';

export const GlobalVendors: React.FC = () => {
    const [activeTab, setActiveTab] = useState('vendor_data');
    const [globalData, setGlobalData] = useState<any>({
        vendor_data: [],
        vendor_quta: [],
        transport: [],
        labor: [],
        miscellaneous: [],
        balance_sheet: [],
        registered_vendors: []
    });
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [projectTypeFilter, setProjectTypeFilter] = useState('all');
    const [vendorDataCategoryFilter, setVendorDataCategoryFilter] = useState<'all' | 'vendor' | 'transport' | 'labor' | 'miscellaneous'>('all');
    const [vendorDataStatusFilter, setVendorDataStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [deletingVendorId, setDeletingVendorId] = useState<string | number | null>(null);
    const [dateFilter, setDateFilter] = useState<'all' | 'last_month' | 'last_3_months' | 'last_6_months' | 'this_year' | 'custom'>('all');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');

    const formatVendorBadgeCode = (code: string | undefined, category: string, index: number = 0) => {
        const cat = (category || '').toLowerCase();
        let num = index + 1;
        if (code) {
            const matches = code.match(/(\d+)$/);
            if (matches && matches[1]) {
                const parsed = parseInt(matches[1], 10);
                if (!isNaN(parsed) && parsed > 0) {
                    num = parsed;
                }
            }
        }

        if (cat.includes('transport')) {
            return `LC-TRN-2026-${String(num).padStart(3, '0')}`;
        } else if (cat.includes('labor') || cat.includes('labour')) {
            return `LC-LAB-2026-${String(num).padStart(3, '0')}`;
        } else if (cat.includes('misc')) {
            return `LC-MISC-2026-${String(num).padStart(3, '0')}`;
        }
        return `LC-VND-2026-${String(num).padStart(4, '0')}`;
    };

    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
    const [editingState, setEditingState] = useState<Record<string, { field: string; value: any }>>({});

    // Vendor Creation & Edit & View Modal State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingVendorModal, setEditingVendorModal] = useState<any | null>(null);
    const [selectedVendorForView, setSelectedVendorForView] = useState<any | null>(null);
    const [previewImageModal, setPreviewImageModal] = useState<{ title: string; src: string } | null>(null);
    const [creatingVendor, setCreatingVendor] = useState(false);
    const [updatingVendor, setUpdatingVendor] = useState(false);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [photosList, setPhotosList] = useState<string[]>([]);
    
    const cameraInputRef = useRef<HTMLInputElement | null>(null);
    const aadharInputRef = useRef<HTMLInputElement | null>(null);
    const panInputRef = useRef<HTMLInputElement | null>(null);
    const bankFileInputRef = useRef<HTMLInputElement | null>(null);
    
    const [vendorForm, setVendorForm] = useState({
        vendor_name: '',
        category: 'Vendor',
        status: 'active',
        contact_person: '',
        phone: '',
        email: '',
        address: '',
        gst_number: '',
        aadhar_number: '',
        aadhar_file: null as string | null,
        pan_number: '',
        pan_file: null as string | null,
        bank_name: '',
        account_number: '',
        ifsc_code: '',
        account_holder: '',
        upi_id: '',
        bank_file: null as string | null
    });

    const compressImage = (file: File, maxWidth = 1200, maxHeight = 1200, quality = 0.75): Promise<string> => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    if (width > height) {
                        if (width > maxWidth) {
                            height = Math.round((height * maxWidth) / width);
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width = Math.round((width * maxHeight) / height);
                            height = maxHeight;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.drawImage(img, 0, 0, width, height);
                        resolve(canvas.toDataURL('image/jpeg', quality));
                    } else {
                        resolve(e.target?.result as string);
                    }
                };
                img.onerror = () => resolve(e.target?.result as string);
                img.src = e.target?.result as string;
            };
            reader.readAsDataURL(file);
        });
    };

    const handleMultiplePhotosUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        const newPhotos: string[] = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.type.startsWith('image/')) {
                try {
                    const compressed = await compressImage(file);
                    newPhotos.push(compressed);
                } catch (err) {
                    console.error('Error compressing image', err);
                }
            }
        }
        if (newPhotos.length > 0) {
            setPhotosList(prev => [...prev, ...newPhotos]);
            if (!photoPreview) setPhotoPreview(newPhotos[0]);
        }
        e.target.value = '';
    };

    const handleCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                const compressed = await compressImage(file);
                setPhotosList(prev => [...prev, compressed]);
                if (!photoPreview) setPhotoPreview(compressed);
            } catch (err) {
                console.error('Error compressing camera image', err);
            }
        }
        e.target.value = '';
    };

    const removePhotoAt = (index: number) => {
        setPhotosList(prev => {
            const updated = prev.filter((_, idx) => idx !== index);
            setPhotoPreview(updated.length > 0 ? updated[0] : null);
            return updated;
        });
    };

    const handleAadharUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                const compressed = await compressImage(file);
                setVendorForm(prev => ({ ...prev, aadhar_file: compressed }));
            } catch (err) {
                console.error('Error compressing aadhar file', err);
            }
        }
        e.target.value = '';
    };

    const handlePanUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                const compressed = await compressImage(file);
                setVendorForm(prev => ({ ...prev, pan_file: compressed }));
            } catch (err) {
                console.error('Error compressing pan file', err);
            }
        }
        e.target.value = '';
    };

    const handleBankFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                const compressed = await compressImage(file);
                setVendorForm(prev => ({ ...prev, bank_file: compressed }));
            } catch (err) {
                console.error('Error compressing bank file', err);
            }
        }
        e.target.value = '';
    };

    const handleCreateVendor = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!vendorForm.vendor_name.trim()) {
            alert('Please enter vendor name');
            return;
        }

        setCreatingVendor(true);
        try {
            const payload = {
                ...vendorForm,
                photo: photosList[0] || photoPreview || '',
                photos: photosList,
                documents: photosList
            };
            const response = await axios.post(`${API_BASE_URL}/vendors`, payload);
            if (response.data.status === 'success') {
                alert('Vendor profile created successfully!');
                setIsCreateModalOpen(false);
                setVendorForm({
                    vendor_name: '',
                    category: 'Vendor',
                    status: 'active',
                    contact_person: '',
                    phone: '',
                    email: '',
                    address: '',
                    gst_number: '',
                    aadhar_number: '',
                    aadhar_file: null,
                    pan_number: '',
                    pan_file: null,
                    bank_name: '',
                    account_number: '',
                    ifsc_code: '',
                    account_holder: '',
                    upi_id: '',
                    bank_file: null
                });
                setPhotosList([]);
                setPhotoPreview(null);
                fetchGlobalData();
            } else {
                alert(response.data.message || 'Failed to create vendor');
            }
        } catch (err) {
            console.error('Error creating vendor profile:', err);
            alert('Failed to create vendor profile');
        } finally {
            setCreatingVendor(false);
        }
    };

    const handleOpenEditModal = (vendor: any) => {
        const details = vendor.details || vendor;
        setEditingVendorModal(vendor);

        let bankDetailsObj: any = {};
        if (details?.bank_details) {
            try {
                bankDetailsObj = typeof details.bank_details === 'string' ? JSON.parse(details.bank_details) : details.bank_details;
            } catch (e) {
                bankDetailsObj = {};
            }
        }

        setVendorForm({
            vendor_name: vendor.vendor_name || details?.vendor_name || '',
            category: details?.category || vendor.category || 'Vendor',
            status: details?.status || vendor.status || 'active',
            contact_person: details?.contact_person || '',
            phone: details?.phone || '',
            email: details?.email || '',
            address: details?.address || '',
            gst_number: details?.gst_number || '',
            aadhar_number: details?.aadhar_number || '',
            aadhar_file: details?.aadhar_file || null,
            pan_number: details?.pan_number || '',
            pan_file: details?.pan_file || null,
            bank_name: details?.bank_name || bankDetailsObj.bank_name || '',
            account_number: details?.account_number || bankDetailsObj.account_number || '',
            ifsc_code: details?.ifsc_code || bankDetailsObj.ifsc_code || '',
            account_holder: details?.account_holder || bankDetailsObj.account_holder || '',
            upi_id: details?.upi_id || bankDetailsObj.upi_id || '',
            bank_file: details?.bank_file || bankDetailsObj.bank_file || null
        });

        let loadedPhotos: string[] = [];
        if (details?.documents) {
            try {
                const parsed = typeof details.documents === 'string' ? JSON.parse(details.documents) : details.documents;
                if (Array.isArray(parsed)) loadedPhotos = parsed;
            } catch (e) {
                if (typeof details.documents === 'string') loadedPhotos = [details.documents];
            }
        }
        if (details?.photo && !loadedPhotos.includes(details.photo)) {
            loadedPhotos.unshift(details.photo);
        }
        setPhotosList(loadedPhotos);
        setPhotoPreview(loadedPhotos[0] || details?.photo || null);
        setIsEditModalOpen(true);
    };

    const handleUpdateVendorProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!vendorForm.vendor_name.trim()) {
            alert('Please enter vendor name');
            return;
        }

        setUpdatingVendor(true);
        try {
            const payload = {
                vendor_id: editingVendorModal?.details?.vendor_id || editingVendorModal?.vendor_id,
                ...vendorForm,
                photo: photosList[0] || photoPreview || editingVendorModal?.details?.photo || '',
                photos: photosList,
                documents: photosList
            };
            const response = await axios.put(`${API_BASE_URL}/vendors/update-profile`, payload);
            if (response.data.status === 'success' || response.data.success) {
                alert('Vendor profile updated successfully!');
                setIsEditModalOpen(false);
                setEditingVendorModal(null);
                setSelectedVendorForView(null);
                fetchGlobalData();
            } else {
                alert(response.data.message || 'Failed to update vendor profile');
            }
        } catch (err) {
            console.error('Error updating vendor profile:', err);
            alert('Failed to update vendor profile');
        } finally {
            setUpdatingVendor(false);
        }
    };

    const handleToggleVendorStatus = async (vendor: any) => {
        const vId = vendor.details?.vendor_id || vendor.vendor_id;
        const vName = vendor.vendor_name || vendor.details?.vendor_name;
        const currentStatus = (vendor.status || vendor.details?.status || 'active').toLowerCase();
        const nextStatus = currentStatus === 'inactive' ? 'active' : 'inactive';

        try {
            const response = await axios.post(`${API_BASE_URL}/vendors/toggle-status`, {
                vendor_id: vId,
                vendor_name: vName,
                status: nextStatus
            });
            if (response.data.status === 'success' || response.data.success) {
                setGlobalData((prev: any) => {
                    const updateItem = (item: any) => {
                        const id = item.vendor_id || item.details?.vendor_id;
                        const name = item.vendor_name || item.details?.vendor_name;
                        if ((vId && id === vId) || (vName && name === vName)) {
                            return {
                                ...item,
                                status: nextStatus,
                                details: item.details ? { ...item.details, status: nextStatus } : item.details
                            };
                        }
                        return item;
                    };

                    return {
                        ...prev,
                        registered_vendors: (prev.registered_vendors || []).map(updateItem),
                        vendor_data: (prev.vendor_data || []).map(updateItem)
                    };
                });
                fetchGlobalData();
            } else {
                alert(response.data.message || 'Failed to update vendor status');
            }
        } catch (err) {
            console.error('Failed to toggle vendor status:', err);
            alert('Failed to update vendor status');
        }
    };

    const handleDeleteVendor = async (vendor: any) => {
        const vId = vendor.details?.vendor_id || vendor.vendor_id;
        const vName = vendor.vendor_name || vendor.details?.vendor_name;

        if (!vId && !vName) {
            alert('Vendor information is missing.');
            return;
        }

        const confirmDelete = window.confirm(
            `Are you sure you want to delete vendor "${vName}"?\n\nThis will remove this vendor profile from the directory.`
        );

        if (!confirmDelete) return;

        setDeletingVendorId(vId || vName);
        try {
            const response = await axios.post(`${API_BASE_URL}/vendors/delete`, {
                vendor_id: vId,
                vendor_name: vName
            });

            if (response.data.status === 'success' || response.data.success) {
                alert('Vendor profile deleted successfully!');
                fetchGlobalData();
            } else {
                const fallback = await axios.delete(`${API_BASE_URL}/vendors/delete-vendor`, {
                    data: { vendor_id: vId, vendor_name: vName }
                });
                if (fallback.data.status === 'success' || fallback.data.success) {
                    alert('Vendor profile deleted successfully!');
                    fetchGlobalData();
                } else {
                    alert(response.data.message || 'Failed to delete vendor profile');
                }
            }
        } catch (err) {
            console.error('Failed to delete vendor:', err);
            try {
                const fallback = await axios.delete(`${API_BASE_URL}/vendors/delete-vendor`, {
                    data: { vendor_id: vId, vendor_name: vName }
                });
                if (fallback.data.status === 'success' || fallback.data.success) {
                    alert('Vendor profile deleted successfully!');
                    fetchGlobalData();
                    return;
                }
            } catch {}
            alert('Failed to delete vendor profile.');
        } finally {
            setDeletingVendorId(null);
        }
    };

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
        { id: 'vendor_data', label: 'Vendor Data', icon: Store },
        { id: 'vendor_quta', label: 'Material Vendor', icon: Package },
        { id: 'transport', label: 'Transport', icon: Truck },
        { id: 'labor', label: 'Labour', icon: Users },
        { id: 'miscellaneous', label: 'Miscellaneous', icon: Layers }
    ];

    // ── Date range helper ────────────────────────────────────────────────────
    const getDateRange = (): { start: Date | null; end: Date | null } => {
        const now = new Date();
        if (dateFilter === 'last_month') {
            const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const end = new Date(now.getFullYear(), now.getMonth(), 0);
            return { start, end };
        }
        if (dateFilter === 'last_3_months') {
            return { start: new Date(now.getFullYear(), now.getMonth() - 3, 1), end: now };
        }
        if (dateFilter === 'last_6_months') {
            return { start: new Date(now.getFullYear(), now.getMonth() - 6, 1), end: now };
        }
        if (dateFilter === 'this_year') {
            return { start: new Date(selectedYear, 0, 1), end: new Date(selectedYear, 11, 31) };
        }
        if (dateFilter === 'custom') {
            return {
                start: customStartDate ? new Date(customStartDate) : null,
                end: customEndDate ? new Date(customEndDate) : null
            };
        }
        return { start: null, end: null };
    };

    const inRange = useCallback((dateStr: string): boolean => {
        if (dateFilter === 'all') return true;
        const { start, end } = getDateRange();
        if (!dateStr) return false;
        const d = new Date(dateStr);
        if (start && d < start) return false;
        if (end && d > end) return false;
        return true;
    }, [dateFilter, selectedYear, customStartDate, customEndDate]);

    const isFilterActive = searchQuery !== '' || projectTypeFilter !== 'all' || dateFilter !== 'all' || customStartDate !== '' || customEndDate !== '';

    const handleResetFilters = () => {
        setSearchQuery('');
        setProjectTypeFilter('all');
        setDateFilter('all');
        setSelectedYear(new Date().getFullYear());
        setCustomStartDate('');
        setCustomEndDate('');
    };

    // ── Filter helpers ───────────────────────────────────────────────────────
    const filterVendorQuta = useCallback((vendors: any[]) => {
        const q = searchQuery.toLowerCase();
        return (vendors || []).map(v => {
            const validItems = (v.items || []).filter((item: any) => {
                const itemDate = item.invoice_date || item.payment_date || '';
                const matchDate = inRange(itemDate);
                const matchSearch = !q || (v.vendor_name || '').toLowerCase().includes(q) ||
                    (item.site || '').toLowerCase().includes(q) ||
                    String(item.client_id || '').toLowerCase().includes(q);
                const pt = (item.project_type || '').toLowerCase();
                const matchType = projectTypeFilter === 'all' ||
                    (projectTypeFilter === 'furniture' && pt.includes('furniture')) ||
                    (projectTypeFilter === 'interior' && pt.includes('interior'));
                return matchDate && matchSearch && matchType;
            });
            return { ...v, items: validItems };
        }).filter(v => {
            const matchVendorName = !q || (v.vendor_name || '').toLowerCase().includes(q);
            if (v.items.length > 0) return true;
            if (matchVendorName && projectTypeFilter === 'all' && dateFilter === 'all') return true;
            return false;
        });
    }, [searchQuery, projectTypeFilter, dateFilter, inRange]);

    const filterPeople = useCallback((people: any[]) => {
        const q = searchQuery.toLowerCase();
        return (people || []).map(p => {
            const validTx = (p.transactions || []).filter((t: any) => {
                const matchDate = inRange(t.transaction_date);
                const matchSearch = !q || (p.person_name || '').toLowerCase().includes(q) ||
                    (t.site || '').toLowerCase().includes(q) ||
                    String(t.client_id || '').toLowerCase().includes(q);
                const pt = (t.project_type || '').toLowerCase();
                const matchType = projectTypeFilter === 'all' ||
                    (projectTypeFilter === 'furniture' && pt.includes('furniture')) ||
                    (projectTypeFilter === 'interior' && pt.includes('interior'));
                return matchDate && matchSearch && matchType;
            });
            return { ...p, transactions: validTx };
        }).filter(p => {
            const matchName = !q || (p.person_name || '').toLowerCase().includes(q);
            if (p.transactions.length > 0) return true;
            if (matchName && projectTypeFilter === 'all' && dateFilter === 'all') return true;
            return false;
        });
    }, [searchQuery, projectTypeFilter, dateFilter, inRange]);

    // ── Computed overview stats (responds to Search, Project Type & Date filters) ──────────────────────────────────────────────
    const overviewStats = useMemo(() => {
        const filteredVendorQuta = filterVendorQuta(globalData.vendor_quta);
        const filteredTransport = filterPeople(globalData.transport);
        const filteredLabor = filterPeople(globalData.labor);
        const filteredMisc = filterPeople(globalData.miscellaneous);

        // Vendor Quta: sum filtered by invoice_date & active filters
        const vendorQutaTotal = filteredVendorQuta.reduce((sum: number, v: any) =>
            sum + v.items.reduce((s: number, item: any) => s + parseFloat(item.total || 0), 0), 0);
        const vendorQutaPaid = filteredVendorQuta.reduce((sum: number, v: any) =>
            sum + v.items.reduce((s: number, item: any) => s + parseFloat(item.paid || 0), 0), 0);
        const vendorQutaOutstanding = vendorQutaTotal - vendorQutaPaid;
        const vendorQutaPaidVendors = filteredVendorQuta.filter((v: any) =>
            v.items.some((item: any) => parseFloat(item.paid || 0) > 0)
        ).length;

        // Transport (filtered by transaction_date & active filters)
        const transportTotal = filteredTransport.reduce((sum: number, p: any) =>
            p.transactions.filter((t: any) => t.payment_mode !== 'Unpaid').reduce((s: number, t: any) => s + parseFloat(t.amount || 0), 0) + sum, 0);
        const transportUnpaid = filteredTransport.reduce((sum: number, p: any) =>
            p.transactions.filter((t: any) => t.payment_mode === 'Unpaid').reduce((s: number, t: any) => s + parseFloat(t.amount || 0), 0) + sum, 0);
        const transportPaidVendors = filteredTransport.filter((p: any) =>
            p.transactions.some((t: any) => t.payment_mode !== 'Unpaid' && parseFloat(t.amount || 0) > 0)
        ).length;

        // Labor
        const laborTotal = filteredLabor.reduce((sum: number, p: any) =>
            p.transactions.filter((t: any) => t.payment_mode !== 'Unpaid').reduce((s: number, t: any) => s + parseFloat(t.amount || 0), 0) + sum, 0);
        const laborUnpaid = filteredLabor.reduce((sum: number, p: any) =>
            p.transactions.filter((t: any) => t.payment_mode === 'Unpaid').reduce((s: number, t: any) => s + parseFloat(t.amount || 0), 0) + sum, 0);
        const laborPaidVendors = filteredLabor.filter((p: any) =>
            p.transactions.some((t: any) => t.payment_mode !== 'Unpaid' && parseFloat(t.amount || 0) > 0)
        ).length;

        // Miscellaneous
        const miscTotal = filteredMisc.reduce((sum: number, p: any) =>
            p.transactions.filter((t: any) => t.payment_mode !== 'Unpaid').reduce((s: number, t: any) => s + parseFloat(t.amount || 0), 0) + sum, 0);
        const miscUnpaid = filteredMisc.reduce((sum: number, p: any) =>
            p.transactions.filter((t: any) => t.payment_mode === 'Unpaid').reduce((s: number, t: any) => s + parseFloat(t.amount || 0), 0) + sum, 0);
        const miscPaidVendors = filteredMisc.filter((p: any) =>
            p.transactions.some((t: any) => t.payment_mode !== 'Unpaid' && parseFloat(t.amount || 0) > 0)
        ).length;

        // Total unique projects across all categories (filtered)
        const allProjects = new Set<string>();
        [...filteredTransport, ...filteredLabor, ...filteredMisc].forEach((p: any) =>
            p.transactions.forEach((t: any) => { if (t.site) allProjects.add(t.site); }));
        filteredVendorQuta.forEach((v: any) =>
            v.items.forEach((item: any) => { if (item.site) allProjects.add(item.site); }));

        return {
            vendorQutaTotal, vendorQutaPaid, vendorQutaOutstanding, vendorQutaPaidVendors, vendorQutaCount: filteredVendorQuta.length,
            transportTotal, transportUnpaid, transportPaidVendors, transportCount: filteredTransport.length,
            laborTotal, laborUnpaid, laborPaidVendors, laborCount: filteredLabor.length,
            miscTotal, miscUnpaid, miscPaidVendors, miscCount: filteredMisc.length,
            balanceSheetCount: (globalData.balance_sheet || []).length,
            totalProjects: allProjects.size
        };
    }, [globalData, filterVendorQuta, filterPeople]);

    const getDisplayCategory = (cat: string) => {
        const c = (cat || '').toLowerCase();
        if (c.includes('transport')) return 'Transport';
        if (c.includes('labor') || c.includes('labour')) return 'Labour';
        if (c.includes('misc')) return 'Miscellaneous';
        return 'Material Vendor';
    };

    const filteredVendorData = useMemo(() => {
        const list = globalData.registered_vendors || [];
        const q = searchQuery.toLowerCase().trim();
        return list.filter((v: any) => {
            const cat = (v.category || 'Vendor').toLowerCase();
            
            // Category filter
            if (vendorDataCategoryFilter === 'vendor' && !cat.includes('vendor') && cat !== 'general') return false;
            if (vendorDataCategoryFilter === 'transport' && !cat.includes('transport')) return false;
            if (vendorDataCategoryFilter === 'labor' && !cat.includes('labor') && !cat.includes('labour')) return false;
            if (vendorDataCategoryFilter === 'miscellaneous' && !cat.includes('misc')) return false;

            // Status filter
            if (vendorDataStatusFilter !== 'all') {
                const isInactive = (v.status || v.details?.status || 'active').toLowerCase() === 'inactive';
                if (vendorDataStatusFilter === 'active' && isInactive) return false;
                if (vendorDataStatusFilter === 'inactive' && !isInactive) return false;
            }

            // Search query filter
            if (q) {
                const name = (v.vendor_name || '').toLowerCase();
                const code = (v.vendor_code || '').toLowerCase();
                const person = (v.contact_person || '').toLowerCase();
                const phone = (v.phone || '').toLowerCase();
                const email = (v.email || '').toLowerCase();
                const gst = (v.gst_number || '').toLowerCase();
                const addr = (v.address || '').toLowerCase();
                return name.includes(q) || code.includes(q) || person.includes(q) || phone.includes(q) || email.includes(q) || gst.includes(q) || addr.includes(q);
            }
            return true;
        });
    }, [globalData.registered_vendors, vendorDataCategoryFilter, vendorDataStatusFilter, searchQuery]);

    const exportVendorDataCSV = () => {
        const headers = ["Vendor ID", "Vendor Name", "Category", "Contact Person", "Phone", "Email", "Address", "GST Number", "Aadhaar Number", "PAN Number", "Status"];
        const rows = filteredVendorData.map((v: any, idx: number) => {
            const code = formatVendorBadgeCode(v.vendor_code, v.category || 'Vendor', idx);
            const cat = getDisplayCategory(v.category);
            return [
                code,
                v.vendor_name || '',
                cat,
                v.contact_person || '',
                v.phone || '',
                v.email || '',
                v.address || '',
                v.gst_number || '',
                v.aadhar_number || '',
                v.pan_number || '',
                v.status || 'Active'
            ];
        });
        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r: any[]) => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `vendor_data_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportVendorDataPDF = () => {
        window.print();
    };

    return (
        <div className="vendors-container" style={{ width: '100%', padding: '0 0 24px 0' }}>
            {/* Header Title Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ padding: '10px', backgroundColor: '#0c1527', borderRadius: '10px', color: '#fca412', boxShadow: '0 4px 12px rgba(12,21,39,0.15)' }}>
                        <Store size={24} />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0c1527', margin: 0, letterSpacing: '-0.02em' }}>
                            Global Vendors &amp; Material Accounts
                        </h1>
                        <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '3px 0 0 0' }}>
                            Track global vendor accounts, material purchases, transport costs, labor, and balance sheet
                        </p>
                    </div>
                </div>

                {/* Create Vendor Profile Button */}
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 20px',
                        backgroundColor: '#fca412',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '10px',
                        fontWeight: 800,
                        fontSize: '0.88rem',
                        cursor: 'pointer',
                        boxShadow: '0 3px 10px rgba(252,164,18,0.35)',
                        transition: 'all 0.2s ease'
                    }}
                >
                    <Plus size={18} /> Create Vendor Profile
                </button>
            </div>

            {/* ── Overview Cards ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '24px' }}>
                {/* Total Projects */}
                <div className="finance-card" style={{ border: '1.5px solid #ffe8c2', borderTop: '4px solid #fca412', padding: '20px', backgroundColor: '#ffffff', borderRadius: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <p style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Projects</p>
                            <h4 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0c1527', margin: 0 }}>{overviewStats.totalProjects}</h4>
                        </div>
                        <div style={{ backgroundColor: '#fff9f0', color: '#fca412', padding: '10px', borderRadius: '12px' }}>
                            <Building2 size={22} />
                        </div>
                    </div>
                    <div style={{ marginTop: '12px', fontSize: '0.75rem', color: '#64748b' }}>
                        Across all categories
                    </div>
                </div>

                {/* Material Vendor */}
                <div className="finance-card" style={{ border: '1.5px solid #ffe8c2', borderTop: '4px solid #f97316', padding: '20px', backgroundColor: '#ffffff', borderRadius: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <p style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>MATERIAL VENDOR</p>
                            <h4 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0c1527', margin: 0 }}>
                                ₹{overviewStats.vendorQutaTotal >= 100000 ? `${(overviewStats.vendorQutaTotal / 100000).toFixed(1)}L` : `${(overviewStats.vendorQutaTotal / 1000).toFixed(0)}K`}
                            </h4>
                        </div>
                        <div style={{ backgroundColor: '#fff7ed', color: '#f97316', padding: '10px', borderRadius: '12px' }}>
                            <Package size={22} />
                        </div>
                    </div>
                    <div style={{ marginTop: '12px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#ea580c', backgroundColor: '#fff7ed', padding: '2px 6px', borderRadius: '6px' }}>
                            Total: {overviewStats.vendorQutaCount} Vendors
                        </span>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#16a34a', backgroundColor: '#f0fdf4', padding: '2px 6px', borderRadius: '6px' }}>
                            Paid {overviewStats.vendorQutaPaidVendors} (₹{(overviewStats.vendorQutaPaid / 1000).toFixed(0)}K)
                        </span>
                        {overviewStats.vendorQutaOutstanding > 0 && <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#dc2626', backgroundColor: '#fef2f2', padding: '2px 6px', borderRadius: '6px' }}>Due ₹{(overviewStats.vendorQutaOutstanding / 1000).toFixed(0)}K</span>}
                    </div>
                </div>

                {/* Transport */}
                <div className="finance-card" style={{ border: '1.5px solid #ffe8c2', borderTop: '4px solid #6366f1', padding: '20px', backgroundColor: '#ffffff', borderRadius: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <p style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Transport</p>
                            <h4 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0c1527', margin: 0 }}>
                                ₹{overviewStats.transportTotal >= 100000 ? `${(overviewStats.transportTotal / 100000).toFixed(1)}L` : `${(overviewStats.transportTotal / 1000).toFixed(1)}K`}
                            </h4>
                        </div>
                        <div style={{ backgroundColor: '#eef2ff', color: '#6366f1', padding: '10px', borderRadius: '12px' }}>
                            <Truck size={22} />
                        </div>
                    </div>
                    <div style={{ marginTop: '12px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#4f46e5', backgroundColor: '#eef2ff', padding: '2px 6px', borderRadius: '6px' }}>
                            Total: {overviewStats.transportCount} Vendors
                        </span>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#16a34a', backgroundColor: '#f0fdf4', padding: '2px 6px', borderRadius: '6px' }}>
                            Paid {overviewStats.transportPaidVendors}
                        </span>
                        {overviewStats.transportUnpaid > 0 && <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#dc2626', backgroundColor: '#fef2f2', padding: '2px 6px', borderRadius: '6px' }}>Due ₹{(overviewStats.transportUnpaid / 1000).toFixed(1)}K</span>}
                    </div>
                </div>

                {/* Labour */}
                <div className="finance-card" style={{ border: '1.5px solid #ffe8c2', borderTop: '4px solid #10b981', padding: '20px', backgroundColor: '#ffffff', borderRadius: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <p style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>LABOUR</p>
                            <h4 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0c1527', margin: 0 }}>
                                ₹{overviewStats.laborTotal >= 100000 ? `${(overviewStats.laborTotal / 100000).toFixed(1)}L` : `${(overviewStats.laborTotal / 1000).toFixed(1)}K`}
                            </h4>
                        </div>
                        <div style={{ backgroundColor: '#ecfdf5', color: '#10b981', padding: '10px', borderRadius: '12px' }}>
                            <Users size={22} />
                        </div>
                    </div>
                    <div style={{ marginTop: '12px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#059669', backgroundColor: '#ecfdf5', padding: '2px 6px', borderRadius: '6px' }}>
                            Total: {overviewStats.laborCount} Vendors
                        </span>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#16a34a', backgroundColor: '#f0fdf4', padding: '2px 6px', borderRadius: '6px' }}>
                            Paid {overviewStats.laborPaidVendors}
                        </span>
                        {overviewStats.laborUnpaid > 0 && <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#dc2626', backgroundColor: '#fef2f2', padding: '2px 6px', borderRadius: '6px' }}>Due ₹{(overviewStats.laborUnpaid / 1000).toFixed(1)}K</span>}
                    </div>
                </div>

                {/* Miscellaneous */}
                <div className="finance-card" style={{ border: '1.5px solid #ffe8c2', borderTop: '4px solid #8b5cf6', padding: '20px', backgroundColor: '#ffffff', borderRadius: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <p style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Miscellaneous</p>
                            <h4 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0c1527', margin: 0 }}>
                                ₹{overviewStats.miscTotal >= 100000 ? `${(overviewStats.miscTotal / 100000).toFixed(1)}L` : `${(overviewStats.miscTotal / 1000).toFixed(1)}K`}
                            </h4>
                        </div>
                        <div style={{ backgroundColor: '#f5f3ff', color: '#8b5cf6', padding: '10px', borderRadius: '12px' }}>
                            <Layers size={22} />
                        </div>
                    </div>
                    <div style={{ marginTop: '12px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#7c3aed', backgroundColor: '#f5f3ff', padding: '2px 6px', borderRadius: '6px' }}>
                            Total: {overviewStats.miscCount} Vendors
                        </span>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#16a34a', backgroundColor: '#f0fdf4', padding: '2px 6px', borderRadius: '6px' }}>
                            Paid {overviewStats.miscPaidVendors}
                        </span>
                        {overviewStats.miscUnpaid > 0 && <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#dc2626', backgroundColor: '#fef2f2', padding: '2px 6px', borderRadius: '6px' }}>Due ₹{(overviewStats.miscUnpaid / 1000).toFixed(1)}K</span>}
                    </div>
                </div>
            </div>

            {/* Filter & Controller Bar (Matching Finance Page) */}
            <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: '16px 24px', borderRadius: '16px', border: '1.5px solid #ffe8c2', boxShadow: '0 4px 14px rgba(252,164,18,0.05)', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '12px', flex: '1', flexWrap: 'wrap', alignItems: 'center' }}>
                    {/* Statement Period Header */}
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0c1527', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Statement Period:</span>
                    
                    {/* Date Filter Buttons */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                        {[
                            { key: 'all' as const, label: 'All Time' },
                            { key: 'last_month' as const, label: 'Last Month' },
                            { key: 'last_3_months' as const, label: 'Last 3 Months' },
                            { key: 'last_6_months' as const, label: 'Last 6 Months' }
                        ].map(item => {
                            const isSelected = dateFilter === item.key;
                            return (
                                <button
                                    key={item.key}
                                    onClick={() => setDateFilter(item.key)}
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
                            Custom Range
                        </button>

                        {/* Custom Date Inputs */}
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
                            { key: 'furniture', label: 'Furniture projects' },
                            { key: 'interior', label: 'Interior Projects' }
                        ].map(typeItem => {
                            const isTypeSelected = projectTypeFilter === typeItem.key;
                            return (
                                <button
                                    key={typeItem.key}
                                    onClick={() => setProjectTypeFilter(typeItem.key)}
                                    style={{
                                        padding: '8px 16px',
                                        borderRadius: '8px',
                                        border: '1.5px solid',
                                        borderColor: isTypeSelected ? '#fca412' : '#ffe8c2',
                                        backgroundColor: isTypeSelected ? '#fca412' : '#ffffff',
                                        color: isTypeSelected ? '#ffffff' : '#0c1527',
                                        fontWeight: isTypeSelected ? 800 : 600,
                                        fontSize: '0.85rem',
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

                    {/* Clear / Reset Filters Button */}
                    {isFilterActive && (
                        <button
                            onClick={handleResetFilters}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '8px 14px',
                                borderRadius: '8px',
                                border: '1.5px solid #fca5a5',
                                backgroundColor: '#fef2f2',
                                color: '#dc2626',
                                fontWeight: 700,
                                fontSize: '0.82rem',
                                outline: 'none',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                marginLeft: '8px',
                                boxShadow: '0 2px 6px rgba(220,38,38,0.15)'
                            }}
                            title="Reset all search, category, and date range filters"
                        >
                            <RotateCcw size={14} /> Clear Filters
                        </button>
                    )}
                </div>

                {/* Search Bar */}
                <div style={{ position: 'relative', width: '280px' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search project by name..."
                        style={{
                            width: '100%', padding: '9px 12px 9px 36px',
                            borderRadius: '8px', border: '1.5px solid #ffe8c2',
                            fontSize: '0.85rem', color: '#0f172a', outline: 'none',
                            backgroundColor: '#ffffff', boxSizing: 'border-box'
                        }}
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* Navigation Tabs Bar */}
            <div className="tabs-container" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '28px', backgroundColor: '#ffffff', padding: '6px', borderRadius: '12px', border: '1.5px solid #ffe8c2', width: 'fit-content', boxShadow: '0 2px 8px rgba(252,164,18,0.06)' }}>
                {tabs.map(tab => {
                    const countMap: Record<string, number> = {
                        vendor_data: (globalData.registered_vendors || []).length,
                        vendor_quta: overviewStats.vendorQutaCount,
                        transport: overviewStats.transportCount,
                        labor: overviewStats.laborCount,
                        miscellaneous: overviewStats.miscCount
                    };
                    const count = countMap[tab.id] ?? 0;

                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                padding: '9px 20px',
                                border: 'none',
                                borderRadius: '8px',
                                backgroundColor: activeTab === tab.id ? '#0c1527' : 'transparent',
                                color: activeTab === tab.id ? '#fca412' : '#64748b',
                                fontWeight: 800,
                                fontSize: '0.88rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <tab.icon size={14} />
                            {tab.label} ({count})
                        </button>
                    );
                })}
            </div>


            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
                    <Loader2 className="animate-spin" size={44} color="#fca412" />
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: '24px', alignItems: 'start' }}>
                    {activeTab === 'vendor_data' && (() => {
                        return (
                            <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1.5px solid #ffe8c2', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)', overflow: 'hidden' }}>
                                {/* Top Controls & Filters */}
                                <div style={{ padding: '18px 24px', backgroundColor: '#fff9f0', borderBottom: '1.5px solid #ffe8c2', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                                    {/* Category Sub-Filters */}
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0c1527', textTransform: 'uppercase', letterSpacing: '0.4px', marginRight: '4px' }}>
                                            Category:
                                        </span>
                                        {[
                                            { key: 'all' as const, label: 'All Vendors', count: (globalData.registered_vendors || []).length },
                                            { key: 'vendor' as const, label: 'Material Vendor', count: (globalData.registered_vendors || []).filter((v: any) => { const c = (v.category || '').toLowerCase(); return c.includes('vendor') || c === 'general'; }).length },
                                            { key: 'transport' as const, label: 'Transport', count: (globalData.registered_vendors || []).filter((v: any) => (v.category || '').toLowerCase().includes('transport')).length },
                                            { key: 'labor' as const, label: 'Labour', count: (globalData.registered_vendors || []).filter((v: any) => { const c = (v.category || '').toLowerCase(); return c.includes('labor') || c.includes('labour'); }).length },
                                            { key: 'miscellaneous' as const, label: 'Miscellaneous', count: (globalData.registered_vendors || []).filter((v: any) => (v.category || '').toLowerCase().includes('misc')).length }
                                        ].map(item => {
                                            const isSelected = vendorDataCategoryFilter === item.key;
                                            return (
                                                <button
                                                    key={item.key}
                                                    onClick={() => setVendorDataCategoryFilter(item.key)}
                                                    style={{
                                                        padding: '6px 14px',
                                                        borderRadius: '8px',
                                                        border: '1.5px solid',
                                                        borderColor: isSelected ? '#fca412' : '#ffe8c2',
                                                        backgroundColor: isSelected ? '#0c1527' : '#ffffff',
                                                        color: isSelected ? '#fca412' : '#64748b',
                                                        fontWeight: 800,
                                                        fontSize: '0.82rem',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '6px'
                                                    }}
                                                >
                                                    {item.label}
                                                    <span style={{ fontSize: '0.72rem', padding: '1px 6px', borderRadius: '10px', backgroundColor: isSelected ? 'rgba(252,164,18,0.2)' : '#f1f5f9', color: isSelected ? '#fca412' : '#475569' }}>
                                                        {item.count}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                        {/* Status Sub-Filters */}
                                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginLeft: '6px', borderLeft: '1.5px solid #ffe8c2', paddingLeft: '12px' }}>
                                            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0c1527', textTransform: 'uppercase', letterSpacing: '0.4px', marginRight: '4px' }}>
                                                Status:
                                            </span>
                                            {[
                                                { key: 'all' as const, label: 'All' },
                                                { key: 'active' as const, label: 'Active' },
                                                { key: 'inactive' as const, label: 'Inactive' }
                                            ].map(item => {
                                                const isSelected = vendorDataStatusFilter === item.key;
                                                return (
                                                    <button
                                                        key={item.key}
                                                        onClick={() => setVendorDataStatusFilter(item.key)}
                                                        style={{
                                                            padding: '4px 10px',
                                                            borderRadius: '6px',
                                                            border: '1.5px solid',
                                                            borderColor: isSelected ? '#0c1527' : '#cbd5e1',
                                                            backgroundColor: isSelected ? '#0c1527' : '#ffffff',
                                                            color: isSelected ? '#ffffff' : '#64748b',
                                                            fontWeight: 700,
                                                            fontSize: '0.78rem',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.15s ease'
                                                        }}
                                                    >
                                                        {item.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Action Buttons: Export & Add */}
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <button
                                            onClick={exportVendorDataCSV}
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                padding: '8px 14px',
                                                backgroundColor: '#ffffff',
                                                color: '#0c1527',
                                                border: '1.5px solid #ffe8c2',
                                                borderRadius: '8px',
                                                fontWeight: 800,
                                                fontSize: '0.82rem',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                            title="Export Vendor List to CSV"
                                        >
                                            <FileSpreadsheet size={15} color="#16a34a" /> Export CSV
                                        </button>
                                        <button
                                            onClick={exportVendorDataPDF}
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                padding: '8px 14px',
                                                backgroundColor: '#ffffff',
                                                color: '#0c1527',
                                                border: '1.5px solid #ffe8c2',
                                                borderRadius: '8px',
                                                fontWeight: 800,
                                                fontSize: '0.82rem',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                            title="Print or Save Vendor Directory as PDF"
                                        >
                                            <Printer size={15} color="#6366f1" /> Print / PDF
                                        </button>
                                        <button
                                            onClick={() => setIsCreateModalOpen(true)}
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                padding: '8px 16px',
                                                backgroundColor: '#fca412',
                                                color: '#ffffff',
                                                border: 'none',
                                                borderRadius: '8px',
                                                fontWeight: 800,
                                                fontSize: '0.82rem',
                                                cursor: 'pointer',
                                                boxShadow: '0 2px 8px rgba(252,164,18,0.3)'
                                            }}
                                        >
                                            <Plus size={16} /> Add Vendor Profile
                                        </button>
                                    </div>
                                </div>

                                {/* Vendor Data Table */}
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
                                        <thead>
                                            <tr style={{ backgroundColor: '#0c1527', color: '#ffffff', borderBottom: '2px solid #ffe8c2' }}>
                                                <th style={{ padding: '14px 18px', fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#fca412' }}>Vendor ID</th>
                                                <th style={{ padding: '14px 18px', fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Vendor / Firm Name</th>
                                                <th style={{ padding: '14px 18px', fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Category</th>
                                                <th style={{ padding: '14px 18px', fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>Status</th>
                                                <th style={{ padding: '14px 18px', fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Contact Person</th>
                                                <th style={{ padding: '14px 18px', fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Contact Info</th>
                                                <th style={{ padding: '14px 18px', fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>GST Number</th>
                                                <th style={{ padding: '14px 18px', fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>KYC / Proofs</th>
                                                <th style={{ padding: '14px 18px', fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right' }}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredVendorData.length > 0 ? (
                                                filteredVendorData.map((vendor: any, vIdx: number) => {
                                                    const badgeId = formatVendorBadgeCode(vendor.vendor_code, vendor.category, vIdx);
                                                    const displayCat = getDisplayCategory(vendor.category);
                                                    
                                                    // Category Badge Colors
                                                    let catBg = '#fff7ed';
                                                    let catColor = '#ea580c';
                                                    let catBorder = '#ffedd5';
                                                    if (displayCat === 'Transport') {
                                                        catBg = '#eef2ff'; catColor = '#4f46e5'; catBorder = '#e0e7ff';
                                                    } else if (displayCat === 'Labour') {
                                                        catBg = '#ecfdf5'; catColor = '#059669'; catBorder = '#d1fae5';
                                                    } else if (displayCat === 'Miscellaneous') {
                                                        catBg = '#f5f3ff'; catColor = '#7c3aed'; catBorder = '#ede9fe';
                                                    }

                                                    return (
                                                        <tr
                                                            key={vendor.vendor_id || vIdx}
                                                            style={{
                                                                borderBottom: '1px solid #f1f5f9',
                                                                backgroundColor: vIdx % 2 === 0 ? '#ffffff' : '#fcfcfd',
                                                                transition: 'background-color 0.15s'
                                                            }}
                                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fff9f0'}
                                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = vIdx % 2 === 0 ? '#ffffff' : '#fcfcfd'}
                                                        >
                                                            {/* Vendor ID */}
                                                            <td style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                                                                <span style={{
                                                                    fontSize: '0.8rem',
                                                                    fontWeight: 800,
                                                                    backgroundColor: '#0c1527',
                                                                    color: '#fca412',
                                                                    padding: '4px 10px',
                                                                    borderRadius: '6px',
                                                                    display: 'inline-block',
                                                                    letterSpacing: '0.4px',
                                                                    fontFamily: 'monospace'
                                                                }}>
                                                                    {badgeId}
                                                                </span>
                                                            </td>

                                                            {/* Vendor / Firm Name (No image box as requested) */}
                                                            <td style={{ padding: '14px 18px' }}>
                                                                <div>
                                                                    <div
                                                                        onClick={() => setSelectedVendorForView(vendor)}
                                                                        style={{ fontWeight: 800, color: '#0c1527', fontSize: '0.92rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                                                                        title="Click to view full vendor profile"
                                                                    >
                                                                        {vendor.vendor_name}
                                                                    </div>
                                                                    {vendor.address && (
                                                                        <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                                                            <MapPin size={11} color="#94a3b8" /> {vendor.address}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </td>

                                                            {/* Category */}
                                                            <td style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                                                                <span style={{
                                                                    fontSize: '0.75rem',
                                                                    fontWeight: 800,
                                                                    padding: '4px 10px',
                                                                    borderRadius: '8px',
                                                                    backgroundColor: catBg,
                                                                    color: catColor,
                                                                    border: `1px solid ${catBorder}`,
                                                                    display: 'inline-block'
                                                                }}>
                                                                    {displayCat}
                                                                </span>
                                                            </td>

                                                            {/* Status with Toggle */}
                                                            <td style={{ padding: '14px 18px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                                                {(() => {
                                                                    const isInactive = (vendor.status || vendor.details?.status || 'active').toLowerCase() === 'inactive';
                                                                    return (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleToggleVendorStatus(vendor)}
                                                                            style={{
                                                                                display: 'inline-flex',
                                                                                alignItems: 'center',
                                                                                gap: '5px',
                                                                                padding: '4px 10px',
                                                                                borderRadius: '20px',
                                                                                border: isInactive ? '1.5px solid #cbd5e1' : '1.5px solid #bbf7d0',
                                                                                backgroundColor: isInactive ? '#f8fafc' : '#f0fdf4',
                                                                                color: isInactive ? '#64748b' : '#16a34a',
                                                                                fontSize: '0.75rem',
                                                                                fontWeight: 800,
                                                                                cursor: 'pointer',
                                                                                transition: 'all 0.15s ease'
                                                                            }}
                                                                            title={`Click to set vendor as ${isInactive ? 'Active' : 'Inactive'}`}
                                                                        >
                                                                            <span style={{
                                                                                width: '7px',
                                                                                height: '7px',
                                                                                borderRadius: '50%',
                                                                                backgroundColor: isInactive ? '#94a3b8' : '#16a34a'
                                                                            }} />
                                                                            {isInactive ? 'Inactive' : 'Active'}
                                                                        </button>
                                                                    );
                                                                })()}
                                                            </td>

                                                            {/* Contact Person */}
                                                            <td style={{ padding: '14px 18px' }}>
                                                                {vendor.contact_person ? (
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#0c1527' }}>
                                                                        <User size={14} color="#fca412" /> {vendor.contact_person}
                                                                    </div>
                                                                ) : (
                                                                    <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontStyle: 'italic' }}>Not specified</span>
                                                                )}
                                                            </td>

                                                            {/* Phone & Email */}
                                                            <td style={{ padding: '14px 18px' }}>
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                                    {vendor.phone ? (
                                                                        <a href={`tel:${vendor.phone}`} style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0c1527', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                                                            <Phone size={12} color="#16a34a" /> {vendor.phone}
                                                                        </a>
                                                                    ) : (
                                                                        <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>No phone</span>
                                                                    )}
                                                                    {vendor.email && (
                                                                        <a href={`mailto:${vendor.email}`} style={{ fontSize: '0.75rem', color: '#64748b', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                                                            <Mail size={11} color="#6366f1" /> {vendor.email}
                                                                        </a>
                                                                    )}
                                                                </div>
                                                            </td>

                                                            {/* GST Number */}
                                                            <td style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                                                                {vendor.gst_number ? (
                                                                    <span style={{
                                                                        fontSize: '0.76rem',
                                                                        fontWeight: 800,
                                                                        fontFamily: 'monospace',
                                                                        backgroundColor: '#f8fafc',
                                                                        color: '#0c1527',
                                                                        padding: '3px 8px',
                                                                        borderRadius: '6px',
                                                                        border: '1px solid #cbd5e1'
                                                                    }}>
                                                                        {vendor.gst_number}
                                                                    </span>
                                                                ) : (
                                                                    <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>—</span>
                                                                )}
                                                            </td>

                                                            {/* KYC / Proofs */}
                                                            <td style={{ padding: '14px 18px' }}>
                                                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                                                                    {/* Aadhaar */}
                                                                    {vendor.aadhar_number || vendor.aadhar_file ? (
                                                                        <span
                                                                            onClick={() => vendor.aadhar_file && setPreviewImageModal({ title: `${vendor.vendor_name} - Aadhaar Card`, src: vendor.aadhar_file })}
                                                                            style={{
                                                                                fontSize: '0.72rem',
                                                                                fontWeight: 700,
                                                                                padding: '2px 8px',
                                                                                borderRadius: '6px',
                                                                                backgroundColor: '#f0fdf4',
                                                                                color: '#16a34a',
                                                                                border: '1px solid #bbf7d0',
                                                                                cursor: vendor.aadhar_file ? 'pointer' : 'default',
                                                                                display: 'inline-flex',
                                                                                alignItems: 'center',
                                                                                gap: '4px'
                                                                            }}
                                                                            title={vendor.aadhar_file ? 'Click to view Aadhaar Document' : `Aadhaar: ${vendor.aadhar_number}`}
                                                                        >
                                                                            🪪 Aadhaar {vendor.aadhar_file ? '🔍' : '✓'}
                                                                        </span>
                                                                    ) : (
                                                                        <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Aadhaar: —</span>
                                                                    )}

                                                                    {/* PAN */}
                                                                    {vendor.pan_number || vendor.pan_file ? (
                                                                        <span
                                                                            onClick={() => vendor.pan_file && setPreviewImageModal({ title: `${vendor.vendor_name} - PAN Card`, src: vendor.pan_file })}
                                                                            style={{
                                                                                fontSize: '0.72rem',
                                                                                fontWeight: 700,
                                                                                padding: '2px 8px',
                                                                                borderRadius: '6px',
                                                                                backgroundColor: '#eef2ff',
                                                                                color: '#4f46e5',
                                                                                border: '1px solid #c7d2fe',
                                                                                cursor: vendor.pan_file ? 'pointer' : 'default',
                                                                                display: 'inline-flex',
                                                                                alignItems: 'center',
                                                                                gap: '4px'
                                                                            }}
                                                                            title={vendor.pan_file ? 'Click to view PAN Document' : `PAN: ${vendor.pan_number}`}
                                                                        >
                                                                            💳 PAN {vendor.pan_file ? '🔍' : '✓'}
                                                                        </span>
                                                                    ) : (
                                                                        <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>PAN: —</span>
                                                                    )}
                                                                </div>
                                                            </td>

                                                            {/* Actions */}
                                                            <td style={{ padding: '14px 18px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                                <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                                                                    <button
                                                                        onClick={() => setSelectedVendorForView(vendor)}
                                                                        style={{
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center',
                                                                            gap: '4px',
                                                                            padding: '6px 10px',
                                                                            backgroundColor: '#fff9f0',
                                                                            color: '#0c1527',
                                                                            border: '1.5px solid #ffe8c2',
                                                                            borderRadius: '6px',
                                                                            fontSize: '0.78rem',
                                                                            fontWeight: 800,
                                                                            cursor: 'pointer'
                                                                        }}
                                                                        title="View full profile & identity proofs"
                                                                    >
                                                                        <Eye size={13} color="#fca412" /> View
                                                                    </button>

                                                                    <button
                                                                        onClick={() => handleOpenEditModal(vendor)}
                                                                        style={{
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center',
                                                                            gap: '4px',
                                                                            padding: '6px 10px',
                                                                            backgroundColor: '#ffffff',
                                                                            color: '#0c1527',
                                                                            border: '1.5px solid #ffe8c2',
                                                                            borderRadius: '6px',
                                                                            fontSize: '0.78rem',
                                                                            fontWeight: 800,
                                                                            cursor: 'pointer'
                                                                        }}
                                                                        title="Edit vendor profile & identity proofs"
                                                                    >
                                                                        <Edit2 size={13} color="#fca412" /> Edit
                                                                    </button>

                                                                    <button
                                                                        onClick={() => handleDeleteVendor(vendor)}
                                                                        disabled={deletingVendorId === (vendor.details?.vendor_id || vendor.vendor_id || vendor.vendor_name)}
                                                                        style={{
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center',
                                                                            gap: '4px',
                                                                            padding: '6px 10px',
                                                                            backgroundColor: '#fff5f5',
                                                                            color: '#dc2626',
                                                                            border: '1.5px solid #fecaca',
                                                                            borderRadius: '6px',
                                                                            fontSize: '0.78rem',
                                                                            fontWeight: 800,
                                                                            cursor: deletingVendorId === (vendor.details?.vendor_id || vendor.vendor_id || vendor.vendor_name) ? 'not-allowed' : 'pointer',
                                                                            opacity: deletingVendorId === (vendor.details?.vendor_id || vendor.vendor_id || vendor.vendor_name) ? 0.6 : 1,
                                                                            transition: 'all 0.15s ease'
                                                                        }}
                                                                        title="Delete vendor profile"
                                                                    >
                                                                        {deletingVendorId === (vendor.details?.vendor_id || vendor.vendor_id || vendor.vendor_name) ? (
                                                                            <Loader2 size={13} className="animate-spin" />
                                                                        ) : (
                                                                            <Trash2 size={13} />
                                                                        )} Delete
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            ) : (
                                                <tr>
                                                    <td colSpan={9} style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
                                                        <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🏬</div>
                                                        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0c1527', marginBottom: '4px' }}>No vendor profiles found</div>
                                                        <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '16px' }}>Try adjusting your search query or category filter</div>
                                                        <button
                                                            onClick={() => { setVendorDataCategoryFilter('all'); setVendorDataStatusFilter('all'); setSearchQuery(''); }}
                                                            style={{ padding: '8px 16px', borderRadius: '8px', border: '1.5px solid #ffe8c2', backgroundColor: '#ffffff', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}
                                                        >
                                                            Reset Filters
                                                        </button>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })()}

                    {activeTab === 'vendor_quta' && (() => {
                        const filtered = filterVendorQuta(globalData.vendor_quta);
                        return filtered.length > 0 ? (
                            filtered.map((vendor: any, index: number) => (
                                <div key={index} className="vendor-card" style={{ backgroundColor: '#ffffff', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)', border: '1.5px solid #ffe8c2', padding: 0 }}>
                                    <div style={{ backgroundColor: '#fff9f0', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1.5px solid #ffe8c2' }}>
                                        <div
                                            onClick={() => setSelectedVendorForView(vendor)}
                                            style={{ fontWeight: 800, fontSize: '1.15rem', color: '#0c1527', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                                            title="Click to view company details & identity proofs"
                                        >
                                            <span>🏬</span> {vendor.vendor_name}
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, backgroundColor: '#0c1527', color: '#fca412', padding: '2px 8px', borderRadius: '6px' }}>
                                                {formatVendorBadgeCode(vendor.details?.vendor_code, vendor.details?.category || 'Vendor', index)}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            <button
                                                onClick={() => handleOpenEditModal(vendor)}
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    padding: '7px 14px',
                                                    backgroundColor: '#ffffff',
                                                    color: '#0c1527',
                                                    border: '1.5px solid #ffe8c2',
                                                    borderRadius: '8px',
                                                    fontSize: '0.82rem',
                                                    fontWeight: 800,
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <Edit2 size={14} color="#fca412" /> Edit Profile
                                            </button>
                                            <button
                                                onClick={() => setSelectedVendorForView(vendor)}
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    padding: '7px 16px',
                                                    backgroundColor: '#0c1527',
                                                    color: '#fca412',
                                                    border: 'none',
                                                    borderRadius: '8px',
                                                    fontSize: '0.82rem',
                                                    fontWeight: 800,
                                                    cursor: 'pointer',
                                                    boxShadow: '0 2px 6px rgba(12,21,39,0.15)'
                                                }}
                                            >
                                                <FileText size={14} /> View Profile &amp; ID Proofs
                                            </button>
                                        </div>
                                    </div>
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                                            <thead>
                                                <tr style={{ backgroundColor: '#ffffff', borderBottom: '2px solid #e2e8f0' }}>
                                                    <th style={{ padding: '12px', fontWeight: 800, color: '#0c1527', fontSize: '0.8rem', textTransform: 'uppercase', textAlign: 'center', width: '50px' }}>S.No</th>
                                                    <th style={{ padding: '12px', fontWeight: 800, color: '#0c1527', fontSize: '0.8rem', textTransform: 'uppercase' }}>Project / Site</th>
                                                    <th style={{ padding: '12px', fontWeight: 800, color: '#0c1527', fontSize: '0.8rem', textTransform: 'uppercase' }}>Bill Date</th>
                                                    <th style={{ padding: '12px', fontWeight: 800, color: '#0c1527', fontSize: '0.8rem', textTransform: 'uppercase', textAlign: 'right' }}>Payment Amount</th>
                                                    <th style={{ padding: '12px', fontWeight: 800, color: '#0c1527', fontSize: '0.8rem', textTransform: 'uppercase', textAlign: 'right' }}>Bill Amount (Invoice Total)</th>
                                                    <th style={{ padding: '12px', fontWeight: 800, color: '#0c1527', fontSize: '0.8rem', textTransform: 'uppercase' }}>Mode</th>
                                                    <th style={{ padding: '12px', fontWeight: 800, color: '#0c1527', fontSize: '0.8rem', textTransform: 'uppercase' }}>Remarks</th>
                                                    <th style={{ padding: '12px', fontWeight: 800, color: '#0c1527', fontSize: '0.8rem', textTransform: 'uppercase', textAlign: 'center', width: '60px' }}>Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                 {vendor.items.length === 0 ? (
                                                     <tr>
                                                         <td colSpan={8} style={{ padding: '24px 12px', textAlign: 'center', color: '#94a3b8', fontSize: '0.88rem', fontWeight: 600 }}>
                                                             Vendor profile registered. No material bills or quotes logged yet.
                                                         </td>
                                                     </tr>
                                                 ) : (
                                                     (() => {
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

                                                         let sno = 1;
                                                         return Object.values(grouped).map((group: any, gIdx: number) => {
                                                             const editingId = `${vendor.vendor_name}-${group.billDate}-${group.invoiceTotal}-${group.site}`;
                                                             const isEditingPaymentAmount = editingState[editingId]?.field === 'payment_amount';
                                                             const isEditingPaymentMode = editingState[editingId]?.field === 'payment_mode';
                                                             const isEditingRemLivincart = editingState[editingId]?.field === 'remLivincart';
                                                             const editing = editingState[editingId];

                                                             return (
                                                                 <tr key={gIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                                     <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: '#64748b' }}>{sno++}</td>
                                                                     <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0c1527' }}>
                                                                         {group.site}
                                                                         <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>
                                                                             {group.items.length} item{group.items.length > 1 ? 's' : ''} ({group.items.map((it: any) => it.item_name || it.name).join(', ')})
                                                                         </div>
                                                                     </td>
                                                                     <td style={{ padding: '10px 12px', color: '#64748b', fontWeight: 600 }}>
                                                                         {group.billDate ? new Date(group.billDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                                                                     </td>
                                                                     <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                                                                         {isEditingPaymentAmount ? (
                                                                             <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                                                                                 <input
                                                                                     type="number"
                                                                                     value={editing?.value || 0}
                                                                                     onChange={(e) => updateEditingValue(editingId, parseFloat(e.target.value))}
                                                                                     style={{ padding: '4px', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '0.85rem', width: '100px', textAlign: 'right' }}
                                                                                 />
                                                                                 <button onClick={() => handleSave(editingId)} style={{ padding: '4px 8px', background: '#059669', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>✓</button>
                                                                                 <button onClick={() => cancelEditing(editingId)} style={{ padding: '4px 8px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>✗</button>
                                                                             </div>
                                                                         ) : (
                                                                             <span onClick={() => startEditing(editingId, 'payment_amount', group.paymentAmount || 0)} style={{ cursor: 'pointer', textDecoration: 'underline' }}>
                                                                                 ₹{group.paymentAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                             </span>
                                                                         )}
                                                                         {group.paymentDate && group.paymentDate !== '-' && (
                                                                             <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 500 }}>
                                                                                 Paid: {new Date(group.paymentDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                                                             </div>
                                                                         )}
                                                                     </td>
                                                                     <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#0c1527' }}>
                                                                         ₹{group.invoiceTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                     </td>
                                                                     <td style={{ padding: '10px 12px', color: '#64748b' }}>
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
                                                                                 <button onClick={() => handleSave(editingId)} style={{ padding: '4px 8px', background: '#059669', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>✓</button>
                                                                                 <button onClick={() => cancelEditing(editingId)} style={{ padding: '4px 8px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>✗</button>
                                                                             </div>
                                                                         ) : (
                                                                             <span onClick={() => startEditing(editingId, 'payment_mode', group.paymentMode || 'Cash')} style={{ cursor: 'pointer', textDecoration: 'underline' }}>
                                                                                 {group.paymentMode || '-'}
                                                                             </span>
                                                                         )}
                                                                     </td>
                                                                     <td style={{ padding: '10px 12px', color: '#64748b' }}>
                                                                         {isEditingRemLivincart ? (
                                                                             <div style={{ display: 'flex', gap: '4px' }}>
                                                                                 <input
                                                                                     type="text"
                                                                                     value={editing?.value || ''}
                                                                                     onChange={(e) => updateEditingValue(editingId, e.target.value)}
                                                                                     style={{ padding: '4px', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '0.85rem', width: '150px' }}
                                                                                 />
                                                                                 <button onClick={() => handleSave(editingId)} style={{ padding: '4px 8px', background: '#059669', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>✓</button>
                                                                                 <button onClick={() => cancelEditing(editingId)} style={{ padding: '4px 8px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>✗</button>
                                                                             </div>
                                                                         ) : (
                                                                             <span onClick={() => startEditing(editingId, 'remLivincart', group.remLivincart || '')} style={{ cursor: 'pointer', textDecoration: 'underline' }}>
                                                                                 {group.remLivincart || '-'}
                                                                             </span>
                                                                         )}
                                                                     </td>
                                                                     <td style={{ padding: '10px 12px', color: '#64748b', textAlign: 'center' }}>
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
                                                     })()
                                                 )}
                                                 {(() => {
                                                     const totalBillAmount = vendor.items.reduce((sum: number, item: any) => sum + parseFloat(item.total || 0), 0);
                                                     const totalPaymentAmount = vendor.items.reduce((sum: number, item: any) => sum + parseFloat(item.paid || 0), 0);
                                                     const totalUnpaid = totalBillAmount - totalPaymentAmount;
                                                     return (
                                                         <>
                                                             <tr style={{ backgroundColor: '#ffffff', borderTop: '2px solid #e2e8f0' }}>
                                                                 <td colSpan={4} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#0c1527' }}>Total Bill Amount =</td>
                                                                 <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#0c1527' }}>
                                                                     ₹{totalBillAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                 </td>
                                                                 <td colSpan={3}></td>
                                                             </tr>
                                                             <tr style={{ backgroundColor: '#ffffff' }}>
                                                                 <td colSpan={3} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>Total Payment Amount =</td>
                                                                 <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>
                                                                     ₹{totalPaymentAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                 </td>
                                                                 <td colSpan={4}></td>
                                                             </tr>
                                                             <tr style={{ backgroundColor: '#ffffff', borderTop: '1px solid #e2e8f0' }}>
                                                                 <td colSpan={4} style={{ padding: '14px 12px', textAlign: 'right', fontWeight: 800, color: '#0c1527' }}>Total Outstanding =</td>
                                                                 <td style={{ padding: '14px 12px', textAlign: 'right', fontWeight: 800, color: '#dc2626', fontSize: '1.05rem' }}>
                                                                     ₹{totalUnpaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                 </td>
                                                                 <td colSpan={3}></td>
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
                            <div style={{ textAlign: 'center', padding: '40px', backgroundColor: '#ffffff', borderRadius: '16px', border: '1.5px solid #ffe8c2', color: '#64748b', fontSize: '1.1rem' }}>
                                No vendor records found{(searchQuery || projectTypeFilter !== 'all') ? ' matching filters' : ''}.
                            </div>
                        );
                    })()}

                    {['transport', 'labor', 'miscellaneous'].includes(activeTab) && (() => {
                        const filteredPeople = filterPeople(globalData[activeTab]);
                        return filteredPeople.length > 0 ? (
                            <div className="vendors-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px' }}>
                                {filteredPeople.map((person: any, index: number) => {
                                    const grouped = person.transactions.reduce((acc: any, t: any) => {
                                        const site = t.site || 'General';
                                        if (!acc[site]) {
                                            acc[site] = { site, total: 0, paid: 0, unpaid: 0, latest_date: t.transaction_date, items: [] };
                                        }
                                        const amt = parseFloat(t.amount);
                                        acc[site].total += amt;
                                        if (t.payment_mode === 'Unpaid') {
                                            acc[site].unpaid += amt;
                                        } else {
                                            acc[site].paid += amt;
                                        }
                                        acc[site].items.push(t);
                                        if (new Date(t.transaction_date) > new Date(acc[site].latest_date)) {
                                            acc[site].latest_date = t.transaction_date;
                                        }
                                        return acc;
                                    }, {});

                                    const siteGroups = Object.values(grouped);
                                    const totalPaid = person.transactions.filter((t: any) => t.payment_mode !== 'Unpaid').reduce((s: number, t: any) => s + parseFloat(t.amount), 0);
                                    const totalUnpaid = person.transactions.filter((t: any) => t.payment_mode === 'Unpaid').reduce((s: number, t: any) => s + parseFloat(t.amount), 0);

                                    return (
                                        <div key={index} className="vendor-card" style={{ backgroundColor: '#ffffff', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)', border: '1.5px solid #ffe8c2', padding: 0 }}>
                                            <div style={{ backgroundColor: '#fff9f0', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1.5px solid #ffe8c2' }}>
                                                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#0c1527', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span>👤</span> {person.person_name}
                                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, backgroundColor: '#0c1527', color: '#fca412', padding: '2px 8px', borderRadius: '6px' }}>
                                                        {formatVendorBadgeCode(person.details?.vendor_code, person.details?.category || activeTab, index)}
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                    {person.details && (
                                                        <button
                                                            onClick={() => handleOpenEditModal(person)}
                                                            style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '6px',
                                                                padding: '5px 12px',
                                                                backgroundColor: '#ffffff',
                                                                color: '#0c1527',
                                                                border: '1.5px solid #ffe8c2',
                                                                borderRadius: '8px',
                                                                fontSize: '0.8rem',
                                                                fontWeight: 800,
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            <Edit2 size={13} color="#fca412" /> Edit Profile
                                                        </button>
                                                    )}
                                                    {totalUnpaid > 0 && (
                                                        <span style={{ backgroundColor: '#fef2f2', color: '#dc2626', fontSize: '0.75rem', fontWeight: 700, padding: '3px 10px', borderRadius: '12px' }}>
                                                            ₹{totalUnpaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Unpaid
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div style={{ padding: '0' }}>
                                                {siteGroups.length === 0 ? (
                                                    <div style={{ padding: '24px 20px', textAlign: 'center', color: '#94a3b8', fontSize: '0.88rem', fontWeight: 600 }}>
                                                        Vendor profile registered. No finance transactions recorded yet.
                                                    </div>
                                                ) : (
                                                    siteGroups.map((group: any, gIdx: number) => {
                                                    const groupKey = `${person.person_name}-${group.site}-${index}`;
                                                    const isExpanded = !!expandedGroups[groupKey];
                                                    return (
                                                        <div key={gIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                            <div
                                                                onClick={() => toggleGroup(groupKey)}
                                                                style={{
                                                                    display: 'grid',
                                                                    gridTemplateColumns: '1fr 120px 140px',
                                                                    padding: '12px 16px',
                                                                    cursor: 'pointer',
                                                                    backgroundColor: isExpanded ? '#fff9f0' : 'transparent',
                                                                    transition: 'background-color 0.2s',
                                                                    alignItems: 'center'
                                                                }}
                                                            >
                                                                <div style={{ fontWeight: 700, color: '#0c1527', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                                    <span style={{
                                                                        transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                                                        transition: 'transform 0.2s',
                                                                        fontSize: '0.8rem',
                                                                        display: 'inline-block'
                                                                    }}>▶</span>
                                                                    {group.site}
                                                                </div>
                                                                <div style={{ textAlign: 'center', fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>
                                                                    {group.latest_date ? new Date(group.latest_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).replace(/ /g, '-') : '-'}
                                                                </div>
                                                                <div style={{ textAlign: 'right', fontWeight: 800, color: group.unpaid > 0 ? '#dc2626' : '#16a34a' }}>
                                                                    ₹{group.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                </div>
                                                            </div>

                                                            {isExpanded && (
                                                                <div style={{ backgroundColor: '#ffffff', padding: '8px 16px 12px 40px', fontSize: '0.85rem', borderTop: '1px solid #f1f5f9' }}>
                                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 140px', color: '#64748b', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', marginBottom: '8px', fontWeight: 700 }}>
                                                                        <div>Description</div>
                                                                        <div>Mode</div>
                                                                        <div style={{ textAlign: 'right' }}>Amount</div>
                                                                    </div>
                                                                    {group.items.map((item: any, iIdx: number) => (
                                                                        <div key={iIdx} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 140px', padding: '4px 0', borderBottom: iIdx === group.items.length - 1 ? 'none' : '1px dashed #e2e8f0' }}>
                                                                            <div style={{ color: '#475569' }}>
                                                                                {item.description || '-'}
                                                                                <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginLeft: '8px' }}>
                                                                                    ({new Date(item.transaction_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })})
                                                                                </span>
                                                                            </div>
                                                                            <div>
                                                                                <span style={{
                                                                                    padding: '2px 7px', borderRadius: '10px', fontSize: '0.72rem', fontWeight: 700,
                                                                                    backgroundColor: item.payment_mode === 'Unpaid' ? '#fef2f2' : '#f0fdf4',
                                                                                    color: item.payment_mode === 'Unpaid' ? '#dc2626' : '#16a34a'
                                                                                }}>
                                                                                    {item.payment_mode || 'Cash'}
                                                                                </span>
                                                                            </div>
                                                                            <div style={{ textAlign: 'right', fontWeight: 600, color: item.payment_mode === 'Unpaid' ? '#dc2626' : '#1e293b' }}>
                                                                                ₹{parseFloat(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })
                                                )}
                                                <div style={{ backgroundColor: '#ffffff', padding: '14px 16px', borderTop: '2px solid #e2e8f0' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <div style={{ fontWeight: 800, color: '#0c1527' }}>Total Paid =</div>
                                                        <div style={{ fontWeight: 800, color: '#16a34a', fontSize: '1.05rem' }}>
                                                            ₹{totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </div>
                                                    </div>
                                                    {totalUnpaid > 0 && (
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                                                            <div style={{ fontWeight: 700, color: '#dc2626', fontSize: '0.88rem' }}>Total Outstanding =</div>
                                                            <div style={{ fontWeight: 800, color: '#dc2626', fontSize: '0.95rem' }}>
                                                                ₹{totalUnpaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '40px', backgroundColor: '#ffffff', borderRadius: '16px', border: '1.5px solid #ffe8c2', color: '#64748b', fontSize: '1.1rem' }}>
                                No {activeTab} records found{(searchQuery || projectTypeFilter !== 'all') ? ' matching filters' : ''}.
                            </div>
                        );
                    })()}
                </div>
            )}
            {/* Create Vendor Profile Modal Drawer */}
            {isCreateModalOpen && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(12, 21, 39, 0.65)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    padding: '16px'
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '20px',
                        width: '100%',
                        maxWidth: '680px',
                        maxHeight: '90vh',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        boxShadow: '0 20px 40px rgba(12, 21, 39, 0.3)',
                        border: '1.5px solid #ffe8c2'
                    }}>
                        {/* Modal Header (Fixed / Non-scrolling) */}
                        <div style={{
                            backgroundColor: '#0c1527',
                            padding: '20px 24px',
                            borderTopLeftRadius: '18px',
                            borderTopRightRadius: '18px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexShrink: 0,
                            position: 'sticky',
                            top: 0,
                            zIndex: 10
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Store size={22} color="#fca412" />
                                <h3 style={{ color: '#ffffff', margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
                                    Create Vendor Profile
                                </h3>
                            </div>
                            <button
                                onClick={() => setIsCreateModalOpen(false)}
                                style={{
                                    backgroundColor: 'transparent',
                                    border: 'none',
                                    color: '#fca412',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '4px'
                                }}
                            >
                                <X size={22} />
                            </button>
                        </div>

                        {/* Modal Form (Scrollable Body) */}
                        <form onSubmit={handleCreateVendor} style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                                {/* Vendor Name, Category & Status */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '16px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#0c1527', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                            Vendor / Company Name *
                                        </label>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                type="text"
                                                required
                                                placeholder="e.g. Balaji Hardware & Plywood"
                                                value={vendorForm.vendor_name}
                                                onChange={(e) => setVendorForm({ ...vendorForm, vendor_name: e.target.value })}
                                                style={{
                                                    width: '100%',
                                                    padding: '10px 14px 10px 38px',
                                                    borderRadius: '8px',
                                                    border: '1.5px solid #ffe8c2',
                                                    backgroundColor: '#ffffff',
                                                    fontSize: '0.9rem',
                                                    fontWeight: 600,
                                                    color: '#0c1527',
                                                    outline: 'none',
                                                    boxSizing: 'border-box'
                                                }}
                                            />
                                            <Store size={18} color="#fca412" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                                        </div>
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#0c1527', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                            Category
                                        </label>
                                        <select
                                            value={vendorForm.category}
                                            onChange={(e) => setVendorForm({ ...vendorForm, category: e.target.value })}
                                            style={{
                                                width: '100%',
                                                padding: '10px 12px',
                                                borderRadius: '8px',
                                                border: '1.5px solid #ffe8c2',
                                                backgroundColor: '#ffffff',
                                                fontSize: '0.88rem',
                                                fontWeight: 700,
                                                color: '#0c1527',
                                                outline: 'none',
                                                boxSizing: 'border-box',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <option value="Vendor">Material Vendor</option>
                                            <option value="Transport">Transport</option>
                                            <option value="Labor">Labor</option>
                                            <option value="Miscellaneous">Miscellaneous</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#0c1527', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                            Status
                                        </label>
                                        <select
                                            value={vendorForm.status}
                                            onChange={(e) => setVendorForm({ ...vendorForm, status: e.target.value })}
                                            style={{
                                                width: '100%',
                                                padding: '10px 12px',
                                                borderRadius: '8px',
                                                border: '1.5px solid #ffe8c2',
                                                backgroundColor: '#ffffff',
                                                fontSize: '0.88rem',
                                                fontWeight: 700,
                                                color: '#0c1527',
                                                outline: 'none',
                                                boxSizing: 'border-box',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <option value="active">Active</option>
                                            <option value="inactive">Inactive</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Phone & Contact Person */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#0c1527', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                            Phone / Mobile Number
                                        </label>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                type="tel"
                                                placeholder="+91 98765 43210"
                                                value={vendorForm.phone}
                                                onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })}
                                                style={{
                                                    width: '100%',
                                                    padding: '10px 14px 10px 38px',
                                                    borderRadius: '8px',
                                                    border: '1.5px solid #ffe8c2',
                                                    backgroundColor: '#ffffff',
                                                    fontSize: '0.9rem',
                                                    fontWeight: 600,
                                                    color: '#0c1527',
                                                    outline: 'none',
                                                    boxSizing: 'border-box'
                                                }}
                                            />
                                            <Phone size={18} color="#fca412" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                                        </div>
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#0c1527', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                            Contact Person / Owner
                                        </label>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                type="text"
                                                placeholder="Proprietor / Contact Name"
                                                value={vendorForm.contact_person}
                                                onChange={(e) => setVendorForm({ ...vendorForm, contact_person: e.target.value })}
                                                style={{
                                                    width: '100%',
                                                    padding: '10px 14px 10px 38px',
                                                    borderRadius: '8px',
                                                    border: '1.5px solid #ffe8c2',
                                                    backgroundColor: '#ffffff',
                                                    fontSize: '0.9rem',
                                                    fontWeight: 600,
                                                    color: '#0c1527',
                                                    outline: 'none',
                                                    boxSizing: 'border-box'
                                                }}
                                            />
                                            <User size={18} color="#fca412" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                                        </div>
                                    </div>
                                </div>

                                {/* GST Number / UPI ID & Address */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#0c1527', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                            GST Number / UPI ID
                                        </label>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                type="text"
                                                placeholder="36AAAAA0000A1Z5"
                                                value={vendorForm.gst_number}
                                                onChange={(e) => setVendorForm({ ...vendorForm, gst_number: e.target.value })}
                                                style={{
                                                    width: '100%',
                                                    padding: '10px 14px 10px 38px',
                                                    borderRadius: '8px',
                                                    border: '1.5px solid #ffe8c2',
                                                    backgroundColor: '#ffffff',
                                                    fontSize: '0.9rem',
                                                    fontWeight: 600,
                                                    color: '#0c1527',
                                                    outline: 'none',
                                                    boxSizing: 'border-box'
                                                }}
                                            />
                                            <FileText size={18} color="#fca412" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                                        </div>
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#0c1527', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                            Address / Shop Location
                                        </label>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                type="text"
                                                placeholder="Store address, city, state"
                                                value={vendorForm.address}
                                                onChange={(e) => setVendorForm({ ...vendorForm, address: e.target.value })}
                                                style={{
                                                    width: '100%',
                                                    padding: '10px 14px 10px 38px',
                                                    borderRadius: '8px',
                                                    border: '1.5px solid #ffe8c2',
                                                    backgroundColor: '#ffffff',
                                                    fontSize: '0.9rem',
                                                    fontWeight: 600,
                                                    color: '#0c1527',
                                                    outline: 'none',
                                                    boxSizing: 'border-box'
                                                }}
                                            />
                                            <MapPin size={18} color="#fca412" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                                        </div>
                                    </div>
                                </div>

                                {/* ── Official Identity Proofs (Any 2 Identity Proofs) ── */}
                                <div style={{ backgroundColor: '#fff9f0', border: '1.5px solid #ffe8c2', borderRadius: '12px', padding: '16px' }}>
                                    <h4 style={{ margin: '0 0 12px 0', fontSize: '0.88rem', fontWeight: 800, color: '#0c1527', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        🪪 Identity Proofs (Aadhaar &amp; PAN Card)
                                    </h4>
                                    
                                    {/* Identity Proof 1: Aadhaar Card */}
                                    <div style={{ marginBottom: '14px', backgroundColor: '#ffffff', padding: '12px', borderRadius: '10px', border: '1px solid #ffe8c2' }}>
                                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#0c1527', marginBottom: '6px' }}>
                                            Identity Proof 1: Aadhaar Card Number
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="12-digit Aadhaar Card Number (e.g. 1234 5678 9012)"
                                            value={vendorForm.aadhar_number}
                                            onChange={(e) => setVendorForm({ ...vendorForm, aadhar_number: e.target.value })}
                                            style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #ffe8c2', fontSize: '0.88rem', outline: 'none', marginBottom: '8px', boxSizing: 'border-box' }}
                                        />
                                        {vendorForm.aadhar_file ? (
                                            <div style={{ position: 'relative', border: '1.5px solid #16a34a', borderRadius: '8px', overflow: 'hidden', padding: '6px 12px', backgroundColor: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#16a34a' }}>✓ Aadhaar Card Image Selected</span>
                                                <button type="button" onClick={() => setVendorForm({ ...vendorForm, aadhar_file: null })} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontWeight: 800, fontSize: '0.78rem' }}>Remove</button>
                                            </div>
                                        ) : (
                                            <label style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px dashed #fca412', backgroundColor: '#fff9f0', color: '#0c1527', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxSizing: 'border-box' }}>
                                                <Upload size={14} color="#fca412" /> Upload Aadhaar Card Document / Photo
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleAadharUpload}
                                                    style={{ display: 'none' }}
                                                />
                                            </label>
                                        )}
                                    </div>

                                    {/* Identity Proof 2: PAN Card */}
                                    <div style={{ backgroundColor: '#ffffff', padding: '12px', borderRadius: '10px', border: '1px solid #ffe8c2' }}>
                                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#0c1527', marginBottom: '6px' }}>
                                            Identity Proof 2: PAN Card Number
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="10-digit PAN Card Number (e.g. ABCDE1234F)"
                                            value={vendorForm.pan_number}
                                            onChange={(e) => setVendorForm({ ...vendorForm, pan_number: e.target.value })}
                                            style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #ffe8c2', fontSize: '0.88rem', outline: 'none', marginBottom: '8px', boxSizing: 'border-box' }}
                                        />
                                        {vendorForm.pan_file ? (
                                            <div style={{ position: 'relative', border: '1.5px solid #16a34a', borderRadius: '8px', overflow: 'hidden', padding: '6px 12px', backgroundColor: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#16a34a' }}>✓ PAN Card Image Selected</span>
                                                <button type="button" onClick={() => setVendorForm({ ...vendorForm, pan_file: null })} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontWeight: 800, fontSize: '0.78rem' }}>Remove</button>
                                            </div>
                                        ) : (
                                            <label style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px dashed #fca412', backgroundColor: '#fff9f0', color: '#0c1527', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxSizing: 'border-box' }}>
                                                <Upload size={14} color="#fca412" /> Upload PAN Card Document / Photo
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handlePanUpload}
                                                    style={{ display: 'none' }}
                                                />
                                            </label>
                                        )}
                                    </div>
                                </div>

                                {/* ── Bank Account & UPI Details ── */}
                                <div style={{ backgroundColor: '#f0f9ff', border: '1.5px solid #bae6fd', borderRadius: '12px', padding: '16px' }}>
                                    <h4 style={{ margin: '0 0 12px 0', fontSize: '0.88rem', fontWeight: 800, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Landmark size={18} color="#0284c7" /> Bank Account &amp; Payment Details
                                    </h4>
                                    
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#0c1527', marginBottom: '6px' }}>
                                                Bank Name
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="e.g. State Bank of India, HDFC"
                                                value={vendorForm.bank_name}
                                                onChange={(e) => setVendorForm({ ...vendorForm, bank_name: e.target.value })}
                                                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #bae6fd', fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box' }}
                                            />
                                        </div>

                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#0c1527', marginBottom: '6px' }}>
                                                Account Holder Name
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Name as per Bank records"
                                                value={vendorForm.account_holder}
                                                onChange={(e) => setVendorForm({ ...vendorForm, account_holder: e.target.value })}
                                                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #bae6fd', fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box' }}
                                            />
                                        </div>

                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#0c1527', marginBottom: '6px' }}>
                                                Account Number
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Bank Account Number"
                                                value={vendorForm.account_number}
                                                onChange={(e) => setVendorForm({ ...vendorForm, account_number: e.target.value })}
                                                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #bae6fd', fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box' }}
                                            />
                                        </div>

                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#0c1527', marginBottom: '6px' }}>
                                                IFSC Code
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="e.g. SBIN0001234"
                                                value={vendorForm.ifsc_code}
                                                onChange={(e) => setVendorForm({ ...vendorForm, ifsc_code: e.target.value.toUpperCase() })}
                                                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #bae6fd', fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box' }}
                                            />
                                        </div>
                                    </div>

                                    {/* UPI ID */}
                                    <div style={{ marginBottom: '12px' }}>
                                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#0c1527', marginBottom: '6px' }}>
                                            UPI ID / VPA
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="e.g. vendor@okhdfcbank / 9876543210@paytm"
                                            value={vendorForm.upi_id}
                                            onChange={(e) => setVendorForm({ ...vendorForm, upi_id: e.target.value })}
                                            style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #bae6fd', fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box' }}
                                        />
                                    </div>

                                    {/* Bank Account Document / Passbook / Cancelled Cheque Upload */}
                                    <div style={{ backgroundColor: '#ffffff', padding: '12px', borderRadius: '10px', border: '1px solid #bae6fd' }}>
                                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#0c1527', marginBottom: '6px' }}>
                                            Bank Account Proof (Passbook / Cancelled Cheque / Statement Photo)
                                        </label>
                                        {vendorForm.bank_file ? (
                                            <div style={{ position: 'relative', border: '1.5px solid #0284c7', borderRadius: '8px', overflow: 'hidden', padding: '8px 12px', backgroundColor: '#f0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <img src={vendorForm.bank_file} alt="Bank Document" style={{ width: '45px', height: '45px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #bae6fd', cursor: 'pointer' }} onClick={() => setPreviewImageModal({ title: 'Bank Account Document Proof', src: vendorForm.bank_file! })} />
                                                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0284c7' }}>✓ Bank Document Attached (Click to preview)</span>
                                                </div>
                                                <button type="button" onClick={() => setVendorForm({ ...vendorForm, bank_file: null })} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontWeight: 800, fontSize: '0.78rem' }}>Remove</button>
                                            </div>
                                        ) : (
                                            <label style={{ width: '100%', padding: '9px', borderRadius: '8px', border: '1px dashed #0284c7', backgroundColor: '#f0f9ff', color: '#0369a1', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxSizing: 'border-box' }}>
                                                <Upload size={16} color="#0284c7" /> Upload Bank Account Passbook / Cheque Scan
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleBankFileUpload}
                                                    style={{ display: 'none' }}
                                                />
                                            </label>
                                        )}
                                    </div>
                                </div>

                                {/* ── Multiple Vendor Photos & Documents ── */}
                                <div style={{ backgroundColor: '#fffdf5', border: '1.5px solid #ffe8c2', borderRadius: '12px', padding: '16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <div>
                                            <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: '#0c1527', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Camera size={18} color="#fca412" /> Vendor Photos &amp; Documents ({photosList.length})
                                            </h4>
                                            <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                                                Add multiple photos (visiting cards, shop photos, work samples, GST certificates, invoices).
                                            </p>
                                        </div>
                                        {photosList.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => { setPhotosList([]); setPhotoPreview(null); }}
                                                style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                                            >
                                                Clear All
                                            </button>
                                        )}
                                    </div>

                                    {/* Photos Grid if any */}
                                    {photosList.length > 0 && (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '10px', marginBottom: '12px' }}>
                                            {photosList.map((photo, index) => (
                                                <div
                                                    key={index}
                                                    style={{
                                                        position: 'relative',
                                                        borderRadius: '10px',
                                                        overflow: 'hidden',
                                                        border: index === 0 ? '2px solid #fca412' : '1.5px solid #e2e8f0',
                                                        backgroundColor: '#0c1527',
                                                        height: '95px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        boxShadow: '0 2px 6px rgba(0,0,0,0.08)'
                                                    }}
                                                >
                                                    <img
                                                        src={photo}
                                                        alt={`Vendor Photo ${index + 1}`}
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                                                        onClick={() => setPreviewImageModal({ title: `Vendor Photo #${index + 1}${index === 0 ? ' (Primary)' : ''}`, src: photo })}
                                                    />
                                                    <div
                                                        style={{
                                                            position: 'absolute',
                                                            bottom: 0,
                                                            left: 0,
                                                            right: 0,
                                                            backgroundColor: 'rgba(12, 21, 39, 0.75)',
                                                            color: '#ffffff',
                                                            fontSize: '0.65rem',
                                                            fontWeight: 700,
                                                            textAlign: 'center',
                                                            padding: '2px 4px',
                                                            whiteSpace: 'nowrap',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis'
                                                        }}
                                                    >
                                                        {index === 0 ? '⭐ Primary' : `#${index + 1}`}
                                                    </div>
                                                    {/* Delete Photo Button */}
                                                    <button
                                                        type="button"
                                                        onClick={() => removePhotoAt(index)}
                                                        style={{
                                                            position: 'absolute',
                                                            top: '4px',
                                                            right: '4px',
                                                            backgroundColor: 'rgba(220, 38, 38, 0.9)',
                                                            color: '#ffffff',
                                                            border: 'none',
                                                            borderRadius: '50%',
                                                            width: '20px',
                                                            height: '20px',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            padding: 0
                                                        }}
                                                        title="Remove photo"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Buttons to Take Photo or Upload Multiple Photos */}
                                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                        {/* Open Camera Button */}
                                        <label style={{
                                            flex: 1,
                                            minWidth: '150px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px',
                                            padding: '10px 14px',
                                            borderRadius: '10px',
                                            border: '1.5px dashed #fca412',
                                            backgroundColor: '#ffffff',
                                            color: '#0c1527',
                                            fontWeight: 800,
                                            fontSize: '0.82rem',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}>
                                            <Camera size={18} color="#fca412" /> Take Photo (Camera)
                                            <input
                                                type="file"
                                                accept="image/*"
                                                capture="environment"
                                                onChange={handleCameraCapture}
                                                style={{ display: 'none' }}
                                            />
                                        </label>

                                        {/* Upload Multiple Files Button */}
                                        <label style={{
                                            flex: 1,
                                            minWidth: '170px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px',
                                            padding: '10px 14px',
                                            borderRadius: '10px',
                                            border: '1.5px dashed #cbd5e1',
                                            backgroundColor: '#ffffff',
                                            color: '#475569',
                                            fontWeight: 700,
                                            fontSize: '0.82rem',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}>
                                            <Upload size={18} color="#64748b" /> Upload Multiple Photos
                                            <input
                                                type="file"
                                                multiple
                                                accept="image/*"
                                                onChange={handleMultiplePhotosUpload}
                                                style={{ display: 'none' }}
                                            />
                                        </label>
                                    </div>
                                </div>

                                {/* Modal Actions (Sticky Bottom) */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'flex-end',
                                    gap: '12px',
                                    marginTop: '16px',
                                    paddingTop: '14px',
                                    borderTop: '1.5px solid #f1f5f9',
                                    position: 'sticky',
                                    bottom: 0,
                                    backgroundColor: '#ffffff',
                                    zIndex: 5
                                }}>
                                    <button
                                        type="button"
                                        onClick={() => setIsCreateModalOpen(false)}
                                        style={{
                                            padding: '10px 20px',
                                            borderRadius: '8px',
                                            border: '1.5px solid #cbd5e1',
                                            backgroundColor: '#ffffff',
                                            color: '#475569',
                                            fontWeight: 700,
                                            fontSize: '0.88rem',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Cancel
                                    </button>

                                    <button
                                        type="submit"
                                        disabled={creatingVendor}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            padding: '10px 24px',
                                            borderRadius: '8px',
                                            border: 'none',
                                            backgroundColor: '#fca412',
                                            color: '#ffffff',
                                            fontWeight: 800,
                                            fontSize: '0.88rem',
                                            cursor: 'pointer',
                                            boxShadow: '0 3px 10px rgba(252,164,18,0.35)',
                                            opacity: creatingVendor ? 0.7 : 1
                                        }}
                                    >
                                        {creatingVendor ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                                        {creatingVendor ? 'Creating Profile...' : 'Save Vendor Profile'}
                                    </button>
                                </div>

                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Vendor Profile Modal Drawer */}
            {isEditModalOpen && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(12, 21, 39, 0.65)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    padding: '16px'
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '20px',
                        width: '100%',
                        maxWidth: '680px',
                        maxHeight: '90vh',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        boxShadow: '0 20px 40px rgba(12, 21, 39, 0.3)',
                        border: '1.5px solid #ffe8c2'
                    }}>
                        {/* Modal Header (Fixed / Non-scrolling) */}
                        <div style={{
                            backgroundColor: '#0c1527',
                            padding: '20px 24px',
                            borderTopLeftRadius: '18px',
                            borderTopRightRadius: '18px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexShrink: 0,
                            position: 'sticky',
                            top: 0,
                            zIndex: 10
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Edit2 size={22} color="#fca412" />
                                <h3 style={{ color: '#ffffff', margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
                                    Edit Vendor Profile
                                </h3>
                            </div>
                            <button
                                onClick={() => setIsEditModalOpen(false)}
                                style={{
                                    backgroundColor: 'transparent',
                                    border: 'none',
                                    color: '#fca412',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '4px'
                                }}
                            >
                                <X size={22} />
                            </button>
                        </div>

                        {/* Modal Form (Scrollable Body) */}
                        <form onSubmit={handleUpdateVendorProfile} style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                                {/* Vendor Name, Category & Status */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '16px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#0c1527', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                            Vendor / Company Name *
                                        </label>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                type="text"
                                                required
                                                placeholder="e.g. Balaji Hardware & Plywood"
                                                value={vendorForm.vendor_name}
                                                onChange={(e) => setVendorForm({ ...vendorForm, vendor_name: e.target.value })}
                                                style={{
                                                    width: '100%',
                                                    padding: '10px 14px 10px 38px',
                                                    borderRadius: '8px',
                                                    border: '1.5px solid #ffe8c2',
                                                    backgroundColor: '#ffffff',
                                                    fontSize: '0.9rem',
                                                    fontWeight: 600,
                                                    color: '#0c1527',
                                                    outline: 'none',
                                                    boxSizing: 'border-box'
                                                }}
                                            />
                                            <Store size={18} color="#fca412" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                                        </div>
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#0c1527', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                            Category
                                        </label>
                                        <select
                                            value={vendorForm.category}
                                            onChange={(e) => setVendorForm({ ...vendorForm, category: e.target.value })}
                                            style={{
                                                width: '100%',
                                                padding: '10px 12px',
                                                borderRadius: '8px',
                                                border: '1.5px solid #ffe8c2',
                                                backgroundColor: '#ffffff',
                                                fontSize: '0.88rem',
                                                fontWeight: 700,
                                                color: '#0c1527',
                                                outline: 'none',
                                                boxSizing: 'border-box',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <option value="Vendor">Material Vendor</option>
                                            <option value="Transport">Transport</option>
                                            <option value="Labor">Labor</option>
                                            <option value="Miscellaneous">Miscellaneous</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#0c1527', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                            Status
                                        </label>
                                        <select
                                            value={vendorForm.status}
                                            onChange={(e) => setVendorForm({ ...vendorForm, status: e.target.value })}
                                            style={{
                                                width: '100%',
                                                padding: '10px 12px',
                                                borderRadius: '8px',
                                                border: '1.5px solid #ffe8c2',
                                                backgroundColor: '#ffffff',
                                                fontSize: '0.88rem',
                                                fontWeight: 700,
                                                color: '#0c1527',
                                                outline: 'none',
                                                boxSizing: 'border-box',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <option value="active">Active</option>
                                            <option value="inactive">Inactive</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Phone & Contact Person */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#0c1527', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                            Phone / Mobile Number
                                        </label>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                type="tel"
                                                placeholder="+91 98765 43210"
                                                value={vendorForm.phone}
                                                onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })}
                                                style={{
                                                    width: '100%',
                                                    padding: '10px 14px 10px 38px',
                                                    borderRadius: '8px',
                                                    border: '1.5px solid #ffe8c2',
                                                    backgroundColor: '#ffffff',
                                                    fontSize: '0.9rem',
                                                    fontWeight: 600,
                                                    color: '#0c1527',
                                                    outline: 'none',
                                                    boxSizing: 'border-box'
                                                }}
                                            />
                                            <Phone size={18} color="#fca412" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                                        </div>
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#0c1527', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                            Contact Person / Owner
                                        </label>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                type="text"
                                                placeholder="Proprietor / Contact Name"
                                                value={vendorForm.contact_person}
                                                onChange={(e) => setVendorForm({ ...vendorForm, contact_person: e.target.value })}
                                                style={{
                                                    width: '100%',
                                                    padding: '10px 14px 10px 38px',
                                                    borderRadius: '8px',
                                                    border: '1.5px solid #ffe8c2',
                                                    backgroundColor: '#ffffff',
                                                    fontSize: '0.9rem',
                                                    fontWeight: 600,
                                                    color: '#0c1527',
                                                    outline: 'none',
                                                    boxSizing: 'border-box'
                                                }}
                                            />
                                            <User size={18} color="#fca412" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                                        </div>
                                    </div>
                                </div>

                                {/* GST Number / UPI ID & Address */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#0c1527', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                            GST Number / UPI ID
                                        </label>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                type="text"
                                                placeholder="36AAAAA0000A1Z5"
                                                value={vendorForm.gst_number}
                                                onChange={(e) => setVendorForm({ ...vendorForm, gst_number: e.target.value })}
                                                style={{
                                                    width: '100%',
                                                    padding: '10px 14px 10px 38px',
                                                    borderRadius: '8px',
                                                    border: '1.5px solid #ffe8c2',
                                                    backgroundColor: '#ffffff',
                                                    fontSize: '0.9rem',
                                                    fontWeight: 600,
                                                    color: '#0c1527',
                                                    outline: 'none',
                                                    boxSizing: 'border-box'
                                                }}
                                            />
                                            <FileText size={18} color="#fca412" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                                        </div>
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#0c1527', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                            Address / Shop Location
                                        </label>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                type="text"
                                                placeholder="Store address, city, state"
                                                value={vendorForm.address}
                                                onChange={(e) => setVendorForm({ ...vendorForm, address: e.target.value })}
                                                style={{
                                                    width: '100%',
                                                    padding: '10px 14px 10px 38px',
                                                    borderRadius: '8px',
                                                    border: '1.5px solid #ffe8c2',
                                                    backgroundColor: '#ffffff',
                                                    fontSize: '0.9rem',
                                                    fontWeight: 600,
                                                    color: '#0c1527',
                                                    outline: 'none',
                                                    boxSizing: 'border-box'
                                                }}
                                            />
                                            <MapPin size={18} color="#fca412" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                                        </div>
                                    </div>
                                </div>

                                {/* ── Official Identity Proofs ── */}
                                <div style={{ backgroundColor: '#fff9f0', border: '1.5px solid #ffe8c2', borderRadius: '12px', padding: '16px' }}>
                                    <h4 style={{ margin: '0 0 12px 0', fontSize: '0.88rem', fontWeight: 800, color: '#0c1527', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        🪪 Identity Proofs (Aadhaar &amp; PAN Card)
                                    </h4>
                                    
                                    {/* Identity Proof 1: Aadhaar Card */}
                                    <div style={{ marginBottom: '14px', backgroundColor: '#ffffff', padding: '12px', borderRadius: '10px', border: '1px solid #ffe8c2' }}>
                                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#0c1527', marginBottom: '6px' }}>
                                            Identity Proof 1: Aadhaar Card Number
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="12-digit Aadhaar Card Number"
                                            value={vendorForm.aadhar_number}
                                            onChange={(e) => setVendorForm({ ...vendorForm, aadhar_number: e.target.value })}
                                            style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #ffe8c2', fontSize: '0.88rem', outline: 'none', marginBottom: '8px', boxSizing: 'border-box' }}
                                        />
                                        {vendorForm.aadhar_file ? (
                                            <div style={{ position: 'relative', border: '1.5px solid #16a34a', borderRadius: '8px', overflow: 'hidden', padding: '6px 12px', backgroundColor: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#16a34a' }}>✓ Aadhaar Card Image Selected</span>
                                                <button type="button" onClick={() => setVendorForm({ ...vendorForm, aadhar_file: null })} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontWeight: 800, fontSize: '0.78rem' }}>Remove</button>
                                            </div>
                                        ) : (
                                            <label style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px dashed #fca412', backgroundColor: '#fff9f0', color: '#0c1527', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxSizing: 'border-box' }}>
                                                <Upload size={14} color="#fca412" /> Upload New Aadhaar Document / Photo
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleAadharUpload}
                                                    style={{ display: 'none' }}
                                                />
                                            </label>
                                        )}
                                    </div>

                                    {/* Identity Proof 2: PAN Card */}
                                    <div style={{ backgroundColor: '#ffffff', padding: '12px', borderRadius: '10px', border: '1px solid #ffe8c2' }}>
                                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#0c1527', marginBottom: '6px' }}>
                                            Identity Proof 2: PAN Card Number
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="10-digit PAN Card Number"
                                            value={vendorForm.pan_number}
                                            onChange={(e) => setVendorForm({ ...vendorForm, pan_number: e.target.value })}
                                            style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #ffe8c2', fontSize: '0.88rem', outline: 'none', marginBottom: '8px', boxSizing: 'border-box' }}
                                        />
                                        {vendorForm.pan_file ? (
                                            <div style={{ position: 'relative', border: '1.5px solid #16a34a', borderRadius: '8px', overflow: 'hidden', padding: '6px 12px', backgroundColor: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#16a34a' }}>✓ PAN Card Image Selected</span>
                                                <button type="button" onClick={() => setVendorForm({ ...vendorForm, pan_file: null })} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontWeight: 800, fontSize: '0.78rem' }}>Remove</button>
                                            </div>
                                        ) : (
                                            <label style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px dashed #fca412', backgroundColor: '#fff9f0', color: '#0c1527', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxSizing: 'border-box' }}>
                                                <Upload size={14} color="#fca412" /> Upload New PAN Document / Photo
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handlePanUpload}
                                                    style={{ display: 'none' }}
                                                />
                                            </label>
                                        )}
                                    </div>
                                </div>

                                {/* ── Bank Account & UPI Details ── */}
                                <div style={{ backgroundColor: '#f0f9ff', border: '1.5px solid #bae6fd', borderRadius: '12px', padding: '16px' }}>
                                    <h4 style={{ margin: '0 0 12px 0', fontSize: '0.88rem', fontWeight: 800, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Landmark size={18} color="#0284c7" /> Bank Account &amp; Payment Details
                                    </h4>
                                    
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#0c1527', marginBottom: '6px' }}>
                                                Bank Name
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="e.g. State Bank of India, HDFC"
                                                value={vendorForm.bank_name}
                                                onChange={(e) => setVendorForm({ ...vendorForm, bank_name: e.target.value })}
                                                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #bae6fd', fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box' }}
                                            />
                                        </div>

                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#0c1527', marginBottom: '6px' }}>
                                                Account Holder Name
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Name as per Bank records"
                                                value={vendorForm.account_holder}
                                                onChange={(e) => setVendorForm({ ...vendorForm, account_holder: e.target.value })}
                                                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #bae6fd', fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box' }}
                                            />
                                        </div>

                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#0c1527', marginBottom: '6px' }}>
                                                Account Number
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Bank Account Number"
                                                value={vendorForm.account_number}
                                                onChange={(e) => setVendorForm({ ...vendorForm, account_number: e.target.value })}
                                                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #bae6fd', fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box' }}
                                            />
                                        </div>

                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#0c1527', marginBottom: '6px' }}>
                                                IFSC Code
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="e.g. SBIN0001234"
                                                value={vendorForm.ifsc_code}
                                                onChange={(e) => setVendorForm({ ...vendorForm, ifsc_code: e.target.value.toUpperCase() })}
                                                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #bae6fd', fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box' }}
                                            />
                                        </div>
                                    </div>

                                    {/* UPI ID */}
                                    <div style={{ marginBottom: '12px' }}>
                                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#0c1527', marginBottom: '6px' }}>
                                            UPI ID / VPA
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="e.g. vendor@okhdfcbank / 9876543210@paytm"
                                            value={vendorForm.upi_id}
                                            onChange={(e) => setVendorForm({ ...vendorForm, upi_id: e.target.value })}
                                            style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #bae6fd', fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box' }}
                                        />
                                    </div>

                                    {/* Bank Account Document / Passbook / Cancelled Cheque Upload */}
                                    <div style={{ backgroundColor: '#ffffff', padding: '12px', borderRadius: '10px', border: '1px solid #bae6fd' }}>
                                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#0c1527', marginBottom: '6px' }}>
                                            Bank Account Proof (Passbook / Cancelled Cheque / Statement Photo)
                                        </label>
                                        {vendorForm.bank_file ? (
                                            <div style={{ position: 'relative', border: '1.5px solid #0284c7', borderRadius: '8px', overflow: 'hidden', padding: '8px 12px', backgroundColor: '#f0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <img src={vendorForm.bank_file} alt="Bank Document" style={{ width: '45px', height: '45px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #bae6fd', cursor: 'pointer' }} onClick={() => setPreviewImageModal({ title: 'Bank Account Document Proof', src: vendorForm.bank_file! })} />
                                                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0284c7' }}>✓ Bank Document Attached (Click to preview)</span>
                                                </div>
                                                <button type="button" onClick={() => setVendorForm({ ...vendorForm, bank_file: null })} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontWeight: 800, fontSize: '0.78rem' }}>Remove</button>
                                            </div>
                                        ) : (
                                            <label style={{ width: '100%', padding: '9px', borderRadius: '8px', border: '1px dashed #0284c7', backgroundColor: '#f0f9ff', color: '#0369a1', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxSizing: 'border-box' }}>
                                                <Upload size={16} color="#0284c7" /> Upload Bank Account Passbook / Cheque Scan
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleBankFileUpload}
                                                    style={{ display: 'none' }}
                                                />
                                            </label>
                                        )}
                                    </div>
                                </div>

                                {/* ── Multiple Vendor Photos & Documents ── */}
                                <div style={{ backgroundColor: '#fffdf5', border: '1.5px solid #ffe8c2', borderRadius: '12px', padding: '16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <div>
                                            <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: '#0c1527', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Camera size={18} color="#fca412" /> Vendor Photos &amp; Documents ({photosList.length})
                                            </h4>
                                            <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                                                Add multiple photos (visiting cards, shop photos, work samples, GST certificates, invoices).
                                            </p>
                                        </div>
                                        {photosList.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => { setPhotosList([]); setPhotoPreview(null); }}
                                                style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                                            >
                                                Clear All
                                            </button>
                                        )}
                                    </div>

                                    {/* Photos Grid if any */}
                                    {photosList.length > 0 && (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '10px', marginBottom: '12px' }}>
                                            {photosList.map((photo, index) => (
                                                <div
                                                    key={index}
                                                    style={{
                                                        position: 'relative',
                                                        borderRadius: '10px',
                                                        overflow: 'hidden',
                                                        border: index === 0 ? '2px solid #fca412' : '1.5px solid #e2e8f0',
                                                        backgroundColor: '#0c1527',
                                                        height: '95px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        boxShadow: '0 2px 6px rgba(0,0,0,0.08)'
                                                    }}
                                                >
                                                    <img
                                                        src={photo}
                                                        alt={`Vendor Photo ${index + 1}`}
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                                                        onClick={() => setPreviewImageModal({ title: `Vendor Photo #${index + 1}${index === 0 ? ' (Primary)' : ''}`, src: photo })}
                                                    />
                                                    <div
                                                        style={{
                                                            position: 'absolute',
                                                            bottom: 0,
                                                            left: 0,
                                                            right: 0,
                                                            backgroundColor: 'rgba(12, 21, 39, 0.75)',
                                                            color: '#ffffff',
                                                            fontSize: '0.65rem',
                                                            fontWeight: 700,
                                                            textAlign: 'center',
                                                            padding: '2px 4px',
                                                            whiteSpace: 'nowrap',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis'
                                                        }}
                                                    >
                                                        {index === 0 ? '⭐ Primary' : `#${index + 1}`}
                                                    </div>
                                                    {/* Delete Photo Button */}
                                                    <button
                                                        type="button"
                                                        onClick={() => removePhotoAt(index)}
                                                        style={{
                                                            position: 'absolute',
                                                            top: '4px',
                                                            right: '4px',
                                                            backgroundColor: 'rgba(220, 38, 38, 0.9)',
                                                            color: '#ffffff',
                                                            border: 'none',
                                                            borderRadius: '50%',
                                                            width: '20px',
                                                            height: '20px',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            padding: 0
                                                        }}
                                                        title="Remove photo"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Buttons to Take Photo or Upload Multiple Photos */}
                                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                        {/* Open Camera Button */}
                                        <label style={{
                                            flex: 1,
                                            minWidth: '150px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px',
                                            padding: '10px 14px',
                                            borderRadius: '10px',
                                            border: '1.5px dashed #fca412',
                                            backgroundColor: '#ffffff',
                                            color: '#0c1527',
                                            fontWeight: 800,
                                            fontSize: '0.82rem',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}>
                                            <Camera size={18} color="#fca412" /> Take Photo (Camera)
                                            <input
                                                type="file"
                                                accept="image/*"
                                                capture="environment"
                                                onChange={handleCameraCapture}
                                                style={{ display: 'none' }}
                                            />
                                        </label>

                                        {/* Upload Multiple Files Button */}
                                        <label style={{
                                            flex: 1,
                                            minWidth: '170px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px',
                                            padding: '10px 14px',
                                            borderRadius: '10px',
                                            border: '1.5px dashed #cbd5e1',
                                            backgroundColor: '#ffffff',
                                            color: '#475569',
                                            fontWeight: 700,
                                            fontSize: '0.82rem',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}>
                                            <Upload size={18} color="#64748b" /> Upload Multiple Photos
                                            <input
                                                type="file"
                                                multiple
                                                accept="image/*"
                                                onChange={handleMultiplePhotosUpload}
                                                style={{ display: 'none' }}
                                            />
                                        </label>
                                    </div>
                                </div>

                                {/* Modal Actions (Sticky Bottom) */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'flex-end',
                                    gap: '12px',
                                    marginTop: '16px',
                                    paddingTop: '14px',
                                    borderTop: '1.5px solid #f1f5f9',
                                    position: 'sticky',
                                    bottom: 0,
                                    backgroundColor: '#ffffff',
                                    zIndex: 5
                                }}>
                                    <button
                                        type="button"
                                        onClick={() => setIsEditModalOpen(false)}
                                        style={{
                                            padding: '10px 20px',
                                            borderRadius: '8px',
                                            border: '1.5px solid #cbd5e1',
                                            backgroundColor: '#ffffff',
                                            color: '#475569',
                                            fontWeight: 700,
                                            fontSize: '0.88rem',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Cancel
                                    </button>

                                    <button
                                        type="submit"
                                        disabled={updatingVendor}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            padding: '10px 24px',
                                            borderRadius: '8px',
                                            border: 'none',
                                            backgroundColor: '#fca412',
                                            color: '#ffffff',
                                            fontWeight: 800,
                                            fontSize: '0.88rem',
                                            cursor: 'pointer',
                                            boxShadow: '0 3px 10px rgba(252,164,18,0.35)',
                                            opacity: updatingVendor ? 0.7 : 1
                                        }}
                                    >
                                        {updatingVendor ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                                        {updatingVendor ? 'Updating Profile...' : 'Save Profile Changes'}
                                    </button>
                                </div>

                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* View Vendor Profile & Identity Proofs Modal Drawer */}
            {selectedVendorForView && (() => {
                const details = selectedVendorForView.details || selectedVendorForView;
                const vCode = formatVendorBadgeCode(details.vendor_code || selectedVendorForView.vendor_code, details.category || selectedVendorForView.category || activeTab, 0);
                return (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(12, 21, 39, 0.7)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
                    <div className="modal-box" style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '20px',
                        width: '100%',
                        maxWidth: '680px',
                        maxHeight: '90vh',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
                        border: '1.5px solid #ffe8c2'
                    }}>
                        {/* Drawer Header (Fixed / Non-scrolling) */}
                        <div className="modal-header" style={{
                            backgroundColor: '#0c1527',
                            padding: '20px 24px',
                            borderTopLeftRadius: '18px',
                            borderTopRightRadius: '18px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexShrink: 0,
                            position: 'sticky',
                            top: 0,
                            zIndex: 10
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: '#fff9f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
                                    🏬
                                </div>
                                <div>
                                    <h3 style={{ color: '#ffffff', margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
                                        {selectedVendorForView.vendor_name}
                                    </h3>
                                    <p style={{ color: '#fca412', margin: '2px 0 0 0', fontSize: '0.8rem', fontWeight: 700, fontFamily: 'monospace' }}>
                                        {vCode}
                                    </p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <button
                                    onClick={() => {
                                        const v = selectedVendorForView;
                                        setSelectedVendorForView(null);
                                        handleOpenEditModal(v);
                                    }}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '6px 14px',
                                        backgroundColor: '#fca412',
                                        color: '#0c1527',
                                        border: 'none',
                                        borderRadius: '8px',
                                        fontSize: '0.82rem',
                                        fontWeight: 800,
                                        cursor: 'pointer'
                                    }}
                                >
                                    <Edit2 size={14} /> Edit Profile
                                </button>
                                <button onClick={() => setSelectedVendorForView(null)} style={{ background: 'none', border: 'none', color: '#fca412', cursor: 'pointer', padding: '4px' }}>
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        <div className="modal-body" style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
                            {/* 1. Company & Contact Details Grid */}
                            <div style={{ marginBottom: '24px', backgroundColor: '#fff9f0', borderRadius: '14px', border: '1.5px solid #ffe8c2', padding: '18px' }}>
                                <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0c1527', margin: '0 0 14px 0', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Building2 size={18} color="#fca412" /> Company &amp; Contact Details
                                </h4>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', fontSize: '0.88rem' }}>
                                    <div>
                                        <span style={{ color: '#64748b', fontWeight: 600, fontSize: '0.78rem', display: 'block', textTransform: 'uppercase' }}>Vendor / Firm Name</span>
                                        <span style={{ color: '#0c1527', fontWeight: 800 }}>{selectedVendorForView.vendor_name}</span>
                                    </div>
                                    <div>
                                        <span style={{ color: '#64748b', fontWeight: 600, fontSize: '0.78rem', display: 'block', textTransform: 'uppercase' }}>Contact Person</span>
                                        <span style={{ color: '#0c1527', fontWeight: 700 }}>{details.contact_person || 'N/A'}</span>
                                    </div>
                                    <div>
                                        <span style={{ color: '#64748b', fontWeight: 600, fontSize: '0.78rem', display: 'block', textTransform: 'uppercase' }}>Phone Number</span>
                                        <span style={{ color: '#0c1527', fontWeight: 700 }}>{details.phone || 'N/A'}</span>
                                    </div>
                                    <div>
                                        <span style={{ color: '#64748b', fontWeight: 600, fontSize: '0.78rem', display: 'block', textTransform: 'uppercase' }}>Email Address</span>
                                        <span style={{ color: '#0c1527', fontWeight: 700 }}>{details.email || 'N/A'}</span>
                                    </div>
                                    <div>
                                        <span style={{ color: '#64748b', fontWeight: 600, fontSize: '0.78rem', display: 'block', textTransform: 'uppercase' }}>GST / Tax Number</span>
                                        <span style={{ color: '#0c1527', fontWeight: 800 }}>{details.gst_number || 'N/A'}</span>
                                    </div>
                                    <div>
                                        <span style={{ color: '#64748b', fontWeight: 600, fontSize: '0.78rem', display: 'block', textTransform: 'uppercase' }}>Business Address</span>
                                        <span style={{ color: '#0c1527', fontWeight: 600 }}>{details.address || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* 2. Bank Account Details Section */}
                            {(() => {
                                let bankObj: any = {};
                                if (details.bank_details) {
                                    try {
                                        bankObj = typeof details.bank_details === 'string' ? JSON.parse(details.bank_details) : details.bank_details;
                                    } catch (e) { bankObj = {}; }
                                }
                                const bName = details.bank_name || bankObj.bank_name;
                                const bAcc = details.account_number || bankObj.account_number;
                                const bIfsc = details.ifsc_code || bankObj.ifsc_code;
                                const bHolder = details.account_holder || bankObj.account_holder;
                                const bUpi = details.upi_id || bankObj.upi_id;
                                const bFile = details.bank_file || bankObj.bank_file;
                                const hasAnyBankInfo = bName || bAcc || bIfsc || bHolder || bUpi || bFile;

                                return (
                                    <div style={{ marginBottom: '24px', backgroundColor: '#f0f9ff', borderRadius: '14px', border: '1.5px solid #bae6fd', padding: '18px' }}>
                                        <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0369a1', margin: '0 0 14px 0', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Landmark size={18} color="#0284c7" /> Bank Account &amp; Payment Details
                                        </h4>
                                        {hasAnyBankInfo ? (
                                            <>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', fontSize: '0.88rem', marginBottom: bFile ? '14px' : '0' }}>
                                                    <div>
                                                        <span style={{ color: '#0284c7', fontWeight: 600, fontSize: '0.78rem', display: 'block', textTransform: 'uppercase' }}>Bank Name</span>
                                                        <span style={{ color: '#0c1527', fontWeight: 800 }}>{bName || 'N/A'}</span>
                                                    </div>
                                                    <div>
                                                        <span style={{ color: '#0284c7', fontWeight: 600, fontSize: '0.78rem', display: 'block', textTransform: 'uppercase' }}>Account Holder</span>
                                                        <span style={{ color: '#0c1527', fontWeight: 700 }}>{bHolder || 'N/A'}</span>
                                                    </div>
                                                    <div>
                                                        <span style={{ color: '#0284c7', fontWeight: 600, fontSize: '0.78rem', display: 'block', textTransform: 'uppercase' }}>Account Number</span>
                                                        <span style={{ color: '#0c1527', fontWeight: 800, fontFamily: 'monospace' }}>{bAcc || 'N/A'}</span>
                                                    </div>
                                                    <div>
                                                        <span style={{ color: '#0284c7', fontWeight: 600, fontSize: '0.78rem', display: 'block', textTransform: 'uppercase' }}>IFSC Code</span>
                                                        <span style={{ color: '#0c1527', fontWeight: 800, fontFamily: 'monospace' }}>{bIfsc || 'N/A'}</span>
                                                    </div>
                                                    <div style={{ gridColumn: 'span 2' }}>
                                                        <span style={{ color: '#0284c7', fontWeight: 600, fontSize: '0.78rem', display: 'block', textTransform: 'uppercase' }}>UPI ID / VPA</span>
                                                        <span style={{ color: '#0c1527', fontWeight: 700 }}>{bUpi || 'N/A'}</span>
                                                    </div>
                                                </div>

                                                {bFile && (
                                                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #bae6fd' }}>
                                                        <span style={{ color: '#0369a1', fontWeight: 700, fontSize: '0.8rem', display: 'block', marginBottom: '8px' }}>Bank Account Proof (Passbook / Cheque Scan):</span>
                                                        <div
                                                            style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', padding: '8px 14px', backgroundColor: '#ffffff', borderRadius: '10px', border: '1.5px solid #bae6fd', cursor: 'pointer' }}
                                                            onClick={() => setPreviewImageModal({ title: 'Bank Account Document Proof', src: bFile })}
                                                        >
                                                            <img src={bFile} alt="Bank Document" style={{ width: '45px', height: '45px', objectFit: 'cover', borderRadius: '6px' }} />
                                                            <div>
                                                                <span style={{ fontSize: '0.82rem', color: '#0284c7', fontWeight: 800, display: 'block' }}>View Bank Proof Document 🔍</span>
                                                                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Click to zoom scan image</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <div style={{ color: '#64748b', fontSize: '0.82rem', fontStyle: 'italic' }}>
                                                No bank account details added yet.
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}

                            {/* 3. Identity Proofs Section */}
                            <div style={{ marginBottom: '24px' }}>
                                <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0c1527', margin: '0 0 14px 0', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <FileText size={18} color="#fca412" /> Official Identity Proofs
                                </h4>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                                    {/* Aadhaar Card */}
                                    <div style={{ border: '1.5px solid #ffe8c2', borderRadius: '12px', padding: '14px', backgroundColor: '#ffffff' }}>
                                        <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#0c1527', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            🪪 Identity Proof 1: Aadhaar Card
                                        </div>
                                        <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '10px' }}>
                                            Number: <strong style={{ color: '#0c1527' }}>{details.aadhar_number || 'Not Provided'}</strong>
                                        </div>
                                        {details.aadhar_file ? (
                                            <div style={{ position: 'relative', cursor: 'pointer', borderRadius: '8px', overflow: 'hidden', border: '1px solid #cbd5e1', maxHeight: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' }}
                                                 onClick={() => setPreviewImageModal({ title: 'Aadhaar Card Proof', src: details.aadhar_file })}>
                                                <img src={details.aadhar_file} alt="Aadhaar Proof" style={{ maxWidth: '100%', maxHeight: '140px', objectFit: 'contain' }} />
                                                <div style={{ position: 'absolute', bottom: '4px', right: '4px', backgroundColor: 'rgba(12,21,39,0.8)', color: '#fff', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>Click to Zoom 🔍</div>
                                            </div>
                                        ) : (
                                            <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem', fontStyle: 'italic', border: '1px dashed #cbd5e1' }}>
                                                No document uploaded
                                            </div>
                                        )}
                                    </div>

                                    {/* PAN Card */}
                                    <div style={{ border: '1.5px solid #ffe8c2', borderRadius: '12px', padding: '14px', backgroundColor: '#ffffff' }}>
                                        <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#0c1527', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            💳 Identity Proof 2: PAN Card
                                        </div>
                                        <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '10px' }}>
                                            Number: <strong style={{ color: '#0c1527' }}>{details.pan_number || 'Not Provided'}</strong>
                                        </div>
                                        {details.pan_file ? (
                                            <div style={{ position: 'relative', cursor: 'pointer', borderRadius: '8px', overflow: 'hidden', border: '1px solid #cbd5e1', maxHeight: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' }}
                                                 onClick={() => setPreviewImageModal({ title: 'PAN Card Proof', src: details.pan_file })}>
                                                <img src={details.pan_file} alt="PAN Proof" style={{ maxWidth: '100%', maxHeight: '140px', objectFit: 'contain' }} />
                                                <div style={{ position: 'absolute', bottom: '4px', right: '4px', backgroundColor: 'rgba(12,21,39,0.8)', color: '#fff', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>Click to Zoom 🔍</div>
                                            </div>
                                        ) : (
                                            <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem', fontStyle: 'italic', border: '1px dashed #cbd5e1' }}>
                                                No document uploaded
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* 4. Uploaded Vendor Photos & Documents Gallery */}
                            {(() => {
                                let viewPhotos: string[] = [];
                                if (details.documents) {
                                    try {
                                        const p = typeof details.documents === 'string' ? JSON.parse(details.documents) : details.documents;
                                        if (Array.isArray(p)) viewPhotos = p;
                                    } catch (e) {
                                        if (typeof details.documents === 'string') viewPhotos = [details.documents];
                                    }
                                }
                                if (details.photo && !viewPhotos.includes(details.photo)) {
                                    viewPhotos.unshift(details.photo);
                                }

                                return (
                                    <div style={{ marginBottom: '24px' }}>
                                        <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0c1527', margin: '0 0 14px 0', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Camera size={18} color="#fca412" /> Attached Photos &amp; Documents ({viewPhotos.length})
                                        </h4>
                                        {viewPhotos.length > 0 ? (
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '12px' }}>
                                                {viewPhotos.map((imgSrc, idx) => (
                                                    <div
                                                        key={idx}
                                                        onClick={() => setPreviewImageModal({ title: `Vendor Document / Photo #${idx + 1}${idx === 0 ? ' (Primary)' : ''}`, src: imgSrc })}
                                                        style={{
                                                            position: 'relative',
                                                            borderRadius: '10px',
                                                            overflow: 'hidden',
                                                            border: '1.5px solid #ffe8c2',
                                                            backgroundColor: '#0c1527',
                                                            height: '110px',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
                                                        }}
                                                    >
                                                        <img src={imgSrc} alt={`Vendor Document ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        <div style={{ position: 'absolute', bottom: '4px', right: '4px', backgroundColor: 'rgba(12,21,39,0.85)', color: '#fff', fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                                                            {idx === 0 ? '⭐ Primary' : `#${idx + 1}`} 🔍
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '10px', textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem', fontStyle: 'italic', border: '1px dashed #cbd5e1' }}>
                                                No vendor photos or documents uploaded yet.
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}

                            {/* Close Button */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button onClick={() => setSelectedVendorForView(null)} style={{ padding: '10px 24px', backgroundColor: '#0c1527', color: '#ffffff', border: 'none', borderRadius: '10px', fontWeight: 800, cursor: 'pointer' }}>
                                    Close Vendor Details
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                );
            })()}

            {/* Image Preview / Zoom Modal */}
            {previewImageModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' }}>
                    <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh', backgroundColor: '#ffffff', borderRadius: '16px', overflow: 'hidden', padding: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0c1527' }}>{previewImageModal.title}</h4>
                            <button onClick={() => setPreviewImageModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0c1527' }}><X size={24} /></button>
                        </div>
                        <img src={previewImageModal.src} alt={previewImageModal.title} style={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain', borderRadius: '8px' }} />
                    </div>
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
