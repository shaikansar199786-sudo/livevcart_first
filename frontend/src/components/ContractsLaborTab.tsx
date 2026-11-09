import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
    Users,
    UserCheck,
    Plus,
    Search,
    FileText,
    CheckCircle2,
    Clock,
    AlertCircle,
    CreditCard,
    Edit2,
    Trash2,
    X,
    Upload,
    Download,
    Printer,
    Eye,
    Phone,
    Building2,
    Hammer,
    Truck,
    ChevronDown,
    ChevronUp,
    ShieldCheck,
    Check,
    Calendar,
    ArrowRight
} from 'lucide-react';
import { API_BASE_URL } from '../config';

interface PaymentItem {
    id: number;
    contract_id: number;
    project_id: string | number;
    payment_stage: string;
    amount: number;
    payment_date: string;
    payment_mode: string;
    status: string;
    receipt_proof?: string;
    notes?: string;
    recorded_by?: string;
    created_at?: string;
}

interface ContractItem {
    id: number;
    project_id: string | number;
    party_name: string;
    party_type: 'Labour' | 'Contractor' | 'Vendor';
    work_trade?: string;
    phone?: string;
    contract_amount: number;
    status: string;
    notes?: string;
    created_by?: string;
    created_at?: string;
    payments: PaymentItem[];
    total_paid: number;
    balance_due: number;
    is_fully_paid: boolean;
}

interface ContractsLaborTabProps {
    project: any;
    user: any;
}

const COMMON_TRADES = [
    'Carpentry & Modular',
    'Electrical Work',
    'Plumbing & Sanitary',
    'Painting & Polish',
    'POP & False Ceiling',
    'Tile & Granite / Flooring',
    'Civil Work / Masonry',
    'Fabrication & Glass',
    'Plywood & Hardware Supplier',
    'Lighting & Fixtures Supplier',
    'Curtains & Wallpaper',
    'Deep Cleaning & Handover'
];

const STAGE_SUGGESTIONS = [
    'Advance',
    '1st Payment',
    '2nd Payment',
    '3rd Payment',
    '4th Payment',
    'Final Settlement'
];

