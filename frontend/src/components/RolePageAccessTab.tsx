import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import {
    LayoutDashboard,
    Clock,
    Briefcase,
    Users,
    Target,
    CheckSquare,
    BarChart3,
    TrendingUp,
    ShoppingCart,
    CreditCard,
    Wallet,
    FileText,
    Receipt,
    Building2,
    Shield,
    Check,
    X,
    RotateCcw,
    Save,
    Search,
    Loader2,
    Eye,
    EyeOff,
    Layers
} from 'lucide-react';

interface RolePageAccessProps {
    teamMembers?: any[];
    onSwitchTab?: (tab: 'page_access' | 'project_tab_access') => void;
}

export const ROLE_COLUMNS: {
    key: string;
    name: string;
    iconText: string;
    bgColor: string;
    textColor: string;
}[] = [
    { key: 'site_engineer', name: 'Site Engineer', iconText: '👷', bgColor: '#dcfce7', textColor: '#15803d' },
    { key: 'site_inspector', name: 'Site Inspector', iconText: '🔍', bgColor: '#ccfbf1', textColor: '#0f766e' },
    { key: 'project_manager', name: 'PM (Project Manager)', iconText: '📋', bgColor: '#ffedd5', textColor: '#c2410c' },
    { key: 'project_head', name: 'Installation Manager', iconText: '🏗️', bgColor: '#e0f2fe', textColor: '#0369a1' },
    { key: 'd1', name: 'D1 Designer', iconText: '🎨', bgColor: '#e0e7ff', textColor: '#4338ca' },
    { key: 'd2', name: 'D2 Designer', iconText: '🎨', bgColor: '#e0e7ff', textColor: '#4338ca' },
    { key: 'associate_designer', name: 'Associate Designer', iconText: '📐', bgColor: '#ede9fe', textColor: '#5b21b6' },
    { key: 'manager', name: 'Design Manager', iconText: '📐', bgColor: '#ede9fe', textColor: '#5b21b6' },
    { key: 'business_associate', name: 'Business Associate', iconText: '💼', bgColor: '#dbeafe', textColor: '#1e40af' },
    { key: 'accountant', name: 'Accountant', iconText: '💰', bgColor: '#fef3c7', textColor: '#a16207' },
    { key: 'sales', name: 'Sales', iconText: '🎯', bgColor: '#fce7f3', textColor: '#be185d' },
    { key: 'marketing_analyst', name: 'Marketing Analyst', iconText: '📊', bgColor: '#fce7f3', textColor: '#9d174d' },
    { key: 'mmt', name: 'MMT (Procurement)', iconText: '📦', bgColor: '#f3e8ff', textColor: '#6b21a8' },
    { key: 'graphic_designer', name: 'Graphic Designer', iconText: '🖌️', bgColor: '#fae8ff', textColor: '#86198f' },
    { key: 'admin', name: 'Admin', iconText: '🛡️', bgColor: '#fee2e2', textColor: '#991b1b' }
];

export const getRoleDashboardPath = (role: string): string => {
    switch (role) {
        case 'site_engineer':
        case 'site_inspector':
        case 'site_inspection':
            return '/site-dashboard';
        case 'project_manager':
            return '/pm-dashboard';
        case 'manager':
            return '/manager-dashboard';
        case 'accountant':
            return '/accountant-dashboard';
        case 'd1':
        case 'd2':
            return '/d1-dashboard';
        case 'associate_designer':
            return '/designer-dashboard';
        case 'marketing_analyst':
            return '/marketing-dashboard';
        case 'mmt':
            return '/mmt-dashboard';
        case 'business_associate':
            return '/mb-dashboard';
        case 'sales':
            return '/dashboard';
        case 'graphic_designer':
        case 'gd':
            return '/gd-dashboard';
        case 'admin':
            return '/overview';
        default:
            return '/dashboard';
    }
};

export interface PageRowItem {
    id: string;
    label: string;
    category: string;
    icon: any;
    getPathForRole: (role: string) => string;
}

