import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    PlusCircle,
    CheckCircle2,
    Clock,
    AlertTriangle,
    Layers,
    FileText,
    Send,
    Edit3,
    X,
    Calendar,
    Link,
    Filter,
    Check
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { API_BASE_URL } from '../config';

export const GDTasks: React.FC = () => {
    const { user } = useAuth();

    const [tasks, setTasks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState<'submissions' | 'active_tasks'>('submissions');
    const [timeframeFilter, setTimeframeFilter] = useState<'all' | 'today' | 'weekly' | 'monthly'>('all');

    // New target submission form state
    const [form, setForm] = useState({
        task_title: '',
        description: '',
        target_type: 'daily',
        target_date: new Date().toISOString().split('T')[0],
        attachment_url: ''
    });

    // Modal state for editing rejected items
    const [editingItem, setEditingItem] = useState<any | null>(null);

    useEffect(() => {
        fetchTasks();
    }, []);

    const fetchTasks = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/gd-tasks`);
            if (res.data.success) {
                setTasks(res.data.data || []);
            }
        } catch (err) {
            console.error('Failed to fetch tasks', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmitTarget = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.task_title.trim()) return;

        setSubmitting(true);
        try {
            const res = await axios.post(`${API_BASE_URL}/gd-tasks/submit`, {
                user_id: user?.user_id,
                gd_name: user?.name || 'Graphic Designer',
                task_title: form.task_title.trim(),
                description: form.description,
                target_type: form.target_type,
                target_date: form.target_date,
                attachment_url: form.attachment_url
            });

            if (res.data.success) {
                alert('Target work submitted to Admin for review!');
                setForm({
                    task_title: '',
                    description: '',
                    target_type: 'daily',
                    target_date: new Date().toISOString().split('T')[0],
                    attachment_url: ''
                });
                fetchTasks();
            } else {
                alert('Failed to submit: ' + res.data.message);
            }
        } catch (err) {
            alert('Failed to submit target work.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleResubmitRejected = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingItem) return;

        setSubmitting(true);
        try {
            const res = await axios.post(`${API_BASE_URL}/gd-tasks/submit`, {
                user_id: user?.user_id,
                gd_name: user?.name || 'Graphic Designer',
                task_title: editingItem.task_title,
                description: editingItem.description,
                target_type: editingItem.target_type,
                target_date: editingItem.target_date,
                attachment_url: editingItem.attachment_url
            });

            if (res.data.success) {
                alert('Revised work resubmitted to Admin for review!');
                setEditingItem(null);
                fetchTasks();
            }
        } catch (err) {
            alert('Failed to resubmit work.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdateTaskStatus = async (taskId: number, newStatus: string) => {
        try {
            const res = await axios.post(`${API_BASE_URL}/gd-tasks/update-status`, {
                id: taskId,
                status: newStatus
            });
            if (res.data.success) {
                if (newStatus === 'pending_completion_approval') {
                    alert('Completion submitted! Admin has been notified to review and approve.');
                }
                fetchTasks();
            }
        } catch (err) {
            alert('Failed to update task status.');
        }
    };

    // Filter tasks based on selected timeframe
    const filterByTimeframe = (items: any[]) => {
        return items.filter(t => {
            if (timeframeFilter === 'all') return true;
            const d = new Date(t.target_date || t.created_at);
            const today = new Date();
            if (timeframeFilter === 'today') {
                return d.toDateString() === today.toDateString();
            }
            if (timeframeFilter === 'weekly') {
                const weekAgo = new Date(today.setDate(today.getDate() - 7));
                return d >= weekAgo;
            }
            if (timeframeFilter === 'monthly') {
                return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
            }
            return true;
        });
    };

    const targetSubmissions = filterByTimeframe(tasks.filter(t => ['pending_admin_review', 'rejected'].includes(t.status)));
    const activeTasks = filterByTimeframe(tasks.filter(t => ['accepted', 'ongoing', 'pending_completion_approval', 'completed', 'incomplete'].includes(t.status)));

    return (
        <div style={{ padding: '24px', maxWidth: '1280px', margin: '0 auto', color: '#1e293b' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                        Graphic Designer Tasks & Target Submissions
                    </h1>
                    <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: '#64748b' }}>
                        Submit daily, weekly, or monthly targets to Admin and manage ongoing design tasks.
                    </p>
                </div>

                {/* Main Tabs */}
                <div style={{ display: 'flex', backgroundColor: '#e2e8f0', borderRadius: '10px', padding: '4px' }}>
                    <button
                        onClick={() => setActiveTab('submissions')}
                        style={{
                            border: 'none',
                            padding: '8px 20px',
                            borderRadius: '8px',
                            fontSize: '0.88rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            backgroundColor: activeTab === 'submissions' ? '#ffffff' : 'transparent',
                            color: activeTab === 'submissions' ? '#0f172a' : '#64748b',
                            boxShadow: activeTab === 'submissions' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'
                        }}
                    >
                        Target Submissions ({targetSubmissions.length})
                    </button>

                    <button
                        onClick={() => setActiveTab('active_tasks')}
                        style={{
                            border: 'none',
                            padding: '8px 20px',
                            borderRadius: '8px',
                            fontSize: '0.88rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            backgroundColor: activeTab === 'active_tasks' ? '#ffffff' : 'transparent',
                            color: activeTab === 'active_tasks' ? '#0f172a' : '#64748b',
                            boxShadow: activeTab === 'active_tasks' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'
                        }}
                    >
                        Active Tasks ({activeTasks.length})
                    </button>
                </div>
            </div>

            {/* Sub-Filter (Timeframe) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: '12px 18px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 700, color: '#475569' }}>
                    <Filter size={16} /> Filter by Schedule:
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    {[
                        { key: 'all', label: 'All' },
                        { key: 'today', label: 'Today' },
                        { key: 'weekly', label: 'This Week' },
                        { key: 'monthly', label: 'This Month' }
                    ].map(tf => (
                        <button
                            key={tf.key}
                            onClick={() => setTimeframeFilter(tf.key as any)}
                            style={{
                                border: '1px solid #cbd5e1',
                                padding: '5px 12px',
                                borderRadius: '6px',
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                backgroundColor: timeframeFilter === tf.key ? '#0f172a' : '#ffffff',
                                color: timeframeFilter === tf.key ? '#ffffff' : '#334155'
                            }}
                        >
                            {tf.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* TAB 1: TARGET SUBMISSIONS */}
            {activeTab === 'submissions' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
                    {/* Submit Target Form */}
                    <div style={{ backgroundColor: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', height: 'fit-content' }}>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <PlusCircle size={20} style={{ color: '#2563eb' }} /> Submit Target Work to Admin
                        </h3>

                        <form onSubmit={handleSubmitTarget}>
                            <div style={{ marginBottom: '14px' }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Target Schedule Type</label>
                                <select
                                    value={form.target_type}
                                    onChange={e => setForm({ ...form, target_type: e.target.value })}
                                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', outline: 'none' }}
                                >
                                    <option value="daily">Daily Target / Today's Work</option>
                                    <option value="weekly">Weekly Target Work</option>
                                    <option value="monthly">Monthly Target Work</option>
                                </select>
                            </div>

                            <div style={{ marginBottom: '14px' }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Work / Design Title *</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. 3D Living Room Social Banner / Kitchen Masking File..."
                                    value={form.task_title}
                                    onChange={e => setForm({ ...form, task_title: e.target.value })}
                                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', outline: 'none' }}
                                />
                            </div>

                            <div style={{ marginBottom: '14px' }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Target Date</label>
                                <input
                                    type="date"
                                    required
                                    value={form.target_date}
                                    onChange={e => setForm({ ...form, target_date: e.target.value })}
                                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', outline: 'none' }}
                                />
                            </div>

                            <div style={{ marginBottom: '14px' }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Work Description & Details</label>
                                <textarea
                                    rows={3}
                                    placeholder="Describe the graphics, revisions, dimensions, or design concept..."
                                    value={form.description}
                                    onChange={e => setForm({ ...form, description: e.target.value })}
                                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', outline: 'none', resize: 'vertical' }}
                                />
                            </div>

                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>Attachment / Artwork Drive URL (Optional)</label>
                                <input
                                    type="url"
                                    placeholder="https://drive.google.com/file/... or Figma link"
                                    value={form.attachment_url}
                                    onChange={e => setForm({ ...form, attachment_url: e.target.value })}
                                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', outline: 'none' }}
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
                                <Send size={16} /> {submitting ? 'Submitting to Admin...' : 'Submit Target Work'}
                            </button>
                        </form>
                    </div>

                    {/* Submissions List */}
                    <div>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                            Submitted Work Status ({targetSubmissions.length})
                        </h3>

                        {loading ? (
                            <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>Loading submissions...</div>
                        ) : targetSubmissions.length === 0 ? (
                            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px dashed #cbd5e1', padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>
                                No pending target submissions. Use the form to send work to Admin for approval.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                {targetSubmissions.map(item => (
                                    <div key={item.id} style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                            <div>
                                                <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#f1f5f9', color: '#475569' }}>
                                                    {item.target_type} Target
                                                </span>
                                                <h4 style={{ margin: '6px 0 0', fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>{item.task_title}</h4>
                                            </div>

                                            {item.status === 'pending_admin_review' && (
                                                <span style={{ backgroundColor: '#fef3c7', color: '#b45309', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Clock size={12} /> Pending Review
                                                </span>
                                            )}

                                            {item.status === 'rejected' && (
                                                <span style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <AlertTriangle size={12} /> Rejected (Needs Fix)
                                                </span>
                                            )}
                                        </div>

                                        {item.description && (
                                            <p style={{ fontSize: '0.85rem', color: '#475569', margin: '0 0 10px 0', lineHeight: '1.4' }}>{item.description}</p>
                                        )}

                                        {item.attachment_url && (
                                            <div style={{ marginBottom: '10px' }}>
                                                <a href={item.attachment_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: '#2563eb', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
                                                    <Link size={12} /> View Artwork Attachment
                                                </a>
                                            </div>
                                        )}

                                        {/* Rejection Notes Box */}
                                        {item.status === 'rejected' && (
                                            <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '12px', marginTop: '10px' }}>
                                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#991b1b', marginBottom: '4px' }}>Admin Feedback Notes:</div>
                                                <div style={{ fontSize: '0.82rem', color: '#7f1d1d' }}>{item.rejection_reason || item.admin_notes || 'Please revise your target design.'}</div>

                                                <button
                                                    onClick={() => setEditingItem({ ...item })}
                                                    style={{
                                                        marginTop: '10px',
                                                        backgroundColor: '#dc2626',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '6px',
                                                        padding: '6px 14px',
                                                        fontSize: '0.78rem',
                                                        fontWeight: 700,
                                                        cursor: 'pointer',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }}
                                                >
                                                    <Edit3 size={13} /> Revise & Resubmit
                                                </button>
                                            </div>
                                        )}

                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '10px', borderTop: '1px solid #f1f5f9', paddingTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
                                            <span>Target Date: {item.target_date || 'N/A'}</span>
                                            <span>Submitted: {new Date(item.created_at).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB 2: ACTIVE TASKS */}
            {activeTab === 'active_tasks' && (
                <div>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                        Accepted GD Tasks List ({activeTasks.length})
                    </h3>

                    {loading ? (
                        <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>Loading active tasks...</div>
                    ) : activeTasks.length === 0 ? (
                        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px dashed #cbd5e1', padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>
                            No active tasks yet. Once Admin accepts your target submissions, they will appear here as ongoing tasks!
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px' }}>
                            {activeTasks.map(task => {
                                const isOngoing = task.status === 'accepted' || task.status === 'ongoing';
                                const isPendingApproval = task.status === 'pending_completion_approval';
                                const isCompleted = task.status === 'completed';

                                return (
                                    <div key={task.id} style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                                                <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#e0f2fe', color: '#0369a1' }}>
                                                    {task.target_type} Task
                                                </span>

                                                {isOngoing && (
                                                    <span style={{ backgroundColor: '#e0f2fe', color: '#0369a1', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700 }}>
                                                        Ongoing
                                                    </span>
                                                )}

                                                {isPendingApproval && (
                                                    <span style={{ backgroundColor: '#fef3c7', color: '#b45309', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700 }}>
                                                        Completion Review
                                                    </span>
                                                )}

                                                {isCompleted && (
                                                    <span style={{ backgroundColor: '#dcfce7', color: '#15803d', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700 }}>
                                                        Completed ✓
                                                    </span>
                                                )}
                                            </div>

                                            <h4 style={{ margin: '0 0 8px 0', fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>{task.task_title}</h4>
                                            {task.description && <p style={{ fontSize: '0.85rem', color: '#475569', margin: '0 0 12px 0', lineHeight: '1.4' }}>{task.description}</p>}

                                            {task.attachment_url && (
                                                <div style={{ marginBottom: '12px' }}>
                                                    <a href={task.attachment_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: '#2563eb', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
                                                        <Link size={12} /> View Design File
                                                    </a>
                                                </div>
                                            )}

                                            {task.admin_notes && (
                                                <div style={{ backgroundColor: '#f8fafc', padding: '8px 12px', borderRadius: '6px', fontSize: '0.78rem', color: '#64748b', marginBottom: '12px' }}>
                                                    <strong>Admin Note:</strong> {task.admin_notes}
                                                </div>
                                            )}
                                        </div>

                                        {/* Status Action Buttons */}
                                        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px', marginTop: '10px' }}>
                                            {isOngoing && (
                                                <button
                                                    onClick={() => handleUpdateTaskStatus(task.id, 'pending_completion_approval')}
                                                    style={{
                                                        width: '100%',
                                                        backgroundColor: '#16a34a',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '8px',
                                                        padding: '9px',
                                                        fontSize: '0.82rem',
                                                        fontWeight: 700,
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '6px'
                                                    }}
                                                >
                                                    <CheckCircle2 size={16} /> Mark Done & Send for Admin Approval
                                                </button>
                                            )}

                                            {isPendingApproval && (
                                                <div style={{ fontSize: '0.8rem', color: '#b45309', fontWeight: 600, textAlign: 'center', backgroundColor: '#fffbeb', padding: '8px', borderRadius: '6px' }}>
                                                    ⏳ Completion sent to Admin! Waiting for sign-off.
                                                </div>
                                            )}

                                            {isCompleted && (
                                                <div style={{ fontSize: '0.8rem', color: '#15803d', fontWeight: 700, textAlign: 'center', backgroundColor: '#f0fdf4', padding: '8px', borderRadius: '6px' }}>
                                                    ✓ Verified & Completed by Admin
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Modal for Editing Rejected Item */}
            {editingItem && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
                    <div style={{ backgroundColor: 'white', borderRadius: '14px', padding: '28px', width: '100%', maxWidth: '500px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1.1rem', color: '#0f172a' }}>Revise & Resubmit Rejected Target</h3>
                            <button onClick={() => setEditingItem(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
                        </div>

                        <form onSubmit={handleResubmitRejected}>
                            <div style={{ marginBottom: '14px' }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Task Title</label>
                                <input
                                    type="text"
                                    required
                                    value={editingItem.task_title}
                                    onChange={e => setEditingItem({ ...editingItem, task_title: e.target.value })}
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                                />
                            </div>

                            <div style={{ marginBottom: '14px' }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Target Description / Fixes</label>
                                <textarea
                                    rows={3}
                                    value={editingItem.description || ''}
                                    onChange={e => setEditingItem({ ...editingItem, description: e.target.value })}
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                                />
                            </div>

                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Updated Attachment URL</label>
                                <input
                                    type="url"
                                    value={editingItem.attachment_url || ''}
                                    onChange={e => setEditingItem({ ...editingItem, attachment_url: e.target.value })}
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button
                                    type="button"
                                    onClick={() => setEditingItem(null)}
                                    style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white', fontWeight: 700, cursor: 'pointer' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#dc2626', color: 'white', fontWeight: 700, cursor: 'pointer' }}
                                >
                                    {submitting ? 'Resubmitting...' : 'Resubmit Work'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
