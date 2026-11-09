import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import axios from 'axios';
import { Loader2, Printer, Save, Undo2, Redo2, Trash2, PlusCircle, ListPlus, MoveUp, MoveDown, Check, Heading, ChevronDown, ChevronRight, CheckCircle2, MoreVertical, Copy, BookOpen, Calendar, Clock, LayoutGrid, User, Phone, Mail, Info, Send, Download, FileText, ShieldCheck, Tag, X, GripVertical, Plus, AlertTriangle } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { QCRejectDetailsModal } from './QCRejectDetailsModal';
import EleganceLogo from '../assets/Elegance Logo.png';
import ArkLogo from '../assets/Logo.png';
import liveLogo from '../assets/1.png';
import liveCartSignature from '../assets/LIVE CART SINGTU.png';
import OfficialLogo from '../assets/1.png';

interface QuoteItem {
    id: string;
    particulars: string;
    brand: string;
    unit: string;
    quantity: number;
    used_quantity?: number;
    rate: number;
    amount: number;
    width?: string;
    height?: string;
    sft?: string;
    hsn_sac?: string;
    image_url?: string;
    gst_rate?: number | string;
    rate_per_sft?: number;
    discount_percent?: number;
    category?: string;
    pricing_mode?: 'dimensions' | 'dimensions_3d' | 'lumpsum';
}

interface QuoteSection {
    id: string;
    name: string;
    custom_headings?: Record<string, string>;
    items: QuoteItem[];
}

interface QuoteTabProps {
    project: any;
    quoteId?: number | string;
    setQuoteTotal?: (total: number) => void;
    isReadOnly?: boolean;
    user?: any;
    isUsedQuote?: boolean;
    hideSave?: boolean;
    onSaveSuccess?: () => void;
    isAgreementPdfView?: boolean;
    usersList?: any[];
    isStage1Paid?: boolean;
    isStage2Paid?: boolean;
    isQcBooked?: boolean;
    isQcMeetingStarted?: boolean;
    qc_status?: string;
}

// Helper: convert number to words for Grand Total display
const numberToWords = (num: number): string => {
    if (num === 0) return 'Zero';
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const scales = ['', 'Thousand', 'Lakh', 'Crore'];
    const convert = (n: number): string => {
        if (n < 20) return ones[n];
        if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
        return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + convert(n % 100) : '');
    };
    const rounded = Math.round(num);
    if (rounded < 1000) return convert(rounded) + ' Rupees Only';
    // Indian numbering: Thousands, Lakhs, Crores
    const crores = Math.floor(rounded / 10000000);
    const lakhs = Math.floor((rounded % 10000000) / 100000);
    const thousands = Math.floor((rounded % 100000) / 1000);
    const remainder = rounded % 1000;
    let result = '';
    if (crores) result += convert(crores) + ' Crore ';
    if (lakhs) result += convert(lakhs) + ' Lakh ';
    if (thousands) result += convert(thousands) + ' Thousand ';
    if (remainder) result += convert(remainder);
    return result.trim() + ' Rupees Only';
};

const getRoundedTotal = (n: number) => Math.round(n);

const QuoteTab: React.FC<QuoteTabProps> = ({
    project,
    quoteId,
    setQuoteTotal,
    isReadOnly,
    user,
    isUsedQuote,
    hideSave,
    onSaveSuccess,
    isAgreementPdfView,
    usersList,
    isStage1Paid: isStage1PaidProp,
    isStage2Paid: isStage2PaidProp,
    isQcBooked: isQcBookedProp,
    isQcMeetingStarted: isQcMeetingStartedProp
}) => {
    const [sections, setSections] = useState<QuoteSection[]>([]);
    const [history, setHistory] = useState<QuoteSection[][]>([]);
    const [redoStack, setRedoStack] = useState<QuoteSection[][]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [subtitle, setSubtitle] = useState('');
    const [gstEnabled, setGstEnabled] = useState(false);
    const [showCoverPage, setShowCoverPage] = useState(true);

    const DEFAULT_QUOTE_TERMS = [
        "Material Specifications - Plywood, HDHMR as per client choice",
        "Finishes Specifications - Hi Gloss Finish, Matt, Suede, Wooden finishes as per client choice",
        "Accessories - Ebco, Hettich, or equivalent based upon availability.",
        "Payment Milestones:",
        "Initial Agreement Payment = 10% of total Quote (Non-Refundable - 3D provided)",
        "2nd Payment = 50% of total Quote (After designs finalisation)",
        "3rd Payment = 35% of total Quote (After 60% of work completion)",
        "Final Payment = 5% of total Quote (After 100% work completion)",
        "Timelines - Once all the designs finalisation 45-60 days for handover.",
        "Note - If any Addons in scope of work this quote may be Increased during installation phase.",
        "Warranty and Responsibility - Vendor shall provide One Year workmanship Warranty covering installation quality and fittings, Accessories.",
        "Kitchen sink, A/C, chimney, set top box and other accessories are not under our scope, If required any as per client selection will be charged separately",
        "Extra lights and electrical wiring charges are separately charged as per site conditions and client requirement",
        "If any excess drawers will be required other than standards, extra cost based on client requirement",
        "Water & power should be supplied by client free of cost",
        "After execution of the work as per drawing if any modifications cost will be extra as on actuals",
        "There is no extra hidden charges in the quotation.",
        "The company cannot be held responsible for additional requirement other than specified in the contract",
        "Customer should give access to the property till the completion of the work so that workers work night shift if needed",
        "The above quotation is prepared completely based on the requirements of client with the proper measurements"
    ];

    const [termsList, setTermsList] = useState<string[]>(DEFAULT_QUOTE_TERMS);
    const [showTermsModal, setShowTermsModal] = useState(false);
    const [termsModalOffset, setTermsModalOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [draggedTermIndex, setDraggedTermIndex] = useState<number | null>(null);
    const [dragOverTermIndex, setDragOverTermIndex] = useState<number | null>(null);
    const termsListContainerRef = useRef<HTMLDivElement | null>(null);
    const termsModalDragStartRef = useRef<{ startX: number; startY: number; initialOffsetX: number; initialOffsetY: number } | null>(null);
    const isPanScrollingRef = useRef(false);
    const panStartYRef = useRef(0);
    const panScrollTopRef = useRef(0);
    const [sendingToQC, setSendingToQC] = useState(false);
    const [loadedQuoteId, setLoadedQuoteId] = useState<any>(quoteId || null);
    const [loadedQuoteNumber, setLoadedQuoteNumber] = useState<string>('');

    // Stored & Previous Product Headings logic for Product Description column dropdown
    const DEFAULT_PRODUCT_HEADINGS = [
        "LIVING ROOM TV UNIT & WALL PANELLING",
        "FOYER CONSOLE & SHOE RACK",
        "CROCKERY UNIT & BAR COUNTER",
        "POOJA UNIT WITH BACKLIT JALI",
        "ACRYLIC MODULAR KITCHEN CABINETRY",
        "KITCHEN ISLAND & BREAKFAST COUNTER",
        "MASTER BEDROOM WARDROBE (SLIDING DOORS)",
        "MASTER BEDROOM WARDROBE (HINGED DOORS)",
        "BED WITH HYDRAULIC STORAGE & HEADBOARD",
        "DRESSING UNIT & FULL LENGTH MIRROR",
        "STUDY TABLE & BOOKSHELF",
        "KIDS BEDROOM WARDROBE & STUDY",
        "GUEST BEDROOM WARDROBE",
        "BATHROOM VANITY & MIRROR CABINET",
        "GYPSUM FALSE CEILING WITH COVE LIGHTING",
        "PVC CEILING (BALCONY AREA)",
        "LED STRIP & PROFILE LIGHTING",
        "CONCEALED LIGHT FITTINGS & WIRING",
        "ROYAL EMULSION WALL PAINTING",
        "DUCO PU PAINT FINISH FOR PANELS",
        "WALLPAPER & DECORATIVE PANELS",
        "CURTAINS & WINDOW BLINDS",
        "SOFA SET & RECLINERS",
        "DINING TABLE & SEATING"
    ];

    // Standard module names
    const COMMON_MODULE_NAMES = [
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

    const DEFAULT_SHUTTER_MATERIALS = [
        'Acrylic High Gloss Finish',
        'High Gloss Laminate (1.0mm)',
        'Matt Finish Laminate (0.8mm)',
        'PU Paint Finish',
        'Duco Paint Finish',
        'Natural Veneer with PU Polish',
        'Tinted Fluted Glass Profile',
        'Lacquer Glass Shutter',
        'Aluminium Profile Glass Door',
        'Ceramic Finish Shutter',
        'Suede Textured Laminate'
    ];

    const DEFAULT_CARCASS_MATERIALS = [
        'Action TESA HDHMR (Water Resistant)',
        'BWP Marine Plywood IS:710',
        'BWR Plywood IS:303',
        'Frosty White Laminate (0.8mm Inner)',
        'Off-White Fabric Texture Laminate',
        'Dark Grey / Charcoal Inner Laminate',
        'Commercial MR Plywood',
        'Pre-Laminated Particle Board',
        'Birch Plywood Core',
        'Calibrated Waterproof Plywood'
    ];

    // Category Recency & Most Used tracking
    const [recentCategories, setRecentCategories] = useState<string[]>(() => {
        try {
            const stored = localStorage.getItem('demoark_recent_categories');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch (e) { }
        return [];
    });

    const [deletedCategories, setDeletedCategories] = useState<string[]>(() => {
        try {
            const stored = localStorage.getItem('demoark_deleted_categories');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) return parsed;
            }
        } catch (e) { }
        return [];
    });

    const [activeCategoryDropdownId, setActiveCategoryDropdownId] = useState<string | null>(null);
    const [categorySearchQuery, setCategorySearchQuery] = useState<string>('');

    const recordCategoryUsage = (categoryName: string) => {
        const trimmed = categoryName.trim();
        if (!trimmed) return;
        setDeletedCategories(prev => {
            if (prev.some(d => d.toLowerCase() === trimmed.toLowerCase())) {
                const next = prev.filter(d => d.toLowerCase() !== trimmed.toLowerCase());
                try { localStorage.setItem('demoark_deleted_categories', JSON.stringify(next)); } catch (e) { }
                return next;
            }
            return prev;
        });
        setRecentCategories(prev => {
            const filtered = prev.filter(c => c.toLowerCase() !== trimmed.toLowerCase());
            const updated = [trimmed, ...filtered].slice(0, 15);
            try {
                localStorage.setItem('demoark_recent_categories', JSON.stringify(updated));
                localStorage.setItem('demoark_last_used_category', trimmed);
            } catch (e) { }
            return updated;
        });
    };

    const removeCategoryOption = (categoryToRemove: string) => {
        const trimmed = categoryToRemove.trim();
        if (!trimmed) return;
        setRecentCategories(prev => {
            const updated = prev.filter(c => c.toLowerCase() !== trimmed.toLowerCase());
            try { localStorage.setItem('demoark_recent_categories', JSON.stringify(updated)); } catch (e) { }
            return updated;
        });
        setDeletedCategories(prev => {
            if (prev.some(d => d.toLowerCase() === trimmed.toLowerCase())) return prev;
            const updated = [...prev, trimmed];
            try { localStorage.setItem('demoark_deleted_categories', JSON.stringify(updated)); } catch (e) { }
            return updated;
        });
    };

    const categoryOptions = useMemo(() => {
        const deletedSet = new Set(deletedCategories.map(d => d.toLowerCase()));
        const currentQuoteCats = sections.flatMap(sec =>
            (sec.items || []).map(it => (it.category || '').trim()).filter(Boolean)
        );
        const recents = Array.from(new Set([...recentCategories, ...currentQuoteCats]))
            .filter(c => Boolean(c) && !deletedSet.has(c.toLowerCase()));
        const recentLowerSet = new Set(recents.map(r => r.toLowerCase()));
        const standard = COMMON_MODULE_NAMES.filter(
            c => !deletedSet.has(c.toLowerCase()) && !recentLowerSet.has(c.toLowerCase())
        );
        return {
            recents,
            standard
        };
    }, [sections, recentCategories, deletedCategories]);

    // Shutter Materials state & recency
    const [recentShutterMaterials, setRecentShutterMaterials] = useState<string[]>(() => {
        try {
            const storedRecent = localStorage.getItem('demoark_recent_shutter_materials');
            if (storedRecent) {
                const parsed = JSON.parse(storedRecent);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
            const storedPrev = localStorage.getItem('demoark_previous_shutter_materials');
            if (storedPrev) {
                const parsed = JSON.parse(storedPrev);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed.filter((x: string) => !DEFAULT_SHUTTER_MATERIALS.includes(x));
                }
            }
        } catch (e) { }
        return [];
    });

    const [deletedShutterMaterials, setDeletedShutterMaterials] = useState<string[]>(() => {
        try {
            const stored = localStorage.getItem('demoark_deleted_shutter_materials');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) return parsed;
            }
        } catch (e) { }
        return [];
    });

    const [activeShutterDropdownId, setActiveShutterDropdownId] = useState<string | null>(null);

    const saveShutterMaterialToPrevious = (material: string) => {
        const trimmed = material.trim();
        if (!trimmed || trimmed === 'HEADER') return;
        setDeletedShutterMaterials(prev => {
            if (prev.some(d => d.toLowerCase() === trimmed.toLowerCase())) {
                const next = prev.filter(d => d.toLowerCase() !== trimmed.toLowerCase());
                try { localStorage.setItem('demoark_deleted_shutter_materials', JSON.stringify(next)); } catch (e) { }
                return next;
            }
            return prev;
        });
        setRecentShutterMaterials(prev => {
            const filtered = prev.filter(m => m.toLowerCase() !== trimmed.toLowerCase());
            const updated = [trimmed, ...filtered].slice(0, 15);
            try {
                localStorage.setItem('demoark_recent_shutter_materials', JSON.stringify(updated));
            } catch (e) { }
            return updated;
        });
    };

    const removeShutterMaterial = (materialToRemove: string) => {
        const trimmed = materialToRemove.trim();
        if (!trimmed) return;
        setRecentShutterMaterials(prev => {
            const updated = prev.filter(m => m.toLowerCase() !== trimmed.toLowerCase());
            try { localStorage.setItem('demoark_recent_shutter_materials', JSON.stringify(updated)); } catch (e) { }
            return updated;
        });
        setDeletedShutterMaterials(prev => {
            if (prev.some(d => d.toLowerCase() === trimmed.toLowerCase())) return prev;
            const updated = [...prev, trimmed];
            try { localStorage.setItem('demoark_deleted_shutter_materials', JSON.stringify(updated)); } catch (e) { }
            return updated;
        });
    };

    const shutterOptions = useMemo(() => {
        const deletedSet = new Set(deletedShutterMaterials.map(d => d.toLowerCase()));
        const currentQuoteShutters = sections.flatMap(sec =>
            (sec.items || []).map(it => (it.brand || '').trim()).filter(b => Boolean(b) && b !== 'HEADER')
        );
        const recents = Array.from(new Set([...recentShutterMaterials, ...currentQuoteShutters]))
            .filter(m => Boolean(m) && !deletedSet.has(m.toLowerCase()));
        const recentLowerSet = new Set(recents.map(r => r.toLowerCase()));
        const standard = DEFAULT_SHUTTER_MATERIALS.filter(
            m => !deletedSet.has(m.toLowerCase()) && !recentLowerSet.has(m.toLowerCase())
        );
        return { recents, standard };
    }, [sections, recentShutterMaterials, deletedShutterMaterials]);

    // Carcass Materials state & recency
    const [recentCarcassMaterials, setRecentCarcassMaterials] = useState<string[]>(() => {
        try {
            const storedRecent = localStorage.getItem('demoark_recent_carcass_materials');
            if (storedRecent) {
                const parsed = JSON.parse(storedRecent);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
            const storedPrev = localStorage.getItem('demoark_previous_carcass_materials');
            if (storedPrev) {
                const parsed = JSON.parse(storedPrev);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed.filter((x: string) => !DEFAULT_CARCASS_MATERIALS.includes(x));
                }
            }
        } catch (e) { }
        return [];
    });

    const [deletedCarcassMaterials, setDeletedCarcassMaterials] = useState<string[]>(() => {
        try {
            const stored = localStorage.getItem('demoark_deleted_carcass_materials');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) return parsed;
            }
        } catch (e) { }
        return [];
    });

    const [activeCarcassDropdownId, setActiveCarcassDropdownId] = useState<string | null>(null);

    const saveCarcassMaterialToPrevious = (material: string) => {
        const trimmed = material.trim();
        if (!trimmed) return;
        setDeletedCarcassMaterials(prev => {
            if (prev.some(d => d.toLowerCase() === trimmed.toLowerCase())) {
                const next = prev.filter(d => d.toLowerCase() !== trimmed.toLowerCase());
                try { localStorage.setItem('demoark_deleted_carcass_materials', JSON.stringify(next)); } catch (e) { }
                return next;
            }
            return prev;
        });
        setRecentCarcassMaterials(prev => {
            const filtered = prev.filter(m => m.toLowerCase() !== trimmed.toLowerCase());
            const updated = [trimmed, ...filtered].slice(0, 15);
            try {
                localStorage.setItem('demoark_recent_carcass_materials', JSON.stringify(updated));
            } catch (e) { }
            return updated;
        });
    };

    const removeCarcassMaterial = (materialToRemove: string) => {
        const trimmed = materialToRemove.trim();
        if (!trimmed) return;
        setRecentCarcassMaterials(prev => {
            const updated = prev.filter(m => m.toLowerCase() !== trimmed.toLowerCase());
            try { localStorage.setItem('demoark_recent_carcass_materials', JSON.stringify(updated)); } catch (e) { }
            return updated;
        });
        setDeletedCarcassMaterials(prev => {
            if (prev.some(d => d.toLowerCase() === trimmed.toLowerCase())) return prev;
            const updated = [...prev, trimmed];
            try { localStorage.setItem('demoark_deleted_carcass_materials', JSON.stringify(updated)); } catch (e) { }
            return updated;
        });
    };

    const carcassOptions = useMemo(() => {
        const deletedSet = new Set(deletedCarcassMaterials.map(d => d.toLowerCase()));
        const currentQuoteCarcasses = sections.flatMap(sec =>
            (sec.items || []).map(it => (it.unit || '').trim()).filter(Boolean)
        );
        const recents = Array.from(new Set([...recentCarcassMaterials, ...currentQuoteCarcasses]))
            .filter(m => Boolean(m) && !deletedSet.has(m.toLowerCase()));
        const recentLowerSet = new Set(recents.map(r => r.toLowerCase()));
        const standard = DEFAULT_CARCASS_MATERIALS.filter(
            m => !deletedSet.has(m.toLowerCase()) && !recentLowerSet.has(m.toLowerCase())
        );
        return { recents, standard };
    }, [sections, recentCarcassMaterials, deletedCarcassMaterials]);

    // Global click listener to auto-close category dropdown when clicking outside
    useEffect(() => {
        const handleGlobalClick = () => {
            setActiveCategoryDropdownId(null);
        };
        window.addEventListener('click', handleGlobalClick);
        return () => window.removeEventListener('click', handleGlobalClick);
    }, []);

    const [previousHeadings, setPreviousHeadings] = useState<string[]>(() => {
        try {
            const stored = localStorage.getItem('demoark_previous_product_headings');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return Array.from(new Set([...DEFAULT_PRODUCT_HEADINGS, ...parsed]));
                }
            }
        } catch (e) {
            console.error('Error reading saved headings:', e);
        }
        return DEFAULT_PRODUCT_HEADINGS;
    });

    const [activeHeadingDropdownId, setActiveHeadingDropdownId] = useState<string | null>(null);

    // Direct Total Category-Wise Discount Input states
    const [globalDiscountInputType, setGlobalDiscountInputType] = useState<'flat' | 'percent'>('flat');
    const [globalDiscountInputValue, setGlobalDiscountInputValue] = useState<string>('0');

    const saveHeadingToPrevious = (heading: string) => {
        const trimmed = heading.trim();
        if (!trimmed) return;
        setPreviousHeadings(prev => {
            if (prev.includes(trimmed)) return prev;
            const updated = [trimmed, ...prev];
            try {
                localStorage.setItem('demoark_previous_product_headings', JSON.stringify(updated));
            } catch (e) {
                console.error('Failed to store previous product heading', e);
            }
            return updated;
        });
    };

    const removePreviousHeading = (headingToRemove: string) => {
        setPreviousHeadings(prev => {
            const updated = prev.filter(h => h !== headingToRemove);
            try {
                localStorage.setItem('demoark_previous_product_headings', JSON.stringify(updated));
            } catch (e) {
                console.error('Failed to remove previous product heading', e);
            }
            return updated;
        });
    };

    const allProductHeadings = useMemo(() => {
        const currentQuoteHeadings = sections.flatMap(sec =>
            (sec.items || []).map(it => (it.particulars || '').trim()).filter(Boolean)
        );
        return Array.from(new Set([...currentQuoteHeadings, ...previousHeadings]));
    }, [sections, previousHeadings]);

    // Available GST rates dropdown options: 18 (default) + standard 12, 5, 0, 28 + any previously entered rates in sections
    const gstOptions = useMemo(() => {
        const standardRates = [18, 12, 5, 0, 28];
        const existingRates = sections.flatMap(sec =>
            (sec.items || [])
                .map(it => parseFloat(it.gst_rate as any))
                .filter(r => !isNaN(r) && r >= 0)
        );
        const combined = Array.from(new Set([...standardRates, ...existingRates])).sort((a, b) => {
            if (a === 18) return -1;
            if (b === 18) return 1;
            return a - b;
        });
        return combined;
    }, [sections]);

    // ✅ Detect newly created / duplicated quotations - these always start clean (no QC/Final flags)
    const isNewlyCreated = !!(
        project?.is_duplicate ||
        project?.save_type === 'draft' ||
        project?.status === 'draft' ||
        String(project?.quote_id || '').startsWith('p-') ||
        String(project?.quote_number || '').startsWith('DRAFT-')
    );

    // ✅ Detect pending / draft quotation state (e.g. status: 'booked', 'draft', 'pending', etc.)
    const rawProjStatus = String(project?.status || '').toLowerCase().trim();
    const isQuotePendingOrDraft = isNewlyCreated || !rawProjStatus || ['booked', 'draft', 'pending', 'concept', 'new'].includes(rawProjStatus);


    // Project Information state (DEFAULT COLLAPSED)
    const getFormattedProjectId = (p: any) => {
        if (!p) return 'PR-101';
        if (p.project_code) return p.project_code;
        if (p.manual_client_id) return p.manual_client_id;
        if (p.client_code) return p.client_code;
        if (p.project_id) {
            const str = String(p.project_id);
            return str.startsWith('DC-') ? str.replace('DC-', 'PR-') : (str.startsWith('PR-') || str.startsWith('LVC') ? str : `PR-${str}`);
        }
        if (p.lead_id) return `PR-${p.lead_id}`;
        if (p.id) return `PR-${p.id}`;
        return 'PR-101';
    };

    const [isProjectInfoExpanded, setIsProjectInfoExpanded] = useState(true);
    const [proposalFor, setProposalFor] = useState(() => project?.client_name || project?.subtitle || '');
    const [projectIdVal, setProjectIdVal] = useState(() => getFormattedProjectId(project));
    const [proposalDate, setProposalDate] = useState(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }));
    const [scopeOfWork, setScopeOfWork] = useState(() => project?.project_scope || project?.scope_of_work || 'Complete Interior Design & Execution');
    const [productionTime, setProductionTime] = useState('75 Business Days');
    const [projectCategory, setProjectCategory] = useState(() => {
        const pType = (project?.project_type || '').toLowerCase();
        if (pType.includes('commercial')) return 'Commercial Interiors';
        if (pType.includes('civil') || pType.includes('arch')) return 'Architecture & Civil Work';
        return 'Interior & Furniture Projects';
    });
    const [clientEmail, setClientEmail] = useState<string>(() => project?.client_email || project?.email || (project as any)?.clientEmail || '');
    const [clientPhone, setClientPhone] = useState<string>(() => project?.client_phone || project?.contact_number || project?.phone || '');
    const [allUsersList, setAllUsersList] = useState<any[]>(() => usersList || []);

    useEffect(() => {
        if (usersList && usersList.length > 0) {
            setAllUsersList(usersList);
        } else {
            axios.get(`${API_BASE_URL}/users`).then(res => {
                const uData = Array.isArray(res.data) ? res.data : (res.data?.data || []);
                if (Array.isArray(uData) && uData.length > 0) {
                    setAllUsersList(uData);
                }
            }).catch(() => { });
        }
    }, [usersList]);

    const isBadAdminSm = (n?: string) => !n || !n.trim() || n.trim().toLowerCase().includes('admin');
    const isBadSmPhone = (p?: string) => !p || p.trim() === '9182263332';
    const getUserEmail = (u: any) => u ? (u.email || (u.username?.includes('@') ? u.username : '')) : '';

    const [designerName, setDesignerName] = useState(() => project?.designer_name || project?.d1_assigned_name || (project as any)?.designer || '');
    const [salesManagerName, setSalesManagerName] = useState(() => {
        const raw = project?.sales_manager_name || project?.sales_person_name || (project as any)?.booked_by_name || (project as any)?.assigned_by_name || '';
        return !isBadAdminSm(raw) ? raw : 'Thanmai';
    });
    const [salesManagerPhone, setSalesManagerPhone] = useState(() => {
        const raw = project?.sales_manager_phone || project?.sales_person_phone || '';
        return !isBadSmPhone(raw) ? raw : '7702312351';
    });
    const [salesManagerEmail, setSalesManagerEmail] = useState(() => {
        const raw = project?.sales_manager_email || project?.sales_person_email || '';
        return raw || 'sukendra.ch@livincart.com';
    });

    useEffect(() => {
        if (project) {
            setProjectIdVal(getFormattedProjectId(project));
            if (project.client_name || project.subtitle) {
                setProposalFor(prev => prev || project.subtitle || project.client_name);
            }
            const cEmail = project.client_email || project.email || (project as any)?.clientEmail;
            if (cEmail) setClientEmail(prev => prev || cEmail);
            const cPhone = project.client_phone || project.contact_number || project.phone;
            if (cPhone) setClientPhone(prev => prev || cPhone);
            const dName = project.designer_name || project.d1_assigned_name || (project as any)?.designer;
            if (dName) {
                setDesignerName(prev => prev || dName);
            }
            const smName = project.sales_manager_name || project.sales_person_name || (project as any)?.booked_by_name || (project as any)?.assigned_by_name;
            if (smName && !isBadAdminSm(smName)) {
                setSalesManagerName(smName);
            } else if (isBadAdminSm(salesManagerName)) {
                // Find sales user from allUsersList
                const su = (allUsersList || []).find((u: any) => {
                    const r = String(u.role || '').toLowerCase();
                    const n = String(u.name || '').toLowerCase();
                    return (r === 'sales' || r === 'sales_manager' || r === 'sales_person' || r.includes('sales')) && !r.includes('admin') && !n.includes('admin');
                });
                setSalesManagerName(su?.name || 'Thanmai');
            }

            const smPhone = project.sales_manager_phone || project.sales_person_phone;
            if (smPhone && !isBadSmPhone(smPhone)) {
                setSalesManagerPhone(smPhone);
            } else if (isBadSmPhone(salesManagerPhone)) {
                const su = (allUsersList || []).find((u: any) => u.name && u.name.trim().toLowerCase() === salesManagerName.trim().toLowerCase());
                setSalesManagerPhone(su?.phone || '7702312351');
            }

            const smEmail = project.sales_manager_email || project.sales_person_email;
            if (smEmail) {
                setSalesManagerEmail(smEmail);
            } else if (!salesManagerEmail) {
                const su = (allUsersList || []).find((u: any) => u.name && u.name.trim().toLowerCase() === salesManagerName.trim().toLowerCase());
                setSalesManagerEmail(getUserEmail(su) || 'sukendra.ch@livincart.com');
            }

            const scp = project.project_scope || project.scope_of_work;
            if (scp) {
                setScopeOfWork(prev => (prev === 'Complete Interior Design & Execution' || !prev) ? scp : prev);
            }
        }
    }, [project, allUsersList]);
    const [discountPercent, setDiscountPercent] = useState(0);
    const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [openItemMenuId, setOpenItemMenuId] = useState<string | null>(null);
    const [openGstMenuId, setOpenGstMenuId] = useState<string | null>(null);

    useEffect(() => {
        const handleOutsideClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest?.('.gst-dropdown-container')) {
                setOpenGstMenuId(null);
            }
            if (!target.closest?.('.quote-section-menu-container')) {
                setOpenMenuId(null);
            }
            if (!target.closest?.('.quote-item-menu-container')) {
                setOpenItemMenuId(null);
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, []);
    // Modules Summary state (DEFAULT EXPANDED)
    const [isModulesSummaryExpanded, setIsModulesSummaryExpanded] = useState(true);

    // Print & Category visibility state
    const [hideCategoryInPrint, setHideCategoryInPrint] = useState(false);
    const [showHidePopup, setShowHidePopup] = useState(false);
    const [hiddenFields, setHiddenFields] = useState<Record<string, boolean>>({
        particulars: false,
        qty: false,
        discount: true,
        amount: false,
        gst: false,
        categoryDiscount: false,
        promoCode: false,
        generalDiscount: false,
        flatDiscount: false,
        additionalCharges: false,
        roundOff: false,
        shutter: false,
        carcass: false,
        dimensions: false,
        rate: false,
        scope: false,
        terms: false
    });

    // Custom Quote Headings state
    const [customHeadings, setCustomHeadings] = useState<Record<string, string>>({
        particulars: 'Product Description',
        shutterMaterial: 'Shutter Material | Finish',
        carcassMaterial: 'Carcass Material | Color',
        dimensions: 'Dimensions (W × H × D)',
        rate: 'Rate / SFT',
        qty: 'QTY',
        disc: 'Disc %',
        gst: 'GST %',
        amount: 'Amount'
    });
    const [headerBgColor, setHeaderBgColor] = useState<string>('rgba(254, 143, 62, 1)');

    const updateSectionHeading = (secId: string, field: string, value: string) => {
        setSections(prevSections => prevSections.map(sec => {
            if (sec.id === secId) {
                return {
                    ...sec,
                    custom_headings: {
                        ...(sec.custom_headings || {}),
                        [field]: value
                    }
                };
            }
            return sec;
        }));
        setCustomHeadings(prev => ({
            ...prev,
            [field]: value
        }));
        setIsDirty(true);
    };

    const isFieldHidden = (key: string): boolean => {
        if (hiddenFields[key] || hiddenFields[key.toLowerCase()]) return true;
        if (key === 'particulars' && (hiddenFields.particulars || (hiddenFields as any).productDescription || (hiddenFields as any)['product_description'])) return true;
        if (key === 'qty' && (hiddenFields.qty || (hiddenFields as any).quantity)) return true;
        if (key === 'amount' && (hiddenFields.amount || (hiddenFields as any)['item_amount'])) return true;
        if (key === 'shutterMaterial' && (hiddenFields.shutter || hiddenFields.shutterMaterial)) return true;
        if (key === 'carcassMaterial' && (hiddenFields.carcass || hiddenFields.carcassMaterial)) return true;
        if ((key === 'discount' || key === 'disc') && (hiddenFields.discount || hiddenFields.disc)) return true;
        if (key === 'categoryDiscount' && (hiddenFields.discount || hiddenFields.categoryDiscount || (hiddenFields as any)['category_discount'])) return true;
        if (key === 'promoCode' && (hiddenFields.discount || hiddenFields.promoCode || (hiddenFields as any).coupon || (hiddenFields as any)['promo_code'])) return true;
        if ((key === 'generalDiscount' || key === 'flatDiscount') && (hiddenFields.discount || hiddenFields.generalDiscount || hiddenFields.flatDiscount || (hiddenFields as any)['general_discount'] || (hiddenFields as any)['flat_discount'])) return true;
        if (key === 'additionalCharges' && (hiddenFields.additionalCharges || (hiddenFields as any)['additional_charges'])) return true;
        if (key === 'gst' && (hiddenFields.gst || overallGstLineHidden)) return true;
        if (key === 'roundOff' && (hiddenFields.roundOff || (hiddenFields as any)['round_off'])) return true;
        return false;
    };

    // Unsaved changes tracking state
    const [isDirty, setIsDirty] = useState<boolean>(false);

    // Additional Charges state
    const [additionalChargesAmount, setAdditionalChargesAmount] = useState<number>(0);
    const [additionalChargesHasGst, setAdditionalChargesHasGst] = useState<boolean>(false);
    const [additionalChargesGstRate, setAdditionalChargesGstRate] = useState<number>(0);

    // General Discount state
    const [generalDiscountAmount, setGeneralDiscountAmount] = useState<number>(0);
    const [generalDiscountType, setGeneralDiscountType] = useState<'flat' | 'percent'>('flat');

    // Overall GST state & Tax Split type ('intra' = CGST + SGST, 'inter' = IGST)
    const [gstSplitType, setGstSplitType] = useState<'intra' | 'inter'>('intra');
    const [overallGstEnabled, setOverallGstEnabled] = useState<boolean>(true);
    const [overallGstLineHidden, setOverallGstLineHidden] = useState<boolean>(false);
    const [overallGstRate, setOverallGstRate] = useState<number>(18);
    const [overallGstInputVal, setOverallGstInputVal] = useState<string | null>(null);

    // Round Off state
    const [roundOffEnabled, setRoundOffEnabled] = useState<boolean>(true);

    // Lead conversion to Project status
    const [isLeadConverted, setIsLeadConverted] = useState<boolean>(() => {
        if (!project) return false;
        // If explicitly passed false from parent, it is strictly unconverted
        if (project.is_lead_converted === false || project.is_converted === 0 || project.is_converted === false || (project as any)?.is_initial_quote === true) return false;
        // If inside the official Projects page (/projects/:id), it's a real active project
        const isInsideProj = typeof window !== 'undefined' && window.location.pathname.includes('/projects/');
        if (isInsideProj) return true;
        // Outside of /projects/ route, quotation CANNOT be converted unless client explicitly accepted
        if (project.ack_status !== 'accepted') return false;
        // If explicitly passed true from parent
        if (project.is_lead_converted === true || project.is_lead_converted === 1) return true;
        if (project.is_converted === 1 || project.is_converted === true || project.is_converted === '1') return true;

        const lst = String(project.lead_status || '').toLowerCase().trim();
        if (['won', 'converted', 'order_converted'].includes(lst)) return true;

        const st = String(project.status || '').toLowerCase().trim();
        if (['won', 'converted', 'order_converted', 'designing phase', 'execution', 'site in progress', 'completed'].includes(st)) {
            return true;
        }
        return false;
    });

    // Tracking for Stage 1, Stage 2 Payment and QC Slot Booking from lead / project records
    const [matchedLeadStatus, setMatchedLeadStatus] = useState<{
        stage1_paid?: boolean;
        stage2_paid?: boolean;
        isQcBooked?: boolean;
        isQcMeetingStarted?: boolean;
        qc_status?: string;
    }>({});

    useEffect(() => {
        const checkLeadConversion = async () => {
            const isInsideProj = typeof window !== 'undefined' && window.location.pathname.includes('/projects/');
            // If already inside /projects/ route, this is an active project
            if (isInsideProj) {
                setIsLeadConverted(true);
            }
            // If outside of /projects/ route and client has NOT accepted, quotation is strictly unconverted
            if (!isInsideProj && project?.ack_status !== 'accepted') {
                setIsLeadConverted(false);
                return;
            }
            // If explicitly marked as unconverted or initial quote
            if (project?.is_lead_converted === false || project?.is_converted === 0 || project?.is_converted === false || (project as any)?.is_initial_quote === true) {
                setIsLeadConverted(false);
                return;
            }
            // If explicitly marked as converted from parent
            if (project?.is_lead_converted === true || project?.is_converted === 1 || project?.is_converted === true || project?.has_project_started === true) {
                setIsLeadConverted(true);
            }

            const targetPid = project?.project_code || project?.manual_client_id || project?.project_id || project?.id || project?.lead_id;
            const cName = String(project?.client_name || proposalFor || subtitle || '').toLowerCase().trim();
            if (!targetPid && !cName) return;

            try {
                const [projsRes, leadsRes] = await Promise.all([
                    axios.get(`${API_BASE_URL}/projects`).catch(() => ({ data: { data: [] } })),
                    axios.get(`${API_BASE_URL}/leads`).catch(() => ({ data: { data: [] } }))
                ]);
                const projs = projsRes.data?.data || (Array.isArray(projsRes.data) ? projsRes.data : []);
                const leads = leadsRes.data?.data || (Array.isArray(leadsRes.data) ? leadsRes.data : []);

                const rawPid = String(targetPid || '').toLowerCase().trim();
                const numPid = rawPid.replace(/\D/g, '');

                // 1. Check matching lead FIRST: lead status is the single source of truth for unconverted leads
                const matchedLead = leads.find((l: any) => {
                    const lid = String(l.lead_id || '').toLowerCase().trim();
                    const manualId = String(l.manual_client_id || '').toLowerCase().trim();
                    const lName = String(l.client_name || '').toLowerCase().trim();
                    return (numPid && lid === numPid) || (rawPid && lid === rawPid) ||
                        (manualId && (manualId === rawPid || rawPid.includes(manualId) || manualId.includes(rawPid))) ||
                        (lName && cName && (lName === cName || lName.includes(cName) || cName.includes(lName)));
                });

                if (matchedLead) {
                    const isLeadStage1Paid = Boolean(
                        matchedLead.stage1_paid === 1 ||
                        matchedLead.stage1_paid === true ||
                        matchedLead.is_10_percent_paid === 1 ||
                        matchedLead.is_10_percent_paid === true ||
                        String(matchedLead.payment_status || '').toLowerCase().includes('10%') ||
                        String(matchedLead.payment_status || '').toLowerCase().includes('20%')
                    );
                    const isLeadStage2Paid = Boolean(
                        matchedLead.stage2_paid === 1 ||
                        matchedLead.is_20_percent_paid === 1 ||
                        String(matchedLead.payment_status || '').toLowerCase().includes('20%')
                    );
                    const hasLeadQcTime = Boolean(
                        (matchedLead.qc_booking_time && String(matchedLead.qc_booking_time).trim() !== '' && matchedLead.qc_booking_time !== '0000-00-00 00:00:00') ||
                        (matchedLead.site_manager_booking_time && String(matchedLead.site_manager_booking_time).trim() !== '' && matchedLead.site_manager_booking_time !== '0000-00-00 00:00:00') ||
                        (matchedLead.site_inspector_booking_time && String(matchedLead.site_inspector_booking_time).trim() !== '' && matchedLead.site_inspector_booking_time !== '0000-00-00 00:00:00')
                    );
                    const leadQcStatus = String(matchedLead.qc_status || matchedLead.site_inspector_status || matchedLead.site_manager_status || '').toLowerCase().trim();
                    const isLeadQcMeetingStarted = Boolean(
                        ['in_meeting', 'started', 'meeting_completed', 'completed', 'approved', 'qc_approved', 'done'].includes(leadQcStatus) ||
                        matchedLead.is_qc_completed === 1 ||
                        matchedLead.is_qc_done === 1
                    );
                    const isLeadQcBooked = hasLeadQcTime || ['booked', 'in_meeting', 'meeting_completed', 'completed', 'approved'].includes(leadQcStatus);

                    setMatchedLeadStatus({ stage1_paid: isLeadStage1Paid, stage2_paid: isLeadStage2Paid, isQcBooked: isLeadQcBooked, qc_status: leadQcStatus, isQcMeetingStarted: isLeadQcMeetingStarted });

                    const isConv = !isClientRejected && Boolean(
                        matchedLead.is_converted === 1 ||
                        matchedLead.is_converted === true ||
                        matchedLead.is_converted === '1' ||
                        matchedLead.status === 'won' ||
                        matchedLead.status === 'converted' ||
                        matchedLead.d1_status === 'won' ||
                        matchedLead.d1_status === 'converted'
                    );
                    setIsLeadConverted(isConv);
                    return;
                }

                // 2. If no lead found, check if project in projects table has active converted status
                const activeProjectStatuses = ['designing phase', 'execution', 'site in progress', 'site work', 'completed', 'won', 'converted', 'order_converted'];
                const matchedProj = projs.find((p: any) => {
                    const pId = String(p.project_id || '').toLowerCase().trim();
                    const pCode = String(p.project_code || '').toLowerCase().trim();
                    const pName = String(p.project_name || p.client_name || '').toLowerCase().trim();
                    return (numPid && pId === numPid) || (rawPid && pId === rawPid) ||
                        (rawPid && pCode && (pCode === rawPid || pCode.includes(rawPid) || rawPid.includes(pCode))) ||
                        (cName && pName && (pName === cName || pName.includes(cName) || cName.includes(pName)));
                });

                if (matchedProj) {
                    const isProjStage1Paid = Boolean(
                        matchedProj.stage1_paid === 1 ||
                        matchedProj.stage1_paid === true ||
                        matchedProj.is_10_percent_paid === 1 ||
                        matchedProj.is_10_percent_paid === true ||
                        String(matchedProj.payment_status || '').toLowerCase().includes('10%') ||
                        String(matchedProj.payment_status || '').toLowerCase().includes('20%')
                    );
                    const isProjStage2Paid = Boolean(
                        matchedProj.stage2_paid === 1 ||
                        matchedProj.is_20_percent_paid === 1 ||
                        String(matchedProj.payment_status || '').toLowerCase().includes('20%')
                    );
                    const hasProjQcTime = Boolean(
                        (matchedProj.qc_booking_time && String(matchedProj.qc_booking_time).trim() !== '' && matchedProj.qc_booking_time !== '0000-00-00 00:00:00') ||
                        (matchedProj.site_manager_booking_time && String(matchedProj.site_manager_booking_time).trim() !== '' && matchedProj.site_manager_booking_time !== '0000-00-00 00:00:00') ||
                        (matchedProj.site_inspector_booking_time && String(matchedProj.site_inspector_booking_time).trim() !== '' && matchedProj.site_inspector_booking_time !== '0000-00-00 00:00:00')
                    );
                    const projQcStatus = String(matchedProj.qc_status || matchedProj.site_inspector_status || matchedProj.site_manager_status || '').toLowerCase().trim();
                    const isProjQcMeetingStarted = Boolean(
                        ['in_meeting', 'started', 'meeting_completed', 'completed', 'approved', 'qc_approved', 'done'].includes(projQcStatus) ||
                        matchedProj.is_qc_completed === 1 ||
                        matchedProj.is_qc_done === 1
                    );
                    const isProjQcBooked = hasProjQcTime || ['booked', 'in_meeting', 'meeting_completed', 'completed', 'approved'].includes(projQcStatus);

                    setMatchedLeadStatus({ stage1_paid: isProjStage1Paid, stage2_paid: isProjStage2Paid, isQcBooked: isProjQcBooked, qc_status: projQcStatus, isQcMeetingStarted: isProjQcMeetingStarted });

                    if (matchedProj.status && activeProjectStatuses.includes(String(matchedProj.status).toLowerCase().trim())) {
                        if (isInsideProj || project?.ack_status === 'accepted') {
                            setIsLeadConverted(true);
                            return;
                        }
                    }
                }

                setIsLeadConverted(false);
            } catch (err) { }
        };
        checkLeadConversion();
    }, [project, proposalFor, subtitle]);

    // Auto-sync overallGstRate with item GST rates if overallGstRate is 0 but items have a non-zero GST rate
    useEffect(() => {
        if (!sections || sections.length === 0) return;
        const validItems = sections.flatMap(s => s.items).filter(i => i.brand !== 'HEADER');
        if (validItems.length === 0) return;

        const nonZeroRates = validItems
            .map(i => i.gst_rate)
            .filter(r => r !== undefined && r !== null && String(r).trim() !== '' && !isNaN(Number(r)) && Number(r) > 0)
            .map(Number);

        if (nonZeroRates.length > 0 && overallGstRate === 0) {
            setOverallGstRate(nonZeroRates[0]);
        }
    }, [sections, overallGstRate]);

    // Live state and reactive updates for Stage 1 Payment
    const [liveStage1Paid, setLiveStage1Paid] = useState<boolean>(() => {
        const pid = String(project?.project_id || (project as any)?.lead_id || (project as any)?.id || quoteId || '').trim();
        const pcode = String((project as any)?.project_code || (project as any)?.manual_client_id || '').trim();
        if (pid && (localStorage.getItem(`stage1_paid_${pid}`) === 'true' || localStorage.getItem(`stage1_paid_${pid}`) === '1')) return true;
        if (pcode && (localStorage.getItem(`stage1_paid_${pcode}`) === 'true' || localStorage.getItem(`stage1_paid_${pcode}`) === '1')) return true;
        return false;
    });

    useEffect(() => {
        const pid = String(project?.project_id || (project as any)?.lead_id || (project as any)?.id || quoteId || '').trim();
        const pcode = String((project as any)?.project_code || (project as any)?.manual_client_id || '').trim();
        if (!pid && !pcode) return;

        if ((pid && localStorage.getItem(`stage1_paid_${pid}`) === 'true') || (pcode && localStorage.getItem(`stage1_paid_${pcode}`) === 'true')) {
            setLiveStage1Paid(true);
        }

        const handlePayment1Update = (e: any) => {
            const updatedPid = e?.detail?.projectId;
            if (!updatedPid || updatedPid === pid || updatedPid === pcode || String(updatedPid) === String(project?.project_id)) {
                setLiveStage1Paid(true);
            }
        };

        window.addEventListener('stage1_payment_updated', handlePayment1Update);
        return () => {
            window.removeEventListener('stage1_payment_updated', handlePayment1Update);
        };
    }, [project, quoteId]);

    const isClientRejected = Boolean(
        project?.ack_status === 'rejected' ||
        project?.status === 'order_lost' ||
        project?.status === 'rejected' ||
        (project as any)?.lead_status === 'lost' ||
        (project as any)?.lead_status === 'rejected'
    );

    const effectiveIsStage1Paid = useMemo(() => {
        if (isClientRejected) return false;
        if (typeof isStage1PaidProp === 'boolean') return isStage1PaidProp;
        if (liveStage1Paid) return true;
        const pid = String(project?.project_id || (project as any)?.lead_id || (project as any)?.id || quoteId || '').trim();
        const pcode = String((project as any)?.project_code || (project as any)?.manual_client_id || '').trim();
        if (pid && (localStorage.getItem(`stage1_paid_${pid}`) === 'true' || localStorage.getItem(`stage1_paid_${pid}`) === '1')) return true;
        if (pcode && (localStorage.getItem(`stage1_paid_${pcode}`) === 'true' || localStorage.getItem(`stage1_paid_${pcode}`) === '1')) return true;
        if (project?.stage1_paid === 1 || project?.stage1_paid === true || (project as any)?.stage1_paid === '1') return true;
        if ((project as any)?.is_10_percent_paid === 1 || (project as any)?.is_10_percent_paid === true || (project as any)?.is_10_percent_paid === '1') return true;
        if (String((project as any)?.payment_status || '').toLowerCase().includes('10%') || String((project as any)?.payment_status || '').toLowerCase().includes('20%')) return true;
        if (Number(project?.paidPercent || (project as any)?.paid_percent || 0) >= 9.9) return true;
        const initialB = parseFloat(String(project?.stage1_base_budget || project?.initial_quote_amount || project?.budget || (project as any)?.total_budget || 0));
        const totPaid = parseFloat(String(project?.total_paid || (project as any)?.advance_paid || (project as any)?.advance_received || 0));
        if (initialB > 0 && totPaid >= (initialB * 0.095)) return true;
        if (totPaid >= 10000) return true;
        if (Array.isArray(project?.transactions) && project.transactions.some((t: any) => t.type === 'credit' && !t.is_deleted && (parseFloat(t.amount || 0) >= 10000 || String(t.category || '').toLowerCase().includes('stage 1') || String(t.description || '').toLowerCase().includes('stage 1') || String(t.description || '').toLowerCase().includes('10%') || String(t.description || '').toLowerCase().includes('advance')))) return true;
        if (matchedLeadStatus.stage1_paid) return true;
        return false;
    }, [isStage1PaidProp, liveStage1Paid, project, quoteId, matchedLeadStatus.stage1_paid, isClientRejected]);

    // STRICT RULE: Without Stage 1 Payment (10% token advance), a lead/quotation CANNOT enter Project Mode!
    // And if client rejected or has not accepted the quotation, project workflow is strictly locked.
    const isInsideProjectsRoute = typeof window !== 'undefined' && window.location.pathname.includes('/projects/');
    const isClientAccepted = Boolean(
        project?.ack_status === 'accepted' ||
        project?.status === 'order_converted' ||
        project?.status === 'approved' ||
        (project as any)?.is_lead_converted === true ||
        (project as any)?.is_converted === 1
    );

    const isProjectStarted = !isClientRejected && Boolean(
        isInsideProjectsRoute
            ? (effectiveIsStage1Paid && (
                isLeadConverted ||
                project?.is_lead_converted === true ||
                project?.is_converted === 1 ||
                project?.is_converted === true ||
                project?.has_project_started === true ||
                (project?.status && ['designing phase', 'execution', 'site in progress', 'completed', 'won', 'converted', 'order_converted', 'project_started'].includes(String(project.status).toLowerCase().trim())) ||
                (project?.project_status && ['designing phase', 'execution', 'site in progress', 'completed', 'won', 'converted', 'order_converted', 'project_started'].includes(String(project.project_status).toLowerCase().trim())) ||
                (project?.lead_status && ['won', 'converted', 'order_converted'].includes(String(project.lead_status).toLowerCase().trim()))
            ))
            : ((isClientAccepted || project?.status === 'order_converted') && (
                effectiveIsStage1Paid ||
                project?.status === 'order_converted' ||
                isLeadConverted ||
                project?.is_lead_converted === true ||
                project?.is_converted === 1 ||
                project?.is_converted === true ||
                project?.has_project_started === true ||
                (project?.status && ['designing phase', 'execution', 'site in progress', 'completed', 'won', 'converted', 'order_converted', 'project_started'].includes(String(project.status).toLowerCase().trim()))
            ))
    );

    // Initial Quotation for Lead State (strictly scoped per quote record)
    const [isInitialQuote, setIsInitialQuote] = useState<boolean>(() => {
        if (!project) return false;
        if (isProjectStarted) return false;
        return true;
    });

    useEffect(() => {
        if (!project) return;
        if (isProjectStarted) {
            setIsInitialQuote(false);
        } else {
            setIsInitialQuote(true);
        }
    }, [project, isProjectStarted]);

    // Send to QC disable logic moved after user & role evaluation

    // Unsaved changes beforeunload warning listener
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isDirty) {
                e.preventDefault();
                e.returnValue = 'You have unsaved changes in your quotation. Are you sure you want to leave?';
                return e.returnValue;
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDirty]);

    // Purge any stale legacy initial quote flags from browser storage
    useEffect(() => {
        try {
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('initial_quote_marked_')) {
                    localStorage.removeItem(key);
                }
            });
            Object.keys(sessionStorage).forEach(key => {
                if (key.startsWith('initial_quote_marked_')) {
                    sessionStorage.removeItem(key);
                }
            });
        } catch (e) { }
    }, []);


    // Final Version state - strictly scoped to active quotation version
    const [isFinalVersion, setIsFinalVersion] = useState<boolean>(false);

    useEffect(() => {
        const projId = project?.project_id || project?.id;
        if (projId) sessionStorage.removeItem(`final_locked_project_${projId}`);
        if (isNewlyCreated) {
            setIsFinalVersion(false);
        }
    }, [project, isNewlyCreated]);

    const [showFinalVersionModal, setShowFinalVersionModal] = useState<boolean>(false);
    const lastAlertTimeRef = React.useRef<number>(0);

    const checkLockEdit = (): boolean => {
        if (isFinalVersion || isReadOnly) {
            const now = Date.now();
            if (now - lastAlertTimeRef.current > 3000) {
                lastAlertTimeRef.current = now;
                alert('This quote has already been finalized as the Final Version. Further edits are not allowed.');
            }
            return true;
        }
        if (qcStatus === 'under_review') {
            const now = Date.now();
            if (now - lastAlertTimeRef.current > 3000) {
                lastAlertTimeRef.current = now;
                const curV = (selectedVersionData as any)?.version || selectedVersionData?.versionNum || (versions && versions.length > 0 ? (versions[0]?.version || versions[0]?.version_number || versions.length) : 1);
                alert(`⚠️ Quotation Under QC Review\n\nThis quotation (Version ${curV}) is currently under Quality Check review.\n\nPlease wait for the QC team's reply before editing, creating, or saving a new version.`);
            }
            return true;
        }
        return false;
    };

    const isLocked = !!(isReadOnly || isFinalVersion);

    // Category-wise Discount state
    const [showCategoryDiscountModal, setShowCategoryDiscountModal] = useState(false);
    const [tempCategoryDiscounts, setTempCategoryDiscounts] = useState<Record<string, {
        type: 'percent' | 'flat';
        value: number;
        maxDiscount?: number;
        adminApproved?: boolean;
        approvedBy?: string;
        approvedAt?: string;
        approvedValue?: number;
        requestedValue?: number;
        requestedAt?: string;
        requestId?: number;
        rejected?: boolean;
        rejectedBy?: string;
        rejectedAt?: string;
        rejectionReason?: string;
    }>>({});
    const [globalMaxDiscount, setGlobalMaxDiscount] = useState<number>(10);
    const [systemCategoryMaxLimits, setSystemCategoryMaxLimits] = useState<Record<string, number>>({});

    const resolveCategoryMaxLimit = useCallback((catName: string, limitsMap?: Record<string, number>, fallback?: number): number => {
        const map = limitsMap || systemCategoryMaxLimits;
        const def = fallback !== undefined ? fallback : (globalMaxDiscount || 10);
        if (!catName || !map || Object.keys(map).length === 0) return def;

        const norm = catName.trim().toLowerCase();
        const compact = norm.replace(/[\s\-_]/g, '');

        // 1. Direct exact match (case-insensitive)
        for (const [key, val] of Object.entries(map)) {
            if (key.trim().toLowerCase() === norm) return Number(val);
        }
        // 2. Compact match (ignoring whitespace and hyphens)
        for (const [key, val] of Object.entries(map)) {
            if (key.trim().toLowerCase().replace(/[\s\-_]/g, '') === compact) return Number(val);
        }
        // 3. Substring match
        for (const [key, val] of Object.entries(map)) {
            const kNorm = key.trim().toLowerCase();
            if (norm.includes(kNorm) || kNorm.includes(norm)) return Number(val);
        }
        return def;
    }, [systemCategoryMaxLimits, globalMaxDiscount]);
    const [activeDiscountRequest, setActiveDiscountRequest] = useState<{
        id: number;
        status: 'pending' | 'approved' | 'rejected';
        requested_by_name?: string;
        reviewed_by_name?: string;
        reviewed_at?: string;
        rejection_reason?: string;
        created_at?: string;
        notes?: string;
        category_discounts_parsed?: any;
    } | null>(null);
    const [showRequestDiscountModal, setShowRequestDiscountModal] = useState<boolean>(false);
    const [discountRequestNote, setDiscountRequestNote] = useState<string>('');
    const [submittingDiscountApproval, setSubmittingDiscountApproval] = useState<boolean>(false);
    const [sendingCategoryApproval, setSendingCategoryApproval] = useState<string | null>(null);
    const [checkingDiscountStatus, setCheckingDiscountStatus] = useState<boolean>(false);
    const [adminAuthModal, setAdminAuthModal] = useState<{
        open: boolean;
        category?: string;
        selectedAdmin: string;
        pin: string;
        error: string;
    } | null>(null);

    // Current user and admin detection for discount approvals and QC rules
    const effectiveUser = useMemo(() => {
        if (user && (user.user_id || user.id || user.role || user.username)) return user;
        try {
            const saved = localStorage.getItem('Livincart_user') || localStorage.getItem('user');
            return saved ? JSON.parse(saved) : (user || null);
        } catch {
            return user || null;
        }
    }, [user]);

    const isAdminUser = useMemo(() => {
        let u = effectiveUser;
        if (!u || (!u.role && !u.is_admin)) {
            try {
                const s = localStorage.getItem('Livincart_user') || localStorage.getItem('user');
                if (s) u = JSON.parse(s);
            } catch { }
        }
        if (!u) return false;
        const r = String(u.role || u.user_type || '').toLowerCase();
        return r === 'admin' || r === 'super_admin' || r === 'owner' || r.includes('admin') || u.is_admin === true || u.is_admin === 1;
    }, [effectiveUser]);

    // Role-based approval access: Admin, Super Admin, Design Manager, Business Manager, Project Manager
    const canApproveDiscounts = useMemo(() => {
        let u = effectiveUser;
        if (!u || (!u.role && !u.is_admin)) {
            try {
                const s = localStorage.getItem('Livincart_user') || localStorage.getItem('user');
                if (s) u = JSON.parse(s);
            } catch { }
        }
        if (!u) return false;
        if (u.is_admin === true || u.is_admin === 1) return true;
        const r = String(u.role || u.user_type || '').toLowerCase().trim();
        return (
            r === 'admin' ||
            r === 'super_admin' ||
            r === 'owner' ||
            r.includes('admin') ||
            r === 'design_manager' ||
            r === 'designer_manager' ||
            r === 'dm' ||
            r.includes('design manager') ||
            r.includes('design_manager') ||
            r === 'business_manager' ||
            r === 'business_associate' ||
            r === 'bm' ||
            r === 'ba' ||
            r.includes('business manager') ||
            r.includes('business_manager') ||
            r === 'manager' ||
            r === 'project_manager' ||
            r === 'project_head' ||
            r === 'pm'
        );
    }, [effectiveUser]);

    const adminUsersList = useMemo(() => {
        const filtered = (allUsersList || []).filter(u => {
            const r = String(u.role || '').toLowerCase();
            return (
                r === 'admin' ||
                u.is_admin === true ||
                u.is_admin === 1 ||
                r.includes('admin') ||
                r === 'design_manager' ||
                r.includes('design manager') ||
                r === 'business_manager' ||
                r.includes('business manager') ||
                r === 'manager' ||
                r === 'project_manager'
            );
        });
        if (filtered.length === 0) {
            return [{ user_id: 'admin', name: 'Admin (Master)', role: 'admin' }];
        }
        return filtered;
    }, [allUsersList]);

    // Check if the current user is a Designer / Non-admin employee
    const isDesignerOrEmployee = useMemo(() => {
        if (canApproveDiscounts || isAdminUser) return false;
        let u = effectiveUser;
        if (!u || (!u.role && !u.is_admin)) {
            try {
                const s = localStorage.getItem('Livincart_user') || localStorage.getItem('user');
                if (s) u = JSON.parse(s);
            } catch { }
        }
        const role = String(u?.role || u?.user_type || '').toLowerCase().trim();
        if (['admin', 'super_admin', 'owner', 'pm', 'project_manager', 'manager', 'project_head', 'design_manager', 'business_manager'].includes(role)) return false;
        if (u?.is_admin === true || u?.is_admin === 1) return false;
        return true; // Designer, D1, D2, Associate Designer, Employee, etc.
    }, [effectiveUser, isAdminUser, canApproveDiscounts]);

    // Live state and reactive updates for Stage 2 Payment
    const [liveStage2Paid, setLiveStage2Paid] = useState<boolean>(() => {
        const pid = String(project?.project_id || (project as any)?.lead_id || (project as any)?.id || quoteId || '').trim();
        const pcode = String((project as any)?.project_code || (project as any)?.manual_client_id || '').trim();
        if (pid && (localStorage.getItem(`stage2_paid_${pid}`) === 'true' || localStorage.getItem(`stage2_paid_${pid}`) === '1')) return true;
        if (pcode && (localStorage.getItem(`stage2_paid_${pcode}`) === 'true' || localStorage.getItem(`stage2_paid_${pcode}`) === '1')) return true;
        return false;
    });

    useEffect(() => {
        const pid = String(project?.project_id || (project as any)?.lead_id || (project as any)?.id || quoteId || '').trim();
        const pcode = String((project as any)?.project_code || (project as any)?.manual_client_id || '').trim();
        if (!pid && !pcode) return;

        if ((pid && localStorage.getItem(`stage2_paid_${pid}`) === 'true') || (pcode && localStorage.getItem(`stage2_paid_${pcode}`) === 'true')) {
            setLiveStage2Paid(true);
        }

        let isMounted = true;
        const fetchLiveStage2 = async () => {
            try {
                const cleanId = pid.replace(/\D/g, '') || pid;
                const requests = [];
                if (cleanId) {
                    requests.push(axios.get(`${API_BASE_URL}/projects/${cleanId}`).catch(() => null));
                    requests.push(axios.get(`${API_BASE_URL}/finance?project_id=${cleanId}`).catch(() => null));
                }
                const results = await Promise.all(requests);
                if (!isMounted) return;

                const projData = results[0]?.data?.data || results[0]?.data;
                const finData = results[1]?.data?.data || (Array.isArray(results[1]?.data) ? results[1]?.data : []);

                let isPaid = false;
                if (projData) {
                    if (projData.stage2_paid === 1 || projData.stage2_paid === true || projData.is_20_percent_paid === 1 || projData.is_20_percent_paid === true) isPaid = true;
                    if (String(projData.payment_status || '').toLowerCase().includes('20%')) isPaid = true;
                    const stage = String(projData.project_stage || projData.stage || '').toLowerCase();
                    if (['masking done', 'sow done', 'works contract done', 'r2p done', 'production in progress', 'ready to dispatch', 'in transit', 'delivery done', 'installation stage', 'final qc', 'handover'].includes(stage)) isPaid = true;
                }
                if (!isPaid && Array.isArray(finData)) {
                    const totalCredits = finData.filter((t: any) => t.type === 'credit' && !t.is_deleted).reduce((sum: number, t: any) => sum + parseFloat(t.amount || 0), 0);
                    const hasStage2Tx = finData.some((t: any) => t.type === 'credit' && !t.is_deleted && (String(t.description || '').toLowerCase().includes('stage 2') || String(t.description || '').toLowerCase().includes('20%') || String(t.category || '').toLowerCase().includes('stage 2')));
                    if (totalCredits >= 15000 || hasStage2Tx) isPaid = true;
                }

                if (isPaid && isMounted) {
                    setLiveStage2Paid(true);
                    if (pid) localStorage.setItem(`stage2_paid_${pid}`, 'true');
                    if (pcode) localStorage.setItem(`stage2_paid_${pcode}`, 'true');
                }
            } catch (err) {
                console.warn('Live stage 2 payment check:', err);
            }
        };

        fetchLiveStage2();

        const handlePaymentUpdate = (e: any) => {
            const updatedPid = e?.detail?.projectId;
            if (!updatedPid || updatedPid === pid || updatedPid === pcode || String(updatedPid) === String(project?.project_id)) {
                setLiveStage2Paid(true);
            }
        };

        window.addEventListener('stage2_payment_updated', handlePaymentUpdate);
        return () => {
            isMounted = false;
            window.removeEventListener('stage2_payment_updated', handlePaymentUpdate);
        };
    }, [project?.project_id, (project as any)?.lead_id, (project as any)?.id, quoteId]);

    // Check Stage 2 Payment status (Client paid 20% milestone)
    const effectiveIsStage2Paid = useMemo(() => {
        if (isStage2PaidProp === true) return true;
        if (liveStage2Paid) return true;
        const pid = String(project?.project_id || (project as any)?.lead_id || (project as any)?.id || quoteId || '').trim();
        const pcode = String((project as any)?.project_code || (project as any)?.manual_client_id || '').trim();
        if (pid && (localStorage.getItem(`stage2_paid_${pid}`) === 'true' || localStorage.getItem(`stage2_paid_${pid}`) === '1')) return true;
        if (pcode && (localStorage.getItem(`stage2_paid_${pcode}`) === 'true' || localStorage.getItem(`stage2_paid_${pcode}`) === '1')) return true;
        if (project?.stage2_paid === 1 || project?.stage2_paid === true || (project as any)?.stage2_paid === '1') return true;
        if ((project as any)?.is_20_percent_paid === 1 || (project as any)?.is_20_percent_paid === true || (project as any)?.is_20_percent_paid === '1') return true;
        if (project?.lead_info?.stage2_paid === 1 || (project?.lead_info as any)?.is_20_percent_paid === 1) return true;
        if (String((project as any)?.payment_status || project?.lead_info?.payment_status || '').toLowerCase().includes('20%')) return true;
        if (Number(project?.paidPercent || (project as any)?.paid_percent || 0) >= 14.5) return true;
        if (project?.is_final_quote_approved === 1 || project?.qc_approved === 1) return true;
        const currStage = String(project?.project_stage || (project as any)?.stage || '').toLowerCase();
        if (['masking done', 'sow done', 'works contract done', 'r2p done', 'production in progress', 'ready to dispatch', 'in transit', 'delivery done', 'installation stage', 'final qc', 'handover'].includes(currStage)) {
            return true;
        }
        if (Array.isArray(project?.transactions) && project.transactions.some((t: any) => t.type === 'credit' && (parseFloat(t.amount || 0) >= 15000 || String(t.category || '').toLowerCase().includes('stage 2') || String(t.description || '').toLowerCase().includes('stage 2') || String(t.description || '').toLowerCase().includes('20%')))) return true;
        const initialB = parseFloat(String(project?.stage1_base_budget || project?.initial_quote_amount || project?.budget || (project as any)?.total_budget || 0));
        const totPaid = parseFloat(String(project?.total_paid || (project as any)?.advance_paid || (project as any)?.advance_received || 0));
        if (initialB > 0 && totPaid >= (initialB * 0.195)) return true;
        if (totPaid >= 20000) return true;
        if (matchedLeadStatus.stage2_paid) return true;
        return false;
    }, [isStage2PaidProp, liveStage2Paid, project, quoteId, matchedLeadStatus.stage2_paid]);

    // Real-time QC Booking & Meeting Start Listener
    const [liveQcMeetingStarted, setLiveQcMeetingStarted] = useState<boolean>(false);
    const [liveQcBooked, setLiveQcBooked] = useState<boolean>(false);

    useEffect(() => {
        const handleQcUpdate = () => {
            setLiveQcBooked(true);
            setLiveQcMeetingStarted(true);
        };
        window.addEventListener('qc_meeting_status_changed', handleQcUpdate);
        window.addEventListener('qc_status_changed', handleQcUpdate);
        window.addEventListener('qc_slot_booked', handleQcUpdate);
        return () => {
            window.removeEventListener('qc_meeting_status_changed', handleQcUpdate);
            window.removeEventListener('qc_status_changed', handleQcUpdate);
            window.removeEventListener('qc_slot_booked', handleQcUpdate);
        };
    }, []);

    // Check Quality Check (QC) Slot Booking status
    const effectiveIsQcBooked = useMemo(() => {
        if (isQcBookedProp === true) return true;
        if (liveQcBooked) return true;
        const hasQcTime = Boolean(
            ((project as any)?.qc_booking_time && String((project as any)?.qc_booking_time).trim() !== '' && (project as any)?.qc_booking_time !== '0000-00-00 00:00:00') ||
            ((project as any)?.site_manager_booking_time && String((project as any)?.site_manager_booking_time).trim() !== '' && (project as any)?.site_manager_booking_time !== '0000-00-00 00:00:00') ||
            ((project as any)?.site_inspector_booking_time && String((project as any)?.site_inspector_booking_time).trim() !== '' && (project as any)?.site_inspector_booking_time !== '0000-00-00 00:00:00') ||
            (project?.lead_info?.qc_booking_time && String(project.lead_info.qc_booking_time).trim() !== '' && project.lead_info.qc_booking_time !== '0000-00-00 00:00:00') ||
            (project?.lead_info?.site_manager_booking_time && String(project.lead_info.site_manager_booking_time).trim() !== '' && project.lead_info.site_manager_booking_time !== '0000-00-00 00:00:00')
        );
        if (hasQcTime) return true;
        const qcSt = String(project?.qc_status || (project as any)?.site_inspector_status || (project as any)?.site_manager_status || project?.lead_info?.qc_status || '').toLowerCase().trim();
        if (['booked', 'in_meeting', 'meeting_completed', 'completed', 'approved', 'under_review', 'qc_approved', 'site_manager_booked'].includes(qcSt)) return true;
        const projIdKey = String(project?.project_id || (project as any)?.lead_id || (project as any)?.id || '');
        const projManualKey = String((project as any)?.manual_client_id || (project as any)?.project_code || '');
        if ((projIdKey && (localStorage.getItem(`qc_booked_${projIdKey}`) === 'true' || localStorage.getItem(`qc_completed_${projIdKey}`) === 'true')) ||
            (projManualKey && (localStorage.getItem(`qc_booked_${projManualKey}`) === 'true' || localStorage.getItem(`qc_completed_${projManualKey}`) === 'true'))) return true;
        if (matchedLeadStatus.isQcBooked) return true;
        return false;
    }, [isQcBookedProp, liveQcBooked, project, matchedLeadStatus.isQcBooked]);

    // Check Quality Check (QC) Meeting status - Must be started before Send to QC is allowed
    const effectiveIsQcMeetingStarted = useMemo(() => {
        if (typeof isQcMeetingStartedProp === 'boolean') return isQcMeetingStartedProp;
        if (liveQcMeetingStarted) return true;

        const startedStatuses = ['in_meeting', 'started', 'meeting_completed', 'completed', 'approved', 'qc_approved', 'done'];

        const pQcMeetingStatus = String(
            (project as any)?.qc_meeting_status ||
            (project as any)?.site_inspector_status ||
            (project as any)?.site_manager_status ||
            (project as any)?.lead_qc_status ||
            project?.qc_status ||
            ''
        ).toLowerCase().trim();

        if (startedStatuses.includes(pQcMeetingStatus)) return true;

        if (project?.is_qc_completed === 1 || (project as any)?.is_qc_done === 1 || project?.is_final_quote_approved === 1) {
            return true;
        }

        const projIdKey = String(project?.project_id || (project as any)?.lead_id || (project as any)?.id || '');
        const projManualKey = String((project as any)?.manual_client_id || (project as any)?.project_code || '');

        if (projIdKey) {
            if (localStorage.getItem(`meeting_started_at_${projIdKey}`)) return true;
            if (localStorage.getItem(`qc_started_${projIdKey}`) === 'true') return true;
            if (localStorage.getItem(`qc_completed_${projIdKey}`) === 'true') return true;
        }
        if (projManualKey) {
            if (localStorage.getItem(`meeting_started_at_${projManualKey}`)) return true;
            if (localStorage.getItem(`qc_started_${projManualKey}`) === 'true') return true;
            if (localStorage.getItem(`qc_completed_${projManualKey}`) === 'true') return true;
        }

        if (matchedLeadStatus.isQcMeetingStarted) return true;
        if (matchedLeadStatus.qc_status && startedStatuses.includes(matchedLeadStatus.qc_status.toLowerCase().trim())) {
            return true;
        }

        return false;
    }, [isQcMeetingStartedProp, liveQcMeetingStarted, project, matchedLeadStatus]);

    // Send to QC STRICT RULE:
    // Only after BOTH conditions are completed:
    // 1. Stage 2 Payment is completed (20% milestone paid)
    // 2. The QC slot is booked by the designer
    // Until BOTH conditions are completed, the "Send to QC" button MUST remain DISABLED!
    const isSendToQCBlockedByStage2 = !effectiveIsStage2Paid;
    const isSendToQCBlockedBySlot = !effectiveIsQcBooked;
    const isSendToQCBlockedForDesigner = isSendToQCBlockedByStage2 || isSendToQCBlockedBySlot;
    const isSendToQCDisabled = isSendToQCBlockedByStage2 || isSendToQCBlockedBySlot;

    // Coupon / Promo Code state
    const [couponInput, setCouponInput] = useState('');
    const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountType: 'percent' | 'flat'; discountValue: number } | null>(null);
    const [couponError, setCouponError] = useState('');

    const [showPromoModal, setShowPromoModal] = useState(false);
    const [promoModalCode, setPromoModalCode] = useState('');
    const [promoModalType, setPromoModalType] = useState<'percent' | 'flat'>('percent');
    const [promoModalValue, setPromoModalValue] = useState<number | string>('');
    const [promoModalError, setPromoModalError] = useState('');
    const [dbPromoCodes, setDbPromoCodes] = useState<Array<{ id: number; code: string; discount_type: 'percent' | 'flat'; discount_value: number; description?: string; created_at?: string }>>([]);

    // Draft & Versions state (DEFAULT COLLAPSED)
    const [savingDraft, setSavingDraft] = useState(false);
    const [savingVersion, setSavingVersion] = useState(false);
    const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
    const [versions, setVersions] = useState<any[]>([]);
    const [isVersionsExpanded, setIsVersionsExpanded] = useState(false);
    const [loadingVersions, setLoadingVersions] = useState(false);
    const [restoringVersion, setRestoringVersion] = useState<number | null>(null);
    const [selectedVersionData, setSelectedVersionData] = useState<{ quoteId: number; versionNum: number; sections: QuoteSection[]; total: number; createdAt: string } | null>(null);
    const [loadingVersionPreview, setLoadingVersionPreview] = useState<number | null>(null);
    const [isPrintingVersion, setIsPrintingVersion] = useState(false);
    const [pendingPrintVersion, setPendingPrintVersion] = useState(false);

    // QC (Quality Check) status & actions
    const [qcStatus, setQcStatus] = useState<string>('not_sent');
    const [showQCSubmitModal, setShowQCSubmitModal] = useState(false);
    const [qcAttachmentFiles, setQcAttachmentFiles] = useState<File[]>([]);
    const [showQCRejectModal, setShowQCRejectModal] = useState(false);
    const [rejectedQCFolderId, setRejectedQCFolderId] = useState<number | null>(null);
    const [matchingQCFolder, setMatchingQCFolder] = useState<any>(null);

    const checkQCStatus = useCallback(async () => {
        const targetPid = project?.project_id || project?.id || project?.project_code || project?.manual_client_id;
        if (!targetPid) return;
        if (isNewlyCreated) {
            setQcStatus('not_sent');
            return;
        }
        try {
            const [resFolders, resFiles] = await Promise.all([
                axios.get(`${API_BASE_URL}/qc/folders?project_id=${targetPid}`).catch(() => ({ data: { success: false, data: [] } })),
                axios.get(`${API_BASE_URL}/qc/files?project_id=${targetPid}`).catch(() => ({ data: { success: false, data: [] } }))
            ]);

            const folders = resFolders.data?.success ? (resFolders.data.data || []) : [];
            const files = resFiles.data?.success ? (resFiles.data.data || []) : [];

            // Identify current version & quote
            const curQuoteId = selectedVersionData?.quoteId || (versions && versions.length > 0 ? versions[0].quote_id : null) || quoteId;
            const curVersionNum = (selectedVersionData as any)?.version || selectedVersionData?.versionNum || (versions && versions.length > 0 ? (versions[0]?.version || versions[0]?.version_number || versions.length) : 1);

            // Find QC folder for this specific version
            const matchingFolder = folders.find((f: any) => {
                const fv = Number(f.version_number || 0);
                if (fv > 0 && fv === Number(curVersionNum)) return true;
                const fName = String(f.name || '').trim().toLowerCase();
                return fName === `version ${curVersionNum}`.toLowerCase() ||
                       fName === `version_${curVersionNum}`.toLowerCase() ||
                       fName === `v${curVersionNum}`.toLowerCase();
            });
            setMatchingQCFolder(matchingFolder || null);

            // Find the specific quotation PDF file in QC files strictly for this version
            const matchingQuoteFile = files.find((f: any) => {
                if (f.file_type !== 'quote_pdf' && !String(f.file_name || '').toLowerCase().includes('.pdf')) {
                    return false;
                }

                const fileRev = Number(f.revision_number || 0);
                const isFolderMatch = Boolean(matchingFolder && Number(f.folder_id) === Number(matchingFolder.folder_id));
                const isRevMatch = fileRev > 0 && fileRev === Number(curVersionNum);
                const fileName = String(f.file_name || '').toLowerCase();
                const isNameMatch = fileName.includes(`_v${curVersionNum}_`) ||
                                    fileName.includes(`version_${curVersionNum}`) ||
                                    fileName.includes(`version ${curVersionNum}`) ||
                                    fileName.includes(`-v${curVersionNum}.`) ||
                                    fileName.includes(`_v${curVersionNum}.`);

                // Strictly prevent files belonging to OTHER versions from falsely matching
                if (fileRev > 0 && fileRev !== Number(curVersionNum)) {
                    return false;
                }
                const otherVerMatch = fileName.match(/_v(\d+)[_.-]/i) || fileName.match(/version[_\s](\d+)/i);
                if (otherVerMatch && Number(otherVerMatch[1]) !== Number(curVersionNum)) {
                    return false;
                }

                return isFolderMatch || isRevMatch || isNameMatch;
            });

            // ✅ A quotation version is officially QC Approved ONLY IF the QC folder (or version file) has completed Final Approval
            const isFolderFinalApproved = Boolean(
                (matchingFolder && (
                    Number(matchingFolder.final_qc_approved) === 1 ||
                    matchingFolder.final_qc_approved === true ||
                    matchingFolder.status === 'approved' ||
                    matchingFolder.pm_status === 'approved' ||
                    matchingFolder.pm_status === 'pm_approved'
                )) ||
                (!matchingFolder && matchingQuoteFile && (
                    matchingQuoteFile.status === 'approved'
                ))
            );

            // ✅ A quotation version is officially Rejected ONLY IF the QC folder (or version file) has been Total Rejected
            const isFolderTotalRejected = Boolean(
                (matchingFolder && (
                    matchingFolder.status === 'changes_requested' ||
                    matchingFolder.status === 'rejected' ||
                    matchingFolder.pm_status === 'pm_rejected' ||
                    matchingFolder.pm_status === 'qc_rejected'
                )) ||
                (!matchingFolder && matchingQuoteFile && (
                    matchingQuoteFile.status === 'changes_requested' ||
                    matchingQuoteFile.status === 'rejected'
                ))
            );

            if (isFolderFinalApproved) {
                setQcStatus('approved');
                setIsFinalVersion(true);
            } else if (isFolderTotalRejected) {
                setQcStatus('changes_requested');
                setIsFinalVersion(false);
                if (matchingFolder) setRejectedQCFolderId(matchingFolder.folder_id);
            } else if (matchingQuoteFile || matchingFolder) {
                // Strictly Under Review until the QC team issues a Total Rejection or Approval on the folder
                setQcStatus('under_review');
                setIsFinalVersion(false);
            } else {
                setQcStatus('not_sent');
                setIsFinalVersion(false);
            }
        } catch (err) { }
    }, [project, selectedVersionData, versions, quoteId, isNewlyCreated]);

    useEffect(() => {
        checkQCStatus();
        const handleQCEvent = () => {
            checkQCStatus();
        };
        window.addEventListener('qc_status_changed', handleQCEvent);
        return () => window.removeEventListener('qc_status_changed', handleQCEvent);
    }, [checkQCStatus]);

    // ✅ QC Approved status is STRICTLY driven by Quality Check (QC), NEVER synced with client proposal status or legacy project flags
    const isQCApproved = !isNewlyCreated && qcStatus === 'approved';

    // Category validation helper to enforce mandatory category (*)
    const validateCategories = (): boolean => {
        for (const sec of sections) {
            for (const it of sec.items || []) {
                if (it.brand !== 'HEADER' && (!it.category || !it.category.trim())) {
                    alert(`⚠️ Category is Mandatory (*)\n\nPlease select a category for item "${it.particulars || 'Item'}" in section "${sec.name || 'Section'}".`);
                    setActiveCategoryDropdownId(it.id);
                    return false;
                }
            }
        }
        return true;
    };

    const handleSendToQC = async () => {
        if (qcStatus === 'under_review') {
            const curV = (selectedVersionData as any)?.version || selectedVersionData?.versionNum || (versions && versions.length > 0 ? (versions[0]?.version || versions[0]?.version_number || versions.length) : 1);
            alert(`⚠️ Quotation Under QC Review\n\nVersion ${curV} is currently under Quality Check (QC) review.\n\nPlease wait for the QC team's reply before submitting a new version.`);
            return;
        }
        if (isSendToQCBlockedByStage2 && isSendToQCBlockedBySlot) {
            alert('⚠️ Send to QC is Locked.\n\nBoth conditions must be completed before sending quotation to Quality Check (QC):\n1. Client must complete Stage 2 Payment (20% Milestone).\n2. Designer must book a Quality Check (QC) slot.');
            return;
        }
        if (isSendToQCBlockedByStage2) {
            alert('⚠️ Send to QC is Locked.\n\nClient must complete Stage 2 Payment (20% Cumulative Milestone) before quotation can be sent to Quality Check (QC).');
            return;
        }
        if (isSendToQCBlockedBySlot) {
            alert('⚠️ Send to QC is Locked.\n\nDesigner must book a Quality Check (QC) slot before quotation can be sent to Quality Check (QC).');
            return;
        }
        if (isSendToQCDisabled) {
            alert('⚠️ Send to QC is currently disabled.');
            return;
        }
        if (!validateCategories()) return;
        const targetPid = project?.project_id || project?.id || project?.project_code || project?.manual_client_id;
        if (!targetPid) {
            alert('Project ID missing. Please save the quote before sending to Quality Check.');
            return;
        }

        setSendingToQC(true);
        try {
            let targetQid = selectedVersionData?.quoteId || (versions && versions.length > 0 ? versions[0].quote_id : null) || quoteId || 0;
            let targetVersion = (selectedVersionData as any)?.version || selectedVersionData?.versionNum || (versions && versions.length > 0 ? (versions[0]?.version || versions[0]?.version_number || versions.length) : 1);

            // 🔄 If the previous QC version was rejected (corrections requested) or there are unsaved edits:
            // Automatically save as a NEW VERSION in the database first so Version 2, 3... is created!
            if (qcStatus === 'changes_requested' || isDirty) {
                try {
                    const saveRes = await axios.post(`${API_BASE_URL}/quotes/save`, buildPayload(true));
                    if (saveRes.data && (saveRes.data.success || saveRes.data.status === 'success')) {
                        const newQid = saveRes.data.quote_id || saveRes.data.data?.quote_id;
                        const newVer = saveRes.data.version || saveRes.data.data?.version;
                        if (newQid) targetQid = newQid;
                        if (newVer) targetVersion = newVer;

                        // Auto-generate frozen PDF snapshot for this new version
                        if (newQid) {
                            try {
                                await axios.post(`${API_BASE_URL}/pdf/snapshot`, {
                                    quote_id: newQid,
                                    project_id: project?.project_id || 0
                                });
                            } catch (snapErr) {
                                console.warn('Snapshot generation notice:', snapErr);
                            }
                        }

                        await loadVersions();
                        setIsDirty(false);
                    }
                } catch (saveErr) {
                    console.warn('Auto version save notice:', saveErr);
                }
            }

            const revStr = String(targetVersion || 1).padStart(2, '0');
            await axios.post(`${API_BASE_URL}/quotes/send-to-qc`, {
                project_id: targetPid,
                version_num: targetVersion || 1,
                quote_id: targetQid,
                client_name: (project as any)?.client_name || subtitle || 'Client',
                project_name: (project as any)?.project_name || subtitle || 'Quotation'
            }).catch(() => { });

            const res = await axios.post(`${API_BASE_URL}/qc/send-quote-to-qc`, {
                project_id: targetPid,
                quote_id: targetQid,
                quote_number: subtitle || ('QT-' + targetQid),
                version: targetVersion,
                user_name: user?.name || 'User'
            });

            if (res.data && (res.data.success || res.data.status === 'success')) {
                const finalRevStr = res.data.version ? String(res.data.version).padStart(2, '0') : revStr;
                alert(`Uploaded - Quote Version - Rev-${finalRevStr} | Quality Check | Project ID ${targetPid}\n\nQuotation version successfully sent to Quality Check (QC) tab!`);
                await checkQCStatus();
                window.dispatchEvent(new CustomEvent('qc_status_changed', { detail: { version: targetVersion } }));
            } else if (res.data && res.data.message) {
                alert('Failed to send to Quality Check: ' + res.data.message);
            } else {
                alert(`Uploaded - Quote Version - Rev-${revStr} | Quality Check | Project ID ${targetPid}\n\nQuotation version successfully sent to Quality Check (QC) tab!`);
                await checkQCStatus();
                window.dispatchEvent(new CustomEvent('qc_status_changed', { detail: { version: targetVersion } }));
            }
        } catch (err: any) {
            alert('Error sending quote to Quality Check tab: ' + (err?.response?.data?.message || err?.message || ''));
        } finally {
            setSendingToQC(false);
        }
    };

    useEffect(() => {
        const origBodyBg = document.body.style.backgroundColor;
        const origDocBg = document.documentElement.style.backgroundColor;
        document.body.style.backgroundColor = '#ffffff';
        document.body.style.background = '#ffffff';
        document.documentElement.style.backgroundColor = '#ffffff';
        document.documentElement.style.background = '#ffffff';

        const fetchPromoCodes = async () => {
            try {
                const res = await axios.get(`${API_BASE_URL}/promo-codes`);
                if (res.data?.success && Array.isArray(res.data?.data)) {
                    setDbPromoCodes(res.data.data);
                }
            } catch (err) {
                console.error('Failed to fetch promo codes from DB:', err);
            }
        };
        fetchPromoCodes();

        return () => {
            document.body.style.backgroundColor = origBodyBg;
            document.body.style.background = origBodyBg;
            document.documentElement.style.backgroundColor = origDocBg;
            document.documentElement.style.background = origDocBg;
        };
    }, []);

    const toggleModule = (id: string) => {
        setExpandedModules(prev => {
            const isCurrentlyOpen = prev[id];
            if (isCurrentlyOpen) {
                return { ...prev, [id]: false };
            }
            // When opening an individual module accordion, collapse all top-level sections as well
            setIsProjectInfoExpanded(false);
            setIsModulesSummaryExpanded(false);
            setIsVersionsExpanded(false);
            return { [id]: true };
        });
    };

    const toggleVersionsSection = () => {
        setIsVersionsExpanded(prev => {
            const next = !prev;
            if (next) {
                setIsProjectInfoExpanded(false);
                setIsModulesSummaryExpanded(false);
                setExpandedModules({});
                loadVersions();
            }
            return next;
        });
    };

    const toggleProjectInfoSection = () => {
        setIsProjectInfoExpanded(prev => {
            const next = !prev;
            if (next) {
                setIsVersionsExpanded(false);
                setIsModulesSummaryExpanded(false);
                setExpandedModules({});
            }
            return next;
        });
    };

    const toggleModulesSummarySection = () => {
        setIsModulesSummaryExpanded(prev => {
            const next = !prev;
            if (next) {
                setIsVersionsExpanded(false);
                setIsProjectInfoExpanded(false);
                setExpandedModules({});
            }
            return next;
        });
    };



    const addCommonModule = (moduleName: string) => {
        const existing = sections.find(s => s.name.trim().toLowerCase() === moduleName.trim().toLowerCase());
        if (existing) {
            setExpandedModules(prev => ({ ...prev, [existing.id]: true }));
            const el = document.getElementById(`section-${existing.id}`);
            if (el) el.scrollIntoView({ behavior: 'smooth' });
            return;
        }
        const newSection: QuoteSection = {
            id: 's-' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            name: moduleName,
            items: []
        };
        addToHistory([...sections, newSection]);
        setExpandedModules(prev => ({ ...prev, [newSection.id]: true }));
    };

    const addAllCommonModules = () => {
        const existingNames = sections.map(s => s.name.trim().toLowerCase());
        const toAdd = COMMON_MODULE_NAMES.filter(name => !existingNames.includes(name.toLowerCase()));

        if (toAdd.length === 0) {
            alert('All 14 common modules are already present in this quote!');
            return;
        }

        const newSections: QuoteSection[] = toAdd.map((name, i) => ({
            id: 's-' + Date.now() + '_' + i,
            name: name,
            items: []
        }));

        addToHistory([...sections, ...newSections]);
        setIsModulesSummaryExpanded(true);
    };

    const duplicateSection = (sectionId: string) => {
        const sec = sections.find(s => s.id === sectionId);
        if (!sec) return;
        const newId = `s${Date.now()}`;
        const newSection: QuoteSection = {
            id: newId,
            name: sec.name,
            items: sec.items.map(item => ({ ...item, id: `i${Date.now()}_${Math.random().toString(36).slice(2, 6)}` }))
        };
        const idx = sections.findIndex(s => s.id === sectionId);
        const newSections = [...sections];
        newSections.splice(idx + 1, 0, newSection);
        addToHistory(newSections);
        setExpandedModules(prev => ({ ...prev, [newId]: true }));
        setOpenMenuId(null);
    };

    const moveSectionUp = (sectionId: string) => {
        const idx = sections.findIndex(s => s.id === sectionId);
        if (idx <= 0) return;
        const newSections = [...sections];
        const temp = newSections[idx];
        newSections[idx] = newSections[idx - 1];
        newSections[idx - 1] = temp;
        addToHistory(newSections);
        setOpenMenuId(null);
    };

    const moveSectionDown = (sectionId: string) => {
        const idx = sections.findIndex(s => s.id === sectionId);
        if (idx === -1 || idx >= sections.length - 1) return;
        const newSections = [...sections];
        const temp = newSections[idx];
        newSections[idx] = newSections[idx + 1];
        newSections[idx + 1] = temp;
        addToHistory(newSections);
        setOpenMenuId(null);
    };

    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isDirty) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDirty]);

    const addToHistory = (newSections: QuoteSection[]) => {
        setHistory(prev => [...prev.slice(-19), sections]); // Keep last 20 states
        setRedoStack([]);
        setSections(newSections);
        setIsDirty(true);
    };

    const handleUndo = () => {
        if (history.length === 0) return;
        const previous = history[history.length - 1];
        setRedoStack(prev => [...prev, sections]);
        setHistory(prev => prev.slice(0, -1));
        setSections(previous);
        setIsDirty(true);
    };

    const handleRedo = () => {
        if (redoStack.length === 0) return;
        const next = redoStack[redoStack.length - 1];
        setHistory(prev => [...prev, sections]);
        setRedoStack(prev => prev.slice(0, -1));
        setSections(next);
        setIsDirty(true);
    };


    useEffect(() => {
        fetchQuote();
        if (isProjectStarted) {
            loadVersions();
        } else {
            setVersions([]);
        }
    }, [project?.project_id, project?.client_name, quoteId, isUsedQuote, isProjectStarted]);

    const applyExtraDataSettings = (extra: any, qdObj?: any) => {
        const rawCoupon = qdObj?.applied_coupon || extra.applied_coupon || extra.appliedCoupon || extra.coupon || extra.promo_code;
        if (rawCoupon) {
            let couponObj = rawCoupon;
            if (typeof couponObj === 'string' && couponObj.startsWith('{')) {
                try { couponObj = JSON.parse(couponObj); } catch (e) { }
            }
            if (couponObj && typeof couponObj === 'object') {
                setAppliedCoupon(couponObj);
            }
        }

        const rawCharges = extra.additional_charges || extra.additionalCharges || qdObj?.additional_charges || qdObj?.additionalCharges;
        if (rawCharges) {
            let chargeAmt = 0;
            if (typeof rawCharges === 'object') {
                if (typeof rawCharges.amount === 'object') {
                    chargeAmt = parseFloat(rawCharges.amount?.amount || rawCharges.amount?.value || 0) || 0;
                } else {
                    chargeAmt = parseFloat(rawCharges.amount ?? rawCharges.value ?? 0) || 0;
                }
            } else {
                chargeAmt = parseFloat(rawCharges) || 0;
            }
            setAdditionalChargesAmount(chargeAmt);
            setAdditionalChargesHasGst(!!(rawCharges.withGst || rawCharges.with_gst || rawCharges.hasGst));
            if (rawCharges.gstRate !== undefined || rawCharges.gst_rate !== undefined) {
                setAdditionalChargesGstRate(parseFloat(rawCharges.gstRate ?? rawCharges.gst_rate) || 0);
            }
        }

        const rawFlat = extra.flat_discount ?? extra.flatDiscount ?? extra.general_discount ?? extra.generalDiscount ?? qdObj?.flat_discount ?? qdObj?.flatDiscount ?? qdObj?.general_discount;
        if (rawFlat !== undefined && rawFlat !== null) {
            let flatAmt = 0;
            if (typeof rawFlat === 'object') {
                flatAmt = parseFloat(rawFlat.amount ?? rawFlat.value ?? 0) || 0;
                if (rawFlat.type) setGeneralDiscountType(rawFlat.type);
            } else {
                flatAmt = parseFloat(rawFlat) || 0;
            }
            if (flatAmt > 0) {
                setGeneralDiscountAmount(flatAmt);
                if (!rawFlat.type) setGeneralDiscountType('flat');
            }
        }
        if (extra.global_discount && extra.global_discount.value !== undefined && extra.global_discount.value !== null) {
            setGlobalDiscountInputValue(extra.global_discount.value ? String(extra.global_discount.value) : '0');
            setGlobalDiscountInputType(extra.global_discount.type || 'flat');
        } else {
            setGlobalDiscountInputValue('0');
        }
        if (extra.gst_split_type) setGstSplitType(extra.gst_split_type);
        if (extra.overall_gst_enabled !== undefined) setOverallGstEnabled(!!extra.overall_gst_enabled);
        if (extra.overall_gst_line_hidden !== undefined) setOverallGstLineHidden(!!extra.overall_gst_line_hidden);
        if (extra.overall_gst_rate !== undefined && extra.overall_gst_rate !== null) {
            const parsedRate = parseFloat(extra.overall_gst_rate);
            setOverallGstRate(!isNaN(parsedRate) ? parsedRate : 0);
        }
        if (extra.round_off_enabled !== undefined) setRoundOffEnabled(!!extra.round_off_enabled);
        if (extra.custom_headings) setCustomHeadings(prev => ({ ...prev, ...extra.custom_headings }));
        if (extra.hidden_fields) setHiddenFields(prev => ({ ...prev, ...extra.hidden_fields }));
        if (extra.category_discounts || extra.tempCategoryDiscounts) {
            const rawCatDisc = extra.category_discounts || extra.tempCategoryDiscounts;
            const updatedCatDisc: any = {};
            Object.keys(rawCatDisc).forEach(k => {
                const item = rawCatDisc[k];
                if (item && typeof item === 'object') {
                    updatedCatDisc[k] = {
                        ...item,
                        maxDiscount: item.adminApproved ? Number(item.maxDiscount || 0) : undefined
                    };
                } else {
                    updatedCatDisc[k] = item;
                }
            });
            setTempCategoryDiscounts(updatedCatDisc);
        }
        if (extra.global_max_discount !== undefined && extra.global_max_discount !== null) {
            const parsedMax = parseFloat(extra.global_max_discount);
            if (!isNaN(parsedMax) && parsedMax >= 0) {
                setGlobalMaxDiscount(parsedMax);
            }
        }
        const isServerInitial = Boolean(
            extra.is_initial_quote === true ||
            qdObj?.is_initial_quote === true ||
            qdObj?.is_initial === 1 ||
            qdObj?.is_initial === true ||
            qdObj?.is_initial === '1'
        );
        setIsInitialQuote(isServerInitial);
        if (qdObj?.discount_percent !== undefined || extra.discount_percent !== undefined) {
            setDiscountPercent(parseFloat(qdObj?.discount_percent ?? extra.discount_percent) || 0);
        }
        const rawTerms = extra.terms_list || extra.terms || qdObj?.terms_list || qdObj?.terms;
        if (rawTerms && Array.isArray(rawTerms) && rawTerms.length > 0) {
            setTermsList(rawTerms);
        } else if (typeof rawTerms === 'string' && rawTerms.startsWith('[')) {
            try {
                const parsed = JSON.parse(rawTerms);
                if (Array.isArray(parsed) && parsed.length > 0) setTermsList(parsed);
            } catch (e) { }
        }

        if (extra.proposal_date || qdObj?.proposal_date) setProposalDate(extra.proposal_date || qdObj?.proposal_date);
        const exEmail = extra.client_email || extra.email || qdObj?.client_email || qdObj?.email;
        if (exEmail && typeof exEmail === 'string' && exEmail.includes('@')) {
            setClientEmail(exEmail.trim());
        }
        const exPhone = extra.client_phone || extra.phone || qdObj?.client_phone || qdObj?.phone;
        if (exPhone && typeof exPhone === 'string') {
            setClientPhone(exPhone.trim());
        }
        if (extra.proposal_for || qdObj?.proposal_for) setProposalFor(extra.proposal_for || qdObj?.proposal_for);
        if (extra.scope_of_work || qdObj?.scope_of_work || extra.project_scope || qdObj?.project_scope) {
            setScopeOfWork(extra.scope_of_work || qdObj?.scope_of_work || extra.project_scope || qdObj?.project_scope);
        }
        if (extra.production_time || qdObj?.production_time) setProductionTime(extra.production_time || qdObj?.production_time);
        if (extra.project_category || qdObj?.project_category) setProjectCategory(extra.project_category || qdObj?.project_category);
        if (extra.designer_name || qdObj?.designer_name) setDesignerName(extra.designer_name || qdObj?.designer_name);
        const smNameExtra = extra.sales_manager_name || qdObj?.sales_manager_name;
        if (smNameExtra && !isBadAdminSm(smNameExtra)) {
            setSalesManagerName(smNameExtra);
        }
        const smPhoneExtra = extra.sales_manager_phone || qdObj?.sales_manager_phone;
        if (smPhoneExtra && !isBadSmPhone(smPhoneExtra)) {
            setSalesManagerPhone(smPhoneExtra);
        }
        const smEmailExtra = extra.sales_manager_email || qdObj?.sales_manager_email;
        if (smEmailExtra) {
            setSalesManagerEmail(smEmailExtra);
        }
    };

    const fetchQuote = async () => {
        setLoading(true);
        try {
            if (project?.initialSections !== undefined && Array.isArray(project.initialSections) && project.initialSections.length > 0) {
                setSections(project.initialSections);
                if (project?.initialExtraData) {
                    applyExtraDataSettings(project.initialExtraData, project);
                }
                setLoading(false);
                return;
            }

            let qd: any = null;

            if (quoteId && !String(quoteId).startsWith('lead-')) {
                try {
                    const qRes = await axios.get(`${API_BASE_URL}/quotes/${quoteId}`);
                    if (qRes.data?.success && qRes.data?.data) {
                        qd = qRes.data.data;
                    }
                } catch (e) {
                    console.warn('Failed to load specific quoteId:', quoteId, e);
                }
            }

            if (!qd) {
                const cNameParam = project?.client_name ? `&client_name=${encodeURIComponent(project.client_name)}` : '';
                const response = await axios.get(`${API_BASE_URL}/quotes/latest?project_id=${project?.project_id || ''}&is_used=${isUsedQuote}${cNameParam}`);
                if (response.data.success && response.data.data) {
                    qd = response.data.data;
                }
            }

            if (qd) {
                const extra = qd.extra_data_parsed || qd.extra_data || {};
                const secHeadingsMap = extra.section_headings || {};
                const mappedSections = (qd.sections || []).map((s: any, idx: number) => ({
                    id: s.section_id,
                    name: s.section_name,
                    custom_headings: (s.custom_headings && typeof s.custom_headings === 'object' ? s.custom_headings : (typeof s.custom_headings === 'string' ? JSON.parse(s.custom_headings || '{}') : null)) ||
                        secHeadingsMap[s.section_id] || 
                        secHeadingsMap[String(s.section_id)] || 
                        secHeadingsMap[s.id] || 
                        secHeadingsMap[String(s.id)] || 
                        secHeadingsMap[idx] || 
                        secHeadingsMap[String(idx)] || 
                        secHeadingsMap[s.section_name || s.name] || 
                        undefined,
                    items: (s.items || []).map((i: any) => ({
                        id: i.item_id,
                        particulars: i.particulars,
                        brand: i.brand || '',
                        unit: i.unit || '',
                        quantity: parseFloat(i.quantity) || 0,
                        used_quantity: parseFloat(i.used_quantity) || 0,
                        rate: parseFloat(i.rate) || 0,
                        amount: parseFloat(i.amount) || 0,
                        width: i.width || '',
                        height: i.height || '',
                        sft: i.sft || '',
                        hsn_sac: i.hsn_sac || '',
                        image_url: i.image_url || '',
                        rate_per_sft: i.rate_per_sft ? parseFloat(i.rate_per_sft) : 0,
                        discount_percent: i.discount_percent !== undefined && i.discount_percent !== null ? parseFloat(i.discount_percent) : 0,
                        gst_rate: i.gst_rate !== undefined && i.gst_rate !== null && String(i.gst_rate) !== '' ? parseFloat(i.gst_rate) : '',
                        category: i.category || '',
                        pricing_mode: i.pricing_mode || 'dimensions'
                    }))
                }));
                setSections(mappedSections);
                if (qd.quote_id) setLoadedQuoteId(qd.quote_id);
                if (qd.quote_number) setLoadedQuoteNumber(qd.quote_number);
                setSubtitle(qd.subtitle || '');
                if (qd.subtitle) {
                    setProposalFor(qd.subtitle);
                }
                if (qd.discount_percent !== undefined) {
                    setDiscountPercent(parseFloat(qd.discount_percent) || 0);
                }

                // Restore extra data if available
                const isFinal = !isNewlyCreated && !!(extra.is_final_version || qd.is_final_version || qd.status === 'Finalized' || qd.status === 'qc_approved');
                setIsFinalVersion(isFinal);

                applyExtraDataSettings(extra, qd);
                if (!extra.global_discount) {
                    const discItems = mappedSections.flatMap(s => s.items).filter(i => i.brand !== 'HEADER' && (i.discount_percent || 0) > 0);
                    if (discItems.length > 0) {
                        const firstDisc = discItems[0].discount_percent || 0;
                        const isUniform = discItems.every(i => (i.discount_percent || 0) === firstDisc);
                        if (isUniform && firstDisc > 0) {
                            setGlobalDiscountInputType('percent');
                            setGlobalDiscountInputValue(String(firstDisc));
                        }
                    }
                }
            } else {
                // If no quote exists, start with empty sections for a clean new project/lead
                setSections([]);
            }
        } catch (err) {
            console.error('Failed to fetch quote', err);
            if (!isUsedQuote) setSections([]);
        } finally {
            setLoading(false);
        }
    };

    const getDefaultSections = (): QuoteSection[] => [
        {
            id: 'd1', name: 'A. FALSE CEILING', items: [
                { id: 'di1', particulars: 'I. GYPSUM CEILING WITH COVE LIGHTING', brand: 'Saint Gobain', unit: 'SFT', quantity: 450, rate: 135, amount: 60750 },
                { id: 'di2', particulars: 'II. PVC CEILING (BALCONY AREA)', brand: 'Vox Heavy Duty', unit: 'SFT', quantity: 120, rate: 165, amount: 19800 }
            ]
        },
        {
            id: 'd2', name: 'B. ELECTRICAL WORK', items: [
                { id: 'di4', particulars: 'I. 15W COB / PANEL CONCEALED LIGHTS', brand: 'Havells / Wipro', unit: 'Nos', quantity: 24, rate: 450, amount: 10800 },
                { id: 'di5', particulars: 'II. LED STRIP & PROFILE CONCEALED LIGHTS', brand: 'Philips Pro', unit: 'RFT', quantity: 80, rate: 180, amount: 14400 },
                { id: 'di6', particulars: 'III. WIRING, SWITCHES & MAIN BOARD FITTINGS', brand: 'Legrand / Polycab', unit: 'LS', quantity: 1, rate: 35000, amount: 35000 }
            ]
        },
        {
            id: 'd3', name: 'C. WOOD WORK & CUSTOM FURNITURE', items: [
                { id: 'di7', particulars: '1. LIVING ROOM TV UNIT & WALL PANELLING', brand: 'Greenply HDMR / Laminate', unit: 'SFT', quantity: 110, rate: 1450, amount: 159500 },
                { id: 'di8', particulars: '2. MASTER BEDROOM WARDROBE (SLIDING DOORS)', brand: 'Greenply / Hettich Hardware', unit: 'SFT', quantity: 160, rate: 1680, amount: 268800 },
                { id: 'di9', particulars: '3. ACRYLIC MODULAR KITCHEN CABINETRY', brand: 'Hafele / Greenply HDMR', unit: 'SFT', quantity: 140, rate: 1850, amount: 259000 }
            ]
        },
        {
            id: 'd4', name: 'D. PAINTING & SURFACE FINISHING', items: [
                { id: 'di10', particulars: 'I. ROYAL EMULSION WALL PAINTING (3 COATS)', brand: 'Asian Paints Royal Luxury', unit: 'SFT', quantity: 1800, rate: 45, amount: 81000 },
                { id: 'di11', particulars: 'II. DUCO PU PAINT FINISH FOR WALL PANELS', brand: 'ICA Italian PU', unit: 'SFT', quantity: 120, rate: 320, amount: 38400 }
            ]
        }
    ];

    const buildPayload = (forNewVersion: boolean = false) => ({
        quote_id: quoteId || loadedQuoteId || project?.quote_id,
        quote_number: loadedQuoteNumber || (forNewVersion ? null : (project?.quote_number?.startsWith('DRAFT-') ? project?.quote_number : null)),
        project_id: project?.project_id,
        is_used_quote: isUsedQuote,
        total_amount: getGrandTotal(),
        sections: sections.map((s, idx) => ({
            ...s,
            custom_headings: s.custom_headings || undefined,
            name: (s.name && s.name.trim() !== '') ? s.name : `Module ${idx + 1}`
        })),
        subtitle: proposalFor || subtitle || project?.client_name || '',
        client_name: proposalFor || project?.client_name || '',
        client_email: clientEmail || project?.client_email || project?.email || (project as any)?.clientEmail || '',
        client_phone: clientPhone || project?.client_phone || project?.contact_number || project?.phone || '',
        lead_id: project?.lead_id || (project?.id && String(project.id).startsWith('lead-') ? String(project.id).replace('lead-', '') : null),
        discount_percent: discountPercent,
        created_by: user?.user_id || 1,
        updated_by: user?.user_id || 1,
        user_id: user?.user_id || 1,
        prepared_by_name: user?.name || '',
        updated_by_name: user?.name || '',
        applied_coupon: appliedCoupon,
        additional_charges: { amount: additionalChargesAmount, withGst: additionalChargesHasGst, gstRate: additionalChargesGstRate },
        general_discount: { amount: generalDiscountAmount, type: generalDiscountType },
        flat_discount: generalDiscountAmount,
        global_discount: { value: parseFloat(globalDiscountInputValue) || 0, type: globalDiscountInputType },
        global_max_discount: globalMaxDiscount,
        category_discounts: tempCategoryDiscounts,
        gst_split_type: gstSplitType,
        overall_gst_enabled: overallGstEnabled,
        overall_gst_line_hidden: overallGstLineHidden,
        overall_gst_rate: overallGstRate,
        round_off_enabled: roundOffEnabled,
        custom_headings: { ...customHeadings, headerBgColor },
        section_headings: (() => {
            const map: Record<string, any> = {};
            sections.forEach((s, idx) => {
                if (s.custom_headings) {
                    map[s.id] = s.custom_headings;
                    map[String(s.id)] = s.custom_headings;
                    map[idx] = s.custom_headings;
                    map[String(idx)] = s.custom_headings;
                    if (s.name) map[s.name] = s.custom_headings;
                }
            });
            return map;
        })(),
        hidden_fields: hiddenFields,
        terms_list: termsList,
        proposal_date: proposalDate,
        proposal_for: proposalFor,
        scope_of_work: scopeOfWork,
        production_time: productionTime,
        project_category: projectCategory,
        designer_name: designerName,
        sales_manager_name: salesManagerName,
        sales_manager_phone: salesManagerPhone,
        sales_manager_email: salesManagerEmail,
        status: (() => {
            if (isClientRejected) {
                return forNewVersion ? 'proposal' : 'order_lost';
            }
            const isAlreadyConverted = !isClientRejected && Boolean(
                project?.status === 'order_converted' ||
                isProjectStarted ||
                isLeadConverted ||
                project?.is_lead_converted === true ||
                project?.is_converted === 1 ||
                project?.is_converted === true ||
                project?.has_project_started === true ||
                (project?.status && ['order_converted', 'designing phase', 'execution', 'site in progress', 'completed'].includes(String(project.status).toLowerCase().trim()))
            );
            if (isAlreadyConverted) return 'order_converted';
            if (isClientAccepted || project?.status === 'approved' || project?.ack_status === 'accepted') {
                return 'approved';
            }
            if (!isInsideProjectsRoute && !isClientAccepted) {
                return forNewVersion ? 'proposal' : ((project?.status === 'proposal' || project?.status === 'proposal_sent' || project?.ack_email_sent_at || (project as any)?.has_proposal_sent) ? 'proposal' : 'draft');
            }
            return forNewVersion ? 'proposal' : ((project?.status === 'proposal' || project?.status === 'proposal_sent' || project?.ack_email_sent_at || (project as any)?.has_proposal_sent) ? 'proposal' : 'draft');
        })(),
        ack_status: (() => {
            if (isClientRejected) {
                return 'rejected';
            }
            if (project?.status === 'order_converted' || (isInsideProjectsRoute && isProjectStarted) || isClientAccepted) {
                return project?.ack_status || 'accepted';
            }
            return isClientAccepted ? 'accepted' : (project?.ack_status || 'pending');
        })(),
        has_proposal_sent: !!(!isClientRejected && (isProjectStarted || isLeadConverted || project?.status === 'proposal' || project?.status === 'proposal_sent' || project?.ack_email_sent_at || (project as any)?.has_proposal_sent)),
        is_final_version: forNewVersion ? false : isFinalVersion,
        is_initial_quote: isProjectStarted ? false : (forNewVersion ? false : isInitialQuote),
        is_lead_converted: !isClientRejected && (isInsideProjectsRoute || isClientAccepted) && Boolean(isProjectStarted || isLeadConverted || project?.is_lead_converted === true || project?.is_converted === 1 || project?.has_project_started === true),
        is_converted: (!isClientRejected && (isInsideProjectsRoute || isClientAccepted) && (isProjectStarted || isLeadConverted || project?.is_lead_converted === true || project?.is_converted === 1 || project?.has_project_started === true)) ? 1 : 0,
        has_project_started: !isClientRejected && (isInsideProjectsRoute || isClientAccepted) && Boolean(isProjectStarted || isLeadConverted || project?.is_lead_converted === true || project?.is_converted === 1 || project?.has_project_started === true)
    });

    const handleSaveDraft = async () => {
        if (checkLockEdit()) return;
        if (!validateCategories()) return;
        setSavingDraft(true);
        try {
            const res = await axios.post(`${API_BASE_URL}/quotes/save-draft`, buildPayload(false));
            if (res.data.success) {
                if (res.data.quote_id) {
                    setLoadedQuoteId(res.data.quote_id);
                }
                const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
                setDraftSavedAt(now);
                if (setQuoteTotal) setQuoteTotal(getGrandTotal());
                setIsDirty(false);
                if (onSaveSuccess) onSaveSuccess();
                alert('Quote saved successfully!');
            } else {
                alert('Quote save failed: ' + (res.data.message || 'Unknown error'));
            }
        } catch (err: any) {
            alert('Quote save failed: ' + (err.response?.data?.message || err.message));
        } finally {
            setSavingDraft(false);
        }
    };

    const handleSaveVersion = async () => {
        if (checkLockEdit()) return;
        if (!validateCategories()) return;
        setSavingVersion(true);
        try {
            const res = await axios.post(`${API_BASE_URL}/quotes/save`, buildPayload(true));
            if (res.data.success) {
                const savedQuoteId = res.data.quote_id;
                if (setQuoteTotal) setQuoteTotal(getGrandTotal());

                // Automatically generate and freeze PDF snapshot for this new version
                if (savedQuoteId) {
                    try {
                        await axios.post(`${API_BASE_URL}/pdf/snapshot`, {
                            quote_id: savedQuoteId,
                            project_id: project?.project_id || 0
                        });
                    } catch (snapErr) {
                        console.error('Failed to auto-generate PDF snapshot:', snapErr);
                    }
                }

                await loadVersions();
                setIsVersionsExpanded(true);
                setIsDirty(false);
                if (onSaveSuccess) onSaveSuccess();
                alert('New version saved successfully with frozen PDF snapshot!');
            } else {
                alert('Version save failed: ' + (res.data.message || 'Unknown error'));
            }
        } catch (err: any) {
            alert('Version save failed: ' + (err.response?.data?.message || err.message));
        } finally {
            setSavingVersion(false);
        }
    };

    // Keep old name for any places still calling it
    const handleSaveQuote = handleSaveVersion;

    const loadVersions = async () => {
        if (!isProjectStarted) {
            setVersions([]);
            return;
        }
        const projId = project?.project_id || project?.id;
        if (!projId) return;
        setLoadingVersions(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/quotes/versions`, {
                params: { project_id: projId, is_used: isUsedQuote ? 'true' : 'false' }
            });
            if (res.data.success && Array.isArray(res.data.data)) {
                setVersions(res.data.data);
                // Check if the current active version itself is final
                const curQuoteId = selectedVersionData?.quoteId || (res.data.data.length > 0 ? res.data.data[0].quote_id : null) || quoteId;
                const curVersionNum = (selectedVersionData as any)?.version || selectedVersionData?.versionNum || (res.data.data.length > 0 ? (res.data.data[0]?.version || res.data.data[0]?.version_number || res.data.data.length) : 1);
                const curV = res.data.data.find((v: any) =>
                    Number(v.version) === Number(curVersionNum) ||
                    (!curVersionNum && curQuoteId && Number(v.quote_id) === Number(curQuoteId))
                );
                if (curV && !isNewlyCreated) {
                    let extra: any = {};
                    try {
                        extra = curV.extra_data_parsed || (typeof curV.extra_data === 'string' ? JSON.parse(curV.extra_data || '{}') : curV.extra_data) || {};
                    } catch (err) { }
                    const isVFinal = curV.status === 'Finalized' || curV.status === 'qc_approved' || !!curV.is_final_version || !!extra.is_final_version;
                    setIsFinalVersion(isVFinal);
                } else if (!isNewlyCreated && !selectedVersionData) {
                    setIsFinalVersion(false);
                }
            }
        } catch (e) { }
        finally { setLoadingVersions(false); }
    };

    const restoreVersion = async (quoteId: number, versionNum: number) => {
        if (!window.confirm(`Restore Version ${versionNum}? This will replace your current workspace with that version's data.`)) return;
        setRestoringVersion(quoteId);
        try {
            const res = await axios.get(`${API_BASE_URL}/quotes/${quoteId}`);
            if (res.data.success && res.data.data) {
                const qd = res.data.data;
                const restored: QuoteSection[] = (qd.sections || []).map((s: any) => ({
                    id: 's-r-' + s.section_id,
                    name: s.section_name,
                    items: (s.items || []).map((it: any) => {
                        const qty = parseFloat(it.quantity) || 0;
                        const rate = parseFloat(it.rate) || 0;
                        const amt = parseFloat(it.amount) || (qty * rate);
                        return {
                            id: 'i-r-' + it.item_id,
                            particulars: it.particulars || '',
                            brand: it.brand || '',
                            unit: it.unit || '',
                            quantity: qty,
                            rate: rate,
                            amount: amt,
                            width: it.width || '',
                            height: it.height || '',
                            sft: it.sft || '',
                            hsn_sac: it.hsn_sac || '',
                            image_url: it.image_url || ''
                        };
                    })
                }));
                addToHistory(restored);
                alert(`Version ${versionNum} restored successfully!`);
            }
        } catch (e) {
            alert('Failed to restore version.');
        } finally {
            setRestoringVersion(null);
        }
    };

    const viewVersion = async (quoteId: number, versionNum: number, total: number, createdAt: string) => {
        // Toggle: clicking same version closes it
        if (selectedVersionData?.quoteId === quoteId) {
            setSelectedVersionData(null);
            return;
        }
        setLoadingVersionPreview(quoteId);
        try {
            const res = await axios.get(`${API_BASE_URL}/quotes/${quoteId}`);
            if (res.data.success && res.data.data) {
                const qd = res.data.data;
                const vExtra = qd.extra_data_parsed || (typeof qd.extra_data === 'string' ? JSON.parse(qd.extra_data || '{}') : (qd.extra_data || {}));
                const vSecHeadingsMap = vExtra.section_headings || {};
                const vSections: QuoteSection[] = (qd.sections || []).map((s: any, idx: number) => ({
                    id: 'v-' + s.section_id,
                    name: s.section_name,
                    custom_headings: (s.custom_headings && typeof s.custom_headings === 'object' ? s.custom_headings : (typeof s.custom_headings === 'string' ? JSON.parse(s.custom_headings || '{}') : null)) ||
                        vSecHeadingsMap[s.section_id] || 
                        vSecHeadingsMap[String(s.section_id)] || 
                        vSecHeadingsMap[idx] || 
                        vSecHeadingsMap[String(idx)] || 
                        vSecHeadingsMap[s.section_name || s.name] || 
                        undefined,
                    items: (s.items || []).map((it: any) => {
                        const qty = parseFloat(it.quantity) || 0;
                        const rate = parseFloat(it.rate) || 0;
                        const amt = parseFloat(it.amount) || (qty * rate);
                        return {
                            id: 'vi-' + it.item_id,
                            particulars: it.particulars || '',
                            brand: it.brand || '',
                            unit: it.unit || '',
                            quantity: qty,
                            rate: rate,
                            amount: amt,
                            width: it.width || '',
                            height: it.height || '',
                            sft: it.sft || '',
                            hsn_sac: it.hsn_sac || '',
                            image_url: it.image_url || ''
                        };
                    })
                }));
                setSelectedVersionData({ quoteId, versionNum, sections: vSections, total, createdAt });
            }
        } catch (e) {
            alert('Failed to load version.');
        } finally {
            setLoadingVersionPreview(null);
        }
    };

    useEffect(() => {
        if (pendingPrintVersion && isPrintingVersion && selectedVersionData) {
            const timer = setTimeout(() => {
                const handleAfterPrint = () => {
                    setIsPrintingVersion(false);
                    setPendingPrintVersion(false);
                    window.removeEventListener('afterprint', handleAfterPrint);
                };
                window.addEventListener('afterprint', handleAfterPrint);
                window.print();
                setTimeout(() => {
                    setIsPrintingVersion(false);
                    setPendingPrintVersion(false);
                }, 5000);
            }, 350);
            return () => clearTimeout(timer);
        }
    }, [pendingPrintVersion, isPrintingVersion, selectedVersionData]);

    const printVersion = async (targetQuoteId?: number, targetVerNum?: number, targetTotal?: number, targetCreatedAt?: string) => {
        let vData = selectedVersionData;

        if (targetQuoteId !== undefined && targetQuoteId !== null) {
            if (!vData || vData.quoteId !== targetQuoteId) {
                setLoadingVersionPreview(targetQuoteId);
                try {
                    const res = await axios.get(`${API_BASE_URL}/quotes/${targetQuoteId}`);
                    if (res.data.success && res.data.data) {
                        const qd = res.data.data;
                        const vExtra = qd.extra_data_parsed || (typeof qd.extra_data === 'string' ? JSON.parse(qd.extra_data || '{}') : (qd.extra_data || {}));
                        const vSecHeadingsMap = vExtra.section_headings || {};
                        const vSections: QuoteSection[] = (qd.sections || []).map((s: any, idx: number) => ({
                            id: 'v-' + s.section_id,
                            name: s.section_name,
                            custom_headings: (s.custom_headings && typeof s.custom_headings === 'object' ? s.custom_headings : (typeof s.custom_headings === 'string' ? JSON.parse(s.custom_headings || '{}') : null)) ||
                                vSecHeadingsMap[s.section_id] || 
                                vSecHeadingsMap[String(s.section_id)] || 
                                vSecHeadingsMap[idx] || 
                                vSecHeadingsMap[String(idx)] || 
                                vSecHeadingsMap[s.section_name || s.name] || 
                                undefined,
                            items: (s.items || []).map((it: any) => ({
                                id: 'vi-' + it.item_id,
                                particulars: it.particulars || '',
                                brand: it.shutter_material || it.shutterMaterial || it.brand || '',
                                unit: it.carcass_material || it.carcassMaterial || it.unit || '',
                                quantity: parseFloat(it.quantity) || 0,
                                rate: parseFloat(it.rate) || 0,
                                rate_per_sft: it.rate_per_sft !== undefined ? parseFloat(it.rate_per_sft) : (parseFloat(it.rate) || 0),
                                amount: parseFloat(it.amount) || 0,
                                width: it.width || '',
                                height: it.height || '',
                                sft: it.sft || '',
                                hsn_sac: it.hsn_sac || '',
                                image_url: it.image_url || '',
                                category: it.category || '',
                                pricing_mode: it.pricing_mode || (it.width || it.height || it.sft ? 'dimensions' : 'lumpsum'),
                                discount_percent: parseFloat(it.discount_percent) || 0,
                                gst_rate: it.gst_rate !== undefined ? parseFloat(it.gst_rate) : undefined
                            }))
                        }));
                        const tot = targetTotal !== undefined ? targetTotal : parseFloat(qd.total_amount || 0);
                        const cAt = targetCreatedAt || qd.created_at || new Date().toISOString();
                        const verNum = targetVerNum || qd.version || 1;
                        vData = { quoteId: targetQuoteId, versionNum: verNum, sections: vSections, total: tot, createdAt: cAt };
                        setSelectedVersionData(vData);
                    }
                } catch (e) {
                    alert('Failed to load version for printing.');
                    setLoadingVersionPreview(null);
                    return;
                } finally {
                    setLoadingVersionPreview(null);
                }
            }
        }

        if (!vData) {
            alert('Please select a version to print.');
            return;
        }

        setIsPrintingVersion(true);
        setPendingPrintVersion(true);
    };

    const openPdfDocument = (quoteId: number) => {
        window.open(`/print-quote/${quoteId}`, '_blank');
    };

    useEffect(() => {
        const total = getGrandTotal();
        if (setQuoteTotal) setQuoteTotal(total);
    }, [sections]);



    const computeSqft = (widthStr?: string, heightStr?: string, depthStr?: string, mode?: string) => {
        const w = parseFloat(widthStr || '0') || 0;
        const h = parseFloat(heightStr || '0') || 0;
        const d = parseFloat(depthStr || '0') || 0;
        if (w > 0 && h > 0) {
            let res = 0;
            if (d > 0) {
                res = (w * h * d) / 27000000;
            } else {
                res = (w * h) / 90000;
            }
            return Math.round(res * 100) / 100;
        }
        return 0;
    };

    const calculateItemAmount = (qty: number, rate: number) => qty * rate;

    const updateItem = (sectionId: string, itemId: string, field: string, value: any, saveToHistory: boolean = false) => {
        if (checkLockEdit()) return;
        const newSections = sections.map(s => {
            if (s.id === sectionId) {
                return {
                    ...s,
                    items: s.items.map(i => {
                        if (i.id === itemId) {
                            const updated = { ...i, [field]: value };

                            // When switching pricing mode (Dimensions <-> Lumpsum), reset previous mode's values to 0 / original clean state
                            if (field === 'pricing_mode' && value !== i.pricing_mode) {
                                updated.pricing_mode = value;
                                updated.width = '';
                                updated.height = '';
                                updated.sft = '';
                                updated.rate_per_sft = 0;
                                updated.rate = 0;
                                updated.amount = 0;
                                updated.quantity = 1;
                                updated.discount_percent = 0;
                                updated.gst_rate = (i.gst_rate !== undefined && i.gst_rate !== null && String(i.gst_rate).trim() !== '') ? i.gst_rate : ((overallGstRate !== undefined && overallGstRate !== null) ? overallGstRate : 18);
                            }

                            // Auto-sync category discount percentage when Category dropdown changes
                            if (field === 'category' && value) {
                                const selectedCat = String(value || '').trim().toLowerCase();
                                const normKey = Object.keys(tempCategoryDiscounts).find(k => k.trim().toLowerCase() === selectedCat);
                                const catDisc = normKey ? tempCategoryDiscounts[normKey] : undefined;
                                if (catDisc && catDisc.value > 0) {
                                    if (catDisc.type === 'percent') {
                                        updated.discount_percent = Math.min(100, Math.max(0, catDisc.value));
                                    } else {
                                        const effQty = updated.quantity || 0;
                                        const base = effQty * (updated.rate || 0);
                                        if (base > 0) {
                                            updated.discount_percent = Math.min(100, Math.max(0, Math.round((catDisc.value / base) * 100)));
                                        }
                                    }
                                }
                            }

                            const isLumpsum = updated.pricing_mode === 'lumpsum';

                            if (!isLumpsum) {
                                const calculatedSqft = computeSqft(updated.width, updated.height, updated.sft, updated.pricing_mode);
                                const rPerSft = Math.max(0, parseFloat(updated.rate_per_sft as any) || 0);
                                if (rPerSft > 0 && calculatedSqft > 0) {
                                    updated.rate = Math.round(calculatedSqft * rPerSft);
                                } else if (field === 'pricing_mode' || field === 'width' || field === 'height' || field === 'sft' || field === 'rate_per_sft') {
                                    updated.rate = 0;
                                }
                            }

                            const effQty = (updated.quantity === undefined || updated.quantity === null || parseFloat(updated.quantity as any) <= 0) ? 1 : parseFloat(updated.quantity as any);
                            const rate = Math.max(0, parseFloat(updated.rate as any) || 0);
                            const baseAmt = effQty * rate;

                            const discPercent = Math.min(100, Math.max(0, parseFloat(updated.discount_percent as any) || 0));
                            const amtAfterDisc = Math.max(0, baseAmt - (baseAmt * (discPercent / 100)));

                            const rawGst = updated.gst_rate;
                            const isGstEmpty = rawGst === '' || rawGst === undefined || rawGst === null;
                            const numGst = isGstEmpty ? 0 : Math.min(100, Math.max(0, parseFloat(rawGst as any) || 0));
                            const effGstRate = overallGstEnabled ? (isGstEmpty ? 0 : numGst) : 0;
                            const finalAmt = Math.max(0, amtAfterDisc + (amtAfterDisc * (effGstRate / 100)));

                            updated.quantity = effQty;
                            updated.rate = rate;
                            updated.discount_percent = discPercent;
                            updated.gst_rate = isGstEmpty ? '' : numGst;
                            updated.amount = Math.round(finalAmt);

                            return updated;
                        }
                        return i;
                    })
                };
            }
            return s;
        });

        if (saveToHistory) {
            addToHistory(newSections);
        } else {
            setSections(newSections);
        }
    };

    const addSection = () => {
        const newSection: QuoteSection = {
            id: 's-' + Date.now(),
            name: '',
            items: []
        };
        addToHistory([...sections, newSection]);
        setExpandedModules(prev => ({ ...prev, [newSection.id]: true }));
    };

    const deleteSection = (sectionId: string) => {
        if (!window.confirm('Delete this entire section?')) return;
        addToHistory(sections.filter(s => s.id !== sectionId));
    };

    const addHeaderAfterGroup = (sectionId: string, headerId: string) => {
        const newItem: QuoteItem = {
            id: 'i-' + Date.now(),
            particulars: '',
            brand: 'HEADER',
            unit: '',
            quantity: 0,
            rate: 0,
            amount: 0,
            width: '',
            height: '',
            sft: '',
            hsn_sac: ''
        };
        const newSections = sections.map(s => {
            if (s.id === sectionId) {
                const index = s.items.findIndex(i => i.id === headerId);
                if (index !== -1) {
                    // Find the next header or end of list
                    let nextHeaderIndex = s.items.length;
                    for (let j = index + 1; j < s.items.length; j++) {
                        if (s.items[j].brand === 'HEADER') {
                            nextHeaderIndex = j;
                            break;
                        }
                    }
                    const newItems = [...s.items];
                    newItems.splice(nextHeaderIndex, 0, newItem);
                    return { ...s, items: newItems };
                }
                return { ...s, items: [...s.items, newItem] };
            }
            return s;
        });
        addToHistory(newSections);
    };

    const addItem = (sectionId: string, isHeader: boolean = false, insertAfterId?: string) => {
        const newItem: QuoteItem = {
            id: 'i-' + Date.now(),
            particulars: '',
            brand: isHeader ? 'HEADER' : '',
            unit: '',
            quantity: isHeader ? 0 : 1,
            rate: 0,
            amount: 0,
            width: '',
            height: '',
            sft: '',
            hsn_sac: '',
            pricing_mode: 'dimensions',
            gst_rate: isHeader ? 0 : (overallGstRate !== undefined && overallGstRate !== null ? overallGstRate : 18),
            discount_percent: 0, // ✅ Always 0% discount by default as requested
            category: '' // ✅ Empty by default so designer is forced to select category
        };
        const newSections = sections.map(s => {
            if (s.id === sectionId) {
                if (insertAfterId) {
                    const index = s.items.findIndex(i => i.id === insertAfterId);
                    if (index !== -1) {
                        const newItems = [...s.items];
                        newItems.splice(index + 1, 0, newItem);
                        return { ...s, items: newItems };
                    }
                }
                return { ...s, items: [...s.items, newItem] };
            }
            return s;
        });
        addToHistory(newSections);
    };

    const deleteItem = (sectionId: string, itemId: string) => {
        const newSections = sections.map(s => {
            if (s.id === sectionId) {
                return { ...s, items: s.items.filter(i => i.id !== itemId) };
            }
            return s;
        });
        addToHistory(newSections);
    };

    const moveItemUp = (sectionId: string, itemId: string) => {
        const newSections = sections.map(s => {
            if (s.id === sectionId) {
                const idx = s.items.findIndex(i => i.id === itemId);
                if (idx > 0) {
                    const newItems = [...s.items];
                    const temp = newItems[idx];
                    newItems[idx] = newItems[idx - 1];
                    newItems[idx - 1] = temp;
                    return { ...s, items: newItems };
                }
            }
            return s;
        });
        addToHistory(newSections);
    };

    const moveItemDown = (sectionId: string, itemId: string) => {
        const newSections = sections.map(s => {
            if (s.id === sectionId) {
                const idx = s.items.findIndex(i => i.id === itemId);
                if (idx !== -1 && idx < s.items.length - 1) {
                    const newItems = [...s.items];
                    const temp = newItems[idx];
                    newItems[idx] = newItems[idx + 1];
                    newItems[idx + 1] = temp;
                    return { ...s, items: newItems };
                }
            }
            return s;
        });
        addToHistory(newSections);
    };

    const duplicateItem = (sectionId: string, itemId: string) => {
        const newSections = sections.map(s => {
            if (s.id === sectionId) {
                const idx = s.items.findIndex(i => i.id === itemId);
                if (idx !== -1) {
                    const target = s.items[idx];
                    const newItem: QuoteItem = {
                        ...target,
                        id: 'i-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
                        particulars: target.particulars,
                        pricing_mode: target.pricing_mode || 'dimensions'
                    };
                    const newItems = [...s.items];
                    newItems.splice(idx + 1, 0, newItem);
                    return { ...s, items: newItems };
                }
            }
            return s;
        });
        addToHistory(newSections);
    };

    const updateSectionName = (sectionId: string, name: string, saveToHistory: boolean = false) => {
        const newSections = sections.map(s => {
            if (s.id === sectionId) return { ...s, name };
            return s;
        });
        if (saveToHistory) {
            addToHistory(newSections);
        } else {
            setSections(newSections);
        }
    };

    const handleTableEnterNavigation = (e: React.KeyboardEvent<HTMLTableElement>, sectionId: string) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            const target = e.target as HTMLElement;
            if (target.tagName === 'BUTTON') return;

            e.preventDefault();

            const table = e.currentTarget;
            const focusables = Array.from(
                table.querySelectorAll<HTMLElement>(
                    'input:not([type="hidden"]):not([disabled]):not([readonly]), textarea:not([disabled]):not([readonly]), select:not([disabled])'
                )
            ).filter(el => el.offsetWidth > 0 && el.offsetHeight > 0 && el.tabIndex !== -1);

            const index = focusables.indexOf(target);
            if (index !== -1 && index < focusables.length - 1) {
                const nextEl = focusables[index + 1];
                nextEl.focus();
                if (nextEl instanceof HTMLInputElement || nextEl instanceof HTMLTextAreaElement) {
                    nextEl.select?.();
                }
            } else {
                addItem(sectionId);
            }
        }
    };

    const getGrossTotal = () => {
        return sections.reduce((sum, s) => sum + s.items.reduce((itemSum, i) => {
            if (i.brand === 'HEADER') return itemSum;
            const qty = (i.quantity === undefined || i.quantity === null || parseFloat(i.quantity as any) <= 0) ? 1 : parseFloat(i.quantity as any);
            const rate = Math.max(0, parseFloat(i.rate as any) || 0);
            const base = qty * rate;
            return itemSum + base;
        }, 0), 0);
    };

    const getCategoryDiscountTotal = () => {
        // If user entered a global flat discount, return that exact amount (bounded by gross total) to avoid rounding discrepancies
        if (globalDiscountInputType === 'flat' && parseFloat(globalDiscountInputValue) > 0) {
            return Math.min(getGrossTotal(), parseFloat(globalDiscountInputValue));
        }
        let totalDisc = 0;
        sections.forEach(sec => {
            sec.items.forEach(item => {
                if (item.brand === 'HEADER') return;
                const qty = (item.quantity === undefined || item.quantity === null || parseFloat(item.quantity as any) <= 0) ? 1 : parseFloat(item.quantity as any);
                const rate = Math.max(0, parseFloat(item.rate as any) || 0);
                const base = qty * rate;
                const discPercent = Math.min(100, Math.max(0, parseFloat(item.discount_percent as any) || 0));
                if (discPercent > 0 && base > 0) {
                    totalDisc += (base * discPercent) / 100;
                }
            });
        });

        // Also fallback to tempCategoryDiscounts if items do not yet have discount_percent stored directly
        if (totalDisc === 0 && tempCategoryDiscounts && Object.keys(tempCategoryDiscounts).length > 0) {
            let catDiscAmt = 0;
            Object.keys(tempCategoryDiscounts).forEach(k => {
                const d = tempCategoryDiscounts[k];
                if (d && d.value > 0) {
                    const normK = k.trim().toLowerCase();
                    let catBase = 0;
                    sections.forEach(sec => {
                        const secName = (sec.name || '').trim().toLowerCase();
                        sec.items.forEach(item => {
                            if (item.brand === 'HEADER') return;
                            const itemCat = (item.category || '').trim().toLowerCase();
                            const itemPart = (item.particulars || '').trim().toLowerCase();
                            if ((itemCat && (itemCat === normK || itemCat.includes(normK) || normK.includes(itemCat))) ||
                                (!itemCat && (secName.includes(normK) || normK.includes(secName) || itemPart.includes(normK)))) {
                                const qty = (item.quantity === undefined || item.quantity === null || parseFloat(item.quantity as any) <= 0) ? 1 : parseFloat(item.quantity as any);
                                const rate = Math.max(0, parseFloat(item.rate as any) || 0);
                                catBase += qty * rate;
                            }
                        });
                    });
                    if (d.type === 'percent') {
                        catDiscAmt += (catBase * d.value) / 100;
                    } else {
                        catDiscAmt += Math.min(catBase, d.value);
                    }
                }
            });
            if (catDiscAmt > 0) {
                totalDisc = catDiscAmt;
            }
        }

        return Math.round(totalDisc * 100) / 100;
    };

    const getGeneralDiscountAmount = () => {
        if (!generalDiscountAmount || generalDiscountAmount <= 0) return 0;
        const gross = getGrossTotal();
        const catDisc = getCategoryDiscountTotal();
        const netBase = Math.max(0, gross - catDisc);
        if (generalDiscountType === 'percent') {
            return Math.round(netBase * (Math.min(100, generalDiscountAmount) / 100) * 100) / 100;
        } else {
            return Math.min(netBase, generalDiscountAmount);
        }
    };

    const getCouponDiscountAmount = () => {
        if (!appliedCoupon) return 0;
        const gross = getGrossTotal();
        const catDisc = getCategoryDiscountTotal();
        const flatDisc = getGeneralDiscountAmount();
        const netBase = Math.max(0, gross - catDisc - flatDisc);
        if (appliedCoupon.discountType === 'percent') {
            return Math.round(netBase * (appliedCoupon.discountValue / 100) * 100) / 100;
        } else {
            return Math.min(netBase, appliedCoupon.discountValue);
        }
    };

    const getTaxableSubtotal = () => {
        const gross = getGrossTotal();
        const catDisc = getCategoryDiscountTotal();
        const flatDisc = getGeneralDiscountAmount();
        const couponDisc = getCouponDiscountAmount();
        return Math.max(0, Math.round((gross - catDisc - flatDisc - couponDisc) * 100) / 100);
    };

    const getAdditionalChargesTotal = () => {
        return Math.max(0, additionalChargesAmount || 0);
    };

    const getAdditionalChargesGstAmount = () => {
        if (!additionalChargesHasGst || (additionalChargesAmount || 0) <= 0 || (additionalChargesGstRate || 0) <= 0) {
            return 0;
        }
        return Math.round((additionalChargesAmount || 0) * (additionalChargesGstRate / 100));
    };

    const getOverallGstAmount = () => {
        if (!overallGstEnabled) return 0;

        let itemsGst = 0;
        sections.forEach(sec => {
            sec.items.forEach(it => {
                if (it.brand === 'HEADER') return;
                const effQty = (it.quantity === undefined || it.quantity === null || parseFloat(it.quantity as any) <= 0) ? 1 : parseFloat(it.quantity as any);
                const rate = Math.max(0, parseFloat(it.rate as any) || 0);
                const baseAmt = effQty * rate;
                const disc = Math.min(100, Math.max(0, it.discount_percent || 0));
                const amtAfterDisc = Math.max(0, baseAmt - (baseAmt * (disc / 100)));

                const itemGst = it.gst_rate !== undefined && it.gst_rate !== null && String(it.gst_rate).trim() !== ''
                    ? Math.min(100, Math.max(0, parseFloat(it.gst_rate as any) || 0))
                    : overallGstRate;

                itemsGst += amtAfterDisc * (itemGst / 100);
            });
        });

        const gross = getGrossTotal();
        const catDisc = getCategoryDiscountTotal();
        const baseAfterCatDisc = Math.max(0, gross - catDisc);
        const flatDisc = getGeneralDiscountAmount();
        const couponDisc = getCouponDiscountAmount();
        const otherDiscounts = flatDisc + couponDisc;

        let totalGst = itemsGst;
        if (otherDiscounts > 0 && baseAfterCatDisc > 0) {
            const discountRatio = Math.max(0, 1 - (otherDiscounts / baseAfterCatDisc));
            totalGst = itemsGst * discountRatio;
        }

        // Note: Additional charges GST applies strictly and only to the additional charges,
        // and is isolated via getAdditionalChargesGstAmount() so it never inflates item/overall GST.
        return Math.round(totalGst);
    };

    const getUnroundedNetTotal = () => {
        const taxable = getTaxableSubtotal();
        const addChargeTotal = getAdditionalChargesTotal();
        const addChargeGst = getAdditionalChargesGstAmount();
        const gst = overallGstEnabled ? getOverallGstAmount() : 0;
        return taxable + addChargeTotal + addChargeGst + gst;
    };

    const getRoundOffAdjustment = () => {
        if (!roundOffEnabled) return 0;
        const unrounded = getUnroundedNetTotal();
        const rounded = Math.round(unrounded);
        return rounded - unrounded;
    };

    const getNetPayableTotal = () => {
        const unrounded = getUnroundedNetTotal();
        return roundOffEnabled ? Math.round(unrounded) : Math.round(unrounded * 100) / 100;
    };

    const getGrandTotal = () => getNetPayableTotal();
    const getFinalTotal = () => getNetPayableTotal();
    const getGstAmount = () => getOverallGstAmount();

    // Check individual item GST rates across modules and compute effective weighted rate
    const getGstRateInfo = () => {
        const rates = new Set<number>();
        let hasAnyItem = false;
        sections.forEach(sec => {
            sec.items.forEach(it => {
                if (it.brand === 'HEADER') return;
                hasAnyItem = true;
                const r = (it.gst_rate !== undefined && it.gst_rate !== null && String(it.gst_rate).trim() !== '')
                    ? parseFloat(it.gst_rate as any)
                    : overallGstRate;
                if (!isNaN(r)) rates.add(r);
            });
        });

        const isMixed = rates.size > 1;
        const taxable = getTaxableSubtotal();
        const totalGst = getOverallGstAmount();
        const effectiveRate = taxable > 0 ? (totalGst / taxable) * 100 : (rates.size === 1 ? Array.from(rates)[0] : overallGstRate);
        const singleRate = rates.size === 1 ? Array.from(rates)[0] : (hasAnyItem ? overallGstRate : 18);

        return {
            isMixed,
            effectiveRate: Math.round(effectiveRate * 100) / 100,
            singleRate,
            rates: Array.from(rates).sort((a, b) => a - b)
        };
    };

    // Apply a unified overall GST percentage to all items across the quote
    const applyOverallGstToAllItems = (newRate: number, skipConfirm: boolean = false) => {
        if (checkLockEdit()) return;
        const safeRate = Math.min(100, Math.max(0, newRate));
        const gstInfo = getGstRateInfo();
        if (!skipConfirm && gstInfo.isMixed) {
            const ratesList = gstInfo.rates.map(r => r + '%').join(', ');
            const confirmed = window.confirm(
                `Your items currently have different GST rates (${ratesList}).\n\nDo you want to apply ${safeRate}% GST to ALL items across this quotation?`
            );
            if (!confirmed) {
                setOverallGstInputVal(null);
                return;
            }
        }

        setOverallGstRate(safeRate);
        setOverallGstInputVal(null);
        setSections(prevSections => prevSections.map(sec => ({
            ...sec,
            items: sec.items.map(it => {
                if (it.brand === 'HEADER') return it;
                const effQty = (it.quantity === undefined || it.quantity === null || parseFloat(it.quantity as any) <= 0) ? 1 : parseFloat(it.quantity as any);
                const rate = Math.max(0, parseFloat(it.rate as any) || 0);
                const baseAmt = effQty * rate;
                const disc = Math.min(100, Math.max(0, it.discount_percent || 0));
                const amtAfterDisc = Math.max(0, baseAmt - (baseAmt * (disc / 100)));
                const effGst = overallGstEnabled ? safeRate : 0;
                const finalAmt = Math.max(0, amtAfterDisc + (amtAfterDisc * (effGst / 100)));
                return {
                    ...it,
                    gst_rate: safeRate,
                    amount: Math.round(finalAmt)
                };
            })
        })));
        setIsDirty(true);
    };

    const getCustomPromoCodes = (): Record<string, { discountType: 'percent' | 'flat', discountValue: number }> => {
        try {
            const stored = localStorage.getItem('custom_promo_codes');
            return stored ? JSON.parse(stored) : {};
        } catch {
            return {};
        }
    };

    const saveCustomPromoCode = (code: string, discountType: 'percent' | 'flat', discountValue: number) => {
        try {
            const existing = getCustomPromoCodes();
            existing[code.toUpperCase().trim()] = { discountType, discountValue };
            localStorage.setItem('custom_promo_codes', JSON.stringify(existing));
        } catch { }
    };

    const applyCouponCode = (codeOverride?: string) => {
        setCouponError('');
        const raw = (codeOverride || couponInput).trim();
        const code = raw.toUpperCase();
        if (!code) {
            setCouponError('Invalid promo code');
            return;
        }

        let discType: 'percent' | 'flat' = 'percent';
        let discVal: number = 0;

        const dbMatch = dbPromoCodes.find(p => p.code.toUpperCase() === code);
        const customCodes = getCustomPromoCodes();

        if (dbMatch) {
            discType = dbMatch.discount_type;
            discVal = parseFloat(String(dbMatch.discount_value)) || 0;
        } else if (code === 'WELCOME10') { discType = 'percent'; discVal = 10; }
        else if (code === 'LIVRCART5') { discType = 'percent'; discVal = 5; }
        else if (code === 'FESTIVE15') { discType = 'percent'; discVal = 15; }
        else if (code === 'SPECIAL5000') { discType = 'flat'; discVal = 5000; }
        else if (code === 'FLAT10000') { discType = 'flat'; discVal = 10000; }
        else if (customCodes[code]) {
            discType = customCodes[code].discountType;
            discVal = customCodes[code].discountValue;
        } else {
            setCouponError('Invalid promo code');
            return;
        }

        setAppliedCoupon({ code, discountType: discType, discountValue: discVal });
        setIsDirty(true);
        setCouponInput('');
    };

    const handleOpenPromoModal = (existingCode?: string) => {
        if (existingCode && appliedCoupon) {
            setPromoModalCode(appliedCoupon.code);
            setPromoModalType(appliedCoupon.discountType);
            setPromoModalValue(appliedCoupon.discountValue);
        } else {
            setPromoModalCode('');
            setPromoModalType('percent');
            setPromoModalValue('');
        }
        setPromoModalError('');
        setShowPromoModal(true);
    };

    const handlePromoCodeTextChange = (text: string) => {
        const upper = text.toUpperCase();
        setPromoModalCode(upper);
        setPromoModalError('');

        // Auto-match existing code to populate type and value
        const dbMatch = dbPromoCodes.find(p => p.code.toUpperCase() === upper);
        const customCodes = getCustomPromoCodes();
        if (dbMatch) {
            setPromoModalType(dbMatch.discount_type);
            setPromoModalValue(parseFloat(String(dbMatch.discount_value)) || 0);
        } else if (upper === 'WELCOME10') {
            setPromoModalType('percent');
            setPromoModalValue(10);
        } else if (upper === 'LIVRCART5') {
            setPromoModalType('percent');
            setPromoModalValue(5);
        } else if (upper === 'FESTIVE15') {
            setPromoModalType('percent');
            setPromoModalValue(15);
        } else if (upper === 'SPECIAL5000') {
            setPromoModalType('flat');
            setPromoModalValue(5000);
        } else if (upper === 'FLAT10000') {
            setPromoModalType('flat');
            setPromoModalValue(10000);
        } else if (customCodes[upper]) {
            setPromoModalType(customCodes[upper].discountType);
            setPromoModalValue(customCodes[upper].discountValue);
        }
    };

    const handleApplyPromoModal = async () => {
        setPromoModalError('');
        const code = promoModalCode.trim().toUpperCase();
        if (!code) {
            setPromoModalError('Please enter a promo code');
            return;
        }
        const val = typeof promoModalValue === 'number' ? promoModalValue : parseFloat(String(promoModalValue)) || 0;
        if (val <= 0) {
            setPromoModalError('Please enter a discount value greater than 0');
            return;
        }
        if (promoModalType === 'percent' && val > 100) {
            setPromoModalError('Percentage discount cannot exceed 100%');
            return;
        }

        saveCustomPromoCode(code, promoModalType, val);
        setAppliedCoupon({ code, discountType: promoModalType, discountValue: val });
        setIsDirty(true);
        setShowPromoModal(false);

        try {
            await axios.post(`${API_BASE_URL}/promo-codes`, {
                code,
                discount_type: promoModalType,
                discount_value: val,
                description: `Promo Code ${code}`
            });
            const refreshRes = await axios.get(`${API_BASE_URL}/promo-codes`);
            if (refreshRes.data?.success && Array.isArray(refreshRes.data?.data)) {
                setDbPromoCodes(refreshRes.data.data);
            }
        } catch (_) { }
    };

    const getAllPromoOptions = () => {
        const list: Array<{ code: string; type: 'percent' | 'flat'; value: number }> = [
            { code: 'WELCOME10', type: 'percent', value: 10 },
            { code: 'FESTIVE15', type: 'percent', value: 15 },
            { code: 'SPECIAL5000', type: 'flat', value: 5000 },
        ];
        dbPromoCodes.forEach(p => {
            const code = p.code.toUpperCase();
            if (!list.some(item => item.code === code)) {
                list.push({
                    code,
                    type: p.discount_type,
                    value: parseFloat(String(p.discount_value)) || 0
                });
            }
        });
        const customCodes = getCustomPromoCodes();
        Object.keys(customCodes).forEach(code => {
            if (!list.some(item => item.code === code)) {
                list.push({
                    code,
                    type: customCodes[code].discountType,
                    value: customCodes[code].discountValue
                });
            }
        });
        return list;
    };

    const removeCouponCode = () => {
        setAppliedCoupon(null);
        setCouponError('');
    };

    const fetchCategoryDiscountSettings = useCallback(async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/category-discounts/settings`);
            if (res.data?.success) {
                const sMax = Number(res.data.max_discount ?? 10);
                const catLimits: Record<string, number> = res.data.category_max_discounts || {};
                if (!isNaN(sMax) && sMax >= 0) {
                    setGlobalMaxDiscount(sMax);
                }
                setSystemCategoryMaxLimits(catLimits);
                setTempCategoryDiscounts(prev => {
                    const next = { ...prev };
                    let hasChanges = false;
                    Object.keys(next).forEach(k => {
                        if (next[k]) {
                            const sysLimit = resolveCategoryMaxLimit(k, catLimits, sMax);
                            if (!next[k].adminApproved) {
                                if (next[k].maxDiscount !== sysLimit) {
                                    next[k] = { ...next[k], maxDiscount: sysLimit };
                                    hasChanges = true;
                                }
                            }
                        }
                    });
                    return hasChanges ? next : prev;
                });
            }
        } catch (err) {
            console.error('Error fetching category max discount settings:', err);
        }
    }, [resolveCategoryMaxLimit]);

    useEffect(() => {
        fetchCategoryDiscountSettings();
    }, [fetchCategoryDiscountSettings]);

    const fetchActiveDiscountApprovalRequest = useCallback(async (silent: boolean = false) => {
        const cleanQuoteId = String(quoteId || '').trim();
        const cleanProjectId = String(project?.project_id || (project as any)?.id || (project as any)?.lead_id || '').trim();
        if (!cleanQuoteId && !cleanProjectId) return;

        if (!silent) setCheckingDiscountStatus(true);
        try {
            const params = new URLSearchParams();
            if (cleanQuoteId) params.append('quote_id', cleanQuoteId);
            if (cleanProjectId) params.append('project_id', cleanProjectId);

            const res = await axios.get(`${API_BASE_URL}/category-discounts/requests?${params.toString()}`);
            if (res.data?.success && Array.isArray(res.data.data) && res.data.data.length > 0) {
                const latest = res.data.data[0];
                setActiveDiscountRequest(latest);

                if (latest.status === 'approved') {
                    // Automatically mark approved categories in tempCategoryDiscounts
                    setTempCategoryDiscounts(prev => {
                        const next = { ...prev };
                        const savedCats = latest.category_discounts_parsed || {};
                        let changed = false;

                        Object.keys(next).forEach(cat => {
                            const curr = next[cat];
                            if (curr && curr.value > 0) {
                                const maxLim = Math.max(Number(curr.maxDiscount ?? globalMaxDiscount), Number(globalMaxDiscount));
                                if (curr.value > maxLim && !curr.adminApproved) {
                                    next[cat] = {
                                        ...curr,
                                        adminApproved: true,
                                        approvedBy: latest.reviewed_by_name || 'Admin',
                                        approvedAt: latest.reviewed_at || new Date().toLocaleString('en-IN'),
                                        approvedValue: curr.value
                                    };
                                    changed = true;
                                }
                            }
                        });

                        Object.keys(savedCats).forEach(cat => {
                            if (!next[cat] || !next[cat].adminApproved) {
                                const sc = savedCats[cat];
                                const scVal = typeof sc === 'object' ? (sc.value ?? 0) : Number(sc || 0);
                                const scType = typeof sc === 'object' ? (sc.type || 'percent') : 'percent';
                                next[cat] = {
                                    type: scType,
                                    value: scVal,
                                    maxDiscount: globalMaxDiscount,
                                    adminApproved: true,
                                    approvedBy: latest.reviewed_by_name || 'Admin',
                                    approvedAt: latest.reviewed_at || new Date().toLocaleString('en-IN'),
                                    approvedValue: scVal
                                };
                                changed = true;
                            }
                        });

                        return changed ? next : prev;
                    });
                } else if (latest.status === 'rejected') {
                    setTempCategoryDiscounts(prev => {
                        const next = { ...prev };
                        let changed = false;
                        Object.keys(next).forEach(cat => {
                            const curr = next[cat];
                            if (curr && (curr.requestedValue || curr.adminApproved)) {
                                next[cat] = {
                                    ...curr,
                                    adminApproved: false,
                                    rejected: true,
                                    rejectedBy: latest.reviewed_by_name || 'Admin',
                                    rejectedAt: latest.reviewed_at || new Date().toLocaleString('en-IN'),
                                    rejectionReason: latest.rejection_reason || 'Rejected by Admin / Manager',
                                    requestedValue: undefined,
                                    approvedValue: 0
                                };
                                changed = true;
                            }
                        });
                        return changed ? next : prev;
                    });
                }
            }
        } catch (err) {
            if (!silent) console.error('Error fetching discount approval request:', err);
        } finally {
            if (!silent) setCheckingDiscountStatus(false);
        }
    }, [quoteId, project, globalMaxDiscount]);

    useEffect(() => {
        if (showCategoryDiscountModal) {
            fetchCategoryDiscountSettings();
            fetchActiveDiscountApprovalRequest(true);
        }
    }, [showCategoryDiscountModal, fetchCategoryDiscountSettings, fetchActiveDiscountApprovalRequest]);

    const handleAdminUpdateGlobalMaxDiscount = async (newVal: number) => {
        setGlobalMaxDiscount(newVal);
        try {
            await axios.post(`${API_BASE_URL}/category-discounts/settings`, { max_discount: newVal });
        } catch (e) {
            console.warn('Could not persist global max discount setting:', e);
        }
    };

    const handleSubmitDiscountApprovalRequest = async (exceedingCats: string[], totalSubtotal: number, totalDiscountAmt: number) => {
        if (exceedingCats.length === 0) {
            alert('None of your categories currently exceed the maximum discount limit.');
            return;
        }
        const cleanQuoteId = String(quoteId || '').trim();
        const cleanProjectId = String(project?.project_id || (project as any)?.id || (project as any)?.lead_id || '').trim();
        const projectName = String(project?.title || project?.name || (project as any)?.project_name || '').trim();
        const clientName = String(project?.client_name || proposalFor || '').trim();

        setSubmittingDiscountApproval(true);
        try {
            const payload = {
                quote_id: cleanQuoteId,
                project_id: cleanProjectId,
                project_name: projectName,
                client_name: clientName,
                requested_by_id: effectiveUser?.user_id || effectiveUser?.id || '',
                requested_by_name: effectiveUser?.name || 'Designer',
                category_discounts: tempCategoryDiscounts,
                exceeding_details: exceedingCats,
                total_subtotal: totalSubtotal,
                total_discount_amount: totalDiscountAmt,
                notes: discountRequestNote.trim()
            };

            const res = await axios.post(`${API_BASE_URL}/category-discounts/request-approval`, payload);
            if (res.data?.success) {
                setActiveDiscountRequest({
                    id: res.data.request_id,
                    status: 'pending',
                    requested_by_name: effectiveUser?.name || 'Designer',
                    notes: discountRequestNote.trim(),
                    created_at: new Date().toISOString()
                });
                setShowRequestDiscountModal(false);
                setDiscountRequestNote('');
                alert('📨 Category discount approval request submitted successfully to Admin Dashboard!\n\nAdmin will review your request. You can check the approval status anytime from this manager.');
            } else {
                alert(res.data?.message || 'Failed to submit discount approval request');
            }
        } catch (err: any) {
            alert(err?.response?.data?.message || 'Error submitting discount approval request');
        } finally {
            setSubmittingDiscountApproval(false);
        }
    };

    const handleDirectSendCategoryApproval = async (category: string, enteredValue: number, discountType: 'percent' | 'flat', catTotal: number) => {
        const cleanQuoteId = String(quoteId || '').trim();
        const cleanProjectId = String(project?.project_id || (project as any)?.id || (project as any)?.lead_id || '').trim();
        const projectName = String(project?.title || project?.name || (project as any)?.project_name || '').trim();
        const clientName = String(project?.client_name || proposalFor || '').trim();
        const catLimit = resolveCategoryMaxLimit(category);
        const exceedingDetail = `${category}: ${enteredValue}${discountType === 'percent' ? '%' : '₹'} (vs Max Allowed ${catLimit}%)`;

        setSendingCategoryApproval(category);
        try {
            const updatedDiscounts = {
                ...tempCategoryDiscounts,
                [category]: {
                    ...(tempCategoryDiscounts[category] || {}),
                    type: discountType,
                    value: enteredValue,
                    requestedValue: enteredValue,
                    adminApproved: false
                }
            };

            const payload = {
                quote_id: cleanQuoteId,
                project_id: cleanProjectId,
                project_name: projectName,
                client_name: clientName,
                requested_by_id: effectiveUser?.user_id || effectiveUser?.id || '',
                requested_by_name: effectiveUser?.name || 'Designer',
                category_discounts: updatedDiscounts,
                exceeding_details: [exceedingDetail],
                total_subtotal: catTotal,
                total_discount_amount: discountType === 'percent' ? (catTotal * enteredValue) / 100 : enteredValue,
                notes: `Direct approval request for ${category}: ${enteredValue}${discountType === 'percent' ? '%' : '₹'}`
            };

            const res = await axios.post(`${API_BASE_URL}/category-discounts/request-approval`, payload);
            if (res.data?.success) {
                setTempCategoryDiscounts(prev => ({
                    ...prev,
                    [category]: {
                        ...(prev[category] || {}),
                        type: discountType,
                        value: enteredValue,
                        requestedValue: enteredValue,
                        requestedAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
                        requestId: res.data.request_id,
                        adminApproved: false
                    }
                }));
                setActiveDiscountRequest({
                    id: res.data.request_id,
                    status: 'pending',
                    requested_by_name: effectiveUser?.name || 'Designer',
                    notes: `Direct approval request for ${category}: ${enteredValue}${discountType === 'percent' ? '%' : '₹'}`,
                    created_at: new Date().toISOString()
                });
            } else {
                alert(res.data?.message || 'Failed to submit discount approval request');
            }
        } catch (err: any) {
            alert(err?.response?.data?.message || 'Error submitting discount approval request');
        } finally {
            setSendingCategoryApproval(null);
        }
    };

    const applyCategoryDiscounts = () => {
        // Enforce: Discounts exceeding the allowed max discount REQUIRE Admin / Manager Approval
        const unapprovedExceeding: string[] = [];

        Object.keys(tempCategoryDiscounts).forEach(key => {
            const val = tempCategoryDiscounts[key];
            if (!val || !val.value || val.value <= 0) return;

            const targetCat = key.trim().toLowerCase();
            let catTotal = 0;
            sections.forEach(sec => {
                sec.items.forEach(item => {
                    if (item.brand === 'HEADER') return;
                    const itemCat = (item.category || '').trim().toLowerCase();
                    const secName = (sec.name || '').trim().toLowerCase();
                    const itemParticulars = (item.particulars || '').trim().toLowerCase();
                    const isDirectMatch = (itemCat && (itemCat === targetCat || itemCat.includes(targetCat) || targetCat.includes(itemCat))) ||
                        (!itemCat && ((secName && (secName === targetCat || secName.includes(targetCat) || targetCat.includes(secName))) ||
                            (itemParticulars && (itemParticulars.includes(targetCat) || targetCat.includes(itemParticulars)))));
                    const isFallbackWoodWork = !itemCat && targetCat.includes('wood') && !secName.includes('accessories') && !secName.includes('ceiling') && !secName.includes('painting') && !secName.includes('lights') && !secName.includes('furniture') && !secName.includes('civil');
                    if (isDirectMatch || isFallbackWoodWork) {
                        catTotal += (item.amount || 0);
                    }
                });
            });

            const catLimit = resolveCategoryMaxLimit(key);
            const effectivePercent = val.type === 'percent'
                ? val.value
                : (catTotal > 0 ? (val.value / catTotal) * 100 : 0);

            const isApprovedForVal = Boolean(
                (val.adminApproved || canApproveDiscounts) &&
                (canApproveDiscounts || (val.approvedValue !== undefined && val.approvedValue !== null && val.value <= Number(val.approvedValue)))
            );

            if (effectivePercent > catLimit && !isApprovedForVal) {
                if (val.approvedValue && val.value > Number(val.approvedValue)) {
                    unapprovedExceeding.push(`${key}: ${val.value}${val.type === 'percent' ? '%' : '₹'} (Approved only up to ${val.approvedValue}${val.type === 'percent' ? '%' : '₹'}, Max Allowed ${catLimit}%)`);
                } else {
                    unapprovedExceeding.push(`${key}: ${val.value}${val.type === 'percent' ? '%' : '₹'} (${effectivePercent.toFixed(1)}% vs Max Allowed ${catLimit}%)`);
                }
            }
        });

        if (unapprovedExceeding.length > 0) {
            alert(
                `⛔ Approval Required!\n\nThe following category discount(s) exceed their Maximum Allowed Discount limit:\n\n• ${unapprovedExceeding.join('\n• ')}\n\nPlease send for approval or reduce the discount to within allowed limits.`
            );
            return;
        }

        // Convert tempCategoryDiscounts to normalized lowercase map
        const normDiscounts: Record<string, { type: 'percent' | 'flat', value: number }> = {};
        Object.keys(tempCategoryDiscounts).forEach(key => {
            const val = tempCategoryDiscounts[key];
            if (val && val.value > 0) {
                normDiscounts[key.trim().toLowerCase()] = val;
            }
        });

        const woodWorkDiscount = normDiscounts['wood work'] || normDiscounts['woodwork'];

        const newSections = sections.map(sec => ({
            ...sec,
            items: sec.items.map(item => {
                if (item.brand === 'HEADER') return item;

                const itemCat = (item.category || '').trim().toLowerCase();
                const secName = (sec.name || '').trim().toLowerCase();
                const itemParticulars = (item.particulars || '').trim().toLowerCase();

                // Find matching category discount entry from normalized map
                let catDisc: { type: 'percent' | 'flat', value: number } | undefined = undefined;

                if (itemCat && normDiscounts[itemCat]) {
                    catDisc = normDiscounts[itemCat];
                } else if (secName && normDiscounts[secName]) {
                    catDisc = normDiscounts[secName];
                } else {
                    const matchedKey = Object.keys(normDiscounts).find(k => {
                        if (!k) return false;
                        if (itemCat && (itemCat === k || itemCat.includes(k) || k.includes(itemCat))) return true;
                        if (secName && (secName === k || secName.includes(k) || k.includes(secName))) return true;
                        if (itemParticulars && (itemParticulars.includes(k) || k.includes(itemParticulars))) return true;
                        return false;
                    });
                    if (matchedKey) {
                        catDisc = normDiscounts[matchedKey];
                    } else if (woodWorkDiscount) {
                        // Fallback uncategorized items to Wood work discount if set
                        catDisc = woodWorkDiscount;
                    }
                }

                if (catDisc && catDisc.value > 0) {
                    let discPercent = item.discount_percent || 0;
                    const effQty = (item.quantity === undefined || item.quantity === null || parseFloat(item.quantity as any) <= 0) ? 1 : parseFloat(item.quantity as any);
                    const rate = Math.max(0, parseFloat(item.rate as any) || 0);
                    const base = effQty * rate;

                    if (catDisc.type === 'percent') {
                        discPercent = Math.min(100, Math.max(0, catDisc.value));
                    } else {
                        if (base > 0) {
                            discPercent = Math.min(100, Math.max(0, Math.round(((catDisc.value / base) * 100) * 100) / 100));
                        }
                    }
                    const safeDiscPercent = Math.min(100, Math.max(0, discPercent));
                    const baseAmt = base;
                    const amtAfterDisc = Math.max(0, baseAmt - (baseAmt * (safeDiscPercent / 100)));
                    const itemGst = item.gst_rate !== undefined && item.gst_rate !== null && String(item.gst_rate).trim() !== ''
                        ? Math.min(100, Math.max(0, parseFloat(item.gst_rate as any) || 0))
                        : overallGstRate;
                    const effGstRate = overallGstEnabled ? itemGst : 0;
                    const finalAmt = Math.max(0, amtAfterDisc + (amtAfterDisc * (effGstRate / 100)));
                    return {
                        ...item,
                        discount_percent: safeDiscPercent,
                        amount: Math.round(finalAmt * 100) / 100
                    };
                }
                return item;
            })
        }));

        // Auto-sync global discount input type to match category discount type
        const activeDiscs = Object.values(normDiscounts).filter(d => d && d.value > 0);
        if (activeDiscs.length > 0) {
            const anyPercent = activeDiscs.some(d => d.type === 'percent');
            if (anyPercent) {
                setGlobalDiscountInputType('percent');
                const allSameVal = activeDiscs.every(d => d.value === activeDiscs[0].value && d.type === 'percent');
                setGlobalDiscountInputValue(allSameVal ? String(activeDiscs[0].value) : '0');
            } else {
                setGlobalDiscountInputType('flat');
                setGlobalDiscountInputValue('0');
            }
        }

        addToHistory(newSections);
        setShowCategoryDiscountModal(false);
    };

    const handleOpenCategoryDiscountModal = () => {
        fetchCategoryDiscountSettings();
        // Pre-populate category discounts from items' existing discounts if not already set
        setTempCategoryDiscounts(prev => {
            const next = { ...prev };
            sections.forEach(sec => {
                sec.items.forEach(item => {
                    if (item.brand === 'HEADER') return;
                    const cat = (item.category || sec.name || '').trim();
                    const disc = parseFloat(item.discount_percent as any) || 0;
                    if (cat) {
                        const normCat = cat.toLowerCase();
                        const existingKey = Object.keys(next).find(k => {
                            const nk = k.trim().toLowerCase();
                            return nk === normCat || nk.replace(/\s+/g, '') === normCat.replace(/\s+/g, '');
                        });
                        const canonical = COMMON_MODULE_NAMES.find(c => c.toLowerCase() === normCat) || cat;
                        const sysLimit = resolveCategoryMaxLimit(canonical);
                        if (!existingKey || !next[existingKey]) {
                            next[canonical] = {
                                type: 'percent',
                                value: disc > 0 ? disc : 0,
                                maxDiscount: sysLimit,
                                adminApproved: false
                            };
                        } else if (!next[existingKey].adminApproved) {
                            next[existingKey] = {
                                ...next[existingKey],
                                maxDiscount: sysLimit
                            };
                        }
                    }
                });
            });
            return next;
        });
        setShowCategoryDiscountModal(true);
    };

    const moveTerm = (index: number, direction: 'up' | 'down') => {
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= termsList.length) return;
        setTermsList(prev => {
            const next = [...prev];
            const temp = next[index];
            next[index] = next[targetIndex];
            next[targetIndex] = temp;
            return next;
        });
    };

    const insertTermBelow = (index: number) => {
        setTermsList(prev => {
            const next = [...prev];
            next.splice(index + 1, 0, "");
            return next;
        });
    };

    const addNewTermPoint = () => {
        setTermsList(prev => [...prev, ""]);
        setTimeout(() => {
            if (termsListContainerRef.current) {
                termsListContainerRef.current.scrollTo({
                    top: termsListContainerRef.current.scrollHeight,
                    behavior: 'smooth'
                });
            }
        }, 50);
    };

    const handleTermDragStart = (e: React.DragEvent, index: number) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(index));
        setDraggedTermIndex(index);
    };

    const handleTermDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dragOverTermIndex !== index) {
            setDragOverTermIndex(index);
        }
        if (termsListContainerRef.current) {
            const rect = termsListContainerRef.current.getBoundingClientRect();
            if (e.clientY < rect.top + 60) {
                termsListContainerRef.current.scrollTop -= 12;
            } else if (e.clientY > rect.bottom - 60) {
                termsListContainerRef.current.scrollTop += 12;
            }
        }
    };

    const handleTermDrop = (e: React.DragEvent, targetIndex: number) => {
        e.preventDefault();
        if (draggedTermIndex === null || draggedTermIndex === targetIndex) {
            setDraggedTermIndex(null);
            setDragOverTermIndex(null);
            return;
        }
        setTermsList(prev => {
            const next = [...prev];
            const [removed] = next.splice(draggedTermIndex, 1);
            next.splice(targetIndex, 0, removed);
            return next;
        });
        setDraggedTermIndex(null);
        setDragOverTermIndex(null);
    };

    const handleTermDragEnd = () => {
        setDraggedTermIndex(null);
        setDragOverTermIndex(null);
    };

    const handleTermsModalHeaderMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return;
        if ((e.target as HTMLElement).closest('button')) return;
        e.preventDefault();
        termsModalDragStartRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            initialOffsetX: termsModalOffset.x,
            initialOffsetY: termsModalOffset.y
        };

        const onMouseMove = (moveEv: MouseEvent) => {
            if (!termsModalDragStartRef.current) return;
            const dx = moveEv.clientX - termsModalDragStartRef.current.startX;
            const dy = moveEv.clientY - termsModalDragStartRef.current.startY;
            setTermsModalOffset({
                x: termsModalDragStartRef.current.initialOffsetX + dx,
                y: termsModalDragStartRef.current.initialOffsetY + dy
            });
        };

        const onMouseUp = () => {
            termsModalDragStartRef.current = null;
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    const handleContainerPanMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
        if (
            target.tagName === 'INPUT' ||
            target.tagName === 'BUTTON' ||
            target.closest('button') ||
            target.closest('input') ||
            target.closest('[data-drag-handle="true"]')
        ) {
            return;
        }
        isPanScrollingRef.current = true;
        panStartYRef.current = e.clientY;
        panScrollTopRef.current = termsListContainerRef.current ? termsListContainerRef.current.scrollTop : 0;
    };

    const handleContainerPanMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isPanScrollingRef.current || !termsListContainerRef.current) return;
        const dy = e.clientY - panStartYRef.current;
        termsListContainerRef.current.scrollTop = panScrollTopRef.current - dy;
    };

    const handleContainerPanMouseUp = () => {
        isPanScrollingRef.current = false;
    };

    const applyGlobalCategoryDiscountValue = (value: number, type: 'flat' | 'percent') => {
        const gross = getGrossTotal();
        const safeVal = Math.max(0, value || 0);

        let targetPercent = 0;
        if (type === 'percent') {
            targetPercent = Math.min(100, safeVal);
        } else if (gross > 0 && safeVal > 0) {
            targetPercent = Math.min(100, (safeVal / gross) * 100);
        }

        const effectivePercent = type === 'flat' ? targetPercent : Math.round(targetPercent * 100) / 100;

        const newSections = sections.map(sec => ({
            ...sec,
            items: sec.items.map(it => {
                if (it.brand === 'HEADER') return it;
                const effQty = Math.max(0, it.quantity || 0);
                const rate = Math.max(0, parseFloat(it.rate as any) || 0);
                const baseAmt = effQty * rate;
                const discPercent = safeVal <= 0 ? 0 : (type === 'flat' ? Math.round(effectivePercent * 100) / 100 : effectivePercent);
                const safeDiscPercent = Math.min(100, Math.max(0, discPercent));
                const amtAfterDisc = Math.max(0, baseAmt - (baseAmt * (safeDiscPercent / 100)));
                const itemGst = it.gst_rate !== undefined && it.gst_rate !== null && String(it.gst_rate).trim() !== ''
                    ? Math.min(100, Math.max(0, parseFloat(it.gst_rate as any) || 0))
                    : overallGstRate;
                const effGstRate = overallGstEnabled ? itemGst : 0;
                const finalAmt = Math.max(0, amtAfterDisc + (amtAfterDisc * (effGstRate / 100)));

                return {
                    ...it,
                    discount_percent: safeDiscPercent,
                    amount: Math.round(finalAmt)
                };
            })
        }));

        addToHistory(newSections);
    };

    const handlePrint = () => {
        if (quoteId) {
            window.open(`/print-quote/${quoteId}`, '_blank');
        } else {
            window.print();
        }
    };

    const PageHeader = () => (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1.5px solid #0f172a', paddingBottom: '8px', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img src={OfficialLogo} onError={(e) => { e.currentTarget.src = ArkLogo; }} alt="Logo" style={{ height: '36px', objectFit: 'contain' }} />
                <div>
                    <div style={{ fontSize: '11pt', fontWeight: 800, color: '#000000', lineHeight: 1.2 }}>Livincart Private Limited</div>
                    <div style={{ fontSize: '7.5pt', color: '#64748b', fontWeight: 500 }}>Official Quotation &amp; Estimation Workspace</div>
                </div>
            </div>
            <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '8.5pt', fontWeight: 800, color: '#000000' }}>COMPANY : LIVINCART AND SERVICES PRIVATE LIMITED</div>
            </div>
        </div>
    );

    const PageFooter = () => null;

    const grandTotal = getGrandTotal();

    return (
        <div className="quote-tab-root" style={{ backgroundColor: '#ffffff', padding: '0', minHeight: '100vh', width: '100%' }}>
            {!isAgreementPdfView && (
                <div className={`quote-container ${isPrintingVersion ? 'no-print' : 'print-area'}`} style={{ backgroundColor: '#ffffff', borderRadius: '12px', width: '100%' }}>



                    {/* ===== WORKSPACE HEADER BAR ===== */}
                    <div className="no-print" style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '14px 22px',
                        backgroundColor: '#ffffff',
                        border: '1.5px solid #e2e8f0',
                        marginBottom: '20px',
                        borderRadius: '12px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                    }}>
                        {/* Left: Logo + Company Name + Subtitle */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <img src={liveLogo} alt="Livincart Logo" style={{ height: '38px', objectFit: 'contain' }} />
                                <div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#000000', lineHeight: 1.2, letterSpacing: '-0.2px' }}>Livincart Private Limited</div>
                                    <div style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 500, marginTop: '2px' }}>Office Interiors &amp; Architecture Workspace</div>
                                </div>
                            </div>
                        </div>

                        {/* Right: Action Buttons */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            {/* Undo / Redo */}
                            {!isLocked && (
                                <div style={{ display: 'flex', gap: '6px', marginRight: '4px' }}>
                                    <button onClick={handleUndo} disabled={history.length === 0} title="Undo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '8px', border: '1.5px solid #e2e8f0', backgroundColor: history.length === 0 ? '#f8fafc' : '#ffffff', cursor: history.length === 0 ? 'not-allowed' : 'pointer', color: '#334155' }}>
                                        <Undo2 size={16} />
                                    </button>
                                    <button onClick={handleRedo} disabled={redoStack.length === 0} title="Redo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '8px', border: '1.5px solid #e2e8f0', backgroundColor: redoStack.length === 0 ? '#f8fafc' : '#ffffff', cursor: redoStack.length === 0 ? 'not-allowed' : 'pointer', color: '#334155' }}>
                                        <Redo2 size={16} />
                                    </button>
                                </div>
                            )}

                            {/* 1) Cover Page */}
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 600, color: '#0f172a', cursor: 'pointer', backgroundColor: '#ffffff', padding: '8px 14px', borderRadius: '8px', border: '1.5px solid #e2e8f0' }} title="Toggle Front Cover Page">
                                <input type="checkbox" checked={showCoverPage} onChange={(e) => setShowCoverPage(e.target.checked)} style={{ cursor: 'pointer', width: '14px', height: '14px', accentColor: '#0f172a' }} />
                                Cover Page
                            </label>

                            {/* 2) Hide Category in Print Popup Button */}
                            <button
                                onClick={() => setShowHidePopup(true)}
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 600, color: '#ea580c', cursor: 'pointer', backgroundColor: '#fff7ed', padding: '8px 14px', borderRadius: '8px', border: '1.5px solid #fed7aa' }}
                                title="Configure hidden categories/fields in Print/PDF document"
                            >
                                👁️ Hide Categories in Print
                            </button>


                            {/* 4) Save Quote */}
                            {!isLocked && !hideSave && (
                                <button
                                    onClick={handleSaveDraft}
                                    disabled={savingDraft}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '8px 18px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        backgroundColor: '#16a34a',
                                        color: '#ffffff',
                                        fontSize: '0.82rem',
                                        fontWeight: 800,
                                        cursor: savingDraft ? 'not-allowed' : 'pointer',
                                        boxShadow: '0 2px 6px rgba(22, 163, 74, 0.25)',
                                        transition: 'all 0.15s'
                                    }}
                                >
                                    {savingDraft ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                                    {savingDraft ? 'Saving...' : 'Save Quote'}
                                </button>
                            )}

                            {/* 5) Edit Terms & Conditions */}
                            {!isLocked && (
                                <button
                                    onClick={() => setShowTermsModal(true)}
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: '1.5px solid #cbd5e1', backgroundColor: '#f8fafc', color: '#334155', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}
                                    title="Edit Terms &amp; Conditions list for this quotation"
                                >
                                    <FileText size={15} /> Edit Terms ({termsList.length})
                                </button>
                            )}

                            {/* ===== REMAINING PROJECT WORKFLOW BUTTONS (Opened only after Project is Opened / Converted with Stage 1 Payment) ===== */}
                            {isProjectStarted ? (
                                <>
                                    {/* Print Quote */}
                                    <button
                                        onClick={handlePrint}
                                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: '1.5px solid #e2e8f0', backgroundColor: '#ffffff', color: '#0f172a', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
                                    >
                                        <Printer size={15} /> Print Quote
                                    </button>

                                    {/* Download PDF */}
                                    <button
                                        onClick={handlePrint}
                                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#0f172a', color: '#ffffff', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}
                                    >
                                        <Download size={15} /> Download PDF
                                    </button>

                                    {/* Save Version */}
                                    {!isLocked && !hideSave && (
                                        <button
                                            onClick={() => { handleSaveVersion(); }}
                                            disabled={savingVersion}
                                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: '1.5px solid #e2e8f0', backgroundColor: '#ffffff', color: '#0f172a', fontSize: '0.82rem', fontWeight: 600, cursor: savingVersion ? 'not-allowed' : 'pointer', transition: 'all 0.15s' }}
                                        >
                                            {savingVersion ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                                            {savingVersion ? 'Saving...' : 'Save Version'}
                                        </button>
                                    )}

                                    {/* Versions History Toggle Button */}
                                    {!isLocked && (
                                        <button
                                            onClick={() => {
                                                const nextState = !isVersionsExpanded;
                                                setIsVersionsExpanded(nextState);
                                                if (nextState) loadVersions();
                                            }}
                                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: '1.5px solid #e2e8f0', backgroundColor: '#ffffff', color: '#0f172a', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
                                        >
                                            <BookOpen size={15} />
                                            Versions ({versions.length > 0 ? versions.length : 1})
                                        </button>
                                    )}

                                    {/* Final Version Button / Dark Green Badge */}
                                    {isFinalVersion ? (
                                        <button
                                            onClick={() => alert('This quote has already been finalized as the Final Version. Further edits or re-saving are not allowed.')}
                                            style={{
                                                backgroundColor: '#15803d',
                                                color: '#ffffff',
                                                border: '1.5px solid #166534',
                                                fontSize: '0.84rem',
                                                fontWeight: 800,
                                                padding: '8px 16px',
                                                borderRadius: '8px',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                cursor: 'pointer',
                                                boxShadow: '0 2px 8px rgba(21, 128, 61, 0.35)'
                                            }}
                                            title="Quote Finalized. Click to view status."
                                        >
                                            <CheckCircle2 size={16} color="#ffffff" />
                                            Final Version
                                        </button>
                                    ) : (
                                        !isReadOnly && !hideSave && (
                                            <button
                                                onClick={() => isQCApproved ? setShowFinalVersionModal(true) : alert('Final Version button is disabled until Quality Check (QC) approves this quotation version.')}
                                                disabled={!isQCApproved}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    padding: '8px 14px',
                                                    borderRadius: '8px',
                                                    border: isQCApproved ? '1.5px solid #bbf7d0' : '1.5px solid #cbd5e1',
                                                    backgroundColor: isQCApproved ? '#f0fdf4' : '#f1f5f9',
                                                    color: isQCApproved ? '#166534' : '#94a3b8',
                                                    fontSize: '0.82rem',
                                                    fontWeight: 800,
                                                    cursor: isQCApproved ? 'pointer' : 'not-allowed',
                                                    transition: 'all 0.15s',
                                                    opacity: isQCApproved ? 1 : 0.65
                                                }}
                                                title={isQCApproved ? "Mark quote as Final Version and generate official green snapshot" : "Disabled until Quality Check (QC) approves this quotation version"}
                                            >
                                                <CheckCircle2 size={15} color={isQCApproved ? "#166534" : "#94a3b8"} />
                                                Final Version {!isQCApproved && '(QC Required)'}
                                            </button>
                                        )
                                    )}

                                    {/* Send to Quality Check */}
                                    {!isReadOnly && (
                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                            <button
                                                onClick={handleSendToQC}
                                                disabled={sendingToQC || isQCApproved || (isSendToQCDisabled && qcStatus !== 'under_review')}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    padding: '8px 14px',
                                                    borderRadius: '8px',
                                                    border: isSendToQCDisabled && qcStatus !== 'under_review' ? '1.5px solid #cbd5e1' : (isQCApproved ? '1.5px solid #bbf7d0' : (qcStatus === 'under_review' ? '1.5px solid #bfdbfe' : '1.5px solid #fed7aa')),
                                                    backgroundColor: isSendToQCDisabled && qcStatus !== 'under_review' ? '#f1f5f9' : (isQCApproved ? '#f0fdf4' : (qcStatus === 'under_review' ? '#eff6ff' : '#fff7ed')),
                                                    color: isSendToQCDisabled && qcStatus !== 'under_review' ? '#94a3b8' : (isQCApproved ? '#166534' : (qcStatus === 'under_review' ? '#1d4ed8' : '#c2410c')),
                                                    fontSize: '0.82rem',
                                                    fontWeight: 800,
                                                    cursor: (sendingToQC || isQCApproved || (isSendToQCDisabled && qcStatus !== 'under_review')) ? 'not-allowed' : 'pointer',
                                                    transition: 'all 0.15s',
                                                    opacity: isSendToQCDisabled && qcStatus !== 'under_review' ? 0.7 : (isQCApproved ? 0.85 : 1)
                                                }}
                                                title={
                                                    isSendToQCBlockedByStage2 && isSendToQCBlockedBySlot ? "Send to QC is locked: Requires Stage 2 (20%) payment AND booked QC slot." :
                                                        isSendToQCBlockedByStage2 ? "Send to QC is locked: Client must complete Stage 2 (20% Milestone) payment before quotation can be sent to QC." :
                                                            isSendToQCBlockedBySlot ? "Send to QC is locked: Designer must book a Quality Check (QC) slot before quotation can be sent to QC." :
                                                                isQCApproved ? "QC Already Approved for this quotation" :
                                                                    qcStatus === 'under_review' ? "Currently under review in Quality Check tab" :
                                                                        matchingQCFolder?.pm_status === 'pm_rejected' ? "Rejected by PM: Click to submit corrected version to QC for review and final PM approval" :
                                                                            qcStatus === 'changes_requested' ? "Corrections requested by QC: Click to submit corrected version to QC" :
                                                                                "Send quotation version to Quality Check (QC) tab for issue review"
                                                }
                                            >
                                                {sendingToQC ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} color={isSendToQCDisabled ? '#94a3b8' : (isQCApproved ? '#166534' : (qcStatus === 'under_review' ? '#1d4ed8' : (matchingQCFolder?.pm_status === 'pm_rejected' ? '#e11d48' : '#c2410c')))} />}
                                                {sendingToQC ? 'Sending...' : isQCApproved ? 'QC Approved ✓' : (qcStatus === 'under_review' ? 'QC Under Review' : 'Send to QC')}
                                            </button>
                                        </div>
                                    )}

                                    {/* Dedicated View Reject Details Button */}
                                    {isProjectStarted && qcStatus === 'changes_requested' && (
                                        <button
                                            type="button"
                                            onClick={() => setShowQCRejectModal(true)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                padding: '8px 14px',
                                                borderRadius: '8px',
                                                border: matchingQCFolder?.pm_status === 'pm_rejected' ? '1.5px solid #fda4af' : '1.5px solid #fecaca',
                                                backgroundColor: matchingQCFolder?.pm_status === 'pm_rejected' ? '#fff1f2' : '#fef2f2',
                                                color: matchingQCFolder?.pm_status === 'pm_rejected' ? '#9f1239' : '#b91c1c',
                                                fontSize: '0.82rem',
                                                fontWeight: 800,
                                                cursor: 'pointer',
                                                boxShadow: '0 1px 3px rgba(220, 38, 38, 0.1)'
                                            }}
                                            title={matchingQCFolder?.pm_status === 'pm_rejected' ? "View PM rejection notes and reopened comments" : "View QC rejection remarks, file feedback, and correction requests"}
                                        >
                                            <AlertTriangle size={15} color={matchingQCFolder?.pm_status === 'pm_rejected' ? '#e11d48' : '#dc2626'} />
                                            {matchingQCFolder?.pm_status === 'pm_rejected' ? 'View PM Reject Details' : 'View Reject Details'}
                                        </button>
                                    )}
                                </>
                            ) : isClientRejected ? (
                                <div
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '7px 14px',
                                        borderRadius: '8px',
                                        backgroundColor: '#fef2f2',
                                        border: '1.5px solid #fecaca',
                                        color: '#991b1b',
                                        fontSize: '0.82rem',
                                        fontWeight: 800,
                                        letterSpacing: '0.2px'
                                    }}
                                    title="Client declined this initial quotation proposal. Project workflow options are locked until the quotation is revised and Stage 1 payment is made."
                                >
                                    <span style={{ fontSize: '1rem' }}>❌</span>
                                    <span>Quotation Declined by Client — Edit &amp; Resubmit (Stage 1 Advance Required)</span>
                                </div>
                            ) : null}
                        </div>
                    </div>

                    {/* Rejection Notice Banner: PM Rejection OR QC Inspection Rejection */}
                    {qcStatus === 'changes_requested' && (
                        matchingQCFolder?.pm_status === 'pm_rejected' ? (
                            <div className="no-print" style={{
                                marginBottom: '16px',
                                backgroundColor: '#fff1f2',
                                borderRadius: '12px',
                                border: '1.5px solid #fda4af',
                                padding: '14px 18px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                gap: '12px',
                                boxShadow: '0 2px 6px rgba(225, 29, 72, 0.08)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                    <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#ffe4e6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e11d48', flexShrink: 0 }}>
                                        <AlertTriangle size={20} />
                                    </div>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#9f1239' }}>
                                                Rejected by Project Manager (PM)
                                            </span>
                                            <span style={{ backgroundColor: '#e11d48', color: '#ffffff', fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: '8px', textTransform: 'uppercase' }}>
                                                Trigger: Rejected by PM
                                            </span>
                                        </div>
                                        {matchingQCFolder.pm_notes ? (
                                            <div style={{ fontSize: '0.82rem', color: '#881337', marginTop: '4px', fontStyle: 'italic', backgroundColor: '#ffe4e6', padding: '6px 10px', borderRadius: '6px', borderLeft: '3px solid #e11d48' }}>
                                                <strong>PM Notes:</strong> "{matchingQCFolder.pm_notes}"
                                            </div>
                                        ) : (
                                            <div style={{ fontSize: '0.78rem', color: '#881337', marginTop: '3px' }}>
                                                Project Manager returned this version for corrections.
                                            </div>
                                        )}
                                        <div style={{ fontSize: '0.76rem', color: '#be123c', marginTop: '4px' }}>
                                            PM Reviewer: <strong>{matchingQCFolder.pm_reviewer_name || 'Project Manager'}</strong> • Please review reopened comments, rectify them, upload revisions, and send to QC for final approval.
                                        </div>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowQCRejectModal(true)}
                                    style={{
                                        padding: '8px 16px',
                                        borderRadius: '8px',
                                        backgroundColor: '#e11d48',
                                        color: '#ffffff',
                                        border: 'none',
                                        fontWeight: 800,
                                        fontSize: '0.80rem',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        boxShadow: '0 2px 6px rgba(225, 29, 72, 0.25)'
                                    }}
                                >
                                    <AlertTriangle size={15} /> View PM Notes &amp; Reopened Comments
                                </button>
                            </div>
                        ) : (
                            <div className="no-print" style={{
                                marginBottom: '16px',
                                backgroundColor: '#fef2f2',
                                borderRadius: '12px',
                                border: '1.5px solid #fecaca',
                                padding: '12px 18px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                gap: '12px',
                                boxShadow: '0 2px 6px rgba(220, 38, 38, 0.08)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ width: '34px', height: '34px', borderRadius: '8px', backgroundColor: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626', flexShrink: 0 }}>
                                        <AlertTriangle size={18} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#991b1b' }}>
                                            QC Inspection: Corrections Requested for this Version
                                        </div>
                                        <div style={{ fontSize: '0.78rem', color: '#7f1d1d' }}>
                                            The Quality Check team requested updates. Make corrections to the quotation and drawings, then save and send the next revision. Approved files will carry over automatically.
                                        </div>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowQCRejectModal(true)}
                                    style={{
                                        padding: '7px 14px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        backgroundColor: '#dc2626',
                                        color: '#ffffff',
                                        fontWeight: 800,
                                        fontSize: '0.80rem',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        boxShadow: '0 2px 6px rgba(220, 38, 38, 0.25)'
                                    }}
                                >
                                    <AlertTriangle size={14} /> View QC Reject Details &amp; Notes
                                </button>
                            </div>
                        )
                    )}

                    {/* ===== VERSIONS HISTORY PANEL ===== */}
                    {!isReadOnly && isProjectStarted && (
                        <div className="no-print" style={{ marginBottom: '16px', backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                            {/* Header row */}
                            <div
                                onClick={toggleVersionsSection}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', cursor: 'pointer', backgroundColor: '#ffffff', userSelect: 'none' }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>📙</span>
                                    <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a', fontFamily: 'inherit' }}>Version History</span>
                                    <Info size={15} color="#94a3b8" />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem', color: '#64748b', fontWeight: 600 }}>
                                    <span>{isVersionsExpanded ? 'Collapse' : 'Expand'}</span>
                                    <ChevronRight size={16} color={isVersionsExpanded ? '#fca412' : '#64748b'} style={{ transform: isVersionsExpanded ? 'rotate(-90deg)' : 'rotate(90deg)', transition: 'transform 0.2s' }} />
                                </div>
                            </div>

                            {/* Body */}
                            {isVersionsExpanded && (
                                <div style={{ padding: '12px 18px' }}>
                                    {loadingVersions ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '0.83rem', padding: '8px 0' }}>
                                            <Loader2 size={14} className="animate-spin" /> Loading versions...
                                        </div>
                                    ) : versions.length === 0 ? (
                                        <div style={{ color: '#94a3b8', fontSize: '0.83rem', padding: '8px 0', fontStyle: 'italic' }}>
                                            No saved versions yet. Click <strong>Save Version</strong> to create the first snapshot.
                                        </div>
                                    ) : (
                                        <>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                                <thead>
                                                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                                        <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: '#475569', width: '60px' }}>Ver.</th>
                                                        <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#475569' }}>Saved On</th>
                                                        <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#475569' }}>Total Amount</th>
                                                        <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: '#475569', width: '220px' }}>Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {versions.map((v, idx) => (
                                                        <tr key={v.quote_id} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: selectedVersionData?.quoteId === v.quote_id ? '#f3f0ff' : idx === 0 ? '#fffbeb' : '#ffffff' }}>
                                                            <td style={{ padding: '9px 10px', textAlign: 'center', fontWeight: 800, color: '#7c3aed' }}>
                                                                v{v.version}
                                                                {v.has_snapshot || v.pdf_snapshot ? (
                                                                    <span style={{ display: 'block', backgroundColor: '#dcfce7', color: '#166534', fontSize: '0.62rem', fontWeight: 800, padding: '1px 4px', borderRadius: '4px', marginTop: '2px' }}>
                                                                        FROZEN SNAPSHOT
                                                                    </span>
                                                                ) : (
                                                                    <span style={{ display: 'block', backgroundColor: '#fef3c7', color: '#92400e', fontSize: '0.62rem', fontWeight: 800, padding: '1px 4px', borderRadius: '4px', marginTop: '2px' }} title="Legacy version saved before design freezing was introduced">
                                                                        LEGACY (NO SNAPSHOT)
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td style={{ padding: '9px 10px', color: '#334155', fontWeight: 600 }}>
                                                                {new Date(v.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                                <span style={{ color: '#94a3b8', marginLeft: '6px', fontWeight: 400 }}>
                                                                    {new Date(v.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                                {idx === 0 && <span style={{ marginLeft: '8px', backgroundColor: '#fef3c7', color: '#92400e', fontSize: '0.68rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px' }}>LATEST</span>}
                                                            </td>
                                                            <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>₹{parseFloat(v.total_amount).toLocaleString()}</td>
                                                            <td style={{ padding: '9px 10px', textAlign: 'center' }}>
                                                                <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                                                    <button
                                                                        onClick={async () => {
                                                                            await viewVersion(v.quote_id, v.version, parseFloat(v.total_amount), v.created_at);
                                                                            openPdfDocument(v.quote_id);
                                                                        }}
                                                                        disabled={loadingVersionPreview === v.quote_id}
                                                                        style={{ padding: '5px 10px', borderRadius: '6px', border: 'none', backgroundColor: '#fca412', color: '#ffffff', fontSize: '0.73rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                                        title="Show preview on screen & open PDF file"
                                                                    >
                                                                        <Printer size={12} /> {loadingVersionPreview === v.quote_id ? '...' : 'PDF'}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => restoreVersion(v.quote_id, v.version)}
                                                                        disabled={restoringVersion === v.quote_id}
                                                                        style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#ffffff', color: '#334155', fontSize: '0.73rem', fontWeight: 700, cursor: 'pointer' }}
                                                                    >
                                                                        {restoringVersion === v.quote_id ? '...' : 'Restore'}
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Subtitle input */}
                    {!isReadOnly && (
                        <div className="no-print" style={{ padding: '0 4px', marginBottom: '16px' }}>
                            <input
                                type="text"
                                placeholder={project?.client_name || project?.project_name || "Enter quote subtitle / reference..."}
                                value={subtitle}
                                onChange={(e) => setSubtitle(e.target.value)}
                                style={{ padding: '9px 14px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.88rem', width: '360px', color: '#334155', fontWeight: 600, outline: 'none', background: '#ffffff', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}
                            />
                        </div>
                    )}

                    <div className="no-print" style={{ padding: '0 4px' }}>

                        {/* ===== PROJECT INFORMATION ACCORDION CARD ===== */}
                        <div style={{
                            backgroundColor: '#ffffff',
                            borderRadius: '16px',
                            border: '1px solid #e2e8f0',
                            marginBottom: '16px',
                            overflow: 'hidden',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                        }}>
                            <div
                                onClick={toggleProjectInfoSection}
                                className="project-info-header"
                                style={{
                                    padding: '14px 20px',
                                    backgroundColor: '#ffffff',
                                    borderBottom: isProjectInfoExpanded ? '1px solid #f1f5f9' : 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    cursor: 'pointer',
                                    userSelect: 'none'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ fontSize: '1.15rem', lineHeight: 1 }}>📑</span>
                                    <span className="project-info-title" style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>Project Information</span>
                                </div>
                                <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem', color: '#64748b', fontWeight: 600 }}>
                                    <span>{isProjectInfoExpanded ? 'Collapse' : 'Expand'}</span>
                                    <ChevronRight size={16} color={isProjectInfoExpanded ? '#fca412' : '#64748b'} style={{ transform: isProjectInfoExpanded ? 'rotate(-90deg)' : 'rotate(90deg)', transition: 'transform 0.2s' }} />
                                </div>
                            </div>

                            <div className="project-info-body-container" style={{ padding: '20px 24px 24px 24px', display: isProjectInfoExpanded ? 'block' : 'none' }}>
                                {/* ROW 1: Proposal Created for | Project ID. | Proposal Date */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '18px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Proposal Created for</label>
                                        {isReadOnly ? (
                                            <div style={{ padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', backgroundColor: '#f8fafc', fontSize: '0.88rem', fontWeight: 600, color: '#0f172a' }}>{proposalFor || project?.client_name || '—'}</div>
                                        ) : (
                                            <input type="text" placeholder={project?.client_name || "Enter client name / proposal for..."} value={proposalFor} onChange={e => setProposalFor(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '0.88rem', fontWeight: 600, color: '#0f172a', outline: 'none', background: '#ffffff' }} />
                                        )}
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Project ID.</label>
                                        {isReadOnly ? (
                                            <div style={{ padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', backgroundColor: '#f8fafc', fontSize: '0.88rem', fontWeight: 600, color: '#0f172a' }}>{projectIdVal}</div>
                                        ) : (
                                            <input type="text" value={projectIdVal} onChange={e => setProjectIdVal(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '0.88rem', fontWeight: 600, color: '#0f172a', outline: 'none', background: '#ffffff' }} />
                                        )}
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Proposal Date</label>
                                        {isReadOnly ? (
                                            <div style={{ padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', backgroundColor: '#f8fafc', fontSize: '0.88rem', fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Calendar size={16} color="#64748b" /> {proposalDate}
                                            </div>
                                        ) : (
                                            <div style={{ position: 'relative' }}>
                                                <Calendar size={16} color="#64748b" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                                                <input type="text" value={proposalDate} onChange={e => setProposalDate(e.target.value)} style={{ width: '100%', padding: '10px 14px 10px 40px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '0.88rem', fontWeight: 600, color: '#0f172a', outline: 'none', background: '#ffffff' }} />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* ROW 2: Scope of Work */}
                                <div style={{ marginBottom: '18px' }}>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Scope of Work</label>
                                    {isReadOnly ? (
                                        <div style={{ padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', backgroundColor: '#f8fafc', fontSize: '0.88rem', fontWeight: 600, color: '#0f172a', minHeight: '60px' }}>{scopeOfWork}</div>
                                    ) : (
                                        <textarea rows={2} value={scopeOfWork} onChange={e => setScopeOfWork(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '0.88rem', fontWeight: 600, color: '#0f172a', outline: 'none', resize: 'vertical', background: '#ffffff' }} />
                                    )}
                                </div>

                                {/* ROW 3: Time for Production & Installation | Project Category | Designer Name | Sales Manager Name */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px', marginBottom: '18px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Time for Production &amp; Installation</label>
                                        {isReadOnly ? (
                                            <div style={{ padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', backgroundColor: '#f8fafc', fontSize: '0.88rem', fontWeight: 600, color: '#0f172a' }}>{productionTime}</div>
                                        ) : (
                                            <div style={{ position: 'relative' }}>
                                                <Clock size={16} color="#64748b" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                                                <input type="text" value={productionTime} onChange={e => setProductionTime(e.target.value)} style={{ width: '100%', padding: '10px 14px 10px 40px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '0.88rem', fontWeight: 600, color: '#0f172a', outline: 'none', background: '#ffffff' }} />
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Project Category</label>
                                        {isReadOnly ? (
                                            <div style={{ padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', backgroundColor: '#f8fafc', fontSize: '0.88rem', fontWeight: 600, color: '#0f172a' }}>{projectCategory}</div>
                                        ) : (
                                            <div style={{ position: 'relative' }}>
                                                <LayoutGrid size={16} color="#64748b" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                                                <select value={projectCategory} onChange={e => setProjectCategory(e.target.value)} style={{ width: '100%', padding: '10px 14px 10px 40px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '0.88rem', fontWeight: 600, color: '#0f172a', outline: 'none', background: '#ffffff', cursor: 'pointer' }}>
                                                    <option value="Interior & Furniture Projects">Interior &amp; Furniture Projects</option>
                                                    <option value="Commercial Interiors">Commercial Interiors</option>
                                                    <option value="Architecture & Civil Work">Architecture &amp; Civil Work</option>
                                                </select>
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Designer Name</label>
                                        {isReadOnly ? (
                                            <div style={{ padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', backgroundColor: '#f8fafc', fontSize: '0.88rem', fontWeight: 600, color: '#0f172a' }}>{designerName || 'Designer Name'}</div>
                                        ) : (
                                            <div style={{ position: 'relative' }}>
                                                <User size={16} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                                                <input type="text" list="quote-designer-list" placeholder="Designer Name" value={designerName} onChange={e => setDesignerName(e.target.value)} style={{ width: '100%', padding: '10px 14px 10px 40px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '0.88rem', fontWeight: 600, color: '#0f172a', outline: 'none', background: '#ffffff' }} />
                                                <datalist id="quote-designer-list">
                                                    {(allUsersList || [])
                                                        .filter((u: any) => {
                                                            const r = String(u.role || '').toLowerCase();
                                                            return ['d1', 'd2', 'designer', 'associate_designer'].includes(r) || r.includes('design');
                                                        })
                                                        .map((u: any) => (
                                                            <option key={u.user_id} value={u.name}>{u.role ? `(${u.role})` : ''}</option>
                                                        ))}
                                                </datalist>
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Sales Manager Name</label>
                                        {isReadOnly ? (
                                            <div style={{ padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', backgroundColor: '#f8fafc', fontSize: '0.88rem', fontWeight: 600, color: '#0f172a' }}>{salesManagerName || 'Sales Manager Name'}</div>
                                        ) : (
                                            <div style={{ position: 'relative' }}>
                                                <User size={16} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                                                <input
                                                    type="text"
                                                    list="quote-sales-manager-list"
                                                    placeholder="Sales Manager Name"
                                                    value={salesManagerName}
                                                    onChange={e => {
                                                        const val = e.target.value;
                                                        setSalesManagerName(val);
                                                        const matched = (allUsersList || []).find((u: any) => u.name && u.name.trim().toLowerCase() === val.trim().toLowerCase());
                                                        if (matched) {
                                                            if (matched.phone && !isBadSmPhone(matched.phone)) setSalesManagerPhone(matched.phone);
                                                            const em = getUserEmail(matched);
                                                            if (em) setSalesManagerEmail(em);
                                                        }
                                                    }}
                                                    style={{ width: '100%', padding: '10px 14px 10px 40px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '0.88rem', fontWeight: 600, color: '#0f172a', outline: 'none', background: '#ffffff' }}
                                                />
                                                <datalist id="quote-sales-manager-list">
                                                    {(allUsersList || [])
                                                        .filter((u: any) => {
                                                            const r = String(u.role || '').toLowerCase();
                                                            const n = String(u.name || '').toLowerCase();
                                                            return !r.includes('admin') && !n.includes('admin') && (['sales', 'sales_manager', 'sales_person', 'manager', 'business_associate', 'ba'].includes(r) || r.includes('sales'));
                                                        })
                                                        .map((u: any) => (
                                                            <option key={u.user_id} value={u.name}>{u.role ? `(${u.role})` : ''}</option>
                                                        ))}
                                                </datalist>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* ROW 4: Sales Manager Phone | Sales Manager Email */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '18px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Sales Manager Phone</label>
                                        {isReadOnly ? (
                                            <div style={{ padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', backgroundColor: '#f8fafc', fontSize: '0.88rem', fontWeight: 600, color: '#0f172a' }}>{salesManagerPhone || 'Sales Manager Phone'}</div>
                                        ) : (
                                            <div style={{ position: 'relative' }}>
                                                <Phone size={16} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                                                <input type="text" placeholder="Sales Manager Phone" value={salesManagerPhone} onChange={e => setSalesManagerPhone(e.target.value)} style={{ width: '100%', padding: '10px 14px 10px 40px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '0.88rem', fontWeight: 600, color: '#0f172a', outline: 'none', background: '#ffffff' }} />
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Sales Manager Email</label>
                                        {isReadOnly ? (
                                            <div style={{ padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', backgroundColor: '#f8fafc', fontSize: '0.88rem', fontWeight: 600, color: '#0f172a' }}>{salesManagerEmail || 'Sales Manager Email'}</div>
                                        ) : (
                                            <div style={{ position: 'relative' }}>
                                                <Mail size={16} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                                                <input type="text" placeholder="Sales Manager Email" value={salesManagerEmail} onChange={e => setSalesManagerEmail(e.target.value)} style={{ width: '100%', padding: '10px 14px 10px 40px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '0.88rem', fontWeight: 600, color: '#0f172a', outline: 'none', background: '#ffffff' }} />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* ROW 5: Notice Banner */}
                                <div style={{ padding: '12px 16px', backgroundColor: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: '10px', fontSize: '0.82rem', color: '#475569', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Info size={16} color="#3b82f6" />
                                    <span>The timeline may change based on Location, Finishes, Project Value, and Civil Scope of work.</span>
                                </div>
                            </div>
                        </div>

                        {/* ===== MODULES SUMMARY TABLE ===== */}
                        <div style={{
                            backgroundColor: '#ffffff',
                            borderRadius: '16px',
                            border: '1px solid #e2e8f0',
                            marginBottom: '16px',
                            overflow: 'hidden',
                            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
                        }}>
                            {/* Header Bar */}
                            <div
                                onClick={toggleModulesSummarySection}
                                style={{
                                    padding: '14px 20px',
                                    backgroundColor: '#ffffff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    cursor: 'pointer',
                                    userSelect: 'none'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ fontSize: '1.15rem', lineHeight: 1 }}>📦</span>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                                        Modules Summary &amp; Amount List
                                    </h3>
                                    <span style={{ fontSize: '0.88rem', color: '#fca412', fontWeight: 700 }}>
                                        ({sections.length} modules)
                                    </span>
                                </div>

                                <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '10px' }} onClick={(e) => e.stopPropagation()}>
                                    {!isReadOnly && (
                                        <button
                                            onClick={addSection}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                padding: '7px 16px',
                                                backgroundColor: '#fca412',
                                                color: '#ffffff',
                                                border: 'none',
                                                borderRadius: '6px',
                                                fontSize: '0.82rem',
                                                fontWeight: 800,
                                                cursor: 'pointer',
                                                boxShadow: '0 2px 6px rgba(252, 164, 18, 0.25)',
                                                transition: 'all 0.15s'
                                            }}
                                        >
                                            <PlusCircle size={14} /> Add Module
                                        </button>
                                    )}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem', color: '#475569', fontWeight: 700 }} onClick={toggleModulesSummarySection}>
                                        <span>{isModulesSummaryExpanded ? 'Collapse' : 'Expand'}</span>
                                        <ChevronRight size={18} color={isModulesSummaryExpanded ? '#fca412' : '#64748b'} style={{ transform: isModulesSummaryExpanded ? 'rotate(-90deg)' : 'rotate(90deg)', transition: 'transform 0.2s' }} />
                                    </div>
                                </div>
                            </div>

                            {/* Table Body */}
                            {isModulesSummaryExpanded && (
                                <div style={{ padding: '0 20px 20px 20px' }}>
                                    <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '0.88rem' }}>
                                        <thead>
                                            <tr style={{ backgroundColor: 'rgb(254, 143, 62)', color: '#ffffff' }}>
                                                <th style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 700, width: '60px', borderTopLeftRadius: '10px' }}>#</th>
                                                <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 700 }}>Module Name</th>
                                                <th style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 700, width: '180px' }}>Total Items</th>
                                                <th style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 700, width: '220px', borderTopRightRadius: '10px' }}>Module Gross Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sections.map((sec, idx) => {
                                                const secGross = sec.items.reduce((sum, item) => {
                                                    if (item.brand === 'HEADER') return sum;
                                                    const qty = (item.quantity === undefined || item.quantity === null || parseFloat(item.quantity as any) <= 0) ? 1 : parseFloat(item.quantity as any);
                                                    const rate = Math.max(0, parseFloat(item.rate as any) || 0);
                                                    return sum + (qty * rate);
                                                }, 0);
                                                const secNet = sec.items.reduce((a, item) => a + (item.amount || 0), 0);
                                                const secDiscount = sec.items.reduce((sum, item) => {
                                                    if (item.brand === 'HEADER') return sum;
                                                    const qty = (item.quantity === undefined || item.quantity === null || parseFloat(item.quantity as any) <= 0) ? 1 : parseFloat(item.quantity as any);
                                                    const rate = Math.max(0, parseFloat(item.rate as any) || 0);
                                                    const base = qty * rate;
                                                    const disc = Math.min(100, Math.max(0, parseFloat(item.discount_percent as any) || 0));
                                                    return sum + (disc > 0 && base > 0 ? (base * disc) / 100 : 0);
                                                }, 0);
                                                const count = sec.items.filter(i => i.brand !== 'HEADER').length;
                                                const secSft = sec.items.reduce((sum, item) => {
                                                    if (item.brand === 'HEADER') return sum;
                                                    const sft = computeSqft(item.width, item.height, item.sft, item.pricing_mode);
                                                    return sum + (sft * (item.quantity || 1));
                                                }, 0);
                                                const isEven = idx % 2 === 1;
                                                return (
                                                    <tr key={sec.id || idx} style={{ borderBottom: '1px solid #f3f4f6', backgroundColor: isEven ? '#fffdf9' : '#ffffff' }}>
                                                        <td style={{ padding: '16px 16px', textAlign: 'center', fontWeight: 700, color: '#374151', borderBottom: '1px solid #f3f4f6' }}>{idx + 1}</td>
                                                        <td style={{ padding: '16px 20px', fontWeight: 800, color: '#111827', borderBottom: '1px solid #f3f4f6' }}>{sec.name || `Module ${idx + 1}`}</td>
                                                        <td style={{ padding: '16px 20px', textAlign: 'right', color: '#374151', fontWeight: 600, borderBottom: '1px solid #f3f4f6' }}>
                                                            <div>{count} Items</div>
                                                            {secSft > 0 && (
                                                                <div style={{ color: '#ea580c', fontWeight: 700, fontSize: '0.80rem', marginTop: '2px', wordBreak: 'break-all' }} title={`Exact Module SFT: ${Number(secSft.toFixed(2))}`}>
                                                                    {Number(secSft.toFixed(2))} SFT
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td style={{ padding: '16px 20px', textAlign: 'right', fontWeight: 800, color: '#ea580c', fontSize: '1rem', borderBottom: '1px solid #f3f4f6' }}>
                                                            <div>₹{secGross.toLocaleString('en-IN')}</div>
                                                            {secDiscount > 0 && (
                                                                <div style={{ fontSize: '0.76rem', color: '#dc2626', fontWeight: 700, marginTop: '2px' }}>
                                                                    Discount: -₹{Math.round(secDiscount).toLocaleString('en-IN')}
                                                                </div>
                                                            )}
                                                            {secGross !== secNet && (
                                                                <div style={{ fontSize: '0.76rem', color: '#15803d', fontWeight: 700, marginTop: '2px' }}>
                                                                    (Net: ₹{secNet.toLocaleString('en-IN')})
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}

                                            {/* 1) Total Modules Gross Amount */}
                                            <tr style={{ backgroundColor: '#fffaf0' }}>
                                                <td colSpan={3} style={{ padding: '16px 20px', textAlign: 'right', fontSize: '1.05rem', fontWeight: 800, color: '#111827', borderTop: '2px solid #fed7aa' }}>
                                                    <div>Total Modules Gross Amount:</div>
                                                    {(() => {
                                                        const grandTotalSft = sections.reduce((secSum, sec) => {
                                                            return secSum + sec.items.reduce((itemSum, item) => {
                                                                if (item.brand === 'HEADER') return itemSum;
                                                                const sft = computeSqft(item.width, item.height, item.sft, item.pricing_mode);
                                                                return itemSum + (sft * (item.quantity || 1));
                                                            }, 0);
                                                        }, 0);
                                                        return grandTotalSft > 0 ? (
                                                            <div style={{ fontSize: '0.84rem', color: '#ea580c', fontWeight: 800, marginTop: '2px', wordBreak: 'break-all' }} title={`Exact Total SFT: ${Number(grandTotalSft.toFixed(2))}`}>
                                                                Total SFT: {Number(grandTotalSft.toFixed(2))} SFT
                                                            </div>
                                                        ) : null;
                                                    })()}
                                                </td>
                                                <td style={{ padding: '16px 20px', textAlign: 'right', fontSize: '1.3rem', fontWeight: 800, color: '#ea580c', borderTop: '2px solid #fed7aa' }}>₹{getGrossTotal().toLocaleString('en-IN')}</td>
                                            </tr>

                                            {/* 2) Category-Wise Discount */}
                                            <tr style={{ backgroundColor: '#fff7ed', borderTop: '1px dashed #fed7aa' }}>
                                                <td colSpan={3} style={{ padding: '10px 20px', textAlign: 'right', fontSize: '0.92rem', fontWeight: 700, color: '#c2410c' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', flexWrap: 'wrap' }}>
                                                        {!isReadOnly && (
                                                            <button
                                                                className="no-print"
                                                                onClick={handleOpenCategoryDiscountModal}
                                                                style={{
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '6px',
                                                                    padding: '6px 14px',
                                                                    backgroundColor: '#ea580c',
                                                                    color: '#ffffff',
                                                                    border: 'none',
                                                                    borderRadius: '8px',
                                                                    fontWeight: 800,
                                                                    fontSize: '0.82rem',
                                                                    cursor: 'pointer',
                                                                    boxShadow: '0 2px 6px rgba(234, 88, 12, 0.25)'
                                                                }}
                                                            >
                                                                🏷️ Category-Wise Discounts
                                                            </button>
                                                        )}
                                                        {getCategoryDiscountTotal() > 0 && (
                                                            <span style={{
                                                                backgroundColor: '#fed7aa',
                                                                color: '#9a3412',
                                                                padding: '2px 8px',
                                                                borderRadius: '6px',
                                                                fontWeight: 800,
                                                                fontSize: '0.86rem'
                                                            }}>
                                                                - ₹{getCategoryDiscountTotal().toLocaleString('en-IN', { minimumFractionDigits: getCategoryDiscountTotal() % 1 !== 0 ? 2 : 0, maximumFractionDigits: 2 })}
                                                            </span>
                                                        )}

                                                        {/* Quick All Items Discount */}
                                                        {!isReadOnly && !isPrintingVersion && (
                                                            <div className="no-print" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                                                <span style={{ fontSize: '0.78rem', color: '#9a3412', fontWeight: 700 }}>Quick All:</span>
                                                                <select
                                                                    value={globalDiscountInputType}
                                                                    onChange={(e) => {
                                                                        const newType = e.target.value as 'flat' | 'percent';
                                                                        setGlobalDiscountInputType(newType);
                                                                        const num = parseFloat(globalDiscountInputValue) || 0;
                                                                        applyGlobalCategoryDiscountValue(num, newType);
                                                                    }}
                                                                    style={{
                                                                        padding: '4px 6px',
                                                                        borderRadius: '6px',
                                                                        border: '1px solid #fed7aa',
                                                                        backgroundColor: '#ffffff',
                                                                        fontSize: '0.82rem',
                                                                        fontWeight: 800,
                                                                        color: '#ea580c',
                                                                        outline: 'none',
                                                                        cursor: 'pointer'
                                                                    }}
                                                                >
                                                                    <option value="percent">% (Percentage)</option>
                                                                    <option value="flat">₹ (Flat Amount)</option>
                                                                </select>
                                                                <input
                                                                    type="number"
                                                                    min={0}
                                                                    max={globalDiscountInputType === 'percent' ? 100 : undefined}
                                                                    value={globalDiscountInputValue}
                                                                    placeholder="0"
                                                                    onFocus={(e) => { if (e.target.value === '0') e.target.select(); }}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        setGlobalDiscountInputValue(val);
                                                                        const num = parseFloat(val) || 0;
                                                                        applyGlobalCategoryDiscountValue(num, globalDiscountInputType);
                                                                    }}
                                                                    style={{
                                                                        width: '120px',
                                                                        padding: '5px 10px',
                                                                        borderRadius: '6px',
                                                                        border: '1.5px solid #ea580c',
                                                                        backgroundColor: '#ffffff',
                                                                        fontSize: '0.88rem',
                                                                        fontWeight: 800,
                                                                        color: '#c2410c',
                                                                        outline: 'none'
                                                                    }}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '10px 20px', textAlign: 'right', fontSize: '1.05rem', fontWeight: 800, color: '#c2410c' }}>
                                                    {getCategoryDiscountTotal() > 0 ? `- ₹${getCategoryDiscountTotal().toLocaleString('en-IN', { minimumFractionDigits: getCategoryDiscountTotal() % 1 !== 0 ? 2 : 0, maximumFractionDigits: 2 })}` : '—'}
                                                </td>
                                            </tr>



                                            {/* 3) Promo / Coupon Code */}
                                            {(appliedCoupon || (!isReadOnly && !isPrintingVersion)) && (
                                                <tr style={{ backgroundColor: '#fff7ed', borderTop: '1px dashed #fed7aa' }}>
                                                    <td colSpan={3} style={{ padding: '12px 20px', textAlign: 'right', fontSize: '0.92rem', fontWeight: 700, color: '#ea580c' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', flexWrap: 'wrap' }}>
                                                            {!appliedCoupon && !isReadOnly && !isPrintingVersion && (
                                                                <div className="no-print">
                                                                    <button
                                                                        onClick={() => handleOpenPromoModal()}
                                                                        style={{
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            gap: '6px',
                                                                            padding: '6px 14px',
                                                                            backgroundColor: '#ea580c',
                                                                            color: '#ffffff',
                                                                            border: 'none',
                                                                            borderRadius: '8px',
                                                                            fontWeight: 800,
                                                                            fontSize: '0.84rem',
                                                                            cursor: 'pointer',
                                                                            boxShadow: '0 2px 6px rgba(234, 88, 12, 0.25)'
                                                                        }}
                                                                        title="Enter promo code"
                                                                    >
                                                                        <Tag size={15} />
                                                                        🎟️ Promo Code
                                                                    </button>
                                                                </div>
                                                            )}

                                                            {appliedCoupon && (
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#ffffff', padding: '6px 14px', borderRadius: '8px', border: '1.5px solid #ea580c', boxShadow: '0 2px 4px rgba(234, 88, 12, 0.1)' }}>
                                                                    <span style={{ fontWeight: 800, color: '#ea580c', fontSize: '0.88rem' }}>
                                                                        🏷️ {appliedCoupon.code} ({appliedCoupon.discountType === 'percent' ? `${appliedCoupon.discountValue}% OFF` : `₹${appliedCoupon.discountValue.toLocaleString('en-IN')} OFF`})
                                                                    </span>
                                                                    {!isReadOnly && !isPrintingVersion && (
                                                                        <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '4px' }}>
                                                                            <button
                                                                                onClick={() => handleOpenPromoModal(appliedCoupon.code)}
                                                                                style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid #fed7aa', backgroundColor: '#fff7ed', color: '#ea580c', fontWeight: 700, fontSize: '0.76rem', cursor: 'pointer' }}
                                                                            >
                                                                                Change
                                                                            </button>
                                                                            <button
                                                                                onClick={removeCouponCode}
                                                                                style={{ background: 'none', border: 'none', color: '#dc2626', fontWeight: 800, cursor: 'pointer', fontSize: '0.90rem', padding: '0 2px' }}
                                                                                title="Remove Coupon"
                                                                            >
                                                                                ✕
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '12px 20px', textAlign: 'right', fontSize: '1.1rem', fontWeight: 800, color: '#ea580c' }}>
                                                        {appliedCoupon ? `- ₹${getCouponDiscountAmount().toLocaleString('en-IN')}` : '—'}
                                                    </td>
                                                </tr>
                                            )}

                                            {/* 5) Additional Charges */}
                                            <tr style={{ backgroundColor: '#fffaf0', borderTop: '1px dashed #fed7aa' }}>
                                                <td colSpan={3} style={{ padding: '10px 20px', textAlign: 'right', fontSize: '0.92rem', fontWeight: 700, color: '#374151' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
                                                        <span>➕ Additional Charges:</span>
                                                        {!isReadOnly && !isPrintingVersion && (
                                                            <div className="no-print" style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                                                                <input
                                                                    type="number"
                                                                    placeholder="Charge ₹"
                                                                    value={additionalChargesAmount || ''}
                                                                    onChange={(e) => {
                                                                        setAdditionalChargesAmount(parseFloat(e.target.value) || 0);
                                                                        setIsDirty(true);
                                                                    }}
                                                                    style={{ width: '120px', padding: '5px 10px', borderRadius: '6px', border: '1.5px solid #cbd5e1', fontSize: '0.88rem', fontWeight: 700, outline: 'none' }}
                                                                />
                                                                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 700, color: additionalChargesHasGst ? '#ea580c' : '#475569', cursor: 'pointer', userSelect: 'none', backgroundColor: '#ffffff', padding: '4px 10px', borderRadius: '6px', border: additionalChargesHasGst ? '1.5px solid #ea580c' : '1px solid #cbd5e1' }}>
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={additionalChargesHasGst}
                                                                        onChange={(e) => {
                                                                            setAdditionalChargesHasGst(e.target.checked);
                                                                            setIsDirty(true);
                                                                        }}
                                                                        style={{ cursor: 'pointer', accentColor: '#ea580c' }}
                                                                    />
                                                                    <span>+ Add</span>
                                                                    <input
                                                                        type="number"
                                                                        min={0}
                                                                        max={100}
                                                                        value={additionalChargesGstRate}
                                                                        placeholder="0"
                                                                        onFocus={(e) => { if (e.target.value === '0') e.target.select(); }}
                                                                        onChange={(e) => {
                                                                            const val = parseFloat(e.target.value) || 0;
                                                                            setAdditionalChargesGstRate(val);
                                                                            if (val > 0 && !additionalChargesHasGst) {
                                                                                setAdditionalChargesHasGst(true);
                                                                            }
                                                                            setIsDirty(true);
                                                                        }}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        style={{ width: '55px', padding: '2px 6px', borderRadius: '4px', border: '1.5px solid #ea580c', fontSize: '0.82rem', fontWeight: 800, textAlign: 'center', color: '#ea580c', outline: 'none' }}
                                                                    />
                                                                    <span>% GST</span>
                                                                </label>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '10px 20px', textAlign: 'right', fontSize: '1.05rem', fontWeight: 800, color: '#374151' }}>
                                                    {additionalChargesAmount > 0 ? (
                                                        <div>
                                                            <div>₹{additionalChargesAmount.toLocaleString('en-IN')}</div>
                                                            {additionalChargesHasGst && additionalChargesGstRate > 0 && (
                                                                <div style={{ fontSize: '0.75rem', color: '#ea580c', fontWeight: 700 }}>
                                                                    + ₹{Math.round(additionalChargesAmount * (additionalChargesGstRate / 100)).toLocaleString('en-IN')} ({additionalChargesGstRate}% GST)
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : '—'}
                                                </td>
                                            </tr>

                                            {/* 6) Overall GST - Splitwise (CGST+SGST or IGST) */}
                                            <tr style={{ backgroundColor: '#fffaf0', borderTop: '1px dashed #fed7aa' }}>
                                                <td colSpan={3} style={{ padding: '10px 20px', textAlign: 'right', fontSize: '0.92rem', fontWeight: 700, color: '#374151' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', flexWrap: 'wrap' }}>
                                                        <span>🏛️ Overall GST:</span>
                                                        {!isReadOnly && !isPrintingVersion && (
                                                            <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                                                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={overallGstEnabled}
                                                                        onChange={(e) => {
                                                                            const isEnabled = e.target.checked;
                                                                            setOverallGstEnabled(isEnabled);
                                                                            setSections(prevSections => prevSections.map(sec => ({
                                                                                ...sec,
                                                                                items: sec.items.map(it => {
                                                                                    if (it.brand === 'HEADER') return it;
                                                                                    const effQty = Math.max(0, it.quantity || 0);
                                                                                    const rate = Math.max(0, parseFloat(it.rate as any) || 0);
                                                                                    const baseAmt = effQty * rate;
                                                                                    const disc = Math.min(100, Math.max(0, it.discount_percent || 0));
                                                                                    const amtAfterDisc = Math.max(0, baseAmt - (baseAmt * (disc / 100)));
                                                                                    const itemGst = it.gst_rate !== undefined && it.gst_rate !== null && String(it.gst_rate).trim() !== ''
                                                                                        ? Math.min(100, Math.max(0, parseFloat(it.gst_rate as any) || 0))
                                                                                        : overallGstRate;
                                                                                    const effGst = isEnabled ? itemGst : 0;
                                                                                    const finalAmt = Math.max(0, amtAfterDisc + (amtAfterDisc * (effGst / 100)));
                                                                                    return {
                                                                                        ...it,
                                                                                        amount: Math.round(finalAmt)
                                                                                    };
                                                                                })
                                                                            })));
                                                                            setIsDirty(true);
                                                                        }}
                                                                    />
                                                                    Apply GST
                                                                </label>
                                                                {overallGstEnabled && (() => {
                                                                    const gstInfo = getGstRateInfo();
                                                                    const displayVal = overallGstInputVal !== null
                                                                        ? overallGstInputVal
                                                                        : (gstInfo.isMixed ? String(gstInfo.effectiveRate) : String(overallGstRate));
                                                                    return (
                                                                        <>
                                                                            {/* Overall GST Input field */}
                                                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: '#ffffff', padding: '2px 8px', borderRadius: '6px', border: '1.5px solid #ea580c' }}>
                                                                                <input
                                                                                    type="text"
                                                                                    inputMode="decimal"
                                                                                    value={displayVal}
                                                                                    title={gstInfo.isMixed ? `Mixed GST rates on items (${gstInfo.rates.join('%, ')}%). Type a % and click 'Apply to All' or press Enter to apply across all items.` : `Enter overall GST %`}
                                                                                    onChange={(e) => {
                                                                                        const raw = e.target.value;
                                                                                        if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
                                                                                            setOverallGstInputVal(raw);
                                                                                        }
                                                                                    }}
                                                                                    onKeyDown={(e) => {
                                                                                        if (e.key === 'Enter') {
                                                                                            const val = overallGstInputVal !== null ? overallGstInputVal : displayVal;
                                                                                            const parsed = val === '' ? (gstInfo.isMixed ? gstInfo.effectiveRate : 18) : Math.min(100, Math.max(0, parseFloat(val) || 0));
                                                                                            applyOverallGstToAllItems(parsed, false);
                                                                                            (e.target as HTMLInputElement).blur();
                                                                                        }
                                                                                    }}
                                                                                    onBlur={() => {
                                                                                        if (overallGstInputVal !== null) {
                                                                                            const val = overallGstInputVal;
                                                                                            const parsed = val === '' ? (gstInfo.isMixed ? gstInfo.effectiveRate : 18) : Math.min(100, Math.max(0, parseFloat(val) || 0));
                                                                                            applyOverallGstToAllItems(parsed, false);
                                                                                        }
                                                                                    }}
                                                                                    style={{
                                                                                        width: '52px',
                                                                                        padding: '2px 4px',
                                                                                        borderRadius: '4px',
                                                                                        border: 'none',
                                                                                        fontSize: '0.82rem',
                                                                                        fontWeight: 800,
                                                                                        textAlign: 'center',
                                                                                        color: '#ea580c',
                                                                                        outline: 'none',
                                                                                        backgroundColor: 'transparent'
                                                                                    }}
                                                                                />
                                                                                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#ea580c' }}>% GST</span>
                                                                            </div>

                                                                            {/* 1-Click Apply to All Items button */}
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    const val = overallGstInputVal !== null ? overallGstInputVal : displayVal;
                                                                                    const parsed = val === '' ? (gstInfo.isMixed ? gstInfo.effectiveRate : 18) : Math.min(100, Math.max(0, parseFloat(val) || 0));
                                                                                    applyOverallGstToAllItems(parsed, false);
                                                                                }}
                                                                                title="Apply this GST % to all items across the quote"
                                                                                style={{
                                                                                    padding: '3px 8px',
                                                                                    backgroundColor: '#ea580c',
                                                                                    color: '#ffffff',
                                                                                    border: 'none',
                                                                                    borderRadius: '5px',
                                                                                    fontSize: '0.72rem',
                                                                                    fontWeight: 800,
                                                                                    cursor: 'pointer',
                                                                                    whiteSpace: 'nowrap',
                                                                                    transition: 'all 0.15s ease'
                                                                                }}
                                                                            >
                                                                                Apply to All
                                                                            </button>

                                                                            {/* Splitwise selector: Intra-state (CGST + SGST) vs Inter-state (IGST) */}
                                                                            <div style={{ display: 'inline-flex', borderRadius: '6px', overflow: 'hidden', border: '1.5px solid #ea580c' }}>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => { setGstSplitType('intra'); setIsDirty(true); }}
                                                                                    style={{
                                                                                        padding: '2px 8px',
                                                                                        border: 'none',
                                                                                        fontSize: '0.74rem',
                                                                                        fontWeight: 800,
                                                                                        cursor: 'pointer',
                                                                                        backgroundColor: gstSplitType === 'intra' ? '#ea580c' : '#ffffff',
                                                                                        color: gstSplitType === 'intra' ? '#ffffff' : '#ea580c',
                                                                                        transition: 'all 0.15s'
                                                                                    }}
                                                                                    title="CGST + SGST Split (Within State)"
                                                                                >
                                                                                    CGST + SGST
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => { setGstSplitType('inter'); setIsDirty(true); }}
                                                                                    style={{
                                                                                        padding: '2px 8px',
                                                                                        border: 'none',
                                                                                        fontSize: '0.74rem',
                                                                                        fontWeight: 800,
                                                                                        cursor: 'pointer',
                                                                                        backgroundColor: gstSplitType === 'inter' ? '#ea580c' : '#ffffff',
                                                                                        color: gstSplitType === 'inter' ? '#ffffff' : '#ea580c',
                                                                                        transition: 'all 0.15s'
                                                                                    }}
                                                                                    title="IGST (Inter-State)"
                                                                                >
                                                                                    IGST
                                                                                </button>
                                                                            </div>
                                                                        </>
                                                                    );
                                                                })()}
                                                                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={overallGstLineHidden}
                                                                        onChange={(e) => {
                                                                            setOverallGstLineHidden(e.target.checked);
                                                                            setIsDirty(true);
                                                                        }}
                                                                    />
                                                                    Hide GST Line in PDF
                                                                </label>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '10px 20px', textAlign: 'right', fontSize: '1.05rem', fontWeight: 800, color: '#374151' }}>
                                                    {overallGstEnabled ? (() => {
                                                        const gstInfo = getGstRateInfo();
                                                        const activeGstPct = gstInfo.isMixed ? gstInfo.effectiveRate : overallGstRate;
                                                        return (
                                                            <div>
                                                                <div>₹{getOverallGstAmount().toLocaleString('en-IN')}</div>
                                                                {(activeGstPct > 0 || getOverallGstAmount() > 0) && (
                                                                    <div style={{ fontSize: '0.74rem', color: '#16a34a', fontWeight: 700, marginTop: '2px' }}>
                                                                        {gstSplitType === 'intra' ? (
                                                                            <>
                                                                                <div>CGST: ₹{Math.round(getOverallGstAmount() / 2).toLocaleString('en-IN')}</div>
                                                                                <div>SGST: ₹{(getOverallGstAmount() - Math.round(getOverallGstAmount() / 2)).toLocaleString('en-IN')}</div>
                                                                            </>
                                                                        ) : (
                                                                            <div>IGST: ₹{getOverallGstAmount().toLocaleString('en-IN')}</div>
                                                                        )}
                                                                        
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })() : '—'}
                                                </td>
                                            </tr>

                                            {/* 7) Round Off Adjustment */}
                                            <tr style={{ backgroundColor: '#fffaf0', borderTop: '1px dashed #fed7aa' }}>
                                                <td colSpan={3} style={{ padding: '10px 20px', textAlign: 'right', fontSize: '0.92rem', fontWeight: 700, color: '#64748b' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
                                                        {!isReadOnly && !isPrintingVersion && (
                                                            <label className="no-print" style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={roundOffEnabled}
                                                                    onChange={(e) => setRoundOffEnabled(e.target.checked)}
                                                                />
                                                                Enable Round Off
                                                            </label>
                                                        )}
                                                        <span>🔄 Round Off Adjustment:</span>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '10px 20px', textAlign: 'right', fontSize: '1.05rem', fontWeight: 800, color: getRoundOffAdjustment() >= 0 ? '#16a34a' : '#dc2626' }}>
                                                    {roundOffEnabled ? (getRoundOffAdjustment() >= 0 ? `+₹${getRoundOffAdjustment().toFixed(2)}` : `-₹${Math.abs(getRoundOffAdjustment()).toFixed(2)}`) : '—'}
                                                </td>
                                            </tr>

                                            {/* 8) Final Amount (Net Payable Total) */}
                                            <tr style={{ backgroundColor: '#fff1f2', borderTop: '2px solid #ea580c' }}>
                                                <td colSpan={3} style={{ padding: '16px 20px', textAlign: 'right', fontSize: '1.1rem', fontWeight: 900, color: '#0f172a' }}>
                                                    Final Amount (Net Payable Total):
                                                </td>
                                                <td style={{ padding: '16px 20px', textAlign: 'right', fontSize: '1.4rem', fontWeight: 900, color: '#16a34a' }}>
                                                    ₹{getNetPayableTotal().toLocaleString('en-IN')}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                    {/* Amount in Words box */}
                                    <div style={{ padding: '14px 20px', backgroundColor: '#fffaf0', borderTop: '1.5px dashed #fed7aa', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#c2410c', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Amount in Words:</span>
                                        <span style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0f172a' }}>{numberToWords(getNetPayableTotal())}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ===== ACCORDION MODULE EDITOR ===== */}
                    <div className="no-print" style={{ marginBottom: '24px' }}>
                        {sections.map((section, sIdx) => {
                            const secGross = section.items.reduce((sum, item) => {
                                if (item.brand === 'HEADER') return sum;
                                const qty = (item.quantity === undefined || item.quantity === null || parseFloat(item.quantity as any) <= 0) ? 1 : parseFloat(item.quantity as any);
                                const rate = Math.max(0, parseFloat(item.rate as any) || 0);
                                return sum + (qty * rate);
                            }, 0);
                            const sectionTotal = section.items.reduce((a, i) => a + (i.amount || 0), 0);
                            const isExpanded = expandedModules[section.id] ?? false;
                            const itemCount = section.items.filter(i => i.brand !== 'HEADER').length;
                            const isSectionMenuActive = openMenuId === section.id;
                            return (
                                <div key={section.id} style={{
                                    backgroundColor: '#ffffff',
                                    borderRadius: '16px',
                                    border: '1px solid #e2e8f0',
                                    marginBottom: '14px',
                                    overflow: 'visible',
                                    position: isSectionMenuActive ? 'relative' : 'static',
                                    zIndex: isSectionMenuActive ? 9999 : 1,
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                                }}>
                                    {/* Module Header Bar */}
                                    <div
                                        onClick={() => toggleModule(section.id)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            padding: '14px 20px',
                                            borderBottom: isExpanded ? '1.5px solid #fed7aa' : 'none',
                                            gap: '12px',
                                            cursor: 'pointer',
                                            userSelect: 'none'
                                        }}
                                    >
                                        {/* Number badge */}
                                        <div style={{
                                            width: '28px', height: '28px',
                                            borderRadius: '6px',
                                            backgroundColor: '#fca412',
                                            color: '#ffffff',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontWeight: 800, fontSize: '0.88rem',
                                            flexShrink: 0
                                        }}>{sIdx + 1}</div>

                                        {/* Module name on left */}
                                        <div style={{ flex: 1 }} onClick={(e) => e.stopPropagation()}>
                                            {isReadOnly ? (
                                                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>{section.name || `Module ${sIdx + 1}`}</div>
                                            ) : (
                                                <input
                                                    value={section.name || ''}
                                                    placeholder={`Module ${sIdx + 1} Name (e.g. Master Bedroom, Kitchen)`}
                                                    onChange={(e) => updateSectionName(section.id, e.target.value, false)}
                                                    onBlur={(e) => updateSectionName(section.id, e.target.value, true)}
                                                    style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a', border: 'none', outline: 'none', backgroundColor: 'transparent', width: '100%' }}
                                                />
                                            )}
                                        </div>

                                        {/* Right side: Items count & Total amount */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
                                            <div style={{ fontSize: '1rem', color: '#0f172a', fontWeight: 800, textAlign: 'right' }}>
                                                <span style={{ color: '#475569', fontWeight: 600, fontSize: '0.92rem' }}>{itemCount} Items</span>
                                                <span style={{ margin: '0 6px', color: '#cbd5e1' }}>•</span>
                                                <span style={{ color: '#fca412', fontWeight: 800, fontSize: '1.05rem' }}>₹{sectionTotal.toLocaleString('en-IN')}</span>
                                                {secGross > sectionTotal && Math.abs(secGross - sectionTotal) > 0.01 && (
                                                    <span style={{ fontSize: '0.80rem', color: '#64748b', fontWeight: 700, marginLeft: '6px' }}>(Gross: ₹{secGross.toLocaleString('en-IN')})</span>
                                                )}
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem', color: '#475569', fontWeight: 700 }}>
                                                <span>{isExpanded ? 'Collapse' : 'Expand'}</span>
                                                <ChevronRight size={18} color={isExpanded ? '#fca412' : '#64748b'} style={{ transform: isExpanded ? 'rotate(-90deg)' : 'rotate(90deg)', transition: 'transform 0.2s' }} />
                                            </div>

                                            {/* Section Three-dot Menu */}
                                            {!isReadOnly && (
                                                <div className="quote-section-menu-container" style={{ position: 'relative' }}>
                                                    {openMenuId === section.id && (
                                                        <div
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setOpenMenuId(null);
                                                            }}
                                                            style={{
                                                                position: 'fixed',
                                                                top: 0,
                                                                left: 0,
                                                                right: 0,
                                                                bottom: 0,
                                                                zIndex: 99990,
                                                                background: 'transparent'
                                                            }}
                                                        />
                                                    )}
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === section.id ? null : section.id); }}
                                                        style={{
                                                            background: openMenuId === section.id ? '#eff6ff' : 'transparent',
                                                            border: openMenuId === section.id ? '1.5px solid #2563eb' : 'none',
                                                            borderRadius: '6px',
                                                            cursor: 'pointer',
                                                            color: openMenuId === section.id ? '#2563eb' : '#374151',
                                                            padding: '4px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            boxShadow: openMenuId === section.id ? '0 0 0 3px rgba(37, 99, 235, 0.15)' : 'none',
                                                            transition: 'all 0.15s ease',
                                                            position: 'relative',
                                                            zIndex: openMenuId === section.id ? 99995 : 1
                                                        }}
                                                        title="Section Options"
                                                    >
                                                        <MoreVertical size={18} color={openMenuId === section.id ? '#2563eb' : '#374151'} />
                                                    </button>
                                                    {openMenuId === section.id && (
                                                        <div
                                                            onClick={(e) => e.stopPropagation()}
                                                            style={{
                                                                position: 'absolute', right: 0, top: '100%', zIndex: 99999,
                                                                backgroundColor: '#ffffff', border: '1.5px solid rgb(251, 158, 20)',
                                                                borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                                                                minWidth: '180px', padding: '4px 0'
                                                            }}>
                                                            <button onClick={(e) => { e.stopPropagation(); moveSectionUp(section.id); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.85rem', color: '#3b82f6', fontWeight: 600 }}>
                                                                <MoveUp size={16} /> Move Up
                                                            </button>
                                                            <button onClick={(e) => { e.stopPropagation(); moveSectionDown(section.id); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.85rem', color: '#3b82f6', fontWeight: 600 }}>
                                                                <MoveDown size={16} /> Move Down
                                                            </button>
                                                            <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '4px 0' }} />
                                                            <button onClick={(e) => { e.stopPropagation(); addItem(section.id); setOpenMenuId(null); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.85rem', color: '#16a34a', fontWeight: 600 }}>
                                                                <PlusCircle size={16} /> Add Item
                                                            </button>
                                                            <button onClick={(e) => { e.stopPropagation(); duplicateSection(section.id); setOpenMenuId(null); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.85rem', color: '#3b82f6', fontWeight: 600 }}>
                                                                <Copy size={16} /> Duplicate Section
                                                            </button>
                                                            <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '4px 0' }} />
                                                            <button onClick={(e) => { e.stopPropagation(); deleteSection(section.id); setOpenMenuId(null); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.85rem', color: '#dc2626', fontWeight: 600 }}>
                                                                <Trash2 size={16} /> Delete Section
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {/* Expanded Module Body - Items Table */}
                                    {isExpanded && (
                                        <div style={{ padding: '16px' }}>
                                            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', overflow: 'visible', border: '1.5px solid #fed7aa', boxShadow: '0 1px 4px rgba(0,0,0,0.02)' }}>
                                                <table onKeyDown={(e) => handleTableEnterNavigation(e, section.id)} style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: 0, fontSize: '0.85rem' }}>
                                                    <thead>
                                                        <tr style={{ backgroundColor: 'rgba(254, 143, 62, 1)', color: '#ffffff' }}>
                                                            <th style={{ padding: '12px 6px', textAlign: 'center', width: '35px', fontWeight: 700, fontSize: '0.88rem', color: '#ffffff', borderRight: '1px solid rgba(255, 255, 255, 0.25)', backgroundColor: 'rgba(254, 143, 62, 1)', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>#</th>
                                                            <th style={{ padding: '12px 10px', textAlign: 'center', width: '21%', fontWeight: 700, fontSize: '0.88rem', color: '#ffffff', borderRight: '1px solid rgba(255, 255, 255, 0.25)', backgroundColor: 'rgba(254, 143, 62, 1)', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                                                <input
                                                                    type="text"
                                                                    value={section.custom_headings?.particulars ?? (customHeadings.particulars !== 'Product Description' ? customHeadings.particulars : '')}
                                                                    placeholder="Product Description"
                                                                    onChange={(e) => updateSectionHeading(section.id, 'particulars', e.target.value)}
                                                                    style={{ background: 'transparent', border: 'none', color: '#ffffff', textAlign: 'center', fontWeight: 700, outline: 'none', width: '100%', fontSize: '0.88rem' }}
                                                                />
                                                            </th>
                                                            <th style={{ padding: '12px 10px', textAlign: 'center', width: '15%', fontWeight: 700, fontSize: '0.88rem', color: '#ffffff', borderRight: '1px solid rgba(255, 255, 255, 0.25)', backgroundColor: 'rgba(254, 143, 62, 1)', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                                                <input
                                                                    type="text"
                                                                    value={section.custom_headings?.shutterMaterial ?? (customHeadings.shutterMaterial !== 'Shutter Material | Finish' ? customHeadings.shutterMaterial : '')}
                                                                    placeholder="Shutter Material | Finish"
                                                                    onChange={(e) => updateSectionHeading(section.id, 'shutterMaterial', e.target.value)}
                                                                    style={{ background: 'transparent', border: 'none', color: '#ffffff', textAlign: 'center', fontWeight: 700, outline: 'none', width: '100%', fontSize: '0.88rem' }}
                                                                />
                                                            </th>
                                                            <th style={{ padding: '12px 10px', textAlign: 'center', width: '15%', fontWeight: 700, fontSize: '0.88rem', color: '#ffffff', borderRight: '1px solid rgba(255, 255, 255, 0.25)', backgroundColor: 'rgba(254, 143, 62, 1)', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                                                <input
                                                                    type="text"
                                                                    value={section.custom_headings?.carcassMaterial ?? (customHeadings.carcassMaterial !== 'Carcass Material | Color' ? customHeadings.carcassMaterial : '')}
                                                                    placeholder="Carcass Material | Color"
                                                                    onChange={(e) => updateSectionHeading(section.id, 'carcassMaterial', e.target.value)}
                                                                    style={{ background: 'transparent', border: 'none', color: '#ffffff', textAlign: 'center', fontWeight: 700, outline: 'none', width: '100%', fontSize: '0.88rem' }}
                                                                />
                                                            </th>
                                                            <th style={{ padding: '10px 6px', textAlign: 'center', width: '135px', fontWeight: 700, fontSize: '0.82rem', color: '#ffffff', borderRight: '1px solid rgba(255, 255, 255, 0.25)', backgroundColor: 'rgba(254, 143, 62, 1)', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                                                <input
                                                                    type="text"
                                                                    value={section.custom_headings?.dimensions ?? (customHeadings.dimensions !== 'Dimensions (W × H × D)' ? customHeadings.dimensions : '')}
                                                                    placeholder="Dimensions (W × H × D)"
                                                                    onChange={(e) => updateSectionHeading(section.id, 'dimensions', e.target.value)}
                                                                    style={{ background: 'transparent', border: 'none', color: '#ffffff', textAlign: 'center', fontWeight: 700, outline: 'none', width: '100%', fontSize: '0.82rem' }}
                                                                />
                                                            </th>
                                                            <th style={{ padding: '10px 6px', textAlign: 'center', width: '90px', fontWeight: 700, fontSize: '0.82rem', color: '#ffffff', borderRight: '1px solid rgba(255, 255, 255, 0.25)', backgroundColor: 'rgba(254, 143, 62, 1)', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                                                <input
                                                                    type="text"
                                                                    value={section.custom_headings?.rate ?? (customHeadings.rate !== 'Rate / SFT' ? customHeadings.rate : '')}
                                                                    placeholder="Rate / SFT"
                                                                    onChange={(e) => updateSectionHeading(section.id, 'rate', e.target.value)}
                                                                    style={{ background: 'transparent', border: 'none', color: '#ffffff', textAlign: 'center', fontWeight: 700, outline: 'none', width: '100%', fontSize: '0.82rem' }}
                                                                />
                                                            </th>
                                                            <th style={{ padding: '10px 4px', textAlign: 'center', width: '65px', fontWeight: 700, fontSize: '0.85rem', color: '#ffffff', borderRight: '1px solid rgba(255, 255, 255, 0.25)', backgroundColor: 'rgba(254, 143, 62, 1)', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                                                <input
                                                                    type="text"
                                                                    value={section.custom_headings?.qty ?? (customHeadings.qty !== 'QTY' ? customHeadings.qty : '')}
                                                                    placeholder="QTY"
                                                                    onChange={(e) => updateSectionHeading(section.id, 'qty', e.target.value)}
                                                                    style={{ background: 'transparent', border: 'none', color: '#ffffff', textAlign: 'center', fontWeight: 700, outline: 'none', width: '100%', fontSize: '0.85rem' }}
                                                                />
                                                            </th>
                                                            <th style={{ padding: '10px 4px', textAlign: 'center', width: '65px', fontWeight: 700, fontSize: '0.85rem', color: '#ffffff', borderRight: '1px solid rgba(255, 255, 255, 0.25)', backgroundColor: 'rgba(254, 143, 62, 1)', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                                                <input
                                                                    type="text"
                                                                    value={section.custom_headings?.gst ?? (customHeadings.gst !== 'GST %' ? customHeadings.gst : '')}
                                                                    placeholder="GST %"
                                                                    onChange={(e) => updateSectionHeading(section.id, 'gst', e.target.value)}
                                                                    style={{ background: 'transparent', border: 'none', color: '#ffffff', textAlign: 'center', fontWeight: 700, outline: 'none', width: '100%', fontSize: '0.85rem' }}
                                                                />
                                                            </th>
                                                            <th style={{ padding: '10px 8px', textAlign: 'center', width: '110px', fontWeight: 700, fontSize: '0.88rem', color: '#ffffff', backgroundColor: 'rgba(254, 143, 62, 1)', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                                                <input
                                                                    type="text"
                                                                    value={section.custom_headings?.amount ?? (customHeadings.amount !== 'Amount' ? customHeadings.amount : '')}
                                                                    placeholder="Amount"
                                                                    onChange={(e) => updateSectionHeading(section.id, 'amount', e.target.value)}
                                                                    style={{ background: 'transparent', border: 'none', color: '#ffffff', textAlign: 'center', fontWeight: 700, outline: 'none', width: '100%', fontSize: '0.88rem' }}
                                                                />
                                                            </th>
                                                            {!isReadOnly && <th style={{ padding: '12px 4px', textAlign: 'center', width: '40px', fontWeight: 700, color: '#ffffff', backgroundColor: 'rgba(254, 143, 62, 1)', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}></th>}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {(() => {
                                                            let regularItemCounter = 0;
                                                            return section.items.map((item, iIdx) => {
                                                                const isHeader = item.brand === 'HEADER';
                                                                if (isHeader) {
                                                                    regularItemCounter = 0;
                                                                } else {
                                                                    regularItemCounter++;
                                                                }
                                                                const displayNum = isHeader ? '' : regularItemCounter;
                                                                const isEvenRow = iIdx % 2 === 1;
                                                                const isMenuActive = openItemMenuId === item.id;
                                                                const isAnyDropdownOpen = activeHeadingDropdownId === item.id || activeCategoryDropdownId === item.id || activeShutterDropdownId === item.id || activeCarcassDropdownId === item.id;
                                                                return (
                                                                    <tr key={item.id} style={{ borderTop: isHeader ? '1.5px solid #fed7aa' : 'none', borderBottom: isHeader ? '2px solid #ea580c' : '1px solid #fed7aa', backgroundColor: isHeader ? '#fff7ed' : (isEvenRow ? 'rgba(251, 158, 20, 0.05)' : '#ffffff'), position: (isMenuActive || isAnyDropdownOpen) ? 'relative' : 'static', zIndex: isAnyDropdownOpen ? 99999 : (isMenuActive ? 100 : 1), WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                                                        <td style={{ padding: '12px 14px', textAlign: 'center', fontSize: '0.85rem', color: '#475569', fontWeight: 700, verticalAlign: 'middle', borderRight: '1px solid #fcd34d' }}>{displayNum}</td>

                                                                        {/* Product Name Column */}
                                                                        <td style={{ padding: '12px 14px', verticalAlign: 'middle', borderRight: '1px solid #fcd34d' }}>
                                                                            {isHeader ? (
                                                                                <input value={item.particulars}
                                                                                    list="product-headings-datalist"
                                                                                    placeholder="SUB TITLE NAME"
                                                                                    onChange={(e) => updateItem(section.id, item.id, 'particulars', e.target.value, false)}
                                                                                    onBlur={(e) => {
                                                                                        updateItem(section.id, item.id, 'particulars', e.target.value, true);
                                                                                        saveHeadingToPrevious(e.target.value);
                                                                                    }}
                                                                                    style={{ width: '100%', border: 'none', outline: 'none', fontWeight: 900, backgroundColor: 'transparent', fontSize: '0.95rem', color: 'rgb(251, 158, 20)', textTransform: 'uppercase', letterSpacing: '0.5px' }}
                                                                                />
                                                                            ) : (
                                                                                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                                                                    {/* Photo Upload Box */}
                                                                                    <label style={{ cursor: isReadOnly ? 'default' : 'pointer', position: 'relative', flexShrink: 0 }} title={isReadOnly ? '' : "Click to upload product image"}>
                                                                                        {!isReadOnly && (
                                                                                            <input
                                                                                                type="file"
                                                                                                accept="image/*"
                                                                                                style={{ display: 'none' }}
                                                                                                onChange={(e) => {
                                                                                                    const file = e.target.files?.[0];
                                                                                                    if (file) {
                                                                                                        const reader = new FileReader();
                                                                                                        reader.onload = (event) => {
                                                                                                            const img = new Image();
                                                                                                            img.onload = () => {
                                                                                                                const canvas = document.createElement('canvas');
                                                                                                                const maxDim = 600;
                                                                                                                let width = img.width;
                                                                                                                let height = img.height;
                                                                                                                if (width > maxDim || height > maxDim) {
                                                                                                                    if (width > height) {
                                                                                                                        height = Math.round((height * maxDim) / width);
                                                                                                                        width = maxDim;
                                                                                                                    } else {
                                                                                                                        width = Math.round((width * maxDim) / height);
                                                                                                                        height = maxDim;
                                                                                                                    }
                                                                                                                }
                                                                                                                canvas.width = width;
                                                                                                                canvas.height = height;
                                                                                                                const ctx = canvas.getContext('2d');
                                                                                                                if (ctx) {
                                                                                                                    ctx.fillStyle = '#ffffff';
                                                                                                                    ctx.fillRect(0, 0, width, height);
                                                                                                                    ctx.drawImage(img, 0, 0, width, height);
                                                                                                                    const compressedUrl = canvas.toDataURL('image/jpeg', 0.85);
                                                                                                                    updateItem(section.id, item.id, 'image_url', compressedUrl, true);
                                                                                                                }
                                                                                                            };
                                                                                                            img.src = event.target?.result as string;
                                                                                                        };
                                                                                                        reader.readAsDataURL(file);
                                                                                                    }
                                                                                                }}
                                                                                            />
                                                                                        )}
                                                                                        <div style={{
                                                                                            width: '46px',
                                                                                            height: '46px',
                                                                                            border: '1px solid #cbd5e1',
                                                                                            borderRadius: '6px',
                                                                                            display: 'flex',
                                                                                            flexDirection: 'column',
                                                                                            alignItems: 'center',
                                                                                            justifyContent: 'center',
                                                                                            backgroundColor: 'transparent',
                                                                                            overflow: 'hidden'
                                                                                        }}>
                                                                                            {item.image_url ? (
                                                                                                <img src={item.image_url} alt="Product" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                                            ) : (
                                                                                                <>
                                                                                                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>📷</span>
                                                                                                    <span style={{ fontSize: '7.5px', color: '#94a3b8', marginTop: '1px', fontWeight: 600 }}>Upload</span>
                                                                                                </>
                                                                                            )}
                                                                                        </div>
                                                                                    </label>
                                                                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0, overflow: 'visible' }}>
                                                                                        {!isReadOnly ? (
                                                                                            <div style={{ position: 'relative', width: 'fit-content', maxWidth: '100%' }}>
                                                                                                <button
                                                                                                    type="button"
                                                                                                    onClick={(e) => {
                                                                                                        e.stopPropagation();
                                                                                                        if (activeCategoryDropdownId === item.id) {
                                                                                                            setActiveCategoryDropdownId(null);
                                                                                                        } else {
                                                                                                            setActiveCategoryDropdownId(item.id);
                                                                                                            setCategorySearchQuery('');
                                                                                                        }
                                                                                                    }}
                                                                                                    style={{
                                                                                                        display: 'inline-flex',
                                                                                                        alignItems: 'center',
                                                                                                        gap: '6px',
                                                                                                        padding: '3px 8px',
                                                                                                        borderRadius: '5px',
                                                                                                        border: activeCategoryDropdownId === item.id
                                                                                                            ? '1.5px solid #ea580c'
                                                                                                            : (!item.category ? '1.5px solid #ef4444' : '1px solid #fed7aa'),
                                                                                                        backgroundColor: !item.category ? '#fff1f2' : '#fff7ed',
                                                                                                        color: !item.category ? '#dc2626' : '#ea580c',
                                                                                                        fontWeight: 800,
                                                                                                        fontSize: '0.74rem',
                                                                                                        outline: 'none',
                                                                                                        cursor: 'pointer',
                                                                                                        maxWidth: '100%',
                                                                                                        textAlign: 'left'
                                                                                                    }}
                                                                                                    title={item.category ? `Category: ${item.category} (Mandatory *)` : 'Category is mandatory (*) - please select'}
                                                                                                >
                                                                                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                                                        {item.category ? `🏷️ ${item.category}` : '🏷️ Select Category'}
                                                                                                    </span>
                                                                                                    <span style={{ color: '#ef4444', fontWeight: 900, fontSize: '0.85rem', marginLeft: '-2px' }}>*</span>
                                                                                                    <ChevronDown size={13} style={{ flexShrink: 0, opacity: 0.8 }} />
                                                                                                </button>

                                                                                                {activeCategoryDropdownId === item.id && (
                                                                                                    <div
                                                                                                        onClick={(e) => e.stopPropagation()}
                                                                                                        style={{
                                                                                                            position: 'absolute',
                                                                                                            top: '100%',
                                                                                                            left: 0,
                                                                                                            marginTop: '4px',
                                                                                                            width: '270px',
                                                                                                            backgroundColor: '#ffffff',
                                                                                                            border: '1.5px solid #fca412',
                                                                                                            borderRadius: '8px',
                                                                                                            boxShadow: '0 10px 25px rgba(0,0,0,0.18)',
                                                                                                            maxHeight: '260px',
                                                                                                            overflowY: 'auto',
                                                                                                            zIndex: 999999,
                                                                                                            textAlign: 'left'
                                                                                                        }}
                                                                                                    >
                                                                                                        {/* Search & Custom Input */}
                                                                                                        <div style={{ padding: '6px', borderBottom: '1px solid #fed7aa', backgroundColor: '#fffaf0', position: 'sticky', top: 0, zIndex: 3 }}>
                                                                                                            <input
                                                                                                                type="text"
                                                                                                                value={categorySearchQuery}
                                                                                                                onChange={(e) => setCategorySearchQuery(e.target.value)}
                                                                                                                placeholder="Search or enter category..."
                                                                                                                autoFocus
                                                                                                                style={{
                                                                                                                    width: '100%',
                                                                                                                    padding: '4px 8px',
                                                                                                                    fontSize: '0.76rem',
                                                                                                                    fontWeight: 600,
                                                                                                                    border: '1px solid #fed7aa',
                                                                                                                    borderRadius: '4px',
                                                                                                                    outline: 'none',
                                                                                                                    boxSizing: 'border-box'
                                                                                                                }}
                                                                                                                onKeyDown={(e) => {
                                                                                                                    if (e.key === 'Enter' && categorySearchQuery.trim()) {
                                                                                                                        e.preventDefault();
                                                                                                                        const val = categorySearchQuery.trim();
                                                                                                                        updateItem(section.id, item.id, 'category', val, true);
                                                                                                                        recordCategoryUsage(val);
                                                                                                                        setActiveCategoryDropdownId(null);
                                                                                                                        setCategorySearchQuery('');
                                                                                                                    }
                                                                                                                }}
                                                                                                            />
                                                                                                        </div>

                                                                                                        {/* Custom New Category option if typed */}
                                                                                                        {categorySearchQuery.trim() && !categoryOptions.recents.includes(categorySearchQuery.trim()) && !categoryOptions.standard.includes(categorySearchQuery.trim()) && (
                                                                                                            <div
                                                                                                                onMouseDown={(e) => {
                                                                                                                    e.preventDefault();
                                                                                                                    const val = categorySearchQuery.trim();
                                                                                                                    updateItem(section.id, item.id, 'category', val, true);
                                                                                                                    recordCategoryUsage(val);
                                                                                                                    setActiveCategoryDropdownId(null);
                                                                                                                    setCategorySearchQuery('');
                                                                                                                }}
                                                                                                                style={{
                                                                                                                    padding: '6px 10px',
                                                                                                                    fontSize: '0.78rem',
                                                                                                                    fontWeight: 700,
                                                                                                                    color: '#047857',
                                                                                                                    backgroundColor: '#ecfdf5',
                                                                                                                    cursor: 'pointer',
                                                                                                                    borderBottom: '1px solid #a7f3d0',
                                                                                                                    display: 'flex',
                                                                                                                    alignItems: 'center',
                                                                                                                    gap: '6px'
                                                                                                                }}
                                                                                                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#d1fae5'; }}
                                                                                                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#ecfdf5'; }}
                                                                                                            >
                                                                                                                <Plus size={13} />
                                                                                                                <span>Use "<strong>{categorySearchQuery.trim()}</strong>"</span>
                                                                                                            </div>
                                                                                                        )}

                                                                                                        {(() => {
                                                                                                            const search = categorySearchQuery.trim().toLowerCase();
                                                                                                            const filteredRecents = categoryOptions.recents.filter(c => !search || c.toLowerCase().includes(search));
                                                                                                            const filteredStandard = categoryOptions.standard.filter(c => !search || c.toLowerCase().includes(search));
                                                                                                            const orderedCategories = Array.from(new Set([...filteredRecents, ...filteredStandard]));

                                                                                                            if (orderedCategories.length === 0) {
                                                                                                                return (
                                                                                                                    <div style={{ padding: '12px 10px', fontSize: '0.78rem', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center' }}>
                                                                                                                        No categories found. Press Enter to use "{categorySearchQuery}".
                                                                                                                    </div>
                                                                                                                );
                                                                                                            }

                                                                                                            return orderedCategories.map((cat, idx) => {
                                                                                                                const isSelected = item.category === cat;
                                                                                                                return (
                                                                                                                    <div
                                                                                                                        key={`cat-item-${idx}`}
                                                                                                                        onMouseDown={(e) => {
                                                                                                                            e.preventDefault();
                                                                                                                            updateItem(section.id, item.id, 'category', cat, true);
                                                                                                                            recordCategoryUsage(cat);
                                                                                                                            setActiveCategoryDropdownId(null);
                                                                                                                            setCategorySearchQuery('');
                                                                                                                        }}
                                                                                                                        style={{
                                                                                                                            padding: '6px 10px',
                                                                                                                            fontSize: '0.80rem',
                                                                                                                            fontWeight: isSelected ? 800 : 600,
                                                                                                                            color: isSelected ? '#ea580c' : '#1e293b',
                                                                                                                            backgroundColor: isSelected ? '#fff7ed' : '#ffffff',
                                                                                                                            cursor: 'pointer',
                                                                                                                            borderBottom: '1px solid #f1f5f9',
                                                                                                                            display: 'flex',
                                                                                                                            alignItems: 'center',
                                                                                                                            justifyContent: 'space-between',
                                                                                                                            gap: '8px'
                                                                                                                        }}
                                                                                                                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#ffedd5'; }}
                                                                                                                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = isSelected ? '#fff7ed' : '#ffffff'; }}
                                                                                                                    >
                                                                                                                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                                                                            {cat}
                                                                                                                        </span>
                                                                                                                        <button
                                                                                                                            type="button"
                                                                                                                            title="Delete category"
                                                                                                                            onMouseDown={(e) => {
                                                                                                                                e.preventDefault();
                                                                                                                                e.stopPropagation();
                                                                                                                                removeCategoryOption(cat);
                                                                                                                            }}
                                                                                                                            style={{
                                                                                                                                background: 'transparent',
                                                                                                                                border: 'none',
                                                                                                                                color: '#ef4444',
                                                                                                                                cursor: 'pointer',
                                                                                                                                padding: '2px 5px',
                                                                                                                                borderRadius: '4px',
                                                                                                                                display: 'flex',
                                                                                                                                alignItems: 'center',
                                                                                                                                justifyContent: 'center',
                                                                                                                                opacity: 0.85
                                                                                                                            }}
                                                                                                                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#fee2e2'; e.currentTarget.style.opacity = '1'; }}
                                                                                                                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.opacity = '0.85'; }}
                                                                                                                        >
                                                                                                                            <Trash2 size={12} color="#dc2626" />
                                                                                                                        </button>
                                                                                                                    </div>
                                                                                                                );
                                                                                                            });
                                                                                                        })()}
                                                                                                    </div>
                                                                                                )}
                                                                                            </div>
                                                                                        ) : (
                                                                                            item.category ? (
                                                                                                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#ea580c', backgroundColor: '#fff7ed', padding: '2px 6px', borderRadius: '4px', border: '1px solid #fed7aa', display: 'inline-block', width: 'fit-content' }}>
                                                                                                    {item.category}
                                                                                                </span>
                                                                                            ) : null
                                                                                        )}

                                                                                        {/* Product Heading Input + Custom Interactive Dropdown Menu */}
                                                                                        <div style={{ position: 'relative', width: '100%' }}>
                                                                                            <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                                                                                                <input value={item.particulars}
                                                                                                    placeholder="Product Heading / Name"
                                                                                                    onFocus={() => setActiveHeadingDropdownId(item.id)}
                                                                                                    onChange={(e) => {
                                                                                                        updateItem(section.id, item.id, 'particulars', e.target.value, false);
                                                                                                        setActiveHeadingDropdownId(item.id);
                                                                                                    }}
                                                                                                    onBlur={() => {
                                                                                                        setTimeout(() => setActiveHeadingDropdownId(null), 250);
                                                                                                        updateItem(section.id, item.id, 'particulars', item.particulars, true);
                                                                                                        saveHeadingToPrevious(item.particulars);
                                                                                                    }}
                                                                                                    style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '5px 26px 5px 8px', fontWeight: 800, backgroundColor: '#ffffff', fontSize: '0.88rem', color: '#111827', outline: 'none' }}
                                                                                                />
                                                                                                <button
                                                                                                    type="button"
                                                                                                    tabIndex={-1}
                                                                                                    onClick={(e) => {
                                                                                                        e.stopPropagation();
                                                                                                        setActiveHeadingDropdownId(activeHeadingDropdownId === item.id ? null : item.id);
                                                                                                    }}
                                                                                                    style={{ position: 'absolute', right: '4px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px', color: '#ea580c' }}
                                                                                                    title="Select previous product heading"
                                                                                                >
                                                                                                    <ChevronDown size={16} />
                                                                                                </button>
                                                                                            </div>

                                                                                            {activeHeadingDropdownId === item.id && (
                                                                                                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', backgroundColor: '#ffffff', border: '1.5px solid #fca412', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.18)', maxHeight: '200px', overflowY: 'auto', zIndex: 999999 }}>
                                                                                                    <div style={{ padding: '6px 10px', fontSize: '0.72rem', fontWeight: 800, color: '#ea580c', backgroundColor: '#fff7ed', borderBottom: '1px solid #fed7aa', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                                                        <span>📋 Select Previous Product Heading</span>
                                                                                                        <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600 }}>{allProductHeadings.length} options</span>
                                                                                                    </div>
                                                                                                    {(() => {
                                                                                                        const searchVal = (item.particulars || '').trim().toLowerCase();
                                                                                                        const filtered = allProductHeadings.filter(h => !searchVal || h.toLowerCase().includes(searchVal));
                                                                                                        if (filtered.length === 0) {
                                                                                                            return (
                                                                                                                <div style={{ padding: '10px 12px', fontSize: '0.80rem', color: '#94a3b8', fontStyle: 'italic' }}>
                                                                                                                    No matching previous headings. Type custom heading above.
                                                                                                                </div>
                                                                                                            );
                                                                                                        }
                                                                                                        return filtered.map((heading, hIdx) => (
                                                                                                            <div
                                                                                                                key={hIdx}
                                                                                                                onMouseDown={(e) => {
                                                                                                                    e.preventDefault();
                                                                                                                    updateItem(section.id, item.id, 'particulars', heading, true);
                                                                                                                    saveHeadingToPrevious(heading);
                                                                                                                    setActiveHeadingDropdownId(null);
                                                                                                                }}
                                                                                                                style={{
                                                                                                                    padding: '7px 10px',
                                                                                                                    fontSize: '0.84rem',
                                                                                                                    fontWeight: 700,
                                                                                                                    color: item.particulars === heading ? '#ea580c' : '#1e293b',
                                                                                                                    backgroundColor: item.particulars === heading ? '#fff7ed' : '#ffffff',
                                                                                                                    cursor: 'pointer',
                                                                                                                    borderBottom: '1px solid #f1f5f9',
                                                                                                                    display: 'flex',
                                                                                                                    alignItems: 'center',
                                                                                                                    justifyContent: 'space-between',
                                                                                                                    gap: '8px'
                                                                                                                }}
                                                                                                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#ffedd5'; }}
                                                                                                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = item.particulars === heading ? '#fff7ed' : '#ffffff'; }}
                                                                                                            >
                                                                                                                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                                                                    {heading}
                                                                                                                </span>
                                                                                                                <button
                                                                                                                    type="button"
                                                                                                                    title="Remove from saved headings list"
                                                                                                                    onMouseDown={(e) => {
                                                                                                                        e.preventDefault();
                                                                                                                        e.stopPropagation();
                                                                                                                        removePreviousHeading(heading);
                                                                                                                    }}
                                                                                                                    style={{
                                                                                                                        background: 'transparent',
                                                                                                                        border: 'none',
                                                                                                                        color: '#ef4444',
                                                                                                                        cursor: 'pointer',
                                                                                                                        padding: '2px 5px',
                                                                                                                        borderRadius: '4px',
                                                                                                                        display: 'flex',
                                                                                                                        alignItems: 'center',
                                                                                                                        justifyContent: 'center',
                                                                                                                        opacity: 0.85
                                                                                                                    }}
                                                                                                                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#fee2e2'; e.currentTarget.style.opacity = '1'; }}
                                                                                                                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.opacity = '0.85'; }}
                                                                                                                >
                                                                                                                    <Trash2 size={13} color="#dc2626" />
                                                                                                                </button>
                                                                                                            </div>
                                                                                                        ));
                                                                                                    })()}
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                        <textarea value={item.hsn_sac || ''}
                                                                                            placeholder="Add description / notes..."
                                                                                            onChange={(e) => {
                                                                                                updateItem(section.id, item.id, 'hsn_sac', e.target.value, false);
                                                                                                e.target.style.height = 'auto';
                                                                                                e.target.style.height = Math.max(28, e.target.scrollHeight) + 'px';
                                                                                            }}
                                                                                            onBlur={(e) => updateItem(section.id, item.id, 'hsn_sac', e.target.value, true)}
                                                                                            ref={(el) => {
                                                                                                if (el) {
                                                                                                    el.style.height = 'auto';
                                                                                                    el.style.height = Math.max(28, el.scrollHeight) + 'px';
                                                                                                }
                                                                                            }}
                                                                                            style={{ width: '100%', border: 'none', outline: 'none', fontWeight: 500, backgroundColor: 'transparent', fontSize: '0.80rem', color: '#475569', resize: 'vertical', minHeight: '28px', fontFamily: 'inherit', lineHeight: 1.35, wordBreak: 'break-word', overflowWrap: 'break-word', overflow: 'hidden' }}
                                                                                        />
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </td>

                                                                        {/* Shutter Material Column */}
                                                                        <td style={{ padding: '8px 10px', verticalAlign: 'middle', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #e2e8f0', textAlign: 'center', position: 'relative' }}>
                                                                            {isHeader ? '' : (
                                                                                <div style={{ position: 'relative', width: '100%' }}>
                                                                                    <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                                                                                        <input
                                                                                            value={item.brand || ''}
                                                                                            placeholder="Shutter finish"
                                                                                            onFocus={() => setActiveShutterDropdownId(item.id)}
                                                                                            onChange={(e) => {
                                                                                                updateItem(section.id, item.id, 'brand', e.target.value, false);
                                                                                                setActiveShutterDropdownId(item.id);
                                                                                            }}
                                                                                            onBlur={() => {
                                                                                                setTimeout(() => setActiveShutterDropdownId(null), 250);
                                                                                                updateItem(section.id, item.id, 'brand', item.brand || '', true);
                                                                                                if (item.brand) saveShutterMaterialToPrevious(item.brand);
                                                                                            }}
                                                                                            style={{
                                                                                                width: '100%',
                                                                                                border: '1px solid #cbd5e1',
                                                                                                borderRadius: '6px',
                                                                                                padding: '5px 22px 5px 8px',
                                                                                                backgroundColor: '#ffffff',
                                                                                                fontSize: '0.86rem',
                                                                                                fontWeight: 600,
                                                                                                color: '#1e293b',
                                                                                                outline: 'none',
                                                                                                textAlign: 'left'
                                                                                            }}
                                                                                        />
                                                                                        <button
                                                                                            type="button"
                                                                                            tabIndex={-1}
                                                                                            onClick={(e) => {
                                                                                                e.stopPropagation();
                                                                                                setActiveShutterDropdownId(activeShutterDropdownId === item.id ? null : item.id);
                                                                                            }}
                                                                                            style={{
                                                                                                position: 'absolute',
                                                                                                right: '3px',
                                                                                                background: 'transparent',
                                                                                                border: 'none',
                                                                                                cursor: 'pointer',
                                                                                                display: 'flex',
                                                                                                alignItems: 'center',
                                                                                                padding: '3px',
                                                                                                color: '#ea580c'
                                                                                            }}
                                                                                            title="Select recent or standard shutter finish"
                                                                                        >
                                                                                            <ChevronDown size={15} />
                                                                                        </button>
                                                                                    </div>

                                                                                    {activeShutterDropdownId === item.id && (
                                                                                        <div style={{
                                                                                            position: 'absolute',
                                                                                            top: '100%',
                                                                                            left: 0,
                                                                                            minWidth: '250px',
                                                                                            maxWidth: '340px',
                                                                                            marginTop: '4px',
                                                                                            backgroundColor: '#ffffff',
                                                                                            border: '1.5px solid #fca412',
                                                                                            borderRadius: '8px',
                                                                                            boxShadow: '0 10px 25px rgba(0,0,0,0.18)',
                                                                                            maxHeight: '230px',
                                                                                            overflowY: 'auto',
                                                                                            zIndex: 999999,
                                                                                            textAlign: 'left'
                                                                                        }}>
                                                                                            {(() => {
                                                                                                const searchVal = (item.brand || '').trim().toLowerCase();
                                                                                                const combined = Array.from(new Set([...shutterOptions.recents, ...shutterOptions.standard]));
                                                                                                const filteredOptions = combined.filter(m => !searchVal || m.toLowerCase().includes(searchVal));

                                                                                                if (filteredOptions.length === 0) {
                                                                                                    return (
                                                                                                        <div style={{ padding: '10px 12px', fontSize: '0.80rem', color: '#94a3b8', fontStyle: 'italic' }}>
                                                                                                            No matching finishes. Type custom finish above.
                                                                                                        </div>
                                                                                                    );
                                                                                                }

                                                                                                return filteredOptions.map((mat, mIdx) => (
                                                                                                    <div
                                                                                                        key={`sh-opt-${mIdx}`}
                                                                                                        onMouseDown={(e) => {
                                                                                                            e.preventDefault();
                                                                                                            updateItem(section.id, item.id, 'brand', mat, true);
                                                                                                            saveShutterMaterialToPrevious(mat);
                                                                                                            setActiveShutterDropdownId(null);
                                                                                                        }}
                                                                                                        style={{
                                                                                                            padding: '7px 10px',
                                                                                                            fontSize: '0.82rem',
                                                                                                            fontWeight: item.brand === mat ? 800 : 600,
                                                                                                            color: item.brand === mat ? '#ea580c' : '#1e293b',
                                                                                                            backgroundColor: item.brand === mat ? '#fff7ed' : '#ffffff',
                                                                                                            cursor: 'pointer',
                                                                                                            borderBottom: '1px solid #f1f5f9',
                                                                                                            display: 'flex',
                                                                                                            alignItems: 'center',
                                                                                                            justifyContent: 'space-between',
                                                                                                            gap: '8px'
                                                                                                        }}
                                                                                                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#ffedd5'; }}
                                                                                                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = item.brand === mat ? '#fff7ed' : '#ffffff'; }}
                                                                                                    >
                                                                                                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                                                            {mat}
                                                                                                        </span>
                                                                                                        <button
                                                                                                            type="button"
                                                                                                            title="Delete from list"
                                                                                                            onMouseDown={(e) => {
                                                                                                                e.preventDefault();
                                                                                                                e.stopPropagation();
                                                                                                                removeShutterMaterial(mat);
                                                                                                            }}
                                                                                                            style={{
                                                                                                                background: 'transparent',
                                                                                                                border: 'none',
                                                                                                                color: '#ef4444',
                                                                                                                cursor: 'pointer',
                                                                                                                padding: '2px 5px',
                                                                                                                borderRadius: '4px',
                                                                                                                display: 'flex',
                                                                                                                alignItems: 'center',
                                                                                                                justifyContent: 'center',
                                                                                                                opacity: 0.85
                                                                                                            }}
                                                                                                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#fee2e2'; e.currentTarget.style.opacity = '1'; }}
                                                                                                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.opacity = '0.85'; }}
                                                                                                        >
                                                                                                            <Trash2 size={13} color="#dc2626" />
                                                                                                        </button>
                                                                                                    </div>
                                                                                                ));
                                                                                            })()}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </td>

                                                                        {/* Carcass Material Column */}
                                                                        <td style={{ padding: '8px 10px', verticalAlign: 'middle', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #e2e8f0', textAlign: 'center', position: 'relative' }}>
                                                                            {isHeader ? '' : (
                                                                                <div style={{ position: 'relative', width: '100%' }}>
                                                                                    <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                                                                                        <input
                                                                                            value={item.unit || ''}
                                                                                            placeholder="Carcass finish"
                                                                                            onFocus={() => setActiveCarcassDropdownId(item.id)}
                                                                                            onChange={(e) => {
                                                                                                updateItem(section.id, item.id, 'unit', e.target.value, false);
                                                                                                setActiveCarcassDropdownId(item.id);
                                                                                            }}
                                                                                            onBlur={() => {
                                                                                                setTimeout(() => setActiveCarcassDropdownId(null), 250);
                                                                                                updateItem(section.id, item.id, 'unit', item.unit || '', true);
                                                                                                if (item.unit) saveCarcassMaterialToPrevious(item.unit);
                                                                                            }}
                                                                                            style={{
                                                                                                width: '100%',
                                                                                                border: '1px solid #cbd5e1',
                                                                                                borderRadius: '6px',
                                                                                                padding: '5px 22px 5px 8px',
                                                                                                backgroundColor: '#ffffff',
                                                                                                fontSize: '0.86rem',
                                                                                                fontWeight: 600,
                                                                                                color: '#1e293b',
                                                                                                outline: 'none',
                                                                                                textAlign: 'left'
                                                                                            }}
                                                                                        />
                                                                                        <button
                                                                                            type="button"
                                                                                            tabIndex={-1}
                                                                                            onClick={(e) => {
                                                                                                e.stopPropagation();
                                                                                                setActiveCarcassDropdownId(activeCarcassDropdownId === item.id ? null : item.id);
                                                                                            }}
                                                                                            style={{
                                                                                                position: 'absolute',
                                                                                                right: '3px',
                                                                                                background: 'transparent',
                                                                                                border: 'none',
                                                                                                cursor: 'pointer',
                                                                                                display: 'flex',
                                                                                                alignItems: 'center',
                                                                                                padding: '3px',
                                                                                                color: '#ea580c'
                                                                                            }}
                                                                                            title="Select recent or standard carcass material/color"
                                                                                        >
                                                                                            <ChevronDown size={15} />
                                                                                        </button>
                                                                                    </div>

                                                                                    {activeCarcassDropdownId === item.id && (
                                                                                        <div style={{
                                                                                            position: 'absolute',
                                                                                            top: '100%',
                                                                                            left: 0,
                                                                                            minWidth: '250px',
                                                                                            maxWidth: '340px',
                                                                                            marginTop: '4px',
                                                                                            backgroundColor: '#ffffff',
                                                                                            border: '1.5px solid #fca412',
                                                                                            borderRadius: '8px',
                                                                                            boxShadow: '0 10px 25px rgba(0,0,0,0.18)',
                                                                                            maxHeight: '230px',
                                                                                            overflowY: 'auto',
                                                                                            zIndex: 999999,
                                                                                            textAlign: 'left'
                                                                                        }}>
                                                                                            {(() => {
                                                                                                const searchVal = (item.unit || '').trim().toLowerCase();
                                                                                                const combined = Array.from(new Set([...carcassOptions.recents, ...carcassOptions.standard]));
                                                                                                const filteredOptions = combined.filter(m => !searchVal || m.toLowerCase().includes(searchVal));

                                                                                                if (filteredOptions.length === 0) {
                                                                                                    return (
                                                                                                        <div style={{ padding: '10px 12px', fontSize: '0.80rem', color: '#94a3b8', fontStyle: 'italic' }}>
                                                                                                            No matching materials. Type custom finish above.
                                                                                                        </div>
                                                                                                    );
                                                                                                }

                                                                                                return filteredOptions.map((mat, mIdx) => (
                                                                                                    <div
                                                                                                        key={`car-opt-${mIdx}`}
                                                                                                        onMouseDown={(e) => {
                                                                                                            e.preventDefault();
                                                                                                            updateItem(section.id, item.id, 'unit', mat, true);
                                                                                                            saveCarcassMaterialToPrevious(mat);
                                                                                                            setActiveCarcassDropdownId(null);
                                                                                                        }}
                                                                                                        style={{
                                                                                                            padding: '7px 10px',
                                                                                                            fontSize: '0.82rem',
                                                                                                            fontWeight: item.unit === mat ? 800 : 600,
                                                                                                            color: item.unit === mat ? '#ea580c' : '#1e293b',
                                                                                                            backgroundColor: item.unit === mat ? '#fff7ed' : '#ffffff',
                                                                                                            cursor: 'pointer',
                                                                                                            borderBottom: '1px solid #f1f5f9',
                                                                                                            display: 'flex',
                                                                                                            alignItems: 'center',
                                                                                                            justifyContent: 'space-between',
                                                                                                            gap: '8px'
                                                                                                        }}
                                                                                                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#ffedd5'; }}
                                                                                                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = item.unit === mat ? '#fff7ed' : '#ffffff'; }}
                                                                                                    >
                                                                                                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                                                            {mat}
                                                                                                        </span>
                                                                                                        <button
                                                                                                            type="button"
                                                                                                            title="Delete from list"
                                                                                                            onMouseDown={(e) => {
                                                                                                                e.preventDefault();
                                                                                                                e.stopPropagation();
                                                                                                                removeCarcassMaterial(mat);
                                                                                                            }}
                                                                                                            style={{
                                                                                                                background: 'transparent',
                                                                                                                border: 'none',
                                                                                                                color: '#ef4444',
                                                                                                                cursor: 'pointer',
                                                                                                                padding: '2px 5px',
                                                                                                                borderRadius: '4px',
                                                                                                                display: 'flex',
                                                                                                                alignItems: 'center',
                                                                                                                justifyContent: 'center',
                                                                                                                opacity: 0.85
                                                                                                            }}
                                                                                                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#fee2e2'; e.currentTarget.style.opacity = '1'; }}
                                                                                                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.opacity = '0.85'; }}
                                                                                                        >
                                                                                                            <Trash2 size={13} color="#dc2626" />
                                                                                                        </button>
                                                                                                    </div>
                                                                                                ));
                                                                                            })()}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </td>

                                                                        {/* Dimensions Column (Width, Height, Depth inputs OR Lumpsum Amount input) */}
                                                                        <td style={{ padding: '6px 8px', verticalAlign: 'middle', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #e2e8f0', minWidth: '150px' }}>
                                                                            {isHeader ? '' : (() => {
                                                                                const isLumpsumItem = item.pricing_mode === 'lumpsum';
                                                                                const lumpsumVal = parseFloat(String(item.rate)) || parseFloat(String(item.amount)) || 0;
                                                                                return (
                                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
                                                                                        {!isReadOnly && (
                                                                                            <div className="no-print" style={{ marginBottom: '2px' }}>
                                                                                                <select
                                                                                                    value={isLumpsumItem ? 'lumpsum' : 'dimensions'}
                                                                                                    onChange={(e) => updateItem(section.id, item.id, 'pricing_mode', e.target.value, true)}
                                                                                                    style={{
                                                                                                        width: '100%',
                                                                                                        padding: '3px 6px',
                                                                                                        borderRadius: '5px',
                                                                                                        border: '1px solid #cbd5e1',
                                                                                                        fontSize: '0.72rem',
                                                                                                        fontWeight: 800,
                                                                                                        backgroundColor: isLumpsumItem ? '#f0fdf4' : '#ffffff',
                                                                                                        color: isLumpsumItem ? '#16a34a' : '#0f172a',
                                                                                                        outline: 'none',
                                                                                                        cursor: 'pointer'
                                                                                                    }}
                                                                                                >
                                                                                                    <option value="dimensions">📐 (W × H × D) (mm)</option>
                                                                                                    <option value="lumpsum">💰 Lumpsum Amount</option>
                                                                                                </select>
                                                                                            </div>
                                                                                        )}

                                                                                        {isLumpsumItem ? (
                                                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', textAlign: 'center' }}>
                                                                                                <span style={{ fontSize: '0.80rem', color: '#16a34a', fontWeight: 800 }}>
                                                                                                    Lumpsum: ₹{lumpsumVal.toLocaleString()}
                                                                                                </span>
                                                                                                {!isReadOnly && (
                                                                                                    <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                                                                                        <span style={{ fontSize: '0.78rem', color: '#16a34a', fontWeight: 800 }}>₹</span>
                                                                                                        <input
                                                                                                            type="number"
                                                                                                            value={item.rate || ''}
                                                                                                            placeholder="0"
                                                                                                            title="Lumpsum Amount (₹)"
                                                                                                            onFocus={(e) => { if (e.target.value === '0') e.target.select(); }}
                                                                                                            onChange={(e) => updateItem(section.id, item.id, 'rate', parseFloat(e.target.value) || 0, false)}
                                                                                                            onBlur={(e) => updateItem(section.id, item.id, 'rate', parseFloat(e.target.value) || 0, true)}
                                                                                                            onWheel={(e) => (e.target as HTMLElement).blur()}
                                                                                                            style={{
                                                                                                                width: '100%',
                                                                                                                padding: '4px 6px',
                                                                                                                borderRadius: '5px',
                                                                                                                border: '1.5px solid #16a34a',
                                                                                                                textAlign: 'center',
                                                                                                                outline: 'none',
                                                                                                                fontSize: '0.86rem',
                                                                                                                fontWeight: 800,
                                                                                                                color: '#16a34a',
                                                                                                                backgroundColor: '#f0fdf4'
                                                                                                            }}
                                                                                                        />
                                                                                                    </div>
                                                                                                )}
                                                                                            </div>
                                                                                        ) : (
                                                                                            <>
                                                                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                                                                                                    <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>Width:</span>
                                                                                                    <input value={item.width || ''} placeholder="0" title="Width in mm"
                                                                                                        onFocus={(e) => { if (e.target.value === '0') e.target.select(); }}
                                                                                                        onChange={(e) => updateItem(section.id, item.id, 'width', e.target.value, false)}
                                                                                                        onBlur={(e) => updateItem(section.id, item.id, 'width', e.target.value, true)}
                                                                                                        style={{ width: '58px', border: '1px solid #cbd5e1', borderRadius: '4px', textAlign: 'center', outline: 'none', fontSize: '0.80rem', padding: '3px 4px', fontWeight: 600, color: '#111827', backgroundColor: 'transparent' }}
                                                                                                    />
                                                                                                </div>
                                                                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                                                                                                    <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>Height:</span>
                                                                                                    <input value={item.height || ''} placeholder="0" title="Height in mm"
                                                                                                        onFocus={(e) => { if (e.target.value === '0') e.target.select(); }}
                                                                                                        onChange={(e) => updateItem(section.id, item.id, 'height', e.target.value, false)}
                                                                                                        onBlur={(e) => updateItem(section.id, item.id, 'height', e.target.value, true)}
                                                                                                        style={{ width: '58px', border: '1px solid #cbd5e1', borderRadius: '4px', textAlign: 'center', outline: 'none', fontSize: '0.80rem', padding: '3px 4px', fontWeight: 600, color: '#111827', backgroundColor: 'transparent' }}
                                                                                                    />
                                                                                                </div>
                                                                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                                                                                                    <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>Depth:</span>
                                                                                                    <input value={item.sft || ''} placeholder="0" title="Depth in mm"
                                                                                                        onFocus={(e) => { if (e.target.value === '0') e.target.select(); }}
                                                                                                        onChange={(e) => updateItem(section.id, item.id, 'sft', e.target.value, false)}
                                                                                                        onBlur={(e) => updateItem(section.id, item.id, 'sft', e.target.value, true)}
                                                                                                        style={{ width: '58px', border: '1px solid #cbd5e1', borderRadius: '4px', textAlign: 'center', outline: 'none', fontSize: '0.80rem', padding: '3px 4px', fontWeight: 600, color: '#111827', backgroundColor: 'transparent' }}
                                                                                                    />
                                                                                                </div>

                                                                                                {/* Formula Answer (Sqft) Badge */}
                                                                                                {(() => {
                                                                                                    const sqftVal = computeSqft(item.width, item.height, item.sft);
                                                                                                    return sqftVal > 0 ? (
                                                                                                        <div style={{ textAlign: 'center', marginTop: '2px' }}>
                                                                                                            <span style={{ fontSize: '0.72rem', color: '#ea580c', fontWeight: 800, backgroundColor: '#fff7ed', padding: '2px 8px', borderRadius: '4px', border: '1px solid #fed7aa', display: 'inline-block', maxWidth: '100%', wordBreak: 'break-all' }} title={`Exact SFT: ${Number(sqftVal.toFixed(2))}`}>
                                                                                                                {Number(sqftVal.toFixed(2))} SFT
                                                                                                            </span>
                                                                                                        </div>
                                                                                                    ) : null;
                                                                                                })()}
                                                                                            </>
                                                                                        )}
                                                                                    </div>
                                                                                );
                                                                            })()}
                                                                        </td>

                                                                        {/* Rate Column */}
                                                                        <td style={{ padding: '10px 6px', textAlign: 'center', verticalAlign: 'middle', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #e2e8f0' }}>
                                                                            {isHeader ? '' : (
                                                                                (item.pricing_mode === 'lumpsum') ? (
                                                                                    <span style={{ fontSize: '0.90rem', color: '#94a3b8', fontWeight: 700 }}>—</span>
                                                                                ) : (
                                                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                                                                                        <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700 }}>₹</span>
                                                                                        <input
                                                                                            type="number"
                                                                                            value={item.rate_per_sft || ''}
                                                                                            placeholder="0"
                                                                                            title="Cost per SFT (₹)"
                                                                                            onFocus={(e) => { if (e.target.value === '0') e.target.select(); }}
                                                                                            onChange={(e) => updateItem(section.id, item.id, 'rate_per_sft', parseFloat(e.target.value) || 0, false)}
                                                                                            onBlur={(e) => updateItem(section.id, item.id, 'rate_per_sft', parseFloat(e.target.value) || 0, true)}
                                                                                            onWheel={(e) => (e.target as HTMLElement).blur()}
                                                                                            style={{ width: '60px', border: '1px solid #cbd5e1', borderRadius: '5px', textAlign: 'center', outline: 'none', fontSize: '0.84rem', padding: '4px 2px', fontWeight: 700, color: '#0f172a', backgroundColor: '#ffffff', boxSizing: 'border-box' }}
                                                                                        />
                                                                                    </div>
                                                                                )
                                                                            )}
                                                                        </td>

                                                                        {/* QTY Column */}
                                                                        <td style={{ padding: '8px 6px', textAlign: 'center', verticalAlign: 'middle', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #e2e8f0' }}>
                                                                            {isHeader ? '' : (
                                                                                <input type="number"
                                                                                    value={item.quantity === undefined || item.quantity === null ? '' : item.quantity}
                                                                                    placeholder="1"
                                                                                    title="Quantity"
                                                                                    onChange={(e) => updateItem(section.id, item.id, 'quantity', e.target.value === '' ? '' : parseFloat(e.target.value) || 0, false)}
                                                                                    onBlur={(e) => {
                                                                                        const val = e.target.value === '' || parseFloat(e.target.value) <= 0 ? 1 : parseFloat(e.target.value) || 1;
                                                                                        updateItem(section.id, item.id, 'quantity', val, true);
                                                                                    }}
                                                                                    onWheel={(e) => (e.target as HTMLElement).blur()}
                                                                                    style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '5px', textAlign: 'center', outline: 'none', backgroundColor: '#ffffff', fontSize: '0.88rem', fontWeight: 700, color: '#111827', padding: '4px 2px', boxSizing: 'border-box' }}
                                                                                />
                                                                            )}
                                                                        </td>


                                                                        {/* GST % Column (Editable Input with previous entered GST rates + compact dropdown) */}
                                                                        <td style={{ padding: '8px 4px', textAlign: 'center', verticalAlign: 'middle', borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #e2e8f0', position: 'relative' }}>
                                                                            {isHeader ? '' : (() => {
                                                                                const currentGst = item.gst_rate !== undefined && item.gst_rate !== null && String(item.gst_rate).trim() !== ''
                                                                                    ? item.gst_rate
                                                                                    : 18;
                                                                                const isOpen = openGstMenuId === item.id;
                                                                                return (
                                                                                    <div className="gst-dropdown-container" style={{ position: 'relative', width: '100%', minWidth: '55px', maxWidth: '65px', margin: '0 auto' }}>
                                                                                        <div style={{
                                                                                            display: 'flex',
                                                                                            alignItems: 'center',
                                                                                            width: '100%',
                                                                                            border: isOpen ? '1.5px solid #ea580c' : '1px solid #cbd5e1',
                                                                                            borderRadius: '5px',
                                                                                            backgroundColor: '#ffffff',
                                                                                            boxShadow: isOpen ? '0 0 0 2px rgba(234, 88, 12, 0.15)' : 'none',
                                                                                            transition: 'all 0.15s ease'
                                                                                        }}>
                                                                                            <input
                                                                                                type="text"
                                                                                                inputMode="decimal"
                                                                                                value={item.gst_rate === undefined || item.gst_rate === null ? '' : item.gst_rate}
                                                                                                placeholder="18"
                                                                                                title="Enter GST % or click arrow to pick from list"
                                                                                                onFocus={() => setOpenGstMenuId(item.id)}
                                                                                                onChange={(e) => {
                                                                                                    const raw = e.target.value;
                                                                                                    if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
                                                                                                        updateItem(section.id, item.id, 'gst_rate', raw as any, false);
                                                                                                    }
                                                                                                }}
                                                                                                onBlur={(e) => {
                                                                                                    const raw = String(e.target.value ?? '').trim();
                                                                                                    if (raw === '') {
                                                                        updateItem(section.id, item.id, 'gst_rate', 0, true);
                                                                    } else {
                                                                        const parsed = parseFloat(raw);
                                                                        updateItem(section.id, item.id, 'gst_rate', isNaN(parsed) ? 0 : Math.min(100, Math.max(0, parsed)), true);
                                                                    }
                                                                                                }}
                                                                                                style={{
                                                                                                    width: '100%',
                                                                                                    border: 'none',
                                                                                                    textAlign: 'center',
                                                                                                    outline: 'none',
                                                                                                    backgroundColor: 'transparent',
                                                                                                    fontSize: '0.84rem',
                                                                                                    fontWeight: 700,
                                                                                                    color: '#475569',
                                                                                                    padding: '4px 1px 4px 4px',
                                                                                                    boxSizing: 'border-box'
                                                                                                }}
                                                                                            />
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={(e) => {
                                                                                                    e.stopPropagation();
                                                                                                    setOpenGstMenuId(isOpen ? null : item.id);
                                                                                                }}
                                                                                                title="Pick GST %"
                                                                                                style={{
                                                                                                    border: 'none',
                                                                                                    background: 'transparent',
                                                                                                    cursor: 'pointer',
                                                                                                    padding: '4px 3px 4px 0',
                                                                                                    display: 'flex',
                                                                                                    alignItems: 'center',
                                                                                                    justifyContent: 'center',
                                                                                                    color: isOpen ? '#ea580c' : '#94a3b8'
                                                                                                }}
                                                                                            >
                                                                                                <ChevronDown size={12} />
                                                                                            </button>
                                                                                        </div>

                                                                                        {isOpen && (
                                                                                            <div
                                                                                                onMouseDown={(e) => e.preventDefault()}
                                                                                                style={{
                                                                                                    position: 'absolute',
                                                                                                    top: 'calc(100% + 2px)',
                                                                                                    left: '50%',
                                                                                                    transform: 'translateX(-50%)',
                                                                                                    width: '65px',
                                                                                                    backgroundColor: '#ffffff',
                                                                                                    border: '1.5px solid #fed7aa',
                                                                                                    borderRadius: '6px',
                                                                                                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.18)',
                                                                                                    zIndex: 99999,
                                                                                                    maxHeight: '160px',
                                                                                                    overflowY: 'auto',
                                                                                                    padding: '2px 0',
                                                                                                    textAlign: 'center'
                                                                                                }}>
                                                                                                {gstOptions.map(rate => {
                                                                                                    const isSelected = (parseFloat(String(currentGst)) || 0) === rate;
                                                                                                    return (
                                                                                                        <div
                                                                                                            key={rate}
                                                                                                            onClick={(e) => {
                                                                                                                e.stopPropagation();
                                                                                                                updateItem(section.id, item.id, 'gst_rate', rate, true);
                                                                                                                setOpenGstMenuId(null);
                                                                                                            }}
                                                                                                            style={{
                                                                                                                padding: '5px 2px',
                                                                                                                fontSize: '0.80rem',
                                                                                                                fontWeight: isSelected ? 800 : (rate === 18 ? 700 : 500),
                                                                                                                color: isSelected ? '#ea580c' : '#1e293b',
                                                                                                                backgroundColor: isSelected ? '#ffedd5' : 'transparent',
                                                                                                                cursor: 'pointer',
                                                                                                                borderBottom: '1px solid #f8fafc'
                                                                                                            }}
                                                                                                            onMouseEnter={(e) => {
                                                                                                                if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = '#fff7ed';
                                                                                                            }}
                                                                                                            onMouseLeave={(e) => {
                                                                                                                if (!isSelected) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                                                                                                            }}
                                                                                                        >
                                                                                                            {rate}%
                                                                                                        </div>
                                                                                                    );
                                                                                                })}
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                );
                                                                            })()}
                                                                        </td>

                                                                        {/* Amount Column */}
                                                                        <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: '#111827', verticalAlign: 'middle', fontSize: '0.90rem', borderBottom: '1px solid #f3f4f6' }}>
                                                                            {isHeader ? (() => {
                                                                                let subTotal = 0;
                                                                                for (let k = iIdx + 1; k < section.items.length; k++) {
                                                                                    if (section.items[k].brand === 'HEADER') break;
                                                                                    subTotal += (parseFloat(String(section.items[k].amount)) || 0);
                                                                                }
                                                                                return <span style={{ color: '#ea580c', fontWeight: 900, fontSize: '0.90rem' }}>₹{subTotal.toLocaleString('en-IN')}</span>;
                                                                            })() : `₹${(item.amount || 0).toLocaleString()}`}
                                                                        </td>

                                                                        {/* Item Action Column: 3-Dot Dropdown Menu */}
                                                                        {!isLocked && (
                                                                            <td className="quote-item-menu-container" style={{ padding: '8px 4px', textAlign: 'center', verticalAlign: 'middle', position: 'relative', borderBottom: '1px solid #f3f4f6' }}>
                                                                                {openItemMenuId === item.id && (
                                                                                    <div
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            setOpenItemMenuId(null);
                                                                                        }}
                                                                                        style={{
                                                                                            position: 'fixed',
                                                                                            top: 0,
                                                                                            left: 0,
                                                                                            right: 0,
                                                                                            bottom: 0,
                                                                                            zIndex: 99990,
                                                                                            background: 'transparent'
                                                                                        }}
                                                                                    />
                                                                                )}
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        setOpenItemMenuId(openItemMenuId === item.id ? null : item.id);
                                                                                    }}
                                                                                    title="Item Actions"
                                                                                    style={{
                                                                                        background: openItemMenuId === item.id ? '#eff6ff' : 'none',
                                                                                        border: openItemMenuId === item.id ? '1.5px solid #2563eb' : 'none',
                                                                                        borderRadius: '6px',
                                                                                        cursor: 'pointer',
                                                                                        color: openItemMenuId === item.id ? '#2563eb' : '#64748b',
                                                                                        padding: '4px',
                                                                                        display: 'flex',
                                                                                        alignItems: 'center',
                                                                                        margin: '0 auto',
                                                                                        boxShadow: openItemMenuId === item.id ? '0 0 0 3px rgba(37, 99, 235, 0.15)' : 'none',
                                                                                        transition: 'all 0.15s ease',
                                                                                        position: 'relative',
                                                                                        zIndex: openItemMenuId === item.id ? 99995 : 1
                                                                                    }}
                                                                                >
                                                                                    <MoreVertical size={16} color={openItemMenuId === item.id ? '#2563eb' : '#64748b'} />
                                                                                </button>
                                                                                {openItemMenuId === item.id && (
                                                                                    <div
                                                                                        onClick={(e) => e.stopPropagation()}
                                                                                        style={{
                                                                                            position: 'absolute',
                                                                                            right: '6px',
                                                                                            top: '100%',
                                                                                            zIndex: 99999,
                                                                                            backgroundColor: '#ffffff',
                                                                                            border: '1.5px solid rgb(251, 158, 20)',
                                                                                            borderRadius: '8px',
                                                                                            boxShadow: '0 12px 28px rgba(0, 0, 0, 0.25)',
                                                                                            minWidth: '165px',
                                                                                            padding: '4px 0',
                                                                                            textAlign: 'left'
                                                                                        }}>
                                                                                        <button
                                                                                            onClick={() => { addItem(section.id, false, item.id); setOpenItemMenuId(null); }}
                                                                                            style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '7px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.82rem', color: '#16a34a', fontWeight: 600 }}
                                                                                        >
                                                                                            <PlusCircle size={15} /> Add Item Below
                                                                                        </button>
                                                                                        <button
                                                                                            onClick={() => { moveItemUp(section.id, item.id); setOpenItemMenuId(null); }}
                                                                                            style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '7px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.82rem', color: '#3b82f6', fontWeight: 600 }}
                                                                                        >
                                                                                            <MoveUp size={15} /> Move Up
                                                                                        </button>
                                                                                        <button
                                                                                            onClick={() => { moveItemDown(section.id, item.id); setOpenItemMenuId(null); }}
                                                                                            style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '7px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.82rem', color: '#3b82f6', fontWeight: 600 }}
                                                                                        >
                                                                                            <MoveDown size={15} /> Move Down
                                                                                        </button>
                                                                                        <button
                                                                                            onClick={() => { duplicateItem(section.id, item.id); setOpenItemMenuId(null); }}
                                                                                            style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '7px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.82rem', color: '#7c3aed', fontWeight: 600 }}
                                                                                        >
                                                                                            <Copy size={15} /> Duplicate Item
                                                                                        </button>
                                                                                        <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '4px 0' }} />
                                                                                        <button
                                                                                            onClick={() => { deleteItem(section.id, item.id); setOpenItemMenuId(null); }}
                                                                                            style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '7px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.82rem', color: '#dc2626', fontWeight: 600 }}
                                                                                        >
                                                                                            <Trash2 size={15} /> Delete Item
                                                                                        </button>
                                                                                    </div>
                                                                                )}
                                                                            </td>
                                                                        )}
                                                                    </tr>
                                                                );
                                                            });
                                                        })()}
                                                    </tbody>
                                                </table>

                                                {/* Add Item / Add Sub Title action bar */}
                                                {!isLocked && (
                                                    <div className="no-print" style={{ display: 'flex', justifyContent: 'center', gap: '20px', padding: '14px 0', backgroundColor: '#fff7ed', borderTop: '1px solid #fed7aa' }}>
                                                        <button onClick={() => addItem(section.id)} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.84rem', fontWeight: 700, color: '#16a34a' }}>
                                                            <PlusCircle size={16} /> Add Item
                                                        </button>
                                                        <button onClick={() => addItem(section.id, true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.84rem', fontWeight: 700, color: '#ea580c' }}>
                                                            <Heading size={16} /> Add Sub Title
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* + Add New Module button */}
                    {!isLocked && (
                        <div className="no-print" style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
                            <button onClick={addSection} style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                padding: '9px 22px',
                                backgroundColor: '#fca412', color: '#ffffff',
                                border: 'none', borderRadius: '8px',
                                fontWeight: 800, fontSize: '0.88rem',
                                cursor: 'pointer',
                                boxShadow: '0 2px 6px rgba(252, 164, 18, 0.25)',
                                transition: 'all 0.15s'
                            }}>
                                <PlusCircle size={16} /> + Add New Module
                            </button>
                        </div>
                    )}


                </div>
            )}



            {/* =============================================================== */}
            {/* PRINT-ONLY / AGREEMENT PDF LAYOUT                               */}
            {/* =============================================================== */}
            {(() => {
                const subTotal = sections.reduce((acc, sec) => acc + (sec.items || []).reduce((iAcc, item) => iAcc + (item.amount || ((item.quantity || 0) * (item.rate || 0))), 0), 0);
                const discountAmt = (subTotal * discountPercent) / 100;
                const taxableAmt = subTotal - discountAmt;
                const gstTotal = gstEnabled ? taxableAmt * 0.18 : 0;
                const finalGrandTotal = getRoundedTotal(taxableAmt + gstTotal);

                return (
                    <div className={isAgreementPdfView ? "agreement-quote-pdf-layout" : "print-only"} style={{ fontFamily: "'Outfit', 'Plus Jakarta Sans', 'Inter', system-ui, -apple-system, sans-serif", color: '#0f172a', backgroundColor: '#ffffff' }}>
                        <style dangerouslySetInnerHTML={{
                            __html: `
                            .agreement-quote-pdf-layout {
                                font-family: 'Outfit', 'Plus Jakarta Sans', 'Inter', system-ui, -apple-system, sans-serif !important;
                            }
                            .agreement-quote-pdf-layout table {
                                table-layout: fixed !important;
                                width: 100% !important;
                                border-collapse: collapse !important;
                            }
                            .agreement-quote-pdf-layout tr {
                                page-break-inside: avoid !important;
                                break-inside: avoid !important;
                            }
                            .agreement-quote-pdf-layout td {
                                vertical-align: top !important;
                                line-height: 1.4 !important;
                                word-break: break-word !important;
                                overflow-wrap: break-word !important;
                                white-space: normal !important;
                                padding: 8px 6px !important;
                                height: auto !important;
                                min-height: auto !important;
                            }
                            .agreement-quote-pdf-layout th {
                                vertical-align: middle !important;
                                line-height: 1.3 !important;
                                word-break: break-word !important;
                                overflow-wrap: break-word !important;
                                white-space: normal !important;
                                padding: 10px 6px !important;
                                height: auto !important;
                            }
                            .agreement-quote-pdf-layout img {
                                max-width: 40px !important;
                                max-height: 40px !important;
                            }
                            ` }} />

                        {/* ===== PAGE 1: COVER PAGE ===== */}
                        {showCoverPage && (
                            <>
                                <div className="page-break-cover" style={{
                                    minHeight: '270mm',
                                    backgroundColor: '#ffffff',
                                    padding: '16px 12px 20px 12px',
                                    position: 'relative',
                                    boxSizing: 'border-box'
                                }}>
                                    <table style={{ width: '100%', height: '100%', minHeight: '250mm', borderCollapse: 'collapse' }}>
                                        <tbody>
                                            {/* Row 1: Top Header */}
                                            <tr>
                                                <td style={{ verticalAlign: 'top', border: 'none', padding: 0 }}>
                                                    <table style={{ width: '100%', borderCollapse: 'collapse', borderBottom: '2.5px solid #ea580c', paddingBottom: '14px', marginBottom: '0px' }}>
                                                        <tbody>
                                                            <tr>
                                                                <td style={{ width: '50%', verticalAlign: 'middle', border: 'none', padding: 0 }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                                                        <img src={OfficialLogo} onError={(e) => { e.currentTarget.src = ArkLogo; }} alt="Logo" style={{ height: '50px', objectFit: 'contain' }} />
                                                                        <div>
                                                                            <div style={{ fontSize: '15pt', fontWeight: 900, color: '#000000', marginBottom: '2px', whiteSpace: 'nowrap' }}>Livincart Private Limited</div>
                                                                            <div style={{ fontSize: '8pt', color: '#64748b', fontWeight: 500, whiteSpace: 'nowrap' }}>Official Quotation &amp; Estimation Workspace</div>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td style={{ width: '50%', verticalAlign: 'middle', textAlign: 'right', border: 'none', padding: 0 }}>
                                                                    <div style={{ fontSize: '9.5pt', fontWeight: 900, color: '#000000', marginBottom: '4px' }}>LIVINCART AND SERVICES PRIVATE LIMITED</div>
                                                                    <div style={{ fontSize: '7.5pt', color: '#475569', fontWeight: 600, marginTop: '2px', lineHeight: '1.4' }}>
                                                                        <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNlYTU4MGMiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMjEgMTBjMCA3LTkgMTMtOSAxM3MtOS02LTktMTNhOSA5IDAgMSAxIDE4IDB6Ii8+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMCIgcj0iMyIvPjwvc3ZnPg==" alt="" style={{ width: '10px', height: '10px', verticalAlign: '-1px', marginRight: '4px', display: 'inline-block' }} />
                                                                        Visakhapatnam, Andhra Pradesh – 530020
                                                                    </div>
                                                                    <div style={{ fontSize: '7.5pt', color: '#475569', fontWeight: 600, marginTop: '2px', lineHeight: '1.4' }}>
                                                                        <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNlYTU4MGMiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMjIgMTYuOTJ2M2EyIDIgMCAwIDEtMi4xOCAyIDE5Ljc5IDE5Ljc5IDAgMCAxLTguNjMtMy4wNyAxOS41IDE5LjUgMCAwIDEtNi02IDE5Ljc5IDE5Ljc5IDAgMCAxLTMuMDctOC42N0EyIDIgMCAwIDEgNC4xMSAyMmgzYTIgMiAwIDAgMSAyIDEuNzIgMTIuODQgMTIuODQgMCAwIDAgLjcgMi44MSAyIDIgMCAwIDEtLjQ1IDIuMTFMOC4wOSA5LjkxYTE2IDE2IDAgMCAwIDYgNmwxLjI3LTEuMjdhMiAyIDAgMCAxIDIuMTEtLjQ1IDEyLjg0IDEyLjg0IDAgMCAwIDIuODEuN0EyIDIgMCAwIDEgMjIgMTYuOTJ6Ii8+PC9zdmc+" alt="" style={{ width: '10px', height: '10px', verticalAlign: '-1px', marginRight: '4px', display: 'inline-block' }} />
                                                                        +91 7702312351
                                                                    </div>
                                                                    <div style={{ fontSize: '7.5pt', color: '#475569', fontWeight: 600, marginTop: '2px', lineHeight: '1.4' }}>
                                                                        <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNlYTU4MGMiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cG9seWxpbmUgcG9pbnRzPSIyMiw2IDEyLDEzIDIsNiIvPjwvc3ZnPg==" alt="" style={{ width: '10px', height: '10px', verticalAlign: '-1px', marginRight: '4px', display: 'inline-block' }} />
                                                                        contact@livincart.com &nbsp;&nbsp;
                                                                        <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMwMjg4YzciIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMCIvPjxsaW5lIHgxPSIyIiB5MT0iMTIiIHgyPSIyMiIgeTI9IjEyIi8+PHBhdGggZD0iTTEyIDJhMTUuMyAxNS43IDAgMCAxIDQgMTAgMTUuMyAxNS43IDAgMCAxLTQgMTAgMTUuMyAxNS43IDAgMCAxLTQtMTAgMTUuMyAxNS43IDAgMCAxIDQtMTB6Ii8+PC9zdmc+" alt="" style={{ width: '10px', height: '10px', verticalAlign: '-1px', marginRight: '4px', display: 'inline-block' }} />
                                                                        www.livincart.com
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </td>
                                            </tr>

                                            {/* Row 2: Top Spacer (220px) */}
                                            <tr style={{ height: '220px' }}>
                                                <td style={{ height: '220px', border: 'none', padding: 0 }}>&nbsp;</td>
                                            </tr>

                                            {/* Row 3: Center Hero Content */}
                                            <tr>
                                                <td style={{ verticalAlign: 'middle', border: 'none', padding: 0, textAlign: 'center' }}>
                                                    <center>
                                                        <table align="center" style={{ width: '100%', borderCollapse: 'collapse', margin: '0 auto', marginLeft: 'auto', marginRight: 'auto' }}>
                                                            <tbody>
                                                                <tr>
                                                                    <td align="center" style={{ textAlign: 'center', verticalAlign: 'middle', border: 'none', width: '100%' }}>
                                                                        <div style={{ textAlign: 'center', width: '100%', margin: '0 auto' }}>
                                                                            <img src={OfficialLogo} onError={(e) => { e.currentTarget.src = ArkLogo; }} alt="Logo Center" style={{ height: '80px', objectFit: 'contain', marginBottom: '16px', display: 'inline-block', margin: '0 auto' }} />
                                                                        </div>
                                                                        <div style={{ fontSize: '13pt', fontWeight: 900, color: '#000000', marginBottom: '10px', textAlign: 'center', width: '100%' }}>LIVINCART AND SERVICES PRIVATE LIMITED</div>
                                                                        <div style={{ width: '160px', height: '0px', borderBottom: '3.5px solid #ea580c', margin: '10px auto 26px', marginLeft: 'auto', marginRight: 'auto' }} />

                                                                        <h1 style={{ margin: 0, fontSize: '22pt', fontWeight: 900, color: '#000000', textAlign: 'center', width: '100%' }}>OFFICIAL QUOTATION &amp;</h1>
                                                                        <h1 style={{ margin: '6px 0 0 0', fontSize: '24pt', fontWeight: 900, color: '#ea580c', textAlign: 'center', width: '100%' }}>PROJECT ESTIMATE</h1>
                                                                        <div style={{ width: '200px', height: '0px', borderBottom: '3.5px solid #ea580c', margin: '14px auto 30px', marginLeft: 'auto', marginRight: 'auto' }} />

                                                                        {/* Quote Details Box */}
                                                                        <table className="quote-header-details-table" align="center" style={{ margin: '0 auto', marginLeft: 'auto', marginRight: 'auto', border: '2px solid #ea580c', borderRadius: '16px', borderCollapse: 'separate', backgroundColor: '#ffffff' }}>
                                                                            <tbody>
                                                                                <tr>
                                                                                    <td align="center" style={{ width: '33.33%', border: 'none', padding: '12px 18px', verticalAlign: 'middle', textAlign: 'center' }}>
                                                                                        <table align="center" style={{ margin: '0 auto', borderCollapse: 'collapse' }}>
                                                                                            <tbody>
                                                                                                <tr>
                                                                                                    <td style={{ verticalAlign: 'middle', border: 'none', paddingRight: '8px' }}>
                                                                                                        <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNlYTU4MGMiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTIgMmM0LjQxIDAgOCAzLjU5IDggOHMtOCAxMy04IDEzLTgtOC41OS04LTEzYzAtNC40MSAzLjU5LTggOC04em0wIDkuNWMxLjM4IDAgMi41LTEuMTIgMi41LTIuNVMxMy4zOCA2LjUgMTIgNi41czIuNSAxLjEyIDIuNSAyLjUtMS4xMiAyLjUtMi41IDIuNXoiLz48L3N2Zz4=" alt="" style={{ height: '20px', verticalAlign: 'middle' }} />
                                                                                                    </td>
                                                                                                    <td style={{ verticalAlign: 'middle', border: 'none', textAlign: 'center' }}>
                                                                                                        <div style={{ fontSize: '8pt', color: '#64748b', fontWeight: 600, textAlign: 'center' }}>Client</div>
                                                                                                        <div style={{ fontSize: '10pt', fontWeight: 900, color: '#000000', whiteSpace: 'nowrap', textAlign: 'center' }}>{proposalFor || project?.client_name || 'Valued Client'}</div>
                                                                                                    </td>
                                                                                                </tr>
                                                                                            </tbody>
                                                                                        </table>
                                                                                    </td>
                                                                                    <td align="center" style={{ width: '33.33%', border: 'none', borderLeft: '1.5px solid #fed7aa', padding: '12px 18px', verticalAlign: 'middle', textAlign: 'center' }}>
                                                                                        <table align="center" style={{ margin: '0 auto', borderCollapse: 'collapse' }}>
                                                                                            <tbody>
                                                                                                <tr>
                                                                                                    <td style={{ verticalAlign: 'middle', border: 'none', paddingRight: '8px' }}>
                                                                                                        <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNlYTU4MGMiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTYgNGgyYTIgMiAwIDAgMSAyIDJ2MTRhMiAyIDAgMCAxLTIgMkg2YTIgMiAwIDAgMS0yLTJWNmEyIDIgMCAwIDEgMi0yaDIiLz48cmVjdCB4PSI4IiB5PSIyIiB3aWR0aD0iOCIgaGVpZ2h0PSI0IiByeD0iMSIgcnk9IjEiLz48L3N2Zz4=" alt="" style={{ height: '20px', verticalAlign: 'middle' }} />
                                                                                                    </td>
                                                                                                    <td style={{ verticalAlign: 'middle', border: 'none', textAlign: 'center' }}>
                                                                                                        <div style={{ fontSize: '8pt', color: '#64748b', fontWeight: 600, textAlign: 'center' }}>Quote No.</div>
                                                                                                        <div style={{ fontSize: '10pt', fontWeight: 900, color: '#000000', whiteSpace: 'nowrap', textAlign: 'center' }}>
                                                                                                            {(() => {
                                                                                                                const val = String(projectIdVal || project?.project_id || '101').trim();
                                                                                                                return val.startsWith('QTN-') ? val : `QTN-${val}`;
                                                                                                            })()}
                                                                                                        </div>
                                                                                                    </td>
                                                                                                </tr>
                                                                                            </tbody>
                                                                                        </table>
                                                                                    </td>
                                                                                    <td align="center" style={{ width: '33.33%', border: 'none', borderLeft: '1.5px solid #fed7aa', padding: '12px 18px', verticalAlign: 'middle', textAlign: 'center' }}>
                                                                                        <table align="center" style={{ margin: '0 auto', borderCollapse: 'collapse' }}>
                                                                                            <tbody>
                                                                                                <tr>
                                                                                                    <td style={{ verticalAlign: 'middle', border: 'none', paddingRight: '8px' }}>
                                                                                                        <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMzYjgyZjYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB4PSIzIiB5PSI0IiB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHJ4PSIyIiByeT0iMiIvPjxsaW5lIHgxPSIxNiIgeTE9IjIiIHgyPSIxNiIgeTI9IjYiLz48bGluZSB4MT0iOCIgeTE9IjIiIHgyPSI4IiB5Mj0iNiIvPjxsaW5lIHgxPSIzIiB5MT0iMTAiIHgyPSIyMSIgeTI9IjEwIi8+PC9zdmc+" alt="" style={{ height: '20px', verticalAlign: 'middle' }} />
                                                                                                    </td>
                                                                                                    <td style={{ verticalAlign: 'middle', border: 'none', textAlign: 'center' }}>
                                                                                                        <div style={{ fontSize: '8pt', color: '#64748b', fontWeight: 600, textAlign: 'center' }}>Date</div>
                                                                                                        <div style={{ fontSize: '10pt', fontWeight: 900, color: '#000000', whiteSpace: 'nowrap', textAlign: 'center' }}>{proposalDate || new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                                                                                                    </td>
                                                                                                </tr>
                                                                                            </tbody>
                                                                                        </table>
                                                                                    </td>
                                                                                </tr>
                                                                            </tbody>
                                                                        </table>
                                                                    </td>
                                                                </tr>
                                                            </tbody>
                                                        </table>
                                                    </center>
                                                </td>
                                            </tr>

                                            {/* Row 4: Bottom Spacer (220px) */}
                                            <tr style={{ height: '220px' }}>
                                                <td style={{ height: '220px', border: 'none', padding: 0 }}>&nbsp;</td>
                                            </tr>

                                            {/* Row 3: Bottom Contact Card */}
                                            <tr>
                                                <td style={{ verticalAlign: 'bottom', border: 'none', padding: 0 }}>
                                                    <div style={{ border: '2px solid #ea580c', borderRadius: '16px', backgroundColor: '#ffffff', overflow: 'hidden' }}>
                                                        <table className="cover-card-orange-strip" style={{ width: '100%', backgroundColor: '#ea580c', background: '#ea580c', borderCollapse: 'collapse', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                                            <tbody>
                                                                <tr>
                                                                    <td style={{ width: '36%', border: 'none', padding: '12px 16px', color: '#ffffff', fontSize: '9pt', fontWeight: 800, verticalAlign: 'middle', textAlign: 'center' }}>
                                                                        <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNCIgaGVpZ2h0PSIxNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSIjZmZmZmZmIj48cGF0aCBkPSJNMTIgMkM4LjEzIDIgNSA1LjEzIDUgOWMwIDUuMjUgNyAxMyA3IDEzczctNy43NSA3LTEzYzAtMy44Ny0zLjEzLTctNy03em0wIDkuNWMtMS4zOCAwLTIuNS0xLjEyLTIuNS0yLjVzMS4xMi0yLjUgMi41LTIuNSAyLjUgMS4xMiAyLjUgMi41LTEuMTIgMi41LTIuNSAyLjV6Ii8+PC9zdmc+" alt="" style={{ width: '12px', height: '12px', verticalAlign: '-1px', marginRight: '5px', display: 'inline-block' }} />
                                                                        Visakhapatnam, Andhra Pradesh 530020
                                                                    </td>
                                                                    <td style={{ width: '28%', border: 'none', borderLeft: '1.5px solid #ffffff', padding: '12px 16px', color: '#ffffff', fontSize: '9pt', fontWeight: 800, verticalAlign: 'middle', textAlign: 'center' }}>
                                                                        <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNCIgaGVpZ2h0PSIxNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSIjZmZmZmZmIj48cGF0aCBkPSJNNi42MiAxMC43OWMxLjQ4IDIuODMgMy43NiA1LjE4IDYuNTkgNi41OWwyLjItMi4yYy4yNy0uMjcuNjctLjM2IDEuMDItLjI0IDEuMTIuMzcgMi4zMy41NyAzLjU3LjU3LjU1IDAgMSAuNDUgMSAxVjIwYzAgLjU1LS40NSAxLTEgMS05LjM5IDAtMTctNy42MS0xNy0xNyAwLS41NS40NS0xIDEtMWgzLjVjLjU1IDAgMSAuNDUgMSAxIDAgMS4yNS4yIDIuNDUuNTcgMy41Ny4xMS4zNS4wMy43NC0uMjUgMS4wMmwtMi4yIDIuMnoiLz48L3N2Zz4=" alt="" style={{ width: '12px', height: '12px', verticalAlign: '-1px', marginRight: '5px', display: 'inline-block' }} />
                                                                        +91 7702312351
                                                                    </td>
                                                                    <td style={{ width: '36%', border: 'none', borderLeft: '1.5px solid #ffffff', padding: '12px 16px', color: '#ffffff', fontSize: '9pt', fontWeight: 800, verticalAlign: 'middle', textAlign: 'center' }}>
                                                                        <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNCIgaGVpZ2h0PSIxNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSIjZmZmZmZmIj48cGF0aCBkPSJNMjAgNEg0Yy0xLjEgMC0xLjk5LjktMS45OSAyTDIgMThjMCAxLjEuOSAyIDIgMmgxNmMxLjEgMCAyLS45IDItNlY2YzAtMS4xLS45LTItMi0yek00IDhsOCA1IDgtNVY2bC04IDUtOC01djJ6Ii8+PC9zdmc+" alt="" style={{ width: '12px', height: '12px', verticalAlign: '-1px', marginRight: '5px', display: 'inline-block' }} />
                                                                        contact@livincart.com
                                                                    </td>
                                                                </tr>
                                                            </tbody>
                                                        </table>

                                                        <table className="cover-card-light-strip" style={{ width: '100%', backgroundColor: '#fff7ed', background: '#fff7ed', borderTop: '1.5px solid #fed7aa', borderCollapse: 'collapse', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                                            <tbody>
                                                                <tr>
                                                                    <td style={{ width: '50%', border: 'none', padding: '10px 16px', color: '#0f172a', fontSize: '9.5pt', fontWeight: 900, verticalAlign: 'middle', textAlign: 'center' }}>
                                                                        <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNCIgaGVpZ2h0PSIxNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSIjZWE1ODBjIj48cGF0aCBkPSJNMTIgMkM2LjQ4IDIgMiA2LjQ4IDIgMTJzNC40OCAxMCAxMCAxMCAxMC00LjQ4IDEwLTEwUzE3LjUyIDIgMTIgMnptLTEgMTcuOTNjLTMuOTUtLjQ5LTctMy44NS03LTcgMC0uNjIuMDgtMS4yMS4yMS0xLjc5TDkgMTV2MWMwIDEuMS45IDIgMiAydjEuOTN6bTYuOS0yLjU0Yy0uMjYtLjgxLTEtMS4zOS0xLjktMS4zOWgtMXYtM2MwLS41NS0uNDUtMS0xLTFIOHYtMmgyYy41NSAwIDEtLjQ1IDEtMVY3aDJjMS4xIDAgMi0uOSAyLTJ2LS40MWMyLjkzIDEuMTkgNSA0LjA2IDUgNy40MSAwIDIuMDgtLjggMy45Ny0yLjEgNS4zOXoiLz48L3N2Zz4=" alt="" style={{ width: '12px', height: '12px', verticalAlign: '-1px', marginRight: '6px', display: 'inline-block' }} />
                                                                        www.livincart.com
                                                                    </td>
                                                                    <td style={{ width: '50%', border: 'none', borderLeft: '1.5px solid #fed7aa', padding: '10px 16px', color: '#0f172a', fontSize: '9.5pt', fontWeight: 900, verticalAlign: 'middle', textAlign: 'center' }}>
                                                                        <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNCIgaGVpZ2h0PSIxNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSIjZWE1ODBjIj48cGF0aCBkPSJNMTIgMTJjMi4yMSAwIDQtMS43OSA0LTRzLTEuNzktNC00LTQtNCAxLjc5LTQgNCAxLjc5IDQgNCA0em0wIDJjLTIuNjcgMC04IDEuMzQtOCA0djJoMTZ2LTJjMC0yLjY2LTUuMzMtNC04LTR6Ii8+PC9zdmc+" alt="" style={{ width: '12px', height: '12px', verticalAlign: '-1px', marginRight: '6px', display: 'inline-block' }} />
                                                                        {designerName || 'Livincart Team'}
                                                                    </td>
                                                                </tr>
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}

                        {/* ===== PAGE 2: PROJECT INFORMATION ===== */}
                        <div className="page-break-project-info" style={{
                            minHeight: 'auto',
                            pageBreakBefore: showCoverPage ? 'always' : 'auto',
                            breakBefore: showCoverPage ? 'page' : 'auto',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            backgroundColor: '#ffffff',
                            padding: '16px 12px 20px 12px',
                            position: 'relative',
                            boxSizing: 'border-box'
                        }}>
                            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
                                <div>
                                    {/* Page Header with Full Contact Info */}
                                    <table style={{ width: '100%', borderCollapse: 'collapse', borderBottom: '2.5px solid #ea580c', paddingBottom: '14px', marginBottom: '28px' }}>
                                        <tbody>
                                            <tr>
                                                <td style={{ width: '50%', verticalAlign: 'top', border: 'none', padding: 0 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                                        <img src={OfficialLogo} onError={(e) => { e.currentTarget.src = ArkLogo; }} alt="Logo" style={{ height: '50px', objectFit: 'contain' }} />
                                                        <div>
                                                            <div style={{ fontSize: '15pt', fontWeight: 900, color: '#000000', marginBottom: '2px' }}>Livincart Private Limited</div>
                                                            <div style={{ fontSize: '8pt', color: '#64748b', fontWeight: 500 }}>Official Quotation &amp; Estimation Workspace</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td style={{ width: '50%', verticalAlign: 'top', textAlign: 'right', border: 'none', padding: 0 }}>
                                                    <div style={{ fontSize: '9.5pt', fontWeight: 900, color: '#000000', marginBottom: '4px' }}>LIVINCART AND SERVICES PRIVATE LIMITED</div>
                                                    <div style={{ fontSize: '7.5pt', color: '#475569', fontWeight: 600, marginTop: '4px', display: 'block' }}>
                                                        📍 Visakhapatnam, Andhra Pradesh – 530020
                                                    </div>
                                                    <div style={{ fontSize: '7.5pt', color: '#475569', fontWeight: 600, marginTop: '3px', display: 'block' }}>
                                                        📞 +91 7702312351
                                                    </div>
                                                    <div style={{ fontSize: '7.5pt', color: '#475569', fontWeight: 600, marginTop: '3px', display: 'block' }}>
                                                        ✉️ contact@livincart.com &nbsp;&nbsp; 🌐 www.livincart.com
                                                    </div>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>

                                    {/* Section Title */}
                                    <div style={{ marginBottom: '28px' }}>
                                        <h2 style={{ margin: 0, fontSize: '20pt', fontWeight: 900, color: '#0f172a' }}>PROJECT INFORMATION</h2>
                                        <div style={{ width: '80px', height: '4px', backgroundColor: '#ea580c', marginTop: '8px' }} />
                                    </div>

                                    {/* Spacious Dotted Grid Layout filling Page 2 */}
                                    <div style={{ border: '2px solid #cbd5e1', borderRadius: '18px', padding: '32px', backgroundColor: '#ffffff', marginBottom: '32px', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
                                        {/* Row 1: 3 Columns */}
                                        <table style={{ width: '100%', borderCollapse: 'collapse', borderBottom: '2px dashed #cbd5e1', paddingBottom: '28px', marginBottom: '28px' }}>
                                            <tbody>
                                                <tr>
                                                    <td style={{ width: '33.33%', border: 'none', borderRight: '2px dashed #cbd5e1', paddingRight: '16px', verticalAlign: 'top' }}>
                                                        <div style={{ fontSize: '9.5pt', color: '#64748b', fontWeight: 700, marginBottom: '8px' }}>Proposal Created for:</div>
                                                        <div style={{ fontSize: '14pt', fontWeight: 900, color: '#ea580c' }}>{proposalFor || project?.client_name || 'Valued Client'}</div>
                                                    </td>
                                                    <td style={{ width: '33.33%', border: 'none', borderRight: '2px dashed #cbd5e1', paddingLeft: '16px', paddingRight: '16px', verticalAlign: 'top' }}>
                                                        <div style={{ fontSize: '9.5pt', color: '#64748b', fontWeight: 700, marginBottom: '8px' }}>Project ID:</div>
                                                        <div style={{ fontSize: '14pt', fontWeight: 900, color: '#ea580c' }}>{projectIdVal}</div>
                                                    </td>
                                                    <td style={{ width: '33.33%', border: 'none', paddingLeft: '16px', verticalAlign: 'top' }}>
                                                        <div style={{ fontSize: '9.5pt', color: '#64748b', fontWeight: 700, marginBottom: '8px' }}>Proposal Created on:</div>
                                                        <div style={{ fontSize: '14pt', fontWeight: 900, color: '#ea580c' }}>{proposalDate}</div>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>

                                        {/* Row 2: Scope of Work */}
                                        <div style={{ padding: '0 0 28px 0', borderBottom: '2px dashed #cbd5e1', marginBottom: '28px' }}>
                                            <div style={{ fontSize: '9.5pt', color: '#64748b', fontWeight: 700, marginBottom: '8px' }}>Scope of Work:</div>
                                            <div style={{ fontSize: '14pt', fontWeight: 900, color: '#ea580c', lineHeight: 1.45 }}>{scopeOfWork}</div>
                                        </div>

                                        {/* Row 3: 3 Columns */}
                                        <table style={{ width: '100%', borderCollapse: 'collapse', borderBottom: '2px dashed #cbd5e1', paddingBottom: '28px', marginBottom: '28px' }}>
                                            <tbody>
                                                <tr>
                                                    <td style={{ width: '33.33%', border: 'none', borderRight: '2px dashed #cbd5e1', paddingRight: '16px', verticalAlign: 'top' }}>
                                                        <div style={{ fontSize: '9.5pt', color: '#64748b', fontWeight: 700, marginBottom: '8px' }}>Time for Production &amp; Installation:</div>
                                                        <div style={{ fontSize: '13pt', fontWeight: 900, color: '#0f172a' }}>{productionTime}</div>
                                                    </td>
                                                    <td style={{ width: '33.33%', border: 'none', borderRight: '2px dashed #cbd5e1', paddingLeft: '16px', paddingRight: '16px', verticalAlign: 'top' }}>
                                                        <div style={{ fontSize: '9.5pt', color: '#64748b', fontWeight: 700, marginBottom: '8px' }}>Project Category:</div>
                                                        <div style={{ fontSize: '13pt', fontWeight: 900, color: '#0f172a' }}>{projectCategory}</div>
                                                    </td>
                                                    <td style={{ width: '33.33%', border: 'none', paddingLeft: '16px', verticalAlign: 'top' }}>
                                                        <div style={{ fontSize: '9.5pt', color: '#64748b', fontWeight: 700, marginBottom: '8px' }}>Designer Name:</div>
                                                        <div style={{ fontSize: '13pt', fontWeight: 900, color: '#0f172a' }}>{designerName || 'Livincart Team'}</div>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>

                                        {/* Row 4: Sales Manager Details */}
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <tbody>
                                                <tr>
                                                    <td style={{ width: '33.33%', border: 'none', borderRight: '2px dashed #cbd5e1', paddingRight: '16px', verticalAlign: 'top' }}>
                                                        <div style={{ fontSize: '9.5pt', color: '#64748b', fontWeight: 700, marginBottom: '8px' }}>Sales Manager Name:</div>
                                                        <div style={{ fontSize: '13pt', fontWeight: 900, color: '#0f172a' }}>{salesManagerName || '—'}</div>
                                                    </td>
                                                    <td style={{ width: '33.33%', border: 'none', borderRight: '2px dashed #cbd5e1', paddingLeft: '16px', paddingRight: '16px', verticalAlign: 'top' }}>
                                                        <div style={{ fontSize: '9.5pt', color: '#64748b', fontWeight: 700, marginBottom: '8px' }}>Sales Manager Phone:</div>
                                                        <div style={{ fontSize: '13pt', fontWeight: 900, color: '#0f172a' }}>{salesManagerPhone || '—'}</div>
                                                    </td>
                                                    <td style={{ width: '33.33%', border: 'none', paddingLeft: '16px', verticalAlign: 'top' }}>
                                                        <div style={{ fontSize: '9.5pt', color: '#64748b', fontWeight: 700, marginBottom: '8px' }}>Sales Manager Email:</div>
                                                        <div style={{ fontSize: '13pt', fontWeight: 900, color: '#0f172a' }}>{salesManagerEmail || '—'}</div>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Orange Note Box placed gracefully at the bottom of Page 2 */}
                                <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff7ed', borderRadius: '14px', border: '2px solid #fed7aa', marginTop: 'auto' }}>
                                    <tbody>
                                        <tr>
                                            <td style={{ width: '44px', minWidth: '44px', maxWidth: '44px', padding: '16px 12px 16px 20px', verticalAlign: 'middle', border: 'none' }}>
                                                <div style={{ width: '32px', height: '32px', minWidth: '32px', maxWidth: '32px', lineHeight: '32px', borderRadius: '50%', backgroundColor: '#ea580c', color: '#ffffff', textAlign: 'center', fontWeight: 900, fontSize: '14pt', margin: '0 auto' }}>i</div>
                                            </td>
                                            <td style={{ padding: '16px 20px 16px 0', verticalAlign: 'middle', border: 'none', fontSize: '10.5pt', color: '#7c2d12', fontWeight: 600, lineHeight: 1.45 }}>
                                                <strong style={{ color: '#ea580c', marginRight: '8px' }}>NOTE:</strong>
                                                The timeline may change based on Location, Finishes, Project Value, and Civil Scope of work.
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="html2pdf__page-break" style={{ pageBreakBefore: 'always', breakBefore: 'page' }} />

                        {/* ===== PAGE 3: MODULES SUMMARY & AMOUNT LIST ===== */}
                        <div className="page-break-modules-summary" style={{ minHeight: '270mm', padding: '16px 12px 20px', backgroundColor: '#ffffff', position: 'relative', boxSizing: 'border-box', marginBottom: '28px' }}>
                            <PageHeader />
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '16px' }}>
                                <span style={{ fontSize: '12pt', fontWeight: 800, color: '#0f172a' }}>MODULES SUMMARY &amp; AMOUNT LIST</span>
                                <span style={{ fontSize: '9pt', color: '#475569', fontWeight: 800 }}>({sections.length} modules)</span>
                            </div>

                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8.5pt', border: '1px solid #e2e8f0' }}>
                                <thead>
                                    <tr style={{ backgroundColor: 'rgb(254, 143, 62)', color: '#ffffff' }}>
                                        <th style={{ padding: '9px 12px', textAlign: 'center', fontWeight: 700, color: '#ffffff', width: '6%' }}>S.No</th>
                                        <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 700, color: '#ffffff' }}>Module Name</th>
                                        <th style={{ padding: '9px 12px', textAlign: 'center', fontWeight: 700, color: '#ffffff', width: '18%' }}>Total Items</th>
                                        <th style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: '#ffffff', width: '22%' }}>Module Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sections.map((section, idx) => {
                                        const secGross = section.items.reduce((sum, item) => {
                                            if (item.brand === 'HEADER') return sum;
                                            const isLump = item.pricing_mode === 'lumpsum' || (!item.width && !item.height && !item.sft);
                                            const qty = Math.max(0, parseFloat(item.quantity as any) || 0);
                                            const rate = Math.max(0, parseFloat(item.rate as any) || 0);
                                            const base = (isLump || qty === 0) ? rate : (qty * rate);
                                            return sum + (base > 0 ? base : (item.amount || 0));
                                        }, 0);
                                        const itemCount = section.items.filter(i => i.brand !== 'HEADER').length;
                                        const secSft = section.items.reduce((sum, item) => {
                                            if (item.brand === 'HEADER') return sum;
                                            const sft = computeSqft(item.width, item.height, item.sft, item.pricing_mode);
                                            return sum + (sft * (item.quantity || 1));
                                        }, 0);
                                        return (
                                            <tr key={section.id} style={{ borderBottom: '1px solid #f3f4f6', backgroundColor: idx % 2 === 1 ? '#fffdf9' : '#ffffff' }}>
                                                <td style={{ padding: '9px 12px', textAlign: 'center', fontWeight: 700, color: '#374151' }}>{idx + 1}</td>
                                                <td style={{ padding: '9px 12px', fontWeight: 800, color: '#111827' }}>{section.name || `Module ${idx + 1}`}</td>
                                                <td style={{ padding: '9px 12px', textAlign: 'center', fontWeight: 600, color: '#374151' }}>
                                                    <div>{itemCount}</div>
                                                    {secSft > 0 && <div style={{ color: '#ea580c', fontSize: '7.5pt', fontWeight: 700, wordBreak: 'break-all' }}>{secSft} SFT</div>}
                                                </td>
                                                <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 800, color: '#ea580c' }}>{'₹' + secGross.toLocaleString()}</td>
                                            </tr>
                                        );
                                    })}
                                    {/* 1) Total Modules Gross Amount */}
                                    <tr style={{ borderTop: '1.5px solid #fed7aa', backgroundColor: '#fffaf0' }}>
                                        <td colSpan={3} style={{ padding: '10px 12px', textAlign: 'right', fontSize: '9pt', fontWeight: 800, color: '#111827' }}>
                                            <div>Total Modules Gross Amount:</div>
                                            {(() => {
                                                const grandTotalSft = sections.reduce((secSum, sec) => {
                                                    return secSum + sec.items.reduce((itemSum, item) => {
                                                        if (item.brand === 'HEADER') return itemSum;
                                                        const sft = computeSqft(item.width, item.height, item.sft, item.pricing_mode);
                                                        return itemSum + (sft * (item.quantity || 1));
                                                    }, 0);
                                                }, 0);
                                                return grandTotalSft > 0 ? (
                                                    <div style={{ fontSize: '8pt', color: '#ea580c', fontWeight: 800, wordBreak: 'break-all' }}>
                                                        Total SFT: {grandTotalSft} SFT
                                                    </div>
                                                ) : null;
                                            })()}
                                        </td>
                                        <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: '10.5pt', fontWeight: 800, color: '#ea580c' }}>{'₹' + getGrossTotal().toLocaleString()}</td>
                                    </tr>

                                    {/* 2) Total Discount Amount (Replaces category-wise breakdown) */}
                                    {(!isFieldHidden('categoryDiscount') || !isFieldHidden('generalDiscount') || !isFieldHidden('flatDiscount')) && (
                                        <tr style={{ backgroundColor: '#fff7ed', borderTop: '1px dashed #fed7aa' }}>
                                            <td colSpan={3} style={{ padding: '8px 12px', textAlign: 'right', fontSize: '8.5pt', fontWeight: 700, color: '#c2410c' }}>
                                                Total Discount:
                                            </td>
                                            <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '9.5pt', fontWeight: 800, color: (getCategoryDiscountTotal() + getGeneralDiscountAmount() + getCouponDiscountAmount()) > 0 ? '#c2410c' : '#94a3b8' }}>
                                                {(getCategoryDiscountTotal() + getGeneralDiscountAmount() + getCouponDiscountAmount()) > 0
                                                    ? '- ₹' + (getCategoryDiscountTotal() + getGeneralDiscountAmount() + getCouponDiscountAmount()).toLocaleString('en-IN', { minimumFractionDigits: (getCategoryDiscountTotal() + getGeneralDiscountAmount() + getCouponDiscountAmount()) % 1 !== 0 ? 2 : 0, maximumFractionDigits: 2 })
                                                    : '-'}
                                            </td>
                                        </tr>
                                    )}

                                    {/* 5) Additional Charges */}
                                    {additionalChargesAmount > 0 && !isFieldHidden('additionalCharges') && (
                                        <>
                                            <tr style={{ backgroundColor: '#fffaf0', borderTop: '1px dashed #fed7aa' }}>
                                                <td colSpan={3} style={{ padding: '8px 12px', textAlign: 'right', fontSize: '8.5pt', fontWeight: 700, color: '#374151' }}>
                                                    Additional Charges:
                                                </td>
                                                <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '9.5pt', fontWeight: 800, color: '#374151' }}>
                                                    {'+ ₹' + additionalChargesAmount.toLocaleString('en-IN')}
                                                </td>
                                            </tr>
                                            {getAdditionalChargesGstAmount() > 0 && (
                                                <tr style={{ backgroundColor: '#fffaf0' }}>
                                                    <td colSpan={3} style={{ padding: '4px 12px 8px', textAlign: 'right', fontSize: '8pt', fontWeight: 700, color: '#ea580c' }}>
                                                        Additional Charges GST ({additionalChargesGstRate}%):
                                                    </td>
                                                    <td style={{ padding: '4px 12px 8px', textAlign: 'right', fontSize: '9pt', fontWeight: 800, color: '#ea580c' }}>
                                                        {'+ ₹' + getAdditionalChargesGstAmount().toLocaleString('en-IN')}
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    )}

                                    {/* 6) Overall GST (% applied, respecting toggle and splitwise) */}
                                    {overallGstEnabled && !overallGstLineHidden && !isFieldHidden('gst') && getGstAmount() > 0 && (() => {
                                        const gstInfo = getGstRateInfo();
                                        const activeGstPct = gstInfo.isMixed ? gstInfo.effectiveRate : overallGstRate;
                                        return (
                                            <>
                                                {gstSplitType === 'intra' ? (
                                                    <>
                                                        <tr style={{ backgroundColor: '#fffaf0', borderTop: '1px dashed #fed7aa' }}>
                                                            <td colSpan={3} style={{ padding: '8px 12px', textAlign: 'right', fontSize: '8.5pt', fontWeight: 700, color: '#16a34a' }}>
                                                                CGST:
                                                            </td>
                                                            <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '9.5pt', fontWeight: 800, color: '#16a34a' }}>
                                                                {'+ ₹' + Math.round(getGstAmount() / 2).toLocaleString('en-IN')}
                                                            </td>
                                                        </tr>
                                                        <tr style={{ backgroundColor: '#fffaf0', borderTop: '1px dashed #fed7aa' }}>
                                                            <td colSpan={3} style={{ padding: '8px 12px', textAlign: 'right', fontSize: '8.5pt', fontWeight: 700, color: '#16a34a' }}>
                                                                SGST:
                                                            </td>
                                                            <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '9.5pt', fontWeight: 800, color: '#16a34a' }}>
                                                                {'+ ₹' + (getGstAmount() - Math.round(getGstAmount() / 2)).toLocaleString('en-IN')}
                                                            </td>
                                                        </tr>
                                                    </>
                                                ) : (
                                                    <tr style={{ backgroundColor: '#fffaf0', borderTop: '1px dashed #fed7aa' }}>
                                                        <td colSpan={3} style={{ padding: '8px 12px', textAlign: 'right', fontSize: '8.5pt', fontWeight: 700, color: '#16a34a' }}>
                                                            IGST:
                                                        </td>
                                                        <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '9.5pt', fontWeight: 800, color: '#16a34a' }}>
                                                            {'+ ₹' + getGstAmount().toLocaleString('en-IN')}
                                                        </td>
                                                    </tr>
                                                )}
                                            </>
                                        );
                                    })()}

                                    {/* 7) Round Off Adjustment */}
                                    {(roundOffEnabled || Math.abs(getRoundOffAdjustment()) > 0.001) && !isFieldHidden('roundOff') && (
                                        <tr style={{ backgroundColor: '#fffaf0', borderTop: '1px dashed #fed7aa' }}>
                                            <td colSpan={3} style={{ padding: '8px 12px', textAlign: 'right', fontSize: '8.5pt', fontWeight: 700, color: '#64748b' }}>
                                                Round Off Adjustment:
                                            </td>
                                            <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '9.5pt', fontWeight: 800, color: getRoundOffAdjustment() >= 0 ? '#16a34a' : '#dc2626' }}>
                                                {getRoundOffAdjustment() >= 0 ? `+ ₹${getRoundOffAdjustment().toFixed(2)}` : `- ₹${Math.abs(getRoundOffAdjustment()).toFixed(2)}`}
                                            </td>
                                        </tr>
                                    )}

                                    {/* 8) Final Amount (Net Payable Total) */}
                                    <tr style={{ backgroundColor: '#fff1f2', borderTop: '2.5px solid #ea580c' }}>
                                        <td colSpan={3} style={{ padding: '10px 12px', textAlign: 'right', fontSize: '9.5pt', fontWeight: 900, color: '#0f172a' }}>
                                            Final Amount (Net Payable Total)
                                        </td>
                                        <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: '11pt', fontWeight: 900, color: '#16a34a' }}>
                                            {'₹' + getFinalTotal().toLocaleString('en-IN')}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>

                            {/* Amount in words box */}
                            <div style={{ marginTop: '14px', padding: '12px 18px', backgroundColor: '#fffaf0', borderRadius: '8px', border: '1.5px solid #fed7aa', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                                <span style={{ fontSize: '8.5pt', fontWeight: 800, color: '#c2410c', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Amount In Words:</span>
                                <span style={{ fontSize: '10.5pt', fontWeight: 900, color: '#111827' }}>{numberToWords(getFinalTotal())}</span>
                            </div>

                            <PageFooter />
                        </div>
                        <div className="html2pdf__page-break" style={{ pageBreakBefore: 'always', breakBefore: 'page' }} />

                        {/* ===== PAGES 4+: PER MODULE DETAIL TABLES ===== */}
                        {sections.map((section, sIdx) => {
                            const sectionTotal = section.items.reduce((a, item) => a + (item.amount || 0), 0);
                            const regularItems = section.items.filter(i => i.brand !== 'HEADER');
                            const secHeadings = section.custom_headings || customHeadings || {};
                            const totalColSpan = 1 +
                                (!isFieldHidden('particulars') ? 1 : 0) +
                                (!isFieldHidden('shutterMaterial') ? 1 : 0) +
                                (!isFieldHidden('carcassMaterial') ? 1 : 0) +
                                (!isFieldHidden('dimensions') ? 1 : 0) +
                                (!isFieldHidden('rate') ? 1 : 0) +
                                (!isFieldHidden('qty') ? 1 : 0) +
                                (!isFieldHidden('discount') ? 1 : 0) +
                                (!isFieldHidden('gst') ? 1 : 0);
                            const allColsCount = totalColSpan + (!isFieldHidden('amount') ? 1 : 0);

                            return (
                                <React.Fragment key={section.id || sIdx}>
                                    <div className="page-break-section" style={{ minHeight: 'auto', padding: '0px 0px 12px', position: 'relative', boxSizing: 'border-box', marginBottom: '20px', backgroundColor: '#ffffff' }}>
                                        {/* Module Title: orange square badge + name + module total amount */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', pageBreakAfter: 'avoid', breakAfter: 'avoid' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{ width: '26px', height: '26px', borderRadius: '6px', backgroundColor: '#ea580c', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '9.5pt', flexShrink: 0 }}>{sIdx + 1}</div>
                                                <span style={{ fontSize: '12.5pt', fontWeight: 900, color: '#111827', letterSpacing: '0.3px', textTransform: 'uppercase' }}>{section.name || `Module ${sIdx + 1}`}</span>
                                            </div>
                                            {!isFieldHidden('amount') && (
                                                <span style={{ fontSize: '12pt', fontWeight: 900, color: '#ea580c' }}>
                                                    ₹ {sectionTotal.toLocaleString('en-IN')}
                                                </span>
                                            )}
                                        </div>

                                        {/* Items Table */}
                                        <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: '8pt', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                                            <thead>
                                                <tr style={{ backgroundColor: headerBgColor, borderBottom: `1px solid ${headerBgColor}`, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                                    <th style={{ padding: '8px 4px', textAlign: 'center', fontWeight: 700, color: '#ffffff', fontSize: '8.5pt', width: '4%', borderRight: '1px solid rgba(255, 255, 255, 0.15)', backgroundColor: headerBgColor, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>#</th>
                                                    {!isFieldHidden('particulars') && (
                                                        <th style={{ padding: '8px 6px', textAlign: 'left', fontWeight: 700, color: '#ffffff', fontSize: '8.5pt', width: '23%', borderRight: '1px solid rgba(255, 255, 255, 0.15)', backgroundColor: headerBgColor, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>{secHeadings.particulars || customHeadings.particulars || 'Product Description'}</th>
                                                    )}
                                                    {!isFieldHidden('shutterMaterial') && (
                                                        <th style={{ padding: '8px 6px', textAlign: 'left', fontWeight: 700, color: '#ffffff', fontSize: '8.5pt', width: '14%', borderRight: '1px solid rgba(255, 255, 255, 0.15)', backgroundColor: headerBgColor, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>{secHeadings.shutterMaterial || customHeadings.shutterMaterial || 'Shutter Material | Finish'}</th>
                                                    )}
                                                    {!isFieldHidden('carcassMaterial') && (
                                                        <th style={{ padding: '8px 6px', textAlign: 'left', fontWeight: 700, color: '#ffffff', fontSize: '8.5pt', width: '14%', borderRight: '1px solid rgba(255, 255, 255, 0.15)', backgroundColor: headerBgColor, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>{secHeadings.carcassMaterial || customHeadings.carcassMaterial || 'Carcass Material | Color'}</th>
                                                    )}
                                                    {!isFieldHidden('dimensions') && (
                                                        <th style={{ padding: '6px 6px', textAlign: 'center', fontWeight: 700, color: '#ffffff', fontSize: '8pt', width: '12%', borderRight: '1px solid rgba(255, 255, 255, 0.15)', backgroundColor: headerBgColor, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>{secHeadings.dimensions || customHeadings.dimensions || 'Dimensions (W × H × D) (mm)'}</th>
                                                    )}
                                                    {!isFieldHidden('rate') && (
                                                        <th style={{ padding: '6px 6px', textAlign: 'center', fontWeight: 700, color: '#ffffff', fontSize: '8pt', width: '9%', borderRight: '1px solid rgba(255, 255, 255, 0.15)', backgroundColor: headerBgColor, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>{secHeadings.rate || customHeadings.rate || 'Rate / SFT'}</th>
                                                    )}
                                                    {!isFieldHidden('qty') && (
                                                        <th style={{ padding: '8px 4px', textAlign: 'center', fontWeight: 700, color: '#ffffff', fontSize: '8.5pt', width: '4.5%', borderRight: '1px solid rgba(255, 255, 255, 0.15)', backgroundColor: headerBgColor, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>{secHeadings.qty || customHeadings.qty || 'QTY'}</th>
                                                    )}
                                                    {!isFieldHidden('discount') && (
                                                        <th style={{ padding: '8px 4px', textAlign: 'center', fontWeight: 700, color: '#ffffff', fontSize: '8.5pt', width: '4.5%', borderRight: '1px solid rgba(255, 255, 255, 0.15)', backgroundColor: headerBgColor, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>{secHeadings.disc || secHeadings.discount || customHeadings.disc || customHeadings.discount || 'Disc %'}</th>
                                                    )}
                                                    {!isFieldHidden('gst') && (
                                                        <th style={{ padding: '8px 4px', textAlign: 'center', fontWeight: 700, color: '#ffffff', fontSize: '8.5pt', width: '5%', borderRight: '1px solid rgba(255, 255, 255, 0.15)', backgroundColor: headerBgColor, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>{secHeadings.gst || customHeadings.gst || 'GST %'}</th>
                                                    )}
                                                    {!isFieldHidden('amount') && (
                                                        <th style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 700, color: '#ffffff', fontSize: '8.5pt', width: '10%', backgroundColor: headerBgColor, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>{secHeadings.amount || customHeadings.amount || 'Amount'}</th>
                                                    )}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {section.items.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={allColsCount} style={{ padding: '12px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', fontSize: '8pt' }}>
                                                            No item specifications listed for this module.
                                                        </td>
                                                    </tr>
                                                ) : (() => {
                                                    let pdfCounter = 0;
                                                    return section.items.map((item, iIdx) => {
                                                        if (item.brand === 'HEADER') {
                                                            pdfCounter = 0;
                                                            let subTotal = 0;
                                                            for (let k = iIdx + 1; k < section.items.length; k++) {
                                                                if (section.items[k].brand === 'HEADER') break;
                                                                subTotal += (parseFloat(String(section.items[k].amount)) || 0);
                                                            }
                                                            return (
                                                                <tr key={item.id || iIdx} style={{ backgroundColor: '#fff7ed', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                                                    <td colSpan={!isFieldHidden('amount') ? totalColSpan : allColsCount} style={{ padding: '8px 12px', borderTop: '1.5px solid #fed7aa', borderBottom: '2px solid #ea580c', backgroundColor: '#fff7ed', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                                                        <span style={{ fontSize: '9.5pt', fontWeight: 900, color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.5px', backgroundColor: 'transparent' }}>{item.particulars}</span>
                                                                    </td>
                                                                    {!isFieldHidden('amount') && (
                                                                        <td style={{ padding: '8px 12px', borderTop: '1.5px solid #fed7aa', borderBottom: '2px solid #ea580c', backgroundColor: '#fff7ed', textAlign: 'right', fontWeight: 900, color: '#ea580c', fontSize: '9.5pt', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                                                            ₹ {subTotal.toLocaleString('en-IN')}
                                                                        </td>
                                                                    )}
                                                                </tr>
                                                            );
                                                        }
                                                        pdfCounter++;
                                                        const isLumpsumItem = item.pricing_mode === 'lumpsum' || (!item.width && !item.height && !item.sft);
                                                        const lumpsumVal = parseFloat(String(item.rate)) || parseFloat(String(item.amount)) || 0;

                                                        return (
                                                            <tr key={item.id || iIdx} style={{ borderBottom: '1px solid #fed7aa', backgroundColor: pdfCounter % 2 === 0 ? '#fffaf5' : '#ffffff', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact', pageBreakInside: 'auto', breakInside: 'auto' }}>
                                                                {/* S.No Column */}
                                                                <td style={{ padding: '10px 4px', verticalAlign: 'top', textAlign: 'center', fontWeight: 700, color: '#475569', fontSize: '8pt', borderRight: '1px solid #e2e8f0', backgroundColor: 'transparent', whiteSpace: 'nowrap' }}>{pdfCounter}</td>
                                                                {/* Product Name with photo box */}
                                                                {!isFieldHidden('particulars') && (
                                                                    <td style={{ padding: '10px 8px', verticalAlign: 'top', borderRight: '1px solid #e2e8f0', backgroundColor: 'transparent', whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'break-word', hyphens: 'auto' }}>
                                                                        {item.image_url && (
                                                                            <img src={item.image_url} alt="Item" style={{ width: '38px', height: '38px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #e2e8f0', float: 'left', marginRight: '8px', marginBottom: '4px' }} />
                                                                        )}
                                                                        <div style={{ fontWeight: 800, color: '#111827', fontSize: '8.5pt', lineHeight: 1.4, marginBottom: '4px', wordBreak: 'break-word', overflowWrap: 'break-word', hyphens: 'auto' }}>
                                                                            {item.category && <span style={{ color: '#ea580c', fontWeight: 800, fontSize: '7.5pt', marginRight: '5px', backgroundColor: '#fff7ed', padding: '1px 5px', borderRadius: '3px', border: '1px solid #fed7aa' }}>[{item.category}]</span>}
                                                                            {item.particulars}
                                                                        </div>
                                                                        {item.hsn_sac && <div style={{ fontSize: '7.5pt', color: '#475569', lineHeight: 1.4, wordBreak: 'break-word', overflowWrap: 'break-word', clear: 'both', hyphens: 'auto' }}>{item.hsn_sac}</div>}
                                                                    </td>
                                                                )}
                                                                {!isFieldHidden('shutterMaterial') && (
                                                                    <td style={{ padding: '10px 8px', verticalAlign: 'top', fontSize: '8pt', color: '#374151', fontWeight: 600, textAlign: 'left', lineHeight: 1.45, borderRight: '1px solid #e2e8f0', backgroundColor: 'transparent', whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'break-word', hyphens: 'auto' }}>{item.brand || '—'}</td>
                                                                )}
                                                                {!isFieldHidden('carcassMaterial') && (
                                                                    <td style={{ padding: '10px 8px', verticalAlign: 'top', fontSize: '8pt', color: '#374151', fontWeight: 600, textAlign: 'left', lineHeight: 1.45, borderRight: '1px solid #e2e8f0', backgroundColor: 'transparent', whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'break-word', hyphens: 'auto' }}>{item.unit || '—'}</td>
                                                                )}
                                                                {!isFieldHidden('dimensions') && (
                                                                    <td style={{ padding: '8px 6px', verticalAlign: 'top', fontSize: '7.5pt', textAlign: 'left', fontWeight: 600, color: '#111827', borderRight: '1px solid #e2e8f0', backgroundColor: 'transparent' }}>
                                                                        {isLumpsumItem ? (
                                                                            <span style={{ color: '#16a34a', fontWeight: 800 }}>Lumpsum: ₹{lumpsumVal.toLocaleString('en-IN')}</span>
                                                                        ) : (
                                                                            <div style={{ lineHeight: 1.3, fontWeight: 600 }}>
                                                                                <div>Width: {item.width || 0}</div>
                                                                                <div>Height: {item.height || 0}</div>
                                                                                <div>Depth: {item.sft || 0}</div>
                                                                                {(() => {
                                                                                    const sftVal = computeSqft(item.width, item.height, item.sft, item.pricing_mode);
                                                                                    return sftVal > 0 ? (
                                                                                        <div style={{ color: '#ea580c', fontWeight: 700, fontSize: '7.2pt', marginTop: '2px', wordBreak: 'break-all' }} title={`Exact SFT: ${Number(sftVal.toFixed(2))}`}>
                                                                                            {Number(sftVal.toFixed(2))} SFT
                                                                                        </div>
                                                                                    ) : null;
                                                                                })()}
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                )}
                                                                {!isFieldHidden('rate') && (
                                                                    <td style={{ padding: '10px 8px', verticalAlign: 'top', textAlign: 'center', fontWeight: 700, color: '#111827', fontSize: '8pt', borderRight: '1px solid #e2e8f0', backgroundColor: 'transparent', whiteSpace: 'nowrap' }}>{isLumpsumItem ? '—' : (item.rate_per_sft ? '₹' + item.rate_per_sft : '—')}</td>
                                                                )}
                                                                {!isFieldHidden('qty') && (
                                                                    <td style={{ padding: '10px 8px', verticalAlign: 'top', textAlign: 'center', fontWeight: 700, color: '#111827', borderRight: '1px solid #e2e8f0', backgroundColor: 'transparent', whiteSpace: 'nowrap' }}>{isLumpsumItem ? ((item.quantity && Number(item.quantity) > 0) ? item.quantity : '—') : (item.quantity || 0)}</td>
                                                                )}
                                                                {!isFieldHidden('discount') && (
                                                                    <td style={{ padding: '10px 8px', verticalAlign: 'top', textAlign: 'center', fontWeight: 600, color: '#ea580c', fontSize: '8pt', borderRight: '1px solid #e2e8f0', backgroundColor: 'transparent', whiteSpace: 'nowrap' }}>{item.discount_percent ? item.discount_percent + '%' : '0%'}</td>
                                                                )}
                                                                {!isFieldHidden('gst') && (
                                                                    <td style={{ padding: '10px 8px', verticalAlign: 'top', textAlign: 'center', fontWeight: 600, color: '#475569', fontSize: '8pt', borderRight: '1px solid #e2e8f0', backgroundColor: 'transparent', whiteSpace: 'nowrap' }}>{item.gst_rate !== undefined ? item.gst_rate + '%' : '18%'}</td>
                                                                )}
                                                                {!isFieldHidden('amount') && (
                                                                    <td style={{ padding: '10px 8px', verticalAlign: 'top', textAlign: 'center', fontWeight: 800, color: '#111827', backgroundColor: 'transparent', whiteSpace: 'nowrap' }}>{'₹' + (item.amount || 0).toLocaleString()}</td>
                                                                )}
                                                            </tr>
                                                        );
                                                    });
                                                })()}
                                                {/* Module Summary Total Row in Print View */}
                                                <tr style={{ backgroundColor: '#fff7ed', borderTop: '2px solid #f97316', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                                    <td colSpan={!isFieldHidden('amount') ? totalColSpan : allColsCount} style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, fontSize: '9pt', color: '#111827', borderRight: !isFieldHidden('amount') ? '1px solid #fed7aa' : 'none', backgroundColor: '#fff7ed', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                                        Module Total ({section.name || `Module ${sIdx + 1}`}):
                                                    </td>
                                                    {!isFieldHidden('amount') && (
                                                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 900, fontSize: '9.5pt', color: '#ea580c', backgroundColor: '#fff7ed', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                                            {'₹' + sectionTotal.toLocaleString()}
                                                        </td>
                                                    )}
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </React.Fragment>
                            );
                        })}

                        {/* ===== PAGE 5: TERMS & CONDITIONS & MATERIAL SPECIFICATIONS ===== */}
                        <div className="page-break-terms-conditions" style={{ minHeight: 'auto', padding: '24px 16px', backgroundColor: '#ffffff', borderRadius: '16px', border: '1.5px solid #fed7aa', marginTop: '24px', position: 'relative', boxSizing: 'border-box', pageBreakBefore: 'always', breakBefore: 'page' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
                                <div>
                                    <PageHeader />

                                    {/* Title */}
                                    <div style={{ marginBottom: '20px', marginTop: '16px' }}>
                                        <h2 style={{ margin: 0, fontSize: '18pt', fontWeight: 900, color: '#0f172a' }}>TERMS, CONDITIONS &amp; MATERIAL SPECIFICATIONS</h2>
                                        <div style={{ width: '80px', height: '4px', backgroundColor: '#ea580c', marginTop: '6px' }} />
                                    </div>

                                    {/* Terms List Box */}
                                    <div style={{ border: '1.5px solid #fed7aa', borderRadius: '14px', padding: '24px', backgroundColor: '#fffdfa', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', position: 'relative' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                                            {(() => {
                                                let numCounter = 0;
                                                return termsList.map((term, idx) => {
                                                    const isSubMilestone = idx >= 4 && idx <= 7;
                                                    const isSectionHeader = idx === 3;
                                                    if (!isSubMilestone) {
                                                        numCounter++;
                                                    }
                                                    const subBulletLabels = ['a.', 'b.', 'c.', 'd.'];
                                                    const bulletLabel = isSubMilestone
                                                        ? (subBulletLabels[idx - 4] || '•')
                                                        : `${numCounter}.`;

                                                    return (
                                                        <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', fontSize: '9.2pt', color: '#1e293b', lineHeight: 1.5, paddingLeft: isSubMilestone ? '16px' : '0' }}>
                                                            <span style={{ fontWeight: 800, color: '#ea580c', marginRight: '6px', flexShrink: 0 }}>{bulletLabel}</span>
                                                            <span style={{ flex: 1, fontWeight: isSectionHeader || term.startsWith('Material') || term.startsWith('Finishes') || term.startsWith('Warranty') || term.startsWith('Note') ? 800 : 500, color: isSectionHeader ? '#ea580c' : '#334155' }}>
                                                                {term}
                                                            </span>
                                                        </div>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    </div>
                                </div>

                                {/* Footer Account Details & Signatures */}
                                <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '2px dashed #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontSize: '9.5pt', fontWeight: 900, color: '#0f172a' }}>
                                            Account Name: <span style={{ color: '#ea580c' }}>Livincart and services private limited</span>
                                        </div>
                                        <div style={{ fontSize: '8pt', color: '#64748b', marginTop: '4px' }}>
                                            Note: Terms &amp; conditions are part of the official quotation agreement.
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '8.5pt', color: '#64748b', fontWeight: 600 }}>Authorized Signature</div>
                                        <div style={{ margin: '6px 0', height: '42px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                                            <img src={liveCartSignature} alt="Signature" style={{ height: '42px', objectFit: 'contain' }} />
                                        </div>
                                        <div style={{ fontSize: '10pt', fontWeight: 900, color: '#0f172a' }}>Livincart &amp; Services Pvt Ltd</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            })()}

            {isPrintingVersion && selectedVersionData && (
                <div className="quote-container print-area" style={{ backgroundColor: '#ffffff', minHeight: '100vh', padding: 0, position: 'absolute', top: 0, left: 0, width: '100%', zIndex: 999999 }}>

                    {/* PAGE 1: COVER PAGE */}
                    {showCoverPage && (
                        <div className="page-break-cover" style={{ minHeight: '260mm', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff', padding: '60px 16px', position: 'relative', boxSizing: 'border-box' }}>
                            <div style={{ marginBottom: '40px', display: 'flex', justifyContent: 'center' }}>
                                <img src={liveLogo} alt="Livincart Logo" style={{ height: '140px', objectFit: 'contain' }} />
                            </div>
                            <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                                <h2 style={{ fontSize: '18pt', fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0', letterSpacing: '0.5px' }}>
                                    COMPANY : LIVINCART AND SERVICES PRIVATE LIMITED
                                </h2>
                            </div>
                            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                                <p style={{ fontSize: '12pt', fontWeight: 800, color: '#10b981', margin: 0, letterSpacing: '1px' }}>
                                    GST : 37AAGCL5523Q1ZX
                                </p>
                            </div>
                            <div style={{ border: '1.5px solid #cbd5e1', borderRadius: '30px', padding: '10px 30px', marginBottom: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ fontSize: '10.5pt', fontWeight: 800, color: '#475569', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                                    OFFICIAL QUOTATION &amp; PROJECT ESTIMATE (VERSION {selectedVersionData.versionNum})
                                </span>
                            </div>
                            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                                <p style={{ fontSize: '11pt', fontWeight: 700, color: '#64748b', margin: 0 }}>
                                    Quote No: QTN-{project?.project_id || '16'}-v{selectedVersionData.versionNum} &nbsp;•&nbsp; Date: {new Date(selectedVersionData.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* PAGE 2: PROJECT INFORMATION */}
                    <div className="page-break-project-info" style={{ minHeight: 'auto', padding: '16px 12px 20px', backgroundColor: '#ffffff', position: 'relative', boxSizing: 'border-box' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '2px solid #0f172a', paddingBottom: '12px', marginBottom: '30px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <img src={liveLogo} alt="Logo" style={{ height: '44px', objectFit: 'contain' }} />
                                <div>
                                    <h1 style={{ margin: 0, fontSize: '14pt', fontWeight: 800, color: '#0f172a' }}>Livincart Private Limited</h1>
                                    <p style={{ margin: 0, fontSize: '8pt', color: '#64748b', fontWeight: 600 }}>Official Quotation &amp; Estimation Workspace</p>
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <h2 style={{ margin: '0 0 2px 0', fontSize: '9pt', fontWeight: 800, color: '#0f172a' }}>COMPANY : LIVINCART AND SERVICES PRIVATE LIMITED</h2>
                                <p style={{ margin: 0, fontSize: '9pt', fontWeight: 800, color: '#10b981' }}>GST : 37AAGCL5523Q1ZX</p>
                            </div>
                        </div>
                        <h3 style={{ fontSize: '13pt', fontWeight: 800, color: '#0f172a', marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Project Information &amp; Scope Details (Version {selectedVersionData.versionNum})
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '30px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '8.5pt', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Proposal Created For</label>
                                    <div style={{ fontSize: '11pt', fontWeight: 800, color: '#0f172a' }}>{proposalFor || project?.client_name || 'Valued Client'}</div>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '8.5pt', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Project ID</label>
                                    <div style={{ fontSize: '11pt', fontWeight: 800, color: '#0f172a' }}>{projectIdVal}</div>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '8.5pt', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Saved On</label>
                                    <div style={{ fontSize: '11pt', fontWeight: 800, color: '#0f172a' }}>{new Date(selectedVersionData.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '8.5pt', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Project Category</label>
                                    <div style={{ fontSize: '11pt', fontWeight: 800, color: '#0f172a' }}>{projectCategory}</div>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '8.5pt', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Time for Production</label>
                                    <div style={{ fontSize: '11pt', fontWeight: 800, color: '#0f172a' }}>{productionTime}</div>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '8.5pt', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Designer / Manager</label>
                                    <div style={{ fontSize: '11pt', fontWeight: 800, color: '#0f172a' }}>{designerName || 'Livincart Team'}</div>
                                </div>
                            </div>
                        </div>
                        <div style={{ marginBottom: '30px' }}>
                            <label style={{ display: 'block', fontSize: '8.5pt', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Scope of Work Summary</label>
                            <div style={{ fontSize: '10pt', fontWeight: 600, color: '#334155', lineHeight: '1.5', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                {scopeOfWork}
                            </div>
                        </div>
                        <PageFooter />
                    </div>

                    {/* PAGE 3: MODULES SUMMARY */}
                    <div className="page-break-modules-summary" style={{ minHeight: 'auto', padding: '16px 12px 20px', backgroundColor: '#ffffff', position: 'relative', boxSizing: 'border-box' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '2px solid #0f172a', paddingBottom: '12px', marginBottom: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <img src={liveLogo} alt="Logo" style={{ height: '44px', objectFit: 'contain' }} />
                                <div>
                                    <h1 style={{ margin: 0, fontSize: '14pt', fontWeight: 800, color: '#0f172a' }}>Livincart Private Limited</h1>
                                    <p style={{ margin: 0, fontSize: '8pt', color: '#64748b', fontWeight: 600 }}>Modules Summary — Version {selectedVersionData.versionNum}</p>
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <h2 style={{ margin: '0 0 2px 0', fontSize: '9pt', fontWeight: 800, color: '#0f172a' }}>COMPANY : LIVINCART AND SERVICES PRIVATE LIMITED</h2>
                                <p style={{ margin: 0, fontSize: '9pt', fontWeight: 800, color: '#10b981' }}>GST : 37AAGCL5523Q1ZX</p>
                            </div>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px', fontSize: '9.5pt' }}>
                            <thead>
                                <tr style={{ backgroundColor: 'rgb(254, 143, 62)', color: '#ffffff' }}>
                                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#ffffff' }}>#</th>
                                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#ffffff' }}>Module Name</th>
                                    <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#ffffff' }}>Total Items</th>
                                    <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#ffffff' }}>Amount (₹)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {selectedVersionData.sections.map((sec, si) => {
                                    const secGross = sec.items.reduce((sum, item) => {
                                        if (item.brand === 'HEADER') return sum;
                                        const isLump = item.pricing_mode === 'lumpsum' || (!item.width && !item.height && !item.sft);
                                        const qty = Math.max(0, parseFloat(item.quantity as any) || 0);
                                        const rate = Math.max(0, parseFloat(item.rate as any) || 0);
                                        const base = (isLump || qty === 0) ? rate : (qty * rate);
                                        return sum + (base > 0 ? base : (item.amount || 0));
                                    }, 0);
                                    const itemCount = sec.items.filter(it => it.brand !== 'HEADER').length;
                                    return (
                                        <tr key={sec.id} style={{ borderBottom: '1px solid #f3f4f6', backgroundColor: si % 2 === 1 ? '#fffdf9' : '#ffffff' }}>
                                            <td style={{ padding: '10px 14px', fontWeight: 700, color: '#f97316' }}>{si + 1}</td>
                                            <td style={{ padding: '10px 14px', fontWeight: 800, color: '#111827' }}>{sec.name || `Module ${si + 1}`}</td>
                                            <td style={{ padding: '10px 14px', textAlign: 'center', color: '#374151', fontWeight: 600 }}>{itemCount}</td>
                                            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#ea580c' }}>₹ {secGross.toLocaleString()}</td>
                                        </tr>
                                    );
                                })}
                                <tr style={{ borderTop: '2.5px solid #fed7aa', backgroundColor: '#fffaf0' }}>
                                    <td colSpan={3} style={{ padding: '12px 14px', fontWeight: 800, textAlign: 'right', fontSize: '10pt', color: '#111827' }}>Grand Total Amount</td>
                                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 900, color: '#ea580c', fontSize: '11.5pt' }}>₹ {selectedVersionData.total.toLocaleString()}</td>
                                </tr>
                            </tbody>
                        </table>
                        <div style={{ padding: '14px 18px', backgroundColor: '#fffaf0', borderRadius: '8px', border: '1px solid #fed7aa', marginBottom: '24px' }}>
                            <span style={{ fontSize: '8.5pt', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Total Amount In Words</span>
                            <span style={{ fontSize: '10.5pt', fontWeight: 800, color: '#111827' }}>{numberToWords(selectedVersionData.total)}</span>
                        </div>
                        <PageFooter />
                    </div>

                    {/* PAGES 4+: PER-MODULE DETAIL TABLES */}
                    {selectedVersionData.sections.map((sec, si) => {
                        const secTotal = sec.items.reduce((a, it) => a + (it.amount || 0), 0);
                        const secHeadings = (sec as any).custom_headings || customHeadings || {};
                        return (
                            <div key={sec.id} className="page-break-section" style={{ minHeight: 'auto', padding: '12px 12px 20px', backgroundColor: '#ffffff', position: 'relative', boxSizing: 'border-box', pageBreakInside: 'auto', breakInside: 'auto', pageBreakAfter: 'auto', breakAfter: 'auto', marginBottom: '24px' }}>
                                {/* Section Header & Title wrapped together — prevented from separating from table */}
                                <div style={{ pageBreakAfter: 'avoid', breakAfter: 'avoid', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '2px solid #0f172a', paddingBottom: '12px', marginBottom: '12px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <img src={liveLogo} alt="Logo" style={{ height: '44px', objectFit: 'contain' }} />
                                            <div>
                                                <h1 style={{ margin: 0, fontSize: '14pt', fontWeight: 800, color: '#0f172a' }}>Livincart Private Limited</h1>
                                                <p style={{ margin: 0, fontSize: '8pt', color: '#64748b', fontWeight: 600 }}>Module {si + 1}: {sec.name || `Module ${si + 1}`}</p>
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <h2 style={{ margin: '0 0 2px 0', fontSize: '9pt', fontWeight: 800, color: '#0f172a' }}>COMPANY : LIVINCART AND SERVICES PRIVATE LIMITED</h2>
                                            <p style={{ margin: 0, fontSize: '9pt', fontWeight: 800, color: '#10b981' }}>GST : 37AAGCL5523Q1ZX</p>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                        <span style={{ fontSize: '11pt', fontWeight: 900, color: '#0f172a', textTransform: 'uppercase' }}>Module {si + 1}: {sec.name || `Module ${si + 1}`}</span>
                                        {!isFieldHidden('amount') && (
                                            <span style={{ fontSize: '11.5pt', fontWeight: 900, color: '#ea580c' }}>₹ {secTotal.toLocaleString('en-IN')}</span>
                                        )}
                                    </div>
                                </div>

                                <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: '8pt', border: '1px solid #e2e8f0', marginBottom: '16px', pageBreakInside: 'auto', breakInside: 'auto' }}>
                                    <thead style={{ display: 'table-header-group', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                                        <tr style={{ backgroundColor: headerBgColor || 'rgb(254, 143, 62)', color: '#ffffff', borderBottom: `1px solid ${headerBgColor || 'rgb(254, 143, 62)'}`, pageBreakInside: 'avoid', breakInside: 'avoid', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                            <th style={{ padding: '8px 4px', textAlign: 'center', fontWeight: 700, color: '#ffffff', fontSize: '8.5pt', width: '4%', borderRight: '1px solid rgba(255, 255, 255, 0.15)', backgroundColor: headerBgColor || 'rgb(254, 143, 62)', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>#</th>
                                            {!isFieldHidden('particulars') && (
                                                <th style={{ padding: '8px 6px', textAlign: 'left', fontWeight: 700, color: '#ffffff', fontSize: '8.5pt', width: '22%', borderRight: '1px solid rgba(255, 255, 255, 0.15)', backgroundColor: headerBgColor || 'rgb(254, 143, 62)', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>{secHeadings.particulars || customHeadings.particulars || 'Product Description'}</th>
                                            )}
                                            {!isFieldHidden('shutterMaterial') && (
                                                <th style={{ padding: '8px 6px', textAlign: 'left', fontWeight: 700, color: '#ffffff', fontSize: '8.5pt', width: '14%', borderRight: '1px solid rgba(255, 255, 255, 0.15)', backgroundColor: headerBgColor || 'rgb(254, 143, 62)', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>{secHeadings.shutterMaterial || customHeadings.shutterMaterial || 'Shutter Material | Finish'}</th>
                                            )}
                                            {!isFieldHidden('carcassMaterial') && (
                                                <th style={{ padding: '8px 6px', textAlign: 'left', fontWeight: 700, color: '#ffffff', fontSize: '8.5pt', width: '14%', borderRight: '1px solid rgba(255, 255, 255, 0.15)', backgroundColor: headerBgColor || 'rgb(254, 143, 62)', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>{secHeadings.carcassMaterial || customHeadings.carcassMaterial || 'Carcass Material | Color'}</th>
                                            )}
                                            {!isFieldHidden('dimensions') && (
                                                <th style={{ padding: '6px 6px', textAlign: 'center', fontWeight: 700, color: '#ffffff', fontSize: '8pt', width: '12%', borderRight: '1px solid rgba(255, 255, 255, 0.15)', backgroundColor: headerBgColor || 'rgb(254, 143, 62)', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>{secHeadings.dimensions || customHeadings.dimensions || 'Dimensions (W × H × D) (mm)'}</th>
                                            )}
                                            {!isFieldHidden('rate') && (
                                                <th style={{ padding: '6px 6px', textAlign: 'center', fontWeight: 700, color: '#ffffff', fontSize: '8pt', width: '9%', borderRight: '1px solid rgba(255, 255, 255, 0.15)', backgroundColor: headerBgColor || 'rgb(254, 143, 62)', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>{secHeadings.rate || customHeadings.rate || 'Rate / SFT'}</th>
                                            )}
                                            {!isFieldHidden('qty') && (
                                                <th style={{ padding: '8px 4px', textAlign: 'center', fontWeight: 700, color: '#ffffff', fontSize: '8.5pt', width: '4.5%', borderRight: '1px solid rgba(255, 255, 255, 0.15)', backgroundColor: headerBgColor || 'rgb(254, 143, 62)', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>{secHeadings.qty || customHeadings.qty || 'QTY'}</th>
                                            )}
                                            {!isFieldHidden('discount') && (
                                                <th style={{ padding: '8px 4px', textAlign: 'center', fontWeight: 700, color: '#ffffff', fontSize: '8.5pt', width: '4.5%', borderRight: '1px solid rgba(255, 255, 255, 0.15)', backgroundColor: headerBgColor || 'rgb(254, 143, 62)', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>{secHeadings.disc || secHeadings.discount || customHeadings.disc || customHeadings.discount || 'Disc %'}</th>
                                            )}
                                            {!isFieldHidden('gst') && (
                                                <th style={{ padding: '8px 4px', textAlign: 'center', fontWeight: 700, color: '#ffffff', fontSize: '8.5pt', width: '5%', borderRight: '1px solid rgba(255, 255, 255, 0.15)', backgroundColor: headerBgColor || 'rgb(254, 143, 62)', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>{secHeadings.gst || customHeadings.gst || 'GST %'}</th>
                                            )}
                                            {!isFieldHidden('amount') && (
                                                <th style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 700, color: '#ffffff', fontSize: '8.5pt', width: '10%', backgroundColor: headerBgColor || 'rgb(254, 143, 62)', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>{secHeadings.amount || customHeadings.amount || 'Amount'}</th>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(() => {
                                            let itemCounter = 0;
                                            const vTotalColSpan = 1 +
                                                (!isFieldHidden('particulars') ? 1 : 0) +
                                                (!isFieldHidden('shutterMaterial') ? 1 : 0) +
                                                (!isFieldHidden('carcassMaterial') ? 1 : 0) +
                                                (!isFieldHidden('dimensions') ? 1 : 0) +
                                                (!isFieldHidden('rate') ? 1 : 0) +
                                                (!isFieldHidden('qty') ? 1 : 0) +
                                                (!isFieldHidden('discount') ? 1 : 0) +
                                                (!isFieldHidden('gst') ? 1 : 0);
                                            const vAllColsCount = vTotalColSpan + (!isFieldHidden('amount') ? 1 : 0);
                                            return sec.items.map((item, iIdx) => {
                                                if (item.brand === 'HEADER') {
                                                    itemCounter = 0;
                                                    let subTotal = 0;
                                                    for (let k = iIdx + 1; k < sec.items.length; k++) {
                                                        if (sec.items[k].brand === 'HEADER') break;
                                                        subTotal += (parseFloat(String(sec.items[k].amount)) || 0);
                                                    }
                                                    return (
                                                        <tr key={item.id || iIdx} style={{ pageBreakInside: 'avoid', breakInside: 'avoid', pageBreakAfter: 'avoid', breakAfter: 'avoid', backgroundColor: '#fff7ed', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                                            <td colSpan={!isFieldHidden('amount') ? vTotalColSpan : vAllColsCount} style={{ padding: '8px 12px', backgroundColor: '#fff7ed', borderTop: '1.5px solid #fed7aa', borderBottom: '2px solid #ea580c', fontWeight: 900, color: '#ea580c', fontSize: '9pt', textTransform: 'uppercase', letterSpacing: '0.5px', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                                                {item.particulars}
                                                            </td>
                                                            {!isFieldHidden('amount') && (
                                                                <td style={{ padding: '8px 12px', backgroundColor: '#fff7ed', borderTop: '1.5px solid #fed7aa', borderBottom: '2px solid #ea580c', fontWeight: 900, color: '#ea580c', fontSize: '9pt', textAlign: 'right', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact', whiteSpace: 'nowrap' }}>
                                                                    ₹ {subTotal.toLocaleString('en-IN')}
                                                                </td>
                                                            )}
                                                        </tr>
                                                    );
                                                }
                                                itemCounter++;
                                                const isLumpsumItem = item.pricing_mode === 'lumpsum' || (!item.width && !item.height && !item.sft);
                                                const lumpsumVal = parseFloat(String(item.rate)) || parseFloat(String(item.amount)) || 0;
                                                const shutter = (item as any).shutter_material || (item as any).shutterMaterial || (item.brand && item.brand !== 'HEADER' ? item.brand : '—');
                                                const carcass = (item as any).carcass_material || (item as any).carcassMaterial || (item.unit && !['SFT', 'RFT', 'NOS', 'SQFT', 'MTR', 'RMT'].includes(String(item.unit).toUpperCase().trim()) ? item.unit : (item.unit || '—'));

                                                return (
                                                    <tr key={item.id || iIdx} style={{ borderBottom: '1px solid #fed7aa', backgroundColor: itemCounter % 2 === 0 ? '#fffaf5' : '#ffffff', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact', pageBreakInside: 'auto', breakInside: 'auto' }}>
                                                        <td style={{ padding: '10px 4px', verticalAlign: 'top', textAlign: 'center', fontWeight: 700, color: '#475569', fontSize: '8pt', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{itemCounter}</td>
                                                        {!isFieldHidden('particulars') && (
                                                            <td style={{ padding: '10px 8px', verticalAlign: 'top', borderRight: '1px solid #e2e8f0', whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                                                                {item.image_url && (
                                                                    <img src={item.image_url} alt="Item" style={{ width: '38px', height: '38px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #e2e8f0', float: 'left', marginRight: '8px', marginBottom: '4px' }} />
                                                                )}
                                                                <div style={{ fontWeight: 800, color: '#111827', fontSize: '8.5pt', lineHeight: 1.4, marginBottom: '4px', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                                                                    {item.category && <span style={{ color: '#ea580c', fontWeight: 800, fontSize: '7.5pt', marginRight: '5px', backgroundColor: '#fff7ed', padding: '1px 5px', borderRadius: '3px', border: '1px solid #fed7aa' }}>[{item.category}]</span>}
                                                                    {item.particulars}
                                                                </div>
                                                                {item.hsn_sac && <div style={{ fontSize: '7.5pt', color: '#475569', lineHeight: 1.4, wordBreak: 'break-word', overflowWrap: 'break-word', clear: 'both' }}>{item.hsn_sac}</div>}
                                                            </td>
                                                        )}
                                                        {!isFieldHidden('shutterMaterial') && (
                                                            <td style={{ padding: '10px 8px', verticalAlign: 'top', fontSize: '8pt', color: '#374151', fontWeight: 600, textAlign: 'left', lineHeight: 1.45, borderRight: '1px solid #e2e8f0', whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'break-word' }}>{shutter}</td>
                                                        )}
                                                        {!isFieldHidden('carcassMaterial') && (
                                                            <td style={{ padding: '10px 8px', verticalAlign: 'top', fontSize: '8pt', color: '#374151', fontWeight: 600, textAlign: 'left', lineHeight: 1.45, borderRight: '1px solid #e2e8f0', whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'break-word' }}>{carcass}</td>
                                                        )}
                                                        {!isFieldHidden('dimensions') && (
                                                            <td style={{ padding: '8px 6px', verticalAlign: 'top', fontSize: '7.5pt', textAlign: 'left', fontWeight: 600, color: '#111827', borderRight: '1px solid #e2e8f0' }}>
                                                                {isLumpsumItem ? (
                                                                    <span style={{ color: '#16a34a', fontWeight: 800 }}>Lumpsum: ₹{lumpsumVal.toLocaleString('en-IN')}</span>
                                                                ) : (
                                                                    <div style={{ lineHeight: 1.3, fontWeight: 600 }}>
                                                                        <div>Width: {item.width || 0}</div>
                                                                        <div>Height: {item.height || 0}</div>
                                                                        <div>Depth: {item.sft || 0}</div>
                                                                        {(() => {
                                                                            const sftVal = computeSqft(item.width, item.height, item.sft, item.pricing_mode);
                                                                            return sftVal > 0 ? (
                                                                                <div style={{ color: '#ea580c', fontWeight: 700, fontSize: '7.2pt', marginTop: '2px', wordBreak: 'break-all' }} title={`Exact SFT: ${Number(sftVal.toFixed(2))}`}>
                                                                                    {Number(sftVal.toFixed(2))} SFT
                                                                                </div>
                                                                            ) : null;
                                                                        })()}
                                                                    </div>
                                                                )}
                                                            </td>
                                                        )}
                                                        {!isFieldHidden('rate') && (
                                                            <td style={{ padding: '10px 8px', verticalAlign: 'top', textAlign: 'center', fontWeight: 700, color: '#111827', fontSize: '8pt', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{isLumpsumItem ? '—' : (item.rate_per_sft ? '₹' + item.rate_per_sft : (item.rate ? '₹' + item.rate : '—'))}</td>
                                                        )}
                                                        {!isFieldHidden('qty') && (
                                                            <td style={{ padding: '10px 8px', verticalAlign: 'top', textAlign: 'center', fontWeight: 700, color: '#111827', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{isLumpsumItem ? ((item.quantity && Number(item.quantity) > 0) ? item.quantity : '—') : (item.quantity || 0)}</td>
                                                        )}
                                                        {!isFieldHidden('discount') && (
                                                            <td style={{ padding: '10px 8px', verticalAlign: 'top', textAlign: 'center', fontWeight: 600, color: '#ea580c', fontSize: '8pt', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{item.discount_percent ? item.discount_percent + '%' : '0%'}</td>
                                                        )}
                                                        {!isFieldHidden('gst') && (
                                                            <td style={{ padding: '10px 8px', verticalAlign: 'top', textAlign: 'center', fontWeight: 600, color: '#475569', fontSize: '8pt', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{item.gst_rate !== undefined ? item.gst_rate + '%' : '18%'}</td>
                                                        )}
                                                        {!isFieldHidden('amount') && (
                                                            <td style={{ padding: '10px 8px', verticalAlign: 'top', textAlign: 'right', fontWeight: 800, color: '#ea580c', whiteSpace: 'nowrap' }}>{'₹' + (item.amount || 0).toLocaleString('en-IN')}</td>
                                                        )}
                                                    </tr>
                                                );
                                            });
                                        })()}
                                        <tr style={{ backgroundColor: '#fffaf0', fontWeight: 800, borderTop: '1.5px solid #fed7aa', pageBreakBefore: 'avoid', breakBefore: 'avoid', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                                            <td colSpan={!isFieldHidden('amount') ? (1 + (!isFieldHidden('particulars') ? 1 : 0) + (!isFieldHidden('shutterMaterial') ? 1 : 0) + (!isFieldHidden('carcassMaterial') ? 1 : 0) + (!isFieldHidden('dimensions') ? 1 : 0) + (!isFieldHidden('rate') ? 1 : 0) + (!isFieldHidden('qty') ? 1 : 0) + (!isFieldHidden('discount') ? 1 : 0) + (!isFieldHidden('gst') ? 1 : 0)) : (1 + (!isFieldHidden('particulars') ? 1 : 0) + (!isFieldHidden('shutterMaterial') ? 1 : 0) + (!isFieldHidden('carcassMaterial') ? 1 : 0) + (!isFieldHidden('dimensions') ? 1 : 0) + (!isFieldHidden('rate') ? 1 : 0) + (!isFieldHidden('qty') ? 1 : 0) + (!isFieldHidden('discount') ? 1 : 0) + (!isFieldHidden('gst') ? 1 : 0) + (!isFieldHidden('amount') ? 1 : 0))} style={{ padding: '10px 10px', textAlign: 'right', fontSize: '9pt', color: '#111827', borderRight: !isFieldHidden('amount') ? '1px solid #fed7aa' : 'none' }}>Module Total ({sec.name || `Module ${si + 1}`}):</td>
                                            {!isFieldHidden('amount') && (
                                                <td style={{ padding: '10px 10px', textAlign: 'right', fontSize: '9.5pt', color: '#ea580c', fontWeight: 900, whiteSpace: 'nowrap' }}>
                                                    ₹ {secTotal.toLocaleString('en-IN')}
                                                </td>
                                            )}
                                        </tr>
                                    </tbody>
                                </table>

                                <PageFooter />
                            </div>
                        );
                    })}

                    {/* ===== PAGE 5: TERMS & CONDITIONS & MATERIAL SPECIFICATIONS ===== */}
                    <div className="page-break-terms-conditions" style={{ minHeight: 'auto', padding: '24px 16px', backgroundColor: '#ffffff', borderRadius: '16px', border: '1.5px solid #fed7aa', marginTop: '24px', position: 'relative', boxSizing: 'border-box', pageBreakBefore: 'always', breakBefore: 'page' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
                            <div>
                                <PageHeader />

                                {/* Title */}
                                <div style={{ marginBottom: '20px', marginTop: '16px' }}>
                                    <h2 style={{ margin: 0, fontSize: '18pt', fontWeight: 900, color: '#0f172a' }}>TERMS, CONDITIONS &amp; MATERIAL SPECIFICATIONS</h2>
                                    <div style={{ width: '80px', height: '4px', backgroundColor: '#ea580c', marginTop: '6px' }} />
                                </div>

                                {/* Terms List Box */}
                                <div style={{ border: '1.5px solid #fed7aa', borderRadius: '14px', padding: '24px', backgroundColor: '#fffdfa', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', position: 'relative' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                                        {(() => {
                                            let numCounter = 0;
                                            return termsList.map((term, idx) => {
                                                const isSubMilestone = idx >= 4 && idx <= 7;
                                                const isSectionHeader = idx === 3;
                                                if (!isSubMilestone) {
                                                    numCounter++;
                                                }
                                                const subBulletLabels = ['a.', 'b.', 'c.', 'd.'];
                                                const bulletLabel = isSubMilestone
                                                    ? (subBulletLabels[idx - 4] || '•')
                                                    : `${numCounter}.`;

                                                return (
                                                    <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', fontSize: '9.2pt', color: '#1e293b', lineHeight: 1.5, paddingLeft: isSubMilestone ? '16px' : '0' }}>
                                                        <span style={{ fontWeight: 800, color: '#ea580c', marginRight: '6px', flexShrink: 0 }}>{bulletLabel}</span>
                                                        <span style={{ flex: 1, fontWeight: isSectionHeader || term.startsWith('Material') || term.startsWith('Finishes') || term.startsWith('Warranty') || term.startsWith('Note') ? 800 : 500, color: isSectionHeader ? '#ea580c' : '#334155' }}>
                                                            {term}
                                                        </span>
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                </div>
                            </div>

                            {/* Footer Account Details & Signatures */}
                            <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '2px dashed #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontSize: '9.5pt', fontWeight: 900, color: '#0f172a' }}>
                                        Account Name: <span style={{ color: '#ea580c' }}>Livincart and services private limited</span>
                                    </div>
                                    <div style={{ fontSize: '8pt', color: '#64748b', marginTop: '4px' }}>
                                        Note: Terms &amp; conditions are part of the official quotation agreement.
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '8.5pt', color: '#64748b', fontWeight: 600 }}>Authorized Signature</div>
                                    <div style={{ margin: '6px 0', height: '42px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                                        <img src={liveCartSignature} alt="Signature" style={{ height: '42px', objectFit: 'contain' }} />
                                    </div>
                                    <div style={{ fontSize: '10pt', fontWeight: 900, color: '#0f172a' }}>Livincart &amp; Services Pvt Ltd</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== CATEGORY-WISE DISCOUNT POPUP MODAL ===== */}
            {showCategoryDiscountModal && (() => {
                // Find all unique categories actually selected or used in this quotation's items
                const activeQuoteCategories: string[] = [];
                const usedCatsSet = new Set<string>();

                sections.forEach(sec => {
                    sec.items.forEach(item => {
                        if (item.brand === 'HEADER') return;
                        const cat = (item.category || '').trim();
                        if (cat && !usedCatsSet.has(cat.toLowerCase())) {
                            usedCatsSet.add(cat.toLowerCase());
                            const canonical = COMMON_MODULE_NAMES.find(c => c.toLowerCase() === cat.toLowerCase()) || cat;
                            activeQuoteCategories.push(canonical);
                        }
                    });
                });

                // Fallback if no item has category assigned: check for items matching COMMON_MODULE_NAMES by section name / particulars
                if (activeQuoteCategories.length === 0) {
                    COMMON_MODULE_NAMES.forEach(cat => {
                        let testTotal = 0;
                        const targetCat = cat.trim().toLowerCase();
                        sections.forEach(sec => {
                            sec.items.forEach(item => {
                                if (item.brand === 'HEADER') return;
                                const secName = (sec.name || '').trim().toLowerCase();
                                const itemParticulars = (item.particulars || '').trim().toLowerCase();
                                if (secName === targetCat || secName.includes(targetCat) || itemParticulars.includes(targetCat)) {
                                    testTotal += (item.amount || 0);
                                }
                            });
                        });
                        if (testTotal > 0 && !usedCatsSet.has(cat.toLowerCase())) {
                            usedCatsSet.add(cat.toLowerCase());
                            activeQuoteCategories.push(cat);
                        }
                    });
                }

                // Calculate exceeding categories & totals across active categories
                const exceedingPendingCats: string[] = [];
                let modalGrandSubtotal = 0;
                let modalGrandDiscountAmt = 0;

                activeQuoteCategories.forEach(c => {
                    const norm = c.trim().toLowerCase();
                    const foundKey = Object.keys(tempCategoryDiscounts).find(k => {
                        const nk = k.trim().toLowerCase();
                        return nk === norm || nk.replace(/\s+/g, '') === norm.replace(/\s+/g, '');
                    });
                    const curr = foundKey ? tempCategoryDiscounts[foundKey] : undefined;
                    let cTot = 0;
                    sections.forEach(sec => {
                        sec.items.forEach(it => {
                            if (it.brand === 'HEADER') return;
                            const itCat = (it.category || '').trim().toLowerCase();
                            const secN = (sec.name || '').trim().toLowerCase();
                            const itPart = (it.particulars || '').trim().toLowerCase();
                            if ((itCat && (itCat === norm || itCat.includes(norm) || norm.includes(itCat))) ||
                                (!itCat && (secN.includes(norm) || norm.includes(secN) || itPart.includes(norm)))) {
                                cTot += (it.amount || 0);
                            }
                        });
                    });
                    modalGrandSubtotal += cTot;

                    if (curr && curr.value > 0) {
                        const sysLimit = resolveCategoryMaxLimit(c);
                        const effPct = curr.type === 'percent' ? curr.value : (cTot > 0 ? (curr.value / cTot) * 100 : 0);
                        const discAmt = curr.type === 'percent' ? (cTot * curr.value) / 100 : curr.value;
                        modalGrandDiscountAmt += discAmt;
                        const isApprovedForVal = Boolean(
                            curr.adminApproved &&
                            curr.approvedValue !== undefined &&
                            curr.approvedValue !== null &&
                            curr.value <= Number(curr.approvedValue)
                        );
                        if (effPct > sysLimit && !isApprovedForVal) {
                            exceedingPendingCats.push(c);
                        }
                    }
                });

                return (
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
                            maxWidth: '1040px',
                            maxHeight: '92vh',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
                            border: '1.5px solid #fed7aa',
                            position: 'relative'
                        }}>
                            {/* Header */}
                            <div style={{ padding: '16px 22px', backgroundColor: '#fca412', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <span style={{ fontSize: '1.3rem' }}>🏷️</span>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, letterSpacing: '0.3px' }}>Category-Wise Discount Manager</h3>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    {canApproveDiscounts ? (
                                        <span style={{
                                            padding: '4px 12px',
                                            borderRadius: '20px',
                                            backgroundColor: '#ffffff',
                                            color: '#ea580c',
                                            fontWeight: 800,
                                            fontSize: '0.75rem',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '5px',
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                        }}>
                                            👑 {isAdminUser ? 'Admin' : (String(effectiveUser?.role || '').toLowerCase().includes('design') ? 'Design Manager' : 'Business Manager')} (Approval Control)
                                        </span>
                                    ) : (
                                        <span style={{
                                            padding: '4px 12px',
                                            borderRadius: '20px',
                                            backgroundColor: 'rgba(255, 255, 255, 0.22)',
                                            color: '#ffffff',
                                            fontWeight: 700,
                                            fontSize: '0.75rem',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '5px'
                                        }}>
                                            👤 Sales Person Mode
                                        </span>
                                    )}
                                    <button
                                        onClick={() => setShowCategoryDiscountModal(false)}
                                        style={{ background: 'none', border: 'none', color: '#ffffff', fontSize: '1.4rem', fontWeight: 800, cursor: 'pointer', lineHeight: 1 }}
                                        title="Close"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>

                            {/* Pending Approvals Bar (only shown when categories exceed limit) */}
                            {exceedingPendingCats.length > 0 && (
                                <div style={{
                                    padding: '10px 20px',
                                    backgroundColor: '#fff7ed',
                                    borderBottom: '1.5px solid #fed7aa',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    flexWrap: 'wrap',
                                    gap: '10px'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{
                                            fontSize: '0.76rem',
                                            color: '#dc2626',
                                            fontWeight: 800,
                                            backgroundColor: '#fef2f2',
                                            padding: '4px 10px',
                                            borderRadius: '12px',
                                            border: '1px solid #fecaca'
                                        }}>
                                            🔒 {exceedingPendingCats.length} category discount(s) require Approval
                                        </span>
                                    </div>
                                    <div>
                                        {canApproveDiscounts ? (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setTempCategoryDiscounts(prev => {
                                                        const next = { ...prev };
                                                        exceedingPendingCats.forEach(cat => {
                                                            const curr = next[cat];
                                                            if (curr) {
                                                                next[cat] = {
                                                                    ...curr,
                                                                    adminApproved: true,
                                                                    approvedBy: effectiveUser?.name || 'Manager',
                                                                    approvedAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + ', ' + new Date().toLocaleDateString('en-IN'),
                                                                    approvedValue: curr.value
                                                                };
                                                            }
                                                        });
                                                        return next;
                                                    });
                                                    alert('All exceeding category discounts approved successfully!');
                                                }}
                                                style={{
                                                    padding: '5px 12px',
                                                    borderRadius: '6px',
                                                    border: 'none',
                                                    backgroundColor: '#16a34a',
                                                    color: '#ffffff',
                                                    fontSize: '0.78rem',
                                                    fontWeight: 800,
                                                    cursor: 'pointer',
                                                    boxShadow: '0 2px 4px rgba(22, 163, 74, 0.25)'
                                                }}
                                            >
                                                ✓ Approve All Exceeding
                                            </button>
                                        ) : (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                {activeDiscountRequest?.status === 'pending' ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <span style={{ fontSize: '0.75rem', color: '#c2410c', fontWeight: 800, backgroundColor: '#fff7ed', border: '1px solid #fed7aa', padding: '3px 8px', borderRadius: '6px' }}>
                                                            ⏳ Request #{activeDiscountRequest.id} Pending Approval
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => fetchActiveDiscountApprovalRequest()}
                                                            disabled={checkingDiscountStatus}
                                                            style={{
                                                                padding: '4px 10px',
                                                                borderRadius: '6px',
                                                                border: '1px solid #fed7aa',
                                                                backgroundColor: '#ffffff',
                                                                color: '#ea580c',
                                                                fontSize: '0.75rem',
                                                                fontWeight: 800,
                                                                cursor: 'pointer'
                                                            }}
                                                            title="Refresh approval status"
                                                        >
                                                            {checkingDiscountStatus ? 'Checking...' : '🔄 Check Status'}
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                                                        Click the send icon in any exceeding row to request permission.
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Body - Categories Table */}
                            <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1.5px solid #cbd5e1', color: '#334155' }}>
                                            <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 800 }}># Category Name</th>
                                            <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800 }}>Current Subtotal</th>
                                            <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 800, width: '95px' }}>Discount Type</th>
                                            <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 800, width: '95px' }}>Discount Value</th>
                                                                                        <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 800, minWidth: '170px' }}>Approval Status</th>
                                            <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#dc2626' }}>Discount Amount</th>
                                            <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>Net Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(() => {
                                            if (activeQuoteCategories.length === 0) {
                                                return (
                                                    <tr>
                                                        <td colSpan={7} style={{ textAlign: 'center', padding: '36px 20px', color: '#64748b' }}>
                                                            <div style={{ fontSize: '1.8rem', marginBottom: '8px' }}>📂</div>
                                                            <div style={{ fontWeight: 800, fontSize: '0.96rem', color: '#334155', marginBottom: '4px' }}>
                                                                No Categories Selected in Current Quotation
                                                            </div>
                                                            <div style={{ fontSize: '0.80rem', color: '#64748b' }}>
                                                                Please select a category for items in your quotation modules (e.g. Wood Work, Accessories, Painting). Only categories used in this quote will be displayed here.
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            }

                                            let grandSubtotal = 0;
                                            let grandDiscountAmt = 0;

                                            const rows = activeQuoteCategories.map((cat, idx) => {
                                                let catTotal = 0;
                                                const targetCat = cat.trim().toLowerCase();
                                                const matchedItems: any[] = [];

                                                sections.forEach(sec => {
                                                    sec.items.forEach(item => {
                                                        if (item.brand === 'HEADER') return;
                                                        const itemCat = (item.category || '').trim().toLowerCase();
                                                        const secName = (sec.name || '').trim().toLowerCase();
                                                        const itemParticulars = (item.particulars || '').trim().toLowerCase();

                                                        const isDirectMatch = (itemCat && (itemCat === targetCat || itemCat.includes(targetCat) || targetCat.includes(itemCat))) ||
                                                            (!itemCat && ((secName && (secName === targetCat || secName.includes(targetCat) || targetCat.includes(secName))) ||
                                                                (itemParticulars && (itemParticulars.includes(targetCat) || targetCat.includes(itemParticulars)))));

                                                        const isFallbackWoodWork = !itemCat && targetCat.includes('wood') && !secName.includes('accessories') && !secName.includes('ceiling') && !secName.includes('painting') && !secName.includes('lights') && !secName.includes('furniture') && !secName.includes('civil');

                                                        if (isDirectMatch || isFallbackWoodWork) {
                                                            catTotal += (item.amount || 0);
                                                            matchedItems.push(item);
                                                        }
                                                    });
                                                });

                                                // 1. Try finding in tempCategoryDiscounts (case-insensitive + ignoring whitespace)
                                                const normCat = cat.trim().toLowerCase();
                                                const foundKey = Object.keys(tempCategoryDiscounts).find(k => {
                                                    const nk = k.trim().toLowerCase();
                                                    return nk === normCat || nk.replace(/\s+/g, '') === normCat.replace(/\s+/g, '');
                                                });
                                                let currData = foundKey ? { ...tempCategoryDiscounts[foundKey] } : undefined;

                                                // Find configured category limitation from system settings
                                                const catLimit = resolveCategoryMaxLimit(cat);

                                                // 2. If not found or value is 0, auto-populate from existing item discounts in this category!
                                                if (!currData || currData.value === undefined || currData.value === null) {
                                                    const itemDiscounts = matchedItems
                                                        .map(i => parseFloat(i.discount_percent as any) || 0)
                                                        .filter(d => d > 0);

                                                    if (itemDiscounts.length > 0) {
                                                        currData = { type: 'percent', value: itemDiscounts[0], maxDiscount: catLimit, adminApproved: false };
                                                    } else if (parseFloat(globalDiscountInputValue) > 0) {
                                                        currData = { type: globalDiscountInputType, value: parseFloat(globalDiscountInputValue), maxDiscount: catLimit, adminApproved: false };
                                                    } else if (discountPercent > 0) {
                                                        currData = { type: 'percent', value: discountPercent, maxDiscount: catLimit, adminApproved: false };
                                                    } else {
                                                        currData = { type: 'percent', value: 0, maxDiscount: catLimit, adminApproved: false };
                                                    }
                                                }

                                                const rawVal = parseFloat(String(currData.value)) || 0;
                                                const discVal = currData.type === 'percent'
                                                    ? Math.min(100, Math.max(0, rawVal))
                                                    : Math.max(0, rawVal);

                                                const effectiveMax = catLimit;
                                                const effectivePercent = currData.type === 'percent'
                                                    ? discVal
                                                    : (catTotal > 0 ? (discVal / catTotal) * 100 : 0);

                                                const isExceeding = discVal > 0 && effectivePercent > effectiveMax;

                                                // Strict per-value approval:
                                                // Must be adminApproved AND have approvedValue >= discVal
                                                const isApprovedForCurrentValue = Boolean(
                                                    currData.adminApproved &&
                                                    currData.approvedValue !== undefined &&
                                                    currData.approvedValue !== null &&
                                                    discVal <= Number(currData.approvedValue)
                                                );

                                                let computedDiscount = 0;
                                                if (discVal > 0 && catTotal > 0) {
                                                    if (currData.type === 'percent') {
                                                        computedDiscount = Math.min(catTotal, Math.round(((catTotal * discVal) / 100) * 100) / 100);
                                                    } else {
                                                        computedDiscount = Math.min(catTotal, Math.round(discVal * 100) / 100);
                                                    }
                                                }
                                                const netAmt = Math.max(0, Math.round((catTotal - computedDiscount) * 100) / 100);

                                                grandSubtotal += catTotal;
                                                grandDiscountAmt += computedDiscount;

                                                const rowBg = isExceeding
                                                    ? (isApprovedForCurrentValue ? '#f0fdf4' : '#fff5f5')
                                                    : (idx % 2 === 1 ? '#fafafa' : '#ffffff');

                                                return (
                                                    <tr key={cat} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: rowBg, transition: 'background-color 0.15s' }}>
                                                        <td style={{ padding: '10px 12px', fontWeight: 800, color: '#0f172a' }}>
                                                            <span style={{ color: '#ea580c', marginRight: '6px' }}>{idx + 1}.</span> {cat}
                                                        </td>
                                                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#475569' }}>
                                                            ₹{catTotal.toLocaleString('en-IN', { minimumFractionDigits: catTotal % 1 !== 0 ? 2 : 0, maximumFractionDigits: 2 })}
                                                        </td>
                                                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                                                            <select
                                                                value={currData.type}
                                                                onChange={(e) => {
                                                                    const newType = e.target.value as 'percent' | 'flat';
                                                                    let safeVal = currData.value;
                                                                    if (newType === 'percent' && safeVal > 100) {
                                                                        safeVal = 100;
                                                                    }
                                                                    // Check if new type causes exceeding and reset approval if needed
                                                                    const newEffPct = newType === 'percent' ? safeVal : (catTotal > 0 ? (safeVal / catTotal) * 100 : 0);
                                                                    const stillExceeding = safeVal > 0 && newEffPct > effectiveMax;
                                                                    setTempCategoryDiscounts(prev => ({
                                                                        ...prev,
                                                                        [cat]: {
                                                                            ...currData,
                                                                            type: newType,
                                                                            value: safeVal,
                                                                            adminApproved: stillExceeding ? false : currData.adminApproved
                                                                        }
                                                                    }));
                                                                }}
                                                                style={{ padding: '4px 6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.80rem', fontWeight: 700 }}
                                                            >
                                                                <option value="percent">% (Percentage)</option>
                                                                <option value="flat">₹ (Flat Off)</option>
                                                            </select>
                                                        </td>
                                                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                                                            <input
                                                                type="number"
                                                                min={0}
                                                                max={currData.type === 'percent' ? 100 : (catTotal > 0 ? catTotal : undefined)}
                                                                value={currData.value === 0 ? '' : currData.value}
                                                                placeholder={currData.type === 'percent' ? '0 - 100%' : '0'}
                                                                onChange={(e) => {
                                                                    const rawInput = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                                                    let safeVal = isNaN(rawInput) ? 0 : Math.max(0, rawInput);
                                                                    if (currData.type === 'percent') {
                                                                        if (safeVal > 100) safeVal = 100;
                                                                    } else if (catTotal > 0) {
                                                                        if (safeVal > catTotal) safeVal = catTotal;
                                                                    }

                                                                    const newEffPct = currData.type === 'percent' ? safeVal : (catTotal > 0 ? (safeVal / catTotal) * 100 : 0);
                                                                    const nowExceeding = safeVal > 0 && newEffPct > effectiveMax;
                                                                    // If value exceeds what was approved (or never approved), require re-approval
                                                                    const exceedsApproved = !currData.approvedValue || safeVal > Number(currData.approvedValue);
                                                                    const shouldKeepApproval = currData.adminApproved && !exceedsApproved;

                                                                    setTempCategoryDiscounts(prev => ({
                                                                        ...prev,
                                                                        [cat]: {
                                                                            ...currData,
                                                                            value: safeVal,
                                                                            adminApproved: nowExceeding ? shouldKeepApproval : currData.adminApproved
                                                                        }
                                                                    }));
                                                                }}
                                                                style={{
                                                                    width: '80px',
                                                                    padding: '4px 6px',
                                                                    borderRadius: '4px',
                                                                    border: isExceeding && !isApprovedForCurrentValue ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                                                                    textAlign: 'center',
                                                                    fontSize: '0.84rem',
                                                                    fontWeight: 800,
                                                                    outline: 'none',
                                                                    backgroundColor: isExceeding && !isApprovedForCurrentValue ? '#fef2f2' : '#ffffff',
                                                                    color: isExceeding && !isApprovedForCurrentValue ? '#dc2626' : '#0f172a'
                                                                }}
                                                            />
                                                        </td>
                                                        {/* Approval Status & Governance Column */}
                                                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                                            {discVal <= 0 ? (
                                                                <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600 }}>-</span>
                                                            ) : !isExceeding ? (
                                                                <span style={{ fontWeight: 800, color: '#334155', fontSize: '0.84rem' }}>
                                                                    {currData.type === 'percent' ? `${discVal}%` : `₹${discVal.toLocaleString('en-IN')}`}
                                                                </span>
                                                            ) : isApprovedForCurrentValue ? (
                                                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                                                    <span style={{
                                                                        color: '#15803d',
                                                                        backgroundColor: '#dcfce7',
                                                                        border: '1.5px solid #86efac',
                                                                        padding: '3px 9px',
                                                                        borderRadius: '12px',
                                                                        fontSize: '0.72rem',
                                                                        fontWeight: 800,
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        gap: '4px'
                                                                    }}>
                                                                        ✅ Approved ({currData.type === 'percent' ? `${currData.approvedValue}%` : `₹${currData.approvedValue}`})
                                                                    </span>
                                                                    <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                                                                        by {currData.approvedBy || 'Manager'}
                                                                    </span>
                                                                    {canApproveDiscounts && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setTempCategoryDiscounts(prev => ({
                                                                                    ...prev,
                                                                                    [cat]: {
                                                                                        ...currData,
                                                                                        adminApproved: false,
                                                                                        approvedBy: undefined,
                                                                                        approvedAt: undefined,
                                                                                        approvedValue: undefined,
                                                                                        requestedValue: undefined
                                                                                    }
                                                                                }));
                                                                            }}
                                                                            style={{
                                                                                border: 'none',
                                                                                background: 'none',
                                                                                color: '#dc2626',
                                                                                fontSize: '0.68rem',
                                                                                fontWeight: 700,
                                                                                cursor: 'pointer',
                                                                                textDecoration: 'underline',
                                                                                padding: 0
                                                                            }}
                                                                            title="Revoke approval"
                                                                        >
                                                                            Revoke
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                                                    <span style={{
                                                                        color: '#dc2626',
                                                                        backgroundColor: '#fef2f2',
                                                                        border: '1px solid #fecaca',
                                                                        padding: '3px 8px',
                                                                        borderRadius: '6px',
                                                                        fontSize: '0.72rem',
                                                                        fontWeight: 800,
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        gap: '4px'
                                                                    }}>
                                                                        ⚠️ Exceed Max limit ({currData.type === 'percent' ? `${discVal}%` : `₹${discVal}`})
                                                                    </span>

                                                                    {canApproveDiscounts ? (
                                                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    setTempCategoryDiscounts(prev => ({
                                                                                        ...prev,
                                                                                        [cat]: {
                                                                                            ...currData,
                                                                                            adminApproved: true,
                                                                                            approvedBy: effectiveUser?.name || 'Manager',
                                                                                            approvedAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + ', ' + new Date().toLocaleDateString('en-IN'),
                                                                                            approvedValue: discVal,
                                                                                            rejected: false,
                                                                                            rejectionReason: undefined
                                                                                        }
                                                                                    }));
                                                                                    if (activeDiscountRequest?.id) {
                                                                                        axios.post(`${API_BASE_URL}/category-discounts/review-request`, {
                                                                                            request_id: activeDiscountRequest.id,
                                                                                            action: 'approved',
                                                                                            reviewed_by_name: effectiveUser?.name || 'Manager',
                                                                                            reviewed_by_id: effectiveUser?.user_id || effectiveUser?.id || ''
                                                                                        }).catch(() => {});
                                                                                    }
                                                                                }}
                                                                                style={{
                                                                                    padding: '3px 8px',
                                                                                    borderRadius: '5px',
                                                                                    backgroundColor: '#16a34a',
                                                                                    color: '#ffffff',
                                                                                    border: 'none',
                                                                                    fontSize: '0.72rem',
                                                                                    fontWeight: 800,
                                                                                    cursor: 'pointer',
                                                                                    display: 'inline-flex',
                                                                                    alignItems: 'center',
                                                                                    gap: '3px',
                                                                                    boxShadow: '0 1px 3px rgba(22, 163, 74, 0.25)'
                                                                                }}
                                                                                title={`Approve ${discVal}${currData.type === 'percent' ? '%' : '₹'} for ${cat}`}
                                                                            >
                                                                                ✓ Approve
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    const reason = window.prompt(`Reject ${cat} discount of ${discVal}${currData.type === 'percent' ? '%' : '₹'}?`, 'Exceeds maximum allowable category limit');
                                                                                    if (reason === null) return;
                                                                                    setTempCategoryDiscounts(prev => ({
                                                                                        ...prev,
                                                                                        [cat]: {
                                                                                            ...currData,
                                                                                            adminApproved: false,
                                                                                            rejected: true,
                                                                                            rejectedBy: effectiveUser?.name || 'Manager',
                                                                                            rejectedAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
                                                                                            rejectionReason: reason.trim() || 'Rejected by Manager',
                                                                                            approvedValue: 0,
                                                                                            requestedValue: undefined
                                                                                        }
                                                                                    }));
                                                                                    if (activeDiscountRequest?.id) {
                                                                                        axios.post(`${API_BASE_URL}/category-discounts/review-request`, {
                                                                                            request_id: activeDiscountRequest.id,
                                                                                            action: 'rejected',
                                                                                            reviewed_by_name: effectiveUser?.name || 'Manager',
                                                                                            reviewed_by_id: effectiveUser?.user_id || effectiveUser?.id || '',
                                                                                            rejection_reason: reason.trim() || 'Rejected by Manager'
                                                                                        }).catch(() => {});
                                                                                    }
                                                                                }}
                                                                                style={{
                                                                                    padding: '3px 8px',
                                                                                    borderRadius: '5px',
                                                                                    backgroundColor: '#ffffff',
                                                                                    color: '#dc2626',
                                                                                    border: '1px solid #fca5a5',
                                                                                    fontSize: '0.72rem',
                                                                                    fontWeight: 800,
                                                                                    cursor: 'pointer',
                                                                                    display: 'inline-flex',
                                                                                    alignItems: 'center',
                                                                                    gap: '3px'
                                                                                }}
                                                                                title={`Reject discount for ${cat}`}
                                                                            >
                                                                                ✕ Reject
                                                                            </button>
                                                                        </div>
                                                                    ) : currData.rejected ? (
                                                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                                                            <span
                                                                                style={{
                                                                                    color: '#dc2626',
                                                                                    backgroundColor: '#fef2f2',
                                                                                    border: '1px solid #fca5a5',
                                                                                    padding: '3px 7px',
                                                                                    borderRadius: '5px',
                                                                                    fontSize: '0.70rem',
                                                                                    fontWeight: 800,
                                                                                    display: 'inline-flex',
                                                                                    alignItems: 'center',
                                                                                    gap: '3px'
                                                                                }}
                                                                                title={currData.rejectionReason ? `Rejected: ${currData.rejectionReason}` : 'Discount rejected by Manager'}
                                                                            >
                                                                                ❌ Rejected
                                                                            </span>
                                                                            <button
                                                                                type="button"
                                                                                disabled={sendingCategoryApproval === cat}
                                                                                onClick={() => handleDirectSendCategoryApproval(cat, discVal, currData.type, catTotal)}
                                                                                style={{
                                                                                    width: '26px',
                                                                                    height: '26px',
                                                                                    borderRadius: '6px',
                                                                                    backgroundColor: sendingCategoryApproval === cat ? '#94a3b8' : '#ea580c',
                                                                                    color: '#ffffff',
                                                                                    border: 'none',
                                                                                    cursor: sendingCategoryApproval === cat ? 'not-allowed' : 'pointer',
                                                                                    display: 'inline-flex',
                                                                                    alignItems: 'center',
                                                                                    justifyContent: 'center',
                                                                                    boxShadow: '0 1px 3px rgba(234, 88, 12, 0.25)',
                                                                                    transition: 'all 0.15s'
                                                                                }}
                                                                                title={`Re-send approval request for ${discVal}% (No popup)`}
                                                                            >
                                                                                {sendingCategoryApproval === cat ? (
                                                                                    <Loader2 size={13} className="animate-spin" />
                                                                                ) : (
                                                                                    <Send size={13} />
                                                                                )}
                                                                            </button>
                                                                        </div>
                                                                    ) : currData.requestedValue === discVal ? (
                                                                        <span
                                                                            style={{
                                                                                color: '#ea580c',
                                                                                backgroundColor: '#fff7ed',
                                                                                border: '1px solid #fed7aa',
                                                                                padding: '3px 7px',
                                                                                borderRadius: '5px',
                                                                                fontSize: '0.70rem',
                                                                                fontWeight: 800,
                                                                                display: 'inline-flex',
                                                                                alignItems: 'center',
                                                                                gap: '4px'
                                                                            }}
                                                                            title={`Approval request for ${discVal}% was sent to Admin & Managers`}
                                                                        >
                                                                            ⏳ Requested ({discVal}%)
                                                                        </span>
                                                                    ) : (
                                                                        <button
                                                                            type="button"
                                                                            disabled={sendingCategoryApproval === cat}
                                                                            onClick={() => handleDirectSendCategoryApproval(cat, discVal, currData.type, catTotal)}
                                                                            style={{
                                                                                width: '26px',
                                                                                height: '26px',
                                                                                borderRadius: '6px',
                                                                                backgroundColor: sendingCategoryApproval === cat ? '#94a3b8' : '#ea580c',
                                                                                color: '#ffffff',
                                                                                border: 'none',
                                                                                cursor: sendingCategoryApproval === cat ? 'not-allowed' : 'pointer',
                                                                                display: 'inline-flex',
                                                                                alignItems: 'center',
                                                                                justifyContent: 'center',
                                                                                boxShadow: '0 1px 3px rgba(234, 88, 12, 0.25)',
                                                                                transition: 'all 0.15s'
                                                                            }}
                                                                            title={`Click to send approval request for ${discVal}% directly to Admin, Design Manager & Business Manager (No popup)`}
                                                                        >
                                                                            {sendingCategoryApproval === cat ? (
                                                                                <Loader2 size={13} className="animate-spin" />
                                                                            ) : (
                                                                                <Send size={13} />
                                                                            )}
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: computedDiscount > 0 ? '#dc2626' : '#94a3b8' }}>
                                                            {computedDiscount > 0 ? `₹${computedDiscount.toLocaleString('en-IN', { minimumFractionDigits: computedDiscount % 1 !== 0 ? 2 : 0, maximumFractionDigits: 2 })}` : '₹0'}
                                                        </td>
                                                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>
                                                            ₹{netAmt.toLocaleString('en-IN', { minimumFractionDigits: netAmt % 1 !== 0 ? 2 : 0, maximumFractionDigits: 2 })}
                                                        </td>
                                                    </tr>
                                                );
                                            });

                                            const safeGrandDiscountAmt = Math.min(grandSubtotal, Math.round(grandDiscountAmt * 100) / 100);
                                            const grandNetTotal = Math.max(0, Math.round((grandSubtotal - safeGrandDiscountAmt) * 100) / 100);

                                            return (
                                                <>
                                                    {rows}
                                                    <tr style={{ backgroundColor: '#fff7ed', borderTop: '2px solid #ea580c', fontWeight: 800 }}>
                                                        <td style={{ padding: '12px', fontWeight: 900, color: '#9a3412' }}>Total Category Summary:</td>
                                                        <td style={{ padding: '12px', textAlign: 'right', color: '#0f172a', fontWeight: 800 }}>₹{grandSubtotal.toLocaleString('en-IN', { minimumFractionDigits: grandSubtotal % 1 !== 0 ? 2 : 0, maximumFractionDigits: 2 })}</td>
                                                        <td colSpan={2} style={{ padding: '12px', textAlign: 'center', color: '#ea580c', fontWeight: 800 }}>
                                                            {safeGrandDiscountAmt > 0 ? `Total Discount Applied` : ''}
                                                        </td>
                                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                                            {/* Status badge in summary */}
                                                            {activeQuoteCategories.some(c => {
                                                                const curr = tempCategoryDiscounts[c];
                                                                if (!curr || !curr.value) return false;
                                                                const sysLimit = resolveCategoryMaxLimit(c);
                                                                const effPct = curr.type === 'percent' ? curr.value : 0;
                                                                const isApprovedForVal = Boolean(curr.adminApproved && curr.approvedValue !== undefined && effPct <= Number(curr.approvedValue));
                                                                return effPct > sysLimit && !isApprovedForVal;
                                                            }) ? (
                                                                <span style={{ fontSize: '0.74rem', color: '#dc2626', fontWeight: 800, backgroundColor: '#fef2f2', padding: '3px 8px', borderRadius: '4px', border: '1px solid #fecaca' }}>
                                                                    ⚠️ Approval required before applying
                                                                </span>
                                                            ) : (
                                                                <span style={{ fontSize: '0.74rem', color: '#16a34a', fontWeight: 800 }}>
                                                                    ✓ Ready to Apply
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td style={{ padding: '12px', textAlign: 'right', color: '#dc2626', fontWeight: 900, fontSize: '0.92rem' }}>
                                                            {safeGrandDiscountAmt > 0 ? `₹${safeGrandDiscountAmt.toLocaleString('en-IN', { minimumFractionDigits: safeGrandDiscountAmt % 1 !== 0 ? 2 : 0, maximumFractionDigits: 2 })}` : '₹0'}
                                                        </td>
                                                        <td style={{ padding: '12px', textAlign: 'right', color: '#16a34a', fontWeight: 900, fontSize: '0.98rem' }}>
                                                            ₹{grandNetTotal.toLocaleString('en-IN', { minimumFractionDigits: grandNetTotal % 1 !== 0 ? 2 : 0, maximumFractionDigits: 2 })}
                                                        </td>
                                                    </tr>
                                                </>
                                            );
                                        })()}
                                    </tbody>
                                </table>
                            </div>

                            {/* Footer buttons */}
                            <div style={{ padding: '14px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', backgroundColor: '#f8fafc' }}>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button
                                        onClick={() => setShowCategoryDiscountModal(false)}
                                        style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#475569', fontWeight: 700, fontSize: '0.84rem', cursor: 'pointer' }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={applyCategoryDiscounts}
                                        style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', backgroundColor: '#ea580c', color: '#ffffff', fontWeight: 800, fontSize: '0.84rem', cursor: 'pointer', boxShadow: '0 2px 6px rgba(234, 88, 12, 0.25)' }}
                                    >
                                        Apply Category Discounts
                                    </button>
                                </div>
                            </div>

                            {/* ===== ADMIN AUTHORIZATION MODAL FOR SALES PERSON ===== */}
                            {adminAuthModal?.open && (
                                <div style={{
                                    position: 'absolute',
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
                                        borderRadius: '14px',
                                        width: '100%',
                                        maxWidth: '430px',
                                        boxShadow: '0 25px 50px rgba(0,0,0,0.35)',
                                        border: '2px solid #ea580c',
                                        overflow: 'hidden'
                                    }}>
                                        {/* Modal Header */}
                                        <div style={{ padding: '14px 18px', backgroundColor: '#ea580c', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontSize: '1.2rem' }}>🛡️</span>
                                                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Admin Discount Authorization</h4>
                                            </div>
                                            <button
                                                onClick={() => setAdminAuthModal(null)}
                                                style={{ background: 'none', border: 'none', color: '#ffffff', fontSize: '1.2rem', fontWeight: 800, cursor: 'pointer' }}
                                            >
                                                ✕
                                            </button>
                                        </div>

                                        {/* Modal Body */}
                                        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                            <div style={{ backgroundColor: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', padding: '10px 14px', fontSize: '0.82rem', color: '#9a3412' }}>
                                                <div>
                                                    Scope: <strong>{adminAuthModal.category ? adminAuthModal.category : 'All Exceeding Categories'}</strong>
                                                </div>
                                                <div style={{ marginTop: '4px', fontSize: '0.78rem', color: '#64748b' }}>
                                                    This discount exceeds the category maximum allowed ceiling. An Admin must authorize this additional discount.
                                                </div>
                                            </div>

                                            {/* Select Admin */}
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#334155', marginBottom: '5px' }}>
                                                    Approving Admin
                                                </label>
                                                <select
                                                    value={adminAuthModal.selectedAdmin}
                                                    onChange={(e) => setAdminAuthModal(prev => prev ? ({ ...prev, selectedAdmin: e.target.value }) : null)}
                                                    style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.84rem', fontWeight: 700, color: '#0f172a', outline: 'none' }}
                                                >
                                                    {adminUsersList.map(u => (
                                                        <option key={u.user_id} value={u.name}>{u.name} ({u.role || 'Admin'})</option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Admin PIN / Password */}
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#334155', marginBottom: '5px' }}>
                                                    Enter Admin Authorization PIN / Password
                                                </label>
                                                <input
                                                    type="password"
                                                    autoFocus
                                                    placeholder="Enter Admin PIN (e.g. 1234 / admin)"
                                                    value={adminAuthModal.pin}
                                                    onChange={(e) => setAdminAuthModal(prev => prev ? ({ ...prev, pin: e.target.value, error: '' }) : null)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            // Trigger authorization
                                                            const pinInput = adminAuthModal.pin.trim().toLowerCase();
                                                            const validPins = ['admin', '1234', 'livincart', 'admin123', '5555', '9999', 'admin@123'];
                                                            const isValid = validPins.includes(pinInput);
                                                            if (isValid) {
                                                                const adminName = adminAuthModal.selectedAdmin || 'Admin';
                                                                const stamp = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + ', ' + new Date().toLocaleDateString('en-IN');
                                                                setTempCategoryDiscounts(prev => {
                                                                    const next = { ...prev };
                                                                    if (adminAuthModal.category) {
                                                                        const curr = next[adminAuthModal.category];
                                                                        if (curr) {
                                                                            next[adminAuthModal.category] = {
                                                                                ...curr,
                                                                                adminApproved: true,
                                                                                approvedBy: adminName,
                                                                                approvedAt: stamp,
                                                                                approvedValue: curr.value
                                                                            };
                                                                        }
                                                                    } else {
                                                                        // Approve all exceeding
                                                                        Object.keys(next).forEach(k => {
                                                                            const curr = next[k];
                                                                            if (curr && curr.value > 0) {
                                                                                const maxLim = curr.maxDiscount !== undefined ? curr.maxDiscount : globalMaxDiscount;
                                                                                if (curr.value > maxLim) {
                                                                                    next[k] = {
                                                                                        ...curr,
                                                                                        adminApproved: true,
                                                                                        approvedBy: adminName,
                                                                                        approvedAt: stamp,
                                                                                        approvedValue: curr.value
                                                                                    };
                                                                                }
                                                                            }
                                                                        });
                                                                    }
                                                                    return next;
                                                                });
                                                                setAdminAuthModal(null);
                                                                alert(`✅ Admin Approval Granted! The additional discount has been approved.`);
                                                            } else {
                                                                setAdminAuthModal(prev => prev ? ({ ...prev, error: 'Incorrect Admin PIN / Password. Please try again.' }) : null);
                                                            }
                                                        }
                                                    }}
                                                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: adminAuthModal.error ? '1.5px solid #ef4444' : '1.5px solid #ea580c', fontSize: '0.88rem', fontWeight: 700, outline: 'none', boxSizing: 'border-box' }}
                                                />
                                                {adminAuthModal.error ? (
                                                    <div style={{ color: '#dc2626', fontSize: '0.75rem', fontWeight: 700, marginTop: '4px' }}>
                                                        {adminAuthModal.error}
                                                    </div>
                                                ) : (
                                                    <div style={{ color: '#64748b', fontSize: '0.70rem', marginTop: '3px' }}>
                                                        Admin master PIN: <code style={{ backgroundColor: '#f1f5f9', padding: '1px 4px', borderRadius: '3px' }}>admin</code> / <code style={{ backgroundColor: '#f1f5f9', padding: '1px 4px', borderRadius: '3px' }}>1234</code>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Action Buttons */}
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => setAdminAuthModal(null)}
                                                    style={{ padding: '7px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#475569', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const pinInput = adminAuthModal.pin.trim().toLowerCase();
                                                        const validPins = ['admin', '1234', 'livincart', 'admin123', '5555', '9999', 'admin@123'];
                                                        const isValid = validPins.includes(pinInput);
                                                        if (isValid) {
                                                            const adminName = adminAuthModal.selectedAdmin || 'Admin';
                                                            const stamp = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + ', ' + new Date().toLocaleDateString('en-IN');
                                                            setTempCategoryDiscounts(prev => {
                                                                const next = { ...prev };
                                                                if (adminAuthModal.category) {
                                                                    const curr = next[adminAuthModal.category];
                                                                    if (curr) {
                                                                        next[adminAuthModal.category] = {
                                                                            ...curr,
                                                                            adminApproved: true,
                                                                            approvedBy: adminName,
                                                                            approvedAt: stamp,
                                                                            approvedValue: curr.value
                                                                        };
                                                                    }
                                                                } else {
                                                                    // Approve all exceeding
                                                                    Object.keys(next).forEach(k => {
                                                                        const curr = next[k];
                                                                        if (curr && curr.value > 0) {
                                                                            const maxLim = curr.maxDiscount !== undefined ? curr.maxDiscount : globalMaxDiscount;
                                                                            if (curr.value > maxLim) {
                                                                                next[k] = {
                                                                                    ...curr,
                                                                                    adminApproved: true,
                                                                                    approvedBy: adminName,
                                                                                    approvedAt: stamp,
                                                                                    approvedValue: curr.value
                                                                                };
                                                                            }
                                                                        }
                                                                    });
                                                                }
                                                                return next;
                                                            });
                                                            setAdminAuthModal(null);
                                                            alert(`✅ Admin Approval Granted! The additional discount has been approved.`);
                                                        } else {
                                                            setAdminAuthModal(prev => prev ? ({ ...prev, error: 'Incorrect Admin PIN / Password. Please try again.' }) : null);
                                                        }
                                                    }}
                                                    style={{ padding: '7px 16px', borderRadius: '6px', border: 'none', backgroundColor: '#16a34a', color: '#ffffff', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer', boxShadow: '0 2px 4px rgba(22, 163, 74, 0.25)' }}
                                                >
                                                    Verify &amp; Approve
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ===== MODAL: REQUEST ADMIN APPROVAL FOR CATEGORY DISCOUNTS (SUBMIT TO DASHBOARD) ===== */}
                            {showRequestDiscountModal && (
                                <div style={{
                                    position: 'absolute',
                                    top: 0, left: 0, right: 0, bottom: 0,
                                    backgroundColor: 'rgba(15, 23, 42, 0.72)',
                                    backdropFilter: 'blur(3px)',
                                    zIndex: 1000000,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '20px'
                                }}>
                                    <div style={{
                                        backgroundColor: '#ffffff',
                                        borderRadius: '14px',
                                        width: '100%',
                                        maxWidth: '480px',
                                        boxShadow: '0 25px 50px rgba(0,0,0,0.35)',
                                        border: '2px solid #ea580c',
                                        overflow: 'hidden'
                                    }}>
                                        {/* Header */}
                                        <div style={{ padding: '14px 18px', backgroundColor: '#ea580c', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontSize: '1.2rem' }}>📨</span>
                                                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Request Admin Approval</h4>
                                            </div>
                                            <button
                                                onClick={() => setShowRequestDiscountModal(false)}
                                                style={{ background: 'none', border: 'none', color: '#ffffff', fontSize: '1.2rem', fontWeight: 800, cursor: 'pointer' }}
                                            >
                                                ✕
                                            </button>
                                        </div>

                                        {/* Body */}
                                        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                            <div style={{ backgroundColor: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', padding: '12px 14px', fontSize: '0.82rem', color: '#9a3412' }}>
                                                <div style={{ fontWeight: 800, marginBottom: '6px' }}>
                                                    Categories Exceeding Allowed Max Limits:
                                                </div>
                                                <ul style={{ margin: '4px 0 0 16px', padding: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    {exceedingPendingCats.map(c => {
                                                        const data = tempCategoryDiscounts[c];
                                                        const val = data ? data.value : 0;
                                                        const type = data ? data.type : 'percent';
                                                        const catAllowedMax = (data?.maxDiscount !== undefined && (isAdminUser || data?.adminApproved))
                                                            ? data.maxDiscount
                                                            : resolveCategoryMaxLimit(c);
                                                        return (
                                                            <li key={c} style={{ fontWeight: 700, color: '#0f172a' }}>
                                                                <strong>{c}</strong>: <span style={{ color: '#ea580c' }}>{val}{type === 'percent' ? '%' : '₹'}</span> (Allowed Max: {catAllowedMax}%)
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            </div>

                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.80rem', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
                                                    Reason / Justification for Admin:
                                                </label>
                                                <textarea
                                                    rows={3}
                                                    placeholder="E.g., Client requested special package discount on kitchen; order closing deal..."
                                                    value={discountRequestNote}
                                                    onChange={(e) => setDiscountRequestNote(e.target.value)}
                                                    style={{
                                                        width: '100%',
                                                        padding: '8px 10px',
                                                        borderRadius: '6px',
                                                        border: '1.5px solid #cbd5e1',
                                                        fontSize: '0.84rem',
                                                        fontFamily: 'inherit',
                                                        boxSizing: 'border-box',
                                                        outline: 'none'
                                                    }}
                                                />
                                            </div>

                                            <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                                                This request will appear in the <strong>Admin Dashboard</strong> under "Category Discount Approvals". Once approved, the discount will be unlocked here.
                                            </div>

                                            {/* Action Buttons */}
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowRequestDiscountModal(false)}
                                                    style={{ padding: '7px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#475569', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={submittingDiscountApproval}
                                                    onClick={() => handleSubmitDiscountApprovalRequest(exceedingPendingCats, modalGrandSubtotal, modalGrandDiscountAmt)}
                                                    style={{
                                                        padding: '7px 18px',
                                                        borderRadius: '6px',
                                                        border: 'none',
                                                        backgroundColor: '#ea580c',
                                                        color: '#ffffff',
                                                        fontWeight: 800,
                                                        fontSize: '0.82rem',
                                                        cursor: submittingDiscountApproval ? 'not-allowed' : 'pointer',
                                                        boxShadow: '0 2px 4px rgba(234, 88, 12, 0.25)',
                                                        opacity: submittingDiscountApproval ? 0.7 : 1
                                                    }}
                                                >
                                                    {submittingDiscountApproval ? 'Sending Request...' : 'Send Request to Admin Dashboard'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })()}

            {/* ===== TERMS & CONDITIONS EDIT / CUSTOMIZE MODAL ===== */}
            {showTermsModal && (
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
                        maxWidth: '880px',
                        maxHeight: '90vh',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)',
                        border: '1.5px solid #fed7aa',
                        transform: `translate(${termsModalOffset.x}px, ${termsModalOffset.y}px)`,
                        transition: termsModalDragStartRef.current ? 'none' : 'transform 0.05s ease-out'
                    }}>
                        {/* Header - Draggable anywhere */}
                        <div
                            onMouseDown={handleTermsModalHeaderMouseDown}
                            title="Drag header to move modal anywhere on screen"
                            style={{
                                padding: '16px 20px',
                                backgroundColor: '#0f172a',
                                color: '#ffffff',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                cursor: 'move',
                                userSelect: 'none'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '1.25rem' }}>📜</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Terms &amp; Conditions</h3>
                                    <span style={{ fontSize: '0.68rem', backgroundColor: '#334155', color: '#94a3b8', padding: '2px 7px', borderRadius: '4px', fontWeight: 600 }}>Drag Header to Move</span>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowTermsModal(false)}
                                style={{ background: 'none', border: 'none', color: '#ffffff', fontSize: '1.4rem', fontWeight: 800, cursor: 'pointer', padding: '0 4px' }}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Toolbar / Actions inside Modal */}
                        <div style={{ padding: '12px 20px', backgroundColor: '#fff7ed', borderBottom: '1px solid #fed7aa', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '0.84rem', color: '#c2410c', fontWeight: 800 }}>
                                    Total {termsList.length} Terms &amp; Conditions Points Active
                                </span>
                                {termsModalOffset.x !== 0 || termsModalOffset.y !== 0 ? (
                                    <button
                                        type="button"
                                        onClick={() => setTermsModalOffset({ x: 0, y: 0 })}
                                        style={{ fontSize: '0.72rem', color: '#ea580c', background: 'none', border: '1px dashed #fdba74', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer' }}
                                    >
                                        ↺ Reset Position
                                    </button>
                                ) : null}
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    type="button"
                                    onClick={() => setTermsList(DEFAULT_QUOTE_TERMS)}
                                    style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #fed7aa', backgroundColor: '#ffffff', color: '#ea580c', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}
                                >
                                    🔄 Reset to Default 20 Terms
                                </button>
                                <button
                                    type="button"
                                    onClick={addNewTermPoint}
                                    style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 14px', borderRadius: '6px', border: 'none', backgroundColor: '#ea580c', color: '#ffffff', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', boxShadow: '0 1px 3px rgba(234, 88, 12, 0.3)' }}
                                >
                                    <Plus size={14} /> Add New Term Point
                                </button>
                            </div>
                        </div>

                        {/* Body - Terms List Inputs with Drag-to-Scroll & Drag-to-Reorder */}
                        <div
                            ref={termsListContainerRef}
                            onMouseDown={handleContainerPanMouseDown}
                            onMouseMove={handleContainerPanMouseMove}
                            onMouseUp={handleContainerPanMouseUp}
                            onMouseLeave={handleContainerPanMouseUp}
                            style={{
                                padding: '16px 20px',
                                overflowY: 'auto',
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px',
                                userSelect: isPanScrollingRef.current ? 'none' : 'auto',
                                cursor: isPanScrollingRef.current ? 'grabbing' : 'default'
                            }}
                        >
                            {termsList.map((termText, idx) => (
                                <div
                                    key={idx}
                                    onDragOver={(e) => handleTermDragOver(e, idx)}
                                    onDrop={(e) => handleTermDrop(e, idx)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        backgroundColor: dragOverTermIndex === idx ? '#fff7ed' : (draggedTermIndex === idx ? '#f1f5f9' : '#f8fafc'),
                                        padding: '7px 10px',
                                        borderRadius: '8px',
                                        border: dragOverTermIndex === idx ? '2px dashed #ea580c' : (draggedTermIndex === idx ? '1px dashed #94a3b8' : '1px solid #e2e8f0'),
                                        opacity: draggedTermIndex === idx ? 0.45 : 1,
                                        transition: 'background-color 0.15s, border-color 0.15s'
                                    }}
                                >
                                    {/* Dedicated Grip Handle for dragging row to any place */}
                                    <div
                                        data-drag-handle="true"
                                        draggable={true}
                                        onDragStart={(e) => handleTermDragStart(e, idx)}
                                        onDragEnd={handleTermDragEnd}
                                        title="Click & drag to reorder row to any place"
                                        style={{
                                            cursor: 'grab',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#94a3b8',
                                            padding: '4px 2px',
                                            flexShrink: 0
                                        }}
                                    >
                                        <GripVertical size={16} />
                                    </div>

                                    {/* Up / Down arrows */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0 }}>
                                        <button
                                            type="button"
                                            disabled={idx === 0}
                                            onClick={() => moveTerm(idx, 'up')}
                                            title="Move Up"
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                width: '22px',
                                                height: '18px',
                                                borderRadius: '3px',
                                                border: '1px solid #cbd5e1',
                                                backgroundColor: idx === 0 ? '#f1f5f9' : '#ffffff',
                                                color: idx === 0 ? '#cbd5e1' : '#334155',
                                                cursor: idx === 0 ? 'not-allowed' : 'pointer',
                                                padding: 0
                                            }}
                                        >
                                            <MoveUp size={10} />
                                        </button>
                                        <button
                                            type="button"
                                            disabled={idx === termsList.length - 1}
                                            onClick={() => moveTerm(idx, 'down')}
                                            title="Move Down"
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                width: '22px',
                                                height: '18px',
                                                borderRadius: '3px',
                                                border: '1px solid #cbd5e1',
                                                backgroundColor: idx === termsList.length - 1 ? '#f1f5f9' : '#ffffff',
                                                color: idx === termsList.length - 1 ? '#cbd5e1' : '#334155',
                                                cursor: idx === termsList.length - 1 ? 'not-allowed' : 'pointer',
                                                padding: 0
                                            }}
                                        >
                                            <MoveDown size={10} />
                                        </button>
                                    </div>

                                    {/* Row Index */}
                                    <span style={{ fontWeight: 800, color: '#ea580c', width: '26px', fontSize: '0.84rem', textAlign: 'center', flexShrink: 0 }}>
                                        {idx + 1}.
                                    </span>

                                    {/* Clause Input with clean Placeholder */}
                                    <input
                                        type="text"
                                        value={termText}
                                        placeholder="Enter term & condition clause (e.g. Material specification, warranty, payment milestone)..."
                                        onChange={(e) => {
                                            const updated = [...termsList];
                                            updated[idx] = e.target.value;
                                            setTermsList(updated);
                                        }}
                                        style={{
                                            flex: 1,
                                            padding: '8px 12px',
                                            borderRadius: '6px',
                                            border: '1px solid #cbd5e1',
                                            fontSize: '0.85rem',
                                            outline: 'none',
                                            fontWeight: 500,
                                            backgroundColor: '#ffffff'
                                        }}
                                    />

                                    {/* + Add Below button on each row */}
                                    <button
                                        type="button"
                                        onClick={() => insertTermBelow(idx)}
                                        title="Insert a new term point directly below this clause"
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '3px',
                                            padding: '6px 9px',
                                            borderRadius: '6px',
                                            border: '1px solid #fed7aa',
                                            backgroundColor: '#fff7ed',
                                            color: '#ea580c',
                                            fontWeight: 700,
                                            fontSize: '0.76rem',
                                            cursor: 'pointer',
                                            flexShrink: 0,
                                            whiteSpace: 'nowrap'
                                        }}
                                    >
                                        <Plus size={12} /> Add Below
                                    </button>

                                    {/* Delete Button */}
                                    <button
                                        type="button"
                                        onClick={() => setTermsList(prev => prev.filter((_, i) => i !== idx))}
                                        title="Delete this term point"
                                        style={{
                                            padding: '6px 10px',
                                            borderRadius: '6px',
                                            border: 'none',
                                            backgroundColor: '#fee2e2',
                                            color: '#dc2626',
                                            fontWeight: 700,
                                            fontSize: '0.76rem',
                                            cursor: 'pointer',
                                            flexShrink: 0
                                        }}
                                    >
                                        ✕ Delete
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Footer buttons */}
                        <div style={{ padding: '14px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
                            <span style={{ fontSize: '0.76rem', color: '#64748b' }}>
                                Tip: Drag handle to reorder rows • Drag header to move popup • Drag background to scroll
                            </span>
                            <button
                                onClick={() => setShowTermsModal(false)}
                                style={{ padding: '8px 22px', borderRadius: '6px', border: 'none', backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 800, fontSize: '0.84rem', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
                            >
                                Done &amp; Save Terms
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* ===== HIDE CATEGORIES IN PRINT POPUP MODAL ===== */}
            {showHidePopup && (
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
                        maxWidth: '650px',
                        maxHeight: '90vh',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                        border: '1.5px solid #fed7aa'
                    }}>
                        {/* Header */}
                        <div style={{ padding: '16px 20px', backgroundColor: '#ea580c', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '1.2rem' }}>👁️</span>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Hide Categories &amp; Fields in Print PDF</h3>
                            </div>
                            <button onClick={() => setShowHidePopup(false)} style={{ background: 'none', border: 'none', color: '#ffffff', fontSize: '1.4rem', fontWeight: 800, cursor: 'pointer' }}>✕</button>
                        </div>

                        {/* Body - Checkboxes */}
                        <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.86rem', fontWeight: 600, color: '#334155', cursor: 'pointer', backgroundColor: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <input
                                    type="checkbox"
                                    checked={!!hiddenFields.particulars}
                                    onChange={(e) => setHiddenFields(prev => ({ ...prev, particulars: e.target.checked }))}
                                    style={{ width: '16px', height: '16px', accentColor: '#ea580c', cursor: 'pointer' }}
                                />
                                Hide Product Description Column
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.86rem', fontWeight: 600, color: '#334155', cursor: 'pointer', backgroundColor: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <input
                                    type="checkbox"
                                    checked={!!hiddenFields.qty}
                                    onChange={(e) => setHiddenFields(prev => ({ ...prev, qty: e.target.checked }))}
                                    style={{ width: '16px', height: '16px', accentColor: '#ea580c', cursor: 'pointer' }}
                                />
                                Hide QTY Column
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.86rem', fontWeight: 600, color: '#334155', cursor: 'pointer', backgroundColor: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <input
                                    type="checkbox"
                                    checked={!!hiddenFields.discount}
                                    onChange={(e) => setHiddenFields(prev => ({ ...prev, discount: e.target.checked, disc: e.target.checked }))}
                                    style={{ width: '16px', height: '16px', accentColor: '#ea580c', cursor: 'pointer' }}
                                />
                                Hide Disc % Column &amp; Breakdown
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.86rem', fontWeight: 600, color: '#334155', cursor: 'pointer', backgroundColor: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <input
                                    type="checkbox"
                                    checked={!!hiddenFields.amount}
                                    onChange={(e) => setHiddenFields(prev => ({ ...prev, amount: e.target.checked }))}
                                    style={{ width: '16px', height: '16px', accentColor: '#ea580c', cursor: 'pointer' }}
                                />
                                Hide Amount Column
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.86rem', fontWeight: 600, color: '#334155', cursor: 'pointer', backgroundColor: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <input
                                    type="checkbox"
                                    checked={!!hiddenFields.shutterMaterial}
                                    onChange={(e) => setHiddenFields(prev => ({ ...prev, shutterMaterial: e.target.checked }))}
                                    style={{ width: '16px', height: '16px', accentColor: '#ea580c', cursor: 'pointer' }}
                                />
                                Hide Shutter Material
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.86rem', fontWeight: 600, color: '#334155', cursor: 'pointer', backgroundColor: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <input
                                    type="checkbox"
                                    checked={!!hiddenFields.carcassMaterial}
                                    onChange={(e) => setHiddenFields(prev => ({ ...prev, carcassMaterial: e.target.checked }))}
                                    style={{ width: '16px', height: '16px', accentColor: '#ea580c', cursor: 'pointer' }}
                                />
                                Hide Carcass Material
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.86rem', fontWeight: 600, color: '#334155', cursor: 'pointer', backgroundColor: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <input
                                    type="checkbox"
                                    checked={!!hiddenFields.dimensions}
                                    onChange={(e) => setHiddenFields(prev => ({ ...prev, dimensions: e.target.checked }))}
                                    style={{ width: '16px', height: '16px', accentColor: '#ea580c', cursor: 'pointer' }}
                                />
                                Hide Dimensions Column
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.86rem', fontWeight: 600, color: '#334155', cursor: 'pointer', backgroundColor: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <input
                                    type="checkbox"
                                    checked={!!hiddenFields.rate}
                                    onChange={(e) => setHiddenFields(prev => ({ ...prev, rate: e.target.checked }))}
                                    style={{ width: '16px', height: '16px', accentColor: '#ea580c', cursor: 'pointer' }}
                                />
                                Hide Rate Column
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.86rem', fontWeight: 600, color: '#334155', cursor: 'pointer', backgroundColor: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <input
                                    type="checkbox"
                                    checked={!!hiddenFields.categoryDiscount}
                                    onChange={(e) => setHiddenFields(prev => ({ ...prev, categoryDiscount: e.target.checked }))}
                                    style={{ width: '16px', height: '16px', accentColor: '#ea580c', cursor: 'pointer' }}
                                />
                                Hide Category Discounts
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.86rem', fontWeight: 600, color: '#334155', cursor: 'pointer', backgroundColor: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <input
                                    type="checkbox"
                                    checked={!!hiddenFields.promoCode}
                                    onChange={(e) => setHiddenFields(prev => ({ ...prev, promoCode: e.target.checked }))}
                                    style={{ width: '16px', height: '16px', accentColor: '#ea580c', cursor: 'pointer' }}
                                />
                                Hide Promo Code Line
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.86rem', fontWeight: 600, color: '#334155', cursor: 'pointer', backgroundColor: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <input
                                    type="checkbox"
                                    checked={!!hiddenFields.generalDiscount || !!hiddenFields.flatDiscount}
                                    onChange={(e) => setHiddenFields(prev => ({ ...prev, generalDiscount: e.target.checked, flatDiscount: e.target.checked }))}
                                    style={{ width: '16px', height: '16px', accentColor: '#ea580c', cursor: 'pointer' }}
                                />
                                Hide Flat Amount Discount Line
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.86rem', fontWeight: 600, color: '#334155', cursor: 'pointer', backgroundColor: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <input
                                    type="checkbox"
                                    checked={!!hiddenFields.additionalCharges}
                                    onChange={(e) => setHiddenFields(prev => ({ ...prev, additionalCharges: e.target.checked }))}
                                    style={{ width: '16px', height: '16px', accentColor: '#ea580c', cursor: 'pointer' }}
                                />
                                Hide Additional Charges Line
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.86rem', fontWeight: 600, color: '#334155', cursor: 'pointer', backgroundColor: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <input
                                    type="checkbox"
                                    checked={!!hiddenFields.gst}
                                    onChange={(e) => setHiddenFields(prev => ({ ...prev, gst: e.target.checked }))}
                                    style={{ width: '16px', height: '16px', accentColor: '#ea580c', cursor: 'pointer' }}
                                />
                                Hide GST Column &amp; Line
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.86rem', fontWeight: 600, color: '#334155', cursor: 'pointer', backgroundColor: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <input
                                    type="checkbox"
                                    checked={!!hiddenFields.roundOff}
                                    onChange={(e) => setHiddenFields(prev => ({ ...prev, roundOff: e.target.checked }))}
                                    style={{ width: '16px', height: '16px', accentColor: '#ea580c', cursor: 'pointer' }}
                                />
                                Hide Round Off Line
                            </label>
                        </div>

                        {/* Footer buttons */}
                        <div style={{ padding: '14px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px', backgroundColor: '#f8fafc' }}>
                            <button
                                onClick={async () => {
                                    setShowHidePopup(false);
                                    await handleSaveDraft();
                                }}
                                style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', backgroundColor: '#ea580c', color: '#ffffff', fontWeight: 800, fontSize: '0.84rem', cursor: 'pointer' }}
                            >
                                Done &amp; Apply Preferences
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== FINAL VERSION MODAL ===== */}
            {showFinalVersionModal && (
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
                        maxWidth: '520px',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                        border: '1.5px solid #bbf7d0'
                    }}>
                        {/* Header */}
                        <div style={{ padding: '16px 20px', backgroundColor: '#166534', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <CheckCircle2 size={20} color="#ffffff" />
                                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Final Version Generation</h3>
                            </div>
                            <button onClick={() => setShowFinalVersionModal(false)} style={{ background: 'none', border: 'none', color: '#ffffff', fontSize: '1.4rem', fontWeight: 800, cursor: 'pointer' }}>✕</button>
                        </div>

                        {/* Body */}
                        <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div style={{ fontSize: '0.92rem', color: '#1e293b', fontWeight: 600, lineHeight: 1.5 }}>
                                Mark this quote state as the official Final Version. The version badge will be updated to a solid green background (<span style={{ color: '#166534', fontWeight: 800 }}>#dcfce7</span>).
                            </div>

                            <button
                                onClick={async () => {
                                    setIsFinalVersion(true);
                                    const projId = project?.project_id || project?.id;
                                    if (projId) sessionStorage.setItem(`final_locked_project_${projId}`, 'true');
                                    setShowFinalVersionModal(false);
                                    setTimeout(async () => {
                                        setSavingVersion(true);
                                        try {
                                            const payload = { ...buildPayload(), is_final_version: true };
                                            const res = await axios.post(`${API_BASE_URL}/quotes/save`, payload);
                                            if (res.data.success) {
                                                const savedQuoteId = res.data.quote_id;
                                                if (setQuoteTotal) setQuoteTotal(getGrandTotal());
                                                if (savedQuoteId) {
                                                    try {
                                                        await axios.post(`${API_BASE_URL}/pdf/snapshot`, {
                                                            quote_id: savedQuoteId,
                                                            project_id: project?.project_id || 0
                                                        });
                                                    } catch (snapErr) { }
                                                }
                                                await loadVersions();
                                                setIsVersionsExpanded(true);
                                                setIsDirty(false);
                                                if (onSaveSuccess) onSaveSuccess();
                                                alert('Final Version generated and locked successfully!');
                                            } else {
                                                alert('Failed to save Final Version: ' + (res.data.message || 'Unknown error'));
                                            }
                                        } catch (err: any) {
                                            alert('Failed to save Final Version: ' + (err.response?.data?.message || err.message));
                                        } finally {
                                            setSavingVersion(false);
                                        }
                                    }, 50);
                                }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    padding: '12px 18px',
                                    backgroundColor: '#166534',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '10px',
                                    fontWeight: 800,
                                    fontSize: '0.90rem',
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 12px rgba(22, 101, 52, 0.25)'
                                }}
                            >
                                <CheckCircle2 size={18} />
                                Generate as Final Version
                            </button>

                            <button
                                onClick={async () => {
                                    setShowFinalVersionModal(false);
                                    await handleSaveDraft();
                                }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    padding: '12px 18px',
                                    backgroundColor: '#ffffff',
                                    color: '#166534',
                                    border: '1.5px solid #bbf7d0',
                                    borderRadius: '10px',
                                    fontWeight: 700,
                                    fontSize: '0.90rem',
                                    cursor: 'pointer'
                                }}
                            >
                                Save as Final Draft Revision
                            </button>
                        </div>

                        {/* Footer */}
                        <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', backgroundColor: '#f8fafc' }}>
                            <button
                                onClick={() => setShowFinalVersionModal(false)}
                                style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#475569', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== PROMO CODE MODAL ===== */}
            {showPromoModal && (
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
                        maxWidth: '480px',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        overflow: 'hidden'
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
                                <Tag size={20} color="#ffffff" />
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>Apply Promo &amp; Coupon Code</h3>
                                    <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#ffedd5' }}>Enter a code or select from available offers</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowPromoModal(false)}
                                style={{ background: 'none', border: 'none', color: '#ffffff', fontSize: '1.2rem', cursor: 'pointer', fontWeight: 800 }}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Body */}
                        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* Promo Code Text Input */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.80rem', fontWeight: 800, color: '#334155', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Promo Code
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type="text"
                                        placeholder="e.g. SUMMER10, FESTIVE15, FLAT5000"
                                        value={promoModalCode}
                                        onChange={(e) => handlePromoCodeTextChange(e.target.value)}
                                        autoFocus
                                        style={{
                                            width: '100%',
                                            padding: '12px 14px',
                                            borderRadius: '8px',
                                            border: '2px solid #ea580c',
                                            fontSize: '1rem',
                                            fontWeight: 800,
                                            color: '#0f172a',
                                            textTransform: 'uppercase',
                                            outline: 'none',
                                            letterSpacing: '1px',
                                            boxSizing: 'border-box',
                                            backgroundColor: '#fffaf5'
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Discount Type & Value */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '12px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.80rem', fontWeight: 800, color: '#334155', marginBottom: '6px', textTransform: 'uppercase' }}>
                                        Discount Type
                                    </label>
                                    <select
                                        value={promoModalType}
                                        onChange={(e) => {
                                            const t = e.target.value as 'percent' | 'flat';
                                            setPromoModalType(t);
                                            if (t === 'percent' && typeof promoModalValue === 'number' && promoModalValue > 100) {
                                                setPromoModalValue(100);
                                            }
                                        }}
                                        style={{
                                            width: '100%',
                                            padding: '10px 12px',
                                            borderRadius: '8px',
                                            border: '1.5px solid #cbd5e1',
                                            fontSize: '0.88rem',
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
                                        Discount Value {promoModalType === 'percent' ? '(%)' : '(₹)'}
                                    </label>
                                    <input
                                        type="number"
                                        min={0}
                                        max={promoModalType === 'percent' ? 100 : undefined}
                                        placeholder={promoModalType === 'percent' ? 'e.g. 10 (Max 100)' : 'e.g. 5000'}
                                        value={promoModalValue}
                                        onChange={(e) => {
                                            let val: any = e.target.value === '' ? '' : parseFloat(e.target.value);
                                            if (val !== '' && !isNaN(val)) {
                                                if (promoModalType === 'percent') {
                                                    val = Math.min(100, Math.max(0, val));
                                                } else {
                                                    val = Math.max(0, val);
                                                }
                                            }
                                            setPromoModalValue(val);
                                            setPromoModalError('');
                                        }}
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

                            {/* Quick Available Promo Codes */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>
                                    Quick Select Available Codes:
                                </label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '110px', overflowY: 'auto', padding: '2px' }}>
                                    {getAllPromoOptions().map((opt, idx) => {
                                        const isSelected = promoModalCode.toUpperCase() === opt.code.toUpperCase();
                                        const label = `${opt.code} (${opt.type === 'percent' ? `${opt.value}%` : `₹${opt.value.toLocaleString('en-IN')}`})`;
                                        return (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => {
                                                    setPromoModalCode(opt.code);
                                                    setPromoModalType(opt.type);
                                                    setPromoModalValue(opt.value);
                                                    setPromoModalError('');
                                                }}
                                                style={{
                                                    padding: '5px 10px',
                                                    borderRadius: '6px',
                                                    border: isSelected ? '1.5px solid #ea580c' : '1px solid #fed7aa',
                                                    backgroundColor: isSelected ? '#ea580c' : '#fff7ed',
                                                    color: isSelected ? '#ffffff' : '#c2410c',
                                                    fontSize: '0.78rem',
                                                    fontWeight: 800,
                                                    cursor: 'pointer',
                                                    transition: 'all 0.15s ease'
                                                }}
                                            >
                                                🎟️ {label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Error Banner */}
                            {promoModalError && (
                                <div style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', fontSize: '0.82rem', fontWeight: 700 }}>
                                    {promoModalError}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div style={{ padding: '14px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
                            <div>
                                {appliedCoupon && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            removeCouponCode();
                                            setShowPromoModal(false);
                                        }}
                                        style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #fca5a5', backgroundColor: '#fff', color: '#dc2626', fontWeight: 700, fontSize: '0.80rem', cursor: 'pointer' }}
                                    >
                                        Remove Code
                                    </button>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowPromoModal(false)}
                                    style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#475569', fontWeight: 700, fontSize: '0.84rem', cursor: 'pointer' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleApplyPromoModal}
                                    style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', backgroundColor: '#ea580c', color: '#ffffff', fontWeight: 800, fontSize: '0.84rem', cursor: 'pointer', boxShadow: '0 2px 6px rgba(234, 88, 12, 0.25)' }}
                                >
                                    Apply Promo Code
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Global Datalist for Product Description / Name Dropdown Autocomplete */}
            <datalist id="product-headings-datalist">
                {allProductHeadings.map((heading, idx) => (
                    <option key={idx} value={heading} />
                ))}
            </datalist>

            {/* QC REJECT DETAILS MODAL */}
            <QCRejectDetailsModal
                isOpen={showQCRejectModal}
                onClose={() => setShowQCRejectModal(false)}
                folderId={rejectedQCFolderId}
                projectId={project?.project_code || project?.manual_client_id || project?.project_id || project?.id}
                versionNumber={(selectedVersionData as any)?.version || selectedVersionData?.versionNum || (versions && versions.length > 0 ? (versions[0]?.version || versions[0]?.version_number || versions.length) : 1)}
            />
        </div>
    );
};

export default QuoteTab;