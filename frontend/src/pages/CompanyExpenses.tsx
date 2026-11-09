import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useAuth } from '../hooks/useAuth';
import {
    TrendingDown,
    Plus,
    Loader2,
    Calendar,
    DollarSign,
    Users,
    Building2,
    Lightbulb,
    Search,
    CreditCard,
    ArrowDownLeft,
    Receipt,
    Filter,
    RotateCcw,
    Zap,
    CheckSquare,
    Square,
    CheckCircle2,
    Copy,
    Check,
    FileText,
    UploadCloud,
    Eye,
    X,
    ImageIcon,
    Paperclip,
    Edit2,
    Trash2
} from 'lucide-react';

interface Transaction {
    transaction_id: string;
    project_id?: string;
    project_name?: string;
    type: 'credit' | 'debit';
    amount: string;
    category: string;
    description: string;
    date?: string;
    created_at?: string;
    transaction_date: string;
    recorded_by: string;
    payment_mode?: string;
    person_name?: string;
    incentive?: string;
    receipt_image?: string;
    image?: string;
    payment_status?: string;
    approval_status?: string;
    is_deleted?: number | boolean | string;
    deleted_at?: string;
    deleted_by?: string;
    days_since_delete?: number;
    recovery_days_remaining?: number;
}

interface TeamMember {
    user_id: string;
    name: string;
    role: string;
    username?: string;
    status?: string;
    salary?: string;
    phone?: string;
}

const ROLE_LABELS: Record<string, string> = {
    admin: 'Admin',
    project_head: 'Installation Manager',
    site_engineer: 'Site Engineer',
    accountant: 'Accountant',
    sales: 'Sales',
    d1: 'D1 Designer',
    d2: 'D2 Designer',
    associate_designer: 'Associate Designer',
    marketing_analyst: 'Marketing Analyst',
    mmt: 'Material Management',
    site_inspection: 'Site Inspection',
    project_manager: 'Project Manager',
    manager: 'Design Manager'
};

const PASTEL_AVATARS = [
    { bg: '#fee2e2', text: '#dc2626' }, // Rose
    { bg: '#fef3c7', text: '#d97706' }, // Amber
    { bg: '#dcfce7', text: '#16a34a' }, // Emerald
    { bg: '#e0f2fe', text: '#0284c7' }, // Sky
    { bg: '#f3e8ff', text: '#9333ea' }, // Purple
    { bg: '#fce7f3', text: '#db2777' }, // Pink
    { bg: '#ffedd5', text: '#ea580c' }, // Orange
    { bg: '#ccfbf1', text: '#0d9488' }, // Teal
];