export const PAGE_ROWS: PageRowItem[] = [
    // 1. Dashboards & Milestones
    { id: 'dashboard', label: 'Dashboard', category: '1. Dashboards & Milestones', icon: LayoutDashboard, getPathForRole: (role) => getRoleDashboardPath(role) },
    { id: 'project-timelines', label: 'Livincart Project Timelines', category: '1. Dashboards & Milestones', icon: Clock, getPathForRole: () => '/project-timelines' },
    { id: 'mb-tasks', label: 'Tasks & Employee Management', category: '1. Dashboards & Milestones', icon: CheckSquare, getPathForRole: () => '/mb-tasks' },
    { id: 'reports', label: 'Reports & Analytics', category: '1. Dashboards & Milestones', icon: BarChart3, getPathForRole: () => '/reports' },
    { id: 'analysis', label: 'Analysis', category: '1. Dashboards & Milestones', icon: TrendingUp, getPathForRole: () => '/analysis' },

    // 2. Projects & Clients
    { id: 'projects', label: 'Projects', category: '2. Projects & Clients', icon: Briefcase, getPathForRole: () => '/projects' },
    { id: 'clients', label: 'Clients', category: '2. Projects & Clients', icon: Users, getPathForRole: () => '/clients' },

    // 3. Leads & CRM Pipeline
    { id: 'leads', label: 'Leads (Main CRM)', category: '3. Leads & CRM Pipeline', icon: Target, getPathForRole: () => '/leads' },
    { id: 'd1-leads', label: 'D1 / D2 Leads', category: '3. Leads & CRM Pipeline', icon: Target, getPathForRole: () => '/d1-leads' },
    { id: 'site-leads', label: 'Site Leads', category: '3. Leads & CRM Pipeline', icon: Target, getPathForRole: () => '/site-leads' },
    { id: 'mmt-leads', label: 'MMT Leads', category: '3. Leads & CRM Pipeline', icon: Target, getPathForRole: () => '/mmt-leads' },

    // 4. Quotes & Vendors
    { id: 'quotes', label: 'Quotes / Estimations', category: '4. Quotes & Vendors', icon: FileText, getPathForRole: () => '/quotes' },
    { id: 'agreements', label: 'Agreements', category: '4. Quotes & Vendors', icon: FileText, getPathForRole: () => '/agreements' },
    { id: 'global-vendors', label: 'Vendors Directory', category: '4. Quotes & Vendors', icon: ShoppingCart, getPathForRole: () => '/global-vendors' },
    { id: 'vendor-quota', label: 'Vendor Quotation', category: '4. Quotes & Vendors', icon: ShoppingCart, getPathForRole: () => '/vendor-quota' },

    // 5. Finance & Overhead Expenses
    { id: 'finance', label: 'Finance & Site Expenses', category: '5. Finance & Overhead Expenses', icon: CreditCard, getPathForRole: () => '/finance' },
    { id: 'financial-overview', label: 'Financial Overview', category: '5. Finance & Overhead Expenses', icon: Wallet, getPathForRole: () => '/financial-overview' },
    { id: 'company-expenses', label: 'Company Expenses', category: '5. Finance & Overhead Expenses', icon: Building2, getPathForRole: () => '/company-expenses' },
    { id: 'reimbursements', label: 'Reimbursements', category: '5. Finance & Overhead Expenses', icon: Receipt, getPathForRole: () => '/reimbursements' },
    { id: 'staff-reimbursements', label: 'Staff Reimbursements', category: '5. Finance & Overhead Expenses', icon: Wallet, getPathForRole: () => '/staff-reimbursements' },
    { id: 'team', label: 'Team Management', category: '5. Finance & Overhead Expenses', icon: Users, getPathForRole: () => '/team' }
];

