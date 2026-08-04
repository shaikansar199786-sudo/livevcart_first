import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { UserPlus, User, Phone, Search, Loader2, Eye, EyeOff, Trash2, Edit3, Shield, Mail, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface UserMember {
    user_id: string;
    name: string;
    username: string;
    role: string;
    phone: string;
    employee_id: string;
    status: string;
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
    graphic_designer: { bg: '#fae8ff', text: '#86198f' },
    mmt: { bg: '#f3e8ff', text: '#6b21a8' },
    site_inspector: { bg: '#ccfbf1', text: '#0f766e' },
    site_inspection: { bg: '#ccfbf1', text: '#0f766e' },
    site_engineer: { bg: '#dcfce7', text: '#15803d' },
    gd: { bg: '#fae8ff', text: '#86198f' }
};

const ROLE_LABELS: Record<string, string> = {
    admin: 'Admin',
    project_head: 'Project Head',
    project_manager: 'Project Manager',
    manager: 'Manager',
    business_associate: 'Business Associate',
    accountant: 'Accountant',
    sales: 'Sales',
    d1: 'D1 Designer',
    d2: 'D2 Designer',
    graphic_designer: 'Graphic Designer',
    mmt: 'Material Management',
    site_inspector: 'Site Inspector',
    site_inspection: 'Site Inspector',
    site_engineer: 'Site Engineer',
    gd: 'GD (Graphic Designer)'
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

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        username: '',
        password: '',
        role: 'project_head',
        phone: '',
        employee_id: '',
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

    const handleDeleteMember = async (userId: string) => {
        if (!window.confirm('Are you sure you want to permanently delete this staff member? This action cannot be undone.')) return;

        try {
            const response = await axios.delete(`${API_BASE_URL}/users/${userId}`);
            if (response.data.success) {
                fetchMembers();
            }
        } catch (err) {
            alert('Error deleting member');
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
            phone: '',
            employee_id: '',
            status: 'active'
        });
        setShowAddModal(true);
    };

    const openEditModal = (member: UserMember) => {
        setIsEditing(true);
        setEditingUserId(member.user_id);
        setFormData({
            name: member.name,
            username: member.username,
            password: '', // Leave blank to keep current
            role: member.role,
            phone: member.phone || '',
            employee_id: member.employee_id || '',
            status: member.status || 'active'
        });
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

            if (response.data.success) {
                setShowAddModal(false);
                fetchMembers();
            } else {
                alert(response.data.message || 'An error occurred');
            }
        } catch (err) {
            alert('Error saving member data');
        } finally {
            setSubmitting(false);
        }
    };

    const filteredMembers = members.filter(m => {
        const matchesSearch = 
            (m.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (m.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (ROLE_LABELS[m.role] || m.role || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (m.employee_id || '').toLowerCase().includes(searchTerm.toLowerCase());
        
        return matchesSearch;
    });

    const getAvatarColors = (name: string) => {
        const charCode = name.charCodeAt(0) || 0;
        return PASTEL_AVATARS[charCode % PASTEL_AVATARS.length];
    };

    return (
        <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
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
                    font-size: 0.95rem;
                    font-weight: 500;
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
                    font-size: 0.95rem;
                    transition: all 0.2s ease;
                }
                .form-control:focus {
                    border-color: #253b50;
                    box-shadow: 0 0 0 3px rgba(37, 59, 80, 0.12);
                }
                .role-badge {
                    padding: 4px 12px;
                    border-radius: 20px;
                    font-size: 0.8rem;
                    font-weight: 700;
                    display: inline-block;
                    letter-spacing: 0.3px;
                }
                .action-btn-circle {
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    border: 1px solid #e2e8f0;
                    background: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    color: #475569;
                }
                .action-btn-circle:hover {
                    background-color: #f1f5f9;
                    color: #0f172a;
                    border-color: #cbd5e1;
                }
                .action-btn-delete {
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    border: 1px solid #fee2e2;
                    background: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    color: #ef4444;
                }
                .action-btn-delete:hover {
                    background-color: #fee2e2;
                    color: #b91c1c;
                }
            `}</style>

            {/* Header section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#253b50', margin: 0 }}>Team Management</h2>
                    <p style={{ color: '#6b7280', marginTop: '4px' }}>Control system access, set credentials, and manage department roles for your staff.</p>
                </div>
                <button className="btn-add" onClick={openAddModal}>
                    <UserPlus size={18} />
                    Add New Member
                </button>
            </div>

            {/* Main Content Area */}
            <div className="team-card" style={{ border: '1px solid #e2e8f0', padding: '24px' }}>
                
                {/* Search Bar */}
                <div style={{ position: 'relative', marginBottom: '24px', maxWidth: '500px' }}>
                    <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search by name, username, employee ID or role..."
                        className="search-field"
                    />
                </div>

                {/* Grid/Table */}
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                                <th style={{ padding: '16px 20px', color: '#475569', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Staff Name</th>
                                <th style={{ padding: '16px 20px', color: '#475569', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Role</th>
                                <th style={{ padding: '16px 20px', color: '#475569', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Contact & Email ID</th>
                                <th style={{ padding: '16px 20px', color: '#475569', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Employee ID</th>
                                <th style={{ padding: '16px 20px', color: '#475569', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</th>
                                <th style={{ padding: '16px 20px', color: '#475569', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} style={{ padding: '50px', textAlign: 'center' }}>
                                        <Loader2 className="animate-spin" style={{ margin: '0 auto' }} size={32} color="#253b50" />
                                    </td>
                                </tr>
                            ) : filteredMembers.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ padding: '50px', textAlign: 'center', color: '#64748b' }}>
                                        No team members found matching your search.
                                    </td>
                                </tr>
                            ) : filteredMembers.map((member) => {
                                const avatar = getAvatarColors(member.name);
                                const roleColors = ROLE_COLORS[member.role] || { bg: '#f1f5f9', text: '#475569' };
                                const roleLabel = ROLE_LABELS[member.role] || member.role;

                                return (
                                    <tr key={member.user_id} className="team-table-row">
                                        {/* Avatar & Name */}
                                        <td style={{ padding: '16px 20px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
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
                                                    <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>{member.name}</div>
                                                    {member.user_id === currentUser?.user_id && (
                                                        <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#253b50', backgroundColor: '#e2e8f0', padding: '1px 6px', borderRadius: '4px', marginTop: '2px', display: 'inline-block' }}>You</span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        {/* Role Badge */}
                                        <td style={{ padding: '16px 20px' }}>
                                            <span className="role-badge" style={{ backgroundColor: roleColors.bg, color: roleColors.text }}>
                                                {roleLabel}
                                            </span>
                                        </td>

                                        {/* Contact Details */}
                                        <td style={{ padding: '16px 20px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem', color: '#475569' }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <Shield size={14} color="#94a3b8" />
                                                    <span style={{ fontWeight: 600, color: '#334155' }}>{member.username}</span>
                                                </span>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <Phone size={14} color="#94a3b8" />
                                                    <span>{member.phone || 'N/A'}</span>
                                                </span>
                                            </div>
                                        </td>

                                        {/* Employee ID */}
                                        <td style={{ padding: '16px 20px', fontWeight: 600, color: '#334155', fontSize: '0.9rem' }}>
                                            {member.employee_id || 'N/A'}
                                        </td>

                                        {/* Status */}
                                        <td style={{ padding: '16px 20px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <div style={{ 
                                                    width: '8px', 
                                                    height: '8px', 
                                                    borderRadius: '50%', 
                                                    backgroundColor: member.status === 'active' ? '#10b981' : '#f43f5e' 
                                                }} />
                                                <span style={{ 
                                                    color: member.status === 'active' ? '#10b981' : '#f43f5e', 
                                                    fontWeight: 700, 
                                                    fontSize: '0.85rem',
                                                    textTransform: 'capitalize'
                                                }}>
                                                    {member.status}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Action buttons */}
                                        <td style={{ padding: '16px 20px' }}>
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                <button 
                                                    onClick={() => openEditModal(member)}
                                                    className="action-btn-circle" 
                                                    title="Edit Member Settings"
                                                >
                                                    <Edit3 size={15} />
                                                </button>
                                                {member.role !== 'admin' && member.user_id !== currentUser?.user_id && (
                                                    <button 
                                                        onClick={() => handleDeleteMember(member.user_id)}
                                                        className="action-btn-delete" 
                                                        title="Revoke System Access"
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add / Edit Staff Modal */}
            {showAddModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="premium-card" style={{ width: '100%', maxWidth: '520px', padding: '0', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', backgroundColor: 'white' }}>
                        <div style={{ padding: '24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                                {isEditing ? 'Edit Staff Member' : 'Add New Staff Member'}
                            </h3>
                            <button onClick={() => setShowAddModal(false)} style={{ color: '#64748b', cursor: 'pointer', border: 'none', background: 'none', fontSize: '1.8rem', fontWeight: 400, padding: '0 8px', lineHeight: 1 }}>&times;</button>
                        </div>

                        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Full Name</label>
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
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Department Role</label>
                                    <select
                                        value={formData.role}
                                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                        style={{ width: '100%', padding: '11px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.95rem', fontWeight: 500, color: '#0f172a' }}
                                    >
                                        <option value="project_head">Project Head</option>
                                        <option value="project_manager">Project Manager</option>
                                        <option value="manager">Manager</option>
                                        <option value="business_associate">Business Associate</option>
                                        <option value="accountant">Accountant</option>
                                        <option value="sales">Sales</option>
                                        <option value="admin">Admin</option>
                                        <option value="d1">D1 Designer</option>
                                        <option value="d2">D2 Designer</option>
                                        <option value="graphic_designer">Graphic Designer</option>
                                        <option value="mmt">MMT (Material Management)</option>
                                        <option value="site_inspector">Site Inspector</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Email ID</label>
                                    <input
                                        type="email"
                                        required
                                        value={formData.username}
                                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                        className="form-control"
                                        placeholder="e.g. rahul_sharma@livincart.com"
                                    />
                                </div>
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>
                                    Password {isEditing && <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 400 }}>(Leave blank to keep current)</span>}
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={showStaffPassword ? "text" : "password"}
                                        required={!isEditing}
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        className="form-control"
                                        style={{ paddingRight: '40px' }}
                                        placeholder={isEditing ? "••••••••" : "Choose password"}
                                    />
                                    <div
                                        onClick={() => setShowStaffPassword(!showStaffPassword)}
                                        style={{
                                            position: 'absolute',
                                            right: '12px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            color: '#94a3b8',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center'
                                        }}
                                    >
                                        {showStaffPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Phone Number</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        className="form-control"
                                        placeholder="e.g. +91 9999999999"
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Employee ID</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.employee_id}
                                        onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                                        className="form-control"
                                        placeholder="e.g. LVC-042"
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', padding: '16px 24px 0 24px', margin: '0 -24px' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
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
                                        backgroundColor: '#253b50',
                                        border: 'none',
                                        color: 'white',
                                        padding: '12px 24px',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontWeight: 700
                                    }}
                                >
                                    {submitting && <Loader2 className="animate-spin" size={16} />}
                                    {isEditing ? 'Save Changes' : 'Add Member'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
