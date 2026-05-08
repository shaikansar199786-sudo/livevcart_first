import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

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
    const [team, setTeam] = useState<any[]>([]);

    const [clientForm, setClientForm] = useState({
        name: '',
        projectname: '',
        consultation_type: 'Interior Design Consultation',
        email: '',
        phone: '',
        address: ''
    });

    const [projectForm, setProjectForm] = useState<{
        project_name: string;
        consultation_type: string;
        project_heads: string[];
        site_engineers: string[];
        total_budget: string;
        start_date: string;
        expected_end_date: string;
    }>({
        project_name: '',
        consultation_type: 'Interior Design Consultation',
        project_heads: [],
        site_engineers: [],
        total_budget: '',
        start_date: new Date().toISOString().split('T')[0],
        expected_end_date: new Date(new Date().setMonth(new Date().getMonth() + 3)).toISOString().split('T')[0]
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

    const fetchTeam = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/users`);
            if (response.data.success) {
                setTeam(response.data.data);
            }
        } catch (err) {
            console.error('Failed to fetch team');
        }
    };

    const handleAddClient = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const response = await axios.post(`${API_BASE_URL}/clients`, {
                ...clientForm,
                created_by: user?.user_id
            });
            if (response.data.success) {
                setShowAddModal(false);
                setClientForm({ name: '', projectname: '', consultation_type: 'Interior Design Consultation', email: '', phone: '', address: '' });
                fetchClients();
            }
        } catch (err) {
            alert('Failed to add client');
        } finally {
            setSubmitting(false);
        }
    };

    const handleLaunchClick = (client: Client) => {
        setSelectedClient(client);
        setProjectForm({
            ...projectForm,
            project_name: client.projectname || (client.name + ' Project'),
            consultation_type: client.consultation_type || 'Interior Design Consultation'
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

    return (
        <div className="clients-page">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#253b50' }}>Registry</h2>
                    <p style={{ color: '#6b7280' }}>All registered clients and their project status</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    <Plus size={18} />
                    Add New Project
                </button>
            </div>

            <div className="premium-card">
                <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                        <input
                            type="text"
                            placeholder="Search by client name, code or phone..."
                            style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: '8px', border: '1px solid #e5e7eb', outline: 'none' }}
                        />
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
                                <th style={{ padding: '16px', color: '#6b7280', fontWeight: 500 }}>Code</th>
                                <th style={{ padding: '16px', color: '#6b7280', fontWeight: 500 }}>Project / Client</th>
                                <th style={{ padding: '16px', color: '#6b7280', fontWeight: 500 }}>Contact</th>
                                <th style={{ padding: '16px', color: '#6b7280', fontWeight: 500 }}>Assign Team</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '40px' }}><Loader2 className="animate-spin" style={{ margin: '0 auto' }} /></td></tr>
                            ) : clients.length === 0 ? (
                                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>No entries found. Click "Add Registry" to create one.</td></tr>
                            ) : clients.map((client, idx) => (
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
                                        {(user?.role === 'principal_architect' || user?.role === 'admin' || user?.role === 'accountant') && (
                                            client.project_id ? (
                                                <button
                                                    onClick={() => navigate(`/projects/${client.project_id}`)}
                                                    style={{ fontSize: '0.75rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                                                >
                                                    <ExternalLink size={14} /> Manage Project
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleLaunchClick(client)}
                                                    className="btn-primary"
                                                    style={{ fontSize: '0.75rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                                                >
                                                    <ExternalLink size={14} /> Assign & Launch
                                                </button>
                                            )
                                        )}
                                    </td>
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
                        <h3 style={{ marginBottom: '24px', fontSize: '1.4rem' }}>Manual Registry Entry</h3>
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
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Consultation Type</label>
                                    <select value={clientForm.consultation_type} onChange={(e) => setClientForm({ ...clientForm, consultation_type: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}>
                                        <option value="Architectural Design Consultation">Architectural Design Consultation</option>
                                        <option value="Interior Design Consultation">Interior Design Consultation</option>
                                        <option value="Arch + Interior">Arch + Interior</option>
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
                                    {submitting ? 'Registering...' : 'Register Registry'}
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
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Project Name</label>
                                    <input type="text" required value={projectForm.project_name} onChange={(e) => setProjectForm({ ...projectForm, project_name: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Consultation Type</label>
                                    <select value={projectForm.consultation_type} onChange={(e) => setProjectForm({ ...projectForm, consultation_type: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}>
                                        <option value="Architectural Design Consultation">Architectural Design Consultation</option>
                                        <option value="Interior Design Consultation">Interior Design Consultation</option>
                                        <option value="Arch + Interior">Arch + Interior</option>
                                    </select>
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                <div style={{ border: '1px solid #d1d5db', borderRadius: '6px', padding: '12px', minHeight: '100px' }}>
                                    <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.9rem', fontWeight: 600 }}>Project Head(s)</label>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {team.filter(t => ['principal_architect', 'project_head', 'admin'].includes(t.role)).map(t => {
                                            const isSelected = projectForm.project_heads.includes(t.user_id);
                                            return (
                                                <div
                                                    key={t.user_id}
                                                    onClick={() => {
                                                        const newHeads = isSelected
                                                            ? projectForm.project_heads.filter(id => id !== t.user_id)
                                                            : [...projectForm.project_heads, t.user_id];
                                                        setProjectForm({ ...projectForm, project_heads: newHeads });
                                                    }}
                                                    style={{
                                                        padding: '6px 14px',
                                                        borderRadius: '20px',
                                                        fontSize: '0.85rem',
                                                        cursor: 'pointer',
                                                        border: `1px solid ${isSelected ? '#253b50' : '#e5e7eb'}`,
                                                        backgroundColor: isSelected ? '#253b50' : '#f9fafb',
                                                        color: isSelected ? 'white' : '#374151',
                                                        fontWeight: isSelected ? 600 : 400,
                                                        transition: 'all 0.2s ease',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '6px'
                                                    }}
                                                >
                                                    {isSelected && <span style={{ fontSize: '14px', lineHeight: 1 }}>✓</span>}
                                                    {t.name}
                                                </div>
                                            );
                                        })}
                                        {team.filter(t => ['principal_architect', 'project_head', 'admin'].includes(t.role)).length === 0 && (
                                            <p style={{ color: '#9ca3af', fontSize: '0.85rem' }}>No project heads available</p>
                                        )}
                                    </div>
                                    <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '10px' }}>Click to select or unselect team members</p>
                                </div>
                                <div style={{ border: '1px solid #d1d5db', borderRadius: '6px', padding: '12px', minHeight: '100px' }}>
                                    <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.9rem', fontWeight: 600 }}>Site Engineer(s)</label>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {team.filter(t => t.role === 'site_engineer').map(t => {
                                            const isSelected = projectForm.site_engineers.includes(t.user_id);
                                            return (
                                                <div
                                                    key={t.user_id}
                                                    onClick={() => {
                                                        const newEngineers = isSelected
                                                            ? projectForm.site_engineers.filter(id => id !== t.user_id)
                                                            : [...projectForm.site_engineers, t.user_id];
                                                        setProjectForm({ ...projectForm, site_engineers: newEngineers });
                                                    }}
                                                    style={{
                                                        padding: '6px 14px',
                                                        borderRadius: '20px',
                                                        fontSize: '0.85rem',
                                                        cursor: 'pointer',
                                                        border: `1px solid ${isSelected ? '#253b50' : '#e5e7eb'}`,
                                                        backgroundColor: isSelected ? '#253b50' : '#f9fafb',
                                                        color: isSelected ? 'white' : '#374151',
                                                        fontWeight: isSelected ? 600 : 400,
                                                        transition: 'all 0.2s ease',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '6px'
                                                    }}
                                                >
                                                    {isSelected && <span style={{ fontSize: '14px', lineHeight: 1 }}>✓</span>}
                                                    {t.name}
                                                </div>
                                            );
                                        })}
                                        {team.filter(t => t.role === 'site_engineer').length === 0 && (
                                            <p style={{ color: '#9ca3af', fontSize: '0.85rem' }}>No site engineers available</p>
                                        )}
                                    </div>
                                    <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '10px' }}>Click to select or unselect team members</p>
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Start Date</label>
                                    <input type="date" required value={projectForm.start_date} onChange={(e) => setProjectForm({ ...projectForm, start_date: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>End Date</label>
                                    <input type="date" required value={projectForm.expected_end_date} onChange={(e) => setProjectForm({ ...projectForm, expected_end_date: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
                                </div>
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
