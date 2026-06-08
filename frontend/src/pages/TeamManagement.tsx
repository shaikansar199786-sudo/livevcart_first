import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { UserPlus, User, Phone, Search, Loader2, Eye, EyeOff, Trash2 } from 'lucide-react';

interface UserMember {
    user_id: string;
    name: string;
    username: string;
    role: string;
    phone: string;
    employee_id: string;
    status: string;
}

export const TeamManagement: React.FC = () => {
    const [members, setMembers] = useState<UserMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showStaffPassword, setShowStaffPassword] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingUserId, setEditingUserId] = useState<string | null>(null);

    const handleDeleteMember = async (userId: string) => {
        if (!window.confirm('Are you sure you want to permanently delete this staff member? This action cannot be undone.')) return;

        try {
            const response = await axios.delete(`${API_BASE_URL}/users/${userId}`);
            if (response.data.success) {
                fetchMembers();
            }
        } catch (err) {
            alert('Error deactivating member');
        }
    };

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
            password: '', // Leave blank to not update password
            role: member.role,
            phone: member.phone || '',
            employee_id: member.employee_id || '',
            status: member.status || 'active'
        });
        setShowAddModal(true);
    };

    useEffect(() => {
        fetchMembers();
    }, []);

    const fetchMembers = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/users`);
            if (response.data.success) {
                setMembers(response.data.data);
            }
        } catch (err) {
            console.error('Failed to fetch members');
        } finally {
            setLoading(false);
        }
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

    return (
        <div className="team-management">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#253b50' }}>Team Management</h2>
                    <p style={{ color: '#6b7280' }}>Manage roles and access for your staff members</p>
                </div>
                <button
                    onClick={openAddModal}
                    className="btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    <UserPlus size={18} />
                    Add New Member
                </button>
            </div>

            <div className="premium-card" style={{ marginBottom: '30px' }}>
                <div style={{ position: 'relative', marginBottom: '24px' }}>
                    <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                    <input
                        type="text"
                        placeholder="Search members by name, username or role..."
                        style={{
                            width: '100%',
                            padding: '12px 12px 12px 40px',
                            borderRadius: '8px',
                            border: '1px solid #e5e7eb',
                            outline: 'none'
                        }}
                    />
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
                                <th style={{ padding: '16px', color: '#6b7280', fontWeight: 500 }}>Member Name</th>
                                <th style={{ padding: '16px', color: '#6b7280', fontWeight: 500 }}>Role</th>
                                <th style={{ padding: '16px', color: '#6b7280', fontWeight: 500 }}>Contact info</th>
                                <th style={{ padding: '16px', color: '#6b7280', fontWeight: 500 }}>Emp ID</th>
                                <th style={{ padding: '16px', color: '#6b7280', fontWeight: 500 }}>Status</th>
                                <th style={{ padding: '16px', color: '#6b7280', fontWeight: 500 }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} style={{ padding: '40px', textAlign: 'center' }}>
                                        <Loader2 className="animate-spin" style={{ margin: '0 auto', color: '#253b50' }} />
                                    </td>
                                </tr>
                            ) : members.filter(m => m.status === 'active').map((member) => (
                                <tr key={member.user_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#253b50', color: 'white', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', fontWeight: 600 }}>
                                                {member.name.charAt(0)}
                                            </div>
                                            <span style={{ fontWeight: 600 }}>{member.name}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '16px' }}>
                                        <span style={{
                                            padding: '4px 10px',
                                            borderRadius: '4px',
                                            fontSize: '0.8rem',
                                            backgroundColor: '#e5e7eb',
                                            textTransform: 'capitalize'
                                        }}>
                                            {member.role.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td style={{ padding: '16px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', fontSize: '0.85rem' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><User size={12} /> {member.username}</span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Phone size={12} /> {member.phone}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '16px' }}>{member.employee_id}</td>
                                    <td style={{ padding: '16px' }}>
                                        <span style={{
                                            color: member.status === 'active' ? '#10b981' : '#ef4444',
                                            fontWeight: 600,
                                            fontSize: '0.9rem'
                                        }}>
                                            {member.status.charAt(0).toUpperCase() + member.status.slice(1)}
                                        </span>
                                    </td>
                                    <td style={{ padding: '16px' }}>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button 
                                                onClick={() => openEditModal(member)}
                                                style={{ color: '#253b50', padding: '4px 8px', borderRadius: '4px', border: '1px solid #253b50', fontSize: '0.85rem', cursor: 'pointer', background: 'none' }}
                                            >
                                                Edit
                                            </button>
                                            {member.role !== 'principal_architect' && member.status === 'active' && (
                                                <button
                                                    onClick={() => handleDeleteMember(member.user_id)}
                                                    style={{ color: '#ef4444', padding: '4px 8px', borderRadius: '4px', border: '1px solid #ef4444', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', background: 'none' }}
                                                >
                                                    <Trash2 size={14} /> Delete
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {showAddModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="premium-card" style={{ width: '100%', maxWidth: '500px', backgroundColor: 'white' }}>
                        <h3 style={{ marginBottom: '24px', fontSize: '1.4rem' }}>{isEditing ? 'Edit Staff Member' : 'Add New Staff Member'}</h3>
                        <form onSubmit={handleSubmit}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Full Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Role</label>
                                    <select
                                        value={formData.role}
                                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                                    >
                                        <option value="project_head">Project Head</option>
                                        <option value="site_engineer">Site Engineer</option>
                                        <option value="accountant">Accountant</option>
                                        <option value="admin">Office Admin</option>
                                        <option value="principal_architect">Principal Architect</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Username</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                                />
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Password {isEditing && <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>(Leave blank to keep current)</span>}</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={showStaffPassword ? "text" : "password"}
                                        required={!isEditing}
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        style={{ width: '100%', padding: '10px 40px 10px 10px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                                    />
                                    <div
                                        onClick={() => setShowStaffPassword(!showStaffPassword)}
                                        style={{
                                            position: 'absolute',
                                            right: '10px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            color: '#9ca3af',
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
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Phone Number</label>
                                    <input
                                        type="text"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Employee ID</label>
                                    <input
                                        type="text"
                                        value={formData.employee_id}
                                        onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    style={{ padding: '10px 20px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: 'white' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="btn-primary"
                                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
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
