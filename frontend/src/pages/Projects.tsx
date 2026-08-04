import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth';
import {
    Search,
    Filter,
    Plus,
    Calendar,
    User,
    MapPin,
    Loader2,
    Trash2
} from 'lucide-react';

interface Project {
    project_id: string;
    project_code: string;
    project_name: string;
    client_name: string;
    project_type: string;
    site_address: string;
    start_date: string;
    expected_end_date: string;
    project_head_name: string;
    status: string;
}

interface Client {
    client_id: string;
    name: string;
}

interface TeamMember {
    user_id: string;
    name: string;
    role: string;
}

import { API_BASE_URL } from '../config';

export const Projects: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [projects, setProjects] = useState<Project[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [team, setTeam] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [filterType, setFilterType] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    const [formData, setFormData] = useState({
        project_code: '',
        project_name: '',
        client_id: '',
        project_type: 'Furniture projects',
        site_address: '',
        start_date: new Date().toISOString().split('T')[0],
        expected_end_date: '',
        total_budget: '',
        project_head_id: '',
        site_engineers: [] as string[],
        status: 'Pending',
        created_by: user?.user_id || ''
    });

    useEffect(() => {
        fetchData();
    }, [user]);

    const fetchData = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const [projectsRes, clientsRes, teamRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/projects?user_id=${user.user_id}&role=${user.role}`),
                axios.get(`${API_BASE_URL}/clients`),
                axios.get(`${API_BASE_URL}/users`)
            ]);
            setProjects(projectsRes.data.data || []);
            setClients(clientsRes.data.data || []);
            setTeam(teamRes.data.data || []);
        } catch (err) {
            console.error('Failed to fetch data');
        } finally {
            setLoading(false);
        }
    };

    const handleProjectStatusChange = async (projectId: string, newStatus: string, e: React.ChangeEvent<HTMLSelectElement>) => {
        e.stopPropagation();
        try {
            const res = await axios.post(`${API_BASE_URL}/projects/update-status`, {
                project_id: projectId,
                status: newStatus
            });
            if (res.data.success) {
                fetchData();
            } else {
                alert(res.data.message || 'Failed to update project status');
            }
        } catch (err) {
            alert('Error updating project status');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const response = await axios.post(`${API_BASE_URL}/projects`, {

                ...formData,
                total_budget: 0
            });
            if (response.data.success) {
                setShowAddModal(false);
                setFormData({
                    ...formData,
                    project_code: '',
                    project_name: '',
                    client_id: '',
                    site_address: '',
                    total_budget: ''
                });
                fetchData();
            }
        } catch (err) {
            alert('Error creating project');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm('Are you sure you want to delete this project? This cannot be undone.')) {
            try {
                const res = await axios.delete(`${API_BASE_URL}/projects/${id}`);
                if (res.data.success) {
                    fetchData();
                } else {
                    alert(res.data.message || 'Failed to delete project');
                }
            } catch (err) {
                console.error('Delete error', err);
                alert('An error occurred while deleting the project.');
            }
        }
    };

    return (
        <div className="projects-page">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'black' }}>Projects</h2>
                    <p style={{ color: '#6b7280' }}>Manage project allocations and team assignments</p>
                </div>
            </div>

            <div className="premium-card">
                <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                        <input
                            type="text"
                            placeholder="Search project name, code or client..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: '8px', border: '1px solid #e5e7eb', outline: 'none' }}
                        />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', overflowX: 'auto', paddingBottom: '8px' }}>
                    {[
                        { id: 'all', label: 'All Projects' },
                        { id: 'Furniture projects', label: 'Furniture projects' },
                        { id: 'Interior Projects', label: 'Interior Projects' },
                        { id: 'Execution Projects', label: 'Execution Projects' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setFilterType(tab.id)}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '20px',
                                border: '1px solid #e5e7eb',
                                backgroundColor: filterType === tab.id ? 'black' : 'white',
                                color: filterType === tab.id ? 'white' : '#6b7280',
                                fontWeight: 600,
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                transition: 'all 0.2s'
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 350px), 1fr))',
                    gap: '24px'
                }}>
                    {loading ? (
                        <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px' }}><Loader2 className="animate-spin" style={{ margin: '0 auto' }} /></div>
                    ) : (() => {
                        console.log('Currently loaded projects:', projects);
                        console.log('Current filter type:', filterType);
                        const filtered = projects.filter(p => {
                            const matchesSearch =
                                (p.project_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                                (p.project_code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                                (p.client_name || '').toLowerCase().includes(searchTerm.toLowerCase());

                            const matchesFilter = filterType === 'all' || 
                                (p.project_type && p.project_type.trim().toLowerCase() === filterType.toLowerCase());

                            return matchesSearch && matchesFilter;
                        });

                        if (filtered.length === 0) {
                            return <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px', color: '#6b7280' }}>No projects found matching your criteria.</div>;
                        }

                        return filtered.map((project) => (
                            <div key={project.project_id} className="premium-card"
                                onClick={() => navigate(`/projects/${project.project_id}`)}
                                style={{ border: '1px solid #f3f4f6', transition: 'transform 0.2s', cursor: 'pointer' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                    <div>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>{project.project_code}</span>
                                        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'black', marginTop: '4px' }}>{project.project_name}</h3>
                                        <p style={{ fontSize: '0.9rem', color: 'black', fontWeight: 500 }}>Client: {project.client_name}</p>
                                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                            {project.project_type && (
                                                <span style={{
                                                    padding: '4px 10px',
                                                    borderRadius: '6px',
                                                    backgroundColor: '#1e293b',
                                                    color: '#f8fafc',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 700,
                                                    letterSpacing: '0.5px'
                                                }}>
                                                    {project.project_type}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', color: '#6b7280', fontSize: '0.9rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                        <MapPin size={16} /> <span>{project.site_address}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                        <User size={16} /> <span>Head: {project.project_head_name}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <Calendar size={16} /> <span>{new Date(project.start_date).toLocaleDateString()} - {new Date(project.expected_end_date).toLocaleDateString()}</span>
                                    </div>
                                </div>

                                <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <button style={{ color: 'black', fontWeight: 600, fontSize: '0.85rem', background: 'none', border: 'none', cursor: 'pointer' }}>View Details</button>
                                    {(user?.role === 'admin' || user?.role === 'accountant') && (
                                        <button onClick={(e) => handleDelete(project.project_id, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', padding: '4px' }}>
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    })()}
                </div>
            </div>

            {showAddModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="premium-card" style={{ width: '100%', maxWidth: '750px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <h3 style={{ marginBottom: '24px', fontSize: '1.4rem' }}>Launch New Project</h3>
                        <form onSubmit={handleSubmit}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Project Code</label>
                                    <input type="text" required placeholder="e.g. Livincart-PR-001" value={formData.project_code} onChange={(e) => setFormData({ ...formData, project_code: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Project Name</label>
                                    <input type="text" required value={formData.project_name} onChange={(e) => setFormData({ ...formData, project_name: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Client</label>
                                    <select required value={formData.client_id} onChange={(e) => setFormData({ ...formData, client_id: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}>
                                        <option value="">Select a Client</option>
                                        {clients.map(c => <option key={c.client_id} value={c.client_id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Project Type</label>
                                    <select value={formData.project_type} onChange={(e) => setFormData({ ...formData, project_type: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}>
                                        <option value="Furniture projects">Furniture projects</option>
                                        <option value="Interior Projects">Interior Projects</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Site Address</label>
                                <textarea rows={2} required value={formData.site_address} onChange={(e) => setFormData({ ...formData, site_address: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Start Date</label>
                                    <input type="date" required value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Expected End Date</label>
                                    <input type="date" required value={formData.expected_end_date} onChange={(e) => setFormData({ ...formData, expected_end_date: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
                                </div>
                            </div>

                            <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '16px', marginBottom: '24px' }}>
                                <h4 style={{ marginBottom: '12px', color: 'black' }}>Team Allocation</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Project Head</label>
                                        <select required value={formData.project_head_id} onChange={(e) => setFormData({ ...formData, project_head_id: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}>
                                            <option value="">Assign Head</option>
                                            {team.filter(t => ['admin', 'project_head', 'admin'].includes(t.role)).map(t => (
                                                <option key={t.user_id} value={t.user_id}>{t.name} ({t.role.replace('_', ' ')})</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Site Engineers (Select multiple)</label>
                                        <select multiple value={formData.site_engineers} onChange={(e) => {
                                            const values = Array.from(e.target.selectedOptions, option => option.value);
                                            setFormData({ ...formData, site_engineers: values });
                                        }} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', height: '100px' }}>
                                            {team.filter(t => t.role === 'site_engineer').map(t => (
                                                <option key={t.user_id} value={t.user_id}>{t.name}</option>
                                            ))}
                                        </select>
                                        <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '4px' }}>Hold Ctrl to select multiple engineers</p>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                <button type="button" onClick={() => setShowAddModal(false)} style={{ padding: '10px 20px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: 'white' }}>Cancel</button>
                                <button type="submit" disabled={submitting} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {submitting && <Loader2 className="animate-spin" size={16} />}
                                    Create Project
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
