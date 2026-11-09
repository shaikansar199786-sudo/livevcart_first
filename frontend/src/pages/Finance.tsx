import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useAuth } from '../hooks/useAuth';
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    Plus,
    Loader2,
    ArrowUpRight,
    ArrowDownLeft,
    Calendar,
    Briefcase,
    FileText,
    Percent,
    Search,
    RotateCcw,
    X,
    Eye,
    Upload,
    Landmark,
    Receipt,
    IndianRupee,
    Download,
    FileSpreadsheet,
    CheckCircle2,
    AlertCircle,
    Edit2,
    Trash2
} from 'lucide-react';
// @ts-ignore
import html2pdf from 'html2pdf.js';

interface Transaction {
    transaction_id: string;
    project_id?: string;
    client_id?: string;
    project_name: string;
    project_type?: string;
    type: 'credit' | 'debit';
    amount: string;
    category: string;
    description: string;
    transaction_date: string;
    recorded_by: string;
    payment_mode?: string;
    receipt_image?: string;
    image?: string;
    is_deleted?: number | boolean | string;
    deleted_at?: string;
    deleted_by?: string;
    days_since_delete?: number;
    recovery_days_remaining?: number;
}

interface Project {
    project_id: string;
    client_id?: string;
    project_name: string;
    project_type?: string;
    total_budget: string;
}

interface ParsedImportRow {
    project_id?: string;
    project_name?: string;
    type: 'credit' | 'debit';
    amount: string;
    category: string;
    payment_mode: string;
    date: string;
    description: string;
    valid: boolean;
    error?: string;
}