export const CompanyExpenses: React.FC = () => {
    const { user } = useAuth();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [restoringId, setRestoringId] = useState<string | null>(null);
    const [permanentDeletingId, setPermanentDeletingId] = useState<string | null>(null);
    const [selectedMonth, setSelectedMonth] = useState<string>(() => {
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    });

    const [activeTab, setActiveTab] = useState<'all_overheads' | 'salary_roll' | 'deleted'>('all_overheads');
    const [searchTerm, setSearchTerm] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    
    // Filter Option States
    const [dateFilterType, setDateFilterType] = useState<'month' | 'today' | 'last7' | 'lastMonth' | 'this_year' | 'by_year' | 'custom'>('month');
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [filterTxnId, setFilterTxnId] = useState('');
    const [filterPaymentMode, setFilterPaymentMode] = useState('all');
    const [filterAmount, setFilterAmount] = useState('');
    const [selectedCategoryCard, setSelectedCategoryCard] = useState<'all' | 'salary' | 'rent' | 'utilities' | 'staff' | 'other'>('all');

    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [receiptPreview, setReceiptPreview] = useState<string>('');
    const [receiptFileName, setReceiptFileName] = useState<string>('');
    const [viewReceiptModalUrl, setViewReceiptModalUrl] = useState<string | null>(null);
    const [customCategory, setCustomCategory] = useState('');

    const [formData, setFormData] = useState({
        type: 'debit',
        category: '',
        person_name: '',
        amount: '',
        incentive: '',
        description: '',
        payment_mode: 'Bank Transfer',
        date: new Date().toISOString().split('T')[0],
        recorded_by: user?.user_id || '',
        receipt_image: ''
    });

    const handleProcessFile = (file: File) => {
        setReceiptFile(file);
        setReceiptFileName(file.name);

        const reader = new FileReader();
        if (file.type.startsWith('image/')) {
            reader.onload = () => {
                const img = new Image();
                img.src = reader.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 1200;
                    const MAX_HEIGHT = 1200;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height = Math.round((height * MAX_WIDTH) / width);
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width = Math.round((width * MAX_HEIGHT) / height);
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, width, height);
                        ctx.drawImage(img, 0, 0, width, height);
                        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
                        setReceiptPreview(compressedBase64);
                        setFormData(prev => ({ ...prev, receipt_image: compressedBase64 }));
                    } else {
                        const raw = reader.result as string;
                        setReceiptPreview(raw);
                        setFormData(prev => ({ ...prev, receipt_image: raw }));
                    }
                };
            };
            reader.readAsDataURL(file);
        } else {
            // PDF or other document
            reader.onload = () => {
                const base64 = reader.result as string;
                setReceiptPreview(base64);
                setFormData(prev => ({ ...prev, receipt_image: base64 }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleProcessFile(file);
    };

    const removeSelectedReceipt = () => {
        setReceiptFile(null);
        setReceiptPreview('');
        setReceiptFileName('');
        setFormData(prev => ({ ...prev, receipt_image: '' }));
    };

    // Auto Salary Roll Batch States
    const [showAutoSalaryModal, setShowAutoSalaryModal] = useState(false);
    const [autoSalariesList, setAutoSalariesList] = useState<any[]>([]);
    const [autoSalaryPaymentMode, setAutoSalaryPaymentMode] = useState('Bank Transfer');
    const [autoSalaryDate, setAutoSalaryDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
    const [isPostingAutoSalaries, setIsPostingAutoSalaries] = useState(false);

    const openAutoSalaryModal = () => {
        const activeMembers = teamMembers.filter(m => m.status === 'active');
        const list = activeMembers.map(m => {
            // Find member's recorded salary transactions for current selected month
            const currentMonthTxns = transactions.filter(t => {
                if (t.category !== 'Salary') return false;
                if ((t.person_name || '').toLowerCase() !== m.name.toLowerCase()) return false;
                const tDate = t.date || t.transaction_date || t.created_at || '';
                return tDate.startsWith(selectedMonth);
            });

            const paidAmount = currentMonthTxns.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0);
            const paidIncentive = currentMonthTxns.reduce((sum, t) => sum + (t.incentive ? parseFloat(t.incentive) : 0), 0);

            // Find last recorded salary transaction in history for this member if m.salary is not set
            const lastSalaryTxn = transactions.find(t => t.category === 'Salary' && (t.person_name || '').toLowerCase() === m.name.toLowerCase());
            const lastRecordedAmount = lastSalaryTxn ? parseFloat(lastSalaryTxn.amount || '0') : 0;
            const lastRecordedIncentive = lastSalaryTxn ? parseFloat(lastSalaryTxn.incentive || '0') : 0;

            const baseSalary = paidAmount > 0 
                ? paidAmount 
                : (m.salary && parseFloat(m.salary) > 0 ? parseFloat(m.salary) : lastRecordedAmount);

            const incentive = paidIncentive > 0 ? paidIncentive : (paidAmount > 0 ? 0 : lastRecordedIncentive);

            return {
                user_id: m.user_id,
                name: m.name,
                role: m.role,
                baseSalary: baseSalary,
                incentive: incentive,
                selected: currentMonthTxns.length === 0,
                alreadyPaid: currentMonthTxns.length > 0
            };
        });
        setAutoSalariesList(list);
        setShowAutoSalaryModal(true);
    };

    const toggleAutoSalaryItem = (name: string) => {
        setAutoSalariesList(prev => prev.map(item => item.name === name ? { ...item, selected: !item.selected } : item));
    };

    const toggleSelectAllAutoSalaries = (checked: boolean) => {
        setAutoSalariesList(prev => prev.map(item => item.alreadyPaid ? item : { ...item, selected: checked }));
    };

    const updateAutoSalaryIncentive = (name: string, incentiveVal: string) => {
        const numVal = parseFloat(incentiveVal) || 0;
        setAutoSalariesList(prev => prev.map(item => item.name === name ? { ...item, incentive: numVal } : item));
    };

    const updateAutoSalaryBase = (name: string, baseVal: string) => {
        const numVal = parseFloat(baseVal) || 0;
        setAutoSalariesList(prev => prev.map(item => item.name === name ? { ...item, baseSalary: numVal } : item));
    };

    const handlePostAutoSalaries = async () => {
        const selectedToPost = autoSalariesList.filter(item => item.selected && !item.alreadyPaid);
        if (selectedToPost.length === 0) {
            alert('No team members selected for salary posting.');
            return;
        }

        setIsPostingAutoSalaries(true);
        try {
            const payDate = autoSalaryDate || new Date().toISOString().split('T')[0];

            for (const item of selectedToPost) {
                const payload = {
                    type: 'debit',
                    category: 'Salary',
                    person_name: item.name,
                    amount: String(item.baseSalary || 0),
                    incentive: String(item.incentive || 0),
                    description: `Monthly Salary payment for ${selectedMonth} to ${item.name}`,
                    payment_mode: autoSalaryPaymentMode,
                    date: payDate,
                    recorded_by: user?.user_id || ''
                };
                await axios.post(`${API_BASE_URL}/finance`, payload);
            }

            await fetchData();
            setShowAutoSalaryModal(false);
            alert(`Successfully posted monthly salary payments for ${selectedToPost.length} team member(s)!`);
        } catch (err) {
            console.error('Error posting auto salaries:', err);
            alert('Failed to post salary entries. Please try again.');
        } finally {
            setIsPostingAutoSalaries(false);
        }
    };

    const copyPreviousMonthSalaries = () => {
        const [year, month] = selectedMonth.split('-').map(Number);
        const prevDate = new Date(year, month - 2, 1);
        const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

        const prevTxns = transactions.filter(t => {
            if (t.category !== 'Salary') return false;
            const tDate = t.date || t.transaction_date || t.created_at || '';
            return tDate.startsWith(prevMonthStr);
        });

        let copiedCount = 0;
        setAutoSalariesList(prev => prev.map(item => {
            if (item.alreadyPaid) return item;

            const lastTxn = prevTxns.find(t => (t.person_name || '').toLowerCase() === item.name.toLowerCase());
            if (lastTxn) {
                copiedCount++;
                return {
                    ...item,
                    baseSalary: parseFloat(lastTxn.amount || '0') || item.baseSalary,
                    incentive: parseFloat(lastTxn.incentive || '0'),
                    selected: true
                };
            }
            return item;
        }));

        if (copiedCount > 0) {
            alert(`Successfully copied previous month (${prevMonthStr}) salary & bonus values for ${copiedCount} staff member(s)!`);
        } else {
            alert(`No previous salary transactions found for month (${prevMonthStr}).`);
        }
    };

    const handlePostSingleSalary = async (item: any) => {
        try {
            const payDate = autoSalaryDate || new Date().toISOString().split('T')[0];
            const payload = {
                type: 'debit',
                category: 'Salary',
                person_name: item.name,
                amount: String(item.baseSalary || 0),
                incentive: String(item.incentive || 0),
                description: `Monthly Salary payment for ${selectedMonth} to ${item.name}`,
                payment_mode: autoSalaryPaymentMode,
                date: payDate,
                recorded_by: user?.user_id || ''
            };
            await axios.post(`${API_BASE_URL}/finance`, payload);
            await fetchData();

            setAutoSalariesList(prev => prev.map(i => i.name === item.name ? { ...i, alreadyPaid: true, selected: false } : i));
            alert(`Salary payment recorded & marked paid for ${item.name}!`);
        } catch (err) {
            console.error('Error posting single salary:', err);
            alert(`Failed to record salary for ${item.name}`);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [transRes, usersRes, reimbRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/finance?include_deleted=1`),
                axios.get(`${API_BASE_URL}/users`),
                axios.get(`${API_BASE_URL}/reimbursements?all=1`).catch(() => ({ data: { success: false, data: [] } }))
            ]);
            
            const rawTransactions: Transaction[] = transRes.data?.data || [];
            const claims: any[] = (reimbRes.data?.data || []).filter((r: any) => 
                r.status === 'approved' && (!r.project_id || r.project_id === '0' || String(r.project_id).toLowerCase() === 'general')
            );

            // Merge approved office reimbursement claims if not already in finance_transactions
            const mergedTransactions: Transaction[] = [...rawTransactions];
            claims.forEach((c: any) => {
                const alreadyRecorded = rawTransactions.some(t => 
                    (t.description || '').toLowerCase().includes(String(c.reason || '').toLowerCase().slice(0, 20)) && 
                    parseFloat(t.amount || '0') === parseFloat(c.amount || '0')
                );
                if (!alreadyRecorded) {
                    mergedTransactions.push({
                        transaction_id: `REIMB-${c.id}`,
                        project_id: null,
                        type: 'debit',
                        amount: c.amount,
                        incentive: '0',
                        payment_mode: 'Reimbursement',
                        category: 'Staff Expense',
                        person_name: c.employee_name,
                        description: `Office Reimbursement (${c.category}): ${c.reason}`,
                        transaction_date: c.created_at || new Date().toISOString(),
                        recorded_by: c.user_id,
                        receipt_image: c.image_path,
                        payment_status: 'paid'
                    });
                }
            });

            setTransactions(mergedTransactions);
            setTeamMembers(usersRes.data?.data || []);
        } catch (err) {
            console.error('Failed to fetch company expenses:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.category || !formData.category.trim()) {
            alert('Expense Category is required. Please select a category.');
            return;
        }

        if (formData.category === 'Other' && !customCategory.trim()) {
            alert('Custom Category Name is required. Please specify the category name.');
            return;
        }

        const finalReceipt = formData.receipt_image || receiptPreview || null;
        const categoryToSend = formData.category === 'Other' ? customCategory.trim() : formData.category;

        setSubmitting(true);
        try {
            const payload = {
                ...formData,
                category: categoryToSend,
                amount: formData.amount ? formData.amount : '0',
                incentive: formData.incentive ? formData.incentive : '0',
                receipt_image: finalReceipt
            };

            let response;
            if (editingTransaction) {
                response = await axios.post(`${API_BASE_URL}/finance/update`, {
                    transaction_id: editingTransaction.transaction_id,
                    ...payload
                });
            } else {
                response = await axios.post(`${API_BASE_URL}/finance`, payload);
            }

            if (response.data.success) {
                setShowModal(false);
                setEditingTransaction(null);
                setCustomCategory('');
                setFormData({
                    type: 'debit',
                    category: '',
                    person_name: '',
                    amount: '',
                    incentive: '',
                    description: '',
                    payment_mode: 'Bank Transfer',
                    date: new Date().toISOString().split('T')[0],
                    recorded_by: user?.user_id || '',
                    receipt_image: ''
                });
                removeSelectedReceipt();
                fetchData();
                alert(editingTransaction ? 'Corporate expense updated successfully!' : 'Corporate expense recorded successfully!');
            } else {
                alert(response.data.message || (editingTransaction ? 'Error updating corporate expense' : 'Error recording corporate expense'));
            }
        } catch (err) {
            alert(editingTransaction ? 'Error updating corporate expense' : 'Error recording corporate expense');
        } finally {
            setSubmitting(false);
        }
    };

    const getMonthOptions = () => {
        const options = [];
        const today = new Date();
        for (let i = 0; i < 24; i++) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            options.push(`${yyyy}-${mm}`);
        }
        return options;
    };

    // Filter to overheads only (where type is debit AND category is salary/rent/utilities/office/staff OR project_id is empty/null)
    const overheadCategories = [
        'Salary', 'Rent', 'Utilities', 'Office Supplies', 'General Overhead', 
        'Staff Expense', 'Staff Expenses', 'Staff Reimbursement', 'Reimbursement', 
        'Food', 'Travel', 'Recharge', 'Fuel'
    ];

    const isSalary = (t: Transaction): boolean => {
        const cat = (t.category || '').toLowerCase().trim();
        return cat === 'salary' || (cat.includes('salary') && !cat.includes('expense'));
    };

    const isRent = (t: Transaction): boolean => {
        const cat = (t.category || '').toLowerCase().trim();
        return cat === 'rent' || cat.includes('office rent') || cat.includes('lease');
    };

    const isUtilities = (t: Transaction): boolean => {
        const cat = (t.category || '').toLowerCase().trim();
        return cat.includes('utilit') || cat.includes('electricity') || cat.includes('power') || cat.includes('water') || cat.includes('wifi') || cat.includes('internet');
    };

    const isStaffExpense = (t: Transaction): boolean => {
        const cat = (t.category || '').toLowerCase().trim();
        const mode = (t.payment_mode || '').toLowerCase().trim();
        const desc = (t.description || '').toLowerCase();
        
        if (mode === 'reimbursement') return true;

        if (
            cat.includes('staff') ||
            cat.includes('reimb') ||
            cat.includes('claim') ||
            cat.includes('food') ||
            cat.includes('travel') ||
            cat.includes('conveyance') ||
            cat.includes('fuel') ||
            cat.includes('recharge') ||
            cat.includes('tea') ||
            cat.includes('snack') ||
            cat.includes('hotel')
        ) {
            // Must not be salary
            if (cat === 'salary' || (cat.includes('salary') && !cat.includes('expense'))) {
                return false;
            }
            return true;
        }

        if (cat === 'other' || cat === 'general' || cat === 'expense' || cat === '') {
            if (desc.includes('reimbursement') || desc.includes('staff expense') || desc.includes('claim') || desc.includes('staff')) {
                return true;
            }
        }

        return false;
    };

    const isOverheadTxn = (t: Transaction): boolean => {
        return t.type === 'debit' && (
            !t.project_id || 
            t.project_id === '0' || 
            String(t.project_id).trim() === '' || 
            isSalary(t) || 
            isRent(t) || 
            isUtilities(t) || 
            isStaffExpense(t) || 
            overheadCategories.some(c => c.toLowerCase() === (t.category || '').toLowerCase().trim())
        );
    };

    const matchesDate = (txnDate: string) => {
        if (!txnDate) return false;
        const dateObj = new Date(txnDate.split(' ')[0]);
        const today = new Date();
        today.setHours(0,0,0,0);
        
        if (dateFilterType === 'today') {
            const dateStr = dateObj.toISOString().split('T')[0];
            const todayStr = new Date().toISOString().split('T')[0];
            return dateStr === todayStr;
        }
        if (dateFilterType === 'last7') {
            const diffTime = today.getTime() - dateObj.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays >= 0 && diffDays <= 7;
        }
        if (dateFilterType === 'lastMonth') {
            const diffTime = today.getTime() - dateObj.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays >= 0 && diffDays <= 30;
        }
        if (dateFilterType === 'custom') {
            const claimDate = txnDate.slice(0, 10);
            if (customStartDate && claimDate < customStartDate) return false;
            if (customEndDate && claimDate > customEndDate) return false;
            return true;
        }
        if (dateFilterType === 'this_year') {
            return dateObj.getFullYear() === new Date().getFullYear();
        }
        if (dateFilterType === 'by_year') {
            return dateObj.getFullYear() === (selectedYear || new Date().getFullYear());
        }
        // Month dropdown selection
        if (selectedMonth === 'all') return true;
        return txnDate.startsWith(selectedMonth);
    };

    const isTxDeleted = (t: Transaction): boolean => {
        return t.is_deleted === 1 || t.is_deleted === '1' || t.is_deleted === true;
    };

    // 1. All overheads matching date/statement period (used for KPI summary cards, excludes deleted)
    const dateFilteredOverheads = transactions.filter(t => {
        if (isTxDeleted(t)) return false;
        if (!isOverheadTxn(t)) return false;
        if (!matchesDate(t.transaction_date)) return false;
        return true;
    });

    // Calculations for the 6 top KPI cards (strictly active overheads)
    const salaryTotal = dateFilteredOverheads
        .filter(t => isSalary(t))
        .reduce((sum, t) => sum + parseFloat(t.amount || '0') + (t.incentive ? parseFloat(t.incentive) : 0), 0);

    const rentTotal = dateFilteredOverheads
        .filter(t => isRent(t))
        .reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0);

    const utilitiesTotal = dateFilteredOverheads
        .filter(t => isUtilities(t))
        .reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0);

    const staffExpensesTotal = dateFilteredOverheads
        .filter(t => isStaffExpense(t))
        .reduce((sum, t) => sum + parseFloat(t.amount || '0') + (t.incentive ? parseFloat(t.incentive) : 0), 0);

    const otherTotal = dateFilteredOverheads
        .filter(t => !isSalary(t) && !isRent(t) && !isUtilities(t) && !isStaffExpense(t))
        .reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0);

    const grandTotal = dateFilteredOverheads.reduce((sum, t) => sum + parseFloat(t.amount || '0') + (isSalary(t) && t.incentive ? parseFloat(t.incentive) : 0), 0);

    // 2. Overheads filtered for the table (applies Category Card selection, Search, TxnId, Payment Mode, Amount)
    const filteredOverheads = dateFilteredOverheads.filter(t => {
        // Category Card selection filter
        if (selectedCategoryCard === 'salary' && !isSalary(t)) return false;
        if (selectedCategoryCard === 'rent' && !isRent(t)) return false;
        if (selectedCategoryCard === 'utilities' && !isUtilities(t)) return false;
        if (selectedCategoryCard === 'staff' && !isStaffExpense(t)) return false;
        if (selectedCategoryCard === 'other' && (isSalary(t) || isRent(t) || isUtilities(t) || isStaffExpense(t))) return false;

        // Search Term
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch = 
                (t.description || '').toLowerCase().includes(searchLower) ||
                (t.person_name || '').toLowerCase().includes(searchLower) ||
                (t.category || '').toLowerCase().includes(searchLower);
            if (!matchesSearch) return false;
        }

        // Transaction ID
        if (filterTxnId) {
            const txnClean = filterTxnId.toLowerCase().replace('txn-', '');
            if (!String(t.transaction_id).toLowerCase().includes(txnClean)) return false;
        }

        // Payment Mode
        if (filterPaymentMode !== 'all') {
            if (t.payment_mode !== filterPaymentMode) return false;
        }

        // Amount
        if (filterAmount) {
            const totalAmt = parseFloat(t.amount || '0') + (t.incentive ? parseFloat(t.incentive) : 0);
            if (!String(totalAmt).includes(filterAmount)) return false;
        }

        return true;
    });

    // 3. Deleted overhead transactions eligible for 30-day recovery
    const deletedOverheadTransactions = transactions.filter(t => {
        if (!isTxDeleted(t)) return false;
        if (!isOverheadTxn(t)) return false;
        return true;
    });

    const deletedFilteredOverheads = deletedOverheadTransactions.filter(t => {
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch = 
                (t.description || '').toLowerCase().includes(searchLower) ||
                (t.person_name || '').toLowerCase().includes(searchLower) ||
                (t.category || '').toLowerCase().includes(searchLower);
            if (!matchesSearch) return false;
        }
        if (filterTxnId) {
            const txnClean = filterTxnId.toLowerCase().replace('txn-', '');
            if (!String(t.transaction_id).toLowerCase().includes(txnClean)) return false;
        }
        if (filterPaymentMode !== 'all') {
            if (t.payment_mode !== filterPaymentMode) return false;
        }
        if (filterAmount) {
            const totalAmt = parseFloat(t.amount || '0') + (t.incentive ? parseFloat(t.incentive) : 0);
            if (!String(totalAmt).includes(filterAmount)) return false;
        }
        return true;
    });

    const activeMonthLabel = () => {
        if (dateFilterType === 'today') return 'Today';
        if (dateFilterType === 'last7') return 'Last 7 Days';
        if (dateFilterType === 'lastMonth') return 'Last 30 Days';
        if (dateFilterType === 'this_year') return `This Year (${new Date().getFullYear()})`;
        if (dateFilterType === 'by_year') return `Year ${selectedYear}`;
        if (dateFilterType === 'custom') {
            if (customStartDate && customEndDate) return `${customStartDate} to ${customEndDate}`;
            if (customStartDate) return `From ${customStartDate}`;
            if (customEndDate) return `Until ${customEndDate}`;
            return 'Custom Date Range';
        }
        if (selectedMonth === 'all') return 'All Time Summary';
        const [year, month] = selectedMonth.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1);
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    };

    const getAvatarColors = (name: string) => {
        const charCode = name.charCodeAt(0) || 0;
        return PASTEL_AVATARS[charCode % PASTEL_AVATARS.length];
    };

    // Helper to calculate salary paid to a specific team member this month (including incentives)
    const getMemberSalaryPaid = (memberName: string) => {
        return filteredOverheads
            .filter(t => t.category === 'Salary' && t.person_name === memberName)
            .reduce((sum, t) => {
                const baseAmount = parseFloat(t.amount) || 0;
                const incentiveAmount = t.incentive ? parseFloat(t.incentive) : 0;
                return sum + baseAmount + incentiveAmount;
            }, 0);
    };

    const openRecordExpenseModal = () => {
        removeSelectedReceipt();
        setEditingTransaction(null);
        setCustomCategory('');
        setFormData({
            type: 'debit',
            category: '',
            person_name: '',
            amount: '',
            incentive: '',
            description: '',
            payment_mode: 'Bank Transfer',
            date: new Date().toISOString().split('T')[0],
            recorded_by: user?.user_id || '',
            receipt_image: ''
        });
        setShowModal(true);
    };

    const openQuickSalaryModal = (memberName: string) => {
        removeSelectedReceipt();
        setEditingTransaction(null);
        setCustomCategory('');
        setFormData({
            ...formData,
            category: 'Salary',
            person_name: memberName,
            description: `Salary payment to ${memberName}`,
            receipt_image: ''
        });
        setShowModal(true);
    };

    const openRecordStaffExpenseModal = (memberName?: string) => {
        removeSelectedReceipt();
        setEditingTransaction(null);
        setCustomCategory('');
        setFormData({
            type: 'debit',
            category: 'Staff Expense',
            person_name: memberName || '',
            amount: '',
            incentive: '',
            description: memberName ? `Staff expense for ${memberName}` : '',
            payment_mode: 'UPI',
            date: new Date().toISOString().split('T')[0],
            recorded_by: user?.user_id || '',
            receipt_image: ''
        });
        setShowModal(true);
    };

    const openEditExpenseModal = (t: Transaction) => {
        removeSelectedReceipt();
        setEditingTransaction(t);

        const standardCategories = ['Salary', 'Staff Expense', 'Staff Reimbursement', 'Rent', 'Utilities', 'Office Supplies', 'General Overhead', 'Food', 'Travel', 'Recharge'];
        const isStandard = standardCategories.includes(t.category);
        
        setCustomCategory(isStandard ? '' : t.category);
        setFormData({
            type: 'debit',
            category: isStandard ? t.category : (t.category && t.category.toLowerCase().includes('staff') ? 'Staff Expense' : 'Other'),
            person_name: t.person_name || '',
            amount: t.amount ? String(t.amount) : '',
            incentive: t.incentive ? String(t.incentive) : '',
            description: t.description || '',
            payment_mode: t.payment_mode || 'Bank Transfer',
            date: t.transaction_date ? t.transaction_date.slice(0, 10) : (t.date ? t.date.slice(0, 10) : new Date().toISOString().split('T')[0]),
            recorded_by: t.recorded_by || user?.user_id || '',
            receipt_image: t.receipt_image || t.image || ''
        });

        if (t.receipt_image || t.image) {
            setReceiptPreview(t.receipt_image || t.image || '');
            setReceiptFileName('Existing Receipt Attached');
        }

        setShowModal(true);
    };

    const handleDeleteExpense = async (t: Transaction) => {
        const desc = t.category === 'Salary'
            ? `Salary payment to ${t.person_name || 'Staff'}`
            : (t.person_name ? `${t.category} - ${t.person_name}` : (t.description || `${t.category} Overhead`));
        const amt = (parseFloat(t.amount || '0') + (t.incentive ? parseFloat(t.incentive) : 0)).toLocaleString('en-IN');
        
        const confirmDelete = window.confirm(
            `Move corporate expense entry to Deleted Entries?\n\n• Transaction ID: TXN-${t.transaction_id}\n• Expense: ${desc}\n• Amount: ₹${amt}\n\nThis entry will be moved to the Deleted Entries section and remain recoverable for 30 days before permanent deletion.`
        );

        if (!confirmDelete) return;

        setDeletingId(t.transaction_id);
        try {
            const res = await axios.post(`${API_BASE_URL}/finance/delete`, { 
                transaction_id: t.transaction_id,
                deleted_by: user?.name || user?.username || user?.user_id || 'User'
            });
            if (res.data.success) {
                alert('✓ Expense moved to Deleted Entries. You can recover it within 30 days.');
                fetchData();
            } else {
                alert(res.data.message || 'Failed to delete expense entry.');
            }
        } catch (err: any) {
            alert('Failed to delete expense entry. Please try again.');
        } finally {
            setDeletingId(null);
        }
    };

    const handleRestoreExpense = async (t: Transaction) => {
        const desc = t.category === 'Salary'
            ? `Salary payment to ${t.person_name || 'Staff'}`
            : (t.person_name ? `${t.category} - ${t.person_name}` : (t.description || `${t.category} Overhead`));
        const amt = (parseFloat(t.amount || '0') + (t.incentive ? parseFloat(t.incentive) : 0)).toLocaleString('en-IN');
        
        if (!window.confirm(`Restore this corporate expense back to active accounts?\n\n• Transaction ID: TXN-${t.transaction_id}\n• Expense: ${desc}\n• Amount: ₹${amt}`)) {
            return;
        }

        setRestoringId(t.transaction_id);
        try {
            const res = await axios.post(`${API_BASE_URL}/finance/restore`, { transaction_id: t.transaction_id });
            if (res.data.success) {
                alert('✓ Expense entry restored successfully.');
                fetchData();
            } else {
                alert(res.data.message || 'Failed to restore expense entry.');
            }
        } catch (err: any) {
            alert('Failed to restore expense entry.');
        } finally {
            setRestoringId(null);
        }
    };

    const handlePermanentDeleteExpense = async (t: Transaction) => {
        const desc = t.category === 'Salary'
            ? `Salary payment to ${t.person_name || 'Staff'}`
            : (t.person_name ? `${t.category} - ${t.person_name}` : (t.description || `${t.category} Overhead`));
        const amt = (parseFloat(t.amount || '0') + (t.incentive ? parseFloat(t.incentive) : 0)).toLocaleString('en-IN');
        
        if (!window.confirm(`⚠️ PERMANENT DELETE WARNING:\n\nAre you sure you want to permanently delete this corporate expense?\n\n• Transaction ID: TXN-${t.transaction_id}\n• Expense: ${desc}\n• Amount: ₹${amt}\n\nThis will purge it from the database forever and CANNOT be undone!`)) {
            return;
        }

        setPermanentDeletingId(t.transaction_id);
        try {
            const res = await axios.post(`${API_BASE_URL}/finance/permanent-delete`, { transaction_id: t.transaction_id });
            if (res.data.success) {
                alert('✓ Expense entry permanently purged from database.');
                fetchData();
            } else {
                alert(res.data.message || 'Failed to permanently delete expense entry.');
            }
        } catch (err: any) {
            alert('Failed to permanently delete expense entry.');
        } finally {
            setPermanentDeletingId(null);
        }
    };

    return (
        <div style={{ width: '100%', padding: '0 0 24px 0' }}>
            <style>{`
                .overhead-card {
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 16px;
                    padding: 24px;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.02);
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                }
                .overhead-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.04);
                }
                .input-field {
                    width: 100%;
                    padding: 12px;
                    border-radius: 8px;
                    border: 1px solid #cbd5e1;
                    outline: none;
                    font-size: 0.95rem;
                    transition: border-color 0.2s ease, box-shadow 0.2s ease;
                }
                .input-field:focus {
                    border-color: #253b50;
                    box-shadow: 0 0 0 3px rgba(37, 59, 80, 0.15);
                }
                .tab-btn {
                    padding: 10px 20px;
                    border: none;
                    background: none;
                    font-size: 0.95rem;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    border-radius: 8px;
                }
                .action-btn {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background-color: #e11d48;
                    color: white;
                    padding: 12px 24px;
                    border-radius: 12px;
                    border: none;
                    font-weight: 700;
                    font-size: 0.95rem;
                    cursor: pointer;
                    box-shadow: 0 4px 10px rgba(225, 29, 72, 0.2);
                    transition: all 0.2s ease;
                }
                .action-btn:hover {
                    background-color: #be123c;
                    box-shadow: 0 6px 14px rgba(225, 29, 72, 0.3);
                    transform: translateY(-1px);
                }
                .table-row {
                    border-bottom: 1px solid #f1f5f9;
                    transition: background-color 0.2s ease;
                }
                .table-row:hover {
                    background-color: #f8fafc;
                }
                .btn-pay {
                    background-color: #ecfdf5;
                    color: #059669;
                    border: 1px solid #a7f3d0;
                    padding: 6px 12px;
                    border-radius: 6px;
                    font-weight: 700;
                    font-size: 0.8rem;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .btn-pay:hover {
                    background-color: #059669;
                    color: white;
                }
            `}</style>

            {/* Header Block */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0c1527', margin: 0 }}>Company Expenses &amp; Overheads</h2>
                    <p style={{ color: '#64748b', marginTop: '4px' }}>Track salaries, office rents, electricity, utilities, and general corporate overhead expenses.</p>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button
                        onClick={() => openRecordStaffExpenseModal()}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '11px 20px',
                            backgroundColor: '#8b5cf6',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '10px',
                            fontWeight: 800,
                            fontSize: '0.92rem',
                            cursor: 'pointer',
                            boxShadow: '0 4px 14px rgba(139,92,246,0.3)',
                            transition: 'all 0.2s'
                        }}
                        title="Record Staff Expense, Claims, Allowance, Travel, or Reimbursement"
                    >
                        <Receipt size={18} /> + Record Staff Expense
                    </button>
                    <button
                        onClick={openRecordExpenseModal}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '11px 22px',
                            backgroundColor: '#fca412',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '10px',
                            fontWeight: 800,
                            fontSize: '0.92rem',
                            cursor: 'pointer',
                            boxShadow: '0 4px 14px rgba(252,164,18,0.3)',
                            transition: 'all 0.2s'
                        }}
                    >
                        <Plus size={18} /> Record Company Expense
                    </button>
                </div>
            </div>

            {/* Filter & Controller Bar */}
            <div style={{ marginBottom: '24px', backgroundColor: '#ffffff', padding: '24px', borderRadius: '16px', border: '1.5px solid #ffe8c2', boxShadow: '0 4px 14px rgba(252,164,18,0.05)' }}>
                {/* Header & Reset Button */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontWeight: 700, fontSize: '0.90rem' }}>
                        <Filter size={18} style={{ color: '#ea580c' }} />
                        Filter &amp; Search Statement Periods
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            backgroundColor: '#fff1f2',
                            border: '1.5px solid #fecdd3',
                            padding: '5px 14px',
                            borderRadius: '8px'
                        }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#be123c', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Total Amount:
                            </span>
                            <span style={{ fontSize: '0.95rem', fontWeight: 900, color: '#be123c' }}>
                                ₹{grandTotal.toLocaleString('en-IN')}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                setSearchTerm('');
                                setFilterTxnId('');
                                setFilterPaymentMode('all');
                                setFilterAmount('');
                                setCustomStartDate('');
                                setCustomEndDate('');
                                setSelectedCategoryCard('all');
                                setDateFilterType('month');
                                setSelectedYear(new Date().getFullYear());
                                setSelectedMonth(() => {
                                    const today = new Date();
                                    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
                                });
                            }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 14px',
                                borderRadius: '8px',
                                border: '1.5px solid #ef4444',
                                backgroundColor: '#fef2f2',
                                color: '#ef4444',
                                fontWeight: 800,
                                fontSize: '0.80rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                boxShadow: '0 2px 6px rgba(239, 68, 68, 0.12)'
                            }}
                            title="Reset all expense search and filter options"
                        >
                            <RotateCcw size={14} /> Reset Filters
                        </button>
                    </div>
                </div>

                {/* Section 1: Date Range Filters */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', borderBottom: '1.5px solid #f1f5f9', paddingBottom: '16px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0c1527', textTransform: 'uppercase', letterSpacing: '0.5px', marginRight: '8px' }}>Statement Period:</span>
                        
                        {/* Quick Date Filters */}
                        {[
                            { id: 'month', label: 'Month Selector' },
                            { id: 'today', label: 'Today' },
                            { id: 'last7', label: 'Last 7 Days' },
                            { id: 'lastMonth', label: 'Last Month (30d)' },
                            { id: 'this_year', label: 'This Year' },
                            { id: 'by_year', label: 'By Year' },
                            { id: 'custom', label: 'Custom Date' }
                        ].map((btn) => (
                            <button
                                key={btn.id}
                                type="button"
                                onClick={() => setDateFilterType(btn.id as any)}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '8px',
                                    border: '1.5px solid',
                                    borderColor: dateFilterType === btn.id ? '#fca412' : '#cbd5e1',
                                    backgroundColor: dateFilterType === btn.id ? '#fca412' : '#ffffff',
                                    color: dateFilterType === btn.id ? '#ffffff' : '#0c1527',
                                    fontSize: '0.82rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                {btn.label}
                            </button>
                        ))}

                        {/* Month Selector Dropdown (Visible only when dateFilterType is 'month') */}
                        {dateFilterType === 'month' && (
                            <div style={{ position: 'relative', marginLeft: '8px' }}>
                                <button 
                                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                    style={{ 
                                        padding: '8px 16px', 
                                        borderRadius: '8px', 
                                        border: '1.5px solid #fca412', 
                                        outline: 'none', 
                                        fontSize: '0.82rem', 
                                        fontWeight: 800, 
                                        color: '#ffffff', 
                                        cursor: 'pointer', 
                                        backgroundColor: '#fca412', 
                                        minWidth: '180px',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}
                                >
                                    <span>{selectedMonth === 'all' ? 'All Time Summary' : activeMonthLabel()}</span>
                                    <span style={{ fontSize: '0.65rem' }}>▼</span>
                                </button>
                                {isDropdownOpen && (
                                    <>
                                        <div onClick={() => setIsDropdownOpen(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }} />
                                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '6px', backgroundColor: '#ffffff', border: '1.5px solid #ffe8c2', borderRadius: '10px', boxShadow: '0 10px 20px rgba(0,0,0,0.1)', zIndex: 100, maxHeight: '200px', overflowY: 'auto' }}>
                                            <div onClick={() => { setSelectedMonth('all'); setIsDropdownOpen(false); }} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, color: selectedMonth === 'all' ? '#fca412' : '#0c1527' }}>
                                                All Time Summary
                                            </div>
                                            {getMonthOptions().map(m => {
                                                const [year, month] = m.split('-');
                                                const date = new Date(parseInt(year), parseInt(month) - 1);
                                                const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                                                return (
                                                    <div key={m} onClick={() => { setSelectedMonth(m); setIsDropdownOpen(false); }} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: selectedMonth === m ? '#fca412' : '#0c1527' }}>
                                                        {label}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* By Year Selector Dropdown (Visible only when dateFilterType is 'by_year') */}
                        {dateFilterType === 'by_year' && (
                            <div style={{ marginLeft: '8px' }}>
                                <select
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                                    style={{
                                        padding: '8px 14px',
                                        borderRadius: '8px',
                                        border: '1.5px solid #2563eb',
                                        backgroundColor: '#eff6ff',
                                        fontSize: '0.82rem',
                                        fontWeight: 800,
                                        color: '#1e40af',
                                        outline: 'none',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {Array.from({ length: 8 }, (_, i) => new Date().getFullYear() - i).map(yr => (
                                        <option key={yr} value={yr}>{yr}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Custom Date Inputs (Visible only when dateFilterType is 'custom') */}
                        {dateFilterType === 'custom' && (
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: '12px' }}>
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

                    <div style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>
                        Statement Scope: <span style={{ color: '#0c1527', backgroundColor: '#fff9f0', padding: '4px 10px', borderRadius: '6px', border: '1px solid #ffe8c2', fontWeight: 800 }}>{activeMonthLabel()}</span>
                    </div>
                </div>

                {/* Section 2: Input Filters */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr auto', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    {/* Search Bar */}
                    <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Search bar</label>
                        <div style={{ position: 'relative' }}>
                            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <input
                                type="text"
                                placeholder="Search description, payee..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ width: '100%', padding: '8px 12px 8px 30px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.82rem', outline: 'none', fontWeight: 600 }}
                            />
                        </div>
                    </div>

                    {/* Transaction ID */}
                    <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Transaction ID</label>
                        <input
                            type="text"
                            placeholder="e.g. 102"
                            value={filterTxnId}
                            onChange={(e) => setFilterTxnId(e.target.value)}
                            style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.82rem', outline: 'none', fontWeight: 600 }}
                        />
                    </div>

                    {/* Payment Mode */}
                    <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Payment Mode</label>
                        <select
                            value={filterPaymentMode}
                            onChange={(e) => setFilterPaymentMode(e.target.value)}
                            style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.82rem', outline: 'none', fontWeight: 600, color: '#0c1527', background: 'white' }}
                        >
                            <option value="all">All Modes</option>
                            <option value="UPI">UPI</option>
                            <option value="Cash">Cash</option>
                            <option value="Bank Transfer">Bank Transfer</option>
                            <option value="Cheque">Cheque</option>
                            <option value="Reimbursement">Reimbursement</option>
                        </select>
                    </div>

                    {/* Amount */}
                    <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Amount (₹)</label>
                        <input
                            type="number"
                            placeholder="Search amount..."
                            value={filterAmount}
                            onChange={(e) => setFilterAmount(e.target.value)}
                            style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.82rem', outline: 'none', fontWeight: 600 }}
                        />
                    </div>

                    {/* Clear Button */}
                    <button
                        type="button"
                        onClick={() => {
                            setSearchTerm('');
                            setFilterTxnId('');
                            setFilterPaymentMode('all');
                            setFilterAmount('');
                            setCustomStartDate('');
                            setCustomEndDate('');
                            setSelectedCategoryCard('all');
                            setDateFilterType('month');
                            setSelectedYear(new Date().getFullYear());
                            setSelectedMonth(() => {
                                const today = new Date();
                                return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
                            });
                        }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '9px 18px',
                            borderRadius: '8px',
                            border: '1.5px solid #ef4444',
                            backgroundColor: '#fef2f2',
                            color: '#ef4444',
                            fontSize: '0.82rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            boxShadow: '0 2px 6px rgba(239, 68, 68, 0.12)'
                        }}
                    >
                        <RotateCcw size={14} /> Reset Filters
                    </button>
                </div>
            </div>

            {/* Stat Grid (6 Columns - All In One Row) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '14px', marginBottom: '28px' }}>
                {/* Salaries Card */}
                <div 
                    className="overhead-card" 
                    onClick={() => setSelectedCategoryCard(prev => prev === 'salary' ? 'all' : 'salary')}
                    style={{ 
                        borderTop: '4px solid #4f46e5', 
                        padding: '16px 18px', 
                        borderRadius: '14px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: selectedCategoryCard === 'salary' ? '0 0 0 2.5px #4f46e5, 0 8px 20px rgba(79,70,229,0.25)' : undefined,
                        backgroundColor: selectedCategoryCard === 'salary' ? '#f5f3ff' : '#ffffff'
                    }}
                    title="Click to filter Salary payments"
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <p style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Salaries Paid</p>
                            <h4 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#4f46e5', margin: 0 }}>₹{salaryTotal.toLocaleString('en-IN')}</h4>
                        </div>
                        <div style={{ backgroundColor: '#e0e7ff', color: '#4f46e5', padding: '8px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Users size={18} />
                        </div>
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '0.72rem', color: '#64748b' }}>
                        Staff monthly payroll.
                    </div>
                </div>

                {/* Rent Card */}
                <div 
                    className="overhead-card" 
                    onClick={() => setSelectedCategoryCard(prev => prev === 'rent' ? 'all' : 'rent')}
                    style={{ 
                        borderTop: '4px solid #f59e0b', 
                        padding: '16px 18px', 
                        borderRadius: '14px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: selectedCategoryCard === 'rent' ? '0 0 0 2.5px #f59e0b, 0 8px 20px rgba(245,158,11,0.25)' : undefined,
                        backgroundColor: selectedCategoryCard === 'rent' ? '#fffbeb' : '#ffffff'
                    }}
                    title="Click to filter Rent payments"
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <p style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Office Rent</p>
                            <h4 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#d97706', margin: 0 }}>₹{rentTotal.toLocaleString('en-IN')}</h4>
                        </div>
                        <div style={{ backgroundColor: '#fef3c7', color: '#d97706', padding: '8px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Building2 size={18} />
                        </div>
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '0.72rem', color: '#64748b' }}>
                        Office lease cost.
                    </div>
                </div>

                {/* Utilities Card */}
                <div 
                    className="overhead-card" 
                    onClick={() => setSelectedCategoryCard(prev => prev === 'utilities' ? 'all' : 'utilities')}
                    style={{ 
                        borderTop: '4px solid #06b6d4', 
                        padding: '16px 18px', 
                        borderRadius: '14px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: selectedCategoryCard === 'utilities' ? '0 0 0 2.5px #06b6d4, 0 8px 20px rgba(6,182,212,0.25)' : undefined,
                        backgroundColor: selectedCategoryCard === 'utilities' ? '#ecfeff' : '#ffffff'
                    }}
                    title="Click to filter Utilities & Bills"
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <p style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Utilities & Bills</p>
                            <h4 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0891b2', margin: 0 }}>₹{utilitiesTotal.toLocaleString('en-IN')}</h4>
                        </div>
                        <div style={{ backgroundColor: '#ecfeff', color: '#0891b2', padding: '8px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Lightbulb size={18} />
                        </div>
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '0.72rem', color: '#64748b' }}>
                        Power, net & bills.
                    </div>
                </div>

                {/* Staff Expenses Card */}
                <div 
                    className="overhead-card" 
                    onClick={() => setSelectedCategoryCard(prev => prev === 'staff' ? 'all' : 'staff')}
                    style={{ 
                        borderTop: '4px solid #8b5cf6', 
                        padding: '16px 18px', 
                        borderRadius: '14px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: selectedCategoryCard === 'staff' ? '0 0 0 2.5px #8b5cf6, 0 8px 20px rgba(139,92,246,0.3)' : undefined,
                        backgroundColor: selectedCategoryCard === 'staff' ? '#f5f3ff' : '#ffffff'
                    }}
                    title="Click to filter Staff Expenses & Claims"
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <p style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Staff Expenses</p>
                            <h4 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#7c3aed', margin: 0 }}>₹{staffExpensesTotal.toLocaleString('en-IN')}</h4>
                        </div>
                        <div style={{ backgroundColor: '#f3e8ff', color: '#7c3aed', padding: '8px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Receipt size={18} />
                        </div>
                    </div>
                    <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Office claims & reimb.</span>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                openRecordStaffExpenseModal();
                            }}
                            style={{
                                padding: '3px 8px',
                                fontSize: '0.70rem',
                                fontWeight: 800,
                                borderRadius: '6px',
                                border: '1px solid #d8b4fe',
                                backgroundColor: '#f3e8ff',
                                color: '#7c3aed',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                            }}
                            title="Quickly record a staff expense"
                        >
                            + Add
                        </button>
                    </div>
                </div>

                {/* Other Expenses Card */}
                <div 
                    className="overhead-card" 
                    onClick={() => setSelectedCategoryCard(prev => prev === 'other' ? 'all' : 'other')}
                    style={{ 
                        borderTop: '4px solid #10b981', 
                        padding: '16px 18px', 
                        borderRadius: '14px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: selectedCategoryCard === 'other' ? '0 0 0 2.5px #10b981, 0 8px 20px rgba(16,185,129,0.25)' : undefined,
                        backgroundColor: selectedCategoryCard === 'other' ? '#ecfdf5' : '#ffffff'
                    }}
                    title="Click to filter Other corporate expenses"
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <p style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Other Expenses</p>
                            <h4 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#059669', margin: 0 }}>₹{otherTotal.toLocaleString('en-IN')}</h4>
                        </div>
                        <div style={{ backgroundColor: '#d1fae5', color: '#059669', padding: '8px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <CreditCard size={18} />
                        </div>
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '0.72rem', color: '#64748b' }}>
                        Office supplies, custom &amp; misc.
                    </div>
                </div>

                {/* Total Overheads Card */}
                <div 
                    className="overhead-card" 
                    onClick={() => setSelectedCategoryCard('all')}
                    style={{ 
                        borderTop: '4px solid #e11d48', 
                        backgroundColor: selectedCategoryCard === 'all' ? '#ffe4e6' : '#fff1f2', 
                        padding: '16px 18px', 
                        borderRadius: '14px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: selectedCategoryCard === 'all' ? '0 0 0 2.5px #e11d48, 0 8px 20px rgba(225,29,72,0.25)' : undefined
                    }}
                    title="Click to view All Overheads"
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <p style={{ color: '#be123c', fontSize: '0.75rem', fontWeight: 700, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Total Overheads</p>
                            <h4 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#be123c', margin: 0 }}>₹{grandTotal.toLocaleString('en-IN')}</h4>
                        </div>
                        <div style={{ backgroundColor: '#ffe4e6', color: '#be123c', padding: '8px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <TrendingDown size={18} />
                        </div>
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '0.72rem', color: '#be123c', fontWeight: 600 }}>
                        Total company expenses.
                    </div>
                </div>
            </div>

            {/* Detailed Tables & Tabs */}
            <div className="premium-card" style={{ border: '1px solid #e2e8f0', padding: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', gap: '8px', backgroundColor: '#e2e8f0', padding: '4px', borderRadius: '10px' }}>
                        <button
                            className="tab-btn"
                            onClick={() => setActiveTab('all_overheads')}
                            style={{
                                backgroundColor: activeTab === 'all_overheads' ? 'white' : 'transparent',
                                color: activeTab === 'all_overheads' ? '#0f172a' : '#475569',
                                boxShadow: activeTab === 'all_overheads' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                            }}
                        >
                            All Overhead Expenses
                        </button>
                        <button
                            className="tab-btn"
                            onClick={() => setActiveTab('salary_roll')}
                            style={{
                                backgroundColor: activeTab === 'salary_roll' ? 'white' : 'transparent',
                                color: activeTab === 'salary_roll' ? '#0f172a' : '#475569',
                                boxShadow: activeTab === 'salary_roll' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                            }}
                        >
                            Team Salaries Roll
                        </button>
                        <button
                            className="tab-btn"
                            onClick={() => setActiveTab('deleted')}
                            style={{
                                backgroundColor: activeTab === 'deleted' ? 'white' : 'transparent',
                                color: activeTab === 'deleted' ? '#b91c1c' : '#475569',
                                boxShadow: activeTab === 'deleted' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <Trash2 size={15} color={activeTab === 'deleted' ? '#b91c1c' : '#64748b'} />
                            Deleted Entries (30-Day Recovery)
                            {deletedOverheadTransactions.length > 0 && (
                                <span style={{
                                    backgroundColor: '#ef4444',
                                    color: 'white',
                                    fontSize: '0.68rem',
                                    fontWeight: 800,
                                    padding: '1px 6px',
                                    borderRadius: '999px'
                                }}>
                                    {deletedOverheadTransactions.length}
                                </span>
                            )}
                        </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        {activeTab === 'all_overheads' && (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                backgroundColor: '#fff1f2',
                                border: '1.5px solid #fecdd3',
                                padding: '6px 16px',
                                borderRadius: '10px',
                                boxShadow: '0 2px 6px rgba(225, 29, 72, 0.08)'
                            }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#be123c', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Total Amount:
                                </span>
                                <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#e11d48' }}>
                                    ₹{grandTotal.toLocaleString('en-IN')}
                                </span>
                            </div>
                        )}
                        {activeTab === 'salary_roll' && (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                backgroundColor: '#eef2ff',
                                border: '1.5px solid #c7d2fe',
                                padding: '6px 16px',
                                borderRadius: '10px',
                                boxShadow: '0 2px 6px rgba(79, 70, 229, 0.08)'
                            }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#4338ca', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Total Salaries Paid:
                                </span>
                                <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#4f46e5' }}>
                                    ₹{salaryTotal.toLocaleString('en-IN')}
                                </span>
                            </div>
                        )}
                        {activeTab === 'deleted' && (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                backgroundColor: '#fef2f2',
                                border: '1.5px solid #fee2e2',
                                padding: '6px 16px',
                                borderRadius: '10px',
                                boxShadow: '0 2px 6px rgba(239, 68, 68, 0.08)'
                            }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Recoverable Entries:
                                </span>
                                <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#b91c1c' }}>
                                    {deletedOverheadTransactions.length}
                                </span>
                            </div>
                        )}

                        {activeTab === 'salary_roll' && (
                            <button
                                onClick={openAutoSalaryModal}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '9px 18px',
                                    borderRadius: '10px',
                                    border: 'none',
                                    background: 'linear-gradient(135deg, #fca412 0%, #ea580c 100%)',
                                    color: '#ffffff',
                                    fontWeight: 800,
                                    fontSize: '0.88rem',
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 12px rgba(234,88,12,0.25)',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <Zap size={18} color="#ffffff" /> Auto Add Monthly Salaries
                            </button>
                        )}
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    {activeTab === 'all_overheads' ? (
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #cbd5e1', backgroundColor: '#f8fafc' }}>
                                    <th style={{ padding: '16px 24px', color: '#475569', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase' }}>Expense Details</th>
                                    <th style={{ padding: '16px 24px', color: '#475569', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase' }}>Category</th>
                                    <th style={{ padding: '16px 24px', color: '#475569', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase' }}>Expense Notes / Description</th>
                                    <th style={{ padding: '16px 24px', color: '#475569', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase' }}>Date</th>
                                    <th style={{ padding: '16px 24px', color: '#475569', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase' }}>Payment Mode</th>
                                    <th style={{ padding: '16px 24px', color: '#475569', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', textAlign: 'center' }}>Receipt / Doc</th>
                                    <th style={{ padding: '16px 24px', color: '#475569', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', textAlign: 'right' }}>Amount</th>
                                    <th style={{ padding: '16px 24px', color: '#475569', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', textAlign: 'center' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={8} style={{ textAlign: 'center', padding: '40px' }}>
                                            <Loader2 className="animate-spin" style={{ margin: '0 auto' }} size={32} color="#253b50" />
                                        </td>
                                    </tr>
                                ) : filteredOverheads.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} style={{ textAlign: 'center', padding: '50px', color: '#64748b' }}>
                                            No corporate overhead transactions logged for this statement month.
                                        </td>
                                    </tr>
                                ) : filteredOverheads.map((o, idx) => (
                                    <tr key={`${o.transaction_id}-${idx}`} className="table-row">
                                        <td style={{ padding: '16px 24px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{
                                                    backgroundColor: '#fee2e2',
                                                    color: '#991b1b',
                                                    padding: '8px',
                                                    borderRadius: '8px'
                                                }}>
                                                    <ArrowDownLeft size={18} />
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>
                                                        {o.category === 'Salary'
                                                            ? `Salary to ${o.person_name || 'Staff Member'}`
                                                            : (o.person_name ? `${o.category} - ${o.person_name}` : (o.description ? o.description : `${o.category} Overhead`))}
                                                    </div>
                                                    {o.category === 'Salary' && o.incentive && parseFloat(o.incentive) > 0 && (
                                                        <div style={{ fontSize: '0.8rem', color: '#059669', fontWeight: 600, marginTop: '2px' }}>
                                                            + Incentive: ₹{parseFloat(o.incentive).toLocaleString('en-IN')}
                                                        </div>
                                                    )}
                                                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>Transaction ID: TXN-{o.transaction_id}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px 24px' }}>
                                            <span style={{ fontSize: '0.8rem', fontWeight: 700, padding: '4px 10px', borderRadius: '20px', backgroundColor: '#f1f5f9', color: '#475569' }}>
                                                {o.category}
                                            </span>
                                        </td>
                                        <td style={{ padding: '16px 24px', maxWidth: '300px' }}>
                                            {o.description ? (
                                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                                    <FileText size={15} color="#ea580c" style={{ flexShrink: 0, marginTop: '2px' }} />
                                                    <span style={{ fontSize: '0.88rem', color: '#1e293b', fontWeight: 500, lineHeight: 1.4, wordBreak: 'break-word' }}>
                                                        {o.description}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span style={{ fontSize: '0.82rem', color: '#94a3b8', fontStyle: 'italic' }}>
                                                    —
                                                </span>
                                            )}
                                        </td>
                                        <td style={{ padding: '16px 24px', fontSize: '0.9rem', color: '#64748b' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Calendar size={14} />
                                                {new Date(o.transaction_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px 24px', fontWeight: 600, color: '#475569' }}>
                                            {o.payment_mode}
                                        </td>
                                        <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                                            {(o.receipt_image || o.image) ? (
                                                <button
                                                    type="button"
                                                    onClick={() => setViewReceiptModalUrl(o.receipt_image || o.image || '')}
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        padding: '6px 12px',
                                                        borderRadius: '8px',
                                                        border: '1.5px solid #fed7aa',
                                                        backgroundColor: '#fff7ed',
                                                        color: '#ea580c',
                                                        fontSize: '0.8rem',
                                                        fontWeight: 700,
                                                        cursor: 'pointer',
                                                        transition: 'all 0.15s ease',
                                                        boxShadow: '0 1px 3px rgba(234,88,12,0.1)'
                                                    }}
                                                    title="View Proof Document / Receipt"
                                                >
                                                    <Eye size={13} /> View Doc
                                                </button>
                                            ) : (
                                                <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>—</span>
                                            )}
                                        </td>
                                        <td style={{ padding: '16px 24px', fontWeight: 800, textAlign: 'right', color: '#e11d48', fontSize: '1rem' }}>
                                            -₹{(parseFloat(o.amount || '0') + (o.incentive ? parseFloat(o.incentive) : 0)).toLocaleString('en-IN')}
                                            {o.category === 'Salary' && o.incentive && parseFloat(o.incentive) > 0 && (
                                                <div style={{ fontSize: '0.8rem', color: '#059669', fontWeight: 600, marginTop: '2px' }}>
                                                    {parseFloat(o.amount || '0') > 0 ? `(Base: ₹${parseFloat(o.amount).toLocaleString('en-IN')} + Incentive: ₹${parseFloat(o.incentive).toLocaleString('en-IN')})` : `Incentive Bonus: ₹${parseFloat(o.incentive).toLocaleString('en-IN')}`}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: '16px 24px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => openEditExpenseModal(o)}
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        padding: '6px 12px',
                                                        borderRadius: '8px',
                                                        border: '1.5px solid #cbd5e1',
                                                        backgroundColor: '#f8fafc',
                                                        color: '#0284c7',
                                                        fontSize: '0.78rem',
                                                        fontWeight: 700,
                                                        cursor: 'pointer',
                                                        transition: 'all 0.15s ease'
                                                    }}
                                                    title={`Edit Transaction TXN-${o.transaction_id}`}
                                                >
                                                    <Edit2 size={13} /> Edit
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteExpense(o)}
                                                    disabled={deletingId === o.transaction_id}
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        padding: '6px 12px',
                                                        borderRadius: '8px',
                                                        border: '1.5px solid #fecaca',
                                                        backgroundColor: '#fff5f5',
                                                        color: '#dc2626',
                                                        fontSize: '0.78rem',
                                                        fontWeight: 700,
                                                        cursor: deletingId === o.transaction_id ? 'not-allowed' : 'pointer',
                                                        opacity: deletingId === o.transaction_id ? 0.6 : 1,
                                                        transition: 'all 0.15s ease'
                                                    }}
                                                    title={`Delete Transaction TXN-${o.transaction_id}`}
                                                >
                                                    {deletingId === o.transaction_id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            {filteredOverheads.length > 0 && (
                                <tfoot>
                                    <tr style={{ backgroundColor: '#fff1f2', borderTop: '2px solid #fecdd3' }}>
                                        <td colSpan={6} style={{ padding: '16px 24px', fontWeight: 800, color: '#be123c', fontSize: '0.92rem' }}>
                                            TOTAL OVERHEAD AMOUNT ({filteredOverheads.length} Transactions)
                                        </td>
                                        <td style={{ padding: '16px 24px', fontWeight: 900, textAlign: 'right', color: '#be123c', fontSize: '1.15rem' }}>
                                            -₹{grandTotal.toLocaleString('en-IN')}
                                        </td>
                                        <td style={{ padding: '16px 24px' }}></td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    ) : activeTab === 'salary_roll' ? (
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #cbd5e1', backgroundColor: '#f8fafc' }}>
                                    <th style={{ padding: '16px 24px', color: '#475569', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase' }}>Team Member Name</th>
                                    <th style={{ padding: '16px 24px', color: '#475569', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase' }}>Department Role</th>
                                    <th style={{ padding: '16px 24px', color: '#475569', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', textAlign: 'right' }}>Base Salary</th>
                                    <th style={{ padding: '16px 24px', color: '#475569', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', textAlign: 'right' }}>Incentive Amount</th>
                                    <th style={{ padding: '16px 24px', color: '#475569', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', textAlign: 'right' }}>Paid This Month</th>
                                    <th style={{ padding: '16px 24px', color: '#475569', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} style={{ textAlign: 'center', padding: '40px' }}>
                                            <Loader2 className="animate-spin" style={{ margin: '0 auto' }} size={32} color="#253b50" />
                                        </td>
                                    </tr>
                                ) : teamMembers.filter(t => t.status === 'active').map((m, idx) => {
                                    const colors = getAvatarColors(m.name);
                                    const paidAmount = getMemberSalaryPaid(m.name);
                                    const baseSalary = m.salary ? parseFloat(m.salary) : 0;
                                    const incentiveAmount = filteredOverheads
                                        .filter(t => t.category === 'Salary' && t.person_name === m.name)
                                        .reduce((sum, t) => sum + (t.incentive ? parseFloat(t.incentive) : 0), 0);
                                    return (
                                        <tr key={m.user_id} className="table-row">
                                            <td style={{ padding: '16px 24px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div style={{ 
                                                        width: '36px', 
                                                        height: '36px', 
                                                        borderRadius: '10px', 
                                                        backgroundColor: colors.bg, 
                                                        color: colors.text, 
                                                        display: 'flex', 
                                                        alignItems: 'center', 
                                                        justifyContent: 'center', 
                                                        fontWeight: 800,
                                                        fontSize: '0.9rem'
                                                    }}>
                                                        {m.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{m.name}</div>
                                                </div>
                                            </td>
                                            <td style={{ padding: '16px 24px', fontWeight: 500, color: '#475569' }}>
                                                {ROLE_LABELS[m.role] || m.role}
                                            </td>
                                            <td style={{ padding: '16px 24px', fontWeight: 800, textAlign: 'right', color: '#64748b', fontSize: '0.95rem' }}>
                                                {baseSalary > 0 ? `₹${baseSalary.toLocaleString('en-IN')}` : '₹0'}
                                            </td>
                                            <td style={{ padding: '16px 24px', fontWeight: 800, textAlign: 'right', color: incentiveAmount > 0 ? '#059669' : '#94a3b8', fontSize: '0.95rem' }}>
                                                {incentiveAmount > 0 ? `₹${incentiveAmount.toLocaleString('en-IN')}` : '₹0'}
                                            </td>
                                            <td style={{ padding: '16px 24px', fontWeight: 800, textAlign: 'right', color: paidAmount > 0 ? '#059669' : '#94a3b8', fontSize: '0.95rem' }}>
                                                {paidAmount > 0 ? `₹${paidAmount.toLocaleString('en-IN')}` : '₹0'}
                                            </td>
                                            <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                                                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                                    <button 
                                                        className="btn-pay" 
                                                        onClick={() => openQuickSalaryModal(m.name)}
                                                    >
                                                        {paidAmount > 0 ? 'Pay Bonus' : 'Record Salary'}
                                                    </button>
                                                    <button 
                                                        type="button"
                                                        onClick={() => openRecordStaffExpenseModal(m.name)}
                                                        style={{
                                                            backgroundColor: '#f3e8ff',
                                                            color: '#7c3aed',
                                                            border: '1px solid #d8b4fe',
                                                            padding: '6px 12px',
                                                            borderRadius: '6px',
                                                            fontWeight: 700,
                                                            fontSize: '0.8rem',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s ease'
                                                        }}
                                                        title="Record travel, food, reimbursement, or staff expense for this member"
                                                    >
                                                        + Staff Expense
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            {teamMembers.filter(t => t.status === 'active').length > 0 && (
                                <tfoot>
                                    <tr style={{ backgroundColor: '#eef2ff', borderTop: '2px solid #c7d2fe' }}>
                                        <td colSpan={4} style={{ padding: '16px 24px', fontWeight: 800, color: '#4338ca', fontSize: '0.92rem' }}>
                                            TOTAL SALARIES PAID THIS MONTH ({teamMembers.filter(t => t.status === 'active').length} Members)
                                        </td>
                                        <td style={{ padding: '16px 24px', fontWeight: 900, textAlign: 'right', color: '#4338ca', fontSize: '1.15rem' }}>
                                            ₹{salaryTotal.toLocaleString('en-IN')}
                                        </td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #cbd5e1', backgroundColor: '#fef2f2' }}>
                                    <th style={{ padding: '16px 24px', color: '#991b1b', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase' }}>Deleted Entry Details</th>
                                    <th style={{ padding: '16px 24px', color: '#991b1b', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase' }}>Category</th>
                                    <th style={{ padding: '16px 24px', color: '#991b1b', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase' }}>Description / Notes</th>
                                    <th style={{ padding: '16px 24px', color: '#991b1b', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase' }}>Deleted On / Recovery Window</th>
                                    <th style={{ padding: '16px 24px', color: '#991b1b', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase' }}>Payment Mode</th>
                                    <th style={{ padding: '16px 24px', color: '#991b1b', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', textAlign: 'right' }}>Amount</th>
                                    <th style={{ padding: '16px 24px', color: '#991b1b', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', textAlign: 'center' }}>Recovery Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={7} style={{ textAlign: 'center', padding: '40px' }}>
                                            <Loader2 className="animate-spin" style={{ margin: '0 auto' }} size={32} color="#dc2626" />
                                        </td>
                                    </tr>
                                ) : deletedFilteredOverheads.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} style={{ textAlign: 'center', padding: '50px', color: '#64748b' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                                <Trash2 size={36} color="#cbd5e1" />
                                                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#475569' }}>Trash Bin is Empty</div>
                                                <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>No deleted corporate overhead entries in the 30-day recovery window.</div>
                                            </div>
                                        </td>
                                    </tr>
                                ) : deletedFilteredOverheads.map((o, idx) => {
                                    const daysRemaining = o.recovery_days_remaining !== undefined && o.recovery_days_remaining !== null
                                        ? Number(o.recovery_days_remaining)
                                        : 30;
                                    return (
                                        <tr key={`${o.transaction_id}-${idx}`} className="table-row" style={{ backgroundColor: '#fffafb' }}>
                                            <td style={{ padding: '16px 24px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div style={{
                                                        backgroundColor: '#fee2e2',
                                                        color: '#b91c1c',
                                                        padding: '8px',
                                                        borderRadius: '8px'
                                                    }}>
                                                        <Trash2 size={16} />
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>
                                                            {o.category === 'Salary'
                                                                ? `Salary to ${o.person_name || 'Staff Member'}`
                                                                : (o.person_name ? `${o.category} - ${o.person_name}` : (o.description ? o.description : `${o.category} Overhead`))}
                                                        </div>
                                                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>Transaction ID: TXN-{o.transaction_id}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ padding: '16px 24px' }}>
                                                <span style={{ 
                                                    padding: '4px 8px', 
                                                    borderRadius: '6px', 
                                                    fontSize: '0.8rem', 
                                                    fontWeight: 600, 
                                                    backgroundColor: '#fee2e2',
                                                    color: '#991b1b'
                                                }}>
                                                    {o.category || 'Expense'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '16px 24px', color: '#475569', fontSize: '0.88rem', maxWidth: '240px' }}>
                                                {o.description || '—'}
                                            </td>
                                            <td style={{ padding: '16px 24px', fontSize: '0.85rem' }}>
                                                <div style={{ fontWeight: 600, color: '#334155' }}>
                                                    {o.deleted_at ? new Date(o.deleted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : (o.transaction_date || '—')}
                                                </div>
                                                <div style={{ marginTop: '4px' }}>
                                                    <span style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        fontSize: '0.72rem',
                                                        fontWeight: 700,
                                                        padding: '2px 8px',
                                                        borderRadius: '999px',
                                                        backgroundColor: daysRemaining <= 5 ? '#fef2f2' : '#fef9c3',
                                                        color: daysRemaining <= 5 ? '#dc2626' : '#854d0e',
                                                        border: `1px solid ${daysRemaining <= 5 ? '#fca5a5' : '#fde047'}`
                                                    }}>
                                                        ⏳ {daysRemaining}d left to recover
                                                    </span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '16px 24px', fontSize: '0.85rem', color: '#475569' }}>
                                                {o.payment_mode || '—'}
                                            </td>
                                            <td style={{ padding: '16px 24px', fontWeight: 800, textAlign: 'right', color: '#991b1b', fontSize: '1rem' }}>
                                                -₹{(parseFloat(o.amount || '0') + (o.incentive ? parseFloat(o.incentive) : 0)).toLocaleString('en-IN')}
                                            </td>
                                            <td style={{ padding: '16px 24px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRestoreExpense(o)}
                                                        disabled={restoringId === o.transaction_id}
                                                        style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '5px',
                                                            padding: '6px 12px',
                                                            borderRadius: '8px',
                                                            border: '1.5px solid #86efac',
                                                            backgroundColor: '#f0fdf4',
                                                            color: '#16a34a',
                                                            fontSize: '0.78rem',
                                                            fontWeight: 700,
                                                            cursor: restoringId === o.transaction_id ? 'not-allowed' : 'pointer',
                                                            opacity: restoringId === o.transaction_id ? 0.6 : 1,
                                                            transition: 'all 0.15s ease'
                                                        }}
                                                        title="Restore this expense back to active overheads"
                                                    >
                                                        {restoringId === o.transaction_id ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />} Restore
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handlePermanentDeleteExpense(o)}
                                                        disabled={permanentDeletingId === o.transaction_id}
                                                        style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '5px',
                                                            padding: '6px 12px',
                                                            borderRadius: '8px',
                                                            border: '1.5px solid #fca5a5',
                                                            backgroundColor: '#fef2f2',
                                                            color: '#dc2626',
                                                            fontSize: '0.78rem',
                                                            fontWeight: 700,
                                                            cursor: permanentDeletingId === o.transaction_id ? 'not-allowed' : 'pointer',
                                                            opacity: permanentDeletingId === o.transaction_id ? 0.6 : 1,
                                                            transition: 'all 0.15s ease'
                                                        }}
                                                        title="Permanently remove now without waiting for 30-day auto-purge"
                                                    >
                                                        {permanentDeletingId === o.transaction_id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Purge
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="premium-card" style={{ width: '100%', maxWidth: '550px', padding: '0', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', backgroundColor: 'white' }}>
                        <div style={{ padding: '24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                                {editingTransaction ? `Edit Corporate Expense (TXN-${editingTransaction.transaction_id})` : 'Record Corporate Expense'}
                            </h3>
                            <button onClick={() => { setShowModal(false); setEditingTransaction(null); setCustomCategory(''); }} style={{ color: '#64748b', cursor: 'pointer', border: 'none', background: 'none', fontSize: '1.8rem', fontWeight: 400, padding: '0 8px', lineHeight: 1 }}>&times;</button>
                        </div>

                        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>
                                        Expense Category <span style={{ color: '#e11d48' }}>*</span>
                                    </label>
                                    <select 
                                        required
                                        value={formData.category} 
                                        onChange={(e) => {
                                            const newCat = e.target.value;
                                            const keepPerson = ['Salary', 'Staff Expense', 'Staff Reimbursement', 'Food', 'Travel', 'Recharge'].includes(newCat);
                                            setFormData({ 
                                                ...formData, 
                                                category: newCat, 
                                                person_name: keepPerson ? formData.person_name : '' 
                                            });
                                        }} 
                                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.92rem', fontWeight: 600, color: '#0f172a', backgroundColor: '#ffffff' }}
                                    >
                                        <option value="">-- Select Category --</option>
                                        <option value="Staff Expense">🟣 Staff Expense / Claims / Reimbursements (Staff Expenses Card)</option>
                                        <option value="Salary">🔵 Staff Salary / Monthly Payroll (Salaries Paid Card)</option>
                                        <option value="Rent">Office Rent</option>
                                        <option value="Utilities">Utilities & Bills</option>
                                        <option value="Office Supplies">Office Supplies</option>
                                        <option value="General Overhead">General Overhead</option>
                                        <option value="Food">Food / Refreshments</option>
                                        <option value="Travel">Travel & Conveyance</option>
                                        <option value="Recharge">Internet / Mobile Recharge</option>
                                        <option value="Other">Other</option>
                                    </select>
                                    {formData.category === 'Staff Expense' && (
                                        <div style={{ marginTop: '4px', fontSize: '0.75rem', color: '#7c3aed', fontWeight: 700 }}>
                                            ✓ Renders under <strong>STAFF EXPENSES</strong> card
                                        </div>
                                    )}
                                    {formData.category === 'Salary' && (
                                        <div style={{ marginTop: '4px', fontSize: '0.75rem', color: '#4f46e5', fontWeight: 700 }}>
                                            ✓ Renders under <strong>SALARIES PAID</strong> card
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>
                                        Amount (₹) <span style={{ color: '#e11d48' }}>*</span>
                                    </label>
                                    <input type="number" required value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} className="input-field" placeholder="e.g. 25000" />
                                </div>
                            </div>

                            {formData.category === 'Other' && (
                                <div style={{ marginBottom: '16px', backgroundColor: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1.5px solid #cbd5e1' }}>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
                                        Custom Category Name <span style={{ color: '#e11d48' }}>*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={customCategory}
                                        onChange={(e) => setCustomCategory(e.target.value)}
                                        className="input-field"
                                        placeholder="Specify custom category (e.g. Travel, Hotel, Stationery, Legal, Maintenance)"
                                        style={{ backgroundColor: '#ffffff' }}
                                    />
                                </div>
                            )}

                            {(formData.category === 'Salary' || formData.category === 'Staff Expense' || formData.category === 'Staff Reimbursement') && (
                                <div style={{ marginBottom: '16px' }}>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>
                                        Staff Member {formData.category === 'Salary' ? 'Payee' : '(Optional)'} {formData.category === 'Salary' && <span style={{ color: '#e11d48' }}>*</span>}
                                    </label>
                                    <select
                                        required={formData.category === 'Salary'}
                                        value={formData.person_name}
                                        onChange={(e) => {
                                            const name = e.target.value;
                                            setFormData({
                                                ...formData,
                                                person_name: name,
                                                description: formData.description || (name ? `${formData.category === 'Salary' ? 'Salary payment to' : 'Staff expense for'} ${name}` : '')
                                            });
                                        }}
                                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.95rem', fontWeight: 500, color: '#0f172a' }}
                                    >
                                        <option value="">-- Select Member --</option>
                                        {teamMembers.filter(t => t.status === 'active').map(m => (
                                            <option key={m.user_id} value={m.name}>
                                                {m.name} ({ROLE_LABELS[m.role] || m.role})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {formData.category === 'Salary' && (
                                <div style={{ marginBottom: '16px' }}>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Incentive Amount (₹)</label>
                                    <input
                                        type="number"
                                        value={formData.incentive}
                                        onChange={(e) => setFormData({ ...formData, incentive: e.target.value })}
                                        className="input-field"
                                        placeholder="e.g. 5000"
                                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.95rem', fontWeight: 500, color: '#0f172a' }}
                                    />
                                </div>
                            )}

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>
                                        Payment Date <span style={{ color: '#e11d48' }}>*</span>
                                    </label>
                                    <input type="date" required value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="input-field" />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>
                                        Payment Mode <span style={{ color: '#e11d48' }}>*</span>
                                    </label>
                                    <select value={formData.payment_mode} onChange={(e) => setFormData({ ...formData, payment_mode: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.95rem', fontWeight: 500, color: '#0f172a' }}>
                                        <option value="UPI">UPI</option>
                                        <option value="Cash">Cash</option>
                                        <option value="Bank Transfer">Bank Transfer</option>
                                        <option value="Cheque">Cheque</option>
                                        <option value="Reimbursement">Reimbursement</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Expense Notes / Description</label>
                                <textarea rows={2} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="input-field" placeholder="Enter bills ref, comments, or transaction notes..." />
                            </div>

                            {/* OPTIONAL RECEIPT / DOCUMENT UPLOAD */}
                            <div style={{ marginBottom: '24px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Paperclip size={16} color="#ea580c" />
                                        <span>Receipt / Bill Document <span style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 500 }}>(Optional)</span></span>
                                    </label>
                                    <span style={{
                                        fontSize: '0.72rem',
                                        fontWeight: 700,
                                        padding: '2px 8px',
                                        borderRadius: '12px',
                                        backgroundColor: '#f1f5f9',
                                        color: '#64748b',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px'
                                    }}>
                                        Optional
                                    </span>
                                </div>

                                {receiptPreview ? (
                                    <div style={{
                                        border: '1.5px solid #bbf7d0',
                                        backgroundColor: '#f0fdf4',
                                        borderRadius: '12px',
                                        padding: '12px 16px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: '12px'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                                            {receiptPreview.startsWith('data:application/pdf') || receiptFileName.toLowerCase().endsWith('.pdf') ? (
                                                <div style={{
                                                    width: '42px',
                                                    height: '42px',
                                                    borderRadius: '8px',
                                                    backgroundColor: '#fee2e2',
                                                    color: '#dc2626',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontWeight: 800,
                                                    fontSize: '0.75rem',
                                                    flexShrink: 0
                                                }}>
                                                    PDF
                                                </div>
                                            ) : (
                                                <img
                                                    src={receiptPreview}
                                                    alt="Receipt preview"
                                                    style={{
                                                        width: '42px',
                                                        height: '42px',
                                                        borderRadius: '8px',
                                                        objectFit: 'cover',
                                                        border: '1px solid #cbd5e1',
                                                        flexShrink: 0
                                                    }}
                                                />
                                            )}
                                            <div style={{ minWidth: 0, flex: 1 }}>
                                                <div style={{
                                                    fontSize: '0.86rem',
                                                    fontWeight: 700,
                                                    color: '#0f172a',
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis'
                                                }}>
                                                    {receiptFileName || 'Uploaded Document'}
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                                    <CheckCircle2 size={13} color="#16a34a" />
                                                    <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>Document attached &amp; ready</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                            <button
                                                type="button"
                                                onClick={() => setViewReceiptModalUrl(receiptPreview)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '5px',
                                                    padding: '6px 12px',
                                                    borderRadius: '7px',
                                                    border: '1px solid #cbd5e1',
                                                    backgroundColor: '#ffffff',
                                                    color: '#334155',
                                                    fontSize: '0.8rem',
                                                    fontWeight: 700,
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <Eye size={13} /> View
                                            </button>
                                            <button
                                                type="button"
                                                onClick={removeSelectedReceipt}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    padding: '6px 10px',
                                                    borderRadius: '7px',
                                                    border: '1px solid #fecaca',
                                                    backgroundColor: '#fef2f2',
                                                    color: '#dc2626',
                                                    fontSize: '0.8rem',
                                                    fontWeight: 700,
                                                    cursor: 'pointer'
                                                }}
                                                title="Remove attached document"
                                            >
                                                <X size={13} /> Remove
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <label style={{
                                        border: '2px dashed #cbd5e1',
                                        borderRadius: '12px',
                                        padding: '20px 16px',
                                        backgroundColor: '#fafaf9',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        textAlign: 'center',
                                        gap: '6px',
                                        transition: 'all 0.2s',
                                        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)'
                                    }}>
                                        <input
                                            type="file"
                                            accept="image/*,application/pdf"
                                            onChange={handleFileChange}
                                            style={{ display: 'none' }}
                                        />
                                        <div style={{
                                            width: '40px',
                                            height: '40px',
                                            borderRadius: '50%',
                                            backgroundColor: '#fff7ed',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#ea580c'
                                        }}>
                                            <UploadCloud size={22} />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}>
                                                Upload Receipt, Bill, or Proof Document <span style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 500 }}>(Optional)</span>
                                            </div>
                                            <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '2px' }}>
                                                PNG, JPG, WEBP, or PDF (Click to browse files)
                                            </div>
                                        </div>
                                    </label>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', padding: '16px 24px 0 24px', margin: '0 -24px' }}>
                                <button type="button" onClick={() => { setShowModal(false); setEditingTransaction(null); setCustomCategory(''); }} style={{ padding: '12px 24px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: 'white', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>Cancel</button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        backgroundColor: '#e11d48',
                                        border: 'none',
                                        color: 'white',
                                        padding: '12px 24px',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontWeight: 700
                                    }}
                                >
                                    {submitting && <Loader2 className="animate-spin" size={16} />}
                                    {submitting ? 'Saving...' : editingTransaction ? 'Update Expense' : 'Save Company Expense'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* BATCH AUTO ADD MONTHLY SALARIES POPUP MODAL */}
            {showAutoSalaryModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px' }}>
                    <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '850px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1.5px solid #fed7aa', boxShadow: '0 20px 40px -15px rgba(234, 88, 12, 0.3)' }}>
                        {/* Header */}
                        <div style={{ padding: '20px 24px', background: 'linear-gradient(135deg, #fca412 0%, #ea580c 100%)', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Zap size={22} color="#ffffff" /> Batch Auto Add Monthly Salaries ({selectedMonth})
                                </h3>
                                <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#ffedd5', fontWeight: 600 }}>
                                    Auto-generate salary payments for active staff members for statement month {selectedMonth}
                                </p>
                            </div>
                            <button onClick={() => setShowAutoSalaryModal(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#ffffff', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                &times;
                            </button>
                        </div>

                        {/* Controls Bar */}
                        <div style={{ padding: '14px 24px', backgroundColor: '#fff7ed', borderBottom: '1px solid #fed7aa', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#9a3412' }}>Payment Date:</label>
                                    <input
                                        type="date"
                                        value={autoSalaryDate}
                                        onChange={e => setAutoSalaryDate(e.target.value)}
                                        style={{ padding: '5px 10px', borderRadius: '8px', border: '1.5px solid #fed7aa', fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', background: '#ffffff', outline: 'none' }}
                                    />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#9a3412' }}>Payment Mode:</label>
                                    <select
                                        value={autoSalaryPaymentMode}
                                        onChange={e => setAutoSalaryPaymentMode(e.target.value)}
                                        style={{ padding: '6px 12px', borderRadius: '8px', border: '1.5px solid #fed7aa', fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', background: '#ffffff' }}
                                    >
                                        <option>Bank Transfer</option>
                                        <option>UPI / GPay</option>
                                        <option>Cash</option>
                                        <option>Cheque</option>
                                    </select>
                                </div>
                                <button
                                    type="button"
                                    onClick={copyPreviousMonthSalaries}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '6px 14px',
                                        borderRadius: '8px',
                                        border: '1.5px solid #ea580c',
                                        backgroundColor: '#ffffff',
                                        color: '#c2410c',
                                        fontWeight: 800,
                                        fontSize: '0.8rem',
                                        cursor: 'pointer',
                                        boxShadow: '0 2px 6px rgba(234,88,12,0.1)'
                                    }}
                                    title="Copy previous month base salaries & incentives for all members"
                                >
                                    <Copy size={14} /> Copy Previous Month Amounts
                                </button>
                            </div>
                            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#c2410c' }}>
                                Selected Payout: ₹{autoSalariesList.filter(i => i.selected && !i.alreadyPaid).reduce((sum, i) => sum + (i.baseSalary || 0) + (i.incentive || 0), 0).toLocaleString('en-IN')}
                            </div>
                        </div>

                        {/* Table Body */}
                        <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 800 }}>
                                        <th style={{ padding: '10px 12px', textAlign: 'center', width: '50px' }}>
                                            <input
                                                type="checkbox"
                                                onChange={e => toggleSelectAllAutoSalaries(e.target.checked)}
                                                checked={autoSalariesList.filter(i => !i.alreadyPaid).length > 0 && autoSalariesList.filter(i => !i.alreadyPaid).every(i => i.selected)}
                                            />
                                        </th>
                                        <th style={{ padding: '10px 12px', textAlign: 'left' }}>Team Member</th>
                                        <th style={{ padding: '10px 12px', textAlign: 'left' }}>Role</th>
                                        <th style={{ padding: '10px 12px', textAlign: 'right' }}>Base Salary (₹)</th>
                                        <th style={{ padding: '10px 12px', textAlign: 'right' }}>Bonus / Incentive (₹)</th>
                                        <th style={{ padding: '10px 12px', textAlign: 'right' }}>Total (₹)</th>
                                        <th style={{ padding: '10px 12px', textAlign: 'center' }}>Action / Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {autoSalariesList.map((item, idx) => {
                                        const totalAmount = (item.baseSalary || 0) + (item.incentive || 0);
                                        return (
                                            <tr key={item.user_id || idx} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: item.alreadyPaid ? '#f8fafc' : (item.selected ? '#fffdfa' : '#ffffff') }}>
                                                <td style={{ padding: '12px', textAlign: 'center' }}>
                                                    <input
                                                        type="checkbox"
                                                        disabled={item.alreadyPaid}
                                                        checked={item.selected || item.alreadyPaid}
                                                        onChange={() => toggleAutoSalaryItem(item.name)}
                                                    />
                                                </td>
                                                <td style={{ padding: '12px', fontWeight: 700, color: '#0f172a' }}>
                                                    {item.name}
                                                </td>
                                                <td style={{ padding: '12px', fontWeight: 500, color: '#64748b' }}>
                                                    {ROLE_LABELS[item.role] || item.role}
                                                </td>
                                                <td style={{ padding: '12px', textAlign: 'right' }}>
                                                    {item.alreadyPaid ? (
                                                        <span style={{ fontWeight: 700, color: '#64748b' }}>₹{(item.baseSalary || 0).toLocaleString('en-IN')}</span>
                                                    ) : (
                                                        <input
                                                            type="number"
                                                            value={item.baseSalary || ''}
                                                            onChange={e => updateAutoSalaryBase(item.name, e.target.value)}
                                                            style={{ width: '100px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', textAlign: 'right', fontWeight: 700 }}
                                                        />
                                                    )}
                                                </td>
                                                <td style={{ padding: '12px', textAlign: 'right' }}>
                                                    {item.alreadyPaid ? (
                                                        <span style={{ fontWeight: 600, color: '#64748b' }}>-</span>
                                                    ) : (
                                                        <input
                                                            type="number"
                                                            placeholder="0"
                                                            value={item.incentive || ''}
                                                            onChange={e => updateAutoSalaryIncentive(item.name, e.target.value)}
                                                            style={{ width: '90px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', textAlign: 'right', fontWeight: 600, color: '#059669' }}
                                                        />
                                                    )}
                                                </td>
                                                <td style={{ padding: '12px', textAlign: 'right', fontWeight: 800, color: item.alreadyPaid ? '#059669' : '#ea580c' }}>
                                                    ₹{totalAmount.toLocaleString('en-IN')}
                                                </td>
                                                <td style={{ padding: '12px', textAlign: 'center' }}>
                                                    {item.alreadyPaid ? (
                                                        <span style={{ backgroundColor: '#dcfce7', color: '#16a34a', padding: '3px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                            <CheckCircle2 size={12} /> Already Paid
                                                        </span>
                                                    ) : (
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                                            <button
                                                                type="button"
                                                                onClick={() => handlePostSingleSalary(item)}
                                                                style={{
                                                                    padding: '4px 10px',
                                                                    borderRadius: '6px',
                                                                    border: 'none',
                                                                    backgroundColor: '#16a34a',
                                                                    color: '#ffffff',
                                                                    fontSize: '0.75rem',
                                                                    fontWeight: 800,
                                                                    cursor: 'pointer',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '4px',
                                                                    boxShadow: '0 2px 6px rgba(22,163,74,0.2)'
                                                                }}
                                                                title="Manually record & mark salary paid for this staff member"
                                                            >
                                                                <Check size={12} /> Mark Paid
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Footer */}
                        <div style={{ padding: '16px 24px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <button
                                onClick={() => setShowAutoSalaryModal(false)}
                                style={{ padding: '9px 20px', borderRadius: '8px', border: '1.5px solid #cbd5e1', backgroundColor: '#ffffff', color: '#475569', fontWeight: 700, cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                            <button
                                disabled={isPostingAutoSalaries || autoSalariesList.filter(i => i.selected && !i.alreadyPaid).length === 0}
                                onClick={handlePostAutoSalaries}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '10px 24px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: 'linear-gradient(135deg, #fca412 0%, #ea580c 100%)',
                                    color: '#ffffff',
                                    fontWeight: 800,
                                    fontSize: '0.9rem',
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 12px rgba(234,88,12,0.25)',
                                    opacity: (isPostingAutoSalaries || autoSalariesList.filter(i => i.selected && !i.alreadyPaid).length === 0) ? 0.6 : 1
                                }}
                            >
                                {isPostingAutoSalaries ? (
                                    <>
                                        <Loader2 className="animate-spin" size={16} /> Posting Salaries...
                                    </>
                                ) : (
                                    <>
                                        <Zap size={18} /> Confirm &amp; Post {autoSalariesList.filter(i => i.selected && !i.alreadyPaid).length} Salaries
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* DOCUMENT / RECEIPT VIEWER MODAL */}
            {viewReceiptModalUrl && (
                <div 
                    style={{ 
                        position: 'fixed', 
                        top: 0, 
                        left: 0, 
                        right: 0, 
                        bottom: 0, 
                        backgroundColor: 'rgba(15, 23, 42, 0.75)', 
                        backdropFilter: 'blur(5px)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        zIndex: 999999, 
                        padding: '20px' 
                    }}
                    onClick={() => setViewReceiptModalUrl(null)}
                >
                    <div 
                        style={{ 
                            backgroundColor: '#ffffff', 
                            borderRadius: '16px', 
                            maxWidth: '900px', 
                            width: '100%', 
                            maxHeight: '92vh', 
                            display: 'flex', 
                            flexDirection: 'column', 
                            overflow: 'hidden', 
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)' 
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{ 
                            padding: '16px 20px', 
                            borderBottom: '1px solid #e2e8f0', 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            backgroundColor: '#f8fafc' 
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Receipt size={20} color="#ea580c" />
                                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>Expense Proof Document / Receipt</h3>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <a 
                                    href={viewReceiptModalUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    download="expense_receipt"
                                    style={{ 
                                        display: 'inline-flex', 
                                        alignItems: 'center', 
                                        gap: '6px', 
                                        padding: '6px 12px', 
                                        borderRadius: '8px', 
                                        backgroundColor: '#f1f5f9', 
                                        color: '#334155', 
                                        fontSize: '0.82rem', 
                                        fontWeight: 700, 
                                        textDecoration: 'none', 
                                        border: '1px solid #cbd5e1' 
                                    }}
                                >
                                    Open Original
                                </a>
                                <button 
                                    onClick={() => setViewReceiptModalUrl(null)}
                                    style={{ 
                                        background: 'transparent', 
                                        border: 'none', 
                                        fontSize: '1.5rem', 
                                        color: '#64748b', 
                                        cursor: 'pointer', 
                                        lineHeight: 1, 
                                        padding: '0 4px' 
                                    }}
                                >
                                    &times;
                                </button>
                            </div>
                        </div>

                        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a', minHeight: '300px' }}>
                            {viewReceiptModalUrl.startsWith('data:application/pdf') || viewReceiptModalUrl.toLowerCase().includes('.pdf') ? (
                                <iframe 
                                    src={viewReceiptModalUrl} 
                                    style={{ width: '100%', height: '70vh', border: 'none', borderRadius: '8px', backgroundColor: '#ffffff' }} 
                                    title="PDF Document" 
                                />
                            ) : (
                                <img 
                                    src={viewReceiptModalUrl} 
                                    alt="Expense Receipt" 
                                    style={{ maxWidth: '100%', maxHeight: '72vh', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.3)' }} 
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
