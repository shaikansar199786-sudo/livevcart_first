import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useAuth } from '../hooks/useAuth';
import QuoteTab from '../components/QuoteTab';
import {
    ChevronDown,
    ChevronRight,
    RotateCcw,
    Bookmark,
    Download,
    Eye,
    ExternalLink,
    Edit3,
    Copy,
    MoreVertical,
    Plus,
    Minus,
    ArrowUp,
    ArrowDown,
    Grid,
    Calendar,
    DollarSign,
    TrendingUp,
    FileText,
    CheckCircle2,
    XCircle,
    Clock,
    X,
    MessageSquare,
    Search,
    Mail,
    Send,
    Paperclip,
    Printer,
    Check,
    ShoppingCart,
    Tag,
    Shield,
    Trash2
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
// @ts-ignore
import html2pdf from 'html2pdf.js';
import { mergePdfBase64Array } from '../utils/pdfMerger';
import { LOGO_BASE64 } from '../assets/logoBase64';
import liveLogo from '../assets/1.png';
import { buildOfficial4PageHtml } from '../utils/quotePdfHtmlBuilder';

export const QuotesPage: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const effectiveUser = useMemo(() => {
        if (user && Object.keys(user).length > 0) return user;
        try {
            const stored = localStorage.getItem('Livincart_user') || localStorage.getItem('user');
            if (stored) return JSON.parse(stored);
        } catch (e) { }
        return null;
    }, [user]);

    const isAdmin = Boolean(
        effectiveUser && (
            String(effectiveUser.role || '').toLowerCase().includes('admin') ||
            String(effectiveUser.role || '').toLowerCase() === 'owner' ||
            effectiveUser.is_admin === 1 ||
            effectiveUser.is_admin === true
        )
    );

    const isDesignerRole = Boolean(
        effectiveUser && !isAdmin && (
            ['d1', 'd2', 'designer', 'lead_designer', 'associate_designer', 'ad', 'graphic_designer', 'gd'].includes(String(effectiveUser.role || '').toLowerCase()) ||
            String(effectiveUser.role || '').toLowerCase().includes('design') ||
            String(effectiveUser.role || '').toLowerCase().includes('d1') ||
            String(effectiveUser.role || '').toLowerCase().includes('d2')
        )
    );

    // Helpers to check if a lead, project, or quote is assigned to the current designer
    const isLeadAssignedToDesigner = useCallback((lead: any, currentUser: any): boolean => {
        if (!lead || !currentUser) return false;
        const uid = String(currentUser.user_id || currentUser.id || '').trim();
        const uname = String(currentUser.name || '').trim().toLowerCase();

        // 1. Check d1_assigned_to
        const d1Str = String(lead.d1_assigned_to || '');
        const d1Ids = d1Str.split(',').map((x: string) => x.trim()).filter(Boolean);
        if (uid && d1Ids.includes(uid)) return true;

        // 2. Check associate_designer_assigned_id
        const adStr = String(lead.associate_designer_assigned_id || '');
        const adIds = adStr.split(',').map((x: string) => x.trim()).filter(Boolean);
        if (uid && adIds.includes(uid)) return true;

        // 3. Check assigned_to
        if (uid && String(lead.assigned_to || '').trim() === uid) return true;

        // 4. Check name matches
        const d1Name = String(lead.d1_assigned_name || '').trim().toLowerCase();
        if (uname && d1Name && (d1Name === uname || d1Name.includes(uname) || uname.includes(d1Name))) return true;

        const adName = String(lead.associate_designer_assigned_name || '').trim().toLowerCase();
        if (uname && adName && (adName === uname || adName.includes(uname) || uname.includes(adName))) return true;

        return false;
    }, []);

    const isProjectAssignedToDesigner = useCallback((proj: any, currentUser: any, leads: any[]): boolean => {
        if (!proj || !currentUser) return false;
        const uid = String(currentUser.user_id || currentUser.id || '').trim();
        const uname = String(currentUser.name || '').trim().toLowerCase();

        // 1. Check project team assignments
        if (Array.isArray(proj.team)) {
            const inTeam = proj.team.some((tm: any) => {
                const tId = String(tm.user_id || '').trim();
                const tName = String(tm.name || '').trim().toLowerCase();
                return (uid && tId === uid) || (uname && tName && (tName === uname || tName.includes(uname)));
            });
            if (inTeam) return true;
        }

        // 2. Check matching lead
        const matchedLead = leads.find((l: any) => {
            const lid = String(l.lead_id || '').trim();
            const mcId = String(l.manual_client_id || '').trim();
            const pId = String(proj.project_id || '').trim();
            const pCode = String(proj.project_code || '').trim();
            return (lid && (lid === pId || `PR-${lid}` === pCode)) || (mcId && (mcId === pCode || mcId === pId));
        });
        if (matchedLead && isLeadAssignedToDesigner(matchedLead, currentUser)) return true;

        return false;
    }, [isLeadAssignedToDesigner]);

    const isQuoteAccessibleByDesigner = useCallback((quote: any, currentUser: any, leads: any[], projs: any[]): boolean => {
        if (!quote || !currentUser) return false;
        const uid = String(currentUser.user_id || currentUser.id || '').trim();
        const uname = String(currentUser.name || '').trim().toLowerCase();

        // 0. If this quote was created by, updated by, or assigned to this designer
        const qCreatedBy = String(quote.created_by || '').trim();
        const qUpdatedBy = String(quote.updated_by || '').trim();
        const qDesignerId = String(quote.designer_id || quote.extra_data?.designer_id || quote.extra_data_parsed?.designer_id || '').trim();
        const qDesignerName = String(quote.designer_name || quote.extra_data?.designer_name || quote.extra_data_parsed?.designer_name || '').trim().toLowerCase();

        if (uid && (qCreatedBy === uid || qUpdatedBy === uid || qDesignerId === uid)) return true;
        if (uname && qDesignerName && (qDesignerName === uname || qDesignerName.includes(uname) || uname.includes(qDesignerName))) return true;

        // 1. Check linked lead in leads
        const matchedLead = leads.find((l: any) => {
            const lid = String(l.lead_id || '').trim();
            const mcId = String(l.manual_client_id || '').trim();
            const qPid = String(quote.project_id || '').trim().replace(/\D/g, '');
            const rawPid = String(quote.project_id || '').trim();
            const qCode = String(quote.project_code || '').trim();
            const qLead = String(quote.lead_id || '').trim();
            const cName = String(quote.client_name || quote.subtitle || '').trim().toLowerCase();
            const lName = String(l.client_name || '').trim().toLowerCase();

            return (qLead && qLead === lid) ||
                (qPid && qPid === lid) ||
                (rawPid && (rawPid === mcId || rawPid === `lead-${lid}`)) ||
                (mcId && (mcId === qCode || qCode.includes(mcId))) ||
                (cName && lName && (cName === lName || cName.includes(lName) || lName.includes(cName)));
        });
        if (matchedLead && isLeadAssignedToDesigner(matchedLead, currentUser)) return true;

        // 2. Check linked project in projs
        const matchedProj = projs.find((p: any) => {
            const pId = String(p.project_id || '').trim();
            const pCode = String(p.project_code || '').trim();
            const qPid = String(quote.project_id || '').trim();
            const numPid = qPid.replace(/\D/g, '');
            const qCode = String(quote.project_code || '').trim();
            return (pId && (pId === qPid || (numPid && pId === numPid))) ||
                (pCode && (pCode === qCode || (pCode.length > 2 && qCode.includes(pCode))));
        });
        if (matchedProj && isProjectAssignedToDesigner(matchedProj, currentUser, leads)) return true;

        return false;
    }, [isLeadAssignedToDesigner, isProjectAssignedToDesigner]);

    // Toggle flag to hide/show Expand column
    const SHOW_EXPAND_COLUMN = false;

    // Data states
    const [rawQuotes, setRawQuotes] = useState<any[]>([]);
    const [rawProjects, setRawProjects] = useState<any[]>([]);
    const [leadsList, setLeadsList] = useState<any[]>([]);
    const [clientsList, setClientsList] = useState<any[]>([]);
    const [financeTransactions, setFinanceTransactions] = useState<any[]>([]);
    const [usersList, setUsersList] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [recentlyCreatedQuote, setRecentlyCreatedQuote] = useState<any | null>(null);

    // Accordions state
    const [isFiltersOpen, setIsFiltersOpen] = useState<boolean>(false);
    const [isSummaryOpen, setIsSummaryOpen] = useState<boolean>(false);
    const [isGraphOpen, setIsGraphOpen] = useState<boolean>(false);

    // Filter Controls state
    const [filterCategory, setFilterCategory] = useState<string>('Active Quotation');
    const [statusFilter, setStatusFilter] = useState<string>('All');
    const [clientFilter, setClientFilter] = useState<string>('All');
    const [contactFilter, setContactFilter] = useState<string>('All');
    const [projectIdFilter, setProjectIdFilter] = useState<string>('All');
    const [projectTypeFilter, setProjectTypeFilter] = useState<string>('All');
    const [dateRangeFilter, setDateRangeFilter] = useState<string>('All Time');
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [customStartDate, setCustomStartDate] = useState<string>(''); // Custom Date Range Start Date
    const [customEndDate, setCustomEndDate] = useState<string>(''); // Custom Date Range End Date

    // Global Coupon / Promo Code state (Main Quotes Page)
    const [appliedGlobalCoupon, setAppliedGlobalCoupon] = useState<{ code: string; discountType: 'percent' | 'flat'; discountValue: number } | null>(null);
    const [dbPromoCodes, setDbPromoCodes] = useState<Array<{ id: number; code: string; discount_type: 'percent' | 'flat'; discount_value: number; description?: string; created_at?: string }>>([]);
    const [showPromoHistoryModal, setShowPromoHistoryModal] = useState<boolean>(false);
    const [showCreatePromoModal, setShowCreatePromoModal] = useState<boolean>(false);

    // Category-Wise Max Discount Governance State (Configured by Admin on /quotes)
    const DEFAULT_CATEGORY_LIST = [
        'Wood work',
        'Accessories',
        'False Ceiling',
        'Painting',
        'HDS',
        'Lights',
        'Furniture',
        'Furnishing',
        'Custom Carpentry',
        'Decor',
        'Civilwork',
        'Services',
        'Miscellaneous',
        'Appliances'
    ];
    const [globalMaxCategoryDiscount, setGlobalMaxCategoryDiscount] = useState<number>(10);
    const [categoryMaxLimits, setCategoryMaxLimits] = useState<Record<string, number>>({});
    const [bulkCategoryMaxDiscount, setBulkCategoryMaxDiscount] = useState<number>(10);
    const [newCategoryName, setNewCategoryName] = useState<string>('');
    const [isSavingMaxDiscount, setIsSavingMaxDiscount] = useState<boolean>(false);
    const [showMaxDiscountModal, setShowMaxDiscountModal] = useState<boolean>(false);

    const fetchCategoryDiscountSetting = useCallback(async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/category-discounts/settings`);
            if (res.data?.success) {
                const sMax = Number(res.data.max_discount ?? 10);
                if (!isNaN(sMax) && sMax >= 0) {
                    setGlobalMaxCategoryDiscount(sMax);
                    setBulkCategoryMaxDiscount(sMax);
                }
                const serverMap: Record<string, number> = res.data.category_max_discounts || {};
                const mergedMap: Record<string, number> = {};
                DEFAULT_CATEGORY_LIST.forEach(cat => {
                    mergedMap[cat] = serverMap[cat] !== undefined ? Number(serverMap[cat]) : sMax;
                });
                Object.keys(serverMap).forEach(cat => {
                    mergedMap[cat] = Number(serverMap[cat]);
                });
                setCategoryMaxLimits(mergedMap);
            }
        } catch (err) {
            console.error('Error fetching max category discount setting:', err);
        }
    }, []);

    useEffect(() => {
        fetchCategoryDiscountSetting();
    }, [fetchCategoryDiscountSetting]);

    const handleSaveMaxCategoryDiscount = async (limitsToSave?: Record<string, number>) => {
        const mapToSave = limitsToSave || categoryMaxLimits;
        setIsSavingMaxDiscount(true);
        try {
            const res = await axios.post(`${API_BASE_URL}/category-discounts/settings`, {
                max_discount: globalMaxCategoryDiscount,
                category_max_discounts: mapToSave
            });
            if (res.data?.success) {
                setCategoryMaxLimits(mapToSave);
                setShowMaxDiscountModal(false);
                alert('✅ Category-wise discount limits saved successfully!');
            } else {
                alert(res.data?.message || 'Failed to update Category Discount Settings');
            }
        } catch (err: any) {
            alert(err?.response?.data?.message || 'Error updating Category Discount Settings');
        } finally {
            setIsSavingMaxDiscount(false);
        }
    };

    const [newPromoName, setNewPromoName] = useState('');
    const [newPromoType, setNewPromoType] = useState<'percent' | 'flat'>('percent');
    const [newPromoVal, setNewPromoVal] = useState<number | ''>('');
    const [newPromoError, setNewPromoError] = useState('');

    const fetchDbPromoCodes = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/promo-codes`);
            if (res.data?.success && Array.isArray(res.data?.data)) {
                setDbPromoCodes(res.data.data);
            }
        } catch (err) {
            console.error('Error fetching promo codes:', err);
        }
    };

    useEffect(() => {
        fetchDbPromoCodes();
    }, []);

    const applyGlobalCouponCode = (codeOverride?: string) => {
        const raw = (codeOverride || '').trim().toUpperCase();
        if (!raw) return;

        const dbMatch = dbPromoCodes.find(p => p.code.toUpperCase() === raw);
        if (dbMatch) {
            setAppliedGlobalCoupon({
                code: dbMatch.code,
                discountType: dbMatch.discount_type,
                discountValue: parseFloat(String(dbMatch.discount_value)) || 0
            });
        }
    };

    const handleCreatePromoCode = async () => {
        setNewPromoError('');
        const name = newPromoName.trim().toUpperCase();
        if (!name) {
            setNewPromoError('Please enter a promo code name');
            return;
        }
        if (name.length < 2) {
            setNewPromoError('Code name must be at least 2 characters');
            return;
        }
        const val = typeof newPromoVal === 'number' ? newPromoVal : parseFloat(String(newPromoVal)) || 0;
        if (val <= 0) {
            setNewPromoError('Please enter a valid discount value greater than 0');
            return;
        }
        if (newPromoType === 'percent' && val > 100) {
            setNewPromoError('Percentage discount cannot exceed 100%');
            return;
        }

        try {
            const res = await axios.post(`${API_BASE_URL}/promo-codes`, {
                code: name,
                discount_type: newPromoType,
                discount_value: val,
                description: `Custom Promo Code ${name}`
            });

            if (res.data?.success) {
                setAppliedGlobalCoupon({ code: name, discountType: newPromoType, discountValue: val });
                await fetchDbPromoCodes();
                setShowCreatePromoModal(false);
                setNewPromoName('');
                setNewPromoVal('');
                setNewPromoError('');
            } else {
                setNewPromoError(res.data?.message || 'Failed to create promo code');
            }
        } catch (err: any) {
            setNewPromoError(err.response?.data?.message || err.message || 'Failed to save promo code');
        }
    };

    const handleDeletePromoCode = async (id: number, codeName: string) => {
        if (!window.confirm(`Are you sure you want to delete promo code "${codeName}"?`)) return;
        try {
            const res = await axios.delete(`${API_BASE_URL}/promo-codes/${id}`);
            if (res.data?.success) {
                await fetchDbPromoCodes();
                if (appliedGlobalCoupon && appliedGlobalCoupon.code.toUpperCase() === codeName.toUpperCase()) {
                    setAppliedGlobalCoupon(null);
                }
            } else {
                alert(res.data?.message || 'Failed to delete promo code');
            }
        } catch (err: any) {
            alert(err.response?.data?.message || err.message || 'Failed to delete promo code');
        }
    };

    // Table controls
    const [rowsPerPage, setRowsPerPage] = useState<number>(10);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [selectedRows, setSelectedRows] = useState<Record<string, boolean>>({});
    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
    const [activeRowMenu, setActiveRowMenu] = useState<string | null>(null);
    const [menuOpenUpward, setMenuOpenUpward] = useState<boolean>(false);
    const [actionLoadingId, setActionLoadingId] = useState<any>(null);

    const deletedQuotesCount = useMemo(() => {
        return rawQuotes.filter(q => q.is_deleted === 1 || q.is_deleted === '1' || q.is_deleted === true).length;
    }, [rawQuotes]);

    const handleDeleteQuote = async (q: any) => {
        const qId = q.quote_id || q.id;
        if (!qId) {
            alert('Cannot delete this quotation: Missing quote ID.');
            return;
        }
        const qName = q.quote_number || q.label || `QTN-${qId}`;
        const clientName = q.client_name || q.subtitle || 'Client';

        const confirmMsg = `🗑️ DELETE QUOTATION (30-DAY RECOVERY)\n\nAre you sure you want to delete quotation "${qName}" for ${clientName}?\n\n• The quote will be moved to Trash.\n• It will remain recoverable for 30 days.\n• After 30 days, it will permanently expire.`;
        if (!window.confirm(confirmMsg)) return;

        setActionLoadingId(qId);
        try {
            const res = await axios.post(`${API_BASE_URL}/quotes/delete`, {
                quote_id: qId,
                user_id: effectiveUser?.user_id
            });
            if (res.data?.success) {
                alert(`✅ Quotation "${qName}" moved to Trash.\n\nIt is safely preserved and can be recovered within 30 days from the "Trash / Deleted" tab.`);
                await fetchQuotesAndProjects();
            } else {
                alert(res.data?.message || 'Failed to delete quotation');
            }
        } catch (err: any) {
            alert(err.response?.data?.message || err.message || 'Error deleting quotation');
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleRestoreQuote = async (q: any) => {
        const qId = q.quote_id || q.id;
        if (!qId) return;
        const qName = q.quote_number || q.label || `QTN-${qId}`;

        if (!window.confirm(`🔄 RECOVER QUOTATION\n\nDo you want to restore quotation "${qName}" back to Active Quotations?`)) return;

        setActionLoadingId(qId);
        try {
            const res = await axios.post(`${API_BASE_URL}/quotes/restore`, {
                quote_id: qId
            });
            if (res.data?.success) {
                alert(`✅ Quotation "${qName}" restored successfully! It is now back in Active Quotations.`);
                await fetchQuotesAndProjects();
            } else {
                alert(res.data?.message || 'Failed to restore quotation');
            }
        } catch (err: any) {
            alert(err.response?.data?.message || err.message || 'Error restoring quotation');
        } finally {
            setActionLoadingId(null);
        }
    };

    // Editing mode / Modal states
    const [activeEditingProject, setActiveEditingProjectState] = useState<any | null>(null);

    const setActiveEditingProject = (proj: any) => {
        setActiveEditingProjectState(proj);
        if (proj) {
            sessionStorage.setItem('dc_active_editing_project', JSON.stringify(proj));
        } else {
            sessionStorage.removeItem('dc_active_editing_project');
            fetchQuotesAndProjects();
        }
    };

    const resolveLeadStaffDetails = (lead: any) => {
        const getEmail = (u: any) => {
            if (!u) return '';
            if (u.email && String(u.email).trim()) return String(u.email).trim();
            if (u.username && String(u.username).includes('@')) return String(u.username).trim();
            return '';
        };

        const isSalesOrManagerUser = (u: any) => {
            if (!u) return false;
            const role = String(u.role || '').toLowerCase();
            const name = String(u.name || '').toLowerCase();
            if (role.includes('admin') || name.includes('admin')) return false;
            if (['d1', 'd2', 'designer', 'associate_designer', 'site_inspector', 'graphic_designer', 'marketing_analyst'].includes(role)) return false;
            return ['sales', 'sales_manager', 'sales_person', 'manager', 'business_associate', 'ba', 'project_head'].includes(role) || role.includes('sales');
        };

        const findPrimarySalesUser = () => {
            return usersList.find((u: any) => {
                const r = String(u.role || '').toLowerCase();
                const n = String(u.name || '').toLowerCase();
                return (r === 'sales' || r === 'sales_manager' || r === 'sales_person' || r.includes('sales')) && !r.includes('admin') && !n.includes('admin');
            }) || usersList.find((u: any) => {
                const r = String(u.role || '').toLowerCase();
                const n = String(u.name || '').toLowerCase();
                return (r === 'manager' || r === 'business_associate' || r === 'ba') && !r.includes('admin') && !n.includes('admin');
            });
        };

        // 1. Resolve Assigned Designer (D1 / D2 / Lead Designer / Associate Designer)
        let dName = lead?.d1_assigned_name || lead?.d1_designer_name || '';
        if (!dName && lead?.d1_assigned_to) {
            const u = usersList.find((usr: any) => String(usr.user_id) === String(lead.d1_assigned_to));
            if (u) dName = u.name;
        }
        if (!dName && lead?.associate_designer_assigned_name) {
            dName = lead.associate_designer_assigned_name;
        }
        if (!dName && (lead?.designer || lead?.designer_name)) {
            dName = lead.designer || lead.designer_name;
        }

        // 2. Resolve Booking Slot Sales Person / Sales Manager
        let rawSpName = lead?.sales_person_name || lead?.assigned_by_name || lead?.sales_person || lead?.booked_by_name || lead?.sales_manager_name || '';
        let spName = (rawSpName && !rawSpName.toLowerCase().includes('admin')) ? rawSpName : '';
        let spPhone = (lead?.sales_person_phone && lead.sales_person_phone !== '9182263332') ? lead.sales_person_phone : (lead?.sales_manager_phone && lead.sales_manager_phone !== '9182263332' ? lead.sales_manager_phone : '');
        let spEmail = lead?.sales_person_email || lead?.sales_manager_email || '';

        if (spName) {
            const u = usersList.find((usr: any) => usr.name && usr.name.trim().toLowerCase() === spName.trim().toLowerCase());
            if (u) {
                if (!spPhone || spPhone === '9182263332') spPhone = u.phone || u.contact_number || '';
                if (!spEmail) spEmail = getEmail(u);
            }
        }

        if (!spName && lead?.assigned_to) {
            const u = usersList.find((usr: any) => String(usr.user_id) === String(lead.assigned_to));
            if (u && isSalesOrManagerUser(u)) {
                spName = u.name;
                if (!spPhone || spPhone === '9182263332') spPhone = u.phone || u.contact_number || '';
                if (!spEmail) spEmail = getEmail(u);
            }
        }

        if (!spName && lead?.created_by) {
            const u = usersList.find((usr: any) => String(usr.user_id) === String(lead.created_by));
            if (u && isSalesOrManagerUser(u)) {
                spName = u.name;
                if (!spPhone || spPhone === '9182263332') spPhone = u.phone || u.contact_number || '';
                if (!spEmail) spEmail = getEmail(u);
            }
        }

        if (!spName && user?.name && isSalesOrManagerUser(user)) {
            spName = user.name;
            if (!spPhone || spPhone === '9182263332') spPhone = (user as any)?.phone || '';
            if (!spEmail) spEmail = getEmail(user);
        }

        // Fallback to active Sales user in the team (e.g. Thanmai)
        if (!spName || spName.toLowerCase().includes('admin')) {
            const fallbackUser = findPrimarySalesUser();
            if (fallbackUser) {
                spName = fallbackUser.name;
                spPhone = fallbackUser.phone || fallbackUser.contact_number || '7702312351';
                spEmail = getEmail(fallbackUser) || 'sukendra.ch@livincart.com';
            } else {
                spName = 'Thanmai';
                spPhone = '7702312351';
                spEmail = 'sukendra.ch@livincart.com';
            }
        }

        // Final sanitation: if phone or email is still empty or belongs to Admin Sukku
        if (!spPhone || spPhone === '9182263332') {
            const u = usersList.find((usr: any) => usr.name && usr.name.trim().toLowerCase() === spName.trim().toLowerCase());
            if (u && u.phone && u.phone !== '9182263332') {
                spPhone = u.phone;
            } else {
                spPhone = '7702312351';
            }
        }
        if (!spEmail) {
            const u = usersList.find((usr: any) => usr.name && usr.name.trim().toLowerCase() === spName.trim().toLowerCase());
            if (u && getEmail(u)) {
                spEmail = getEmail(u);
            } else {
                spEmail = 'sukendra.ch@livincart.com';
            }
        }

        return {
            designerName: dName || '',
            salesPersonName: spName || 'Thanmai',
            salesPersonPhone: spPhone || '7702312351',
            salesPersonEmail: spEmail || 'sukendra.ch@livincart.com'
        };
    };

    const formatLeadSourceDisplay = (src?: string) => {
        if (!src) return 'Walk In';
        const clean = src.replace(/[_-]/g, ' ').trim();
        return clean.replace(/\b\w/g, c => c.toUpperCase());
    };

    const resolveScopeInfo = (scopeVal?: string) => {
        const raw = (scopeVal || '2 BHK').trim();
        const standardList = ['2 BHK', '3 BHK', 'Villa', 'Duplex', 'Commercial'];
        const matchedStd = standardList.find(s => s.toLowerCase() === raw.toLowerCase());
        if (matchedStd) {
            return { project_scope: matchedStd, custom_scope: '' };
        }
        if (raw.toLowerCase() === 'other' || !raw) {
            return { project_scope: 'Other', custom_scope: '' };
        }
        return { project_scope: 'Other', custom_scope: raw };
    };

    const openQuoteWorkspace = (targetQuote: any) => {
        if (!targetQuote) {
            setActiveEditingProject(null);
            return;
        }
        if (isDesignerRole && !isQuoteAccessibleByDesigner(targetQuote, effectiveUser, leadsList, rawProjects)) {
            alert('Access Restricted: You do not have permission to access quotations for projects not assigned to you.');
            return;
        }
        const rawPid = String(targetQuote.project_id || '').toLowerCase().trim();
        const numPid = rawPid.replace(/\D/g, '');
        const rawPcode = String(targetQuote.project_code || '').toLowerCase().trim();
        const clientName = String(targetQuote.client_name || targetQuote.subtitle || '').toLowerCase().trim();

        const proj = rawProjects.find((p: any) => {
            const pId = String(p.project_id || '').toLowerCase().trim();
            const pCode = String(p.project_code || '').toLowerCase().trim();
            const pClient = String(p.client_name || p.project_name || '').toLowerCase().trim();
            const isGenericClient = !clientName || ['client', 'customer', 'valued client', 'valuedclient', 'none', 'client quotation', 'new client'].includes(clientName);
            const codeMatch = rawPcode && pCode && rawPcode.length >= 4 && pCode.length >= 4 && rawPcode === pCode;
            const idMatch = rawPid && pId && rawPid !== '0' && pId !== '0' && (pId === rawPid || (numPid && pId === numPid && !targetQuote?.lead_id));
            const clientMatch = !isGenericClient && clientName.length > 3 && pClient && pClient === clientName;
            return codeMatch || (idMatch && (codeMatch || clientMatch || !targetQuote?.lead_id));
        }) || {};

        const isGenericLeadClient = !clientName || ['client', 'customer', 'valued client', 'valuedclient', 'none', 'client quotation', 'new client'].includes(clientName);
        const matchedLead = leadsList.find((l: any) => {
            const lid = String(l.lead_id || '').toLowerCase().trim();
            const manualId = String(l.manual_client_id || '').toLowerCase().trim();
            const lName = String(l.client_name || '').toLowerCase().trim();
            const leadIdMatch = (targetQuote?.lead_id && String(targetQuote.lead_id) === lid) ||
                (numPid && numPid !== '0' && lid === numPid && (rawPcode.includes('pr-') || !targetQuote?.project_code));
            const manualIdMatch = manualId && rawPcode && manualId.length >= 4 && rawPcode === manualId;
            const nameMatch = !isGenericLeadClient && clientName.length > 3 && lName && lName === clientName;
            return leadIdMatch || manualIdMatch || nameMatch;
        });

        const staffDetails = resolveLeadStaffDetails(matchedLead);

        // Client rejection check: If client declined the quote or marked order_lost/rejected
        const isClientRejected = Boolean(
            targetQuote?.ack_status === 'rejected' ||
            targetQuote?.status === 'order_lost' ||
            targetQuote?.status === 'rejected' ||
            proj?.status === 'order_lost' ||
            proj?.status === 'rejected' ||
            matchedLead?.status === 'lost' ||
            matchedLead?.status === 'rejected'
        );

        const isClientAccepted = !isClientRejected && Boolean(
            targetQuote?.ack_status === 'accepted' ||
            targetQuote?.status === 'order_converted' ||
            targetQuote?.status === 'approved' ||
            proj?.status === 'order_converted' ||
            matchedLead?.status === 'won' ||
            matchedLead?.status === 'converted'
        );

        const isStage1PaidForQuote = isClientAccepted && Boolean(
            targetQuote?.status === 'order_converted' ||
            (matchedLead && (
                matchedLead.is_converted === 1 ||
                matchedLead.status === 'won' ||
                matchedLead.status === 'converted'
            )) ||
            (proj && proj.project_id && ['designing phase', 'execution', 'site in progress', 'completed', 'won', 'converted', 'order_converted', 'project_started'].includes(String(proj.status || '').toLowerCase().trim()) && !targetQuote?.lead_id) ||
            matchedLead?.stage1_paid === 1 ||
            matchedLead?.stage1_paid === true ||
            matchedLead?.stage1_paid === '1' ||
            matchedLead?.is_10_percent_paid === 1 ||
            matchedLead?.is_10_percent_paid === true ||
            matchedLead?.is_10_percent_paid === '1' ||
            String(matchedLead?.payment_status || '').toLowerCase().includes('10%') ||
            String(matchedLead?.payment_status || '').toLowerCase().includes('20%') ||
            targetQuote?.stage1_paid === 1 ||
            targetQuote?.stage1_paid === true ||
            targetQuote?.stage1_paid === '1' ||
            targetQuote?.is_10_percent_paid === 1 ||
            targetQuote?.is_10_percent_paid === true ||
            targetQuote?.is_10_percent_paid === '1' ||
            (proj && !targetQuote?.lead_id && (proj.stage1_paid === 1 || proj.stage1_paid === true || proj.is_10_percent_paid === 1)) ||
            (rawPid && rawPid !== '0' && localStorage.getItem(`stage1_paid_${rawPid}`) === 'true') ||
            (rawPcode && rawPcode.length >= 4 && localStorage.getItem(`stage1_paid_${rawPcode}`) === 'true')
        );

        const isLeadConverted = isClientAccepted && Boolean(
            targetQuote?.status === 'order_converted' ||
            (matchedLead && (
                matchedLead.is_converted === 1 ||
                matchedLead.status === 'won' ||
                matchedLead.status === 'converted'
            )) ||
            (proj && proj.project_id && ['designing phase', 'execution', 'site in progress', 'completed', 'won', 'converted', 'order_converted', 'project_started'].includes(String(proj.status || '').toLowerCase().trim()) && !targetQuote?.lead_id) ||
            isStage1PaidForQuote
        );

        // STRICT RULE: Once converted, a quotation is part of an active project that has already started!
        // It stays converted unless the client rejected!
        const isProjectStartedForQuote = !isClientRejected && Boolean(
            targetQuote?.status === 'order_converted' ||
            (isClientAccepted && isStage1PaidForQuote && !targetQuote?.is_initial_quote && targetQuote?.save_type !== 'draft')
        );

        const isInitialQuote = !isProjectStartedForQuote;

        const isDraftOrDup = Boolean(
            targetQuote.is_duplicate ||
            String(targetQuote.quote_id || '').startsWith('p-') ||
            String(targetQuote.quote_number || '').startsWith('DRAFT-')
        );

        if (isDraftOrDup && !isProjectStartedForQuote) {
            const pidToClear = targetQuote.project_id || proj.project_id;
            if (pidToClear) sessionStorage.removeItem(`final_locked_project_${pidToClear}`);
            const pcodeToClear = targetQuote.project_code || proj.project_code;
            if (pcodeToClear) sessionStorage.removeItem(`final_locked_project_${pcodeToClear}`);
        }

        const safeStatus = isClientRejected 
            ? 'order_lost' 
            : (isProjectStartedForQuote || targetQuote?.status === 'order_converted'
                ? 'order_converted' 
                : (isClientAccepted || targetQuote?.status === 'approved'
                    ? 'approved'
                    : (isDraftOrDup 
                        ? ((targetQuote?.status === 'proposal' || targetQuote?.status === 'proposal_sent' || targetQuote?.ack_email_sent_at || targetQuote?.has_proposal_sent) ? 'proposal' : 'draft') 
                        : (targetQuote?.status || 'draft'))));

        const safeAckStatus = isClientRejected 
            ? 'rejected' 
            : (isClientAccepted || isProjectStartedForQuote || targetQuote?.status === 'order_converted' 
                ? 'accepted' 
                : (targetQuote?.ack_status || 'pending'));

        const fullProject = {
            ...proj,
            ...targetQuote,
            is_initial_quote: isInitialQuote,
            is_lead_converted: isProjectStartedForQuote,
            is_converted: isProjectStartedForQuote ? 1 : 0,
            has_project_started: isProjectStartedForQuote,
            stage1_paid: isStage1PaidForQuote ? 1 : 0,
            is_10_percent_paid: isStage1PaidForQuote ? 1 : 0,
            project_status: isProjectStartedForQuote ? (proj?.status || 'designing phase') : (isClientRejected ? 'order_lost' : 'draft'),
            status: safeStatus,
            ack_status: safeAckStatus,
            acknowledged_at: isClientAccepted ? (targetQuote?.acknowledged_at || null) : null,
            is_duplicate: isDraftOrDup ? true : Boolean(targetQuote.is_duplicate),
            is_final_version: isDraftOrDup ? false : Boolean(targetQuote.is_final_version),
            is_final: isDraftOrDup ? false : Boolean(targetQuote.is_final),
            is_qc_approved: isDraftOrDup ? false : Boolean(targetQuote.is_qc_approved),
            qc_approved: isDraftOrDup ? false : Boolean(targetQuote.qc_approved),
            is_final_quote_approved: isDraftOrDup ? 0 : (proj.is_final_quote_approved || 0),
            qc_status: isDraftOrDup ? 'not_sent' : (targetQuote.qc_status || 'not_sent'),
            qc_meeting_status: matchedLead?.qc_status || proj?.qc_status || matchedLead?.site_inspector_status || proj?.site_inspector_status || '',
            site_inspector_status: matchedLead?.site_inspector_status || proj?.site_inspector_status || '',
            site_manager_status: matchedLead?.site_manager_status || proj?.site_manager_status || '',
            is_qc_completed: matchedLead?.is_qc_completed ?? proj?.is_qc_completed ?? 0,
            is_qc_done: matchedLead?.is_qc_done ?? proj?.is_qc_done ?? 0,
            quote_id: targetQuote.quote_id || proj.quote_id,
            project_id: proj.project_id || targetQuote.project_id || 'standalone',
            project_code: proj.project_code || targetQuote.project_code,
            client_name: targetQuote.client_name || proj.client_name || targetQuote.subtitle || 'Client',
            client_phone: targetQuote.client_phone || proj.client_phone || matchedLead?.contact_number || matchedLead?.phone || '',
            client_email: targetQuote.client_email || proj.client_email || matchedLead?.email || '',
            location: targetQuote.location || proj.location || matchedLead?.location || '',
            client_address: targetQuote.client_address || proj.client_address || matchedLead?.client_address || '',
            project_scope: targetQuote.project_scope || proj.project_scope || matchedLead?.project_scope || '2 BHK',
            designer_name: targetQuote.designer_name || proj.designer_name || staffDetails.designerName || '',
            sales_manager_name: (() => {
                const sm = targetQuote.sales_manager_name || proj.sales_manager_name;
                return (sm && !sm.toLowerCase().includes('admin')) ? sm : staffDetails.salesPersonName;
            })(),
            sales_manager_phone: (() => {
                const ph = targetQuote.sales_manager_phone || proj.sales_manager_phone;
                return (ph && ph !== '9182263332') ? ph : staffDetails.salesPersonPhone;
            })(),
            sales_manager_email: targetQuote.sales_manager_email || proj.sales_manager_email || staffDetails.salesPersonEmail || 'sukendra.ch@livincart.com',
            project_name: proj.project_name || targetQuote.project_name || `${targetQuote.client_name || 'Client'} Quotation`,
            initialSections: undefined,
            initialExtraData: undefined
        };
        setActiveEditingProject(fullProject);
    };

    useEffect(() => {
        const handleClickOutside = () => {
            setActiveRowMenu(null);
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const isFinalMode = searchParams.get('final') === 'true' || Boolean(location.state?.isFinalMode);
        const isInitialFlow = searchParams.get('initial') === 'true' || Boolean(location.state?.isInitialQuote);
        const shouldCreate = (searchParams.get('create') === 'true' || Boolean(location.state?.createForLead)) && !isFinalMode;
        const leadIdParam = searchParams.get('lead_id') || location.state?.createForLead?.lead_id || location.state?.project?.lead_id;

        if (location.state?.targetQuote) {
            setShowCreateModal(false);
            setIsInitialQuoteFlow(false);
            openQuoteWorkspace(location.state.targetQuote);
            navigate('/quotes', { replace: true, state: null });
            return;
        }

        if (isFinalMode) {
            // Final Quotation mode -> Quote already exists! Open existing quote editor directly (skip modal popup)
            const targetLead = location.state?.project ||
                location.state?.createForLead ||
                (leadsList.length > 0 ? leadsList.find((l: any) => String(l.lead_id) === String(leadIdParam) || String(l.manual_client_id) === String(leadIdParam)) : null);

            if (targetLead && isDesignerRole && !isLeadAssignedToDesigner(targetLead, effectiveUser)) {
                alert('Access Restricted: You are only permitted to access quotations for projects assigned to you.');
                navigate('/quotes', { replace: true, state: null });
                return;
            }

            if (targetLead) {
                const hasStage1 = Boolean(
                    targetLead.stage1_paid === 1 ||
                    targetLead.stage1_paid === true ||
                    targetLead.stage1_paid === '1' ||
                    targetLead.is_10_percent_paid === 1 ||
                    targetLead.is_10_percent_paid === true ||
                    targetLead.is_10_percent_paid === '1' ||
                    String(targetLead.payment_status || '').toLowerCase().includes('10%') ||
                    String(targetLead.payment_status || '').toLowerCase().includes('20%')
                );
                const isConv = hasStage1 && Boolean(targetLead.is_converted === 1 || targetLead.status === 'won' || targetLead.status === 'converted');
                setActiveEditingProjectState({
                    ...targetLead,
                    stage1_paid: hasStage1 ? 1 : 0,
                    is_10_percent_paid: hasStage1 ? 1 : 0,
                    is_lead_converted: isConv,
                    is_converted: isConv ? 1 : 0
                });
            } else if (leadIdParam) {
                setActiveEditingProjectState({
                    lead_id: leadIdParam,
                    project_id: leadIdParam,
                    client_name: 'Existing Client',
                    is_lead_converted: false,
                    is_converted: 0
                });
            }
            setShowCreateModal(false);
            navigate('/quotes', { replace: true, state: null });
        } else if (shouldCreate) {
            const targetLead = location.state?.createForLead ||
                location.state?.project ||
                (leadsList.length > 0 ? leadsList.find((l: any) => String(l.lead_id) === String(leadIdParam) || String(l.manual_client_id) === String(leadIdParam)) : null);

            if (targetLead && isDesignerRole && !isLeadAssignedToDesigner(targetLead, effectiveUser)) {
                alert('Access Restricted: You are only permitted to create quotations for projects assigned to you.');
                navigate('/quotes', { replace: true, state: null });
                return;
            }

            // Check if a quote already exists for this lead in rawQuotes by exact lead ID or manual client ID
            const lid = String(leadIdParam || targetLead?.lead_id || '').toLowerCase().trim();
            const mcId = String(targetLead?.manual_client_id || '').toLowerCase().trim();

            const existingQuote = rawQuotes.find((q: any) => {
                const qid = String(q.quote_id || '');
                if (!qid || qid.startsWith('lead-') || qid.startsWith('p-') || q.is_placeholder || q.is_synthetic) return false;
                const num = Number(qid);
                if (isNaN(num) || num <= 0) return false;

                const qPid = String(q.project_id || '').toLowerCase().trim();
                const qLeadId = String(q.lead_id || '').toLowerCase().trim();
                const qCode = String(q.project_code || '').toLowerCase().trim();

                if (lid && (qLeadId === lid || qPid === lid || qCode === lid || qPid === `pr-${lid}` || qCode === `pr-${lid}`)) return true;
                if (mcId && (qPid === mcId || qCode === mcId)) return true;
                return false;
            });

            if (existingQuote) {
                // Initial quotation already exists for this lead! One time is enough!
                setShowCreateModal(false);
                setIsInitialQuoteFlow(false);
                openQuoteWorkspace(existingQuote);
                navigate('/quotes', { replace: true, state: null });
                return;
            }

            setIsInitialQuoteFlow(Boolean(isInitialFlow));

            if (targetLead) {
                const lid = String(targetLead.lead_id || '');
                if (lid) setSelectedLeadId(lid);
                const pIdVal = targetLead.manual_client_id || targetLead.project_code || (lid ? `PR-${lid}` : '');
                const staffDetails = resolveLeadStaffDetails(targetLead);
                const rawType = targetLead.project_type || targetLead.consultation_type || '';
                const rawScope = targetLead.project_scope || targetLead.custom_scope || targetLead.scope || '';
                const rawSource = targetLead.lead_source || targetLead.source || '';

                setCreateFormData({
                    client_name: targetLead.client_name || targetLead.name || '',
                    contact_number: targetLead.contact_number || targetLead.phone || '',
                    email: targetLead.email || targetLead.client_email || '',
                    project_id: pIdVal,
                    client_address: targetLead.client_address || targetLead.address || '',
                    location: targetLead.location || targetLead.site_address || '',
                    project_type: rawType ? rawType.trim() : 'Interior Projects',
                    project_scope: rawScope ? rawScope.trim() : '2 BHK',
                    custom_scope: rawScope ? rawScope.trim() : '2 BHK',
                    lead_source: rawSource ? rawSource.trim() : 'Walk In',
                    estimated_budget: String(targetLead.estimated_budget || targetLead.total_budget || targetLead.initial_quote_amount || ''),
                    designer_name: staffDetails.designerName,
                    sales_person_name: staffDetails.salesPersonName,
                    sales_person_phone: staffDetails.salesPersonPhone,
                    sales_person_email: staffDetails.salesPersonEmail
                });
                setShowCreateModal(true);
            } else if (leadIdParam) {
                const lid = String(leadIdParam);
                setSelectedLeadId(lid);
                axios.get(`${API_BASE_URL}/leads/${lid}`).then(res => {
                    const lData = res.data?.data || res.data;
                    if (lData && (lData.client_name || lData.lead_id)) {
                        const pIdVal = lData.manual_client_id || lData.project_code || `PR-${lid}`;
                        const staffDetails = resolveLeadStaffDetails(lData);
                        const rawType = lData.project_type || lData.consultation_type || '';
                        const rawScope = lData.project_scope || lData.custom_scope || lData.scope || '';
                        const rawSource = lData.lead_source || lData.source || '';
                        setCreateFormData({
                            client_name: lData.client_name || lData.name || '',
                            contact_number: lData.contact_number || lData.phone || '',
                            email: lData.email || lData.client_email || '',
                            project_id: pIdVal,
                            client_address: lData.client_address || lData.address || '',
                            location: lData.location || lData.site_address || '',
                            project_type: rawType ? rawType.trim() : 'Interior Projects',
                            project_scope: rawScope ? rawScope.trim() : '2 BHK',
                            custom_scope: rawScope ? rawScope.trim() : '2 BHK',
                            lead_source: rawSource ? rawSource.trim() : 'Walk In',
                            estimated_budget: String(lData.estimated_budget || lData.total_budget || lData.initial_quote_amount || ''),
                            designer_name: staffDetails.designerName,
                            sales_person_name: staffDetails.salesPersonName,
                            sales_person_phone: staffDetails.salesPersonPhone,
                            sales_person_email: staffDetails.salesPersonEmail
                        });
                    } else {
                        setCreateFormData(prev => ({ ...prev, project_id: `PR-${lid}` }));
                    }
                }).catch(() => {
                    setCreateFormData(prev => ({ ...prev, project_id: `PR-${lid}` }));
                });
                setShowCreateModal(true);
            }
            navigate('/quotes', { replace: true, state: null });
        } else if (location.state?.project) {
            setShowCreateModal(false);
            const pObj = location.state.project;
            if (pObj.quote_id) {
                const matchedQuote = rawQuotes.find((q: any) => String(q.quote_id) === String(pObj.quote_id));
                if (matchedQuote) {
                    openQuoteWorkspace(matchedQuote);
                    navigate('/quotes', { replace: true, state: null });
                    return;
                }
            }
            const isConv = pObj.is_lead_converted !== undefined ? Boolean(pObj.is_lead_converted) : Boolean(pObj.is_converted === 1 || pObj.status === 'won' || pObj.status === 'converted');
            setActiveEditingProjectState({
                ...pObj,
                is_lead_converted: isConv,
                is_converted: isConv ? 1 : 0
            });
            navigate('/quotes', { replace: true, state: null });
        }
    }, [location.state, location.search, leadsList, rawQuotes]);

    useEffect(() => {
        return () => {
            sessionStorage.removeItem('dc_active_editing_project');
        };
    }, []);
    const [previewModalQuote, setPreviewModalQuote] = useState<any | null>(null);
    const [saveReportDropdownOpen, setSaveReportDropdownOpen] = useState<boolean>(false);
    const [downloadDropdownOpen, setDownloadDropdownOpen] = useState<boolean>(false);

    // Send Quote Email Modal State
    const [emailModalQuote, setEmailModalQuote] = useState<any | null>(null);
    const [emailProject, setEmailProject] = useState<any | null>(null);
    const [emailQuoteDetails, setEmailQuoteDetails] = useState<any | null>(null);
    const [sendingEmail, setSendingEmail] = useState<boolean>(false);
    const [generatingPreview, setGeneratingPreview] = useState<boolean>(false);
    const [customPdfFile, setCustomPdfFile] = useState<File | null>(null);
    const [removePdfAttachment, setRemovePdfAttachment] = useState<boolean>(false);
    const [includeQuotePdf, setIncludeQuotePdf] = useState<boolean>(true);
    const [includeAgreementPdf, setIncludeAgreementPdf] = useState<boolean>(false);
    const [availableAgreementId, setAvailableAgreementId] = useState<number | null>(null);
    const [isAgreementSigned, setIsAgreementSigned] = useState<boolean>(false);
    const [emailForm, setEmailForm] = useState({
        from: 'quotes@livincart.com',
        to: '',
        subject: '',
        content: ''
    });
    const [emailHiddenFields, setEmailHiddenFields] = useState<Record<string, boolean>>({
        particulars: false,
        qty: false,
        discount: false,
        amount: false,
        shutterMaterial: false,
        carcassMaterial: false,
        dimensions: false,
        rate: false,
        categoryDiscount: false,
        promoCode: false,
        generalDiscount: false,
        additionalCharges: false,
        gst: false,
        roundOff: false
    });
    const [showEmailHideFieldsPanel, setShowEmailHideFieldsPanel] = useState<boolean>(false);

    // Robust helper to resolve client email from quote, leadsList, clientsList, projects, extra_data, or cache
    const resolveClientEmailForQuote = (
        q: any,
        leads: any[] = [],
        clients: any[] = [],
        projects: any[] = []
    ): string => {
        if (!q) return '';

        const isValid = (em: any) => typeof em === 'string' && em.trim().length > 3 && em.includes('@') && em.includes('.');

        // 1. Direct fields on quote
        if (isValid(q.client_email)) return String(q.client_email).trim();
        if (isValid(q.email)) return String(q.email).trim();

        // 2. Extra data on quote
        let extraEmail = '';
        if (q.extra_data) {
            try {
                const ed = typeof q.extra_data === 'string' ? JSON.parse(q.extra_data) : q.extra_data;
                extraEmail = ed.client_email || ed.last_email_to || ed.email || ed.to_email || '';
            } catch (e) { }
        } else if (q.extra_data_parsed) {
            extraEmail = q.extra_data_parsed.client_email || q.extra_data_parsed.last_email_to || q.extra_data_parsed.email || q.extra_data_parsed.to_email || '';
        }
        if (isValid(extraEmail)) return String(extraEmail).trim();

        // 3. Normalized search keys
        const rawClientName = String(q.client_name || q.subtitle || '').trim();
        const clean = (s: string) => String(s || '').toLowerCase().replace(/^(mr\.?|ms\.?|mrs\.?|miss\.?|dr\.?)\s+/i, '').replace(/[^a-z0-9]/g, '');
        const getBaseName = (s: string) => {
            return String(s || '').toLowerCase()
                .replace(/^(mr\.?|ms\.?|mrs\.?|miss\.?|dr\.?)\s+/i, '')
                .replace(/(_\d+|\(\d+\)|-\d+|\s+\d+|[_-]v\d+|\b(draft|v\d+)\b)/gi, '')
                .replace(/[^a-z0-9]/g, '');
        };

        const qClean = clean(rawClientName);
        const qBase = getBaseName(rawClientName);
        const rawPid = String(q.project_id || '').toLowerCase().trim();
        const numPid = rawPid.replace(/\D/g, '');
        const rawLeadId = String(q.lead_id || '').toLowerCase().trim();
        const rawQNum = String(q.quote_number || '').toLowerCase().trim();
        const extractedNumMatch = rawQNum.match(/(\d{4,})/);
        const extractedNum = extractedNumMatch ? extractedNumMatch[1] : '';

        // 4. Search leads list (filtering for valid emails ONLY)
        if (Array.isArray(leads) && leads.length > 0) {
            const validLeads = leads.filter((l: any) => isValid(l.email || l.client_email));

            // 4a. Match by ID
            const idMatched = validLeads.find((l: any) => {
                const lid = String(l.lead_id || '').toLowerCase().trim();
                const mid = String(l.manual_client_id || '').toLowerCase().trim();
                if (rawLeadId && (lid === rawLeadId || mid === rawLeadId)) return true;
                if (numPid && (lid === numPid || mid === numPid)) return true;
                if (rawPid && (lid === rawPid || mid === rawPid)) return true;
                if (extractedNum && (lid === extractedNum || mid === extractedNum || mid.includes(extractedNum))) return true;
                return false;
            });
            if (idMatched) return String(idMatched.email || idMatched.client_email).trim();

            // 4b. Match by phone
            const qPhone = String(q.contact_number || q.client_phone || q.phone || '').replace(/\D/g, '');
            if (qPhone && qPhone.length > 5) {
                const phoneMatched = validLeads.find((l: any) => {
                    const lp = String(l.contact_number || l.phone || '').replace(/\D/g, '');
                    return lp && lp.length > 5 && (lp === qPhone || lp.includes(qPhone) || qPhone.includes(lp));
                });
                if (phoneMatched) return String(phoneMatched.email || phoneMatched.client_email).trim();
            }

            // 4c. Match by exact clean client name
            if (qClean) {
                const nameMatched = validLeads.find((l: any) => {
                    const lClean = clean(l.client_name);
                    return lClean && lClean === qClean;
                });
                if (nameMatched) return String(nameMatched.email || nameMatched.client_email).trim();
            }

            // 4d. Match by base name (stripping _000, numbers, etc.)
            if (qBase && qBase.length >= 3) {
                const baseMatched = validLeads.find((l: any) => {
                    const lClean = clean(l.client_name);
                    const lBase = getBaseName(l.client_name);
                    if (lClean === qBase || lBase === qBase) return true;
                    if (lClean.length >= 3 && (lClean.includes(qBase) || qBase.includes(lClean))) return true;
                    return false;
                });
                if (baseMatched) return String(baseMatched.email || baseMatched.client_email).trim();
            }
        }

        // 5. Search clients list
        if (Array.isArray(clients) && clients.length > 0) {
            const validClients = clients.filter((c: any) => isValid(c.email));
            const cMatched = validClients.find((c: any) => {
                const cid = String(c.client_id || '').toLowerCase().trim();
                const ccode = String(c.client_code || '').toLowerCase().trim();
                const cClean = clean(c.name);
                const cBase = getBaseName(c.name);
                if (rawPid && (cid === rawPid || ccode === rawPid)) return true;
                if (numPid && (cid === numPid || ccode === numPid)) return true;
                if (qClean && cClean === qClean) return true;
                if (qBase && qBase.length >= 3 && (cClean === qBase || cBase === qBase || cClean.includes(qBase) || qBase.includes(cClean))) return true;
                return false;
            });
            if (cMatched) return String(cMatched.email).trim();
        }

        // 6. Search projects list
        if (Array.isArray(projects) && projects.length > 0) {
            const pMatched = projects.find((p: any) => {
                const pid = String(p.project_id || '').toLowerCase().trim();
                const pcode = String(p.project_code || '').toLowerCase().trim();
                const pclient = clean(p.client_name || '');
                const pBase = getBaseName(p.client_name || '');
                if (rawPid && (pid === rawPid || (numPid && pid === numPid))) return true;
                if (rawPid && pcode === rawPid) return true;
                if (qClean && pclient === qClean) return true;
                if (qBase && qBase.length >= 3 && (pclient === qBase || pBase === qBase)) return true;
                return false;
            });
            if (pMatched && isValid(pMatched.client_email || pMatched.email)) {
                return String(pMatched.client_email || pMatched.email).trim();
            }
        }

        // 7. Check localStorage cache
        try {
            if (qClean) {
                const cached = localStorage.getItem(`client_email_${qClean}`);
                if (isValid(cached)) return String(cached).trim();
            }
            if (qBase) {
                const cached = localStorage.getItem(`client_email_${qBase}`);
                if (isValid(cached)) return String(cached).trim();
            }
            if (rawPid) {
                const cached = localStorage.getItem(`client_email_${rawPid}`);
                if (isValid(cached)) return String(cached).trim();
            }
        } catch (e) { }

        return '';
    };

    // Auto-fill To (Client Email) whenever modal opens or quote details update
    useEffect(() => {
        if (!emailModalQuote) return;
        if (emailForm.to && emailForm.to.trim() !== '') return;

        const resolved = resolveClientEmailForQuote(
            emailQuoteDetails || emailModalQuote,
            leadsList,
            clientsList,
            rawProjects
        );
        if (resolved) {
            setEmailForm(prev => ({
                ...prev,
                to: resolved
            }));
        }
    }, [emailModalQuote, emailQuoteDetails, emailProject, emailForm.to, leadsList, clientsList, rawProjects]);

    /* ── Quotation Acknowledgement State & Handler ── */
    const [ackSendingId, setAckSendingId] = useState<string | number | null>(null);

    const handleSendAckEmail = async (q: any) => {
        const quoteId = q.quote_id || q.id;
        if (!quoteId) {
            alert('Missing quote ID');
            return;
        }

        let clientEmail = q.client_email || q.email || '';
        if (!clientEmail) {
            clientEmail = window.prompt(
                `Enter client email for "${q.client_name || q.subtitle || 'Quotation'}":`,
                ''
            ) || '';
        }
        if (!clientEmail || !clientEmail.includes('@')) {
            alert('A valid client email address is required to send the acknowledgement email.');
            return;
        }

        setAckSendingId(quoteId);
        try {
            const res = await axios.post(`${API_BASE_URL}/quotes/send-ack-email`, {
                quote_id: quoteId,
                quote_number: q.quote_number || '',
                client_email: clientEmail,
                client_name: q.client_name || q.subtitle || ''
            });

            if (res.data?.success) {
                alert(`✅ Quotation Acknowledgement email sent successfully!\n\nDelivered to: Client (${clientEmail}), Admin, Designer, and Sales Team.\n\nThe email contains ACCEPT and REJECT buttons. When ACCEPT is clicked, the lead converts to a project automatically and all stakeholders receive official confirmation.`);
                setRawQuotes(prev => prev.map(item =>
                    (String(item.quote_id) === String(quoteId) || (q.project_id && String(item.project_id) === String(q.project_id)))
                        ? { ...item, ack_email_sent_at: new Date().toISOString(), status: 'proposal', has_proposal_sent: true }
                        : item
                ));
                await fetchQuotesAndProjects();
            } else {
                alert('❌ ' + (res.data?.message || 'Failed to send acknowledgement email'));
            }
        } catch (err: any) {
            alert('Error: ' + (err.response?.data?.message || err.message || 'Network error'));
        } finally {
            setAckSendingId(null);
        }
    };

    // Vendor Quota Modal State
    const [vendorQuotaModalQuote, setVendorQuotaModalQuote] = useState<any>(null);
    const [availableVendors, setAvailableVendors] = useState<any[]>([]);
    const [itemVendorAssignments, setItemVendorAssignments] = useState<Record<number, string>>({});
    const [customVendorItems, setCustomVendorItems] = useState<Record<number, {
        rate?: number;
        discount_percent?: number;
        gst_rate?: number;
        quantity?: number;
        width?: number | string;
        height?: number | string;
        sft?: number | string;
        pricing_mode?: string;
        particulars?: string;
        description?: string;
    }>>({});
    const [savingVendorQuota, setSavingVendorQuota] = useState<boolean>(false);
    const [vendorQuotaSuccess, setVendorQuotaSuccess] = useState<string>('');

    // Create New Quotation Modal State
    const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
    const [isInitialQuoteFlow, setIsInitialQuoteFlow] = useState<boolean>(false);
    const [selectedLeadId, setSelectedLeadId] = useState<string>('');
    const [leadSearchTerm, setLeadSearchTerm] = useState<string>('');
    const [isLeadDropdownOpen, setIsLeadDropdownOpen] = useState<boolean>(false);
    const leadDropdownRef = useRef<HTMLDivElement>(null);

    const [duplicateSourceId, setDuplicateSourceId] = useState<string>('');
    const [duplicateSearchTerm, setDuplicateSearchTerm] = useState<string>('');
    const [isDuplicateDropdownOpen, setIsDuplicateDropdownOpen] = useState<boolean>(false);
    const duplicateDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (duplicateDropdownRef.current && !duplicateDropdownRef.current.contains(event.target as Node)) {
                setIsDuplicateDropdownOpen(false);
            }
            if (leadDropdownRef.current && !leadDropdownRef.current.contains(event.target as Node)) {
                setIsLeadDropdownOpen(false);
            }
        };
        if (isDuplicateDropdownOpen || isLeadDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isDuplicateDropdownOpen, isLeadDropdownOpen]);

    const [submittingCreate, setSubmittingCreate] = useState<boolean>(false);
    const [createFormData, setCreateFormData] = useState<{
        client_name: string;
        contact_number: string;
        email: string;
        project_id: string;
        client_address: string;
        location: string;
        project_type: string;
        project_scope: string;
        custom_scope?: string;
        lead_source: string;
        estimated_budget: string;
        designer_name?: string;
        sales_person_name?: string;
        sales_person_phone?: string;
        sales_person_email?: string;
    }>({
        client_name: '',
        contact_number: '',
        email: '',
        project_id: '',
        client_address: '',
        location: '',
        project_type: 'Interior Projects',
        project_scope: '2 BHK',
        custom_scope: '',
        lead_source: 'Walk In',
        estimated_budget: '',
        designer_name: '',
        sales_person_name: '',
        sales_person_phone: '',
        sales_person_email: ''
    });

    // Detect if Project has Started for the Create Quotation form
    const isProjectStartedCreate = useMemo(() => {
        if (selectedLeadId) {
            const matched = leadsList.find((l: any) => String(l.lead_id) === String(selectedLeadId));
            if (matched && (matched.is_converted === 1 || ['won', 'converted', 'order_converted'].includes(String(matched.status || '').toLowerCase()))) {
                return true;
            }
        }
        const cid = String(createFormData.project_id || '').toLowerCase().trim();
        if (cid) {
            return rawProjects.some((p: any) => {
                const pid = String(p.project_id || '').toLowerCase().trim();
                const pcode = String(p.project_code || '').toLowerCase().trim();
                return pid === cid || pcode === cid || (cid.length > 2 && pcode.includes(cid));
            });
        }
        return false;
    }, [selectedLeadId, createFormData.project_id, leadsList, rawProjects]);

    // Dedicated Duplicate Quotation Modal State
    const [showDuplicateModal, setShowDuplicateModal] = useState<boolean>(false);
    const [duplicateSourceQuote, setDuplicateSourceQuote] = useState<any | null>(null);
    const [selectedDupLeadId, setSelectedDupLeadId] = useState<string>('');
    const [dupFormData, setDupFormData] = useState({
        project_id: '',
        client_name: '',
        contact_number: '',
        email: '',
        location: '',
        client_address: '',
        project_type: 'Furniture projects',
        project_scope: '2 BHK'
    });

    // Helper: Check if a given project ID or lead ID already has an active quotation in system
    const isProjectAlreadyQuoted = useCallback((targetPid: string | number, targetLeadId?: string | number, targetPcode?: string) => {
        if (!targetPid && !targetLeadId && !targetPcode) return false;
        const cleanId = String(targetPid || '').toLowerCase().replace(/\D/g, '');
        const cleanLeadId = String(targetLeadId || '').toLowerCase().replace(/\D/g, '');
        const rawStr = String(targetPid || '').toLowerCase().trim();
        const rawCode = String(targetPcode || '').toLowerCase().trim();

        return rawQuotes.some(q => {
            // Ignore placeholder projects with zero amount and p- prefix
            if (String(q.quote_id || '').startsWith('p-') && Number(q.total_amount || 0) === 0) {
                return false;
            }

            const qPid = String(q.project_id || '').toLowerCase().trim();
            const qCleanPid = qPid.replace(/\D/g, '');
            const qPcode = String(q.project_code || '').toLowerCase().trim();
            const qLeadId = String(q.lead_id || '').toLowerCase().trim();
            const qCleanLeadId = qLeadId.replace(/\D/g, '');

            if (cleanId && (qCleanPid === cleanId || (qCleanLeadId && qCleanLeadId === cleanId))) return true;
            if (cleanLeadId && (qCleanPid === cleanLeadId || (qCleanLeadId && qCleanLeadId === cleanLeadId))) return true;
            if (rawStr && (qPid === rawStr || qPcode === rawStr)) return true;
            if (rawCode && (qPid === rawCode || qPcode === rawCode)) return true;
            return false;
        });
    }, [rawQuotes]);

    const handleOpenDuplicateModal = (q: any) => {
        setDuplicateSourceQuote(q);
        setSelectedDupLeadId('');
        const timestamp = Date.now().toString().slice(-4);
        const baseCode = q.project_code || (q.project_id ? `PR-${q.project_id}` : 'PR');
        const baseClient = q.client_name || q.subtitle || 'Client';
        setDupFormData({
            project_id: `${baseCode}-COPY-${timestamp}`,
            client_name: `${baseClient} (Copy)`,
            contact_number: q.client_phone || q.contact_number || '',
            email: q.client_email || q.email || '',
            location: q.location || '',
            client_address: q.client_address || '',
            project_type: q.project_type || 'Furniture projects',
            project_scope: q.project_scope || '2 BHK'
        });
        setShowDuplicateModal(true);
    };

    const handleSelectDupLead = (leadId: string) => {
        setSelectedDupLeadId(leadId);
        if (!leadId) {
            setDupFormData(prev => ({
                ...prev,
                project_id: '',
                client_name: '',
                contact_number: '',
                email: '',
                location: '',
                client_address: ''
            }));
            return;
        }

        const matchedLead = leadsList.find((l: any) => String(l.lead_id) === String(leadId));
        const matchedProject = !matchedLead ? rawProjects.find((p: any) => String(p.project_id) === String(leadId)) : null;
        const matched = matchedLead || matchedProject;

        if (matched) {
            const pIdVal = matched.manual_client_id || (matched.project_code ? matched.project_code : (matched.lead_id ? `PR-LEAD-${matched.lead_id}` : `PR-${matched.project_id}`));
            setDupFormData(prev => ({
                ...prev,
                project_id: pIdVal,
                client_name: matched.client_name || matched.name || matched.project_name || '',
                contact_number: matched.contact_number || matched.phone || matched.client_phone || '',
                email: matched.email || matched.client_email || '',
                client_address: matched.client_address || '',
                location: matched.location || matched.site_address || '',
                project_type: matched.project_type || 'Furniture projects',
                project_scope: matched.project_scope || '2 BHK'
            }));
        }
    };

    const handleDupLeadLookup = (val: string) => {
        const query = val.trim().toLowerCase();
        setSelectedDupLeadId('');
        if (!query) {
            setDupFormData(prev => ({ ...prev, project_id: val }));
            return;
        }

        const matchedLead = leadsList.find((l: any) => {
            const lid = String(l.lead_id);
            const manualId = String(l.manual_client_id || '');
            const pcode = String(l.project_code || '');
            const cname = String(l.client_name || '');
            return (
                lid === query ||
                `lead_${lid}`.toLowerCase() === query ||
                `lead-${lid}`.toLowerCase() === query ||
                `pr-${lid}`.toLowerCase() === query ||
                `pr_lead_${lid}`.toLowerCase() === query ||
                (manualId && manualId.toLowerCase() === query) ||
                (pcode && pcode.toLowerCase() === query) ||
                (cname && cname.toLowerCase() === query)
            );
        });

        const matchedProject = !matchedLead ? rawProjects.find((p: any) => {
            const pid = String(p.project_id);
            const pcode = String(p.project_code || p.manual_client_id || '');
            const cname = String(p.client_name || p.project_name || '');
            return (
                pid === query ||
                `pr-${pid}`.toLowerCase() === query ||
                (pcode && pcode.toLowerCase() === query) ||
                (cname && cname.toLowerCase() === query)
            );
        }) : null;

        const matched = matchedLead || matchedProject;

        if (matched) {
            setSelectedDupLeadId(matched.lead_id ? String(matched.lead_id) : '');
            setDupFormData(prev => ({
                ...prev,
                project_id: val,
                client_name: matched.client_name || matched.name || matched.project_name || prev.client_name,
                contact_number: matched.contact_number || matched.phone || matched.client_phone || prev.contact_number,
                email: matched.email || matched.client_email || prev.email,
                client_address: matched.client_address || prev.client_address,
                location: matched.location || matched.site_address || prev.location,
                project_type: matched.project_type || prev.project_type || 'Furniture projects',
                project_scope: matched.project_scope || prev.project_scope || '2 BHK'
            }));
        } else {
            setDupFormData(prev => ({ ...prev, project_id: val }));
        }
    };

    const handleConfirmDuplicateQuote = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!dupFormData.project_id || !dupFormData.client_name) {
            alert('Please select a Target Lead or Project to apply modules.');
            return;
        }

        if (isProjectAlreadyQuoted(dupFormData.project_id, selectedDupLeadId, dupFormData.project_id)) {
            alert(`⚠️ Quotation already added for this project (${dupFormData.project_id})!\n\nCannot create duplicate quotation. A quotation already exists for this project.`);
            return;
        }

        setSubmittingCreate(true);
        try {
            let duplicatedSections: any[] = [];
            let initialExtraData: any = null;
            const srcQuote = duplicateSourceQuote;

            let fullSrcData: any = null;
            try {
                const res = await axios.get(`${API_BASE_URL}/quotes/${srcQuote?.quote_id || srcQuote?.id}`);
                if (res.data?.success && res.data?.data) {
                    fullSrcData = res.data.data;
                }
            } catch (e) {
                console.warn('Failed to load source quote full details:', e);
            }

            const targetSrc = fullSrcData || srcQuote;
            const srcExtra = targetSrc?.extra_data_parsed || targetSrc?.extra_data || {};
            let qSections = targetSrc?.sections || [];

            if (qSections && qSections.length > 0) {
                duplicatedSections = qSections.map((sec: any, sIdx: number) => ({
                    id: `dup_sec_${Date.now()}_${sIdx}`,
                    name: sec.section_name || sec.title || sec.name || `Module ${sIdx + 1}`,
                    custom_headings: sec.custom_headings || undefined,
                    items: (sec.items || []).map((it: any, iIdx: number) => ({
                        id: `dup_it_${Date.now()}_${sIdx}_${iIdx}`,
                        particulars: it.particulars || it.item_name || '',
                        brand: it.brand || '',
                        unit: it.unit || 'SFT',
                        quantity: parseFloat(it.quantity) || 1,
                        used_quantity: parseFloat(it.used_quantity) || 0,
                        rate: parseFloat(it.rate) || 0,
                        amount: parseFloat(it.amount) || ((parseFloat(it.quantity) || 1) * (parseFloat(it.rate) || 0)),
                        width: it.width || '',
                        height: it.height || '',
                        sft: it.sft || '',
                        hsn_sac: it.hsn_sac || '',
                        image_url: it.image_url || '',
                        rate_per_sft: it.rate_per_sft ? parseFloat(it.rate_per_sft) : 0,
                        discount_percent: it.discount_percent !== undefined && it.discount_percent !== null ? parseFloat(it.discount_percent) : 0,
                        gst_rate: it.gst_rate !== undefined && it.gst_rate !== null && String(it.gst_rate) !== '' ? parseFloat(it.gst_rate) : '',
                        category: it.category || '',
                        pricing_mode: it.pricing_mode || 'dimensions'
                    }))
                }));
            }

            let dupCharges: any = srcExtra.additional_charges || srcExtra.additionalCharges || targetSrc?.additional_charges || targetSrc?.additionalCharges || null;
            if (dupCharges && typeof dupCharges === 'object' && typeof dupCharges.amount === 'object') {
                dupCharges = { ...dupCharges, amount: parseFloat(dupCharges.amount?.amount || dupCharges.amount?.value || 0) || 0 };
            } else if (dupCharges && typeof dupCharges !== 'object') {
                dupCharges = { amount: parseFloat(dupCharges) || 0, withGst: false, gstRate: 0 };
            }

            const dupFlat = srcExtra.flat_discount ?? srcExtra.flatDiscount ?? targetSrc?.flat_discount ?? targetSrc?.flatDiscount ?? (srcExtra.general_discount?.amount || null);

            initialExtraData = {
                applied_coupon: null,
                additional_charges: dupCharges,
                general_discount: srcExtra.general_discount || srcExtra.generalDiscount || null,
                flat_discount: dupFlat,
                global_discount: srcExtra.global_discount || srcExtra.globalDiscount || null,
                overall_gst_enabled: srcExtra.overall_gst_enabled !== undefined ? srcExtra.overall_gst_enabled : true,
                overall_gst_line_hidden: srcExtra.overall_gst_line_hidden !== undefined ? srcExtra.overall_gst_line_hidden : false,
                round_off_enabled: srcExtra.round_off_enabled !== undefined ? srcExtra.round_off_enabled : true,
                custom_headings: srcExtra.custom_headings || null,
                section_headings: srcExtra.section_headings || null,
                hidden_fields: srcExtra.hidden_fields || null,
                category_discounts: srcExtra.category_discounts || srcExtra.tempCategoryDiscounts || null,
                discount_percent: targetSrc?.discount_percent || srcExtra.discount_percent || 0,
                is_duplicate: true,
                is_final_version: false,
                is_final: false,
                is_qc_approved: false,
                qc_approved: false,
                is_final_quote_approved: 0,
                qc_status: 'not_sent'
            };

            const rawLeadNum = String(selectedDupLeadId || dupFormData.project_id).replace(/\D/g, '');
            const numericPid = Number(selectedDupLeadId) > 0 ? Number(selectedDupLeadId) : (rawLeadNum && Number(rawLeadNum) > 0 ? Number(rawLeadNum) : Math.floor(Date.now() / 1000));

            try {
                sessionStorage.removeItem(`final_locked_project_${numericPid}`);
                sessionStorage.removeItem(`final_locked_project_${dupFormData.project_id}`);
                sessionStorage.removeItem(`final_locked_project_p-${numericPid}`);
            } catch (e) { }

            const newProj = {
                quote_id: `p-${numericPid}`,
                project_id: numericPid,
                project_code: dupFormData.project_id,
                project_name: `${dupFormData.client_name} Quotation`,
                client_name: dupFormData.client_name,
                client_phone: dupFormData.contact_number || '',
                client_email: dupFormData.email || '',
                client_address: dupFormData.client_address || '',
                location: dupFormData.location || '',
                project_type: dupFormData.project_type || 'Furniture projects',
                project_scope: dupFormData.project_scope || '2 BHK',
                total_amount: Number(targetSrc?.total_amount || targetSrc?.grand_total || targetSrc?.net_total || 0),
                version: 1,
                status: 'draft',
                save_type: 'draft',
                is_duplicate: true,
                is_final_version: false,
                is_final: false,
                qc_status: 'not_sent',
                is_qc_approved: false,
                qc_approved: false,
                is_final_quote_approved: 0,
                is_lead_converted: false,
                is_converted: 0,
                has_project_started: false,
                created_at: new Date().toISOString(),
                created_by: effectiveUser?.user_id || user?.user_id || 1,
                user_id: effectiveUser?.user_id || user?.user_id || 1,
                designer_id: effectiveUser?.user_id || user?.user_id || 1,
                designer_name: effectiveUser?.name || user?.name || '',
                initialSections: duplicatedSections,
                initialExtraData: initialExtraData
            };

            let savedQuoteId: any = null;
            try {
                const draftRes = await axios.post(`${API_BASE_URL}/quotes/save-draft`, {
                    project_id: numericPid,
                    project_code: newProj.project_code,
                    client_name: newProj.client_name,
                    subtitle: newProj.client_name,
                    total_amount: newProj.total_amount,
                    sections: duplicatedSections,
                    status: 'draft',
                    save_type: 'draft',
                    is_duplicate: true,
                    is_final_version: false,
                    is_qc_approved: false,
                    created_by: effectiveUser?.user_id || user?.user_id || 1,
                    user_id: effectiveUser?.user_id || user?.user_id || 1,
                    role: effectiveUser?.role || user?.role || 'designer',
                    designer_id: effectiveUser?.user_id || user?.user_id || 1,
                    designer_name: effectiveUser?.name || user?.name || '',
                    quote_number: `QTN-${newProj.project_code}`,
                    extra_data: {
                        ...(initialExtraData || {}),
                        is_duplicate: true,
                        is_final_version: false,
                        is_final: false,
                        is_qc_approved: false,
                        qc_approved: false,
                        is_final_quote_approved: 0,
                        qc_status: 'not_sent',
                        created_by: effectiveUser?.user_id || user?.user_id || 1,
                        user_id: effectiveUser?.user_id || user?.user_id || 1,
                        designer_id: effectiveUser?.user_id || user?.user_id || 1,
                        designer_name: effectiveUser?.name || user?.name || '',
                        client_phone: newProj.client_phone,
                        client_email: newProj.client_email,
                        client_address: newProj.client_address,
                        location: newProj.location,
                        project_type: newProj.project_type,
                        project_scope: newProj.project_scope
                    }
                });
                if (draftRes.data?.quote_id) {
                    savedQuoteId = draftRes.data.quote_id;
                    newProj.quote_id = String(savedQuoteId);
                } else if (draftRes.data && !draftRes.data.success && draftRes.data.message) {
                    alert(`⚠️ ${draftRes.data.message}`);
                    return;
                }
            } catch (saveErr) {
                console.warn('Failed to auto-save duplicate draft:', saveErr);
            }

            setShowDuplicateModal(false);
            setStatusFilter('All');
            setFilterCategory('Active Quotation');
            setSearchQuery('');
            setCurrentPage(1);

            setRawQuotes(prev => [newProj, ...prev.filter(q => String(q.project_id) !== String(numericPid) && String(q.quote_id) !== String(newProj.quote_id))]);
            setRecentlyCreatedQuote(newProj);
            setActiveEditingProject(null);
            await fetchQuotesAndProjects();
            alert(`✅ Quotation duplicated successfully as "${newProj.project_code}" for "${newProj.client_name}"!\n\nIt is now listed in your table history.`);
        } finally {
            setSubmittingCreate(false);
        }
    };

    const handleLeadLookup = (val: string) => {
        const query = val.trim().toLowerCase();
        setCreateFormData(prev => ({ ...prev, project_id: val }));
        if (!query) {
            setSelectedLeadId('');
            return;
        }

        const matched = leadsList.find((l: any) => {
            const lid = String(l.lead_id || '');
            const manualId = String(l.manual_client_id || '');
            const cname = String(l.client_name || '');
            return (
                lid === query ||
                `lead_${lid}`.toLowerCase() === query ||
                `lead-${lid}`.toLowerCase() === query ||
                `pr-${lid}`.toLowerCase() === query ||
                `pr_lead_${lid}`.toLowerCase() === query ||
                (manualId && manualId.toLowerCase() === query) ||
                (cname && cname.toLowerCase() === query)
            );
        });

        if (matched) {
            const lid = String(matched.lead_id || '');
            if (lid) setSelectedLeadId(lid);
            const staffDetails = resolveLeadStaffDetails(matched);
            const rawType = matched.project_type || matched.consultation_type || '';
            const rawScope = matched.project_scope || matched.custom_scope || matched.scope || '';
            const rawSource = matched.lead_source || matched.source || '';
            const pIdVal = matched.manual_client_id || matched.project_code || (lid ? `PR-${lid}` : '');

            setCreateFormData(prev => ({
                ...prev,
                client_name: matched.client_name || matched.name || '',
                contact_number: matched.contact_number || matched.phone || '',
                email: matched.email || matched.client_email || '',
                project_id: pIdVal || val,
                client_address: matched.client_address || matched.address || '',
                location: matched.location || matched.site_address || '',
                project_type: rawType ? rawType.trim() : 'Interior Projects',
                project_scope: rawScope ? rawScope.trim() : '2 BHK',
                custom_scope: rawScope ? rawScope.trim() : '2 BHK',
                lead_source: rawSource ? rawSource.trim() : 'Walk In',
                estimated_budget: String(matched.estimated_budget || matched.total_budget || matched.initial_quote_amount || prev.estimated_budget || ''),
                designer_name: staffDetails.designerName,
                sales_person_name: staffDetails.salesPersonName,
                sales_person_phone: staffDetails.salesPersonPhone,
                sales_person_email: staffDetails.salesPersonEmail
            }));
        }
    };

    const getQuoteItems = (q: any) => {
        if (!q) return [];
        const extra = q.extra_data_parsed || (typeof q.extra_data === 'string' ? (() => { try { return JSON.parse(q.extra_data); } catch (e) { return {}; } })() : q.extra_data) || {};

        let rawSections = (extra.sections && Array.isArray(extra.sections) && extra.sections.length > 0)
            ? extra.sections
            : (q.quote_data?.sections && Array.isArray(q.quote_data.sections) && q.quote_data.sections.length > 0)
                ? q.quote_data.sections
                : q.sections || [];

        if (!Array.isArray(rawSections) || rawSections.length === 0) {
            rawSections = q.sections || [];
        }

        if (Array.isArray(rawSections) && rawSections.length > 0) {
            const items: any[] = [];
            rawSections.forEach((sec: any) => {
                const secName = sec.section_name || sec.name || sec.title || 'General Module';
                // Section Header row matching quotation design system
                items.push({
                    brand: 'HEADER',
                    module_name: secName,
                    particulars: secName,
                    unit: '',
                    quantity: 0,
                    rate: 0,
                    amount: 0
                });

                const secItems = sec.items || [];
                secItems.forEach((it: any) => {
                    const qty = parseFloat(it.quantity) || 1;
                    const r = parseFloat(it.rate || it.rate_per_sft) || 0;
                    const disc = parseFloat(it.discount_percent) || 0;
                    const gst = parseFloat(it.gst_rate) || 18;
                    const baseAmt = r * (1 - disc / 100) * qty;
                    const derivedAmt = parseFloat(it.amount) || (baseAmt + baseAmt * (gst / 100));

                    let pText = (it.particulars || it.item_name || it.title || it.name || '').trim();
                    let dText = (it.hsn_sac || it.description || it.details || it.notes || it.specification || it.specs || '').trim();

                    // If pText contains newlines (multiline title + description), split into title & description
                    if (pText.includes('\n')) {
                        const parts = pText.split('\n');
                        pText = parts[0].trim();
                        if (!dText) {
                            dText = parts.slice(1).join('\n').trim();
                        }
                    }

                    const fullParticulars = pText || dText || 'Item Specification';

                    items.push({
                        ...it,
                        module_name: secName,
                        particulars: fullParticulars,
                        raw_particulars: pText || fullParticulars,
                        description: dText,
                        pricing_mode: it.pricing_mode || 'dimensions',
                        brand: it.brand || '',
                        unit: it.unit || 'SFT',
                        quantity: qty,
                        rate: r,
                        rate_per_sft: r,
                        discount_percent: disc,
                        gst_rate: gst,
                        amount: derivedAmt,
                        width: it.width || '',
                        height: it.height || '',
                        sft: it.sft || ''
                    });
                });
            });
            if (items.length > 0) return items;
        }

        return [
            { brand: 'HEADER', module_name: 'Civil & Masonry Work', particulars: 'Civil & Masonry Work', unit: '', quantity: 0, rate: 0, amount: 0 },
            { module_name: 'Civil & Masonry Work', particulars: 'Civil & Masonry Work Execution', brand: 'Standard', unit: 'SFT', quantity: 450, rate: 180, amount: 81000 },
            { brand: 'HEADER', module_name: 'Electrical Setup', particulars: 'Electrical Setup', unit: '', quantity: 0, rate: 0, amount: 0 },
            { module_name: 'Electrical Setup', particulars: 'Electrical Fixtures & Wiring Setup', brand: 'Havells', unit: 'LS', quantity: 1, rate: 46440, amount: 46440 }
        ];
    };

    const canEditVendorPrices = ['admin', 'superadmin', 'sales_manager', 'project_manager'].includes(user?.role || (user as any)?.user_type || '');

    const canCreateVendorQuotation = (() => {
        const r = String(user?.role || (user as any)?.user_type || '').toLowerCase();
        const isAdmin = ['admin', 'administrator', 'superadmin', 'management', 'owner'].includes(r) || r.includes('admin');
        const isSiteInspector = ['site_inspector', 'site_inspection', 'site_engineer', 'site_manager', 'qc'].includes(r) || r.includes('inspector') || r.includes('site_') || r.includes('site inspector');
        return isAdmin || isSiteInspector;
    })();

    const openVendorQuotaModal = async (q: any) => {
        if (!canCreateVendorQuotation) {
            alert('Access Denied: Only Admin and Site Inspector are authorized to create vendor quotations.');
            return;
        }
        setVendorQuotaSuccess('');
        setSavingVendorQuota(false);
        setCustomVendorItems({});

        let fullQuote = q;
        const qId = q.quote_id || q.id;
        try {
            if (qId && !String(qId).startsWith('lead-')) {
                const res = await axios.get(`${API_BASE_URL}/quotes/${qId}`);
                if (res.data?.success && res.data?.data) {
                    fullQuote = { ...q, ...res.data.data };
                }
            } else if (q.project_id) {
                const res = await axios.get(`${API_BASE_URL}/quotes/latest?project_id=${q.project_id}`);
                if (res.data?.success && res.data?.data) {
                    fullQuote = { ...q, ...res.data.data };
                }
            }
        } catch (e) {
            console.warn('Could not fetch detailed quote for vendor modal:', e);
        }

        setVendorQuotaModalQuote(fullQuote);

        try {
            const vRes = await axios.get(`${API_BASE_URL}/vendor-quotas`);
            if (vRes.data?.vendors && Array.isArray(vRes.data.vendors)) {
                setAvailableVendors(vRes.data.vendors);
            } else {
                const gRes = await axios.get(`${API_BASE_URL}/vendors`);
                if (gRes.data?.data && Array.isArray(gRes.data.data)) {
                    setAvailableVendors(gRes.data.data.map((vName: string) => ({ vendor_name: vName })));
                }
            }
        } catch (e) {
            console.log('Error fetching vendors for quota modal:', e);
        }

        const items = getQuoteItems(fullQuote);
        const initialMap: Record<number, string> = {};
        items.forEach((_, idx) => {
            initialMap[idx] = '';
        });
        setItemVendorAssignments(initialMap);
    };

    const handleSaveVendorQuota = async () => {
        if (!vendorQuotaModalQuote) return;

        const items = getQuoteItems(vendorQuotaModalQuote);
        const vendorMap: Record<string, any[]> = {};
        let unassignedCount = 0;

        items.forEach((item, idx) => {
            if (item.brand === 'HEADER') return;
            const vName = itemVendorAssignments[idx];
            if (vName && vName.trim() !== '') {
                if (!vendorMap[vName]) vendorMap[vName] = [];

                const baseRate = customVendorItems[idx]?.rate ?? item.rate ?? item.rate_per_sft ?? 0;
                const disc = customVendorItems[idx]?.discount_percent ?? item.discount_percent ?? 0;
                const gst = customVendorItems[idx]?.gst_rate ?? item.gst_rate ?? 18;
                const qty = customVendorItems[idx]?.quantity ?? item.quantity ?? 1;
                const width = customVendorItems[idx]?.width ?? item.width ?? '';
                const height = customVendorItems[idx]?.height ?? item.height ?? '';
                const sft = customVendorItems[idx]?.sft ?? item.sft ?? '';

                const pricingMode = customVendorItems[idx]?.pricing_mode ?? item.pricing_mode ?? (item.width || item.height || item.sft ? 'dimensions' : 'lumpsum');

                const netRate = baseRate * (1 - disc / 100);
                const baseAmt = netRate * qty;
                const gstAmt = baseAmt * (gst / 100);
                const derivedAmount = baseAmt + gstAmt;

                vendorMap[vName].push({
                    ...item,
                    pricing_mode: pricingMode,
                    particulars: customVendorItems[idx]?.particulars ?? item.particulars ?? item.raw_particulars ?? 'Item Specification',
                    description: customVendorItems[idx]?.description ?? item.description ?? '',
                    width,
                    height,
                    sft,
                    quantity: qty,
                    original_rate: item.rate || item.rate_per_sft || 0,
                    original_amount: item.amount || 0,
                    original_discount: item.discount_percent || 0,
                    original_gst: item.gst_rate || 18,
                    vendor_rate: baseRate,
                    vendor_amount: derivedAmount,
                    vendor_discount: disc,
                    vendor_gst: gst,
                    rate: baseRate,
                    amount: derivedAmount,
                    discount_percent: disc,
                    gst_rate: gst
                });
            } else {
                unassignedCount++;
            }
        });

        const assignedVendors = Object.keys(vendorMap);
        if (assignedVendors.length === 0) {
            alert('Please assign at least one item/module to a vendor before saving.');
            return;
        }

        if (unassignedCount > 0) {
            const proceed = window.confirm(`There are ${unassignedCount} unassigned item(s). Do you want to proceed and save Vendor Quotas for the assigned items only?`);
            if (!proceed) return;
        }

        setSavingVendorQuota(true);
        try {
            const projectId = vendorQuotaModalQuote.project_id || '1';

            const payloadQuotas = assignedVendors.map(vName => {
                const assignedItems = vendorMap[vName];
                const totalAmt = assignedItems.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);
                return {
                    project_id: projectId,
                    vendor_name: vName,
                    total_amount: totalAmt,
                    items_data: assignedItems,
                    notes: `Generated from Quotation #${vendorQuotaModalQuote.quote_number || vendorQuotaModalQuote.quote_id}`
                };
            });

            const res = await axios.post(`${API_BASE_URL}/vendor-quotas`, { quotas: payloadQuotas });

            if (res.data?.success) {
                setVendorQuotaSuccess(`Successfully generated vendor quotas for ${assignedVendors.length} vendor(s)! Navigating to Vendor Quota Page...`);
                setTimeout(() => {
                    setVendorQuotaModalQuote(null);
                    navigate('/vendor-quota');
                }, 1500);
            } else {
                throw new Error(res.data?.error || 'Failed to save vendor quotas');
            }
        } catch (err: any) {
            console.error('Error saving vendor quota:', err);
            alert('Failed to save vendor quota: ' + (err.response?.data?.error || err.message));
        } finally {
            setSavingVendorQuota(false);
        }
    };

    const openEmailModal = async (q: any) => {
        setCustomPdfFile(null);
        setRemovePdfAttachment(false);
        setIncludeQuotePdf(true);
        setIncludeAgreementPdf(false);
        setAvailableAgreementId(null);

        let qNum = q.quote_number || `QTN-${q.project_code || q.project_id || '101'}`;
        if (q.version && !qNum.toLowerCase().includes(`v${q.version}`)) {
            qNum = `${qNum}-v${q.version}`;
        }
        const clientName = q.client_name || q.subtitle || 'Valued Client';

        // Set emailProject
        const rawPid = String(q.project_id || '').toLowerCase().trim();
        const numPid = rawPid.replace(/\D/g, '');
        const rawPcode = String(q.project_code || '').toLowerCase().trim();
        const cleanName = (n: string) => String(n || '').toLowerCase().replace(/^(mr\.?|ms\.?|mrs\.?|miss\.?|dr\.?)\s+/i, '').replace(/[^a-z0-9]/g, '');
        const qClientClean = cleanName(clientName);

        const proj = (rawProjects || []).find((p: any) => {
            const pid = String(p.project_id || '').toLowerCase().trim();
            const pcode = String(p.project_code || '').toLowerCase().trim();
            const pname = cleanName(p.project_name || '');
            const pclient = cleanName(p.client_name || '');

            if (rawPid && (pid === rawPid || (numPid && pid === numPid))) return true;
            if (rawPcode && (pcode === rawPcode || pcode === rawPid || pid === rawPcode)) return true;
            if (rawPid && pcode === rawPid) return true;
            if (qClientClean && pclient && (pclient === qClientClean || pclient.includes(qClientClean))) return true;
            if (qClientClean && pname && (pname === qClientClean || pname.includes(qClientClean))) return true;
            return false;
        }) || {
            project_id: q.project_id || 'standalone',
            project_name: q.project_name || 'Project',
            client_name: q.client_name,
            client_email: q.client_email
        };
        setEmailProject(proj);

        // 1. Resolve client email using comprehensive helper
        let clientEmail = resolveClientEmailForQuote(q, leadsList, clientsList, rawProjects);

        // 2. If not found locally, fetch fresh leads & clients directly from API
        if (!clientEmail) {
            try {
                const [leadsRes, clientsRes] = await Promise.all([
                    axios.get(`${API_BASE_URL}/leads`).catch(() => null),
                    axios.get(`${API_BASE_URL}/clients`).catch(() => null)
                ]);
                const freshLeads = leadsRes?.data?.data || (Array.isArray(leadsRes?.data) ? leadsRes.data : []);
                const freshClients = clientsRes?.data?.data || (Array.isArray(clientsRes?.data) ? clientsRes.data : []);
                if (freshLeads.length > 0) setLeadsList(freshLeads);
                if (freshClients.length > 0) setClientsList(freshClients);

                clientEmail = resolveClientEmailForQuote(q, freshLeads, freshClients, rawProjects);
            } catch (e) { }
        }

        // 3. Fallback: if quote_id is valid, fetch quote details which resolves team & client emails on backend
        const targetQid = (q.quote_id !== undefined && q.quote_id !== null) ? q.quote_id : q.id;
        if (!clientEmail && targetQid !== undefined && targetQid !== null && !String(targetQid).startsWith('lead-')) {
            try {
                const qRes = await axios.get(`${API_BASE_URL}/quotes/${targetQid}`).catch(() => null);
                const qDetails = qRes?.data?.data || qRes?.data;
                const fetchedEmail = qDetails?.client_email || qDetails?.email || qDetails?.extra_data_parsed?.client_email;
                if (typeof fetchedEmail === 'string' && fetchedEmail.includes('@') && fetchedEmail.includes('.')) {
                    clientEmail = fetchedEmail.trim();
                }
            } catch (e) { }
        }

        // Cache found clientEmail for future opens
        if (clientEmail) {
            try {
                if (qClientClean) localStorage.setItem(`client_email_${qClientClean}`, clientEmail);
                if (rawPid) localStorage.setItem(`client_email_${rawPid}`, clientEmail);
            } catch (e) { }
        }

        const projName = q.project_name || `Project #${q.project_code || q.project_id || ''}`;
        const grossAmt = (q.sections && Array.isArray(q.sections) && q.sections.length > 0)
            ? q.sections.reduce((sum: number, s: any) => sum + (s.items || []).reduce((itemSum: number, i: any) => itemSum + (parseFloat(i.amount) || 0), 0), 0)
            : (parseFloat(q.total_amount) || 0);
        const amount = `₹${grossAmt.toLocaleString('en-IN')}`;

        setEmailForm({
            from: 'quotes@livincart.com',
            to: clientEmail,
            subject: `Official Quotation #${qNum} for ${clientName} - Livincart Interiors`,
            content: `Dear ${clientName},\n\nThank you for choosing Livincart Interiors!\n\nPlease find attached the official proposal and cost estimate for your project (${projName}).\n\nQuotation Summary:\n- Quotation Number: #${qNum}\n- Total Estimated Amount: ${amount}\n- Status: ${q.status || 'Created'}\n\nPlease review the attached PDF quotation. Feel free to contact us if you have any questions or require revisions.\n\nWarm regards,\nLivincart Interiors Team`
        });
        setEmailModalQuote(q);
        setEmailQuoteDetails(q);

        // Check if an agreement exists for this client or project and is marked as Signed
        try {
            const agRes = await axios.get(`${API_BASE_URL}/agreements`);
            const agList = agRes.data?.data || (Array.isArray(agRes.data) ? agRes.data : []);
            if (Array.isArray(agList)) {
                const cleanClientName = (name: string) => (name || '').replace(/^(mr\.?|ms\.?|mrs\.?|miss\.?|dr\.?)\s+/i, '').toLowerCase().trim();
                const qClientClean = cleanClientName(clientName);
                const qPid = q.project_id ? String(q.project_id) : null;

                const matchedAgList = agList.filter((a: any) => {
                    if (qPid && a.project_id && String(a.project_id) === qPid) return true;
                    if (qPid && a.ref_id && (String(a.ref_id).toLowerCase() === `pr_${qPid}` || String(a.ref_id).toLowerCase() === `pr-${qPid}` || String(a.ref_id).toLowerCase().includes(`pr_${qPid}`))) return true;
                    if (a.client_name && qClientClean) {
                        const aClientClean = cleanClientName(a.client_name);
                        return aClientClean === qClientClean || (aClientClean.length > 3 && qClientClean.length > 3 && (aClientClean.includes(qClientClean) || qClientClean.includes(aClientClean)));
                    }
                    return false;
                });

                // Check if any matched agreement is signed or if any global agreement for this project/client is signed
                const matchedAg = matchedAgList.find((a: any) => {
                    const st = String(a.status || '').toLowerCase().trim();
                    return st === 'signed' || st.includes('sign') || st === 'approved' || st === 'order_converted' || st === 'deal_done' || st === 'completed' || a.is_signed === 1 || a.is_signed === true;
                }) || matchedAgList[0] || agList.find((a: any) => {
                    const st = String(a.status || '').toLowerCase().trim();
                    return (st === 'signed' || st.includes('sign') || st === 'approved') && (
                        (qPid && String(a.project_id) === qPid) ||
                        (a.client_name && cleanClientName(a.client_name) === qClientClean)
                    );
                });

                let localClientSigned = false;
                try {
                    localClientSigned = localStorage.getItem(`signed_client_${qClientClean}`) === 'true' ||
                        (qPid ? localStorage.getItem(`signed_proj_${qPid}`) === 'true' : false) ||
                        localStorage.getItem('has_signed_agreement') === 'true';
                } catch (e) { }

                if (matchedAg) {
                    setAvailableAgreementId(matchedAg.id);
                    let statusLower = String(matchedAg.status || '').toLowerCase().trim();
                    try {
                        const loc = localStorage.getItem(`ag_status_${matchedAg.id}`) || localStorage.getItem(`ag_status_${matchedAg.ref_id}`);
                        if (loc) statusLower = loc.toLowerCase().trim();
                    } catch (e) { }

                    const qStatusLower = String(q.status || '').toLowerCase().trim();
                    const isSigned = statusLower === 'signed' || statusLower.includes('sign') || statusLower === 'approved' || statusLower === 'order_converted' || statusLower === 'deal_done' || statusLower === 'completed' || matchedAg.is_signed === 1 || matchedAg.is_signed === true || qStatusLower === 'signed' || qStatusLower.includes('sign') || localClientSigned;

                    if (isSigned) {
                        setIsAgreementSigned(true);
                        setIncludeAgreementPdf(true); // Auto-enable checkbox if signed!
                    } else {
                        setIsAgreementSigned(false);
                        setIncludeAgreementPdf(false); // Force uncheck if not signed
                    }
                } else {
                    const qStatusLower = String(q.status || '').toLowerCase().trim();
                    if (qStatusLower === 'signed' || qStatusLower.includes('sign') || localClientSigned) {
                        setIsAgreementSigned(true);
                        setIncludeAgreementPdf(true);
                    } else {
                        setAvailableAgreementId(null);
                        setIsAgreementSigned(false);
                        setIncludeAgreementPdf(false);
                    }
                }
            }
        } catch (err) {
            console.error('Error fetching agreements for email modal:', err);
        }

        let fullData = q;
        // targetQid already declared above
        if (targetQid !== undefined && targetQid !== null && !String(targetQid).startsWith('lead-')) {
            try {
                const res = await axios.get(`${API_BASE_URL}/quotes/${targetQid}`);
                if (res.data?.data) {
                    fullData = { ...q, ...res.data.data };
                } else if (res.data?.sections) {
                    fullData = { ...q, ...res.data };
                }

                const fullEmail = fullData.client_email || fullData.email || fullData.extra_data_parsed?.client_email || fullData.extra_data_parsed?.last_email_to;
                if (typeof fullEmail === 'string' && fullEmail.includes('@') && fullEmail.includes('.')) {
                    setEmailForm(prev => ({
                        ...prev,
                        to: prev.to && prev.to.trim() !== '' ? prev.to : fullEmail.trim()
                    }));
                }
            } catch (err) {
                console.error('Failed to fetch quote details for email PDF:', err);
            }
        }
        setEmailModalQuote(fullData);
        setEmailQuoteDetails(fullData);

        // Pre-populate email hidden fields from the quote's saved configuration if present
        let savedHf: any = {};
        if (fullData.extra_data) {
            try {
                const ed = typeof fullData.extra_data === 'string' ? JSON.parse(fullData.extra_data) : fullData.extra_data;
                savedHf = ed.hidden_fields || {};
            } catch (e) { }
        } else if (fullData.hidden_fields) {
            savedHf = fullData.hidden_fields;
        }
        setEmailHiddenFields({
            shutterMaterial: !!(savedHf.shutterMaterial || savedHf.shutter),
            carcassMaterial: !!(savedHf.carcassMaterial || savedHf.carcass),
            dimensions: !!savedHf.dimensions,
            rate: !!savedHf.rate,
            categoryDiscount: !!(savedHf.categoryDiscount || savedHf.category_discount),
            promoCode: !!(savedHf.promoCode || savedHf.coupon || savedHf.promo_code),
            generalDiscount: !!(savedHf.generalDiscount || savedHf.flatDiscount || savedHf.general_discount || savedHf.flat_discount),
            additionalCharges: !!(savedHf.additionalCharges || savedHf.additional_charges),
            gst: !!(savedHf.gst || fullData.overall_gst_line_hidden),
            roundOff: !!(savedHf.roundOff || savedHf.round_off)
        });
    };

    /**
     * generatePdfBase64 — Generates/Retrieves single or merged PDFs based on checkbox selection.
     */
    const extractSectionsFromQuote = (q: any) => {
        if (!q) return [];
        let rawSections = q.sections || q.quote_data?.sections || [];
        if ((!rawSections || rawSections.length === 0) && q.extra_data) {
            try {
                const parsed = typeof q.extra_data === 'string' ? JSON.parse(q.extra_data) : q.extra_data;
                if (parsed?.sections && Array.isArray(parsed.sections)) {
                    rawSections = parsed.sections;
                }
            } catch (e) { }
        }
        return Array.isArray(rawSections) ? rawSections : [];
    };

    const generateQuotePdfFallback = async (title: string, refId: string | number, preferElemId?: string, quoteData?: any): Promise<string> => {
        // Requirement 1: Data loading completion check & fallback fetch if sections are missing
        let dataToUse = quoteData || emailQuoteDetails || emailModalQuote;
        if (title === 'Quotation' && (!dataToUse || !dataToUse.sections || dataToUse.sections.length === 0)) {
            try {
                const cleanRef = String(refId).replace(/\D/g, '');
                if (cleanRef) {
                    const res = await axios.get(`${API_BASE_URL}/quotes/${cleanRef}`).catch(() => null);
                    if (res?.data?.data || res?.data?.sections) {
                        dataToUse = res.data.data || res.data;
                    }
                }
            } catch (e) { }
        }

        let elem = (preferElemId ? document.getElementById(preferElemId) : null) ||
            document.getElementById('printable-container') ||
            document.querySelector('.print-version') ||
            document.querySelector('.quote-tab-container') ||
            document.querySelector('.contract-container') ||
            document.querySelector('.agreement-print-container');

        const isElemValid = elem && elem.innerHTML && elem.innerHTML.trim().length > 500;

        let createdTemp = false;
        if (title === 'Quotation' || !isElemValid) {
            createdTemp = true;
            const tempDiv = document.createElement('div');
            tempDiv.style.position = 'fixed';
            tempDiv.style.left = '0';
            tempDiv.style.top = '0';
            tempDiv.style.zIndex = '9999999';
            tempDiv.style.width = '794px';
            tempDiv.style.padding = '35px';
            tempDiv.style.backgroundColor = '#ffffff';
            tempDiv.style.color = '#0f172a';
            tempDiv.style.fontFamily = "'Inter', 'Segoe UI', Arial, sans-serif";
            tempDiv.style.boxSizing = 'border-box';
            tempDiv.style.visibility = 'visible';
            tempDiv.style.opacity = '1';
            tempDiv.style.pointerEvents = 'none';

            const clientName = dataToUse?.client_name || dataToUse?.subtitle || 'Valued Client';
            const rawAmt = parseFloat(dataToUse?.total_amount || 0);
            const grandTotalStr = rawAmt > 0 ? rawAmt.toLocaleString('en-IN') : '0';
            const execDate = new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
            if (title === 'Quotation') {
                tempDiv.innerHTML = buildOfficial4PageHtml(dataToUse, emailHiddenFields);
            } else if (title.includes('Agreement') || title.includes('Contract')) {
                tempDiv.innerHTML = `
                    <div style="border-bottom: 3px solid #0c1527; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center;">
                        <div style="display: flex; align-items: center; gap: 14px;">
                            <img src="${LOGO_BASE64}" alt="Livincart Logo" style="height: 52px; max-width: 190px; object-fit: contain;" />
                            <div>
                                <h1 style="color: #0c1527; font-size: 22px; font-weight: 900; margin: 0;">LIVINCART ARCHITECTS & INTERIORS</h1>
                                <p style="color: #64748b; font-size: 12px; margin: 3px 0 0 0; font-weight: 500;">Works Contract Agreement — Ref #${refId}</p>
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <span style="background-color: #0c1527; color: #ffffff; padding: 6px 14px; border-radius: 6px; font-weight: 800; font-size: 12px;">LEGAL AGREEMENT</span>
                        </div>
                    </div>

                    <div style="margin-bottom: 24px; padding: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 13px; color: #334155; display: flex; justify-content: space-between;">
                        <div>
                            <p style="margin: 0 0 6px 0;"><strong>Client Name:</strong> ${clientName}</p>
                            <p style="margin: 0;"><strong>Agreement Ref:</strong> #${refId}</p>
                        </div>
                        <div style="text-align: right;">
                            <p style="margin: 0 0 6px 0;"><strong>Execution Date:</strong> ${execDate}</p>
                            <p style="margin: 0;"><strong>Total Contract Value:</strong> ₹${grandTotalStr}</p>
                        </div>
                    </div>

                    <h3 style="color: #0c1527; font-size: 14px; font-weight: 800; margin: 0 0 12px 0; text-transform: uppercase;">1. Payment Schedule & Milestones</h3>
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; border: 1px solid #e2e8f0; font-size: 12px;">
                        <thead>
                            <tr style="background-color: #0c1527; color: #ffffff;">
                                <th style="padding: 10px; text-align: left;">Stage</th>
                                <th style="padding: 10px; text-align: left;">Payment Milestone Particulars</th>
                                <th style="padding: 10px; text-align: right; width: 100px;">Percentage</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr><td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">Stage 1</td><td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">Booking Advance / Sign Off</td><td style="padding: 10px; text-align: right; border-bottom: 1px solid #e2e8f0;">10%</td></tr>
                            <tr><td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">Stage 2</td><td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">Factory Production Approval</td><td style="padding: 10px; text-align: right; border-bottom: 1px solid #e2e8f0;">40%</td></tr>
                            <tr><td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">Stage 3</td><td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">Material Dispatch to Site</td><td style="padding: 10px; text-align: right; border-bottom: 1px solid #e2e8f0;">45%</td></tr>
                            <tr><td style="padding: 10px;">Stage 4</td><td style="padding: 10px;">Final Installation & Handover</td><td style="padding: 10px; text-align: right;">5%</td></tr>
                        </tbody>
                    </table>

                    <h3 style="color: #0c1527; font-size: 14px; font-weight: 800; margin: 0 0 12px 0; text-transform: uppercase;">2. General Terms & Conditions</h3>
                    <ul style="font-size: 12px; color: #475569; line-height: 1.6; padding-left: 20px; margin-bottom: 30px;">
                        <li>All interior work shall be executed strictly as per approved 2D/3D design specifications.</li>
                        <li>Material delivery timelines start post site confirmation and 50% cumulative payment receipt.</li>
                        <li>Any additional work requested beyond the initial proposal scope shall be billed separately.</li>
                        <li>Warranty applies to factory manufacturing defects under standard operating conditions.</li>
                    </ul>

                    <div style="display: flex; justify-content: space-between; margin-top: 40px; border-top: 1px solid #cbd5e1; padding-top: 20px;">
                        <div>
                            <p style="margin: 0; font-size: 12px; font-weight: 700; color: #0c1527;">Client Signature</p>
                            <div style="height: 45px;"></div>
                            <p style="margin: 0; font-size: 11px; color: #64748b;">${clientName}</p>
                        </div>
                        <div style="text-align: right;">
                            <p style="margin: 0; font-size: 12px; font-weight: 700; color: #0c1527;">Authorized Signatory</p>
                            <div style="height: 45px;"></div>
                            <p style="margin: 0; font-size: 11px; color: #64748b;">Livincart Architects & Interiors</p>
                        </div>
                    </div>
                `;
            } else {
                // Handover Terms & Guidelines
                tempDiv.innerHTML = `
                    <div style="border-bottom: 3px solid #0c1527; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center;">
                        <div style="display: flex; align-items: center; gap: 14px;">
                            <img src="${LOGO_BASE64}" alt="Livincart Logo" style="height: 52px; max-width: 190px; object-fit: contain;" />
                            <div>
                                <h1 style="color: #0c1527; font-size: 22px; font-weight: 900; margin: 0;">LIVINCART ARCHITECTS & INTERIORS</h1>
                                <p style="color: #64748b; font-size: 12px; margin: 3px 0 0 0; font-weight: 500;">Handover Terms & Guidelines — Ref #${refId}</p>
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <span style="background-color: #0c1527; color: #ffffff; padding: 6px 14px; border-radius: 6px; font-weight: 800; font-size: 12px;">HANDOVER DOC</span>
                        </div>
                    </div>

                    <div style="margin-bottom: 24px; padding: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 13px; color: #334155; display: flex; justify-content: space-between;">
                        <div>
                            <p style="margin: 0 0 6px 0;"><strong>Client Name:</strong> ${clientName}</p>
                            <p style="margin: 0;"><strong>Project Ref:</strong> #${refId}</p>
                        </div>
                        <div style="text-align: right;">
                            <p style="margin: 0 0 6px 0;"><strong>Handover Date:</strong> ${execDate}</p>
                            <p style="margin: 0;"><strong>Status:</strong> Final Site Handover</p>
                        </div>
                    </div>

                    <h3 style="color: #0c1527; font-size: 14px; font-weight: 800; margin: 0 0 12px 0; text-transform: uppercase;">Handover Checklist & Maintenance Guidelines</h3>
                    <div style="padding: 18px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 12px; color: #334155; line-height: 1.6; margin-bottom: 30px;">
                        <p style="margin: 0 0 10px 0;"><strong>1. Inspection & Acceptance:</strong> The site has been inspected jointly by Livincart Project Manager and the Client. All installed joinery, finishes, and fixtures are handed over in prime condition.</p>
                        <p style="margin: 0 0 10px 0;"><strong>2. Care & Maintenance:</strong> Clean laminate surfaces using soft micro-fiber cloths. Avoid abrasive chemicals or direct water contact on engineered wood edges.</p>
                        <p style="margin: 0;"><strong>3. Hardware Warranty:</strong> Soft-close hinges and drawer channels carry manufacturer brand warranties. Contact Livincart support for service assistance.</p>
                    </div>

                    <div style="display: flex; justify-content: space-between; margin-top: 40px; border-top: 1px solid #cbd5e1; padding-top: 20px;">
                        <div>
                            <p style="margin: 0; font-size: 12px; font-weight: 700; color: #0c1527;">Client Acceptance Signature</p>
                            <div style="height: 45px;"></div>
                            <p style="margin: 0; font-size: 11px; color: #64748b;">${clientName}</p>
                        </div>
                        <div style="text-align: right;">
                            <p style="margin: 0; font-size: 12px; font-weight: 700; color: #0c1527;">Project Manager Signature</p>
                            <div style="height: 45px;"></div>
                            <p style="margin: 0; font-size: 11px; color: #64748b;">Livincart Site Execution Team</p>
                        </div>
                    </div>
                `;
            }
            document.body.appendChild(tempDiv);
            elem = tempDiv;
        }

        const htmlContent = elem?.innerHTML || '';
        console.log(`🔍 [PDF CAPTURE] Title: "${title}", Ref: #${refId}`);
        console.log(`📊 [PDF CAPTURE] Target Element ID: "${elem?.id || 'tempDiv'}", innerHTML.length: ${htmlContent.length}`);
        console.log(`📝 [PDF CAPTURE] Snippet (first 300 chars):\n${htmlContent.substring(0, 300)}`);

        try {
            // Requirement 3: Ensure all web fonts and images are 100% loaded into memory before html2canvas capture starts
            if ((document as any).fonts && (document as any).fonts.ready) {
                await (document as any).fonts.ready;
            }
            await new Promise(resolve => setTimeout(resolve, 250));

            const opt: any = {
                margin: 6,
                filename: `${title}_${refId}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, logging: false, scrollX: 0, scrollY: 0 },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };
            const pdfBase64 = await html2pdf().set(opt).from(elem).outputPdf('datauristring');
            if (createdTemp && elem && elem.parentNode) {
                elem.parentNode.removeChild(elem);
            }
            return pdfBase64 || '';
        } catch (err) {
            if (createdTemp && elem && elem.parentNode) {
                elem.parentNode.removeChild(elem);
            }
            console.error('Fallback PDF generation error:', err);
            return '';
        }
    };

    const generatePdfBase64 = async (): Promise<string> => {
        const quoteId = emailModalQuote?.quote_id || emailModalQuote?.id || emailQuoteDetails?.quote_id || emailQuoteDetails?.id;
        const pdfsToMerge: string[] = [];

        // 1. Fetch Quote PDF first if selected (Order 1: Quotation PDF)
        if (includeQuotePdf) {
            if (!quoteId || String(quoteId).startsWith('lead-')) {
                alert('Cannot generate Quote PDF: this quote has not been saved yet.');
                return '';
            }
            try {
                const response = await axios.post(`${API_BASE_URL}/pdf/for-email`, {
                    quote_id: quoteId,
                    project_id: emailProject?.project_id
                });
                if (response.data?.success && response.data?.pdf_base64 && response.data.pdf_base64.length > 25000) {
                    pdfsToMerge.push(response.data.pdf_base64);
                } else {
                    console.log('[PDF Fallback] Backend PDF snapshot missing or legacy receipt (<25KB), generating full 4-page official quotation snapshot...');
                    const fallbackPdf = await generateQuotePdfFallback('Quotation', quoteId, 'printable-container', emailQuoteDetails || emailModalQuote);
                    if (fallbackPdf) {
                        pdfsToMerge.push(fallbackPdf);
                        axios.post(`${API_BASE_URL}/pdf/upload-snapshot`, { type: 'quote', id: quoteId, pdf_base64: fallbackPdf }).catch(() => { });
                    }
                }
            } catch (err: any) {
                console.log('[PDF Fallback] Network error calling PDF endpoint, generating fallback PDF...');
                const fallbackPdf = await generateQuotePdfFallback('Quotation', quoteId, 'printable-container', emailQuoteDetails || emailModalQuote);
                if (fallbackPdf) pdfsToMerge.push(fallbackPdf);
            }
        }

        // 2. Fetch Agreement PDF second if selected (Order 2: Agreement PDF)
        if (includeAgreementPdf) {
            const pId = emailProject?.project_id || emailModalQuote?.project_id;
            const qId = emailModalQuote?.quote_id;
            const cName = emailModalQuote?.subtitle || emailModalQuote?.client_name || emailProject?.client_name || emailProject?.customer_name;

            let matchingAgId: any = null;
            if (pId || qId || cName) {
                try {
                    const agListRes = await axios.get(`${API_BASE_URL}/agreements`);
                    if (agListRes.data?.data && Array.isArray(agListRes.data.data)) {
                        const matchAg = agListRes.data.data.find((a: any) => {
                            if (pId && (String(a.project_id) === String(pId) || String(a.ref_id) === String(pId))) return true;
                            if (qId && String(a.quote_id) === String(qId)) return true;
                            if (cName && a.client_name && String(a.client_name).toLowerCase().includes(String(cName).toLowerCase())) return true;
                            return false;
                        });
                        if (matchAg) matchingAgId = matchAg.id;
                    }
                } catch (e) { }
            }

            let agPdfAdded = false;
            if (matchingAgId) {
                try {
                    const agRes = await axios.post(`${API_BASE_URL}/pdf/agreement-for-email`, { agreement_id: matchingAgId });
                    if (agRes.data?.success && agRes.data?.pdf_base64) {
                        pdfsToMerge.push(agRes.data.pdf_base64);
                        agPdfAdded = true;
                    }
                } catch (err: any) { }
            }

            if (!agPdfAdded) {
                console.log('[PDF Fallback] Generating matching Agreement PDF snapshot for Quote:', cName);
                const fallbackPdf = await generateQuotePdfFallback('Agreement', quoteId, 'agreement-print-container', {
                    client_name: cName || 'Valued Client',
                    total_amount: emailModalQuote?.total_amount || 0,
                    contract_value: emailModalQuote?.total_amount ? parseFloat(emailModalQuote.total_amount).toLocaleString('en-IN') : '0',
                    ref_id: emailModalQuote?.quote_number || `QT-${quoteId}`
                });
                if (fallbackPdf) {
                    pdfsToMerge.push(fallbackPdf);
                    agPdfAdded = true;
                }
            }

            // ENFORCE USER REQUIREMENT (b): Visible warning if Agreement PDF fails to attach when includeAgreementPdf is selected
            if (includeAgreementPdf && !agPdfAdded) {
                alert(
                    `⚠️ WARNING: Agreement PDF missing!\n\n` +
                    `The option "Include Agreement PDF" was selected, but no matching saved Agreement PDF was found for this quotation.\n\n` +
                    `Email transmission HAS BEEN STOPPED to prevent sending an incomplete package to the client without the Agreement contract.\n\n` +
                    `Please create/save an Agreement contract for this project in /agreements first.`
                );
                return '';
            }
        }

        if (pdfsToMerge.length === 0) {
            alert('Please select at least one document to include in the email.');
            return '';
        }

        // 3. Return single PDF if only 1 is selected
        if (pdfsToMerge.length === 1) {
            return pdfsToMerge[0];
        }

        // 4. Merge multiple PDFs if multiple are selected using client-side pdf-lib
        console.log(`[PDF MERGE] Merging ${pdfsToMerge.length} PDFs via client-side pdf-lib...`);
        try {
            return await mergePdfBase64Array(pdfsToMerge);
        } catch (mergeErr: any) {
            console.error('[PDF MERGE] Multi-PDF Merge Error:', mergeErr);
            alert(`PDF Package Merge Error: ${mergeErr?.message || mergeErr}`);
            return pdfsToMerge[0] || '';
        }
    };

    const handlePreviewPdfInBrowser = async () => {
        setGeneratingPreview(true);
        const pdfWin = window.open('', '_blank');
        if (pdfWin) {
            pdfWin.document.write(`
                <!DOCTYPE html>
                <html>
                <head><title>Loading PDF Preview...</title></head>
                <body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#0f172a;color:#fff;">
                    <div style="text-align:center;">
                        <h2 style="margin-bottom:8px;">Generating PDF Preview...</h2>
                        <p style="opacity:0.7;margin:0;">Please wait a moment.</p>
                    </div>
                </body>
                </html>
            `);
        }
        try {
            const pdfDataUri = await generatePdfBase64();
            if (!pdfDataUri) {
                if (pdfWin) pdfWin.close();
                return;
            }
            if (pdfWin) {
                pdfWin.document.open();
                pdfWin.document.write(`
                    <!DOCTYPE html>
                    <html>
                    <head><title>Quotation PDF Preview</title></head>
                    <body style="margin:0;padding:0;overflow:hidden;background:#525659;">
                        <iframe src="${pdfDataUri}" width="100%" height="100%" style="border:none;position:absolute;top:0;left:0;right:0;bottom:0;"></iframe>
                    </body>
                    </html>
                `);
                pdfWin.document.close();
            }
        } catch (err) {
            if (pdfWin) pdfWin.close();
            console.error('Error opening PDF preview:', err);
            alert('Failed to generate PDF preview.');
        } finally {
            setGeneratingPreview(false);
        }
    };

    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
        });
    };

    const handleSendQuoteEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!emailForm.to.trim()) {
            alert('Please enter client email address');
            return;
        }
        setSendingEmail(true);

        try {
            let dataToUse = emailQuoteDetails || emailModalQuote;
            const targetQid = emailModalQuote?.quote_id ?? emailModalQuote?.id ?? emailQuoteDetails?.quote_id ?? emailQuoteDetails?.id ?? dataToUse?.quote_id ?? dataToUse?.id;
            if (targetQid !== undefined && targetQid !== null && (!dataToUse?.sections || dataToUse.sections.length === 0) && !String(targetQid).startsWith('lead-')) {
                try {
                    const res = await axios.get(`${API_BASE_URL}/quotes/${targetQid}`);
                    if (res.data?.data) {
                        dataToUse = { ...dataToUse, ...res.data.data };
                        setEmailQuoteDetails(dataToUse);
                    } else if (res.data?.sections) {
                        dataToUse = { ...dataToUse, ...res.data };
                        setEmailQuoteDetails(dataToUse);
                    }
                } catch (e) { }
            }

            let pdfBase64 = '';
            if (customPdfFile) {
                pdfBase64 = await fileToBase64(customPdfFile);
            } else {
                pdfBase64 = await generatePdfBase64();
            }

            const full4PageHtml = buildOfficial4PageHtml(dataToUse, emailHiddenFields);

            const resolvedQuoteId = targetQid || 0;
            const resolvedQuoteNumber = emailModalQuote?.quote_number || emailQuoteDetails?.quote_number || dataToUse?.quote_number || '';

            let parsedEmailExtra: any = {};
            if (dataToUse?.extra_data) {
                try {
                    parsedEmailExtra = typeof dataToUse.extra_data === 'string' ? JSON.parse(dataToUse.extra_data) : dataToUse.extra_data;
                } catch (e) { }
            }
            if (!parsedEmailExtra && dataToUse?.extra_data_parsed) {
                parsedEmailExtra = dataToUse.extra_data_parsed;
            }

            let emailCustomHeadings = dataToUse?.custom_headings ?? parsedEmailExtra?.custom_headings ?? null;
            if (typeof emailCustomHeadings === 'string') {
                try { emailCustomHeadings = JSON.parse(emailCustomHeadings); } catch (e) { }
            }
            let emailSectionHeadings = dataToUse?.section_headings ?? parsedEmailExtra?.section_headings ?? null;
            if (typeof emailSectionHeadings === 'string') {
                try { emailSectionHeadings = JSON.parse(emailSectionHeadings); } catch (e) { }
            }

            const emailCatDisc = dataToUse?.category_discounts || dataToUse?.categoryDiscounts || parsedEmailExtra?.category_discounts || parsedEmailExtra?.categoryDiscounts || null;
            const emailGlobalDisc = dataToUse?.global_discount || dataToUse?.globalDiscount || parsedEmailExtra?.global_discount || parsedEmailExtra?.globalDiscount || null;
            const emailGenDisc = dataToUse?.general_discount || dataToUse?.generalDiscount || parsedEmailExtra?.general_discount || parsedEmailExtra?.generalDiscount || null;

            let emailFlatDisc: any = dataToUse?.flat_discount ?? dataToUse?.flatDiscount ?? parsedEmailExtra?.flat_discount ?? parsedEmailExtra?.flatDiscount ?? null;
            if (emailFlatDisc === null || emailFlatDisc === undefined || emailFlatDisc === '') {
                if (emailGenDisc && typeof emailGenDisc === 'object') {
                    emailFlatDisc = emailGenDisc.amount ?? emailGenDisc.value ?? null;
                } else if (typeof emailGenDisc === 'number') {
                    emailFlatDisc = emailGenDisc;
                }
            }
            if (emailFlatDisc && typeof emailFlatDisc === 'object') {
                emailFlatDisc = emailFlatDisc.amount ?? emailFlatDisc.value ?? 0;
            }
            if (emailFlatDisc !== null && emailFlatDisc !== undefined) {
                emailFlatDisc = parseFloat(emailFlatDisc) || 0;
            }

            let emailAppliedCoupon = dataToUse?.applied_coupon || dataToUse?.appliedCoupon || dataToUse?.coupon || dataToUse?.promo_code || parsedEmailExtra?.applied_coupon || parsedEmailExtra?.appliedCoupon || parsedEmailExtra?.coupon || parsedEmailExtra?.promo_code || null;
            if (typeof emailAppliedCoupon === 'string' && emailAppliedCoupon.startsWith('{')) {
                try { emailAppliedCoupon = JSON.parse(emailAppliedCoupon); } catch (e) { }
            }

            let emailAddCharges = dataToUse?.additional_charges || dataToUse?.additionalCharges || parsedEmailExtra?.additional_charges || parsedEmailExtra?.additionalCharges || null;
            if (typeof emailAddCharges === 'string' && emailAddCharges.startsWith('{')) {
                try { emailAddCharges = JSON.parse(emailAddCharges); } catch (e) { }
            }
            if (emailAddCharges && typeof emailAddCharges === 'object' && typeof emailAddCharges.amount === 'object') {
                emailAddCharges = {
                    ...emailAddCharges,
                    amount: parseFloat(emailAddCharges.amount?.amount || emailAddCharges.amount?.value || 0) || 0
                };
            } else if (emailAddCharges && typeof emailAddCharges !== 'object') {
                emailAddCharges = { amount: parseFloat(emailAddCharges) || 0, withGst: false, gstRate: 0 };
            }

            const emailTerms = dataToUse?.terms_list || dataToUse?.terms || parsedEmailExtra?.terms_list || parsedEmailExtra?.terms || null;

            const response = await axios.post(`${API_BASE_URL}/quotes/send-email`, {
                ...emailForm,
                quote_id: resolvedQuoteId,
                quote_number: resolvedQuoteNumber,
                quote_data: dataToUse,
                lead_id: dataToUse?.lead_id || emailModalQuote?.lead_id || null,
                project_id: dataToUse?.project_id || emailModalQuote?.project_id || null,
                client_name: dataToUse?.client_name || emailModalQuote?.client_name || emailModalQuote?.subtitle || null,
                manual_client_id: dataToUse?.manual_client_id || dataToUse?.project_code || emailModalQuote?.project_code || null,
                sections: dataToUse?.sections || [],
                custom_headings: emailCustomHeadings,
                section_headings: emailSectionHeadings,
                category_discounts: emailCatDisc,
                global_discount: emailGlobalDisc,
                general_discount: emailGenDisc,
                flat_discount: emailFlatDisc,
                applied_coupon: emailAppliedCoupon,
                additional_charges: emailAddCharges,
                overall_gst_enabled: dataToUse?.overall_gst_enabled ?? parsedEmailExtra?.overall_gst_enabled ?? true,
                overall_gst_line_hidden: dataToUse?.overall_gst_line_hidden ?? parsedEmailExtra?.overall_gst_line_hidden ?? false,
                overall_gst_rate: dataToUse?.overall_gst_rate ?? parsedEmailExtra?.overall_gst_rate ?? 18,
                round_off_enabled: dataToUse?.round_off_enabled ?? parsedEmailExtra?.round_off_enabled ?? true,
                pdf_base64: (pdfBase64 && pdfBase64.length > 25000) ? pdfBase64 : '',
                pdf_html: full4PageHtml,
                hidden_fields: emailHiddenFields,
                terms_list: emailTerms,
                terms: emailTerms
            });
            if (response.data.success || response.data.status === 'success') {
                alert(response.data.message || `Official Saved Quotation PDF & proposal email sent successfully to ${emailForm.to}!`);
                setEmailModalQuote(null);
                setEmailProject(null);
                setEmailQuoteDetails(null);
                setCustomPdfFile(null);
                await fetchQuotesAndProjects();
            } else {
                alert(response.data.message || 'Failed to send email');
            }
        } catch (err: any) {
            console.error('Error sending quote email:', err);
            const errMsg = err.response?.data?.message || err.message || 'Failed to send email';
            alert(`Failed to send quotation proposal email: ${errMsg}`);
        } finally {
            setSendingEmail(false);
        }
    };

    const handlePrintOfficialQuote = async () => {
        let dataToUse = emailQuoteDetails || emailModalQuote;
        if (!dataToUse?.sections || dataToUse.sections.length === 0) {
            const qid = emailModalQuote?.quote_id || emailModalQuote?.id;
            if (qid) {
                try {
                    const res = await axios.get(`${API_BASE_URL}/quotes/${qid}`);
                    if (res.data?.data || res.data?.sections) {
                        dataToUse = res.data.data || res.data;
                    }
                } catch (e) { }
            }
        }
        const html = buildOfficial4PageHtml(dataToUse, emailHiddenFields);
        const printWin = window.open('', '_blank');
        if (printWin) {
            printWin.document.open();
            printWin.document.write(html);
            printWin.document.close();
            printWin.focus();
            setTimeout(() => {
                printWin.print();
            }, 500);
        }
    };

    useEffect(() => {
        fetchQuotesAndProjects();
    }, []);

    const fetchQuotesAndProjects = async () => {
        setLoading(true);
        try {
            const uidParam = effectiveUser?.user_id || effectiveUser?.id || '';
            const uRoleParam = effectiveUser?.role || '';
            const quotesUrl = uidParam ? `${API_BASE_URL}/quotes?user_id=${uidParam}&role=${uRoleParam}` : `${API_BASE_URL}/quotes`;

            const [quotesRes, projectsRes, leadsRes, finRes, usersRes, clientsRes] = await Promise.all([
                axios.get(quotesUrl, {
                    headers: {
                        'x-user-id': uidParam,
                        'x-user-role': uRoleParam
                    }
                }),
                axios.get(`${API_BASE_URL}/projects`),
                axios.get(`${API_BASE_URL}/leads`).catch(() => ({ data: { data: [] } })),
                axios.get(`${API_BASE_URL}/finance`).catch(() => ({ data: { data: [] } })),
                axios.get(`${API_BASE_URL}/users`).catch(() => ({ data: { data: [] } })),
                axios.get(`${API_BASE_URL}/clients`).catch(() => ({ data: { data: [] } }))
            ]);

            const quotesData = quotesRes.data?.data || (Array.isArray(quotesRes.data) ? quotesRes.data : []);
            const projectsData = projectsRes.data?.data || (Array.isArray(projectsRes.data) ? projectsRes.data : []);
            const leadsData = leadsRes.data?.data || (Array.isArray(leadsRes.data) ? leadsRes.data : []);
            const finData = finRes.data?.data || (Array.isArray(finRes.data) ? finRes.data : []);
            const usersData = usersRes.data?.data || (Array.isArray(usersRes.data) ? usersRes.data : []);
            const clientsData = clientsRes.data?.data || (Array.isArray(clientsRes.data) ? clientsRes.data : []);

            setRawProjects(Array.isArray(projectsData) ? projectsData : []);
            setRawQuotes(Array.isArray(quotesData) ? quotesData : []);
            setLeadsList(Array.isArray(leadsData) ? leadsData : []);
            setFinanceTransactions(Array.isArray(finData) ? finData : []);
            setUsersList(Array.isArray(usersData) ? usersData : []);
            setClientsList(Array.isArray(clientsData) ? clientsData : []);
        } catch (err) {
            console.error('Failed to load quotes data', err);
        } finally {
            setLoading(false);
        }
    };

    // Helper: Check if Stage 1 Advance (10% Token Advance) is paid/recorded for a given quote
    const isStage1AdvancePaidForQuote = useCallback((q: any): boolean => {
        const rawPid = String(q.project_id || '').toLowerCase().trim();
        const numPid = rawPid.replace(/\D/g, '');
        const rawPcode = String(q.project_code || '').toLowerCase().trim();
        const clientName = String(q.client_name || q.subtitle || '').toLowerCase().trim();
        const isGenericName = !clientName || ['client', 'customer', 'valued client', 'valuedclient', 'none', 'client quotation', 'new client'].includes(clientName);

        // 1. Check all matching projects in rawProjects
        const matchingProjs = rawProjects.filter((p: any) => {
            const pId = String(p.project_id || '').toLowerCase().trim();
            const pCode = String(p.project_code || '').toLowerCase().trim();
            const pClient = String(p.client_name || p.project_name || '').toLowerCase().trim();

            const codeMatch = rawPcode && pCode && rawPcode.length >= 4 && pCode.length >= 4 && rawPcode === pCode;
            const idMatch = rawPid && pId && rawPid !== '0' && pId !== '0' && (pId === rawPid || (numPid && pId === numPid && !q.lead_id));
            const clientMatch = !isGenericName && clientName.length > 3 && pClient && pClient === clientName;

            return codeMatch || (idMatch && (codeMatch || clientMatch || !q.lead_id));
        });

        // 2. Check matched lead in leadsList
        const matchedLead = leadsList.find((l: any) => {
            const lid = String(l.lead_id || '').toLowerCase().trim();
            const manualId = String(l.manual_client_id || '').toLowerCase().trim();
            const lName = String(l.client_name || '').toLowerCase().trim();

            const leadIdMatch = (q.lead_id && String(q.lead_id) === lid) ||
                (numPid && numPid !== '0' && lid === numPid && (rawPcode.includes('pr-') || !q.project_code));
            const manualIdMatch = manualId && rawPcode && manualId.length >= 4 && rawPcode === manualId;
            const nameMatch = !isGenericName && clientName.length > 3 && lName && lName === clientName;

            return leadIdMatch || manualIdMatch || nameMatch;
        });

        // 3. Check finance transactions
        const matchingTx = financeTransactions.filter((t: any) => {
            if (String(t.type || '').toLowerCase() !== 'credit') return false;
            const tPid = String(t.project_id || '').toLowerCase().trim();
            const tPCode = String(t.project_code || '').toLowerCase().trim();
            const tDesc = String(t.description || '').toLowerCase();
            const tCat = String(t.category || '').toLowerCase();

            const pidMatch = (rawPid && rawPid !== '0' && (tPid === rawPid || (numPid && numPid !== '0' && tPid === numPid))) ||
                (rawPcode && rawPcode.length >= 4 && (tPid === rawPcode || tPCode === rawPcode || tDesc.includes(rawPcode))) ||
                (!isGenericName && clientName.length > 3 && tDesc.includes(clientName));

            return pidMatch || (tCat.includes('stage 1') && ((rawPid && rawPid !== '0' && tPid === rawPid) || (rawPcode && rawPcode.length >= 4 && tDesc.includes(rawPcode))));
        });

        const totalTxPaid = matchingTx.reduce((sum: number, t: any) => sum + (parseFloat(t.amount) || 0), 0);
        const projAdv = Math.max(0, ...matchingProjs.map((p: any) => Math.max(parseFloat(String(p.advance_paid || 0)) || 0, parseFloat(String(p.advance_received || 0)) || 0)));
        const leadAdv = Math.max(parseFloat(String(matchedLead?.advance_paid || 0)) || 0, parseFloat(String(matchedLead?.advance_received || 0)) || 0);
        const effectivePaid = Math.max(totalTxPaid, projAdv, leadAdv);

        // If quotation was rejected by client or not yet accepted, Stage 1 advance cannot be satisfied
        const isClientAccepted = q.ack_status === 'accepted' || q.status === 'approved' || q.status === 'order_converted';
        const isClientRejected = Boolean(
            q.ack_status === 'rejected' ||
            q.status === 'order_lost' ||
            q.status === 'rejected' ||
            (q as any).is_rejected === 1
        );
        if (isClientRejected || !isClientAccepted) {
            return false;
        }

        // Check if this specific lead or project is already officially converted
        const isOfficiallyConvertedLead = Boolean(
            matchedLead && (
                matchedLead.is_converted === 1 ||
                matchedLead.is_converted === true ||
                matchedLead.is_converted === '1' ||
                matchedLead.status === 'won' ||
                matchedLead.status === 'converted' ||
                matchedLead.d1_status === 'won' ||
                matchedLead.d1_status === 'converted'
            )
        );
        const isOfficiallyConvertedProj = matchingProjs.some((p: any) =>
            p.status && ['designing phase', 'execution', 'site in progress', 'completed', 'won', 'converted', 'order_converted', 'project_started'].includes(String(p.status).toLowerCase().trim())
        );

        if (isOfficiallyConvertedLead || isOfficiallyConvertedProj) {
            return true;
        }

        // Strict Check: If no money/payment was received at all, Stage 1 advance cannot be satisfied
        if (effectivePaid <= 0) {
            return false;
        }

        const quoteTotal = (q.sections && Array.isArray(q.sections) && q.sections.length > 0)
            ? q.sections.reduce((sum: number, s: any) => sum + (s.items || []).reduce((itemSum: number, i: any) => itemSum + (parseFloat(i.amount) || 0), 0), 0)
            : (parseFloat(q.total_amount) || 0);

        const projBudget = Math.max(0, ...matchingProjs.map((p: any) => parseFloat(p.total_budget || p.budget || 0)));
        const projInitialQuote = Math.max(0, ...matchingProjs.map((p: any) => parseFloat(p.initial_quote_amount || 0)));
        const leadInitialQuote = parseFloat(matchedLead?.initial_quote_amount || 0);
        const leadBudget = parseFloat(matchedLead?.total_budget || matchedLead?.estimated_budget || 0);

        // Target budget priority: Initial Quotation > Lead Budget > Project Budget > Current Quote Total
        const targetBudget = (leadInitialQuote > 0)
            ? leadInitialQuote
            : (projInitialQuote > 0
                ? projInitialQuote
                : (leadBudget > 0
                    ? leadBudget
                    : (projBudget > 0 ? projBudget : quoteTotal)));

        if (targetBudget > 0) {
            const target10 = targetBudget * 0.10;
            return effectivePaid >= (target10 - 1);
        }

        return effectivePaid > 0;
    }, [rawProjects, leadsList, financeTransactions]);

    // Helper: Determine effective status for quotes table, ensuring Order Converted strictly requires Stage 1 Advance payment
    const getEffectiveQuoteStatus = useCallback((q: any): string => {
        const rawStatus = String(q.status || 'booked').toLowerCase().trim();
        const ackStatus = String(q.ack_status || '').toLowerCase().trim();

        const rawPid = String(q.project_id || '').toLowerCase().trim();
        const numPid = rawPid.replace(/\D/g, '');
        const rawPcode = String(q.project_code || '').toLowerCase().trim();
        const clientName = String(q.client_name || q.subtitle || '').toLowerCase().trim();
        const isGenericName = !clientName || ['client', 'customer', 'valued client', 'valuedclient', 'none', 'client quotation', 'new client'].includes(clientName);

        // Helper: Check if another quote is genuinely for the same project/lead
        const isSameProjectQuote = (otherQ: any): boolean => {
            if (!otherQ || otherQ === q || String(otherQ.quote_id) === String(q.quote_id)) return false;
            const oPid = String(otherQ.project_id || '').toLowerCase().trim();
            const oNumPid = oPid.replace(/\D/g, '');
            const oPcode = String(otherQ.project_code || '').toLowerCase().trim();
            const oClient = String(otherQ.client_name || otherQ.subtitle || '').toLowerCase().trim();

            const codeMatch = rawPcode && oPcode && rawPcode.length >= 4 && oPcode.length >= 4 && rawPcode === oPcode;
            const idMatch = rawPid && oPid && rawPid !== '0' && oPid !== '0' && (rawPid === oPid || (numPid && oNumPid && numPid === oNumPid));
            const nameMatch = !isGenericName && clientName.length > 3 && oClient && oClient === clientName;

            return codeMatch || (idMatch && (codeMatch || nameMatch));
        };

        // 1. Check if client has rejected this quotation or any quote for this project
        const hasAnyRejectedForProject = rawQuotes.some((otherQ: any) => {
            if (!isSameProjectQuote(otherQ)) return false;
            return String(otherQ.ack_status || '').toLowerCase() === 'rejected' ||
                String(otherQ.status || '').toLowerCase() === 'order_lost' ||
                String(otherQ.status || '').toLowerCase() === 'rejected';
        });

        const isClientRejected = Boolean(
            ackStatus === 'rejected' ||
            rawStatus === 'order_lost' ||
            rawStatus === 'lost' ||
            rawStatus === 'cancelled' ||
            rawStatus === 'canceled' ||
            rawStatus === 'rejected' ||
            (q as any).is_rejected === 1 ||
            (q as any).is_rejected === true ||
            hasAnyRejectedForProject
        );

        if (isClientRejected) {
            return 'order_lost';
        }

        // 2. Check if this quote or another quote for the same project was converted
        const hasProjectConverted = rawQuotes.some((otherQ: any) => {
            if (!isSameProjectQuote(otherQ)) return false;
            return String(otherQ.status || '').toLowerCase() === 'order_converted';
        });

        // 3. Client accepted check across quote and project
        const hasProjectAccepted = rawQuotes.some((otherQ: any) => {
            if (!isSameProjectQuote(otherQ)) return false;
            return String(otherQ.ack_status || '').toLowerCase() === 'accepted' ||
                String(otherQ.status || '').toLowerCase() === 'approved';
        });

        const isClientAccepted = ackStatus === 'accepted' || rawStatus === 'approved' || rawStatus === 'order_converted' || hasProjectAccepted;

        const isStage1Paid = isStage1AdvancePaidForQuote(q);

        // STRICT CONVERSION RULE:
        // A quotation can ONLY be 'order_converted' if:
        // 1. Client has accepted it (or it's already converted and accepted), AND
        // 2. Stage 1 Advance payment is actually verified paid (isStage1Paid), OR it was already an officially converted order.
        // A fresh draft, initial quotation, or quote with NO client acceptance / NO Stage 1 advance must NEVER be order_converted!
        if (isClientAccepted) {
            const isAlreadyConverted = (rawStatus === 'order_converted' || hasProjectConverted) && !q.is_initial_quote && q.save_type !== 'draft';
            if (isAlreadyConverted || isStage1Paid) {
                return 'order_converted';
            }
            return 'approved';
        }

        const isProposalSentAtLeastOnce = 
            rawStatus === 'proposal' ||
            rawStatus === 'proposal_sent' ||
            rawStatus === 'sent' ||
            Boolean(q.ack_email_sent_at) ||
            Boolean((q as any).has_proposal_sent) ||
            Boolean((q as any).proposal_sent_at);

        if (isProposalSentAtLeastOnce) {
            return 'proposal_sent';
        }

        if (rawStatus === 'draft' || q.save_type === 'draft') {
            return 'draft';
        }

        return 'booked';
    }, [isStage1AdvancePaidForQuote, rawQuotes]);

    // Search Query state
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Base active quotes for the user/designer, deduplicated to latest version per project/lead
    const baseQuotes = useMemo(() => {
        const enriched = rawQuotes.map(q => {
            const cName = String(q.client_name || q.subtitle || '').toLowerCase().trim();
            const isGen = !cName || ['client', 'customer', 'valued client', 'valuedclient', 'none', 'client quotation', 'new client'].includes(cName);
            const matchedLead = leadsList.find((l: any) =>
                (l.manual_client_id && String(q.project_code || q.project_id).includes(l.manual_client_id)) ||
                (q.lead_id && String(l.lead_id) === String(q.lead_id)) ||
                (String(l.lead_id) === String(q.project_id).replace(/\D/g, '')) ||
                (!isGen && l.client_name && q.client_name && l.client_name.trim().toLowerCase() === q.client_name.trim().toLowerCase()) ||
                (!isGen && l.client_name && q.subtitle && l.client_name.trim().toLowerCase() === q.subtitle.trim().toLowerCase())
            );

            const matchedProj = rawProjects.find((p: any) =>
                String(p.project_id) === String(q.project_id) || (p.project_code && String(q.project_code || '').includes(p.project_code))
            );

            const bestCode = matchedLead?.manual_client_id || matchedLead?.project_code || matchedProj?.project_code || (q.project_code && !q.project_code.startsWith('DC-') && !q.project_code.startsWith('PR-17') ? q.project_code : (matchedLead ? `PR-${matchedLead.lead_id}` : null));

            return {
                ...q,
                project_code: bestCode || q.project_code
            };
        });

        const activeScoped = enriched.filter(q => {
            // Strictly exclude synthetic placeholder mock quotes (only genuine quotations created by designers)
            const qid = String(q.quote_id || '');
            if (!qid || qid.startsWith('lead-') || qid.startsWith('p-') || q.is_placeholder || q.is_synthetic || q.is_real_quote === false) {
                return false;
            }

            // STRICT DESIGNER ISOLATION: Designers ONLY see quotes for projects/leads assigned to them!
            if (isDesignerRole && !isQuoteAccessibleByDesigner(q, effectiveUser, leadsList, rawProjects)) {
                return false;
            }

            const isQuoteDeleted = q.is_deleted === 1 || q.is_deleted === '1' || q.is_deleted === true;
            if (filterCategory === 'Trash / Deleted') {
                if (!isQuoteDeleted) return false;
            } else {
                if (isQuoteDeleted) return false;
                if (filterCategory === 'Active Quotation' && q.status === 'archived') return false;
                if (filterCategory === 'Archived Quotation' && q.status !== 'archived') return false;
                if (filterCategory === 'Used Quotation' && q.status !== 'used') return false;
            }

            return true;
        });

        // Group quotes by project / client and select ONLY the latest quotation version to eliminate duplicate older revision records
        const getQuoteGroupKey = (q: any): string => {
            if (q.is_deleted === 1 || q.is_deleted === '1' || q.is_deleted === true) {
                return `del_${q.quote_id || q.id}`;
            }

            const pCode = String(q.project_code || q.manual_client_id || q.client_code || '').trim().toLowerCase();
            if (pCode && !pCode.startsWith('dc-') && !pCode.startsWith('draft-')) {
                return `code_${pCode}`;
            }

            const pId = String(q.project_id || '').trim().toLowerCase();
            if (pId && pId !== '0') {
                return `pid_${pId}`;
            }

            const cName = String(q.client_name || q.subtitle || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
            if (cName && cName !== 'valuedclient' && cName !== 'client') {
                return `client_${cName}`;
            }

            return `qid_${q.quote_id || q.id}`;
        };

        const getQuoteAmount = (q: any): number => {
            if (q.sections && Array.isArray(q.sections) && q.sections.length > 0) {
                return q.sections.reduce((sum: number, s: any) =>
                    sum + (s.items || []).reduce((itemSum: number, i: any) => itemSum + (parseFloat(i.amount) || 0), 0), 0);
            }
            return parseFloat(q.total_amount || q.grand_total || q.net_amount || 0);
        };

        const getQuoteDateMs = (q: any): number => {
            if (!q.created_at) return 0;
            const dt = new Date(q.created_at);
            return isNaN(dt.getTime()) ? 0 : dt.getTime();
        };

        const latestQuotesMap = new Map<string, any>();
        activeScoped.forEach(q => {
            const projKey = getQuoteGroupKey(q);
            if (!latestQuotesMap.has(projKey)) {
                latestQuotesMap.set(projKey, q);
            } else {
                const existing = latestQuotesMap.get(projKey);
                const existingAmt = getQuoteAmount(existing);
                const currentAmt = getQuoteAmount(q);

                // Rule 1: Prefer a quotation that has a non-zero amount over a zero-amount placeholder
                if (currentAmt > 0 && existingAmt === 0) {
                    latestQuotesMap.set(projKey, q);
                } else if (currentAmt === 0 && existingAmt > 0) {
                    // keep existing non-zero quote
                } else {
                    // Rule 2: If both have amounts or both are 0, prefer the one with higher version or newer creation date
                    const existingVer = Number(existing.version || 1);
                    const currentVer = Number(q.version || 1);
                    const existingDate = getQuoteDateMs(existing);
                    const currentDate = getQuoteDateMs(q);
                    const existingId = Number(existing.quote_id || existing.id || 0);
                    const currentId = Number(q.quote_id || q.id || 0);

                    if (currentVer > existingVer) {
                        latestQuotesMap.set(projKey, q);
                    } else if (currentVer === existingVer) {
                        if (currentDate > existingDate) {
                            latestQuotesMap.set(projKey, q);
                        } else if (currentDate === existingDate && currentId > existingId) {
                            latestQuotesMap.set(projKey, q);
                        }
                    }
                }
            }
        });

        return Array.from(latestQuotesMap.values());
    }, [rawQuotes, leadsList, rawProjects, isDesignerRole, effectiveUser, filterCategory, isQuoteAccessibleByDesigner]);

    // Status counts and total amount metrics for top summary cards (evaluated across base dataset so card numbers remain constant)
    const statusCountsAndTotals = useMemo(() => {
        let bookedCount = 0, bookedTotal = 0;
        let proposalCount = 0, proposalTotal = 0;
        let approvedCount = 0, approvedTotal = 0;
        let convertedCount = 0, convertedTotal = 0;
        let orderLostCount = 0, orderLostTotal = 0;
        let totalCount = 0, grandTotal = 0;

        baseQuotes.forEach((q: any) => {
            const amt = (q.sections && Array.isArray(q.sections) && q.sections.length > 0)
                ? q.sections.reduce((sum: number, s: any) => sum + (s.items || []).reduce((itemSum: number, i: any) => itemSum + (parseFloat(i.amount) || 0), 0), 0)
                : (parseFloat(q.total_amount) || 0);

            totalCount++;
            grandTotal += amt;

            const st = getEffectiveQuoteStatus(q);
            const rawSt = String(q.status || '').toLowerCase().trim();
            const ackSt = String(q.ack_status || '').toLowerCase().trim();

            const isLost = Boolean(
                st === 'order_lost' ||
                ackSt === 'rejected' ||
                rawSt === 'order_lost' ||
                rawSt === 'rejected'
            );

            // Proposal Sent: Every quotation where a proposal was sent to the client
            const wasProposalSent = Boolean(
                q.ack_email_sent_at ||
                (q as any).has_proposal_sent ||
                (q as any).proposal_sent_at ||
                rawSt === 'proposal' ||
                rawSt === 'proposal_sent' ||
                rawSt === 'sent' ||
                st === 'proposal_sent' ||
                st === 'approved' ||
                st === 'order_converted' ||
                ackSt === 'accepted'
            );

            // Approved: Every quotation that has been accepted / approved by client
            const isApproved = Boolean(
                st === 'approved' ||
                st === 'order_converted' ||
                ackSt === 'accepted' ||
                rawSt === 'approved' ||
                rawSt === 'order_converted'
            );

            // Converted: Every quotation that has been converted (Stage 1 paid)
            const isConverted = Boolean(
                st === 'order_converted' ||
                st === 'deal_done' ||
                st === 'deal_won' ||
                rawSt === 'order_converted'
            );

            if (isLost) {
                orderLostCount++;
                orderLostTotal += amt;
            } else {
                if (isConverted) {
                    convertedCount++;
                    convertedTotal += amt;
                }
                if (isApproved) {
                    approvedCount++;
                    approvedTotal += amt;
                }
                // PROPOSALS SENT MUST STAY CONSTANT (Cumulative Sent Proposals):
                // If 10 sent today and 10 tomorrow, totally stay 20! It does not drop when approved or converted.
                if (wasProposalSent) {
                    proposalCount++;
                    proposalTotal += amt;
                }
                if (!wasProposalSent && !isApproved && !isConverted) {
                    bookedCount++;
                    bookedTotal += amt;
                }
            }
        });

        return {
            totalCount, grandTotal,
            bookedCount, bookedTotal,
            proposalCount, proposalTotal,
            approvedCount, approvedTotal,
            convertedCount, convertedTotal,
            orderLostCount, orderLostTotal
        };
    }, [baseQuotes, getEffectiveQuoteStatus]);

    // Filter Logic for table rows (respects statusFilter, search, client, and date filters)
    const filteredQuotes = useMemo(() => {
        return baseQuotes.filter(q => {
            if (searchQuery.trim() !== '') {
                const term = searchQuery.trim().toLowerCase();
                const quoteNum = String(q.quote_number || '').toLowerCase();
                const clientName = String(q.client_name || '').toLowerCase();
                const projName = String(q.project_name || '').toLowerCase();
                const projCode = String(q.project_code || (q.project_id ? (String(q.project_id).startsWith('DC-') ? q.project_id : `DC-${q.project_id}`) : '')).toLowerCase();
                const phone = String(q.client_phone || q.sales_manager_phone || q.contact || '').toLowerCase();
                const sub = String(q.subtitle || '').toLowerCase();

                if (
                    !quoteNum.includes(term) &&
                    !clientName.includes(term) &&
                    !projName.includes(term) &&
                    !projCode.includes(term) &&
                    !phone.includes(term) &&
                    !sub.includes(term)
                ) {
                    return false;
                }
            }

            if (statusFilter !== 'All') {
                const s = getEffectiveQuoteStatus(q);
                const rawSt = String(q.status || '').toLowerCase().trim();
                const ackSt = String(q.ack_status || '').toLowerCase().trim();
                const sf = statusFilter.toLowerCase().trim().replace(/\s+/g, '_');

                const isLost = Boolean(
                    s === 'order_lost' ||
                    ackSt === 'rejected' ||
                    rawSt === 'order_lost' ||
                    rawSt === 'rejected'
                );

                const wasProposalSent = Boolean(
                    q.ack_email_sent_at ||
                    (q as any).has_proposal_sent ||
                    (q as any).proposal_sent_at ||
                    rawSt === 'proposal' ||
                    rawSt === 'proposal_sent' ||
                    rawSt === 'sent' ||
                    s === 'proposal_sent' ||
                    s === 'approved' ||
                    s === 'order_converted' ||
                    ackSt === 'accepted'
                );

                const isApproved = Boolean(
                    s === 'approved' ||
                    s === 'order_converted' ||
                    ackSt === 'accepted' ||
                    rawSt === 'approved' ||
                    rawSt === 'order_converted'
                );

                const isConverted = Boolean(
                    s === 'order_converted' ||
                    s === 'deal_done' ||
                    s === 'deal_won' ||
                    rawSt === 'order_converted'
                );

                if (sf === 'booked') {
                    if (wasProposalSent || isApproved || isConverted || isLost) return false;
                } else if (sf === 'proposal_sent' || sf === 'proposal') {
                    if (!wasProposalSent || isLost) return false;
                } else if (sf === 'approved') {
                    if (!isApproved || isLost) return false;
                } else if (sf === 'order_converted' || sf === 'deal_done') {
                    if (!isConverted || isLost) return false;
                } else if (sf === 'order_lost' || sf === 'lost' || sf === 'cancelled') {
                    if (!isLost) return false;
                } else {
                    if (s !== sf && !s.includes(sf)) return false;
                }
            }

            if (clientFilter !== 'All') {
                const c = String(q.client_name || '').toLowerCase();
                if (!c.includes(clientFilter.toLowerCase())) return false;
            }

            if (contactFilter !== 'All' && contactFilter.trim() !== '') {
                const phone = String(q.client_phone || q.sales_manager_phone || q.contact || '').toLowerCase();
                if (!phone.includes(contactFilter.toLowerCase().trim())) return false;
            }

            if (projectIdFilter !== 'All' && projectIdFilter.trim() !== '') {
                const pid = String(q.project_code || (q.project_id ? `PR-${q.project_id}` : '')).toLowerCase();
                if (!pid.includes(projectIdFilter.toLowerCase())) return false;
            }

            if (projectTypeFilter !== 'All') {
                const ptype = String(q.project_category || q.project_type || 'Interior & Furniture Projects').toLowerCase();
                if (!ptype.includes(projectTypeFilter.toLowerCase())) return false;
            }

            if (dateRangeFilter !== 'All Time' && dateRangeFilter !== 'All') {
                if (q.created_at) {
                    const parseLocalDateStr = (rawDate: string | null | undefined): Date | null => {
                        if (!rawDate) return null;
                        const s = String(rawDate).trim();
                        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
                            const [y, m, d] = s.split('-').map(Number);
                            return new Date(y, m - 1, d, 0, 0, 0, 0);
                        }
                        const dt = new Date(rawDate);
                        return isNaN(dt.getTime()) ? null : dt;
                    };
                    const qDate = parseLocalDateStr(q.created_at);
                    if (qDate) {
                        const qTime = qDate.getTime();
                        const now = new Date();
                        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
                        const oneDay = 86400000;

                        if (dateRangeFilter === 'Today') {
                            if (qTime < todayStart) return false;
                        } else if (dateRangeFilter === 'This Week') {
                            const weekStart = todayStart - (now.getDay() * oneDay);
                            if (qTime < weekStart) return false;
                        } else if (dateRangeFilter === 'This Month') {
                            if (qDate.getMonth() !== now.getMonth() || qDate.getFullYear() !== now.getFullYear()) return false;
                        } else if (dateRangeFilter === 'Last Month') {
                            const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                            if (qDate.getMonth() !== prevMonthDate.getMonth() || qDate.getFullYear() !== prevMonthDate.getFullYear()) return false;
                        } else if (dateRangeFilter === 'Last 3 Months') {
                            if ((now.getTime() - qTime) > oneDay * 90) return false;
                        } else if (dateRangeFilter === 'Last 6 Months') {
                            if ((now.getTime() - qTime) > oneDay * 180) return false;
                        } else if (dateRangeFilter === 'This Year') {
                            if (qDate.getFullYear() !== now.getFullYear()) return false;
                        } else if (dateRangeFilter === 'By Year') {
                            if (qDate.getFullYear() !== selectedYear) return false;
                        } else if (dateRangeFilter === 'Custom Range') {
                            if (customStartDate) {
                                const startDt = parseLocalDateStr(customStartDate);
                                if (startDt && qTime < startDt.getTime()) return false;
                            }
                            if (customEndDate) {
                                const [ey, em, ed] = customEndDate.split('-').map(Number);
                                const endMs = new Date(ey, em - 1, ed, 23, 59, 59).getTime();
                                if (qTime > endMs) return false;
                            }
                        }
                    } else {
                        return false;
                    }
                } else {
                    return false;
                }
            }

            return true;
        });
    }, [baseQuotes, searchQuery, statusFilter, clientFilter, contactFilter, projectIdFilter, projectTypeFilter, dateRangeFilter, selectedYear, customStartDate, customEndDate, getEffectiveQuoteStatus]);
    // Unique clients for filter dropdown
    const clientOptions = useMemo(() => {
        const set = new Set<string>();
        rawQuotes.forEach(q => {
            if (q.client_name) set.add(q.client_name);
        });
        return Array.from(set);
    }, [rawQuotes]);

    // Unique Project IDs for filter dropdown
    const projectIdOptions = useMemo(() => {
        const set = new Set<string>();
        rawQuotes.forEach(q => {
            const pid = q.project_code || (q.project_id ? (String(q.project_id).startsWith('DC-') ? q.project_id : `DC-${q.project_id}`) : null);
            if (pid) set.add(pid);
        });
        return Array.from(set);
    }, [rawQuotes]);

    // Pagination calculations
    const totalRecords = filteredQuotes.length;
    const totalPages = Math.ceil(totalRecords / rowsPerPage) || 1;
    const startIndex = (currentPage - 1) * rowsPerPage;
    const currentQuotes = filteredQuotes.slice(startIndex, startIndex + rowsPerPage);

    // Reset filters
    const handleResetFilters = () => {
        setSearchQuery('');
        setFilterCategory('Active Quotation');
        setStatusFilter('All');
        setClientFilter('All');
        setContactFilter('All');
        setProjectIdFilter('All');
        setProjectTypeFilter('All');
        setDateRangeFilter('All Time');
        setSelectedYear(new Date().getFullYear());
        setCustomStartDate('');
        setCustomEndDate('');
        setCurrentPage(1);
    };

    // Toggle expand row
    const toggleExpandRow = (id: string) => {
        setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
    };

    // Select all rows
    const toggleSelectAll = () => {
        if (Object.keys(selectedRows).length === currentQuotes.length) {
            setSelectedRows({});
        } else {
            const next: Record<string, boolean> = {};
            currentQuotes.forEach(q => { next[q.quote_id] = true; });
            setSelectedRows(next);
        }
    };

    // Select single row
    const toggleSelectRow = (id: string) => {
        setSelectedRows(prev => ({ ...prev, [id]: !prev[id] }));
    };

    // Format date string to reference design format (e.g. "Jun 25, 2026")
    const formatDate = (dateStr?: string) => {
        if (!dateStr) return 'Jun 25, 2026';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return 'Jun 25, 2026';
            return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
        } catch {
            return 'Jun 25, 2026';
        }
    };

    // Format currency (INR)
    const formatINR = (val?: number) => {
        const num = Number(val) || 0;
        return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    // Helper to get audit details: who created/prepared and who edited the quote
    const getQuoteUserAuditInfo = (q: any) => {
        let prepName = (q.prepared_by_name || '').trim();
        let prepRole = (q.prepared_by_role || '').trim();

        // Strict Sales Assignment Rule: If lead or project has an assigned designer from the sales team, THAT designer is the assigned quote preparer
        const numPid = String(q.project_id || '').replace(/\D/g, '');
        const matchingLead = leadsList.find(l =>
            String(l.lead_id) === String(q.project_id) ||
            (numPid && String(l.lead_id) === numPid) ||
            String(l.manual_client_id) === String(q.project_id) ||
            String(l.manual_client_id) === String(q.project_code)
        );
        if (matchingLead) {
            const assignedId = matchingLead.d1_assigned_to || matchingLead.associate_designer_assigned_id || matchingLead.assigned_to;
            if (assignedId && Number(assignedId) > 0) {
                const u = usersList.find(user => String(user.user_id) === String(assignedId));
                if (u) {
                    prepName = u.name;
                    prepRole = u.role;
                }
            }
        } else if (rawProjects && rawProjects.length > 0) {
            const matchingProj = rawProjects.find(p =>
                String(p.project_id) === String(q.project_id) ||
                (numPid && String(p.project_id) === numPid) ||
                String(p.project_code) === String(q.project_id) ||
                String(p.project_code) === String(q.project_code)
            );
            if (matchingProj) {
                const assignedId = matchingProj.designer_id || matchingProj.d1_assigned_to || matchingProj.created_by;
                if (assignedId && Number(assignedId) > 0) {
                    const u = usersList.find(user => String(user.user_id) === String(assignedId));
                    if (u) {
                        prepName = u.name;
                        prepRole = u.role;
                    }
                }
            }
        }

        // If not in quote row or generic, check usersList with created_by
        if ((!prepName || prepName === 'Admin Sukku') && q.created_by && Number(q.created_by) > 1) {
            const u = usersList.find(user => String(user.user_id) === String(q.created_by));
            if (u) {
                prepName = u.name;
                prepRole = u.role;
            }
        }

        if (!prepName) {
            prepName = 'Admin Sukku';
            prepRole = 'admin';
        }

        let editName = (q.updated_by_name || '').trim();
        let editRole = (q.updated_by_role || '').trim();

        if ((!editName || editName === 'Admin Sukku') && q.updated_by && Number(q.updated_by) > 1) {
            const u = usersList.find(user => String(user.user_id) === String(q.updated_by));
            if (u) {
                editName = u.name;
                editRole = u.role;
            }
        }

        if (!editName) {
            editName = prepName;
            editRole = prepRole;
        }

        // Determine if edited: different updater OR updated_at is distinctly after created_at
        const isEdited = Boolean(
            (q.updated_by && q.created_by && String(q.updated_by) !== String(q.created_by)) ||
            (editName && prepName && editName.toLowerCase() !== prepName.toLowerCase()) ||
            (q.updated_at && q.created_at && Math.abs(new Date(q.updated_at).getTime() - new Date(q.created_at).getTime()) > 120000)
        );

        return {
            prepName,
            prepRole,
            editName,
            editRole,
            isEdited,
            createdAt: q.created_at,
            updatedAt: q.updated_at
        };
    };

    // If an editing project is active -> Render full QuoteTab Component
    if (activeEditingProject) {
        const activePid = String(activeEditingProject.project_id || activeEditingProject.lead_id || '').trim();
        const activePcode = String(activeEditingProject.project_code || activeEditingProject.manual_client_id || '').trim();
        const isClientAcceptedForActive = activeEditingProject?.ack_status === 'accepted';
        const isClientRejectedForActive = Boolean(
            activeEditingProject?.ack_status === 'rejected' ||
            activeEditingProject?.status === 'order_lost' ||
            activeEditingProject?.status === 'rejected'
        );
        const isStage1PaidForActiveEditing = !isClientRejectedForActive && isClientAcceptedForActive && Boolean(
            (activePid && (localStorage.getItem(`stage1_paid_${activePid}`) === 'true' || localStorage.getItem(`stage1_paid_${activePid}`) === '1')) ||
            (activePcode && (localStorage.getItem(`stage1_paid_${activePcode}`) === 'true' || localStorage.getItem(`stage1_paid_${activePcode}`) === '1')) ||
            activeEditingProject.stage1_paid === 1 ||
            activeEditingProject.stage1_paid === true ||
            activeEditingProject.is_10_percent_paid === 1 ||
            activeEditingProject.is_10_percent_paid === true ||
            String(activeEditingProject.payment_status || '').toLowerCase().includes('10%') ||
            String(activeEditingProject.payment_status || '').toLowerCase().includes('20%') ||
            rawProjects.some((p: any) =>
                ((activePid && (String(p.project_id) === activePid || String(p.lead_id) === activePid)) ||
                    (activePcode && (String(p.project_code) === activePcode || String(p.manual_client_id) === activePcode))) &&
                (p.stage1_paid === 1 || p.stage1_paid === true || p.is_10_percent_paid === 1 || p.is_10_percent_paid === true || String(p.payment_status || '').toLowerCase().includes('10%') || String(p.payment_status || '').toLowerCase().includes('20%'))
            ) ||
            leadsList.some((l: any) =>
                ((activePid && String(l.lead_id) === activePid) ||
                    (activePcode && String(l.manual_client_id) === activePcode)) &&
                (l.stage1_paid === 1 || l.stage1_paid === true || l.is_10_percent_paid === 1 || l.is_10_percent_paid === true || String(l.payment_status || '').toLowerCase().includes('10%') || String(l.payment_status || '').toLowerCase().includes('20%'))
            ) ||
            financeTransactions.filter((t: any) => {
                if (t.type !== 'credit' || t.is_deleted) return false;
                const tPid = String(t.project_id || '');
                const tDesc = String(t.description || '');
                return (activePid && (tPid === activePid || tDesc.includes(activePid))) || (activePcode && (tPid === activePcode || tDesc.includes(activePcode)));
            }).reduce((sum: number, t: any) => sum + parseFloat(t.amount || 0), 0) >= 10000
        );

        const isStage2PaidForActiveEditing = Boolean(
            (activePid && (localStorage.getItem(`stage2_paid_${activePid}`) === 'true' || localStorage.getItem(`stage2_paid_${activePid}`) === '1')) ||
            (activePcode && (localStorage.getItem(`stage2_paid_${activePcode}`) === 'true' || localStorage.getItem(`stage2_paid_${activePcode}`) === '1')) ||
            activeEditingProject.stage2_paid === 1 ||
            activeEditingProject.stage2_paid === true ||
            activeEditingProject.is_20_percent_paid === 1 ||
            activeEditingProject.is_20_percent_paid === true ||
            String(activeEditingProject.payment_status || '').toLowerCase().includes('20%') ||
            rawProjects.some((p: any) =>
                ((activePid && (String(p.project_id) === activePid || String(p.lead_id) === activePid)) ||
                    (activePcode && (String(p.project_code) === activePcode || String(p.manual_client_id) === activePcode))) &&
                (p.stage2_paid === 1 || p.stage2_paid === true || p.is_20_percent_paid === 1 || p.is_20_percent_paid === true || String(p.payment_status || '').toLowerCase().includes('20%'))
            ) ||
            leadsList.some((l: any) =>
                ((activePid && String(l.lead_id) === activePid) ||
                    (activePcode && String(l.manual_client_id) === activePcode)) &&
                (l.stage2_paid === 1 || l.stage2_paid === true || l.is_20_percent_paid === 1 || l.is_20_percent_paid === true || String(l.payment_status || '').toLowerCase().includes('20%'))
            ) ||
            financeTransactions.filter((t: any) => {
                if (t.type !== 'credit' || t.is_deleted) return false;
                const tPid = String(t.project_id || '');
                const tDesc = String(t.description || '');
                return (activePid && (tPid === activePid || tDesc.includes(activePid))) || (activePcode && (tPid === activePcode || tDesc.includes(activePcode)));
            }).reduce((sum: number, t: any) => sum + parseFloat(t.amount || 0), 0) >= 15000
        );

        const isQcBookedForActiveEditing = Boolean(
            (activePid && (localStorage.getItem(`qc_booked_${activePid}`) === 'true' || localStorage.getItem(`qc_completed_${activePid}`) === 'true')) ||
            (activePcode && (localStorage.getItem(`qc_booked_${activePcode}`) === 'true' || localStorage.getItem(`qc_completed_${activePcode}`) === 'true')) ||
            (activeEditingProject?.qc_booking_time && String(activeEditingProject.qc_booking_time).trim() !== '' && activeEditingProject.qc_booking_time !== '0000-00-00 00:00:00') ||
            (activeEditingProject?.site_manager_booking_time && String(activeEditingProject.site_manager_booking_time).trim() !== '' && activeEditingProject.site_manager_booking_time !== '0000-00-00 00:00:00') ||
            (activeEditingProject?.site_inspector_booking_time && String(activeEditingProject.site_inspector_booking_time).trim() !== '' && activeEditingProject.site_inspector_booking_time !== '0000-00-00 00:00:00') ||
            ['booked', 'in_meeting', 'meeting_completed', 'completed', 'approved', 'under_review', 'qc_approved', 'site_manager_booked'].includes(String(activeEditingProject?.qc_status || activeEditingProject?.site_inspector_status || activeEditingProject?.site_manager_status || '').toLowerCase().trim()) ||
            activeEditingProject?.is_qc_completed === 1 ||
            activeEditingProject?.is_qc_done === 1 ||
            rawProjects.some((p: any) =>
                ((activePid && (String(p.project_id) === activePid || String(p.lead_id) === activePid)) ||
                    (activePcode && (String(p.project_code) === activePcode || String(p.manual_client_id) === activePcode))) &&
                (
                    (p.qc_booking_time && String(p.qc_booking_time).trim() !== '' && p.qc_booking_time !== '0000-00-00 00:00:00') ||
                    (p.site_manager_booking_time && String(p.site_manager_booking_time).trim() !== '' && p.site_manager_booking_time !== '0000-00-00 00:00:00') ||
                    (p.site_inspector_booking_time && String(p.site_inspector_booking_time).trim() !== '' && p.site_inspector_booking_time !== '0000-00-00 00:00:00') ||
                    ['booked', 'in_meeting', 'meeting_completed', 'completed', 'approved', 'under_review', 'qc_approved', 'site_manager_booked'].includes(String(p.qc_status || p.site_inspector_status || p.site_manager_status || '').toLowerCase().trim()) ||
                    p.is_qc_completed === 1 || p.is_qc_done === 1
                )
            ) ||
            leadsList.some((l: any) =>
                ((activePid && String(l.lead_id) === activePid) ||
                    (activePcode && String(l.manual_client_id) === activePcode)) &&
                (
                    (l.qc_booking_time && String(l.qc_booking_time).trim() !== '' && l.qc_booking_time !== '0000-00-00 00:00:00') ||
                    (l.site_manager_booking_time && String(l.site_manager_booking_time).trim() !== '' && l.site_manager_booking_time !== '0000-00-00 00:00:00') ||
                    (l.site_inspector_booking_time && String(l.site_inspector_booking_time).trim() !== '' && l.site_inspector_booking_time !== '0000-00-00 00:00:00') ||
                    ['booked', 'in_meeting', 'meeting_completed', 'completed', 'approved', 'under_review', 'qc_approved', 'site_manager_booked'].includes(String(l.qc_status || l.site_inspector_status || l.site_manager_status || '').toLowerCase().trim()) ||
                    l.is_qc_completed === 1 || l.is_qc_done === 1
                )
            )
        );

        const isQcMeetingStartedForActiveEditing = Boolean(
            (activePid && (localStorage.getItem(`meeting_started_at_${activePid}`) || localStorage.getItem(`qc_started_${activePid}`) === 'true' || localStorage.getItem(`qc_completed_${activePid}`) === 'true')) ||
            (activePcode && (localStorage.getItem(`meeting_started_at_${activePcode}`) || localStorage.getItem(`qc_started_${activePcode}`) === 'true' || localStorage.getItem(`qc_completed_${activePcode}`) === 'true')) ||
            ['in_meeting', 'started', 'meeting_completed', 'completed', 'approved', 'qc_approved', 'done'].includes(String(activeEditingProject.qc_meeting_status || activeEditingProject.qc_status || activeEditingProject.site_inspector_status || activeEditingProject.site_manager_status || '').toLowerCase().trim()) ||
            activeEditingProject.is_qc_completed === 1 ||
            activeEditingProject.is_qc_done === 1 ||
            rawProjects.some((p: any) =>
                ((activePid && (String(p.project_id) === activePid || String(p.lead_id) === activePid)) ||
                    (activePcode && (String(p.project_code) === activePcode || String(p.manual_client_id) === activePcode))) &&
                (['in_meeting', 'started', 'meeting_completed', 'completed', 'approved', 'qc_approved', 'done'].includes(String(p.qc_status || p.site_inspector_status || p.site_manager_status || '').toLowerCase().trim()) || p.is_qc_completed === 1 || p.is_qc_done === 1)
            ) ||
            leadsList.some((l: any) =>
                ((activePid && String(l.lead_id) === activePid) ||
                    (activePcode && String(l.manual_client_id) === activePcode)) &&
                (['in_meeting', 'started', 'meeting_completed', 'completed', 'approved', 'qc_approved', 'done'].includes(String(l.qc_status || l.site_inspector_status || l.site_manager_status || '').toLowerCase().trim()) || l.is_qc_completed === 1 || l.is_qc_done === 1)
            )
        );

        return (
            <div className="quotes-workspace-page" style={{ padding: '24px 32px', width: '100%', margin: '0 auto', maxWidth: '1600px', boxSizing: 'border-box', backgroundColor: '#ffffff', minHeight: '100vh' }}>
                <div className="no-print" style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 22px',
                    backgroundColor: '#ffffff',
                    border: '1.5px solid #e2e8f0',
                    marginBottom: '20px',
                    borderRadius: '12px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                    flexWrap: 'wrap',
                    gap: '14px'
                }}>
                    {/* Left: Livincart Branding & Company Name */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <img src={liveLogo} alt="Livincart Logo" style={{ height: '38px', objectFit: 'contain' }} />
                            <div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#000000', lineHeight: 1.2, letterSpacing: '-0.2px' }}>
                                    Livincart Private Limited
                                </div>
                                <div style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 500, marginTop: '2px' }}>
                                    Office Interiors &amp; Architecture Workspace
                                </div>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={() => {
                            setActiveEditingProject(null);
                            sessionStorage.removeItem('dc_active_editing_project');
                            navigate('/quotes', { replace: true, state: null });
                            window.history.replaceState({}, document.title, '/quotes');
                            fetchQuotesAndProjects();
                        }}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: '#ffffff',
                            color: '#334155',
                            border: '1px solid #cbd5e1',
                            borderRadius: '8px',
                            fontWeight: 600,
                            fontSize: '0.82rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                        }}
                    >
                        ← Back to Quotations List
                    </button>
                </div>

                <QuoteTab
                    key={`quote-tab-${activeEditingProject?.quote_id || activeEditingProject?.project_id || 'active'}`}
                    project={activeEditingProject}
                    quoteId={activeEditingProject?.quote_id}
                    user={user}
                    usersList={usersList}
                    isReadOnly={false}
                    isUsedQuote={false}
                    isStage1Paid={isStage1PaidForActiveEditing}
                    isStage2Paid={isStage2PaidForActiveEditing}
                    isQcBooked={isQcBookedForActiveEditing}
                    isQcMeetingStarted={isQcMeetingStartedForActiveEditing}
                    onSaveSuccess={fetchQuotesAndProjects}
                />
            </div>
        );
    }

    return (
        <div className="quotes-management-page" style={{
            padding: '30px 40px',
            backgroundColor: '#f8fafc',
            minHeight: '100vh',
            color: '#1e293b',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
        }}>

            {/* RECENTLY CREATED QUOTATION SUCCESS BANNER */}
            {recentlyCreatedQuote && (
                <div style={{
                    padding: '16px 20px',
                    backgroundColor: '#ecfdf5',
                    border: '1.5px solid #10b981',
                    borderRadius: '14px',
                    marginBottom: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '14px',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.12)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669', flexShrink: 0 }}>
                            <CheckCircle2 size={24} />
                        </div>
                        <div>
                            <div style={{ fontWeight: 800, color: '#065f46', fontSize: '0.98rem' }}>
                                Quotation Workspace Created Successfully!
                            </div>
                            <div style={{ fontSize: '0.85rem', color: '#047857', marginTop: '3px' }}>
                                Quotation for <strong>{recentlyCreatedQuote.client_name}</strong> (Project ID: <strong>{recentlyCreatedQuote.project_code || recentlyCreatedQuote.project_id}</strong>) is now reflected and visible in your Quotation History table below.
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button
                            onClick={() => {
                                openQuoteWorkspace(recentlyCreatedQuote);
                                setRecentlyCreatedQuote(null);
                            }}
                            style={{
                                padding: '9px 20px',
                                backgroundColor: '#059669',
                                color: '#ffffff',
                                borderRadius: '8px',
                                border: 'none',
                                fontWeight: 800,
                                fontSize: '0.86rem',
                                cursor: 'pointer',
                                boxShadow: '0 2px 6px rgba(5, 150, 105, 0.25)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <ExternalLink size={15} /> Open Quotation Workspace →
                        </button>
                        <button
                            onClick={() => setRecentlyCreatedQuote(null)}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: '#059669',
                                cursor: 'pointer',
                                padding: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                borderRadius: '6px'
                            }}
                            title="Dismiss"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>
            )}

            {/* OFFICIAL LIVINCART BRANDING & WORKSPACE HEADER */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 24px',
                backgroundColor: '#ffffff',
                border: '1.5px solid #e2e8f0',
                marginBottom: '20px',
                borderRadius: '14px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                flexWrap: 'wrap',
                gap: '16px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <img src={liveLogo} alt="Livincart Logo" style={{ height: '42px', objectFit: 'contain' }} />
                        <div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#000000', lineHeight: 1.2, letterSpacing: '-0.3px' }}>
                                Livincart Private Limited
                            </div>
                            <div style={{ fontSize: '0.80rem', color: '#64748b', fontWeight: 600, marginTop: '2px' }}>
                                Office Interiors &amp; Architecture Workspace
                            </div>
                        </div>
                    </div>

                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 14px',
                        borderRadius: '10px',
                        backgroundColor: '#fff9f0',
                        border: '1.5px solid #ffe8c2'
                    }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 900, color: '#c2410c' }}>
                            📊 Quotation &amp; Estimate Workspace
                        </span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, backgroundColor: '#ffedd5', color: '#ea580c', padding: '1px 8px', borderRadius: '6px' }}>
                            {filteredQuotes.length} Quotes Active
                        </span>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                        onClick={() => {
                            setIsInitialQuoteFlow(false);
                            setShowCreateModal(true);
                            setCreateFormData({
                                client_name: '',
                                contact_number: '',
                                email: '',
                                project_id: '',
                                client_address: '',
                                location: '',
                                project_type: 'Furniture projects',
                                project_scope: '2 BHK',
                                custom_scope: '',
                                lead_source: 'walk_in',
                                estimated_budget: ''
                            });
                            setSelectedLeadId('');
                            setLeadSearchTerm('');
                            setIsLeadDropdownOpen(false);
                            setDuplicateSourceId('');
                            setDuplicateSearchTerm('');
                            setIsDuplicateDropdownOpen(false);
                        }}
                        style={{
                            padding: '11px 22px',
                            backgroundColor: '#111827',
                            color: '#ffffff',
                            borderRadius: '10px',
                            border: 'none',
                            fontWeight: 800,
                            fontSize: '0.88rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            boxShadow: '0 4px 14px rgba(17,24,39,0.25)'
                        }}
                    >
                        <Plus size={18} /> + Create New Quotation
                    </button>
                </div>
            </div>

            {/* TOP STATUS OVERVIEW METRIC CARDS (CARD AT TOP IN /QUOTES PAGE) */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
                marginBottom: '24px'
            }} className="no-print">
                {/* Total / All Quotes Card */}
                <div
                    onClick={() => { setStatusFilter('All'); setCurrentPage(1); }}
                    style={{
                        backgroundColor: statusFilter === 'All' ? '#eff6ff' : '#ffffff',
                        border: statusFilter === 'All' ? '2.5px solid #2563eb' : '1.5px solid #cbd5e1',
                        borderRadius: '14px',
                        padding: '16px 18px',
                        boxShadow: statusFilter === 'All' ? '0 6px 16px rgba(37, 99, 235, 0.18)' : '0 2px 5px rgba(0,0,0,0.04)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        position: 'relative'
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: statusFilter === 'All' ? '#1d4ed8' : '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>All Quotations</span>
                        <div style={{ width: '34px', height: '34px', borderRadius: '10px', backgroundColor: statusFilter === 'All' ? '#dbeafe' : '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FileText size={18} />
                        </div>
                    </div>
                    <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>{statusCountsAndTotals.totalCount}</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                        <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#2563eb' }}>
                            {formatINR(statusCountsAndTotals.grandTotal)}
                        </div>
                        {statusFilter === 'All' && (
                            <span style={{ fontSize: '0.66rem', fontWeight: 900, backgroundColor: '#2563eb', color: '#ffffff', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>FILTERED</span>
                        )}
                    </div>
                </div>

                {/* Pending Quote Card */}
                <div
                    onClick={() => { setStatusFilter(statusFilter === 'booked' ? 'All' : 'booked'); setCurrentPage(1); }}
                    style={{
                        backgroundColor: statusFilter === 'booked' ? '#fff7ed' : '#ffffff',
                        border: statusFilter === 'booked' ? '2.5px solid #ea580c' : '1.5px solid #e2e8f0',
                        borderRadius: '14px',
                        padding: '16px 18px',
                        boxShadow: statusFilter === 'booked' ? '0 6px 16px rgba(234, 88, 12, 0.18)' : '0 2px 5px rgba(0,0,0,0.04)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        position: 'relative'
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: statusFilter === 'booked' ? '#c2410c' : '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pending Quote</span>
                        <div style={{ width: '34px', height: '34px', borderRadius: '10px', backgroundColor: statusFilter === 'booked' ? '#ffedd5' : '#fff9f0', color: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Bookmark size={18} />
                        </div>
                    </div>
                    <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>{statusCountsAndTotals.bookedCount}</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                        <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#ea580c' }}>
                            {formatINR(statusCountsAndTotals.bookedTotal)}
                        </div>
                        {statusFilter === 'booked' && (
                            <span style={{ fontSize: '0.66rem', fontWeight: 900, backgroundColor: '#ea580c', color: '#ffffff', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>FILTERED</span>
                        )}
                    </div>
                </div>

                {/* Proposal Sent Card */}
                <div
                    onClick={() => { setStatusFilter(statusFilter === 'proposal_sent' ? 'All' : 'proposal_sent'); setCurrentPage(1); }}
                    style={{
                        backgroundColor: statusFilter === 'proposal_sent' ? '#eff6ff' : '#ffffff',
                        border: statusFilter === 'proposal_sent' ? '2.5px solid #2563eb' : '1.5px solid #e2e8f0',
                        borderRadius: '14px',
                        padding: '16px 18px',
                        boxShadow: statusFilter === 'proposal_sent' ? '0 6px 16px rgba(37, 99, 235, 0.18)' : '0 2px 5px rgba(0,0,0,0.04)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        position: 'relative'
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: statusFilter === 'proposal_sent' ? '#1d4ed8' : '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Proposal Sent</span>
                        <div style={{ width: '34px', height: '34px', borderRadius: '10px', backgroundColor: statusFilter === 'proposal_sent' ? '#dbeafe' : '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Send size={18} />
                        </div>
                    </div>
                    <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>{statusCountsAndTotals.proposalCount}</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                        <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#2563eb' }}>
                            {formatINR(statusCountsAndTotals.proposalTotal)}
                        </div>
                        {statusFilter === 'proposal_sent' && (
                            <span style={{ fontSize: '0.66rem', fontWeight: 900, backgroundColor: '#2563eb', color: '#ffffff', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>FILTERED</span>
                        )}
                    </div>
                </div>

                {/* Approved Card */}
                <div
                    onClick={() => { setStatusFilter(statusFilter === 'approved' ? 'All' : 'approved'); setCurrentPage(1); }}
                    style={{
                        backgroundColor: statusFilter === 'approved' ? '#f0fdf4' : '#ffffff',
                        border: statusFilter === 'approved' ? '2.5px solid #16a34a' : '1.5px solid #e2e8f0',
                        borderRadius: '14px',
                        padding: '16px 18px',
                        boxShadow: statusFilter === 'approved' ? '0 6px 16px rgba(22, 163, 74, 0.18)' : '0 2px 5px rgba(0,0,0,0.04)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        position: 'relative'
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: statusFilter === 'approved' ? '#15803d' : '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Approved</span>
                        <div style={{ width: '34px', height: '34px', borderRadius: '10px', backgroundColor: statusFilter === 'approved' ? '#dcfce7' : '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <CheckCircle2 size={18} />
                        </div>
                    </div>
                    <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>{statusCountsAndTotals.approvedCount}</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                        <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#16a34a' }}>
                            {formatINR(statusCountsAndTotals.approvedTotal)}
                        </div>
                        {statusFilter === 'approved' && (
                            <span style={{ fontSize: '0.66rem', fontWeight: 900, backgroundColor: '#16a34a', color: '#ffffff', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>FILTERED</span>
                        )}
                    </div>
                </div>

                {/* Order Converted Card */}
                <div
                    onClick={() => { setStatusFilter(statusFilter === 'order_converted' ? 'All' : 'order_converted'); setCurrentPage(1); }}
                    style={{
                        backgroundColor: statusFilter === 'order_converted' ? '#f0fdf4' : '#ffffff',
                        border: statusFilter === 'order_converted' ? '2.5px solid #15803d' : '1.5px solid #e2e8f0',
                        borderRadius: '14px',
                        padding: '16px 18px',
                        boxShadow: statusFilter === 'order_converted' ? '0 6px 16px rgba(21, 128, 61, 0.18)' : '0 2px 5px rgba(0,0,0,0.04)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        position: 'relative'
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: statusFilter === 'order_converted' ? '#166534' : '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Order Converted</span>
                        <div style={{ width: '34px', height: '34px', borderRadius: '10px', backgroundColor: statusFilter === 'order_converted' ? '#bbf7d0' : '#dcfce7', color: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ShoppingCart size={18} />
                        </div>
                    </div>
                    <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>{statusCountsAndTotals.convertedCount}</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                        <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#15803d' }}>
                            {formatINR(statusCountsAndTotals.convertedTotal)}
                        </div>
                        {statusFilter === 'order_converted' && (
                            <span style={{ fontSize: '0.66rem', fontWeight: 900, backgroundColor: '#15803d', color: '#ffffff', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>FILTERED</span>
                        )}
                    </div>
                </div>

                {/* Order Lost Card */}
                <div
                    onClick={() => { setStatusFilter(statusFilter === 'order_lost' ? 'All' : 'order_lost'); setCurrentPage(1); }}
                    style={{
                        backgroundColor: statusFilter === 'order_lost' ? '#fff1f2' : '#ffffff',
                        border: statusFilter === 'order_lost' ? '2.5px solid #e11d48' : '1.5px solid #e2e8f0',
                        borderRadius: '14px',
                        padding: '16px 18px',
                        boxShadow: statusFilter === 'order_lost' ? '0 6px 16px rgba(225, 29, 72, 0.18)' : '0 2px 5px rgba(0,0,0,0.04)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        position: 'relative'
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: statusFilter === 'order_lost' ? '#be123c' : '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Order Lost</span>
                        <div style={{ width: '34px', height: '34px', borderRadius: '10px', backgroundColor: statusFilter === 'order_lost' ? '#ffe4e6' : '#fff1f2', color: '#e11d48', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <XCircle size={18} />
                        </div>
                    </div>
                    <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>{statusCountsAndTotals.orderLostCount}</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                        <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#e11d48' }}>
                            {formatINR(statusCountsAndTotals.orderLostTotal)}
                        </div>
                        {statusFilter === 'order_lost' && (
                            <span style={{ fontSize: '0.66rem', fontWeight: 900, backgroundColor: '#e11d48', color: '#ffffff', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>FILTERED</span>
                        )}
                    </div>
                </div>
            </div>

            {/* PROJECT PROMO & COUPON CODE BAR (RIGHT AFTER TITLE BANNER ON MAIN QUOTES PAGE) */}
            <div className="no-print" style={{
                padding: '14px 20px',
                backgroundColor: '#fff7ed',
                border: '1.5px solid #fed7aa',
                borderRadius: '12px',
                marginBottom: '20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
                boxShadow: '0 2px 6px rgba(251, 146, 60, 0.08)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>🎟️</span>
                    <div>
                        <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#9a3412', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Project Promo &amp; Coupon Code</div>
                        <div style={{ fontSize: '0.78rem', color: '#c2410c', fontWeight: 500 }}>
                            {appliedGlobalCoupon
                                ? `Active Coupon Applied: ${appliedGlobalCoupon.code} (${appliedGlobalCoupon.discountType === 'percent' ? `${appliedGlobalCoupon.discountValue}% OFF` : `₹${appliedGlobalCoupon.discountValue.toLocaleString('en-IN')} OFF`})`
                                : `View all created promo codes & discounts (${dbPromoCodes.length} Available)`}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    {appliedGlobalCoupon && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#ffffff', padding: '6px 14px', borderRadius: '8px', border: '1.5px solid #ea580c' }}>
                            <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#ea580c' }}>
                                🏷️ {appliedGlobalCoupon.code} ({appliedGlobalCoupon.discountType === 'percent' ? `${appliedGlobalCoupon.discountValue}% OFF` : `₹${appliedGlobalCoupon.discountValue.toLocaleString('en-IN')} OFF`})
                            </span>
                            <button onClick={() => setAppliedGlobalCoupon(null)} style={{ background: 'none', border: 'none', color: '#dc2626', fontWeight: 800, cursor: 'pointer', fontSize: '0.90rem', padding: '0 4px' }} title="Remove Coupon">✕</button>
                        </div>
                    )}

                    {/* Admin Category-Wise Max Discount Option */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        backgroundColor: '#ffffff',
                        border: '1.5px solid #ea580c',
                        borderRadius: '8px',
                        padding: '4px 10px',
                        boxShadow: '0 2px 5px rgba(234, 88, 12, 0.12)'
                    }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#9a3412', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <Shield size={15} color="#ea580c" />
                            Category Max Discounts
                        </span>
                        {isAdmin && (
                            <button
                                type="button"
                                onClick={() => setShowMaxDiscountModal(true)}
                                style={{
                                    padding: '5px 12px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    backgroundColor: '#ea580c',
                                    color: '#ffffff',
                                    fontSize: '0.78rem',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    boxShadow: '0 1px 3px rgba(234, 88, 12, 0.25)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px'
                                }}
                                title="Set individual max discount limitations for each category"
                            >
                                <Edit3 size={13} />
                                Category Limits
                            </button>
                        )}
                    </div>

                    <button
                        onClick={() => setShowPromoHistoryModal(true)}
                        style={{
                            padding: '8px 18px',
                            backgroundColor: '#ea580c',
                            color: '#ffffff',
                            borderRadius: '8px',
                            border: 'none',
                            fontWeight: 800,
                            fontSize: '0.84rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 2px 6px rgba(234, 88, 12, 0.25)'
                        }}
                        title="Open Promo Codes History & Creation Modal"
                    >
                        <Tag size={16} />
                        Select or Create Promo Code
                    </button>
                </div>
            </div>

            {/* 1. TOP FILTERS ACCORDION CARD */}
            <div style={{
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                marginBottom: '20px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                overflow: 'visible'
            }}>
                {/* Filters Header Line */}
                <div style={{
                    padding: '14px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                    borderBottom: isFiltersOpen ? '1px solid #f1f5f9' : 'none'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button
                            onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontSize: '0.95rem',
                                fontWeight: 800,
                                color: '#0f172a',
                                padding: 0
                            }}
                        >
                            {isFiltersOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                            <span>Filters</span>
                        </button>

                        <select
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            style={{
                                padding: '6px 14px',
                                borderRadius: '8px',
                                border: filterCategory === 'Trash / Deleted' ? '1.5px solid #ef4444' : '1.5px solid #fca412',
                                backgroundColor: filterCategory === 'Trash / Deleted' ? '#fef2f2' : '#fff7ed',
                                fontSize: '0.85rem',
                                fontWeight: 700,
                                color: filterCategory === 'Trash / Deleted' ? '#dc2626' : '#0f172a',
                                outline: 'none',
                                cursor: 'pointer',
                                boxShadow: filterCategory === 'Trash / Deleted' ? '0 0 0 3px rgba(239, 68, 68, 0.15)' : '0 0 0 3px rgba(252, 164, 18, 0.15)'
                            }}
                        >
                            <option value="Active Quotation">Active Quotation</option>
                            {isAdmin && (
                                <option value="Trash / Deleted">
                                    🗑️ Trash / Deleted ({deletedQuotesCount} Recoverable)
                                </option>
                            )}
                        </select>

                        {/* Admin Quick Trash / 30-Day Recovery Toggle */}
                        {isAdmin && (
                            <button
                                onClick={() => setFilterCategory(filterCategory === 'Trash / Deleted' ? 'Active Quotation' : 'Trash / Deleted')}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '6px 12px',
                                    borderRadius: '8px',
                                    fontSize: '0.84rem',
                                    fontWeight: 700,
                                    border: filterCategory === 'Trash / Deleted' ? '1.5px solid #ef4444' : '1.5px solid #cbd5e1',
                                    backgroundColor: filterCategory === 'Trash / Deleted' ? '#fee2e2' : '#ffffff',
                                    color: filterCategory === 'Trash / Deleted' ? '#dc2626' : '#64748b',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                }}
                                title="View deleted quotes recoverable for up to 30 days"
                            >
                                <Trash2 size={15} color={filterCategory === 'Trash / Deleted' ? '#dc2626' : '#64748b'} />
                                <span>Trash {deletedQuotesCount > 0 ? `(${deletedQuotesCount})` : ''}</span>
                                {filterCategory === 'Trash / Deleted' && (
                                    <span style={{ fontSize: '0.72rem', backgroundColor: '#fecdd3', color: '#9f1239', padding: '1px 6px', borderRadius: '10px' }}>
                                        30-Day Recovery
                                    </span>
                                )}
                            </button>
                        )}

                        {/* Search Input Bar (Top Bar) */}
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', minWidth: '260px' }}>
                            <Search size={15} color="#fca412" style={{ position: 'absolute', left: '10px', pointerEvents: 'none' }} />
                            <input
                                type="text"
                                placeholder="Search quote #, client, project..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '6px 28px 6px 32px',
                                    borderRadius: '8px',
                                    border: '1.5px solid #fed7aa',
                                    backgroundColor: '#ffffff',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    color: '#0f172a',
                                    outline: 'none',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                                }}
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    style={{ position: 'absolute', right: '8px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontWeight: 800, fontSize: '0.85rem' }}
                                    title="Clear search"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <button
                            onClick={handleResetFilters}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '8px 16px',
                                borderRadius: '8px',
                                border: '1.5px solid #ef4444',
                                backgroundColor: '#fef2f2',
                                color: '#ef4444',
                                fontSize: '0.82rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                boxShadow: '0 2px 6px rgba(239, 68, 68, 0.15)',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            <RotateCcw size={14} /> Reset Filters
                        </button>

                        <div style={{ position: 'relative' }}>
                            <button
                                onClick={() => setSaveReportDropdownOpen(!saveReportDropdownOpen)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '6px 14px',
                                    borderRadius: '6px',
                                    border: '1px solid #e2e8f0',
                                    backgroundColor: '#ffffff',
                                    color: '#475569',
                                    fontSize: '0.82rem',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                <Bookmark size={14} /> Save as Report <ChevronDown size={14} />
                            </button>

                            {saveReportDropdownOpen && (
                                <div style={{
                                    position: 'absolute',
                                    right: 0,
                                    top: '100%',
                                    marginTop: '4px',
                                    backgroundColor: '#ffffff',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '8px',
                                    boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                                    zIndex: 100,
                                    width: '180px',
                                    padding: '6px'
                                }}>
                                    <button
                                        onClick={() => { setSaveReportDropdownOpen(false); alert('Report saved to bookmarks!'); }}
                                        style={{ width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'transparent', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 500 }}
                                    >
                                        Save Current View
                                    </button>
                                    <button
                                        onClick={() => { setSaveReportDropdownOpen(false); alert('Custom Report Created!'); }}
                                        style={{ width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'transparent', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 500 }}
                                    >
                                        Create New Report
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Filter Grid Controls Panel */}
                {isFiltersOpen && (
                    <div style={{
                        padding: '18px 20px 22px 20px',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: '16px',
                        backgroundColor: '#fffcf5',
                        borderTop: '1px solid #fed7aa'
                    }}>
                        {/* Search Query Filter Input */}
                        <div style={{ gridColumn: 'span 2' }}>
                            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#0c1527', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.4px' }}>
                                Search Quotations:
                            </label>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <Search size={15} color="#fca412" style={{ position: 'absolute', left: '12px', pointerEvents: 'none' }} />
                                <input
                                    type="text"
                                    placeholder="Search by quote #, client, project name, phone..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '8px 30px 8px 36px',
                                        borderRadius: '8px',
                                        border: '1.5px solid #fca412',
                                        backgroundColor: '#ffffff',
                                        fontSize: '0.85rem',
                                        fontWeight: 700,
                                        color: '#0f172a',
                                        outline: 'none',
                                        boxSizing: 'border-box',
                                        boxShadow: '0 2px 4px rgba(252, 164, 18, 0.1)'
                                    }}
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        style={{ position: 'absolute', right: '10px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontWeight: 800, fontSize: '0.9rem' }}
                                        title="Clear search"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        </div>
                        {/* Status Filter */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#0c1527', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.4px' }}>
                                Status:
                            </label>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    border: '1.5px solid #fed7aa',
                                    backgroundColor: '#ffffff',
                                    fontSize: '0.85rem',
                                    fontWeight: 700,
                                    color: '#0f172a',
                                    outline: 'none',
                                    cursor: 'pointer',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                                }}
                            >
                                <option value="All">All Statuses</option>
                                <option value="booked">Pending Quote</option>
                                <option value="proposal_sent">Proposal Sent</option>
                                <option value="approved">Approved</option>
                                <option value="order_converted">Order Converted</option>
                                <option value="order_lost">Order Lost</option>
                            </select>
                        </div>

                        {/* Client Filter */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#0c1527', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.4px' }}>
                                Client:
                            </label>
                            <select
                                value={clientFilter}
                                onChange={(e) => setClientFilter(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    border: '1.5px solid #fed7aa',
                                    backgroundColor: '#ffffff',
                                    fontSize: '0.85rem',
                                    fontWeight: 700,
                                    color: '#0f172a',
                                    outline: 'none',
                                    cursor: 'pointer',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                                }}
                            >
                                <option value="All">All Clients</option>
                                {clientOptions.map((c, i) => (
                                    <option key={i} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>

                        {/* Contact Filter (Interactive Text Input) */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#0c1527', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.4px' }}>
                                Contact:
                            </label>
                            <input
                                type="text"
                                placeholder="Enter contact number..."
                                value={contactFilter === 'All' ? '' : contactFilter}
                                onChange={(e) => setContactFilter(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    border: '1.5px solid #fed7aa',
                                    backgroundColor: '#ffffff',
                                    fontSize: '0.85rem',
                                    fontWeight: 700,
                                    color: '#0f172a',
                                    outline: 'none',
                                    boxSizing: 'border-box',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                                }}
                            />
                        </div>

                        {/* Project ID Filter */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#0c1527', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.4px' }}>
                                Project ID:
                            </label>
                            <select
                                value={projectIdFilter}
                                onChange={(e) => setProjectIdFilter(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    border: '1.5px solid #fed7aa',
                                    backgroundColor: '#ffffff',
                                    fontSize: '0.85rem',
                                    fontWeight: 700,
                                    color: '#0f172a',
                                    outline: 'none',
                                    cursor: 'pointer',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                                }}
                            >
                                <option value="All">All Project IDs</option>
                                {projectIdOptions.map((pid, i) => (
                                    <option key={i} value={pid}>{pid}</option>
                                ))}
                            </select>
                        </div>

                        {/* Project Type Filter */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#0c1527', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.4px' }}>
                                Project Type:
                            </label>
                            <select
                                value={projectTypeFilter}
                                onChange={(e) => setProjectTypeFilter(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    border: '1.5px solid #fed7aa',
                                    backgroundColor: '#ffffff',
                                    fontSize: '0.85rem',
                                    fontWeight: 700,
                                    color: '#0f172a',
                                    outline: 'none',
                                    cursor: 'pointer',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                                }}
                            >
                                <option value="All">All Project Types</option>
                                <option value="Furniture Projects">Furniture Projects</option>
                                <option value="Interior Projects">Interior Projects</option>
                                <option value="Interior & Furniture Projects">Interior &amp; Furniture Projects</option>
                            </select>
                        </div>
                    </div>
                )}
            </div>

            {/* DATE RANGE TAB STRIP */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '20px',
                overflowX: 'auto',
                paddingBottom: '4px',
                flexWrap: 'wrap'
            }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 900, color: '#fca412', textTransform: 'uppercase', marginRight: '6px', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>
                    Date Range:
                </span>
                {['All Time', 'Today', 'This Week', 'This Month', 'Last Month', 'Last 3 Months', 'Last 6 Months', 'This Year', 'By Year', 'Custom Range'].map((rangeOption) => {
                    const isActive = dateRangeFilter === rangeOption;
                    return (
                        <button
                            key={rangeOption}
                            onClick={() => setDateRangeFilter(rangeOption)}
                            style={{
                                padding: '6px 16px',
                                borderRadius: '20px',
                                fontSize: '0.82rem',
                                fontWeight: 800,
                                border: isActive ? '1.5px solid #fca412' : '1px solid #e2e8f0',
                                backgroundColor: isActive ? '#fca412' : '#ffffff',
                                color: isActive ? '#ffffff' : '#475569',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                boxShadow: isActive ? '0 2px 8px rgba(252,164,18,0.35)' : '0 1px 2px rgba(0,0,0,0.02)',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {rangeOption}
                        </button>
                    );
                })}

                {/* Dynamic Year Picker for By Year */}
                {dateRangeFilter === 'By Year' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '8px', backgroundColor: '#fff7ed', padding: '4px 10px', borderRadius: '10px', border: '1.5px solid #fed7aa' }}>
                        <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#ea580c' }}>Year:</span>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(Number(e.target.value))}
                            style={{
                                padding: '4px 8px',
                                borderRadius: '6px',
                                border: '1.5px solid #2563eb',
                                backgroundColor: '#eff6ff',
                                fontSize: '0.80rem',
                                fontWeight: 800,
                                color: '#1e40af',
                                outline: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            {Array.from({ length: 8 }, (_, i) => new Date().getFullYear() - i).map((yr) => (
                                <option key={yr} value={yr}>{yr}</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Custom Date Range Pickers */}
                {dateRangeFilter === 'Custom Range' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '8px', backgroundColor: '#fff7ed', padding: '4px 10px', borderRadius: '10px', border: '1.5px solid #fed7aa' }}>
                        <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#ea580c' }}>From:</span>
                        <input
                            type="date"
                            value={customStartDate}
                            onChange={(e) => setCustomStartDate(e.target.value)}
                            style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.80rem', fontWeight: 700, outline: 'none' }}
                        />
                        <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#ea580c' }}>To:</span>
                        <input
                            type="date"
                            value={customEndDate}
                            onChange={(e) => setCustomEndDate(e.target.value)}
                            style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.80rem', fontWeight: 700, outline: 'none' }}
                        />
                    </div>
                )}
            </div>

            {/* 4. TABLE CONTROLS BAR */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '14px',
                flexWrap: 'wrap',
                gap: '12px'
            }}>
                {/* Left: Showing Range Text */}
                <div style={{ fontSize: '0.88rem', color: '#475569', fontWeight: 600 }}>
                    Showing <span style={{ fontWeight: 800, color: '#0f172a' }}>{totalRecords > 0 ? startIndex + 1 : 0}</span> to <span style={{ fontWeight: 800, color: '#0f172a' }}>{Math.min(startIndex + rowsPerPage, totalRecords)}</span> of <span style={{ fontWeight: 800, color: '#0f172a' }}>{totalRecords}</span> Quotations
                </div>

                {/* Right: Controls (Rows/Page, Download As, Column Icon) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {/* Rows/Page selector */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>
                        <span>Rows/Page</span>
                        <select
                            value={rowsPerPage}
                            onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                            style={{
                                padding: '5px 10px',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                backgroundColor: '#ffffff',
                                fontWeight: 700,
                                color: '#0f172a',
                                outline: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                        </select>
                    </div>

                    {/* Download As Dropdown */}
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => setDownloadDropdownOpen(!downloadDropdownOpen)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 14px',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                backgroundColor: '#ffffff',
                                color: '#0f172a',
                                fontSize: '0.85rem',
                                fontWeight: 700,
                                cursor: 'pointer'
                            }}
                        >
                            <Download size={14} color="#fca412" /> Download As <ChevronDown size={14} />
                        </button>

                        {downloadDropdownOpen && (
                            <div style={{
                                position: 'absolute',
                                right: 0,
                                top: '100%',
                                marginTop: '4px',
                                backgroundColor: '#ffffff',
                                border: '1px solid #cbd5e1',
                                borderRadius: '8px',
                                boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                                zIndex: 100,
                                width: '150px',
                                padding: '4px'
                            }}>
                                <button
                                    onClick={() => { setDownloadDropdownOpen(false); alert('Exporting CSV...'); }}
                                    style={{ width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'transparent', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 500 }}
                                >
                                    Export CSV
                                </button>
                                <button
                                    onClick={() => { setDownloadDropdownOpen(false); alert('Exporting PDF...'); }}
                                    style={{ width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'transparent', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 500 }}
                                >
                                    Export PDF
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Column Grid Customizer Icon */}
                    <button
                        title="Customize Columns"
                        style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            backgroundColor: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fca412',
                            cursor: 'pointer'
                        }}
                    >
                        <Grid size={16} />
                    </button>
                </div>
            </div>

            {/* Trash & 30-Day Recovery Info Banner */}
            {filterCategory === 'Trash / Deleted' && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 20px',
                    marginBottom: '16px',
                    backgroundColor: '#fff1f2',
                    border: '1.5px solid #fecdd3',
                    borderRadius: '12px',
                    boxShadow: '0 2px 6px rgba(225, 29, 72, 0.06)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '8px',
                            backgroundColor: '#ffe4e6',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                        }}>
                            <Trash2 size={20} color="#e11d48" />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#9f1239', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>Quotation Recycle Bin (30-Day Recovery Policy)</span>
                                <span style={{ fontSize: '0.74rem', fontWeight: 700, backgroundColor: '#fecdd3', color: '#881337', padding: '2px 8px', borderRadius: '12px' }}>
                                    {deletedQuotesCount} deleted quote{deletedQuotesCount === 1 ? '' : 's'}
                                </span>
                            </div>
                            <div style={{ fontSize: '0.82rem', color: '#be123c', marginTop: '3px' }}>
                                Deleted quotations are preserved here for <strong>30 days</strong> from the date of deletion. Click <strong>"Recover"</strong> in the Actions column to instantly restore any quote back to Active status.
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => setFilterCategory('Active Quotation')}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: '#ffffff',
                            border: '1.5px solid #fda4af',
                            borderRadius: '8px',
                            color: '#e11d48',
                            fontSize: '0.84rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                        }}
                    >
                        <RotateCcw size={14} color="#e11d48" /> Back to Active Quotations
                    </button>
                </div>
            )}

            {/* 5. MAIN QUOTATIONS TABLE */}
            <div style={{
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                overflow: 'visible'
            }}>
                <div style={{ overflowX: 'auto', overflowY: 'visible', minHeight: '260px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                        <thead style={{ fontWeight: 900 }}>
                            <tr style={{ backgroundColor: '#fff9f0', color: '#0c1527', fontWeight: 900, fontSize: '0.80rem', letterSpacing: '0.6px', height: '54px', borderBottom: '2px solid #fca412' }}>
                                <th style={{ padding: '18px 16px', width: '40px', fontWeight: 900 }}>
                                    <input
                                        type="checkbox"
                                        checked={currentQuotes.length > 0 && Object.keys(selectedRows).length === currentQuotes.length}
                                        onChange={toggleSelectAll}
                                        style={{ cursor: 'pointer', accentColor: '#fca412' }}
                                    />
                                </th>
                                <th style={{ padding: '18px 12px', width: '40px', color: '#94a3b8', fontWeight: 900 }}>#</th>

                                {/* Date Column */}
                                <th style={{ padding: '18px 16px', whiteSpace: 'nowrap', textTransform: 'uppercase', fontWeight: 900 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span>Date</span>
                                        <ArrowDown size={14} color="#fca412" />
                                    </div>
                                </th>

                                {/* Expand Line Items Column */}
                                {SHOW_EXPAND_COLUMN && (
                                    <th style={{ padding: '18px 16px', whiteSpace: 'nowrap', textTransform: 'uppercase', fontWeight: 900 }}>
                                        Expand
                                    </th>
                                )}

                                {/* Project ID / Quotation Column */}
                                <th style={{ padding: '18px 16px', whiteSpace: 'nowrap', textTransform: 'uppercase', fontWeight: 900 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span>Project ID / Quotation</span>
                                        <ArrowUp size={14} color="#94a3b8" />
                                    </div>
                                </th>

                                {/* Quoted To (Client) Column */}
                                <th style={{ padding: '18px 16px', whiteSpace: 'nowrap', textTransform: 'uppercase', fontWeight: 900 }}>
                                    Quoted To
                                </th>

                                {/* Amount Column */}
                                <th style={{ padding: '18px 16px', whiteSpace: 'nowrap', textTransform: 'uppercase', fontWeight: 900 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span>Amount</span>
                                        <ArrowUp size={14} color="#94a3b8" />
                                    </div>
                                </th>

                                {/* Status Column */}
                                <th style={{ padding: '18px 16px', whiteSpace: 'nowrap', textTransform: 'uppercase', fontWeight: 900 }}>
                                    Status
                                </th>

                                {/* Prepared / Edited By Column */}
                                <th style={{ padding: '18px 16px', whiteSpace: 'nowrap', textTransform: 'uppercase', fontWeight: 900 }}>
                                    Prepared / Edited By
                                </th>

                                {/* Payment Date Column */}
                                <th style={{ padding: '18px 16px', whiteSpace: 'nowrap', textTransform: 'uppercase', fontWeight: 900 }}>
                                    Payment Date
                                </th>

                                {/* Actions Column */}
                                <th style={{ padding: '18px 16px', textAlign: 'right', minWidth: '160px', textTransform: 'uppercase', fontWeight: 900 }}>
                                    Actions
                                </th>
                            </tr>
                        </thead>

                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={SHOW_EXPAND_COLUMN ? 11 : 10} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                                        Loading quotations...
                                    </td>
                                </tr>
                            ) : currentQuotes.length === 0 ? (
                                <tr>
                                    <td colSpan={SHOW_EXPAND_COLUMN ? 11 : 10} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                                        No quotations found matching your criteria.
                                    </td>
                                </tr>
                            ) : (
                                currentQuotes.map((q, idx) => {
                                    const rowNum = startIndex + idx + 1;
                                    const isExpanded = !!expandedRows[q.quote_id];
                                    const isSelected = !!selectedRows[q.quote_id];
                                    const isRecentlyCreated = Boolean(recentlyCreatedQuote && (
                                        String(q.project_id) === String(recentlyCreatedQuote.project_id) ||
                                        String(q.quote_id) === String(recentlyCreatedQuote.quote_id) ||
                                        (q.project_code && q.project_code === recentlyCreatedQuote.project_code)
                                    ));

                                    return (
                                        <React.Fragment key={`q-${q.quote_id || q.id || idx}-${idx}`}>
                                            <tr style={{
                                                borderBottom: isExpanded ? 'none' : '1px solid #f1f5f9',
                                                backgroundColor: isRecentlyCreated ? '#f0fdf4' : (isSelected ? '#fffcf5' : 'transparent'),
                                                borderLeft: isRecentlyCreated ? '4px solid #10b981' : undefined,
                                                transition: 'background 0.15s',
                                                position: 'relative',
                                                zIndex: (activeRowMenu === q.quote_id) ? 100 : 1
                                            }}>
                                                {/* Checkbox */}
                                                <td style={{ padding: '16px' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleSelectRow(q.quote_id)}
                                                        style={{ cursor: 'pointer', accentColor: '#ea580c' }}
                                                    />
                                                </td>

                                                {/* Row Index */}
                                                <td style={{ padding: '16px 12px', fontWeight: 600, color: '#64748b' }}>
                                                    {rowNum}
                                                </td>

                                                {/* Date */}
                                                <td style={{ padding: '16px', fontWeight: 600, color: '#334155', whiteSpace: 'nowrap' }}>
                                                    {formatDate(q.created_at)}
                                                </td>

                                                {/* Expand Line Items (+) */}
                                                {SHOW_EXPAND_COLUMN && (
                                                    <td style={{ padding: '16px' }}>
                                                        <button
                                                            onClick={() => toggleExpandRow(q.quote_id)}
                                                            style={{
                                                                background: isExpanded ? '#fff7ed' : '#f8fafc',
                                                                border: isExpanded ? '1px solid #fed7aa' : '1px solid #e2e8f0',
                                                                borderRadius: '6px',
                                                                cursor: 'pointer',
                                                                fontSize: '0.9rem',
                                                                fontWeight: 700,
                                                                color: isExpanded ? '#ea580c' : '#475569',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                width: '26px',
                                                                height: '26px'
                                                            }}
                                                        >
                                                            {isExpanded ? <Minus size={14} /> : <Plus size={14} />}
                                                        </button>
                                                    </td>
                                                )}

                                                {/* Project ID / Quotation Number */}
                                                {(() => {
                                                    const displayProjId = q.project_code || q.manual_client_id || q.client_code || (q.project_id ? (String(q.project_id).startsWith('DC-') ? String(q.project_id).replace('DC-', 'PR-') : (String(q.project_id).startsWith('PR-') || String(q.project_id).startsWith('LVC') ? q.project_id : `PR-${q.project_id}`)) : `PR-${rowNum}`);
                                                    const refCode = q.quote_number || `QTN-${q.project_code || q.project_id || rowNum}`;
                                                    const isInitialQuote = q.is_initial === 1 || q.is_initial === true || q.is_initial === '1' || (typeof q.extra_data === 'string' && q.extra_data.includes('"is_initial_quote":true')) || q.extra_data?.is_initial_quote;
                                                    const isFinalQuote = q.is_qc_approved === 1 || q.is_qc_approved === true || q.is_qc_approved === '1' || q.status === 'qc_approved' || q.status === 'Finalized' || (typeof q.extra_data === 'string' && q.extra_data.includes('"is_final_version":true')) || q.extra_data?.is_final_version || (q as any).is_final === 1;

                                                    return (
                                                        <td
                                                            onClick={() => openQuoteWorkspace(q)}
                                                            title="Click to open quote workspace"
                                                            style={{ padding: '16px', fontWeight: 600, color: '#334155', cursor: 'pointer' }}
                                                        >
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                                                <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>{displayProjId}</div>
                                                                {isRecentlyCreated && (
                                                                    <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#15803d', background: '#dcfce7', border: '1px solid #86efac', padding: '1px 6px', borderRadius: '4px' }}>
                                                                        ✨ JUST CREATED
                                                                    </span>
                                                                )}
                                                                {isInitialQuote && (
                                                                    <span style={{ fontSize: '0.70rem', fontWeight: 800, color: '#15803d', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '1px 6px', borderRadius: '4px' }}>
                                                                        ⭐ Initial
                                                                    </span>
                                                                )}
                                                                {isFinalQuote && (
                                                                    <span style={{ fontSize: '0.70rem', fontWeight: 800, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '1px 6px', borderRadius: '4px' }}>
                                                                        🏆 Final Quote
                                                                    </span>
                                                                )}
                                                                {(q.is_deleted === 1 || q.is_deleted === '1' || q.is_deleted === true) && (
                                                                    <span style={{ fontSize: '0.70rem', fontWeight: 800, color: '#b91c1c', background: '#fee2e2', border: '1px solid #fca5a5', padding: '1px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                                                        <Trash2 size={10} color="#b91c1c" /> Deleted ({q.recovery_days_remaining !== undefined ? `${q.recovery_days_remaining}d left` : '30d'})
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {refCode && refCode !== displayProjId && (
                                                                <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#64748b', background: '#fff9f0', border: '1px solid #ffe8c2', padding: '2px 8px', borderRadius: '4px', display: 'inline-block', marginTop: '3px' }}>
                                                                    Ref: {refCode}
                                                                </span>
                                                            )}
                                                        </td>
                                                    );
                                                })()}

                                                {/* Quoted To (Client Name with Circle Initials Avatar) */}
                                                <td
                                                    onClick={() => openQuoteWorkspace(q)}
                                                    title="Click to open quote workspace"
                                                    style={{ padding: '16px', fontWeight: 600, color: '#0f172a', cursor: 'pointer' }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <div style={{
                                                            width: '32px',
                                                            height: '32px',
                                                            borderRadius: '50%',
                                                            backgroundColor: '#fff9f0',
                                                            border: '1.5px solid #fca412',
                                                            color: '#0c1527',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            fontSize: '0.75rem',
                                                            fontWeight: 700,
                                                            flexShrink: 0
                                                        }}>
                                                            {(q.client_name || 'Valued Client').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                                                        </div>
                                                        <span>{q.client_name || 'Valued Client'}</span>
                                                    </div>
                                                </td>

                                                {/* Amount formatted e.g. ₹18,88,623.00 */}
                                                <td style={{ padding: '16px', fontWeight: 600, color: '#0f172a', fontSize: '0.90rem', whiteSpace: 'nowrap' }}>
                                                    {formatINR(
                                                        (q.sections && Array.isArray(q.sections) && q.sections.length > 0)
                                                            ? q.sections.reduce((sum: number, s: any) => sum + (s.items || []).reduce((itemSum: number, i: any) => itemSum + (parseFloat(i.amount) || 0), 0), 0)
                                                            : (parseFloat(q.total_amount) || 0)
                                                    )}
                                                </td>

                                                {/* Status Dropdown Selector (Automated Pipeline with Manual Order Lost only) */}
                                                <td style={{ padding: '14px 16px' }}>
                                                    {(() => {
                                                        const isStage1Paid = isStage1AdvancePaidForQuote(q);
                                                        const selectVal = getEffectiveQuoteStatus(q);
                                                        const isLost = selectVal === 'order_lost';

                                                        let bg = '#fff9f0', fg = '#ea580c', border = '#ffe8c2';
                                                        let autoLabel = '⏳ Pending Quote';

                                                        if (selectVal === 'proposal_sent') {
                                                            bg = '#eff6ff'; fg = '#2563eb'; border = '#bfdbfe';
                                                            autoLabel = '✉ Proposal Sent';
                                                        } else if (selectVal === 'approved') {
                                                            bg = '#dcfce7'; fg = '#15803d'; border = '#86efac';
                                                            autoLabel = '✓ Approved';
                                                        } else if (selectVal === 'order_converted') {
                                                            bg = '#15803d'; fg = '#ffffff'; border = '#166534';
                                                            autoLabel = '✓ Converted';
                                                        } else if (isLost) {
                                                            bg = '#fff1f2'; fg = '#e11d48'; border = '#fecdd3';
                                                            autoLabel = '✕ Order Lost';
                                                        } else if (selectVal === 'draft') {
                                                            bg = '#f8fafc'; fg = '#475569'; border = '#cbd5e1';
                                                            autoLabel = '✏ Draft';
                                                        } else {
                                                            bg = '#fff9f0'; fg = '#ea580c'; border = '#ffe8c2';
                                                            autoLabel = '⏳ Pending Quote';
                                                        }

                                                        return (
                                                            <>
                                                                <select
                                                                    value={isLost ? 'order_lost' : selectVal}
                                                                    onChange={async (e) => {
                                                                        const newSt = e.target.value;
                                                                        if (newSt === 'reopen') {
                                                                            const targetSt = 'booked';
                                                                            setRawQuotes(prev => prev.map(item =>
                                                                                String(item.quote_id) === String(q.quote_id)
                                                                                    ? {
                                                                                        ...item,
                                                                                        status: targetSt,
                                                                                        ack_status: 'pending',
                                                                                        acknowledged_at: null,
                                                                                        acknowledged_ip: null,
                                                                                        updated_by: user?.user_id || 1,
                                                                                        updated_at: new Date().toISOString()
                                                                                    }
                                                                                    : item
                                                                            ));
                                                                            try {
                                                                                await axios.post(`${API_BASE_URL}/quotes/update-status`, {
                                                                                    quote_id: q.quote_id,
                                                                                    project_id: q.project_id,
                                                                                    status: targetSt,
                                                                                    ack_status: 'pending',
                                                                                    updated_by: user?.user_id || 1,
                                                                                    user_id: user?.user_id || 1
                                                                                });
                                                                                if (q.project_id) {
                                                                                    await axios.post(`${API_BASE_URL}/leads/update-status`, {
                                                                                        lead_id: q.project_id,
                                                                                        status: 'working'
                                                                                    }).catch(() => { });
                                                                                }
                                                                            } catch (err: any) {
                                                                                console.error('Failed to reopen quote:', err);
                                                                            }
                                                                            return;
                                                                        }

                                                                        if (newSt === 'order_lost') {
                                                                            setRawQuotes(prev => prev.map(item =>
                                                                                String(item.quote_id) === String(q.quote_id)
                                                                                    ? {
                                                                                        ...item,
                                                                                        status: 'order_lost',
                                                                                        updated_by: user?.user_id || 1,
                                                                                        updated_by_name: user?.name || 'Admin',
                                                                                        updated_by_role: user?.role || 'admin',
                                                                                        updated_at: new Date().toISOString()
                                                                                    }
                                                                                    : item
                                                                            ));
                                                                            try {
                                                                                await axios.post(`${API_BASE_URL}/quotes/update-status`, {
                                                                                    quote_id: q.quote_id,
                                                                                    project_id: q.project_id,
                                                                                    status: 'order_lost',
                                                                                    updated_by: user?.user_id || 1,
                                                                                    user_id: user?.user_id || 1
                                                                                });
                                                                                if (q.project_id) {
                                                                                    await axios.post(`${API_BASE_URL}/leads/update-status`, {
                                                                                        lead_id: q.project_id,
                                                                                        status: 'lost'
                                                                                    }).catch(() => { });
                                                                                }
                                                                            } catch (err: any) {
                                                                                console.error('Failed to update status:', err);
                                                                            }
                                                                        }
                                                                    }}
                                                                    style={{
                                                                        padding: '6px 12px',
                                                                        borderRadius: '8px',
                                                                        fontSize: '0.80rem',
                                                                        fontWeight: 800,
                                                                        cursor: 'pointer',
                                                                        outline: 'none',
                                                                        backgroundColor: bg,
                                                                        color: fg,
                                                                        border: `1.5px solid ${border}`,
                                                                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                                                                        transition: 'all 0.15s ease'
                                                                    }}
                                                                >
                                                                    {isLost ? (
                                                                        <>
                                                                            <option value="order_lost" style={{ backgroundColor: '#ffffff', color: '#e11d48', fontWeight: 700 }}>✕ Order Lost</option>
                                                                            <option value="reopen" style={{ backgroundColor: '#ffffff', color: '#ea580c', fontWeight: 700 }}>⏳ Reset to Pending Quote</option>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <option value={selectVal} disabled style={{ backgroundColor: '#ffffff', color: fg, fontWeight: 700 }}>
                                                                                {autoLabel}
                                                                            </option>
                                                                            <option value="order_lost" style={{ backgroundColor: '#ffffff', color: '#e11d48', fontWeight: 700 }}>
                                                                                ✕ Order Lost
                                                                            </option>
                                                                        </>
                                                                    )}
                                                                </select>
                                                                {(isLost || selectVal === 'order_lost' || q.ack_status === 'rejected' || q.status === 'order_lost' || q.status === 'rejected') ? (
                                                                    <div style={{ marginTop: '5px' }}>
                                                                        <span style={{
                                                                            fontSize: '0.68rem',
                                                                            fontWeight: 800,
                                                                            color: '#dc2626',
                                                                            backgroundColor: '#fef2f2',
                                                                            border: '1px solid #fecaca',
                                                                            borderRadius: '6px',
                                                                            padding: '2px 6px',
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center',
                                                                            gap: '3px',
                                                                            whiteSpace: 'nowrap'
                                                                        }}>
                                                                            ✕ Declined by Client
                                                                        </span>
                                                                    </div>
                                                                ) : (selectVal === 'order_converted') ? (
                                                                    <div style={{ marginTop: '5px' }}>
                                                                        <span style={{
                                                                            fontSize: '0.68rem',
                                                                            fontWeight: 800,
                                                                            color: '#15803d',
                                                                            backgroundColor: '#f0fdf4',
                                                                            border: '1px solid #86efac',
                                                                            borderRadius: '6px',
                                                                            padding: '2px 6px',
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center',
                                                                            gap: '3px',
                                                                            whiteSpace: 'nowrap'
                                                                        }}>
                                                                            ✓ Converted (Stage 1 Paid)
                                                                        </span>
                                                                    </div>
                                                                ) : (selectVal === 'approved' || q.ack_status === 'accepted') ? (
                                                                    <div style={{ marginTop: '5px' }}>
                                                                        <span style={{
                                                                            fontSize: '0.68rem',
                                                                            fontWeight: 800,
                                                                            color: '#16a34a',
                                                                            backgroundColor: '#f0fdf4',
                                                                            border: '1px solid #bbf7d0',
                                                                            borderRadius: '6px',
                                                                            padding: '2px 6px',
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center',
                                                                            gap: '3px',
                                                                            whiteSpace: 'nowrap'
                                                                        }}>
                                                                            ✓ Client Accepted (Awaiting Stage 1)
                                                                        </span>
                                                                    </div>
                                                                ) : (q.ack_email_sent_at || selectVal === 'proposal_sent') ? (
                                                                    <div style={{ marginTop: '5px' }}>
                                                                        <span style={{
                                                                            fontSize: '0.68rem',
                                                                            fontWeight: 700,
                                                                            color: '#2563eb',
                                                                            backgroundColor: '#eff6ff',
                                                                            border: '1px solid #bfdbfe',
                                                                            borderRadius: '6px',
                                                                            padding: '2px 6px',
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center',
                                                                            gap: '3px',
                                                                            whiteSpace: 'nowrap'
                                                                        }}>
                                                                            📧 Ack Sent
                                                                        </span>
                                                                    </div>
                                                                ) : null}
                                                            </>
                                                        );
                                                    })()}
                                                </td>

                                                {/* Prepared / Edited By Column */}
                                                <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                                                    {(() => {
                                                        const audit = getQuoteUserAuditInfo(q);
                                                        const formatRoleBadge = (role: string) => {
                                                            const r = (role || '').toLowerCase();
                                                            if (r.includes('admin')) return { label: 'Admin', bg: '#fef3c7', color: '#b45309', border: '#fde68a' };
                                                            if (r.includes('d1')) return { label: 'D1 Designer', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' };
                                                            if (r.includes('d2')) return { label: 'D2 Designer', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' };
                                                            if (r.includes('designer')) return { label: 'Designer', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' };
                                                            if (r.includes('sales')) return { label: 'Sales', bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' };
                                                            if (r.includes('manager') || r.includes('head') || r.includes('pm')) return { label: 'PM', bg: '#f5f3ff', color: '#6d28d9', border: '#ddd6fe' };
                                                            return { label: role || 'Staff', bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' };
                                                        };

                                                        const prepBadge = formatRoleBadge(audit.prepRole);
                                                        const editBadge = formatRoleBadge(audit.editRole);

                                                        return (
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '150px' }}>
                                                                {/* Prepared By Row */}
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                                                    <span style={{
                                                                        fontSize: '0.68rem',
                                                                        fontWeight: 800,
                                                                        color: '#475569',
                                                                        backgroundColor: '#f1f5f9',
                                                                        border: '1px solid #e2e8f0',
                                                                        padding: '1px 5px',
                                                                        borderRadius: '4px',
                                                                        letterSpacing: '0.3px',
                                                                        textTransform: 'uppercase'
                                                                    }}>
                                                                        Prepared
                                                                    </span>
                                                                    <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.84rem' }}>
                                                                        {audit.prepName}
                                                                    </span>
                                                                    <span style={{
                                                                        fontSize: '0.67rem',
                                                                        fontWeight: 700,
                                                                        backgroundColor: prepBadge.bg,
                                                                        color: prepBadge.color,
                                                                        border: `1px solid ${prepBadge.border}`,
                                                                        padding: '1px 6px',
                                                                        borderRadius: '10px'
                                                                    }}>
                                                                        {prepBadge.label}
                                                                    </span>
                                                                </div>

                                                                {/* Edited By Row */}
                                                                {audit.isEdited ? (
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                                                        <span style={{
                                                                            fontSize: '0.68rem',
                                                                            fontWeight: 800,
                                                                            color: '#c2410c',
                                                                            backgroundColor: '#fff7ed',
                                                                            border: '1px solid #fed7aa',
                                                                            padding: '1px 5px',
                                                                            borderRadius: '4px',
                                                                            letterSpacing: '0.3px',
                                                                            textTransform: 'uppercase'
                                                                        }}>
                                                                            Edited
                                                                        </span>
                                                                        <span style={{ fontWeight: 600, color: '#334155', fontSize: '0.82rem' }}>
                                                                            {audit.editName}
                                                                        </span>
                                                                        {audit.editRole !== audit.prepRole && (
                                                                            <span style={{
                                                                                fontSize: '0.67rem',
                                                                                fontWeight: 700,
                                                                                backgroundColor: editBadge.bg,
                                                                                color: editBadge.color,
                                                                                border: `1px solid ${editBadge.border}`,
                                                                                padding: '1px 6px',
                                                                                borderRadius: '10px'
                                                                            }}>
                                                                                {editBadge.label}
                                                                            </span>
                                                                        )}
                                                                        {audit.updatedAt && (
                                                                            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                                                                • {formatDate(audit.updatedAt)}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                ) : null}
                                                            </div>
                                                        );
                                                    })()}
                                                </td>

                                                {/* Payment Date */}
                                                <td style={{ padding: '14px 16px', color: '#64748b' }}>
                                                    {q.payment_date || '-'}
                                                </td>

                                                {/* Action Icons */}
                                                <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                                                        {(q.is_deleted === 1 || q.is_deleted === '1' || q.is_deleted === true) ? (
                                                            <button
                                                                onClick={() => handleRestoreQuote(q)}
                                                                disabled={actionLoadingId === (q.quote_id || q.id)}
                                                                title="Recover Quote (Restore to Active Quotations within 30 days)"
                                                                style={{
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '6px',
                                                                    padding: '5px 12px',
                                                                    backgroundColor: '#ecfdf5',
                                                                    border: '1.5px solid #10b981',
                                                                    borderRadius: '6px',
                                                                    color: '#047857',
                                                                    fontSize: '0.80rem',
                                                                    fontWeight: 700,
                                                                    cursor: 'pointer',
                                                                    transition: 'all 0.15s ease'
                                                                }}
                                                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#d1fae5'; }}
                                                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#ecfdf5'; }}
                                                            >
                                                                <RotateCcw size={13} color="#047857" />
                                                                <span>Recover</span>
                                                            </button>
                                                        ) : (
                                                            <>
                                                                {/* External Link / Open in Full Editor */}
                                                                <button
                                                                    onClick={() => openQuoteWorkspace(q)}
                                                                    title="Open Quote Workspace"
                                                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}
                                                                >
                                                                    <ExternalLink size={16} />
                                                                </button>

                                                                {/* Edit Quote */}
                                                                <button
                                                                    onClick={() => openQuoteWorkspace(q)}
                                                                    title="Edit Quote"
                                                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}
                                                                >
                                                                    <Edit3 size={16} />
                                                                </button>

                                                                {/* Duplicate Quote (Copy Symbol) */}
                                                                <button
                                                                    onClick={() => handleOpenDuplicateModal(q)}
                                                                    title="Duplicate / Copy Quotation Modules"
                                                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ea580c', padding: '4px', display: 'flex', alignItems: 'center' }}
                                                                >
                                                                    <Copy size={16} color="#ea580c" />
                                                                </button>
                                                            </>
                                                        )}

                                                        {/* More Options */}
                                                        <div style={{ position: 'relative' }}>
                                                            {(() => {
                                                                const isMenuOpen = activeRowMenu === q.quote_id;
                                                                return (
                                                                    <>
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                if (isMenuOpen) {
                                                                                    setActiveRowMenu(null);
                                                                                } else {
                                                                                    const isNearBottom = idx > 0 && (idx >= currentQuotes.length - 2);
                                                                                    setMenuOpenUpward(isNearBottom);
                                                                                    setActiveRowMenu(q.quote_id);
                                                                                }
                                                                            }}
                                                                            title="More Actions"
                                                                            style={{
                                                                                background: isMenuOpen ? '#eff6ff' : 'transparent',
                                                                                border: isMenuOpen ? '1.5px solid #2563eb' : 'none',
                                                                                borderRadius: '6px',
                                                                                cursor: 'pointer',
                                                                                color: isMenuOpen ? '#2563eb' : '#64748b',
                                                                                padding: '4px',
                                                                                boxShadow: isMenuOpen ? '0 0 0 3px rgba(37, 99, 235, 0.15)' : 'none',
                                                                                transition: 'all 0.15s ease'
                                                                            }}
                                                                        >
                                                                            <MoreVertical size={16} color={isMenuOpen ? '#2563eb' : '#64748b'} />
                                                                        </button>

                                                                        {isMenuOpen && (
                                                                            <>
                                                                                <div
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        setActiveRowMenu(null);
                                                                                    }}
                                                                                    style={{
                                                                                        position: 'fixed',
                                                                                        top: 0,
                                                                                        left: 0,
                                                                                        right: 0,
                                                                                        bottom: 0,
                                                                                        zIndex: 9998,
                                                                                        cursor: 'default'
                                                                                    }}
                                                                                />
                                                                                <div
                                                                                    onClick={(e) => e.stopPropagation()}
                                                                                    style={{
                                                                                        position: 'absolute',
                                                                                        right: 0,
                                                                                        ...(menuOpenUpward ? { bottom: '100%', marginBottom: '6px' } : { top: '100%', marginTop: '6px' }),
                                                                                        backgroundColor: '#ffffff',
                                                                                        border: '1.5px solid #cbd5e1',
                                                                                        borderRadius: '8px',
                                                                                        boxShadow: '0 10px 25px rgba(0,0,0,0.16)',
                                                                                        zIndex: 9999,
                                                                                        width: '185px',
                                                                                        padding: '5px'
                                                                                    }}
                                                                                >
                                                                                    <button
                                                                                        onClick={() => {
                                                                                            setActiveRowMenu(null);
                                                                                            window.open(`/print-quote/${q.quote_id || q.id}`, '_blank');
                                                                                        }}
                                                                                        style={{ width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: 'transparent', fontSize: '0.84rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a', fontWeight: 600, borderRadius: '5px' }}
                                                                                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                                                                                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                                                                                    >
                                                                                        <Printer size={14} color="#ea580c" /> Print / View Quote PDF
                                                                                    </button>

                                                                                    <button
                                                                                        onClick={() => {
                                                                                            setActiveRowMenu(null);
                                                                                            openEmailModal(q);
                                                                                        }}
                                                                                        style={{ width: '100%', padding: '8px 12px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.84rem', color: '#0f172a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '5px' }}
                                                                                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                                                                                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                                                                                    >
                                                                                        <Mail size={14} color="#2563eb" /> Send Email
                                                                                    </button>

                                                                                    {(q.is_deleted === 1 || q.is_deleted === '1' || q.is_deleted === true) ? (
                                                                                        <button
                                                                                            onClick={() => {
                                                                                                setActiveRowMenu(null);
                                                                                                handleRestoreQuote(q);
                                                                                            }}
                                                                                            style={{ width: '100%', padding: '8px 12px', textAlign: 'left', background: 'none', border: 'none', borderTop: '1px solid #f1f5f9', marginTop: '4px', cursor: 'pointer', fontSize: '0.84rem', color: '#047857', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '5px' }}
                                                                                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#ecfdf5'; }}
                                                                                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                                                                                        >
                                                                                            <RotateCcw size={14} color="#047857" /> Recover Quote
                                                                                        </button>
                                                                                    ) : (
                                                                                        isAdmin && (
                                                                                            <button
                                                                                                onClick={() => {
                                                                                                    setActiveRowMenu(null);
                                                                                                    handleDeleteQuote(q);
                                                                                                }}
                                                                                                style={{ width: '100%', padding: '8px 12px', textAlign: 'left', background: 'none', border: 'none', borderTop: '1px solid #fee2e2', marginTop: '4px', cursor: 'pointer', fontSize: '0.84rem', color: '#dc2626', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '5px' }}
                                                                                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#fef2f2'; }}
                                                                                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                                                                                            >
                                                                                                <Trash2 size={14} color="#dc2626" /> Delete Quote
                                                                                            </button>
                                                                                        )
                                                                                    )}
                                                                                </div>
                                                                            </>
                                                                        )}
                                                                    </>
                                                                );
                                                            })()}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* Inline Expanded Line Items Drawer */}
                                            {isExpanded && (
                                                <tr style={{ backgroundColor: '#fffcf5' }}>
                                                    <td colSpan={SHOW_EXPAND_COLUMN ? 12 : 11} style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0' }}>
                                                        <div style={{
                                                            backgroundColor: '#ffffff',
                                                            borderRadius: '8px',
                                                            border: '1.5px solid #fed7aa',
                                                            padding: '16px',
                                                            boxShadow: '0 2px 8px rgba(234,88,12,0.06)'
                                                        }}>
                                                            <div style={{ fontWeight: 900, color: '#ea580c', marginBottom: '10px', fontSize: '0.9rem' }}>
                                                                Line Items for Quotation #{q.quote_number || q.quote_id}
                                                            </div>
                                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                                                <thead>
                                                                    <tr style={{ borderBottom: '1.5px solid #fed7aa', color: '#0f172a', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.75rem', backgroundColor: '#fff9f0' }}>
                                                                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Category & Particulars</th>
                                                                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Brand</th>
                                                                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Unit</th>
                                                                        <th style={{ padding: '8px 12px', textAlign: 'center' }}>Dimensions (W×H×D)</th>
                                                                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Qty</th>
                                                                        <th style={{ padding: '8px 12px', textAlign: 'center' }}>Disc %</th>
                                                                        <th style={{ padding: '8px 12px', textAlign: 'center' }}>GST %</th>
                                                                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Rate (₹)</th>
                                                                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Total (₹)</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {q.sections && q.sections.length > 0 ? (
                                                                        q.sections.flatMap((sec: any) => sec.items || []).map((item: any, iIdx: number) => (
                                                                            <tr key={iIdx} style={{ borderBottom: '1px solid #faf5ff' }}>
                                                                                <td style={{ padding: '8px 12px', fontWeight: 600, color: '#334155' }}>
                                                                                    {item.category && <span style={{ color: '#ea580c', fontWeight: 800, fontSize: '0.75rem', marginRight: '6px' }}>[{item.category}]</span>}
                                                                                    {item.particulars || 'Item Specification'}
                                                                                </td>
                                                                                <td style={{ padding: '8px 12px', color: '#64748b' }}>{item.brand || '—'}</td>
                                                                                <td style={{ padding: '8px 12px', color: '#64748b' }}>{item.unit || 'SFT'}</td>
                                                                                <td style={{ padding: '8px 12px', textAlign: 'center', color: '#334155' }}>
                                                                                    {item.width || item.height || item.sft ? `${item.width || 0} × ${item.height || 0} × ${item.sft || 0}` : '—'}
                                                                                </td>
                                                                                <td style={{ padding: '8px 12px', textAlign: 'right', color: '#334155' }}>{item.quantity || 1}</td>
                                                                                <td style={{ padding: '8px 12px', textAlign: 'center', color: '#ea580c', fontWeight: 700 }}>{item.discount_percent ? `${item.discount_percent}%` : '0%'}</td>
                                                                                <td style={{ padding: '8px 12px', textAlign: 'center', color: '#64748b' }}>{item.gst_rate !== undefined ? `${item.gst_rate}%` : '18%'}</td>
                                                                                <td style={{ padding: '8px 12px', textAlign: 'right', color: '#334155' }}>{formatINR(item.rate)}</td>
                                                                                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#ea580c' }}>{formatINR(item.amount)}</td>
                                                                            </tr>
                                                                        ))
                                                                    ) : (
                                                                        <>
                                                                            <tr style={{ borderBottom: '1px solid #faf5ff' }}>
                                                                                <td style={{ padding: '8px 12px', fontWeight: 600, color: '#334155' }}>Civil & Masonry Work Execution</td>
                                                                                <td style={{ padding: '8px 12px', color: '#64748b' }}>SFT</td>
                                                                                <td style={{ padding: '8px 12px', textAlign: 'right', color: '#334155' }}>450</td>
                                                                                <td style={{ padding: '8px 12px', textAlign: 'right', color: '#334155' }}>₹180.00</td>
                                                                                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>₹81,000.00</td>
                                                                            </tr>
                                                                            <tr style={{ borderBottom: '1px solid #faf5ff' }}>
                                                                                <td style={{ padding: '8px 12px', fontWeight: 600, color: '#334155' }}>Electrical Fixtures & Wiring Setup</td>
                                                                                <td style={{ padding: '8px 12px', color: '#64748b' }}>LS</td>
                                                                                <td style={{ padding: '8px 12px', textAlign: 'right', color: '#334155' }}>1</td>
                                                                                <td style={{ padding: '8px 12px', textAlign: 'right', color: '#334155' }}>₹46,440.00</td>
                                                                                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>₹46,440.00</td>
                                                                            </tr>
                                                                        </>
                                                                    )}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Footer */}
                <div style={{
                    padding: '12px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: '#ffffff',
                    borderTop: '1px solid #e2e8f0',
                    fontSize: '0.85rem'
                }}>
                    <div style={{ color: '#64748b' }}>
                        Page <span style={{ fontWeight: 700, color: '#0f172a' }}>{currentPage}</span> of <span style={{ fontWeight: 700, color: '#0f172a' }}>{totalPages}</span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            style={{
                                padding: '6px 14px',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                backgroundColor: currentPage === 1 ? '#f1f5f9' : '#ffffff',
                                color: currentPage === 1 ? '#94a3b8' : '#334155',
                                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                                fontWeight: 600
                            }}
                        >
                            Previous
                        </button>
                        <button
                            disabled={currentPage >= totalPages}
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            style={{
                                padding: '6px 14px',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                backgroundColor: currentPage >= totalPages ? '#f1f5f9' : '#ffffff',
                                color: currentPage >= totalPages ? '#94a3b8' : '#334155',
                                cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                                fontWeight: 600
                            }}
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>

            {/* 6. PREVIEW MODAL */}
            {previewModalQuote && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    padding: '20px'
                }}>
                    <div className="modal-box" style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '16px',
                        maxWidth: '700px',
                        width: '100%',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        border: '1px solid #cbd5e1'
                    }}>
                        <div className="modal-header" style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#ffffff', borderRadius: '16px 16px 0 0' }}>
                            <div>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                                    Quotation #{previewModalQuote.quote_number || previewModalQuote.quote_id}
                                </h3>
                                <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '2px' }}>
                                    Quoted To: {previewModalQuote.client_name || 'Client'} • Date: {formatDate(previewModalQuote.created_at)}
                                </div>
                            </div>
                            <button
                                onClick={() => setPreviewModalQuote(null)}
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="modal-body" style={{ padding: '24px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '10px' }}>
                                <div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>TOTAL AMOUNT</div>
                                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#2563eb', marginTop: '2px' }}>
                                        {formatINR(previewModalQuote.total_amount)}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>STATUS</div>
                                    <span style={{
                                        padding: '4px 12px',
                                        borderRadius: '12px',
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        display: 'inline-block',
                                        backgroundColor: '#fef3c7',
                                        color: '#d97706',
                                        marginTop: '4px'
                                    }}>
                                        {previewModalQuote.status || 'Created'}
                                    </span>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                                <button
                                    onClick={() => {
                                        const q = previewModalQuote;
                                        setPreviewModalQuote(null);
                                        openEmailModal(q);
                                    }}
                                    style={{
                                        flex: 1,
                                        padding: '12px',
                                        backgroundColor: '#fca412',
                                        color: '#ffffff',
                                        border: 'none',
                                        borderRadius: '8px',
                                        fontWeight: 800,
                                        fontSize: '0.9rem',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        boxShadow: '0 4px 14px rgba(252,164,18,0.35)'
                                    }}
                                >
                                    <Mail size={18} /> Send Quote to Client
                                </button>

                                <button
                                    onClick={() => {
                                        const qToOpen = previewModalQuote;
                                        setPreviewModalQuote(null);
                                        openQuoteWorkspace(qToOpen);
                                    }}
                                    style={{
                                        flex: 1,
                                        padding: '12px',
                                        backgroundColor: '#0c1527',
                                        color: '#ffffff',
                                        border: 'none',
                                        borderRadius: '8px',
                                        fontWeight: 700,
                                        fontSize: '0.9rem',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px'
                                    }}
                                >
                                    <Edit3 size={18} /> Open Full Editor
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* SEND QUOTE EMAIL MODAL */}
            {emailModalQuote && (
                <>
                    {/* Full 12+ Page QuoteTab printable container for exact Print Quote PDF rendering */}
                    {emailProject && (
                        <div style={{ position: 'absolute', top: 0, left: 0, visibility: 'hidden', zIndex: -1 }}>
                            <div id="email-quote-full-printable-area" style={{ width: '794px', backgroundColor: '#ffffff', position: 'fixed', top: '-9999px', left: '-9999px' }}>
                                <QuoteTab
                                    key={`email-quote-tab-${emailModalQuote?.quote_id || emailProject?.project_id}`}
                                    project={emailProject}
                                    quoteId={emailModalQuote?.quote_id}
                                    isReadOnly={true}
                                    hideSave={true}
                                    isAgreementPdfView={true}
                                    user={user}
                                    usersList={usersList}
                                />
                            </div>
                        </div>
                    )}

                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(12, 21, 39, 0.75)',
                        backdropFilter: 'blur(4px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1100,
                        padding: '16px',
                        boxSizing: 'border-box'
                    }}>
                        <div className="modal-box" style={{
                            backgroundColor: '#ffffff',
                            borderRadius: '16px',
                            width: '100%',
                            maxWidth: '640px',
                            maxHeight: 'min(92vh, 860px)',
                            display: 'flex',
                            flexDirection: 'column',
                            boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
                            border: '1.5px solid #ffe8c2',
                            overflow: 'hidden'
                        }}>
                            {/* Modal Header */}
                            <div className="modal-header" style={{
                                padding: '16px 20px',
                                backgroundColor: '#0c1527',
                                color: '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                flexShrink: 0
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ padding: '8px', backgroundColor: 'rgba(252,164,18,0.2)', borderRadius: '10px' }}>
                                        <Mail size={22} color="#fca412" />
                                    </div>
                                    <div>
                                        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                                            Send Quotation Proposal Email
                                        </h3>
                                        <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '2px 0 0 0' }}>
                                            Quotation #{emailModalQuote.quote_number || emailModalQuote.quote_id} • {emailModalQuote.client_name || 'Client'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setEmailModalQuote(null)}
                                    style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                                    title="Close"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Modal Form */}
                            <form onSubmit={handleSendQuoteEmail} style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0, overflow: 'hidden', margin: 0 }}>
                                <div className="modal-body" style={{ padding: '20px 24px', flex: '1 1 auto', overflowY: 'auto', minHeight: 0 }}>
                                    {/* Acknowledgement Feature Notice */}
                                    <div style={{
                                        backgroundColor: '#f0fdf4',
                                        border: '1px solid #bbf7d0',
                                        borderRadius: '10px',
                                        padding: '12px 16px',
                                        marginBottom: '16px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        fontSize: '0.84rem',
                                        color: '#166534'
                                    }}>
                                        <CheckCircle2 size={18} color="#16a34a" style={{ flexShrink: 0 }} />
                                        <div>
                                            <strong>Quotation Acknowledgement Active:</strong> Email automatically includes <strong>Accept</strong> &amp; <strong>Reject</strong> buttons. When the client clicks <strong>Accept</strong>, the lead converts to a project automatically!
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#0c1527', marginBottom: '6px', textTransform: 'uppercase' }}>
                                                From (Sender Email)
                                            </label>
                                            <input
                                                type="email"
                                                required
                                                value={emailForm.from}
                                                onChange={(e) => setEmailForm({ ...emailForm, from: e.target.value })}
                                                style={{
                                                    width: '100%',
                                                    padding: '10px 14px',
                                                    borderRadius: '8px',
                                                    border: '1.5px solid #cbd5e1',
                                                    fontSize: '0.9rem',
                                                    color: '#0c1527',
                                                    fontWeight: 600,
                                                    backgroundColor: '#f8fafc'
                                                }}
                                            />
                                        </div>

                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#0c1527', marginBottom: '6px', textTransform: 'uppercase' }}>
                                                To (Client Email)
                                            </label>
                                            <input
                                                type="email"
                                                required
                                                placeholder="client@example.com"
                                                value={emailForm.to}
                                                onChange={(e) => setEmailForm({ ...emailForm, to: e.target.value })}
                                                style={{
                                                    width: '100%',
                                                    padding: '10px 14px',
                                                    borderRadius: '8px',
                                                    border: '1.5px solid #fca412',
                                                    fontSize: '0.9rem',
                                                    color: '#0c1527',
                                                    fontWeight: 700,
                                                    outline: 'none',
                                                    boxShadow: '0 0 0 3px rgba(252,164,18,0.15)'
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <div style={{ marginBottom: '16px' }}>
                                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#0c1527', marginBottom: '6px', textTransform: 'uppercase' }}>
                                            Email Subject
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={emailForm.subject}
                                            onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })}
                                            style={{
                                                width: '100%',
                                                padding: '10px 14px',
                                                borderRadius: '8px',
                                                border: '1.5px solid #cbd5e1',
                                                fontSize: '0.9rem',
                                                color: '#0c1527',
                                                fontWeight: 600
                                            }}
                                        />
                                    </div>

                                    {/* PDF Attachment Controls & Multi-Document Selection */}
                                    <div style={{
                                        backgroundColor: '#fff9f0',
                                        border: '1.5px dashed #fca412',
                                        padding: '16px',
                                        borderRadius: '12px',
                                        marginBottom: '16px'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <Paperclip size={18} color="#fca412" />
                                                <div>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0c1527' }}>
                                                        {includeQuotePdf && includeAgreementPdf ? 'Merged Package PDF (Agreement + Quote)' : (includeAgreementPdf ? 'Works Contract Agreement PDF' : 'Official Quotation PDF')}
                                                    </div>
                                                    <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                                                        {includeQuotePdf && includeAgreementPdf ? 'Agreement_and_Quotation_Package.pdf' : `Quotation_${emailModalQuote.quote_number || emailModalQuote.quote_id}.pdf`}
                                                    </div>
                                                </div>
                                            </div>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 800, padding: '4px 10px', borderRadius: '12px', backgroundColor: includeQuotePdf && includeAgreementPdf ? '#e0e7ff' : '#dcfce7', color: includeQuotePdf && includeAgreementPdf ? '#3730a3' : '#15803d' }}>
                                                {includeQuotePdf && includeAgreementPdf ? 'Merged PDF Package' : 'Auto Generated'}
                                            </span>
                                        </div>

                                        {/* Multi-document Selection Checkboxes */}
                                        <div style={{ backgroundColor: '#ffffff', padding: '12px 14px', borderRadius: '8px', border: '1px solid #fed7aa', marginBottom: '12px' }}>
                                            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0c1527', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                                                Select Documents to Include in Email Attachment:
                                            </div>
                                            <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap' }}>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={includeQuotePdf}
                                                        onChange={(e) => setIncludeQuotePdf(e.target.checked)}
                                                        style={{ width: '16px', height: '16px', accentColor: '#fca412', cursor: 'pointer' }}
                                                    />
                                                    <span>Quotation PDF</span>
                                                </label>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.88rem', fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={includeAgreementPdf}
                                                        onChange={(e) => setIncludeAgreementPdf(e.target.checked)}
                                                        style={{ width: '16px', height: '16px', accentColor: '#fca412', cursor: 'pointer' }}
                                                    />
                                                    <span>
                                                        Works Contract Agreement PDF {isAgreementSigned ? '(Signed & Available)' : '(Agreement Contract)'}
                                                    </span>
                                                </label>
                                            </div>
                                            {includeQuotePdf && includeAgreementPdf && (
                                                <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#4338ca', fontWeight: 700, backgroundColor: '#e0e7ff', padding: '4px 10px', borderRadius: '6px' }}>
                                                    ✨ Both documents selected! They will be combined into a single merged PDF attachment.
                                                </div>
                                            )}
                                        </div>

                                        {/* 👁️ Hide Categories & Fields in PDF Panel */}
                                        <div style={{
                                            backgroundColor: '#ffffff',
                                            border: '1.5px solid #fed7aa',
                                            borderRadius: '10px',
                                            marginBottom: '12px',
                                            overflow: 'hidden'
                                        }}>
                                            <div
                                                onClick={() => setShowEmailHideFieldsPanel(!showEmailHideFieldsPanel)}
                                                style={{
                                                    padding: '10px 14px',
                                                    backgroundColor: '#fffdfa',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    cursor: 'pointer',
                                                    borderBottom: showEmailHideFieldsPanel ? '1px solid #fed7aa' : 'none'
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem', fontWeight: 800, color: '#0c1527' }}>
                                                    <span>👁️ Hide Categories & Fields in Print / Email PDF</span>
                                                    {Object.values(emailHiddenFields).filter(Boolean).length > 0 && (
                                                        <span style={{ fontSize: '0.7rem', backgroundColor: '#ea580c', color: '#ffffff', padding: '2px 8px', borderRadius: '10px', fontWeight: 800 }}>
                                                            {Object.values(emailHiddenFields).filter(Boolean).length} Hidden
                                                        </span>
                                                    )}
                                                </div>
                                                <span style={{ fontSize: '0.78rem', color: '#ea580c', fontWeight: 800 }}>
                                                    {showEmailHideFieldsPanel ? '▼ Hide Toggles' : '► Configure PDF Toggles'}
                                                </span>
                                            </div>

                                            {showEmailHideFieldsPanel && (
                                                <div style={{ padding: '14px', backgroundColor: '#ffffff' }}>
                                                    <p style={{ fontSize: '0.76rem', color: '#64748b', margin: '0 0 10px 0', fontWeight: 600 }}>
                                                        Select fields to hide in the emailed PDF proposal:
                                                    </p>
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                                        {[
                                                            { key: 'particulars', label: 'Hide Product Description Column' },
                                                            { key: 'qty', label: 'Hide QTY Column' },
                                                            { key: 'discount', label: 'Hide Disc % Column' },
                                                            { key: 'amount', label: 'Hide Amount Column' },
                                                            { key: 'shutterMaterial', label: 'Hide Shutter Material' },
                                                            { key: 'carcassMaterial', label: 'Hide Carcass Material' },
                                                            { key: 'dimensions', label: 'Hide Dimensions Column' },
                                                            { key: 'rate', label: 'Hide Rate Column' },
                                                            { key: 'categoryDiscount', label: 'Hide Category Discounts' },
                                                            { key: 'promoCode', label: 'Hide Promo Code Line' },
                                                            { key: 'generalDiscount', label: 'Hide Flat / General Discount Line' },
                                                            { key: 'additionalCharges', label: 'Hide Additional Charges Line' },
                                                            { key: 'gst', label: 'Hide GST Column & Line' },
                                                            { key: 'roundOff', label: 'Hide Round Off Line' }
                                                        ].map((item) => (
                                                            <label
                                                                key={item.key}
                                                                style={{
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '8px',
                                                                    fontSize: '0.8rem',
                                                                    fontWeight: 700,
                                                                    color: emailHiddenFields[item.key] ? '#c2410c' : '#334155',
                                                                    backgroundColor: emailHiddenFields[item.key] ? '#fff7ed' : '#f8fafc',
                                                                    padding: '6px 10px',
                                                                    borderRadius: '6px',
                                                                    border: emailHiddenFields[item.key] ? '1px solid #fed7aa' : '1px solid #e2e8f0',
                                                                    cursor: 'pointer'
                                                                }}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={!!emailHiddenFields[item.key]}
                                                                    onChange={(e) => setEmailHiddenFields(prev => ({ ...prev, [item.key]: e.target.checked }))}
                                                                    style={{ width: '15px', height: '15px', accentColor: '#ea580c', cursor: 'pointer' }}
                                                                />
                                                                <span>{item.label}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed #fed7aa' }}>
                                            <button
                                                type="button"
                                                onClick={handlePrintOfficialQuote}
                                                style={{
                                                    padding: '6px 12px',
                                                    borderRadius: '6px',
                                                    border: '1px solid #ea580c',
                                                    backgroundColor: '#ffffff',
                                                    color: '#ea580c',
                                                    fontSize: '0.78rem',
                                                    fontWeight: 700,
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px'
                                                }}
                                            >
                                                <Printer size={14} /> Print / Save Browser PDF
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#0c1527', marginBottom: '6px', textTransform: 'uppercase' }}>
                                            Email Message Body Content
                                        </label>
                                        <textarea
                                            rows={4}
                                            required
                                            value={emailForm.content}
                                            onChange={(e) => setEmailForm({ ...emailForm, content: e.target.value })}
                                            style={{
                                                width: '100%',
                                                padding: '10px 12px',
                                                borderRadius: '8px',
                                                border: '1.5px solid #cbd5e1',
                                                color: '#0c1527',
                                                fontFamily: 'inherit',
                                                lineHeight: 1.5,
                                                fontSize: '0.88rem',
                                                minHeight: '75px',
                                                maxHeight: '160px',
                                                resize: 'vertical'
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Modal Footer Actions - Fixed at Bottom */}
                                <div style={{
                                    padding: '14px 20px',
                                    backgroundColor: '#f8fafc',
                                    borderTop: '1px solid #e2e8f0',
                                    display: 'flex',
                                    gap: '10px',
                                    justifyContent: 'flex-end',
                                    alignItems: 'center',
                                    flexWrap: 'wrap',
                                    flexShrink: 0
                                }}>
                                    <button
                                        type="button"
                                        onClick={handlePrintOfficialQuote}
                                        style={{
                                            padding: '9px 16px',
                                            borderRadius: '8px',
                                            border: '1.5px solid #0c1527',
                                            backgroundColor: '#ffffff',
                                            color: '#0c1527',
                                            fontWeight: 800,
                                            fontSize: '0.85rem',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}
                                    >
                                        <Eye size={16} />
                                        Print / Preview Official Quote
                                    </button>

                                    <button
                                        type="submit"
                                        disabled={sendingEmail}
                                        style={{
                                            padding: '9px 20px',
                                            borderRadius: '8px',
                                            border: 'none',
                                            backgroundColor: '#fca412',
                                            color: '#ffffff',
                                            fontWeight: 800,
                                            fontSize: '0.85rem',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            boxShadow: '0 4px 14px rgba(252,164,18,0.35)',
                                            opacity: sendingEmail ? 0.7 : 1
                                        }}
                                    >
                                        {sendingEmail ? <RotateCcw className="animate-spin" size={16} /> : <Send size={16} />}
                                        {sendingEmail ? 'Sending Email...' : 'Send Mail to Client'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </>
            )}

            {/* VENDOR QUOTA CREATION MODAL */}
            {vendorQuotaModalQuote && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(12, 21, 39, 0.75)',
                    backdropFilter: 'blur(4px)',
                    zIndex: 1100,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px'
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '20px',
                        width: '95vw',
                        maxWidth: '1450px',
                        maxHeight: '92vh',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
                        border: '1.5px solid #ffe8c2'
                    }}>
                        {/* Header */}
                        <div style={{
                            padding: '20px 24px',
                            backgroundColor: '#0c1527',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            borderBottom: '2px solid #fca412'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '10px',
                                    backgroundColor: '#fca412',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#0c1527'
                                }}>
                                    <ShoppingCart size={22} />
                                </div>
                                <div>
                                    <div style={{ fontWeight: 800, fontSize: '1.15rem', color: '#ffffff' }}>
                                        Create Vendor Quotation &amp; Assign Materials
                                    </div>
                                    <div style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>
                                        Quotation #{vendorQuotaModalQuote.quote_number || vendorQuotaModalQuote.quote_id} | Project: {vendorQuotaModalQuote.project_name || 'N/A'} ({vendorQuotaModalQuote.client_name || 'Client'})
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setVendorQuotaModalQuote(null)}
                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
                            >
                                <X size={22} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
                            {vendorQuotaSuccess && (
                                <div style={{ padding: '14px 18px', backgroundColor: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: '10px', color: '#166534', fontWeight: 700, fontSize: '0.9rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <CheckCircle2 size={20} color="#16a34a" />
                                    {vendorQuotaSuccess}
                                </div>
                            )}

                            {/* Quick Assign Bar */}
                            <div style={{ padding: '16px', backgroundColor: '#fff9f0', borderRadius: '12px', border: '1.5px solid #ffe8c2', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                                <div style={{ fontWeight: 800, color: '#0c1527', fontSize: '0.88rem' }}>
                                    ⚡ Quick Assign All Modules to a Single Vendor:
                                </div>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                    <select
                                        onChange={(e) => {
                                            const v = e.target.value;
                                            if (!v) return;
                                            const items = getQuoteItems(vendorQuotaModalQuote);
                                            const updated: Record<number, string> = {};
                                            items.forEach((_, idx) => { updated[idx] = v; });
                                            setItemVendorAssignments(updated);
                                        }}
                                        style={{ padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontWeight: 700, fontSize: '0.85rem', color: '#0c1527' }}
                                    >
                                        <option value="">Select Vendor to Apply All...</option>
                                        {availableVendors.map((v: any, idx: number) => (
                                            <option key={idx} value={v.vendor_name || v}>{v.vendor_name || v}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Table of Modules & Items matching Quotation Table styling */}
                            <div style={{ borderRadius: '12px', border: '1px solid #fed7aa', overflowX: 'auto', marginBottom: '20px', backgroundColor: '#ffffff' }}>
                                <table style={{ width: '100%', minWidth: '1250px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: 'rgb(254, 143, 62)', color: '#ffffff', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.80rem' }}>
                                            <th style={{ padding: '10px 10px', textAlign: 'center', width: '40px', borderRight: '1px solid rgba(255,255,255,0.25)' }}>#</th>
                                            <th style={{ padding: '10px 12px', borderRight: '1px solid rgba(255,255,255,0.25)' }}>Product Description / Particulars</th>
                                            <th style={{ padding: '10px 10px', textAlign: 'center', width: '120px', borderRight: '1px solid rgba(255,255,255,0.25)' }}>Shutter Material</th>
                                            <th style={{ padding: '10px 10px', textAlign: 'center', width: '120px', borderRight: '1px solid rgba(255,255,255,0.25)' }}>Carcass Material</th>
                                            <th style={{ padding: '10px 10px', textAlign: 'center', width: '120px', borderRight: '1px solid rgba(255,255,255,0.25)' }}>Dimensions</th>
                                            <th style={{ padding: '10px 10px', textAlign: 'center', width: '90px', borderRight: '1px solid rgba(255,255,255,0.25)' }}>Rate / SFT (₹)</th>
                                            <th style={{ padding: '10px 10px', textAlign: 'center', width: '50px', borderRight: '1px solid rgba(255,255,255,0.25)' }}>QTY</th>
                                            <th style={{ padding: '10px 10px', textAlign: 'center', width: '65px', borderRight: '1px solid rgba(255,255,255,0.25)' }}>Disc %</th>
                                            <th style={{ padding: '10px 10px', textAlign: 'center', width: '60px', borderRight: '1px solid rgba(255,255,255,0.25)' }}>GST %</th>
                                            <th style={{ padding: '10px 12px', textAlign: 'right', width: '100px', borderRight: '1px solid rgba(255,255,255,0.25)' }}>Amount (₹)</th>
                                            <th style={{ padding: '10px 12px', minWidth: '180px', textAlign: 'center' }}>Assign Vendor</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(() => {
                                            const items = getQuoteItems(vendorQuotaModalQuote);
                                            let itemCounter = 0;
                                            return items.map((item, idx) => {
                                                const isHeader = item.brand === 'HEADER';
                                                if (isHeader) {
                                                    itemCounter = 0;
                                                    let subTotal = 0;
                                                    for (let k = idx + 1; k < items.length; k++) {
                                                        if (items[k].brand === 'HEADER') break;
                                                        const kRate = customVendorItems[k]?.rate ?? items[k].rate ?? items[k].rate_per_sft ?? 0;
                                                        const kDisc = customVendorItems[k]?.discount_percent ?? items[k].discount_percent ?? 0;
                                                        const kGst = customVendorItems[k]?.gst_rate ?? items[k].gst_rate ?? 18;
                                                        const kQty = items[k].quantity || 1;
                                                        const kNetRate = kRate * (1 - kDisc / 100);
                                                        const kBaseAmt = kNetRate * kQty;
                                                        subTotal += (kBaseAmt + (kBaseAmt * (kGst / 100)));
                                                    }
                                                    return (
                                                        <tr key={idx} style={{ backgroundColor: '#fff7ed', borderTop: '1.5px solid #fed7aa', borderBottom: '2px solid #ea580c' }}>
                                                            <td colSpan={9} style={{ padding: '8px 12px', fontWeight: 900, color: '#ea580c', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                                {item.particulars}
                                                            </td>
                                                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 900, color: '#ea580c', fontSize: '0.90rem' }}>
                                                                ₹{subTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                                            </td>
                                                            <td></td>
                                                        </tr>
                                                    );
                                                }

                                                itemCounter++;
                                                const currentRate = customVendorItems[idx]?.rate ?? item.rate ?? item.rate_per_sft ?? 0;
                                                const currentDisc = customVendorItems[idx]?.discount_percent ?? item.discount_percent ?? 0;
                                                const currentGst = customVendorItems[idx]?.gst_rate ?? item.gst_rate ?? 18;
                                                const qty = customVendorItems[idx]?.quantity ?? item.quantity ?? 1;

                                                const netRate = currentRate * (1 - currentDisc / 100);
                                                const baseAmt = netRate * qty;
                                                const derivedAmount = baseAmt + (baseAmt * (currentGst / 100));

                                                return (
                                                    <tr key={idx} style={{ borderBottom: '1px solid #fed7aa', backgroundColor: itemVendorAssignments[idx] ? '#f0fdf4' : '#ffffff' }}>
                                                        <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: '#64748b', borderRight: '1px solid #fcd34d' }}>{itemCounter}</td>
                                                        <td style={{ padding: '8px 10px', borderRight: '1px solid #e2e8f0', minWidth: '220px' }}>
                                                            <div style={{ fontWeight: 800, color: '#0c1527', fontSize: '0.86rem', lineHeight: '1.35', wordBreak: 'break-word', marginBottom: '4px' }}>
                                                                {customVendorItems[idx]?.particulars ?? item.particulars ?? item.raw_particulars ?? 'Item Specification'}
                                                            </div>
                                                            {(customVendorItems[idx]?.description || item.description) && (
                                                                <div style={{ fontSize: '0.78rem', color: '#475569', lineHeight: '1.35', wordBreak: 'break-word', whiteSpace: 'pre-line' }}>
                                                                    {customVendorItems[idx]?.description || item.description}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td style={{ padding: '10px 8px', textAlign: 'center', color: '#475569', borderRight: '1px solid #e2e8f0', fontSize: '0.80rem' }}>{item.brand || '—'}</td>
                                                        <td style={{ padding: '10px 8px', textAlign: 'center', color: '#475569', borderRight: '1px solid #e2e8f0', fontSize: '0.80rem' }}>{item.unit || '—'}</td>
                                                        <td style={{ padding: '6px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                                                            {(() => {
                                                                const isLumpsum = (customVendorItems[idx]?.pricing_mode ?? item.pricing_mode) === 'lumpsum';
                                                                const currentMode = customVendorItems[idx]?.pricing_mode ?? (isLumpsum ? 'lumpsum' : 'dimensions');

                                                                if (canEditVendorPrices) {
                                                                    return (
                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                                                                            <select
                                                                                value={currentMode}
                                                                                onChange={(e) => {
                                                                                    const mode = e.target.value;
                                                                                    setCustomVendorItems(prev => ({
                                                                                        ...prev,
                                                                                        [idx]: {
                                                                                            ...prev[idx],
                                                                                            pricing_mode: mode,
                                                                                            width: '',
                                                                                            height: '',
                                                                                            sft: '',
                                                                                            rate: 0
                                                                                        }
                                                                                    }));
                                                                                }}
                                                                                style={{
                                                                                    fontSize: '0.72rem',
                                                                                    fontWeight: 700,
                                                                                    padding: '2px 4px',
                                                                                    borderRadius: '4px',
                                                                                    border: '1px solid #cbd5e1',
                                                                                    outline: 'none',
                                                                                    backgroundColor: currentMode === 'lumpsum' ? '#f0fdf4' : '#ffffff',
                                                                                    color: currentMode === 'lumpsum' ? '#16a34a' : '#334155',
                                                                                    cursor: 'pointer'
                                                                                }}
                                                                            >
                                                                                <option value="dimensions">📐 Dimensions</option>
                                                                                <option value="lumpsum">💰 Lumpsum</option>
                                                                            </select>

                                                                            {currentMode === 'lumpsum' ? (
                                                                                <div style={{ color: '#16a34a', fontWeight: 800, fontSize: '0.78rem', backgroundColor: '#f0fdf4', padding: '2px 6px', borderRadius: '4px', border: '1px solid #bbf7d0' }}>
                                                                                    Lumpsum
                                                                                </div>
                                                                            ) : (
                                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'center' }}>
                                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>
                                                                                        <span>W:</span>
                                                                                        <input
                                                                                            type="text"
                                                                                            value={customVendorItems[idx]?.width ?? item.width ?? ''}
                                                                                            placeholder="W"
                                                                                            onChange={(e) => setCustomVendorItems(prev => ({ ...prev, [idx]: { ...prev[idx], width: e.target.value } }))}
                                                                                            style={{ width: '58px', padding: '2px 4px', border: '1px solid #cbd5e1', borderRadius: '4px', textAlign: 'center', fontWeight: 600, fontSize: '0.78rem', outline: 'none', backgroundColor: '#ffffff' }}
                                                                                        />
                                                                                    </div>
                                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>
                                                                                        <span>H:</span>
                                                                                        <input
                                                                                            type="text"
                                                                                            value={customVendorItems[idx]?.height ?? item.height ?? ''}
                                                                                            placeholder="H"
                                                                                            onChange={(e) => setCustomVendorItems(prev => ({ ...prev, [idx]: { ...prev[idx], height: e.target.value } }))}
                                                                                            style={{ width: '58px', padding: '2px 4px', border: '1px solid #cbd5e1', borderRadius: '4px', textAlign: 'center', fontWeight: 600, fontSize: '0.78rem', outline: 'none', backgroundColor: '#ffffff' }}
                                                                                        />
                                                                                    </div>
                                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>
                                                                                        <span>D:</span>
                                                                                        <input
                                                                                            type="text"
                                                                                            value={customVendorItems[idx]?.sft ?? item.sft ?? ''}
                                                                                            placeholder="D"
                                                                                            onChange={(e) => setCustomVendorItems(prev => ({ ...prev, [idx]: { ...prev[idx], sft: e.target.value } }))}
                                                                                            style={{ width: '58px', padding: '2px 4px', border: '1px solid #cbd5e1', borderRadius: '4px', textAlign: 'center', fontWeight: 600, fontSize: '0.78rem', outline: 'none', backgroundColor: '#ffffff' }}
                                                                                        />
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                }

                                                                return isLumpsum ? (
                                                                    <span style={{ color: '#16a34a', fontWeight: 800, fontSize: '0.78rem', backgroundColor: '#f0fdf4', padding: '2px 6px', borderRadius: '4px', border: '1px solid #bbf7d0' }}>
                                                                        Lumpsum
                                                                    </span>
                                                                ) : (
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center', lineHeight: '1.3' }}>
                                                                        {item.width && <div>W: {item.width}</div>}
                                                                        {item.height && <div>H: {item.height}</div>}
                                                                        {item.sft && <div>D: {item.sft}</div>}
                                                                    </div>
                                                                );
                                                            })()}
                                                        </td>
                                                        <td style={{ padding: '6px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                                                            {canEditVendorPrices ? (
                                                                <input
                                                                    type="number"
                                                                    value={currentRate || ''}
                                                                    placeholder="0"
                                                                    onChange={(e) => {
                                                                        const val = parseFloat(e.target.value) || 0;
                                                                        setCustomVendorItems(prev => ({ ...prev, [idx]: { ...prev[idx], rate: val } }));
                                                                    }}
                                                                    style={{ width: '75px', padding: '4px 6px', border: '1px solid #f97316', borderRadius: '5px', textAlign: 'center', fontWeight: 700, fontSize: '0.84rem', outline: 'none', backgroundColor: '#fff7ed', color: '#c2410c' }}
                                                                />
                                                            ) : (
                                                                <span style={{ fontWeight: 700, color: '#0c1527' }}>₹{currentRate.toLocaleString('en-IN')}</span>
                                                            )}
                                                        </td>
                                                        <td style={{ padding: '6px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                                                            {canEditVendorPrices ? (
                                                                <input
                                                                    type="number"
                                                                    value={qty}
                                                                    placeholder="1"
                                                                    onChange={(e) => {
                                                                        const val = parseFloat(e.target.value) || 1;
                                                                        setCustomVendorItems(prev => ({ ...prev, [idx]: { ...prev[idx], quantity: val } }));
                                                                    }}
                                                                    style={{ width: '55px', padding: '4px 6px', border: '1px solid #3b82f6', borderRadius: '5px', textAlign: 'center', fontWeight: 700, fontSize: '0.84rem', outline: 'none', backgroundColor: '#eff6ff', color: '#1d4ed8' }}
                                                                />
                                                            ) : (
                                                                <span style={{ fontWeight: 700, color: '#0c1527' }}>{qty}</span>
                                                            )}
                                                        </td>
                                                        <td style={{ padding: '6px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                                                            {canEditVendorPrices ? (
                                                                <input
                                                                    type="number"
                                                                    value={currentDisc}
                                                                    placeholder="0"
                                                                    onChange={(e) => {
                                                                        const val = parseFloat(e.target.value) || 0;
                                                                        setCustomVendorItems(prev => ({ ...prev, [idx]: { ...prev[idx], discount_percent: val } }));
                                                                    }}
                                                                    style={{ width: '55px', padding: '4px 4px', border: '1px solid #10b981', borderRadius: '5px', textAlign: 'center', fontWeight: 700, fontSize: '0.84rem', outline: 'none', backgroundColor: '#f0fdf4', color: '#047857' }}
                                                                />
                                                            ) : (
                                                                <span style={{ fontWeight: 700, color: '#ea580c' }}>{currentDisc}%</span>
                                                            )}
                                                        </td>
                                                        <td style={{ padding: '6px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                                                            {canEditVendorPrices ? (
                                                                <input
                                                                    type="number"
                                                                    value={currentGst}
                                                                    placeholder="18"
                                                                    onChange={(e) => {
                                                                        const val = parseFloat(e.target.value) || 0;
                                                                        setCustomVendorItems(prev => ({ ...prev, [idx]: { ...prev[idx], gst_rate: val } }));
                                                                    }}
                                                                    style={{ width: '55px', padding: '4px 4px', border: '1px solid #8b5cf6', borderRadius: '5px', textAlign: 'center', fontWeight: 700, fontSize: '0.84rem', outline: 'none', backgroundColor: '#f5f3ff', color: '#6d28d9' }}
                                                                />
                                                            ) : (
                                                                <span style={{ fontWeight: 700, color: '#475569' }}>{currentGst}%</span>
                                                            )}
                                                        </td>
                                                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 900, color: '#ea580c', borderRight: '1px solid #e2e8f0', fontSize: '0.88rem' }}>
                                                            ₹{derivedAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                                        </td>
                                                        <td style={{ padding: '8px 10px' }}>
                                                            <select
                                                                value={itemVendorAssignments[idx] || ''}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    setItemVendorAssignments(prev => ({ ...prev, [idx]: val }));
                                                                }}
                                                                style={{
                                                                    width: '100%',
                                                                    padding: '6px 8px',
                                                                    borderRadius: '6px',
                                                                    border: itemVendorAssignments[idx] ? '1.5px solid #16a34a' : '1.5px solid #cbd5e1',
                                                                    backgroundColor: itemVendorAssignments[idx] ? '#f0fdf4' : '#ffffff',
                                                                    fontWeight: 700,
                                                                    fontSize: '0.80rem',
                                                                    color: '#0c1527',
                                                                    outline: 'none'
                                                                }}
                                                            >
                                                                <option value="">-- Choose Vendor --</option>
                                                                {availableVendors.map((v: any, vIdx: number) => (
                                                                    <option key={vIdx} value={v.vendor_name || v}>{v.vendor_name || v} ({v.vendor_type || 'Vendor'})</option>
                                                                ))}
                                                            </select>
                                                        </td>
                                                    </tr>
                                                );
                                            });
                                        })()}
                                    </tbody>
                                </table>
                            </div>

                            {/* Summary per Vendor */}
                            <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                <div style={{ fontWeight: 800, color: '#0c1527', marginBottom: '10px', fontSize: '0.88rem' }}>
                                    📊 Assigned Vendor Breakdown:
                                </div>
                                {(() => {
                                    const items = getQuoteItems(vendorQuotaModalQuote);
                                    const breakdown: Record<string, { count: number, total: number }> = {};
                                    items.forEach((it, idx) => {
                                        if (it.brand === 'HEADER') return;
                                        const v = itemVendorAssignments[idx];
                                        if (v) {
                                            const baseRate = customVendorItems[idx]?.rate ?? it.rate ?? it.rate_per_sft ?? 0;
                                            const disc = customVendorItems[idx]?.discount_percent ?? it.discount_percent ?? 0;
                                            const gst = customVendorItems[idx]?.gst_rate ?? it.gst_rate ?? 18;
                                            const qty = it.quantity || 1;
                                            const netRate = baseRate * (1 - disc / 100);
                                            const baseAmt = netRate * qty;
                                            const derivedAmount = baseAmt + (baseAmt * (gst / 100));

                                            if (!breakdown[v]) breakdown[v] = { count: 0, total: 0 };
                                            breakdown[v].count += 1;
                                            breakdown[v].total += derivedAmount;
                                        }
                                    });
                                    const entries = Object.entries(breakdown);
                                    if (entries.length === 0) {
                                        return <div style={{ fontSize: '0.82rem', color: '#94a3b8', fontStyle: 'italic' }}>No vendors assigned yet. Select a vendor for each material/module above.</div>;
                                    }
                                    return (
                                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                            {entries.map(([vName, summary], eIdx) => (
                                                <div key={eIdx} style={{ backgroundColor: '#ffffff', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #fed7aa', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <span style={{ fontWeight: 800, color: '#0c1527', fontSize: '0.85rem' }}>{vName}:</span>
                                                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{summary.count} Item(s)</span>
                                                    <span style={{ fontWeight: 800, color: '#ea580c', fontSize: '0.85rem' }}>₹{summary.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div style={{ padding: '16px 24px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <button
                                onClick={() => setVendorQuotaModalQuote(null)}
                                style={{ padding: '10px 20px', borderRadius: '8px', border: '1.5px solid #cbd5e1', backgroundColor: '#ffffff', color: '#64748b', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveVendorQuota}
                                disabled={savingVendorQuota}
                                style={{
                                    padding: '10px 24px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    backgroundColor: '#fca412',
                                    color: '#ffffff',
                                    fontWeight: 800,
                                    fontSize: '0.88rem',
                                    cursor: savingVendorQuota ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    boxShadow: '0 4px 14px rgba(252,164,18,0.35)',
                                    opacity: savingVendorQuota ? 0.7 : 1
                                }}
                            >
                                {savingVendorQuota ? <RotateCcw className="animate-spin" size={18} /> : <ShoppingCart size={18} />}
                                {savingVendorQuota ? 'Saving Quotation...' : 'Generate & Save Vendor Quotation PDF'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CREATE NEW QUOTATION MODAL WITH LEAD AUTO-FILL */}
            {showCreateModal && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.65)',
                    backdropFilter: 'blur(4px)',
                    zIndex: 9999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px'
                }}>
                    <div className="modal-box" style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '16px',
                        width: '100%',
                        maxWidth: '680px',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
                        border: '1px solid #e2e8f0'
                    }}>
                        {/* Modal Header */}
                        <div className="modal-header" style={{
                            padding: '16px 24px',
                            borderBottom: '1.5px solid #e2e8f0',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            backgroundColor: '#ffffff',
                            borderRadius: '16px 16px 0 0'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                <img src={liveLogo} alt="Livincart Logo" style={{ height: '40px', objectFit: 'contain' }} />
                                <div>
                                    <div style={{ fontSize: '1.12rem', fontWeight: 900, color: '#000000', lineHeight: 1.2, letterSpacing: '-0.2px' }}>
                                        Livincart Private Limited
                                    </div>
                                    <div style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 600, marginTop: '2px' }}>
                                        Office Interiors &amp; Architecture Workspace
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setShowCreateModal(false);
                                    setIsInitialQuoteFlow(false);
                                }}
                                style={{ background: '#f1f5f9', border: 'none', cursor: 'pointer', color: '#475569', padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Sub-Header */}
                        <div style={{
                            padding: '12px 24px',
                            backgroundColor: '#f8fafc',
                            borderBottom: '1px solid #e2e8f0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '10px'
                        }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                                    {isInitialQuoteFlow ? '⭐ Create Initial Quotation Workspace' : '+ Create New Quotation Workspace'}
                                </h3>
                                <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                                    {isInitialQuoteFlow
                                        ? 'Lead enquiry details are frozen for this initial quotation proposal.'
                                        : 'Enter or select a Project / Client ID to auto-fill saved lead details automatically.'}
                                </p>
                            </div>
                        </div>

                        <div className="modal-body" style={{ padding: '24px' }}>
                            {/* Modal Form */}
                            <form onSubmit={async (e) => {
                                e.preventDefault();
                                setSubmittingCreate(true);
                                try {
                                    const matchedLead = leadsList.find((l: any) =>
                                        String(l.manual_client_id).toLowerCase() === createFormData.project_id.toLowerCase() ||
                                        String(l.lead_id) === createFormData.project_id ||
                                        `PR-LEAD-${l.lead_id}`.toLowerCase() === createFormData.project_id.toLowerCase()
                                    );

                                    if (isDesignerRole) {
                                        const isLeadAllowed = isLeadAssignedToDesigner(matchedLead, effectiveUser);
                                        const isProjAllowed = rawProjects.some((p: any) =>
                                            (String(p.project_id) === createFormData.project_id || p.project_code === createFormData.project_id) &&
                                            isProjectAssignedToDesigner(p, effectiveUser, leadsList)
                                        );
                                        if (!isLeadAllowed && !isProjAllowed) {
                                            alert('Access Restricted: You are only permitted to create quotations for projects assigned to you.');
                                            setSubmittingCreate(false);
                                            return;
                                        }
                                    }

                                    const existingQ = rawQuotes.find((q: any) => {
                                        const qid = String(q.quote_id || '');
                                        if (!qid || qid.startsWith('lead-') || qid.startsWith('p-') || q.is_placeholder || q.is_synthetic) return false;
                                        const num = Number(qid);
                                        if (isNaN(num) || num <= 0) return false;

                                        const qPid = String(q.project_id || '').toLowerCase().trim();
                                        const qLeadId = String(q.lead_id || '').toLowerCase().trim();
                                        const qCode = String(q.project_code || '').toLowerCase().trim();
                                        const lid = String(matchedLead?.lead_id || '').toLowerCase().trim();
                                        const mcId = String(matchedLead?.manual_client_id || createFormData.project_id || '').toLowerCase().trim();
                                        if (lid && (qLeadId === lid || qPid === lid || qCode === lid || qPid === `pr-${lid}` || qCode === `pr-${lid}`)) return true;
                                        if (mcId && (qPid === mcId || qCode === mcId)) return true;
                                        return false;
                                    });
                                    if (existingQ && !duplicateSourceId) {
                                        alert(`A quotation workspace already exists for this lead (Quote #${existingQ.quote_number || existingQ.quote_id}). Opening existing workspace.`);
                                        setShowCreateModal(false);
                                        openQuoteWorkspace(existingQ);
                                        setSubmittingCreate(false);
                                        return;
                                    }

                                    let duplicatedSections: any[] = [];
                                    let initialExtraData: any = null;
                                    if (duplicateSourceId) {
                                        const srcQuote = rawQuotes.find((q: any) => String(q.quote_id) === String(duplicateSourceId) || String(q.project_id) === String(duplicateSourceId));
                                        let fullSrcData: any = null;
                                        try {
                                            const res = await axios.get(`${API_BASE_URL}/quotes/${duplicateSourceId}`);
                                            if (res.data?.success && res.data?.data) {
                                                fullSrcData = res.data.data;
                                            }
                                        } catch (e) {
                                            console.warn('Failed to load source quote details:', e);
                                        }

                                        const targetSrc = fullSrcData || srcQuote;
                                        const srcExtra = targetSrc?.extra_data_parsed || targetSrc?.extra_data || {};
                                        let qSections = targetSrc?.sections || [];

                                        if (qSections && qSections.length > 0) {
                                            duplicatedSections = qSections.map((sec: any, sIdx: number) => ({
                                                id: `dup_sec_${Date.now()}_${sIdx}`,
                                                name: sec.section_name || sec.title || sec.name || `Module ${sIdx + 1}`,
                                                custom_headings: sec.custom_headings || undefined,
                                                items: (sec.items || []).map((it: any, iIdx: number) => ({
                                                    id: `dup_it_${Date.now()}_${sIdx}_${iIdx}`,
                                                    particulars: it.particulars || it.item_name || '',
                                                    brand: it.brand || '',
                                                    unit: it.unit || 'SFT',
                                                    quantity: parseFloat(it.quantity) || 1,
                                                    used_quantity: parseFloat(it.used_quantity) || 0,
                                                    rate: parseFloat(it.rate) || 0,
                                                    amount: parseFloat(it.amount) || ((parseFloat(it.quantity) || 1) * (parseFloat(it.rate) || 0)),
                                                    width: it.width || '',
                                                    height: it.height || '',
                                                    sft: it.sft || '',
                                                    hsn_sac: it.hsn_sac || '',
                                                    image_url: it.image_url || '',
                                                    rate_per_sft: it.rate_per_sft ? parseFloat(it.rate_per_sft) : 0,
                                                    discount_percent: it.discount_percent !== undefined && it.discount_percent !== null ? parseFloat(it.discount_percent) : 0,
                                                    gst_rate: it.gst_rate !== undefined && it.gst_rate !== null && String(it.gst_rate) !== '' ? parseFloat(it.gst_rate) : '',
                                                    category: it.category || '',
                                                    pricing_mode: it.pricing_mode || 'dimensions'
                                                }))
                                            }));
                                        }

                                        let newCharges: any = srcExtra.additional_charges || srcExtra.additionalCharges || targetSrc?.additional_charges || targetSrc?.additionalCharges || null;
                                        if (newCharges && typeof newCharges === 'object' && typeof newCharges.amount === 'object') {
                                            newCharges = { ...newCharges, amount: parseFloat(newCharges.amount?.amount || newCharges.amount?.value || 0) || 0 };
                                        } else if (newCharges && typeof newCharges !== 'object') {
                                            newCharges = { amount: parseFloat(newCharges) || 0, withGst: false, gstRate: 0 };
                                        }

                                        const newFlat = srcExtra.flat_discount ?? srcExtra.flatDiscount ?? targetSrc?.flat_discount ?? targetSrc?.flatDiscount ?? (srcExtra.general_discount?.amount || null);

                                        initialExtraData = {
                                            applied_coupon: targetSrc?.applied_coupon || targetSrc?.appliedCoupon || srcExtra.applied_coupon || srcExtra.appliedCoupon || srcExtra.coupon || null,
                                            additional_charges: newCharges,
                                            general_discount: srcExtra.general_discount || srcExtra.generalDiscount || null,
                                            flat_discount: newFlat,
                                            global_discount: srcExtra.global_discount || srcExtra.globalDiscount || null,
                                            overall_gst_enabled: srcExtra.overall_gst_enabled !== undefined ? srcExtra.overall_gst_enabled : true,
                                            overall_gst_line_hidden: srcExtra.overall_gst_line_hidden !== undefined ? srcExtra.overall_gst_line_hidden : false,
                                            round_off_enabled: srcExtra.round_off_enabled !== undefined ? srcExtra.round_off_enabled : true,
                                            custom_headings: srcExtra.custom_headings || null,
                                            hidden_fields: srcExtra.hidden_fields || null,
                                            category_discounts: srcExtra.category_discounts || srcExtra.tempCategoryDiscounts || null,
                                            discount_percent: targetSrc?.discount_percent || srcExtra.discount_percent || 0
                                        };
                                    }

                                    const rawLeadNum = matchedLead ? String(matchedLead.lead_id) : (createFormData.project_id ? String(createFormData.project_id).replace(/\D/g, '') : '');
                                    const numericPid = rawLeadNum && Number(rawLeadNum) > 0 ? Number(rawLeadNum) : Math.floor(Date.now() / 1000);
                                    const projCode = matchedLead?.manual_client_id || matchedLead?.project_code || matchedLead?.client_code || createFormData.project_id || `PR-${numericPid}`;

                                    const isDuplicating = Boolean(duplicatedSections && duplicatedSections.length > 0);
                                    const sectionsToSave: any[] = isDuplicating ? duplicatedSections : [];
                                    const userBudget = Number(createFormData.estimated_budget) || 0;
                                    const sectionsSum = sectionsToSave.reduce((sum: number, sec: any) =>
                                        sum + (sec.items || []).reduce((iSum: number, item: any) => iSum + (Number(item.amount) || ((Number(item.quantity) || 1) * (Number(item.rate) || 0))), 0), 0
                                    );
                                    // For fresh quotes: start with empty sections (0 items) and set total to lead estimated budget
                                    const finalTotal = userBudget > 0 ? userBudget : (isDuplicating ? sectionsSum : 0);

                                    const isLeadStage1Paid = Boolean(
                                        matchedLead && (
                                            matchedLead.stage1_paid === 1 ||
                                            matchedLead.stage1_paid === true ||
                                            matchedLead.stage1_paid === '1' ||
                                            matchedLead.is_10_percent_paid === 1 ||
                                            matchedLead.is_10_percent_paid === true ||
                                            matchedLead.is_10_percent_paid === '1' ||
                                            String(matchedLead.payment_status || '').toLowerCase().includes('10%') ||
                                            String(matchedLead.payment_status || '').toLowerCase().includes('20%')
                                        )
                                    );
                                    const isLeadConv = isLeadStage1Paid && Boolean(
                                        matchedLead && (
                                            matchedLead.is_converted === 1 ||
                                            matchedLead.status === 'won' ||
                                            matchedLead.status === 'converted' ||
                                            matchedLead.d1_status === 'won' ||
                                            matchedLead.d1_status === 'converted'
                                        )
                                    );
                                    const isInitialQuoteNew = !isLeadConv;

                                    const newProj: any = {
                                        quote_id: `p-${numericPid}`,
                                        project_id: numericPid,
                                        project_code: projCode,
                                        project_name: `${createFormData.client_name || 'Customer'} Quotation`,
                                        client_name: createFormData.client_name || 'Client',
                                        client_phone: createFormData.contact_number || '',
                                        client_email: createFormData.email || '',
                                        client_address: createFormData.client_address || '',
                                        location: createFormData.location || '',
                                        project_type: createFormData.project_type || 'Furniture projects',
                                        project_scope: (createFormData.project_scope === 'Other' ? (createFormData.custom_scope?.trim() || 'Other') : createFormData.project_scope) || '2 BHK',
                                        scope_of_work: (createFormData.project_scope === 'Other' ? (createFormData.custom_scope?.trim() || 'Other') : createFormData.project_scope) || '2 BHK',
                                        designer_name: createFormData.designer_name || '',
                                        sales_manager_name: createFormData.sales_person_name || '',
                                        sales_manager_phone: createFormData.sales_person_phone || '',
                                        sales_manager_email: createFormData.sales_person_email || '',
                                        lead_source: createFormData.lead_source || 'walk_in',
                                        total_amount: finalTotal,
                                        version: 1,
                                        status: 'draft',
                                        // Always reset approval/version flags for new quotations
                                        is_duplicate: duplicateSourceId ? true : false,
                                        is_final_version: false,
                                        is_final: false,
                                        is_initial_quote: isInitialQuoteNew,
                                        is_initial: isInitialQuoteNew ? 1 : 0,
                                        is_lead_converted: isLeadConv,
                                        is_converted: isLeadConv ? 1 : 0,
                                        has_project_started: isLeadConv,
                                        stage1_paid: isLeadStage1Paid ? 1 : 0,
                                        is_10_percent_paid: isLeadStage1Paid ? 1 : 0,
                                        qc_status: 'draft',
                                        is_qc_approved: false,
                                        qc_approved: false,
                                        created_at: new Date().toISOString(),
                                        initialSections: isDuplicating ? duplicatedSections : undefined,
                                        initialExtraData: {
                                            ...(initialExtraData || {}),
                                            designer_name: createFormData.designer_name || '',
                                            sales_manager_name: createFormData.sales_person_name || '',
                                            sales_manager_phone: createFormData.sales_person_phone || '',
                                            sales_manager_email: createFormData.sales_person_email || '',
                                            project_scope: (createFormData.project_scope === 'Other' ? (createFormData.custom_scope?.trim() || 'Other') : createFormData.project_scope) || '2 BHK',
                                            scope_of_work: (createFormData.project_scope === 'Other' ? (createFormData.custom_scope?.trim() || 'Other') : createFormData.project_scope) || '2 BHK',
                                            is_initial_quote: isInitialQuoteNew
                                        }
                                    };

                                    let savedQuoteId: any = null;
                                    try {
                                        const draftRes = await axios.post(`${API_BASE_URL}/quotes/save-draft`, {
                                            project_id: numericPid,
                                            project_code: projCode,
                                            client_name: newProj.client_name,
                                            subtitle: newProj.client_name,
                                            total_amount: finalTotal,
                                            sections: sectionsToSave,
                                            is_initial_quote: isInitialQuoteNew,
                                            status: 'draft',
                                            created_by: user?.user_id || 1,
                                            quote_number: `QTN-${projCode}`,
                                            extra_data: {
                                                ...(initialExtraData || {}),
                                                client_phone: newProj.client_phone,
                                                client_email: newProj.client_email,
                                                client_address: newProj.client_address,
                                                location: newProj.location,
                                                project_type: newProj.project_type,
                                                project_scope: newProj.project_scope,
                                                scope_of_work: newProj.scope_of_work,
                                                designer_name: newProj.designer_name,
                                                sales_manager_name: newProj.sales_manager_name,
                                                sales_manager_phone: newProj.sales_manager_phone,
                                                sales_manager_email: newProj.sales_manager_email,
                                                lead_source: newProj.lead_source,
                                                is_initial_quote: isInitialQuoteNew
                                            }
                                        });
                                        if (draftRes.data?.quote_id) {
                                            savedQuoteId = draftRes.data.quote_id;
                                            newProj.quote_id = String(savedQuoteId);
                                        }
                                    } catch (saveErr) {
                                        console.warn('Failed to auto-save draft quotation:', saveErr);
                                    }

                                    // Clean URL query params so modal does not re-open
                                    navigate('/quotes', { replace: true });

                                    // Close modal popup
                                    setShowCreateModal(false);
                                    setIsInitialQuoteFlow(false);

                                    // Reset filters so the new quote is visible immediately in the Quotation History Table
                                    setStatusFilter('All');
                                    setFilterCategory('Active Quotation');
                                    setSearchQuery('');
                                    setCurrentPage(1);

                                    // Immediately add to local rawQuotes so it renders right away in the Quotation History Table
                                    setRawQuotes(prev => [newProj, ...prev.filter(q => String(q.project_id) !== String(numericPid) && String(q.quote_id) !== String(newProj.quote_id))]);
                                    setRecentlyCreatedQuote(newProj);
                                    setActiveEditingProject(null);

                                    // Re-fetch from database to ensure full synchronization
                                    await fetchQuotesAndProjects();
                                } finally {
                                    setSubmittingCreate(false);
                                }
                            }} style={{ padding: '0px' }}>

                                {/* Select Existing Lead Quick Dropdown */}
                                {leadsList.length > 0 && (() => {
                                    const availableLeads = isDesignerRole
                                        ? leadsList.filter((l: any) => isLeadAssignedToDesigner(l, effectiveUser))
                                        : leadsList;

                                    // Sort by most recent/latest first
                                    const sortedLeads = [...availableLeads].sort((a: any, b: any) => {
                                        const timeA = new Date(a.created_at || a.updated_at || 0).getTime();
                                        const timeB = new Date(b.created_at || b.updated_at || 0).getTime();
                                        if (timeA && timeB && timeA !== timeB) return timeB - timeA;
                                        return (Number(b.lead_id) || 0) - (Number(a.lead_id) || 0);
                                    });

                                    const lTrim = leadSearchTerm.trim().toLowerCase();
                                    // ONLY LAST 4 LEADS by default when not searching
                                    const filteredLeads = !lTrim
                                        ? sortedLeads.slice(0, 4)
                                        : sortedLeads.filter((l: any) => {
                                            const cName = String(l.client_name || '').toLowerCase();
                                            const phone = String(l.contact_number || '').toLowerCase();
                                            const mcId = String(l.manual_client_id || '').toLowerCase();
                                            const email = String(l.email || '').toLowerCase();
                                            const loc = String(l.location || '').toLowerCase();
                                            const lId = String(l.lead_id || '').toLowerCase();
                                            return cName.includes(lTrim) || phone.includes(lTrim) || mcId.includes(lTrim) || email.includes(lTrim) || loc.includes(lTrim) || lId.includes(lTrim);
                                        });

                                    // Ensure selected lead is in options if user picked one
                                    const displayLeads = (() => {
                                        if (!selectedLeadId) return filteredLeads;
                                        const exists = filteredLeads.some((l: any) => String(l.lead_id) === String(selectedLeadId));
                                        if (!exists) {
                                            const selObj = availableLeads.find((l: any) => String(l.lead_id) === String(selectedLeadId));
                                            if (selObj) return [selObj, ...filteredLeads];
                                        }
                                        return filteredLeads;
                                    })();

                                    const selectedLeadObj = leadsList.find((l: any) => String(l.lead_id) === String(selectedLeadId));

                                    const applyLeadToForm = (matched: any) => {
                                        if (!matched) {
                                            setSelectedLeadId('');
                                            return;
                                        }
                                        const lid = String(matched.lead_id || '');
                                        setSelectedLeadId(lid);
                                        const staffDetails = resolveLeadStaffDetails(matched);
                                        const rawType = matched.project_type || matched.consultation_type || '';
                                        const rawScope = matched.project_scope || matched.custom_scope || matched.scope || '';
                                        const rawSource = matched.lead_source || matched.source || '';
                                        const pIdVal = matched.manual_client_id || matched.project_code || (lid ? `PR-${lid}` : '');

                                        setCreateFormData(prev => ({
                                            ...prev,
                                            client_name: matched.client_name || matched.name || '',
                                            contact_number: matched.contact_number || matched.phone || '',
                                            email: matched.email || matched.client_email || '',
                                            project_id: pIdVal || prev.project_id,
                                            client_address: matched.client_address || matched.address || '',
                                            location: matched.location || matched.site_address || '',
                                            project_type: rawType ? rawType.trim() : 'Interior Projects',
                                            project_scope: rawScope ? rawScope.trim() : '2 BHK',
                                            custom_scope: rawScope ? rawScope.trim() : '2 BHK',
                                            lead_source: rawSource ? rawSource.trim() : 'Walk In',
                                            estimated_budget: String(matched.estimated_budget || matched.total_budget || matched.initial_quote_amount || prev.estimated_budget || ''),
                                            designer_name: staffDetails.designerName,
                                            sales_person_name: staffDetails.salesPersonName,
                                            sales_person_phone: staffDetails.salesPersonPhone,
                                            sales_person_email: staffDetails.salesPersonEmail
                                        }));
                                    };

                                    return (
                                        <div style={{ marginBottom: '16px', padding: '12px 16px', backgroundColor: '#fff9f0', border: '1.5px solid #ffe8c2', borderRadius: '12px' }}>
                                            {/* Minimised heading & short note */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', flexWrap: 'wrap', gap: '4px' }}>
                                                <div>
                                                    <label style={{ fontSize: '0.82rem', fontWeight: 800, color: '#9a3412', margin: 0 }}>
                                                        ⚡ Quick Pick Lead <span style={{ fontWeight: 500, color: '#c2410c' }}>(Auto-Fill)</span>
                                                    </label>
                                                    <p style={{ margin: '2px 0 0 0', fontSize: '0.74rem', color: '#c2410c', fontWeight: 500 }}>
                                                        Auto-populate client, contact &amp; project details from a sales lead.
                                                    </p>
                                                </div>
                                                <span style={{ fontSize: '0.70rem', backgroundColor: '#ffedd5', color: '#9a3412', fontWeight: 800, padding: '2px 8px', borderRadius: '10px' }}>
                                                    {lTrim ? `Matches (${displayLeads.length})` : 'Last 4 Leads'}
                                                </span>
                                            </div>

                                            {/* Custom Dropdown with Scroller if > 4 items */}
                                            <div ref={leadDropdownRef} style={{ position: 'relative' }}>
                                                {/* Dropdown Trigger Button */}
                                                <button
                                                    type="button"
                                                    onClick={() => setIsLeadDropdownOpen(prev => !prev)}
                                                    style={{
                                                        width: '100%',
                                                        padding: '9px 12px',
                                                        borderRadius: '8px',
                                                        border: isLeadDropdownOpen ? '2px solid #ea580c' : '1px solid #fed7aa',
                                                        backgroundColor: '#ffffff',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        cursor: 'pointer',
                                                        textAlign: 'left',
                                                        boxShadow: isLeadDropdownOpen ? '0 0 0 3px rgba(234, 88, 12, 0.15)' : 'none',
                                                        transition: 'all 0.15s ease'
                                                    }}
                                                >
                                                    <span style={{ fontSize: '0.85rem', fontWeight: selectedLeadObj ? 700 : 500, color: selectedLeadObj ? '#9a3412' : '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {selectedLeadObj
                                                            ? `${selectedLeadObj.client_name} (${selectedLeadObj.contact_number || 'No Phone'}) • ${selectedLeadObj.manual_client_id || `ID: ${selectedLeadObj.lead_id}`}`
                                                            : '-- Choose a Sales Lead to Auto-Populate --'}
                                                    </span>
                                                    <ChevronDown size={16} color="#ea580c" style={{ transform: isLeadDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease', flexShrink: 0, marginLeft: '8px' }} />
                                                </button>

                                                {/* Dropdown Menu Popover */}
                                                {isLeadDropdownOpen && (
                                                    <div style={{
                                                        position: 'absolute',
                                                        top: 'calc(100% + 6px)',
                                                        left: 0,
                                                        right: 0,
                                                        backgroundColor: '#ffffff',
                                                        borderRadius: '10px',
                                                        border: '1.5px solid #fed7aa',
                                                        boxShadow: '0 12px 28px -4px rgba(0, 0, 0, 0.18), 0 4px 8px -2px rgba(0, 0, 0, 0.08)',
                                                        zIndex: 9999,
                                                        padding: '8px',
                                                        boxSizing: 'border-box'
                                                    }}>
                                                        {/* Real-time Search Box inside Dropdown */}
                                                        <div style={{ position: 'relative', marginBottom: '8px' }}>
                                                            <Search size={14} color="#ea580c" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                                                            <input
                                                                type="text"
                                                                autoFocus
                                                                placeholder="🔍 Search all leads by name, phone, ID, location..."
                                                                value={leadSearchTerm}
                                                                onChange={(e) => setLeadSearchTerm(e.target.value)}
                                                                onClick={(e) => e.stopPropagation()}
                                                                style={{
                                                                    width: '100%',
                                                                    padding: '7px 28px 7px 30px',
                                                                    borderRadius: '6px',
                                                                    border: '1px solid #cbd5e1',
                                                                    fontSize: '0.82rem',
                                                                    outline: 'none',
                                                                    backgroundColor: '#f8fafc',
                                                                    color: '#0f172a',
                                                                    boxSizing: 'border-box'
                                                                }}
                                                            />
                                                            {leadSearchTerm && (
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setLeadSearchTerm('');
                                                                    }}
                                                                    style={{
                                                                        position: 'absolute',
                                                                        right: '6px',
                                                                        top: '50%',
                                                                        transform: 'translateY(-50%)',
                                                                        background: '#e2e8f0',
                                                                        border: 'none',
                                                                        borderRadius: '50%',
                                                                        width: '18px',
                                                                        height: '18px',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        color: '#475569',
                                                                        fontSize: '0.72rem',
                                                                        fontWeight: 800,
                                                                        cursor: 'pointer'
                                                                    }}
                                                                    title="Clear search"
                                                                >
                                                                    ✕
                                                                </button>
                                                            )}
                                                        </div>

                                                        {/* Scrollable list container: 4 items height constraint (~44px per item => maxHeight 185px) */}
                                                        <div style={{
                                                            maxHeight: '185px',
                                                            overflowY: 'auto',
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            gap: '2px',
                                                            paddingRight: '2px'
                                                        }}>
                                                            {/* Option 0: Do not auto-fill */}
                                                            <div
                                                                onClick={() => {
                                                                    setSelectedLeadId('');
                                                                    setIsLeadDropdownOpen(false);
                                                                }}
                                                                style={{
                                                                    padding: '8px 10px',
                                                                    borderRadius: '6px',
                                                                    cursor: 'pointer',
                                                                    backgroundColor: !selectedLeadId ? '#fff7ed' : 'transparent',
                                                                    border: !selectedLeadId ? '1px solid #fed7aa' : '1px solid transparent',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'space-between',
                                                                    fontSize: '0.82rem',
                                                                    fontWeight: !selectedLeadId ? 800 : 500,
                                                                    color: !selectedLeadId ? '#c2410c' : '#64748b'
                                                                }}
                                                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
                                                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = !selectedLeadId ? '#fff7ed' : 'transparent'; }}
                                                            >
                                                                <span>-- Do Not Auto-Fill (Manual Entry) --</span>
                                                                {!selectedLeadId && <span style={{ color: '#ea580c', fontWeight: 800 }}>✓</span>}
                                                            </div>

                                                            {/* No Results Message */}
                                                            {displayLeads.length === 0 && (
                                                                <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>
                                                                    No leads matching "{leadSearchTerm}"
                                                                </div>
                                                            )}

                                                            {/* Leads List */}
                                                            {displayLeads.map((l: any) => {
                                                                const isSelected = String(selectedLeadId) === String(l.lead_id);
                                                                return (
                                                                    <div
                                                                        key={l.lead_id}
                                                                        onClick={() => {
                                                                            applyLeadToForm(l);
                                                                            setIsLeadDropdownOpen(false);
                                                                        }}
                                                                        style={{
                                                                            padding: '8px 10px',
                                                                            borderRadius: '6px',
                                                                            cursor: 'pointer',
                                                                            backgroundColor: isSelected ? '#ffedd5' : 'transparent',
                                                                            border: isSelected ? '1px solid #fdba74' : '1px solid transparent',
                                                                            transition: 'background 0.15s ease'
                                                                        }}
                                                                        onMouseEnter={(e) => {
                                                                            if (!isSelected) e.currentTarget.style.backgroundColor = '#fff7ed';
                                                                        }}
                                                                        onMouseLeave={(e) => {
                                                                            if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                                                                        }}
                                                                    >
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                            <span style={{ fontWeight: 700, fontSize: '0.84rem', color: isSelected ? '#9a3412' : '#1e293b' }}>
                                                                                {l.client_name}
                                                                            </span>
                                                                            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#c2410c' }}>
                                                                                {l.contact_number || 'No Phone'}
                                                                            </span>
                                                                        </div>
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px', fontSize: '0.73rem', color: '#64748b' }}>
                                                                            <span>{l.manual_client_id || `ID: ${l.lead_id}`}</span>
                                                                            {l.project_type && <span style={{ fontStyle: 'italic' }}>{l.project_type}</span>}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>

                                                        {/* Helper note if more than 4 items */}
                                                        {displayLeads.length > 4 && (
                                                            <div style={{ padding: '5px 8px 0 8px', borderTop: '1px solid #f1f5f9', marginTop: '4px', fontSize: '0.71rem', color: '#94a3b8', textAlign: 'center' }}>
                                                                ↕ Scroll down to view all {displayLeads.length} leads
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Selected Lead Indicator Card */}
                                            {selectedLeadObj && (
                                                <div style={{ marginTop: '8px', padding: '6px 12px', backgroundColor: '#ffedd5', border: '1px solid #fed7aa', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                                                    <span style={{ fontSize: '0.78rem', color: '#9a3412', fontWeight: 700 }}>
                                                        ✓ Auto-filled from: <strong>{selectedLeadObj.client_name}</strong> ({selectedLeadObj.manual_client_id || `ID: ${selectedLeadObj.lead_id}`})
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedLeadId('')}
                                                        style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '0.74rem', fontWeight: 800, cursor: 'pointer', textDecoration: 'underline' }}
                                                    >
                                                        Clear
                                                    </button>
                                                </div>
                                            )}

                                            {/* Existing Quote Warning Banner */}
                                            {selectedLeadId && (() => {
                                                const matched = leadsList.find((l: any) => String(l.lead_id) === selectedLeadId);
                                                const existingQ = rawQuotes.find((q: any) => {
                                                    const qid = String(q.quote_id || '');
                                                    if (!qid || qid.startsWith('lead-') || qid.startsWith('p-') || q.is_placeholder || q.is_synthetic) return false;
                                                    const num = Number(qid);
                                                    if (isNaN(num) || num <= 0) return false;

                                                    const qPid = String(q.project_id || '').toLowerCase().trim();
                                                    const qLeadId = String(q.lead_id || '').toLowerCase().trim();
                                                    const qCode = String(q.project_code || '').toLowerCase().trim();
                                                    const lid = String(selectedLeadId).toLowerCase().trim();
                                                    const mcId = String(matched?.manual_client_id || '').toLowerCase().trim();
                                                    if (lid && (qLeadId === lid || qPid === lid || qCode === lid || qPid === `pr-${lid}` || qCode === `pr-${lid}`)) return true;
                                                    if (mcId && (qPid === mcId || qCode === mcId)) return true;
                                                    return false;
                                                });
                                                if (!existingQ) return null;
                                                return (
                                                    <div style={{ marginTop: '10px', padding: '10px 14px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                                                        <span style={{ fontSize: '0.82rem', color: '#1e40af', fontWeight: 700 }}>
                                                            ℹ️ Quotation workspace already exists for this lead (Quote #{existingQ.quote_number || existingQ.quote_id}).
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setShowCreateModal(false);
                                                                openQuoteWorkspace(existingQ);
                                                            }}
                                                            style={{ padding: '6px 12px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}
                                                        >
                                                            Open Existing Workspace →
                                                        </button>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    );
                                })()}

                                {/* Duplicate Modules & Items Dropdown */}
                                {rawQuotes.length > 0 && (() => {
                                    const accessibleQuotes = isDesignerRole
                                        ? rawQuotes.filter((q: any) => isQuoteAccessibleByDesigner(q, effectiveUser, leadsList, rawProjects))
                                        : rawQuotes;

                                    // Sort by most recent/latest first
                                    const sortedQuotes = [...accessibleQuotes].sort((a: any, b: any) => {
                                        const timeA = new Date(a.created_at || a.updated_at || 0).getTime();
                                        const timeB = new Date(b.created_at || b.updated_at || 0).getTime();
                                        if (timeA && timeB && timeA !== timeB) return timeB - timeA;
                                        return (Number(b.quote_id) || 0) - (Number(a.quote_id) || 0);
                                    });

                                    const qTrim = duplicateSearchTerm.trim().toLowerCase();
                                    // ONLY LAST 4 PROJECTS by default when not searching
                                    const filteredQuotes = !qTrim
                                        ? sortedQuotes.slice(0, 4)
                                        : sortedQuotes.filter((q: any) => {
                                            const cName = String(q.client_name || '').toLowerCase();
                                            const pName = String(q.project_name || '').toLowerCase();
                                            const qNum = String(q.quote_number || '').toLowerCase();
                                            const pCode = String(q.project_code || '').toLowerCase();
                                            const qId = String(q.quote_id || '').toLowerCase();
                                            const pId = String(q.project_id || '').toLowerCase();
                                            return cName.includes(qTrim) || pName.includes(qTrim) || qNum.includes(qTrim) || pCode.includes(qTrim) || qId.includes(qTrim) || pId.includes(qTrim);
                                        });

                                    // Ensure selected quote is in options if user picked one
                                    const displayQuotes = (() => {
                                        if (!duplicateSourceId) return filteredQuotes;
                                        const exists = filteredQuotes.some((q: any) => String(q.quote_id) === String(duplicateSourceId));
                                        if (!exists) {
                                            const selectedObj = accessibleQuotes.find((q: any) => String(q.quote_id) === String(duplicateSourceId));
                                            if (selectedObj) return [selectedObj, ...filteredQuotes];
                                        }
                                        return filteredQuotes;
                                    })();

                                    const selectedQ = rawQuotes.find((q: any) => String(q.quote_id) === String(duplicateSourceId));

                                    return (
                                        <div style={{ marginBottom: '16px', padding: '12px 16px', backgroundColor: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: '12px' }}>
                                            {/* Minimised heading & short note */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', flexWrap: 'wrap', gap: '4px' }}>
                                                <div>
                                                    <label style={{ fontSize: '0.82rem', fontWeight: 800, color: '#166534', margin: 0 }}>
                                                        📋 Duplicate From Existing Project <span style={{ fontWeight: 500, color: '#15803d' }}>(Optional)</span>
                                                    </label>
                                                    <p style={{ margin: '2px 0 0 0', fontSize: '0.74rem', color: '#15803d', fontWeight: 500 }}>
                                                        Copy section modules, items, units &amp; rates into this new quotation.
                                                    </p>
                                                </div>
                                                <span style={{ fontSize: '0.70rem', backgroundColor: '#dcfce7', color: '#15803d', fontWeight: 800, padding: '2px 8px', borderRadius: '10px' }}>
                                                    {qTrim ? `Matches (${displayQuotes.length})` : 'Last 4 Projects'}
                                                </span>
                                            </div>

                                            {/* Custom Dropdown with Scroller if > 4 items */}
                                            <div ref={duplicateDropdownRef} style={{ position: 'relative' }}>
                                                {/* Dropdown Trigger Button */}
                                                <button
                                                    type="button"
                                                    onClick={() => setIsDuplicateDropdownOpen(prev => !prev)}
                                                    style={{
                                                        width: '100%',
                                                        padding: '9px 12px',
                                                        borderRadius: '8px',
                                                        border: isDuplicateDropdownOpen ? '2px solid #16a34a' : '1px solid #86efac',
                                                        backgroundColor: '#ffffff',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        cursor: 'pointer',
                                                        textAlign: 'left',
                                                        boxShadow: isDuplicateDropdownOpen ? '0 0 0 3px rgba(34, 197, 94, 0.18)' : 'none',
                                                        transition: 'all 0.15s ease'
                                                    }}
                                                >
                                                    <span style={{ fontSize: '0.85rem', fontWeight: selectedQ ? 700 : 500, color: selectedQ ? '#14532d' : '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {selectedQ
                                                            ? `${selectedQ.client_name || selectedQ.project_name || 'Project'} • ${selectedQ.quote_number || selectedQ.project_code || `#${selectedQ.quote_id}`} (₹${Number(selectedQ.total_amount || 0).toLocaleString('en-IN')})`
                                                            : '-- Do Not Duplicate (Start Blank) --'}
                                                    </span>
                                                    <ChevronDown size={16} color="#16a34a" style={{ transform: isDuplicateDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease', flexShrink: 0, marginLeft: '8px' }} />
                                                </button>

                                                {/* Dropdown Menu Popover */}
                                                {isDuplicateDropdownOpen && (
                                                    <div style={{
                                                        position: 'absolute',
                                                        top: 'calc(100% + 6px)',
                                                        left: 0,
                                                        right: 0,
                                                        backgroundColor: '#ffffff',
                                                        borderRadius: '10px',
                                                        border: '1.5px solid #86efac',
                                                        boxShadow: '0 12px 28px -4px rgba(0, 0, 0, 0.18), 0 4px 8px -2px rgba(0, 0, 0, 0.08)',
                                                        zIndex: 9999,
                                                        padding: '8px',
                                                        boxSizing: 'border-box'
                                                    }}>
                                                        {/* Real-time Search Box inside Dropdown */}
                                                        <div style={{ position: 'relative', marginBottom: '8px' }}>
                                                            <Search size={14} color="#16a34a" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                                                            <input
                                                                type="text"
                                                                autoFocus
                                                                placeholder="🔍 Search all projects..."
                                                                value={duplicateSearchTerm}
                                                                onChange={(e) => setDuplicateSearchTerm(e.target.value)}
                                                                onClick={(e) => e.stopPropagation()}
                                                                style={{
                                                                    width: '100%',
                                                                    padding: '7px 28px 7px 30px',
                                                                    borderRadius: '6px',
                                                                    border: '1px solid #cbd5e1',
                                                                    fontSize: '0.82rem',
                                                                    outline: 'none',
                                                                    backgroundColor: '#f8fafc',
                                                                    color: '#0f172a',
                                                                    boxSizing: 'border-box'
                                                                }}
                                                            />
                                                            {duplicateSearchTerm && (
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setDuplicateSearchTerm('');
                                                                    }}
                                                                    style={{
                                                                        position: 'absolute',
                                                                        right: '6px',
                                                                        top: '50%',
                                                                        transform: 'translateY(-50%)',
                                                                        background: '#e2e8f0',
                                                                        border: 'none',
                                                                        borderRadius: '50%',
                                                                        width: '18px',
                                                                        height: '18px',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        color: '#475569',
                                                                        fontSize: '0.72rem',
                                                                        fontWeight: 800,
                                                                        cursor: 'pointer'
                                                                    }}
                                                                    title="Clear search"
                                                                >
                                                                    ✕
                                                                </button>
                                                            )}
                                                        </div>

                                                        {/* Scrollable list container: 4 items height constraint (~44px per item => maxHeight 185px) */}
                                                        <div style={{
                                                            maxHeight: '185px',
                                                            overflowY: 'auto',
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            gap: '2px',
                                                            paddingRight: '2px'
                                                        }}>
                                                            {/* Option 0: Do not duplicate */}
                                                            <div
                                                                onClick={() => {
                                                                    setDuplicateSourceId('');
                                                                    setIsDuplicateDropdownOpen(false);
                                                                    if (selectedLeadId) {
                                                                        const matched = leadsList.find((l: any) => String(l.lead_id) === selectedLeadId);
                                                                        if (matched) {
                                                                            const rawType = matched.project_type || matched.consultation_type || '';
                                                                            const rawScope = matched.project_scope || matched.custom_scope || matched.scope || '';
                                                                            setCreateFormData(prev => ({
                                                                                ...prev,
                                                                                project_type: rawType ? rawType.trim() : prev.project_type,
                                                                                project_scope: rawScope ? rawScope.trim() : prev.project_scope,
                                                                                custom_scope: rawScope ? rawScope.trim() : prev.custom_scope
                                                                            }));
                                                                        }
                                                                    }
                                                                }}
                                                                style={{
                                                                    padding: '8px 10px',
                                                                    borderRadius: '6px',
                                                                    cursor: 'pointer',
                                                                    backgroundColor: !duplicateSourceId ? '#f0fdf4' : 'transparent',
                                                                    border: !duplicateSourceId ? '1px solid #bbf7d0' : '1px solid transparent',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'space-between',
                                                                    fontSize: '0.82rem',
                                                                    fontWeight: !duplicateSourceId ? 800 : 500,
                                                                    color: !duplicateSourceId ? '#15803d' : '#64748b'
                                                                }}
                                                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
                                                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = !duplicateSourceId ? '#f0fdf4' : 'transparent'; }}
                                                            >
                                                                <span>-- Do Not Duplicate (Start Blank) --</span>
                                                                {!duplicateSourceId && <span style={{ color: '#16a34a', fontWeight: 800 }}>✓</span>}
                                                            </div>

                                                            {/* No Results Message */}
                                                            {displayQuotes.length === 0 && (
                                                                <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>
                                                                    No projects matching "{duplicateSearchTerm}"
                                                                </div>
                                                            )}

                                                            {/* Projects List */}
                                                            {displayQuotes.map((q: any) => {
                                                                const isSelected = String(duplicateSourceId) === String(q.quote_id);
                                                                return (
                                                                    <div
                                                                        key={q.quote_id}
                                                                        onClick={() => {
                                                                            setDuplicateSourceId(String(q.quote_id));
                                                                            setIsDuplicateDropdownOpen(false);
                                                                            const qType = q.project_type || q.extra_data?.project_type;
                                                                            const qScope = q.project_scope || q.scope_of_work || q.extra_data?.project_scope || q.extra_data?.scope_of_work;
                                                                            setCreateFormData(prev => ({
                                                                                ...prev,
                                                                                project_type: qType ? qType.trim() : prev.project_type,
                                                                                project_scope: qScope ? qScope.trim() : prev.project_scope,
                                                                                custom_scope: qScope ? qScope.trim() : prev.custom_scope
                                                                            }));
                                                                        }}
                                                                        style={{
                                                                            padding: '8px 10px',
                                                                            borderRadius: '6px',
                                                                            cursor: 'pointer',
                                                                            backgroundColor: isSelected ? '#dcfce7' : 'transparent',
                                                                            border: isSelected ? '1px solid #86efac' : '1px solid transparent',
                                                                            transition: 'background 0.15s ease'
                                                                        }}
                                                                        onMouseEnter={(e) => {
                                                                            if (!isSelected) e.currentTarget.style.backgroundColor = '#f0fdf4';
                                                                        }}
                                                                        onMouseLeave={(e) => {
                                                                            if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                                                                        }}
                                                                    >
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                            <span style={{ fontWeight: 700, fontSize: '0.84rem', color: isSelected ? '#14532d' : '#1e293b' }}>
                                                                                {q.client_name || q.project_name || 'Project'}
                                                                            </span>
                                                                            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#15803d' }}>
                                                                                ₹{Number(q.total_amount || 0).toLocaleString('en-IN')}
                                                                            </span>
                                                                        </div>
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px', fontSize: '0.73rem', color: '#64748b' }}>
                                                                            <span>{q.quote_number || q.project_code || `#${q.quote_id}`}</span>
                                                                            {q.project_type && <span style={{ fontStyle: 'italic' }}>{q.project_type}</span>}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>

                                                        {/* Helper note if more than 4 items */}
                                                        {displayQuotes.length > 4 && (
                                                            <div style={{ padding: '5px 8px 0 8px', borderTop: '1px solid #f1f5f9', marginTop: '4px', fontSize: '0.71rem', color: '#94a3b8', textAlign: 'center' }}>
                                                                ↕ Scroll down to view all {displayQuotes.length} projects
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Selected Quote Indicator Card */}
                                            {selectedQ && (
                                                <div style={{ marginTop: '8px', padding: '6px 12px', backgroundColor: '#dcfce7', border: '1px solid #86efac', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                                                    <span style={{ fontSize: '0.78rem', color: '#166534', fontWeight: 700 }}>
                                                        ✓ Selected: <strong>{selectedQ.client_name || selectedQ.project_name}</strong> ({selectedQ.quote_number || selectedQ.project_code || `#${selectedQ.quote_id}`}) — ₹{Number(selectedQ.total_amount || 0).toLocaleString('en-IN')}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setDuplicateSourceId('');
                                                            if (selectedLeadId) {
                                                                const matched = leadsList.find((l: any) => String(l.lead_id) === selectedLeadId);
                                                                if (matched) {
                                                                    const rawType = matched.project_type || matched.consultation_type || '';
                                                                    const rawScope = matched.project_scope || matched.custom_scope || matched.scope || '';
                                                                    setCreateFormData(prev => ({
                                                                        ...prev,
                                                                        project_type: rawType ? rawType.trim() : prev.project_type,
                                                                        project_scope: rawScope ? rawScope.trim() : prev.project_scope,
                                                                        custom_scope: rawScope ? rawScope.trim() : prev.custom_scope
                                                                    }));
                                                                }
                                                            }
                                                        }}
                                                        style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '0.74rem', fontWeight: 800, cursor: 'pointer', textDecoration: 'underline' }}
                                                    >
                                                        Clear
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', margin: 0 }}>
                                                Project ID / Client ID * <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>(e.g. PR-101)</span>
                                            </label>
                                            {isInitialQuoteFlow && (
                                                <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#0284c7', backgroundColor: '#e0f2fe', padding: '1px 6px', borderRadius: '4px' }}>
                                                    ❄️ Freezed
                                                </span>
                                            )}
                                        </div>
                                        <input
                                            type="text"
                                            required
                                            readOnly={isInitialQuoteFlow}
                                            tabIndex={isInitialQuoteFlow ? -1 : undefined}
                                            placeholder="e.g. PR-101 or lead_15"
                                            value={createFormData.project_id}
                                            onChange={(e) => !isInitialQuoteFlow && handleLeadLookup(e.target.value)}
                                            style={{
                                                width: '100%',
                                                padding: '10px 12px',
                                                borderRadius: '8px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '0.88rem',
                                                outline: 'none',
                                                fontWeight: 700,
                                                backgroundColor: isInitialQuoteFlow ? '#f8fafc' : '#ffffff',
                                                color: '#0f172a',
                                                cursor: isInitialQuoteFlow ? 'default' : 'text',
                                                boxSizing: 'border-box'
                                            }}
                                        />
                                    </div>

                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', margin: 0 }}>
                                                Client Name *
                                            </label>
                                            {isInitialQuoteFlow && (
                                                <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#0284c7', backgroundColor: '#e0f2fe', padding: '1px 6px', borderRadius: '4px' }}>
                                                    ❄️ Freezed
                                                </span>
                                            )}
                                        </div>
                                        <input
                                            type="text"
                                            required
                                            readOnly={isInitialQuoteFlow}
                                            tabIndex={isInitialQuoteFlow ? -1 : undefined}
                                            placeholder="Full client name"
                                            value={createFormData.client_name}
                                            onChange={(e) => !isInitialQuoteFlow && setCreateFormData({ ...createFormData, client_name: e.target.value })}
                                            style={{
                                                width: '100%',
                                                padding: '10px 12px',
                                                borderRadius: '8px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '0.88rem',
                                                outline: 'none',
                                                fontWeight: 600,
                                                backgroundColor: isInitialQuoteFlow ? '#f8fafc' : '#ffffff',
                                                color: '#0f172a',
                                                cursor: isInitialQuoteFlow ? 'default' : 'text',
                                                boxSizing: 'border-box'
                                            }}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', margin: 0 }}>
                                                Contact Number
                                            </label>
                                            {isInitialQuoteFlow && (
                                                <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#0284c7', backgroundColor: '#e0f2fe', padding: '1px 6px', borderRadius: '4px' }}>
                                                    ❄️ Freezed
                                                </span>
                                            )}
                                        </div>
                                        <input
                                            type="text"
                                            readOnly={isInitialQuoteFlow}
                                            tabIndex={isInitialQuoteFlow ? -1 : undefined}
                                            placeholder="Phone number"
                                            value={createFormData.contact_number}
                                            onChange={(e) => !isInitialQuoteFlow && setCreateFormData({ ...createFormData, contact_number: e.target.value })}
                                            style={{
                                                width: '100%',
                                                padding: '10px 12px',
                                                borderRadius: '8px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '0.88rem',
                                                outline: 'none',
                                                backgroundColor: isInitialQuoteFlow ? '#f8fafc' : '#ffffff',
                                                color: '#0f172a',
                                                cursor: isInitialQuoteFlow ? 'default' : 'text',
                                                boxSizing: 'border-box'
                                            }}
                                        />
                                    </div>

                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', margin: 0 }}>
                                                Email Address
                                            </label>
                                            {isInitialQuoteFlow && (
                                                <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#0284c7', backgroundColor: '#e0f2fe', padding: '1px 6px', borderRadius: '4px' }}>
                                                    ❄️ Freezed
                                                </span>
                                            )}
                                        </div>
                                        <input
                                            type="email"
                                            readOnly={isInitialQuoteFlow}
                                            tabIndex={isInitialQuoteFlow ? -1 : undefined}
                                            placeholder="client@example.com"
                                            value={createFormData.email}
                                            onChange={(e) => !isInitialQuoteFlow && setCreateFormData({ ...createFormData, email: e.target.value })}
                                            style={{
                                                width: '100%',
                                                padding: '10px 12px',
                                                borderRadius: '8px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '0.88rem',
                                                outline: 'none',
                                                backgroundColor: isInitialQuoteFlow ? '#f8fafc' : '#ffffff',
                                                color: '#0f172a',
                                                cursor: isInitialQuoteFlow ? 'default' : 'text',
                                                boxSizing: 'border-box'
                                            }}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', margin: 0 }}>
                                                Client Address
                                            </label>
                                            {isInitialQuoteFlow && (
                                                <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#0284c7', backgroundColor: '#e0f2fe', padding: '1px 6px', borderRadius: '4px' }}>
                                                    ❄️ Freezed
                                                </span>
                                            )}
                                        </div>
                                        <input
                                            type="text"
                                            readOnly={isInitialQuoteFlow}
                                            tabIndex={isInitialQuoteFlow ? -1 : undefined}
                                            placeholder="Street / Flat address"
                                            value={createFormData.client_address}
                                            onChange={(e) => !isInitialQuoteFlow && setCreateFormData({ ...createFormData, client_address: e.target.value })}
                                            style={{
                                                width: '100%',
                                                padding: '10px 12px',
                                                borderRadius: '8px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '0.88rem',
                                                outline: 'none',
                                                backgroundColor: isInitialQuoteFlow ? '#f8fafc' : '#ffffff',
                                                color: '#0f172a',
                                                cursor: isInitialQuoteFlow ? 'default' : 'text',
                                                boxSizing: 'border-box'
                                            }}
                                        />
                                    </div>

                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', margin: 0 }}>
                                                Site Location
                                            </label>
                                            {isInitialQuoteFlow && (
                                                <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#0284c7', backgroundColor: '#e0f2fe', padding: '1px 6px', borderRadius: '4px' }}>
                                                    ❄️ Freezed
                                                </span>
                                            )}
                                        </div>
                                        <input
                                            type="text"
                                            readOnly={isInitialQuoteFlow}
                                            tabIndex={isInitialQuoteFlow ? -1 : undefined}
                                            placeholder="e.g. Sagar Nagar, Visakhapatnam"
                                            value={createFormData.location}
                                            onChange={(e) => !isInitialQuoteFlow && setCreateFormData({ ...createFormData, location: e.target.value })}
                                            style={{
                                                width: '100%',
                                                padding: '10px 12px',
                                                borderRadius: '8px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '0.88rem',
                                                outline: 'none',
                                                backgroundColor: isInitialQuoteFlow ? '#f8fafc' : '#ffffff',
                                                color: '#0f172a',
                                                cursor: isInitialQuoteFlow ? 'default' : 'text',
                                                boxSizing: 'border-box'
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Project Type, Scope of Project, Lead Source */}
                                {isInitialQuoteFlow ? (
                                    /* FREEZED INPUT MODE (Create Initial Quotation Flow - Standard read-only input fields) */
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                                        {/* Project Type */}
                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', margin: 0 }}>
                                                    Project Type
                                                </label>
                                                <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#0284c7', backgroundColor: '#e0f2fe', padding: '1px 6px', borderRadius: '4px' }}>
                                                    ❄️ Freezed
                                                </span>
                                            </div>
                                            <input
                                                type="text"
                                                readOnly
                                                tabIndex={-1}
                                                value={createFormData.project_type || 'Interior Projects'}
                                                title="Freezed from Lead Enquiry / Duplicate Project (Read-only)"
                                                style={{
                                                    width: '100%',
                                                    padding: '10px 12px',
                                                    borderRadius: '8px',
                                                    border: '1.5px solid #cbd5e1',
                                                    fontSize: '0.88rem',
                                                    backgroundColor: '#f8fafc',
                                                    color: '#0f172a',
                                                    fontWeight: 700,
                                                    outline: 'none',
                                                    cursor: 'default',
                                                    boxSizing: 'border-box'
                                                }}
                                            />
                                        </div>

                                        {/* Scope of Project */}
                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', margin: 0 }}>
                                                    Scope of Project
                                                </label>
                                                <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#0284c7', backgroundColor: '#e0f2fe', padding: '1px 6px', borderRadius: '4px' }}>
                                                    ❄️ Freezed
                                                </span>
                                            </div>
                                            <input
                                                type="text"
                                                readOnly
                                                tabIndex={-1}
                                                value={createFormData.project_scope || '2 BHK'}
                                                title="Freezed from Lead Enquiry / Duplicate Project (Read-only)"
                                                style={{
                                                    width: '100%',
                                                    padding: '10px 12px',
                                                    borderRadius: '8px',
                                                    border: '1.5px solid #cbd5e1',
                                                    fontSize: '0.88rem',
                                                    backgroundColor: '#f8fafc',
                                                    color: '#0f172a',
                                                    fontWeight: 700,
                                                    outline: 'none',
                                                    cursor: 'default',
                                                    boxSizing: 'border-box'
                                                }}
                                            />
                                        </div>

                                        {/* Lead Source */}
                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', margin: 0 }}>
                                                    Lead Source
                                                </label>
                                                <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#0284c7', backgroundColor: '#e0f2fe', padding: '1px 6px', borderRadius: '4px' }}>
                                                    ❄️ Freezed
                                                </span>
                                            </div>
                                            <input
                                                type="text"
                                                readOnly
                                                tabIndex={-1}
                                                value={formatLeadSourceDisplay(createFormData.lead_source)}
                                                title="Freezed from Lead Enquiry (Read-only)"
                                                style={{
                                                    width: '100%',
                                                    padding: '10px 12px',
                                                    borderRadius: '8px',
                                                    border: '1.5px solid #cbd5e1',
                                                    fontSize: '0.88rem',
                                                    backgroundColor: '#f8fafc',
                                                    color: '#0f172a',
                                                    fontWeight: 700,
                                                    outline: 'none',
                                                    cursor: 'default',
                                                    boxSizing: 'border-box'
                                                }}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    /* EDITABLE MODE (+ Create New Quotation Flow - Editable) */
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                                        {/* Project Type */}
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                                                Project Type
                                            </label>
                                            <select
                                                value={createFormData.project_type}
                                                onChange={(e) => setCreateFormData({ ...createFormData, project_type: e.target.value })}
                                                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', outline: 'none', backgroundColor: '#ffffff' }}
                                            >
                                                <option value="Interior Projects">Interior Projects</option>
                                                <option value="Furniture projects">Furniture projects</option>
                                                <option value="Commercial project">Commercial project</option>
                                                <option value="Architectural consultation">Architectural consultation</option>
                                                <option value="Civil Work">Civil Work</option>
                                                {!['Interior Projects', 'Furniture projects', 'Commercial project', 'Architectural consultation', 'Civil Work'].includes(createFormData.project_type) && createFormData.project_type && (
                                                    <option value={createFormData.project_type}>{createFormData.project_type}</option>
                                                )}
                                            </select>
                                        </div>

                                        {/* Scope of Project */}
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                                                Scope of Project
                                            </label>
                                            <select
                                                value={createFormData.project_scope}
                                                onChange={(e) => setCreateFormData({ ...createFormData, project_scope: e.target.value })}
                                                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', outline: 'none', backgroundColor: '#ffffff' }}
                                            >
                                                <option value="2 BHK">2 BHK</option>
                                                <option value="3 BHK">3 BHK</option>
                                                <option value="Villa">Villa</option>
                                                <option value="Duplex">Duplex</option>
                                                <option value="Commercial">Commercial</option>
                                                <option value="Other">Other (Type custom scope)</option>
                                                {!['2 BHK', '3 BHK', 'Villa', 'Duplex', 'Commercial', 'Other'].includes(createFormData.project_scope) && createFormData.project_scope && (
                                                    <option value={createFormData.project_scope}>{createFormData.project_scope}</option>
                                                )}
                                            </select>
                                            {createFormData.project_scope === 'Other' && (
                                                <input
                                                    type="text"
                                                    autoFocus
                                                    value={createFormData.custom_scope}
                                                    onChange={(e) => setCreateFormData({ ...createFormData, custom_scope: e.target.value })}
                                                    placeholder="Type custom scope..."
                                                    style={{
                                                        width: '100%',
                                                        marginTop: '6px',
                                                        padding: '8px 10px',
                                                        borderRadius: '6px',
                                                        border: '1.5px solid #ea580c',
                                                        backgroundColor: '#fffaf0',
                                                        fontSize: '0.84rem',
                                                        outline: 'none',
                                                        boxSizing: 'border-box'
                                                    }}
                                                />
                                            )}
                                        </div>

                                        {/* Lead Source */}
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                                                Lead Source
                                            </label>
                                            <select
                                                value={createFormData.lead_source}
                                                onChange={(e) => setCreateFormData({ ...createFormData, lead_source: e.target.value })}
                                                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', outline: 'none', backgroundColor: '#ffffff' }}
                                            >
                                                <option value="Walk In">Walk In</option>
                                                <option value="Social Media">Social Media</option>
                                                <option value="Reference">Reference</option>
                                                <option value="Website">Website</option>
                                                <option value="Other">Other</option>
                                                {!['Walk In', 'Social Media', 'Reference', 'Website', 'Other'].includes(createFormData.lead_source) && createFormData.lead_source && (
                                                    <option value={createFormData.lead_source}>{formatLeadSourceDisplay(createFormData.lead_source)}</option>
                                                )}
                                            </select>
                                        </div>
                                    </div>
                                )}

                                {/* Assigned Designer & Booking Sales Person (Auto-resolved from Lead) */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px', backgroundColor: '#f8fafc', padding: '14px 16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', margin: 0 }}>
                                                🎨 Assigned Designer {createFormData.designer_name && <span style={{ color: '#16a34a', fontWeight: 600, fontSize: '0.75rem' }}>✓ Auto-Detected</span>}
                                            </label>
                                            {isInitialQuoteFlow && (
                                                <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#0284c7', backgroundColor: '#e0f2fe', padding: '1px 6px', borderRadius: '4px' }}>
                                                    ❄️ Freezed
                                                </span>
                                            )}
                                        </div>
                                        <input
                                            type="text"
                                            readOnly={isInitialQuoteFlow}
                                            tabIndex={isInitialQuoteFlow ? -1 : undefined}
                                            placeholder="Designer name (e.g. D1 / Associate)"
                                            value={createFormData.designer_name || ''}
                                            onChange={(e) => !isInitialQuoteFlow && setCreateFormData({ ...createFormData, designer_name: e.target.value })}
                                            style={{
                                                width: '100%',
                                                padding: '9px 12px',
                                                borderRadius: '8px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '0.88rem',
                                                outline: 'none',
                                                backgroundColor: isInitialQuoteFlow ? '#f1f5f9' : '#ffffff',
                                                color: '#0f172a',
                                                cursor: isInitialQuoteFlow ? 'default' : 'text',
                                                boxSizing: 'border-box'
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', margin: 0 }}>
                                                💼 Booking Slot Sales Person {createFormData.sales_person_name && <span style={{ color: '#16a34a', fontWeight: 600, fontSize: '0.75rem' }}>✓ Auto-Detected</span>}
                                            </label>
                                            {isInitialQuoteFlow && (
                                                <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#0284c7', backgroundColor: '#e0f2fe', padding: '1px 6px', borderRadius: '4px' }}>
                                                    ❄️ Freezed
                                                </span>
                                            )}
                                        </div>
                                        <input
                                            type="text"
                                            readOnly={isInitialQuoteFlow}
                                            tabIndex={isInitialQuoteFlow ? -1 : undefined}
                                            placeholder="Sales person / Manager name"
                                            value={createFormData.sales_person_name || ''}
                                            onChange={(e) => !isInitialQuoteFlow && setCreateFormData({ ...createFormData, sales_person_name: e.target.value })}
                                            style={{
                                                width: '100%',
                                                padding: '9px 12px',
                                                borderRadius: '8px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '0.88rem',
                                                outline: 'none',
                                                backgroundColor: isInitialQuoteFlow ? '#f1f5f9' : '#ffffff',
                                                color: '#0f172a',
                                                cursor: isInitialQuoteFlow ? 'default' : 'text',
                                                boxSizing: 'border-box'
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Modal Footer Actions */}
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowCreateModal(false);
                                            setIsInitialQuoteFlow(false);
                                        }}
                                        style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#64748b', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer' }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        style={{ padding: '10px 22px', borderRadius: '8px', border: 'none', backgroundColor: '#111827', color: '#ffffff', fontWeight: 800, fontSize: '0.88rem', cursor: 'pointer', boxShadow: '0 2px 6px rgba(17,24,39,0.25)' }}
                                    >
                                        Start Quotation Workspace →
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* 7. FLOATING ACTION ASSISTANT BUTTON (BOTTOM RIGHT PURPLE ICON AS IN DESIGN) */}
            <div
                style={{
                    position: 'fixed',
                    bottom: '24px',
                    right: '24px',
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    backgroundColor: '#7c3aed',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 8px 20px rgba(124, 58, 237, 0.4)',
                    cursor: 'pointer',
                    zIndex: 999
                }}
                onClick={() => alert('Quotation Assistant ready to help!')}
                title="Quotation Assistant"
            >
                <MessageSquare size={22} />
            </div>

            {/* ===== PROMO CODE HISTORY & MANAGEMENT MODAL ===== */}
            {showPromoHistoryModal && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.65)',
                    backdropFilter: 'blur(4px)',
                    zIndex: 999999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px'
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '16px',
                        width: '100%',
                        maxWidth: '720px',
                        maxHeight: '85vh',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden'
                    }}>
                        {/* Header */}
                        <div style={{
                            padding: '16px 22px',
                            backgroundColor: '#0f172a',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Clock size={20} color="#f97316" />
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>Project Promo &amp; Coupon Code History</h3>
                                    <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#94a3b8' }}>All promo codes created and stored in the system database</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowPromoHistoryModal(false)}
                                style={{ background: 'none', border: 'none', color: '#ffffff', fontSize: '1.2rem', cursor: 'pointer', fontWeight: 800 }}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Body / Table */}
                        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                                        <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, width: '40px' }}>#</th>
                                        <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 800, color: '#0f172a' }}>Promo Code Name</th>
                                        <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 800 }}>Discount Value</th>
                                        <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Description / Created</th>
                                        <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 800, width: '150px' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dbPromoCodes.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
                                                No promo codes found in system database. Click "+ Create New Promo Code" to add one.
                                            </td>
                                        </tr>
                                    ) : (
                                        dbPromoCodes.map((p, idx) => {
                                            const isCurrentlyApplied = appliedGlobalCoupon?.code.toUpperCase() === p.code.toUpperCase();
                                            const discText = p.discount_type === 'percent'
                                                ? `${parseFloat(String(p.discount_value))}% OFF`
                                                : `Flat ₹${parseFloat(String(p.discount_value)).toLocaleString('en-IN')} OFF`;
                                            const createdDate = p.created_at ? new Date(p.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

                                            return (
                                                <tr key={p.id || idx} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: isCurrentlyApplied ? '#fff7ed' : (idx % 2 === 1 ? '#fafafa' : '#ffffff') }}>
                                                    <td style={{ padding: '12px', textAlign: 'center', fontWeight: 700, color: '#64748b' }}>{idx + 1}</td>
                                                    <td style={{ padding: '12px 14px', fontWeight: 900, color: '#ea580c', letterSpacing: '0.5px' }}>
                                                        🎟️ {p.code}
                                                        {isCurrentlyApplied && (
                                                            <span style={{ marginLeft: '8px', fontSize: '0.72rem', backgroundColor: '#ea580c', color: '#ffffff', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                                                                APPLIED
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 800, color: '#16a34a' }}>
                                                        {discText}
                                                    </td>
                                                    <td style={{ padding: '12px 14px', color: '#475569', fontSize: '0.82rem' }}>
                                                        <div>{p.description || 'Custom Offer Code'}</div>
                                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>Created: {createdDate}</div>
                                                    </td>
                                                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                                            <button
                                                                onClick={() => {
                                                                    applyGlobalCouponCode(p.code);
                                                                    setShowPromoHistoryModal(false);
                                                                }}
                                                                disabled={isCurrentlyApplied}
                                                                style={{
                                                                    padding: '5px 10px',
                                                                    borderRadius: '6px',
                                                                    border: 'none',
                                                                    backgroundColor: isCurrentlyApplied ? '#cbd5e1' : '#ea580c',
                                                                    color: '#ffffff',
                                                                    fontWeight: 800,
                                                                    fontSize: '0.78rem',
                                                                    cursor: isCurrentlyApplied ? 'default' : 'pointer'
                                                                }}
                                                            >
                                                                {isCurrentlyApplied ? 'Active' : 'Apply'}
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeletePromoCode(p.id, p.code)}
                                                                style={{
                                                                    padding: '5px 8px',
                                                                    borderRadius: '6px',
                                                                    border: '1px solid #fca5a5',
                                                                    backgroundColor: '#fef2f2',
                                                                    color: '#dc2626',
                                                                    fontWeight: 700,
                                                                    fontSize: '0.78rem',
                                                                    cursor: 'pointer'
                                                                }}
                                                                title="Delete promo code from database"
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Footer */}
                        <div style={{ padding: '14px 22px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
                            <button
                                onClick={() => {
                                    setShowPromoHistoryModal(false);
                                    setShowCreatePromoModal(true);
                                }}
                                style={{ padding: '8px 16px', borderRadius: '6px', border: '1.5px solid #ea580c', backgroundColor: '#fff7ed', color: '#ea580c', fontWeight: 800, fontSize: '0.84rem', cursor: 'pointer' }}
                            >
                                + Create New Promo Code
                            </button>
                            <button
                                onClick={() => setShowPromoHistoryModal(false)}
                                style={{ padding: '8px 18px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#475569', fontWeight: 700, fontSize: '0.84rem', cursor: 'pointer' }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== CREATE PROMO CODE MODAL ===== */}
            {showCreatePromoModal && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.65)',
                    backdropFilter: 'blur(4px)',
                    zIndex: 999999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px'
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '16px',
                        width: '100%',
                        maxWidth: '460px',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            padding: '16px 20px',
                            backgroundColor: '#ea580c',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Tag size={20} color="#ffffff" />
                                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Create New Promo / Coupon Code</h3>
                            </div>
                            <button
                                onClick={() => setShowCreatePromoModal(false)}
                                style={{ background: 'none', border: 'none', color: '#ffffff', fontSize: '1.2rem', cursor: 'pointer', fontWeight: 800 }}
                            >
                                ✕
                            </button>
                        </div>

                        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.80rem', fontWeight: 800, color: '#334155', marginBottom: '6px', textTransform: 'uppercase' }}>
                                    Promo Code Text Name:
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. FESTIVE20, SPECIAL100"
                                    value={newPromoName}
                                    onChange={(e) => { setNewPromoName(e.target.value); setNewPromoError(''); }}
                                    style={{
                                        width: '100%',
                                        padding: '10px 14px',
                                        borderRadius: '8px',
                                        border: '1.5px solid #cbd5e1',
                                        fontSize: '0.90rem',
                                        fontWeight: 800,
                                        color: '#0f172a',
                                        textTransform: 'uppercase',
                                        outline: 'none',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.80rem', fontWeight: 800, color: '#334155', marginBottom: '6px', textTransform: 'uppercase' }}>
                                        Discount Type:
                                    </label>
                                    <select
                                        value={newPromoType}
                                        onChange={(e) => setNewPromoType(e.target.value as 'percent' | 'flat')}
                                        style={{
                                            width: '100%',
                                            padding: '10px 12px',
                                            borderRadius: '8px',
                                            border: '1.5px solid #cbd5e1',
                                            fontSize: '0.86rem',
                                            fontWeight: 700,
                                            color: '#0f172a',
                                            outline: 'none',
                                            boxSizing: 'border-box'
                                        }}
                                    >
                                        <option value="percent">Percentage (%)</option>
                                        <option value="flat">Flat Amount (₹)</option>
                                    </select>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.80rem', fontWeight: 800, color: '#334155', marginBottom: '6px', textTransform: 'uppercase' }}>
                                        Discount Value:
                                    </label>
                                    <input
                                        type="number"
                                        placeholder={newPromoType === 'percent' ? 'e.g. 15' : 'e.g. 5000'}
                                        value={newPromoVal}
                                        onChange={(e) => { setNewPromoVal(e.target.value === '' ? '' : parseFloat(e.target.value)); setNewPromoError(''); }}
                                        style={{
                                            width: '100%',
                                            padding: '10px 14px',
                                            borderRadius: '8px',
                                            border: '1.5px solid #cbd5e1',
                                            fontSize: '0.90rem',
                                            fontWeight: 800,
                                            color: '#0f172a',
                                            outline: 'none',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                </div>
                            </div>

                            {newPromoError && (
                                <div style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', fontSize: '0.82rem', fontWeight: 700 }}>
                                    {newPromoError}
                                </div>
                            )}
                        </div>

                        <div style={{ padding: '14px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px', backgroundColor: '#f8fafc' }}>
                            <button
                                onClick={() => setShowCreatePromoModal(false)}
                                style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#475569', fontWeight: 700, fontSize: '0.84rem', cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreatePromoCode}
                                style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', backgroundColor: '#ea580c', color: '#ffffff', fontWeight: 800, fontSize: '0.84rem', cursor: 'pointer', boxShadow: '0 2px 6px rgba(234, 88, 12, 0.25)' }}
                            >
                                Save &amp; Apply Promo Code
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== CATEGORY-WISE MAX DISCOUNT SETTINGS MODAL (ADMIN) ===== */}
            {showMaxDiscountModal && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.7)',
                    backdropFilter: 'blur(3px)',
                    zIndex: 1000000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px'
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '16px',
                        width: '100%',
                        maxWidth: '560px',
                        boxShadow: '0 25px 50px rgba(0,0,0,0.3)',
                        overflow: 'hidden',
                        border: '2px solid #ea580c',
                        display: 'flex',
                        flexDirection: 'column',
                        maxHeight: '90vh'
                    }}>
                        {/* Header */}
                        <div style={{
                            padding: '16px 20px',
                            backgroundColor: '#ea580c',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Shield size={20} />
                                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>Category-Wise Max Discount Settings</h3>
                            </div>
                            <button
                                onClick={() => setShowMaxDiscountModal(false)}
                                style={{ background: 'none', border: 'none', color: '#ffffff', fontSize: '1.2rem', cursor: 'pointer', fontWeight: 800 }}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Body */}
                        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflowY: 'auto' }}>
                            {/* Categories Table */}
                            <div style={{ border: '1.5px solid #fed7aa', borderRadius: '8px', overflow: 'hidden' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#fff7ed', borderBottom: '1px solid #fed7aa', color: '#9a3412' }}>
                                            <th style={{ padding: '8px 10px', textAlign: 'center', width: '40px', fontWeight: 800 }}>#</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 800 }}>Category</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'center', width: '150px', fontWeight: 800 }}>Max Discount Limit</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.keys(categoryMaxLimits).map((cat, idx) => (
                                            <tr key={cat} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: idx % 2 === 1 ? '#fafafa' : '#ffffff' }}>
                                                <td style={{ padding: '8px 10px', textAlign: 'center', color: '#94a3b8', fontWeight: 700 }}>
                                                    {idx + 1}
                                                </td>
                                                <td style={{ padding: '8px 12px', fontWeight: 700, color: '#0f172a' }}>
                                                    {cat}
                                                </td>
                                                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                                    <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden', padding: '2px 8px', backgroundColor: '#ffffff' }}>
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            max={100}
                                                            value={categoryMaxLimits[cat] ?? 10}
                                                            onChange={(e) => {
                                                                const v = parseFloat(e.target.value);
                                                                const safe = isNaN(v) ? 0 : Math.min(100, Math.max(0, v));
                                                                setCategoryMaxLimits(prev => ({
                                                                    ...prev,
                                                                    [cat]: safe
                                                                }));
                                                            }}
                                                            style={{ width: '50px', border: 'none', outline: 'none', textAlign: 'center', fontWeight: 800, fontSize: '0.85rem', color: '#ea580c' }}
                                                        />
                                                        <span style={{ fontWeight: 800, color: '#ea580c', fontSize: '0.80rem' }}>%</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Add Custom Category Row */}
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', paddingTop: '4px' }}>
                                <input
                                    type="text"
                                    placeholder="Add other category name..."
                                    value={newCategoryName}
                                    onChange={(e) => setNewCategoryName(e.target.value)}
                                    style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', outline: 'none' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        const trimmed = newCategoryName.trim();
                                        if (trimmed && !categoryMaxLimits[trimmed]) {
                                            setCategoryMaxLimits(prev => ({
                                                ...prev,
                                                [trimmed]: bulkCategoryMaxDiscount || 10
                                            }));
                                            setNewCategoryName('');
                                        }
                                    }}
                                    disabled={!newCategoryName.trim()}
                                    style={{
                                        padding: '6px 12px',
                                        borderRadius: '6px',
                                        border: '1px solid #ea580c',
                                        backgroundColor: '#fff7ed',
                                        color: '#ea580c',
                                        fontWeight: 800,
                                        fontSize: '0.80rem',
                                        cursor: newCategoryName.trim() ? 'pointer' : 'not-allowed',
                                        opacity: newCategoryName.trim() ? 1 : 0.6
                                    }}
                                >
                                    + Add
                                </button>
                            </div>
                        </div>

                        {/* Footer */}
                        <div style={{ padding: '14px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px', backgroundColor: '#f8fafc' }}>
                            <button
                                type="button"
                                onClick={() => setShowMaxDiscountModal(false)}
                                style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#475569', fontWeight: 700, fontSize: '0.84rem', cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={isSavingMaxDiscount}
                                onClick={() => handleSaveMaxCategoryDiscount(categoryMaxLimits)}
                                style={{
                                    padding: '8px 22px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    backgroundColor: '#ea580c',
                                    color: '#ffffff',
                                    fontWeight: 800,
                                    fontSize: '0.84rem',
                                    cursor: isSavingMaxDiscount ? 'not-allowed' : 'pointer',
                                    boxShadow: '0 2px 6px rgba(234, 88, 12, 0.25)'
                                }}
                            >
                                {isSavingMaxDiscount ? 'Saving...' : 'Save Category Limits'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== DEDICATED DUPLICATE QUOTATION MODAL ===== */}
            {showDuplicateModal && duplicateSourceQuote && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999999, padding: '16px' }}>
                    <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '620px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)', overflow: 'hidden', border: '1.5px solid #fed7aa' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', backgroundColor: '#fff7ed', borderBottom: '1.5px solid #fed7aa' }}>
                            <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#9a3412', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                📋 Duplicate Quotation
                            </h3>
                            <button onClick={() => setShowDuplicateModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#9a3412', fontWeight: 800 }}>✕</button>
                        </div>

                        {(() => {
                            const isTargetQuoted = Boolean(
                                dupFormData.project_id &&
                                isProjectAlreadyQuoted(dupFormData.project_id, selectedDupLeadId, dupFormData.project_id)
                            );

                            return (
                                <form onSubmit={handleConfirmDuplicateQuote} style={{ padding: '24px', overflowY: 'auto', maxHeight: 'calc(90vh - 100px)' }}>
                                    {/* New Project Input Fields */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
                                                New Project ID / Client ID * <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 500 }}>(e.g. PR-102)</span>
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                placeholder="e.g. PR-102"
                                                value={dupFormData.project_id}
                                                onChange={(e) => handleDupLeadLookup(e.target.value)}
                                                style={{
                                                    width: '100%',
                                                    padding: '10px 12px',
                                                    borderRadius: '8px',
                                                    border: isTargetQuoted ? '2px solid #ef4444' : '1.5px solid #cbd5e1',
                                                    fontSize: '0.88rem',
                                                    outline: 'none',
                                                    fontWeight: 800
                                                }}
                                            />
                                        </div>

                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
                                                New Client Name *
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                placeholder="Enter client name"
                                                value={dupFormData.client_name}
                                                onChange={(e) => setDupFormData({ ...dupFormData, client_name: e.target.value })}
                                                style={{
                                                    width: '100%',
                                                    padding: '10px 12px',
                                                    borderRadius: '8px',
                                                    border: '1.5px solid #cbd5e1',
                                                    fontSize: '0.88rem',
                                                    outline: 'none',
                                                    fontWeight: 700
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                                                Contact Number
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Phone number"
                                                value={dupFormData.contact_number}
                                                onChange={(e) => setDupFormData({ ...dupFormData, contact_number: e.target.value })}
                                                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', outline: 'none' }}
                                            />
                                        </div>

                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                                                Email Address
                                            </label>
                                            <input
                                                type="email"
                                                placeholder="client@example.com"
                                                value={dupFormData.email}
                                                onChange={(e) => setDupFormData({ ...dupFormData, email: e.target.value })}
                                                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', outline: 'none' }}
                                            />
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '18px' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                                                Site Location
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="e.g. Visakhapatnam"
                                                value={dupFormData.location}
                                                onChange={(e) => setDupFormData({ ...dupFormData, location: e.target.value })}
                                                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', outline: 'none' }}
                                            />
                                        </div>

                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                                                Project Type
                                            </label>
                                            <select
                                                value={dupFormData.project_type}
                                                onChange={(e) => setDupFormData({ ...dupFormData, project_type: e.target.value })}
                                                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', outline: 'none', backgroundColor: '#ffffff' }}
                                            >
                                                <option value="Furniture projects">Furniture projects</option>
                                                <option value="Interior projects">Interior projects</option>
                                                <option value="Commercial project">Commercial project</option>
                                                <option value="Architectural consultation">Architectural consultation</option>
                                                <option value="Civil Work">Civil Work</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Restriction Banner: If Quotation Already Exists */}
                                    {isTargetQuoted && (
                                        <div style={{
                                            backgroundColor: '#fef2f2',
                                            border: '1.5px solid #ef4444',
                                            borderRadius: '10px',
                                            padding: '14px 16px',
                                            marginBottom: '18px',
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            gap: '12px'
                                        }}>
                                            <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>🚫</span>
                                            <div>
                                                <div style={{ fontSize: '0.92rem', fontWeight: 900, color: '#991b1b', marginBottom: '4px' }}>
                                                    Quotation Already Added for this Project!
                                                </div>
                                                <div style={{ fontSize: '0.82rem', color: '#b91c1c', fontWeight: 600, lineHeight: 1.4 }}>
                                                    A quotation already exists for <strong>{dupFormData.client_name || dupFormData.project_id}</strong> ({dupFormData.project_id}). Cannot create duplicate quotation.
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
                                        <button
                                            type="button"
                                            onClick={() => setShowDuplicateModal(false)}
                                            style={{
                                                padding: '10px 18px',
                                                borderRadius: '8px',
                                                border: '1px solid #cbd5e1',
                                                backgroundColor: '#ffffff',
                                                color: '#64748b',
                                                fontWeight: 700,
                                                fontSize: '0.88rem',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={submittingCreate || isTargetQuoted || !dupFormData.project_id || !dupFormData.client_name}
                                            style={{
                                                padding: '10px 22px',
                                                borderRadius: '8px',
                                                border: 'none',
                                                backgroundColor: (isTargetQuoted || !dupFormData.project_id || !dupFormData.client_name) ? '#94a3b8' : '#ea580c',
                                                color: '#ffffff',
                                                fontWeight: 800,
                                                fontSize: '0.88rem',
                                                cursor: (isTargetQuoted || !dupFormData.project_id || !dupFormData.client_name) ? 'not-allowed' : 'pointer',
                                                boxShadow: (isTargetQuoted || !dupFormData.project_id || !dupFormData.client_name) ? 'none' : '0 2px 8px rgba(234,88,12,0.3)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px'
                                            }}
                                        >
                                            {submittingCreate
                                                ? 'Duplicating...'
                                                : isTargetQuoted
                                                    ? '🚫 Quotation Already Added (Cannot Duplicate)'
                                                    : (!dupFormData.project_id || !dupFormData.client_name)
                                                        ? 'Enter Project ID & Client Name'
                                                        : '📋 Confirm & Create Quotation with Copied Modules →'}
                                        </button>
                                    </div>
                                </form>
                            );
                        })()}
                    </div>
                </div>
            )}

        </div>
    );
};

export default QuotesPage;