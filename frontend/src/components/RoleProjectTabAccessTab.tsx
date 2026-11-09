import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { ROLE_COLUMNS } from './RolePageAccessTab';
import {
    LayoutDashboard,
    FileText,
    CreditCard,
    CheckSquare,
    Folder,
    Clock,
    Package,
    ShoppingCart,
    Truck,
    HardHat,
    Receipt,
    Wallet,
    RotateCcw,
    Save,
    Search,
    Loader2,
    Shield,
    Layers,
    X,
    Check
} from 'lucide-react';

export interface ProjectTabRowItem {
    id: string;
    label: string;
    category: string;
    icon: any;
    description: string;
}

export const PROJECT_TAB_ROWS: ProjectTabRowItem[] = [
    // 1. Core Project & Commercials
    {
        id: 'overview',
        label: 'Overview',
        category: '1. Core Project & Commercials',
        icon: LayoutDashboard,
        description: 'Project summary, client details, budget & key milestones'
    },
    {
        id: 'quote',
        label: 'Quote / Estimation',
        category: '1. Core Project & Commercials',
        icon: FileText,
        description: 'Quotation editor, revision versions, item rates & specs'
    },
    {
        id: 'balance_sheet',
        label: 'Balance Sheet',
        category: '1. Core Project & Commercials',
        icon: CreditCard,
        description: 'Project cash flow, receipts, payments & profit calculations'
    },

    // 2. Quality & Documentation
    {
        id: 'quality_check',
        label: 'Quality Check (QC)',
        category: '2. Quality & Documentation',
        icon: CheckSquare,
        description: 'QC inspection stages, photos, checklist & punch lists'
    },
    {
        id: 'documents',
        label: 'Documents',
        category: '2. Quality & Documentation',
        icon: Folder,
        description: 'Design files, site photos, 2D/3D drawings & contracts'
    },

    // 3. Execution Timelines
    {
        id: 'timeline',
        label: 'Designer Timeline',
        category: '3. Execution Timelines',
        icon: Clock,
        description: 'Designer drawing release dates & client consultation schedule'
    },
    {
        id: 'pm_timeline',
        label: 'Project Manager Timeline',
        category: '3. Execution Timelines',
        icon: Clock,
        description: 'Site execution milestones, installation & handover tracking'
    },

    // 4. Stock & Procurement
    {
        id: 'stock_category',
        label: 'Stock Category',
        category: '4. Stock & Procurement',
        icon: Package,
        description: 'Factory inventory categories, site allocations & tracking'
    },
    {
        id: 'vendor_quta',
        label: 'Materials Bill (Vendor Quota)',
        category: '4. Stock & Procurement',
        icon: ShoppingCart,
        description: 'Materials billing, purchase orders & vendor delivery slips'
    },

    // 5. Site Expenses & Costing
    {
        id: 'transport',
        label: 'Transport Expenses',
        category: '5. Site Expenses & Costing',
        icon: Truck,
        description: 'Logistics, delivery, freight & vehicle transport expenses'
    },
    {
        id: 'labor',
        label: 'Labor Expenses',
        category: '5. Site Expenses & Costing',
        icon: HardHat,
        description: 'Carpenters, site technicians & contractor wage payments'
    },
    {
        id: 'miscellaneous',
        label: 'Miscellaneous Expenses',
        category: '5. Site Expenses & Costing',
        icon: Receipt,
        description: 'Petty cash, hardware purchases & local emergency expenses'
    },
    {
        id: 'reimbursements',
        label: 'Reimbursements',
        category: '5. Site Expenses & Costing',
        icon: Wallet,
        description: 'Staff travel, site claims & reimbursable bill submissions'
    }
];

interface RoleProjectTabAccessProps {
    teamMembers?: any[];
    onSwitchTab?: (tab: 'page_access' | 'project_tab_access') => void;
}