export const Finance: React.FC = () => {
    const { user } = useAuth();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [historyTab, setHistoryTab] = useState<'received' | 'spent' | 'deleted'>('received');
    const [dateFilter, setDateFilter] = useState<'all' | 'last_month' | 'last_3_months' | 'last_6_months' | 'this_year' | 'custom'>('all');
    const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [projectTypeFilter, setProjectTypeFilter] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');

    // Proof preview and upload states
    const [viewProofUrl, setViewProofUrl] = useState<string | null>(null);
    const [receiptPreview, setReceiptPreview] = useState<string>('');
    const [uploadingTxnId, setUploadingTxnId] = useState<string | null>(null);

    // Edit and Delete states
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [deletingTxnId, setDeletingTxnId] = useState<string | null>(null);
    const [restoringTxnId, setRestoringTxnId] = useState<string | null>(null);
    const [permanentDeletingTxnId, setPermanentDeletingTxnId] = useState<string | null>(null);

    // PDF generation states
    const [generatingPdf, setGeneratingPdf] = useState(false);
    const [generatingProjectPdf, setGeneratingProjectPdf] = useState(false);

    // CSV Import Modal states
    const [showImportModal, setShowImportModal] = useState(false);
    const [importTarget, setImportTarget] = useState<'received' | 'spent' | 'all'>('all');
    const [importFile, setImportFile] = useState<File | null>(null);
    const [parsedImportRows, setParsedImportRows] = useState<ParsedImportRow[]>([]);
    const [isImporting, setIsImporting] = useState(false);
    const [importError, setImportError] = useState<string | null>(null);

    const resetFilters = () => {
        setDateFilter('all');
        setSelectedYear(new Date().getFullYear());
        setCustomStartDate('');
        setCustomEndDate('');
        setProjectTypeFilter('all');
        setSearchTerm('');
    };

    const formatTransactionNo = (id: string | number, date?: string) => {
        let yr = '26';
        if (date) {
            const d = new Date(date);
            if (!isNaN(d.getTime())) {
                yr = String(d.getFullYear()).slice(-2);
            }
        }
        const cleanId = String(id).replace(/\D/g, '') || String(id);
        const padded = cleanId.padStart(5, '0');
        return `LC-TXN-${yr}-${padded}`;
    };

    const compressOrReadFile = (file: File, callback: (base64: string) => void) => {
        const reader = new FileReader();
        if (file.type.startsWith('image/')) {
            reader.onload = (e) => {
                const img = new Image();
                img.src = e.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    const MAX_WIDTH = 1200;
                    const MAX_HEIGHT = 1200;
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
                        callback(canvas.toDataURL('image/jpeg', 0.7));
                    } else {
                        callback(reader.result as string);
                    }
                };
            };
            reader.readAsDataURL(file);
        } else {
            reader.onload = () => {
                callback(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleUploadProofForRow = async (transaction_id: string, file: File) => {
        setUploadingTxnId(transaction_id);
        compressOrReadFile(file, async (base64) => {
            try {
                await axios.put(`${API_BASE_URL}/finance`, {
                    transaction_id,
                    receipt_image: base64
                });
                setTransactions(prev => prev.map(t => t.transaction_id === transaction_id ? { ...t, receipt_image: base64 } : t));
            } catch (err) {
                console.error('Error updating proof:', err);
                alert('Failed to upload transaction proof.');
            } finally {
                setUploadingTxnId(null);
            }
        });
    };

    // CSV Helper Utilities
    const escapeCsvCell = (val: any) => {
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
    };

    const exportToCSV = (filename: string, headers: string[], rows: (string | number)[][]) => {
        const csvRows = [
            headers.map(escapeCsvCell).join(','),
            ...rows.map(row => row.map(escapeCsvCell).join(','))
        ];
        const csvString = '\uFEFF' + csvRows.join('\r\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const parseCSV = (text: string) => {
        const lines: string[][] = [];
        let currentLine: string[] = [];
        let currentCell = '';
        let insideQuotes = false;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const nextChar = text[i + 1];

            if (char === '"') {
                if (insideQuotes && nextChar === '"') {
                    currentCell += '"';
                    i++;
                } else {
                    insideQuotes = !insideQuotes;
                }
            } else if (char === ',' && !insideQuotes) {
                currentLine.push(currentCell.trim());
                currentCell = '';
            } else if ((char === '\r' || char === '\n') && !insideQuotes) {
                if (char === '\r' && nextChar === '\n') i++;
                currentLine.push(currentCell.trim());
                if (currentLine.some(c => c !== '')) {
                    lines.push(currentLine);
                }
                currentLine = [];
                currentCell = '';
            } else {
                currentCell += char;
            }
        }
        if (currentCell || currentLine.length > 0) {
            currentLine.push(currentCell.trim());
            if (currentLine.some(c => c !== '')) {
                lines.push(currentLine);
            }
        }
        return lines;
    };

    // Export Handlers
    const handleExportTransactionsCSV = () => {
        const list = filteredTransactions.filter(t => historyTab === 'received' ? t.type === 'credit' : t.type === 'debit');
        const headers = [
            'Transaction No',
            'Transaction Description',
            'Project ID',
            'Project Name',
            'Project Type',
            'Transaction Date',
            'Category',
            'Payment Mode',
            'Type',
            'Amount (INR)'
        ];
        const rows = list.map(t => [
            formatTransactionNo(t.transaction_id, t.transaction_date),
            t.description || (t.type === 'credit' ? 'Client Payment' : 'Site Expense'),
            t.client_id || '-',
            t.project_name || 'General Company Income',
            t.project_type || '-',
            t.transaction_date,
            t.category,
            t.payment_mode || 'Cash',
            t.type === 'credit' ? 'Inflow (Credit)' : 'Outflow (Debit)',
            parseFloat(t.amount || '0')
        ]);
        exportToCSV(`Finance_${historyTab === 'received' ? 'Received_Payments' : 'Spent_Payments'}`, headers, rows);
    };

    const handleExportProjectCashFlowCSV = () => {
        const headers = [
            'Project ID',
            'Project Name',
            'Project Type',
            'Cash Inflow (INR)',
            'Cash Outflow (INR)',
            'Net Margin (INR)'
        ];
        const rows = projectFinancials.map(p => {
            const project = projects.find(proj => proj.project_name === p.project_name);
            return [
                project?.client_id || '-',
                p.project_name,
                project?.project_type || '-',
                p.cashIn,
                p.cashOut,
                p.remaining
            ];
        });
        exportToCSV('Project_Wise_Cash_Flow_Summary', headers, rows);
    };

    const handleExportTransactionsPDF = async () => {
        try {
            setGeneratingPdf(true);
            const elem = document.getElementById('printable-transactions-report');
            if (!elem) {
                alert('Printable report container not found.');
                return;
            }
            const opt = {
                margin: [8, 8, 8, 8],
                filename: `Finance_${historyTab === 'received' ? 'Received_Payments' : 'Spent_Payments'}_${new Date().toISOString().split('T')[0]}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, logging: false },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
            };
            // @ts-ignore
            await html2pdf().set(opt).from(elem).save();
        } catch (err) {
            console.error('PDF export failed:', err);
            window.print();
        } finally {
            setGeneratingPdf(false);
        }
    };

    const handleExportProjectCashFlowPDF = async () => {
        try {
            setGeneratingProjectPdf(true);
            const elem = document.getElementById('printable-project-cashflow-report');
            if (!elem) {
                alert('Printable report container not found.');
                return;
            }
            const opt = {
                margin: [8, 8, 8, 8],
                filename: `Project_Wise_Cash_Flow_${new Date().toISOString().split('T')[0]}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, logging: false },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
            };
            // @ts-ignore
            await html2pdf().set(opt).from(elem).save();
        } catch (err) {
            console.error('PDF export failed:', err);
            window.print();
        } finally {
            setGeneratingProjectPdf(false);
        }
    };

    // Import Handlers
    const handleDownloadTemplate = () => {
        const headers = ['Project Name or ID', 'Type (Inflow or Outflow)', 'Amount', 'Category', 'Payment Mode', 'Date (YYYY-MM-DD)', 'Description'];
        const sampleRows = [
            ['General Company', 'Inflow', 50000, 'advance', 'Bank Transfer', new Date().toISOString().split('T')[0], 'Client Advance Booking'],
            ['General Site', 'Outflow', 12500, 'Material', 'UPI', new Date().toISOString().split('T')[0], 'Site hardware and materials']
        ];
        exportToCSV('Finance_Transactions_Template', headers, sampleRows);
    };

    const handleProcessImportFile = (file: File) => {
        setImportError(null);
        setImportFile(file);
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                const parsed = parseCSV(text);
                if (parsed.length < 2) {
                    setImportError('CSV file is empty or missing data rows.');
                    setParsedImportRows([]);
                    return;
                }

                const rawHeaders = parsed[0].map(h => h.toLowerCase().trim());
                
                // Find column indices
                const projectIdx = rawHeaders.findIndex(h => h.includes('project'));
                const typeIdx = rawHeaders.findIndex(h => h.includes('type'));
                const amountIdx = rawHeaders.findIndex(h => h.includes('amount'));
                const categoryIdx = rawHeaders.findIndex(h => h.includes('category'));
                const modeIdx = rawHeaders.findIndex(h => h.includes('mode') || h.includes('payment'));
                const dateIdx = rawHeaders.findIndex(h => h.includes('date'));
                const descIdx = rawHeaders.findIndex(h => h.includes('desc') || h.includes('note'));

                if (amountIdx === -1) {
                    setImportError('Could not find required column: Amount. Please check template format.');
                    setParsedImportRows([]);
                    return;
                }

                const rows: ParsedImportRow[] = [];
                for (let i = 1; i < parsed.length; i++) {
                    const row = parsed[i];
                    if (row.length === 0 || (row.length === 1 && !row[0])) continue;

                    const rawProj = projectIdx !== -1 ? row[projectIdx] : '';
                    const rawType = typeIdx !== -1 && row[typeIdx] ? row[typeIdx].toLowerCase() : (importTarget === 'spent' ? 'debit' : 'credit');
                    const rawAmount = row[amountIdx]?.replace(/[₹,]/g, '').trim() || '0';
                    const rawCategory = categoryIdx !== -1 && row[categoryIdx] ? row[categoryIdx] : (rawType.includes('in') || rawType.includes('credit') ? 'advance' : 'Other');
                    const rawMode = modeIdx !== -1 && row[modeIdx] ? row[modeIdx] : 'Bank Transfer';
                    const rawDate = dateIdx !== -1 && row[dateIdx] ? row[dateIdx] : new Date().toISOString().split('T')[0];
                    const rawDesc = descIdx !== -1 ? row[descIdx] : '';

                    const numAmount = parseFloat(rawAmount);
                    const isTypeInflow = rawType.includes('in') || rawType.includes('credit') || rawType.includes('rec');
                    const normalizedType = isTypeInflow ? 'credit' : 'debit';

                    // Match project
                    let matchedProject = projects.find(p => 
                        (p.project_name && rawProj && p.project_name.toLowerCase().trim() === rawProj.toLowerCase().trim()) ||
                        (p.client_id && rawProj && p.client_id.toLowerCase().trim() === rawProj.toLowerCase().trim()) ||
                        (p.project_id && rawProj && p.project_id.toLowerCase().trim() === rawProj.toLowerCase().trim())
                    );

                    const valid = !isNaN(numAmount) && numAmount > 0;
                    const error = !valid ? 'Invalid or zero amount' : undefined;

                    rows.push({
                        project_id: matchedProject ? matchedProject.project_id : '',
                        project_name: matchedProject ? matchedProject.project_name : (rawProj || 'General Company Income'),
                        type: normalizedType,
                        amount: String(numAmount || 0),
                        category: rawCategory,
                        payment_mode: rawMode,
                        date: rawDate,
                        description: rawDesc,
                        valid,
                        error
                    });
                }

                if (rows.length === 0) {
                    setImportError('No data rows found in CSV file.');
                }
                setParsedImportRows(rows);
            } catch (err: any) {
                setImportError(`Failed to parse CSV file: ${err.message || err}`);
            }
        };
        reader.readAsText(file);
    };

    const handleConfirmImport = async () => {
        const validRows = parsedImportRows.filter(r => r.valid);
        if (validRows.length === 0) {
            alert('No valid rows to import.');
            return;
        }

        setIsImporting(true);
        let successCount = 0;
        let failCount = 0;

        for (const r of validRows) {
            try {
                await axios.post(`${API_BASE_URL}/finance`, {
                    project_id: r.project_id || '',
                    type: r.type,
                    amount: r.amount,
                    category: r.category,
                    payment_mode: r.payment_mode,
                    date: r.date,
                    description: r.description,
                    recorded_by: user?.user_id || ''
                });
                successCount++;
            } catch (err) {
                failCount++;
            }
        }

        setIsImporting(false);
        setShowImportModal(false);
        setParsedImportRows([]);
        setImportFile(null);
        await fetchData();

        if (failCount > 0) {
            alert(`Import completed: ${successCount} transactions imported successfully, ${failCount} failed.`);
        } else {
            alert(`Successfully imported all ${successCount} transactions!`);
        }
    };

    const [formData, setFormData] = useState({
        project_id: '',
        type: 'debit',
        category: 'Transport',
        amount: '',
        description: '',
        payment_mode: 'Cash',
        date: new Date().toISOString().split('T')[0],
        recorded_by: user?.user_id || '',
        receipt_image: ''
    });

    const [isCustomCategory, setIsCustomCategory] = useState(false);
    const [customCategoryInput, setCustomCategoryInput] = useState('');

    const standardCategories = useMemo(() => [
        'advance', 'mid_payment', 'final_payment', 'additional_works',
        'labor', 'material', 'transport', 'site costs', 'equipment', 'other'
    ], []);

    const existingCustomCategories = useMemo(() => {
        const set = new Set<string>();
        transactions.forEach(t => {
            if (t.category) {
                const trimmed = t.category.trim();
                if (trimmed && !standardCategories.includes(trimmed.toLowerCase())) {
                    set.add(trimmed);
                }
            }
        });
        return Array.from(set);
    }, [transactions, standardCategories]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [transRes, projRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/finance?include_deleted=1`),
                axios.get(`${API_BASE_URL}/projects`)
            ]);
            setTransactions(transRes.data.data || []);
            setProjects(projRes.data.data || []);
        } catch (err) {
            console.error('Failed to fetch finance data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenEditModal = (t: Transaction) => {
        setEditingTransaction(t);
        const catClean = (t.category || '').trim();
        const isCustom = catClean !== '' && !standardCategories.includes(catClean.toLowerCase());
        setIsCustomCategory(isCustom);
        setCustomCategoryInput(isCustom ? catClean : '');

        setFormData({
            project_id: t.project_id || '',
            type: t.type,
            category: t.category || (t.type === 'credit' ? 'advance' : 'Transport'),
            amount: t.amount || '',
            description: t.description || '',
            payment_mode: t.payment_mode || 'Cash',
            date: t.transaction_date ? t.transaction_date.split(' ')[0] : new Date().toISOString().split('T')[0],
            recorded_by: user?.user_id || '',
            receipt_image: t.receipt_image || t.image || ''
        });
        setReceiptPreview(t.receipt_image || t.image || '');
        setShowModal(true);
    };

    const handleDeleteTransaction = async (t: Transaction) => {
        const desc = t.description || (t.type === 'credit' ? 'Client Payment' : 'Site Expense');
        const amt = parseFloat(t.amount || '0').toLocaleString('en-IN');
        const confirmDelete = window.confirm(
            `Move transaction to Deleted Entries?\n\n• Transaction No: ${formatTransactionNo(t.transaction_id, t.transaction_date)}\n• Description: ${desc}\n• Amount: ₹${amt}\n\nThis entry will be moved to the Deleted Entries section and remain recoverable for 30 days before permanent deletion.`
        );

        if (!confirmDelete) return;

        setDeletingTxnId(t.transaction_id);
        try {
            const res = await axios.post(`${API_BASE_URL}/finance/delete`, { 
                transaction_id: t.transaction_id,
                deleted_by: user?.name || user?.username || user?.user_id || 'User'
            });
            if (res.data.success) {
                alert('✓ Transaction moved to Deleted Entries. You can recover it within 30 days.');
                fetchData();
            } else {
                alert(res.data.message || 'Failed to delete transaction.');
            }
        } catch (err: any) {
            alert('Failed to delete transaction. Please try again.');
        } finally {
            setDeletingTxnId(null);
        }
    };

    const handleRestoreTransaction = async (t: Transaction) => {
        const desc = t.description || (t.type === 'credit' ? 'Client Payment' : 'Site Expense');
        const amt = parseFloat(t.amount || '0').toLocaleString('en-IN');
        if (!window.confirm(`Restore this transaction back to active accounts?\n\n• Transaction No: ${formatTransactionNo(t.transaction_id, t.transaction_date)}\n• Description: ${desc}\n• Amount: ₹${amt}`)) {
            return;
        }

        setRestoringTxnId(t.transaction_id);
        try {
            const res = await axios.post(`${API_BASE_URL}/finance/restore`, { transaction_id: t.transaction_id });
            if (res.data.success) {
                alert('✓ Transaction restored successfully.');
                fetchData();
            } else {
                alert(res.data.message || 'Failed to restore transaction.');
            }
        } catch (err: any) {
            alert('Failed to restore transaction.');
        } finally {
            setRestoringTxnId(null);
        }
    };

    const handlePermanentDeleteTransaction = async (t: Transaction) => {
        const desc = t.description || (t.type === 'credit' ? 'Client Payment' : 'Site Expense');
        const amt = parseFloat(t.amount || '0').toLocaleString('en-IN');
        if (!window.confirm(`⚠️ PERMANENT DELETE WARNING:\n\nAre you sure you want to permanently delete this transaction?\n\n• Transaction No: ${formatTransactionNo(t.transaction_id, t.transaction_date)}\n• Description: ${desc}\n• Amount: ₹${amt}\n\nThis will purge it from the database forever and CANNOT be undone!`)) {
            return;
        }

        setPermanentDeletingTxnId(t.transaction_id);
        try {
            const res = await axios.post(`${API_BASE_URL}/finance/permanent-delete`, { transaction_id: t.transaction_id });
            if (res.data.success) {
                alert('✓ Transaction permanently deleted from database.');
                fetchData();
            } else {
                alert(res.data.message || 'Failed to permanently delete transaction.');
            }
        } catch (err: any) {
            alert('Failed to permanently delete transaction.');
        } finally {
            setPermanentDeletingTxnId(null);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const finalCategory = isCustomCategory ? customCategoryInput.trim() : formData.category;
        if (!finalCategory) {
            alert('Please select or enter a category');
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                ...formData,
                category: finalCategory,
                receipt_image: formData.receipt_image || receiptPreview || ''
            };

            let response;
            if (editingTransaction) {
                response = await axios.post(`${API_BASE_URL}/finance/update`, {
                    transaction_id: editingTransaction.transaction_id,
                    ...payload,
                    transaction_date: payload.date
                });
            } else {
                response = await axios.post(`${API_BASE_URL}/finance`, payload);
            }

            if (response.data.success) {
                setShowModal(false);
                setEditingTransaction(null);
                setReceiptPreview('');
                setIsCustomCategory(false);
                setCustomCategoryInput('');
                setFormData({
                    project_id: '',
                    type: 'debit',
                    category: 'Transport',
                    amount: '',
                    description: '',
                    payment_mode: 'Cash',
                    date: new Date().toISOString().split('T')[0],
                    recorded_by: user?.user_id || '',
                    receipt_image: ''
                });
                fetchData();
                alert(editingTransaction ? 'Transaction updated successfully!' : 'Transaction recorded successfully!');
            } else {
                alert(response.data.message || (editingTransaction ? 'Error updating transaction' : 'Error recording transaction'));
            }
        } catch (err) {
            alert(editingTransaction ? 'Error updating transaction' : 'Error recording transaction');
        } finally {
            setSubmitting(false);
        }
    };

    const getMonthOptions = () => {
        const options = [];
        const today = new Date();
        // Generate last 24 months statically so each and every month is selectable
        for (let i = 0; i < 24; i++) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            options.push(`${yyyy}-${mm}`);
        }
        return options;
    };

    // Active vs Deleted separation
    const isTxDeleted = (t: Transaction) => t.is_deleted === 1 || t.is_deleted === '1' || t.is_deleted === true;

    const activeFilteredTransactions = transactions.filter(t => !isTxDeleted(t)).filter(t => {
        const matchesProjectType = projectTypeFilter === 'all' || (t.project_type || '').toLowerCase() === projectTypeFilter.toLowerCase();
        const matchesSearch = !searchTerm || 
            (t.project_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (t.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (t.category || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            formatTransactionNo(t.transaction_id, t.transaction_date).toLowerCase().includes(searchTerm.toLowerCase());
        
        if (!matchesProjectType || !matchesSearch) return false;
        if (dateFilter === 'all') return true;
        
        const transactionDate = t.transaction_date ? new Date(t.transaction_date) : null;
        if (!transactionDate) return false;
        
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        if (dateFilter === 'last_month') {
            const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
            return transactionDate >= lastMonthStart && transactionDate <= lastMonthEnd;
        } else if (dateFilter === 'last_3_months') {
            const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
            return transactionDate >= threeMonthsAgo && transactionDate <= today;
        } else if (dateFilter === 'last_6_months') {
            const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
            return transactionDate >= sixMonthsAgo && transactionDate <= today;
        } else if (dateFilter === 'this_year') {
            const yearStart = new Date(selectedYear, 0, 1);
            const yearEnd = new Date(selectedYear, 11, 31, 23, 59, 59);
            return transactionDate >= yearStart && transactionDate <= yearEnd;
        } else if (dateFilter === 'custom') {
            if (customStartDate && customEndDate) {
                const startDate = new Date(customStartDate);
                const endDate = new Date(customEndDate);
                return transactionDate >= startDate && transactionDate <= endDate;
            }
            return false;
        }
        
        return true;
    });

    const deletedFilteredTransactions = transactions.filter(t => isTxDeleted(t)).filter(t => {
        if (!searchTerm) return true;
        return (t.project_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (t.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (t.category || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            formatTransactionNo(t.transaction_id, t.transaction_date).toLowerCase().includes(searchTerm.toLowerCase());
    });

    const filteredTransactions = activeFilteredTransactions;

    const totalCredit = activeFilteredTransactions
        .filter(t => t.type === 'credit')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const totalDebit = activeFilteredTransactions
        .filter(t => t.type === 'debit' && t.payment_mode !== 'Unpaid')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    // Calculate per-project cash in/out
    const projectFinancials = projects.map((project: any) => {
        const projectTransactions = filteredTransactions.filter(t => t.project_name === project.project_name);
        const cashIn = projectTransactions.filter(t => t.type === 'credit').reduce((sum, t) => sum + parseFloat(t.amount), 0);
        const cashOut = projectTransactions.filter(t => t.type === 'debit' && t.payment_mode !== 'Unpaid').reduce((sum, t) => sum + parseFloat(t.amount), 0);
        const remaining = cashIn - cashOut;
        return {
            project_name: project.project_name,
            cashIn,
            cashOut,
            remaining
        };
    }).filter(p => p.cashIn > 0 || p.cashOut > 0);

    const activeMonthLabel = () => {
        if (dateFilter === 'all') return 'All Time Summary';
        if (dateFilter === 'last_month') return 'Last Month';
        if (dateFilter === 'last_3_months') return 'Last 3 Months';
        if (dateFilter === 'last_6_months') return 'Last 6 Months';
        if (dateFilter === 'this_year') return `Year ${selectedYear}`;
        if (dateFilter === 'custom') {
            if (customStartDate && customEndDate) return `${customStartDate} to ${customEndDate}`;
            if (customStartDate) return `From ${customStartDate}`;
            if (customEndDate) return `Until ${customEndDate}`;
            return 'Custom Date Range';
        }
        return 'All Time Summary';
    };

    const uniqueProjectTypes = Array.from(new Set(projects.map(p => p.project_type).filter(Boolean)));

    return (
        <div style={{ width: '100%', padding: '0 0 24px 0' }}>
            {/* Styles for premium animations & aesthetics */}
            <style>{`
                .finance-card {
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 16px;
                    padding: 24px;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.02);
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                }
                .finance-card:hover {
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
                    background-color: #253b50;
                    color: white;
                    padding: 12px 24px;
                    border-radius: 12px;
                    border: none;
                    font-weight: 700;
                    font-size: 0.95rem;
                    cursor: pointer;
                    box-shadow: 0 4px 10px rgba(37, 59, 80, 0.2);
                    transition: all 0.2s ease;
                }
                .action-btn:hover {
                    background-color: #1e3041;
                    box-shadow: 0 6px 14px rgba(37, 59, 80, 0.3);
                    transform: translateY(-1px);
                }
                .table-row {
                    border-bottom: 1px solid #f1f5f9;
                    transition: background-color 0.2s ease;
                }
                .table-row:hover {
                    background-color: #f8fafc;
                }
            `}</style>

            {/* Header Block */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0c1527', margin: 0 }}>Finance &amp; Accounts</h2>
                    <p style={{ color: '#64748b', marginTop: '4px' }}>Analyze statements, record advance payments, and log site expenses monthly.</p>
                </div>
                <button
                    onClick={() => {
                        setEditingTransaction(null);
                        setIsCustomCategory(false);
                        setCustomCategoryInput('');
                        setFormData({
                            project_id: '',
                            type: 'debit',
                            category: 'Transport',
                            amount: '',
                            description: '',
                            payment_mode: 'Cash',
                            date: new Date().toISOString().split('T')[0],
                            recorded_by: user?.user_id || '',
                            receipt_image: ''
                        });
                        setReceiptPreview('');
                        setShowModal(true);
                    }}
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
                    <Plus size={18} /> Record Transaction
                </button>
            </div>

            {/* Filter & Controller Bar */}
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
                            Custom Date
                        </button>

                        {/* Custom Date Inputs (Visible only when dateFilter is 'custom') */}
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
                            { key: 'Furniture projects', label: 'Furniture projects' },
                            { key: 'Interior Projects', label: 'Interior Projects' }
                        ].map(typeItem => {
                            const isTypeSelected = projectTypeFilter === typeItem.key;
                            return (
                                <button
                                    key={typeItem.key}
                                    onClick={() => setProjectTypeFilter(typeItem.key)}
                                    style={{
                                        padding: '7px 14px',
                                        borderRadius: '8px',
                                        border: '1.5px solid',
                                        borderColor: isTypeSelected ? '#fca412' : '#ffe8c2',
                                        backgroundColor: isTypeSelected ? '#fca412' : '#ffffff',
                                        color: isTypeSelected ? '#ffffff' : '#0c1527',
                                        fontWeight: isTypeSelected ? 800 : 600,
                                        fontSize: '0.82rem',
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
                </div>

                {/* Search Input & Reset Button */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ position: 'relative', width: '240px' }}>
                        <Search size={18} color="#9ca3af" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search project by name..."
                            style={{ width: '100%', padding: '9px 12px 9px 38px', borderRadius: '8px', border: '1.5px solid #ffe8c2', outline: 'none', fontSize: '0.88rem', color: '#0c1527', fontWeight: 600 }}
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    {(dateFilter !== 'all' || projectTypeFilter !== 'all' || searchTerm !== '' || customStartDate !== '' || customEndDate !== '') && (
                        <button
                            onClick={resetFilters}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', border: '1.5px solid #ef4444', backgroundColor: '#fef2f2', color: '#ef4444', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer', boxShadow: '0 2px 6px rgba(239, 68, 68, 0.15)', whiteSpace: 'nowrap' }}
                        >
                            <RotateCcw size={14} /> Reset Filters
                        </button>
                    )}
                </div>
            </div>

            {/* Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '35px' }}>
                {/* Cash Inflow */}
                <div className="finance-card" style={{ borderTop: '4px solid #10b981' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <p style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase' }}>CASH INFLOW</p>
                            <h4 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#059669' }}>₹{totalCredit.toLocaleString('en-IN')}</h4>
                        </div>
                        <div style={{ backgroundColor: '#ecfdf5', color: '#10b981', padding: '12px', borderRadius: '12px' }}>
                            <TrendingUp size={24} />
                        </div>
                    </div>
                    <div style={{ marginTop: '14px', fontSize: '0.75rem', color: '#64748b' }}>
                        Total client bookings & advances for this period.
                    </div>
                </div>

                {/* Cash Outflow */}
                <div className="finance-card" style={{ borderTop: '4px solid #f43f5e' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <p style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase' }}>CASH OUTFLOW</p>
                            <h4 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#e11d48' }}>₹{totalDebit.toLocaleString('en-IN')}</h4>
                        </div>
                        <div style={{ backgroundColor: '#fff1f2', color: '#f43f5e', padding: '12px', borderRadius: '12px' }}>
                            <TrendingDown size={24} />
                        </div>
                    </div>
                    <div style={{ marginTop: '14px', fontSize: '0.75rem', color: '#64748b' }}>
                        Total site materials, logistics, & labor costs.
                    </div>
                </div>

                {/* Bank Balance */}
                <div className="finance-card" style={{ borderTop: '4px solid #253b50', backgroundColor: '#f8fafc' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <p style={{ color: '#253b50', fontSize: '0.85rem', fontWeight: 800, marginBottom: '6px', textTransform: 'uppercase' }}>BANK BALANCE</p>
                            <h4 style={{ fontSize: '1.8rem', fontWeight: 900, color: (totalCredit - totalDebit) >= 0 ? '#0f172a' : '#e11d48' }}>
                                ₹{(totalCredit - totalDebit).toLocaleString('en-IN')}
                            </h4>
                        </div>
                        <div style={{ backgroundColor: '#e2e8f0', color: '#253b50', padding: '12px', borderRadius: '12px' }}>
                            <Landmark size={24} />
                        </div>
                    </div>
                    <div style={{ marginTop: '14px', fontSize: '0.75rem', color: '#64748b' }}>
                        Net available bank balance (Inflow − Outflow).
                    </div>
                </div>
            </div>

            {/* Main Tabs and Table Section */}
            <div className="premium-card" style={{ border: '1px solid #e2e8f0', padding: '0px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', gap: '8px', backgroundColor: '#e2e8f0', padding: '4px', borderRadius: '10px' }}>
                        <button
                            className="tab-btn"
                            onClick={() => setHistoryTab('received')}
                            style={{
                                backgroundColor: historyTab === 'received' ? 'white' : 'transparent',
                                color: historyTab === 'received' ? '#059669' : '#475569',
                                boxShadow: historyTab === 'received' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                            }}
                        >
                            Total Received payments
                        </button>
                        <button
                            className="tab-btn"
                            onClick={() => setHistoryTab('spent')}
                            style={{
                                backgroundColor: historyTab === 'spent' ? 'white' : 'transparent',
                                color: historyTab === 'spent' ? '#e11d48' : '#475569',
                                boxShadow: historyTab === 'spent' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                            }}
                        >
                            Total spent payments
                        </button>
                        <button
                            className="tab-btn"
                            onClick={() => setHistoryTab('deleted')}
                            style={{
                                backgroundColor: historyTab === 'deleted' ? '#fee2e2' : 'transparent',
                                color: historyTab === 'deleted' ? '#b91c1c' : '#dc2626',
                                boxShadow: historyTab === 'deleted' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <Trash2 size={13} color="#dc2626" />
                            <span>Deleted Entries (30-Day Recovery)</span>
                            {deletedFilteredTransactions.length > 0 && (
                                <span style={{
                                    backgroundColor: '#dc2626',
                                    color: '#ffffff',
                                    fontSize: '0.68rem',
                                    fontWeight: 900,
                                    borderRadius: '10px',
                                    padding: '1px 6px',
                                    lineHeight: 1.2
                                }}>
                                    {deletedFilteredTransactions.length}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* Action buttons for Transactions List */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        {historyTab === 'deleted' && (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', padding: '6px 12px', borderRadius: '8px', fontSize: '0.78rem', color: '#b91c1c', fontWeight: 700 }}>
                                <span>⏳ Deleted entries remain recoverable for 30 days before permanent auto-purge.</span>
                            </div>
                        )}
                        <button
                            onClick={() => {
                                setImportTarget(historyTab === 'deleted' ? 'all' : historyTab);
                                setShowImportModal(true);
                            }}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '8px 14px',
                                borderRadius: '8px',
                                border: '1.5px solid #cbd5e1',
                                backgroundColor: '#ffffff',
                                color: '#1e293b',
                                fontSize: '0.82rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                            }}
                            title="Import Transactions via CSV"
                        >
                            <Upload size={14} color="#0284c7" /> Import CSV
                        </button>

                        <button
                            onClick={handleExportTransactionsCSV}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '8px 14px',
                                borderRadius: '8px',
                                border: '1.5px solid #cbd5e1',
                                backgroundColor: '#ffffff',
                                color: '#1e293b',
                                fontSize: '0.82rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                            }}
                            title="Export Transactions to CSV / Excel"
                        >
                            <Download size={14} color="#16a34a" /> Export CSV
                        </button>

                        <button
                            onClick={handleExportTransactionsPDF}
                            disabled={generatingPdf}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '8px 14px',
                                borderRadius: '8px',
                                border: '1.5px solid #cbd5e1',
                                backgroundColor: '#ffffff',
                                color: '#1e293b',
                                fontSize: '0.82rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                            }}
                            title="Export Transactions Statement to PDF"
                        >
                            {generatingPdf ? <Loader2 className="animate-spin" size={14} /> : <FileText size={14} color="#ea580c" />} Export PDF
                        </button>
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                                <th style={{ padding: '16px 20px', color: '#475569', fontWeight: 750, fontSize: '0.8rem', textTransform: 'uppercase' }}>Transaction No</th>
                                <th style={{ padding: '16px 20px', color: '#475569', fontWeight: 750, fontSize: '0.8rem', textTransform: 'uppercase' }}>Transaction Description</th>
                                <th style={{ padding: '16px 20px', color: '#475569', fontWeight: 750, fontSize: '0.8rem', textTransform: 'uppercase' }}>Project ID</th>
                                <th style={{ padding: '16px 20px', color: '#475569', fontWeight: 750, fontSize: '0.8rem', textTransform: 'uppercase' }}>Project</th>
                                <th style={{ padding: '16px 20px', color: '#475569', fontWeight: 750, fontSize: '0.8rem', textTransform: 'uppercase' }}>Project Type</th>
                                <th style={{ padding: '16px 20px', color: '#475569', fontWeight: 750, fontSize: '0.8rem', textTransform: 'uppercase' }}>
                                    {historyTab === 'deleted' ? 'Deleted Date / Expiry' : 'Transaction Date'}
                                </th>
                                <th style={{ padding: '16px 20px', color: '#475569', fontWeight: 750, fontSize: '0.8rem', textTransform: 'uppercase' }}>Category</th>
                                <th style={{ padding: '16px 20px', color: '#475569', fontWeight: 750, fontSize: '0.8rem', textTransform: 'uppercase', textAlign: 'center' }}>Proof / Receipt</th>
                                <th style={{ padding: '16px 20px', color: '#475569', fontWeight: 750, fontSize: '0.8rem', textTransform: 'uppercase', textAlign: 'right' }}>Amount</th>
                                <th style={{ padding: '16px 20px', color: '#475569', fontWeight: 750, fontSize: '0.8rem', textTransform: 'uppercase', textAlign: 'center' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={10} style={{ textAlign: 'center', padding: '40px' }}>
                                        <Loader2 className="animate-spin" style={{ margin: '0 auto' }} size={32} color="#253b50" />
                                    </td>
                                </tr>
                            ) : (() => {
                                const currentList = historyTab === 'deleted'
                                    ? deletedFilteredTransactions
                                    : filteredTransactions.filter(t => historyTab === 'received' ? t.type === 'credit' : t.type === 'debit');

                                if (currentList.length === 0) {
                                    return (
                                        <tr>
                                            <td colSpan={10} style={{ textAlign: 'center', padding: '50px', color: '#64748b' }}>
                                                {historyTab === 'deleted' 
                                                    ? 'No deleted entries in trash.' 
                                                    : 'No statement transactions found for this month.'}
                                            </td>
                                        </tr>
                                    );
                                }

                                return currentList.map((t, idx) => {
                                    const proofDoc = t.receipt_image || t.image;
                                    const isDeletedRow = isTxDeleted(t);
                                    const daysRemaining = t.recovery_days_remaining !== undefined ? t.recovery_days_remaining : 30;

                                    return (
                                    <tr key={`${t.transaction_id}-${idx}`} className="table-row" style={{ backgroundColor: isDeletedRow ? '#fff8f8' : 'transparent' }}>
                                        <td style={{ padding: '16px 20px', whiteSpace: 'nowrap' }}>
                                            <span style={{ 
                                                backgroundColor: isDeletedRow ? '#fee2e2' : '#f1f5f9', 
                                                color: isDeletedRow ? '#991b1b' : '#0f172a', 
                                                padding: '4px 8px', 
                                                borderRadius: '6px', 
                                                fontSize: '0.78rem', 
                                                fontWeight: 800, 
                                                border: `1px solid ${isDeletedRow ? '#fca5a5' : '#cbd5e1'}`, 
                                                letterSpacing: '0.5px' 
                                            }}>
                                                {formatTransactionNo(t.transaction_id, t.transaction_date)}
                                            </span>
                                            {isDeletedRow && (
                                                <div style={{ marginTop: '4px' }}>
                                                    <span style={{
                                                        fontSize: '0.68rem',
                                                        fontWeight: 800,
                                                        color: '#b91c1c',
                                                        backgroundColor: '#fef2f2',
                                                        border: '1px solid #fecaca',
                                                        padding: '1px 6px',
                                                        borderRadius: '4px',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '3px'
                                                    }}>
                                                        ⏳ {daysRemaining}d left to recover
                                                    </span>
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: '16px 20px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{
                                                    backgroundColor: t.type === 'credit' ? '#d1fae5' : '#fee2e2',
                                                    color: t.type === 'credit' ? '#065f46' : '#991b1b',
                                                    padding: '8px',
                                                    borderRadius: '8px',
                                                    flexShrink: 0
                                                }}>
                                                    {t.type === 'credit' ? <ArrowUpRight size={18} /> : <ArrowDownLeft size={18} />}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.92rem' }}>
                                                        {t.description || (t.type === 'credit' ? 'Client Payment' : 'Site Expense')}
                                                    </div>
                                                    {t.payment_mode && (
                                                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                                                            Mode: {t.payment_mode}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px 20px', fontWeight: 600, color: '#64748b', fontSize: '0.85rem' }}>{t.client_id || '-'}</td>
                                        <td style={{ padding: '16px 20px', fontWeight: 500, color: '#334155' }}>{t.project_name || 'General Company Income'}</td>
                                        <td style={{ padding: '16px 20px', fontWeight: 500, color: '#64748b', fontSize: '0.85rem' }}>{t.project_type || '-'}</td>
                                        <td style={{ padding: '16px 20px', fontSize: '0.88rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Calendar size={14} />
                                                {new Date(t.transaction_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </div>
                                            {isDeletedRow && t.deleted_at && (
                                                <div style={{ fontSize: '0.70rem', color: '#dc2626', fontWeight: 600, marginTop: '3px' }}>
                                                    Deleted: {new Date(t.deleted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: '16px 20px' }}>
                                            <span style={{ fontSize: '0.8rem', fontWeight: 600, padding: '4px 10px', borderRadius: '20px', backgroundColor: '#f1f5f9', color: '#475569', textTransform: 'capitalize' }}>
                                                {t.category.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                                            {proofDoc ? (
                                                <button
                                                    type="button"
                                                    onClick={() => setViewProofUrl(proofDoc)}
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '5px',
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
                                                    title="View Transaction Proof Document"
                                                >
                                                    <Eye size={13} /> View Proof
                                                </button>
                                            ) : (
                                                <label
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '5px',
                                                        padding: '5px 10px',
                                                        borderRadius: '8px',
                                                        border: '1px dashed #cbd5e1',
                                                        backgroundColor: '#f8fafc',
                                                        color: '#64748b',
                                                        fontSize: '0.78rem',
                                                        fontWeight: 600,
                                                        cursor: isDeletedRow ? 'not-allowed' : 'pointer'
                                                    }}
                                                    title={isDeletedRow ? 'Cannot attach to deleted item' : 'Click to attach proof document'}
                                                >
                                                    {uploadingTxnId === t.transaction_id ? (
                                                        <Loader2 className="animate-spin" size={13} />
                                                    ) : (
                                                        <Upload size={13} />
                                                    )}
                                                    Attach Proof
                                                    {!isDeletedRow && (
                                                        <input
                                                            type="file"
                                                            accept="image/*,application/pdf"
                                                            style={{ display: 'none' }}
                                                            disabled={uploadingTxnId === t.transaction_id}
                                                            onChange={(e) => {
                                                                const file = e.target.files?.[0];
                                                                if (file) handleUploadProofForRow(t.transaction_id, file);
                                                            }}
                                                        />
                                                    )}
                                                </label>
                                            )}
                                        </td>
                                        <td style={{ padding: '16px 20px', fontWeight: 700, textAlign: 'right', color: t.type === 'credit' ? '#059669' : '#e11d48', fontSize: '1rem', whiteSpace: 'nowrap' }}>
                                            {t.type === 'credit' ? '+' : '-'} ₹{parseFloat(t.amount).toLocaleString('en-IN')}
                                        </td>
                                        <td style={{ padding: '16px 20px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                            {isDeletedRow ? (
                                                <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRestoreTransaction(t)}
                                                        disabled={restoringTxnId === t.transaction_id}
                                                        style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                            padding: '6px 12px',
                                                            borderRadius: '8px',
                                                            border: '1.5px solid #86efac',
                                                            backgroundColor: '#f0fdf4',
                                                            color: '#15803d',
                                                            fontSize: '0.78rem',
                                                            fontWeight: 700,
                                                            cursor: restoringTxnId === t.transaction_id ? 'not-allowed' : 'pointer',
                                                            transition: 'all 0.15s ease'
                                                        }}
                                                        title="Restore this transaction back to active accounts"
                                                    >
                                                        {restoringTxnId === t.transaction_id ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />} Restore
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handlePermanentDeleteTransaction(t)}
                                                        disabled={permanentDeletingTxnId === t.transaction_id}
                                                        style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                            padding: '6px 12px',
                                                            borderRadius: '8px',
                                                            border: '1.5px solid #fecaca',
                                                            backgroundColor: '#fef2f2',
                                                            color: '#b91c1c',
                                                            fontSize: '0.78rem',
                                                            fontWeight: 700,
                                                            cursor: permanentDeletingTxnId === t.transaction_id ? 'not-allowed' : 'pointer',
                                                            transition: 'all 0.15s ease'
                                                        }}
                                                        title="Purge transaction permanently from database"
                                                    >
                                                        {permanentDeletingTxnId === t.transaction_id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Purge
                                                    </button>
                                                </div>
                                            ) : (
                                                <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenEditModal(t)}
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
                                                        title={`Edit Transaction ${formatTransactionNo(t.transaction_id, t.transaction_date)}`}
                                                    >
                                                        <Edit2 size={13} /> Edit
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteTransaction(t)}
                                                        disabled={deletingTxnId === t.transaction_id}
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
                                                            cursor: deletingTxnId === t.transaction_id ? 'not-allowed' : 'pointer',
                                                            opacity: deletingTxnId === t.transaction_id ? 0.6 : 1,
                                                            transition: 'all 0.15s ease'
                                                        }}
                                                        title={`Delete Transaction ${formatTransactionNo(t.transaction_id, t.transaction_date)}`}
                                                    >
                                                        {deletingTxnId === t.transaction_id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Delete
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                    );
                                });
                            })()}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Per-Project Financial Breakdown */}
            <div className="premium-card" style={{ marginTop: '40px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
                    <div>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>Project-wise Cash Flow</h3>
                        <p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0 }}>Summary of incoming and outgoing cash flows for individual active projects.</p>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <button
                            onClick={() => {
                                setImportTarget('all');
                                setShowImportModal(true);
                            }}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '8px 14px',
                                borderRadius: '8px',
                                border: '1.5px solid #cbd5e1',
                                backgroundColor: '#ffffff',
                                color: '#1e293b',
                                fontSize: '0.82rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                            }}
                            title="Import Project Transactions via CSV"
                        >
                            <Upload size={14} color="#0284c7" /> Import CSV
                        </button>

                        <button
                            onClick={handleExportProjectCashFlowCSV}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '8px 14px',
                                borderRadius: '8px',
                                border: '1.5px solid #cbd5e1',
                                backgroundColor: '#ffffff',
                                color: '#1e293b',
                                fontSize: '0.82rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                            }}
                            title="Export Project Cash Flow to CSV / Excel"
                        >
                            <Download size={14} color="#16a34a" /> Export CSV
                        </button>

                        <button
                            onClick={handleExportProjectCashFlowPDF}
                            disabled={generatingProjectPdf}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '8px 14px',
                                borderRadius: '8px',
                                border: '1.5px solid #cbd5e1',
                                backgroundColor: '#ffffff',
                                color: '#1e293b',
                                fontSize: '0.82rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                            }}
                            title="Export Project Cash Flow to PDF"
                        >
                            {generatingProjectPdf ? <Loader2 className="animate-spin" size={14} /> : <FileText size={14} color="#ea580c" />} Export PDF
                        </button>
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid #cbd5e1', backgroundColor: '#f8fafc' }}>
                                <th style={{ padding: '16px 24px', color: '#475569', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase' }}>Project ID</th>
                                <th style={{ padding: '16px 24px', color: '#475569', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase' }}>Project Name</th>
                                <th style={{ padding: '16px 24px', color: '#475569', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase' }}>Project Type</th>
                                <th style={{ padding: '16px 24px', color: '#475569', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', textAlign: 'right' }}>Cash Inflow</th>
                                <th style={{ padding: '16px 24px', color: '#475569', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', textAlign: 'right' }}>Cash Outflow</th>
                                <th style={{ padding: '16px 24px', color: '#475569', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', textAlign: 'right' }}>Net Margin</th>
                            </tr>
                        </thead>
                        <tbody>
                            {projectFinancials.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                                        No active project cash flows recorded for this statement period.
                                    </td>
                                </tr>
                            ) : projectFinancials.map((p, idx) => {
                                const project = projects.find(proj => proj.project_name === p.project_name);
                                return (
                                <tr key={idx} className="table-row">
                                    <td style={{ padding: '16px 24px', fontWeight: 600, color: '#64748b', fontSize: '0.85rem' }}>{project?.client_id || '-'}</td>
                                    <td style={{ padding: '16px 24px', fontWeight: 600, color: '#0f172a' }}>{p.project_name}</td>
                                    <td style={{ padding: '16px 24px', fontWeight: 500, color: '#64748b', fontSize: '0.85rem' }}>{project?.project_type || '-'}</td>
                                    <td style={{ padding: '16px 24px', fontWeight: 700, textAlign: 'right', color: '#059669' }}>+₹{p.cashIn.toLocaleString('en-IN')}</td>
                                    <td style={{ padding: '16px 24px', fontWeight: 700, textAlign: 'right', color: '#e11d48' }}>-₹{p.cashOut.toLocaleString('en-IN')}</td>
                                    <td style={{ padding: '16px 24px', fontWeight: 800, textAlign: 'right', color: p.remaining >= 0 ? '#0f172a' : '#e11d48' }}>
                                        ₹{p.remaining.toLocaleString('en-IN')}
                                    </td>
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
                    <div className="premium-card" style={{ width: '100%', maxWidth: '550px', padding: '0', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                        {/* Constant Header - Never Scrolls */}
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', flexShrink: 0, position: 'sticky', top: 0, zIndex: 10 }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                                {editingTransaction ? 'Edit Transaction' : 'Record Transaction'}
                            </h3>
                            <button 
                                onClick={() => {
                                    setShowModal(false);
                                    setEditingTransaction(null);
                                    setIsCustomCategory(false);
                                    setCustomCategoryInput('');
                                }} 
                                style={{ color: '#64748b', cursor: 'pointer', border: 'none', background: 'none', fontSize: '1.8rem', fontWeight: 400, padding: '0 8px', lineHeight: 1 }}
                            >
                                &times;
                            </button>
                        </div>

                        {/* Scrollable Form Body */}
                        <form onSubmit={handleSubmit} style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', padding: '4px', backgroundColor: '#f1f5f9', borderRadius: '12px' }}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setFormData({ ...formData, type: 'credit', category: 'advance' });
                                        setIsCustomCategory(false);
                                        setCustomCategoryInput('');
                                    }}
                                    style={{
                                        flex: 1,
                                        padding: '12px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        fontSize: '0.9rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        backgroundColor: formData.type === 'credit' ? '#059669' : 'transparent',
                                        color: formData.type === 'credit' ? 'white' : '#475569',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    Payment Received (Income)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setFormData({ ...formData, type: 'debit', category: 'Labor' });
                                        setIsCustomCategory(false);
                                        setCustomCategoryInput('');
                                    }}
                                    style={{
                                        flex: 1,
                                        padding: '12px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        fontSize: '0.9rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        backgroundColor: formData.type === 'debit' ? '#e11d48' : 'transparent',
                                        color: formData.type === 'debit' ? 'white' : '#475569',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    Site Expense (Outcome)
                                </button>
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Project Scope</label>
                                <select required value={formData.project_id} onChange={(e) => setFormData({ ...formData, project_id: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.95rem', fontWeight: 500, color: '#0f172a' }}>
                                    <option value="">Specific Project (Optional)</option>
                                    {projects.map(p => <option key={p.project_id} value={p.project_id}>{p.project_name}</option>)}
                                </select>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Amount (₹)</label>
                                    <input type="number" required value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} className="input-field" placeholder="e.g. 50000" />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Category</label>
                                    <select 
                                        value={isCustomCategory ? '__custom__' : formData.category} 
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === '__custom__') {
                                                setIsCustomCategory(true);
                                            } else {
                                                setIsCustomCategory(false);
                                                setFormData({ ...formData, category: val });
                                            }
                                        }} 
                                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.95rem', fontWeight: 500, color: '#0f172a' }}
                                    >
                                        <optgroup label="Standard Categories">
                                            {formData.type === 'credit' ? (
                                                <>
                                                    <option value="advance">Advance Payment</option>
                                                    <option value="mid_payment">Mid Payment</option>
                                                    <option value="final_payment">Final Payment</option>
                                                    <option value="additional_works">Additional Works</option>
                                                </>
                                            ) : (
                                                <>
                                                    <option value="Labor">Labor Payment</option>
                                                    <option value="Material">Material Purchase</option>
                                                    <option value="Transport">Transportation</option>
                                                    <option value="Site Costs">Site Maintenance</option>
                                                    <option value="Equipment">Equipment Rental</option>
                                                    <option value="Other">Other Expense</option>
                                                </>
                                            )}
                                        </optgroup>
                                        {existingCustomCategories.length > 0 && (
                                            <optgroup label="Previous Custom Entries">
                                                {existingCustomCategories.map(cat => (
                                                    <option key={cat} value={cat}>{cat}</option>
                                                ))}
                                            </optgroup>
                                        )}
                                        <optgroup label="Custom Option">
                                            <option value="__custom__">➕ + Custom Category (Add Custom Entry)...</option>
                                        </optgroup>
                                    </select>

                                    {isCustomCategory && (
                                        <div style={{ marginTop: '8px' }}>
                                            <input
                                                type="text"
                                                required
                                                autoFocus
                                                value={customCategoryInput}
                                                onChange={(e) => setCustomCategoryInput(e.target.value)}
                                                placeholder="Enter custom category (e.g. Plumbing, Carpentry)..."
                                                className="input-field"
                                                style={{
                                                    width: '100%',
                                                    padding: '10px 12px',
                                                    borderRadius: '8px',
                                                    border: '1.5px solid #fca412',
                                                    backgroundColor: '#fffdfa',
                                                    fontSize: '0.9rem',
                                                    fontWeight: 600,
                                                    color: '#0f172a',
                                                    outline: 'none',
                                                    boxShadow: '0 0 0 3px rgba(252, 164, 18, 0.15)'
                                                }}
                                            />
                                            <div style={{ fontSize: '0.75rem', color: '#ea580c', marginTop: '4px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <span>✏️</span> Custom category entry will be recorded with this transaction
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Transaction Date</label>
                                    <input type="date" required value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="input-field" />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Payment Mode</label>
                                    <select value={formData.payment_mode} onChange={(e) => setFormData({ ...formData, payment_mode: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.95rem', fontWeight: 500, color: '#0f172a' }}>
                                        <option value="UPI">UPI</option>
                                        <option value="Cash">Cash</option>
                                        <option value="Bank Transfer">Bank Transfer</option>
                                        <option value="Cheque">Cheque</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Notes & References</label>
                                <textarea rows={2} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="input-field" placeholder="Enter cheque number, bank ref or custom notes..." />
                            </div>

                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Transaction Proof / Receipt Document (Optional)</label>
                                <input
                                    type="file"
                                    accept="image/*,application/pdf"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            compressOrReadFile(file, (base64) => {
                                                setReceiptPreview(base64);
                                                setFormData(prev => ({ ...prev, receipt_image: base64 }));
                                            });
                                        }
                                    }}
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', backgroundColor: '#ffffff' }}
                                />
                                {receiptPreview && (
                                    <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                        {receiptPreview.startsWith('data:application/pdf') ? (
                                            <span style={{ fontSize: '0.82rem', color: '#059669', fontWeight: 700 }}>📄 PDF Document Selected</span>
                                        ) : (
                                            <img src={receiptPreview} alt="Receipt Preview" style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setReceiptPreview('');
                                                setFormData(prev => ({ ...prev, receipt_image: '' }));
                                            }}
                                            style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', marginLeft: 'auto' }}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                                <button 
                                    type="button" 
                                    onClick={() => {
                                        setShowModal(false);
                                        setEditingTransaction(null);
                                        setIsCustomCategory(false);
                                        setCustomCategoryInput('');
                                    }} 
                                    style={{ padding: '12px 24px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: 'white', fontWeight: 600, color: '#475569', cursor: 'pointer' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        backgroundColor: formData.type === 'credit' ? '#059669' : '#e11d48',
                                        border: 'none',
                                        color: 'white',
                                        padding: '12px 24px',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontWeight: 700
                                    }}
                                >
                                    {submitting && <Loader2 className="animate-spin" size={16} />}
                                    {editingTransaction ? 'Update Transaction' : `Save ${formData.type === 'credit' ? 'Income' : 'Expense'}`}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* View Proof / Receipt Document Modal */}
            {viewProofUrl && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px' }}>
                    <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '820px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)', border: '1.5px solid #fed7aa' }}>
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Receipt size={20} color="#ea580c" />
                                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>Transaction Proof Document</h3>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <a 
                                    href={viewProofUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    download="transaction_proof"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', backgroundColor: '#f1f5f9', color: '#334155', fontSize: '0.82rem', fontWeight: 700, textDecoration: 'none', border: '1px solid #cbd5e1' }}
                                >
                                    Open Original
                                </a>
                                <button 
                                    onClick={() => setViewProofUrl(null)}
                                    style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', color: '#64748b', cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}
                                >
                                    &times;
                                </button>
                            </div>
                        </div>

                        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a', minHeight: '320px' }}>
                            {viewProofUrl.startsWith('data:application/pdf') || viewProofUrl.toLowerCase().includes('.pdf') ? (
                                <iframe 
                                    src={viewProofUrl} 
                                    style={{ width: '100%', height: '70vh', border: 'none', borderRadius: '8px', backgroundColor: '#ffffff' }} 
                                    title="PDF Document" 
                                />
                            ) : (
                                <img 
                                    src={viewProofUrl} 
                                    alt="Transaction Proof" 
                                    style={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain', borderRadius: '8px' }} 
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* CSV Import Modal */}
            {showImportModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px' }}>
                    <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '850px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1.5px solid #fed7aa' }}>
                        {/* Header */}
                        <div style={{ padding: '18px 24px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Upload size={20} color="#0284c7" /> Import Transactions via CSV
                                </h3>
                                <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                                    Upload spreadsheet records to automatically populate financial transactions &amp; project cash flows.
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    setShowImportModal(false);
                                    setParsedImportRows([]);
                                    setImportFile(null);
                                    setImportError(null);
                                }}
                                style={{ background: 'none', border: 'none', fontSize: '1.6rem', color: '#64748b', cursor: 'pointer', lineHeight: 1 }}
                            >
                                &times;
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
                            {/* Template Download & File Picker */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                                <div style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>
                                    Need format reference? Download standard template:
                                </div>
                                <button
                                    type="button"
                                    onClick={handleDownloadTemplate}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '7px 14px',
                                        borderRadius: '8px',
                                        border: '1.5px solid #0284c7',
                                        backgroundColor: '#f0f9ff',
                                        color: '#0284c7',
                                        fontSize: '0.82rem',
                                        fontWeight: 700,
                                        cursor: 'pointer'
                                    }}
                                >
                                    <Download size={14} /> Download Sample Template (.CSV)
                                </button>
                            </div>

                            {/* Drop / Select Area */}
                            <div style={{
                                border: '2px dashed #cbd5e1',
                                borderRadius: '12px',
                                padding: '28px',
                                textAlign: 'center',
                                backgroundColor: '#f8fafc',
                                marginBottom: '20px'
                            }}>
                                <input
                                    type="file"
                                    id="csv-file-input"
                                    accept=".csv,text/csv"
                                    style={{ display: 'none' }}
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleProcessImportFile(file);
                                    }}
                                />
                                <Upload size={32} color="#64748b" style={{ margin: '0 auto 10px' }} />
                                <h4 style={{ margin: '0 0 6px', fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                                    {importFile ? importFile.name : 'Select or drop a CSV file here'}
                                </h4>
                                <p style={{ margin: '0 0 16px', fontSize: '0.82rem', color: '#64748b' }}>
                                    Supported format: .csv (with headers Project, Type, Amount, Category, Mode, Date, Description)
                                </p>
                                <label
                                    htmlFor="csv-file-input"
                                    style={{
                                        display: 'inline-block',
                                        padding: '9px 20px',
                                        borderRadius: '8px',
                                        backgroundColor: '#0284c7',
                                        color: '#ffffff',
                                        fontWeight: 700,
                                        fontSize: '0.85rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Browse Computer
                                </label>
                            </div>

                            {/* Error Alert */}
                            {importError && (
                                <div style={{ padding: '12px 16px', borderRadius: '8px', backgroundColor: '#fef2f2', border: '1px solid #fee2e2', color: '#b91c1c', fontSize: '0.85rem', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <AlertCircle size={18} /> {importError}
                                </div>
                            )}

                            {/* Parsed Rows Summary & Preview */}
                            {parsedImportRows.length > 0 && (
                                <div>
                                    <div style={{ display: 'flex', gap: '12px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
                                            Total Rows: <strong>{parsedImportRows.length}</strong>
                                        </span>
                                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#059669', backgroundColor: '#ecfdf5', padding: '3px 8px', borderRadius: '6px' }}>
                                            ✓ {parsedImportRows.filter(r => r.valid).length} Valid
                                        </span>
                                        {parsedImportRows.filter(r => !r.valid).length > 0 && (
                                            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#dc2626', backgroundColor: '#fef2f2', padding: '3px 8px', borderRadius: '6px' }}>
                                                ⚠ {parsedImportRows.filter(r => !r.valid).length} Invalid
                                            </span>
                                        )}
                                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0284c7', marginLeft: 'auto' }}>
                                            Inflows: ₹{parsedImportRows.filter(r => r.valid && r.type === 'credit').reduce((s, r) => s + parseFloat(r.amount), 0).toLocaleString('en-IN')} | Outflows: ₹{parsedImportRows.filter(r => r.valid && r.type === 'debit').reduce((s, r) => s + parseFloat(r.amount), 0).toLocaleString('en-IN')}
                                        </span>
                                    </div>

                                    {/* Preview Table */}
                                    <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                            <thead>
                                                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1.5px solid #cbd5e1', textAlign: 'left', position: 'sticky', top: 0, zIndex: 1 }}>
                                                    <th style={{ padding: '8px 12px' }}>Status</th>
                                                    <th style={{ padding: '8px 12px' }}>Project</th>
                                                    <th style={{ padding: '8px 12px' }}>Type</th>
                                                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Amount</th>
                                                    <th style={{ padding: '8px 12px' }}>Category</th>
                                                    <th style={{ padding: '8px 12px' }}>Mode</th>
                                                    <th style={{ padding: '8px 12px' }}>Date</th>
                                                    <th style={{ padding: '8px 12px' }}>Notes</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {parsedImportRows.map((r, i) => (
                                                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: r.valid ? '#ffffff' : '#fef2f2' }}>
                                                        <td style={{ padding: '8px 12px' }}>
                                                            {r.valid ? (
                                                                <span style={{ color: '#059669', fontWeight: 800 }}>✓ OK</span>
                                                            ) : (
                                                                <span style={{ color: '#dc2626', fontWeight: 800 }}>✕ {r.error}</span>
                                                            )}
                                                        </td>
                                                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>{r.project_name}</td>
                                                        <td style={{ padding: '8px 12px' }}>
                                                            <span style={{ fontWeight: 700, color: r.type === 'credit' ? '#059669' : '#dc2626' }}>
                                                                {r.type === 'credit' ? 'Inflow' : 'Outflow'}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>
                                                            ₹{parseFloat(r.amount).toLocaleString('en-IN')}
                                                        </td>
                                                        <td style={{ padding: '8px 12px' }}>{r.category}</td>
                                                        <td style={{ padding: '8px 12px' }}>{r.payment_mode}</td>
                                                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{r.date}</td>
                                                        <td style={{ padding: '8px 12px', color: '#64748b' }}>{r.description || '-'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div style={{ padding: '16px 24px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowImportModal(false);
                                    setParsedImportRows([]);
                                    setImportFile(null);
                                    setImportError(null);
                                }}
                                style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#475569', fontWeight: 700, cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={isImporting || parsedImportRows.filter(r => r.valid).length === 0}
                                onClick={handleConfirmImport}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '10px 24px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    backgroundColor: parsedImportRows.filter(r => r.valid).length > 0 ? '#0284c7' : '#94a3b8',
                                    color: '#ffffff',
                                    fontWeight: 800,
                                    cursor: parsedImportRows.filter(r => r.valid).length > 0 ? 'pointer' : 'not-allowed'
                                }}
                            >
                                {isImporting && <Loader2 className="animate-spin" size={16} />}
                                Import {parsedImportRows.filter(r => r.valid).length} Transactions
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Hidden Printable Container for Transactions PDF Export */}
            <div
                id="printable-transactions-report"
                style={{
                    position: 'fixed',
                    left: '-99999px',
                    top: 0,
                    width: '1050px',
                    backgroundColor: '#ffffff',
                    padding: '30px',
                    fontFamily: 'system-ui, sans-serif',
                    color: '#0f172a'
                }}
            >
                {/* Official Statement Header */}
                <div style={{ borderBottom: '3px solid #fca412', paddingBottom: '16px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 900, color: '#0c1527', letterSpacing: '-0.02em' }}>
                            LIVRCART INTERIORS &amp; ARCHITECTS
                        </h1>
                        <h2 style={{ margin: '4px 0 0', fontSize: '1.1rem', fontWeight: 800, color: '#ea580c', textTransform: 'uppercase' }}>
                            {historyTab === 'received' ? 'Total Received Payments (Cash Inflow Statement)' : 'Total Spent Payments (Cash Outflow Statement)'}
                        </h2>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '0.85rem', color: '#475569' }}>
                        <div><strong>Statement Period:</strong> {activeMonthLabel()}</div>
                        <div><strong>Generated on:</strong> {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                    </div>
                </div>

                {/* Summary Metric Strip */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
                    <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0' }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#065f46', textTransform: 'uppercase' }}>Total Cash Inflow</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#059669', marginTop: '4px' }}>₹{totalCredit.toLocaleString('en-IN')}</div>
                    </div>
                    <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: '#fff1f2', border: '1px solid #fecdd3' }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#9f1239', textTransform: 'uppercase' }}>Total Cash Outflow</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#e11d48', marginTop: '4px' }}>₹{totalDebit.toLocaleString('en-IN')}</div>
                    </div>
                    <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1' }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase' }}>Net Bank Balance</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 900, color: (totalCredit - totalDebit) >= 0 ? '#0f172a' : '#e11d48', marginTop: '4px' }}>
                            ₹{(totalCredit - totalDebit).toLocaleString('en-IN')}
                        </div>
                    </div>
                </div>

                {/* Report Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #cbd5e1', textAlign: 'left' }}>
                            <th style={{ padding: '10px 12px', fontWeight: 800 }}>Txn No</th>
                            <th style={{ padding: '10px 12px', fontWeight: 800 }}>Description</th>
                            <th style={{ padding: '10px 12px', fontWeight: 800 }}>Project ID</th>
                            <th style={{ padding: '10px 12px', fontWeight: 800 }}>Project Name</th>
                            <th style={{ padding: '10px 12px', fontWeight: 800 }}>Date</th>
                            <th style={{ padding: '10px 12px', fontWeight: 800 }}>Category</th>
                            <th style={{ padding: '10px 12px', fontWeight: 800 }}>Mode</th>
                            <th style={{ padding: '10px 12px', fontWeight: 800, textAlign: 'right' }}>Amount (₹)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredTransactions.filter(t => historyTab === 'received' ? t.type === 'credit' : t.type === 'debit').map((t, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                                <td style={{ padding: '10px 12px', fontWeight: 700 }}>{formatTransactionNo(t.transaction_id, t.transaction_date)}</td>
                                <td style={{ padding: '10px 12px', fontWeight: 600 }}>{t.description || (t.type === 'credit' ? 'Client Payment' : 'Site Expense')}</td>
                                <td style={{ padding: '10px 12px' }}>{t.client_id || '-'}</td>
                                <td style={{ padding: '10px 12px' }}>{t.project_name || 'General Company Income'}</td>
                                <td style={{ padding: '10px 12px' }}>{new Date(t.transaction_date).toLocaleDateString('en-IN')}</td>
                                <td style={{ padding: '10px 12px' }}>{t.category}</td>
                                <td style={{ padding: '10px 12px' }}>{t.payment_mode || 'Cash'}</td>
                                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: t.type === 'credit' ? '#059669' : '#e11d48' }}>
                                    {t.type === 'credit' ? '+' : '-'} ₹{parseFloat(t.amount).toLocaleString('en-IN')}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr style={{ backgroundColor: '#f8fafc', borderTop: '2px solid #0f172a', fontWeight: 900 }}>
                            <td colSpan={7} style={{ padding: '12px', fontSize: '0.92rem', textAlign: 'right' }}>
                                Total {historyTab === 'received' ? 'Received (Inflow)' : 'Spent (Outflow)'} Sum:
                            </td>
                            <td style={{ padding: '12px', fontSize: '1.05rem', textAlign: 'right', color: historyTab === 'received' ? '#059669' : '#e11d48' }}>
                                ₹{(historyTab === 'received' ? totalCredit : totalDebit).toLocaleString('en-IN')}
                            </td>
                        </tr>
                    </tfoot>
                </table>

                {/* Footer Note */}
                <div style={{ marginTop: '30px', borderTop: '1px solid #e2e8f0', paddingTop: '10px', fontSize: '0.75rem', color: '#94a3b8', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Confidential Official Financial Statement — Livrcart ERP System</span>
                    <span>Page 1 of 1</span>
                </div>
            </div>

            {/* Hidden Printable Container for Project-wise Cash Flow PDF Export */}
            <div
                id="printable-project-cashflow-report"
                style={{
                    position: 'fixed',
                    left: '-99999px',
                    top: 0,
                    width: '1050px',
                    backgroundColor: '#ffffff',
                    padding: '30px',
                    fontFamily: 'system-ui, sans-serif',
                    color: '#0f172a'
                }}
            >
                {/* Official Statement Header */}
                <div style={{ borderBottom: '3px solid #0284c7', paddingBottom: '16px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 900, color: '#0c1527', letterSpacing: '-0.02em' }}>
                            LIVRCART INTERIORS &amp; ARCHITECTS
                        </h1>
                        <h2 style={{ margin: '4px 0 0', fontSize: '1.1rem', fontWeight: 800, color: '#0284c7', textTransform: 'uppercase' }}>
                            PROJECT-WISE CASH FLOW SUMMARY REPORT
                        </h2>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '0.85rem', color: '#475569' }}>
                        <div><strong>Statement Period:</strong> {activeMonthLabel()}</div>
                        <div><strong>Generated on:</strong> {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                    </div>
                </div>

                {/* Summary Metric Strip */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                    <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: '#f0f9ff', border: '1px solid #bae6fd' }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0369a1', textTransform: 'uppercase' }}>Active Projects</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#0284c7', marginTop: '4px' }}>{projectFinancials.length}</div>
                    </div>
                    <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0' }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#065f46', textTransform: 'uppercase' }}>Total Inflow</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#059669', marginTop: '4px' }}>
                            ₹{projectFinancials.reduce((s, p) => s + p.cashIn, 0).toLocaleString('en-IN')}
                        </div>
                    </div>
                    <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: '#fff1f2', border: '1px solid #fecdd3' }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#9f1239', textTransform: 'uppercase' }}>Total Outflow</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#e11d48', marginTop: '4px' }}>
                            ₹{projectFinancials.reduce((s, p) => s + p.cashOut, 0).toLocaleString('en-IN')}
                        </div>
                    </div>
                    <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1' }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase' }}>Net Portfolio Margin</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#0f172a', marginTop: '4px' }}>
                            ₹{projectFinancials.reduce((s, p) => s + p.remaining, 0).toLocaleString('en-IN')}
                        </div>
                    </div>
                </div>

                {/* Report Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #cbd5e1', textAlign: 'left' }}>
                            <th style={{ padding: '10px 14px', fontWeight: 800 }}>Project ID</th>
                            <th style={{ padding: '10px 14px', fontWeight: 800 }}>Project Name</th>
                            <th style={{ padding: '10px 14px', fontWeight: 800 }}>Project Type</th>
                            <th style={{ padding: '10px 14px', fontWeight: 800, textAlign: 'right' }}>Cash Inflow (₹)</th>
                            <th style={{ padding: '10px 14px', fontWeight: 800, textAlign: 'right' }}>Cash Outflow (₹)</th>
                            <th style={{ padding: '10px 14px', fontWeight: 800, textAlign: 'right' }}>Net Margin (₹)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {projectFinancials.map((p, idx) => {
                            const project = projects.find(proj => proj.project_name === p.project_name);
                            return (
                                <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                                    <td style={{ padding: '10px 14px', fontWeight: 700 }}>{project?.client_id || '-'}</td>
                                    <td style={{ padding: '10px 14px', fontWeight: 600 }}>{p.project_name}</td>
                                    <td style={{ padding: '10px 14px' }}>{project?.project_type || '-'}</td>
                                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                                        +₹{p.cashIn.toLocaleString('en-IN')}
                                    </td>
                                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#e11d48' }}>
                                        -₹{p.cashOut.toLocaleString('en-IN')}
                                    </td>
                                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 900, color: p.remaining >= 0 ? '#0f172a' : '#e11d48' }}>
                                        ₹{p.remaining.toLocaleString('en-IN')}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr style={{ backgroundColor: '#f8fafc', borderTop: '2px solid #0f172a', fontWeight: 900 }}>
                            <td colSpan={3} style={{ padding: '12px', fontSize: '0.92rem' }}>Portfolio Totals:</td>
                            <td style={{ padding: '12px', fontSize: '1rem', textAlign: 'right', color: '#059669' }}>
                                +₹{projectFinancials.reduce((s, p) => s + p.cashIn, 0).toLocaleString('en-IN')}
                            </td>
                            <td style={{ padding: '12px', fontSize: '1rem', textAlign: 'right', color: '#e11d48' }}>
                                -₹{projectFinancials.reduce((s, p) => s + p.cashOut, 0).toLocaleString('en-IN')}
                            </td>
                            <td style={{ padding: '12px', fontSize: '1.05rem', textAlign: 'right', color: '#0f172a' }}>
                                ₹{projectFinancials.reduce((s, p) => s + p.remaining, 0).toLocaleString('en-IN')}
                            </td>
                        </tr>
                    </tfoot>
                </table>

                {/* Footer Note */}
                <div style={{ marginTop: '30px', borderTop: '1px solid #e2e8f0', paddingTop: '10px', fontSize: '0.75rem', color: '#94a3b8', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Confidential Official Financial Statement — Livrcart ERP System</span>
                    <span>Page 1 of 1</span>
                </div>
            </div>
        </div>
    );
};
