import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import {
    Search,
    Plus,
    Mail,
    Phone,
    Loader2,
    ExternalLink,
    Edit2,
    Trash2,
    Users,
    CheckCircle2,
    Filter,
    RotateCcw,
    Briefcase
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { 
    isSiteEngineerRole, 
    isProjectHeadRole, 
    isDesignerRole, 
    isAssociateDesignerRole, 
    isQcRole, 
    isCommonRole,
    formatRoleDisplay,
    TeamMultiSelector 
} from './Projects';

interface Client {
    client_id: string;
    client_code: string;
    name: string;
    email: string;
    phone: string;
    address: string;
    status: string;
    project_id?: string;
    projectname?: string;
    consultation_type?: string;
    project_status?: string;
    project_stage?: string;
}

export const Clients: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showProjectModal, setShowProjectModal] = useState(false);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [team, setTeam] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');

    const [clientForm, setClientForm] = useState<{
        client_id?: string;
        name: string;
        projectname: string;
        consultation_type: string;
        email: string;
        phone: string;
        address: string;
    }>({
        name: '',
        projectname: '',
        consultation_type: 'Furniture projects',
        email: '',
        phone: '',
        address: ''
    });

    const [projectForm, setProjectForm] = useState<{
        project_code: string;
        project_name: string;
        consultation_type: string;
        project_heads: string[];
        site_engineers: string[];
        designers: string[];
        associate_designers: string[];
        qc_inspectors: string[];
        total_budget: string;
        start_date: string;
        expected_end_date: string;
    }>({
        project_code: '',
        project_name: '',
        consultation_type: 'Furniture projects',
        project_heads: [],
        site_engineers: [],
        designers: [],
        associate_designers: [],
        qc_inspectors: [],
        total_budget: '',
        start_date: new Date().toISOString().split('T')[0],
        expected_end_date: new Date(new Date().setMonth(new Date().getMonth() + 6)).toISOString().split('T')[0]
    });

    useEffect(() => {
        fetchClients();
        fetchTeam();
    }, []);

    const fetchClients = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/clients`);
            if (response.data.success) {
                setClients(response.data.data);
            }
        } catch (err) {
            console.error('Failed to fetch clients');
        } finally {
            setLoading(false);
        }
    };

    const availableHeads = useMemo(() => {
        const heads = team.filter(t => isProjectHeadRole(t.role) || isCommonRole(t.role));
        return heads.length > 0 ? heads : team;
    }, [team]);

    const availableEngineers = useMemo(() => {
        const eng = team.filter(t => isSiteEngineerRole(t.role) || isCommonRole(t.role));
        return eng.length > 0 ? eng : team;
    }, [team]);

    const availableDesigners = useMemo(() => {
        const d = team.filter(t => isDesignerRole(t.role) || isCommonRole(t.role));
        return d.length > 0 ? d : team;
    }, [team]);

    const availableADs = useMemo(() => {
        const ad = team.filter(t => isAssociateDesignerRole(t.role) || isDesignerRole(t.role) || isCommonRole(t.role));
        return ad.length > 0 ? ad : team;
    }, [team]);

    const availableQcs = useMemo(() => {
        const qc = team.filter(t => isQcRole(t.role) || isCommonRole(t.role));
        return qc.length > 0 ? qc : team;
    }, [team]);

    const fetchTeam = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/users`);
            const userList = Array.isArray(response.data) ? response.data : (response.data?.data || []);
            setTeam(userList);
        } catch (err) {
            console.error('Failed to fetch team');
        }
    };

    const handleAddClient = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            if (isEditing && clientForm.client_id) {
                const response = await axios.put(`${API_BASE_URL}/clients`, {
                    ...clientForm
                });
                if (response.data.success) {
                    setShowAddModal(false);
                    setClientForm({ name: '', projectname: '', consultation_type: 'Furniture projects', email: '', phone: '', address: '' });
                    setIsEditing(false);
                    fetchClients();
                } else {
                    alert('Failed to update client');
                }
            } else {
                const response = await axios.post(`${API_BASE_URL}/clients`, {
                    ...clientForm,
                    created_by: user?.user_id
                });
                if (response.data.success) {
                    setShowAddModal(false);
                    setClientForm({ name: '', projectname: '', consultation_type: 'Furniture projects', email: '', phone: '', address: '' });
                    fetchClients();
                } else {
                    alert('Failed to add client');
                }
            }
        } catch (err) {
            alert('Failed to process client');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteClient = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this client?")) return;
        try {
            const response = await axios.delete(`${API_BASE_URL}/clients/${id}`);
            if (response.data.success) {
                fetchClients();
            } else {
                alert('Failed to delete client');
            }
        } catch (err) {
            alert('Failed to delete client');
        }
    };

    const handleEditClick = (client: Client) => {
        setIsEditing(true);
        setClientForm({
            client_id: client.client_id,
            name: client.name,
            projectname: client.projectname || '',
            consultation_type: client.consultation_type || 'Furniture projects',
            email: client.email,
            phone: client.phone,
            address: client.address
        } as any);
        setShowAddModal(true);
    };

    const handleLaunchClick = (client: Client) => {
        setSelectedClient(client);
        setProjectForm({
            ...projectForm,
            project_code: '',
            project_name: client.projectname || (client.name + ' Project'),
            consultation_type: client.consultation_type || 'Furniture projects'
        });
        setShowProjectModal(true);
    };

    const handleProjectLaunch = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const response = await axios.post(`${API_BASE_URL}/projects`, {
                ...projectForm,
                project_type: projectForm.consultation_type,
                client_id: selectedClient?.client_id,
                total_budget: projectForm.total_budget || 0,
                expected_end_date: projectForm.expected_end_date,
                created_by: user?.user_id
            });
            if (response.data.success) {
                setShowProjectModal(false);
                navigate(`/projects/${response.data.project_id}`);
            }
        } catch (err) {
            alert('Failed to launch project');
        } finally {
            setSubmitting(false);
        }
    };

    const filteredClients = clients.filter(c => {
        const query = searchTerm.trim().toLowerCase();
        const matchesSearch = !query ||
            (c.name || '').toLowerCase().includes(query) ||
            (c.client_code || '').toLowerCase().includes(query) ||
            (c.phone || '').toLowerCase().includes(query) ||
            (c.projectname || '').toLowerCase().includes(query) ||
            (c.email || '').toLowerCase().includes(query);

        const matchesType = typeFilter === 'all' || (c.consultation_type && c.consultation_type.toLowerCase().includes(typeFilter.toLowerCase()));
        const targetStatus = statusFilter.toLowerCase();
        const matchesStatus = statusFilter === 'all' ||
            (c.status && c.status.toLowerCase() === targetStatus) ||
            (c.project_stage && c.project_stage.toLowerCase() === targetStatus) ||
            (c.project_stage && c.project_stage.toLowerCase().includes(targetStatus));

        return matchesSearch && matchesType && matchesStatus;
    });

    const totalClientsCount = filteredClients.length;
    const activeProjectsCount = filteredClients.filter(c => !!c.project_id || (c.status && c.status.toLowerCase() === 'active')).length;
    const furnitureCount = filteredClients.filter(c => String(c.consultation_type || '').toLowerCase().includes('furniture')).length;
    const interiorCount = filteredClients.filter(c => String(c.consultation_type || '').toLowerCase().includes('interior')).length;

    return (
        <div className="clients-page">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0c1527' }}>Client Registry</h2>
                    <p style={{ color: '#64748b', fontWeight: 500 }}>Manage registered clients and their linked project status</p>
                </div>
            </div>

            {/* Metric Summary Overview Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Users size={22} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Total Clients</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a' }}>{totalClientsCount}</div>
                    </div>
                </div>

                <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CheckCircle2 size={22} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Active Projects</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a' }}>{activeProjectsCount}</div>
                    </div>
                </div>

                <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: '#fff9f0', color: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Briefcase size={22} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Furniture Projects</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a' }}>{furnitureCount}</div>
                    </div>
                </div>

                <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: '#f3e8ff', color: '#9333ea', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Filter size={22} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Interior Projects</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a' }}>{interiorCount}</div>
                    </div>
                </div>
            </div>

            <div className="premium-card">
                <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                        <input
                            type="text"
                            placeholder="Search by client name, code, phone or project..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: '8px', border: '1px solid #e5e7eb', outline: 'none' }}
                        />
                    </div>

                    <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        style={{ padding: '11px 16px', borderRadius: '8px', border: '1px solid #e5e7eb', backgroundColor: '#ffffff', fontWeight: 700, fontSize: '0.88rem', color: '#0f172a', outline: 'none', cursor: 'pointer' }}
                    >
                        <option value="all">All Consultation Types</option>
                        <option value="Furniture projects">Furniture projects</option>
                        <option value="Interior projects">Interior projects</option>
                    </select>

                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        style={{ padding: '11px 16px', borderRadius: '8px', border: '1px solid #e5e7eb', backgroundColor: '#ffffff', fontWeight: 700, fontSize: '0.88rem', color: '#0f172a', outline: 'none', cursor: 'pointer' }}
                    >
                        <option value="all">All Statuses / Stages</option>
                        <option value="Order Booked">Order Booked</option>
                        <option value="Design Phase">Design Phase</option>
                        <option value="R2P">R2P</option>
                        <option value="Production Phase">Production Phase</option>
                        <option value="Execution Phase">Execution Phase</option>
                        <option value="Handover">Handover</option>
                        <option value="active">Active</option>
                        <option value="completed">Completed</option>
                    </select>

                    {(searchTerm || typeFilter !== 'all' || statusFilter !== 'all') && (
                        <button
                            onClick={() => { setSearchTerm(''); setTypeFilter('all'); setStatusFilter('all'); }}
                            style={{ padding: '11px 16px', borderRadius: '8px', border: '1px solid #e5e7eb', backgroundColor: '#f8fafc', color: '#64748b', fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                            <RotateCcw size={14} /> Reset
                        </button>
                    )}
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
                                <th style={{ padding: '16px', color: '#6b7280', fontWeight: 500 }}>Code</th>
                                <th style={{ padding: '16px', color: '#6b7280', fontWeight: 500 }}>Project / Client</th>
                                <th style={{ padding: '16px', color: '#6b7280', fontWeight: 500 }}>Contact</th>
                                <th style={{ padding: '16px', color: '#6b7280', fontWeight: 500 }}>Project Status</th>
                                {(user?.role === 'admin' || user?.role === 'd1' || user?.role === 'project_head') && (
                                    <th style={{ padding: '16px', color: '#6b7280', fontWeight: 500, textAlign: 'center' }}>Actions</th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px' }}><Loader2 className="animate-spin" style={{ margin: '0 auto' }} /></td></tr>
                            ) : filteredClients.length === 0 ? (
                                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>No entries found matching your criteria.</td></tr>
                            ) : filteredClients.map((client, idx) => (
                                <tr key={`${client.client_id}-${idx}`} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '16px' }}>
                                        <span style={{ fontWeight: 700, color: '#253b50' }}>{client.client_code}</span>
                                    </td>
                                    <td style={{ padding: '16px' }}>
                                        {client.projectname ? (
                                            <>
                                                <div style={{ fontWeight: 700, color: '#253b50', fontSize: '1.05rem' }}>{client.projectname}</div>
                                                <div style={{ fontSize: '0.85rem', color: '#4b5563', marginTop: '2px', fontWeight: 500 }}>{client.name}</div>
                                            </>
                                        ) : (
                                            <div style={{ fontWeight: 600, color: '#253b50' }}>{client.name}</div>
                                        )}
                                        <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '4px' }}>{client.address}</div>
                                    </td>
                                    <td style={{ padding: '16px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', fontSize: '0.85rem' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Mail size={12} /> {client.email}</span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Phone size={12} /> {client.phone}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '16px' }}>
                                        {client.project_id && client.project_stage ? (
                                            <span style={{
                                                display: 'inline-block',
                                                padding: '4px 12px',
                                                borderRadius: '20px',
                                                fontSize: '0.75rem',
                                                fontWeight: 700,
                                                backgroundColor: 'rgb(255, 249, 240)',
                                                color: '#fca412',
                                                border: '1.5px solid #fca412',
                                                letterSpacing: '0.02em'
                                            }}>
                                                {client.project_stage}
                                            </span>
                                        ) : (
                                            <span style={{ fontSize: '0.9rem', color: '#9ca3af', fontWeight: 600 }}>—</span>
                                        )}
                                    </td>

                                    {(user?.role === 'admin' || user?.role === 'd1') && (
                                        <td style={{ padding: '16px', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                <button onClick={() => handleEditClick(client)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', padding: '4px' }}>
                                                    <Edit2 size={16} />
                                                </button>
                                                <button onClick={() => handleDeleteClient(client.client_id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px' }}>
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Client Modal */}
            {showAddModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="premium-card" style={{ width: '100%', maxWidth: '500px' }}>
                        <h3 style={{ marginBottom: '24px', fontSize: '1.4rem' }}>{isEditing ? 'Edit Client Entry' : 'Manual Registry Entry'}</h3>
                        <form onSubmit={handleAddClient}>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Full Name</label>
                                <input type="text" required value={clientForm.name} onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Name of Project</label>
                                    <input type="text" required value={clientForm.projectname} onChange={(e) => setClientForm({ ...clientForm, projectname: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }} placeholder="Enter the name of the project" />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Project Type</label>
                                    <select value={clientForm.consultation_type} onChange={(e) => setClientForm({ ...clientForm, consultation_type: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}>
                                        <option value="Furniture projects">Furniture projects</option>
                                        <option value="Interior Projects">Interior Projects</option>
                                    </select>
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Phone Number</label>
                                    <input type="text" required value={clientForm.phone} onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Email Address</label>
                                    <input type="email" value={clientForm.email} onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
                                </div>
                            </div>
                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Client Address</label>
                                <textarea rows={2} required value={clientForm.address} onChange={(e) => setClientForm({ ...clientForm, address: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                <button type="button" onClick={() => setShowAddModal(false)} style={{ padding: '10px 20px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: 'white' }}>Cancel</button>
                                <button type="submit" disabled={submitting} className="btn-primary">
                                    {submitting ? 'Saving...' : (isEditing ? 'Update Registry' : 'Register Registry')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Launch Project Modal */}
            {showProjectModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="premium-card" style={{ width: '100%', maxWidth: '650px' }}>
                        <h3 style={{ marginBottom: '24px', fontSize: '1.4rem' }}>Assign & Launch: {selectedClient?.name}</h3>
                        <p style={{ marginBottom: '20px', color: '#6b7280', fontSize: '0.9rem' }}>Select the project execution team. (Financial details to be entered by Accountant)</p>
                        <form onSubmit={handleProjectLaunch}>
                            {/* Project ID Input Field */}
                            <div style={{ marginBottom: '16px', backgroundColor: '#f0f4ff', padding: '14px', borderRadius: '10px', border: '1.5px solid #c7d2fe' }}>
                                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.88rem', fontWeight: 800, color: '#1e1b4b' }}>
                                    <span>Enter Project ID *</span>
                                    <span style={{ fontSize: '0.7rem', backgroundColor: '#4338ca', color: '#ffffff', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 }}>Required</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Enter Project ID (e.g. PR-101, LVC-2026-01)"
                                    value={projectForm.project_code}
                                    onChange={(e) => setProjectForm({ ...projectForm, project_code: e.target.value })}
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '2px solid #6366f1', fontSize: '0.95rem', fontWeight: 700, outline: 'none', background: '#ffffff', color: '#1e1b4b' }}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Project Name *</label>
                                    <input type="text" required value={projectForm.project_name} onChange={(e) => setProjectForm({ ...projectForm, project_name: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Project Type</label>
                                    <select value={projectForm.consultation_type} onChange={(e) => setProjectForm({ ...projectForm, consultation_type: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}>
                                        <option value="Furniture projects">Furniture projects</option>
                                        <option value="Interior Projects">Interior Projects</option>
                                    </select>
                                </div>
                            </div>
                            <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '16px', marginBottom: '20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                    <h4 style={{ margin: 0, color: '#0f172a', fontSize: '1rem', fontWeight: 700 }}>Team Allocation</h4>
                                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Select multiple members for each department</span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                                    <TeamMultiSelector
                                        label="Project Head(s)"
                                        items={availableHeads}
                                        selected={projectForm.project_heads}
                                        onChange={(vals) => setProjectForm({ ...projectForm, project_heads: vals })}
                                        emptyText="No project heads found"
                                    />
                                    <TeamMultiSelector
                                        label="Site Engineer(s)"
                                        items={availableEngineers}
                                        selected={projectForm.site_engineers}
                                        onChange={(vals) => setProjectForm({ ...projectForm, site_engineers: vals })}
                                        emptyText="No site engineers found"
                                    />
                                    <TeamMultiSelector
                                        label="Designer(s) (D1 / D2)"
                                        items={availableDesigners}
                                        selected={projectForm.designers}
                                        onChange={(vals) => setProjectForm({ ...projectForm, designers: vals })}
                                        emptyText="No designers found"
                                    />
                                    <TeamMultiSelector
                                        label="Associate Designer(s) (AD)"
                                        items={availableADs}
                                        selected={projectForm.associate_designers}
                                        onChange={(vals) => setProjectForm({ ...projectForm, associate_designers: vals })}
                                        emptyText="No associate designers found"
                                    />
                                    <TeamMultiSelector
                                        label="QC Inspector(s)"
                                        items={availableQcs}
                                        selected={projectForm.qc_inspectors}
                                        onChange={(vals) => setProjectForm({ ...projectForm, qc_inspectors: vals })}
                                        emptyText="No QC inspectors found"
                                    />
                                </div>
                            </div>
                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Start Date *</label>
                                <input type="date" required value={projectForm.start_date} onChange={(e) => setProjectForm({ ...projectForm, start_date: e.target.value })} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #cbd5e1', outline: 'none' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                <button type="button" onClick={() => setShowProjectModal(false)} style={{ padding: '10px 20px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: 'white' }}>Cancel</button>
                                <button type="submit" disabled={submitting} className="btn-primary">
                                    {submitting ? 'Launching...' : 'Activate Project'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
