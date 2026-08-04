import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Loader2, Printer, Save, Undo2, Redo2, Trash2, PlusCircle, ListPlus, MoveUp, MoveDown, Check, Heading, ChevronDown, ChevronRight, CheckCircle2, MoreVertical, Copy, BookOpen } from 'lucide-react';
import EleganceLogo from '../assets/Elegance Logo.png';
import ArkLogo from '../assets/Logo.png';
import liveLogo from '../assets/live-logo.png';

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
}

interface QuoteSection {
    id: string;
    name: string;
    items: QuoteItem[];
}

interface QuoteTabProps {
    project: any;
    setQuoteTotal?: (total: number) => void;
    isReadOnly?: boolean;
    user?: any;
    isUsedQuote?: boolean;
    hideSave?: boolean;
    onSaveSuccess?: () => void;
    isAgreementPdfView?: boolean;
}

import { API_BASE_URL } from '../config';

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

const QuoteTab: React.FC<QuoteTabProps> = ({ project, setQuoteTotal, isReadOnly, user, isUsedQuote, hideSave, onSaveSuccess, isAgreementPdfView }) => {
    const [sections, setSections] = useState<QuoteSection[]>([]);
    const [history, setHistory] = useState<QuoteSection[][]>([]);
    const [redoStack, setRedoStack] = useState<QuoteSection[][]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [subtitle, setSubtitle] = useState('');
    const [gstEnabled, setGstEnabled] = useState(false);
    const [showCoverPage, setShowCoverPage] = useState(true);

    // Project Information state
    const [isProjectInfoExpanded, setIsProjectInfoExpanded] = useState(true);
    const [proposalFor, setProposalFor] = useState(project?.client_name || '');

    useEffect(() => {
        if (project?.client_name) {
            setProposalFor(project.client_name);
        }
    }, [project?.client_name]);
    const [projectIdVal, setProjectIdVal] = useState(`DC-${project?.project_id || ''}`);
    const [proposalDate, setProposalDate] = useState(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }));
    const [scopeOfWork, setScopeOfWork] = useState('Complete Interior Design & Execution');
    const [productionTime, setProductionTime] = useState('75 Business Days');
    const [projectCategory, setProjectCategory] = useState('Interior & Furniture Projects');
    const [designerName, setDesignerName] = useState('');
    const [salesManagerName, setSalesManagerName] = useState('');
    const [salesManagerPhone, setSalesManagerPhone] = useState('');
    const [salesManagerEmail, setSalesManagerEmail] = useState('');
    const [discountPercent, setDiscountPercent] = useState(0);
    const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [openItemMenuId, setOpenItemMenuId] = useState<string | null>(null);
    const [isModulesSummaryExpanded, setIsModulesSummaryExpanded] = useState(true);

    // Draft & Versions state
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

    const toggleModule = (id: string) => {
        setExpandedModules(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const duplicateSection = (sectionId: string) => {
        const sec = sections.find(s => s.id === sectionId);
        if (!sec) return;
        const newId = `s${Date.now()}`;
        const newSection: QuoteSection = {
            id: newId,
            name: `${sec.name} (Copy)`,
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

    const addToHistory = (newSections: QuoteSection[]) => {
        setHistory(prev => [...prev.slice(-19), sections]); // Keep last 20 states
        setRedoStack([]);
        setSections(newSections);
    };

    const handleUndo = () => {
        if (history.length === 0) return;
        const previous = history[history.length - 1];
        setRedoStack(prev => [...prev, sections]);
        setHistory(prev => prev.slice(0, -1));
        setSections(previous);
    };

    const handleRedo = () => {
        if (redoStack.length === 0) return;
        const next = redoStack[redoStack.length - 1];
        setHistory(prev => [...prev, sections]);
        setRedoStack(prev => prev.slice(0, -1));
        setSections(next);
    };


    useEffect(() => {
        fetchQuote();
        loadVersions();
    }, [project?.project_id, project?.client_name, isUsedQuote]);

    const fetchQuote = async () => {
        setLoading(true);
        try {
            const cNameParam = project?.client_name ? `&client_name=${encodeURIComponent(project.client_name)}` : '';
            const response = await axios.get(`${API_BASE_URL}/quotes/latest?project_id=${project?.project_id || ''}&is_used=${isUsedQuote}${cNameParam}`);
            if (response.data.success && response.data.data) {
                const qd = response.data.data;
                const mappedSections = (qd.sections || []).map((s: any) => ({
                    id: s.section_id,
                    name: s.section_name,
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
                        image_url: i.image_url || ''
                    }))
                }));
                setSections(mappedSections);
                setSubtitle(qd.subtitle || '');
                if (qd.subtitle || qd.client_name) {
                    setProposalFor(qd.subtitle || qd.client_name);
                }
                if (qd.discount_percent !== undefined) {
                    setDiscountPercent(parseFloat(qd.discount_percent) || 0);
                }
            } else if (!isUsedQuote) {
                // If no quote exists and it's not a used quote, load default data
                setSections(getDefaultSections());
            } else {
                setSections([]);
            }
        } catch (err) {
            console.error('Failed to fetch quote', err);
            if (!isUsedQuote) setSections(getDefaultSections());
        } finally {
            setLoading(false);
        }
    };

    const getDefaultSections = (): QuoteSection[] => [];

    const buildPayload = () => ({
        project_id: project?.project_id,
        is_used_quote: isUsedQuote,
        total_amount: getGrandTotal(),
        sections,
        subtitle: proposalFor || subtitle || project?.client_name || '',
        client_name: proposalFor || project?.client_name || '',
        discount_percent: discountPercent,
        created_by: user?.user_id || 1
    });

    const handleSaveDraft = async () => {
        setSavingDraft(true);
        try {
            const res = await axios.post(`${API_BASE_URL}/quotes/save-draft`, buildPayload());
            if (res.data.success) {
                const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
                setDraftSavedAt(now);
                if (setQuoteTotal) setQuoteTotal(getGrandTotal());
                alert('Draft saved successfully!');
            } else {
                alert('Draft save failed: ' + (res.data.message || 'Unknown error'));
            }
        } catch (err: any) {
            alert('Draft save failed: ' + (err.response?.data?.message || err.message));
        } finally {
            setSavingDraft(false);
        }
    };

    const handleSaveVersion = async () => {
        setSavingVersion(true);
        try {
            const res = await axios.post(`${API_BASE_URL}/quotes/save`, buildPayload());
            if (res.data.success) {
                if (setQuoteTotal) setQuoteTotal(getGrandTotal());
                await loadVersions();
                setIsVersionsExpanded(true);
                alert('New version saved successfully!');
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
        if (!project?.project_id) return;
        setLoadingVersions(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/quotes/versions`, {
                params: { project_id: project.project_id, is_used: isUsedQuote ? 'true' : 'false' }
            });
            if (res.data.success) setVersions(res.data.data || []);
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
                    items: (s.items || []).map((it: any) => ({
                        id: 'i-r-' + it.item_id,
                        particulars: it.particulars || '',
                        brand: it.brand || '',
                        unit: it.unit || '',
                        quantity: parseFloat(it.quantity) || 0,
                        rate: parseFloat(it.rate) || 0,
                        amount: parseFloat(it.amount) || 0,
                        width: it.width || '',
                        height: it.height || '',
                        sft: it.sft || '',
                        hsn_sac: it.hsn_sac || '',
                        image_url: it.image_url || ''
                    }))
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
                const vSections: QuoteSection[] = (qd.sections || []).map((s: any) => ({
                    id: 'v-' + s.section_id,
                    name: s.section_name,
                    items: (s.items || []).map((it: any) => ({
                        id: 'vi-' + it.item_id,
                        particulars: it.particulars || '',
                        brand: it.brand || '',
                        unit: it.unit || '',
                        quantity: parseFloat(it.quantity) || 0,
                        rate: parseFloat(it.rate) || 0,
                        amount: parseFloat(it.amount) || 0,
                        width: it.width || '',
                        height: it.height || '',
                        sft: it.sft || '',
                        hsn_sac: it.hsn_sac || '',
                        image_url: it.image_url || ''
                    }))
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

        if (targetQuoteId && targetVerNum && targetTotal && targetCreatedAt) {
            if (!vData || vData.quoteId !== targetQuoteId) {
                setLoadingVersionPreview(targetQuoteId);
                try {
                    const res = await axios.get(`${API_BASE_URL}/quotes/${targetQuoteId}`);
                    if (res.data.success && res.data.data) {
                        const qd = res.data.data;
                        const vSections: QuoteSection[] = (qd.sections || []).map((s: any) => ({
                            id: 'v-' + s.section_id,
                            name: s.section_name,
                            items: (s.items || []).map((it: any) => ({
                                id: 'vi-' + it.item_id,
                                particulars: it.particulars || '',
                                brand: it.brand || '',
                                unit: it.unit || '',
                                quantity: parseFloat(it.quantity) || 0,
                                rate: parseFloat(it.rate) || 0,
                                amount: parseFloat(it.amount) || 0,
                                width: it.width || '',
                                height: it.height || '',
                                sft: it.sft || '',
                                hsn_sac: it.hsn_sac || '',
                                image_url: it.image_url || ''
                            }))
                        }));
                        vData = { quoteId: targetQuoteId, versionNum: targetVerNum, sections: vSections, total: targetTotal, createdAt: targetCreatedAt };
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

    useEffect(() => {
        const total = getGrandTotal();
        if (setQuoteTotal) setQuoteTotal(total);
    }, [sections]);



    const calculateItemAmount = (qty: number, rate: number) => qty * rate;

    const updateItem = (sectionId: string, itemId: string, field: string, value: any, saveToHistory: boolean = false) => {
        const newSections = sections.map(s => {
            if (s.id === sectionId) {
                return {
                    ...s,
                    items: s.items.map(i => {
                        if (i.id === itemId) {
                            const updated = { ...i, [field]: value };
                            if (field === 'quantity' || field === 'rate') {
                                updated.amount = calculateItemAmount(updated.quantity, updated.rate);
                            }
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
            name: 'NEW SECTION',
            items: []
        };
        addToHistory([...sections, newSection]);
    };

    const deleteSection = (sectionId: string) => {
        if (!window.confirm('Delete this entire section?')) return;
        addToHistory(sections.filter(s => s.id !== sectionId));
    };

    const addHeaderAfterGroup = (sectionId: string, headerId: string) => {
        const newItem: QuoteItem = {
            id: 'i-' + Date.now(),
            particulars: 'SUB TITLE NAME',
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
            particulars: isHeader ? 'SUB TITLE NAME' : 'New Item',
            brand: isHeader ? 'HEADER' : '',
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
                        particulars: target.particulars + ' (Copy)'
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

    const getGrandTotal = () => {
        return sections.reduce((sum, s) => sum + s.items.reduce((itemSum, i) => itemSum + (i.amount || 0), 0), 0);
    };

    const getGstAmount = () => {
        return gstEnabled ? getGrandTotal() * 0.18 : 0;
    };

    const getFinalTotal = () => {
        return getGrandTotal() + getGstAmount();
    };

    const handlePrint = () => {
        window.print();
    };

    const PageHeader = () => (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1.5px solid #0f172a', paddingBottom: '10px', marginBottom: '22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img src={liveLogo} alt="Logo" style={{ height: '38px', objectFit: 'contain' }} />
                <div>
                    <div style={{ fontSize: '11pt', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>Livincart Private Limited</div>
                    <div style={{ fontSize: '7.5pt', color: '#64748b', fontWeight: 500 }}>Official Quotation &amp; Estimation Workspace</div>
                </div>
            </div>
            <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '8pt', fontWeight: 800, color: '#0f172a' }}>COMPANY : LIVINCART AND SERVICES PRIVATE LIMITED</div>
                <div style={{ fontSize: '8pt', fontWeight: 800, color: '#10b981' }}>GST : 37AAGCL5523Q1ZX</div>
            </div>
        </div>
    );

    const PageFooter = () => null;

    const grandTotal = getGrandTotal();

    return (
        <div className="quote-tab-root">
            <div className={`quote-container ${isPrintingVersion ? 'no-print' : 'print-area'}`} style={{ backgroundColor: 'white', borderRadius: '12px' }}>



                {/* ===== WORKSPACE HEADER BAR ===== */}
                {!isAgreementPdfView && (
                    <div className="no-print" style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '14px 20px',
                        backgroundColor: '#ffffff',
                        borderBottom: '1.5px solid #e2e8f0',
                        marginBottom: '20px',
                        borderRadius: '10px',
                        boxShadow: '0 1px 6px rgba(0,0,0,0.07)'
                    }}>
                        {/* Left: Logo + Company Name + Subtitle */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <img src={liveLogo} alt="Livincart Logo" style={{ height: '42px', objectFit: 'contain' }} />
                            <div>
                                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2, letterSpacing: '-0.2px' }}>Livincart Private Limited</div>
                                <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, marginTop: '2px' }}>Official Quotation &amp; Estimation Workspace</div>
                            </div>
                        </div>

                        {/* Right: Action Buttons */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            {/* Undo / Redo (small, subtle) */}
                            {!isReadOnly && (
                                <div style={{ display: 'flex', gap: '4px', marginRight: '6px' }}>
                                    <button onClick={handleUndo} disabled={history.length === 0} title="Undo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: history.length === 0 ? '#f8fafc' : '#f1f5f9', cursor: history.length === 0 ? 'not-allowed' : 'pointer', color: '#64748b' }}>
                                        <Undo2 size={14} />
                                    </button>
                                    <button onClick={handleRedo} disabled={redoStack.length === 0} title="Redo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: redoStack.length === 0 ? '#f8fafc' : '#f1f5f9', cursor: redoStack.length === 0 ? 'not-allowed' : 'pointer', color: '#64748b' }}>
                                        <Redo2 size={14} />
                                    </button>
                                </div>
                            )}

                            {/* Cover Page toggle */}
                            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', fontWeight: 600, color: '#334155', cursor: 'pointer', backgroundColor: '#f8fafc', padding: '5px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', marginRight: '4px' }} title="Toggle Front Cover Page">
                                <input type="checkbox" checked={showCoverPage} onChange={(e) => setShowCoverPage(e.target.checked)} style={{ cursor: 'pointer', width: '13px', height: '13px' }} />
                                Cover Page
                            </label>

                            {/* Print Quote */}
                            <button
                                onClick={handlePrint}
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '7px', border: '1.5px solid #334155', backgroundColor: '#ffffff', color: '#334155', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}
                                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f1f5f9'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#ffffff'; }}
                            >
                                <Printer size={14} /> Print Quote
                            </button>

                            {/* Download PDF */}
                            <button
                                onClick={handlePrint}
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '7px', border: 'none', backgroundColor: '#2563eb', color: '#ffffff', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}
                                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1d4ed8'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#2563eb'; }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                                Download PDF
                            </button>

                            {/* Save Draft */}
                            {!isReadOnly && !hideSave && (
                                <button
                                    onClick={handleSaveDraft}
                                    disabled={savingDraft}
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '7px', border: 'none', backgroundColor: '#f59e0b', color: '#ffffff', fontSize: '0.78rem', fontWeight: 700, cursor: savingDraft ? 'not-allowed' : 'pointer', transition: 'all 0.15s' }}
                                    onMouseEnter={e => { if (!savingDraft) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#d97706'; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f59e0b'; }}
                                    title={draftSavedAt ? `Last draft saved at ${draftSavedAt}` : 'Save working draft'}
                                >
                                    {savingDraft ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                    {savingDraft ? 'Saving...' : draftSavedAt ? `Draft ✓ ${draftSavedAt}` : 'Save Draft'}
                                </button>
                            )}

                            {/* Save Version */}
                            {!isReadOnly && !hideSave && (
                                <button
                                    onClick={() => { handleSaveVersion(); }}
                                    disabled={savingVersion}
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '7px', border: 'none', backgroundColor: '#16a34a', color: '#ffffff', fontSize: '0.78rem', fontWeight: 700, cursor: savingVersion ? 'not-allowed' : 'pointer', transition: 'all 0.15s' }}
                                    onMouseEnter={e => { if (!savingVersion) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#15803d'; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#16a34a'; }}
                                    title="Snapshot the current quote as a new version"
                                >
                                    {savingVersion ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                                    {savingVersion ? 'Saving...' : 'Save Version'}
                                </button>
                            )}

                            {/* Versions History Toggle Button */}
                            {!isReadOnly && (
                                <button
                                    onClick={() => {
                                        const nextState = !isVersionsExpanded;
                                        setIsVersionsExpanded(nextState);
                                        if (nextState) loadVersions();
                                    }}
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '7px', border: '1.5px solid #7c3aed', backgroundColor: isVersionsExpanded ? '#7c3aed' : '#ffffff', color: isVersionsExpanded ? '#ffffff' : '#7c3aed', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}
                                    title="View saved versions history"
                                >
                                    <BookOpen size={14} />
                                    Versions {versions.length > 0 ? `(${versions.length})` : ''}
                                </button>
                            )}

                            {/* Send Quote */}
                            <button
                                onClick={() => window.alert('Send Quote feature coming soon!')}
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '7px', border: 'none', backgroundColor: '#7c3aed', color: '#ffffff', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}
                                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#6d28d9'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#7c3aed'; }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                                Send Quote
                            </button>
                        </div>
                    </div>
                )}

                {/* ===== VERSIONS HISTORY PANEL ===== */}
                {!isReadOnly && (
                    <div className="no-print" style={{ marginBottom: '16px', backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                        {/* Header row */}
                        <div
                            onClick={() => { setIsVersionsExpanded(v => !v); if (!isVersionsExpanded) loadVersions(); }}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', cursor: 'pointer', backgroundColor: isVersionsExpanded ? '#f8fafc' : '#ffffff', borderBottom: isVersionsExpanded ? '1px solid #e2e8f0' : 'none' }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <BookOpen size={16} style={{ color: '#7c3aed' }} />
                                <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a' }}>Versions History</span>
                                {versions.length > 0 && (
                                    <span style={{ backgroundColor: '#7c3aed', color: '#fff', borderRadius: '999px', padding: '1px 8px', fontSize: '0.72rem', fontWeight: 700 }}>{versions.length}</span>
                                )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {draftSavedAt && (
                                    <span style={{ fontSize: '0.73rem', color: '#16a34a', fontWeight: 600, backgroundColor: '#f0fdf4', padding: '3px 8px', borderRadius: '6px', border: '1px solid #bbf7d0' }}>📝 Draft saved at {draftSavedAt}</span>
                                )}
                                {isVersionsExpanded ? <ChevronDown size={16} style={{ color: '#64748b' }} /> : <ChevronRight size={16} style={{ color: '#64748b' }} />}
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
                                                        <td style={{ padding: '9px 10px', textAlign: 'center', fontWeight: 800, color: '#7c3aed' }}>v{v.version}</td>
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
                                                                    onClick={() => viewVersion(v.quote_id, v.version, parseFloat(v.total_amount), v.created_at)}
                                                                    disabled={loadingVersionPreview === v.quote_id}
                                                                    style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #7c3aed', backgroundColor: selectedVersionData?.quoteId === v.quote_id ? '#7c3aed' : '#ffffff', color: selectedVersionData?.quoteId === v.quote_id ? '#fff' : '#7c3aed', fontSize: '0.73rem', fontWeight: 700, cursor: 'pointer' }}
                                                                >
                                                                    {loadingVersionPreview === v.quote_id ? '...' : selectedVersionData?.quoteId === v.quote_id ? '✕ Close' : '👁 View'}
                                                                </button>
                                                                <button
                                                                    onClick={() => printVersion(v.quote_id, v.version, parseFloat(v.total_amount), v.created_at)}
                                                                    disabled={loadingVersionPreview === v.quote_id}
                                                                    style={{ padding: '5px 10px', borderRadius: '6px', border: 'none', backgroundColor: '#2563eb', color: '#ffffff', fontSize: '0.73rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                                    title="Download / Print PDF for this version"
                                                                >
                                                                    <Printer size={12} /> {loadingVersionPreview === v.quote_id ? '...' : 'PDF'}
                                                                </button>
                                                                <button
                                                                    onClick={() => restoreVersion(v.quote_id, v.version)}
                                                                    disabled={restoringVersion === v.quote_id}
                                                                    style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#ffffff', color: '#334155', fontSize: '0.73rem', fontWeight: 700, cursor: 'pointer' }}
                                                                >
                                                                    {restoringVersion === v.quote_id ? '...' : '↩ Restore'}
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>

                                        {/* Version Preview Accordion */}
                                        {selectedVersionData && (
                                            <div style={{ marginTop: '16px', border: '2px solid #7c3aed', borderRadius: '10px', overflow: 'hidden' }}>
                                                {/* Preview Header */}
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', backgroundColor: '#7c3aed', color: '#fff' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <BookOpen size={16} />
                                                        <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>Version {selectedVersionData.versionNum} Preview</span>
                                                        <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>• Saved {new Date(selectedVersionData.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        <button
                                                            onClick={() => printVersion()}
                                                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '6px', border: '1.5px solid #fff', backgroundColor: 'transparent', color: '#fff', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                                                        >
                                                            <Printer size={14} /> Print This Version
                                                        </button>
                                                        <button
                                                            onClick={() => restoreVersion(selectedVersionData.quoteId, selectedVersionData.versionNum)}
                                                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '6px', border: 'none', backgroundColor: '#fff', color: '#7c3aed', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                                                        >
                                                            ↩ Restore to Editor
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* The actual printable version content */}
                                                <div className="version-print-area" style={{ backgroundColor: '#fff', padding: '16px' }}>
                                                    {/* Version modules summary */}
                                                    <div style={{ marginBottom: '16px', padding: '12px 16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                                        <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a', marginBottom: '8px' }}>📋 Modules Summary — Version {selectedVersionData.versionNum}</div>
                                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                                            <thead>
                                                                <tr style={{ backgroundColor: '#e2e8f0' }}>
                                                                    <th style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 700, color: '#334155' }}>#</th>
                                                                    <th style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 700, color: '#334155' }}>Module</th>
                                                                    <th style={{ padding: '7px 10px', textAlign: 'center', fontWeight: 700, color: '#334155' }}>Items</th>
                                                                    <th style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: '#334155' }}>Amount</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {selectedVersionData.sections.map((sec, si) => {
                                                                    const secTotal = sec.items.reduce((a, it) => a + (it.amount || 0), 0);
                                                                    const itemCount = sec.items.filter(it => it.brand !== 'HEADER').length;
                                                                    return (
                                                                        <tr key={sec.id} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: si % 2 === 0 ? '#fff' : '#f8fafc' }}>
                                                                            <td style={{ padding: '7px 10px', fontWeight: 700, color: '#7c3aed' }}>{si + 1}</td>
                                                                            <td style={{ padding: '7px 10px', fontWeight: 600, color: '#0f172a' }}>{sec.name}</td>
                                                                            <td style={{ padding: '7px 10px', textAlign: 'center', color: '#64748b' }}>{itemCount}</td>
                                                                            <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>₹{secTotal.toLocaleString()}</td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                                <tr style={{ borderTop: '2px solid #7c3aed', backgroundColor: '#f3f0ff' }}>
                                                                    <td colSpan={3} style={{ padding: '9px 10px', fontWeight: 800, color: '#0f172a', textAlign: 'right' }}>Grand Total</td>
                                                                    <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 900, color: '#7c3aed', fontSize: '1rem' }}>₹{selectedVersionData.total.toLocaleString()}</td>
                                                                </tr>
                                                            </tbody>
                                                        </table>
                                                    </div>

                                                    {/* Per-module item tables */}
                                                    {selectedVersionData.sections.map((sec, si) => (
                                                        <div key={sec.id} style={{ marginBottom: '16px', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', backgroundColor: '#0f172a', color: '#fff' }}>
                                                                <div style={{ width: '24px', height: '24px', borderRadius: '4px', backgroundColor: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem' }}>{si + 1}</div>
                                                                <span style={{ fontWeight: 800, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{sec.name}</span>
                                                            </div>
                                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                                                <thead>
                                                                    <tr style={{ backgroundColor: '#fef9f0' }}>
                                                                        <th style={{ padding: '7px 10px', textAlign: 'center', width: '40px', fontWeight: 700, color: '#475569' }}>#</th>
                                                                        <th style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 700, color: '#475569' }}>Item</th>
                                                                        <th style={{ padding: '7px 10px', textAlign: 'center', width: '60px', fontWeight: 700, color: '#475569' }}>Qty</th>
                                                                        <th style={{ padding: '7px 10px', textAlign: 'right', width: '90px', fontWeight: 700, color: '#475569' }}>Rate</th>
                                                                        <th style={{ padding: '7px 10px', textAlign: 'right', width: '100px', fontWeight: 700, color: '#475569' }}>Amount</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {(() => {
                                                                        let counter = 0;
                                                                        return sec.items.map((item, ii) => {
                                                                            if (item.brand === 'HEADER') {
                                                                                counter = 0;
                                                                                return (
                                                                                    <tr key={item.id}>
                                                                                        <td colSpan={5} style={{ padding: '6px 10px', backgroundColor: '#e8f0fe', borderTop: '2px solid #c7d7f9', fontWeight: 800, color: '#1e3a8a', fontSize: '0.78rem', textTransform: 'uppercase' }}>{item.particulars}</td>
                                                                                    </tr>
                                                                                );
                                                                            }
                                                                            counter++;
                                                                            return (
                                                                                <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: counter % 2 === 0 ? '#fafafa' : '#fff' }}>
                                                                                    <td style={{ padding: '7px 10px', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>{counter}</td>
                                                                                    <td style={{ padding: '7px 10px', fontWeight: 600, color: '#0f172a' }}>{item.particulars}</td>
                                                                                    <td style={{ padding: '7px 10px', textAlign: 'center', color: '#334155' }}>{item.quantity || 1}</td>
                                                                                    <td style={{ padding: '7px 10px', textAlign: 'right', color: '#334155' }}>₹{(item.rate || 0).toLocaleString()}</td>
                                                                                    <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>₹{(item.amount || 0).toLocaleString()}</td>
                                                                                </tr>
                                                                            );
                                                                        });
                                                                    })()}
                                                                </tbody>
                                                            </table>
                                                            <PageFooter />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Subtitle input */}
                {!isReadOnly && (
                    <div className="no-print" style={{ padding: '0 24px', marginBottom: '16px' }}>
                        <input
                            type="text"
                            placeholder="Enter quote subtitle / reference..."
                            value={subtitle}
                            onChange={(e) => setSubtitle(e.target.value)}
                            style={{ padding: '7px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.88rem', width: '340px', color: '#334155', fontWeight: 600 }}
                        />
                    </div>
                )}

                <div className="no-print" style={{ padding: '0 4px' }}>

                    {/* ===== PROJECT INFORMATION ACCORDION CARD ===== */}
                    <div style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '12px',
                        border: '1px solid #cbd5e1',
                        marginBottom: '20px',
                        overflow: 'hidden',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
                    }}>
                        <div
                            onClick={() => setIsProjectInfoExpanded(!isProjectInfoExpanded)}
                            className="project-info-header"
                            style={{
                                padding: '14px 20px',
                                backgroundColor: '#f8fafc',
                                borderBottom: isProjectInfoExpanded ? '1px solid #e2e8f0' : 'none',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                                fontWeight: 800,
                                fontSize: '0.95rem',
                                color: '#0f172a'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '4px', height: '20px', backgroundColor: '#1e3a8a', borderRadius: '2px' }} />
                                <span className="project-info-title">Project Information</span>
                            </div>
                            <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#64748b' }}>
                                <span>{isProjectInfoExpanded ? 'Collapse' : 'Expand'}</span>
                                {isProjectInfoExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                            </div>
                        </div>

                        <div className="project-info-body-container" style={{ padding: '24px 20px', display: isProjectInfoExpanded ? 'block' : 'none' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Proposal Created for:</label>
                                    {isReadOnly ? (
                                        <div style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', fontSize: '0.88rem', fontWeight: 600 }}>{proposalFor || '—'}</div>
                                    ) : (
                                        <input type="text" value={proposalFor} onChange={e => setProposalFor(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem', fontWeight: 600 }} />
                                    )}
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Project ID:</label>
                                    {isReadOnly ? (
                                        <div style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', fontSize: '0.88rem', fontWeight: 600 }}>{projectIdVal}</div>
                                    ) : (
                                        <input type="text" value={projectIdVal} onChange={e => setProjectIdVal(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem', fontWeight: 600 }} />
                                    )}
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Proposal Created on:</label>
                                    {isReadOnly ? (
                                        <div style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', fontSize: '0.88rem', fontWeight: 600 }}>{proposalDate}</div>
                                    ) : (
                                        <input type="text" value={proposalDate} onChange={e => setProposalDate(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem', fontWeight: 600 }} />
                                    )}
                                </div>
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Scope of Work:</label>
                                {isReadOnly ? (
                                    <div style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', fontSize: '0.88rem', fontWeight: 600, minHeight: '36px' }}>{scopeOfWork}</div>
                                ) : (
                                    <textarea rows={2} value={scopeOfWork} onChange={e => setScopeOfWork(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem', fontWeight: 600, resize: 'vertical' }} />
                                )}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Time for Production & Installation:</label>
                                    {isReadOnly ? (
                                        <div style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', fontSize: '0.88rem', fontWeight: 600 }}>{productionTime}</div>
                                    ) : (
                                        <input type="text" value={productionTime} onChange={e => setProductionTime(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem', fontWeight: 600 }} />
                                    )}
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Project Category:</label>
                                    {isReadOnly ? (
                                        <div style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', fontSize: '0.88rem', fontWeight: 600 }}>{projectCategory}</div>
                                    ) : (
                                        <input type="text" value={projectCategory} onChange={e => setProjectCategory(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem', fontWeight: 600 }} />
                                    )}
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Designer Name:</label>
                                    {isReadOnly ? (
                                        <div style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', fontSize: '0.88rem', fontWeight: 600 }}>{designerName || 'Livincart Team'}</div>
                                    ) : (
                                        <input type="text" value={designerName} onChange={e => setDesignerName(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem', fontWeight: 600 }} />
                                    )}
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Sales Manager Name:</label>
                                    {isReadOnly ? (
                                        <div style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', fontSize: '0.88rem', fontWeight: 600 }}>{salesManagerName || '—'}</div>
                                    ) : (
                                        <input type="text" value={salesManagerName} onChange={e => setSalesManagerName(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem', fontWeight: 600 }} />
                                    )}
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '14px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Sales Manager Phone:</label>
                                    {isReadOnly ? (
                                        <div style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', fontSize: '0.88rem', fontWeight: 600 }}>{salesManagerPhone || '—'}</div>
                                    ) : (
                                        <input type="text" value={salesManagerPhone} onChange={e => setSalesManagerPhone(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem', fontWeight: 600 }} />
                                    )}
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Sales Manager Email:</label>
                                    {isReadOnly ? (
                                        <div style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', fontSize: '0.88rem', fontWeight: 600 }}>{salesManagerEmail || '—'}</div>
                                    ) : (
                                        <input type="text" value={salesManagerEmail} onChange={e => setSalesManagerEmail(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem', fontWeight: 600 }} />
                                    )}
                                </div>
                            </div>

                            <div style={{ padding: '10px 14px', backgroundColor: '#f1f5f9', borderRadius: '6px', fontSize: '0.78rem', color: '#475569', fontStyle: 'italic', fontWeight: 600 }}>
                                ℹ️ The timeline may change based on Location, Finishes, Project Value, and Civil Scope of work.
                            </div>
                        </div>
                    </div>

                    {/* ===== MODULES SUMMARY TABLE ===== */}
                    <div style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '12px',
                        border: '1px solid #cbd5e1',
                        marginBottom: '20px',
                        overflow: 'hidden',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
                    }}>
                        <div style={{
                            padding: '14px 20px',
                            backgroundColor: '#f8fafc',
                            borderBottom: isModulesSummaryExpanded ? '1px solid #e2e8f0' : 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontWeight: 800,
                            fontSize: '0.95rem',
                            color: '#0f172a'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <BookOpen size={18} style={{ color: '#059669' }} />
                                <span>Modules Summary & Amount List</span>
                                <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>({sections.length} modules)</span>
                            </div>
                            <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                {!isReadOnly && (
                                    <button
                                        onClick={addSection}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            padding: '6px 12px',
                                            backgroundColor: '#0f172a',
                                            color: '#ffffff',
                                            border: 'none',
                                            borderRadius: '6px',
                                            fontSize: '0.8rem',
                                            fontWeight: 700,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <PlusCircle size={14} /> Add Module
                                    </button>
                                )}
                                <button
                                    onClick={() => setIsModulesSummaryExpanded(!isModulesSummaryExpanded)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        background: 'none',
                                        border: 'none',
                                        fontSize: '0.8rem',
                                        color: '#64748b',
                                        cursor: 'pointer',
                                        fontWeight: 600
                                    }}
                                >
                                    <span>{isModulesSummaryExpanded ? 'Collapse' : 'Expand'}</span>
                                    {isModulesSummaryExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                </button>
                            </div>
                        </div>

                        {isModulesSummaryExpanded && (
                            <div style={{ padding: '16px 20px' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1.5px solid #cbd5e1', color: '#475569' }}>
                                            <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, width: '8%' }}>#</th>
                                            <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, width: '52%' }}>Module Name</th>
                                            <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, width: '20%' }}>Total Items</th>
                                            <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, width: '20%' }}>Module Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sections.map((sec, idx) => {
                                            const sectionTotal = sec.items.reduce((a, item) => a + (item.amount || 0), 0);
                                            const count = sec.items.filter(i => i.brand !== 'HEADER').length;
                                            return (
                                                <tr key={sec.id || idx} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                                                    <td style={{ padding: '10px 12px', fontWeight: 600, color: '#64748b' }}>{idx + 1}</td>
                                                    <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0f172a' }}>{sec.name}</td>
                                                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#475569', fontWeight: 600 }}>{count} Items</td>
                                                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#059669' }}>₹{sectionTotal.toLocaleString()}</td>
                                                </tr>
                                            );
                                        })}
                                        <tr style={{ borderTop: '2px solid #cbd5e1', backgroundColor: '#f8fafc', fontWeight: 800 }}>
                                            <td colSpan={3} style={{ padding: '12px 12px', textAlign: 'right', fontSize: '0.9rem', color: '#334155' }}>Total Modules Gross Amount:</td>
                                            <td style={{ padding: '12px 12px', textAlign: 'right', fontSize: '1rem', color: '#059669' }}>₹{grandTotal.toLocaleString()}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>



                    {/* ===== ACCORDION MODULE EDITOR ===== */}
                    <div className="no-print" style={{ marginBottom: '20px' }}>
                        {sections.map((section, sIdx) => {
                            const sectionTotal = section.items.reduce((a, i) => a + (i.amount || 0), 0);
                            const isExpanded = expandedModules[section.id] ?? false;
                            const itemCount = section.items.filter(i => i.brand !== 'HEADER').length;
                            return (
                                <div key={section.id} style={{
                                    backgroundColor: '#ffffff',
                                    borderRadius: '12px',
                                    border: '1px solid #e2e8f0',
                                    marginBottom: '12px',
                                    overflow: 'hidden',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                                }}>
                                    {/* Module Header */}
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '14px 16px',
                                        backgroundColor: isExpanded ? '#fafbfc' : '#ffffff',
                                        borderBottom: isExpanded ? '1px solid #e2e8f0' : 'none',
                                        gap: '12px'
                                    }}>
                                        {/* Number badge */}
                                        <div style={{
                                            width: '32px', height: '32px',
                                            borderRadius: '8px',
                                            backgroundColor: '#1e3a8a',
                                            color: '#ffffff',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontWeight: 800, fontSize: '0.85rem',
                                            flexShrink: 0
                                        }}>{sIdx + 1}</div>

                                        {/* Module name */}
                                        <div style={{ flex: 1 }}>
                                            {isReadOnly ? (
                                                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>{section.name}</div>
                                            ) : (
                                                <input
                                                    value={section.name}
                                                    onChange={(e) => updateSectionName(section.id, e.target.value, false)}
                                                    onBlur={(e) => updateSectionName(section.id, e.target.value, true)}
                                                    style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a', border: 'none', outline: 'none', backgroundColor: 'transparent', width: '100%' }}
                                                />
                                            )}
                                            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                                                {itemCount} Items • ₹{sectionTotal.toLocaleString()}
                                            </div>
                                        </div>

                                        {/* Expand/collapse */}
                                        <button
                                            onClick={() => toggleModule(section.id)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px', display: 'flex', alignItems: 'center' }}
                                        >
                                            {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                        </button>

                                        {/* Three-dot menu */}
                                        {!isReadOnly && (
                                            <div style={{ position: 'relative' }}>
                                                <button
                                                    onClick={() => setOpenMenuId(openMenuId === section.id ? null : section.id)}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px', display: 'flex', alignItems: 'center' }}
                                                >
                                                    <MoreVertical size={20} />
                                                </button>
                                                {openMenuId === section.id && (
                                                    <div style={{
                                                        position: 'absolute', right: 0, top: '100%', zIndex: 50,
                                                        backgroundColor: '#ffffff', border: '1px solid #e2e8f0',
                                                        borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                                                        minWidth: '180px', padding: '4px 0'
                                                    }}>
                                                        <button onClick={() => { moveSectionUp(section.id); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.85rem', color: '#3b82f6', fontWeight: 600 }}>
                                                            <MoveUp size={16} /> Move Up
                                                        </button>
                                                        <button onClick={() => { moveSectionDown(section.id); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.85rem', color: '#3b82f6', fontWeight: 600 }}>
                                                            <MoveDown size={16} /> Move Down
                                                        </button>
                                                        <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '4px 0' }} />
                                                        <button onClick={() => { addItem(section.id); setOpenMenuId(null); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.85rem', color: '#16a34a', fontWeight: 600 }}>
                                                            <PlusCircle size={16} /> Add Item
                                                        </button>
                                                        <button onClick={() => duplicateSection(section.id)} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.85rem', color: '#3b82f6', fontWeight: 600 }}>
                                                            <Copy size={16} /> Duplicate Section
                                                        </button>
                                                        <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '4px 0' }} />
                                                        <button onClick={() => { deleteSection(section.id); setOpenMenuId(null); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.85rem', color: '#dc2626', fontWeight: 600 }}>
                                                            <Trash2 size={16} /> Delete Section
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Expanded Module Body - Items Table */}
                                    {isExpanded && (
                                        <div style={{ padding: '16px' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                                <thead>
                                                    <tr style={{ backgroundColor: '#f1f5f9' }}>
                                                        <th style={{ padding: '10px 12px', textAlign: 'center', width: '40px', fontWeight: 700, color: '#475569', borderBottom: '2px solid #cbd5e1', fontSize: '0.88rem' }}>#</th>
                                                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#475569', borderBottom: '2px solid #cbd5e1', fontSize: '0.88rem' }}>Product Name</th>
                                                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#475569', borderBottom: '2px solid #cbd5e1', fontSize: '0.88rem' }}>Shutter Material | Finish</th>
                                                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#475569', borderBottom: '2px solid #cbd5e1', fontSize: '0.88rem' }}>Carcass Material | Color</th>
                                                        <th style={{ padding: '10px 12px', textAlign: 'center', width: '180px', fontWeight: 700, color: '#475569', borderBottom: '2px solid #cbd5e1', fontSize: '0.88rem' }}>Dimensions (H * D * W)</th>
                                                        <th style={{ padding: '10px 12px', textAlign: 'center', width: '70px', fontWeight: 700, color: '#475569', borderBottom: '2px solid #cbd5e1', fontSize: '0.88rem' }}>QTY</th>
                                                        <th style={{ padding: '10px 12px', textAlign: 'right', width: '110px', fontWeight: 700, color: '#475569', borderBottom: '2px solid #cbd5e1', fontSize: '0.88rem' }}>Price</th>
                                                        <th style={{ padding: '10px 12px', textAlign: 'right', width: '120px', fontWeight: 700, color: '#475569', borderBottom: '2px solid #cbd5e1', fontSize: '0.88rem' }}>Amount</th>
                                                        {!isReadOnly && <th style={{ padding: '10px 12px', textAlign: 'center', width: '40px', fontWeight: 700, color: '#475569', borderBottom: '2px solid #cbd5e1' }}></th>}
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
                                                            return (
                                                                <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: isHeader ? '#f8fafc' : '#fff' }}>
                                                                    <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: '0.85rem', color: '#64748b', fontWeight: 600, verticalAlign: 'middle' }}>{displayNum}</td>

                                                                    {/* Product Name Column */}
                                                                    <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                                                                        {isHeader ? (
                                                                            <input value={item.particulars}
                                                                                onChange={(e) => updateItem(section.id, item.id, 'particulars', e.target.value, false)}
                                                                                onBlur={(e) => updateItem(section.id, item.id, 'particulars', e.target.value, true)}
                                                                                style={{ width: '100%', border: 'none', outline: 'none', fontWeight: 800, backgroundColor: 'transparent', fontSize: '0.95rem', color: '#1e3a8a' }}
                                                                            />
                                                                        ) : (
                                                                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
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
                                                                                        width: '52px',
                                                                                        height: '52px',
                                                                                        border: item.image_url ? '1px solid #cbd5e1' : '1.5px dashed #cbd5e1',
                                                                                        borderRadius: '6px',
                                                                                        display: 'flex',
                                                                                        flexDirection: 'column',
                                                                                        alignItems: 'center',
                                                                                        justifyContent: 'center',
                                                                                        backgroundColor: '#f8fafc',
                                                                                        overflow: 'hidden',
                                                                                        transition: 'all 0.2s'
                                                                                    }}>
                                                                                        {item.image_url ? (
                                                                                            <img src={item.image_url} alt="Product" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                                        ) : (
                                                                                            <>
                                                                                                <span style={{ fontSize: '13px', color: '#64748b' }}>📷</span>
                                                                                                <span style={{ fontSize: '8px', color: '#64748b', marginTop: '2px', fontWeight: 700 }}>Upload</span>
                                                                                            </>
                                                                                        )}
                                                                                    </div>
                                                                                </label>

                                                                                <div style={{ flex: 1 }}>
                                                                                    <input value={item.particulars}
                                                                                        placeholder="Product Name"
                                                                                        onChange={(e) => updateItem(section.id, item.id, 'particulars', e.target.value, false)}
                                                                                        onBlur={(e) => updateItem(section.id, item.id, 'particulars', e.target.value, true)}
                                                                                        style={{ width: '100%', border: 'none', outline: 'none', fontWeight: 700, backgroundColor: 'transparent', fontSize: '0.92rem', color: '#0f172a' }}
                                                                                    />
                                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                                                                        <span style={{ fontSize: '0.80rem', color: '#64748b', fontWeight: 600 }}>Handles:</span>
                                                                                        <input value={item.unit}
                                                                                            placeholder="None"
                                                                                            onChange={(e) => updateItem(section.id, item.id, 'unit', e.target.value, false)}
                                                                                            onBlur={(e) => updateItem(section.id, item.id, 'unit', e.target.value, true)}
                                                                                            style={{ border: 'none', outline: 'none', backgroundColor: 'transparent', fontSize: '0.80rem', color: '#475569', width: '100px', borderBottom: '1px dashed #cbd5e1', fontWeight: 600 }}
                                                                                        />
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </td>

                                                                    {/* Shutter Material Column */}
                                                                    <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                                                                        {isHeader ? '' : (
                                                                            <input value={item.hsn_sac || ''}
                                                                                placeholder="Shutter finish"
                                                                                onChange={(e) => updateItem(section.id, item.id, 'hsn_sac', e.target.value, false)}
                                                                                onBlur={(e) => updateItem(section.id, item.id, 'hsn_sac', e.target.value, true)}
                                                                                style={{ width: '100%', border: 'none', outline: 'none', backgroundColor: 'transparent', fontSize: '0.90rem', fontWeight: 600, color: '#334155' }}
                                                                            />
                                                                        )}
                                                                    </td>

                                                                    {/* Carcass Material Column */}
                                                                    <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                                                                        {isHeader ? '' : (
                                                                            <input value={item.brand || ''}
                                                                                placeholder="Carcass finish"
                                                                                onChange={(e) => updateItem(section.id, item.id, 'brand', e.target.value, false)}
                                                                                onBlur={(e) => updateItem(section.id, item.id, 'brand', e.target.value, true)}
                                                                                style={{ width: '100%', border: 'none', outline: 'none', backgroundColor: 'transparent', fontSize: '0.90rem', fontWeight: 600, color: '#334155' }}
                                                                            />
                                                                        )}
                                                                    </td>

                                                                    {/* Dimensions Column (H * D * W) */}
                                                                    <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                                                                        {isHeader ? '' : (
                                                                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'center' }}>
                                                                                <input value={item.height || ''} placeholder="H"
                                                                                    onChange={(e) => updateItem(section.id, item.id, 'height', e.target.value, false)}
                                                                                    onBlur={(e) => updateItem(section.id, item.id, 'height', e.target.value, true)}
                                                                                    style={{ width: '38px', border: '1px solid #cbd5e1', borderRadius: '4px', textAlign: 'center', outline: 'none', fontSize: '0.85rem', padding: '4px 2px', fontWeight: 600 }}
                                                                                />
                                                                                <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700 }}>x</span>
                                                                                <input value={item.sft || ''} placeholder="D"
                                                                                    onChange={(e) => updateItem(section.id, item.id, 'sft', e.target.value, false)}
                                                                                    onBlur={(e) => updateItem(section.id, item.id, 'sft', e.target.value, true)}
                                                                                    style={{ width: '38px', border: '1px solid #cbd5e1', borderRadius: '4px', textAlign: 'center', outline: 'none', fontSize: '0.85rem', padding: '4px 2px', fontWeight: 600 }}
                                                                                />
                                                                                <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700 }}>x</span>
                                                                                <input value={item.width || ''} placeholder="W"
                                                                                    onChange={(e) => updateItem(section.id, item.id, 'width', e.target.value, false)}
                                                                                    onBlur={(e) => updateItem(section.id, item.id, 'width', e.target.value, true)}
                                                                                    style={{ width: '38px', border: '1px solid #cbd5e1', borderRadius: '4px', textAlign: 'center', outline: 'none', fontSize: '0.85rem', padding: '4px 2px', fontWeight: 600 }}
                                                                                />
                                                                            </div>
                                                                        )}
                                                                    </td>

                                                                    {/* QTY Column */}
                                                                    <td style={{ padding: '10px 12px', textAlign: 'center', verticalAlign: 'middle' }}>
                                                                        {isHeader ? '' : (
                                                                            <input type="number" value={item.quantity}
                                                                                onChange={(e) => updateItem(section.id, item.id, 'quantity', parseFloat(e.target.value) || 0, false)}
                                                                                onBlur={(e) => updateItem(section.id, item.id, 'quantity', parseFloat(e.target.value) || 0, true)}
                                                                                style={{ width: '100%', border: 'none', textAlign: 'center', outline: 'none', backgroundColor: 'transparent', fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}
                                                                            />
                                                                        )}
                                                                    </td>

                                                                    {/* Price Column */}
                                                                    <td style={{ padding: '10px 12px', textAlign: 'right', verticalAlign: 'middle' }}>
                                                                        {isHeader ? '' : (
                                                                            <input type="number" value={item.rate}
                                                                                onChange={(e) => updateItem(section.id, item.id, 'rate', parseFloat(e.target.value) || 0, false)}
                                                                                onBlur={(e) => updateItem(section.id, item.id, 'rate', parseFloat(e.target.value) || 0, true)}
                                                                                style={{ width: '100%', border: 'none', textAlign: 'right', outline: 'none', backgroundColor: 'transparent', fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}
                                                                            />
                                                                        )}
                                                                    </td>

                                                                    {/* Amount Column */}
                                                                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#0f172a', verticalAlign: 'middle', fontSize: '0.92rem' }}>
                                                                        {isHeader ? '' : `₹${(item.amount || 0).toLocaleString()}`}
                                                                    </td>

                                                                    {/* Item Action Column: 3-Dot Dropdown Menu */}
                                                                    {!isReadOnly && (
                                                                        <td style={{ padding: '8px 4px', textAlign: 'center', verticalAlign: 'middle', position: 'relative' }}>
                                                                            <button
                                                                                onClick={() => setOpenItemMenuId(openItemMenuId === item.id ? null : item.id)}
                                                                                title="Item Actions"
                                                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px', display: 'flex', alignItems: 'center', margin: '0 auto' }}
                                                                            >
                                                                                <MoreVertical size={18} />
                                                                            </button>
                                                                            {openItemMenuId === item.id && (
                                                                                <div style={{
                                                                                    position: 'absolute',
                                                                                    right: '10px',
                                                                                    top: '80%',
                                                                                    zIndex: 60,
                                                                                    backgroundColor: '#ffffff',
                                                                                    border: '1px solid #cbd5e1',
                                                                                    borderRadius: '8px',
                                                                                    boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                                                                                    minWidth: '160px',
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

                                            {/* Add Item / Add Sub Title buttons inside module */}
                                            {!isReadOnly && (
                                                <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', padding: '12px 0 4px 0' }}>
                                                    <button onClick={() => addItem(section.id)} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, color: '#16a34a' }}>
                                                        <PlusCircle size={16} /> Add Item
                                                    </button>
                                                    <button onClick={() => addItem(section.id, true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, color: '#f59e0b' }}>
                                                        <Heading size={16} /> Add Sub Title
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* + Add New Module button */}
                        {!isReadOnly && (
                            <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
                                <button onClick={addSection} style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    padding: '10px 24px',
                                    backgroundColor: '#1e3a8a', color: '#ffffff',
                                    border: 'none', borderRadius: '10px',
                                    fontWeight: 800, fontSize: '0.88rem',
                                    cursor: 'pointer',
                                    boxShadow: '0 2px 8px rgba(30, 58, 138, 0.25)'
                                }}>
                                    <PlusCircle size={18} /> + Add New Module
                                </button>
                            </div>
                        )}

                        {/* GST Toggle */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, color: '#253b50', fontSize: '0.85rem' }}>
                                <input
                                    type="checkbox"
                                    checked={gstEnabled}
                                    onChange={(e) => setGstEnabled(e.target.checked)}
                                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                />
                                Add 18% GST to Grand Total
                            </label>
                            {gstEnabled && (
                                <span style={{ fontSize: '0.82rem', color: '#16a34a', fontWeight: 700 }}>GST: ₹{getGstAmount().toLocaleString()} | Final: ₹{getFinalTotal().toLocaleString()}</span>
                            )}
                        </div>

                        {/* Grand Total display */}
                        <div style={{
                            display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
                            padding: '14px 20px', marginTop: '12px',
                            backgroundColor: '#1e3a8a', borderRadius: '10px', color: '#ffffff'
                        }}>
                            <span style={{ fontSize: '0.95rem', fontWeight: 700, marginRight: '20px' }}>Total Modules Gross Amount:</span>
                            <span style={{ fontSize: '1.15rem', fontWeight: 900 }}>₹{(gstEnabled ? getFinalTotal() : grandTotal).toLocaleString()}</span>
                        </div>
                    </div>
                </div>



                {/* =============================================================== */}
                {/* PRINT-ONLY PDF LAYOUT — Hidden on screen, shown only on print   */}
                {/* =============================================================== */}
                {(() => {
                    const subTotal = sections.reduce((acc, sec) => acc + (sec.items || []).reduce((iAcc, item) => iAcc + (item.amount || ((item.quantity || 1) * (item.rate || 0))), 0), 0);
                    const discountAmt = (subTotal * discountPercent) / 100;
                    const taxableAmt = subTotal - discountAmt;
                    const gstTotal = gstEnabled ? taxableAmt * 0.18 : 0;
                    const finalGrandTotal = getRoundedTotal(taxableAmt + gstTotal);

                    return (
                        <div className="print-only" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", color: '#1e293b', backgroundColor: '#ffffff' }}>
                            {/* ===== PAGE 1: COVER PAGE ===== */}
                            {showCoverPage && (
                                <div className="page-break-cover" style={{
                                    minHeight: '270mm',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    backgroundColor: '#ffffff',
                                    padding: '40px 16px 20px 16px',
                                    position: 'relative',
                                    boxSizing: 'border-box',
                                    textAlign: 'center',
                                    pageBreakAfter: 'always',
                                    breakAfter: 'page'
                                }}>
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                                        {/* Logo */}
                                        <div style={{ marginBottom: '32px' }}>
                                            <img src={liveLogo} alt="Livincart Logo" style={{ height: '110px', objectFit: 'contain' }} />
                                        </div>

                                        {/* Company Name */}
                                        <div style={{ fontSize: '16pt', fontWeight: 800, color: '#0f172a', marginBottom: '8px', maxWidth: '520px', lineHeight: 1.3, letterSpacing: '0.5px' }}>
                                            COMPANY : LIVINCART AND SERVICES PRIVATE LIMITED
                                        </div>

                                        {/* GST */}
                                        <div style={{ fontSize: '11pt', fontWeight: 800, color: '#10b981', marginBottom: '36px', letterSpacing: '0.5px' }}>
                                            GST : 37AAGCL5523Q1ZX
                                        </div>

                                        {/* Capsule Badge */}
                                        <div style={{ border: '1.5px solid #cbd5e1', borderRadius: '30px', padding: '9px 30px', marginBottom: '32px', display: 'inline-block' }}>
                                            <span style={{ fontSize: '9pt', fontWeight: 800, color: '#475569', letterSpacing: '1.5px' }}>OFFICIAL QUOTATION &amp; PROJECT ESTIMATE</span>
                                        </div>

                                        {/* Quote + Date */}
                                        <div style={{ fontSize: '9.5pt', fontWeight: 700, color: '#475569', marginBottom: '16px' }}>
                                            Quote No: QTN-{project?.project_id || '16'} &nbsp;•&nbsp; Date: {proposalDate}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ===== PAGE 2: PROJECT INFORMATION ===== */}
                            <div className="page-break-project-info" style={{ minHeight: 'auto', padding: '16px 12px 20px', backgroundColor: '#ffffff', position: 'relative', boxSizing: 'border-box', pageBreakAfter: 'always', breakAfter: 'page' }}>
                                <PageHeader />
                                <div style={{ fontSize: '12pt', fontWeight: 800, color: '#0f172a', marginBottom: '18px', letterSpacing: '0.3px' }}>PROJECT INFORMATION</div>

                                {/* Row 1: 3 columns */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '16px' }}>
                                    <div>
                                        <div style={{ fontSize: '7.5pt', color: '#64748b', marginBottom: '3px' }}>Proposal Created for:</div>
                                        <div style={{ fontSize: '9.5pt', fontWeight: 700, color: '#0f172a' }}>{proposalFor || project?.client_name || 'Valued Client'}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '7.5pt', color: '#64748b', marginBottom: '3px' }}>Project ID:</div>
                                        <div style={{ fontSize: '9.5pt', fontWeight: 700, color: '#0f172a' }}>{projectIdVal}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '7.5pt', color: '#64748b', marginBottom: '3px' }}>Proposal Created on:</div>
                                        <div style={{ fontSize: '9.5pt', fontWeight: 700, color: '#0f172a' }}>{proposalDate}</div>
                                    </div>
                                </div>

                                {/* Scope of Work: full width */}
                                <div style={{ marginBottom: '16px' }}>
                                    <div style={{ fontSize: '7.5pt', color: '#64748b', marginBottom: '4px' }}>Scope of Work:</div>
                                    <div style={{ fontSize: '9pt', fontWeight: 600, color: '#0f172a', lineHeight: 1.5 }}>{scopeOfWork}</div>
                                </div>

                                {/* Row 2: 4 columns */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                    <div>
                                        <div style={{ fontSize: '7.5pt', color: '#64748b', marginBottom: '3px' }}>Time for Production &amp; Installation:</div>
                                        <div style={{ fontSize: '9.5pt', fontWeight: 700, color: '#0f172a' }}>{productionTime}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '7.5pt', color: '#64748b', marginBottom: '3px' }}>Project Category:</div>
                                        <div style={{ fontSize: '9.5pt', fontWeight: 700, color: '#0f172a' }}>{projectCategory}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '7.5pt', color: '#64748b', marginBottom: '3px' }}>Designer Name:</div>
                                        <div style={{ fontSize: '9.5pt', fontWeight: 700, color: '#0f172a' }}>{designerName || 'Livincart Team'}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '7.5pt', color: '#64748b', marginBottom: '3px' }}>Sales Manager Name:</div>
                                        <div style={{ fontSize: '9.5pt', fontWeight: 700, color: '#0f172a' }}>{salesManagerName || '—'}</div>
                                    </div>
                                </div>

                                {/* Row 3: Phone + Email */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '18px' }}>
                                    <div>
                                        <div style={{ fontSize: '7.5pt', color: '#64748b', marginBottom: '3px' }}>Sales Manager Phone:</div>
                                        <div style={{ fontSize: '9.5pt', fontWeight: 700, color: '#0f172a' }}>{salesManagerPhone || '—'}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '7.5pt', color: '#64748b', marginBottom: '3px' }}>Sales Manager Email:</div>
                                        <div style={{ fontSize: '9.5pt', fontWeight: 700, color: '#0f172a' }}>{salesManagerEmail || '—'}</div>
                                    </div>
                                </div>

                                {/* Info note box */}
                                <div style={{ backgroundColor: '#eff6ff', borderRadius: '4px', padding: '8px 12px', fontSize: '8pt', color: '#1e40af', fontStyle: 'italic' }}>
                                    ℹ️ The timeline may change based on Location, Finishes, Project Value, and Civil Scope of work.
                                </div>

                                <PageFooter />
                            </div>

                            {/* ===== PAGE 3: MODULES SUMMARY & AMOUNT LIST ===== */}
                            <div className="page-break-modules-summary" style={{ minHeight: 'auto', padding: '16px 12px 20px', backgroundColor: '#ffffff', position: 'relative', boxSizing: 'border-box', pageBreakAfter: 'always', breakAfter: 'page' }}>
                                <PageHeader />
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '16px' }}>
                                    <span style={{ fontSize: '12pt', fontWeight: 800, color: '#0f172a' }}>MODULES SUMMARY &amp; AMOUNT LIST</span>
                                    <span style={{ fontSize: '9pt', color: '#475569', fontWeight: 800 }}>({sections.length} modules)</span>
                                </div>

                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8.5pt', border: '1px solid #e2e8f0' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1.5px solid #cbd5e1' }}>
                                            <th style={{ padding: '9px 12px', textAlign: 'center', fontWeight: 700, color: '#334155', width: '6%' }}>#</th>
                                            <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 700, color: '#334155' }}>Module Name</th>
                                            <th style={{ padding: '9px 12px', textAlign: 'center', fontWeight: 700, color: '#334155', width: '18%' }}>Total Items</th>
                                            <th style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: '#334155', width: '22%' }}>Module Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sections.map((section, idx) => {
                                            const secTotal = section.items.reduce((a, i) => a + (i.amount || 0), 0);
                                            const itemCount = section.items.filter(i => i.brand !== 'HEADER').length;
                                            return (
                                                <tr key={section.id} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                                                    <td style={{ padding: '9px 12px', textAlign: 'center', fontWeight: 600, color: '#475569' }}>{idx + 1}</td>
                                                    <td style={{ padding: '9px 12px', fontWeight: 600, color: '#0f172a' }}>{section.name}</td>
                                                    <td style={{ padding: '9px 12px', textAlign: 'center', color: '#475569' }}>{itemCount} Items</td>
                                                    <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>₹{secTotal.toLocaleString()}</td>
                                                </tr>
                                            );
                                        })}
                                        {/* Total Row */}
                                        <tr style={{ borderTop: '1.5px solid #cbd5e1', backgroundColor: '#f8fafc' }}>
                                            <td colSpan={3} style={{ padding: '10px 12px', textAlign: 'right', fontSize: '9pt', fontWeight: 700, color: '#0f172a' }}>Total Modules Gross Amount:</td>
                                            <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: '10pt', fontWeight: 800, color: '#10b981' }}>₹{subTotal.toLocaleString()}</td>
                                        </tr>
                                        {discountPercent > 0 && (
                                            <tr style={{ backgroundColor: '#f0fdf4' }}>
                                                <td colSpan={3} style={{ padding: '8px 12px', textAlign: 'right', fontSize: '8.5pt', fontWeight: 700, color: '#374151' }}>Discount ({discountPercent}%)</td>
                                                <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '9pt', fontWeight: 700, color: '#10b981' }}>- ₹{discountAmt.toLocaleString()}</td>
                                            </tr>
                                        )}
                                        {gstEnabled && (
                                            <tr style={{ backgroundColor: '#f8fafc' }}>
                                                <td colSpan={3} style={{ padding: '8px 12px', textAlign: 'right', fontSize: '8.5pt', fontWeight: 700, color: '#374151' }}>GST (18%)</td>
                                                <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '9pt', fontWeight: 700, color: '#475569' }}>₹{gstTotal.toLocaleString()}</td>
                                            </tr>
                                        )}
                                        {(discountPercent > 0 || gstEnabled) && (
                                            <tr style={{ backgroundColor: '#f1f5f9' }}>
                                                <td colSpan={3} style={{ padding: '10px 12px', textAlign: 'right', fontSize: '9pt', fontWeight: 800, color: '#0f172a' }}>Final Payable Amount</td>
                                                <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: '10pt', fontWeight: 900, color: '#0f172a' }}>₹{finalGrandTotal.toLocaleString()}</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>

                                <PageFooter />
                            </div>

                            {/* ===== PAGES 4+: PER MODULE DETAIL TABLES ===== */}
                            {sections.map((section, sIdx) => {
                                const sectionTotal = section.items.reduce((a, item) => a + (item.amount || 0), 0);
                                const regularItems = section.items.filter(i => i.brand !== 'HEADER');
                                return (
                                    <div key={section.id || sIdx} className="page-break-section" style={{ minHeight: 'auto', padding: '16px 12px 20px', backgroundColor: '#ffffff', position: 'relative', boxSizing: 'border-box', pageBreakAfter: 'always', breakAfter: 'page' }}>
                                        <PageHeader />

                                        {/* Module Title: dark square badge + name */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                                            <div style={{ width: '28px', height: '28px', borderRadius: '4px', backgroundColor: '#0f172a', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '10pt', flexShrink: 0 }}>{sIdx + 1}</div>
                                            <span style={{ fontSize: '13pt', fontWeight: 900, color: '#0f172a', letterSpacing: '0.3px', textTransform: 'uppercase' }}>{section.name}</span>
                                        </div>

                                        {/* Items Table */}
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8pt', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                                            <thead>
                                                <tr style={{ backgroundColor: '#fef9f0', borderBottom: '1px solid #e2e8f0' }}>
                                                    <th style={{ padding: '8px 8px', textAlign: 'left', fontWeight: 700, color: '#334155', width: '30%' }}>Product Name</th>
                                                    <th style={{ padding: '8px 8px', textAlign: 'left', fontWeight: 700, color: '#334155', width: '20%' }}>Shutter Material | Finish</th>
                                                    <th style={{ padding: '8px 8px', textAlign: 'left', fontWeight: 700, color: '#334155', width: '18%' }}>Carcass Material | Color</th>
                                                    <th style={{ padding: '8px 8px', textAlign: 'center', fontWeight: 700, color: '#334155', width: '18%' }}>Dimensions<br /><span style={{ fontSize: '6.5pt', fontWeight: 500 }}>(mm * mm * mm)</span></th>
                                                    <th style={{ padding: '8px 8px', textAlign: 'center', fontWeight: 700, color: '#334155', width: '6%' }}>QTY</th>
                                                    <th style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 700, color: '#334155', width: '8%' }}>Price</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {section.items.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={6} style={{ padding: '12px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', fontSize: '8pt' }}>
                                                            No item specifications listed for this module.
                                                        </td>
                                                    </tr>
                                                ) : (() => {
                                                    let pdfCounter = 0;
                                                    return section.items.map((item, iIdx) => {
                                                        if (item.brand === 'HEADER') {
                                                            pdfCounter = 0;
                                                            return (
                                                                <tr key={item.id || iIdx}>
                                                                    <td colSpan={6} style={{ padding: '7px 10px', backgroundColor: '#e8f0fe', borderTop: '2px solid #c7d7f9', borderBottom: '1px solid #c7d7f9' }}>
                                                                        <span style={{ fontSize: '8.5pt', fontWeight: 800, color: '#1e3a8a', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{item.particulars}</span>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        }
                                                        pdfCounter++;
                                                        return (
                                                            <tr key={item.id || iIdx} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: pdfCounter % 2 === 0 ? '#fafafa' : '#ffffff' }}>
                                                                {/* Product Name with photo box */}
                                                                <td style={{ padding: '8px 8px', verticalAlign: 'top' }}>
                                                                    <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                                                                        <div style={{ width: '42px', height: '42px', border: '1px solid #cbd5e1', borderRadius: '4px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', flexShrink: 0, overflow: 'hidden' }}>
                                                                            {item.image_url ? (
                                                                                <img src={item.image_url} alt="Item" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                            ) : (
                                                                                <>
                                                                                    <span style={{ fontSize: '10px', color: '#94a3b8' }}>📷</span>
                                                                                    <span style={{ fontSize: '7px', color: '#94a3b8' }}>Photo</span>
                                                                                </>
                                                                            )}
                                                                        </div>
                                                                        <div>
                                                                            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '8.5pt', lineHeight: 1.3 }}>{item.particulars}</div>
                                                                            <div style={{ fontSize: '7.5pt', color: '#64748b', marginTop: '2px' }}>Handles: <span style={{ fontWeight: 600 }}>{item.unit || ''}</span></div>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td style={{ padding: '8px 8px', verticalAlign: 'top', fontSize: '8pt', color: '#334155', fontWeight: 600 }}>{item.hsn_sac || ''}</td>
                                                                <td style={{ padding: '8px 8px', verticalAlign: 'top', fontSize: '8pt', color: '#334155', fontWeight: 600 }}>{item.brand || ''}</td>
                                                                <td style={{ padding: '8px 8px', verticalAlign: 'top', fontSize: '7.5pt', textAlign: 'left', paddingLeft: '16px' }}>
                                                                    <div><span style={{ color: '#64748b' }}>Height:</span> <span style={{ fontWeight: 700 }}>{item.height || ''}</span></div>
                                                                    <div><span style={{ color: '#64748b' }}>Depth:</span> <span style={{ fontWeight: 700 }}>{item.sft || ''}</span></div>
                                                                    <div><span style={{ color: '#64748b' }}>Width:</span> <span style={{ fontWeight: 700 }}>{item.width || ''}</span></div>
                                                                </td>
                                                                <td style={{ padding: '8px 8px', verticalAlign: 'top', textAlign: 'center', fontWeight: 700, color: '#0f172a' }}>{item.quantity || 1}</td>
                                                                <td style={{ padding: '8px 8px', verticalAlign: 'top', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{item.amount ? item.amount.toLocaleString() : ''}</td>
                                                            </tr>
                                                        );
                                                    });
                                                })()}
                                            </tbody>
                                        </table>

                                        <PageFooter />
                                    </div>
                                );
                            })}
                        </div>
                    );
                })()}

            </div>

            {isPrintingVersion && selectedVersionData && (
                <div className="quote-container print-area" style={{ backgroundColor: 'white', padding: 0, position: 'absolute', top: 0, left: 0, width: '100%', zIndex: 999999 }}>

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
                                <tr style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
                                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700 }}>#</th>
                                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700 }}>Module Name</th>
                                    <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700 }}>Total Items</th>
                                    <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700 }}>Amount (₹)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {selectedVersionData.sections.map((sec, si) => {
                                    const secTotal = sec.items.reduce((a, it) => a + (it.amount || 0), 0);
                                    const itemCount = sec.items.filter(it => it.brand !== 'HEADER').length;
                                    return (
                                        <tr key={sec.id} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: si % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                                            <td style={{ padding: '10px 14px', fontWeight: 700, color: '#7c3aed' }}>{si + 1}</td>
                                            <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>{sec.name}</td>
                                            <td style={{ padding: '10px 14px', textAlign: 'center', color: '#475569' }}>{itemCount}</td>
                                            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>₹ {secTotal.toLocaleString()}</td>
                                        </tr>
                                    );
                                })}
                                <tr style={{ borderTop: '2.5px solid #0f172a', backgroundColor: '#f1f5f9' }}>
                                    <td colSpan={3} style={{ padding: '12px 14px', fontWeight: 800, textAlign: 'right', fontSize: '10pt', color: '#0f172a' }}>Grand Total Amount</td>
                                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 900, color: '#7c3aed', fontSize: '11.5pt' }}>₹ {selectedVersionData.total.toLocaleString()}</td>
                                </tr>
                            </tbody>
                        </table>
                        <div style={{ padding: '14px 18px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
                            <span style={{ fontSize: '8.5pt', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Total Amount In Words</span>
                            <span style={{ fontSize: '10.5pt', fontWeight: 800, color: '#0f172a' }}>{numberToWords(selectedVersionData.total)}</span>
                        </div>
                        <PageFooter />
                    </div>

                    {/* PAGES 4+: PER-MODULE DETAIL TABLES */}
                    {selectedVersionData.sections.map((sec, si) => {
                        const secTotal = sec.items.reduce((a, it) => a + (it.amount || 0), 0);
                        return (
                            <div key={sec.id} className="page-break-section" style={{ minHeight: 'auto', padding: '16px 12px 20px', backgroundColor: '#ffffff', position: 'relative', boxSizing: 'border-box', pageBreakAfter: 'always', breakAfter: 'page' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '2px solid #0f172a', paddingBottom: '12px', marginBottom: '20px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <img src={liveLogo} alt="Logo" style={{ height: '44px', objectFit: 'contain' }} />
                                        <div>
                                            <h1 style={{ margin: 0, fontSize: '14pt', fontWeight: 800, color: '#0f172a' }}>Livincart Private Limited</h1>
                                            <p style={{ margin: 0, fontSize: '8pt', color: '#64748b', fontWeight: 600 }}>Module {si + 1}: {sec.name}</p>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <h2 style={{ margin: '0 0 2px 0', fontSize: '9pt', fontWeight: 800, color: '#0f172a' }}>COMPANY : LIVINCART AND SERVICES PRIVATE LIMITED</h2>
                                        <p style={{ margin: 0, fontSize: '9pt', fontWeight: 800, color: '#10b981' }}>GST : 37AAGCL5523Q1ZX</p>
                                    </div>
                                </div>

                                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '8.5pt' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
                                            <th style={{ padding: '8px 10px', textAlign: 'center', width: '40px' }}>S.No</th>
                                            <th style={{ padding: '8px 10px', textAlign: 'left' }}>Item Description / Particulars</th>
                                            <th style={{ padding: '8px 10px', textAlign: 'center', width: '60px' }}>Qty</th>
                                            <th style={{ padding: '8px 10px', textAlign: 'right', width: '90px' }}>Rate (₹)</th>
                                            <th style={{ padding: '8px 10px', textAlign: 'right', width: '100px' }}>Amount (₹)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(() => {
                                            let itemCounter = 0;
                                            return sec.items.map((item) => {
                                                if (item.brand === 'HEADER') {
                                                    itemCounter = 0;
                                                    return (
                                                        <tr key={item.id}>
                                                            <td colSpan={5} style={{ padding: '8px 10px', backgroundColor: '#e8f0fe', borderTop: '2px solid #c7d7f9', borderBottom: '1px solid #c7d7f9', fontWeight: 800, color: '#1e3a8a', fontSize: '8.5pt', textTransform: 'uppercase' }}>
                                                                {item.particulars}
                                                            </td>
                                                        </tr>
                                                    );
                                                }
                                                itemCounter++;
                                                return (
                                                    <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: itemCounter % 2 === 0 ? '#fafafa' : '#ffffff' }}>
                                                        <td style={{ padding: '8px 10px', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>{itemCounter}</td>
                                                        <td style={{ padding: '8px 10px', fontWeight: 600, color: '#0f172a' }}>{item.particulars}</td>
                                                        <td style={{ padding: '8px 10px', textAlign: 'center', color: '#334155' }}>{item.quantity || 1}</td>
                                                        <td style={{ padding: '8px 10px', textAlign: 'right', color: '#334155' }}>{(item.rate || 0).toLocaleString()}</td>
                                                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{(item.amount || 0).toLocaleString()}</td>
                                                    </tr>
                                                );
                                            });
                                        })()}
                                        <tr style={{ backgroundColor: '#fdf6f0', fontWeight: 800 }}>
                                            <td colSpan={4} style={{ padding: '10px 10px', textAlign: 'right', fontSize: '9pt', color: '#0f172a' }}>Module Total:</td>
                                            <td style={{ padding: '10px 10px', textAlign: 'right', fontSize: '9pt', color: '#0f172a' }}>
                                                ₹ {secTotal.toLocaleString()}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>

                                <PageFooter />
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default QuoteTab;
