import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useAuth } from '../hooks/useAuth';
import {
  UserPlus,
  Search,
  CheckCircle2,
  MoreVertical,
  ArrowRightCircle,
  Loader2,
  Phone,
  MapPin,
  Pencil
} from 'lucide-react';
interface Lead {
  lead_id: string;
  client_name: string;
  contact_number: string;
  email: string;
  location: string;
  project_type: string;
  estimated_budget: string;
  status: 'enquiry' | 'proposal_sent' | 'converted' | 'won' | 'lost';
  lead_source: string;
}
export const Leads: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [team, setTeam] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    client_name: '',
    contact_number: '',
    email: '',
    location: '',
    project_type: 'residential_interior',
    estimated_budget: '',
    lead_source: 'walk_in',
    created_by: user?.user_id || ''
  });
  const [convertData, setConvertData] = useState({
    project_name: '',
    project_head_id: '',
    site_engineer_id: '',
    total_budget: '',
    start_date: new Date().toISOString().split('T')[0],
    expected_end_date: new Date(new Date().setMonth(new Date().getMonth() + 4)).toISOString().split('T')[0]
  });
  useEffect(() => {
    fetchLeads();
    fetchTeam();
  }, []);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/leads`);
      if (response.data.success) {
        setLeads(response.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch leads');
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

  const handleStatusUpdate = async (lead_id: string, newStatus: string) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/leads/update-status`, {
        lead_id,
        status: newStatus
      });
      if (response.data.success) {
        fetchLeads();
      }
    } catch (err) {
      alert('Error updating status');
    }
  };

  const handleConvertClick = (lead: Lead) => {
    setSelectedLead(lead);
    setConvertData({
      ...convertData,
      project_name: lead.client_name + ' Project'
    });
    setShowConvertModal(true);
  };

  const handleConversionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/leads/update-status`, {
        lead_id: selectedLead?.lead_id,
        status: 'won',
        data: {
          ...convertData,
          total_budget: 0,
          advance_paid: 0, // Accountant will record this in Finance
          created_by: user?.user_id
        }
      });
      if (response.data.success) {
        setShowConvertModal(false);
        fetchLeads();
        navigate(`/projects/${response.data.project_id}`);
      } else {
        alert(response.data.message);
      }
    } catch (err) {
      alert('Conversion failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditClick = (lead: Lead) => {
    setEditingLead(lead);
    setFormData({
      client_name: lead.client_name,
      contact_number: lead.contact_number,
      email: lead.email || '',
      location: lead.location,
      project_type: lead.project_type,
      estimated_budget: lead.estimated_budget,
      lead_source: lead.lead_source,
      created_by: user?.user_id || ''
    });
    setShowEditModal(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const response = await axios.put(`${API_BASE_URL}/leads`, {
        ...formData,
        lead_id: editingLead?.lead_id
      });
      if (response.data.success) {
        setShowEditModal(false);
        setEditingLead(null);
        fetchLeads();
      }
    } catch (err) {
      alert('Error updating lead');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/leads`, {
        ...formData,
        created_by: user?.user_id
      });
      if (response.data.success) {
        setShowAddModal(false);
        setFormData({
          ...formData,
          client_name: '',
          contact_number: '',
          email: '',
          location: '',
          estimated_budget: ''
        });
        fetchLeads();
      }
    } catch (err) {
      alert('Error adding lead');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'won': return { bg: '#d1fae5', text: '#065f46' };
      case 'proposal_sent': return { bg: '#e0e7ff', text: '#3730a3' };
      case 'lost': return { bg: '#fee2e2', text: '#991b1b' };
      default: return { bg: '#f3f4f6', text: '#374151' };
    }
  };

  return (
    <div className="leads-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#253b50' }}>Lead Management</h2>
          <p style={{ color: '#6b7280' }}>Track enquiries and customer conversions</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <UserPlus size={18} />
          New Enquiry
        </button>
      </div>

      <div className="premium-card">
        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
            <input
              type="text"
              placeholder="Search by client name or contact..."
              style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: '8px', border: '1px solid #e5e7eb', outline: 'none' }}
            />
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
                <th style={{ padding: '16px', color: '#6b7280', fontWeight: 500 }}>Client Info</th>
                <th style={{ padding: '16px', color: '#6b7280', fontWeight: 500 }}>Project Type</th>
                <th style={{ padding: '16px', color: '#6b7280', fontWeight: 500 }}>Est. Budget</th>
                <th style={{ padding: '16px', color: '#6b7280', fontWeight: 500 }}>Status</th>
                <th style={{ padding: '16px', color: '#6b7280', fontWeight: 500 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px' }}><Loader2 className="animate-spin" style={{ margin: '0 auto' }} /></td></tr>
              ) : leads.map((lead) => (
                <tr key={lead.lead_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '16px' }}>
                    <div style={{ fontWeight: 600, color: '#253b50' }}>{lead.client_name}</div>
                    <div style={{ fontSize: '0.85rem', color: '#6b7280', display: 'flex', gap: '10px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Phone size={12} /> {lead.contact_number}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={12} /> {lead.location}</span>
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span style={{ textTransform: 'capitalize' }}>{lead.project_type.replace('_', ' ')}</span>
                  </td>
                  <td style={{ padding: '16px', fontWeight: 600 }}>₹{parseFloat(lead.estimated_budget).toLocaleString()}</td>
                  <td style={{ padding: '16px' }}>
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: '20px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      backgroundColor: getStatusColor(lead.status).bg,
                      color: getStatusColor(lead.status).text,
                      textTransform: 'capitalize'
                    }}>
                      {lead.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => handleEditClick(lead)} title="Edit Lead" style={{ color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer' }}><Pencil size={18} /></button>
                      {lead.status === 'enquiry' && (
                        <button onClick={() => handleStatusUpdate(lead.lead_id, 'proposal_sent')} title="Send Proposal" style={{ color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer' }}><ArrowRightCircle size={20} /></button>
                      )}
                      {(lead.status === 'proposal_sent' || lead.status === 'enquiry') && (user?.role === 'principal_architect' || user?.role === 'admin') && (
                        <button onClick={() => handleConvertClick(lead)} title="Finalize Project" style={{ color: '#10b981', background: 'none', border: 'none', cursor: 'pointer' }}><CheckCircle2 size={20} /></button>
                      )}
                      <button style={{ color: '#9ca3af', background: 'none', border: 'none' }}><MoreVertical size={20} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showConvertModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="premium-card" style={{ width: '100%', maxWidth: '650px' }}>
            <h3 style={{ marginBottom: '24px', fontSize: '1.4rem', color: '#253b50' }}>Launch Project: {selectedLead?.client_name}</h3>
            <p style={{ marginBottom: '20px', color: '#6b7280', fontSize: '0.9rem' }}>Assign the core execution team. (Budget & Advance will be managed by Accountant later)</p>
            <form onSubmit={handleConversionSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Project Name</label>
                <input type="text" required value={convertData.project_name} onChange={(e) => setConvertData({ ...convertData, project_name: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Project Head</label>
                  <select required value={convertData.project_head_id} onChange={(e) => setConvertData({ ...convertData, project_head_id: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}>
                    <option value="">Select Head</option>
                    {team.filter(t => ['principal_architect', 'project_head', 'admin'].includes(t.role)).map(t => (
                      <option key={t.user_id} value={t.user_id}>{t.name} ({t.role.replace('_', ' ')})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Site Engineer</label>
                  <select required value={convertData.site_engineer_id} onChange={(e) => setConvertData({ ...convertData, site_engineer_id: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}>
                    <option value="">Select Engineer</option>
                    {team.filter(t => t.role === 'site_engineer').map(t => <option key={t.user_id} value={t.user_id}>{t.name}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Start Date</label>
                  <input type="date" required value={convertData.start_date} onChange={(e) => setConvertData({ ...convertData, start_date: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>End Date</label>
                  <input type="date" required value={convertData.expected_end_date} onChange={(e) => setConvertData({ ...convertData, expected_end_date: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowConvertModal(false)} style={{ padding: '10px 20px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: 'white' }}>Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting ? 'Assigning...' : 'Assign & Launch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="premium-card" style={{ width: '100%', maxWidth: '600px' }}>
            <h3 style={{ marginBottom: '24px', fontSize: '1.4rem' }}>New Customer Enquiry</h3>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Client Name</label>
                  <input type="text" required value={formData.client_name} onChange={(e) => setFormData({ ...formData, client_name: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Contact Number</label>
                  <input type="text" required value={formData.contact_number} onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Project Type</label>
                  <select value={formData.project_type} onChange={(e) => setFormData({ ...formData, project_type: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}>
                    <option value="residential_interior">Residential Interior</option>
                    <option value="commercial_interior">Commercial Interior</option>
                    <option value="architecture">Architecture</option>
                    <option value="landscape">Landscape</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Estimated Budget (₹)</label>
                  <input type="number" required value={formData.estimated_budget} onChange={(e) => setFormData({ ...formData, estimated_budget: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Site Location / Address</label>
                <textarea rows={2} value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Email Address</label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Lead Source</label>
                  <select value={formData.lead_source} onChange={(e) => setFormData({ ...formData, lead_source: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}>
                    <option value="walk_in">Walk-in</option>
                    <option value="reference">Reference</option>
                    <option value="website">Website</option>
                    <option value="social_media">Social Media</option>
                    <option value="advertisement">Advertisement</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowAddModal(false)} style={{ padding: '10px 20px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: 'white' }}>Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {submitting && <Loader2 className="animate-spin" size={16} />}
                  Save Enquiry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="premium-card" style={{ width: '100%', maxWidth: '600px' }}>
            <h3 style={{ marginBottom: '24px', fontSize: '1.4rem' }}>Edit Customer Enquiry</h3>
            <form onSubmit={handleUpdate}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Client Name</label>
                  <input type="text" required value={formData.client_name} onChange={(e) => setFormData({ ...formData, client_name: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Contact Number</label>
                  <input type="text" required value={formData.contact_number} onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Project Type</label>
                  <select value={formData.project_type} onChange={(e) => setFormData({ ...formData, project_type: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}>
                    <option value="residential_interior">Residential Interior</option>
                    <option value="commercial_interior">Commercial Interior</option>
                    <option value="architecture">Architecture</option>
                    <option value="landscape">Landscape</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Estimated Budget (₹)</label>
                  <input type="number" required value={formData.estimated_budget} onChange={(e) => setFormData({ ...formData, estimated_budget: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Site Location / Address</label>
                <textarea rows={2} value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Email Address</label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 500 }}>Lead Source</label>
                  <select value={formData.lead_source} onChange={(e) => setFormData({ ...formData, lead_source: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}>
                    <option value="walk_in">Walk-in</option>
                    <option value="reference">Reference</option>
                    <option value="website">Website</option>
                    <option value="social_media">Social Media</option>
                    <option value="advertisement">Advertisement</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => { setShowEditModal(false); setEditingLead(null); }} style={{ padding: '10px 20px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: 'white' }}>Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {submitting && <Loader2 className="animate-spin" size={16} />}
                  Update Enquiry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
