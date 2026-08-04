import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Plus,
    CheckCircle2,
    Clock,
    AlertTriangle,
    Layers,
    Send,
    Edit3,
    X,
    Calendar,
    Check,
    Play,
    Filter,
    Loader2
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { API_BASE_URL } from '../config';

interface SubTaskForm {
    title: string;
    start_date: string;
    duration_days: number;
}

export const MBTasks: React.FC = () => {
    const { user } = useAuth();
    const [tasks, setTasks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState<'submissions' | 'active_tasks'>('submissions');
    const [showAddModal, setShowAddModal] = useState(false);

    // Form state
    const [form, setForm] = useState({
        task_title: '',
        description: '',
        start_date: new Date().toISOString().split('T')[0],
        duration_days: 1,
        sub_tasks: [{ title: '', start_date: new Date().toISOString().split('T')[0], duration_days: 1 }] as SubTaskForm[]
    });

    // Modal state for editing rejected items
    const [editingItem, setEditingItem] = useState<any | null>(null);

    useEffect(() => {
        fetchTasks();
    }, []);

    const fetchTasks = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/mb-tasks`);
            if (res.data.success) {
                setTasks(res.data.data || []);
            }
        } catch (err) {
            console.error('Failed to fetch tasks', err);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenAddModal = () => {
        setForm({
            task_title: '',
            description: '',
            start_date: new Date().toISOString().split('T')[0],
            duration_days: 1,
            sub_tasks: [{ title: '', start_date: new Date().toISOString().split('T')[0], duration_days: 1 }]
        });
        setShowAddModal(true);
    };

    const handleSubmitTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.task_title.trim()) return;

        setSubmitting(true);
        try {
            const res = await axios.post(`${API_BASE_URL}/mb-tasks/submit`, {
                user_id: user?.user_id,
                employee_name: user?.name || 'Employee',
                role: user?.role || 'business_associate',
                task_title: form.task_title.trim(),
                description: form.description,
                start_date: form.start_date,
                duration_days: form.duration_days,
                sub_tasks: form.sub_tasks.filter(s => s.title.trim() !== '')
            });

            if (res.data.success) {
                alert('Task request submitted to Admin for approval!');
                setShowAddModal(false);
                fetchTasks();
            } else {
                alert('Failed to submit: ' + res.data.message);
            }
        } catch (err) {
            alert('Failed to submit task request.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleResubmitRejected = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingItem) return;

        setSubmitting(true);
        try {
            const res = await axios.post(`${API_BASE_URL}/mb-tasks/submit`, {
                user_id: user?.user_id,
                employee_name: user?.name || 'Employee',
                role: user?.role || 'business_associate',
                task_title: editingItem.task_title.trim(),
                description: editingItem.description,
                start_date: editingItem.start_date,
                duration_days: editingItem.duration_days,
                sub_tasks: (editingItem.sub_tasks || []).filter((s: any) => s.title.trim() !== '')
            });

            if (res.data.success) {
                alert('Revised task resubmitted to Admin for approval!');
                setEditingItem(null);
                fetchTasks();
            } else {
                alert('Failed to resubmit: ' + res.data.message);
            }
        } catch (err) {
            alert('Failed to resubmit task.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdateTaskStatus = async (taskId: number, newStatus: string) => {
        try {
            const res = await axios.post(`${API_BASE_URL}/mb-tasks/update-status`, {
                id: taskId,
                status: newStatus
            });
            if (res.data.success) {
                const displayStatus = newStatus === 'pending_completion_review' ? 'Submitted for Completion Review' : newStatus.replace('_', ' ');
                alert(`Task status updated to: ${displayStatus}!`);
                fetchTasks();
            } else {
                alert('Failed to update status: ' + res.data.message);
            }
        } catch (err) {
            alert('Failed to update task status.');
        }
    };

    const handleToggleSubTask = async (subtaskId: number, newStatus: 'pending' | 'completed') => {
        try {
            const res = await axios.post(`${API_BASE_URL}/mb-tasks/toggle-subtask`, {
                subtask_id: subtaskId,
                status: newStatus
            });
            if (res.data.success) {
                // Instantly update local state for fluidity
                setTasks(prev => prev.map(t => {
                    if (t.sub_tasks) {
                        return {
                            ...t,
                            sub_tasks: t.sub_tasks.map((st: any) => {
                                if (st.id === subtaskId) {
                                    return { ...st, status: newStatus };
                                }
                                return st;
                            })
                        };
                    }
                    return t;
                }));
            } else {
                alert('Failed to update subtask: ' + res.data.message);
            }
        } catch (err) {
            alert('Failed to update subtask status.');
        }
    };

    const pendingSubmissions = tasks.filter(t => ['pending_admin_review', 'rejected'].includes(t.status));
    const activeTasks = tasks.filter(t => ['accepted', 'ongoing', 'pending_completion_review', 'completed'].includes(t.status));

    // Stats calculations
    const statsSummary = {
        pending: pendingSubmissions.filter(t => t.status === 'pending_admin_review').length,
        rejected: pendingSubmissions.filter(t => t.status === 'rejected').length,
        active: activeTasks.filter(t => ['accepted', 'ongoing', 'pending_completion_review'].includes(t.status)).length,
        completed: activeTasks.filter(t => t.status === 'completed').length
    };

    const renderMiniTimeline = (status: string) => {
        const stages = [
            { key: 'proposed', color: '#3b82f6', label: 'Proposed' },
            { 
                key: 'approved', 
                color: status === 'rejected' ? '#ef4444' : '#10b981', 
                label: status === 'rejected' ? 'Rejected' : 'Approved',
                active: ['accepted', 'ongoing', 'pending_completion_review', 'completed'].includes(status) || status === 'rejected'
            },
            { key: 'ongoing', color: '#3b82f6', label: 'Ongoing', active: ['ongoing', 'pending_completion_review', 'completed'].includes(status) },
            { 
                key: 'completed', 
                color: status === 'pending_completion_review' ? '#d97706' : '#10b981', 
                label: status === 'pending_completion_review' ? 'Reviewing' : 'Completed', 
                active: ['pending_completion_review', 'completed'].includes(status) 
            }
        ];

        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {stages.map((stage, idx) => {
                    const isActive = idx === 0 || stage.active;
                    const isCurrent = (stage.key === 'proposed' && status === 'pending_admin_review') ||
                                      (stage.key === 'approved' && (status === 'accepted' || status === 'rejected')) ||
                                      (stage.key === 'ongoing' && status === 'ongoing') ||
                                      (stage.key === 'completed' && (status === 'completed' || status === 'pending_completion_review'));

                    return (
                        <React.Fragment key={idx}>
                            {idx > 0 && (
                                <div style={{ 
                                    width: '12px', 
                                    height: '2px', 
                                    backgroundColor: isActive ? '#475569' : '#e2e8f0' 
                                }} />
                            )}
                            <div 
                                title={stage.label}
                                style={{
                                    width: '10px',
                                    height: '10px',
                                    borderRadius: '50%',
                                    backgroundColor: isCurrent ? stage.color : (isActive ? '#475569' : '#cbd5e1'),
                                    border: isCurrent ? '2px solid #ffffff' : 'none',
                                    boxShadow: isCurrent ? '0 0 0 2px ' + stage.color : 'none',
                                    transition: 'all 0.2s'
                                }}
                            />
                        </React.Fragment>
                    );
                })}
            </div>
        );
    };

    const getStatusStyles = (status: string, end_date?: string) => {
        const isOverdue = ['accepted', 'ongoing'].includes(status) && end_date && new Date(end_date) < new Date();
        
        if (isOverdue) {
            return { bg: '#fee2e2', text: '#ef4444', label: 'Overdue' };
        }
        switch (status) {
            case 'completed': return { bg: '#dcfce7', text: '#16a34a', label: 'Completed' };
            case 'pending_completion_review': return { bg: '#fef9c3', text: '#d97706', label: 'Reviewing Completion' };
            case 'ongoing': return { bg: '#dbeafe', text: '#2563eb', label: 'Ongoing' };
            case 'accepted': return { bg: '#f1f5f9', text: '#475569', label: 'Approved' };
            case 'rejected': return { bg: '#fee2e2', text: '#ef4444', label: 'Rejected' };
            default: return { bg: '#fef9c3', text: '#d97706', label: 'Awaiting Review' };
        }
    };

    return (
        <div style={{ padding: '20px 0' }}>
            {/* Header / Stats Summary Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h2 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#253b50', margin: 0 }}>
                        Marketing & Business Task Manager
                    </h2>
                    <p style={{ color: '#6b7280', fontSize: '0.88rem', marginTop: '4px' }}>
                        Create goals, assign task timelines, and coordinate administrative approvals.
                    </p>
                </div>

                {user?.role !== 'admin' && (
                    <button 
                        onClick={handleOpenAddModal} 
                        className="btn-primary" 
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '8px', fontWeight: 600 }}
                    >
                        <Plus size={16} /> Propose New Task
                    </button>
                )}
            </div>


            {/* Main Tabs Toolbar */}
            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e5e7eb', paddingBottom: '12px', marginBottom: '20px' }}>
                <button
                    onClick={() => setActiveTab('submissions')}
                    style={{
                        padding: '8px 16px',
                        border: 'none',
                        borderBottom: activeTab === 'submissions' ? '2.5px solid #253b50' : '2.5px solid transparent',
                        backgroundColor: 'transparent',
                        color: activeTab === 'submissions' ? '#253b50' : '#6b7280',
                        fontWeight: activeTab === 'submissions' ? 700 : 500,
                        fontSize: '0.9rem',
                        cursor: 'pointer'
                    }}
                >
                    Submissions / Approvals ({pendingSubmissions.length})
                </button>
                <button
                    onClick={() => setActiveTab('active_tasks')}
                    style={{
                        padding: '8px 16px',
                        border: 'none',
                        borderBottom: activeTab === 'active_tasks' ? '2.5px solid #253b50' : '2.5px solid transparent',
                        backgroundColor: 'transparent',
                        color: activeTab === 'active_tasks' ? '#253b50' : '#6b7280',
                        fontWeight: activeTab === 'active_tasks' ? 700 : 500,
                        fontSize: '0.9rem',
                        cursor: 'pointer'
                    }}
                >
                    Active Tasks ({activeTasks.length})
                </button>
            </div>

            {/* List / Table Area */}
            <div className="premium-card" style={{ padding: '0px', overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px' }}>
                        <Loader2 className="animate-spin" size={32} style={{ color: '#253b50', marginRight: '10px' }} />
                        <span style={{ fontWeight: 500, color: '#4b5563' }}>Loading task schedules...</span>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                                    <th style={{ padding: '14px 16px', color: '#4b5563', fontWeight: 600, fontSize: '0.85rem' }}>Employee / Role</th>
                                    <th style={{ padding: '14px 16px', color: '#4b5563', fontWeight: 600, fontSize: '0.85rem' }}>Task Details / Description</th>
                                    <th style={{ padding: '14px 16px', color: '#4b5563', fontWeight: 600, fontSize: '0.85rem' }}>Schedule Dates</th>
                                    <th style={{ padding: '14px 16px', color: '#4b5563', fontWeight: 600, fontSize: '0.85rem' }}>Duration</th>
                                    <th style={{ padding: '14px 16px', color: '#4b5563', fontWeight: 600, fontSize: '0.85rem' }}>Approval Flow</th>
                                    <th style={{ padding: '14px 16px', color: '#4b5563', fontWeight: 600, fontSize: '0.85rem' }}>Status</th>
                                    <th style={{ padding: '14px 16px', color: '#4b5563', fontWeight: 600, fontSize: '0.85rem', textAlign: 'center' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {activeTab === 'submissions' ? (
                                    pendingSubmissions.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#6b7280', fontSize: '0.9rem' }}>
                                                No submissions or pending tasks registered.
                                            </td>
                                        </tr>
                                    ) : (
                                        pendingSubmissions.map((task) => {
                                            const statusInfo = getStatusStyles(task.status);
                                            return (
                                                <React.Fragment key={task.id}>
                                                    <tr style={{ borderBottom: '1px solid #f3f4f6', verticalAlign: 'top' }}>
                                                        <td style={{ padding: '16px' }}>
                                                            <div style={{ fontWeight: 600, color: '#111827', fontSize: '0.9rem' }}>{task.employee_name}</div>
                                                            <div style={{ fontSize: '0.78rem', color: '#9ca3af', textTransform: 'capitalize', marginTop: '2px' }}>
                                                                {task.role?.replace('_', ' ')}
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '16px', maxWidth: '320px' }}>
                                                            <div style={{ fontWeight: 600, color: '#111827', fontSize: '0.9rem' }}>{task.task_title}</div>
                                                            {task.description && (
                                                                <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '4px', whiteSpace: 'pre-wrap' }}>
                                                                    {task.description}
                                                                </div>
                                                            )}
                                                            {/* Subtasks view */}
                                                            {task.sub_tasks && task.sub_tasks.length > 0 && (
                                                                <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px dashed #e5e7eb', paddingTop: '10px' }}>
                                                                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Subtasks ({task.sub_tasks.filter((st: any) => st.status === 'completed').length}/{task.sub_tasks.length}):</div>
                                                                    {task.sub_tasks.map((st: any) => (
                                                                        <div key={st.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#6b7280' }}>
                                                                            <input type="checkbox" checked={st.status === 'completed'} disabled style={{ width: '12px', height: '12px' }} />
                                                                            <span style={{ textDecoration: st.status === 'completed' ? 'line-through' : 'none' }}>
                                                                                {st.title}
                                                                                {st.start_date && (
                                                                                    <span style={{ fontSize: '0.72rem', color: '#9ca3af', marginLeft: '6px', fontWeight: 400 }}>
                                                                                        ({new Date(st.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, {st.duration_days} Day{st.duration_days > 1 ? 's' : ''})
                                                                                    </span>
                                                                                )}
                                                                            </span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                            {task.status === 'rejected' && task.rejection_reason && (
                                                                <div style={{ marginTop: '10px', backgroundColor: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '6px', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#991b1b', fontWeight: 600 }}>
                                                                    <AlertTriangle size={13} /> <span><strong>Rejection Reason:</strong> {task.rejection_reason}</span>
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td style={{ padding: '16px', fontSize: '0.85rem', color: '#374151' }}>
                                                            {new Date(task.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} - {new Date(task.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                        </td>
                                                        <td style={{ padding: '16px', fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>
                                                            {task.duration_days} Day{task.duration_days > 1 ? 's' : ''}
                                                        </td>
                                                        <td style={{ padding: '16px' }}>
                                                            {renderMiniTimeline(task.status)}
                                                        </td>
                                                        <td style={{ padding: '16px' }}>
                                                            <span style={{ 
                                                                fontSize: '0.72rem', 
                                                                fontWeight: 700, 
                                                                padding: '4px 10px', 
                                                                borderRadius: '12px', 
                                                                backgroundColor: statusInfo.bg, 
                                                                color: statusInfo.text, 
                                                                textTransform: 'uppercase' 
                                                            }}>
                                                                {statusInfo.label}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '16px', textAlign: 'center' }}>
                                                            {task.status === 'rejected' && user?.role !== 'admin' ? (
                                                                <button
                                                                    onClick={() => setEditingItem({
                                                                        ...task,
                                                                        sub_tasks: task.sub_tasks ? task.sub_tasks.map((st: any) => ({
                                                                            title: st.title,
                                                                            start_date: st.start_date || task.start_date,
                                                                            duration_days: st.duration_days || 1
                                                                        })) : [{ title: '', start_date: task.start_date, duration_days: 1 }]
                                                                    })}
                                                                    style={{
                                                                        border: '1px solid #d1d5db',
                                                                        padding: '6px 12px',
                                                                        borderRadius: '6px',
                                                                        fontSize: '0.8rem',
                                                                        fontWeight: 600,
                                                                        color: '#374151',
                                                                        backgroundColor: 'white',
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        gap: '4px'
                                                                    }}
                                                                >
                                                                    <Edit3 size={12} /> Edit & Resubmit
                                                                </button>
                                                            ) : (
                                                                <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>-</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                </React.Fragment>
                                            );
                                        })
                                    )
                                ) : (
                                    activeTasks.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#6b7280', fontSize: '0.9rem' }}>
                                                No active task goals found.
                                            </td>
                                        </tr>
                                    ) : (
                                        activeTasks.map((task) => {
                                            const statusInfo = getStatusStyles(task.status, task.end_date);
                                            return (
                                                <React.Fragment key={task.id}>
                                                    <tr style={{ borderBottom: '1px solid #f3f4f6', verticalAlign: 'top' }}>
                                                        <td style={{ padding: '16px' }}>
                                                            <div style={{ fontWeight: 600, color: '#111827', fontSize: '0.9rem' }}>{task.employee_name}</div>
                                                            <div style={{ fontSize: '0.78rem', color: '#9ca3af', textTransform: 'capitalize', marginTop: '2px' }}>
                                                                {task.role?.replace('_', ' ')}
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '16px', maxWidth: '320px' }}>
                                                            <div style={{ fontWeight: 600, color: '#111827', fontSize: '0.9rem' }}>{task.task_title}</div>
                                                            {task.description && (
                                                                <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '4px', whiteSpace: 'pre-wrap' }}>
                                                                    {task.description}
                                                                </div>
                                                            )}
                                                            {/* Subtasks interactive checklist */}
                                                            {task.sub_tasks && task.sub_tasks.length > 0 && (
                                                                <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px dashed #e5e7eb', paddingTop: '10px' }}>
                                                                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Subtasks ({task.sub_tasks.filter((st: any) => st.status === 'completed').length}/{task.sub_tasks.length}):</div>
                                                                    {task.sub_tasks.map((st: any) => {
                                                                        const canToggle = user?.role !== 'admin' && ['accepted', 'ongoing'].includes(task.status);
                                                                        return (
                                                                            <label key={st.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: st.status === 'completed' ? '#9ca3af' : '#4b5563', cursor: canToggle ? 'pointer' : 'default' }}>
                                                                                <input 
                                                                                    type="checkbox" 
                                                                                    checked={st.status === 'completed'} 
                                                                                    disabled={!canToggle}
                                                                                    onChange={() => handleToggleSubTask(st.id, st.status === 'completed' ? 'pending' : 'completed')}
                                                                                    style={{ width: '12px', height: '12px', cursor: canToggle ? 'pointer' : 'default', accentColor: '#253b50' }} 
                                                                                />
                                                                                <span style={{ textDecoration: st.status === 'completed' ? 'line-through' : 'none' }}>
                                                                                    {st.title}
                                                                                    {st.start_date && (
                                                                                        <span style={{ fontSize: '0.72rem', color: '#9ca3af', marginLeft: '6px', fontWeight: 400 }}>
                                                                                            ({new Date(st.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, {st.duration_days} Day{st.duration_days > 1 ? 's' : ''})
                                                                                        </span>
                                                                                    )}
                                                                                </span>
                                                                            </label>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                            {task.status === 'ongoing' && task.rejection_reason && (
                                                                <div style={{ marginTop: '10px', backgroundColor: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '6px', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#991b1b', fontWeight: 600 }}>
                                                                    <AlertTriangle size={13} /> <span><strong>Completion Rejected:</strong> {task.rejection_reason}</span>
                                                                </div>
                                                            )}
                                                            {task.admin_notes && (
                                                                <div style={{ marginTop: '10px', backgroundColor: '#f0fdf4', border: '1px solid #dcfce7', borderRadius: '6px', padding: '8px 12px', fontSize: '0.78rem', color: '#15803d' }}>
                                                                    <strong>Admin Remarks:</strong> {task.admin_notes}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td style={{ padding: '16px', fontSize: '0.85rem', color: '#374151' }}>
                                                            {new Date(task.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} - {new Date(task.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                        </td>
                                                        <td style={{ padding: '16px', fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>
                                                            {task.duration_days} Day{task.duration_days > 1 ? 's' : ''}
                                                        </td>
                                                        <td style={{ padding: '16px' }}>
                                                            {renderMiniTimeline(task.status)}
                                                        </td>
                                                        <td style={{ padding: '16px' }}>
                                                            <span style={{ 
                                                                fontSize: '0.72rem', 
                                                                fontWeight: 700, 
                                                                padding: '4px 10px', 
                                                                borderRadius: '12px', 
                                                                backgroundColor: statusInfo.bg, 
                                                                color: statusInfo.text, 
                                                                textTransform: 'uppercase' 
                                                            }}>
                                                                {statusInfo.label}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '16px', textAlign: 'center' }}>
                                                            {user?.role !== 'admin' && (
                                                                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                                                                    {task.status === 'accepted' && (
                                                                        <button
                                                                            onClick={() => handleUpdateTaskStatus(task.id, 'ongoing')}
                                                                            style={{
                                                                                border: 'none',
                                                                                backgroundColor: '#2563eb',
                                                                                color: 'white',
                                                                                padding: '6px 12px',
                                                                                borderRadius: '6px',
                                                                                fontSize: '0.78rem',
                                                                                fontWeight: 600,
                                                                                display: 'inline-flex',
                                                                                alignItems: 'center',
                                                                                gap: '4px'
                                                                            }}
                                                                        >
                                                                            <Play size={12} /> Start Task
                                                                        </button>
                                                                    )}
                                                                    {task.status === 'ongoing' && (
                                                                        <button
                                                                            onClick={() => handleUpdateTaskStatus(task.id, 'pending_completion_review')}
                                                                            style={{
                                                                                border: 'none',
                                                                                backgroundColor: '#16a34a',
                                                                                color: 'white',
                                                                                padding: '6px 12px',
                                                                                borderRadius: '6px',
                                                                                fontSize: '0.78rem',
                                                                                fontWeight: 600,
                                                                                display: 'inline-flex',
                                                                                alignItems: 'center',
                                                                                gap: '4px'
                                                                            }}
                                                                        >
                                                                            <Check size={12} /> Submit Completion
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )}
                                                            {user?.role === 'admin' && (
                                                                <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>-</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                </React.Fragment>
                                            );
                                        })
                                    )
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ADD TASK MODAL (Employee Only) */}
            {showAddModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="premium-card" style={{ width: '100%', maxWidth: '640px', padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#253b50', margin: 0 }}>Propose Target Goal</h3>
                            <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSubmitTask}>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Task / Target Title *</label>
                                <input 
                                    type="text" 
                                    required 
                                    value={form.task_title} 
                                    onChange={(e) => setForm({ ...form, task_title: e.target.value })} 
                                    placeholder="e.g. Host Site Marketing Campaign" 
                                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', outline: 'none' }} 
                                />
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Description / Execution Steps</label>
                                <textarea 
                                    rows={3} 
                                    value={form.description} 
                                    onChange={(e) => setForm({ ...form, description: e.target.value })} 
                                    placeholder="Describe deliverables and goals..." 
                                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', outline: 'none', resize: 'none', fontFamily: 'inherit' }} 
                                />
                            </div>

                            {/* Sub-tasks entry */}
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#374151', marginBottom: '6px' }}>Subtasks</label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 80px 30px', gap: '8px', marginBottom: '6px' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280' }}>Title</span>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280' }}>Start Date</span>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280' }}>Days</span>
                                    <span></span>
                                </div>
                                {form.sub_tasks.map((sub, idx) => (
                                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 80px 30px', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                                        <input 
                                            type="text" 
                                            placeholder={`Subtask Name #${idx + 1}`}
                                            value={sub.title}
                                            onChange={(e) => {
                                                const newSubs = [...form.sub_tasks];
                                                newSubs[idx] = { ...newSubs[idx], title: e.target.value };
                                                setForm({ ...form, sub_tasks: newSubs });
                                            }}
                                            style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', outline: 'none' }}
                                        />
                                        <input 
                                            type="date" 
                                            value={sub.start_date}
                                            onChange={(e) => {
                                                const newSubs = [...form.sub_tasks];
                                                newSubs[idx] = { ...newSubs[idx], start_date: e.target.value };
                                                setForm({ ...form, sub_tasks: newSubs });
                                            }}
                                            style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', outline: 'none' }}
                                        />
                                        <input 
                                            type="number" 
                                            min={1}
                                            value={sub.duration_days}
                                            onChange={(e) => {
                                                const newSubs = [...form.sub_tasks];
                                                newSubs[idx] = { ...newSubs[idx], duration_days: parseInt(e.target.value) || 1 };
                                                setForm({ ...form, sub_tasks: newSubs });
                                            }}
                                            style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', outline: 'none' }}
                                        />
                                        {form.sub_tasks.length > 1 && (
                                            <button 
                                                type="button" 
                                                onClick={() => {
                                                    const newSubs = form.sub_tasks.filter((_, i) => i !== idx);
                                                    setForm({ ...form, sub_tasks: newSubs });
                                                }}
                                                style={{ background: 'none', border: 'none', color: '#ef4444', padding: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                            >
                                                <X size={16} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button 
                                    type="button" 
                                    onClick={() => setForm({ 
                                        ...form, 
                                        sub_tasks: [
                                            ...form.sub_tasks, 
                                            { 
                                                title: '', 
                                                start_date: form.start_date || new Date().toISOString().split('T')[0], 
                                                duration_days: 1 
                                            }
                                        ] 
                                    })}
                                    style={{ background: 'none', border: 'none', color: '#253b50', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: 0 }}
                                >
                                    + Add Subtask
                                </button>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Planned Start Date</label>
                                    <input 
                                        type="date" 
                                        value={form.start_date} 
                                        onChange={(e) => setForm({ ...form, start_date: e.target.value })} 
                                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', outline: 'none' }} 
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Duration (Days)</label>
                                    <input 
                                        type="number" 
                                        min={1} 
                                        value={form.duration_days} 
                                        onChange={(e) => setForm({ ...form, duration_days: parseInt(e.target.value) || 1 })} 
                                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', outline: 'none' }} 
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                <button type="button" onClick={() => setShowAddModal(false)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: 'white', fontSize: '0.88rem' }}>Cancel</button>
                                <button type="submit" disabled={submitting} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem' }}>
                                    {submitting && <Loader2 className="animate-spin" size={14} />}
                                    Submit Request
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* EDIT MODAL (Employee Only) */}
            {editingItem && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="premium-card" style={{ width: '100%', maxWidth: '640px', padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#253b50', margin: 0 }}>Edit & Resubmit Goal</h3>
                            <button onClick={() => setEditingItem(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleResubmitRejected}>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Task Name *</label>
                                <input 
                                    type="text" 
                                    required 
                                    value={editingItem.task_title} 
                                    onChange={(e) => setEditingItem({ ...editingItem, task_title: e.target.value })} 
                                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', outline: 'none' }} 
                                />
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Description</label>
                                <textarea 
                                    rows={3} 
                                    value={editingItem.description} 
                                    onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })} 
                                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', outline: 'none', resize: 'none', fontFamily: 'inherit' }} 
                                />
                            </div>

                            {/* Subtasks Edit list */}
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#374151', marginBottom: '6px' }}>Subtasks</label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 80px 30px', gap: '8px', marginBottom: '6px' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280' }}>Title</span>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280' }}>Start Date</span>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280' }}>Days</span>
                                    <span></span>
                                </div>
                                {(editingItem.sub_tasks || []).map((sub: any, idx: number) => (
                                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 80px 30px', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                                        <input 
                                            type="text" 
                                            placeholder={`Subtask Name #${idx + 1}`}
                                            value={sub.title}
                                            onChange={(e) => {
                                                const newSubs = [...editingItem.sub_tasks];
                                                newSubs[idx] = { ...newSubs[idx], title: e.target.value };
                                                setEditingItem({ ...editingItem, sub_tasks: newSubs });
                                            }}
                                            style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', outline: 'none' }}
                                        />
                                        <input 
                                            type="date" 
                                            value={sub.start_date}
                                            onChange={(e) => {
                                                const newSubs = [...editingItem.sub_tasks];
                                                newSubs[idx] = { ...newSubs[idx], start_date: e.target.value };
                                                setEditingItem({ ...editingItem, sub_tasks: newSubs });
                                            }}
                                            style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', outline: 'none' }}
                                        />
                                        <input 
                                            type="number" 
                                            min={1}
                                            value={sub.duration_days}
                                            onChange={(e) => {
                                                const newSubs = [...editingItem.sub_tasks];
                                                newSubs[idx] = { ...newSubs[idx], duration_days: parseInt(e.target.value) || 1 };
                                                setEditingItem({ ...editingItem, sub_tasks: newSubs });
                                            }}
                                            style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', outline: 'none' }}
                                        />
                                        {(editingItem.sub_tasks || []).length > 1 && (
                                            <button 
                                                type="button" 
                                                onClick={() => {
                                                    const newSubs = editingItem.sub_tasks.filter((_: any, i: number) => i !== idx);
                                                    setEditingItem({ ...editingItem, sub_tasks: newSubs });
                                                }}
                                                style={{ background: 'none', border: 'none', color: '#ef4444', padding: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                            >
                                                <X size={16} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button 
                                    type="button" 
                                    onClick={() => setEditingItem({ 
                                        ...editingItem, 
                                        sub_tasks: [
                                            ...(editingItem.sub_tasks || []), 
                                            { 
                                                title: '', 
                                                start_date: editingItem.start_date || new Date().toISOString().split('T')[0], 
                                                duration_days: 1 
                                            }
                                        ] 
                                    })}
                                    style={{ background: 'none', border: 'none', color: '#253b50', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: 0 }}
                                >
                                    + Add Subtask
                                </button>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Start Date</label>
                                    <input 
                                        type="date" 
                                        value={editingItem.start_date} 
                                        onChange={(e) => setEditingItem({ ...editingItem, start_date: e.target.value })} 
                                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', outline: 'none' }} 
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>Duration (Days)</label>
                                    <input 
                                        type="number" 
                                        min={1} 
                                        value={editingItem.duration_days} 
                                        onChange={(e) => setEditingItem({ ...editingItem, duration_days: parseInt(e.target.value) || 1 })} 
                                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', outline: 'none' }} 
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                <button type="button" onClick={() => setEditingItem(null)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: 'white', fontSize: '0.88rem' }}>Cancel</button>
                                <button type="submit" disabled={submitting} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem' }}>
                                    {submitting && <Loader2 className="animate-spin" size={14} />}
                                    Resubmit Request
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