export const RoleProjectTabAccessTab: React.FC<RoleProjectTabAccessProps> = ({ onSwitchTab }) => {
    const [permissions, setPermissions] = useState<Record<string, string[]>>({});
    const [defaultPermissions, setDefaultPermissions] = useState<Record<string, string[]>>({});
    const [loading, setLoading] = useState<boolean>(true);
    const [saving, setSaving] = useState<boolean>(false);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // Fetch tab permissions from backend
    const fetchTabPermissions = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${API_BASE_URL}/role-tab-permissions`);
            if (res.data?.success && res.data?.data) {
                setPermissions(res.data.data);
                if (res.data?.defaults) {
                    setDefaultPermissions(res.data.defaults);
                }
                localStorage.setItem('livrcart_role_tab_permissions', JSON.stringify(res.data.data));
            }
        } catch (err: any) {
            console.error('Failed to load project tab permissions:', err);
            // Fallback to localStorage or factory defaults
            const cached = localStorage.getItem('livrcart_role_tab_permissions');
            if (cached) {
                try {
                    setPermissions(JSON.parse(cached));
                } catch {
                    // Ignore JSON parse error
                }
            }
            setFeedback({ type: 'error', message: 'Failed to load project tab permissions from server.' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTabPermissions();
    }, []);

    // Filter tab rows by search
    const filteredRows = useMemo(() => {
        if (!searchTerm.trim()) return PROJECT_TAB_ROWS;
        const q = searchTerm.toLowerCase().trim();
        return PROJECT_TAB_ROWS.filter(p =>
            p.label.toLowerCase().includes(q) ||
            p.category.toLowerCase().includes(q) ||
            p.id.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q)
        );
    }, [searchTerm]);

    // Check if a tab is allowed for a given role
    const isTabAllowed = (role: string, tabId: string): boolean => {
        // Admin always has all tabs enabled
        if (role === 'admin') {
            const list = permissions['admin'];
            if (list && list.length > 0) return list.includes(tabId);
            return true;
        }
        const allowedList = permissions[role] || defaultPermissions[role] || [];
        return allowedList.includes(tabId);
    };

    // Toggle a single cell checkbox
    const handleToggleCell = (role: string, tabId: string) => {
        const allowedList = permissions[role] || defaultPermissions[role] || [];
        const isAllowed = allowedList.includes(tabId);

        const updated = isAllowed
            ? allowedList.filter(t => t !== tabId)
            : [...allowedList, tabId];

        setPermissions(prev => ({
            ...prev,
            [role]: updated
        }));
        setFeedback(null);
    };

    // Column quick actions: select all or clear all for that role
    const handleToggleColumn = (role: string, selectAll: boolean) => {
        const allTabIds = selectAll ? PROJECT_TAB_ROWS.map(p => p.id) : [];
        setPermissions(prev => ({
            ...prev,
            [role]: allTabIds
        }));
        setFeedback(null);
    };

    // Row quick actions: check or uncheck a tab for all roles
    const handleToggleRow = (tabId: string, selectAll: boolean) => {
        setPermissions(prev => {
            const next = { ...prev };
            ROLE_COLUMNS.forEach(r => {
                const current = next[r.key] || defaultPermissions[r.key] || [];
                if (selectAll) {
                    if (!current.includes(tabId)) {
                        next[r.key] = [...current, tabId];
                    }
                } else {
                    next[r.key] = current.filter(t => t !== tabId);
                }
            });
            return next;
        });
        setFeedback(null);
    };

    // Reset all roles back to recommended system defaults
    const handleResetAllDefaults = () => {
        if (!window.confirm('Reset all roles back to recommended system default Project Details tab access?')) return;
        setPermissions({ ...defaultPermissions });
        setFeedback({
            type: 'success',
            message: 'Reset all roles to default project tab settings. Click Save to apply.'
        });
    };

    // Save permissions to server
    const handleSavePermissions = async () => {
        try {
            setSaving(true);
            setFeedback(null);

            const res = await axios.post(`${API_BASE_URL}/role-tab-permissions`, {
                permissions: permissions
            });

            if (res.data?.success) {
                localStorage.setItem('livrcart_role_tab_permissions', JSON.stringify(permissions));
                setFeedback({
                    type: 'success',
                    message: 'Project Details Tab permissions saved successfully! All employee roles updated.'
                });
            } else {
                setFeedback({
                    type: 'error',
                    message: res.data?.message || 'Failed to save project tab permissions.'
                });
            }
        } catch (err: any) {
            console.error('Error saving tab permissions:', err);
            setFeedback({
                type: 'error',
                message: err.response?.data?.message || err.message || 'Network error saving tab permissions.'
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
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
                        onClick={() => onSwitchTab?.('page_access')}
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
                        <Shield size={14} color="#fca412" />
                        <span>🛡️ Sidebar Page Access (Role Wise)</span>
                    </button>
                    <button
                        type="button"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 16px',
                            borderRadius: '8px',
                            border: '1.5px solid #2563eb',
                            backgroundColor: '#2563eb',
                            color: '#ffffff',
                            fontWeight: 800,
                            fontSize: '0.84rem',
                            cursor: 'default',
                            boxShadow: '0 2px 6px rgba(37, 99, 235, 0.35)'
                        }}
                    >
                        <Layers size={14} />
                        <span>📋 Project Details Tabs Access (Role Wise)</span>
                    </button>
                </div>

                <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
                    Assign which tabs appear when an employee views a Project
                </div>
            </div>

            {/* Header Description & Action Buttons */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '14px',
                padding: '16px 20px',
                backgroundColor: '#f8fafc',
                borderRadius: '12px',
                border: '1.5px solid #e2e8f0'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '10px',
                        backgroundColor: '#dbeafe',
                        color: '#1d4ed8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1.5px solid #bfdbfe'
                    }}>
                        <Layers size={22} />
                    </div>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                            Project Details Tabs Access Table (Role-Wise)
                        </h3>
                        <p style={{ margin: '3px 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                            Project Details tabs are listed on the left; employee roles are in the columns. Check the box to make that tab visible for that role.
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
                            placeholder="Filter project tabs..."
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
                            backgroundColor: '#ffffff',
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
                            backgroundColor: '#2563eb',
                            color: '#ffffff',
                            fontWeight: 800,
                            fontSize: '0.88rem',
                            cursor: saving ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)'
                        }}
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        Save Project Tab Permissions
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

            {/* MASTER PERMISSION TABLE (LEFT = PROJECT TABS, TOP = ROLES) */}
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
                                
                                {/* 1. Sticky First Column: Tab Name & Description */}
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
                                    minWidth: '260px',
                                    boxShadow: '3px 0 6px rgba(0,0,0,0.04)',
                                    borderBottom: '2px solid #cbd5e1'
                                }}>
                                    Project Details Tab
                                </th>

                                {/* 2. Role Columns */}
                                {ROLE_COLUMNS.map(role => {
                                    const allowedCount = PROJECT_TAB_ROWS.filter(p => isTabAllowed(role.key, p.id)).length;
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
                                                    {allowedCount} / {PROJECT_TAB_ROWS.length}
                                                </span>

                                                {/* Column quick toggle */}
                                                <div style={{ display: 'flex', gap: '4px', marginTop: '3px' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggleColumn(role.key, true)}
                                                        style={{ border: 'none', background: 'none', color: '#16a34a', fontSize: '0.66rem', fontWeight: 800, cursor: 'pointer', padding: 0 }}
                                                        title="Check all tabs for this role"
                                                    >
                                                        All
                                                    </button>
                                                    <span style={{ color: '#cbd5e1' }}>|</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggleColumn(role.key, false)}
                                                        style={{ border: 'none', background: 'none', color: '#dc2626', fontSize: '0.66rem', fontWeight: 800, cursor: 'pointer', padding: 0 }}
                                                        title="Clear all tabs for this role"
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
                                        <Loader2 className="animate-spin" size={28} color="#2563eb" style={{ margin: '0 auto' }} />
                                        <p style={{ marginTop: '8px', fontSize: '0.84rem' }}>Loading project tab permissions...</p>
                                    </td>
                                </tr>
                            ) : filteredRows.length === 0 ? (
                                <tr>
                                    <td colSpan={ROLE_COLUMNS.length + 1} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                                        No project tabs found matching '{searchTerm}'.
                                    </td>
                                </tr>
                            ) : (
                                filteredRows.map((tab, idx) => {
                                    const TabIcon = tab.icon;

                                    return (
                                        <tr key={tab.id} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fbfcfe' }}>
                                            
                                            {/* Sticky First Column: Tab Name & Icon */}
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
                                                            width: '30px',
                                                            height: '30px',
                                                            borderRadius: '8px',
                                                            backgroundColor: '#eff6ff',
                                                            color: '#2563eb',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            flexShrink: 0
                                                        }}>
                                                            <TabIcon size={16} />
                                                        </div>
                                                        <div>
                                                            <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a', display: 'block' }}>
                                                                {tab.label}
                                                            </span>
                                                            <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500, display: 'block' }}>
                                                                {tab.description}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Row quick action buttons */}
                                                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleToggleRow(tab.id, true)}
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
                                                            title="Check this tab for all roles"
                                                        >
                                                            All
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleToggleRow(tab.id, false)}
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
                                                            title="Uncheck this tab for all roles"
                                                        >
                                                            None
                                                        </button>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Role Cells with Checkboxes */}
                                            {ROLE_COLUMNS.map(role => {
                                                const allowed = isTabAllowed(role.key, tab.id);

                                                return (
                                                    <td
                                                        key={role.key}
                                                        onClick={() => handleToggleCell(role.key, tab.id)}
                                                        style={{
                                                            padding: '10px 8px',
                                                            borderBottom: '1px solid #f1f5f9',
                                                            borderLeft: '1px solid #f1f5f9',
                                                            cursor: 'pointer',
                                                            backgroundColor: allowed ? '#f0fdf4' : 'transparent',
                                                            transition: 'background-color 0.1s ease'
                                                        }}
                                                        title={`Click to ${allowed ? 'remove' : 'grant'} "${tab.label}" for ${role.name}`}
                                                    >
                                                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                                            <div style={{
                                                                width: '24px',
                                                                height: '24px',
                                                                borderRadius: '6px',
                                                                border: allowed ? '2px solid #16a34a' : '2px solid #cbd5e1',
                                                                backgroundColor: allowed ? '#16a34a' : '#ffffff',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                color: '#ffffff',
                                                                boxShadow: allowed ? '0 2px 4px rgba(22, 163, 74, 0.25)' : 'none',
                                                                transition: 'all 0.12s ease'
                                                            }}>
                                                                {allowed ? <Check size={15} strokeWidth={3} /> : null}
                                                            </div>
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
            </div>

            {/* Quick Helper Guide */}
            <div style={{
                padding: '14px 18px',
                borderRadius: '10px',
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                fontSize: '0.82rem',
                color: '#1e40af',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
            }}>
                <Layers size={18} color="#2563eb" style={{ flexShrink: 0 }} />
                <span>
                    <strong>Admin Tip:</strong> When you check or uncheck tabs here and click <strong>"Save Project Tab Permissions"</strong>, the changes take effect immediately across all project details pages. Employees will only see the exact tabs assigned to their role!
                </span>
            </div>

        </div>
    );
};

