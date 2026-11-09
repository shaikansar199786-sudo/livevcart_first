import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { 
    UserPlus, User, Phone, Search, Loader2, Eye, EyeOff, Trash2, Edit3, 
    Shield, Mail, CheckCircle2, RotateCcw, Building2, AlertTriangle, 
    Clock, RefreshCw, XCircle, CheckCircle, Power, Layers
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { RolePageAccessTab } from '../components/RolePageAccessTab';
import { RoleProjectTabAccessTab } from '../components/RoleProjectTabAccessTab';

interface UserMember {
    user_id: string;
    name: string;
    username: string;
    role: string;
    department?: string;
    phone: string;
    employee_id: string;
    status: string; // 'active' | 'inactive' | 'deleted'
    deleted_at?: string;
    days_remaining?: number;
    plain_password?: string;
    password?: string;
}

const ROLE_COLORS: Record<string, { bg: string, text: string }> = {
    admin: { bg: '#fee2e2', text: '#991b1b' },
    project_head: { bg: '#e0f2fe', text: '#0369a1' },
    project_manager: { bg: '#ffedd5', text: '#c2410c' },
    manager: { bg: '#e0e7ff', text: '#3730a3' },
    business_associate: { bg: '#dbeafe', text: '#1e40af' },
    accountant: { bg: '#fef3c7', text: '#a16207' },
    sales: { bg: '#fce7f3', text: '#be185d' },
    d1: { bg: '#e0e7ff', text: '#4338ca' },
    d2: { bg: '#e0e7ff', text: '#4338ca' },
    associate_designer: { bg: '#e0e7ff', text: '#4338ca' },
    marketing_analyst: { bg: '#fce7f3', text: '#be185d' },
    graphic_designer: { bg: '#fae8ff', text: '#86198f' },
    mmt: { bg: '#f3e8ff', text: '#6b21a8' },
    site_inspector: { bg: '#ccfbf1', text: '#0f766e' },
    site_inspection: { bg: '#ccfbf1', text: '#0f766e' },
    site_engineer: { bg: '#dcfce7', text: '#15803d' },
    gd: { bg: '#fae8ff', text: '#86198f' }
};

const ROLE_LABELS: Record<string, string> = {
    admin: 'Admin',
    project_head: 'Installation Manager',
    project_manager: 'Project Manager',
    manager: 'Design Manager',
    business_associate: 'Business Associate',
    accountant: 'Accountant',
    sales: 'Sales',
    d1: 'D1 Designer',
    d2: 'D2 Designer',
    associate_designer: 'Associate Designer',
    marketing_analyst: 'Marketing Analyst',
    graphic_designer: 'Graphic Designer',
    mmt: 'Material Management',
    site_inspector: 'Site Inspector',
    site_inspection: 'Site Inspector',
    site_engineer: 'Site Engineer',
    gd: 'GD (Graphic Designer)'
};

const STANDARD_DEPARTMENTS = [
    'Design & 3D Visualization',
    'Project Management',
    'Site Operations & Execution',
    'Accounts & Finance',
    'Sales & Business Development',
    'Marketing & Branding',
    'Material Management (MMT)',
    'Quality Control (QC)',
    'Executive & Administration'
];

const getDefaultDepartmentForRole = (role: string): string => {
    const r = (role || '').toLowerCase();
    if (['d1', 'd2', 'associate_designer', 'graphic_designer', 'gd', 'manager'].includes(r)) return 'Design & 3D Visualization';
    if (['project_head', 'project_manager'].includes(r)) return 'Project Management';
    if (['site_inspector', 'site_inspection', 'site_engineer'].includes(r)) return 'Site Operations & Execution';
    if (r === 'accountant') return 'Accounts & Finance';
    if (['sales', 'business_associate'].includes(r)) return 'Sales & Business Development';
    if (['marketing_analyst'].includes(r)) return 'Marketing & Branding';
    if (r === 'mmt') return 'Material Management (MMT)';
    if (r === 'admin') return 'Executive & Administration';
    return 'General Operations';
};

const PASTEL_AVATARS = [
    { bg: '#fee2e2', text: '#ef4444' },
    { bg: '#ffedd5', text: '#f97316' },
    { bg: '#fef3c7', text: '#f59e0b' },
    { bg: '#dcfce7', text: '#10b981' },
    { bg: '#ecfdf5', text: '#34d399' },
    { bg: '#e0f2fe', text: '#0284c7' },
    { bg: '#e0e7ff', text: '#6366f1' },
    { bg: '#f3e8ff', text: '#a855f7' },
    { bg: '#fce7f3', text: '#ec4899' }
];

export const TeamManagement: React.FC = () => {
    const { user: currentUser } = useAuth();
    const [members, setMembers] = useState<UserMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showStaffPassword, setShowStaffPassword] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Tabs: All Active/Inactive, Active only, Inactive only, 30-Day Recovery Trash, or Role Page Access / Project Tab Access
    const [activeTab, setActiveTab] = useState<'all' | 'active' | 'inactive' | 'deleted' | 'page_access' | 'project_tab_access'>('all');
    const [roleFilter, setRoleFilter] = useState('All');
    const [departmentFilter, setDepartmentFilter] = useState('All');

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        username: '',
        password: '',
        role: 'project_head',
        department: 'Project Management',
        phone: '',
        employee_id: '',
        salary: '',
        status: 'active'
    });

    useEffect(() => {
        fetchMembers();
    }, []);

    const fetchMembers = async () => {
        setLoading(true);
        try {
            const response = await axios.get(`${API_BASE_URL}/users`);
            if (response.data.success) {
                setMembers(response.data.data);
            }
        } catch (err) {
            console.error('Failed to fetch members:', err);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Soft delete employee with 30-day recovery window.
     * User requirement: "If we delete any employee need 30 day recovery option not added yet"
     */
    const handleSoftDelete = async (member: UserMember) => {
        const confirmMsg = `Are you sure you want to delete ${member.name}?\n\n` +
            `• The account will be moved to the Trash.\n` +
            `• You have 30 days to recover this account.\n` +
            `• When this person tries to log in, they will be blocked with: "You are not an employee."\n` +
            `• If recovered within 30 days, their access will be instantly restored.`;

        if (!window.confirm(confirmMsg)) return;

        try {
            const response = await axios.post(`${API_BASE_URL}/users/soft-delete`, { user_id: member.user_id });
            if (response.data.success) {
                alert(`Account for ${member.name} moved to Trash with 30-day recovery window.`);
                fetchMembers();
            } else {
                alert(response.data.message || 'Error deleting employee');
            }
        } catch (err: any) {
            alert(err.response?.data?.message || 'Error deleting employee');
        }
    };

    /**
     * Restore employee within 30 days.
     * User requirement: "and suppose if admin recovery with 30 day when they login with login and password they dashboard it"
     */
    const handleRestoreMember = async (member: UserMember) => {
        try {
            const response = await axios.post(`${API_BASE_URL}/users/restore`, { user_id: member.user_id });
            if (response.data.success) {
                alert(`✅ Account for ${member.name} has been recovered successfully!\n\nThey can now immediately log in with their email/password and access their dashboard.`);
                fetchMembers();
            } else {
                alert(response.data.message || 'Error restoring employee');
            }
        } catch (err: any) {
            alert(err.response?.data?.message || 'Error restoring employee');
        }
    };

    /**
     * Toggle Active / Inactive status without deleting.
     * User requirement: "i want option for active and inactive employees"
     */
    const handleToggleStatus = async (member: UserMember) => {
        const nextStatus = member.status === 'active' ? 'inactive' : 'active';
        try {
            const response = await axios.post(`${API_BASE_URL}/users/status`, { 
                user_id: member.user_id, 
                status: nextStatus 
            });
            if (response.data.success) {
                fetchMembers();
            } else {
                alert(response.data.message || 'Error updating status');
            }
        } catch (err: any) {
            alert(err.response?.data?.message || 'Error updating status');
        }
    };

    /**
     * Permanent delete immediately (from Trash).
     */
    const handlePermanentDelete = async (member: UserMember) => {
        if (!window.confirm(`⚠️ WARNING: Permanently delete ${member.name}?\n\nThis will permanently purge the account from the database immediately. This CANNOT be undone!`)) return;

        try {
            const response = await axios.post(`${API_BASE_URL}/users/permanent-delete`, { user_id: member.user_id });
            if (response.data.success) {
                alert(`Account for ${member.name} permanently deleted.`);
                fetchMembers();
            } else {
                alert(response.data.message || 'Error permanently deleting employee');
            }
        } catch (err: any) {
            alert(err.response?.data?.message || 'Error permanently deleting employee');
        }
    };

    const openAddModal = () => {
        setIsEditing(false);
        setEditingUserId(null);
        setFormData({
            name: '',
            username: '',
            password: '',
            role: 'project_head',
            department: 'Project Management',
            phone: '',
            employee_id: '',
            salary: '',
            status: 'active'
        });
        setShowStaffPassword(false);
        setShowAddModal(true);
    };

    const openEditModal = (member: UserMember) => {
        setIsEditing(true);
        setEditingUserId(member.user_id);
        const existingPwd = member.plain_password || member.password || '';
        setFormData({
            name: member.name,
            username: member.username,
            password: existingPwd,
            role: member.role,
            department: member.department || getDefaultDepartmentForRole(member.role),
            phone: member.phone || '',
            employee_id: member.employee_id || '',
            salary: (member as any).salary || '',
            status: member.status === 'deleted' ? 'active' : (member.status || 'active')
        });
        setShowStaffPassword(true);
        setShowAddModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            let response;
            if (isEditing && editingUserId) {
                response = await axios.put(`${API_BASE_URL}/users`, { ...formData, user_id: editingUserId });
            } else {
                response = await axios.post(`${API_BASE_URL}/users`, formData);
            }

            if (response.data && response.data.success) {
                setShowAddModal(false);
                fetchMembers();
            } else {
                alert(response.data?.message || 'An error occurred while saving member data');
            }
        } catch (err: any) {
            const errorMsg = err.response?.data?.message || err.message || 'Error saving member data';
            alert(errorMsg);
        } finally {
            setSubmitting(false);
        }
    };

    // Filter Logic based on Active Tab & Search
    const filteredMembers = members.filter(m => {
        const isDeleted = m.status === 'deleted';

        // Tab filter
        if (activeTab === 'all' && isDeleted) return false;
        if (activeTab === 'active' && m.status !== 'active') return false;
        if (activeTab === 'inactive' && m.status !== 'inactive') return false;
        if (activeTab === 'deleted' && !isDeleted) return false;

        // Search match
        const dept = m.department || getDefaultDepartmentForRole(m.role);
        const matchesSearch = 
            (m.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (m.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (ROLE_LABELS[m.role] || m.role || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            dept.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (m.phone || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (m.employee_id || '').toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesRole = roleFilter === 'All' || m.role === roleFilter;
        const matchesDept = departmentFilter === 'All' || dept === departmentFilter;

        return matchesSearch && matchesRole && matchesDept;
    });

    // Counts
    const nonDeletedMembers = members.filter(m => m.status !== 'deleted');
    const totalStaffCount = nonDeletedMembers.length;
    const activeStaffCount = members.filter(m => m.status === 'active').length;
    const inactiveStaffCount = members.filter(m => m.status === 'inactive').length;
    const deletedTrashCount = members.filter(m => m.status === 'deleted').length;

    const getAvatarColors = (name: string) => {
        const charCode = name.charCodeAt(0) || 0;
        return PASTEL_AVATARS[charCode % PASTEL_AVATARS.length];
    };

    return (
        <div style={{ width: '100%', padding: '0 0 24px 0', fontFamily: 'inherit' }}>
            <style>{`
                .team-card {
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 16px;
                    padding: 24px;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.02);
                }
                .btn-add {
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
                .btn-add:hover {
                    background-color: #1e3041;
                    box-shadow: 0 6px 14px rgba(37, 59, 80, 0.3);
                    transform: translateY(-1px);
                }
                .search-field {
                    width: 100%;
                    padding: 12px 16px 12px 44px;
                    border-radius: 10px;
                    border: 1px solid #cbd5e1;
                    outline: none;
                    font-size: 0.92rem;
                    font-weight: 600;
                    transition: all 0.2s ease;
                }
                .search-field:focus {
                    border-color: #253b50;
                    box-shadow: 0 0 0 3px rgba(37, 59, 80, 0.15);
                }
                .team-table-row {
                    border-bottom: 1px solid #f1f5f9;
                    transition: background-color 0.2s ease;
                }
                .team-table-row:hover {
                    background-color: #f8fafc;
                }
                .form-control {
                    width: 100%;
                    padding: 11px 14px;
                    border-radius: 8px;
                    border: 1px solid #cbd5e1;
                    outline: none;
                    font-size: 0.92rem;
                    transition: all 0.2s ease;
                }
                .form-control:focus {
                    border-color: #253b50;
                    box-shadow: 0 0 0 3px rgba(37, 59, 80, 0.12);
                }
                .role-badge {
                    padding: 4px 12px;
                    border-radius: 20px;
                    font-size: 0.78rem;
                    font-weight: 700;
                    display: inline-block;
                    letter-spacing: 0.3px;
                }
                .department-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    padding: 4px 10px;
                    border-radius: 8px;
                    font-size: 0.76rem;
                    font-weight: 700;
                    background-color: #f1f5f9;
                    color: #334155;
                    border: 1px solid #e2e8f0;
                }
                .action-btn-circle {
                    width: 34px;
                    height: 34px;
                    border-radius: 8px;
                    border: 1px solid #e2e8f0;
                    background: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.15s ease;
                    color: #475569;
                }
                .action-btn-circle:hover {
                    background-color: #f1f5f9;
                    color: #0f172a;
                    border-color: #cbd5e1;
                }
                .action-btn-delete {
                    width: 34px;
                    height: 34px;
                    border-radius: 8px;
                    border: 1px solid #fee2e2;
                    background: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.15s ease;
                    color: #ef4444;
                }
                .action-btn-delete:hover {
                    background-color: #fee2e2;
                    color: #b91c1c;
                }
                .action-btn-restore {
                    padding: 6px 12px;
                    border-radius: 8px;
                    border: 1px solid #86efac;
                    background: #f0fdf4;
                    color: #16a34a;
                    font-weight: 800;
                    font-size: 0.78rem;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    cursor: pointer;
                    transition: all 0.15s ease;
                }
                .action-btn-restore:hover {
                    background: #dcfce7;
                    color: #15803d;
                }
            `}</style>

            {/* Header section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '14px' }}>
                <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                        Team &amp; Access Management
                    </h2>
                    <p style={{ color: '#64748b', marginTop: '4px', fontSize: '0.86rem' }}>
                        Manage employee credentials, assigned departments, active access status, and 30-day account recovery.
                    </p>
                </div>
                <button className="btn-add" onClick={openAddModal}>
                    <UserPlus size={18} />
                    Add New Employee
                </button>
            </div>

            {/* Metric Summary Overview Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px', marginBottom: '22px' }}>
                
                {/* 1. Total Staff */}
                <div 
                    onClick={() => setActiveTab('all')}
                    style={{ backgroundColor: '#ffffff', border: activeTab === 'all' ? '2px solid #4f46e5' : '1.5px solid #e2e8f0', borderRadius: '14px', padding: '18px 20px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', transition: 'all 0.15s ease' }}
                >
                    <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <User size={22} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>All Employees</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a' }}>{totalStaffCount}</div>
                    </div>
                </div>

                {/* 2. Active Staff */}
                <div 
                    onClick={() => setActiveTab('active')}
                    style={{ backgroundColor: '#ffffff', border: activeTab === 'active' ? '2px solid #16a34a' : '1.5px solid #e2e8f0', borderRadius: '14px', padding: '18px 20px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', transition: 'all 0.15s ease' }}
                >
                    <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CheckCircle2 size={22} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Active Access</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#16a34a' }}>{activeStaffCount}</div>
                    </div>
                </div>

                {/* 3. Inactive Staff */}
                <div 
                    onClick={() => setActiveTab('inactive')}
                    style={{ backgroundColor: '#ffffff', border: activeTab === 'inactive' ? '2px solid #d97706' : '1.5px solid #e2e8f0', borderRadius: '14px', padding: '18px 20px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', transition: 'all 0.15s ease' }}
                >
                    <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Power size={22} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Inactive Access</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#d97706' }}>{inactiveStaffCount}</div>
                    </div>
                </div>

                {/* 4. Trash & 30-Day Recovery */}
                <div 
                    onClick={() => setActiveTab('deleted')}
                    style={{ backgroundColor: '#ffffff', border: activeTab === 'deleted' ? '2px solid #dc2626' : '1.5px solid #fecaca', borderRadius: '14px', padding: '18px 20px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', transition: 'all 0.15s ease' }}
                >
                    <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Trash2 size={22} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Trash (30-Day Recovery)</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#dc2626' }}>{deletedTrashCount}</div>
                    </div>
                </div>

                {/* 5. Role Page Access (Admin Only) */}
                {currentUser?.role === 'admin' && (
                    <div 
                        onClick={() => setActiveTab('page_access')}
                        style={{
                            backgroundColor: activeTab === 'page_access' ? '#fffbeb' : '#ffffff',
                            border: activeTab === 'page_access' ? '2.5px solid rgb(252, 164, 18)' : '1.5px solid #fed7aa',
                            borderRadius: '14px',
                            padding: '18px 20px',
                            boxShadow: activeTab === 'page_access' ? '0 4px 12px rgba(252, 164, 18, 0.25)' : '0 2px 6px rgba(0,0,0,0.02)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '16px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        <div style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '12px',
                            backgroundColor: activeTab === 'page_access' ? 'rgb(252, 164, 18)' : '#fff7ed',
                            color: activeTab === 'page_access' ? '#ffffff' : 'rgb(252, 164, 18)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: activeTab === 'page_access' ? '0 2px 6px rgba(252, 164, 18, 0.4)' : 'none'
                        }}>
                            <Shield size={22} />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'rgb(217, 119, 6)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Role Permissions</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a' }}>Page Access</div>
                        </div>
                    </div>
                )}

                {/* 6. Role Project Tab Access (Admin Only) */}
                {currentUser?.role === 'admin' && (
                    <div 
                        onClick={() => setActiveTab('project_tab_access')}
                        style={{
                            backgroundColor: activeTab === 'project_tab_access' ? '#eff6ff' : '#ffffff',
                            border: activeTab === 'project_tab_access' ? '2.5px solid #2563eb' : '1.5px solid #bfdbfe',
                            borderRadius: '14px',
                            padding: '18px 20px',
                            boxShadow: activeTab === 'project_tab_access' ? '0 4px 12px rgba(37, 99, 235, 0.25)' : '0 2px 6px rgba(0,0,0,0.02)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '16px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        <div style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '12px',
                            backgroundColor: activeTab === 'project_tab_access' ? '#2563eb' : '#eff6ff',
                            color: activeTab === 'project_tab_access' ? '#ffffff' : '#2563eb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: activeTab === 'project_tab_access' ? '0 2px 6px rgba(37, 99, 235, 0.4)' : 'none'
                        }}>
                            <Layers size={22} />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Project Tabs</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a' }}>Tab Access</div>
                        </div>
                    </div>
                )}

            </div>

            {/* Main Content Area */}
            <div className="team-card" style={{ border: '1.5px solid #e2e8f0', padding: '24px' }}>
                
                {/* STATUS NAVIGATION TABS (USER EXPLICIT REQUIREMENT) */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', borderBottom: '1.5px solid #e2e8f0', paddingBottom: '16px', marginBottom: '20px' }}>
                    <div style={{ display: 'inline-flex', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '10px', gap: '4px' }}>
                        <button
                            onClick={() => setActiveTab('all')}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '8px',
                                border: 'none',
                                fontWeight: 800,
                                fontSize: '0.80rem',
                                cursor: 'pointer',
                                backgroundColor: activeTab === 'all' ? '#ffffff' : 'transparent',
                                color: activeTab === 'all' ? '#0f172a' : '#64748b',
                                boxShadow: activeTab === 'all' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            👥 All Employees ({totalStaffCount})
                        </button>
                        <button
                            onClick={() => setActiveTab('active')}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '8px',
                                border: 'none',
                                fontWeight: 800,
                                fontSize: '0.80rem',
                                cursor: 'pointer',
                                backgroundColor: activeTab === 'active' ? '#ffffff' : 'transparent',
                                color: activeTab === 'active' ? '#16a34a' : '#64748b',
                                boxShadow: activeTab === 'active' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            🟢 Active ({activeStaffCount})
                        </button>
                        <button
                            onClick={() => setActiveTab('inactive')}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '8px',
                                border: 'none',
                                fontWeight: 800,
                                fontSize: '0.80rem',
                                cursor: 'pointer',
                                backgroundColor: activeTab === 'inactive' ? '#ffffff' : 'transparent',
                                color: activeTab === 'inactive' ? '#d97706' : '#64748b',
                                boxShadow: activeTab === 'inactive' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            🟡 Inactive ({inactiveStaffCount})
                        </button>
                        <button
                            onClick={() => setActiveTab('deleted')}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '8px',
                                border: 'none',
                                fontWeight: 800,
                                fontSize: '0.80rem',
                                cursor: 'pointer',
                                backgroundColor: activeTab === 'deleted' ? '#fee2e2' : 'transparent',
                                color: activeTab === 'deleted' ? '#b91c1c' : '#dc2626',
                                boxShadow: activeTab === 'deleted' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                transition: 'all 0.15s ease',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <span>🗑️ Trash &amp; 30-Day Recovery</span>
                            {deletedTrashCount > 0 && (
                                <span style={{ backgroundColor: '#dc2626', color: '#ffffff', borderRadius: '10px', padding: '1px 7px', fontSize: '0.70rem', fontWeight: 900 }}>
                                    {deletedTrashCount}
                                </span>
                            )}
                        </button>

                        {/* 5. Role Page Access Tab (Admin Only) */}
                        {currentUser?.role === 'admin' && (
                            <button
                                onClick={() => setActiveTab('page_access')}
                                style={{
                                    padding: '8px 18px',
                                    borderRadius: '8px',
                                    border: activeTab === 'page_access' ? '1px solid rgb(235, 145, 8)' : '1px solid rgba(252, 164, 18, 0.35)',
                                    fontWeight: 800,
                                    fontSize: '0.80rem',
                                    cursor: 'pointer',
                                    backgroundColor: activeTab === 'page_access' ? 'rgb(252, 164, 18)' : 'rgba(252, 164, 18, 0.12)',
                                    color: activeTab === 'page_access' ? '#ffffff' : 'rgb(217, 119, 6)',
                                    boxShadow: activeTab === 'page_access' ? '0 2px 8px rgba(252, 164, 18, 0.4)' : 'none',
                                    transition: 'all 0.15s ease',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                            >
                                <Shield size={14} />
                                <span>🛡️ Page Access (Role Wise)</span>
                            </button>
                        )}

                        {/* 6. Role Project Details Tab Access (Admin Only) */}
                        {currentUser?.role === 'admin' && (
                            <button
                                onClick={() => setActiveTab('project_tab_access')}
                                style={{
                                    padding: '8px 18px',
                                    borderRadius: '8px',
                                    border: activeTab === 'project_tab_access' ? '1px solid #1d4ed8' : '1px solid rgba(37, 99, 235, 0.35)',
                                    fontWeight: 800,
                                    fontSize: '0.80rem',
                                    cursor: 'pointer',
                                    backgroundColor: activeTab === 'project_tab_access' ? '#2563eb' : 'rgba(37, 99, 235, 0.12)',
                                    color: activeTab === 'project_tab_access' ? '#ffffff' : '#1d4ed8',
                                    boxShadow: activeTab === 'project_tab_access' ? '0 2px 8px rgba(37, 99, 235, 0.4)' : 'none',
                                    transition: 'all 0.15s ease',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                            >
                                <Layers size={14} />
                                <span>📋 Project Tabs Access (Role Wise)</span>
                            </button>
                        )}
                    </div>

                    {activeTab === 'deleted' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: '#b91c1c', backgroundColor: '#fef2f2', padding: '6px 14px', borderRadius: '8px', border: '1px solid #fecaca', fontWeight: 700 }}>
                            <Clock size={15} color="#dc2626" />
                            <span>Accounts in Trash are automatically deleted permanently after 30 days. You can restore them anytime before expiry.</span>
                        </div>
                    )}
                </div>

                {activeTab === 'page_access' ? (
                    <RolePageAccessTab teamMembers={members} onSwitchTab={(t) => setActiveTab(t)} />
                ) : activeTab === 'project_tab_access' ? (
                    <RoleProjectTabAccessTab teamMembers={members} onSwitchTab={(t) => setActiveTab(t)} />
                ) : (
                    <>
                        {/* Search & Filter Controls Bar */}
                        <div style={{ display: 'flex', gap: '14px', marginBottom: '22px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
                        <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search by staff name, department, username, phone or employee ID..."
                            className="search-field"
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                        {/* Department Filter */}
                        <select
                            value={departmentFilter}
                            onChange={(e) => setDepartmentFilter(e.target.value)}
                            style={{ padding: '11px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', outline: 'none', cursor: 'pointer' }}
                        >
                            <option value="All">All Departments</option>
                            {STANDARD_DEPARTMENTS.map(d => (
                                <option key={d} value={d}>{d}</option>
                            ))}
                        </select>

                        {/* Role Filter */}
                        <select
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                            style={{ padding: '11px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', outline: 'none', cursor: 'pointer' }}
                        >
                            <option value="All">All Roles</option>
                            {Object.entries(ROLE_LABELS).map(([rKey, rName]) => (
                                <option key={rKey} value={rKey}>{rName}</option>
                            ))}
                        </select>

                        {(searchTerm || roleFilter !== 'All' || departmentFilter !== 'All') && (
                            <button
                                onClick={() => { setSearchTerm(''); setRoleFilter('All'); setDepartmentFilter('All'); }}
                                style={{ padding: '11px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', color: '#64748b', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                                <RotateCcw size={14} /> Clear
                            </button>
                        )}
                    </div>
                </div>

                {/* Table with Department, Active/Inactive and 30-Day Recovery columns */}
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1.5px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                                <th style={{ padding: '14px 18px', color: '#475569', fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Staff Employee</th>
                                <th style={{ padding: '14px 18px', color: '#475569', fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Department</th>
                                <th style={{ padding: '14px 18px', color: '#475569', fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Role</th>
                                <th style={{ padding: '14px 18px', color: '#475569', fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Contact &amp; Login Email</th>
                                <th style={{ padding: '14px 18px', color: '#475569', fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Employee ID</th>
                                <th style={{ padding: '14px 18px', color: '#475569', fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Access Status</th>
                                <th style={{ padding: '14px 18px', color: '#475569', fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={7} style={{ padding: '50px', textAlign: 'center' }}>
                                        <Loader2 className="animate-spin" style={{ margin: '0 auto' }} size={32} color="#253b50" />
                                    </td>
                                </tr>
                            ) : filteredMembers.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ padding: '50px', textAlign: 'center', color: '#64748b' }}>
                                        {activeTab === 'deleted' 
                                            ? 'Trash is empty. No deleted accounts pending recovery.' 
                                            : 'No team members found matching your search and filter criteria.'}
                                    </td>
                                </tr>
                            ) : filteredMembers.map((member) => {
                                const avatar = getAvatarColors(member.name);
                                const roleColors = ROLE_COLORS[member.role] || { bg: '#f1f5f9', text: '#475569' };
                                const roleLabel = ROLE_LABELS[member.role] || member.role;
                                const departmentName = member.department || getDefaultDepartmentForRole(member.role);
                                const isDeleted = member.status === 'deleted';
                                const daysRemaining = member.days_remaining !== undefined ? Number(member.days_remaining) : 30;

                                return (
                                    <tr key={member.user_id} className="team-table-row" style={{ backgroundColor: isDeleted ? '#fffaf0' : 'transparent' }}>
                                        
                                        {/* Avatar & Name */}
                                        <td style={{ padding: '14px 18px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ 
                                                    width: '40px', 
                                                    height: '40px', 
                                                    borderRadius: '12px', 
                                                    backgroundColor: avatar.bg, 
                                                    color: avatar.text, 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    justifyContent: 'center', 
                                                    fontWeight: 800,
                                                    fontSize: '1rem',
                                                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)'
                                                }}>
                                                    {member.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.92rem' }}>{member.name}</div>
                                                    {member.user_id === currentUser?.user_id && (
                                                        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#4f46e5', backgroundColor: '#eef2ff', padding: '1px 6px', borderRadius: '4px', marginTop: '2px', display: 'inline-block' }}>You</span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        {/* Department Column (User requirement: "need add one column for department") */}
                                        <td style={{ padding: '14px 18px' }}>
                                            <span className="department-badge">
                                                <Building2 size={13} color="#64748b" />
                                                <span>{departmentName}</span>
                                            </span>
                                        </td>

                                        {/* Role Badge */}
                                        <td style={{ padding: '14px 18px' }}>
                                            <span className="role-badge" style={{ backgroundColor: roleColors.bg, color: roleColors.text }}>
                                                {roleLabel}
                                            </span>
                                        </td>

                                        {/* Contact & Email */}
                                        <td style={{ padding: '14px 18px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.82rem', color: '#475569' }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <Mail size={13} color="#94a3b8" />
                                                    <span style={{ fontWeight: 700, color: '#1e293b' }}>{member.username}</span>
                                                </span>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <Phone size={13} color="#94a3b8" />
                                                    <span>{member.phone || 'N/A'}</span>
                                                </span>
                                                {member.plain_password && (
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: '#059669', fontWeight: 700, marginTop: '2px' }}>
                                                        <Shield size={12} color="#10b981" />
                                                        <span>Password: {member.plain_password}</span>
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        {/* Employee ID */}
                                        <td style={{ padding: '14px 18px', fontWeight: 700, color: '#334155', fontSize: '0.85rem' }}>
                                            {member.employee_id || 'N/A'}
                                        </td>

                                        {/* Access Status (Active, Inactive, Deleted with 30-day countdown) */}
                                        <td style={{ padding: '14px 18px' }}>
                                            {isDeleted ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    <span style={{ backgroundColor: '#fee2e2', color: '#dc2626', padding: '3px 8px', borderRadius: '6px', fontWeight: 800, fontSize: '0.74rem', display: 'inline-flex', alignItems: 'center', gap: '4px', width: 'fit-content' }}>
                                                        <Trash2 size={12} /> Deleted (In Trash)
                                                    </span>
                                                    <span style={{ fontSize: '0.72rem', color: '#ea580c', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                        <Clock size={12} /> ⏳ {daysRemaining} days left to recover
                                                    </span>
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <button
                                                        onClick={() => handleToggleStatus(member)}
                                                        title="Click to toggle Active / Inactive"
                                                        style={{
                                                            padding: '4px 10px',
                                                            borderRadius: '8px',
                                                            border: member.status === 'active' ? '1px solid #bbf7d0' : '1px solid #fde68a',
                                                            backgroundColor: member.status === 'active' ? '#f0fdf4' : '#fffbeb',
                                                            color: member.status === 'active' ? '#16a34a' : '#d97706',
                                                            fontSize: '0.75rem',
                                                            fontWeight: 800,
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '6px',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.15s ease'
                                                        }}
                                                    >
                                                        <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: member.status === 'active' ? '#16a34a' : '#d97706' }} />
                                                        {member.status === 'active' ? 'Active' : 'Inactive'}
                                                    </button>
                                                </div>
                                            )}
                                        </td>

                                        {/* Action Buttons */}
                                        <td style={{ padding: '14px 18px' }}>
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                                {isDeleted ? (
                                                    <>
                                                        {/* RECOVER BUTTON (User requirement: "suppose if admin recovery with 30 day when they login with login and password they dashboard it") */}
                                                        <button 
                                                            onClick={() => handleRestoreMember(member)}
                                                            className="action-btn-restore"
                                                            title="Recover Account within 30 days (Re-enables login access immediately)"
                                                        >
                                                            <RefreshCw size={13} />
                                                            <span>Recover Account</span>
                                                        </button>

                                                        {/* Permanent Delete */}
                                                        <button 
                                                            onClick={() => handlePermanentDelete(member)}
                                                            className="action-btn-delete"
                                                            title="Delete Permanently Right Now"
                                                        >
                                                            <XCircle size={15} />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button 
                                                            onClick={() => openEditModal(member)}
                                                            className="action-btn-circle" 
                                                            title="Edit Employee &amp; Department"
                                                        >
                                                            <Edit3 size={15} />
                                                        </button>

                                                        {member.role !== 'admin' && member.user_id !== currentUser?.user_id && (
                                                            <button 
                                                                onClick={() => handleSoftDelete(member)}
                                                                className="action-btn-delete" 
                                                                title="Delete Employee (30-Day Recovery in Trash)"
                                                            >
                                                                <Trash2 size={15} />
                                                            </button>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                </>
                )}
            </div>

            {/* Add / Edit Staff Modal */}
            {showAddModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
                    <div style={{ width: '100%', maxWidth: '540px', padding: '0', overflow: 'hidden', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', backgroundColor: 'white' }}>
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                                {isEditing ? 'Edit Employee Profile' : 'Add New Employee'}
                            </h3>
                            <button onClick={() => setShowAddModal(false)} style={{ color: '#64748b', cursor: 'pointer', border: 'none', background: 'none', fontSize: '1.8rem', fontWeight: 400, padding: '0 8px', lineHeight: 1 }}>&times;</button>
                        </div>

                        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', fontWeight: 700, color: '#475569' }}>Full Name *</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="form-control"
                                        placeholder="e.g. Rahul Sharma"
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', fontWeight: 700, color: '#475569' }}>Department Role *</label>
                                    <select
                                        value={formData.role}
                                        onChange={(e) => {
                                            const newRole = e.target.value;
                                            setFormData({ 
                                                ...formData, 
                                                role: newRole,
                                                department: getDefaultDepartmentForRole(newRole)
                                            });
                                        }}
                                        style={{ width: '100%', padding: '11px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.88rem', fontWeight: 600, color: '#0f172a' }}
                                    >
                                        <option value="project_head">Installation Manager</option>
                                        <option value="project_manager">Project Manager</option>
                                        <option value="manager">Design Manager</option>
                                        <option value="business_associate">Business Associate</option>
                                        <option value="accountant">Accountant</option>
                                        <option value="sales">Sales</option>
                                        <option value="admin">Admin</option>
                                        <option value="d1">D1 Designer</option>
                                        <option value="d2">D2 Designer</option>
                                        <option value="associate_designer">Associate Designer</option>
                                        <option value="marketing_analyst">Marketing Analyst</option>
                                        <option value="graphic_designer">Graphic Designer</option>
                                        <option value="mmt">MMT (Material Management)</option>
                                        <option value="site_inspector">Site Inspector</option>
                                        <option value="site_engineer">Site Engineer</option>
                                    </select>
                                </div>
                            </div>

                            {/* Department Selection (User requirement: "need add one column for department") */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', fontWeight: 700, color: '#475569' }}>Department *</label>
                                    <select
                                        value={formData.department}
                                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                        style={{ width: '100%', padding: '11px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.88rem', fontWeight: 600, color: '#0f172a' }}
                                    >
                                        {STANDARD_DEPARTMENTS.map(d => (
                                            <option key={d} value={d}>{d}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', fontWeight: 700, color: '#475569' }}>Access Status *</label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                        style={{ width: '100%', padding: '11px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.88rem', fontWeight: 700, color: formData.status === 'active' ? '#16a34a' : '#d97706' }}
                                    >
                                        <option value="active">Active (Full Login Access)</option>
                                        <option value="inactive">Inactive (Login Access Blocked)</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', fontWeight: 700, color: '#475569' }}>Login Email / Username *</label>
                                <input
                                    type="email"
                                    required
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    className="form-control"
                                    placeholder="e.g. rahul_sharma@livincart.com"
                                />
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', fontWeight: 700, color: '#475569' }}>
                                    Password {isEditing && <span style={{ fontSize: '0.78rem', color: '#059669', fontWeight: 700 }}>({formData.password ? 'Current password saved' : 'Set new password'})</span>}
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={showStaffPassword ? "text" : "password"}
                                        required
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        className="form-control"
                                        style={{ paddingRight: '44px', fontWeight: 700 }}
                                        placeholder={isEditing ? "Enter password" : "Choose password"}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowStaffPassword(!showStaffPassword)}
                                        style={{
                                            position: 'absolute',
                                            right: '10px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            color: '#64748b',
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            padding: '4px'
                                        }}
                                        title={showStaffPassword ? "Hide password" : "Show password"}
                                    >
                                        {showStaffPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', fontWeight: 700, color: '#475569' }}>Phone Number</label>
                                    <input
                                        type="text"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        className="form-control"
                                        placeholder="e.g. +91 9999999999"
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', fontWeight: 700, color: '#475569' }}>Employee ID</label>
                                    <input
                                        type="text"
                                        value={formData.employee_id}
                                        onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                                        className="form-control"
                                        placeholder="e.g. LVC-042"
                                    />
                                </div>
                            </div>

                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', fontWeight: 700, color: '#475569' }}>Monthly Salary (₹)</label>
                                <input
                                    type="number"
                                    value={formData.salary}
                                    onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                                    className="form-control"
                                    placeholder="e.g. 25000"
                                    style={{ width: '100%', padding: '11px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.90rem', fontWeight: 600, color: '#0f172a' }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    style={{ padding: '11px 20px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: 'white', fontWeight: 700, color: '#475569', cursor: 'pointer' }}
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
                                        backgroundColor: '#253b50',
                                        border: 'none',
                                        color: 'white',
                                        padding: '11px 22px',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontWeight: 800,
                                        fontSize: '0.90rem'
                                    }}
                                >
                                    {submitting && <Loader2 className="animate-spin" size={16} />}
                                    {isEditing ? 'Save Changes' : 'Add Employee'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeamManagement;