export const RolePageAccessTab: React.FC<RolePageAccessProps> = ({ onSwitchTab }) => {
    const [permissions, setPermissions] = useState<Record<string, string[]>>({});
    const [defaultPermissions, setDefaultPermissions] = useState<Record<string, string[]>>({});
    const [loading, setLoading] = useState<boolean>(true);
    const [saving, setSaving] = useState<boolean>(false);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // Fetch permissions from backend
    const fetchPermissions = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${API_BASE_URL}/role-permissions`);
            if (res.data?.success && res.data?.data) {
                setPermissions(res.data.data);
                if (res.data?.defaults) {
                    setDefaultPermissions(res.data.defaults);
                }
                localStorage.setItem('livrcart_role_permissions', JSON.stringify(res.data.data));
            }
        } catch (err: any) {
            console.error('Failed to load permissions:', err);
            setFeedback({ type: 'error', message: 'Failed to load permissions from server.' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPermissions();
    }, []);

    // Filter page rows by search
    const filteredRows = useMemo(() => {
        if (!searchTerm.trim()) return PAGE_ROWS;
        const q = searchTerm.toLowerCase().trim();
        return PAGE_ROWS.filter(p =>
            p.label.toLowerCase().includes(q) ||
            p.category.toLowerCase().includes(q) ||
            p.id.toLowerCase().includes(q)
        );
    }, [searchTerm]);

    // Check if a page is allowed for a given role
    const isPageAllowed = (role: string, page: PageRowItem): boolean => {
        const allowedList = permissions[role] || defaultPermissions[role] || [];
        const rolePath = page.getPathForRole(role);
        return allowedList.includes(rolePath);
    };

    // Toggle a single cell checkbox
    const handleToggleCell = (role: string, page: PageRowItem) => {
        const allowedList = permissions[role] || defaultPermissions[role] || [];
        const rolePath = page.getPathForRole(role);
        const isAllowed = allowedList.includes(rolePath);

        const updated = isAllowed
            ? allowedList.filter(p => p !== rolePath)
            : [...allowedList, rolePath];

        setPermissions(prev => ({
            ...prev,
            [role]: updated
        }));
        setFeedback(null);
    };

    // Column quick actions: select all or clear all for that role
    const handleToggleColumn = (role: string, selectAll: boolean) => {
        const allPaths = selectAll ? PAGE_ROWS.map(p => p.getPathForRole(role)) : [];
        setPermissions(prev => ({
            ...prev,
            [role]: allPaths
        }));
        setFeedback(null);
    };

    // Row quick actions: check or uncheck a page for all roles
    const handleToggleRow = (page: PageRowItem, selectAll: boolean) => {
        setPermissions(prev => {
            const next = { ...prev };
            ROLE_COLUMNS.forEach(r => {
                const current = next[r.key] || defaultPermissions[r.key] || [];
                const rolePath = page.getPathForRole(r.key);
                if (selectAll) {
                    if (!current.includes(rolePath)) {
                        next[r.key] = [...current, rolePath];
                    }
                } else {
                    next[r.key] = current.filter(p => p !== rolePath);
                }
            });
            return next;
        });
        setFeedback(null);
    };

    // Reset all roles back to recommended factory defaults
    const handleResetAllDefaults = () => {
        if (!window.confirm('Reset all roles back to recommended system default access?')) return;
        setPermissions({ ...defaultPermissions });
        setFeedback({
            type: 'success',
            message: 'Reset all roles to default sidebar settings. Click Save to apply.'
        });
    };

    // Save permissions to server
    const handleSavePermissions = async () => {
        try {
            setSaving(true);
            setFeedback(null);

            const res = await axios.post(`${API_BASE_URL}/role-permissions`, {
                permissions: permissions
            });

            if (res.data?.success) {
                localStorage.setItem('livrcart_role_permissions', JSON.stringify(permissions));
                window.dispatchEvent(new Event('livrcart_role_permissions_updated'));

                setFeedback({
                    type: 'success',
                    message: '✅ Role permissions saved successfully! Changes are active in the sidebar.'
                });
            } else {
                setFeedback({
                    type: 'error',
                    message: res.data?.message || 'Failed to save permissions.'
                });
            }
        } catch (err: any) {
            console.error('Save error:', err);
            setFeedback({
                type: 'error',
                message: err.response?.data?.message || 'Error communicating with server.'
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Navigation Switcher: Sidebar Page Access vs Project Details Tabs Access */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                border: '1.5px solid #fed7aa',
                boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                flexWrap: 'wrap',
                gap: '12px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Access Management:
                    </span>
                    <button
                        type="button"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 16px',
                            borderRadius: '8px',
                            border: '1.5px solid rgb(252, 164, 18)',
                            backgroundColor: 'rgb(252, 164, 18)',
                            color: '#ffffff',
                            fontWeight: 800,
                            fontSize: '0.84rem',
                            cursor: 'default',
                            boxShadow: '0 2px 6px rgba(252, 164, 18, 0.35)'
                        }}
                    >
                        <Shield size={14} />
                        <span>🛡️ Sidebar Page Access (Role Wise)</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => onSwitchTab?.('project_tab_access')}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 16px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            backgroundColor: '#f8fafc',
                            color: '#475569',
                            fontWeight: 700,
                            fontSize: '0.84rem',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        <Layers size={14} color="#2563eb" />
                        <span>📋 Project Details Tabs Access (Role Wise)</span>
                    </button>
                </div>

                <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
                    Configure role-wise sidebar page visibility
                </div>
            </div>

            {/* Top Clean Toolbar */}
            <div style={{
                backgroundColor: '#ffffff',
                border: '1.5px solid #e2e8f0',
                borderRadius: '12px',
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '14px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '10px',
                        backgroundColor: '#fff7ed',
                        color: 'rgb(252, 164, 18)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1.5px solid rgba(252, 164, 18, 0.4)'
                    }}>
                        <Shield size={22} />
                    </div>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                            Sidebar Page Access Table (Role-Wise)
                        </h3>
                        <p style={{ margin: '3px 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                            Pages are listed on the left; employee roles are in the columns. Check the box to make a page appear in that role's sidebar.
                        </p>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Search Input */}
                    <div style={{ position: 'relative', width: '220px' }}>
                        <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Filter pages..."
                            style={{
                                width: '100%',
                                padding: '7px 10px 7px 30px',
                                borderRadius: '8px',
                                border: '1px solid #cbd5e1',
                                fontSize: '0.82rem',
                                outline: 'none'
                            }}
                        />
                    </div>

                    <button
                        type="button"
                        onClick={handleResetAllDefaults}
                        style={{
                            padding: '8px 14px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            backgroundColor: '#f8fafc',
                            color: '#475569',
                            fontWeight: 700,
                            fontSize: '0.80rem',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}
                        title="Reset all roles to factory defaults"
                    >
                        <RotateCcw size={13} /> Reset Defaults
                    </button>

                    <button
                        type="button"
                        onClick={handleSavePermissions}
                        disabled={saving}
                        style={{
                            padding: '9px 24px',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: '#16a34a',
                            color: '#ffffff',
                            fontWeight: 800,
                            fontSize: '0.88rem',
                            cursor: saving ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 4px 12px rgba(22, 163, 74, 0.35)'
                        }}
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        Save Page Permissions
                    </button>
                </div>
            </div>

            {/* Notification Alert */}
            {feedback && (
                <div style={{
                    padding: '10px 16px',
                    borderRadius: '8px',
                    backgroundColor: feedback.type === 'success' ? '#f0fdf4' : '#fef2f2',
                    border: `1px solid ${feedback.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
                    color: feedback.type === 'success' ? '#166534' : '#991b1b',
                    fontSize: '0.86rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <span>{feedback.message}</span>
                    <button onClick={() => setFeedback(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
                        <X size={15} />
                    </button>
                </div>
            )}

            {/* THE MASTER PERMISSION TABLE (LEFT = PAGES, TOP = ROLES) */}
            <div style={{
                backgroundColor: '#ffffff',
                border: '1.5px solid #e2e8f0',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
            }}>
                <div style={{ overflowX: 'auto', maxHeight: '720px' }}>
                    <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, textAlign: 'center' }}>
                        
                        {/* Table Header */}
                        <thead style={{ position: 'sticky', top: 0, zIndex: 20, backgroundColor: '#f8fafc' }}>
                            <tr style={{ borderBottom: '2px solid #cbd5e1' }}>
                                
                                {/* 1. Sticky First Column: Page Name */}
                                <th style={{
                                    position: 'sticky',
                                    left: 0,
                                    zIndex: 30,
                                    backgroundColor: '#f8fafc',
                                    padding: '14px 16px',
                                    textAlign: 'left',
                                    fontSize: '0.82rem',
                                    fontWeight: 800,
                                    color: '#0f172a',
                                    textTransform: 'uppercase',
                                    minWidth: '240px',
                                    boxShadow: '3px 0 6px rgba(0,0,0,0.04)',
                                    borderBottom: '2px solid #cbd5e1'
                                }}>
                                    Sidebar Page / Link
                                </th>

                                {/* 2. Role Columns */}
                                {ROLE_COLUMNS.map(role => {
                                    const allowedCount = PAGE_ROWS.filter(p => isPageAllowed(role.key, p)).length;
                                    return (
                                        <th key={role.key} style={{
                                            padding: '12px 10px',
                                            fontSize: '0.76rem',
                                            fontWeight: 800,
                                            color: '#0f172a',
                                            minWidth: '105px',
                                            borderBottom: '2px solid #cbd5e1',
                                            borderLeft: '1px solid #e2e8f0',
                                            backgroundColor: '#f8fafc'
                                        }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                                                <span style={{ fontSize: '1.15rem' }}>{role.iconText}</span>
                                                <span style={{ whiteSpace: 'nowrap', fontWeight: 800, color: role.textColor }}>
                                                    {role.name}
                                                </span>
                                                
                                                {/* Mini badge count */}
                                                <span style={{
                                                    fontSize: '0.66rem',
                                                    fontWeight: 800,
                                                    padding: '1px 6px',
                                                    borderRadius: '999px',
                                                    backgroundColor: role.bgColor,
                                                    color: role.textColor
                                                }}>
                                                    {allowedCount} / {PAGE_ROWS.length}
                                                </span>

                                                {/* Column quick toggle */}
                                                <div style={{ display: 'flex', gap: '4px', marginTop: '3px' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggleColumn(role.key, true)}
                                                        style={{ border: 'none', background: 'none', color: '#16a34a', fontSize: '0.66rem', fontWeight: 800, cursor: 'pointer', padding: 0 }}
                                                        title="Check all for this role"
                                                    >
                                                        All
                                                    </button>
                                                    <span style={{ color: '#cbd5e1' }}>|</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggleColumn(role.key, false)}
                                                        style={{ border: 'none', background: 'none', color: '#dc2626', fontSize: '0.66rem', fontWeight: 800, cursor: 'pointer', padding: 0 }}
                                                        title="Clear all for this role"
                                                    >
                                                        Clear
                                                    </button>
                                                </div>
                                            </div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>

                        {/* Table Body */}
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={ROLE_COLUMNS.length + 1} style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
                                        <Loader2 className="animate-spin" size={28} color="#4f46e5" style={{ margin: '0 auto' }} />
                                        <p style={{ marginTop: '8px', fontSize: '0.84rem' }}>Loading permissions table...</p>
                                    </td>
                                </tr>
                            ) : filteredRows.length === 0 ? (
                                <tr>
                                    <td colSpan={ROLE_COLUMNS.length + 1} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                                        No pages found matching '{searchTerm}'.
                                    </td>
                                </tr>
                            ) : (
                                filteredRows.map((page, idx) => {
                                    const PageIcon = page.icon;

                                    return (
                                        <tr key={page.id} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fbfcfe' }}>
                                            
                                            {/* Sticky First Column: Page Name & Icon */}
                                            <td style={{
                                                position: 'sticky',
                                                left: 0,
                                                zIndex: 10,
                                                backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fbfcfe',
                                                padding: '12px 16px',
                                                textAlign: 'left',
                                                borderBottom: '1px solid #f1f5f9',
                                                boxShadow: '3px 0 6px rgba(0,0,0,0.04)'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <div style={{
                                                            width: '28px',
                                                            height: '28px',
                                                            borderRadius: '6px',
                                                            backgroundColor: '#f1f5f9',
                                                            color: '#475569',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            flexShrink: 0
                                                        }}>
                                                            <PageIcon size={15} />
                                                        </div>
                                                        <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#0f172a' }}>
                                                            {page.label}
                                                        </span>
                                                    </div>

                                                    {/* Row quick action buttons */}
                                                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleToggleRow(page, true)}
                                                            style={{
                                                                padding: '2px 5px',
                                                                fontSize: '0.64rem',
                                                                fontWeight: 700,
                                                                border: '1px solid #cbd5e1',
                                                                borderRadius: '4px',
                                                                backgroundColor: '#f8fafc',
                                                                color: '#16a34a',
                                                                cursor: 'pointer'
                                                            }}
                                                            title="Check this page for all roles"
                                                        >
                                                            All
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleToggleRow(page, false)}
                                                            style={{
                                                                padding: '2px 5px',
                                                                fontSize: '0.64rem',
                                                                fontWeight: 700,
                                                                border: '1px solid #cbd5e1',
                                                                borderRadius: '4px',
                                                                backgroundColor: '#f8fafc',
                                                                color: '#dc2626',
                                                                cursor: 'pointer'
                                                            }}
                                                            title="Uncheck this page for all roles"
                                                        >
                                                            None
                                                        </button>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Role Cells with Checkboxes */}
                                            {ROLE_COLUMNS.map(role => {
                                                const isAllowed = isPageAllowed(role.key, page);

                                                return (
                                                    <td
                                                        key={role.key}
                                                        onClick={() => handleToggleCell(role.key, page)}
                                                        style={{
                                                            padding: '10px 8px',
                                                            borderBottom: '1px solid #f1f5f9',
                                                            borderLeft: '1px solid #f1f5f9',
                                                            backgroundColor: isAllowed ? '#f0fdf4' : 'transparent',
                                                            cursor: 'pointer',
                                                            transition: 'background 0.12s ease'
                                                        }}
                                                        title={`${isAllowed ? 'Visible' : 'Hidden'} for ${role.name}`}
                                                    >
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={isAllowed}
                                                                onChange={() => handleToggleCell(role.key, page)}
                                                                style={{
                                                                    width: '18px',
                                                                    height: '18px',
                                                                    accentColor: '#16a34a',
                                                                    cursor: 'pointer'
                                                                }}
                                                            />
                                                        </div>
                                                    </td>
                                                );
                                            })}

                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Bottom Bar with Save Button */}
                <div style={{
                    padding: '14px 20px',
                    backgroundColor: '#f8fafc',
                    borderTop: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '10px'
                }}>
                    <span style={{ fontSize: '0.80rem', color: '#64748b' }}>
                        💡 Click on any checkbox to toggle page visibility for that role. Click Save when finished.
                    </span>

                    <button
                        type="button"
                        onClick={handleSavePermissions}
                        disabled={saving}
                        style={{
                            padding: '9px 24px',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: '#16a34a',
                            color: '#ffffff',
                            fontWeight: 800,
                            fontSize: '0.88rem',
                            cursor: saving ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 2px 8px rgba(22, 163, 74, 0.35)'
                        }}
                    >
                        {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                        Save Page Permissions
                    </button>
                </div>
            </div>

        </div>
    );
};
