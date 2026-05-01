import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useAuth } from '../hooks/useAuth';
import {
    Package,
    ShoppingCart,
    CheckCircle2,
    XCircle,
    Clock,
    Loader2
} from 'lucide-react';

interface MaterialRequest {
    request_id: string;
    project_name: string;
    item_name: string;
    quantity: string;
    unit: string;
    urgency: string;
    status: string;
    requester_name: string;
    created_at: string;
}

interface Project {
    project_id: string;
    project_name: string;
}

export const Inventory: React.FC = () => {
    const { user } = useAuth();
    const [requests, setRequests] = useState<MaterialRequest[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        project_id: '',
        item_name: '',
        quantity: '',
        unit: 'nos',
        urgency: 'normal',
        requested_by: user?.user_id || ''
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [requestsRes, projectsRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/inventory/requests`),
                axios.get(`${API_BASE_URL}/projects`)
            ]);
            setRequests(requestsRes.data.data || []);
            setProjects(projectsRes.data.data || []);
        } catch (err) {
            console.error('Failed to fetch data');
        } finally {
            setLoading(false);
        }
    };

    const handleStatusUpdate = async (requestId: string, status: string) => {
        try {
            const response = await axios.post(`${API_BASE_URL}/inventory/update-request`, {
                request_id: requestId,
                status: status,
                user_id: user?.user_id
            });
            if (response.data.success) {
                fetchData();
            }
        } catch (err) {
            alert('Error updating request');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const response = await axios.post(`${API_BASE_URL}/inventory/request`, formData);
            if (response.data.success) {
                setShowRequestModal(false);
                setFormData({ ...formData, item_name: '', quantity: '' });
                fetchData();
            }
        } catch (err) {
            alert('Error submitting request');
        } finally {
            setSubmitting(false);
        }
    };

    const isAdmin = user?.role === 'principal_architect' || user?.role === 'admin' || user?.role === 'project_head';

    return (
        <div className="inventory-page">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#253b50' }}>Inventory & Materials</h2>
                    <p style={{ color: '#6b7280' }}>Track material requests and site stock levels</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                        onClick={() => setShowRequestModal(true)}
                        className="btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        <ShoppingCart size={18} />
                        Request Material
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '30px' }}>
                <div className="premium-card" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: '#e0e7ff', color: '#3730a3' }}><Package size={24} /></div>
                    <div><h4 style={{ fontSize: '1.4rem', fontWeight: 700 }}>{requests.length}</h4><p style={{ fontSize: '0.85rem', color: '#6b7280' }}>Total Requests</p></div>
                </div>
                <div className="premium-card" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: '#fef3c7', color: '#92400e' }}><Clock size={24} /></div>
                    <div><h4 style={{ fontSize: '1.4rem', fontWeight: 700 }}>{requests.filter(r => r.status === 'pending').length}</h4><p style={{ fontSize: '0.85rem', color: '#6b7280' }}>Pending Approval</p></div>
                </div>
                <div className="premium-card" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: '#d1fae5', color: '#065f46' }}><CheckCircle2 size={24} /></div>
                    <div><h4 style={{ fontSize: '1.4rem', fontWeight: 700 }}>{requests.filter(r => r.status === 'approved').length}</h4><p style={{ fontSize: '0.85rem', color: '#6b7280' }}>Fulfilled</p></div>
                </div>
            </div>

            <div className="premium-card">
                <h3 style={{ marginBottom: '20px' }}>Recent Material Requests</h3>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
                                <th style={{ padding: '16px', color: '#6b7280', fontWeight: 500 }}>Item & Project</th>
                                <th style={{ padding: '16px', color: '#6b7280', fontWeight: 500 }}>Qty</th>
                                <th style={{ padding: '16px', color: '#6b7280', fontWeight: 500 }}>Requested By</th>
                                <th style={{ padding: '16px', color: '#6b7280', fontWeight: 500 }}>Urgency</th>
                                <th style={{ padding: '16px', color: '#6b7280', fontWeight: 500 }}>Status</th>
                                <th style={{ padding: '16px', color: '#6b7280', fontWeight: 500 }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px' }}><Loader2 className="animate-spin" style={{ margin: '0 auto' }} /></td></tr>
                            ) : requests.map((req) => (
                                <tr key={req.request_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '16px' }}>
                                        <div style={{ fontWeight: 600 }}>{req.item_name}</div>
                                        <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{req.project_name}</div>
                                    </td>
                                    <td style={{ padding: '16px' }}>{req.quantity} {req.unit}</td>
                                    <td style={{ padding: '16px' }}>
                                        <div style={{ fontSize: '0.9rem' }}>{req.requester_name}</div>
                                        <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{new Date(req.created_at).toLocaleDateString()}</div>
                                    </td>
                                    <td style={{ padding: '16px' }}>
                                        <span style={{
                                            fontSize: '0.75rem',
                                            padding: '2px 8px',
                                            borderRadius: '10px',
                                            backgroundColor: req.urgency === 'high' ? '#fee2e2' : '#f3f4f6',
                                            color: req.urgency === 'high' ? '#ef4444' : '#6b7280',
                                            fontWeight: 600
                                        }}>
                                            {req.urgency.toUpperCase()}
                                        </span>
                                    </td>
                                    <td style={{ padding: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                                            {req.status === 'pending' && <Clock size={14} style={{ color: '#f59e0b' }} />}
                                            {req.status === 'approved' && <CheckCircle2 size={14} style={{ color: '#10b981' }} />}
                                            <span style={{ textTransform: 'capitalize' }}>{req.status}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '16px' }}>
                                        {isAdmin && req.status === 'pending' && (
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button onClick={() => handleStatusUpdate(req.request_id, 'approved')} style={{ color: '#10b981', background: 'none', border: 'none', cursor: 'pointer' }}><CheckCircle2 size={20} /></button>
                                                <button onClick={() => handleStatusUpdate(req.request_id, 'rejected')} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}><XCircle size={20} /></button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {showRequestModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="premium-card" style={{ width: '100%', maxWidth: '500px' }}>
                        <h3 style={{ marginBottom: '24px', fontSize: '1.4rem' }}>Material Request</h3>
                        <form onSubmit={handleSubmit}>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Select Project</label>
                                <select required value={formData.project_id} onChange={(e) => setFormData({ ...formData, project_id: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}>
                                    <option value="">Select Project</option>
                                    {projects.map(p => <option key={p.project_id} value={p.project_id}>{p.project_name}</option>)}
                                </select>
                            </div>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Material / Item Name</label>
                                <input type="text" required placeholder="e.g. Cement (43 Grade), Teak Wood, etc." value={formData.item_name} onChange={(e) => setFormData({ ...formData, item_name: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Quantity</label>
                                    <input type="number" required value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Unit</label>
                                    <select value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}>
                                        <option value="pcs">Pieces (pcs)</option>
                                        <option value="bags">Bags</option>
                                        <option value="kg">Kilograms (kg)</option>
                                        <option value="sqft">Square Feet (sqft)</option>
                                        <option value="ltr">Liters (ltr)</option>
                                    </select>
                                </div>
                            </div>
                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Urgency Level</label>
                                <div style={{ display: 'flex', gap: '20px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                        <input type="radio" value="normal" checked={formData.urgency === 'normal'} onChange={(e) => setFormData({ ...formData, urgency: e.target.value })} /> Normal
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#ef4444' }}>
                                        <input type="radio" value="high" checked={formData.urgency === 'high'} onChange={(e) => setFormData({ ...formData, urgency: e.target.value })} /> High Urgency
                                    </label>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                <button type="button" onClick={() => setShowRequestModal(false)} style={{ padding: '10px 20px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: 'white' }}>Cancel</button>
                                <button type="submit" disabled={submitting} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {submitting && <Loader2 className="animate-spin" size={16} />}
                                    Submit Request
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
