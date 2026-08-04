import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth';
import { TimelineTab } from './ProjectDetails';
import { API_BASE_URL } from '../config';
import { Loader2, Calendar } from 'lucide-react';

export default function Timeline() {
    const { user } = useAuth();
    const [projects, setProjects] = useState<any[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        fetchProjects();
    }, [user]);

    const fetchProjects = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/projects`);
            const fetchedProjects = res.data.data || [];
            setProjects(fetchedProjects);
            if (fetchedProjects.length > 0 && !selectedProjectId) {
                setSelectedProjectId(fetchedProjects[0].project_id);
            }
        } catch (err) {
            console.error('Failed to fetch projects for timeline', err);
        } finally {
            setLoading(false);
        }
    };

    const selectedProject = projects.find(p => String(p.project_id) === String(selectedProjectId)) || projects[0];

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '60px' }}>
                <Loader2 className="animate-spin" size={32} style={{ margin: '0 auto 16px' }} />
                <p style={{ color: '#6b7280' }}>Loading Project Timelines...</p>
            </div>
        );
    }

    return (
        <div style={{ padding: '30px', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
            {/* Project Selector Bar */}
            <div className="premium-card no-print" style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Calendar size={24} style={{ color: '#2563eb' }} />
                    <div>
                        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>Project Timeline Management</h2>
                        <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: '2px 0 0' }}>Select a project to view and manage work schedules, timeline ranges, and categories.</p>
                    </div>
                </div>

                <div style={{ minWidth: '280px' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Select Project</label>
                    <select
                        value={selectedProjectId}
                        onChange={(e) => setSelectedProjectId(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            backgroundColor: '#ffffff',
                            fontWeight: 600,
                            fontSize: '0.9rem',
                            outline: 'none',
                            cursor: 'pointer'
                        }}
                    >
                        {projects.map(p => (
                            <option key={p.project_id} value={p.project_id}>
                                {p.project_code} — {p.project_name} ({p.client_name || 'Client'})
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Embedded Interactive Timeline */}
            {selectedProject ? (
                <TimelineTab
                    project={selectedProject}
                    user={user}
                    type="designer"
                    fetchProjectDetails={fetchProjects}
                />
            ) : (
                <div className="premium-card" style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                    No projects found. Please create a project first.
                </div>
            )}
        </div>
    );
}