export const ContractsLaborTab: React.FC<ContractsLaborTabProps> = ({ project, user }) => {
    const projectId = project?.project_id || project?.id;
    const isAuthorized = ['admin', 'super_admin', 'accountant', 'project_head', 'project_manager', 'manager', 'site_engineer'].includes(
        String(user?.role || '').toLowerCase()
    );

    const [loading, setLoading] = useState<boolean>(true);
    const [contracts, setContracts] = useState<ContractItem[]>([]);
    const [summary, setSummary] = useState({
        total_assigned: 0,
        total_contract_amount: 0,
        total_paid: 0,
        total_balance_due: 0,
        counts_by_type: { Labour: 0, Contractor: 0, Vendor: 0 }
    });

    // Global vendor autocomplete
    const [globalVendors, setGlobalVendors] = useState<any[]>([]);

    // Search and filters
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<'ALL' | 'Labour' | 'Contractor' | 'Vendor'>('ALL');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'PAID'>('ALL');
    const [expandedCards, setExpandedCards] = useState<Record<number, boolean>>({});

    // Modals
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [showEditContractModal, setShowEditContractModal] = useState(false);
    const [selectedContract, setSelectedContract] = useState<ContractItem | null>(null);

    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [editingPayment, setEditingPayment] = useState<PaymentItem | null>(null);

    const [viewProofModal, setViewProofModal] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Form state for creating contract
    const [contractForm, setContractForm] = useState({
        party_name: '',
        party_type: 'Labour' as 'Labour' | 'Contractor' | 'Vendor',
        work_trade: '',
        phone: '',
        contract_amount: '',
        status: 'In Progress',
        notes: '',
        with_advance: true,
        advance_stage: 'Advance',
        advance_amount: '',
        advance_date: new Date().toISOString().split('T')[0],
        advance_mode: 'Cash',
        advance_notes: 'Initial Advance Payment'
    });

    // Form state for adding/editing payment
    const [paymentForm, setPaymentForm] = useState({
        payment_stage: '1st Payment',
        amount: '',
        payment_date: new Date().toISOString().split('T')[0],
        payment_mode: 'Cash',
        status: 'Paid',
        notes: '',
        receipt_proof: ''
    });

    // Load contracts
    const fetchContracts = async () => {
        if (!projectId) return;
        try {
            setLoading(true);
            const res = await axios.get(`${API_BASE_URL}/contracts-labor?project_id=${projectId}`);
            if (res.data && res.data.success) {
                setContracts(res.data.data.contracts || []);
                setSummary(res.data.data.summary || {
                    total_assigned: 0,
                    total_contract_amount: 0,
                    total_paid: 0,
                    total_balance_due: 0,
                    counts_by_type: { Labour: 0, Contractor: 0, Vendor: 0 }
                });

                // Auto expand all cards initially
                const expandMap: Record<number, boolean> = {};
                (res.data.data.contracts || []).forEach((c: ContractItem) => {
                    expandMap[c.id] = true;
                });
                setExpandedCards(expandMap);
            }
        } catch (err) {
            console.error('Error fetching contracts and labor:', err);
        } finally {
            setLoading(false);
        }
    };

    // Load global vendors list for suggestions
    useEffect(() => {
        axios.get(`${API_BASE_URL}/vendors/global`).then(res => {
            if (res.data && res.data.success) {
                setGlobalVendors(res.data.data || []);
            }
        }).catch(() => {});
    }, []);

    useEffect(() => {
        fetchContracts();
    }, [projectId]);

    const toggleExpand = (contractId: number) => {
        setExpandedCards(prev => ({ ...prev, [contractId]: !prev[contractId] }));
    };

    // Handle receipt file upload & compression
    const handleProofUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const img = document.createElement('img');
                img.src = reader.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 900;
                    const MAX_HEIGHT = 900;
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
                        setPaymentForm(prev => ({ ...prev, receipt_proof: canvas.toDataURL('image/jpeg', 0.7) }));
                    } else {
                        setPaymentForm(prev => ({ ...prev, receipt_proof: reader.result as string }));
                    }
                };
            };
            reader.readAsDataURL(file);
        }
    };

    // Submit Create Contract
    const handleCreateContract = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!contractForm.party_name.trim()) {
            alert('Please enter party / vendor / contractor name');
            return;
        }
        if (!contractForm.contract_amount || parseFloat(contractForm.contract_amount) <= 0) {
            alert('Please specify an agreed contract amount');
            return;
        }

        try {
            setSubmitting(true);
            const payload: any = {
                project_id: projectId,
                party_name: contractForm.party_name.trim(),
                party_type: contractForm.party_type,
                work_trade: contractForm.work_trade.trim(),
                phone: contractForm.phone.trim(),
                contract_amount: parseFloat(contractForm.contract_amount),
                status: contractForm.status,
                notes: contractForm.notes.trim(),
                created_by: user?.name || user?.username || 'User'
            };

            if (contractForm.with_advance && parseFloat(contractForm.advance_amount) > 0) {
                payload.initial_advance = parseFloat(contractForm.advance_amount);
                payload.advance_date = contractForm.advance_date;
                payload.advance_mode = contractForm.advance_mode;
                payload.advance_notes = contractForm.advance_notes;
            }

            const res = await axios.post(`${API_BASE_URL}/contracts-labor`, payload);
            if (res.data && res.data.success) {
                setShowAssignModal(false);
                setContractForm({
                    party_name: '',
                    party_type: 'Labour',
                    work_trade: '',
                    phone: '',
                    contract_amount: '',
                    status: 'In Progress',
                    notes: '',
                    with_advance: true,
                    advance_stage: 'Advance',
                    advance_amount: '',
                    advance_date: new Date().toISOString().split('T')[0],
                    advance_mode: 'Cash',
                    advance_notes: 'Initial Advance Payment'
                });
                fetchContracts();
            } else {
                alert(res.data?.message || 'Failed to save contract');
            }
        } catch (err: any) {
            alert(err?.response?.data?.message || 'Error creating contract');
        } finally {
            setSubmitting(false);
        }
    };

    // Submit Edit Contract
    const handleUpdateContract = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedContract) return;

        try {
            setSubmitting(true);
            const payload = {
                id: selectedContract.id,
                party_name: selectedContract.party_name,
                party_type: selectedContract.party_type,
                work_trade: selectedContract.work_trade,
                phone: selectedContract.phone,
                contract_amount: selectedContract.contract_amount,
                status: selectedContract.status,
                notes: selectedContract.notes
            };

            const res = await axios.put(`${API_BASE_URL}/contracts-labor`, payload);
            if (res.data && res.data.success) {
                setShowEditContractModal(false);
                setSelectedContract(null);
                fetchContracts();
            } else {
                alert(res.data?.message || 'Failed to update contract');
            }
        } catch (err: any) {
            alert(err?.response?.data?.message || 'Error updating contract');
        } finally {
            setSubmitting(false);
        }
    };

    // Delete Contract
    const handleDeleteContract = async (contract: ContractItem) => {
        if (!window.confirm(`Are you sure you want to delete ${contract.party_name} (${contract.party_type}) and all logged installments?`)) {
            return;
        }

        try {
            const res = await axios.delete(`${API_BASE_URL}/contracts-labor?id=${contract.id}`);
            if (res.data && res.data.success) {
                fetchContracts();
            } else {
                alert(res.data?.message || 'Failed to delete contract');
            }
        } catch (err: any) {
            alert(err?.response?.data?.message || 'Error deleting contract');
        }
    };

    // Open Payment Modal
    const openAddPaymentModal = (contract: ContractItem) => {
        setSelectedContract(contract);
        setEditingPayment(null);
        
        // Auto-suggest next installment label
        const paymentCount = contract.payments.length;
        let nextStage = '1st Payment';
        if (paymentCount === 0) {
            nextStage = 'Advance';
        } else if (paymentCount === 1) {
            nextStage = '1st Payment';
        } else if (paymentCount === 2) {
            nextStage = '2nd Payment';
        } else if (paymentCount === 3) {
            nextStage = '3rd Payment';
        } else {
            nextStage = `${paymentCount}th Payment`;
        }

        setPaymentForm({
            payment_stage: nextStage,
            amount: contract.balance_due > 0 ? String(contract.balance_due) : '',
            payment_date: new Date().toISOString().split('T')[0],
            payment_mode: 'Cash',
            status: 'Paid',
            notes: '',
            receipt_proof: ''
        });
        setShowPaymentModal(true);
    };

    const openEditPaymentModal = (contract: ContractItem, payment: PaymentItem) => {
        setSelectedContract(contract);
        setEditingPayment(payment);
        setPaymentForm({
            payment_stage: payment.payment_stage,
            amount: String(payment.amount),
            payment_date: payment.payment_date,
            payment_mode: payment.payment_mode,
            status: payment.status,
            notes: payment.notes || '',
            receipt_proof: payment.receipt_proof || ''
        });
        setShowPaymentModal(true);
    };

    // Save Payment Installment (Add or Edit)
    const handleSavePayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedContract) return;
        if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
            alert('Please enter a valid amount');
            return;
        }

        try {
            setSubmitting(true);
            if (editingPayment) {
                // Update
                const payload = {
                    id: editingPayment.id,
                    payment_stage: paymentForm.payment_stage,
                    amount: parseFloat(paymentForm.amount),
                    payment_date: paymentForm.payment_date,
                    payment_mode: paymentForm.payment_mode,
                    status: paymentForm.status,
                    notes: paymentForm.notes.trim(),
                    receipt_proof: paymentForm.receipt_proof || null
                };
                const res = await axios.put(`${API_BASE_URL}/contracts-labor/payments`, payload);
                if (res.data && res.data.success) {
                    setShowPaymentModal(false);
                    fetchContracts();
                } else {
                    alert(res.data?.message || 'Failed to update payment');
                }
            } else {
                // Create
                const payload = {
                    contract_id: selectedContract.id,
                    project_id: projectId,
                    payment_stage: paymentForm.payment_stage,
                    amount: parseFloat(paymentForm.amount),
                    payment_date: paymentForm.payment_date,
                    payment_mode: paymentForm.payment_mode,
                    status: paymentForm.status,
                    receipt_proof: paymentForm.receipt_proof || null,
                    notes: paymentForm.notes.trim(),
                    recorded_by: user?.name || user?.username || 'User'
                };
                const res = await axios.post(`${API_BASE_URL}/contracts-labor/payments`, payload);
                if (res.data && res.data.success) {
                    setShowPaymentModal(false);
                    fetchContracts();
                } else {
                    alert(res.data?.message || 'Failed to record payment');
                }
            }
        } catch (err: any) {
            alert(err?.response?.data?.message || 'Error recording payment');
        } finally {
            setSubmitting(false);
        }
    };

    // Delete Payment Installment
    const handleDeletePayment = async (paymentId: number) => {
        if (!window.confirm('Are you sure you want to delete this payment installment?')) return;
        try {
            const res = await axios.delete(`${API_BASE_URL}/contracts-labor/payments?id=${paymentId}`);
            if (res.data && res.data.success) {
                fetchContracts();
            } else {
                alert(res.data?.message || 'Failed to delete payment');
            }
        } catch (err: any) {
            alert(err?.response?.data?.message || 'Error deleting payment');
        }
    };

    // Filtered contracts
    const filteredContracts = useMemo(() => {
        return contracts.filter(c => {
            if (typeFilter !== 'ALL' && c.party_type !== typeFilter) return false;
            if (statusFilter === 'PAID' && !c.is_fully_paid) return false;
            if (statusFilter === 'PENDING' && c.is_fully_paid) return false;
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchName = (c.party_name || '').toLowerCase().includes(q);
                const matchTrade = (c.work_trade || '').toLowerCase().includes(q);
                const matchPhone = (c.phone || '').toLowerCase().includes(q);
                if (!matchName && !matchTrade && !matchPhone) return false;
            }
            return true;
        });
    }, [contracts, typeFilter, statusFilter, searchQuery]);

    // CSV Export
    const exportCSV = () => {
        if (contracts.length === 0) {
            alert('No contract data to export');
            return;
        }

        const headers = [
            'Party Name',
            'Type',
            'Trade',
            'Phone',
            'Contract Amount (₹)',
            'Total Paid (₹)',
            'Balance Due (₹)',
            'Status',
            'Installment Stage',
            'Installment Amount (₹)',
            'Payment Date',
            'Payment Mode',
            'Payment Status',
            'Notes'
        ];

        const rows: any[] = [];
        contracts.forEach(c => {
            if (c.payments.length === 0) {
                rows.push([
                    `"${c.party_name}"`,
                    `"${c.party_type}"`,
                    `"${c.work_trade || ''}"`,
                    `"${c.phone || ''}"`,
                    c.contract_amount,
                    c.total_paid,
                    c.balance_due,
                    `"${c.status}"`,
                    'No payments recorded',
                    0,
                    '',
                    '',
                    '',
                    `"${(c.notes || '').replace(/"/g, '""')}"`
                ]);
            } else {
                c.payments.forEach(p => {
                    rows.push([
                        `"${c.party_name}"`,
                        `"${c.party_type}"`,
                        `"${c.work_trade || ''}"`,
                        `"${c.phone || ''}"`,
                        c.contract_amount,
                        c.total_paid,
                        c.balance_due,
                        `"${c.status}"`,
                        `"${p.payment_stage}"`,
                        p.amount,
                        p.payment_date,
                        `"${p.payment_mode}"`,
                        `"${p.status}"`,
                        `"${(p.notes || '').replace(/"/g, '""')}"`
                    ]);
                });
            }
        });

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `Project_${project?.project_code || projectId}_Contracts_Labor.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Top KPI Statistics Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                {/* 1. Assigned Parties Summary */}
                <div style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '14px',
                    padding: '20px',
                    border: '1.5px solid #e2e8f0',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div>
                            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Assigned Parties
                            </span>
                            <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#0c1527', marginTop: '4px' }}>
                                {summary.total_assigned}
                            </div>
                        </div>
                        <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Users size={22} color="#0284c7" />
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', backgroundColor: '#ecfdf5', color: '#059669' }}>
                            Labour: {summary.counts_by_type.Labour || 0}
                        </span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', backgroundColor: '#eff6ff', color: '#2563eb' }}>
                            Contractors: {summary.counts_by_type.Contractor || 0}
                        </span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', backgroundColor: '#fffbeb', color: '#d97706' }}>
                            Vendors: {summary.counts_by_type.Vendor || 0}
                        </span>
                    </div>
                </div>

                {/* 2. Total Agreed Contracts */}
                <div style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '14px',
                    padding: '20px',
                    border: '1.5px solid #e2e8f0',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Total Agreed Contracts
                            </span>
                            <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#0c1527', marginTop: '4px' }}>
                                ₹{summary.total_contract_amount.toLocaleString('en-IN')}
                            </div>
                        </div>
                        <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FileText size={22} color="#ea580c" />
                        </div>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #f1f5f9', fontWeight: 600 }}>
                        Across all {summary.total_assigned} assigned vendor & labor parties
                    </div>
                </div>

                {/* 3. Total Amount Paid */}
                <div style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '14px',
                    padding: '20px',
                    border: '1.5px solid #e2e8f0',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Total Amount Paid
                            </span>
                            <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>
                                ₹{summary.total_paid.toLocaleString('en-IN')}
                            </div>
                        </div>
                        <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <CheckCircle2 size={22} color="#10b981" />
                        </div>
                    </div>
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 700, color: '#64748b', marginTop: '8px' }}>
                            <span>Paid Progress</span>
                            <span>
                                {summary.total_contract_amount > 0 ? Math.round((summary.total_paid / summary.total_contract_amount) * 100) : 0}%
                            </span>
                        </div>
                        <div style={{ width: '100%', height: '6px', backgroundColor: '#f1f5f9', borderRadius: '4px', overflow: 'hidden', marginTop: '4px' }}>
                            <div style={{
                                width: `${Math.min(100, summary.total_contract_amount > 0 ? (summary.total_paid / summary.total_contract_amount) * 100 : 0)}%`,
                                height: '100%',
                                backgroundColor: '#10b981',
                                borderRadius: '4px'
                            }} />
                        </div>
                    </div>
                </div>

                {/* 4. Total Balance Due */}
                <div style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '14px',
                    padding: '20px',
                    border: '1.5px solid #ffe8c2',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Total Balance Due
                            </span>
                            <div style={{ fontSize: '1.9rem', fontWeight: 800, color: summary.total_balance_due > 0 ? '#d97706' : '#10b981', marginTop: '4px' }}>
                                ₹{summary.total_balance_due.toLocaleString('en-IN')}
                            </div>
                        </div>
                        <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Clock size={22} color="#d97706" />
                        </div>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #fef3c7', fontWeight: 600 }}>
                        {summary.total_balance_due > 0 ? 'Remaining to be disbursed on milestone completion' : 'All agreed contracts settled'}
                    </div>
                </div>
            </div>

            {/* Filter and Action Bar */}
            <div style={{
                backgroundColor: '#ffffff',
                borderRadius: '14px',
                padding: '16px 20px',
                border: '1.5px solid #ffe8c2',
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', flex: 1 }}>
                    {/* Search Input */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        backgroundColor: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        borderRadius: '10px',
                        padding: '8px 14px',
                        gap: '8px',
                        minWidth: '220px'
                    }}>
                        <Search size={16} color="#64748b" />
                        <input
                            type="text"
                            placeholder="Search party, trade, phone..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                border: 'none',
                                background: 'transparent',
                                outline: 'none',
                                fontSize: '0.88rem',
                                color: '#0f172a',
                                width: '100%'
                            }}
                        />
                        {searchQuery && (
                            <X size={14} color="#94a3b8" style={{ cursor: 'pointer' }} onClick={() => setSearchQuery('')} />
                        )}
                    </div>

                    {/* Type Filter Pills */}
                    <div style={{ display: 'flex', gap: '6px', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
                        {(['ALL', 'Labour', 'Contractor', 'Vendor'] as const).map(type => (
                            <button
                                key={type}
                                onClick={() => setTypeFilter(type)}
                                style={{
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '6px 12px',
                                    fontSize: '0.8rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    backgroundColor: typeFilter === type ? '#0c1527' : 'transparent',
                                    color: typeFilter === type ? '#ffffff' : '#64748b',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                {type === 'ALL' ? 'All Parties' : type === 'Vendor' ? 'Material Vendor' : type}
                            </button>
                        ))}
                    </div>

                    {/* Status Filter */}
                    <select
                        value={statusFilter}
                        onChange={(e: any) => setStatusFilter(e.target.value)}
                        style={{
                            padding: '8px 12px',
                            borderRadius: '10px',
                            border: '1px solid #cbd5e1',
                            backgroundColor: '#ffffff',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            color: '#334155',
                            outline: 'none',
                            cursor: 'pointer'
                        }}
                    >
                        <option value="ALL">All Payment Statuses</option>
                        <option value="PENDING">Pending Balance Due</option>
                        <option value="PAID">Fully Paid</option>
                    </select>
                </div>

                {/* Right side buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                        onClick={exportCSV}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 14px',
                            borderRadius: '10px',
                            border: '1.5px solid #e2e8f0',
                            backgroundColor: '#ffffff',
                            color: '#334155',
                            fontSize: '0.85rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                        }}
                        title="Export ledger as CSV"
                    >
                        <Download size={15} /> Export CSV
                    </button>

                    <button
                        onClick={() => window.print()}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 14px',
                            borderRadius: '10px',
                            border: '1.5px solid #e2e8f0',
                            backgroundColor: '#ffffff',
                            color: '#334155',
                            fontSize: '0.85rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                        }}
                        title="Print contracts and labor ledger"
                    >
                        <Printer size={15} /> Print
                    </button>

                    {isAuthorized && (
                        <button
                            onClick={() => setShowAssignModal(true)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '9px 18px',
                                borderRadius: '10px',
                                border: 'none',
                                backgroundColor: '#fca412',
                                color: '#0c1527',
                                fontSize: '0.88rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                boxShadow: '0 2px 8px rgba(252, 164, 18, 0.25)'
                            }}
                        >
                            <Plus size={18} /> Assign Contract / Party
                        </button>
                    )}
                </div>
            </div>

            {/* Contracts List */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '60px', backgroundColor: '#ffffff', borderRadius: '14px', border: '1.5px solid #e2e8f0' }}>
                    <Clock className="animate-spin" size={36} color="#fca412" style={{ margin: '0 auto 12px' }} />
                    <p style={{ color: '#64748b', fontWeight: 600 }}>Loading assigned contracts & payment installments...</p>
                </div>
            ) : filteredContracts.length === 0 ? (
                <div style={{
                    textAlign: 'center',
                    padding: '60px 20px',
                    backgroundColor: '#ffffff',
                    borderRadius: '14px',
                    border: '1.5px dashed #cbd5e1'
                }}>
                    <Building2 size={44} color="#94a3b8" style={{ margin: '0 auto 12px' }} />
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0c1527', marginBottom: '6px' }}>
                        No Contracts or Labour Found
                    </h3>
                    <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '500px', margin: '0 auto 16px' }}>
                        Assign material vendors, carpenters, painters, electricians, or contractors to track their agreed contract amount and installments (e.g. Advance 5k + 1st payment 10k).
                    </p>
                    {isAuthorized && (
                        <button
                            onClick={() => setShowAssignModal(true)}
                            style={{
                                padding: '10px 20px',
                                borderRadius: '10px',
                                border: 'none',
                                backgroundColor: '#0c1527',
                                color: '#ffffff',
                                fontSize: '0.88rem',
                                fontWeight: 700,
                                cursor: 'pointer'
                            }}
                        >
                            + Assign First Party / Contract
                        </button>
                    )}
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {filteredContracts.map(contract => {
                        const isExpanded = expandedCards[contract.id] !== false;
                        const percentPaid = contract.contract_amount > 0 ? Math.round((contract.total_paid / contract.contract_amount) * 100) : 0;
                        
                        // Badge color styling by party type
                        const typeBadgeStyle = contract.party_type === 'Labour'
                            ? { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0', icon: <Hammer size={14} /> }
                            : contract.party_type === 'Contractor'
                            ? { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe', icon: <Building2 size={14} /> }
                            : { bg: '#fffbeb', text: '#d97706', border: '#fde68a', icon: <Truck size={14} /> };

                        return (
                            <div
                                key={contract.id}
                                style={{
                                    backgroundColor: '#ffffff',
                                    borderRadius: '14px',
                                    border: contract.is_fully_paid ? '1.5px solid #bbf7d0' : '1.5px solid #e2e8f0',
                                    boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                                    overflow: 'hidden',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                {/* Contract Header */}
                                <div style={{
                                    padding: '18px 22px',
                                    backgroundColor: '#ffffff',
                                    borderBottom: isExpanded ? '1px solid #f1f5f9' : 'none',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    flexWrap: 'wrap',
                                    gap: '14px'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                                        {/* Type badge */}
                                        <span style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '5px',
                                            fontSize: '0.78rem',
                                            fontWeight: 800,
                                            padding: '4px 10px',
                                            borderRadius: '8px',
                                            backgroundColor: typeBadgeStyle.bg,
                                            color: typeBadgeStyle.text,
                                            border: `1px solid ${typeBadgeStyle.border}`
                                        }}>
                                            {typeBadgeStyle.icon}
                                            {contract.party_type === 'Vendor' ? 'Material Vendor' : contract.party_type}
                                        </span>

                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0c1527' }}>
                                                    {contract.party_name}
                                                </h3>
                                                {contract.is_fully_paid && (
                                                    <span style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        fontSize: '0.72rem',
                                                        fontWeight: 800,
                                                        padding: '2px 8px',
                                                        borderRadius: '6px',
                                                        backgroundColor: '#dcfce7',
                                                        color: '#166534'
                                                    }}>
                                                        <ShieldCheck size={12} /> FULLY PAID
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px', flexWrap: 'wrap' }}>
                                                {contract.work_trade && (
                                                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}>
                                                        Trade: <strong style={{ color: '#0f172a' }}>{contract.work_trade}</strong>
                                                    </span>
                                                )}
                                                {contract.phone && (
                                                    <a
                                                        href={`tel:${contract.phone}`}
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                            fontSize: '0.82rem',
                                                            color: '#2563eb',
                                                            textDecoration: 'none',
                                                            fontWeight: 600
                                                        }}
                                                    >
                                                        <Phone size={13} /> {contract.phone}
                                                    </a>
                                                )}
                                                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                                    Status: <strong>{contract.status}</strong>
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action buttons & collapse toggle */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {isAuthorized && (
                                            <>
                                                <button
                                                    onClick={() => openAddPaymentModal(contract)}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        padding: '7px 14px',
                                                        borderRadius: '8px',
                                                        border: 'none',
                                                        backgroundColor: '#0c1527',
                                                        color: '#ffffff',
                                                        fontSize: '0.82rem',
                                                        fontWeight: 700,
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    <Plus size={14} /> Add Installment
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setSelectedContract(contract);
                                                        setShowEditContractModal(true);
                                                    }}
                                                    style={{
                                                        padding: '7px 10px',
                                                        borderRadius: '8px',
                                                        border: '1px solid #e2e8f0',
                                                        backgroundColor: '#f8fafc',
                                                        color: '#475569',
                                                        cursor: 'pointer'
                                                    }}
                                                    title="Edit contract details"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteContract(contract)}
                                                    style={{
                                                        padding: '7px 10px',
                                                        borderRadius: '8px',
                                                        border: '1px solid #fee2e2',
                                                        backgroundColor: '#fff5f5',
                                                        color: '#ef4444',
                                                        cursor: 'pointer'
                                                    }}
                                                    title="Delete contract"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </>
                                        )}
                                        <button
                                            onClick={() => toggleExpand(contract.id)}
                                            style={{
                                                padding: '7px 10px',
                                                borderRadius: '8px',
                                                border: '1px solid #e2e8f0',
                                                backgroundColor: '#f8fafc',
                                                color: '#64748b',
                                                cursor: 'pointer'
                                            }}
                                            title={isExpanded ? 'Collapse' : 'Expand'}
                                        >
                                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                        </button>
                                    </div>
                                </div>

                                {/* Financial Ledger Bar for this party */}
                                <div style={{
                                    padding: '14px 22px',
                                    backgroundColor: '#f8fafc',
                                    borderBottom: isExpanded ? '1px solid #e2e8f0' : 'none',
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                                    gap: '12px',
                                    alignItems: 'center'
                                }}>
                                    <div>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                                            Agreed Contract
                                        </span>
                                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0c1527', marginTop: '2px' }}>
                                            ₹{contract.contract_amount.toLocaleString('en-IN')}
                                        </div>
                                    </div>

                                    <div>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                                            Total Paid ({contract.payments.length} installments)
                                        </span>
                                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981', marginTop: '2px' }}>
                                            ₹{contract.total_paid.toLocaleString('en-IN')}
                                        </div>
                                    </div>

                                    <div>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                                            Balance Due
                                        </span>
                                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: contract.balance_due > 0 ? '#d97706' : '#10b981', marginTop: '2px' }}>
                                            ₹{contract.balance_due.toLocaleString('en-IN')}
                                        </div>
                                    </div>

                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                                            <span>Installment Payout</span>
                                            <span>{percentPaid}%</span>
                                        </div>
                                        <div style={{ width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                            <div style={{
                                                width: `${Math.min(100, percentPaid)}%`,
                                                height: '100%',
                                                backgroundColor: percentPaid >= 100 ? '#10b981' : '#fca412',
                                                borderRadius: '4px',
                                                transition: 'width 0.3s ease'
                                            }} />
                                        </div>
                                    </div>
                                </div>

                                {/* Installments Ledger Breakdown */}
                                {isExpanded && (
                                    <div style={{ padding: '20px 22px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                            <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                Payment Installments Breakdown
                                            </h4>
                                            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                                e.g. Advance ₹5k + 1st payment ₹10k
                                            </span>
                                        </div>

                                        {contract.payments.length === 0 ? (
                                            <div style={{
                                                padding: '24px',
                                                textAlign: 'center',
                                                backgroundColor: '#f8fafc',
                                                borderRadius: '10px',
                                                border: '1px dashed #cbd5e1'
                                            }}>
                                                <p style={{ margin: '0 0 10px', fontSize: '0.88rem', color: '#64748b', fontWeight: 600 }}>
                                                    No installments logged yet for this contract.
                                                </p>
                                                {isAuthorized && (
                                                    <button
                                                        onClick={() => openAddPaymentModal(contract)}
                                                        style={{
                                                            padding: '7px 16px',
                                                            borderRadius: '8px',
                                                            border: 'none',
                                                            backgroundColor: '#0c1527',
                                                            color: '#ffffff',
                                                            fontSize: '0.82rem',
                                                            fontWeight: 700,
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        + Record Initial Advance / 1st Payment
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            <div style={{ overflowX: 'auto' }}>
                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                                                    <thead>
                                                        <tr style={{ backgroundColor: '#f1f5f9', color: '#475569', textAlign: 'left', borderBottom: '1px solid #cbd5e1' }}>
                                                            <th style={{ padding: '10px 14px', borderRadius: '6px 0 0 0' }}>Stage</th>
                                                            <th style={{ padding: '10px 14px' }}>Amount (₹)</th>
                                                            <th style={{ padding: '10px 14px' }}>Date</th>
                                                            <th style={{ padding: '10px 14px' }}>Payment Mode</th>
                                                            <th style={{ padding: '10px 14px' }}>Status</th>
                                                            <th style={{ padding: '10px 14px' }}>Receipt / Bill</th>
                                                            <th style={{ padding: '10px 14px' }}>Notes / Remarks</th>
                                                            {isAuthorized && <th style={{ padding: '10px 14px', textAlign: 'right', borderRadius: '0 6px 0 0' }}>Actions</th>}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {contract.payments.map((p, idx) => {
                                                            const isAdvance = p.payment_stage.toLowerCase().includes('advance');
                                                            return (
                                                                <tr
                                                                    key={p.id}
                                                                    style={{
                                                                        borderBottom: '1px solid #f1f5f9',
                                                                        backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafafa'
                                                                    }}
                                                                >
                                                                    {/* Stage Badge */}
                                                                    <td style={{ padding: '12px 14px', fontWeight: 700 }}>
                                                                        <span style={{
                                                                            display: 'inline-block',
                                                                            padding: '4px 10px',
                                                                            borderRadius: '6px',
                                                                            fontSize: '0.78rem',
                                                                            fontWeight: 800,
                                                                            backgroundColor: isAdvance ? '#fef3c7' : '#e0e7ff',
                                                                            color: isAdvance ? '#b45309' : '#3730a3',
                                                                            border: isAdvance ? '1px solid #fde68a' : '1px solid #c7d2fe'
                                                                        }}>
                                                                            {p.payment_stage}
                                                                        </span>
                                                                    </td>

                                                                    {/* Amount */}
                                                                    <td style={{ padding: '12px 14px', fontWeight: 800, color: '#0c1527', fontSize: '0.95rem' }}>
                                                                        ₹{p.amount.toLocaleString('en-IN')}
                                                                    </td>

                                                                    {/* Date */}
                                                                    <td style={{ padding: '12px 14px', color: '#475569' }}>
                                                                        {p.payment_date}
                                                                    </td>

                                                                    {/* Mode */}
                                                                    <td style={{ padding: '12px 14px' }}>
                                                                        <span style={{
                                                                            padding: '3px 8px',
                                                                            borderRadius: '6px',
                                                                            fontSize: '0.75rem',
                                                                            fontWeight: 700,
                                                                            backgroundColor: '#f1f5f9',
                                                                            color: '#334155'
                                                                        }}>
                                                                            {p.payment_mode}
                                                                        </span>
                                                                    </td>

                                                                    {/* Status */}
                                                                    <td style={{ padding: '12px 14px' }}>
                                                                        <span style={{
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center',
                                                                            gap: '4px',
                                                                            padding: '3px 8px',
                                                                            borderRadius: '6px',
                                                                            fontSize: '0.75rem',
                                                                            fontWeight: 700,
                                                                            backgroundColor: p.status === 'Paid' ? '#dcfce7' : '#fef3c7',
                                                                            color: p.status === 'Paid' ? '#15803d' : '#b45309'
                                                                        }}>
                                                                            {p.status === 'Paid' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                                                                            {p.status}
                                                                        </span>
                                                                    </td>

                                                                    {/* Proof */}
                                                                    <td style={{ padding: '12px 14px' }}>
                                                                        {p.receipt_proof ? (
                                                                            <button
                                                                                onClick={() => setViewProofModal(p.receipt_proof!)}
                                                                                style={{
                                                                                    display: 'flex',
                                                                                    alignItems: 'center',
                                                                                    gap: '4px',
                                                                                    padding: '4px 8px',
                                                                                    borderRadius: '6px',
                                                                                    border: '1px solid #cbd5e1',
                                                                                    backgroundColor: '#ffffff',
                                                                                    color: '#2563eb',
                                                                                    fontSize: '0.75rem',
                                                                                    fontWeight: 700,
                                                                                    cursor: 'pointer'
                                                                                }}
                                                                            >
                                                                                <Eye size={12} /> View Proof
                                                                            </button>
                                                                        ) : (
                                                                            <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>None</span>
                                                                        )}
                                                                    </td>

                                                                    {/* Notes */}
                                                                    <td style={{ padding: '12px 14px', color: '#64748b', fontSize: '0.82rem', maxWidth: '200px' }}>
                                                                        {p.notes || '-'}
                                                                    </td>

                                                                    {/* Actions */}
                                                                    {isAuthorized && (
                                                                        <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                                                                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                                                                                <button
                                                                                    onClick={() => openEditPaymentModal(contract, p)}
                                                                                    style={{
                                                                                        padding: '5px 8px',
                                                                                        borderRadius: '6px',
                                                                                        border: '1px solid #e2e8f0',
                                                                                        backgroundColor: '#f8fafc',
                                                                                        color: '#475569',
                                                                                        cursor: 'pointer'
                                                                                    }}
                                                                                    title="Edit installment"
                                                                                >
                                                                                    <Edit2 size={12} />
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => handleDeletePayment(p.id)}
                                                                                    style={{
                                                                                        padding: '5px 8px',
                                                                                        borderRadius: '6px',
                                                                                        border: '1px solid #fee2e2',
                                                                                        backgroundColor: '#fff5f5',
                                                                                        color: '#ef4444',
                                                                                        cursor: 'pointer'
                                                                                    }}
                                                                                    title="Delete installment"
                                                                                >
                                                                                    <Trash2 size={12} />
                                                                                </button>
                                                                            </div>
                                                                        </td>
                                                                    )}
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}

                                        {contract.notes && (
                                            <div style={{
                                                marginTop: '14px',
                                                padding: '10px 14px',
                                                backgroundColor: '#f8fafc',
                                                borderRadius: '8px',
                                                border: '1px solid #e2e8f0',
                                                fontSize: '0.82rem',
                                                color: '#475569'
                                            }}>
                                                <strong style={{ color: '#0f172a' }}>Contract Terms / Scope Notes:</strong> {contract.notes}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* MODAL 1: Assign Contract / Party */}
            {showAssignModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(12, 21, 39, 0.7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    padding: '20px'
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '16px',
                        width: '100%',
                        maxWidth: '620px',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        padding: '24px',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '14px' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0c1527' }}>
                                    Assign Contract / Party to Project
                                </h3>
                                <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                                    Project: {project?.project_code || project?.project_name || `#${projectId}`}
                                </p>
                            </div>
                            <button
                                onClick={() => setShowAssignModal(false)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateContract} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* Party Type Select */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                                    Party Type *
                                </label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                                    {(['Labour', 'Contractor', 'Vendor'] as const).map(type => (
                                        <button
                                            type="button"
                                            key={type}
                                            onClick={() => setContractForm(prev => ({ ...prev, party_type: type }))}
                                            style={{
                                                padding: '10px',
                                                borderRadius: '8px',
                                                border: contractForm.party_type === type ? '2px solid #0c1527' : '1px solid #cbd5e1',
                                                backgroundColor: contractForm.party_type === type ? '#0c1527' : '#ffffff',
                                                color: contractForm.party_type === type ? '#ffffff' : '#334155',
                                                fontSize: '0.82rem',
                                                fontWeight: 800,
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {type === 'Vendor' ? 'Material Vendor' : type}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Party Name with Autocomplete */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                                    Party / Company / Contractor Name *
                                </label>
                                <input
                                    type="text"
                                    list="global-party-suggestions"
                                    placeholder="e.g. Ramesh Carpenter, Shree Sai Pop Works, Greenlam Laminates"
                                    value={contractForm.party_name}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setContractForm(prev => ({ ...prev, party_name: val }));
                                        // Auto-match phone / trade if matched in global vendors
                                        const matched = globalVendors.find(v => (v.name || v.vendor_name || '').toLowerCase() === val.toLowerCase());
                                        if (matched) {
                                            setContractForm(prev => ({
                                                ...prev,
                                                phone: matched.phone || matched.contact_person_phone || prev.phone,
                                                work_trade: matched.category || matched.trade || prev.work_trade
                                            }));
                                        }
                                    }}
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '10px 14px',
                                        borderRadius: '8px',
                                        border: '1.5px solid #cbd5e1',
                                        fontSize: '0.88rem',
                                        outline: 'none',
                                        boxSizing: 'border-box'
                                    }}
                                />
                                <datalist id="global-party-suggestions">
                                    {globalVendors.map((v, i) => (
                                        <option key={i} value={v.name || v.vendor_name || v.title} />
                                    ))}
                                </datalist>
                            </div>

                            {/* Work Trade & Phone in 2 columns */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                                        Work / Trade / Category
                                    </label>
                                    <input
                                        type="text"
                                        list="trade-suggestions"
                                        placeholder="e.g. Carpentry, False Ceiling, POP"
                                        value={contractForm.work_trade}
                                        onChange={(e) => setContractForm(prev => ({ ...prev, work_trade: e.target.value }))}
                                        style={{
                                            width: '100%',
                                            padding: '10px 14px',
                                            borderRadius: '8px',
                                            border: '1.5px solid #cbd5e1',
                                            fontSize: '0.88rem',
                                            outline: 'none',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                    <datalist id="trade-suggestions">
                                        {COMMON_TRADES.map((t, idx) => (
                                            <option key={idx} value={t} />
                                        ))}
                                    </datalist>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                                        Contact Phone
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. 9876543210"
                                        value={contractForm.phone}
                                        onChange={(e) => setContractForm(prev => ({ ...prev, phone: e.target.value }))}
                                        style={{
                                            width: '100%',
                                            padding: '10px 14px',
                                            borderRadius: '8px',
                                            border: '1.5px solid #cbd5e1',
                                            fontSize: '0.88rem',
                                            outline: 'none',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Agreed Contract Amount */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                                    Agreed Contract Amount (₹) *
                                </label>
                                <input
                                    type="number"
                                    placeholder="e.g. 10000"
                                    min="1"
                                    step="any"
                                    value={contractForm.contract_amount}
                                    onChange={(e) => setContractForm(prev => ({ ...prev, contract_amount: e.target.value }))}
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '10px 14px',
                                        borderRadius: '8px',
                                        border: '1.5px solid #cbd5e1',
                                        fontSize: '1rem',
                                        fontWeight: 800,
                                        color: '#0c1527',
                                        outline: 'none',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>

                            {/* Optional Initial Advance Toggle */}
                            <div style={{
                                padding: '14px',
                                borderRadius: '10px',
                                backgroundColor: '#f8fafc',
                                border: '1.5px solid #e2e8f0'
                            }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem', color: '#0c1527' }}>
                                    <input
                                        type="checkbox"
                                        checked={contractForm.with_advance}
                                        onChange={(e) => setContractForm(prev => ({ ...prev, with_advance: e.target.checked }))}
                                        style={{ width: '16px', height: '16px' }}
                                    />
                                    Record Initial Advance / 1st Payment Now
                                </label>

                                {contractForm.with_advance && (
                                    <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                                                    Advance Amount (₹)
                                                </label>
                                                <input
                                                    type="number"
                                                    placeholder="e.g. 5000"
                                                    min="1"
                                                    step="any"
                                                    value={contractForm.advance_amount}
                                                    onChange={(e) => setContractForm(prev => ({ ...prev, advance_amount: e.target.value }))}
                                                    style={{
                                                        width: '100%',
                                                        padding: '8px 12px',
                                                        borderRadius: '6px',
                                                        border: '1px solid #cbd5e1',
                                                        fontSize: '0.9rem',
                                                        fontWeight: 700,
                                                        boxSizing: 'border-box'
                                                    }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                                                    Payment Date
                                                </label>
                                                <input
                                                    type="date"
                                                    value={contractForm.advance_date}
                                                    onChange={(e) => setContractForm(prev => ({ ...prev, advance_date: e.target.value }))}
                                                    style={{
                                                        width: '100%',
                                                        padding: '8px 12px',
                                                        borderRadius: '6px',
                                                        border: '1px solid #cbd5e1',
                                                        fontSize: '0.88rem',
                                                        boxSizing: 'border-box'
                                                    }}
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                                                Payment Mode
                                            </label>
                                            <select
                                                value={contractForm.advance_mode}
                                                onChange={(e) => setContractForm(prev => ({ ...prev, advance_mode: e.target.value }))}
                                                style={{
                                                    width: '100%',
                                                    padding: '8px 12px',
                                                    borderRadius: '6px',
                                                    border: '1px solid #cbd5e1',
                                                    fontSize: '0.85rem',
                                                    backgroundColor: '#ffffff'
                                                }}
                                            >
                                                <option value="Cash">Cash</option>
                                                <option value="UPI / GPay">UPI / GPay / PhonePe</option>
                                                <option value="Bank Transfer">Bank Transfer / NEFT / IMPS</option>
                                                <option value="Cheque">Cheque</option>
                                            </select>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Notes */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                                    Contract Scope / Terms / Notes
                                </label>
                                <textarea
                                    rows={2}
                                    placeholder="e.g. Includes materials & labour for 2 bedrooms false ceiling and wiring..."
                                    value={contractForm.notes}
                                    onChange={(e) => setContractForm(prev => ({ ...prev, notes: e.target.value }))}
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        borderRadius: '8px',
                                        border: '1.5px solid #cbd5e1',
                                        fontSize: '0.85rem',
                                        outline: 'none',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>

                            {/* Buttons */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowAssignModal(false)}
                                    style={{
                                        padding: '10px 18px',
                                        borderRadius: '8px',
                                        border: '1px solid #cbd5e1',
                                        backgroundColor: '#ffffff',
                                        color: '#64748b',
                                        fontSize: '0.88rem',
                                        fontWeight: 700,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    style={{
                                        padding: '10px 22px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        backgroundColor: '#fca412',
                                        color: '#0c1527',
                                        fontSize: '0.88rem',
                                        fontWeight: 800,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}
                                >
                                    {submitting ? 'Saving...' : 'Assign Contract'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 2: Add or Edit Payment Installment */}
            {showPaymentModal && selectedContract && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(12, 21, 39, 0.7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    padding: '20px'
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '16px',
                        width: '100%',
                        maxWidth: '560px',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        padding: '24px',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0c1527' }}>
                                    {editingPayment ? 'Edit Payment Installment' : 'Record Payment Installment'}
                                </h3>
                                <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                                    For <strong>{selectedContract.party_name}</strong> ({selectedContract.party_type})
                                </p>
                            </div>
                            <button
                                onClick={() => setShowPaymentModal(false)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Contract summary pill */}
                        <div style={{
                            padding: '12px 14px',
                            backgroundColor: '#f8fafc',
                            borderRadius: '10px',
                            border: '1px solid #e2e8f0',
                            marginBottom: '16px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '0.85rem'
                        }}>
                            <div>
                                <span style={{ color: '#64748b' }}>Contract Amount:</span>{' '}
                                <strong>₹{selectedContract.contract_amount.toLocaleString('en-IN')}</strong>
                            </div>
                            <div>
                                <span style={{ color: '#64748b' }}>Paid so far:</span>{' '}
                                <strong style={{ color: '#10b981' }}>₹{selectedContract.total_paid.toLocaleString('en-IN')}</strong>
                            </div>
                            <div>
                                <span style={{ color: '#64748b' }}>Balance Due:</span>{' '}
                                <strong style={{ color: selectedContract.balance_due > 0 ? '#d97706' : '#10b981' }}>
                                    ₹{selectedContract.balance_due.toLocaleString('en-IN')}
                                </strong>
                            </div>
                        </div>

                        <form onSubmit={handleSavePayment} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            {/* Payment Stage Select */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                                    Installment Stage *
                                </label>
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                                    {STAGE_SUGGESTIONS.map(stage => (
                                        <button
                                            type="button"
                                            key={stage}
                                            onClick={() => setPaymentForm(prev => ({ ...prev, payment_stage: stage }))}
                                            style={{
                                                padding: '5px 10px',
                                                borderRadius: '6px',
                                                border: paymentForm.payment_stage === stage ? '1.5px solid #0c1527' : '1px solid #cbd5e1',
                                                backgroundColor: paymentForm.payment_stage === stage ? '#0c1527' : '#f8fafc',
                                                color: paymentForm.payment_stage === stage ? '#ffffff' : '#475569',
                                                fontSize: '0.78rem',
                                                fontWeight: 700,
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {stage}
                                        </button>
                                    ))}
                                </div>
                                <input
                                    type="text"
                                    placeholder="e.g. Advance, 1st Payment, Final Settlement"
                                    value={paymentForm.payment_stage}
                                    onChange={(e) => setPaymentForm(prev => ({ ...prev, payment_stage: e.target.value }))}
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '9px 12px',
                                        borderRadius: '8px',
                                        border: '1.5px solid #cbd5e1',
                                        fontSize: '0.88rem',
                                        outline: 'none',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>

                            {/* Amount & Date */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                                        Amount (₹) *
                                    </label>
                                    <input
                                        type="number"
                                        placeholder="e.g. 5000"
                                        min="1"
                                        step="any"
                                        value={paymentForm.amount}
                                        onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                                        required
                                        style={{
                                            width: '100%',
                                            padding: '10px 12px',
                                            borderRadius: '8px',
                                            border: '1.5px solid #cbd5e1',
                                            fontSize: '1rem',
                                            fontWeight: 800,
                                            color: '#0c1527',
                                            outline: 'none',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                                        Payment Date *
                                    </label>
                                    <input
                                        type="date"
                                        value={paymentForm.payment_date}
                                        onChange={(e) => setPaymentForm(prev => ({ ...prev, payment_date: e.target.value }))}
                                        required
                                        style={{
                                            width: '100%',
                                            padding: '10px 12px',
                                            borderRadius: '8px',
                                            border: '1.5px solid #cbd5e1',
                                            fontSize: '0.88rem',
                                            outline: 'none',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Mode & Status */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                                        Payment Mode
                                    </label>
                                    <select
                                        value={paymentForm.payment_mode}
                                        onChange={(e) => setPaymentForm(prev => ({ ...prev, payment_mode: e.target.value }))}
                                        style={{
                                            width: '100%',
                                            padding: '9px 12px',
                                            borderRadius: '8px',
                                            border: '1.5px solid #cbd5e1',
                                            fontSize: '0.88rem',
                                            backgroundColor: '#ffffff'
                                        }}
                                    >
                                        <option value="Cash">Cash</option>
                                        <option value="UPI / GPay">UPI / GPay / PhonePe</option>
                                        <option value="Bank Transfer">Bank Transfer / NEFT / IMPS</option>
                                        <option value="Cheque">Cheque</option>
                                    </select>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                                        Status
                                    </label>
                                    <select
                                        value={paymentForm.status}
                                        onChange={(e) => setPaymentForm(prev => ({ ...prev, status: e.target.value }))}
                                        style={{
                                            width: '100%',
                                            padding: '9px 12px',
                                            borderRadius: '8px',
                                            border: '1.5px solid #cbd5e1',
                                            fontSize: '0.88rem',
                                            backgroundColor: '#ffffff'
                                        }}
                                    >
                                        <option value="Paid">Paid</option>
                                        <option value="Pending">Pending</option>
                                    </select>
                                </div>
                            </div>

                            {/* Receipt Proof Upload */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                                    Receipt / Bill / Proof Image
                                </label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <label style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '8px 14px',
                                        borderRadius: '8px',
                                        border: '1.5px dashed #cbd5e1',
                                        backgroundColor: '#f8fafc',
                                        color: '#475569',
                                        fontSize: '0.82rem',
                                        fontWeight: 700,
                                        cursor: 'pointer'
                                    }}>
                                        <Upload size={14} /> Upload Receipt Proof
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleProofUpload}
                                            style={{ display: 'none' }}
                                        />
                                    </label>

                                    {paymentForm.receipt_proof && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <img
                                                src={paymentForm.receipt_proof}
                                                alt="Receipt preview"
                                                style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setPaymentForm(prev => ({ ...prev, receipt_proof: '' }))}
                                                style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 700 }}
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                                    Remarks / Milestone Notes
                                </label>
                                <textarea
                                    rows={2}
                                    placeholder="e.g. 1st installment released after ply carcass installation verified..."
                                    value={paymentForm.notes}
                                    onChange={(e) => setPaymentForm(prev => ({ ...prev, notes: e.target.value }))}
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        borderRadius: '8px',
                                        border: '1.5px solid #cbd5e1',
                                        fontSize: '0.85rem',
                                        outline: 'none',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>

                            {/* Buttons */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowPaymentModal(false)}
                                    style={{
                                        padding: '10px 18px',
                                        borderRadius: '8px',
                                        border: '1px solid #cbd5e1',
                                        backgroundColor: '#ffffff',
                                        color: '#64748b',
                                        fontSize: '0.88rem',
                                        fontWeight: 700,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    style={{
                                        padding: '10px 22px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        backgroundColor: '#0c1527',
                                        color: '#ffffff',
                                        fontSize: '0.88rem',
                                        fontWeight: 800,
                                        cursor: 'pointer'
                                    }}
                                >
                                    {submitting ? 'Saving...' : editingPayment ? 'Update Payment' : 'Record Payment'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 3: Edit Contract */}
            {showEditContractModal && selectedContract && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(12, 21, 39, 0.7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    padding: '20px'
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '16px',
                        width: '100%',
                        maxWidth: '560px',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        padding: '24px',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0c1527' }}>
                                Edit Contract Details
                            </h3>
                            <button
                                onClick={() => setShowEditContractModal(false)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleUpdateContract} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                                    Party / Contractor Name
                                </label>
                                <input
                                    type="text"
                                    value={selectedContract.party_name}
                                    onChange={(e) => setSelectedContract({ ...selectedContract, party_name: e.target.value })}
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '9px 12px',
                                        borderRadius: '8px',
                                        border: '1.5px solid #cbd5e1',
                                        fontSize: '0.88rem',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                                        Party Type
                                    </label>
                                    <select
                                        value={selectedContract.party_type}
                                        onChange={(e: any) => setSelectedContract({ ...selectedContract, party_type: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '9px 12px',
                                            borderRadius: '8px',
                                            border: '1.5px solid #cbd5e1',
                                            fontSize: '0.88rem',
                                            backgroundColor: '#ffffff'
                                        }}
                                    >
                                        <option value="Labour">Labour</option>
                                        <option value="Contractor">Contractor</option>
                                        <option value="Vendor">Material Vendor</option>
                                    </select>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                                        Work / Trade
                                    </label>
                                    <input
                                        type="text"
                                        value={selectedContract.work_trade || ''}
                                        onChange={(e) => setSelectedContract({ ...selectedContract, work_trade: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '9px 12px',
                                            borderRadius: '8px',
                                            border: '1.5px solid #cbd5e1',
                                            fontSize: '0.88rem',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                                        Phone Number
                                    </label>
                                    <input
                                        type="text"
                                        value={selectedContract.phone || ''}
                                        onChange={(e) => setSelectedContract({ ...selectedContract, phone: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '9px 12px',
                                            borderRadius: '8px',
                                            border: '1.5px solid #cbd5e1',
                                            fontSize: '0.88rem',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                                        Agreed Contract (₹)
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        step="any"
                                        value={selectedContract.contract_amount}
                                        onChange={(e) => setSelectedContract({ ...selectedContract, contract_amount: parseFloat(e.target.value) || 0 })}
                                        required
                                        style={{
                                            width: '100%',
                                            padding: '9px 12px',
                                            borderRadius: '8px',
                                            border: '1.5px solid #cbd5e1',
                                            fontSize: '1rem',
                                            fontWeight: 800,
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                                    Status
                                </label>
                                <select
                                    value={selectedContract.status}
                                    onChange={(e) => setSelectedContract({ ...selectedContract, status: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: '9px 12px',
                                        borderRadius: '8px',
                                        border: '1.5px solid #cbd5e1',
                                        fontSize: '0.88rem',
                                        backgroundColor: '#ffffff'
                                    }}
                                >
                                    <option value="In Progress">In Progress</option>
                                    <option value="Completed">Completed</option>
                                    <option value="On Hold">On Hold</option>
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                                    Notes
                                </label>
                                <textarea
                                    rows={2}
                                    value={selectedContract.notes || ''}
                                    onChange={(e) => setSelectedContract({ ...selectedContract, notes: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        borderRadius: '8px',
                                        border: '1.5px solid #cbd5e1',
                                        fontSize: '0.85rem',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowEditContractModal(false)}
                                    style={{
                                        padding: '9px 16px',
                                        borderRadius: '8px',
                                        border: '1px solid #cbd5e1',
                                        backgroundColor: '#ffffff',
                                        color: '#64748b',
                                        fontWeight: 700,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    style={{
                                        padding: '9px 20px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        backgroundColor: '#0c1527',
                                        color: '#ffffff',
                                        fontWeight: 800,
                                        cursor: 'pointer'
                                    }}
                                >
                                    {submitting ? 'Updating...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 4: Image Proof Lightbox */}
            {viewProofModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.85)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10000,
                    padding: '20px'
                }}>
                    <div style={{ position: 'relative', maxWidth: '85vw', maxHeight: '85vh' }}>
                        <button
                            onClick={() => setViewProofModal(null)}
                            style={{
                                position: 'absolute',
                                top: '-38px',
                                right: '-8px',
                                background: 'none',
                                border: 'none',
                                color: '#ffffff',
                                cursor: 'pointer'
                            }}
                        >
                            <X size={28} />
                        </button>
                        <img
                            src={viewProofModal}
                            alt="Receipt proof"
                            style={{
                                maxWidth: '100%',
                                maxHeight: '85vh',
                                objectFit: 'contain',
                                borderRadius: '10px',
                                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)'
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};
export default ContractsLaborTab;
