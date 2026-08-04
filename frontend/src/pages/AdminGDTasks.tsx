import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    CheckCircle2,
    XCircle,
    Clock,
    UserCheck,
    PlusCircle,
    FileText,
    Send,
    X,
    Link,
    Filter,
    ShieldAlert,
    Check,
    Layers
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { API_BASE_URL } from '../config';

export const AdminGDTasks: React.FC = () => {
    const { user } = useAuth();

    const [tasks, setTasks] = useState<any[]>([]);
    const [team, setTeam] = useState<any[]>([]);
    const [selectedGdId, setSelectedGdId] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState<'submissions_review' | 'completion_approvals' | 'assign_task'>('submissions_review');

    // Reject Modal state
    const [rejectingItem, setRejectingItem] = useState<any | null>(null);
    const [rejectNotes, setRejectNotes] = useState('');
    const [rejectType, setRejectType] = useState<'submission' | 'completion'>('submission');

    // Direct Task Assignment Form state
    const [assignForm, setAssignForm] = useState({
        user_id: '',
        task_title: '',
        description: '',
        target_type: 'daily',
        target_date: new Date().toISOString().split('T')[0],
        admin_notes: 'Assigned directly by Admin'
    });

    useEffect(() => {
        fetchTeam();
        fetchTasks();
    }, [selectedGdId]);

    const fetchTeam = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/users`);
            if (res.data.success) {
                // Filter ONLY graphic_designer or gd roles (excluding d1)
                const gdMembers = (res.data.data || []).filter((u: any) => {
                    const r = String(u.role || '').toLowerCase();
                    return r === 'graphic_designer' || r === 'gd' || r.includes('graphic');
                });
                setTeam(gdMembers);
            }
        } catch (err) {
            console.error('Failed to fetch team members', err);
        }
    };

    const fetchTasks = async () => {
        setLoading(true);
        try {
            const url = selectedGdId
                ? `${API_BASE_URL}/gd-tasks?gd_user_id=${selectedGdId}`
                : `${API_BASE_URL}/gd-tasks`;
            const res = await axios.get(url);
            if (res.data.success) {
                setTasks(res.data.data || []);
            }
        } catch (err) {
            console.error('Failed to fetch GD tasks', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAcceptSubmission = async (taskId: number) => {
        try {
            const res = await axios.post(`${API_BASE_URL}/gd-tasks/review-submission`, {
                id: taskId,
                action: 'accept'
            });
            if (res.data.success) {
                alert('Target submission accepted! It is now active on the Graphic Designer\'s task list.');
                fetchTasks();
            }
        } catch (err) {
            alert('Failed to accept submission.');
        }
    };

    const handleRejectSubmission = async () => {
        if (!rejectingItem) return;
        setSubmitting(true);
        try {
            const endpoint = rejectType === 'submission'
                ? `${API_BASE_URL}/gd-tasks/review-submission`
                : `${API_BASE_URL}/gd-tasks/review-completion`;

            const res = await axios.post(endpoint, {
                id: rejectingItem.id,
                action: 'reject',
                notes: rejectNotes.trim()
            });

            if (res.data.success) {
                alert('Rejection notes sent to the Graphic Designer.');
                setRejectingItem(null);
                setRejectNotes('');
                fetchTasks();
            }
        } catch (err) {
            alert('Failed to process rejection.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleApproveCompletion = async (taskId: number) => {
        try {
            const res = await axios.post(`${API_BASE_URL}/gd-tasks/review-completion`, {
                id: taskId,
                action: 'approve'
            });
            if (res.data.success) {
                alert('Task completion officially approved!');
                fetchTasks();
            }
        } catch (err) {
            alert('Failed to approve completion.');
        }
    };

    const handleAssignDirectTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!assignForm.user_id || !assignForm.task_title.trim()) return;

        setSubmitting(true);
        try {
            const selectedMember = team.find(t => String(t.user_id) === String(assignForm.user_id));

            const res = await axios.post(`${API_BASE_URL}/gd-tasks/assign`, {
                user_id: assignForm.user_id,
                gd_name: selectedMember?.name || 'Graphic Designer',
                task_title: assignForm.task_title.trim(),
                description: assignForm.description,
                target_type: assignForm.target_type,
                target_date: assignForm.target_date,
                admin_notes: assignForm.admin_notes
            });

            if (res.data.success) {
                alert('Task assigned to Graphic Designer!');
                setAssignForm({
                    user_id: '',
                    task_title: '',
                    description: '',
                    target_type: 'daily',
                    target_date: new Date().toISOString().split('T')[0],
                    admin_notes: 'Assigned directly by Admin'
                });
                setActiveTab('submissions_review');
                fetchTasks();
            }
        } catch (err) {
            alert('Failed to assign task.');
        } finally {
            setSubmitting(false);
        }
    };

    const pendingSubmissions = tasks.filter(t => t.status === 'pending_admin_review');
    const pendingCompletions = tasks.filter(t => t.status === 'pending_completion_approval');

    return (
        <div style={{ padding: '24px', maxWidth: '1280px', margin: '0 auto', color: '#1e293b' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                        Admin GD Task & Target Approvals
                    </h1>
                    <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: '#64748b' }}>
                        Review target work submissions from Graphic Designers, approve completed tasks, and assign direct targets.
                    </p>
                </div>

                {/* Filter by GD Employee */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', padding: '6px 14px', borderRadius: '10px' }}>
                    <Filter size={16} style={{ color: '#64748b' }} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569' }}>Select GD:</span>
                    <select
                        value={selectedGdId}
                        onChange={e => setSelectedGdId(e.target.value)}
                        style={{ border: 'none', background: 'transparent', fontSize: '0.88rem', fontWeight: 700, color: '#0f172a', outline: 'none', cursor: 'pointer' }}
                    >
                        <option value="">All Graphic Designers</option>
                        {team.map(m => (
                            <option key={m.user_id} value={m.user_id}>{m.name} ({m.role})</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div style={{ display: 'flex', backgroundColor: '#e2e8f0', borderRadius: '10px', padding: '4px', marginBottom: '24px', width: 'fit-content' }}>
                <button
                    onClick={() => setActiveTab('submissions_review')}
                    style={{
                        border: 'none',
                        padding: '10px 20px',
                        borderRadius: '8px',
                        fontSize: '0.88rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        backgroundColor: activeTab === 'submissions_review' ? '#ffffff' : 'transparent',
                        color: activeTab === 'submissions_review' ? '#0f172a' : '#64748b',
                        boxShadow: activeTab === 'submissions_review' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'
                    }}
                >
                    Target Submissions Review ({pendingSubmissions.length})
                </button>

                <button
                    onClick={() => setActiveTab('completion_approvals')}
                    style={{
                        border: 'none',
                        padding: '10px 20px',
                        borderRadius: '8px',
                        fontSize: '0.88rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        backgroundColor: activeTab === 'completion_approvals' ? '#ffffff' : 'transparent',
                        color: activeTab === 'completion_approvals' ? '#0f172a' : '#64748b',
                        boxShadow: activeTab === 'completion_approvals' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'
                    }}
                >
                    Completion Approvals ({pendingCompletions.length})
                </button>

                <button
                    onClick={() => setActiveTab('assign_task')}
                    style={{
                        border: 'none',
                        padding: '10px 20px',
                        borderRadius: '8px',
                        fontSize: '0.88rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        backgroundColor: activeTab === 'assign_task' ? '#ffffff' : 'transparent',
                        color: activeTab === 'assign_task' ? '#0f172a' : '#64748b',
                        boxShadow: activeTab === 'assign_task' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'
                    }}
                >
                    + Assign New Target Task
                </button>
            </div>

            {/* TAB 1: SUBMISSIONS REVIEW */}
            {activeTab === 'submissions_review' && (
                <div>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                        Pending Target Submissions from Graphic Designers ({pendingSubmissions.length})
                    </h3>

                    {loading ? (
                        <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>Loading submissions...</div>
                    ) : pendingSubmissions.length === 0 ? (
                        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px dashed #cbd5e1', padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>
                            ✓ No pending target submissions to review.
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
                            {pendingSubmissions.map(item => (
                                <div key={item.id} style={{ backgroundColor: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                            <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', padding: '3px 8px', borderRadius: '4px', backgroundColor: '#fef3c7', color: '#b45309' }}>
                                                {item.target_type} Target Submission
                                            </span>
                                            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
                                                {item.target_date || 'No Date'}
                                            </span>
                                        </div>

                                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#2563eb', marginBottom: '4px' }}>
                                            Submitted by: {item.employee_name || item.gd_name || 'Graphic Designer'}
                                        </div>

                                        <h4 style={{ margin: '0 0 8px 0', fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>{item.task_title}</h4>
                                        {item.description && <p style={{ fontSize: '0.85rem', color: '#475569', margin: '0 0 12px 0', lineHeight: '1.4' }}>{item.description}</p>}

                                        {item.attachment_url && (
                                            <div style={{ marginBottom: '12px' }}>
                                                <a href={item.attachment_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.82rem', color: '#2563eb', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
                                                    <Link size={14} /> Open Artwork / Drive Attachment
                                                </a>
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div style={{ display: 'flex', gap: '10px', borderTop: '1px solid #f1f5f9', paddingTop: '14px', marginTop: '12px' }}>
                                        <button
                                            onClick={() => handleAcceptSubmission(item.id)}
                                            style={{
                                                flex: 1,
                                                backgroundColor: '#16a34a',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '8px',
                                                padding: '10px',
                                                fontSize: '0.82rem',
                                                fontWeight: 700,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '6px'
                                            }}
                                        >
                                            <CheckCircle2 size={16} /> Accept & Start Task
                                        </button>

                                        <button
                                            onClick={() => { setRejectingItem(item); setRejectType('submission'); setRejectNotes(''); }}
                                            style={{
                                                flex: 1,
                                                backgroundColor: '#dc2626',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '8px',
                                                padding: '10px',
                                                fontSize: '0.82rem',
                                                fontWeight: 700,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '6px'
                                            }}
                                        >
                                            <XCircle size={16} /> Reject & Send Feedback
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 2: COMPLETION APPROVALS */}
            {activeTab === 'completion_approvals' && (
                <div>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                        Tasks Marked Complete by Graphic Designers ({pendingCompletions.length})
                    </h3>

                    {loading ? (
                        <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>Loading completion requests...</div>
                    ) : pendingCompletions.length === 0 ? (
                        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px dashed #cbd5e1', padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>
                            ✓ No completion approvals pending.
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
                            {pendingCompletions.map(item => (
                                <div key={item.id} style={{ backgroundColor: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                            <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', padding: '3px 8px', borderRadius: '4px', backgroundColor: '#dcfce7', color: '#15803d' }}>
                                                {item.target_type} Completion Review
                                            </span>
                                        </div>

                                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#2563eb', marginBottom: '4px' }}>
                                            GD Designer: {item.employee_name || item.gd_name || 'Graphic Designer'}
                                        </div>

                                        <h4 style={{ margin: '0 0 8px 0', fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>{item.task_title}</h4>
                                        {item.description && <p style={{ fontSize: '0.85rem', color: '#475569', margin: '0 0 12px 0', lineHeight: '1.4' }}>{item.description}</p>}

                                        {item.attachment_url && (
                                            <div style={{ marginBottom: '12px' }}>
                                                <a href={item.attachment_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.82rem', color: '#2563eb', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
                                                    <Link size={14} /> Open Final Completed Artwork
                                                </a>
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div style={{ display: 'flex', gap: '10px', borderTop: '1px solid #f1f5f9', paddingTop: '14px', marginTop: '12px' }}>
                                        <button
                                            onClick={() => handleApproveCompletion(item.id)}
                                            style={{
                                                flex: 1,
                                                backgroundColor: '#16a34a',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '8px',
                                                padding: '10px',
                                                fontSize: '0.82rem',
                                                fontWeight: 700,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '6px'
                                            }}
                                        >
                                            <CheckCircle2 size={16} /> Approve & Mark Complete
                                        </button>

                                        <button
                                            onClick={() => { setRejectingItem(item); setRejectType('completion'); setRejectNotes(''); }}
                                            style={{
                                                flex: 1,
                                                backgroundColor: '#dc2626',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '8px',
                                                padding: '10px',
                                                fontSize: '0.82rem',
                                                fontWeight: 700,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '6px'
                                            }}
                                        >
                                            <XCircle size={16} /> Request Changes
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 3: DIRECT TASK ASSIGNMENT */}
            {activeTab === 'assign_task' && (
                <div style={{ backgroundColor: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '24px', maxWidth: '600px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <PlusCircle size={20} style={{ color: '#2563eb' }} /> Directly Assign Target Task to GD
                    </h3>

                    <form onSubmit={handleAssignDirectTask}>
                        <div style={{ marginBottom: '14px' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Select Graphic Designer *</label>
                            <select
                                required
                                value={assignForm.user_id}
                                onChange={e => setAssignForm({ ...assignForm, user_id: e.target.value })}
                                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', outline: 'none' }}
                            >
                                <option value="">-- Choose Graphic Designer --</option>
                                {team.map(m => (
                                    <option key={m.user_id} value={m.user_id}>{m.name} ({m.role})</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ marginBottom: '14px' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Target Schedule Type</label>
                            <select
                                value={assignForm.target_type}
                                onChange={e => setAssignForm({ ...assignForm, target_type: e.target.value })}
                                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', outline: 'none' }}
                            >
                                <option value="daily">Daily Target</option>
                                <option value="weekly">Weekly Target</option>
                                <option value="monthly">Monthly Target</option>
                            </select>
                        </div>

                        <div style={{ marginBottom: '14px' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Task / Artwork Title *</label>
                            <input
                                type="text"
                                required
                                placeholder="e.g. Master Bedroom 3D Masking Cutouts..."
                                value={assignForm.task_title}
                                onChange={e => setAssignForm({ ...assignForm, task_title: e.target.value })}
                                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', outline: 'none' }}
                            />
                        </div>

                        <div style={{ marginBottom: '14px' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Target Date</label>
                            <input
                                type="date"
                                required
                                value={assignForm.target_date}
                                onChange={e => setAssignForm({ ...assignForm, target_date: e.target.value })}
                                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', outline: 'none' }}
                            />
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Instructions & Description</label>
                            <textarea
                                rows={3}
                                placeholder="Enter specific design requirements or guidelines..."
                                value={assignForm.description}
                                onChange={e => setAssignForm({ ...assignForm, description: e.target.value })}
                                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', outline: 'none', resize: 'vertical' }}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={submitting}
                            style={{
                                width: '100%',
                                backgroundColor: '#0f172a',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '12px',
                                fontWeight: 700,
                                fontSize: '0.9rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px'
                            }}
                        >
                            <Send size={16} /> {submitting ? 'Assigning...' : 'Assign Task to GD'}
                        </button>
                    </form>
                </div>
            )}

            {/* Rejection Notes Modal */}
            {rejectingItem && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
                    <div style={{ backgroundColor: 'white', borderRadius: '14px', padding: '28px', width: '100%', maxWidth: '480px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1.1rem', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <XCircle size={20} /> Reject & Provide Feedback
                            </h3>
                            <button onClick={() => setRejectingItem(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
                        </div>

                        <p style={{ fontSize: '0.88rem', color: '#475569', marginBottom: '14px' }}>
                            Provide feedback for <strong>{rejectingItem.task_title}</strong>. The Graphic Designer will receive a notification and can revise their work.
                        </p>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Rejection Reason / Required Fixes *</label>
                            <textarea
                                rows={4}
                                required
                                placeholder="Explain what changes are needed before this task can be accepted..."
                                value={rejectNotes}
                                onChange={e => setRejectNotes(e.target.value)}
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', outline: 'none' }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                type="button"
                                onClick={() => setRejectingItem(null)}
                                style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white', fontWeight: 700, cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleRejectSubmission}
                                disabled={submitting}
                                style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#dc2626', color: 'white', fontWeight: 700, cursor: 'pointer' }}
                            >
                                {submitting ? 'Sending...' : 'Confirm Rejection'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
